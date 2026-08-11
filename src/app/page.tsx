"use client";

import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AboutPage } from "@/components/AboutPage";
import { SessionBar } from "@/components/SessionBar";
import { PlayerSelector } from "@/components/PlayerSelector";
import { GameSituation } from "@/components/GameSituation";
import { PredictionResult } from "@/components/PredictionResult";
import { SessionAccuracy } from "@/components/SessionAccuracy";
import { LogPitchButton } from "@/components/LogPitchButton";
import { PITCHERS, BATTERS } from "@/data/players";
import { useGameState } from "@/hooks/useGameState";
import { useSession } from "@/hooks/useSession";
import { usePitchLogging } from "@/hooks/usePitchLogging";
import { predictNextPitch } from "@/lib/predictionService";
import { Player, PredictionResult as PredictionResultType } from "@/types";

export default function Home() {
  const [view, setView] = useState<"home" | "about">("home");
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
  const [predictError, setPredictError] = useState<string | null>(null);

  const {
    pitchThrown,
    setPitchThrown,
    pitchResult,
    handlePitchResultChange,
    atBatResult,
    setAtBatResult,
    canLogPitch,
    handleLogPitch,
  } = usePitchLogging({
    pitcher,
    batter,
    gameState,
    predictionResult: result,
    sessionActive: session.active,
    sessionId: session.sessionId,
    logSessionPitch: logPitch,
    setPreviousPitch,
    applyPitchResult,
    applyAtBatResult,
  });

  // Live prediction engine: re-runs automatically whenever the situation
  // changes, as long as a session is active. A request id guards against a
  // slower, stale response landing after a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!session.active || !session.sessionId || !pitcher || !batter) {
      requestIdRef.current += 1;
      setResult(null);
      setPredictError(null);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    predictNextPitch({ pitcher, batter, gameState, sessionId: session.sessionId })
      .then((prediction) => {
        if (requestId !== requestIdRef.current) return;
        setResult(prediction);
        setPredictError(null);
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setPredictError(err instanceof Error ? err.message : "Prediction request failed.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });
  }, [session.active, session.sessionId, pitcher, batter, gameState]);

  const emptyMessage = !session.active
    ? "Start a session to see live predictions."
    : !pitcher || !batter
    ? "Select a pitcher and batter."
    : "Set the current game situation.";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader view={view} onNavigate={setView} />

      {view === "about" ? (
        <AboutPage />
      ) : (
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
            onPitchResultChange={handlePitchResultChange}
            atBatResult={atBatResult}
            onAtBatResultChange={setAtBatResult}
          />
        </div>

        {/* RIGHT: prediction + accuracy — sticky, so this stays in view
            (including the Log Pitch button) no matter how far the left
            column's game-situation form scrolls. */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-3">
          <PredictionResult
            result={result}
            loading={loading}
            emptyMessage={emptyMessage}
            error={predictError}
          />
          <SessionAccuracy
            active={session.active}
            count={stats.count}
            trueAccuracyValue={stats.trueAccuracy}
            adjustedAccuracyValue={stats.adjustedAccuracy}
            log={session.log}
          />
          <LogPitchButton disabled={!canLogPitch} onClick={handleLogPitch} />
        </div>
      </main>
      )}

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
