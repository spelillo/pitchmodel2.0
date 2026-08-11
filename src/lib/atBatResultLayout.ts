import { AT_BAT_RESULTS, AtBatResult } from "@/types";

export interface AtBatResultColumn {
  label: string;
  results: AtBatResult[];
}

// A *display-only* grouping for the "At-Bat Result" selector. Every
// AT_BAT_RESULTS value must land in exactly one column — the guard below
// enforces that at module-load time.
const COLUMN_DEFINITIONS: { label: string; members: readonly AtBatResult[] }[] = [
  {
    // Fielders Choice and Field Error both put the ball in play and let
    // the batter reach base safely — neither is a credited hit, so this
    // column isn't just "Hit."
    label: "In Play — Reach Base",
    members: ["Single", "Double", "Triple", "Home Run", "Fielders Choice", "Field Error"],
  },
  {
    label: "In Play — Out",
    members: [
      "Field Out",
      "Force Out",
      "Grounded Into DP",
      "Double Play",
      "Triple Play",
      "Fielders Choice Out",
    ],
  },
  { label: "In Play — Sac", members: ["Sac Fly", "Sac Bunt", "Sac Fly DP"] },
  {
    label: "No Contact",
    members: [
      "Strikeout",
      "Walk",
      "Intent Walk",
      "Hit By Pitch",
      "Strikeout DP",
      "Catcher Interf",
      "At Bat Still In Progress",
    ],
  },
];

export const AT_BAT_RESULT_COLUMNS: AtBatResultColumn[] = COLUMN_DEFINITIONS.map(
  ({ label, members }) => ({
    label,
    // Order within a column follows AT_BAT_RESULTS' own declared order
    // rather than the (unordered) membership list above, so a future
    // reordering of AT_BAT_RESULTS doesn't need to be mirrored here by hand.
    results: AT_BAT_RESULTS.filter((result) =>
      (members as readonly AtBatResult[]).includes(result)
    ),
  })
);

// Guards against a future AT_BAT_RESULTS addition silently going
// unassigned to any column and becoming unreachable in this selector.
const placed = new Set(AT_BAT_RESULT_COLUMNS.flatMap((column) => column.results));
const unplaced = AT_BAT_RESULTS.filter((result) => !placed.has(result));
if (unplaced.length > 0) {
  throw new Error(
    `atBatResultLayout: ${unplaced.join(", ")} is not assigned to a column — ` +
      "add it to COLUMN_DEFINITIONS in src/lib/atBatResultLayout.ts."
  );
}
