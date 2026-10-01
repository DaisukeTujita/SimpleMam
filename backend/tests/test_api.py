from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.auth import Principal, current_user
from app.db import get_db
from app.main import app
from app.routers import uploads


def test_unauthenticated_reads_are_rejected():
    app.dependency_overrides[get_db] = lambda: None
    try:
        client = TestClient(app)  # No lifespan: tests never connect to a real SQL Server.
        response = client.get("/api/materials")
        assert response.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_unsafe_request_requires_same_origin_header():
    response = TestClient(app).post("/api/auth/logout")
    assert response.status_code == 403
    assert TestClient(app).post("/api/auth/logout", headers={"X-SimpleMam-Request": "1"}).status_code == 204


def test_upload_reception_and_oversize_cleanup(tmp_path, monkeypatch):
    monkeypatch.setattr(
        uploads, "settings", lambda: SimpleNamespace(upload={"folder": str(tmp_path), "max_file_bytes": 4})
    )
    app.dependency_overrides[current_user] = lambda: Principal("u", "User", "g", "Group", False)
    try:
        client = TestClient(app)
        headers = {"X-SimpleMam-Request": "1"}
        result = client.post(
            "/api/uploads", files={"file": ("video.mp4", b"1234", "video/mp4")}, headers=headers
        )
        assert result.status_code == 201
        assert len(list(tmp_path.glob("*.mp4"))) == 1
        assert len(list(tmp_path.glob("*.json"))) == 1
        rejected = client.post(
            "/api/uploads", files={"file": ("large.mp4", b"12345", "video/mp4")}, headers=headers
        )
        assert rejected.status_code == 413
        assert not list(tmp_path.glob("*.part"))
        assert len(list(tmp_path.glob("*.json"))) == 1
    finally:
        app.dependency_overrides.clear()
