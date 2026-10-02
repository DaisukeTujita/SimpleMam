import asyncio
from contextlib import contextmanager
from functools import lru_cache
from types import SimpleNamespace

from fastapi import FastAPI
import pytest
from sqlalchemy.exc import OperationalError

from app import main


@pytest.mark.parametrize("database_available, sqlstate", [(False, "08001"), (False, "IM002"), (True, None)])
def test_startup_distinguishes_database_and_media_errors_without_logging_secrets(
    tmp_path, monkeypatch, caplog, database_available, sqlstate
):
    @contextmanager
    def connect():
        if not database_available:
            raise OperationalError(None, None, RuntimeError(sqlstate, "private connection details"))
        yield SimpleNamespace(execute=lambda statement: None)

    disposed = []

    @lru_cache
    def engine():
        return SimpleNamespace(connect=connect, dispose=lambda: disposed.append(True))

    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "serializer", lambda: None)
    monkeypatch.setattr(
        main,
        "settings",
        lambda: SimpleNamespace(
            logging={"folder": str(tmp_path / "logs")},
            media={"thumbnail_root": str(tmp_path / "missing"), "hls_root": str(tmp_path / "missing")},
        ),
    )

    async def start():
        async with main.lifespan(FastAPI()):
            pytest.fail("Invalid startup must not reach the running application")

    with pytest.raises(RuntimeError if database_available else OperationalError):
        asyncio.run(start())

    expected_stage = "media.thumbnail_root directory" if database_available else "SQL Server connection"
    expected_state = "unknown" if database_available else sqlstate
    assert f"Failed during {expected_stage}" in caplog.text
    assert f"SQLSTATE={expected_state}" in caplog.text
    assert "private connection details" not in caplog.text
    assert "backend.stderr.log" in caplog.text
    if sqlstate == "IM002":
        assert "ODBC Driver 17 for SQL Server" in caplog.text
        assert "The example configuration selects Driver 18" in caplog.text
    assert disposed == [True]
