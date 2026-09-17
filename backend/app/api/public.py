from datetime import datetime, timedelta, timezone
import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.attempt import Attempt, AttemptAnswer
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.schemas.attempt import (
    AttemptAnswerDetailResponse,
    AttemptResultResponse,
    AttemptSubmitRequest,
    GuestAttemptStartRequest,
    GuestAttemptStartResponse,
)
from app.schemas.test import PublicTestInfoResponse, TestEmployeeResponse

router = APIRouter(prefix="/public", tags=["Public Guest Testing"])


@router.get("/tests/{token}", response_model=PublicTestInfoResponse)
async def get_public_test_info(token: str, db: AsyncSession = Depends(get_db)):
    """Fetch public test details for guest preview."""
    stmt = (
        select(Test)
        .where(Test.public_token == token, Test.allow_guest.is_(True), Test.is_published.is_(True))
        .options(selectinload(Test.questions))
    )
    res = await db.execute(stmt)
    test = res.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест не найден или доступ по публичной ссылке отключен",
        )

    tot_points = sum(q.points for q in test.questions)
    return PublicTestInfoResponse(
        id=test.id,
        title=test.title,
        description=test.description or "",
        time_limit_minutes=test.time_limit_minutes,
        passing_score=test.passing_score,
        question_count=len(test.questions),
        total_points=tot_points,
        public_token=test.public_token,
    )


@router.post("/tests/{token}/start", response_model=GuestAttemptStartResponse)
async def start_guest_attempt(
    token: str,
    guest_data: GuestAttemptStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start an unauthenticated guest test attempt with provided Full Name."""
    if not guest_data.guest_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пожалуйста, укажите ваше ФИО",
        )

    stmt = (
        select(Test)
        .where(Test.public_token == token, Test.allow_guest.is_(True), Test.is_published.is_(True))
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    res = await db.execute(stmt)
    test = res.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест не найден или публичный доступ деактивирован",
        )

    now = datetime.now(timezone.utc)
    tot_points = sum(q.points for q in test.questions)
    session_token = secrets.token_urlsafe(32)

    new_attempt = Attempt(
        test_id=test.id,
        user_id=None,
        is_guest=True,
        guest_name=guest_data.guest_name.strip(),
        guest_email=guest_data.guest_email.strip() if guest_data.guest_email else None,
        guest_phone=guest_data.guest_phone.strip() if guest_data.guest_phone else None,
        guest_session_token=session_token,
        status="in_progress",
        started_at=now,
        max_score=tot_points,
        score=0,
        is_passed=False,
    )
    db.add(new_attempt)
    await db.commit()
    await db.refresh(new_attempt)

    expires_at = None
    if test.time_limit_minutes:
        expires_at = new_attempt.started_at + timedelta(minutes=test.time_limit_minutes)

    sanitized_test = TestEmployeeResponse.model_validate(test)
    sanitized_test.total_points = tot_points

    return GuestAttemptStartResponse(
        attempt_id=new_attempt.id,
        guest_session_token=session_token,
        test=sanitized_test,
        started_at=new_attempt.started_at,
        expires_at=expires_at,
    )


@router.get("/attempts/{attempt_id}", response_model=GuestAttemptStartResponse)
async def get_active_guest_attempt(
    attempt_id: int,
    session_token: str = Query(..., description="Гостевой токен сессии"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve ongoing guest attempt questions."""
    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id, Attempt.is_guest.is_(True))
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    if not attempt or attempt.guest_session_token != session_token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена или сессия недействительна")

    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данная попытка уже завершена",
        )

    test = attempt.test
    expires_at = None
    if test.time_limit_minutes:
        expires_at = attempt.started_at + timedelta(minutes=test.time_limit_minutes)

    sanitized_test = TestEmployeeResponse.model_validate(test)
    sanitized_test.total_points = sum(q.points for q in test.questions)

    return GuestAttemptStartResponse(
        attempt_id=attempt.id,
        guest_session_token=attempt.guest_session_token,
        test=sanitized_test,
        started_at=attempt.started_at,
        expires_at=expires_at,
    )


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptResultResponse)
async def submit_guest_attempt(
    attempt_id: int,
    submission: AttemptSubmitRequest,
    session_token: Optional[str] = Query(None, description="Гостевой токен сессии"),
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: AsyncSession = Depends(get_db),
):
    """Submit guest answers and perform scoring."""
    token = session_token or x_guest_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Гостевой токен сессии не предоставлен")

    att_stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id, Attempt.is_guest.is_(True))
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
            selectinload(Attempt.answers),
        )
    )
    res = await db.execute(att_stmt)
    attempt = res.scalar_one_or_none()

    if not attempt or attempt.guest_session_token != token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Попытка уже завершена (текущий статус: {attempt.status})",
        )

    now = datetime.now(timezone.utc)
    test = attempt.test

    is_timed_out = False
    if test.time_limit_minutes:
        max_duration = timedelta(minutes=test.time_limit_minutes, seconds=15)
        elapsed = now - attempt.started_at
        if elapsed > max_duration:
            is_timed_out = True

    submitted_answers_map = {ans.question_id: ans for ans in submission.answers}
    total_score = 0
    has_unreviewed = False
    max_possible = sum(q.points for q in test.questions)
    answer_details: List[AttemptAnswerDetailResponse] = []

    for q in test.questions:
        user_ans = submitted_answers_map.get(q.id)
        user_selected = user_ans.selected_option_ids if user_ans and user_ans.selected_option_ids else []
        user_text = ""
        if user_ans:
            user_text = (user_ans.text_answer or user_ans.answer_text or "").strip()

        is_q_correct = False
        points_earned = 0
        is_q_reviewed = True

        correct_options = [opt for opt in q.options if opt.is_correct]
        correct_option_ids = [opt.id for opt in correct_options]
        correct_option_texts = [opt.text for opt in correct_options]

        if q.question_type == "single_choice":
            if len(user_selected) == 1 and user_selected[0] in correct_option_ids:
                is_q_correct = True
                points_earned = q.points

        elif q.question_type == "multiple_choice":
            if set(user_selected) == set(correct_option_ids) and len(correct_option_ids) > 0:
                is_q_correct = True
                points_earned = q.points

        elif q.question_type in ("manual_review", "open", "free_text"):
            # Open question requiring administrator manual review
            is_q_reviewed = False
            has_unreviewed = True
            points_earned = 0
            is_q_correct = False

        elif q.question_type == "text":
            # Keyword matching if options provided, otherwise manual review
            clean_user_text = user_text.strip().lower()
            if correct_options:
                if clean_user_text:
                    for opt in correct_options:
                        if opt.text.strip().lower() == clean_user_text:
                            is_q_correct = True
                            points_earned = q.points
                            break
            else:
                is_q_reviewed = False
                has_unreviewed = True
                points_earned = 0

        total_score += points_earned

        db_answer = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_option_ids=user_selected,
            text_answer=user_text if user_text else None,
            is_correct=is_q_correct,
            points_awarded=points_earned,
            is_reviewed=is_q_reviewed,
        )
        db.add(db_answer)

        answer_details.append(
            AttemptAnswerDetailResponse(
                question_id=q.id,
                question_text=q.text,
                question_type=q.question_type,
                points_max=q.points,
                points_awarded=points_earned,
                is_correct=is_q_correct,
                is_reviewed=is_q_reviewed,
                user_selected_option_ids=user_selected,
                user_text_answer=user_text if user_text else None,
                correct_option_ids=correct_option_ids if is_q_reviewed else [],
                correct_option_texts=correct_option_texts if is_q_reviewed else [],
            )
        )

    percentage = round((total_score / max_possible * 100), 1) if max_possible > 0 else 0.0

    if is_timed_out:
        attempt.status = "timed_out"
        is_passed = False
    elif has_unreviewed:
        attempt.status = "needs_review"
        is_passed = False
    else:
        attempt.status = "submitted"
        if test.passing_score <= 100:
            is_passed = percentage >= test.passing_score
        else:
            is_passed = total_score >= test.passing_score

    attempt.score = total_score
    attempt.max_score = max_possible
    attempt.is_passed = is_passed
    attempt.submitted_at = now

    await db.commit()
    await db.refresh(attempt)

    time_spent = int((attempt.submitted_at - attempt.started_at).total_seconds())

    return AttemptResultResponse(
        id=attempt.id,
        test_id=test.id,
        test_title=test.title,
        status=attempt.status,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=percentage,
        passing_score=test.passing_score,
        is_passed=attempt.is_passed,
        is_guest=True,
        guest_name=attempt.guest_name,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        time_spent_seconds=time_spent,
        answers=answer_details,
    )


@router.get("/attempts/{attempt_id}/result", response_model=AttemptResultResponse)
async def get_guest_attempt_result(
    attempt_id: int,
    session_token: Optional[str] = Query(None, description="Гостевой токен сессии"),
    x_guest_token: Optional[str] = Header(None, alias="X-Guest-Token"),
    db: AsyncSession = Depends(get_db),
):
    """Fetch result details for a guest attempt."""
    token = session_token or x_guest_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Гостевой токен сессии не предоставлен")

    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id, Attempt.is_guest.is_(True))
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
            selectinload(Attempt.answers),
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    if not attempt or attempt.guest_session_token != token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    test = attempt.test
    answer_map = {ans.question_id: ans for ans in attempt.answers}

    answer_details: List[AttemptAnswerDetailResponse] = []
    for q in test.questions:
        user_ans = answer_map.get(q.id)
        user_selected = user_ans.selected_option_ids if user_ans and user_ans.selected_option_ids else []
        user_text = user_ans.text_answer if user_ans else None
        awarded = user_ans.points_awarded if user_ans else 0
        is_cor = user_ans.is_correct if user_ans else False
        is_rev = user_ans.is_reviewed if user_ans else True
        rev_comment = user_ans.reviewer_comment if user_ans else None

        correct_options = [opt for opt in q.options if opt.is_correct]
        correct_option_ids = [opt.id for opt in correct_options]
        correct_option_texts = [opt.text for opt in correct_options]

        answer_details.append(
            AttemptAnswerDetailResponse(
                question_id=q.id,
                question_text=q.text,
                question_type=q.question_type,
                points_max=q.points,
                points_awarded=awarded,
                is_correct=is_cor,
                is_reviewed=is_rev,
                reviewer_comment=rev_comment,
                user_selected_option_ids=user_selected,
                user_text_answer=user_text,
                correct_option_ids=correct_option_ids if is_rev else [],
                correct_option_texts=correct_option_texts if is_rev else [],
            )
        )

    percentage = round((attempt.score / attempt.max_score * 100), 1) if attempt.max_score > 0 else 0.0
    time_spent = None
    if attempt.submitted_at and attempt.started_at:
        time_spent = int((attempt.submitted_at - attempt.started_at).total_seconds())

    return AttemptResultResponse(
        id=attempt.id,
        test_id=test.id,
        test_title=test.title,
        status=attempt.status,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=percentage,
        passing_score=test.passing_score,
        is_passed=attempt.is_passed,
        is_guest=True,
        guest_name=attempt.guest_name,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        time_spent_seconds=time_spent,
        answers=answer_details,
    )
