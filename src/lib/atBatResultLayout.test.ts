import { AT_BAT_RESULTS } from "@/types";
import { AT_BAT_RESULT_COLUMNS } from "./atBatResultLayout";

describe("AT_BAT_RESULT_COLUMNS", () => {
  it("has exactly the four expected columns, in order", () => {
    expect(AT_BAT_RESULT_COLUMNS.map((c) => c.label)).toEqual([
      "In Play — Reach Base",
      "In Play — Out",
      "In Play — Sac",
      "No Contact",
    ]);
  });

  it("groups each result into the expected column", () => {
    const byColumn = Object.fromEntries(
      AT_BAT_RESULT_COLUMNS.map((c) => [c.label, c.results])
    );
    expect(byColumn["In Play — Reach Base"]).toEqual([
      "Single",
      "Double",
      "Triple",
      "Home Run",
      "Fielders Choice",
      "Field Error",
    ]);
    expect(byColumn["In Play — Out"]).toEqual([
      "Field Out",
      "Force Out",
      "Grounded Into DP",
      "Double Play",
      "Triple Play",
      "Fielders Choice Out",
    ]);
    expect(byColumn["In Play — Sac"]).toEqual(["Sac Fly", "Sac Bunt", "Sac Fly DP"]);
    expect(byColumn["No Contact"]).toEqual([
      "Strikeout",
      "Walk",
      "Intent Walk",
      "Hit By Pitch",
      "Strikeout DP",
      "Catcher Interf",
      "At Bat Still In Progress",
    ]);
  });

  it("keeps 'Fielders Choice' (reach base) and 'Fielders Choice Out' (an out) apart", () => {
    const byColumn = Object.fromEntries(
      AT_BAT_RESULT_COLUMNS.map((c) => [c.label, c.results])
    );
    expect(byColumn["In Play — Reach Base"]).toContain("Fielders Choice");
    expect(byColumn["In Play — Reach Base"]).not.toContain("Fielders Choice Out");
    expect(byColumn["In Play — Out"]).toContain("Fielders Choice Out");
    expect(byColumn["In Play — Out"]).not.toContain("Fielders Choice");
  });

  it("accounts for every AT_BAT_RESULTS entry exactly once", () => {
    const allPlaced = AT_BAT_RESULT_COLUMNS.flatMap((c) => c.results);

    expect(allPlaced.sort()).toEqual([...AT_BAT_RESULTS].sort());
    expect(new Set(allPlaced).size).toBe(allPlaced.length); // no duplicates
  });
});
