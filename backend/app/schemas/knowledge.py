from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class KnowledgeFileBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = ""
    file_type: str = Field(default="video")  # video, presentation, document, image, other
    department: str = Field(default="Общий")
    access_type: str = Field(default="all")  # all, department, users
    accessible_departments: Optional[str] = ""


class KnowledgeFileCreate(KnowledgeFileBase):
    file_name: str
    file_url: str
    file_size_bytes: int = 0
    mime_type: Optional[str] = None
    assigned_user_ids: Optional[List[int]] = []


class KnowledgeFileUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    file_type: Optional[str] = None
    access_type: Optional[str] = None
    accessible_departments: Optional[str] = None
    assigned_user_ids: Optional[List[int]] = None


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
    access_type: str = "all"
    accessible_departments: Optional[str] = ""
    assigned_user_ids: List[int] = []
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
