from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from time import perf_counter
import traceback
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
    request.state.request_id = request_id
    started = perf_counter()
    logger = logging.getLogger("simplemam.http")
    is_api = request.url.path.startswith("/api/")
    context = f"request={request_id} {request.method} {request.url.path}"
    # Query strings, request bodies and cookies are intentionally omitted.
    if is_api:
        logger.info("RECEIVE %s", context)
    try:
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("X-SimpleMam-Request") != "1":
            response = JSONResponse({"detail": "このリクエストは許可されていません"}, status_code=403)
        else:
            response = await call_next(request)
    except Exception as exc:
        if is_api:
            logger.error(
                "ERROR %s status=500 elapsed_ms=%.1f exception=%s location=%s",
                context, (perf_counter() - started) * 1000, type(exc).__name__, error_location(exc),
            )
        raise
    response.headers["X-Request-Id"] = request_id
    if is_api:
        logger.info(
            "RESPONSE %s status=%s elapsed_ms=%.1f",
            context, response.status_code, (perf_counter() - started) * 1000,
        )
    return response


def error_location(exc):
    # Record application file/line/function, without source lines or local variables.
    folder = Path(__file__).resolve().parent
    frames = [
        f"{Path(frame.filename).relative_to(folder)}:{frame.lineno} ({frame.name})"
        for frame in traceback.extract_tb(exc.__traceback__)
        if Path(frame.filename).is_relative_to(folder)
    ]
    return " -> ".join(frames) or "unavailable"


@app.exception_handler(SQLAlchemyError)
async def database_error(request, exc):
    request_id = getattr(request.state, "request_id", "unknown")
    original = getattr(exc, "orig", None)
    args = getattr(original, "args", ())
    state = args[0] if args and isinstance(args[0], str) else "unknown"
    if len(state) != 5 or not state.isascii() or not state.isalnum():
        state = "unknown"

    def safe_text(value):
        value = str(value)
        password = settings().database.get("password", "")
        if password:
            value = value.replace(password, "[REDACTED]")
        return " ".join(value.split())[:8000]

    # Avoid str(exc): SQLAlchemy exceptions may include all bound parameter values.
    message = original if original is not None else (exc.args[0] if exc.args else type(exc).__name__)
    logging.getLogger("simplemam").error(
        "Database operation failed request=%s %s %s exception=%s SQLSTATE=%s\n"
        "Driver error: %s\nSQL: %s\nLocation: %s",
        request_id, request.method, request.url.path, type(exc).__name__, state,
        safe_text(message), safe_text(getattr(exc, "statement", None) or "unavailable"), error_location(exc),
    )
    return JSONResponse(
        {"detail": "DB処理に失敗しました。ログとDBの定義を確認してください", "request_id": request_id},
        status_code=503,
    )


@app.get("/api/health")
def health():
    with engine().connect() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok", "version": "0.1.0"}
