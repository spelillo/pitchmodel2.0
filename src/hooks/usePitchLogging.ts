import { useCallback, useState } from "react";
import { logPitch as logPitchToApi } from "@/lib/predictionService";
import { trueAccuracy, adjustedAccuracy } from "@/lib/pitchCategories";
import {
  AtBatResult,
  GameState,
  LoggedPitch,
  Player,
  PitchResultOutcome,
  PitchType,
  PredictionResult as PredictionResultType,
} from "@/types";

const AT_BAT_STILL_IN_PROGRESS: AtBatResult = "At Bat Still In Progress";

interface UsePitchLoggingArgs {
  pitcher: Player | null;
  batter: Player | null;
  gameState: GameState;
  predictionResult: PredictionResultType | null;
  sessionActive: boolean;
  sessionId: string | null;
  logSessionPitch: (entry: Omit<LoggedPitch, "id" | "timestamp">) => void;
  setPreviousPitch: (pitch: PitchType) => void;
  applyPitchResult: (outcome: PitchResultOutcome) => void;
  applyAtBatResult: (result: AtBatResult) => void;
}

/** Owns the three-step "what actually happened" form (pitch thrown ->
 *  pitch result -> at-bat result) and committing it: scoring the pitch
 *  locally, folding it into the session log, best-effort telling the
 *  backend, and advancing the count/outs.
 */
export function usePitchLogging({
  pitcher,
  batter,
  gameState,
  predictionResult,
  sessionActive,
  sessionId,
  logSessionPitch,
  setPreviousPitch,
  applyPitchResult,
  applyAtBatResult,
}: UsePitchLoggingArgs) {
  const [pitchThrown, setPitchThrown] = useState<PitchType | null>(null);
  const [pitchResult, setPitchResult] = useState<PitchResultOutcome | null>(null);
  const [atBatResult, setAtBatResult] = useState<AtBatResult | null>(null);

  // Step 2 (At-Bat Result) unlocks the moment Step 1 (Pitch Result) is
  // answered. "At Bat Still In Progress" is by far the most common
  // outcome — most pitches don't end the at-bat — so it's filled in
  // automatically as soon as that step unlocks, instead of making the
  // analyst click it every single pitch. A manual pick always wins: this
  // only fills an empty slot, never overwrites one already made.
  const handlePitchResultChange = useCallback((outcome: PitchResultOutcome) => {
    setPitchResult(outcome);
    setAtBatResult((prev) => prev ?? AT_BAT_STILL_IN_PROGRESS);
  }, []);

  const canLogPitch = pitchResult !== null && atBatResult !== null;

  const handleLogPitch = useCallback(() => {
    if (!pitchResult || !atBatResult) return;

    // 1) Compare the pitch thrown against the model's top prediction and
    //    2) fold it into the session's running accuracy metrics.
    if (pitchThrown && predictionResult && sessionActive && sessionId && pitcher && batter) {
      logSessionPitch({
        pitcherName: pitcher.name,
        batterName: batter.name,
        count: `${gameState.balls}-${gameState.strikes}`,
        predictedPitch: predictionResult.predictedPitch,
        predictedProbability: predictionResult.probability,
        actualPitch: pitchThrown,
        trueAccuracy: trueAccuracy(predictionResult.predictedPitch, pitchThrown),
        adjustedAccuracy: adjustedAccuracy(predictionResult.predictedPitch, pitchThrown),
      });
      setPreviousPitch(pitchThrown);

      // Best-effort: tell the backend what was thrown so its session
      // cache picks it up for live 2x-weighting on the next prediction.
      // Not awaited — scoring above is already computed locally (same
      // logic, mirrored server-side), so the UI doesn't wait on this.
      logPitchToApi({
        pitcher,
        batter,
        gameState,
        sessionId,
        actualPitch: pitchThrown,
        pitchResult,
        atBatResult,
      }).catch((err: unknown) => {
        console.error("log-pitch API call failed (session log already updated locally):", err);
      });
    }

    // 3) Update the count and outs. An at-bat that's still in progress
    //    only advances the count; anything terminal resets the count and
    //    lets the outcome adjust outs (and roll the half-inning on out 3).
    if (atBatResult === AT_BAT_STILL_IN_PROGRESS) {
      applyPitchResult(pitchResult);
    } else {
      applyAtBatResult(atBatResult);
    }

    setPitchThrown(null);
    setPitchResult(null);
    setAtBatResult(null);
  }, [
    pitchThrown,
    pitchResult,
    atBatResult,
    predictionResult,
    sessionActive,
    sessionId,
    pitcher,
    batter,
    gameState,
    logSessionPitch,
    setPreviousPitch,
    applyPitchResult,
    applyAtBatResult,
  ]);

  return {
    pitchThrown,
    setPitchThrown,
    pitchResult,
    handlePitchResultChange,
    atBatResult,
    setAtBatResult,
    canLogPitch,
    handleLogPitch,
  };
}
