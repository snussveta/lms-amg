from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BankOptionCreate(BaseModel):
    id: Optional[int] = None
    text: str = Field(..., min_length=1)
    is_correct: bool = False


class BankOptionResponse(BaseModel):
    id: int
    bank_question_id: int
    text: str
    is_correct: bool

    model_config = {"from_attributes": True}


class BankQuestionCreate(BaseModel):
    text: str = Field(..., min_length=1)
    question_type: str = Field(..., pattern="^(single_choice|multiple_choice|manual_review|text)$")
    department: str = Field(default="Общий", min_length=1, max_length=100)
    points: int = Field(default=10, ge=1)
    options: List[BankOptionCreate] = []


class BankQuestionUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[str] = Field(None, pattern="^(single_choice|multiple_choice|manual_review|text)$")
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    points: Optional[int] = Field(None, ge=1)
    options: Optional[List[BankOptionCreate]] = None


class BankQuestionResponse(BaseModel):
    id: int
    text: str
    question_type: str
    department: str
    points: int
    created_at: datetime
    updated_at: datetime
    options: List[BankOptionResponse] = []

    model_config = {"from_attributes": True}
