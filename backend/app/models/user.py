from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.test import Test
    from app.models.attempt import Attempt
    from app.models.assignment import TestAssignment
    from app.models.course import CourseAssignment
    from app.models.department import Department


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="employee", nullable=False)  # superadmin, admin, employee
    branch: Mapped[Optional[str]] = mapped_column(String(100), default="AutoMall Центральный", nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), default="СТО", nullable=True)
    department_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    department_rel: Mapped[Optional["Department"]] = relationship(
        "Department",
        foreign_keys=[department_id],
        back_populates="users",
    )
    tests_created: Mapped[List["Test"]] = relationship("Test", back_populates="author", cascade="all, delete-orphan")
    attempts: Mapped[List["Attempt"]] = relationship("Attempt", back_populates="user", cascade="all, delete-orphan")
    assigned_tests: Mapped[List["TestAssignment"]] = relationship(
        "TestAssignment",
        foreign_keys="[TestAssignment.user_id]",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    assigned_courses: Mapped[List["CourseAssignment"]] = relationship(
        "CourseAssignment",
        foreign_keys="[CourseAssignment.user_id]",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
