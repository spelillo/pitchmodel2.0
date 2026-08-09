import { AtBatResult } from "@/types";

// Outs added when an at-bat ends this way. Reaching-base and free-pass
// outcomes add none; anything the fielders convert adds one, a double
// play adds two.
export const AT_BAT_OUT_DELTA: Record<AtBatResult, number> = {
  Strikeout: 1,
  Walk: 0,
  "Hit By Pitch": 0,
  Single: 0,
  Double: 0,
  Triple: 0,
  "Home Run": 0,
  Groundout: 1,
  Flyout: 1,
  Popout: 1,
  "Double Play": 2,
  "Sac Fly": 1,
  "Fielder's Choice": 1,
  Error: 0,
};
