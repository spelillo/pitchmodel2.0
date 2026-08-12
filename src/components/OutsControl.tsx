interface OutsControlProps {
  active: 0 | 1 | 2;
  onChange: (value: 0 | 1 | 2) => void;
}

const DOT_INDEXES = [0, 1] as const;

export function OutsControl({ active, onChange }: OutsControlProps) {
  return (
    <div>
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        Outs
      </span>
      <div role="radiogroup" aria-label="Outs" className="flex items-center gap-1.5 py-1">
        {DOT_INDEXES.map((index) => {
          const target = (index + 1) as 1 | 2;
          const filled = active >= target;
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={filled}
              aria-label={`${target} out${target === 1 ? "" : "s"}`}
              onClick={() => onChange(active === target ? (index as 0 | 1) : target)}
              className={`no-transition dot-indicator h-4 w-4 border-2 ${
                filled ? "border-win-yellow bg-win-yellow" : "border-win-midGray bg-win-face"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
