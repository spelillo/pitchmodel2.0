import { useCallback, useState } from "react";
import { AtBatResult, GameState, PitchResultOutcome } from "@/types";
import { AT_BAT_OUT_DELTA } from "@/lib/atBatOutcomes";

export const DEFAULT_GAME_STATE: GameState = {
  balls: 0,
  strikes: 0,
  outs: 0,
  runners: { first: false, second: false, third: false },
  inning: 1,
  inningHalf: "top",
  previousPitch: null,
};

export function useGameState(initial: GameState = DEFAULT_GAME_STATE) {
  const [gameState, setGameState] = useState<GameState>(initial);

  const setBalls = useCallback((balls: GameState["balls"]) => {
    setGameState((prev) => ({ ...prev, balls }));
  }, []);

  const setStrikes = useCallback((strikes: GameState["strikes"]) => {
    setGameState((prev) => ({ ...prev, strikes }));
  }, []);

  const setOuts = useCallback((outs: GameState["outs"]) => {
    setGameState((prev) => ({ ...prev, outs }));
  }, []);

  const toggleRunner = useCallback((base: keyof GameState["runners"]) => {
    setGameState((prev) => ({
      ...prev,
      runners: { ...prev.runners, [base]: !prev.runners[base] },
    }));
  }, []);

  const setInning = useCallback((inning: number) => {
    setGameState((prev) => ({ ...prev, inning: Math.max(1, inning) }));
  }, []);

  const setInningHalf = useCallback((inningHalf: GameState["inningHalf"]) => {
    setGameState((prev) => ({ ...prev, inningHalf }));
  }, []);

  const setPreviousPitch = useCallback(
    (previousPitch: GameState["previousPitch"]) => {
      setGameState((prev) => ({ ...prev, previousPitch }));
    },
    []
  );

  /** Advance the count after a pitch is thrown, resetting on the natural
   *  end-of-plate-appearance boundaries (walk / strikeout) is intentionally
   *  left to the analyst — this only offers the raw setters above. */
  const resetCount = useCallback(() => {
    setGameState((prev) => ({ ...prev, balls: 0, strikes: 0 }));
  }, []);

  /** A foul ball behaves like a strike, except it can never be the third —
   *  with two strikes it just stays foul. */
  const applyPitchResult = useCallback((outcome: PitchResultOutcome) => {
    setGameState((prev) => {
      if (outcome === "Ball") {
        return { ...prev, balls: Math.min(prev.balls + 1, 3) as GameState["balls"] };
      }
      if (outcome === "Strike") {
        return { ...prev, strikes: Math.min(prev.strikes + 1, 2) as GameState["strikes"] };
      }
      if (prev.strikes < 2) {
        return { ...prev, strikes: (prev.strikes + 1) as GameState["strikes"] };
      }
      return prev;
    });
  }, []);

  /** Ending an at-bat wipes the count and applies whatever outs the result
   *  produces. A third out ends the half-inning instead of overflowing. */
  const applyAtBatResult = useCallback((result: AtBatResult) => {
    setGameState((prev) => {
      const rawOuts = prev.outs + AT_BAT_OUT_DELTA[result];
      if (rawOuts >= 3) {
        return {
          ...prev,
          balls: 0,
          strikes: 0,
          outs: 0,
          runners: { first: false, second: false, third: false },
          inning: prev.inningHalf === "bottom" ? prev.inning + 1 : prev.inning,
          inningHalf: prev.inningHalf === "top" ? "bottom" : "top",
        };
      }
      return {
        ...prev,
        balls: 0,
        strikes: 0,
        outs: rawOuts as GameState["outs"],
      };
    });
  }, []);

  return {
    gameState,
    setGameState,
    setBalls,
    setStrikes,
    setOuts,
    toggleRunner,
    setInning,
    setInningHalf,
    setPreviousPitch,
    resetCount,
    applyPitchResult,
    applyAtBatResult,
  };
}
