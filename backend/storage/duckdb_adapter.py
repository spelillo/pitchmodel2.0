"""DuckDB storage adapter for Statcast pitch data.

A single embedded database file — no server, no cloud credentials, no
per-spreadsheet cell limits. Chosen over Google Sheets because raw
pitch-level data for even one season (~770k rows) blows past Sheets'
10M-cell cap; a full 3-year backfill would need roughly 37M cells.

Table: statcast_pitches. Its schema is derived automatically from
whatever DataFrame is first passed to load() — see fetch_statcast.py's
REQUIRED_COLUMNS for the actual column list — so the two files never need
to be kept in sync by hand.

Dedup key: (game_pk, at_bat_number, pitch_number), the triple that
uniquely identifies one pitch. A unique index on that triple plus
`ON CONFLICT ... DO NOTHING` makes load() idempotent: re-running a
backfill or the weekly sync over already-loaded dates inserts nothing new.
"""

from __future__ import annotations

import os
from pathlib import Path

import duckdb
import pandas as pd
import requests

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "pitchmodel.duckdb"

TABLE_NAME = "statcast_pitches"
PRIMARY_KEY_COLUMNS = ("game_pk", "at_bat_number", "pitch_number")

# The spec's requested composite index for the KNN engine's situational
# lookups.
SITUATION_INDEX_COLUMNS = ("player_name", "stand", "balls", "strikes")

# Render's Free/Starter tiers have no persistent disk, so the .duckdb
# file (gitignored — too large/binary for git, and regenerable) has to
# come from somewhere on every cold start. Default assumes the backfill
# is published as a GitHub Release asset tagged "db-latest" — always the
# same tag, so republishing a fresh backfill there never requires
# reconfiguring this URL. Override via the PITCHMODEL_DB_URL env var to
# point at a different release (e.g. after a rename, or for local
# testing against a smaller sample release).
DEFAULT_DB_DOWNLOAD_URL = (
    "https://github.com/spelillo/pitchmodel2.0/releases/download/db-latest/pitchmodel.duckdb"
)
DOWNLOAD_CHUNK_BYTES = 1024 * 1024  # 1 MB — stream to disk, never buffer the whole file in memory


def ensure_db_present(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Download the .duckdb file from a GitHub Release if it isn't
    already on disk. A no-op on local dev or any host with a persistent
    disk, where the file just already exists after the first run.

    Streams to a temp file and only renames it into place once the
    download completes in full — so a connection drop mid-download
    can never leave a truncated file sitting at db_path that a later
    restart would mistake for a valid, already-present database.
    """
    if db_path.exists():
        return

    url = os.environ.get("PITCHMODEL_DB_URL", DEFAULT_DB_DOWNLOAD_URL)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = db_path.with_suffix(".duckdb.part")

    # No content-length completeness check here on purpose: GitHub can
    # transfer-compress responses (e.g. raw.githubusercontent.com gzips
    # text), in which case Content-Length reflects the compressed size
    # while iter_content() yields decompressed bytes — comparing the two
    # produces false "incomplete download" failures on a fully successful
    # transfer. requests already raises (ChunkedEncodingError, etc.) if
    # the connection actually drops mid-stream, which is what leaves
    # tmp_path orphaned below rather than getting renamed into place.
    print(f"{db_path} not found locally — downloading from {url} ...")
    written_bytes = 0
    try:
        with requests.get(url, stream=True, timeout=120) as resp:
            resp.raise_for_status()
            with open(tmp_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=DOWNLOAD_CHUNK_BYTES):
                    f.write(chunk)
                    written_bytes += len(chunk)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise

    tmp_path.rename(db_path)
    print(f"Downloaded {written_bytes / 1024**2:.1f} MB to {db_path}")


def _ensure_schema(con: duckdb.DuckDBPyConnection, incoming: pd.DataFrame) -> None:
    con.register("incoming", incoming)
    con.execute(f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} AS SELECT * FROM incoming WHERE 0 = 1")
    pk_cols = ", ".join(PRIMARY_KEY_COLUMNS)
    con.execute(
        f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{TABLE_NAME}_pk ON {TABLE_NAME} ({pk_cols})"
    )
    situation_cols = ", ".join(SITUATION_INDEX_COLUMNS)
    con.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{TABLE_NAME}_situation "
        f"ON {TABLE_NAME} ({situation_cols})"
    )


def load(df: pd.DataFrame, db_path: Path = DEFAULT_DB_PATH) -> int:
    """Upsert df's rows into the statcast_pitches table.

    Returns the number of *new* rows actually inserted — duplicates
    (already-loaded pitches) are silently skipped, not counted.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(db_path))
    try:
        _ensure_schema(con, df)

        before = con.execute(f"SELECT count(*) FROM {TABLE_NAME}").fetchone()[0]

        con.register("incoming", df)
        pk_cols = ", ".join(PRIMARY_KEY_COLUMNS)
        con.execute(
            f"INSERT INTO {TABLE_NAME} SELECT * FROM incoming "
            f"ON CONFLICT ({pk_cols}) DO NOTHING"
        )

        after = con.execute(f"SELECT count(*) FROM {TABLE_NAME}").fetchone()[0]
        return after - before
    finally:
        con.close()


def row_count(db_path: Path = DEFAULT_DB_PATH) -> int:
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        return con.execute(f"SELECT count(*) FROM {TABLE_NAME}").fetchone()[0]
    finally:
        con.close()
