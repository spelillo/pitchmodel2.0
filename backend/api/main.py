"""FastAPI app wiring the KNN engine, session cache, and game-state
advancement into the two endpoints from the system spec: POST
/api/v1/predict and POST /api/v1/log-pitch.

Not run yet: the lifespan handler below only opens a DuckDB connection
when the server actually starts (`uvicorn backend.api.main:app`), and
this file was built without starting it, so it never touched the
database while backend/etl's backfill was writing to it.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

import duckdb
import pandas as pd
from fastapi import FastAPI, HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from storage.duckdb_adapter import DEFAULT_DB_PATH, TABLE_NAME  # noqa: E402

from .game_state import GameSituation, apply_at_bat_result, apply_pitch_result
from .knn import nearest_neighbors, normalize_runner_columns
from .pitch_types import AT_BAT_STILL_IN_PROGRESS, PITCH_CATEGORY_MAP
from .schemas import (
    ApiPitchPrediction,
    ApiRunnerState,
    LogPitchApiRequest,
    LogPitchApiResponse,
    PredictApiRequest,
    PredictApiResponse,
)
from .session_cache import SESSION_STORE, LoggedPitch

HISTORICAL: pd.DataFrame | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global HISTORICAL
    con = duckdb.connect(str(DEFAULT_DB_PATH), read_only=True)
    try:
        df = con.execute(f"SELECT * FROM {TABLE_NAME}").fetchdf()
    finally:
        con.close()
    HISTORICAL = normalize_runner_columns(df)
    print(f"Loaded {len(HISTORICAL)} historical pitches into memory")
    yield


app = FastAPI(title="PitchModel API", lifespan=lifespan)


def _pitcher_history(player_name: str) -> pd.DataFrame:
    if HISTORICAL is None:
        raise HTTPException(status_code=503, detail="Historical data not loaded yet")
    subset = HISTORICAL[HISTORICAL["player_name"] == player_name]
    if subset.empty:
        raise HTTPException(status_code=404, detail=f"No historical pitches for {player_name!r}")
    return subset


def _build_prediction(pool: pd.DataFrame) -> PredictApiResponse:
    if pool.empty:
        raise HTTPException(status_code=404, detail="No comparable historical pitches found")

    counts = pool["pitch_name"].value_counts()
    total = int(counts.sum())

    top_pitch = counts.index[0]
    top_confidence = counts.iloc[0] / total
    secondary = None
    if len(counts) > 1:
        secondary = ApiPitchPrediction(
            pitch_type=counts.index[1], confidence=counts.iloc[1] / total
        )

    category_breakdown: dict[str, int] = {}
    for pitch_name, count in counts.items():
        category = PITCH_CATEGORY_MAP.get(pitch_name, "Other")
        category_breakdown[category] = category_breakdown.get(category, 0) + int(count)

    return PredictApiResponse(
        top_prediction=ApiPitchPrediction(pitch_type=top_pitch, confidence=top_confidence),
        secondary_prediction=secondary,
        confidence_pct=round(top_confidence * 100, 1),
        category_breakdown=category_breakdown,
        sample_count=total,
        exact_match_count=int((pool["distance"] == 0.0).sum()),
    )


@app.post("/api/v1/predict", response_model=PredictApiResponse)
def predict(payload: PredictApiRequest) -> PredictApiResponse:
    pitcher_history = _pitcher_history(payload.player_name)
    session_df = SESSION_STORE.pitches_as_dataframe(payload.session_id)
    pool = nearest_neighbors(pitcher_history, payload, session_df)
    return _build_prediction(pool)


@app.post("/api/v1/log-pitch", response_model=LogPitchApiResponse)
def log_pitch(payload: LogPitchApiRequest) -> LogPitchApiResponse:
    pitcher_history = _pitcher_history(payload.player_name)
    session_df = SESSION_STORE.pitches_as_dataframe(payload.session_id)
    pool = nearest_neighbors(pitcher_history, payload, session_df)
    prediction = _build_prediction(pool)

    # Only the exact-match tier is resolved right now (see schemas.py's
    # LogPitchApiResponse docstring) — 0.7/0.5 are placeholders until
    # that scoring decision is made, so this only ever returns 1.0 or 0.0.
    true_accuracy = 1.0 if payload.actual_pitch == prediction.top_prediction.pitch_type else 0.0
    adjusted_accuracy = true_accuracy

    session_state = SESSION_STORE.add_pitch(
        payload.session_id,
        LoggedPitch(
            balls=payload.balls,
            strikes=payload.strikes,
            outs_when_up=payload.outs,
            on_1b=payload.runners.on_1b,
            on_2b=payload.runners.on_2b,
            on_3b=payload.runners.on_3b,
            inning=payload.inning,
            inning_topbot=payload.inning_topbot,
            pitch_name=payload.actual_pitch,
            true_accuracy=true_accuracy,
            adjusted_accuracy=adjusted_accuracy,
        ),
    )

    situation = GameSituation(
        balls=payload.balls,
        strikes=payload.strikes,
        outs=payload.outs,
        on_1b=payload.runners.on_1b,
        on_2b=payload.runners.on_2b,
        on_3b=payload.runners.on_3b,
        inning=payload.inning,
        inning_topbot=payload.inning_topbot,
    )
    if payload.at_bat_result == AT_BAT_STILL_IN_PROGRESS:
        situation = apply_pitch_result(situation, payload.pitch_result)
    else:
        situation = apply_at_bat_result(situation, payload.at_bat_result)

    return LogPitchApiResponse(
        accuracy_score=true_accuracy,
        session_true_accuracy=session_state.true_accuracy,
        session_adjusted_accuracy=session_state.adjusted_accuracy,
        balls=situation.balls,
        strikes=situation.strikes,
        outs=situation.outs,
        runners=ApiRunnerState(
            on_1b=situation.on_1b, on_2b=situation.on_2b, on_3b=situation.on_3b
        ),
        inning=situation.inning,
        inning_topbot=situation.inning_topbot,
    )
