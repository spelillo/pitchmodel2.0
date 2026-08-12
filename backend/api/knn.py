"""Weighted-KNN "similar historical situations" engine.

Two hard-filter fallback hierarchies run before the distance formula
ever sees a row:

1. Matchup identity (resolve_matchup_identity): prefer this specific
   pitcher/batter's own head-to-head history; fall back to the
   pitcher-vs-batter-hand cohort when they haven't faced each other
   enough times for a reliable neighbor set.
2. Count + tier widening (_resolve_pool_filters): a prediction should
   never be based on a handful of pitches, so the count filter — and,
   if needed, the matchup tier itself — widens step by step until the
   pool reaches MIN_CANDIDATE_SAMPLE:
       (resolved tier, exact count)
       -> (resolved tier, count bucket)
       -> (resolved tier, any count)
       -> (hand_cohort tier, exact count)          [only if step 1 chose "batter"]
       -> (hand_cohort tier, count bucket)
       -> (hand_cohort tier, any count)
   Each widening step is logged — meant to be visible when it happens,
   not silent, even though the last ("hand_cohort, any count") step
   should in practice always clear the floor on its own.

Distance formula (lower = more similar), applied to whatever pool step
1+2 leaves — count no longer appears here since it's a hard filter
above, though the balls/strikes terms still do useful ranking work
within a widened pool (preferring rows closer to the actual count even
when the filter had to loosen):
    distance = |Δballs| × 5.83 + |Δstrikes| × 8.75 + |Δouts| × 5.0
             + runners_penalty(15.0 if any base occupancy differs)
             + inning_penalty(5.0 if inning+half differs)

The historical baseline (2M+ rows) is queried directly in SQL — the
matchup/count filters and the distance formula and the top-k selection
are all pushed into DuckDB itself, so the full table is never loaded
into Python memory. This is what lets the service run on a 512MB
instance instead of needing >1GB just to hold a static dataset in RAM
(measured: loading the whole table into a DataFrame takes ~410MB on
its own, before the rest of the process's overhead).

Live session pitches (a handful per game, already in memory) get
special treatment: any session pitch matching the current count/
outs/runners exactly is force-set to distance 0.0 (regardless of
inning), and every such exact match is duplicated in the candidate
pool (2x weight) before combining with the historical top-k and
truncating back to CANDIDATE_POOL_SIZE.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

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

# Step 1: below this many head-to-head pitches, a specific batter's
# history is too thin to trust at all — fall back to the pitcher-vs-hand
# cohort instead of even attempting the batter-specific tier.
MIN_HEAD_TO_HEAD_PITCHES = 10

# Step 2: the floor a candidate pool must clear before its filters stop
# widening. Applies at every step of the cascade in the module
# docstring above — count first, then (if that was the batter tier)
# matchup identity — so a prediction is never based on fewer than this
# many historical pitches when a bigger pool is available by relaxing
# a lower-priority filter.
MIN_CANDIDATE_SAMPLE = 25

# 3-2 is an explicit exception (full count is its own high-leverage
# bucket, not treated as batter-favorable despite balls > strikes);
# every other count falls out of the balls-vs-strikes comparison.
COUNT_BUCKET_SQL = """
    CASE
        WHEN (balls = 3 AND strikes = 2) OR balls = strikes THEN 'even'
        WHEN strikes > balls THEN 'ahead'
        ELSE 'behind'
    END
"""


def count_bucket(balls: int, strikes: int) -> str:
    """Python mirror of COUNT_BUCKET_SQL, for computing the target
    bucket value to bind as a query parameter."""
    if (balls == 3 and strikes == 2) or balls == strikes:
        return "even"
    if strikes > balls:
        return "ahead"
    return "behind"


@dataclass
class MatchupIdentity:
    tier: Literal["batter", "hand_cohort"]
    where_sql: str
    params: dict


def resolve_matchup_identity(
    con: duckdb.DuckDBPyConnection, table_name: str, situation: ApiSituation
) -> MatchupIdentity:
    """Step 1 of the fallback hierarchy. situation.b_hand must already
    be resolved to "L"/"R" (see handedness.py) — the hand_cohort branch
    reuses it as-is."""
    pitcher_id = int(situation.pitcher_id)
    batter_id = int(situation.batter_id)
    h2h_count = con.cursor().execute(
        f"SELECT count(*) FROM {table_name} WHERE pitcher = $pitcher_id AND batter = $batter_id",
        {"pitcher_id": pitcher_id, "batter_id": batter_id},
    ).fetchone()[0]

    if h2h_count >= MIN_HEAD_TO_HEAD_PITCHES:
        return MatchupIdentity(
            tier="batter",
            where_sql="pitcher = $pitcher_id AND batter = $batter_id",
            params={"pitcher_id": pitcher_id, "batter_id": batter_id},
        )
    return MatchupIdentity(
        tier="hand_cohort",
        where_sql="player_name = $player_name AND stand = $b_hand",
        params={"player_name": situation.player_name, "b_hand": situation.b_hand},
    )


def _count_levels(situation: ApiSituation) -> list[tuple[str, str, dict]]:
    """The three progressively looser count filters tried at each
    matchup tier, tightest first."""
    bucket = count_bucket(situation.balls, situation.strikes)
    return [
        (
            "exact",
            "balls = $balls AND strikes = $strikes",
            {"balls": situation.balls, "strikes": situation.strikes},
        ),
        ("bucket", f"({COUNT_BUCKET_SQL}) = $bucket", {"bucket": bucket}),
        ("any_count", "1 = 1", {}),
    ]


def _resolve_pool_filters(
    con: duckdb.DuckDBPyConnection,
    table_name: str,
    situation: ApiSituation,
    identity: MatchupIdentity,
) -> tuple[MatchupIdentity, str, dict]:
    """Step 2: widens the count filter, and if needed the matchup tier
    itself, until the pool reaches MIN_CANDIDATE_SAMPLE. See the module
    docstring for the exact cascade order. Returns whichever
    (tier, count_where, params) combination first cleared the floor,
    or — in the unreachable-in-practice case that nothing does — the
    single largest pool any combination produced."""
    tiers = [identity]
    if identity.tier == "batter":
        tiers.append(
            MatchupIdentity(
                tier="hand_cohort",
                where_sql="player_name = $player_name AND stand = $b_hand",
                params={"player_name": situation.player_name, "b_hand": situation.b_hand},
            )
        )

    best: tuple[MatchupIdentity, str, dict, int] | None = None
    for tier in tiers:
        for level_name, count_where, count_extra in _count_levels(situation):
            params = {**tier.params, **count_extra}
            n = con.cursor().execute(
                f"SELECT count(*) FROM {table_name} WHERE {tier.where_sql} AND {count_where}",
                params,
            ).fetchone()[0]

            if best is None or n > best[3]:
                best = (tier, count_where, params, n)

            if n >= MIN_CANDIDATE_SAMPLE:
                if not (tier is identity and level_name == "exact"):
                    print(
                        f"[knn] widened filters for {situation.player_name} "
                        f"{situation.balls}-{situation.strikes}: {tier.tier}/{level_name} "
                        f"reached {n} pitches (>= {MIN_CANDIDATE_SAMPLE})"
                    )
                return tier, count_where, params

    # Nothing cleared the floor anywhere in the cascade (should be
    # essentially unreachable — hand_cohort/any_count is just "this
    # pitcher's full history vs. this hand"). Use the largest pool found
    # rather than erroring on a technically-valid, just very thin, matchup.
    tier, count_where, params, n = best
    print(
        f"[knn] no filter combination reached {MIN_CANDIDATE_SAMPLE} pitches for "
        f"{situation.player_name} {situation.balls}-{situation.strikes} — using the "
        f"largest available pool ({tier.tier}, {n} pitches)"
    )
    return tier, count_where, params


def fetch_historical_topk(
    con: duckdb.DuckDBPyConnection,
    table_name: str,
    situation: ApiSituation,
    k: int = CANDIDATE_POOL_SIZE,
) -> tuple[pd.DataFrame, MatchupIdentity]:
    """Resolves matchup identity (step 1) and widens count/tier filters
    until the pool reaches MIN_CANDIDATE_SAMPLE (step 2), then ranks
    whatever pool that leaves by the distance formula. Returns the tier
    actually used alongside the DataFrame so callers (main.py's
    _candidate_pool) can scope the live session pool to match.

    Uses a fresh cursor off the shared connection so concurrent
    requests don't contend for the same DuckDB connection object.
    """
    identity = resolve_matchup_identity(con, table_name, situation)
    tier, count_where, count_params = _resolve_pool_filters(con, table_name, situation, identity)

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
        WHERE {tier.where_sql} AND {count_where}
        -- (game_pk, at_bat_number, pitch_number) breaks ties
        -- deterministically among the many rows that share a distance,
        -- preferring more recent games first.
        ORDER BY distance ASC, game_date DESC, game_pk, at_bat_number, pitch_number
        LIMIT $k
    """
    params = {
        **count_params,
        "balls": situation.balls,
        "strikes": situation.strikes,
        "outs": situation.outs,
        "on1": situation.runners.on_1b,
        "on2": situation.runners.on_2b,
        "on3": situation.runners.on_3b,
        "inning": situation.inning,
        "topbot": situation.inning_topbot,
        "k": k,
    }
    df = con.cursor().execute(query, params).fetchdf()
    return df, tier


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
