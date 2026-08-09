import { PitchCategory, PitchType } from "@/types";

// Every pitch type in the app's arsenal, grouped into the families
// analysts actually talk about. Extend this map first if PITCH_TYPES grows.
export const PITCH_CATEGORY_MAP: Record<PitchType, PitchCategory> = {
  "4-Seam Fastball": "Fastball",
  Sinker: "Fastball",
  Cutter: "Fastball",
  Slider: "Breaking",
  Sweeper: "Breaking",
  Slurve: "Breaking",
  Curveball: "Breaking",
  "Knuckle Curve": "Breaking",
  "Slow Curve": "Breaking",
  Changeup: "Off-speed",
  "Split-Finger": "Off-speed",
  Forkball: "Off-speed",
  Screwball: "Off-speed",
  Knuckleball: "Off-speed",
  Eephus: "Off-speed",
  "Pitch Out": "Other",
  Other: "Other",
  Unknown: "Other",
};

export function pitchCategory(pitch: PitchType): PitchCategory {
  return PITCH_CATEGORY_MAP[pitch];
}

/** Exact-match scoring: 1 if the predicted pitch was the pitch actually
 *  thrown, 0 otherwise. No partial credit. */
export function trueAccuracy(predicted: PitchType, actual: PitchType): 0 | 1 {
  return predicted === actual ? 1 : 0;
}

/** Category-aware scoring: full credit for an exact match, partial credit
 *  (0.75) for landing in the right family (e.g. predicted a four-seam,
 *  pitcher actually threw a sinker — both fastballs), 0 otherwise. */
export function adjustedAccuracy(predicted: PitchType, actual: PitchType): 0 | 0.75 | 1 {
  if (predicted === actual) return 1;
  return pitchCategory(predicted) === pitchCategory(actual) ? 0.75 : 0;
}
