from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, computed_field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    category: int = Field(default=1, ge=1, le=4)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "employee"


class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="employee", pattern="^(superadmin|admin|department_head|employee)$")
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    category: int = Field(default=1, ge=1, le=4)


class UserAdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = Field(None, pattern="^(superadmin|admin|department_head|employee)$")
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None
    category: Optional[int] = Field(None, ge=1, le=4)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdateRole(BaseModel):
    role: str = Field(..., pattern="^(superadmin|admin|department_head|employee)$")


class NotificationSettingsUpdate(BaseModel):
    notify_email: Optional[bool] = None
    notify_telegram: Optional[bool] = None


class TelegramLinkCodeResponse(BaseModel):
    code: str
    bot_username: Optional[str] = None
    deep_link: Optional[str] = None
    expires_in_seconds: int = 900


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    telegram_chat_id: Optional[str] = None
    telegram_username: Optional[str] = None
    notify_email: bool = True
    notify_telegram: bool = True
    created_at: datetime

    @computed_field
    @property
    def telegram_connected(self) -> bool:
        return bool(self.telegram_chat_id)

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class UserCourseStatItem(BaseModel):
    course_id: int
    title: str
    cover_image_url: Optional[str] = None
    status: str  # not_started, in_progress, completed
    progress_percent: int = 0
    enrolled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    total_lessons: int = 0
    completed_lessons: int = 0


class UserTestStatItem(BaseModel):
    attempt_id: int
    test_id: int
    test_title: str
    status: str  # submitted, in_progress, needs_review, timed_out
    score: int = 0
    max_score: int = 0
    percentage: float = 0.0
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None


class UserAttestationStatItem(BaseModel):
    attempt_id: int
    test_id: int
    test_title: str
    status: str  # submitted, in_progress, needs_review, timed_out
    score: int = 0
    max_score: int = 0
    percentage: float = 0.0
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    category_before: Optional[int] = None
    category_after: Optional[int] = None
    category_action: Optional[str] = None  # promoted, demoted, retained, None


class UserStatisticsSummary(BaseModel):
    total_courses: int = 0
    completed_courses: int = 0
    in_progress_courses: int = 0
    total_tests: int = 0
    total_attestations: int = 0
    current_category: int = 1


class UserFullStatisticsResponse(BaseModel):
    user: UserResponse
    summary: UserStatisticsSummary
    courses: List[UserCourseStatItem] = []
    tests: List[UserTestStatItem] = []
    attestations: List[UserAttestationStatItem] = []
