"""Tests for backend/api/knn.py's matchup-identity and count-fallback
hierarchy: head-to-head history vs. pitcher-vs-hand cohort (step 1),
and exact count vs. ahead/even/behind bucket (step 2).
"""

from __future__ import annotations

import duckdb
import pandas as pd
import pytest

from backend.api.knn import (
    MIN_EXACT_COUNT_PITCHES,
    MIN_HEAD_TO_HEAD_PITCHES,
    count_bucket,
    fetch_historical_topk,
    resolve_matchup_identity,
)
from backend.api.schemas import ApiRunnerState, ApiSituation
from backend.storage import duckdb_adapter

PITCHER_ID = 691725
BATTER_ID = 500001
OTHER_BATTER_ID = 500002


@pytest.mark.parametrize(
    "balls,strikes,expected",
    [
        (0, 0, "even"),
        (1, 1, "even"),
        (2, 2, "even"),
        (3, 2, "even"),  # full count is an explicit "even" exception
        (0, 1, "ahead"),
        (0, 2, "ahead"),
        (1, 2, "ahead"),
        (1, 0, "behind"),
        (2, 0, "behind"),
        (2, 1, "behind"),
        (3, 0, "behind"),
        (3, 1, "behind"),
    ],
)
def test_count_bucket_covers_all_twelve_counts(balls, strikes, expected):
    assert count_bucket(balls, strikes) == expected


def _rows(
    n: int,
    *,
    pitcher: int = PITCHER_ID,
    batter: int = BATTER_ID,
    stand: str = "R",
    player_name: str = "Painter, Andrew",
    balls: int = 0,
    strikes: int = 0,
    start_at_bat: int = 1,
    pitch_name: str = "4-Seam Fastball",
) -> pd.DataFrame:
    at_bat_numbers = list(range(start_at_bat, start_at_bat + n))
    return pd.DataFrame(
        {
            "game_pk": [1] * n,
            "at_bat_number": at_bat_numbers,
            "pitch_number": [1] * n,
            "game_date": ["2026-04-01"] * n,
            "player_name": [player_name] * n,
            "pitcher": [pitcher] * n,
            "batter": [batter] * n,
            "stand": [stand] * n,
            "balls": [balls] * n,
            "strikes": [strikes] * n,
            "outs_when_up": [0] * n,
            "inning": [1] * n,
            "inning_topbot": ["Top"] * n,
            "on_1b": [False] * n,
            "on_2b": [False] * n,
            "on_3b": [False] * n,
            "pitch_type": ["FF"] * n,
            "pitch_name": [pitch_name] * n,
        }
    )


def _situation(**overrides) -> ApiSituation:
    defaults = dict(
        player_name="Painter, Andrew",
        pitcher_id=str(PITCHER_ID),
        batter_id=str(BATTER_ID),
        b_hand="R",
        balls=0,
        strikes=0,
        outs=0,
        runners=ApiRunnerState(on_1b=False, on_2b=False, on_3b=False),
        inning=1,
        inning_topbot="Top",
        session_id="s1",
    )
    defaults.update(overrides)
    return ApiSituation(**defaults)


def _connect(tmp_path, df: pd.DataFrame) -> duckdb.DuckDBPyConnection:
    db_path = tmp_path / "test.duckdb"
    duckdb_adapter.load(df, db_path=db_path)
    return duckdb.connect(str(db_path), read_only=True)


def test_resolves_to_batter_tier_when_head_to_head_clears_threshold(tmp_path):
    assert MIN_HEAD_TO_HEAD_PITCHES == 10
    df = _rows(MIN_HEAD_TO_HEAD_PITCHES, batter=BATTER_ID)
    con = _connect(tmp_path, df)

    identity = resolve_matchup_identity(con, "statcast_pitches", _situation())

    assert identity.tier == "batter"
    assert identity.params == {"pitcher_id": PITCHER_ID, "batter_id": BATTER_ID}


def test_falls_back_to_hand_cohort_when_head_to_head_too_thin(tmp_path):
    below_threshold = _rows(
        MIN_HEAD_TO_HEAD_PITCHES - 1, batter=BATTER_ID, start_at_bat=1
    )
    # Padding so the hand-cohort pool itself isn't empty (a different
    # batter, same hand, same pitcher).
    cohort_padding = _rows(20, batter=OTHER_BATTER_ID, start_at_bat=1000)
    con = _connect(tmp_path, pd.concat([below_threshold, cohort_padding], ignore_index=True))

    identity = resolve_matchup_identity(con, "statcast_pitches", _situation())

    assert identity.tier == "hand_cohort"
    assert identity.params == {"player_name": "Painter, Andrew", "b_hand": "R"}


def test_uses_exact_count_when_sample_is_large_enough(tmp_path):
    assert MIN_EXACT_COUNT_PITCHES == 8
    exact = _rows(MIN_EXACT_COUNT_PITCHES, balls=0, strikes=0, start_at_bat=1)
    same_bucket_different_count = _rows(20, balls=1, strikes=1, start_at_bat=1000)
    con = _connect(
        tmp_path, pd.concat([exact, same_bucket_different_count], ignore_index=True)
    )

    df, identity = fetch_historical_topk(con, "statcast_pitches", _situation())

    assert identity.tier == "batter"
    assert len(df) == MIN_EXACT_COUNT_PITCHES
    assert (df["balls"] == 0).all() and (df["strikes"] == 0).all()


def test_falls_back_to_count_bucket_when_exact_count_too_thin(tmp_path, capsys):
    thin_exact = _rows(
        MIN_EXACT_COUNT_PITCHES - 1, balls=0, strikes=0, start_at_bat=1
    )
    # 1-1 is also "even" per count_bucket, so it should be pulled in.
    same_bucket = _rows(20, balls=1, strikes=1, start_at_bat=1000)
    # 0-1 is "ahead", a different bucket — must NOT be pulled in.
    different_bucket = _rows(20, balls=0, strikes=1, start_at_bat=5000)
    con = _connect(
        tmp_path,
        pd.concat([thin_exact, same_bucket, different_bucket], ignore_index=True),
    )

    df, identity = fetch_historical_topk(con, "statcast_pitches", _situation(balls=0, strikes=0))

    assert identity.tier == "batter"
    assert len(df) > MIN_EXACT_COUNT_PITCHES - 1  # bucket rows were pulled in
    for _, row in df.iterrows():
        assert count_bucket(row["balls"], row["strikes"]) == "even"
    assert "count fallback" in capsys.readouterr().out
