from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..auth import Principal, current_user
from ..db import get_db
from ..schemas import MaterialEdit
from ..services import materials

router = APIRouter(prefix="/api/materials", tags=["materials"])


@router.get("")
def search(
    created_from: date | None = None,
    created_to: date | None = None,
    title: str = "",
    number: str = "",
    category_code: str = "",
    genre_code: str = "",
    route: str = "",
    status: str = "",
    material_type: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    return materials.search(
        db,
        user,
        created_from,
        created_to,
        title,
        number,
        category_code,
        genre_code,
        route,
        status,
        material_type,
        page,
        page_size,
    )


@router.get("/{number}/usages")
def usages(number: str, user: Principal = Depends(current_user), db: Connection = Depends(get_db)):
    return materials.usages(db, user, number)


@router.get("/{number}")
def detail(number: str, user: Principal = Depends(current_user), db: Connection = Depends(get_db)):
    return materials.get(db, user, number)


@router.patch("/{number}")
def edit(
    number: str, body: MaterialEdit, user: Principal = Depends(current_user), db: Connection = Depends(get_db)
):
    result = materials.update(db, user, number, body)
    db.commit()
    return result
