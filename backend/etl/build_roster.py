"""Build the real MLB pitcher/batter roster for the frontend's player
selectors, replacing the hand-picked mock list in src/data/players.ts.

Cross-references the MLB Stats API's current-season player list (real
names/teams/handedness, keyed by MLBAM id — the same id space as
backend/data/pitchmodel.duckdb's pitcher/batter columns) against the
distinct pitcher/batter ids that actually have at least --min-pitches
pitches in the Statcast backfill. That intersection naturally filters
out players who are no longer active (only in old seasons of the
backfill) and players with too little history for a meaningful
prediction, without needing a separate roster/relevance heuristic.

A player can appear in both lists — e.g. a two-way player who both
pitched and batted in the backfilled window.

Usage:
    python backend/etl/build_roster.py
    python backend/etl/build_roster.py --season 2025 --min-pitches 100
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import duckdb
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from storage.duckdb_adapter import DEFAULT_DB_PATH, TABLE_NAME  # noqa: E402

MLB_STATS_API = "https://statsapi.mlb.com/api/v1"
OUTPUT_PATH = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "players.ts"

# Computed, not hardcoded: an MLB season's calendar year always matches
# its season year (unlike e.g. the NFL), so "today's year" is always the
# right default. A hardcoded literal here is exactly what caused rookies
# like Andrew Painter (debuted 2026-03-31) to be silently excluded from
# the roster — the 2025 MLB Stats API roster pull doesn't know he exists.
DEFAULT_SEASON = date.today().year
DEFAULT_MIN_PITCHES = 100


def fetch_team_abbreviations() -> dict[int, str]:
    resp = requests.get(f"{MLB_STATS_API}/teams", params={"sportId": 1}, timeout=30)
    resp.raise_for_status()
    return {team["id"]: team["abbreviation"] for team in resp.json()["teams"]}


def fetch_players(season: int) -> list[dict]:
    resp = requests.get(
        f"{MLB_STATS_API}/sports/1/players", params={"season": season}, timeout=30
    )
    resp.raise_for_status()
    return resp.json()["people"]


def fetch_statcast_counts() -> tuple[dict[int, int], dict[int, int]]:
    """(pitcher_id -> pitch count, batter_id -> pitch count) from the backfill."""
    con = duckdb.connect(str(DEFAULT_DB_PATH), read_only=True)
    try:
        pitcher_counts = dict(
            con.execute(f"SELECT pitcher, count(*) FROM {TABLE_NAME} GROUP BY 1").fetchall()
        )
        batter_counts = dict(
            con.execute(f"SELECT batter, count(*) FROM {TABLE_NAME} GROUP BY 1").fetchall()
        )
    finally:
        con.close()
    return pitcher_counts, batter_counts


def fetch_statcast_names() -> dict[int, str]:
    """pitcher_id -> the exact player_name string Statcast uses for them
    (e.g. "Cease, Dylan"). The prediction API filters on this exact
    string, which is *not* the same as the MLB Stats API's "First Last"
    fullName — verified 1:1 (no pitcher has more than one player_name
    across the backfill) before relying on this mapping."""
    con = duckdb.connect(str(DEFAULT_DB_PATH), read_only=True)
    try:
        rows = con.execute(f"SELECT DISTINCT pitcher, player_name FROM {TABLE_NAME}").fetchall()
    finally:
        con.close()
    return dict(rows)


def build_roster(season: int, min_pitches: int) -> tuple[list[dict], list[dict]]:
    print(f"Fetching {season} MLB roster + teams from statsapi.mlb.com ...")
    team_abbrev = fetch_team_abbreviations()
    players = fetch_players(season)
    print(f"  {len(players)} players, {len(team_abbrev)} teams")

    pitcher_counts, batter_counts = fetch_statcast_counts()
    statcast_names = fetch_statcast_names()
    print(
        f"  {len(pitcher_counts)} distinct pitchers, "
        f"{len(batter_counts)} distinct batters in backfill"
    )

    pitchers: list[dict] = []
    batters: list[dict] = []

    for p in players:
        mlbam_id = p["id"]
        team = team_abbrev.get((p.get("currentTeam") or {}).get("id"))
        if not team:
            continue  # no current team (e.g. free agent) — nothing to select against

        pitch_count = pitcher_counts.get(mlbam_id, 0)
        throws = (p.get("pitchHand") or {}).get("code")
        statcast_name = statcast_names.get(mlbam_id)
        if pitch_count >= min_pitches and throws in ("L", "R") and statcast_name:
            pitchers.append(
                {
                    "id": str(mlbam_id),
                    "name": p["fullName"],
                    "statcastName": statcast_name,
                    "team": team,
                    "throws": throws,
                    "role": "pitcher",
                    "_count": pitch_count,
                }
            )

        bat_count = batter_counts.get(mlbam_id, 0)
        bats = (p.get("batSide") or {}).get("code")
        if bat_count >= min_pitches and bats in ("L", "R", "S"):
            batters.append(
                {
                    "id": str(mlbam_id),
                    "name": p["fullName"],
                    "team": team,
                    "bats": bats,
                    "role": "batter",
                    "_count": bat_count,
                }
            )

    pitchers.sort(key=lambda p: -p["_count"])
    batters.sort(key=lambda b: -b["_count"])
    for p in pitchers:
        del p["_count"]
    for b in batters:
        del b["_count"]

    return pitchers, batters


def _js_string(value: str) -> str:
    """Escape a value for embedding in a double-quoted TS string literal
    — matters here since MLB names include apostrophes (O'Neill) and
    accented characters that need to round-trip correctly."""
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _ts_literal(player: dict) -> str:
    parts = [
        f'id: "{player["id"]}"',
        f'name: "{_js_string(player["name"])}"',
        f'team: "{player["team"]}"',
    ]
    if "throws" in player:
        parts.append(f'throws: "{player["throws"]}"')
    if "bats" in player:
        parts.append(f'bats: "{player["bats"]}"')
    parts.append(f'role: "{player["role"]}"')
    if "statcastName" in player:
        parts.append(f'statcastName: "{_js_string(player["statcastName"])}"')
    return "{ " + ", ".join(parts) + " }"


def write_players_ts(pitchers: list[dict], batters: list[dict], season: int, min_pitches: int) -> None:
    lines = [
        'import { Player } from "@/types";',
        "",
        "// Real MLB roster, generated by backend/etl/build_roster.py from the",
        f"// MLB Stats API ({season} season) cross-referenced against players with at",
        f"// least {min_pitches} pitches in the Statcast backfill. Regenerate rather",
        "// than hand-editing — rerun the script instead.",
        "// A switch hitter's effective side for a given pitcher is resolved at",
        "// prediction time (see @/lib/handedness), not stored here.",
        "",
        "export const PITCHERS: Player[] = [",
    ]
    lines += [f"  {_ts_literal(p)}," for p in pitchers]
    lines += ["];", "", "export const BATTERS: Player[] = ["]
    lines += [f"  {_ts_literal(b)}," for b in batters]
    lines += [
        "];",
        "",
        "export function searchPlayers(players: Player[], query: string): Player[] {",
        '  const q = query.trim().toLowerCase();',
        "  if (!q) return players;",
        "  return players.filter(",
        "    (p) =>",
        "      p.name.toLowerCase().includes(q) ||",
        "      p.team.toLowerCase().includes(q)",
        "  );",
        "}",
        "",
    ]
    OUTPUT_PATH.write_text("\n".join(lines))
    print(f"Wrote {len(pitchers)} pitchers, {len(batters)} batters to {OUTPUT_PATH}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON)
    parser.add_argument("--min-pitches", type=int, default=DEFAULT_MIN_PITCHES)
    args = parser.parse_args()

    pitchers, batters = build_roster(args.season, args.min_pitches)
    write_players_ts(pitchers, batters, args.season, args.min_pitches)


if __name__ == "__main__":
    main()
