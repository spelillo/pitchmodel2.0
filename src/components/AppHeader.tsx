type View = "home" | "about";

interface AppHeaderProps {
  view: View;
  onNavigate: (view: View) => void;
}

export function AppHeader({ view, onNavigate }: AppHeaderProps) {
  return (
    <header className="shrink-0">
      {/* Windows 95 title bar */}
      <div
        className="flex h-8 items-center justify-between gap-2 px-1.5"
        style={{
          background: "linear-gradient(to right, #000080, #1084D0)",
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <TitleBarIcon />
          <span className="truncate text-sm font-bold text-white">
            pitchmodel.exe — Next Pitch Prediction System
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TitleBarButton label="_" />
          <TitleBarButton label="□" />
          <TitleBarButton label="✕" />
        </div>
      </div>

      {/* Menu bar */}
      <div className="flex h-6 items-center gap-4 border-b-2 border-win-midGray bg-win-face px-2 text-2xs">
        <MenuItem label="Home" active={view === "home"} onClick={() => onNavigate("home")} />
        <MenuItem label="About" active={view === "about"} onClick={() => onNavigate("about")} />
      </div>

      {/* Marquee banner */}
      <div className="h-6 overflow-hidden bevel-in bg-win-black">
        <div className="flex h-full items-center whitespace-nowrap">
          <span className="marquee-track font-mono-retro text-sm font-bold text-win-green">
            *** PITCHMODEL ML v2.0 — STATCAST NEXT-PITCH PREDICTION SYSTEM
            *** ACTIVE GAME MODE ***
          </span>
        </div>
      </div>
    </header>
  );
}

function TitleBarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="22" height="22" fill="#C0C0C0" stroke="#000000" strokeWidth="1" />
      <circle cx="12" cy="12" r="7" fill="#FFFFFF" stroke="#000000" strokeWidth="1" />
      <path d="M7 6C5.5 8 5 10 5 12s.5 4 2 6" stroke="#FF0000" strokeWidth="1" />
      <path d="M17 6c1.5 2 2 4 2 6s-.5 4-2 6" stroke="#FF0000" strokeWidth="1" />
    </svg>
  );
}

function MenuItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`underline decoration-1 underline-offset-2 hover:text-win-blue ${
        active ? "font-bold" : ""
      }`}
    >
      {label}
    </button>
  );
}

function TitleBarButton({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-4 w-4 items-center justify-center bevel-out bg-win-face text-[10px] font-bold leading-none text-win-black"
    >
      {label}
    </span>
  );
}
