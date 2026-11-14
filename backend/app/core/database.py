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
                    # Departments table
                    """CREATE TABLE IF NOT EXISTS departments (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) UNIQUE NOT NULL,
                        description TEXT DEFAULT '',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        head_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_departments_name ON departments(name);",
                    "ALTER TABLE departments ADD COLUMN IF NOT EXISTS head_id INTEGER REFERENCES users(id) ON DELETE SET NULL;",
                    "CREATE INDEX IF NOT EXISTS ix_departments_head_id ON departments(head_id);",
                    # Users branch, department & department_id
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);",
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;",
                    "CREATE INDEX IF NOT EXISTS ix_users_department_id ON users(department_id);",
                    # Courses schema checks
                    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);",
                    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS department_tag VARCHAR(100);",
                    "ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;",
                    "ALTER TABLE user_lesson_progress ADD COLUMN IF NOT EXISTS last_timestamp_seconds DOUBLE PRECISION DEFAULT 0.0;",
                    # Course Assignments table
                    """CREATE TABLE IF NOT EXISTS course_assignments (
                        id SERIAL PRIMARY KEY,
                        course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        deadline TIMESTAMP WITH TIME ZONE,
                        is_completed BOOLEAN DEFAULT FALSE NOT NULL,
                        CONSTRAINT uq_course_user_assignment UNIQUE (course_id, user_id)
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_course_assignments_course_id ON course_assignments(course_id);",
                    "CREATE INDEX IF NOT EXISTS ix_course_assignments_user_id ON course_assignments(user_id);",
                    # Knowledge Files table
                    """CREATE TABLE IF NOT EXISTS knowledge_files (
                        id SERIAL PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        description TEXT DEFAULT '',
                        file_name VARCHAR(255) NOT NULL,
                        file_url VARCHAR(500) NOT NULL,
                        file_type VARCHAR(50) DEFAULT 'video' NOT NULL,
                        file_size_bytes BIGINT DEFAULT 0 NOT NULL,
                        mime_type VARCHAR(100),
                        department VARCHAR(100) DEFAULT 'Общий' NOT NULL,
                        uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        downloads_count INTEGER DEFAULT 0 NOT NULL,
                        views_count INTEGER DEFAULT 0 NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_files_title ON knowledge_files(title);",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_files_file_type ON knowledge_files(file_type);",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_files_department ON knowledge_files(department);",
                    "ALTER TABLE knowledge_files ADD COLUMN IF NOT EXISTS access_type VARCHAR(50) DEFAULT 'all';",
                    "ALTER TABLE knowledge_files ADD COLUMN IF NOT EXISTS accessible_departments TEXT DEFAULT '';",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_files_access_type ON knowledge_files(access_type);",
                    # Knowledge File User Assignments table
                    """CREATE TABLE IF NOT EXISTS knowledge_file_assignments (
                        id SERIAL PRIMARY KEY,
                        file_id INTEGER NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        CONSTRAINT uq_knowledge_file_user UNIQUE (file_id, user_id)
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_file_assignments_file_id ON knowledge_file_assignments(file_id);",
                    "CREATE INDEX IF NOT EXISTS ix_knowledge_file_assignments_user_id ON knowledge_file_assignments(user_id);",
                    # Auto-publish any courses or tests that have active assignments
                    "UPDATE courses SET is_published = TRUE WHERE id IN (SELECT DISTINCT course_id FROM course_assignments);",
                    "UPDATE tests SET is_published = TRUE WHERE id IN (SELECT DISTINCT test_id FROM test_assignments);",
                    # Default courses to assigned-only (is_public = FALSE) so unassigned employees do not see them
                    "ALTER TABLE courses ALTER COLUMN is_public SET DEFAULT FALSE;",
                    "UPDATE courses SET is_public = FALSE WHERE is_public IS NULL OR is_public = TRUE;",
                    # Exam Sessions table
                    """CREATE TABLE IF NOT EXISTS exam_sessions (
                        id SERIAL PRIMARY KEY,
                        test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
                        creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        title VARCHAR(255) NOT NULL,
                        pin_code VARCHAR(10) NOT NULL,
                        session_token VARCHAR(64) UNIQUE NOT NULL,
                        status VARCHAR(50) DEFAULT 'waiting' NOT NULL,
                        time_limit_minutes INTEGER DEFAULT 30 NOT NULL,
                        passing_score INTEGER DEFAULT 70 NOT NULL,
                        shuffle_questions BOOLEAN DEFAULT TRUE NOT NULL,
                        shuffle_options BOOLEAN DEFAULT TRUE NOT NULL,
                        started_at TIMESTAMP WITH TIME ZONE,
                        ended_at TIMESTAMP WITH TIME ZONE,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_exam_sessions_pin_code ON exam_sessions(pin_code);",
                    "CREATE INDEX IF NOT EXISTS ix_exam_sessions_status ON exam_sessions(status);",
                    "CREATE INDEX IF NOT EXISTS ix_exam_sessions_test_id ON exam_sessions(test_id);",
                    # Exam Participants table
                    """CREATE TABLE IF NOT EXISTS exam_participants (
                        id SERIAL PRIMARY KEY,
                        session_id INTEGER NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        guest_name VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'waiting' NOT NULL,
                        current_question_index INTEGER DEFAULT 0 NOT NULL,
                        progress_percent INTEGER DEFAULT 0 NOT NULL,
                        tab_switches_count INTEGER DEFAULT 0 NOT NULL,
                        score FLOAT DEFAULT 0.0 NOT NULL,
                        points_earned INTEGER DEFAULT 0 NOT NULL,
                        total_points INTEGER DEFAULT 0 NOT NULL,
                        passed BOOLEAN DEFAULT FALSE NOT NULL,
                        attempt_id INTEGER REFERENCES attempts(id) ON DELETE SET NULL,
                        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        finished_at TIMESTAMP WITH TIME ZONE
                    );""",
                    "CREATE INDEX IF NOT EXISTS ix_exam_participants_session_id ON exam_participants(session_id);",
                    "CREATE INDEX IF NOT EXISTS ix_exam_participants_user_id ON exam_participants(user_id);",
                    "CREATE INDEX IF NOT EXISTS ix_exam_participants_status ON exam_participants(status);",
                    # Anti-cheat custom controls
                    "ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS detect_tab_switches BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS detect_right_clicks BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS block_copy_paste BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE exam_participants ADD COLUMN IF NOT EXISTS right_clicks_count INTEGER DEFAULT 0;",
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
