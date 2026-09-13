from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


# -----------------------------------------------------------------------------
# Options Schemas
# -----------------------------------------------------------------------------
class QuestionOptionCreate(BaseModel):
    id: Optional[int] = None
    text: str = Field(..., min_length=1)
    is_correct: bool = False


class QuestionOptionAdminResponse(BaseModel):
    id: int
    question_id: int
    text: str
    is_correct: bool

    model_config = {"from_attributes": True}


class QuestionOptionEmployeeResponse(BaseModel):
    """Sanitized option: strictly does NOT include is_correct field (Anti-Cheat)"""
    id: int
    question_id: int
    text: str

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# Questions Schemas
# -----------------------------------------------------------------------------
class QuestionCreate(BaseModel):
    id: Optional[int] = None
    text: str = Field(..., min_length=1)
    # single_choice, multiple_choice, manual_review, text
    question_type: str = Field(..., pattern="^(single_choice|multiple_choice|manual_review|text)$")
    points: int = Field(default=1, ge=1)
    order: int = Field(default=0, ge=0)
    options: List[QuestionOptionCreate] = []


class QuestionAdminResponse(BaseModel):
    id: int
    test_id: int
    text: str
    question_type: str
    points: int
    order: int
    options: List[QuestionOptionAdminResponse] = []

    model_config = {"from_attributes": True}


class QuestionEmployeeResponse(BaseModel):
    """Sanitized question for testing room: no correct answer indicators (Anti-Cheat)"""
    id: int
    test_id: int
    text: str
    question_type: str
    points: int
    order: int
    options: List[QuestionOptionEmployeeResponse] = []

    @model_validator(mode="after")
    def sanitize_text_options(self):
        # Anti-cheat: Never send accepted answers/keywords for text/manual questions to client
        if self.question_type in ["text", "manual_review"]:
            self.options = []
        return self

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# Tests Schemas
# -----------------------------------------------------------------------------
class TestBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = ""
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=1440)  # None = unlimited
    passing_score: int = Field(default=70, ge=0)
    max_attempts: Optional[int] = Field(default=1, ge=1)
    is_assigned_only: bool = True
    is_published: bool = True
    allow_guest: bool = False
    public_token: Optional[str] = None


class TestCreate(TestBase):
    questions: List[QuestionCreate] = []


class TestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    time_limit_minutes: Optional[int] = Field(None, ge=1, le=1440)
    passing_score: Optional[int] = Field(None, ge=0)
    max_attempts: Optional[int] = Field(None, ge=1)
    is_assigned_only: Optional[bool] = None
    is_published: Optional[bool] = None
    allow_guest: Optional[bool] = None
    public_token: Optional[str] = None
    questions: Optional[List[QuestionCreate]] = None


class TestListItemResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    time_limit_minutes: Optional[int] = None
    passing_score: int
    max_attempts: Optional[int] = 1
    is_assigned_only: bool = True
    is_published: bool
    allow_guest: bool = False
    public_token: Optional[str] = None
    question_count: int = 0
    total_points: int = 0
    created_at: datetime
    updated_at: datetime
    # Extra fields for employee catalog
    user_attempt_status: Optional[str] = None  # None, passed, failed, in_progress, needs_review
    user_best_score: Optional[int] = None
    can_attempt: bool = True
    user_attempt_id: Optional[int] = None
    # Assignment fields
    is_assigned: bool = False
    assignment_due_date: Optional[datetime] = None
    assignment_status: Optional[str] = None  # pending, in_progress, completed

    model_config = {"from_attributes": True}


class TestAdminResponse(TestBase):
    id: int
    author_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    questions: List[QuestionAdminResponse] = []
    total_points: int = 0

    model_config = {"from_attributes": True}


class TestEmployeeResponse(TestBase):
    id: int
    created_at: datetime
    questions: List[QuestionEmployeeResponse] = []
    total_points: int = 0

    model_config = {"from_attributes": True}


class PublicTestInfoResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = ""
    time_limit_minutes: Optional[int] = None
    passing_score: int
    question_count: int = 0
    total_points: int = 0
    public_token: str

    model_config = {"from_attributes": True}
