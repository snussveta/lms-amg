from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.bank_question import BankQuestion, BankQuestionOption
from app.models.user import User
from app.schemas.bank_question import (
    BankQuestionCreate,
    BankQuestionResponse,
    BankQuestionUpdate,
)

router = APIRouter(prefix="/bank-questions", tags=["Question Bank"])

DEFAULT_DEPARTMENTS = ["Общий", "Бухгалтерия", "Продажи", "IT", "Логистика"]


@router.get("/departments", response_model=List[str])
async def get_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список всех отделов / направлений для категоризации вопросов."""
    stmt = select(distinct(BankQuestion.department))
    res = await db.execute(stmt)
    db_deps = [d for (d,) in res.all() if d]

    all_deps = list(dict.fromkeys(DEFAULT_DEPARTMENTS + db_deps))
    return all_deps


@router.get("", response_model=List[BankQuestionResponse])
async def list_bank_questions(
    department: Optional[str] = Query(None, description="Фильтр по отделу"),
    search: Optional[str] = Query(None, description="Поиск по тексту вопроса"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение списка вопросов из банка с фильтрацией по отделу и поиском."""
    stmt = (
        select(BankQuestion)
        .options(selectinload(BankQuestion.options))
        .order_by(BankQuestion.created_at.desc())
    )

    if department and department != "Все" and department != "all":
        stmt = stmt.where(BankQuestion.department == department)

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(BankQuestion.text.ilike(search_pattern))

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=BankQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_question(
    q_in: BankQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Создать вопрос в банке вопросов (только администратор)."""
    new_q = BankQuestion(
        text=q_in.text,
        question_type=q_in.question_type,
        department=q_in.department.strip() if q_in.department else "Общий",
        points=q_in.points,
    )
    db.add(new_q)
    await db.flush()

    for opt_in in q_in.options:
        opt = BankQuestionOption(
            bank_question_id=new_q.id,
            text=opt_in.text,
            is_correct=opt_in.is_correct,
        )
        db.add(opt)

    await db.commit()

    # Load with options
    stmt = (
        select(BankQuestion)
        .where(BankQuestion.id == new_q.id)
        .options(selectinload(BankQuestion.options))
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/{question_id}", response_model=BankQuestionResponse)
async def get_bank_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить вопрос из банка по ID."""
    stmt = (
        select(BankQuestion)
        .where(BankQuestion.id == question_id)
        .options(selectinload(BankQuestion.options))
    )
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден в банке")

    return question


@router.put("/{question_id}", response_model=BankQuestionResponse)
async def update_bank_question(
    question_id: int,
    q_in: BankQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Редактировать вопрос в банке вопросов (только администратор)."""
    stmt = (
        select(BankQuestion)
        .where(BankQuestion.id == question_id)
        .options(selectinload(BankQuestion.options))
    )
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден в банке")

    if q_in.text is not None:
        question.text = q_in.text
    if q_in.question_type is not None:
        question.question_type = q_in.question_type
    if q_in.department is not None:
        question.department = q_in.department.strip()
    if q_in.points is not None:
        question.points = q_in.points

    if q_in.options is not None:
        # Replace options
        for opt in question.options:
            await db.delete(opt)
        await db.flush()

        for opt_in in q_in.options:
            new_opt = BankQuestionOption(
                bank_question_id=question.id,
                text=opt_in.text,
                is_correct=opt_in.is_correct,
            )
            db.add(new_opt)

    question.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Re-fetch
    stmt = (
        select(BankQuestion)
        .where(BankQuestion.id == question_id)
        .options(selectinload(BankQuestion.options))
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bank_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Удалить вопрос из банка вопросов (только администратор)."""
    stmt = select(BankQuestion).where(BankQuestion.id == question_id)
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден в банке")

    await db.delete(question)
    await db.commit()
    return None
