"""Programs are identified by program_id + on_air_date. Shared blocks use program_id."""

from datetime import date

from fastapi import HTTPException
from sqlalchemy import text

from ..db import rows
from .materials import contains

AIR_DATE = "CASE WHEN LEFT(CONVERT(varchar(30), p.on_air_date), 4)='9999' THEN NULL ELSE p.on_air_date END"
BASE = """
FROM T_PROGRAMS p
LEFT JOIN M_SUB_CONTROL_ROOMS r ON r.sub_control_room_id=p.sub_control_room_id
WHERE p.program_data_type='2' AND (:admin=1 OR p.group_id=:group_id)
"""
COLUMNS = f"""p.program_id AS id, p.program_name AS name, {AIR_DATE} AS on_air_date,
p.program_start_time AS start_time, p.program_end_time AS end_time, p.group_id,
p.category_code, p.genre_code, p.sub_control_room_id, r.sub_control_room_name"""


def present(row, user):
    item = dict(row)
    for key in ("name", "group_id", "category_code", "genre_code", "sub_control_room_name"):
        item[key] = str(item[key] or "")
    item["can_edit"] = user.can_edit(item["group_id"])
    item["start_time"] = str(item["start_time"] or "")
    item["end_time"] = str(item["end_time"] or "")
    return item


def date_where(value: str):
    if value == "undated":
        return f"{AIR_DATE} IS NULL", {}
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(422, "放送日が正しくありません") from None
    if parsed.year == 9999:
        raise HTTPException(422, "放送日未定はundatedで指定してください")
    return f"{AIR_DATE} = :air_date", {"air_date": parsed}


def get(db, user, program_id, on_air_date, lock=False):
    condition, params = date_where(on_air_date)
    source = BASE.replace("T_PROGRAMS p", "T_PROGRAMS p WITH (UPDLOCK, HOLDLOCK)") if lock else BASE
    matches = rows(
        db,
        "SELECT " + COLUMNS + source + " AND p.program_id=:id AND " + condition,
        {**user.params(), **params, "id": program_id},
    )
    if not matches:
        raise HTTPException(404, "番組が見つかりません")
    if len(matches) != 1:
        raise HTTPException(409, "番組IDと放送日の組み合わせが重複しています")
    return present(matches[0], user)


def search(
    db,
    user,
    date_from=None,
    date_to=None,
    name="",
    category_code="",
    genre_code="",
    room="",
    group="",
    include_undated=False,
    page=1,
    page_size=50,
):
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "開始日は終了日以前にしてください")
    conditions = []
    params = user.params()
    date_parts = []
    for value, op, key in ((date_from, ">=", "date_from"), (date_to, "<=", "date_to")):
        if value:
            date_parts.append(f"{AIR_DATE}{op}:{key}")
            params[key] = value
    if date_parts:
        condition = "(" + " AND ".join(date_parts) + ")"
        conditions.append(f"({condition} OR {AIR_DATE} IS NULL)" if include_undated else condition)
    elif not include_undated:
        conditions.append(f"{AIR_DATE} IS NOT NULL")
    if name:
        conditions.append("p.program_name LIKE :name ESCAPE '/'")
        params["name"] = contains(name)
    for value, column, key in (
        (category_code, "p.category_code", "category"),
        (genre_code, "p.genre_code", "genre"),
        (room, "p.sub_control_room_id", "room"),
        (group, "p.group_id", "group"),
    ):
        if value != "" and value is not None:
            conditions.append(f"{column}=:{key}")
            params[key] = value
    source = BASE + (" AND " + " AND ".join(conditions) if conditions else "")
    total = rows(db, "SELECT COUNT(*) AS total " + source, params)[0]["total"]
    params.update(offset=(page - 1) * page_size, limit=page_size)
    found = rows(
        db,
        "SELECT "
        + COLUMNS
        + source
        + f" ORDER BY {AIR_DATE}, p.program_start_time, p.program_id OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY",
        params,
    )
    return {"items": [present(row, user) for row in found], "total": total}


def update_name(db, user, program_id, on_air_date, edit):
    old = get(db, user, program_id, on_air_date, lock=True)
    if not old["can_edit"]:
        raise HTTPException(403, "編集権限がありません")
    if old["name"] != edit.expected:
        raise HTTPException(409, "他の利用者が変更しました。再読み込みしてください")
    condition, params = date_where(on_air_date)
    result = db.execute(
        text(
            "UPDATE p SET program_name=:name FROM T_PROGRAMS p WHERE p.program_id=:id AND "
            + condition
            + " AND p.program_data_type='2'"
        ),
        {**params, "id": program_id, "name": edit.name},
    )
    if result.rowcount != 1:
        raise HTTPException(409, "番組が変更されました。再読み込みしてください")
    return get(db, user, program_id, on_air_date)
