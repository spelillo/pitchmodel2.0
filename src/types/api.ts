import { AtBatResult, Handedness, PitchCategory, PitchResultOutcome, PitchType } from "@/types";

// -----------------------------------------------------------------------
// FUTURE BACKEND CONTRACT
//
// These types describe the wire shape of the FastAPI KNN prediction
// service from the PitchModel 2.0 system spec — not yet implemented or
// called anywhere in this app. They exist so the eventual `fetch()` calls
// in lib/predictionService.ts have a documented target to code against.
// Field names are snake_case to mirror the JSON the backend will send,
// unlike the camelCase domain types in "@/types" that the rest of the
// frontend consumes.
//
// Distance formula (weighted KNN, lower = more similar):
//   distance = |Δballs| × 5.83 + |Δstrikes| × 8.75 + |Δouts| × 5.0
//            + runnersPenalty(15.0 if any base mismatches)
//            + inningPenalty(5.0 if inning string mismatches)
// Session pitches matching the live count/outs/runners exactly score
// distance = 0.0 and are double-counted (2x weight) in the candidate
// pool before combining with the top 50 historical matches.
// -----------------------------------------------------------------------

export interface ApiRunnerState {
  on_1b: boolean;
  on_2b: boolean;
  on_3b: boolean;
}

/** Shared situational payload used by both endpoints below. */
export interface ApiSituation {
  player_name: string;
  b_hand: Handedness;
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
  outs: 0 | 1 | 2;
  runners: ApiRunnerState;
  inning: number;
  session_id: string;
}

export interface ApiPitchPrediction {
  pitch_type: PitchType;
  confidence: number; // 0-1
}

/** POST /api/v1/predict request body. */
export type PredictApiRequest = ApiSituation;

/** POST /api/v1/predict response body. */
export interface PredictApiResponse {
  top_prediction: ApiPitchPrediction;
  secondary_prediction: ApiPitchPrediction | null;
  confidence_pct: number; // 0-100, top_prediction.confidence expressed as a percentage
  category_breakdown: Partial<Record<PitchCategory, number>>;
  sample_count: number; // size of the k=50 candidate pool actually used
  exact_match_count: number; // candidates with distance = 0.0 (live session matches)
}

/** POST /api/v1/log-pitch request body. */
export interface LogPitchApiRequest extends ApiSituation {
  actual_pitch: PitchType;
  pitch_result: PitchResultOutcome;
  at_bat_result: AtBatResult;
}

/** POST /api/v1/log-pitch response body. */
export interface LogPitchApiResponse {
  // Partial-credit accuracy for this one pitch. The 0.7 / 0.5 tiers are
  // not yet defined — see the "Scoring" decision still open on this spec.
  accuracy_score: 1.0 | 0.7 | 0.5 | 0.0;
  session_true_accuracy: number;
  session_adjusted_accuracy: number;
  // Game state the server advanced to after applying pitch_result /
  // at_bat_result, echoed back so the client can sync without drifting.
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
  outs: 0 | 1 | 2;
  runners: ApiRunnerState;
}
