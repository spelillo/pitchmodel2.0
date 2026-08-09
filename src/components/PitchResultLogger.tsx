import { PITCH_RESULTS, PitchResultOutcome } from "@/types";

interface PitchResultLoggerProps {
  balls: number;
  strikes: number;
  onLog: (outcome: PitchResultOutcome) => void;
}

export function PitchResultLogger({ balls, strikes, onLog }: PitchResultLoggerProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-heading text-2xs uppercase tracking-wide text-win-black">
          Pitch Result
        </p>
        <span className="bevel-in bg-win-white px-1.5 py-0.5 font-mono-retro text-2xs font-bold tabular text-win-black">
          {balls}-{strikes}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {PITCH_RESULTS.map((outcome) => (
          <button
            key={outcome}
            type="button"
            onClick={() => onLog(outcome)}
            className="no-transition bevel-out bg-win-white px-1.5 py-2 text-center font-mono-retro text-2xs font-bold text-win-black hover:bg-win-rowAlt active:bevel-pressed"
          >
            {outcome}
          </button>
        ))}
      </div>
    </div>
  );
}
