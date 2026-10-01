from types import SimpleNamespace

from fastapi import HTTPException
from itsdangerous import URLSafeTimedSerializer
import pytest
from starlette.requests import Request

from app import auth


def request(cookie=""):
    return Request({"type": "http", "headers": [(b"cookie", cookie.encode())]})


def test_session_tamper_and_missing_cookie(monkeypatch):
    signer = URLSafeTimedSerializer("a" * 48, salt="test")
    monkeypatch.setattr(auth, "serializer", lambda: signer)
    monkeypatch.setattr(auth, "settings", lambda: SimpleNamespace(auth={"session_hours": 8}))
    token = signer.dumps({"user_id": "u1", "group_id": "g1"})
    assert auth.session(request(f"{auth.COOKIE}={token}"))["group_id"] == "g1"
    for value in ("", f"{auth.COOKIE}={token}tampered"):
        with pytest.raises(HTTPException) as exc:
            auth.session(request(value))
        assert exc.value.status_code == 401


def test_group_limits():
    user = auth.Principal("u", "u", "g", "g", False)
    assert user.can_edit("g")
    assert not user.can_edit("other")
    assert not user.can_edit(None)
    assert auth.Principal("u", "u", "g", "g", True).can_edit("other")


def test_password_formats(monkeypatch):
    monkeypatch.setattr(auth, "settings", lambda: SimpleNamespace(auth={"password_format": "plain"}))
    assert auth.password_matches("password", "password")
    assert not auth.password_matches("password", "wrong")
    import hashlib

    digest = hashlib.md5(hashlib.md5(b"password").hexdigest().encode()).hexdigest()
    monkeypatch.setattr(auth, "settings", lambda: SimpleNamespace(auth={"password_format": "double_md5"}))
    assert auth.password_matches(digest.upper(), "password")
    assert not auth.password_matches(digest, "wrong")
