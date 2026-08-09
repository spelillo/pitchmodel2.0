import { AT_BAT_RESULTS, AtBatResult } from "@/types";

interface AtBatResultLoggerProps {
  onLog: (result: AtBatResult) => void;
}

export function AtBatResultLogger({ onLog }: AtBatResultLoggerProps) {
  return (
    <div>
      <p className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        At-Bat Result
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {AT_BAT_RESULTS.map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onLog(result)}
            title={`${result} — resets the count`}
            className="no-transition bevel-out bg-win-white px-1.5 py-2 text-left font-mono-retro text-2xs font-bold leading-tight text-win-black hover:bg-win-rowAlt active:bevel-pressed"
          >
            {result}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono-retro text-2xs text-win-midGray">
        Selecting a result clears the count and adjusts outs.
      </p>
    </div>
  );
}
