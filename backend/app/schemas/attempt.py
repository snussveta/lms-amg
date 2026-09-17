from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.test import TestEmployeeResponse


class AttemptStartResponse(BaseModel):
    attempt_id: int
    test: TestEmployeeResponse
    started_at: datetime
    expires_at: Optional[datetime] = None


class GuestAttemptStartRequest(BaseModel):
    guest_name: str = Field(..., min_length=2, max_length=255)
    guest_email: Optional[str] = Field(None, max_length=255)
    guest_phone: Optional[str] = Field(None, max_length=50)


class GuestAttemptStartResponse(BaseModel):
    attempt_id: int
    guest_session_token: str
    test: TestEmployeeResponse
    started_at: datetime
    expires_at: Optional[datetime] = None


class AnswerSubmitItem(BaseModel):
    question_id: int
    selected_option_ids: Optional[List[int]] = []
    text_answer: Optional[str] = None
    answer_text: Optional[str] = None


class AttemptSubmitRequest(BaseModel):
    answers: List[AnswerSubmitItem]


class ManualAnswerReviewItem(BaseModel):
    question_id: int
    points_awarded: int = Field(..., ge=0)
    reviewer_comment: Optional[str] = None


class AttemptManualReviewRequest(BaseModel):
    reviews: List[ManualAnswerReviewItem]


class AttemptAnswerDetailResponse(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    points_max: int
    points_awarded: int
    is_correct: bool
    is_reviewed: bool = True
    reviewer_comment: Optional[str] = None
    user_selected_option_ids: List[int] = []
    user_text_answer: Optional[str] = None
    correct_option_ids: List[int] = []
    correct_option_texts: List[str] = []


class AttemptResultResponse(BaseModel):
    id: int
    test_id: int
    test_title: str
    status: str  # in_progress, needs_review, submitted, timed_out
    score: int
    max_score: int
    percentage: float
    passing_score: int
    is_passed: bool
    is_guest: bool = False
    guest_name: Optional[str] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    answers: List[AttemptAnswerDetailResponse] = []

    model_config = {"from_attributes": True}


class AttemptListItemResponse(BaseModel):
    id: int
    test_id: int
    test_title: str
    score: int
    max_score: int
    percentage: float
    is_passed: bool
    status: str
    is_guest: bool = False
    guest_name: Optional[str] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
