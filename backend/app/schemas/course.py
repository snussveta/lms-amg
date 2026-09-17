from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field


# --- Lesson Schemas ---
class CourseLessonBase(BaseModel):
    title: str = Field(..., max_length=255)
    order_index: int = 0
    lesson_type: str = Field(default="article")  # article, video, presentation, quiz
    content_json: Optional[str] = "[]"
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    quiz_id: Optional[int] = None


class CourseLessonCreate(CourseLessonBase):
    pass


class CourseLessonUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None
    lesson_type: Optional[str] = None
    content_json: Optional[str] = None
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    quiz_id: Optional[int] = None


class CourseLessonResponse(CourseLessonBase):
    id: int
    module_id: int
    quiz_title: Optional[str] = None
    quiz_passing_score: Optional[int] = None

    class Config:
        from_attributes = True


# --- Module Schemas ---
class CourseModuleBase(BaseModel):
    title: str = Field(..., max_length=255)
    order_index: int = 0


class CourseModuleCreate(CourseModuleBase):
    pass


class CourseModuleUpdate(BaseModel):
    title: Optional[str] = None
    order_index: Optional[int] = None


class CourseModuleResponse(CourseModuleBase):
    id: int
    course_id: int
    lessons: List[CourseLessonResponse] = []

    class Config:
        from_attributes = True


# --- Course Schemas ---
class CourseBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = ""
    department_tag: str = Field(default="СТО")
    cover_image_url: Optional[str] = None
    is_published: bool = False


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    department_tag: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_published: Optional[bool] = None


class CourseListItemResponse(CourseBase):
    id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    modules_count: int = 0
    lessons_count: int = 0
    created_at: datetime
    updated_at: datetime
    # Employee-specific enrollment fields
    user_status: Optional[str] = None  # not_started, in_progress, completed
    user_progress_percent: Optional[int] = 0

    class Config:
        from_attributes = True


class CourseDetailResponse(CourseBase):
    id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    modules: List[CourseModuleResponse] = []

    class Config:
        from_attributes = True


# --- Progress & Learn Player Schemas ---
class LessonProgressUpdate(BaseModel):
    status: Optional[str] = None  # in_progress, completed
    last_timestamp_seconds: Optional[float] = None  # Current playback offset in seconds


class CourseLearnLessonItem(BaseModel):
    id: int
    module_id: int
    title: str
    order_index: int
    lesson_type: str
    content_json: Optional[str] = None
    file_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    quiz_id: Optional[int] = None
    quiz_title: Optional[str] = None
    quiz_passing_score: Optional[int] = None
    quiz_has_passed: bool = False
    
    # Progress & lock status
    status: str = "not_started"  # not_started, in_progress, completed
    last_timestamp_seconds: float = 0.0
    is_locked: bool = False  # True if previous step not completed!


class CourseLearnModuleItem(BaseModel):
    id: int
    title: str
    order_index: int
    lessons: List[CourseLearnLessonItem] = []


class CourseLearnResponse(BaseModel):
    course_id: int
    title: str
    description: Optional[str] = ""
    department_tag: str
    total_lessons: int
    completed_lessons: int
    progress_percent: int
    modules: List[CourseLearnModuleItem] = []
    current_lesson_id: Optional[int] = None


# --- Reorder Schema ---
class LessonReorderItem(BaseModel):
    id: int
    order_index: int
    module_id: int


class ModuleReorderItem(BaseModel):
    id: int
    order_index: int


class CourseReorderRequest(BaseModel):
    modules: List[ModuleReorderItem] = []
    lessons: List[LessonReorderItem] = []
