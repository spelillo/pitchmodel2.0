"use client";

import { useCallback, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SessionBar } from "@/components/SessionBar";
import { PlayerSelector } from "@/components/PlayerSelector";
import { GameSituation } from "@/components/GameSituation";
import { PredictionButton } from "@/components/PredictionButton";
import { PredictionResult } from "@/components/PredictionResult";
import { SessionAccuracy } from "@/components/SessionAccuracy";
import { PITCHERS, BATTERS } from "@/data/players";
import { useGameState } from "@/hooks/useGameState";
import { useSession } from "@/hooks/useSession";
import { predictNextPitch } from "@/lib/predictionService";
import { trueAccuracy, adjustedAccuracy } from "@/lib/pitchCategories";
import { Player, PredictionResult as PredictionResultType, PitchType } from "@/types";

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
  } = useGameState();

  const { session, startSession, endSession, logPitch, stats } = useSession();

  const [result, setResult] = useState<PredictionResultType | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingLog, setAwaitingLog] = useState(false);
  const [lastLoggedActual, setLastLoggedActual] = useState<PitchType | null>(null);

  const canPredict = Boolean(pitcher && batter) && !loading;

  const handlePredict = useCallback(async () => {
    if (!pitcher || !batter) return;
    setLoading(true);
    try {
      const prediction = await predictNextPitch({
        pitcherId: pitcher.id,
        batterId: batter.id,
        gameState,
      });
      setResult(prediction);
      setAwaitingLog(true);
      setLastLoggedActual(null);
    } finally {
      setLoading(false);
    }
  }, [pitcher, batter, gameState]);

  const handleLogPitch = useCallback(
    (actual: PitchType) => {
      if (!result || !pitcher || !batter) return;

      if (session.active) {
        logPitch({
          pitcherName: pitcher.name,
          batterName: batter.name,
          count: `${gameState.balls}-${gameState.strikes}`,
          predictedPitch: result.predictedPitch,
          predictedProbability: result.probability,
          actualPitch: actual,
          trueAccuracy: trueAccuracy(result.predictedPitch, actual),
          adjustedAccuracy: adjustedAccuracy(result.predictedPitch, actual),
        });
      }

      // Feed the actual pitch forward as "previous pitch" for the next
      // prediction — that's what really happened in the at-bat.
      setPreviousPitch(actual);
      setLastLoggedActual(actual);
      setAwaitingLog(false);
    },
    [result, pitcher, batter, session.active, gameState.balls, gameState.strikes, logPitch, setPreviousPitch]
  );

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
            onPreviousPitchChange={setPreviousPitch}
          />

          <PredictionButton
            onClick={handlePredict}
            loading={loading}
            disabled={!canPredict}
          />
        </div>

        {/* RIGHT: prediction + accuracy */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-3">
          <PredictionResult
            result={result}
            loading={loading}
            awaitingLog={awaitingLog}
            lastLoggedActual={lastLoggedActual}
            onLogPitch={handleLogPitch}
          />
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
