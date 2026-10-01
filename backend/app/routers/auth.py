from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.engine import Connection

from ..auth import COOKIE, Principal, current_user, password_matches, session, set_session
from ..db import get_db, rows
from ..schemas import GroupSelection, Login

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: Login, response: Response, db: Connection = Depends(get_db)):
    found = rows(
        db,
        "SELECT u.user_id, p.password FROM T_USERS u JOIN T_PASSWORDS p ON p.user_id=u.user_id WHERE u.user_id=:id",
        {"id": body.user_id},
    )
    if len(found) != 1 or not password_matches(str(found[0]["password"] or ""), body.password):
        raise HTTPException(401, "IDまたはパスワードが違います")
    set_session(response, body.user_id)
    return {"ok": True}


@router.get("/groups")
def groups(request: Request, db: Connection = Depends(get_db)):
    payload = session(request)
    return rows(
        db,
        """SELECT g.group_id, g.group_name FROM T_GROUPS g
        JOIN T_USERS_GROUPS ug ON ug.group_id=g.group_id
        JOIN T_USERS u ON u.user_id=ug.user_id WHERE ug.user_id=:id ORDER BY g.group_name""",
        {"id": payload["user_id"]},
    )


@router.post("/select-group")
def select_group(
    body: GroupSelection, request: Request, response: Response, db: Connection = Depends(get_db)
):
    payload = session(request)
    if payload.get("group_id"):
        raise HTTPException(409, "グループを変更するにはログアウトしてください")
    found = rows(
        db,
        """SELECT 1 AS found FROM T_USERS_GROUPS ug
        JOIN T_USERS u ON u.user_id=ug.user_id JOIN T_GROUPS g ON g.group_id=ug.group_id
        WHERE ug.user_id=:id AND ug.group_id=:group""",
        {"id": payload["user_id"], "group": body.group_id},
    )
    if not found:
        raise HTTPException(403, "このグループには所属していません")
    set_session(response, payload["user_id"], body.group_id)
    return {"ok": True}


@router.get("/me")
def me(user: Principal = Depends(current_user)):
    return asdict(user)


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
