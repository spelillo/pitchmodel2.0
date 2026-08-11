import { PITCH_TYPES } from "@/types";
import { PITCH_THROWN_COLUMNS } from "./pitchThrownLayout";

describe("PITCH_THROWN_COLUMNS", () => {
  it("has exactly the four expected columns, in order", () => {
    expect(PITCH_THROWN_COLUMNS.map((c) => c.label)).toEqual([
      "Fastball",
      "Breaking",
      "Off-speed",
      "Other",
    ]);
  });

  it("groups each pitch into the expected column", () => {
    const byColumn = Object.fromEntries(
      PITCH_THROWN_COLUMNS.map((c) => [c.label, c.pitches])
    );
    expect(byColumn["Fastball"]).toEqual(["4-Seam Fastball", "Sinker", "Cutter"]);
    expect(byColumn["Breaking"]).toEqual([
      "Slider",
      "Sweeper",
      "Slurve",
      "Curveball",
      "Knuckle Curve",
      "Slow Curve",
    ]);
    expect(byColumn["Off-speed"]).toEqual(["Changeup", "Split-Finger", "Forkball", "Screwball"]);
    expect(byColumn["Other"]).toEqual(["Knuckleball", "Eephus", "Other", "Unknown"]);
  });

  it("never includes Pitch Out in any column", () => {
    const allPlaced = PITCH_THROWN_COLUMNS.flatMap((c) => c.pitches);
    expect(allPlaced).not.toContain("Pitch Out");
  });

  it("accounts for every PITCH_TYPES entry exactly once, except the excluded Pitch Out", () => {
    const allPlaced = PITCH_THROWN_COLUMNS.flatMap((c) => c.pitches);
    const expected = PITCH_TYPES.filter((p) => p !== "Pitch Out");

    expect(allPlaced.sort()).toEqual([...expected].sort());
    expect(new Set(allPlaced).size).toBe(allPlaced.length); // no duplicates
  });
});
