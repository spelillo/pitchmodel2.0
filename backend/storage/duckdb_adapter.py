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

from pathlib import Path

import duckdb
import pandas as pd

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "pitchmodel.duckdb"

TABLE_NAME = "statcast_pitches"
PRIMARY_KEY_COLUMNS = ("game_pk", "at_bat_number", "pitch_number")

# The spec's requested composite index for the KNN engine's situational
# lookups.
SITUATION_INDEX_COLUMNS = ("player_name", "stand", "balls", "strikes")


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
