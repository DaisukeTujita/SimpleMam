from datetime import date, datetime
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

from app.auth import Principal
from app.services import materials, programs, rundown

USER = Principal("u1", "利用者", "g1", "報道", False)


def material_row():
    return dict(
        id="ABC-001",
        number="MAT-001",
        title=None,
        material_type="1",
        category_code="01",
        genre_code="02",
        group_id="g1",
        status="3",
        created_at=datetime(2026, 10, 2),
        registration_route="FTP",
        on_air_duration=None,
        material_content=None,
        handover_note=None,
        edit_status=None,
    )


def test_media_uses_only_toml_and_material_number(monkeypatch):
    monkeypatch.setattr(
        materials,
        "settings",
        lambda: SimpleNamespace(media={"thumbnail_file": "thumbnail.jpg", "hls_file": "index.m3u8"}),
    )
    item = materials.present(material_row(), USER)
    assert item["thumbnail_url"] == "/media/thumbnails/MAT-001/thumbnail.jpg"
    assert item["hls_url"] == "/media/hls/MAT-001/index.m3u8"
    assert item["title"] == ""
    assert item["id"] == "ABC-001"
    assert item["duration"] == "-"
    assert item["registration_route"] == "FTP"
    assert not any("sub_number" in key for key in item)


@pytest.mark.parametrize("number", ["../x", "..", r"a\b", "a:b", ""])
def test_invalid_folder_identifiers_rejected(monkeypatch, number):
    row = material_row()
    row["number"] = number
    with pytest.raises(HTTPException) as exc:
        materials.present(row, USER)
    assert exc.value.status_code == 409


def test_duplicate_number_never_updates(monkeypatch):
    monkeypatch.setattr(materials, "rows", lambda *args: [material_row(), material_row()])
    with pytest.raises(HTTPException) as exc:
        materials.get(None, USER, "MAT-001", lock=True)
    assert exc.value.status_code == 409


def test_stale_material_edit_rejected_before_write(monkeypatch):
    from app.schemas import MaterialEdit, MaterialValues

    monkeypatch.setattr(materials, "get", lambda *args, **kwargs: {"can_edit": True, "title": "changed"})
    db = SimpleNamespace(execute=lambda *args: pytest.fail("No update allowed"))
    edit = MaterialEdit(values=MaterialValues(title="new"), expected=MaterialValues(title="old"))
    with pytest.raises(HTTPException) as exc:
        materials.update(db, USER, "MAT-001", edit)
    assert exc.value.status_code == 409


def test_search_is_group_scoped_and_sql_order_is_not_bound(monkeypatch):
    calls = []

    def read(db, sql, params):
        calls.append((sql, params.copy()))
        return []

    monkeypatch.setattr(materials, "rows", read)
    materials.search(None, USER, date(2026, 10, 2), date(2026, 10, 2), title="x%' OR 1=1")
    assert all("m.group_id = :group_id" in sql for sql, _ in calls)
    assert all(params["group_id"] == "g1" and params["admin"] == 0 for _, params in calls)
    assert all("OR 1=1" not in sql for sql, _ in calls)
    assert calls[-1][1]["date_to"] == datetime(2026, 10, 3)
    assert "ORDER BY v.created_at DESC, v.material_number DESC" in calls[-1][0]
    assert "sub_number" not in calls[-1][0]


def test_invalid_date_range_rejected_before_query(monkeypatch):
    monkeypatch.setattr(materials, "rows", lambda *args: pytest.fail("Invalid search reached DB"))
    with pytest.raises(HTTPException) as exc:
        materials.search(None, USER, date(2026, 10, 3), date(2026, 10, 2))
    assert exc.value.status_code == 422


def test_program_lookup_uses_both_id_and_date(monkeypatch):
    calls = []
    monkeypatch.setattr(programs, "rows", lambda db, sql, params: calls.append((sql, params)) or [])
    with pytest.raises(HTTPException):
        programs.get(None, USER, 12, "2026-10-02")
    assert "p.program_id=:id" in calls[0][0]
    assert ":air_date" in calls[0][0]
    assert calls[0][1]["air_date"] == date(2026, 10, 2)
    assert "group_id=:group_id" in calls[0][0]


def test_shared_program_blocks_cannot_be_updated(monkeypatch):
    monkeypatch.setattr(programs, "get", lambda *args, **kwargs: {"can_edit": True})
    monkeypatch.setattr(rundown, "rows", lambda *args: [{"n": 2}])
    with pytest.raises(HTTPException) as exc:
        rundown.authorize_write(None, USER, 12, "2026-10-02")
    assert exc.value.status_code == 409


def test_duration_is_frames():
    assert materials.duration(30) == "00:00:01:00"
    assert materials.duration(108001) == "01:00:00:01"
