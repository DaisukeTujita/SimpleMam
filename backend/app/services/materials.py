"""Material SQL is here. No adapter, sub-number, file table, or system-settings lookup."""

from datetime import date, datetime, time, timedelta
import re
from urllib.parse import quote

from fastapi import HTTPException
from sqlalchemy import text

from ..auth import Principal
from ..config import settings
from ..db import rows

STATUS = {"": "未登録", "1": "未登録", "2": "登録中", "3": "登録完了", "8": "キャンセル", "9": "エラー"}
TYPE = {"1": "元素材", "2": "OA素材"}
BASE = """
FROM T_MATERIALS m JOIN T_MATERIAL_VERSIONS v ON v.material_id = m.material_id
WHERE m.is_deleted = 0 AND (:admin = 1 OR m.group_id = :group_id)
"""
COLUMNS = """CAST(m.material_id AS varchar(64)) AS id, v.material_number AS number,
v.material_title AS title, m.material_type, m.category_code, m.genre_code, m.group_id,
v.registration_status AS status, v.created_at, v.registration_path AS registration_route,
v.on_air_duration, v.material_content, v.handover_note, v.edit_status"""


def duration(frames):
    if frames is None:
        return "-"
    frames = max(0, int(frames))
    return f"{frames // 108000:02}:{frames // 1800 % 60:02}:{frames // 30 % 60:02}:{frames % 30:02}"


def contains(value: str) -> str:
    return "%" + value.replace("/", "//").replace("%", "/%").replace("_", "/_").replace("[", "/[") + "%"


def present(row: dict, user: Principal):
    item = dict(row)
    for key in (
        "title",
        "category_code",
        "genre_code",
        "group_id",
        "registration_route",
        "material_content",
        "handover_note",
    ):
        item[key] = str(item.get(key) or "")
    item["id"] = str(item["id"])
    item["number"] = str(item["number"])
    if not re.fullmatch(r'[^\x00-\x1f<>:"/\\|?*]+', item["number"]) or item["number"] in (".", ".."):
        raise HTTPException(409, "素材番号はフォルダー名として使用できる値である必要があります")
    item["status"] = STATUS.get(str(item["status"] or ""), "未登録")
    item["material_type"] = TYPE.get(str(item["material_type"]), str(item["material_type"]))
    item["edit_status"] = {"1": "白", "2": "黒"}.get(str(item["edit_status"] or ""), "")
    item["duration"] = duration(item.pop("on_air_duration"))
    item["can_edit"] = user.can_edit(item["group_id"])
    media = settings().media
    number = quote(item["number"], safe="")
    item["thumbnail_url"] = f"/media/thumbnails/{number}/{quote(media['thumbnail_file'], safe='')}"
    item["hls_url"] = f"/media/hls/{number}/{quote(media['hls_file'], safe='')}"
    return item


def search(
    db,
    user,
    created_from: date | None,
    created_to: date | None,
    title="",
    number="",
    category_code="",
    genre_code="",
    route="",
    status="",
    material_type="",
    page=1,
    page_size=50,
):
    conditions = []
    params = user.params()
    if created_from and created_to and created_from > created_to:
        raise HTTPException(422, "開始日は終了日以前にしてください")
    for value, column, key in ((title, "v.material_title", "title"), (number, "v.material_number", "number")):
        terms = value.split()
        if terms:
            parts = []
            for i, term in enumerate(terms):
                name = f"{key}_{i}"
                parts.append(f"{column} LIKE :{name} ESCAPE '/' ")
                params[name] = contains(term)
            conditions.append("(" + " OR ".join(parts) + ")")
    for value, column, key in (
        (category_code, "m.category_code", "category"),
        (genre_code, "m.genre_code", "genre"),
        (route, "v.registration_path", "route"),
        (material_type, "m.material_type", "type"),
    ):
        if value:
            conditions.append(f"{column} = :{key}")
            params[key] = value
    if created_from:
        conditions.append("v.created_at >= :date_from")
        params["date_from"] = datetime.combine(created_from, time.min)
    if created_to:
        if created_to == date.max:
            raise HTTPException(422, "終了日は9999-12-30以前にしてください")
        conditions.append("v.created_at < :date_to")
        params["date_to"] = datetime.combine(created_to + timedelta(days=1), time.min)
    source = BASE + (" AND " + " AND ".join(conditions) if conditions else "")
    # Reject ambiguity instead of silently selecting a version or editing multiple rows.
    duplicates = rows(
        db,
        "SELECT TOP 1 v.material_number " + source + " GROUP BY v.material_number HAVING COUNT(*) > 1",
        params,
    )
    if duplicates:
        raise HTTPException(409, "素材番号が重複しています。SimpleMamは素材番号単位で一意なDBを前提とします")
    grouped = rows(
        db,
        "SELECT v.registration_status AS status, COUNT(*) AS n " + source + " GROUP BY v.registration_status",
        params,
    )
    counts = {label: 0 for label in STATUS.values()}
    for row in grouped:
        counts[STATUS.get(str(row["status"] or ""), "未登録")] += row["n"]
    total = sum(counts.values()) if not status else counts.get(status, 0)
    if status:
        if status not in counts:
            raise HTTPException(422, "状態が正しくありません")
        codes = [code for code, label in STATUS.items() if label == status]
        placeholders = []
        for i, code in enumerate(codes):
            params[f"status_{i}"] = code
            placeholders.append(f":status_{i}")
        source += " AND COALESCE(v.registration_status, '') IN (" + ",".join(placeholders) + ")"
    params.update(offset=(page - 1) * page_size, limit=page_size)
    result = rows(
        db,
        "SELECT "
        + COLUMNS
        + source
        + """
        ORDER BY v.created_at DESC, v.material_number DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
    """,
        params,
    )
    return {"items": [present(row, user) for row in result], "total": total, "status_counts": counts}


def get(db, user, number: str, lock=False):
    source = (
        BASE
        if not lock
        else BASE.replace("T_MATERIALS m", "T_MATERIALS m WITH (UPDLOCK, HOLDLOCK)").replace(
            "T_MATERIAL_VERSIONS v", "T_MATERIAL_VERSIONS v WITH (UPDLOCK, HOLDLOCK)"
        )
    )
    matches = rows(
        db,
        "SELECT " + COLUMNS + source + " AND v.material_number = :number",
        {**user.params(), "number": number},
    )
    if not matches:
        raise HTTPException(404, "素材が見つかりません")
    if len(matches) != 1:
        raise HTTPException(409, "素材番号が重複しているため、この素材は扱えません")
    return present(matches[0], user)


def update(db, user, number, edit):
    old = get(db, user, number, lock=True)
    if not old["can_edit"]:
        raise HTTPException(403, "編集権限がありません")
    if any(old[key] != value for key, value in edit.expected.model_dump().items()):
        raise HTTPException(409, "他の利用者が変更しました。再読み込みしてください")
    values = {**edit.values.model_dump(), "number": number, "id": old["id"]}
    result = db.execute(
        text("""UPDATE T_MATERIAL_VERSIONS SET material_title=:title,
        material_content=:material_content, handover_note=:handover_note
        WHERE material_number=:number"""),
        values,
    )
    if result.rowcount != 1:
        raise HTTPException(409, "素材が変更されました。再読み込みしてください")
    result = db.execute(
        text(
            "UPDATE T_MATERIALS SET category_code=:category_code, genre_code=:genre_code WHERE material_id=:id"
        ),
        values,
    )
    if result.rowcount != 1:
        raise HTTPException(409, "素材が変更されました。再読み込みしてください")
    return get(db, user, number)


def usages(db, user, number):
    get(db, user, number)
    result = rows(
        db,
        """
        SELECT p.program_id AS id, p.program_name AS name, p.on_air_date,
          p.program_start_time AS start_time, s.small_block_name
        FROM T_RUNDOWN_SMALL_BLOCKS s JOIN T_PROGRAMS p ON p.program_id=s.program_id
        WHERE s.is_deleted=0 AND s.active_material_number=:number
          AND (:admin=1 OR p.group_id=:group_id)
        ORDER BY p.on_air_date DESC, p.program_start_time
    """,
        {**user.params(), "number": number},
    )
    for item in result:
        value = item.get("on_air_date")
        if value is not None and str(value).startswith("9999"):
            item["on_air_date"] = None
    return result
