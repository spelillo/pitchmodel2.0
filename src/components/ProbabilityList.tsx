import { PitchProbability } from "@/types";
import { formatPercent } from "@/lib/format";

interface ProbabilityListProps {
  probabilities: PitchProbability[];
}

const BAR_COLORS = ["bg-win-blue", "bg-win-red", "bg-win-navy", "bg-win-midGray", "bg-win-midGray"];

export function ProbabilityList({ probabilities }: ProbabilityListProps) {
  const max = probabilities[0]?.probability ?? 1;

  return (
    <div>
      <h3 className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        Pitch Probabilities
      </h3>
      <div className="bevel-in bg-win-white">
        <ul>
          {probabilities.map((entry, index) => (
            <li
              key={entry.pitch}
              className={`flex items-center gap-2.5 border-b border-win-lightGray px-2 py-1.5 last:border-b-0 ${
                index % 2 === 1 ? "bg-win-rowAlt" : "bg-win-white"
              }`}
            >
              <span
                className={`w-[120px] shrink-0 truncate text-sm ${
                  index === 0 ? "font-bold text-win-black" : "text-win-black"
                }`}
              >
                {entry.pitch}
              </span>
              <span className="h-3.5 flex-1 bevel-in bg-win-white p-0.5">
                <span
                  className={`block h-full ${BAR_COLORS[index] ?? "bg-win-midGray"}`}
                  style={{ width: `${Math.max(4, (entry.probability / max) * 100)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-mono-retro text-sm font-bold tabular text-win-black">
                {formatPercent(entry.probability)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
