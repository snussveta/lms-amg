from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    branch: Optional[str] = "AutoMall Центральный"
    department: Optional[str] = "СТО"
    department_id: Optional[int] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)
    role: Optional[str] = "employee"


class UserAdminCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="employee", pattern="^(superadmin|admin|employee)$")
    branch: Optional[str] = "AutoMall Центральный"
    department: Optional[str] = "СТО"
    department_id: Optional[int] = None


class UserAdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = Field(None, pattern="^(superadmin|admin|employee)$")
    branch: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdateRole(BaseModel):
    role: str = Field(..., pattern="^(superadmin|admin|employee)$")


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None
