from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..auth import Principal, current_user
from ..db import get_db
from ..schemas import DeleteBlock, NameEdit, NewBlock
from ..services import rundown

router = APIRouter(prefix="/api/programs/{program_id}/rundown", tags=["rundown"])


@router.get("")
def detail(
    program_id: int,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    return rundown.get(db, user, program_id, on_air_date)


@router.post("/large-blocks", status_code=201)
def add_large(
    program_id: int,
    body: NewBlock,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    result = rundown.add_large(db, user, program_id, on_air_date, body.name)
    db.commit()
    return result


@router.post("/large-blocks/{large_number}/small-blocks", status_code=201)
def add_small(
    program_id: int,
    large_number: int,
    body: NewBlock,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    result = rundown.add_small(db, user, program_id, on_air_date, large_number, body.name)
    db.commit()
    return result


@router.patch("/large-blocks/{block_id}", status_code=204)
def rename_large(
    program_id: int,
    block_id: int,
    body: NameEdit,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    rundown.change(db, user, program_id, on_air_date, "large", block_id, body.expected, body.name)
    db.commit()


@router.patch("/small-blocks/{block_id}", status_code=204)
def rename_small(
    program_id: int,
    block_id: int,
    body: NameEdit,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    rundown.change(db, user, program_id, on_air_date, "small", block_id, body.expected, body.name)
    db.commit()


@router.delete("/large-blocks/{block_id}", status_code=204)
def delete_large(
    program_id: int,
    block_id: int,
    body: DeleteBlock,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    rundown.change(db, user, program_id, on_air_date, "large", block_id, body.expected)
    db.commit()


@router.delete("/small-blocks/{block_id}", status_code=204)
def delete_small(
    program_id: int,
    block_id: int,
    body: DeleteBlock,
    on_air_date: str = Query(...),
    user: Principal = Depends(current_user),
    db: Connection = Depends(get_db),
):
    rundown.change(db, user, program_id, on_air_date, "small", block_id, body.expected)
    db.commit()
