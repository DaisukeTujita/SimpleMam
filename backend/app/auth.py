"""Signed HttpOnly session and direct reads of existing user/group tables."""

from dataclasses import dataclass
from functools import lru_cache
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, Request
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.engine import Connection

from .config import ROOT, settings
from .db import get_db, rows

COOKIE = "simplemam_session"


@lru_cache
def serializer():
    path = ROOT / "var" / "session-secret.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("x", encoding="utf-8") as stream:
            stream.write(secrets.token_urlsafe(48))
        path.chmod(0o600)
    except FileExistsError:
        pass
    secret = path.read_text(encoding="utf-8").strip()
    if len(secret) < 32:
        raise RuntimeError("var/session-secret.txt must contain at least 32 characters")
    return URLSafeTimedSerializer(secret, salt="simplemam-session")


def set_session(response, user_id: str, group_id: str | None = None):
    response.set_cookie(
        COOKIE,
        serializer().dumps({"user_id": user_id, "group_id": group_id}),
        max_age=int(settings().auth.get("session_hours", 8)) * 3600,
        httponly=True,
        secure=settings().auth.get("cookie_secure", False),
        samesite="lax",
        path="/",
    )


def session(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "ログインしてください")
    try:
        data = serializer().loads(token, max_age=int(settings().auth.get("session_hours", 8)) * 3600)
        if not isinstance(data, dict) or not isinstance(data.get("user_id"), str):
            raise BadSignature("invalid session")
        return data
    except BadSignature:
        raise HTTPException(401, "ログインしてください") from None


@dataclass(frozen=True)
class Principal:
    user_id: str
    user_name: str
    group_id: str
    group_name: str
    is_admin: bool

    def can_edit(self, group_id: str | None) -> bool:
        return self.is_admin or str(group_id or "") == self.group_id

    def params(self) -> dict:
        return {"admin": int(self.is_admin), "group_id": self.group_id}


def current_user(request: Request, db: Connection = Depends(get_db)) -> Principal:
    payload = session(request)
    if not payload.get("group_id"):
        raise HTTPException(403, "グループを選択してください")
    matches = rows(
        db,
        """
        SELECT u.user_id, u.first_name, u.last_name, g.group_id, g.group_name, g.authority_flag
        FROM T_USERS u JOIN T_USERS_GROUPS ug ON ug.user_id = u.user_id
        JOIN T_GROUPS g ON g.group_id = ug.group_id
        WHERE u.user_id = :user_id AND g.group_id = :group_id
    """,
        payload,
    )
    if len(matches) != 1:
        raise HTTPException(401, "ログインし直してください")
    row = matches[0]
    return Principal(
        str(row["user_id"]),
        f"{row['last_name'] or ''} {row['first_name'] or ''}".strip(),
        str(row["group_id"]),
        str(row["group_name"] or ""),
        str(row["authority_flag"] or "").strip().endswith("1"),
    )


def password_matches(stored: str, supplied: str) -> bool:
    if settings().auth.get("password_format", "plain") == "double_md5":
        supplied = hashlib.md5(hashlib.md5(supplied.encode()).hexdigest().encode()).hexdigest()
        stored = stored.lower()
    return hmac.compare_digest(stored.encode(), supplied.encode())
