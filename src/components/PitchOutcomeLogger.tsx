import { PITCH_TYPES, PitchType } from "@/types";

interface PitchOutcomeLoggerProps {
  predictedPitch: PitchType;
  awaitingLog: boolean;
  loggedActual: PitchType | null;
  onLog: (actual: PitchType) => void;
}

export function PitchOutcomeLogger({
  predictedPitch,
  awaitingLog,
  loggedActual,
  onLog,
}: PitchOutcomeLoggerProps) {
  return (
    <div className="mx-3 mb-3 bevel-in bg-win-face p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-heading text-2xs uppercase tracking-wide text-win-black">
          Log Actual Pitch Thrown
        </p>
        {!awaitingLog && loggedActual && (
          <span className="bevel-out bg-win-yellow px-1.5 py-0.5 font-mono-retro text-2xs font-bold text-win-black">
            LOGGED: {loggedActual.toUpperCase()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {PITCH_TYPES.map((type) => {
          const isPredicted = type === predictedPitch;
          const isLogged = type === loggedActual;
          return (
            <button
              key={type}
              type="button"
              disabled={!awaitingLog}
              onClick={() => onLog(type)}
              title={isPredicted ? `${type} (predicted)` : type}
              className={`no-transition relative px-1.5 py-2 text-left font-mono-retro text-2xs font-bold leading-tight ${
                !awaitingLog
                  ? isLogged
                    ? "bevel-pressed bg-win-yellow text-win-black"
                    : "bevel-in bg-win-lightGray text-win-midGray"
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

      {awaitingLog && (
        <p className="mt-2 font-mono-retro text-2xs text-win-midGray">
          <span className="inline-block h-1.5 w-1.5 bg-win-blue align-middle" aria-hidden="true" />{" "}
          = model predicted this pitch. Click what was actually thrown.
        </p>
      )}
    </div>
  );
}
