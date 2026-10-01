from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..auth import Principal, current_user
from ..db import get_db, rows
from ..schemas import NameEdit
from ..services import programs

router = APIRouter(prefix="/api", tags=["programs"])


@router.get("/sub-control-rooms")
def rooms(user: Principal = Depends(current_user), db: Connection = Depends(get_db)):
    return rows(
        db,
        "SELECT sub_control_room_id AS id, sub_control_room_name AS name FROM M_SUB_CONTROL_ROOMS ORDER BY sub_control_room_id",
    )


@router.get("/programs")
def search(
    date_from: date | None = None,
    date_to: date | None = None,
    name: str = "",
    category_code: str = "",
    genre_code: str = "",
    room: str = "",
    group: str = "",
    include_undated: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    return programs.search(
        db,
        user,
        date_from,
        date_to,
        name,
        category_code,
        genre_code,
        room,
        group,
        include_undated,
        page,
        page_size,
    )


@router.get("/programs/{program_id}")
def detail(
    program_id: int,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    return programs.get(db, user, program_id, on_air_date)


@router.patch("/programs/{program_id}")
def edit(
    program_id: int,
    body: NameEdit,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    result = programs.update_name(db, user, program_id, on_air_date, body)
    db.commit()
    return result
