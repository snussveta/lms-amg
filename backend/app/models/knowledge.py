from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), default="video", index=True, nullable=False)  # video, presentation, document, image, other
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[str] = mapped_column(String(100), default="Общий", index=True, nullable=False)

    # Access control: 'all' (everyone), 'department' (specific department/departments), 'users' (specific employees)
    access_type: Mapped[str] = mapped_column(String(50), default="all", index=True, nullable=False)
    accessible_departments: Mapped[Optional[str]] = mapped_column(Text, default="", nullable=True)  # JSON or comma-separated department names

    uploaded_by_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    uploaded_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[uploaded_by_id])

    downloads_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    views_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

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

    # User assignments for access_type == 'users'
    assigned_users: Mapped[List["KnowledgeFileAssignment"]] = relationship(
        "KnowledgeFileAssignment",
        back_populates="file",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<KnowledgeFile id={self.id} title='{self.title}' type={self.file_type} access_type={self.access_type}>"


class KnowledgeFileAssignment(Base):
    __tablename__ = "knowledge_file_assignments"
    __table_args__ = (
        UniqueConstraint("file_id", "user_id", name="uq_knowledge_file_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("knowledge_files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    file: Mapped["KnowledgeFile"] = relationship("KnowledgeFile", back_populates="assigned_users")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
