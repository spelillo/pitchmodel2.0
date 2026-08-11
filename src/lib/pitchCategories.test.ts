import { PITCH_TYPES } from "@/types";
import {
  PITCH_CATEGORY_MAP,
  adjustedAccuracy,
  pitchCategory,
  trueAccuracy,
} from "./pitchCategories";

describe("PITCH_CATEGORY_MAP (accuracy scoring families)", () => {
  // Regression guard: the "Pitch Thrown" selector got its own, separate
  // display grouping (see pitchThrownLayout.ts) that puts Knuckleball and
  // Eephus in a visual "Other" column — but scoring was deliberately left
  // as-is, so they must stay in the "Off-speed" family here.
  it("keeps Knuckleball and Eephus in the Off-speed scoring family", () => {
    expect(pitchCategory("Knuckleball")).toBe("Off-speed");
    expect(pitchCategory("Eephus")).toBe("Off-speed");
  });

  it("classifies the core fastball/breaking/off-speed pitches as expected", () => {
    expect(pitchCategory("4-Seam Fastball")).toBe("Fastball");
    expect(pitchCategory("Sinker")).toBe("Fastball");
    expect(pitchCategory("Cutter")).toBe("Fastball");
    expect(pitchCategory("Slider")).toBe("Breaking");
    expect(pitchCategory("Curveball")).toBe("Breaking");
    expect(pitchCategory("Changeup")).toBe("Off-speed");
  });
});

describe("trueAccuracy", () => {
  it("scores 1 for an exact match", () => {
    expect(trueAccuracy("Slider", "Slider")).toBe(1);
  });

  it("scores 0 for anything else, even same-family pitches", () => {
    expect(trueAccuracy("Slider", "Sweeper")).toBe(0);
  });
});

describe("adjustedAccuracy", () => {
  it("scores 1 for an exact match", () => {
    expect(adjustedAccuracy("Changeup", "Changeup")).toBe(1);
  });

  it("scores 0.75 for a same-family miss", () => {
    expect(adjustedAccuracy("4-Seam Fastball", "Sinker")).toBe(0.75);
    expect(adjustedAccuracy("Changeup", "Knuckleball")).toBe(0.75);
  });

  it("scores 0 for a different-family miss", () => {
    expect(adjustedAccuracy("4-Seam Fastball", "Slider")).toBe(0);
  });
});

describe("PITCH_CATEGORY_MAP completeness", () => {
  it("covers every declared PitchType with no gaps", () => {
    for (const type of PITCH_TYPES) {
      expect(PITCH_CATEGORY_MAP[type]).toBeDefined();
    }
  });
});
