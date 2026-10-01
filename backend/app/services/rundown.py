"""Concrete SQL for the existing large/small block tables; all writes use one transaction."""

from fastapi import HTTPException
from sqlalchemy import text

from ..db import rows
from . import programs


def get(db, user, program_id, on_air_date):
    program = programs.get(db, user, program_id, on_air_date)
    large = rows(
        db,
        """SELECT large_block_number AS number, large_block_name AS name,
        display_number, sort_order, is_discarded FROM T_RUNDOWN_LARGE_BLOCKS
        WHERE program_id=:id ORDER BY sort_order, large_block_number""",
        {"id": program_id},
    )
    small = rows(
        db,
        """SELECT small_block_id AS id, large_block_number AS large_number,
        small_block_name AS name, active_material_number AS material_number, is_blank, sort_order
        FROM T_RUNDOWN_SMALL_BLOCKS WHERE program_id=:id AND is_deleted=0
        ORDER BY sort_order, small_block_id""",
        {"id": program_id},
    )
    for item in small:
        item["name"] = str(item["name"] or "")
        item["material_number"] = str(item["material_number"] or "")
        item["is_blank"] = bool(item["is_blank"])
    for item in large:
        item["name"] = str(item["name"] or "")
        item["is_discarded"] = bool(item["is_discarded"])
        item["children"] = [child for child in small if child["large_number"] == item["number"]]
    numbers = {item["number"] for item in large}
    bucket = [item for item in small if item["large_number"] == 0 or item["large_number"] not in numbers]
    return {"program": program, "large_blocks": large, "bucket": bucket}


def authorize_write(db, user, program_id, on_air_date):
    program = programs.get(db, user, program_id, on_air_date, lock=True)
    if not program["can_edit"]:
        raise HTTPException(403, "編集権限がありません")
    # Existing block tables have no on_air_date. Do not edit shared blocks across broadcasts.
    matches = rows(db, "SELECT COUNT(*) AS n FROM T_PROGRAMS WHERE program_id=:id", {"id": program_id})
    if matches[0]["n"] != 1:
        raise HTTPException(
            409,
            "このDBでは同じ番組IDが複数放送日にあります。放送日を持たない運行表テーブルへの更新はできません",
        )


def add_large(db, user, program_id, on_air_date, name):
    authorize_write(db, user, program_id, on_air_date)
    params = {"id": program_id, "name": name}
    next_row = rows(
        db,
        """SELECT COALESCE(MAX(large_block_number),0)+1 AS number,
        COALESCE(MAX(sort_order),0)+1 AS ordering FROM T_RUNDOWN_LARGE_BLOCKS
        WITH (UPDLOCK, HOLDLOCK) WHERE program_id=:id""",
        params,
    )[0]
    if next_row["number"] > 999:
        raise HTTPException(409, "大項目番号の上限に達しました")
    params.update(
        number=next_row["number"], ordering=next_row["ordering"], display=f"{next_row['number']:03}"
    )
    db.execute(
        text("""INSERT INTO T_RUNDOWN_LARGE_BLOCKS
        (program_id,large_block_number,large_block_category,large_block_type,is_discarded,
         sort_order,large_block_name,display_number) VALUES (:id,:number,'1','1',0,:ordering,:name,:display)"""),
        params,
    )
    return {"number": next_row["number"]}


def add_small(db, user, program_id, on_air_date, large_number, name):
    authorize_write(db, user, program_id, on_air_date)
    params = {"id": program_id, "large": large_number, "name": name}
    if large_number != 0 and not rows(
        db,
        "SELECT 1 AS found FROM T_RUNDOWN_LARGE_BLOCKS WHERE program_id=:id AND large_block_number=:large",
        params,
    ):
        raise HTTPException(404, "大項目が見つかりません")
    params["ordering"] = rows(
        db,
        """SELECT COALESCE(MAX(sort_order),0)+1 AS ordering
        FROM T_RUNDOWN_SMALL_BLOCKS WITH (UPDLOCK,HOLDLOCK)
        WHERE program_id=:id AND large_block_number=:large AND is_deleted=0""",
        params,
    )[0]["ordering"]
    result = db.execute(
        text("""INSERT INTO T_RUNDOWN_SMALL_BLOCKS
        (program_id,large_block_number,sort_order,small_block_name,material_id,active_material_number,is_blank,is_deleted)
        OUTPUT INSERTED.small_block_id VALUES (:id,:large,:ordering,:name,NULL,NULL,0,0)"""),
        params,
    )
    return {"id": result.scalar_one()}


def change(db, user, program_id, on_air_date, kind, block_id, expected, name=None):
    authorize_write(db, user, program_id, on_air_date)
    # Identifiers only come from this fixed mapping; user input is always parameterized.
    table, key, column = (
        ("T_RUNDOWN_LARGE_BLOCKS", "large_block_number", "large_block_name")
        if kind == "large"
        else ("T_RUNDOWN_SMALL_BLOCKS", "small_block_id", "small_block_name")
    )
    params = {"id": program_id, "block": block_id, "expected": expected, "name": name}
    alive = "" if kind == "large" else " AND is_deleted=0"
    matches = rows(
        db,
        f"SELECT {column} AS name FROM {table} WITH (UPDLOCK,HOLDLOCK) WHERE program_id=:id AND {key}=:block"
        + alive,
        params,
    )
    if len(matches) != 1 or str(matches[0]["name"] or "") != expected:
        raise HTTPException(409, "他の利用者が変更しました。再読み込みしてください")
    if name is not None:
        result = db.execute(
            text(f"UPDATE {table} SET {column}=:name WHERE program_id=:id AND {key}=:block" + alive), params
        )
    elif kind == "small":
        result = db.execute(
            text(
                "UPDATE T_RUNDOWN_SMALL_BLOCKS SET is_deleted=1 WHERE program_id=:id AND small_block_id=:block AND is_deleted=0"
            ),
            params,
        )
    else:
        db.execute(
            text(
                "UPDATE T_RUNDOWN_SMALL_BLOCKS SET is_deleted=1 WHERE program_id=:id AND large_block_number=:block AND is_deleted=0"
            ),
            params,
        )
        result = db.execute(
            text("DELETE FROM T_RUNDOWN_LARGE_BLOCKS WHERE program_id=:id AND large_block_number=:block"),
            params,
        )
    if result.rowcount != 1:
        raise HTTPException(409, "項目が変更されました。再読み込みしてください")
