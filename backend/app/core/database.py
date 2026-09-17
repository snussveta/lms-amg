import asyncio
import logging
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger(__name__)

# Declarative Base for SQLAlchemy 2.0 models
class Base(DeclarativeBase):
    pass


# Asynchronous Database Engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.ENVIRONMENT == "development"),
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Async Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db(max_retries: int = 15, delay: float = 2.0) -> None:
    """
    Waits for PostgreSQL connection to become available,
    tests connection, and creates database schema tables.
    """
    logger.info("Initializing database connection...")
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
                # Ensure all models are imported so Base.metadata is fully populated
                import app.models  # noqa: F401

                # Create all tables defined in models
                await conn.run_sync(Base.metadata.create_all)

                # Safe backward-compatible schema alterations for existing databases
                migration_sqls = [
                    "ALTER TABLE tests ADD COLUMN IF NOT EXISTS allow_guest BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE tests ADD COLUMN IF NOT EXISTS public_token VARCHAR(64);",
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_tests_public_token ON tests(public_token);",
                    "ALTER TABLE attempts ALTER COLUMN user_id DROP NOT NULL;",
                    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);",
                    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);",
                    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);",
                    "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS guest_session_token VARCHAR(100);",
                    "CREATE INDEX IF NOT EXISTS ix_attempts_guest_session_token ON attempts(guest_session_token);",
                    "ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS is_reviewed BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS reviewer_comment TEXT;",
                    "ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;",
                    "ALTER TABLE attempt_answers ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;",
                    "ALTER TABLE tests ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1;",
                    "ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_assigned_only BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE bank_questions ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'Общий';",
                    # Courses schema checks
                    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);",
                    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS department_tag VARCHAR(100) DEFAULT 'СТО';",
                    "ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;",
                    "ALTER TABLE user_lesson_progress ADD COLUMN IF NOT EXISTS last_timestamp_seconds DOUBLE PRECISION DEFAULT 0.0;",
                ]
                for stmt in migration_sqls:
                    try:
                        await conn.execute(text(stmt))
                    except Exception as migration_err:
                        logger.debug(f"Migration statement ignored/already applied: {stmt} ({migration_err})")


            logger.info("Successfully connected to PostgreSQL and initialized tables.")
            return
        except Exception as e:
            logger.warning(
                f"PostgreSQL connection attempt {attempt}/{max_retries} failed: {e}. "
                f"Retrying in {delay} seconds..."
            )
            if attempt == max_retries:
                logger.error("Could not connect to PostgreSQL after multiple attempts.")
                raise e
            await asyncio.sleep(delay)
