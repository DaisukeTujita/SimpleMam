"""SQL Server only. Connections are opened per request and always closed."""

from functools import lru_cache
import logging
from time import perf_counter
from urllib.parse import quote_plus

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Connection

from .config import settings


def odbc_value(value: object) -> str:
    return "{" + str(value).replace("}", "}}") + "}"


@lru_cache
def engine():
    cfg = settings().database
    parts = [
        f"DRIVER={odbc_value(cfg.get('driver', 'ODBC Driver 18 for SQL Server'))}",
        f"SERVER={odbc_value(cfg['server'])}",
        f"DATABASE={odbc_value(cfg['name'])}",
    ]
    if cfg.get("trusted_connection", True):
        parts.append("Trusted_Connection=yes")
    else:
        parts.extend([f"UID={odbc_value(cfg['username'])}", f"PWD={odbc_value(cfg['password'])}"])
    parts.extend(
        [
            f"Encrypt={'yes' if cfg.get('encrypt', True) else 'no'}",
            f"TrustServerCertificate={'yes' if cfg.get('trust_server_certificate', False) else 'no'}",
            "Connection Timeout=10",
        ]
    )
    db = create_engine(
        "mssql+pyodbc:///?odbc_connect=" + quote_plus(";".join(parts)),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )

    @event.listens_for(db, "before_cursor_execute")
    def before(conn, cursor, statement, parameters, context, executemany):
        context.started = perf_counter()
        cursor.timeout = 30

    @event.listens_for(db, "after_cursor_execute")
    def after(conn, cursor, statement, parameters, context, executemany):
        # Do not log bind parameters: authentication statements include password data.
        logging.getLogger("simplemam.sql").info(
            "SQL %.1fms rows=%s", (perf_counter() - context.started) * 1000, cursor.rowcount
        )

    return db


def get_db():
    with engine().connect() as connection:
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def rows(db: Connection, sql: str, params: dict | None = None) -> list[dict]:
    from sqlalchemy import text

    return [dict(row) for row in db.execute(text(sql), params or {}).mappings()]
