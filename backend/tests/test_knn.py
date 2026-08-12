"""Tests for backend/api/knn.py's matchup-identity and count/tier
widening cascade: head-to-head history vs. pitcher-vs-hand cohort
(step 1), and the exact/bucket/any-count -> hand_cohort widening ladder
that guarantees at least MIN_CANDIDATE_SAMPLE historical pitches
(step 2).
"""

from __future__ import annotations

import duckdb
import pandas as pd
import pytest

from backend.api.knn import (
    MIN_CANDIDATE_SAMPLE,
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
    cohort_padding = _rows(30, batter=OTHER_BATTER_ID, start_at_bat=1000)
    con = _connect(tmp_path, pd.concat([below_threshold, cohort_padding], ignore_index=True))

    identity = resolve_matchup_identity(con, "statcast_pitches", _situation())

    assert identity.tier == "hand_cohort"
    assert identity.params == {"player_name": "Painter, Andrew", "b_hand": "R"}


def test_uses_exact_count_when_pool_already_clears_the_floor(tmp_path, capsys):
    assert MIN_CANDIDATE_SAMPLE == 25
    exact = _rows(MIN_CANDIDATE_SAMPLE, balls=0, strikes=0, start_at_bat=1)
    other_bucket_noise = _rows(20, balls=0, strikes=1, start_at_bat=1000)
    con = _connect(tmp_path, pd.concat([exact, other_bucket_noise], ignore_index=True))

    df, tier = fetch_historical_topk(con, "statcast_pitches", _situation())

    assert tier.tier == "batter"
    assert len(df) == MIN_CANDIDATE_SAMPLE
    assert (df["balls"] == 0).all() and (df["strikes"] == 0).all()
    assert "widened" not in capsys.readouterr().out


def test_widens_to_bucket_when_exact_count_is_too_thin(tmp_path, capsys):
    thin_exact = _rows(5, balls=0, strikes=0, start_at_bat=1)
    # 1-1 is also "even" per count_bucket, so it should be pulled in to
    # clear the floor.
    same_bucket = _rows(25, balls=1, strikes=1, start_at_bat=1000)
    # 0-1 is "ahead", a different bucket — must NOT be pulled in.
    different_bucket = _rows(30, balls=0, strikes=1, start_at_bat=5000)
    con = _connect(
        tmp_path,
        pd.concat([thin_exact, same_bucket, different_bucket], ignore_index=True),
    )

    df, tier = fetch_historical_topk(con, "statcast_pitches", _situation(balls=0, strikes=0))

    assert tier.tier == "batter"
    assert len(df) == 30  # 5 exact + 25 same-bucket, none from the other bucket
    for _, row in df.iterrows():
        assert count_bucket(row["balls"], row["strikes"]) == "even"
    assert "widened filters" in capsys.readouterr().out


def test_widens_to_any_count_when_even_the_bucket_is_too_thin(tmp_path, capsys):
    # Total batter-tier pitches (28) clear MIN_HEAD_TO_HEAD_PITCHES and
    # MIN_CANDIDATE_SAMPLE, but no single count bucket does on its own
    # (each is only 7 or 14).
    even_bucket = _rows(7, balls=0, strikes=0, start_at_bat=1)
    ahead_bucket = _rows(7, balls=0, strikes=1, start_at_bat=100)
    behind_bucket = _rows(7, balls=1, strikes=0, start_at_bat=200)
    more_even = _rows(7, balls=1, strikes=1, start_at_bat=300)
    con = _connect(
        tmp_path,
        pd.concat([even_bucket, ahead_bucket, behind_bucket, more_even], ignore_index=True),
    )

    df, tier = fetch_historical_topk(con, "statcast_pitches", _situation(balls=0, strikes=0))

    assert tier.tier == "batter"
    assert len(df) == 28  # all four counts pulled in — "any_count" level
    out = capsys.readouterr().out
    assert "any_count" in out


def test_falls_through_to_hand_cohort_when_batter_tier_never_clears_floor(tmp_path, capsys):
    # Batter-tier total (any count) clears MIN_HEAD_TO_HEAD_PITCHES but
    # not MIN_CANDIDATE_SAMPLE, so it must fall through to the
    # hand-cohort tier — which, since it filters only by player_name/
    # stand (not batter), naturally includes these same 15 rows too,
    # plus another batter's padding, once widened.
    thin_batter_tier = _rows(15, batter=BATTER_ID, balls=0, strikes=0, start_at_bat=1)
    cohort_padding = _rows(15, batter=OTHER_BATTER_ID, balls=0, strikes=0, start_at_bat=1000)
    con = _connect(
        tmp_path, pd.concat([thin_batter_tier, cohort_padding], ignore_index=True)
    )

    df, tier = fetch_historical_topk(con, "statcast_pitches", _situation(balls=0, strikes=0))

    assert tier.tier == "hand_cohort"
    assert len(df) == 30
    assert "widened filters" in capsys.readouterr().out
