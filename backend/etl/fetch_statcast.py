"""Pull a sample of Statcast pitch-by-pitch data via pybaseball and
validate it against the fields PitchModel's prediction engine needs.

This is a sanity-check pull for a short date range — NOT the full 3-year
historical backfill described in the system spec. It exists to confirm
column names, null rates, and pitch_name coverage before anything commits
to a storage adapter or a scheduled weekly sync.

Scaling this up later:
  - Full historical backfill: use fetch_range_chunked() (Statcast pulls
    get slow/unreliable over very wide ranges) — it splits into
    --chunk-days windows, pauses briefly between requests, and
    concatenates. REQUIRED_COLUMNS/validate() stay the same either way.
  - Weekly GitHub Action sync: reuse fetch() with --start/--end set to
    "since last run", then append (not overwrite) into the storage
    adapter instead of writing a local CSV.

Usage:
    python backend/etl/fetch_statcast.py
    python backend/etl/fetch_statcast.py --start 2025-06-01 --end 2025-06-03
    python backend/etl/fetch_statcast.py --start 2023-04-01 --end 2025-10-01 --chunk-days 3
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    today = date.today()
    default_end = today - timedelta(days=1)
    default_start = default_end - timedelta(days=DEFAULT_SAMPLE_DAYS - 1)
    parser.add_argument("--start", default=default_start.isoformat(), help="YYYY-MM-DD")
    parser.add_argument("--end", default=default_end.isoformat(), help="YYYY-MM-DD")
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
    return parser.parse_args()


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

        inserted = load(df[REQUIRED_COLUMNS])
        print(f"Upserted into DuckDB: {inserted} new row(s) (duplicates skipped)")


if __name__ == "__main__":
    main()
