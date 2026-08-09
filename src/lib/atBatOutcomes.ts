import { AtBatResult } from "@/types";

// Outs added when an at-bat ends this way. Reaching-base and free-pass
// outcomes add none; anything the fielders convert adds one, double/triple
// plays add two/three.
export const AT_BAT_OUT_DELTA: Record<AtBatResult, number> = {
  Single: 0,
  Double: 0,
  Triple: 0,
  "Home Run": 0,
  Strikeout: 1,
  Walk: 0,
  "Intent Walk": 0,
  "Hit By Pitch": 0,
  "Field Out": 1,
  "Force Out": 1,
  "Grounded Into DP": 2,
  "Double Play": 2,
  "Triple Play": 3,
  "Strikeout DP": 2,
  "Fielders Choice": 0,
  "Fielders Choice Out": 1,
  "Field Error": 0,
  "Sac Fly": 1,
  "Sac Bunt": 1,
  "Sac Fly DP": 2,
  "Catcher Interf": 0,
  "At Bat Still In Progress": 0,
};
