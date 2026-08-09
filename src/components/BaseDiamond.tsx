import { RunnerState } from "@/types";

interface BaseDiamondProps {
  runners: RunnerState;
  onToggle: (base: keyof RunnerState) => void;
}

// Coordinates within a 176x176 box.
const HOME = { x: 88, y: 162 };
const FIRST = { x: 154, y: 88 };
const SECOND = { x: 88, y: 14 };
const THIRD = { x: 22, y: 88 };

export function BaseDiamond({ runners, onToggle }: BaseDiamondProps) {
  return (
    <div>
      <span className="mb-1 block font-heading text-2xs uppercase tracking-wide text-win-black">
        Runners
      </span>
      <div className="bevel-in bg-win-paper p-3">
        <div className="relative mx-auto h-[176px] w-[176px]">
          <svg
            viewBox="0 0 176 176"
            width="176"
            height="176"
            aria-hidden="true"
            className="absolute inset-0"
          >
            <polygon
              points={`${HOME.x},${HOME.y} ${FIRST.x},${FIRST.y} ${SECOND.x},${SECOND.y} ${THIRD.x},${THIRD.y}`}
              fill="none"
              stroke="#808080"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* home plate marker */}
            <rect
              x={HOME.x - 7}
              y={HOME.y - 5}
              width="14"
              height="12"
              fill="#C0C0C0"
              stroke="#000000"
              strokeWidth="1.5"
            />
          </svg>

          <Base
            position={SECOND}
            label="Second base"
            occupied={runners.second}
            onClick={() => onToggle("second")}
          />
          <Base
            position={FIRST}
            label="First base"
            occupied={runners.first}
            onClick={() => onToggle("first")}
          />
          <Base
            position={THIRD}
            label="Third base"
            occupied={runners.third}
            onClick={() => onToggle("third")}
          />
        </div>
      </div>
    </div>
  );
}

function Base({
  position,
  label,
  occupied,
  onClick,
}: {
  position: { x: number; y: number };
  label: string;
  occupied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={occupied}
      aria-label={`${label}${occupied ? ", runner on base" : ", empty"}`}
      title={label}
      style={{
        left: `${(position.x / 176) * 100}%`,
        top: `${(position.y / 176) * 100}%`,
      }}
      className="no-transition group absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rotate-45"
    >
      <span
        className={`block h-full w-full border-2 ${
          occupied
            ? "border-win-black bg-win-amber shadow-[2px_2px_0_#000000]"
            : "border-win-midGray border-dashed bg-win-paper group-hover:border-win-black"
        }`}
      />
    </button>
  );
}
