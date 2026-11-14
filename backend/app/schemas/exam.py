from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ExamSessionCreate(BaseModel):
    test_id: int
    title: str = Field(..., min_length=2, max_length=255)
    time_limit_minutes: Optional[int] = Field(default=30, ge=1, le=1440)
    passing_score: Optional[int] = Field(default=70, ge=0, le=100)
    shuffle_questions: Optional[bool] = True
    shuffle_options: Optional[bool] = True
    detect_tab_switches: Optional[bool] = True
    detect_right_clicks: Optional[bool] = True
    block_copy_paste: Optional[bool] = True


class ExamParticipantResponse(BaseModel):
    id: int
    session_id: int
    user_id: Optional[int] = None
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    status: str
    current_question_index: int = 0
    progress_percent: int = 0
    tab_switches_count: int = 0
    right_clicks_count: int = 0
    score: float = 0.0
    points_earned: int = 0
    total_points: int = 0
    passed: bool = False
    attempt_id: Optional[int] = None
    joined_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExamSessionDetailResponse(BaseModel):
    id: int
    test_id: int
    test_title: str
    title: str
    pin_code: str
    session_token: str
    status: str
    time_limit_minutes: int
    passing_score: int
    shuffle_questions: bool
    shuffle_options: bool
    detect_tab_switches: bool = True
    detect_right_clicks: bool = True
    block_copy_paste: bool = True
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    creator_name: Optional[str] = None
    participants_count: int = 0
    participants: List[ExamParticipantResponse] = []

    class Config:
        from_attributes = True


class ExamJoinRequest(BaseModel):
    pin_code: Optional[str] = None
    session_token: Optional[str] = None
    guest_name: Optional[str] = None


class ExamProgressReport(BaseModel):
    participant_id: int
    current_question_index: int = 0
    progress_percent: int = 0
    switched_tab: bool = False
    right_clicked: bool = False


class ExamAnswerItem(BaseModel):
    question_id: int
    selected_option_ids: List[int] = []
    text_answer: Optional[str] = None


class ExamSubmitRequest(BaseModel):
    participant_id: int
    answers: List[ExamAnswerItem] = []
