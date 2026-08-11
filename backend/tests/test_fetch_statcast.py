"""Tests for backend/etl/fetch_statcast.py: column validation, the
chunked date-window splitter, and compute_since_last() — the piece that
lets the scheduled sync resume exactly where the last run left off
instead of relying on a hand-picked --start (the root cause of the
~4-month hole that hid 2026 rookies like Andrew Painter from the app).
"""

from __future__ import annotations

from datetime import date

import duckdb
import pandas as pd
import pytest

from backend.etl import fetch_statcast
from backend.storage.duckdb_adapter import TABLE_NAME


def test_validate_raises_on_missing_columns():
    df = pd.DataFrame({"game_pk": [1]})
    with pytest.raises(SystemExit):
        fetch_statcast.validate(df)


def test_validate_passes_with_all_required_columns(capsys):
    data = {col: ["x"] for col in fetch_statcast.REQUIRED_COLUMNS}
    data["pitch_name"] = ["Four-Seam Fastball"]
    df = pd.DataFrame(data)

    fetch_statcast.validate(df)  # must not raise

    assert "All required columns present." in capsys.readouterr().out


def test_fetch_range_chunked_windows_are_contiguous_and_bounded(monkeypatch):
    calls: list[tuple[str, str]] = []

    def fake_statcast(start_dt, end_dt):
        calls.append((start_dt, end_dt))
        return pd.DataFrame({"x": [1]})

    monkeypatch.setattr(fetch_statcast, "statcast", fake_statcast)

    fetch_statcast.fetch_range_chunked("2026-03-25", "2026-04-02", chunk_days=3)

    assert calls == [
        ("2026-03-25", "2026-03-27"),
        ("2026-03-28", "2026-03-30"),
        ("2026-03-31", "2026-04-02"),
    ]


def test_fetch_range_chunked_rejects_inverted_range(monkeypatch):
    monkeypatch.setattr(
        fetch_statcast, "statcast", lambda start_dt, end_dt: pd.DataFrame({"x": [1]})
    )
    with pytest.raises(SystemExit):
        fetch_statcast.fetch_range_chunked("2026-04-02", "2026-03-25", chunk_days=3)


def test_fetch_range_chunked_skips_empty_chunks_and_concatenates_rest(monkeypatch):
    def fake_statcast(start_dt, end_dt):
        if start_dt == "2026-03-28":  # simulate a no-games window
            return pd.DataFrame()
        return pd.DataFrame({"x": [1]})

    monkeypatch.setattr(fetch_statcast, "statcast", fake_statcast)

    combined = fetch_statcast.fetch_range_chunked("2026-03-25", "2026-03-30", chunk_days=3)

    assert len(combined) == 1


def _duckdb_with_max_game_date(db_path, max_date: date) -> None:
    con = duckdb.connect(str(db_path))
    con.execute(
        f"CREATE TABLE {TABLE_NAME} "
        "(game_date DATE, game_pk INTEGER, at_bat_number INTEGER, pitch_number INTEGER)"
    )
    con.execute(f"INSERT INTO {TABLE_NAME} VALUES (?, 1, 1, 1)", [max_date])
    con.close()


def test_compute_since_last_returns_day_after_max_date(tmp_path):
    db_path = tmp_path / "test.duckdb"
    _duckdb_with_max_game_date(db_path, date(2026, 8, 7))

    assert fetch_statcast.compute_since_last(db_path) == "2026-08-08"


def test_compute_since_last_requires_existing_file(tmp_path):
    with pytest.raises(SystemExit):
        fetch_statcast.compute_since_last(tmp_path / "does-not-exist.duckdb")


def test_compute_since_last_requires_the_pitches_table(tmp_path):
    db_path = tmp_path / "empty.duckdb"
    con = duckdb.connect(str(db_path))
    con.execute("CREATE TABLE unrelated (x INTEGER)")
    con.close()

    with pytest.raises(SystemExit):
        fetch_statcast.compute_since_last(db_path)


def test_parse_args_since_last_overrides_start(tmp_path, monkeypatch):
    db_path = tmp_path / "test.duckdb"
    _duckdb_with_max_game_date(db_path, date(2026, 8, 7))
    monkeypatch.setattr(
        "sys.argv",
        ["fetch_statcast.py", "--since-last", "--end", "2026-08-09", "--db-path", str(db_path)],
    )

    args = fetch_statcast.parse_args()

    assert args.start == "2026-08-08"
    assert args.end == "2026-08-09"
