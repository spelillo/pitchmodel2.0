export type Handedness = "L" | "R" | "S"; // switch hitters only apply to batters

export interface Player {
  id: string;
  name: string;
  team: string; // 3-letter team code
  throws?: Handedness; // pitchers
  bats?: Handedness; // batters
  role: "pitcher" | "batter";
}

export const PITCH_TYPES = [
  "Four-Seam Fastball",
  "Sinker",
  "Cutter",
  "Slider",
  "Sweeper",
  "Curveball",
  "Changeup",
  "Splitter",
] as const;

export type PitchType = (typeof PITCH_TYPES)[number];

export const PITCH_RESULTS = ["Ball", "Strike", "Foul"] as const;

export type PitchResultOutcome = (typeof PITCH_RESULTS)[number];

export const AT_BAT_RESULTS = [
  "Strikeout",
  "Walk",
  "Hit By Pitch",
  "Single",
  "Double",
  "Triple",
  "Home Run",
  "Groundout",
  "Flyout",
  "Popout",
  "Double Play",
  "Triple Play",
  "Sac Fly",
  "Fielder's Choice",
  "Error",
  "At-bat still in progress",
] as const;

export type AtBatResult = (typeof AT_BAT_RESULTS)[number];

export interface RunnerState {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface GameState {
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
  outs: 0 | 1 | 2;
  runners: RunnerState;
  inning: number;
  inningHalf: "top" | "bottom";
  previousPitch: PitchType | null;
}

export type PitchCategory = "Fastball" | "Breaking Ball" | "Offspeed";

export interface PitchProbability {
  pitch: PitchType;
  probability: number; // 0-1
}

export interface SimilarSituationBreakdown {
  pitch: PitchType;
  count: number;
}

export interface PredictionResult {
  predictedPitch: PitchType;
  probability: number;
  probabilities: PitchProbability[];
  similarSituationTotal: number;
  similarSituationBreakdown: SimilarSituationBreakdown[];
  matchingSituations: number; // how many of the similar situations matched the predicted pitch
}

export interface PredictionRequest {
  pitcherId: string;
  batterId: string;
  gameState: GameState;
}

/** One logged outcome: a prediction that was checked against the pitch that
 *  was actually thrown. Scored two ways — see lib/pitchCategories.ts. */
export interface LoggedPitch {
  id: string;
  timestamp: number;
  pitcherName: string;
  batterName: string;
  count: string; // e.g. "1-2"
  predictedPitch: PitchType;
  predictedProbability: number;
  actualPitch: PitchType;
  trueAccuracy: 0 | 1;
  adjustedAccuracy: 0 | 0.75 | 1;
}

export interface SessionState {
  active: boolean;
  startedAt: number | null;
  log: LoggedPitch[];
}
