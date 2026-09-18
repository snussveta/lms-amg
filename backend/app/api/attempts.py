from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.assignment import TestAssignment
from app.models.attempt import Attempt, AttemptAnswer
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User
from app.schemas.attempt import (
    AttemptAnswerDetailResponse,
    AttemptListItemResponse,
    AttemptManualReviewRequest,
    AttemptResultResponse,
    AttemptStartResponse,
    AttemptSubmitRequest,
)
from app.schemas.test import TestEmployeeResponse

from app.models.course import Course, CourseModule, CourseLesson

router = APIRouter(prefix="/attempts", tags=["Test Attempts"])


@router.post("/start", response_model=AttemptStartResponse)
@router.post("/start/{test_id}", response_model=AttemptStartResponse)
async def start_attempt(
    test_id: Optional[int] = None,
    test_id_query: Optional[int] = Query(None, alias="test_id", description="ID теста для прохождения"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Запуск или продолжение тестирования сотрудником:
    - Если есть активная попытка (in_progress) и время не истекло, возвращает её
    - Проверяет лимит попыток (max_attempts) перед созданием новой
    - Проверяет статус публикации и персональные назначения
    """
    actual_test_id = test_id if test_id is not None else test_id_query
    if not actual_test_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не указан ID теста")

    stmt = (
        select(Test)
        .where(Test.id == actual_test_id)
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    res = await db.execute(stmt)
    test = res.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    if current_user.role == "employee":
        # Check if test is linked to a published course lesson
        course_check_stmt = (
            select(CourseLesson)
            .join(CourseModule, CourseLesson.module_id == CourseModule.id)
            .join(Course, CourseModule.course_id == Course.id)
            .where(
                CourseLesson.quiz_id == actual_test_id,
                Course.is_published == True,
            )
        )
        is_in_course = (await db.execute(course_check_stmt)).scalar_one_or_none() is not None

        if not test.is_published and not is_in_course:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Этот тест еще не опубликован")

        # Строгая проверка персонального назначения для тестов с ограниченным доступом
        if test.is_assigned_only and not is_in_course:
            assign_check = await db.execute(
                select(TestAssignment).where(
                    TestAssignment.test_id == actual_test_id,
                    TestAssignment.user_id == current_user.id,
                )
            )
            assignment = assign_check.scalar_one_or_none()
            if not assignment:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Этот тест вам не назначен",
                )

    now = datetime.now(timezone.utc)

    # Проверка активной незавершенной попытки
    active_stmt = (
        select(Attempt)
        .where(
            Attempt.test_id == test.id,
            Attempt.user_id == current_user.id,
            Attempt.status == "in_progress",
        )
        .order_by(Attempt.started_at.desc())
    )
    active_res = await db.execute(active_stmt)
    active_attempt = active_res.scalars().first()

    expires_at = None
    if test.time_limit_minutes:
        if active_attempt:
            expires_at = active_attempt.started_at + timedelta(minutes=test.time_limit_minutes)
            if now > (expires_at + timedelta(seconds=15)):
                active_attempt.status = "timed_out"
                await db.commit()
                active_attempt = None

    if not active_attempt:
        # Строгая проверка лимита попыток (max_attempts)
        if test.max_attempts is not None and test.max_attempts > 0:
            count_stmt = (
                select(func.count(Attempt.id))
                .where(
                    Attempt.test_id == test.id,
                    Attempt.user_id == current_user.id,
                    Attempt.status.in_(["submitted", "needs_review", "timed_out"]),
                )
            )
            count_res = await db.execute(count_stmt)
            completed_count = count_res.scalar() or 0
            if completed_count >= test.max_attempts:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Вы уже исчерпали лимит попыток для этого теста",
                )

        tot_points = sum(q.points for q in test.questions)
        new_attempt = Attempt(
            test_id=test.id,
            user_id=current_user.id,
            status="in_progress",
            started_at=now,
            max_score=tot_points,
            score=0,
            is_passed=False,
        )
        db.add(new_attempt)

        # Обновляем статус назначения, если тест был назначен
        assign_res = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test.id,
                TestAssignment.user_id == current_user.id,
            )
        )
        assignment = assign_res.scalar_one_or_none()
        if assignment and assignment.status == "pending":
            assignment.status = "in_progress"

        await db.commit()
        await db.refresh(new_attempt)
        active_attempt = new_attempt

        if test.time_limit_minutes:
            expires_at = active_attempt.started_at + timedelta(minutes=test.time_limit_minutes)

    sanitized_test = TestEmployeeResponse.model_validate(test)
    sanitized_test.total_points = sum(q.points for q in test.questions)

    return AttemptStartResponse(
        attempt_id=active_attempt.id,
        test=sanitized_test,
        started_at=active_attempt.started_at,
        expires_at=expires_at,
    )


@router.get("/my", response_model=List[AttemptListItemResponse])
async def get_my_attempts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    История всех попыток текущего пользователя.
    Маршрут объявлен ДО /{attempt_id}, чтобы избежать конфликта совпадения путей в FastAPI.
    """
    stmt = (
        select(Attempt)
        .where(Attempt.user_id == current_user.id)
        .options(selectinload(Attempt.test))
        .order_by(Attempt.started_at.desc())
    )
    result = await db.execute(stmt)
    attempts = result.scalars().all()

    items = []
    for a in attempts:
        pct = round((a.score / a.max_score * 100), 1) if a.max_score > 0 else 0.0
        items.append(
            AttemptListItemResponse(
                id=a.id,
                test_id=a.test_id,
                test_title=a.test.title if a.test else "Неизвестный тест",
                score=a.score,
                max_score=a.max_score,
                percentage=pct,
                is_passed=a.is_passed,
                status=a.status,
                is_guest=a.is_guest,
                guest_name=a.guest_name,
                started_at=a.started_at,
                submitted_at=a.submitted_at,
            )
        )
    return items


@router.get("/{attempt_id}", response_model=AttemptStartResponse)
async def get_active_attempt(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получение текущей активной попытки сотрудника."""
    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id)
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    if current_user.role == "employee" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен")

    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данная попытка уже завершена или время истекло",
        )

    test = attempt.test
    expires_at = None
    if test.time_limit_minutes:
        expires_at = attempt.started_at + timedelta(minutes=test.time_limit_minutes)

    sanitized_test = TestEmployeeResponse.model_validate(test)
    sanitized_test.total_points = sum(q.points for q in test.questions)

    return AttemptStartResponse(
        attempt_id=attempt.id,
        test=sanitized_test,
        started_at=attempt.started_at,
        expires_at=expires_at,
    )


@router.post("/{attempt_id}/submit", response_model=AttemptResultResponse)
async def submit_attempt(
    attempt_id: int,
    submission: AttemptSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Серверная оценка сданного теста:
    - Проверяет права и статус попытки
    - Автоматически оценивает вопросы с выбором вариантов
    - Открытые вопросы (manual_review) помечает как ожидающие проверки
    - Если есть вопросы на ручную проверку, выставляет статус 'needs_review'
    """
    att_stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id)
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
            selectinload(Attempt.answers),
        )
    )
    res = await db.execute(att_stmt)
    attempt = res.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    if attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нельзя сдать попытку другого пользователя")

    if attempt.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Попытка уже была завершена (статус: {attempt.status})",
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
            # Открытый вопрос, требующий ручной проверки методистом/экзаменатором
            is_q_reviewed = False
            has_unreviewed = True
            points_earned = 0
            is_q_correct = False

        elif q.question_type == "text":
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

    # Если попытка успешно завершена без ручной проверки, обновляем назначение
    if attempt.status == "submitted" and attempt.user_id:
        assign_res = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test.id,
                TestAssignment.user_id == attempt.user_id,
            )
        )
        assignment = assign_res.scalar_one_or_none()
        if assignment:
            assignment.status = "completed"

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
        is_guest=attempt.is_guest,
        guest_name=attempt.guest_name,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        time_spent_seconds=time_spent,
        answers=answer_details,
    )


@router.post("/{attempt_id}/review", response_model=AttemptResultResponse)
async def review_attempt_answers(
    attempt_id: int,
    review_req: AttemptManualReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """
    Интерфейс ручной проверки открытых ответов администратором:
    - Выставляет баллы (от 0 до MAX) за каждый открытый вопрос
    - Оставляет комментарий / заметку проверяющего
    - Пересчитывает итоговый балл, процент и статус сдачи
    """
    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id)
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
            selectinload(Attempt.answers),
            selectinload(Attempt.user),
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    test = attempt.test
    questions_map = {q.id: q for q in test.questions}
    answers_map = {ans.question_id: ans for ans in attempt.answers}
    now = datetime.now(timezone.utc)

    # Применяем выставленные баллы и комментарии
    for rev in review_req.reviews:
        q = questions_map.get(rev.question_id)
        if not q:
            continue
        ans = answers_map.get(rev.question_id)
        if not ans:
            continue

        if rev.points_awarded < 0 or rev.points_awarded > q.points:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Балл за вопрос #{q.order + 1} должен быть в диапазоне от 0 до {q.points}",
            )

        ans.points_awarded = rev.points_awarded
        ans.is_correct = (rev.points_awarded == q.points)
        ans.reviewer_comment = rev.reviewer_comment
        ans.is_reviewed = True
        ans.reviewed_at = now
        ans.reviewed_by_id = current_user.id

    # Пересчитываем суммарный балл
    new_total_score = sum(ans.points_awarded for ans in attempt.answers)
    max_possible = sum(q.points for q in test.questions)
    percentage = round((new_total_score / max_possible * 100), 1) if max_possible > 0 else 0.0

    all_reviewed = all(ans.is_reviewed for ans in attempt.answers)
    if all_reviewed:
        attempt.status = "submitted"
        if test.passing_score <= 100:
            attempt.is_passed = percentage >= test.passing_score
        else:
            attempt.is_passed = new_total_score >= test.passing_score
    else:
        attempt.status = "needs_review"

    attempt.score = new_total_score

    # Если попытка сотрудника завершена, обновляем статус в назначениях
    if attempt.status == "submitted" and attempt.user_id:
        assign_res = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test.id,
                TestAssignment.user_id == attempt.user_id,
            )
        )
        assignment = assign_res.scalar_one_or_none()
        if assignment:
            assignment.status = "completed"

    await db.commit()
    await db.refresh(attempt)

    # Формируем ответ
    answer_details: List[AttemptAnswerDetailResponse] = []
    for q in test.questions:
        user_ans = answers_map.get(q.id)
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
        is_guest=attempt.is_guest,
        guest_name=attempt.guest_name,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        time_spent_seconds=time_spent,
        answers=answer_details,
    )


@router.get("/{attempt_id}/result", response_model=AttemptResultResponse)
async def get_attempt_result(
    attempt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Просмотр результатов завершенной попытки.
    Доступно владельцу попытки или администратору.
    """
    stmt = (
        select(Attempt)
        .where(Attempt.id == attempt_id)
        .options(
            selectinload(Attempt.test).selectinload(Test.questions).selectinload(Question.options),
            selectinload(Attempt.answers),
        )
    )
    res = await db.execute(stmt)
    attempt = res.scalar_one_or_none()

    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Попытка не найдена")

    if current_user.role == "employee" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Доступ запрещен")

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
        is_guest=attempt.is_guest,
        guest_name=attempt.guest_name,
        started_at=attempt.started_at,
        submitted_at=attempt.submitted_at,
        time_spent_seconds=time_spent,
        answers=answer_details,
    )
