"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/format";

interface SessionBarProps {
  active: boolean;
  startedAt: number | null;
  pitchCount: number;
  onStart: () => void;
  onEnd: () => void;
}

export function SessionBar({
  active,
  startedAt,
  pitchCount,
  onStart,
  onEnd,
}: SessionBarProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return (
    <div className="flex items-center justify-between gap-3 bevel-out bg-win-face px-3 py-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 border border-win-black ${
            active ? "blink bg-win-red" : "bg-win-midGray"
          }`}
        />
        <span className="font-mono-retro text-sm font-bold uppercase tracking-wide text-win-black">
          Session: {active ? "Active" : "Inactive"}
        </span>
        {active && (
          <>
            <span className="hidden font-mono-retro text-sm tabular text-win-black sm:inline">
              {formatElapsed(startedAt, now)}
            </span>
            <span className="hidden font-mono-retro text-sm tabular text-win-black sm:inline">
              {pitchCount} logged
            </span>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={active ? onEnd : onStart}
        className="no-transition bevel-out bg-win-face px-3 py-1.5 font-heading text-2xs uppercase tracking-wide text-win-black active:bevel-pressed"
      >
        {active ? "End Session" : "Start Session"}
      </button>
    </div>
  );
}
