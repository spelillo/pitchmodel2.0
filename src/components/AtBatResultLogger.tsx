import { AtBatResult } from "@/types";
import { AT_BAT_RESULT_COLUMNS } from "@/lib/atBatResultLayout";

const STILL_IN_PROGRESS: AtBatResult = "At Bat Still In Progress";

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
        className={`grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-4 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {AT_BAT_RESULT_COLUMNS.map((column) => (
          <div key={column.label} className="flex flex-col gap-1.5">
            <p className="font-mono-retro text-2xs font-bold text-win-black">{column.label}</p>
            <div className="flex flex-col gap-1.5">
              {column.results.map((result) => {
                const isSelected = result === selected;
                const isStillInProgress = result === STILL_IN_PROGRESS;
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
                    } ${
                      isStillInProgress
                        ? "outline outline-2 -outline-offset-2 outline-win-black"
                        : ""
                    }`}
                  >
                    {result}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
