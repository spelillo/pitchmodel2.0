interface PredictionButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}

export function PredictionButton({ onClick, loading, disabled }: PredictionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`no-transition flex h-14 w-full items-center justify-center gap-2 bg-win-face font-heading text-lg uppercase tracking-wide text-win-black ${
        disabled || loading ? "bevel-in text-win-midGray" : "bevel-out active:bevel-pressed"
      }`}
    >
      {loading ? (
        <>
          <span className="font-mono-retro text-base">Predicting</span>
          <span aria-hidden="true" className="blink font-mono-retro text-base">
            ▮▮▮
          </span>
        </>
      ) : (
        "Predict Next Pitch"
      )}
    </button>
  );
}
