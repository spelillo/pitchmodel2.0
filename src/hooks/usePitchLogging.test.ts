import { act, renderHook } from "@testing-library/react";
import { usePitchLogging } from "./usePitchLogging";
import { GameState, Player, PredictionResult } from "@/types";

jest.mock("@/lib/predictionService", () => ({
  logPitch: jest.fn().mockResolvedValue(undefined),
}));

const pitcher: Player = {
  id: "1",
  name: "Rookie Ace",
  team: "PHI",
  throws: "R",
  role: "pitcher",
  statcastName: "Ace, Rookie",
};

const batter: Player = { id: "2", name: "Slugger", team: "NYY", bats: "R", role: "batter" };

const gameState: GameState = {
  balls: 1,
  strikes: 2,
  outs: 1,
  runners: { first: true, second: false, third: false },
  inning: 5,
  inningHalf: "top",
  previousPitch: null,
};

const predictionResult: PredictionResult = {
  predictedPitch: "4-Seam Fastball",
  probability: 0.4,
  probabilities: [],
  similarSituationTotal: 50,
  similarSituationBreakdown: [],
  matchingSituations: 20,
};

function setup(overrides: Partial<Parameters<typeof usePitchLogging>[0]> = {}) {
  const logSessionPitch = jest.fn();
  const setPreviousPitch = jest.fn();
  const applyPitchResult = jest.fn();
  const applyAtBatResult = jest.fn();

  const { result } = renderHook(() =>
    usePitchLogging({
      pitcher,
      batter,
      gameState,
      predictionResult,
      sessionActive: true,
      sessionId: "session-1",
      logSessionPitch,
      setPreviousPitch,
      applyPitchResult,
      applyAtBatResult,
      ...overrides,
    })
  );

  return { result, logSessionPitch, setPreviousPitch, applyPitchResult, applyAtBatResult };
}

describe("usePitchLogging", () => {
  it("starts with nothing selected and logging disabled", () => {
    const { result } = setup();
    expect(result.current.pitchThrown).toBeNull();
    expect(result.current.pitchResult).toBeNull();
    expect(result.current.atBatResult).toBeNull();
    expect(result.current.canLogPitch).toBe(false);
  });

  it("auto-selects 'At Bat Still In Progress' the moment a pitch result is chosen", () => {
    const { result } = setup();

    act(() => result.current.handlePitchResultChange("Ball"));

    expect(result.current.pitchResult).toBe("Ball");
    expect(result.current.atBatResult).toBe("At Bat Still In Progress");
  });

  it("does not clobber a manually-selected at-bat result on a later pitch-result change", () => {
    const { result } = setup();

    act(() => result.current.handlePitchResultChange("Ball"));
    act(() => result.current.setAtBatResult("Single"));
    act(() => result.current.handlePitchResultChange("Strike"));

    expect(result.current.pitchResult).toBe("Strike");
    expect(result.current.atBatResult).toBe("Single"); // unchanged
  });

  it("enables logging once both steps have a value", () => {
    const { result } = setup();

    act(() => result.current.handlePitchResultChange("Strike"));

    expect(result.current.canLogPitch).toBe(true); // auto-filled step 2 counts
  });

  it("scores and logs the pitch, then resets the three-step form", () => {
    const { result, logSessionPitch, setPreviousPitch, applyPitchResult } = setup();

    act(() => result.current.setPitchThrown("Sinker"));
    act(() => result.current.handlePitchResultChange("Ball")); // -> Still In Progress

    act(() => result.current.handleLogPitch());

    expect(logSessionPitch).toHaveBeenCalledWith(
      expect.objectContaining({
        pitcherName: "Rookie Ace",
        batterName: "Slugger",
        count: "1-2",
        predictedPitch: "4-Seam Fastball",
        actualPitch: "Sinker",
        trueAccuracy: 0,
        adjustedAccuracy: 0.75, // same family (Fastball), not exact
      })
    );
    expect(setPreviousPitch).toHaveBeenCalledWith("Sinker");
    expect(applyPitchResult).toHaveBeenCalledWith("Ball");

    expect(result.current.pitchThrown).toBeNull();
    expect(result.current.pitchResult).toBeNull();
    expect(result.current.atBatResult).toBeNull();
  });

  it("applies the at-bat result instead of just the pitch result when the at-bat ended", () => {
    const { result, applyAtBatResult, applyPitchResult } = setup();

    act(() => result.current.handlePitchResultChange("Strike"));
    act(() => result.current.setAtBatResult("Strikeout"));
    act(() => result.current.handleLogPitch());

    expect(applyAtBatResult).toHaveBeenCalledWith("Strikeout");
    expect(applyPitchResult).not.toHaveBeenCalled();
  });

  it("does nothing when logging is attempted before both steps are answered", () => {
    const { result, applyPitchResult, applyAtBatResult } = setup();

    act(() => result.current.handleLogPitch());

    expect(applyPitchResult).not.toHaveBeenCalled();
    expect(applyAtBatResult).not.toHaveBeenCalled();
  });

  it("still advances game state when no session is active, but skips session logging", () => {
    const { result, logSessionPitch, applyPitchResult } = setup({
      sessionActive: false,
      sessionId: null,
    });

    act(() => result.current.setPitchThrown("Slider"));
    act(() => result.current.handlePitchResultChange("Ball"));
    act(() => result.current.handleLogPitch());

    expect(logSessionPitch).not.toHaveBeenCalled();
    expect(applyPitchResult).toHaveBeenCalledWith("Ball");
  });
});
