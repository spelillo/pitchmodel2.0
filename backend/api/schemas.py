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


class PredictApiRequest(ApiSituation):
    pass


class PredictApiResponse(BaseModel):
    top_prediction: ApiPitchPrediction
    secondary_prediction: ApiPitchPrediction | None
    confidence_pct: float  # 0-100
    category_breakdown: dict[PitchCategory, int]
    sample_count: int  # size of the k=50 candidate pool actually used
    exact_match_count: int  # candidates with distance = 0.0


class LogPitchApiRequest(ApiSituation):
    actual_pitch: PitchType
    pitch_result: PitchResultOutcome
    at_bat_result: AtBatResult


class LogPitchApiResponse(BaseModel):
    # Partial-credit accuracy for this one pitch. The 0.7 / 0.5 tiers
    # aren't resolved yet — see memory/backend_spec.md. Only 1.0 (exact
    # match) and 0.0 (miss) are meaningful right now.
    accuracy_score: Literal[1.0, 0.7, 0.5, 0.0]
    session_true_accuracy: float
    session_adjusted_accuracy: float
    balls: Literal[0, 1, 2, 3]
    strikes: Literal[0, 1, 2]
    outs: Literal[0, 1, 2]
    runners: ApiRunnerState
    inning: int
    inning_topbot: Literal["Top", "Bot"]
