import { PITCH_TYPES, PitchType } from "@/types";

interface PitchThrownSelectorProps {
  predictedPitch: PitchType | null;
  selected: PitchType | null;
  onSelect: (pitch: PitchType) => void;
}

export function PitchThrownSelector({
  predictedPitch,
  selected,
  onSelect,
}: PitchThrownSelectorProps) {
  return (
    <div>
      <p className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        Pitch Thrown
      </p>
      <div
        role="radiogroup"
        aria-label="Pitch thrown"
        className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
      >
        {PITCH_TYPES.map((type) => {
          const isPredicted = type === predictedPitch;
          const isSelected = type === selected;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(type)}
              title={isPredicted ? `${type} (predicted)` : type}
              className={`no-transition relative px-1.5 py-2 text-left font-mono-retro text-2xs font-bold leading-tight ${
                isSelected
                  ? "bevel-pressed bg-win-yellow text-win-black"
                  : "bevel-out bg-win-white text-win-black hover:bg-win-rowAlt active:bevel-pressed"
              }`}
            >
              {isPredicted && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-none bg-win-blue"
                  title="Predicted pitch"
                />
              )}
              {type}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono-retro text-2xs text-win-midGray">
        <span className="inline-block h-1.5 w-1.5 bg-win-blue align-middle" aria-hidden="true" />{" "}
        = model&apos;s current top prediction.
      </p>
    </div>
  );
}
