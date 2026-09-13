from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class TestAssignRequest(BaseModel):
    user_ids: List[int] = Field(default_factory=list)
    assign_all: bool = False
    due_date: Optional[datetime] = None


class TestAssignmentItemResponse(BaseModel):
    id: int
    test_id: int
    user_id: int
    user_name: str
    user_email: str
    assigned_at: datetime
    due_date: Optional[datetime] = None
    status: str  # pending, in_progress, completed
    attempt_status: Optional[str] = None  # None, passed, failed, in_progress, needs_review
    score: Optional[int] = None
    max_score: Optional[int] = None
    percentage: Optional[float] = None

    model_config = {"from_attributes": True}


class TestAssignmentListResponse(BaseModel):
    test_id: int
    test_title: str
    total_assigned: int
    assignments: List[TestAssignmentItemResponse]
