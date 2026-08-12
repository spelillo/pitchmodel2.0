import { AtBatResult, Handedness, PitchCategory, PitchResultOutcome, PitchType } from "@/types";

// -----------------------------------------------------------------------
// LIVE BACKEND CONTRACT
//
// These types describe the wire shape of the FastAPI KNN prediction
// service, live at https://pitchmodel2-0.onrender.com. Field names are
// snake_case to mirror the JSON the backend actually sends, unlike the
// camelCase domain types in "@/types" that the rest of the frontend
// consumes — lib/predictionService.ts is the adapter between the two.
//
// Matchup + count are hard filters, resolved server-side with a
// fallback hierarchy before the distance formula ever runs:
//   1. pitcher_id + batter_id head-to-head history, if they've faced
//      each other >= 10 times; else pitcher_id + b_hand (batter's
//      resolved hand) cohort.
//   2. balls + strikes exact match, if that matchup has >= 8 pitches
//      at that exact count; else the ahead/even/behind count bucket
//      (rare — logged server-side when it fires).
//
// Distance formula (weighted KNN over whatever pool step 1+2 leaves,
// lower = more similar):
//   distance = |Δballs| × 5.83 + |Δstrikes| × 8.75 + |Δouts| × 5.0
//            + runnersPenalty(15.0 if any base mismatches)
//            + inningPenalty(5.0 if inning string mismatches)
// (balls/strikes terms are no-ops within an exact-count pool, but still
// rank rows within a bucket-fallback pool.)
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
  // MLBAM ids (same id space as Statcast's `pitcher`/`batter` columns
  // and Player.id) — used for the head-to-head matchup lookup and,
  // when it clears the threshold, the batter-specific query itself.
  pitcher_id: string;
  batter_id: string;
  // Must already be resolved to "L"/"R" by the caller — a switch hitter
  // ("S") has no fixed side, it depends on which pitcher they're facing.
  // See @/lib/handedness's resolveBatterHandedness(). Used for the
  // pitcher-vs-batter-hand fallback cohort.
  b_hand: Handedness;
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
  outs: 0 | 1 | 2;
  runners: ApiRunnerState;
  inning: number;
  inning_topbot: "Top" | "Bot"; // matches raw Statcast values; needed by the inning-penalty term
  session_id: string;
}

export interface ApiPitchPrediction {
  pitch_type: PitchType;
  confidence: number; // 0-1
}

export interface ApiRankedPitch {
  pitch_type: PitchType;
  count: number;
  probability: number; // 0-1, count / sample_count
}

/** POST /api/v1/predict request body. */
export type PredictApiRequest = ApiSituation;

/** POST /api/v1/predict response body. */
export interface PredictApiResponse {
  top_prediction: ApiPitchPrediction;
  secondary_prediction: ApiPitchPrediction | null;
  confidence_pct: number; // 0-100, top_prediction.confidence expressed as a percentage
  // Full breakdown (up to 5 pitches, sorted by count desc) — top_prediction
  // and secondary_prediction are ranked_pitches[0]/[1].
  ranked_pitches: ApiRankedPitch[];
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
  // This pitch's score, mirroring @/lib/pitchCategories.ts's
  // trueAccuracy/adjustedAccuracy exactly: true_accuracy is 1 only on an
  // exact pitch match; adjusted_accuracy gives partial credit (0.75) for
  // a same-category miss.
  true_accuracy: 0 | 1;
  adjusted_accuracy: 0 | 0.75 | 1;
  // Running session totals: session_true_accuracy is (sum of
  // true_accuracy) / pitch count; session_adjusted_accuracy is the same
  // over adjusted_accuracy.
  session_true_accuracy: number;
  session_adjusted_accuracy: number;
  // Game state the server advanced to after applying pitch_result /
  // at_bat_result, echoed back so the client can sync without drifting.
  // inning/inning_topbot only change on a third-out half-inning rollover.
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
  outs: 0 | 1 | 2;
  runners: ApiRunnerState;
  inning: number;
  inning_topbot: "Top" | "Bot";
}
