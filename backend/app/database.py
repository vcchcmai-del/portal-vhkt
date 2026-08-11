"""Kết nối CSDL an toàn cho môi trường PaaS.

- Ưu tiên PostgreSQL nếu DATABASE_URL được cấu hình.
- Nếu không có, dùng SQLite với WAL + busy_timeout và NullPool.
- Mỗi request dùng một Session riêng; commit được retry khi SQLite đang bận.
"""
import os
import time
import logging

from sqlalchemy import create_engine, event
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session

log = logging.getLogger("portal.database")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
REQUIRE_POSTGRES = os.getenv("REQUIRE_POSTGRES", "0").lower() in {"1", "true", "yes", "on"}

if not DATABASE_URL and REQUIRE_POSTGRES:
    raise RuntimeError("DATABASE_URL chưa được cấu hình. Production phải dùng PostgreSQL; không tự rơi về SQLite.")

if not DATABASE_URL:
    data_dir = os.getenv("DATA_DIR", os.path.join(os.getcwd(), "data"))
    os.makedirs(data_dir, exist_ok=True)
    DATABASE_URL = "sqlite:///" + os.path.join(data_dir, "portal.db")
    print(f"DATABASE_URL chưa đặt — dùng SQLite tại: {data_dir}/portal.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    # NullPool tránh giữ connection SQLite lâu giữa các request/container.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        poolclass=__import__("sqlalchemy.pool", fromlist=["NullPool"]).NullPool,
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _connection_record):
        cur = dbapi_conn.cursor()
        try:
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA synchronous=NORMAL")
            cur.execute("PRAGMA busy_timeout=30000")
            cur.execute("PRAGMA foreign_keys=ON")
        finally:
            cur.close()
else:
    # PostgreSQL là CSDL production khuyến nghị. Pool chủ động giữ kết nối
    # vừa phải, kiểm tra kết nối trước khi dùng và tự thu hồi kết nối cũ.
    # Điều này tránh lỗi 500/502 do connection chết sau một thời gian idle.
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
        pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
        pool_use_lifo=True,
        connect_args={
            "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
    )


class ResilientSession(Session):
    """Retry commit ngắn khi SQLite trả SQLITE_BUSY/locked."""
    def commit(self):
        attempts = 4 if IS_SQLITE else 1
        delay = 0.25
        for i in range(attempts):
            try:
                return super().commit()
            except OperationalError as exc:
                text = str(exc).lower()
                locked = "database is locked" in text or "database table is locked" in text
                if not locked or i == attempts - 1:
                    self.rollback()
                    raise
                self.rollback()
                time.sleep(delay)
                delay *= 2


SessionLocal = sessionmaker(
    bind=engine,
    class_=ResilientSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
