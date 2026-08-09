"""Weighted-KNN "similar historical situations" engine.

Distance formula (lower = more similar), per the system spec:
    distance = |Δballs| × 5.83 + |Δstrikes| × 8.75 + |Δouts| × 5.0
             + runners_penalty(15.0 if any base occupancy differs)
             + inning_penalty(5.0 if inning+half differs)

The historical baseline (2M+ rows) is queried directly in SQL —
fetch_historical_topk() pushes the handedness anchor, the distance
formula, and the top-k selection into DuckDB itself, so the full table
is never loaded into Python memory. This is what lets the service run
on a 512MB instance instead of needing >1GB just to hold a static
dataset in RAM (measured: loading the whole table into a DataFrame
takes ~410MB on its own, before the rest of the process's overhead).

Live session pitches (a handful per game, already in memory) get
special treatment: any session pitch matching the current count/
outs/runners exactly is force-set to distance 0.0 (regardless of
inning), and every such exact match is duplicated in the candidate
pool (2x weight) before combining with the historical top-k and
truncating back to CANDIDATE_POOL_SIZE.
"""

from __future__ import annotations

import duckdb
import pandas as pd

from .schemas import ApiSituation

BALLS_WEIGHT = 5.83
STRIKES_WEIGHT = 8.75
OUTS_WEIGHT = 5.0
RUNNERS_PENALTY = 15.0
INNING_PENALTY = 5.0

CANDIDATE_POOL_SIZE = 50
SESSION_EXACT_MATCH_DUPLICATE_FACTOR = 2


def fetch_historical_topk(
    con: duckdb.DuckDBPyConnection,
    table_name: str,
    situation: ApiSituation,
    k: int = CANDIDATE_POOL_SIZE,
) -> pd.DataFrame:
    """The spec anchors the engine "strictly by Batter Handedness":
    same-handedness pitches are a hard filter (WHERE), not one of the
    weighted distance terms — a pitcher's approach to lefties and
    righties is a fundamentally different distribution, not a matter of
    degree.

    situation.b_hand must already be resolved to "L"/"R" — "S" will
    never match any historical row, since Statcast's `stand` records
    the batter's actual side per plate appearance and is never
    literally "S" (see handedness.py).

    Uses a fresh cursor off the shared connection so concurrent
    requests don't contend for the same DuckDB connection object.
    """
    query = f"""
        SELECT *,
            ABS(balls - $balls) * {BALLS_WEIGHT}
          + ABS(strikes - $strikes) * {STRIKES_WEIGHT}
          + ABS(outs_when_up - $outs) * {OUTS_WEIGHT}
          + CASE WHEN (on_1b IS NOT NULL) = $on1
                  AND (on_2b IS NOT NULL) = $on2
                  AND (on_3b IS NOT NULL) = $on3
                 THEN 0.0 ELSE {RUNNERS_PENALTY} END
          + CASE WHEN inning = $inning AND inning_topbot = $topbot
                 THEN 0.0 ELSE {INNING_PENALTY} END
          AS distance
        FROM {table_name}
        WHERE player_name = $player_name AND stand = $stand
        -- (game_pk, at_bat_number, pitch_number) breaks ties
        -- deterministically among the many rows that share a distance,
        -- preferring more recent games first.
        ORDER BY distance ASC, game_date DESC, game_pk, at_bat_number, pitch_number
        LIMIT $k
    """
    params = {
        "balls": situation.balls,
        "strikes": situation.strikes,
        "outs": situation.outs,
        "on1": situation.runners.on_1b,
        "on2": situation.runners.on_2b,
        "on3": situation.runners.on_3b,
        "inning": situation.inning,
        "topbot": situation.inning_topbot,
        "player_name": situation.player_name,
        "stand": situation.b_hand,
        "k": k,
    }
    return con.cursor().execute(query, params).fetchdf()


def _runners_mismatch(df: pd.DataFrame, situation: ApiSituation) -> pd.Series:
    match = (
        df["on_1b"].eq(situation.runners.on_1b)
        & df["on_2b"].eq(situation.runners.on_2b)
        & df["on_3b"].eq(situation.runners.on_3b)
    )
    return ~match


def compute_distances(df: pd.DataFrame, situation: ApiSituation) -> pd.Series:
    """Vectorized distance formula for an in-memory DataFrame — used
    for the live session pool (a handful of rows, already loaded).
    The historical baseline uses fetch_historical_topk() instead; this
    exists separately because session pitches already store
    on_1b/on_2b/on_3b as plain booleans (see session_cache.LoggedPitch),
    so there's no SQL round-trip worth making for a handful of rows.
    """
    outs_col = df["outs_when_up"] if "outs_when_up" in df.columns else df["outs"]

    balls_penalty = (df["balls"] - situation.balls).abs() * BALLS_WEIGHT
    strikes_penalty = (df["strikes"] - situation.strikes).abs() * STRIKES_WEIGHT
    outs_penalty = (outs_col - situation.outs).abs() * OUTS_WEIGHT
    runners_penalty = _runners_mismatch(df, situation).astype(float) * RUNNERS_PENALTY

    if "inning_topbot" in df.columns:
        inning_mismatch = (df["inning"] != situation.inning) | (
            df["inning_topbot"] != situation.inning_topbot
        )
    else:
        inning_mismatch = df["inning"] != situation.inning
    inning_penalty = inning_mismatch.astype(float) * INNING_PENALTY

    return balls_penalty + strikes_penalty + outs_penalty + runners_penalty + inning_penalty


def _session_pool(session_pitches: pd.DataFrame, situation: ApiSituation) -> pd.DataFrame:
    """Score session pitches, force-zero exact count/outs/runners
    matches, and duplicate those exact matches for 2x weight."""
    if session_pitches.empty:
        return session_pitches

    pool = session_pitches.copy()
    pool["distance"] = compute_distances(pool, situation)

    exact_match = (
        (pool["balls"] == situation.balls)
        & (pool["strikes"] == situation.strikes)
        & (pool.get("outs_when_up", pool.get("outs")) == situation.outs)
        & ~_runners_mismatch(pool, situation)
    )
    pool.loc[exact_match, "distance"] = 0.0

    duplicates = pool[exact_match]
    if not duplicates.empty:
        extra_copies = [duplicates] * (SESSION_EXACT_MATCH_DUPLICATE_FACTOR - 1)
        pool = pd.concat([pool, *extra_copies], ignore_index=True)

    return pool


def combine_with_session(
    historical_topk: pd.DataFrame,
    situation: ApiSituation,
    session_pitches: pd.DataFrame | None = None,
    k: int = CANDIDATE_POOL_SIZE,
) -> pd.DataFrame:
    """Fold the (already top-k, already-scored) historical pool
    together with the live session pool and re-rank. Combining a top-k
    slice with a small session pool and re-truncating to k is exactly
    equivalent to scoring everything in one pass — a historical row
    outside the top-k can never outrank one already inside it.
    """
    frames = [historical_topk]
    if session_pitches is not None and not session_pitches.empty:
        frames.append(_session_pool(session_pitches, situation))

    combined = pd.concat(frames, ignore_index=True)
    return combined.nsmallest(k, "distance")
