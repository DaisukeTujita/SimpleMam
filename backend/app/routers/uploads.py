"""Standard FastAPI multipart upload. Reception does not create material database rows."""

import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..auth import Principal, current_user
from ..config import local_path, settings

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("", status_code=201)
def upload(
    file: UploadFile = File(...),
    title: str = Form("", max_length=128),
    user: Principal = Depends(current_user),
):
    cfg = settings().upload
    folder = local_path(cfg["folder"])
    folder.mkdir(parents=True, exist_ok=True)
    original = Path((file.filename or "upload").replace("\\", "/")).name
    extension = Path(original).suffix.lower()
    if extension not in (".mp4", ".mov", ".mxf", ".m4v", ".webm", ".avi", ".mpeg", ".mpg"):
        raise HTTPException(422, "動画ファイルを選択してください")
    upload_id = uuid4().hex
    target = folder / (upload_id + extension)
    temporary = folder / (upload_id + ".part")
    metadata = folder / (upload_id + ".json")
    size = 0
    try:
        with temporary.open("xb") as stream:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > int(cfg.get("max_file_bytes", 50 * 1024**3)):
                    raise HTTPException(413, "ファイルサイズの上限を超えています")
                stream.write(chunk)
        if size == 0:
            raise HTTPException(422, "空のファイルは受信できません")
        metadata.write_text(
            json.dumps(
                {
                    "file": target.name,
                    "original_name": original,
                    "title": title,
                    "size": size,
                    "user_id": user.user_id,
                    "group_id": user.group_id,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        temporary.replace(target)
    except Exception:
        temporary.unlink(missing_ok=True)
        metadata.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()
    return {"id": upload_id, "name": original, "size": size}
