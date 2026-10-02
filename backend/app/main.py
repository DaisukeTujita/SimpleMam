from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import logging
from logging.handlers import RotatingFileHandler
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .auth import serializer
from .config import local_path, settings
from .db import engine
from .routers import auth, materials, programs, rundown, uploads


def configure_logging():
    folder = local_path(settings().logging.get("folder", "var/log"))
    folder.mkdir(parents=True, exist_ok=True)
    cutoff = datetime.now() - timedelta(days=30)
    for path in folder.glob("simplemam_*.log*"):
        if datetime.fromtimestamp(path.stat().st_mtime) < cutoff:
            path.unlink()
    handler = RotatingFileHandler(
        folder / f"simplemam_{datetime.now():%Y%m%d_%H%M%S}.log",
        maxBytes=1024 * 1024,
        backupCount=100,
        encoding="utf-8",
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logger = logging.getLogger("simplemam")
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return handler


@asynccontextmanager
async def lifespan(app):
    handler = configure_logging()
    logger = logging.getLogger("simplemam")
    stage = "session configuration"
    try:
        logger.info("SimpleMam 0.1.0 startup; configuration loaded; database=SQL Server")
        serializer()
        # Fail immediately if the real DB is unavailable. Never fall back to a demo DB.
        stage = "SQL Server connection"
        with engine().connect() as db:
            db.execute(text("SELECT 1"))
        for kind, prefix in (("thumbnail", "thumbnails"), ("hls", "hls")):
            stage = f"media.{kind}_root directory"
            app.mount(
                f"/media/{prefix}",
                StaticFiles(directory=local_path(settings().media[f"{kind}_root"]), check_dir=True),
                name=kind,
            )
        stage = "application runtime or shutdown"
        yield
    except Exception as exc:
        # The driver error can contain connection details. Log only its SQLSTATE here;
        # uvicorn's traceback is available in backend.stderr.log on the same machine.
        original = getattr(exc, "orig", None)
        args = getattr(original, "args", ())
        state = args[0] if args and isinstance(args[0], str) else "unknown"
        if len(state) != 5 or not state.isascii() or not state.isalnum():
            state = "unknown"
        logger.error(
            "Failed during %s (%s; SQLSTATE=%s). Details: var/log/backend.stderr.log.",
            stage,
            type(exc).__name__,
            state,
        )
        if state == "IM002":
            logger.error(
                "ODBC driver not found. Set [database].driver in simplemam.toml to the exact installed "
                "name, e.g. 'ODBC Driver 17 for SQL Server' when Driver 17 is installed. "
                "The example configuration selects Driver 18."
            )
        raise
    finally:
        if engine.cache_info().currsize:
            engine().dispose()
        logger.removeHandler(handler)
        handler.close()


app = FastAPI(title="SimpleMam API", version="0.1.0", lifespan=lifespan)
for router in (auth.router, materials.router, programs.router, rundown.router, uploads.router):
    app.include_router(router)


@app.middleware("http")
async def request_log(request: Request, call_next):
    request_id = uuid4().hex[:12]
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("X-SimpleMam-Request") != "1":
        return JSONResponse({"detail": "このリクエストは許可されていません"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    # Query strings can contain titles and user ids; only the path is recorded.
    if request.url.path.startswith("/api/"):
        logging.getLogger("simplemam.http").info(
            "%s %s %s request=%s", request.method, request.url.path, response.status_code, request_id
        )
    return response


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    # SQLAlchemy exceptions may include SQL/password bind values. Do not dump them.
    logging.getLogger("simplemam").error("Database operation failed (%s)", type(exc).__name__)
    return JSONResponse({"detail": "DB処理に失敗しました。ログとDBの定義を確認してください"}, status_code=503)


@app.get("/api/health")
def health():
    with engine().connect() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok", "version": "0.1.0"}
