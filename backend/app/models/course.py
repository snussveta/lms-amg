from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.test import Test


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)
    department_tag: Mapped[str] = mapped_column(String(100), default="СТО", index=True, nullable=False)
    cover_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    author_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    author: Mapped[Optional["User"]] = relationship("User", foreign_keys=[author_id])
    modules: Mapped[List["CourseModule"]] = relationship(
        "CourseModule",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseModule.order_index",
    )
    enrollments: Mapped[List["UserCourseEnrollment"]] = relationship(
        "UserCourseEnrollment",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[List["CourseAssignment"]] = relationship(
        "CourseAssignment",
        back_populates="course",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Course id={self.id} title='{self.title}' department='{self.department_tag}'>"


class CourseModule(Base):
    __tablename__ = "course_modules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="modules")
    lessons: Mapped[List["CourseLesson"]] = relationship(
        "CourseLesson",
        back_populates="module",
        cascade="all, delete-orphan",
        order_by="CourseLesson.order_index",
    )

    def __repr__(self) -> str:
        return f"<CourseModule id={self.id} course_id={self.course_id} title='{self.title}'>"


class CourseLesson(Base):
    __tablename__ = "course_lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(Integer, ForeignKey("course_modules.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lesson_type: Mapped[str] = mapped_column(String(50), default="article", nullable=False)  # article, video, presentation, quiz
    
    # Structured JSON text content for longreads (headings, formatted text, regulations callouts, auto parts illustrations)
    content_json: Mapped[Optional[str]] = mapped_column(Text, default="[]", nullable=True)
    
    # Stored media file reference (MP4/MKV video or PDF presentation)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    
    # Direct reference to existing Quiz / Test in database
    quiz_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("tests.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    module: Mapped["CourseModule"] = relationship("CourseModule", back_populates="lessons")
    quiz: Mapped[Optional["Test"]] = relationship("Test", foreign_keys=[quiz_id])
    progress_records: Mapped[List["UserLessonProgress"]] = relationship(
        "UserLessonProgress",
        back_populates="lesson",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<CourseLesson id={self.id} title='{self.title}' type={self.lesson_type}>"


class UserCourseEnrollment(Base):
    __tablename__ = "user_course_enrollments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    course_id: Mapped[int] = mapped_column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="not_started", nullable=False)  # not_started, in_progress, completed
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    course: Mapped["Course"] = relationship("Course", back_populates="enrollments")

    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_user_course_enrollment"),
    )

    def __repr__(self) -> str:
        return f"<UserCourseEnrollment user_id={self.user_id} course_id={self.course_id} status={self.status}>"


class UserLessonProgress(Base):
    __tablename__ = "user_lesson_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    lesson_id: Mapped[int] = mapped_column(Integer, ForeignKey("course_lessons.id", ondelete="CASCADE"), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="not_started", nullable=False)  # not_started, in_progress, completed
    
    # Track playback second for 5+ hour lectures (allows resuming right where employee stopped)
    last_timestamp_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User")
    lesson: Mapped["CourseLesson"] = relationship("CourseLesson", back_populates="progress_records")

    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_progress"),
    )

    def __repr__(self) -> str:
        return f"<UserLessonProgress user_id={self.user_id} lesson_id={self.lesson_id} status={self.status} timestamp={self.last_timestamp_seconds}>"


class CourseAssignment(Base):
    __tablename__ = "course_assignments"
    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_course_user_assignment"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="assignments")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="assigned_courses")
    assigned_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_by_id])

    def __repr__(self) -> str:
        return f"<CourseAssignment id={self.id} course_id={self.course_id} user_id={self.user_id} is_completed={self.is_completed}>"

