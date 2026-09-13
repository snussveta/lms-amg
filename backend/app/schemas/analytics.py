from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class TestAnalyticsSummary(BaseModel):
    total_attempts: int
    passed_attempts: int
    failed_attempts: int
    needs_review_attempts: int = 0
    pass_rate: float
    average_score: float
    max_possible_points: int


class AttemptAdminDetail(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: str
    user_email: str
    is_guest: bool = False
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    guest_phone: Optional[str] = None
    score: int
    max_score: int
    percentage: float
    is_passed: bool
    status: str
    needs_review: bool = False
    unreviewed_count: int = 0
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None

    model_config = {"from_attributes": True}


class TestAnalyticsResponse(BaseModel):
    test_id: int
    test_title: str
    summary: TestAnalyticsSummary
    attempts: List[AttemptAdminDetail]
