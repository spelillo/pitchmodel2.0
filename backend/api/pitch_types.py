"""Python mirror of the string-literal vocabularies in src/types/index.ts.

Keep these in sync by hand — there's no shared source between the
TypeScript frontend and this Python backend. If PITCH_TYPES,
AT_BAT_RESULTS, or PITCH_RESULTS change on one side, update the other.
"""

from __future__ import annotations

from typing import Literal

PitchType = Literal[
    "4-Seam Fastball",
    "Sinker",
    "Cutter",
    "Slider",
    "Sweeper",
    "Slurve",
    "Curveball",
    "Knuckle Curve",
    "Slow Curve",
    "Changeup",
    "Split-Finger",
    "Forkball",
    "Screwball",
    "Knuckleball",
    "Eephus",
    "Pitch Out",
    "Other",
    "Unknown",
]

PitchResultOutcome = Literal["Ball", "Strike", "Foul"]

AtBatResult = Literal[
    "Single",
    "Double",
    "Triple",
    "Home Run",
    "Strikeout",
    "Walk",
    "Intent Walk",
    "Hit By Pitch",
    "Field Out",
    "Force Out",
    "Grounded Into DP",
    "Double Play",
    "Triple Play",
    "Strikeout DP",
    "Fielders Choice",
    "Fielders Choice Out",
    "Field Error",
    "Sac Fly",
    "Sac Bunt",
    "Sac Fly DP",
    "Catcher Interf",
    "At Bat Still In Progress",
]

PitchCategory = Literal["Fastball", "Breaking", "Off-speed", "Other"]

Handedness = Literal["L", "R", "S"]

AT_BAT_STILL_IN_PROGRESS: AtBatResult = "At Bat Still In Progress"

# Outs added when an at-bat ends this way — mirrors
# src/lib/atBatOutcomes.ts's AT_BAT_OUT_DELTA exactly.
AT_BAT_OUT_DELTA: dict[str, int] = {
    "Single": 0,
    "Double": 0,
    "Triple": 0,
    "Home Run": 0,
    "Strikeout": 1,
    "Walk": 0,
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
}

# Mirrors src/lib/pitchCategories.ts's PITCH_CATEGORY_MAP exactly.
PITCH_CATEGORY_MAP: dict[str, str] = {
    "4-Seam Fastball": "Fastball",
    "Sinker": "Fastball",
    "Cutter": "Fastball",
    "Slider": "Breaking",
    "Sweeper": "Breaking",
    "Slurve": "Breaking",
    "Curveball": "Breaking",
    "Knuckle Curve": "Breaking",
    "Slow Curve": "Breaking",
    "Changeup": "Off-speed",
    "Split-Finger": "Off-speed",
    "Forkball": "Off-speed",
    "Screwball": "Off-speed",
    "Knuckleball": "Off-speed",
    "Eephus": "Off-speed",
    "Pitch Out": "Other",
    "Other": "Other",
    "Unknown": "Other",
}
