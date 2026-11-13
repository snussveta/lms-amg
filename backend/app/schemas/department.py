from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DepartmentHeadInfo(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""
    head_id: Optional[int] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    head_id: Optional[int] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    users_count: int = 0
    head: Optional[DepartmentHeadInfo] = None

    model_config = {"from_attributes": True}


class DepartmentAssignHeadRequest(BaseModel):
    user_id: Optional[int] = None
