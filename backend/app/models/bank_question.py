from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class BankQuestion(Base):
    __tablename__ = "bank_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # single_choice, multiple_choice, text, manual_review
    question_type: Mapped[str] = mapped_column(String(50), nullable=False)
    department: Mapped[str] = mapped_column(String(100), default="Общий", nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
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
    options: Mapped[List["BankQuestionOption"]] = relationship(
        "BankQuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="BankQuestionOption.id",
    )

    def __repr__(self) -> str:
        return f"<BankQuestion id={self.id} department={self.department} type={self.question_type}>"


class BankQuestionOption(Base):
    __tablename__ = "bank_question_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    bank_question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("bank_questions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    question: Mapped["BankQuestion"] = relationship("BankQuestion", back_populates="options")

    def __repr__(self) -> str:
        return f"<BankQuestionOption id={self.id} correct={self.is_correct}>"
