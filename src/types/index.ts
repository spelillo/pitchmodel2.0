export type Handedness = "L" | "R" | "S"; // switch hitters only apply to batters

export interface Player {
  id: string;
  name: string;
  team: string; // 3-letter team code
  throws?: Handedness; // pitchers
  bats?: Handedness; // batters
  role: "pitcher" | "batter";
  // Pitchers only. The prediction API's player_name filter matches
  // Statcast's own "Last, First" format exactly (e.g. "Cease, Dylan"),
  // which is *not* the same string as `name` ("Dylan Cease", from the
  // MLB Stats API) — sending `name` there would 404 on every request.
  statcastName?: string;
}

export const PITCH_TYPES = [
  "4-Seam Fastball",
  "Sinker",
  "Cutter",
  "Slider",
  "Sweeper",
  "Slurve",
  "Curveball",
  "Knuckle Curve",
  "Slow Curve",
  "Changeup",
  "Split-Finger",
  "Forkball",
  "Screwball",
  "Knuckleball",
  "Eephus",
  "Pitch Out",
  "Other",
  "Unknown",
] as const;

export type PitchType = (typeof PITCH_TYPES)[number];

export const PITCH_RESULTS = ["Ball", "Strike", "Foul"] as const;

export type PitchResultOutcome = (typeof PITCH_RESULTS)[number];

export const AT_BAT_RESULTS = [
  "Single",
  "Double",
  "Triple",
  "Home Run",
  "Strikeout",
  "Walk",
  "Intent Walk",
  "Hit By Pitch",
  "Field Out",
  "Force Out",
  "Grounded Into DP",
  "Double Play",
  "Triple Play",
  "Strikeout DP",
  "Fielders Choice",
  "Fielders Choice Out",
  "Field Error",
  "Sac Fly",
  "Sac Bunt",
  "Sac Fly DP",
  "Catcher Interf",
  "At Bat Still In Progress",
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

export type PitchCategory = "Fastball" | "Breaking" | "Off-speed" | "Other";

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
  pitcher: Player;
  batter: Player;
  gameState: GameState;
  sessionId: string;
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
  // Identifies this session to the prediction API's in-memory session
  // cache (live 2x-weighting + running accuracy) — null until a session
  // starts, since predictions only run while a session is active anyway.
  sessionId: string | null;
  log: LoggedPitch[];
}
