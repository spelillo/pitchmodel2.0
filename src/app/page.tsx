"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SessionBar } from "@/components/SessionBar";
import { PlayerSelector } from "@/components/PlayerSelector";
import { GameSituation } from "@/components/GameSituation";
import { PredictionResult } from "@/components/PredictionResult";
import { SessionAccuracy } from "@/components/SessionAccuracy";
import { PITCHERS, BATTERS } from "@/data/players";
import { useGameState } from "@/hooks/useGameState";
import { useSession } from "@/hooks/useSession";
import { predictNextPitch } from "@/lib/predictionService";
import { trueAccuracy, adjustedAccuracy } from "@/lib/pitchCategories";
import {
  AtBatResult,
  Player,
  PredictionResult as PredictionResultType,
  PitchResultOutcome,
  PitchType,
} from "@/types";

const AT_BAT_STILL_IN_PROGRESS: AtBatResult = "At-bat still in progress";

export default function Home() {
  const [pitcher, setPitcher] = useState<Player | null>(PITCHERS[0]);
  const [batter, setBatter] = useState<Player | null>(BATTERS[0]);

  const {
    gameState,
    setBalls,
    setStrikes,
    setOuts,
    toggleRunner,
    setInning,
    setInningHalf,
    setPreviousPitch,
    applyPitchResult,
    applyAtBatResult,
  } = useGameState();

  const { session, startSession, endSession, logPitch, stats } = useSession();

  const [result, setResult] = useState<PredictionResultType | null>(null);
  const [loading, setLoading] = useState(false);

  const [pitchThrown, setPitchThrown] = useState<PitchType | null>(null);
  const [pitchResult, setPitchResult] = useState<PitchResultOutcome | null>(null);
  const [atBatResult, setAtBatResult] = useState<AtBatResult | null>(null);

  // Live prediction engine: re-runs automatically whenever the situation
  // changes, as long as a session is active. A request id guards against a
  // slower, stale response landing after a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!session.active || !pitcher || !batter) {
      requestIdRef.current += 1;
      setResult(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    predictNextPitch({ pitcherId: pitcher.id, batterId: batter.id, gameState })
      .then((prediction) => {
        if (requestId !== requestIdRef.current) return;
        setResult(prediction);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [session.active, pitcher, batter, gameState]);

  const canLogPitch = pitchResult !== null && atBatResult !== null;

  const handleLogPitch = useCallback(() => {
    if (!pitchResult || !atBatResult) return;

    // 1) Compare the pitch thrown against the model's top prediction and
    //    2) fold it into the session's running accuracy metrics.
    if (pitchThrown && result && session.active && pitcher && batter) {
      logPitch({
        pitcherName: pitcher.name,
        batterName: batter.name,
        count: `${gameState.balls}-${gameState.strikes}`,
        predictedPitch: result.predictedPitch,
        predictedProbability: result.probability,
        actualPitch: pitchThrown,
        trueAccuracy: trueAccuracy(result.predictedPitch, pitchThrown),
        adjustedAccuracy: adjustedAccuracy(result.predictedPitch, pitchThrown),
      });
      setPreviousPitch(pitchThrown);
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
    result,
    session.active,
    pitcher,
    batter,
    gameState.balls,
    gameState.strikes,
    logPitch,
    setPreviousPitch,
    applyPitchResult,
    applyAtBatResult,
  ]);

  const emptyMessage = !session.active
    ? "Start a session to see live predictions."
    : !pitcher || !batter
    ? "Select a pitcher and batter."
    : "Set the current game situation.";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-3 p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-3">
        {/* LEFT: setup */}
        <div className="flex flex-col gap-3">
          <SessionBar
            active={session.active}
            startedAt={session.startedAt}
            pitchCount={stats.count}
            onStart={startSession}
            onEnd={endSession}
          />

          <div className="bevel-out bg-win-face p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PlayerSelector
                label="Pitcher"
                role="pitcher"
                players={PITCHERS}
                selected={pitcher}
                onSelect={setPitcher}
              />
              <PlayerSelector
                label="Batter"
                role="batter"
                players={BATTERS}
                selected={batter}
                onSelect={setBatter}
              />
            </div>
          </div>

          <GameSituation
            gameState={gameState}
            onBallsChange={setBalls}
            onStrikesChange={setStrikes}
            onOutsChange={setOuts}
            onToggleRunner={toggleRunner}
            onInningChange={setInning}
            onInningHalfChange={setInningHalf}
            predictedPitch={result?.predictedPitch ?? null}
            pitchThrown={pitchThrown}
            onPitchThrownChange={setPitchThrown}
            pitchResult={pitchResult}
            onPitchResultChange={setPitchResult}
            atBatResult={atBatResult}
            onAtBatResultChange={setAtBatResult}
            canLogPitch={canLogPitch}
            onLogPitch={handleLogPitch}
          />
        </div>

        {/* RIGHT: prediction + accuracy */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-3">
          <PredictionResult result={result} loading={loading} emptyMessage={emptyMessage} />
          <SessionAccuracy
            active={session.active}
            count={stats.count}
            trueAccuracyValue={stats.trueAccuracy}
            adjustedAccuracyValue={stats.adjustedAccuracy}
            log={session.log}
          />
        </div>
      </main>

      {/* Status bar */}
      <footer className="flex h-6 shrink-0 items-center justify-between border-t-2 border-win-white bg-win-face px-2">
        <span className="bevel-in bg-win-face px-2 font-mono-retro text-2xs text-win-black">
          Ready
        </span>
        <span className="bevel-in bg-win-face px-2 font-mono-retro text-2xs text-win-black">
          PitchModel v2.0
        </span>
      </footer>
    </div>
  );
}
