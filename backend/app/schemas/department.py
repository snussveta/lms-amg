from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    users_count: int = 0

    model_config = {"from_attributes": True}

