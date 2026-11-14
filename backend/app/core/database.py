import os
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, declarative_base

# SKYGUARD_DB_PATH lets tests and local development use a scratch database
# (e.g. a seeded demo DB) without touching the default skyguard.db.
DATABASE_PATH = Path(
    os.environ.get("SKYGUARD_DB_PATH")
    or Path(__file__).resolve().parents[2] / "skyguard.db"
)
DATABASE_URL = URL.create(
    "sqlite+aiosqlite",
    database=str(DATABASE_PATH),
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def init_db() -> None:
    from app.models.observation import Observation

    if Observation.__tablename__ not in Base.metadata.tables:
        raise RuntimeError("Observation table was not registered with SQLAlchemy metadata.")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        # Lightweight additive migration for databases created before the
        # Phase 0 columns existed: add any missing column, never drop or
        # rewrite data.
        await connection.run_sync(_add_missing_columns)


def _add_missing_columns(connection) -> None:
    from sqlalchemy import text

    existing = {
        row[1]
        for row in connection.execute(
            text("PRAGMA table_info(observations)")
        ).fetchall()
    }
    additions = {
        "observed_at": "ALTER TABLE observations ADD COLUMN observed_at VARCHAR",
        "raw_temperature": "ALTER TABLE observations ADD COLUMN raw_temperature FLOAT",
        "raw_pressure": "ALTER TABLE observations ADD COLUMN raw_pressure FLOAT",
        "raw_humidity": "ALTER TABLE observations ADD COLUMN raw_humidity FLOAT",
        "repaired_temperature": "ALTER TABLE observations ADD COLUMN repaired_temperature FLOAT",
        "repair_method": "ALTER TABLE observations ADD COLUMN repair_method VARCHAR",
    }
    for column, ddl in additions.items():
        if column not in existing:
            connection.execute(text(ddl))


async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session