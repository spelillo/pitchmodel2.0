import { LoggedPitch } from "@/types";
import { formatPercent } from "@/lib/format";

interface SessionAccuracyProps {
  active: boolean;
  count: number;
  trueAccuracyValue: number;
  adjustedAccuracyValue: number;
  log: LoggedPitch[];
}

export function SessionAccuracy({
  active,
  count,
  trueAccuracyValue,
  adjustedAccuracyValue,
  log,
}: SessionAccuracyProps) {
  return (
    <section aria-label="Session accuracy" className="bevel-out bg-win-face">
      <div
        className="flex h-6 items-center px-1.5"
        style={{ background: "linear-gradient(to right, #000080, #1084D0)" }}
      >
        <h2 className="text-2xs font-bold text-white">SESSION_ACCURACY.DAT</h2>
      </div>

      <div className="p-3">
        {count === 0 ? (
          <div className="bevel-in bg-win-black p-4 text-center">
            <p className="font-mono-retro text-2xs uppercase tracking-wide text-win-green opacity-80">
              {active
                ? "No pitches logged yet this session."
                : "Start a session and log pitches to see accuracy."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <AccuracyCounter label="True Accuracy" value={trueAccuracyValue} />
              <AccuracyCounter label="Adjusted Accuracy" value={adjustedAccuracyValue} />
            </div>
            <p className="mt-2 font-mono-retro text-2xs text-win-midGray">
              based on {count} logged {count === 1 ? "pitch" : "pitches"}
            </p>

            <div className="mt-3 bevel-in max-h-64 overflow-y-auto bg-win-white no-scrollbar">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-win-midGray bg-win-face">
                    <Th>Count</Th>
                    <Th>Predicted</Th>
                    <Th>Actual</Th>
                    <Th className="text-right">True</Th>
                    <Th className="text-right">Adj.</Th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((entry, index) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-win-lightGray ${
                        index % 2 === 1 ? "bg-win-rowAlt" : "bg-win-white"
                      }`}
                    >
                      <Td className="font-mono-retro tabular">{entry.count}</Td>
                      <Td>{entry.predictedPitch}</Td>
                      <Td>{entry.actualPitch}</Td>
                      <Td
                        className={`text-right font-mono-retro font-bold tabular ${
                          entry.trueAccuracy === 1 ? "text-win-blue" : "text-win-red"
                        }`}
                      >
                        {entry.trueAccuracy}
                      </Td>
                      <Td
                        className={`text-right font-mono-retro font-bold tabular ${
                          entry.adjustedAccuracy === 1
                            ? "text-win-blue"
                            : entry.adjustedAccuracy === 0.75
                            ? "text-win-amber"
                            : "text-win-red"
                        }`}
                      >
                        {entry.adjustedAccuracy}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AccuracyCounter({ label, value }: { label: string; value: number }) {
  return (
    <div className="bevel-in bg-win-black p-2.5">
      <p className="font-mono-retro text-2xs font-bold uppercase tracking-wide text-win-green opacity-80">
        {label}
      </p>
      <p className="font-mono-retro text-3xl font-bold tabular text-win-green">
        {formatPercent(value)}
      </p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-2 py-1 font-mono-retro text-2xs font-bold uppercase text-win-black ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-2 py-1 text-2xs text-win-black ${className}`}>{children}</td>;
}
