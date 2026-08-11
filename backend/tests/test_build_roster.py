"""Tests for backend/etl/build_roster.py: the min-pitches/handedness
filtering logic, TS-literal generation, and — the direct regression test
for the bug that hid 2026 rookies like Andrew Painter — that
DEFAULT_SEASON tracks the current year instead of a frozen literal.
"""

from __future__ import annotations

from datetime import date

from backend.etl import build_roster


def test_default_season_tracks_current_year():
    assert build_roster.DEFAULT_SEASON == date.today().year


def _player(id_, team_id, throws=None, bats=None, full_name="Test Player"):
    player = {"id": id_, "fullName": full_name, "currentTeam": {"id": team_id}}
    if throws:
        player["pitchHand"] = {"code": throws}
    if bats:
        player["batSide"] = {"code": bats}
    return player


def test_build_roster_filters_by_pitch_count_handedness_and_team(monkeypatch):
    players = [
        _player(1, 100, throws="R", full_name="Rookie Ace"),  # qualifies as pitcher
        _player(2, 100, throws="L", full_name="Too Few Pitches"),  # under min_pitches
        _player(3, 100, bats="R", full_name="Slugger"),  # qualifies as batter
        _player(4, None, throws="R", full_name="Free Agent"),  # no current team
    ]
    monkeypatch.setattr(build_roster, "fetch_team_abbreviations", lambda: {100: "PHI"})
    monkeypatch.setattr(build_roster, "fetch_players", lambda season: players)
    monkeypatch.setattr(
        build_roster, "fetch_statcast_counts", lambda: ({1: 500, 2: 50}, {3: 200})
    )
    monkeypatch.setattr(build_roster, "fetch_statcast_names", lambda: {1: "Ace, Rookie"})

    pitchers, batters = build_roster.build_roster(season=2026, min_pitches=100)

    assert [p["id"] for p in pitchers] == ["1"]
    assert pitchers[0]["statcastName"] == "Ace, Rookie"
    assert pitchers[0]["throws"] == "R"
    assert [b["id"] for b in batters] == ["3"]
    assert batters[0]["bats"] == "R"


def test_build_roster_excludes_pitcher_without_a_statcast_name_mapping(monkeypatch):
    # A pitcher can clear the pitch-count bar in the backfill but still
    # lack a resolved Statcast player_name (e.g. a very recent call-up
    # whose id->name mapping hasn't synced yet) — the prediction API
    # filters on that exact string, so without it the player can't be
    # selected safely.
    monkeypatch.setattr(build_roster, "fetch_team_abbreviations", lambda: {100: "PHI"})
    monkeypatch.setattr(
        build_roster, "fetch_players", lambda season: [_player(1, 100, throws="R")]
    )
    monkeypatch.setattr(build_roster, "fetch_statcast_counts", lambda: ({1: 500}, {}))
    monkeypatch.setattr(build_roster, "fetch_statcast_names", lambda: {})

    pitchers, batters = build_roster.build_roster(season=2026, min_pitches=100)

    assert pitchers == []
    assert batters == []


def test_build_roster_sorts_by_pitch_count_descending(monkeypatch):
    players = [
        _player(1, 100, throws="R", full_name="Low Count"),
        _player(2, 100, throws="R", full_name="High Count"),
    ]
    monkeypatch.setattr(build_roster, "fetch_team_abbreviations", lambda: {100: "PHI"})
    monkeypatch.setattr(build_roster, "fetch_players", lambda season: players)
    monkeypatch.setattr(build_roster, "fetch_statcast_counts", lambda: ({1: 150, 2: 900}, {}))
    monkeypatch.setattr(
        build_roster,
        "fetch_statcast_names",
        lambda: {1: "Count, Low", 2: "Count, High"},
    )

    pitchers, _ = build_roster.build_roster(season=2026, min_pitches=100)

    assert [p["name"] for p in pitchers] == ["High Count", "Low Count"]


def test_js_string_escapes_quotes_and_backslashes():
    assert build_roster._js_string('Cot’ O"Neill') == 'Cot’ O\\"Neill'
    assert build_roster._js_string("back\\slash") == "back\\\\slash"


def test_ts_literal_pitcher_includes_throws_and_statcast_name_not_bats():
    literal = build_roster._ts_literal(
        {
            "id": "1",
            "name": "Rookie Ace",
            "team": "PHI",
            "throws": "R",
            "role": "pitcher",
            "statcastName": "Ace, Rookie",
        }
    )
    assert 'statcastName: "Ace, Rookie"' in literal
    assert 'throws: "R"' in literal
    assert "bats" not in literal


def test_ts_literal_batter_includes_bats_not_throws():
    literal = build_roster._ts_literal(
        {"id": "3", "name": "Slugger", "team": "PHI", "bats": "R", "role": "batter"}
    )
    assert 'bats: "R"' in literal
    assert "throws" not in literal
    assert "statcastName" not in literal


def test_write_players_ts_roundtrips(tmp_path, monkeypatch):
    out_path = tmp_path / "players.ts"
    monkeypatch.setattr(build_roster, "OUTPUT_PATH", out_path)

    pitchers = [
        {
            "id": "1",
            "name": "Rookie Ace",
            "team": "PHI",
            "throws": "R",
            "role": "pitcher",
            "statcastName": "Ace, Rookie",
        }
    ]
    batters = [{"id": "3", "name": "Slugger", "team": "PHI", "bats": "R", "role": "batter"}]

    build_roster.write_players_ts(pitchers, batters, season=2026, min_pitches=100)

    text = out_path.read_text()
    assert "export const PITCHERS: Player[] = [" in text
    assert "export const BATTERS: Player[] = [" in text
    assert '"Rookie Ace"' in text
    assert '"Slugger"' in text
