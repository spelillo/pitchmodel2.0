"""Server-side port of the count/outs/inning advancement logic in
src/hooks/useGameState.ts, so /api/v1/log-pitch can "auto-advance
balls/strikes/outs for the client" per the spec. Keep in sync by hand.
"""

from __future__ import annotations

from dataclasses import dataclass

from .pitch_types import AT_BAT_OUT_DELTA, AT_BAT_STILL_IN_PROGRESS, AtBatResult, PitchResultOutcome


@dataclass
class GameSituation:
    balls: int
    strikes: int
    outs: int
    on_1b: bool
    on_2b: bool
    on_3b: bool
    inning: int
    inning_topbot: str  # "Top" | "Bot"


def apply_pitch_result(situation: GameSituation, outcome: PitchResultOutcome) -> GameSituation:
    """A foul ball behaves like a strike, except it can never be the
    third — with two strikes it just stays foul."""
    if outcome == "Ball":
        return _replace(situation, balls=min(situation.balls + 1, 3))
    if outcome == "Strike":
        return _replace(situation, strikes=min(situation.strikes + 1, 2))
    if situation.strikes < 2:
        return _replace(situation, strikes=situation.strikes + 1)
    return situation


def apply_at_bat_result(situation: GameSituation, result: AtBatResult) -> GameSituation:
    """Ending an at-bat wipes the count and applies whatever outs the
    result produces. A third out ends the half-inning instead of
    overflowing. "At Bat Still In Progress" is a no-op here — the caller
    should route that case to apply_pitch_result instead."""
    if result == AT_BAT_STILL_IN_PROGRESS:
        return situation

    raw_outs = situation.outs + AT_BAT_OUT_DELTA[result]
    if raw_outs >= 3:
        next_topbot = "Bot" if situation.inning_topbot == "Top" else "Top"
        next_inning = situation.inning + 1 if situation.inning_topbot == "Bot" else situation.inning
        return GameSituation(
            balls=0,
            strikes=0,
            outs=0,
            on_1b=False,
            on_2b=False,
            on_3b=False,
            inning=next_inning,
            inning_topbot=next_topbot,
        )

    return _replace(situation, balls=0, strikes=0, outs=raw_outs)


def _replace(situation: GameSituation, **changes) -> GameSituation:
    return GameSituation(
        balls=changes.get("balls", situation.balls),
        strikes=changes.get("strikes", situation.strikes),
        outs=changes.get("outs", situation.outs),
        on_1b=changes.get("on_1b", situation.on_1b),
        on_2b=changes.get("on_2b", situation.on_2b),
        on_3b=changes.get("on_3b", situation.on_3b),
        inning=changes.get("inning", situation.inning),
        inning_topbot=changes.get("inning_topbot", situation.inning_topbot),
    )
