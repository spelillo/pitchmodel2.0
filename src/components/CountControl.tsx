interface CountControlProps {
  label: string;
  values: readonly number[];
  active: number;
  onChange: (value: number) => void;
}

export function CountControl({ label, values, active, onChange }: CountControlProps) {
  return (
    <div>
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1.5 bevel-in bg-win-face p-1.5"
      >
        {values.map((value) => {
          const isActive = value === active;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(value)}
              className={`no-transition flex-1 py-1.5 text-center font-mono-retro text-base font-bold tabular ${
                isActive
                  ? "bevel-pressed bg-win-yellow text-win-black"
                  : "bevel-out bg-win-face text-win-black hover:bg-win-lightGray"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}
