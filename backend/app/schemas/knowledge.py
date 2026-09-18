from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class KnowledgeFileBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = ""
    file_type: str = Field(default="video")  # video, presentation, document, image, other
    department: str = Field(default="Общий")


class KnowledgeFileCreate(KnowledgeFileBase):
    file_name: str
    file_url: str
    file_size_bytes: int = 0
    mime_type: Optional[str] = None


class KnowledgeFileUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    file_type: Optional[str] = None


class KnowledgeFileResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    file_name: str
    file_url: str
    file_type: str
    file_size_bytes: int
    mime_type: Optional[str] = None
    department: str
    uploaded_by_id: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    downloads_count: int = 0
    views_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class KnowledgeStatsResponse(BaseModel):
    total_files: int = 0
    total_size_bytes: int = 0
    videos_count: int = 0
    presentations_count: int = 0
    documents_count: int = 0
    images_count: int = 0
