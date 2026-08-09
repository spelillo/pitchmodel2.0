"""In-memory active-session pitch store — the spec's "Redis or FastAPI
dictionary" option, using a plain dict since this deploys as a single
process. Session pitches feed the KNN engine's 2x live-weighting and the
running accuracy totals in LogPitchApiResponse.

Not persisted: a server restart clears all active sessions. That's an
acceptable tradeoff for a single-instance deployment — sessions are
meant to represent "this live game right now," not durable history
(that's what the DuckDB store is for).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class LoggedPitch:
    balls: int
    strikes: int
    outs_when_up: int
    on_1b: bool
    on_2b: bool
    on_3b: bool
    inning: int
    inning_topbot: str  # "Top" | "Bot"
    pitch_name: str
    true_accuracy: float
    adjusted_accuracy: float


@dataclass
class SessionState:
    pitches: list[LoggedPitch] = field(default_factory=list)

    @property
    def true_accuracy(self) -> float:
        if not self.pitches:
            return 0.0
        return sum(p.true_accuracy for p in self.pitches) / len(self.pitches)

    @property
    def adjusted_accuracy(self) -> float:
        if not self.pitches:
            return 0.0
        return sum(p.adjusted_accuracy for p in self.pitches) / len(self.pitches)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def get(self, session_id: str) -> SessionState:
        return self._sessions.setdefault(session_id, SessionState())

    def add_pitch(self, session_id: str, pitch: LoggedPitch) -> SessionState:
        state = self.get(session_id)
        state.pitches.append(pitch)
        return state

    def pitches_as_dataframe(self, session_id: str) -> pd.DataFrame:
        state = self._sessions.get(session_id)
        if not state or not state.pitches:
            return pd.DataFrame()
        return pd.DataFrame([vars(p) for p in state.pitches])

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


# Single process-wide instance, imported by main.py's route handlers.
SESSION_STORE = SessionStore()
