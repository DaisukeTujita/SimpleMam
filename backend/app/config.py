"""One TOML file; no adapter, environment fallback database, or demo mode."""

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database: dict
    auth: dict
    media: dict
    upload: dict
    server: dict
    logging: dict


@lru_cache
def settings() -> Settings:
    path = Path(os.environ.get("SIMPLEMAM_CONFIG", str(ROOT / "simplemam.toml")))
    with path.open("rb") as stream:
        data = tomllib.load(stream)
    result = Settings(**{name: data[name] for name in Settings.__dataclass_fields__})
    if not result.database.get("server") or not result.database.get("name"):
        raise ValueError("[database] server and name are required")
    if result.auth.get("password_format", "plain") not in ("plain", "double_md5"):
        raise ValueError("[auth] password_format must be plain or double_md5")
    if not 1 <= int(result.auth.get("session_hours", 8)) <= 24:
        raise ValueError("[auth] session_hours must be between 1 and 24")
    for kind in ("thumbnail", "hls"):
        if not result.media.get(f"{kind}_root"):
            raise ValueError(f"[media] {kind}_root is required")
        filename = result.media.get(f"{kind}_file", "")
        if not filename or "/" in filename or "\\" in filename or filename in (".", ".."):
            raise ValueError(f"[media] {kind}_file must be a filename")
    return result


def local_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path
