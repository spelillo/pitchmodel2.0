import { useCallback, useState } from "react";
import { GameState } from "@/types";

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
  };
}
