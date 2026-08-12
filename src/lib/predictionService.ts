import { resolveBatterHandedness } from "@/lib/handedness";
import {
  ApiRunnerState,
  LogPitchApiRequest,
  PredictApiRequest,
  PredictApiResponse,
} from "@/types/api";
import {
  AtBatResult,
  GameState,
  Player,
  PitchResultOutcome,
  PitchType,
  PredictionRequest,
  PredictionResult,
} from "@/types";

// -----------------------------------------------------------------------
// LIVE PREDICTION SERVICE
//
// Calls the real FastAPI/KNN backend at API_BASE_URL — see @/types/api
// for the wire contract this adapts to/from. Both predictNextPitch and
// logPitch require pitcher.statcastName (the exact "Last, First" string
// Statcast uses, set by backend/etl/build_roster.py — NOT the same as
// pitcher.name, which is "First Last" from the MLB Stats API). Sending
// the wrong format 404s on every request since the backend filters on
// an exact string match.
// -----------------------------------------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PITCHMODEL_API_URL ?? "https://pitchmodel2-0.onrender.com";

function toApiRunners(runners: GameState["runners"]): ApiRunnerState {
  return { on_1b: runners.first, on_2b: runners.second, on_3b: runners.third };
}

function toInningTopbot(half: GameState["inningHalf"]): "Top" | "Bot" {
  return half === "top" ? "Top" : "Bot";
}

async function extractErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // body wasn't JSON (or was empty) — fall through to the generic message
  }
  return res.statusText || `HTTP ${res.status}`;
}

function buildSituation(
  pitcher: Player,
  batter: Player,
  gameState: GameState,
  sessionId: string
): Omit<PredictApiRequest, never> {
  if (!pitcher.statcastName) {
    throw new Error(`No Statcast history on file for ${pitcher.name}.`);
  }
  return {
    player_name: pitcher.statcastName,
    pitcher_id: pitcher.id,
    batter_id: batter.id,
    b_hand: resolveBatterHandedness(pitcher.throws ?? "R", batter.bats ?? "R"),
    balls: gameState.balls,
    strikes: gameState.strikes,
    outs: gameState.outs,
    runners: toApiRunners(gameState.runners),
    inning: gameState.inning,
    inning_topbot: toInningTopbot(gameState.inningHalf),
    session_id: sessionId,
  };
}

function adaptPredictResponse(data: PredictApiResponse): PredictionResult {
  return {
    predictedPitch: data.top_prediction.pitch_type,
    probability: data.top_prediction.confidence,
    probabilities: data.ranked_pitches.map((p) => ({
      pitch: p.pitch_type,
      probability: p.probability,
    })),
    similarSituationTotal: data.sample_count,
    similarSituationBreakdown: data.ranked_pitches.map((p) => ({
      pitch: p.pitch_type,
      count: p.count,
    })),
    matchingSituations: data.ranked_pitches[0]?.count ?? 0,
  };
}

export async function predictNextPitch(request: PredictionRequest): Promise<PredictionResult> {
  const { pitcher, batter, gameState, sessionId } = request;
  const payload: PredictApiRequest = buildSituation(pitcher, batter, gameState, sessionId);

  const res = await fetch(`${API_BASE_URL}/api/v1/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Prediction request failed: ${await extractErrorDetail(res)}`);
  }

  return adaptPredictResponse(await res.json());
}

export interface LogPitchRequest {
  pitcher: Player;
  batter: Player;
  gameState: GameState;
  sessionId: string;
  actualPitch: PitchType;
  pitchResult: PitchResultOutcome;
  atBatResult: AtBatResult;
}

/** Tells the backend what was actually thrown, feeding its in-memory
 *  session cache (the live 2x-weighting) and running accuracy totals.
 *
 * Deliberately not the source of truth for this app's own session log —
 * the caller already scores locally via @/lib/pitchCategories (same
 * 3-tier logic, mirrored server-side) so the UI updates instantly
 * without waiting on a network round-trip. This call is a best-effort
 * side effect; callers should fire it without awaiting and just log
 * failures, not block on them.
 */
export async function logPitch(request: LogPitchRequest): Promise<void> {
  const { pitcher, batter, gameState, sessionId, actualPitch, pitchResult, atBatResult } = request;
  const situation = buildSituation(pitcher, batter, gameState, sessionId);

  const payload: LogPitchApiRequest = {
    ...situation,
    actual_pitch: actualPitch,
    pitch_result: pitchResult,
    at_bat_result: atBatResult,
  };

  const res = await fetch(`${API_BASE_URL}/api/v1/log-pitch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Log-pitch request failed: ${await extractErrorDetail(res)}`);
  }
}
