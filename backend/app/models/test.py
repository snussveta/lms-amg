from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.question import Question
    from app.models.attempt import Attempt
    from app.models.assignment import TestAssignment


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # None means unlimited
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    max_attempts: Mapped[Optional[int]] = mapped_column(Integer, default=1, nullable=True)  # 1 = retakes disallowed, None = unlimited
    is_assigned_only: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # True = only assigned employees, False = company-wide
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_guest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    public_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True, nullable=True)
    hide_from_heads: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_exam: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Shuffling (questions & options)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Employee Category Rating Fork
    category_rating_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    category_demote_threshold: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    category_promote_threshold: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
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
    author: Mapped[Optional["User"]] = relationship("User", back_populates="tests_created")
    questions: Mapped[List["Question"]] = relationship(
        "Question",
        back_populates="test",
        cascade="all, delete-orphan",
        order_by="Question.order",
    )
    attempts: Mapped[List["Attempt"]] = relationship(
        "Attempt",
        back_populates="test",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[List["TestAssignment"]] = relationship(
        "TestAssignment",
        back_populates="test",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Test id={self.id} title={self.title}>"
