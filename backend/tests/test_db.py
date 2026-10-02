"""Exercise SQLAlchemy events without a database or an ODBC driver installation."""

from types import SimpleNamespace

from sqlalchemy.engine import Engine, make_url
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.pool import QueuePool

from app import db


class Cursor:
    # Like pyodbc.Cursor, this object has no writable timeout attribute.
    __slots__ = ()
    description = [("value", None, None, None, None, None, None)]
    rowcount = 1

    def execute(self, statement, parameters):
        pass

    def fetchone(self):
        return (1,)

    def close(self):
        pass


class Connection:
    def __init__(self):
        self.timeout = 0
        self.cursor_timeouts = []

    def cursor(self):
        self.cursor_timeouts.append(self.timeout)
        return Cursor()

    def rollback(self):
        pass

    def close(self):
        pass


def test_query_timeout_is_applied_before_creating_cursors_and_survives_pool_reuse(monkeypatch, caplog):
    connections = []

    def connect():
        connection = Connection()
        connections.append(connection)
        return connection

    def create(url, **options):
        assert options["hide_parameters"] is True
        assert make_url(url).drivername == "mssql+pyodbc"
        assert "DRIVER={ODBC Driver 17 for SQL Server}" in make_url(url).query["odbc_connect"]
        dialect = DefaultDialect(dbapi=SimpleNamespace(paramstyle="named", Error=RuntimeError))
        return Engine(QueuePool(connect), dialect, make_url(url))

    monkeypatch.setattr(db, "create_engine", create)
    monkeypatch.setattr(
        db,
        "settings",
        lambda: SimpleNamespace(
            database={
                "server": "localhost",
                "name": "MAM",
                "driver": "ODBC Driver 17 for SQL Server",
            }
        ),
    )
    db.engine.cache_clear()
    engine = db.engine()
    try:
        with caplog.at_level("INFO", logger="simplemam.sql"):
            # Two requests reuse one pooled connection and create separate cursors.
            for _ in range(2):
                with engine.connect() as connection:
                    assert connection.exec_driver_sql("SELECT 1").scalar() == 1
        assert len(connections) == 1
        assert connections[0].cursor_timeouts == [30, 30]
        assert len(caplog.records) == 2
        assert all("rows=1" in record.message for record in caplog.records)
    finally:
        engine.dispose()
        db.engine.cache_clear()
