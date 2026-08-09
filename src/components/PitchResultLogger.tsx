import { PITCH_RESULTS, PitchResultOutcome } from "@/types";

interface PitchResultLoggerProps {
  selected: PitchResultOutcome | null;
  onSelect: (outcome: PitchResultOutcome) => void;
}

export function PitchResultLogger({ selected, onSelect }: PitchResultLoggerProps) {
  return (
    <div>
      <p className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        Step 1 — Pitch Result
      </p>
      <div role="radiogroup" aria-label="Pitch result" className="grid grid-cols-3 gap-1.5">
        {PITCH_RESULTS.map((outcome) => {
          const isSelected = outcome === selected;
          return (
            <button
              key={outcome}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(outcome)}
              className={`no-transition px-1.5 py-2 text-center font-mono-retro text-2xs font-bold ${
                isSelected
                  ? "bevel-pressed bg-win-yellow text-win-black"
                  : "bevel-out bg-win-white text-win-black hover:bg-win-rowAlt active:bevel-pressed"
              }`}
            >
              {outcome}
            </button>
          );
        })}
      </div>
    </div>
  );
}
