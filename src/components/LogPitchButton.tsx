interface LogPitchButtonProps {
  disabled: boolean;
  onClick: () => void;
}

export function LogPitchButton({ disabled, onClick }: LogPitchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`no-transition flex h-11 w-full items-center justify-center font-heading text-sm uppercase tracking-wide ${
        disabled
          ? "bevel-in bg-win-face text-win-midGray"
          : "bevel-out bg-win-green text-win-black active:bevel-pressed"
      }`}
    >
      Log Pitch
    </button>
  );
}
