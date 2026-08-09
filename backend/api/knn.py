"""Weighted-KNN "similar historical situations" engine.

Distance formula (lower = more similar), per the system spec:
    distance = |Δballs| × 5.83 + |Δstrikes| × 8.75 + |Δouts| × 5.0
             + runners_penalty(15.0 if any base occupancy differs)
             + inning_penalty(5.0 if inning+half differs)

Live session pitches get special treatment: any session pitch matching
the current count/outs/runners exactly is force-set to distance 0.0
(regardless of inning), and every such exact match is duplicated in the
candidate pool (2x weight) before combining with the historical pool and
truncating to the top CANDIDATE_POOL_SIZE.
"""

from __future__ import annotations

import pandas as pd

from .schemas import ApiSituation

BALLS_WEIGHT = 5.83
STRIKES_WEIGHT = 8.75
OUTS_WEIGHT = 5.0
RUNNERS_PENALTY = 15.0
INNING_PENALTY = 5.0

CANDIDATE_POOL_SIZE = 50
SESSION_EXACT_MATCH_DUPLICATE_FACTOR = 2


def normalize_runner_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Raw Statcast on_1b/on_2b/on_3b hold a runner's player id (float)
    or NaN when the base is empty. Collapse that to plain occupancy
    booleans once, at the data boundary, so every downstream function
    (this module, session_cache) can assume on_1b/on_2b/on_3b are bool.
    A no-op if the columns are already bool (e.g. session pitches).
    """
    df = df.copy()
    for col in ("on_1b", "on_2b", "on_3b"):
        if df[col].dtype != bool:
            df[col] = df[col].notna()
    return df


def _runners_mismatch(df: pd.DataFrame, situation: ApiSituation) -> pd.Series:
    match = (
        df["on_1b"].eq(situation.runners.on_1b)
        & df["on_2b"].eq(situation.runners.on_2b)
        & df["on_3b"].eq(situation.runners.on_3b)
    )
    return ~match


def compute_distances(df: pd.DataFrame, situation: ApiSituation) -> pd.Series:
    """Vectorized distance formula, one row -> one distance value."""
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


def nearest_neighbors(
    historical: pd.DataFrame,
    situation: ApiSituation,
    session_pitches: pd.DataFrame | None = None,
    k: int = CANDIDATE_POOL_SIZE,
) -> pd.DataFrame:
    """Return the k nearest pitches to `situation` across the historical
    baseline plus the live session store, sorted by ascending distance.

    Only ever materializes the historical baseline's own top-k rows, not
    a copy of what may be a multi-million-row DataFrame — a row outside
    that top-k can never outrank one already inside it, so folding in the
    (typically tiny) session pool and re-ranking the union is exactly
    equivalent to scoring everything in one pass.
    """
    hist_distances = compute_distances(historical, situation)
    top_idx = hist_distances.nsmallest(k).index
    hist_pool = historical.loc[top_idx].copy()
    hist_pool["distance"] = hist_distances.loc[top_idx]

    frames = [hist_pool]
    if session_pitches is not None and not session_pitches.empty:
        frames.append(_session_pool(session_pitches, situation))

    combined = pd.concat(frames, ignore_index=True)
    return combined.nsmallest(k, "distance")
