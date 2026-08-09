import { PredictionResult as PredictionResultType } from "@/types";
import { formatPercent } from "@/lib/format";
import { ProbabilityList } from "./ProbabilityList";
import { SimilarSituations } from "./SimilarSituations";

interface PredictionResultProps {
  result: PredictionResultType | null;
  loading: boolean;
  emptyMessage: string;
  error?: string | null;
}

export function PredictionResult({ result, loading, emptyMessage, error }: PredictionResultProps) {
  return (
    <section aria-label="Prediction result" aria-live="polite" className="bevel-out bg-win-face">
      <div
        className="flex h-6 items-center px-1.5"
        style={{ background: "linear-gradient(to right, #000080, #1084D0)" }}
      >
        <h2 className="text-2xs font-bold text-white">
          PREDICTION ENGINE — OUTPUT.LOG
        </h2>
      </div>

      {!result ? (
        <EmptyState loading={loading} message={emptyMessage} error={error} />
      ) : (
        <div className={loading ? "opacity-60" : "opacity-100"}>
          {/* Hit-counter style pitch display */}
          <div className="m-3 bevel-in bg-win-black p-3">
            <div className="flex items-center gap-1.5">
              <p className="font-mono-retro text-2xs font-bold uppercase tracking-wide text-win-green">
                &gt; predicted_next_pitch
              </p>
              <span
                aria-hidden="true"
                className="blink border border-win-red bg-win-red px-1 font-mono-retro text-[9px] font-bold text-win-white"
              >
                HOT!
              </span>
            </div>
            <p className="mt-1 font-mono-retro text-2xl font-bold uppercase text-win-green">
              {result.predictedPitch}
            </p>
            <p className="font-mono-retro text-4xl font-bold tabular text-win-green">
              {formatPercent(result.probability)}
            </p>
            <p className="font-mono-retro text-2xs text-win-green opacity-80">
              most likely pitch
            </p>
          </div>

          {/* Explanation, Notepad-style */}
          <div className="mx-3 mb-3 bevel-in bg-win-paper p-2.5">
            <p className="font-heading text-2xs uppercase tracking-wide text-win-black">
              Why {result.predictedPitch.toUpperCase()}?
            </p>
            <p className="mt-1 font-mono-retro text-sm text-win-black">
              <span className="font-bold tabular">{result.matchingSituations}</span>{" "}
              of the{" "}
              <span className="font-bold tabular">{result.similarSituationTotal}</span>{" "}
              most similar historical situations resulted in a{" "}
              {result.predictedPitch.toLowerCase()}.
            </p>
          </div>

          <div className="mx-3 mb-3">
            <ProbabilityList probabilities={result.probabilities} />
          </div>

          <div className="mx-3 mb-3">
            <SimilarSituations
              total={result.similarSituationTotal}
              breakdown={result.similarSituationBreakdown}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({
  loading,
  message,
  error,
}: {
  loading: boolean;
  message: string;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="m-3 bevel-in bg-win-black p-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <span aria-hidden="true" className="blink font-mono-retro text-lg font-bold text-win-green">
            LOADING...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-3 bevel-in bg-win-black p-8">
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="font-mono-retro text-sm font-bold uppercase tracking-wide text-win-red">
            PREDICTION FAILED
          </p>
          <p className="max-w-[36ch] font-mono-retro text-2xs text-win-red opacity-90">{error}</p>
          <p className="max-w-[36ch] font-mono-retro text-2xs text-win-midGray">
            The next situation change will retry automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="m-3 bevel-in bg-win-black p-8">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <p className="font-mono-retro text-sm font-bold uppercase tracking-wide text-win-green">
          READY FOR PREDICTION
        </p>
        <p className="max-w-[30ch] font-mono-retro text-2xs text-win-green opacity-70">{message}</p>
        <span aria-hidden="true" className="blink mt-1 font-mono-retro text-lg text-win-green">
          _
        </span>
      </div>
    </div>
  );
}
