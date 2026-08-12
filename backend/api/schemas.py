"""Pydantic mirror of src/types/api.ts — keep the two in sync by hand."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .pitch_types import AtBatResult, Handedness, PitchCategory, PitchResultOutcome, PitchType


class ApiRunnerState(BaseModel):
    on_1b: bool
    on_2b: bool
    on_3b: bool


class ApiSituation(BaseModel):
    player_name: str
    # MLBAM ids (same id space as Statcast's pitcher/batter columns) —
    # used for the head-to-head matchup lookup and, when it clears the
    # threshold, the batter-specific query itself. See knn.py's
    # resolve_matchup_identity().
    pitcher_id: str
    batter_id: str
    # Must already be resolved to "L"/"R" by the caller — a switch
    # hitter ("S") has no fixed side, it depends on which pitcher they're
    # facing. See handedness.py's resolve_batter_handedness(). Used for
    # the pitcher-vs-batter-hand fallback cohort.
    b_hand: Handedness
    balls: Literal[0, 1, 2, 3]
    strikes: Literal[0, 1, 2]
    outs: Literal[0, 1, 2]
    runners: ApiRunnerState
    inning: int
    inning_topbot: Literal["Top", "Bot"]
    session_id: str


class ApiPitchPrediction(BaseModel):
    pitch_type: PitchType
    confidence: float  # 0-1


class RankedPitch(BaseModel):
    pitch_type: PitchType
    count: int
    probability: float  # 0-1, count / sample_count


class PredictApiRequest(ApiSituation):
    pass


class PredictApiResponse(BaseModel):
    top_prediction: ApiPitchPrediction
    secondary_prediction: ApiPitchPrediction | None
    confidence_pct: float  # 0-100
    # Full breakdown (up to 5 pitches, sorted by count desc) — top_prediction
    # and secondary_prediction are ranked_pitches[0]/[1], kept as separate
    # fields since they were the original response shape and are still the
    # simplest way to get just the top pick.
    ranked_pitches: list[RankedPitch]
    category_breakdown: dict[PitchCategory, int]
    sample_count: int  # size of the k=50 candidate pool actually used
    exact_match_count: int  # candidates with distance = 0.0


class LogPitchApiRequest(ApiSituation):
    actual_pitch: PitchType
    pitch_result: PitchResultOutcome
    at_bat_result: AtBatResult


class LogPitchApiResponse(BaseModel):
    # This pitch's score, mirroring src/lib/pitchCategories.ts exactly:
    # true_accuracy is 1 only on an exact pitch match; adjusted_accuracy
    # gives partial credit (0.75) for a same-category miss.
    true_accuracy: Literal[0, 1]
    adjusted_accuracy: Literal[0, 0.75, 1]
    # Running session totals: session_true_accuracy is (sum of
    # true_accuracy) / pitch count; session_adjusted_accuracy is the
    # same over adjusted_accuracy.
    session_true_accuracy: float
    session_adjusted_accuracy: float
    balls: Literal[0, 1, 2, 3]
    strikes: Literal[0, 1, 2]
    outs: Literal[0, 1, 2]
    runners: ApiRunnerState
    inning: int
    inning_topbot: Literal["Top", "Bot"]
