"""Tests for backend/storage/duckdb_adapter.py: the dedup/idempotency
guarantees load() makes, and the download-on-cold-start behavior
ensure_db_present() needs for Render's disk-less free tier.
"""

from __future__ import annotations

import pandas as pd
import pytest

from backend.storage import duckdb_adapter


def _pitches(at_bat_numbers: list[int]) -> pd.DataFrame:
    """A minimal frame shaped like a REQUIRED_COLUMNS row, one per
    at_bat_number, all sharing game_pk=1/pitch_number=1 so the primary
    key (game_pk, at_bat_number, pitch_number) varies only by
    at_bat_number — enough to exercise dedup without needing every
    Statcast column.
    """
    return pd.DataFrame(
        {
            "game_pk": [1] * len(at_bat_numbers),
            "at_bat_number": at_bat_numbers,
            "pitch_number": [1] * len(at_bat_numbers),
            "game_date": ["2026-04-01"] * len(at_bat_numbers),
            "player_name": ["Painter, Andrew"] * len(at_bat_numbers),
            "pitcher": [691725] * len(at_bat_numbers),
            "batter": [500001] * len(at_bat_numbers),
            "stand": ["R"] * len(at_bat_numbers),
            "p_throws": ["R"] * len(at_bat_numbers),
            "balls": [0] * len(at_bat_numbers),
            "strikes": [0] * len(at_bat_numbers),
        }
    )


def test_load_inserts_new_rows(tmp_path):
    db_path = tmp_path / "test.duckdb"
    inserted = duckdb_adapter.load(_pitches([1, 2, 3]), db_path=db_path)
    assert inserted == 3
    assert duckdb_adapter.row_count(db_path) == 3


def test_load_is_idempotent_on_exact_rerun(tmp_path):
    db_path = tmp_path / "test.duckdb"
    df = _pitches([1, 2, 3])
    duckdb_adapter.load(df, db_path=db_path)

    inserted_again = duckdb_adapter.load(df, db_path=db_path)

    assert inserted_again == 0
    assert duckdb_adapter.row_count(db_path) == 3


def test_load_only_counts_genuinely_new_rows_on_overlap(tmp_path):
    db_path = tmp_path / "test.duckdb"
    duckdb_adapter.load(_pitches([1, 2]), db_path=db_path)

    inserted = duckdb_adapter.load(_pitches([1, 2, 3]), db_path=db_path)

    assert inserted == 1
    assert duckdb_adapter.row_count(db_path) == 3


def test_ensure_db_present_skips_download_when_file_exists(tmp_path, monkeypatch):
    db_path = tmp_path / "existing.duckdb"
    db_path.write_bytes(b"already here")

    def fail_get(*args, **kwargs):
        raise AssertionError("should not attempt a download when the file already exists")

    monkeypatch.setattr(duckdb_adapter.requests, "get", fail_get)

    duckdb_adapter.ensure_db_present(db_path)

    assert db_path.read_bytes() == b"already here"


def test_ensure_db_present_downloads_and_streams_to_final_path(tmp_path, monkeypatch):
    db_path = tmp_path / "downloaded" / "pitchmodel.duckdb"

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *exc_info):
            return False

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size):
            yield b"chunk-one-"
            yield b"chunk-two"

    def fake_get(url, stream, timeout):
        assert stream is True
        return FakeResponse()

    monkeypatch.setattr(duckdb_adapter.requests, "get", fake_get)

    duckdb_adapter.ensure_db_present(db_path)

    assert db_path.read_bytes() == b"chunk-one-chunk-two"
    assert not db_path.with_suffix(".duckdb.part").exists()


def test_ensure_db_present_cleans_up_partial_file_on_failure(tmp_path, monkeypatch):
    db_path = tmp_path / "pitchmodel.duckdb"

    def fake_get(url, stream, timeout):
        raise ConnectionError("dropped mid-stream")

    monkeypatch.setattr(duckdb_adapter.requests, "get", fake_get)

    with pytest.raises(ConnectionError):
        duckdb_adapter.ensure_db_present(db_path)

    assert not db_path.exists()
    assert not db_path.with_suffix(".duckdb.part").exists()
