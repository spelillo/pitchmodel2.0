import { AT_BAT_RESULTS, AtBatResult } from "@/types";

interface AtBatResultLoggerProps {
  selected: AtBatResult | null;
  onSelect: (result: AtBatResult) => void;
  disabled: boolean;
}

export function AtBatResultLogger({ selected, onSelect, disabled }: AtBatResultLoggerProps) {
  return (
    <div>
      <p className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        Step 2 — At-Bat Result
      </p>
      <div
        role="radiogroup"
        aria-label="At-bat result"
        aria-disabled={disabled}
        className={`grid grid-cols-2 gap-1.5 sm:grid-cols-4 ${disabled ? "opacity-60" : ""}`}
      >
        {AT_BAT_RESULTS.map((result) => {
          const isSelected = result === selected;
          return (
            <button
              key={result}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(result)}
              className={`no-transition px-1.5 py-2 text-left font-mono-retro text-2xs font-bold leading-tight ${
                disabled
                  ? "bevel-in bg-win-lightGray text-win-midGray"
                  : isSelected
                  ? "bevel-pressed bg-win-yellow text-win-black"
                  : "bevel-out bg-win-white text-win-black hover:bg-win-rowAlt active:bevel-pressed"
              }`}
            >
              {result}
            </button>
          );
        })}
      </div>
    </div>
  );
}
