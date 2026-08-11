"""Pull Statcast pitch-by-pitch data via pybaseball, validate it against
the fields PitchModel's prediction engine needs, and optionally load it
into backend/data/pitchmodel.duckdb.

Two ways to pick a date range:
  - Explicit --start/--end: a one-off backfill (initial load, or filling
    a specific gap).
  - --since-last: for routine syncs. Reads the latest game_date already
    in the target duckdb and resumes the day after it, so nobody has to
    hand-pick (and remember to update) a date range. This is what
    .github/workflows/sync-statcast.yml runs on a schedule.

Wide ranges go through fetch_range_chunked() (Statcast pulls get
slow/unreliable over very wide ranges) — it splits into --chunk-days
windows, pauses briefly between requests, and concatenates.

Usage:
    python backend/etl/fetch_statcast.py
    python backend/etl/fetch_statcast.py --start 2025-06-01 --end 2025-06-03
    python backend/etl/fetch_statcast.py --start 2023-04-01 --end 2025-10-01 --chunk-days 3 --load-duckdb
    python backend/etl/fetch_statcast.py --since-last --end 2026-08-09 --load-duckdb
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
from pybaseball import statcast

# Lets `from storage.duckdb_adapter import load` resolve when this file is
# run directly (`python backend/etl/fetch_statcast.py`) rather than as
# part of an installed package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Duplicated from storage.duckdb_adapter.DEFAULT_DB_PATH (same value)
# rather than imported, so that module — and its unconditional `import
# duckdb` — only loads lazily, inside the code paths that actually touch
# the database (--load-duckdb, --since-last). Everyone else, and the
# --db-path default below, doesn't need duckdb installed at all.
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "pitchmodel.duckdb"

# Columns the prediction engine's situational model and pitch-type target
# need. Cross-referenced against the system spec's "Extraction Fields"
# list and src/types/api.ts. inning_topbot isn't in the spec's list
# verbatim but is required to build the inning-penalty match string
# (game state needs top/bottom, not just the inning number).
# game_pk + at_bat_number + pitch_number together uniquely identify a
# single pitch — that triple is this table's natural key, and what
# backend/storage/duckdb_adapter.py dedupes on so re-running a backfill
# or the weekly sync never inserts the same pitch twice.
REQUIRED_COLUMNS = [
    "game_pk",
    "at_bat_number",
    "pitch_number",
    "game_date",
    "player_name",  # pitcher's name
    "pitcher",  # pitcher MLBAM id
    "batter",  # batter MLBAM id
    "stand",  # batter handedness: 'L' / 'R'
    "p_throws",  # pitcher handedness: 'L' / 'R'
    "balls",
    "strikes",
    "outs_when_up",
    "inning",
    "inning_topbot",  # 'Top' / 'Bot'
    "on_1b",
    "on_2b",
    "on_3b",
    "pitch_type",  # Statcast's short code, e.g. 'FF', 'SL'
    "pitch_name",  # human-readable name, e.g. 'Four-Seam Fastball'
]

DEFAULT_SAMPLE_DAYS = 3
DEFAULT_CHUNK_DAYS = 3
PAUSE_BETWEEN_CHUNKS_SEC = 2

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "samples"


def compute_since_last(db_path: Path = DEFAULT_DB_PATH) -> str:
    """The day after the latest game_date already loaded into db_path.

    Lets the weekly sync always pick up exactly where the last run left
    off, instead of a hand-picked --start that has to be remembered and
    updates the moment someone forgets it (the exact bug that let a
    ~4-month hole open up in the 2026 backfill).
    """
    import duckdb

    from storage.duckdb_adapter import TABLE_NAME

    if not db_path.exists():
        raise SystemExit(
            f"--since-last requires an existing database at {db_path} to read the "
            "last-loaded date from — run an initial backfill with an explicit "
            "--start/--end first."
        )
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        tables = con.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_name = ?",
            [TABLE_NAME],
        ).fetchall()
        if not tables:
            raise SystemExit(
                f"--since-last requires {db_path} to already contain the "
                f"'{TABLE_NAME}' table — run an initial backfill first."
            )
        (max_date,) = con.execute(f"SELECT max(game_date) FROM {TABLE_NAME}").fetchone()
    finally:
        con.close()

    if max_date is None:
        raise SystemExit(f"{TABLE_NAME} in {db_path} is empty — run an initial backfill first.")

    next_date = max_date + timedelta(days=1)
    return next_date.isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    today = date.today()
    default_end = today - timedelta(days=1)
    default_start = default_end - timedelta(days=DEFAULT_SAMPLE_DAYS - 1)
    parser.add_argument("--start", default=default_start.isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--end", default=default_end.isoformat(), help="YYYY-MM-DD")
    parser.add_argument(
        "--since-last",
        action="store_true",
        help=(
            "ignore --start and instead resume the day after the latest game_date "
            "already loaded into the target database (see --load-duckdb / db-path)"
        ),
    )
    parser.add_argument(
        "--chunk-days",
        type=int,
        default=DEFAULT_CHUNK_DAYS,
        help="split the range into windows this many days wide (default: %(default)s)",
    )
    parser.add_argument(
        "--load-duckdb",
        action="store_true",
        help="also upsert the pulled rows into backend/data/pitchmodel.duckdb",
    )
    parser.add_argument(
        "--db-path",
        type=Path,
        default=DEFAULT_DB_PATH,
        help="duckdb file to read/write (default: %(default)s)",
    )
    args = parser.parse_args()
    if args.since_last:
        args.start = compute_since_last(args.db_path)
    return args


def fetch(start: str, end: str) -> pd.DataFrame:
    print(f"Pulling Statcast data {start} -> {end} ...")
    df = statcast(start_dt=start, end_dt=end)
    print(f"Retrieved {len(df)} rows, {len(df.columns)} columns")
    return df


def fetch_range_chunked(start: str, end: str, chunk_days: int) -> pd.DataFrame:
    """Pull [start, end] in chunk_days-wide windows and concatenate.

    Statcast's export gets slow/unreliable over wide date ranges, so a
    multi-season backfill needs to go through in smaller bites with a
    short pause between requests rather than one huge call.
    """
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    if start_date > end_date:
        raise SystemExit(f"--start ({start}) is after --end ({end})")

    windows: list[tuple[date, date]] = []
    cursor = start_date
    while cursor <= end_date:
        window_end = min(cursor + timedelta(days=chunk_days - 1), end_date)
        windows.append((cursor, window_end))
        cursor = window_end + timedelta(days=1)

    print(f"Pulling {start} -> {end} in {len(windows)} chunk(s) of up to {chunk_days} day(s)")

    frames: list[pd.DataFrame] = []
    for i, (window_start, window_end) in enumerate(windows, start=1):
        print(f"\n[chunk {i}/{len(windows)}]")
        chunk = fetch(window_start.isoformat(), window_end.isoformat())
        if not chunk.empty:
            frames.append(chunk)
        if i < len(windows):
            time.sleep(PAUSE_BETWEEN_CHUNKS_SEC)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    print(f"\nCombined {len(frames)} chunk(s) into {len(combined)} total rows")
    return combined


def validate(df: pd.DataFrame) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing expected columns: {missing}")
    print("\nAll required columns present.")

    null_counts = df[REQUIRED_COLUMNS].isna().sum()
    dirty = null_counts[null_counts > 0]
    if not dirty.empty:
        print("\nNull counts in required columns:")
        print(dirty.to_string())

    pitch_names = sorted(df["pitch_name"].dropna().unique())
    print(f"\n{len(pitch_names)} distinct pitch_name values in this sample:")
    for name in pitch_names:
        print(f"  - {name}")


def main() -> None:
    args = parse_args()
    df = fetch_range_chunked(args.start, args.end, args.chunk_days)
    if df.empty:
        raise SystemExit("No rows returned — check the date range (no games scheduled?).")

    validate(df)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"statcast_{args.start}_{args.end}.csv"
    df[REQUIRED_COLUMNS].to_csv(out_path, index=False)
    print(f"\nWrote {len(df)} rows to {out_path}")

    if args.load_duckdb:
        # Imported lazily so `duckdb` isn't a hard dependency for people
        # who only want the CSV sanity-check path.
        from storage.duckdb_adapter import load

        inserted = load(df[REQUIRED_COLUMNS], db_path=args.db_path)
        print(f"Upserted into DuckDB: {inserted} new row(s) (duplicates skipped)")


if __name__ == "__main__":
    main()
