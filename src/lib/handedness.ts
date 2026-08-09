import { Handedness } from "@/types";

/** A switch hitter's effective batting side for a given matchup is
 *  always the opposite of the pitcher's throwing hand — Statcast's
 *  `stand` column reflects this per plate appearance (it's never
 *  literally "S"), so resolving to a concrete side here is what lets a
 *  switch hitter's prediction request match real historical rows
 *  instead of an empty "switch" bucket. Matchup-dependent, so this
 *  can't be a fixed attribute stored on the batter. */
export function resolveBatterHandedness(
  pitcherThrows: Handedness,
  batterBats: Handedness
): "L" | "R" {
  if (batterBats !== "S") return batterBats;
  return pitcherThrows === "L" ? "R" : "L";
}
