import { SimilarSituationBreakdown } from "@/types";

interface SimilarSituationsProps {
  total: number;
  breakdown: SimilarSituationBreakdown[];
}

export function SimilarSituations({ total, breakdown }: SimilarSituationsProps) {
  const max = breakdown[0]?.count ?? 1;

  return (
    <div>
      <h3 className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-black">
        Similar Situations
      </h3>
      <p className="mb-1.5 text-sm text-win-black">
        <span className="font-mono-retro font-bold tabular">{total}</span>{" "}
        similar historical situations
      </p>
      <div className="bevel-in bg-win-white">
        <ul>
          {breakdown.map((entry, index) => (
            <li
              key={entry.pitch}
              className={`flex items-center gap-2.5 border-b border-win-lightGray px-2 py-1 last:border-b-0 ${
                index % 2 === 1 ? "bg-win-rowAlt" : "bg-win-white"
              }`}
            >
              <span
                className={`w-[120px] shrink-0 truncate text-2xs ${
                  index === 0 ? "font-bold text-win-black" : "text-win-black"
                }`}
              >
                {entry.pitch}
              </span>
              <span className="h-2.5 flex-1 bevel-in bg-win-white p-0.5">
                <span
                  className="block h-full bg-win-midGray"
                  style={{ width: `${Math.max(4, (entry.count / max) * 100)}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right font-mono-retro text-2xs font-bold tabular text-win-black">
                {entry.count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
