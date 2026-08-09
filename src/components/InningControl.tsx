interface InningControlProps {
  inning: number;
  half: "top" | "bottom";
  onInningChange: (inning: number) => void;
  onHalfChange: (half: "top" | "bottom") => void;
}

export function InningControl({
  inning,
  half,
  onInningChange,
  onHalfChange,
}: InningControlProps) {
  return (
    <div>
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        Inning
      </span>
      <div className="flex items-stretch gap-1.5">
        <div className="flex items-center gap-1 bevel-in bg-win-white px-1.5 py-1">
          <StepButton
            direction="down"
            label="Decrease inning"
            onClick={() => onInningChange(Math.max(1, inning - 1))}
          />
          <span className="w-6 text-center font-mono-retro text-base font-bold tabular text-win-black">
            {inning}
          </span>
          <StepButton
            direction="up"
            label="Increase inning"
            onClick={() => onInningChange(inning + 1)}
          />
        </div>
        <div className="flex gap-1">
          <HalfButton
            label="TOP"
            fullLabel="Top of the inning"
            active={half === "top"}
            onClick={() => onHalfChange("top")}
          />
          <HalfButton
            label="BOT"
            fullLabel="Bottom of the inning"
            active={half === "bottom"}
            onClick={() => onHalfChange("bottom")}
          />
        </div>
      </div>
    </div>
  );
}

function StepButton({
  direction,
  label,
  onClick,
}: {
  direction: "up" | "down";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="no-transition flex h-6 w-5 items-center justify-center bevel-out bg-win-face text-win-black active:bevel-pressed"
    >
      <span aria-hidden="true" className="text-[10px] font-bold leading-none">
        {direction === "up" ? "▲" : "▼"}
      </span>
    </button>
  );
}

function HalfButton({
  label,
  fullLabel,
  active,
  onClick,
}: {
  label: string;
  fullLabel: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={fullLabel}
      title={fullLabel}
      className={`no-transition h-8 px-2 font-mono-retro text-2xs font-bold ${
        active ? "bevel-pressed bg-win-yellow text-win-black" : "bevel-out bg-win-face text-win-black"
      }`}
    >
      {label}
    </button>
  );
}
