from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, computed_field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None


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


class UserAdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = Field(None, pattern="^(superadmin|admin|department_head|employee)$")
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None


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
