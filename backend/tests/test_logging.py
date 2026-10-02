from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy.exc import ProgrammingError

from app import main
from app.auth import Principal, current_user
from app.db import get_db


def test_database_failure_logs_driver_sql_location_and_shared_request_id(monkeypatch, caplog):
    def execute(statement, params):
        raise ProgrammingError(
            str(statement), {"password": "bound-secret"},
            RuntimeError("42S22", "Invalid column name 'missing_column'; connection=db-secret"),
        )

    monkeypatch.setattr(main, "settings", lambda: SimpleNamespace(database={"password": "db-secret"}))
    main.app.dependency_overrides[current_user] = lambda: Principal("u", "User", "g", "Group", False)
    main.app.dependency_overrides[get_db] = lambda: SimpleNamespace(execute=execute)
    try:
        with caplog.at_level("INFO", logger="simplemam"):
            response = TestClient(main.app).get("/api/materials?title=query-secret")
        assert response.status_code == 503
        request_id = response.headers["X-Request-Id"]
        assert response.json()["request_id"] == request_id
        assert f"RECEIVE request={request_id} GET /api/materials" in caplog.text
        assert f"RESPONSE request={request_id} GET /api/materials status=503" in caplog.text
        assert f"Database operation failed request={request_id}" in caplog.text
        assert "SQLSTATE=42S22" in caplog.text
        assert "Invalid column name 'missing_column'" in caplog.text
        assert "SQL: SELECT" in caplog.text
        assert "services/materials.py:" in caplog.text
        assert "db.py:" in caplog.text
        assert "elapsed_ms=" in caplog.text
        assert "[REDACTED]" in caplog.text
        assert "db-secret" not in caplog.text
        assert "bound-secret" not in caplog.text
        assert "query-secret" not in caplog.text
    finally:
        main.app.dependency_overrides.clear()


def test_early_rejection_is_logged_with_request_id(caplog):
    with caplog.at_level("INFO", logger="simplemam"):
        response = TestClient(main.app).post("/api/auth/logout")
    assert response.status_code == 403
    request_id = response.headers["X-Request-Id"]
    assert f"RECEIVE request={request_id}" in caplog.text
    assert f"RESPONSE request={request_id}" in caplog.text
    assert "status=403" in caplog.text


def test_unhandled_error_is_logged_without_request_body_or_exception_values(caplog):
    def execute(statement, params):
        raise ValueError("private-value")

    main.app.dependency_overrides[current_user] = lambda: Principal("u", "User", "g", "Group", False)
    main.app.dependency_overrides[get_db] = lambda: SimpleNamespace(execute=execute)
    try:
        with caplog.at_level("INFO", logger="simplemam"):
            response = TestClient(main.app, raise_server_exceptions=False).get("/api/materials")
        assert response.status_code == 500
        assert "ERROR request=" in caplog.text
        assert "exception=ValueError" in caplog.text
        assert "services/materials.py:" in caplog.text
        assert "private-value" not in caplog.text
    finally:
        main.app.dependency_overrides.clear()
