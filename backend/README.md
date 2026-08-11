# Backend — data pipeline

FastAPI + a DuckDB-backed KNN engine over historical Statcast pitches
(`backend/api/`), fed by an ETL pipeline (`backend/etl/`) that also
generates the frontend's player pickers (`src/data/players.ts`).

## Pieces

| File | Role |
| --- | --- |
| `etl/fetch_statcast.py` | Pulls pitch-by-pitch Statcast data via `pybaseball` and upserts it into `data/pitchmodel.duckdb`. |
| `etl/build_roster.py` | Cross-references the current MLB Stats API roster against who actually has pitches in the DuckDB backfill, and writes `src/data/players.ts`. |
| `storage/duckdb_adapter.py` | The DuckDB adapter: schema, dedup-safe `load()`, and `ensure_db_present()` (downloads the DB from a GitHub Release on a disk-less cold start, e.g. Render's free tier). |
| `.github/workflows/sync-statcast.yml` | Runs the two ETL scripts on a schedule so both stay current automatically. |
| `.github/workflows/backend-tests.yml` | Runs `backend/tests` on every push/PR touching `backend/`. |

## Keeping the data fresh

Two things go stale if nobody runs the ETL:

1. **`pitchmodel.duckdb`** — no new pitches after the last backfill.
2. **`src/data/players.ts`** — no new call-ups, trades, or rookies, since
   it's a snapshot generated *from* the DuckDB data.

`sync-statcast.yml` runs both scripts weekly (Mondays, 13:00 UTC) and on
`workflow_dispatch`. It downloads the currently-published database,
pulls everything new via `--since-last` (see below), regenerates the
roster, republishes the database to the `db-latest` GitHub Release
(the same asset `ensure_db_present()` downloads on a cold start), and
commits `players.ts` if it changed.

**One-time repo setup this workflow needs** (not code, so it has to be
done in GitHub's UI): Settings → Actions → General → Workflow
permissions → "Read and write permissions". Without that, the default
`GITHUB_TOKEN` can't push commits or publish releases.

### `--since-last`: how incremental syncs pick a date range

```bash
python backend/etl/fetch_statcast.py --since-last --end 2026-08-16 --load-duckdb
```

Reads the latest `game_date` already in the target DuckDB and resumes
the day after it — nobody has to hand-pick (and remember to keep
updating) a `--start` date.

**Important caveat:** `--since-last` only looks at the *max* date. It
cannot detect a hole earlier in the history — which is exactly what
happened here (see below). If you ever re-import a database with an
internal gap, `--since-last` will happily continue from the end of it
forever without noticing the gap. Fill any known gap explicitly with
`--start`/`--end` first; use `--since-last` only once the history is
contiguous.

### Bootstrapping `db-latest` after a gap fix

Because `--since-last` can't self-heal a gap, publishing a corrected
`pitchmodel.duckdb` to the `db-latest` release is a manual, one-time
step after a fix like this one — not something the scheduled workflow
does on its own:

```bash
gh release upload db-latest backend/data/pitchmodel.duckdb --clobber
```

Skipping this means the *next* scheduled sync still resumes from
whatever stale asset is currently published, silently perpetuating the
same gap.

## Incident: the 2026 roster was missing rookies (e.g. Andrew Painter)

Two independent bugs compounded:

1. **`fetch_statcast.py`** had only ever been run for full seasons
   2023–2025 plus a one-week 2026 sanity-check sample
   (Aug 1–7). Opening Day 2026 was March 25 — about 4.5 months of the
   current season were never pulled, so any pitcher/batter whose only
   2026 action fell in that window had zero rows in the backfill.
2. **`build_roster.py`** had `DEFAULT_SEASON = 2025` hardcoded. The
   script filters the MLB Stats API's roster to a specific season
   before cross-referencing it against the Statcast backfill — a 2026
   rookie doesn't appear on the *2025* league-wide roster at all, so
   even with full 2026 data loaded, the script would never have looked
   for them.

Fix: the March 25 – Aug 9 2026 gap was backfilled explicitly, and
`DEFAULT_SEASON` is now computed as `date.today().year` instead of a
literal, so this can't silently drift again. `fetch_statcast.py` also
gained `--since-last` (above) so routine syncs never depend on someone
remembering to update a hardcoded date.

## Tests

```bash
pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -v
```

Covers: `duckdb_adapter`'s dedup/idempotency and download-on-cold-start
behavior, `fetch_statcast`'s column validation, chunked date-window
splitting, and `--since-last` date math, and `build_roster`'s
pitch-count/handedness filtering, TS-literal generation, and (as a
direct regression guard for the incident above) that `DEFAULT_SEASON`
tracks the current year.

## Running the ETL manually

```bash
# One-off backfill for a specific range
python backend/etl/fetch_statcast.py --start 2026-03-25 --end 2026-08-09 --chunk-days 3 --load-duckdb

# Routine incremental sync
python backend/etl/fetch_statcast.py --since-last --end 2026-08-16 --load-duckdb

# Regenerate src/data/players.ts from whatever's currently in the DB
python backend/etl/build_roster.py
```
