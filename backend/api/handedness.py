"""Resolve a batter's effective handedness for a specific matchup.

Mirrors src/lib/handedness.ts — keep the two in sync by hand.

A switch hitter's effective side is always the opposite of the
pitcher's throwing hand. Statcast's `stand` column reflects this per
plate appearance (it's never literally "S"), so this is what lets a
switch hitter's prediction request match real historical rows instead
of an empty "switch" bucket.
"""

from __future__ import annotations

from .pitch_types import Handedness


def resolve_batter_handedness(pitcher_throws: Handedness, batter_bats: Handedness) -> str:
    if batter_bats != "S":
        return batter_bats
    return "R" if pitcher_throws == "L" else "L"
