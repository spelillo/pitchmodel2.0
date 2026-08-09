import { GameState } from "@/types";
import { CountControl } from "./CountControl";
import { OutsControl } from "./OutsControl";
import { BaseDiamond } from "./BaseDiamond";
import { InningControl } from "./InningControl";
import { PreviousPitch } from "./PreviousPitch";

const BALLS_VALUES = [0, 1, 2, 3] as const;
const STRIKES_VALUES = [0, 1, 2] as const;

interface GameSituationProps {
  gameState: GameState;
  onBallsChange: (value: 0 | 1 | 2 | 3) => void;
  onStrikesChange: (value: 0 | 1 | 2) => void;
  onOutsChange: (value: 0 | 1 | 2) => void;
  onToggleRunner: (base: keyof GameState["runners"]) => void;
  onInningChange: (inning: number) => void;
  onInningHalfChange: (half: "top" | "bottom") => void;
  onPreviousPitchChange: (pitch: GameState["previousPitch"]) => void;
}

export function GameSituation({
  gameState,
  onBallsChange,
  onStrikesChange,
  onOutsChange,
  onToggleRunner,
  onInningChange,
  onInningHalfChange,
  onPreviousPitchChange,
}: GameSituationProps) {
  return (
    <section aria-label="Game situation" className="bevel-out bg-win-face">
      <div
        className="flex h-6 items-center px-1.5"
        style={{ background: "linear-gradient(to right, #000080, #1084D0)" }}
      >
        <h2 className="text-2xs font-bold text-white">GAME_SITUATION.DAT</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 p-3">
        <CountControl
          label="Balls"
          values={BALLS_VALUES}
          active={gameState.balls}
          onChange={(v) => onBallsChange(v as 0 | 1 | 2 | 3)}
        />
        <CountControl
          label="Strikes"
          values={STRIKES_VALUES}
          active={gameState.strikes}
          onChange={(v) => onStrikesChange(v as 0 | 1 | 2)}
        />
      </div>

      <hr className="groove mx-3" />

      <div className="p-3">
        <OutsControl active={gameState.outs} onChange={onOutsChange} />
      </div>

      <hr className="groove mx-3" />

      <div className="grid grid-cols-[176px_1fr] gap-3 p-3">
        <BaseDiamond runners={gameState.runners} onToggle={onToggleRunner} />
        <div className="flex flex-col gap-3">
          <InningControl
            inning={gameState.inning}
            half={gameState.inningHalf}
            onInningChange={onInningChange}
            onHalfChange={onInningHalfChange}
          />
        </div>
      </div>

      <hr className="groove mx-3" />

      <div className="p-3">
        <PreviousPitch
          pitch={gameState.previousPitch}
          onPitchChange={onPreviousPitchChange}
        />
      </div>
    </section>
  );
}
