import {
  GameState,
  PitchProbability,
  PitchType,
  PITCH_TYPES,
  PredictionRequest,
  PredictionResult,
} from "@/types";

// -----------------------------------------------------------------------
// MOCK PREDICTION SERVICE
//
// This module simulates the response of the future FastAPI backend
// (`POST /predict`, a KNN-style "similar historical situations" model
// trained on Statcast data). It exists only to give the frontend a
// realistic, situationally-aware contract to build against.
//
// To connect the real backend later, replace the body of
// `predictNextPitch` with a fetch call to the FastAPI endpoint and keep
// the same input/output shape (`PredictionRequest` -> `PredictionResult`).
// No component above this file needs to change.
//
// See @/types/api for the documented wire contract (PredictApiRequest /
// PredictApiResponse) that endpoint is expected to speak — this mock
// doesn't build or return those shapes yet, it's a reference for whoever
// wires up the real `fetch()` call.
// -----------------------------------------------------------------------

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BREAKING_FAMILY: PitchType[] = [
  "Slider",
  "Sweeper",
  "Slurve",
  "Curveball",
  "Knuckle Curve",
  "Slow Curve",
];
const OFFSPEED_FAMILY: PitchType[] = [
  "Changeup",
  "Split-Finger",
  "Forkball",
  "Screwball",
  "Knuckleball",
  "Eephus",
];
// Situational/administrative "pitch types" — essentially never the model's pick.
const NON_ARSENAL_TYPES: PitchType[] = ["Pitch Out", "Other", "Unknown"];

// The common, everyday secondary pitches most pitchers lean on. Rarer
// shapes (slurve, knuckle curve, forkball, ...) still get a small share
// so the full arsenal is representable, just without dominating.
const COMMON_SECONDARY: PitchType[] = ["Slider", "Sweeper", "Curveball", "Changeup", "Split-Finger"];
const RARE_SECONDARY: PitchType[] = BREAKING_FAMILY.concat(OFFSPEED_FAMILY).filter(
  (pitch) => !COMMON_SECONDARY.includes(pitch)
);

/** Each pitcher gets a stable, pseudo-random-but-consistent base arsenal. */
function baseArsenal(pitcherId: string): Record<PitchType, number> {
  const rand = mulberry32(hashString(pitcherId));
  const weights: Partial<Record<PitchType, number>> = {};

  PITCH_TYPES.forEach((pitch) => {
    weights[pitch] = 0.002;
  });

  // Every pitcher relies most heavily on the fastball family.
  weights["4-Seam Fastball"] = 0.34 + rand() * 0.18;
  weights["Sinker"] = rand() * 0.16;
  weights["Cutter"] = rand() * 0.14;

  // A primary and secondary breaking/offspeed pitch from the common pool.
  COMMON_SECONDARY.forEach((pitch) => {
    weights[pitch] = rand() * 0.22;
  });

  // Guarantee at least one strong secondary offering.
  const featured = COMMON_SECONDARY[Math.floor(rand() * COMMON_SECONDARY.length)];
  weights[featured] = (weights[featured] ?? 0) + 0.2 + rand() * 0.1;

  // Rarer shapes some pitchers mix in lightly.
  RARE_SECONDARY.forEach((pitch) => {
    weights[pitch] = rand() * 0.04;
  });

  NON_ARSENAL_TYPES.forEach((pitch) => {
    weights[pitch] = rand() * 0.003;
  });

  return weights as Record<PitchType, number>;
}

function applySituationalAdjustments(
  weights: Record<PitchType, number>,
  gameState: GameState
): Record<PitchType, number> {
  const adjusted: Record<PitchType, number> = { ...weights };
  const { balls, strikes, runners, previousPitch, outs } = gameState;

  const multiply = (pitch: PitchType, factor: number) => {
    adjusted[pitch] = (adjusted[pitch] ?? 0) * factor;
  };

  // Two-strike counts: pitchers expand the zone with offspeed/breaking stuff.
  if (strikes === 2) {
    BREAKING_FAMILY.concat(OFFSPEED_FAMILY).forEach((p) => multiply(p, 1.35));
    multiply("4-Seam Fastball", 0.85);
  }

  // Hitter's counts (3 balls): pitchers go back to the fastball for a strike.
  if (balls === 3) {
    multiply("4-Seam Fastball", 1.5);
    multiply("Sinker", 1.25);
    multiply("Split-Finger", 0.6);
    multiply("Curveball", 0.65);
  }

  // Even/early counts lean slightly more balanced, no strong adjustment.

  // Runners on base: quicker pitches to the plate, fewer pitches in the dirt.
  const onBase = runners.first || runners.second || runners.third;
  if (onBase) {
    multiply("Sinker", 1.15);
    multiply("Cutter", 1.1);
    multiply("Split-Finger", 0.75);
    multiply("Curveball", 0.85);
  }

  // Two outs, runner in scoring position: pitchers nibble more.
  if (outs === 2 && (runners.second || runners.third)) {
    multiply("Slider", 1.15);
    multiply("Sweeper", 1.15);
  }

  // Sequencing: avoid repeating the identical previous pitch, and lean
  // toward a complementary pitch (fastball -> changeup is classic).
  if (previousPitch) {
    multiply(previousPitch, 0.55);
    if (previousPitch === "4-Seam Fastball" || previousPitch === "Sinker") {
      multiply("Changeup", 1.25);
      multiply("Slider", 1.1);
    } else {
      multiply("4-Seam Fastball", 1.15);
    }
  }

  return adjusted;
}

function normalize(weights: Record<PitchType, number>): PitchProbability[] {
  const total = PITCH_TYPES.reduce((sum, pitch) => sum + (weights[pitch] ?? 0), 0);
  return PITCH_TYPES.map((pitch) => ({
    pitch,
    probability: total > 0 ? (weights[pitch] ?? 0) / total : 1 / PITCH_TYPES.length,
  })).sort((a, b) => b.probability - a.probability);
}

const SIMULATED_LATENCY_MS = 420;

export async function predictNextPitch(
  request: PredictionRequest
): Promise<PredictionResult> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  const seedKey = `${request.pitcherId}:${request.batterId}:${request.gameState.balls}:${request.gameState.strikes}:${request.gameState.previousPitch ?? "none"}`;
  const rand = mulberry32(hashString(seedKey));

  const arsenal = baseArsenal(request.pitcherId);
  const adjusted = applySituationalAdjustments(arsenal, request.gameState);

  // Small amount of situational noise so identical states don't feel static.
  PITCH_TYPES.forEach((pitch) => {
    adjusted[pitch] = Math.max(0.001, adjusted[pitch] * (0.9 + rand() * 0.2));
  });

  const probabilities = normalize(adjusted).slice(0, 5);
  const top = probabilities[0];

  const similarSituationTotal = 80 + Math.floor(rand() * 60); // 80-139
  const similarSituationBreakdown = probabilities.map((p) => ({
    pitch: p.pitch,
    count: Math.round(p.probability * similarSituationTotal),
  }));

  const matchingSituations =
    similarSituationBreakdown.find((s) => s.pitch === top.pitch)?.count ??
    Math.round(top.probability * similarSituationTotal);

  return {
    predictedPitch: top.pitch,
    probability: top.probability,
    probabilities,
    similarSituationTotal,
    similarSituationBreakdown,
    matchingSituations,
  };
}
