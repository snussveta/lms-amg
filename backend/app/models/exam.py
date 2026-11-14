from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.test import Test
    from app.models.user import User
    from app.models.attempt import Attempt


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    creator_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    pin_code: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    session_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    # Status: 'waiting', 'in_progress', 'completed', 'cancelled'
    status: Mapped[str] = mapped_column(String(50), default="waiting", nullable=False, index=True)
    
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    test: Mapped["Test"] = relationship("Test")
    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[creator_id])
    participants: Mapped[List["ExamParticipant"]] = relationship(
        "ExamParticipant",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ExamParticipant.joined_at",
    )

    def __repr__(self) -> str:
        return f"<ExamSession id={self.id} pin={self.pin_code} status={self.status}>"


class ExamParticipant(Base):
    __tablename__ = "exam_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    guest_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Status: 'waiting', 'taking', 'submitted', 'disqualified'
    status: Mapped[str] = mapped_column(String(50), default="waiting", nullable=False, index=True)
    
    current_question_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tab_switches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    points_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    attempt_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("attempts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="participants")
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    attempt: Mapped[Optional["Attempt"]] = relationship("Attempt", foreign_keys=[attempt_id])

    def __repr__(self) -> str:
        return f"<ExamParticipant id={self.id} session_id={self.session_id} status={self.status}>"
