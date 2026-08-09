"""FastAPI app wiring the KNN engine, session cache, and game-state
advancement into the two endpoints from the system spec: POST
/api/v1/predict and POST /api/v1/log-pitch.

Queries the DuckDB file directly per request (see knn.fetch_historical_topk)
rather than loading the ~2.2M-row table into memory at startup — that
full load measured ~410MB on its own, too tight for a 512MB instance
once Python/FastAPI/pandas overhead and a startup working copy are
added on top. The per-request query approach costs a network hop's
worth of latency (milliseconds; local benchmark was ~20ms) in exchange
for a nearly-flat memory footprint regardless of dataset size.

The .duckdb file itself is gitignored (too large/binary for git) and
Render's Free/Starter tiers have no persistent disk, so on a cold start
where it's missing, ensure_db_present() downloads it from a GitHub
Release before the connection below is opened.
"""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

import duckdb
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from storage.duckdb_adapter import DEFAULT_DB_PATH, TABLE_NAME, ensure_db_present  # noqa: E402

from .game_state import GameSituation, apply_at_bat_result, apply_pitch_result
from .knn import combine_with_session, fetch_historical_topk
from .pitch_types import AT_BAT_STILL_IN_PROGRESS, PITCH_CATEGORY_MAP
from .schemas import (
    ApiPitchPrediction,
    ApiRunnerState,
    ApiSituation,
    LogPitchApiRequest,
    LogPitchApiResponse,
    PredictApiRequest,
    PredictApiResponse,
    RankedPitch,
)
from .session_cache import SESSION_STORE, LoggedPitch

BASE_CON: duckdb.DuckDBPyConnection | None = None

# The frontend runs on a different origin (GitHub Pages) than this API
# (Render), so the browser needs explicit permission to call it.
# localhost:3000 is included for local frontend dev against this
# deployed API (or a locally-run instance of it).
ALLOWED_ORIGINS = [
    "https://spelillo.github.io",
    "http://localhost:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    global BASE_CON
    ensure_db_present(DEFAULT_DB_PATH)
    BASE_CON = duckdb.connect(str(DEFAULT_DB_PATH), read_only=True)
    print(f"Connected to {DEFAULT_DB_PATH} (query-per-request, no full table load)")
    yield
    BASE_CON.close()


app = FastAPI(title="PitchModel API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


def _candidate_pool(payload: ApiSituation) -> pd.DataFrame:
    if BASE_CON is None:
        raise HTTPException(status_code=503, detail="Database not connected yet")
    historical_topk = fetch_historical_topk(BASE_CON, TABLE_NAME, payload)
    session_df = SESSION_STORE.pitches_as_dataframe(
        payload.session_id, player_name=payload.player_name, stand=payload.b_hand
    )
    return combine_with_session(historical_topk, payload, session_df)


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

    ranked_pitches = [
        RankedPitch(pitch_type=pitch_name, count=int(count), probability=count / total)
        for pitch_name, count in counts.head(5).items()
    ]

    category_breakdown: dict[str, int] = {}
    for pitch_name, count in counts.items():
        category = PITCH_CATEGORY_MAP.get(pitch_name, "Other")
        category_breakdown[category] = category_breakdown.get(category, 0) + int(count)

    return PredictApiResponse(
        top_prediction=ApiPitchPrediction(pitch_type=top_pitch, confidence=top_confidence),
        secondary_prediction=secondary,
        confidence_pct=round(top_confidence * 100, 1),
        ranked_pitches=ranked_pitches,
        category_breakdown=category_breakdown,
        sample_count=total,
        exact_match_count=int((pool["distance"] == 0.0).sum()),
    )


@app.post("/api/v1/predict", response_model=PredictApiResponse)
def predict(payload: PredictApiRequest) -> PredictApiResponse:
    pool = _candidate_pool(payload)
    return _build_prediction(pool)


@app.post("/api/v1/log-pitch", response_model=LogPitchApiResponse)
def log_pitch(payload: LogPitchApiRequest) -> LogPitchApiResponse:
    pool = _candidate_pool(payload)
    prediction = _build_prediction(pool)

    # Mirrors src/lib/pitchCategories.ts's trueAccuracy/adjustedAccuracy
    # exactly: full credit only for an exact match, partial credit for
    # landing in the same pitch family, nothing otherwise.
    predicted_pitch = prediction.top_prediction.pitch_type
    actual_pitch = payload.actual_pitch
    if actual_pitch == predicted_pitch:
        true_accuracy, adjusted_accuracy = 1, 1
    elif PITCH_CATEGORY_MAP.get(predicted_pitch) == PITCH_CATEGORY_MAP.get(actual_pitch):
        true_accuracy, adjusted_accuracy = 0, 0.75
    else:
        true_accuracy, adjusted_accuracy = 0, 0

    session_state = SESSION_STORE.add_pitch(
        payload.session_id,
        LoggedPitch(
            player_name=payload.player_name,
            stand=payload.b_hand,
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
        true_accuracy=true_accuracy,
        adjusted_accuracy=adjusted_accuracy,
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
