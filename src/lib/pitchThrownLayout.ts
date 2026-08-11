import { PITCH_TYPES, PitchType } from "@/types";

export interface PitchThrownColumn {
  label: string;
  pitches: PitchType[];
}

// A *display-only* grouping for the "Pitch Thrown" selector — deliberately
// separate from PITCH_CATEGORY_MAP (see @/lib/pitchCategories), which
// drives Adjusted Accuracy scoring. There, Knuckleball/Eephus score as the
// same family as Changeup/Split-Finger ("Off-speed") — kept that way on
// purpose (knuckleballs are rare enough it doesn't move the needle) even
// though they get their own visual column here, next to Other/Unknown.
const COLUMN_DEFINITIONS: { label: string; members: readonly PitchType[] }[] = [
  { label: "Fastball", members: ["4-Seam Fastball", "Sinker", "Cutter"] },
  {
    label: "Breaking",
    members: ["Slider", "Sweeper", "Slurve", "Curveball", "Knuckle Curve", "Slow Curve"],
  },
  { label: "Off-speed", members: ["Changeup", "Split-Finger", "Forkball", "Screwball"] },
  { label: "Other", members: ["Knuckleball", "Eephus", "Other", "Unknown"] },
];

// Never shown in the Pitch Thrown selector — logging an intentional pitch
// out isn't a meaningful "what did the pitcher throw" answer here.
const EXCLUDED: readonly PitchType[] = ["Pitch Out"];

export const PITCH_THROWN_COLUMNS: PitchThrownColumn[] = COLUMN_DEFINITIONS.map(
  ({ label, members }) => ({
    label,
    // Order pitches within a column by PITCH_TYPES' own declared order
    // rather than the (unordered) membership list above, so a future
    // reordering of PITCH_TYPES doesn't need to be mirrored here by hand.
    pitches: PITCH_TYPES.filter((pitch) => (members as readonly PitchType[]).includes(pitch)),
  })
);

// Guards against a future PITCH_TYPES addition silently going unassigned
// to any column (and becoming unreachable in this selector) or unexcluded.
const placed = new Set(PITCH_THROWN_COLUMNS.flatMap((column) => column.pitches));
const unplaced = PITCH_TYPES.filter((pitch) => !placed.has(pitch) && !EXCLUDED.includes(pitch));
if (unplaced.length > 0) {
  throw new Error(
    `pitchThrownLayout: ${unplaced.join(", ")} is not assigned to a column or excluded — ` +
      "add it to COLUMN_DEFINITIONS or EXCLUDED in src/lib/pitchThrownLayout.ts."
  );
}
