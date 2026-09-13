import secrets
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.assignment import TestAssignment
from app.models.attempt import Attempt
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User
from app.schemas.analytics import AttemptAdminDetail, TestAnalyticsResponse, TestAnalyticsSummary
from app.schemas.assignment import (
    TestAssignRequest,
    TestAssignmentItemResponse,
    TestAssignmentListResponse,
)
from app.schemas.test import (
    TestAdminResponse,
    TestCreate,
    TestEmployeeResponse,
    TestListItemResponse,
    TestUpdate,
)

router = APIRouter(prefix="/tests", tags=["Tests"])


@router.get("", response_model=List[TestListItemResponse])
async def get_tests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Список тестов:
    - Для сотрудников: опубликованные тесты + персонально назначенные тесты (включая черновики).
    - Для администраторов: все тесты компании (опубликованные и черновики).
    """
    assigned_map = {}
    if current_user.role == "employee":
        # Получаем назначения сотрудника
        assign_res = await db.execute(
            select(TestAssignment).where(TestAssignment.user_id == current_user.id)
        )
        for a in assign_res.scalars().all():
            assigned_map[a.test_id] = a

    stmt = (
        select(Test)
        .options(selectinload(Test.questions))
        .order_by(Test.created_at.desc())
    )

    if current_user.role == "employee":
        # Опубликованные или персонально назначенные
        if assigned_map:
            assigned_ids = list(assigned_map.keys())
            stmt = stmt.where((Test.is_published.is_(True)) | (Test.id.in_(assigned_ids)))
        else:
            stmt = stmt.where(Test.is_published.is_(True))

    result = await db.execute(stmt)
    tests = result.scalars().all()

    # Попытки сотрудника
    user_attempts_map = {}
    completed_attempts_count_map = {}
    latest_completed_attempt_id_map = {}
    if current_user.role == "employee":
        attempts_res = await db.execute(
            select(Attempt).where(Attempt.user_id == current_user.id).order_by(Attempt.started_at.desc())
        )
        attempts = attempts_res.scalars().all()
        for att in attempts:
            if att.status in ["submitted", "needs_review", "timed_out"]:
                completed_attempts_count_map[att.test_id] = completed_attempts_count_map.get(att.test_id, 0) + 1
                if att.test_id not in latest_completed_attempt_id_map:
                    latest_completed_attempt_id_map[att.test_id] = att.id

            if att.test_id not in user_attempts_map:
                user_attempts_map[att.test_id] = att
            else:
                if att.is_passed or (att.score > user_attempts_map[att.test_id].score):
                    user_attempts_map[att.test_id] = att

    response_items = []
    for t in tests:
        q_count = len(t.questions)
        tot_points = sum(q.points for q in t.questions)

        attempt = user_attempts_map.get(t.id)
        user_status = None
        user_best = None
        if attempt:
            if attempt.status == "needs_review":
                user_status = "needs_review"
            elif attempt.is_passed:
                user_status = "passed"
            elif attempt.status == "in_progress":
                user_status = "in_progress"
            else:
                user_status = "failed"
            user_best = attempt.score

        completed_count = completed_attempts_count_map.get(t.id, 0)
        can_attempt = True
        if t.max_attempts is not None and t.max_attempts > 0:
            if completed_count >= t.max_attempts:
                can_attempt = False
        user_attempt_id = latest_completed_attempt_id_map.get(t.id) or (attempt.id if attempt else None)

        assignment = assigned_map.get(t.id)
        is_assigned = assignment is not None
        due_date = assignment.due_date if assignment else None
        assignment_status = assignment.status if assignment else None

        response_items.append(
            TestListItemResponse(
                id=t.id,
                title=t.title,
                description=t.description or "",
                time_limit_minutes=t.time_limit_minutes,
                passing_score=t.passing_score,
                max_attempts=t.max_attempts,
                is_published=t.is_published,
                allow_guest=t.allow_guest,
                public_token=t.public_token,
                question_count=q_count,
                total_points=tot_points,
                created_at=t.created_at,
                updated_at=t.updated_at,
                user_attempt_status=user_status,
                user_best_score=user_best,
                can_attempt=can_attempt,
                user_attempt_id=user_attempt_id,
                is_assigned=is_assigned,
                assignment_due_date=due_date,
                assignment_status=assignment_status,
            )
        )

    return response_items


@router.post("", response_model=TestAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    test_in: TestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Создание нового теста (Администратор/Суперадминистратор)."""
    public_token = test_in.public_token
    if test_in.allow_guest and not public_token:
        public_token = secrets.token_urlsafe(16)

    new_test = Test(
        title=test_in.title,
        description=test_in.description or "",
        time_limit_minutes=test_in.time_limit_minutes,
        passing_score=test_in.passing_score,
        max_attempts=test_in.max_attempts,
        is_published=test_in.is_published,
        allow_guest=test_in.allow_guest,
        public_token=public_token,
        author_id=current_user.id,
    )
    db.add(new_test)
    await db.flush()

    for q_idx, q_in in enumerate(test_in.questions):
        new_q = Question(
            test_id=new_test.id,
            text=q_in.text,
            question_type=q_in.question_type,
            points=q_in.points,
            order=q_in.order if q_in.order is not None else q_idx,
        )
        db.add(new_q)
        await db.flush()

        for opt_in in q_in.options:
            new_opt = QuestionOption(
                question_id=new_q.id,
                text=opt_in.text,
                is_correct=opt_in.is_correct,
            )
            db.add(new_opt)

    await db.commit()

    result = await db.execute(
        select(Test)
        .where(Test.id == new_test.id)
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    saved_test = result.scalar_one()
    tot_points = sum(q.points for q in saved_test.questions)

    res = TestAdminResponse.model_validate(saved_test)
    res.total_points = tot_points
    return res


@router.get("/{test_id}")
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получить тест по ID:
    - Для администратора: полный ответ со всеми правильными ответами.
    - Для сотрудника: безопасный ответ без подсказок (Anti-Cheat).
    """
    stmt = (
        select(Test)
        .where(Test.id == test_id)
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    result = await db.execute(stmt)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    # Если сотрудник и тест не опубликован, проверяем, назначен ли тест персонально
    if current_user.role == "employee" and not test.is_published:
        assign_check = await db.execute(
            select(TestAssignment).where(
                TestAssignment.test_id == test_id,
                TestAssignment.user_id == current_user.id,
            )
        )
        if not assign_check.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не опубликован")

    tot_points = sum(q.points for q in test.questions)

    if current_user.role in ["admin", "superadmin"]:
        res = TestAdminResponse.model_validate(test)
        res.total_points = tot_points
        return res
    else:
        res = TestEmployeeResponse.model_validate(test)
        res.total_points = tot_points
        return res


@router.put("/{test_id}", response_model=TestAdminResponse)
async def update_test(
    test_id: int,
    test_in: TestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Обновление настроек и вопросов теста (Администратор/Суперадминистратор)."""
    stmt = (
        select(Test)
        .where(Test.id == test_id)
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    result = await db.execute(stmt)
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    if test_in.title is not None:
        test.title = test_in.title
    if test_in.description is not None:
        test.description = test_in.description
    if test_in.time_limit_minutes is not None:
        test.time_limit_minutes = test_in.time_limit_minutes
    if test_in.passing_score is not None:
        test.passing_score = test_in.passing_score
    if test_in.max_attempts is not None:
        test.max_attempts = test_in.max_attempts
    if test_in.is_published is not None:
        test.is_published = test_in.is_published

    if test_in.allow_guest is not None:
        test.allow_guest = test_in.allow_guest
        if test.allow_guest and not test.public_token:
            test.public_token = secrets.token_urlsafe(16)
    if test_in.public_token is not None:
        test.public_token = test_in.public_token

    if test_in.questions is not None:
        for q in test.questions:
            await db.delete(q)
        await db.flush()

        for q_idx, q_in in enumerate(test_in.questions):
            new_q = Question(
                test_id=test.id,
                text=q_in.text,
                question_type=q_in.question_type,
                points=q_in.points,
                order=q_in.order if q_in.order is not None else q_idx,
            )
            db.add(new_q)
            await db.flush()

            for opt_in in q_in.options:
                new_opt = QuestionOption(
                    question_id=new_q.id,
                    text=opt_in.text,
                    is_correct=opt_in.is_correct,
                )
                db.add(new_opt)

    await db.commit()

    refetched = await db.execute(
        select(Test)
        .where(Test.id == test_id)
        .options(selectinload(Test.questions).selectinload(Question.options))
    )
    updated = refetched.scalar_one()
    tot_points = sum(q.points for q in updated.questions)
    res = TestAdminResponse.model_validate(updated)
    res.total_points = tot_points
    return res


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Удаление теста и всех связанных данных (Администратор/Суперадминистратор)."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    await db.delete(test)
    await db.commit()
    return None


@router.post("/{test_id}/assign", status_code=status.HTTP_200_OK)
async def assign_test_to_users(
    test_id: int,
    assign_req: TestAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Назначить тест выбранным сотрудникам или всем сотрудникам организации."""
    test_res = await db.execute(select(Test).where(Test.id == test_id))
    test = test_res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    target_user_ids = []
    if assign_req.assign_all:
        users_res = await db.execute(select(User.id).where(User.is_active.is_(True)))
        target_user_ids = [uid for (uid,) in users_res.fetchall()]
    else:
        target_user_ids = assign_req.user_ids

    if not target_user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не выбраны сотрудники для назначения")

    # Получаем уже существующие назначения для данного теста
    existing_res = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_id == test_id,
            TestAssignment.user_id.in_(target_user_ids),
        )
    )
    existing_assignments = {a.user_id: a for a in existing_res.scalars().all()}

    for uid in target_user_ids:
        if uid in existing_assignments:
            # Обновляем дедлайн
            existing_assignments[uid].due_date = assign_req.due_date
        else:
            new_assignment = TestAssignment(
                test_id=test_id,
                user_id=uid,
                assigned_by_id=current_user.id,
                due_date=assign_req.due_date,
                status="pending",
            )
            db.add(new_assignment)

    await db.commit()
    return {"message": f"Тест успешно назначен {len(target_user_ids)} сотрудникам"}


@router.get("/{test_id}/assignments", response_model=TestAssignmentListResponse)
async def get_test_assignments(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Получить список назначений теста с детальным статусом прохождения."""
    test_res = await db.execute(select(Test).where(Test.id == test_id))
    test = test_res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    assignments_res = await db.execute(
        select(TestAssignment)
        .where(TestAssignment.test_id == test_id)
        .options(selectinload(TestAssignment.user))
        .order_by(TestAssignment.assigned_at.desc())
    )
    assignments = assignments_res.scalars().all()

    # Получаем последние попытки для каждого назначенного пользователя
    assigned_user_ids = [a.user_id for a in assignments]
    attempts_map = {}
    if assigned_user_ids:
        attempts_res = await db.execute(
            select(Attempt)
            .where(Attempt.test_id == test_id, Attempt.user_id.in_(assigned_user_ids))
            .order_by(Attempt.started_at.desc())
        )
        for att in attempts_res.scalars().all():
            if att.user_id not in attempts_map:
                attempts_map[att.user_id] = att

    items: List[TestAssignmentItemResponse] = []
    for a in assignments:
        att = attempts_map.get(a.user_id)
        pct = None
        att_status = None
        score = None
        max_score = None
        if att:
            att_status = att.status if att.status in ["needs_review", "in_progress"] else ("passed" if att.is_passed else "failed")
            score = att.score
            max_score = att.max_score
            pct = round((att.score / att.max_score * 100), 1) if att.max_score > 0 else 0.0

        items.append(
            TestAssignmentItemResponse(
                id=a.id,
                test_id=a.test_id,
                user_id=a.user_id,
                user_name=a.user.full_name if a.user else "Сотрудник удален",
                user_email=a.user.email if a.user else "—",
                assigned_at=a.assigned_at,
                due_date=a.due_date,
                status=a.status,
                attempt_status=att_status,
                score=score,
                max_score=max_score,
                percentage=pct,
            )
        )

    return TestAssignmentListResponse(
        test_id=test.id,
        test_title=test.title,
        total_assigned=len(items),
        assignments=items,
    )


@router.delete("/{test_id}/assignments/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_assignment(
    test_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Отозвать назначение теста у сотрудника."""
    res = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_id == test_id,
            TestAssignment.user_id == user_id,
        )
    )
    assignment = res.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Назначение не найдено")

    await db.delete(assignment)
    await db.commit()
    return None


@router.get("/{test_id}/analytics", response_model=TestAnalyticsResponse)
async def get_test_analytics(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Аналитика теста: сотрудники, гости, средний балл, ручная проверка."""
    stmt = (
        select(Test)
        .where(Test.id == test_id)
        .options(selectinload(Test.questions))
    )
    result = await db.execute(stmt)
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    max_possible = sum(q.points for q in test.questions)

    # Загружаем попытки вместе с ответами (чтобы посчитать unreviewed_count)
    att_stmt = (
        select(Attempt)
        .where(Attempt.test_id == test_id)
        .options(selectinload(Attempt.user), selectinload(Attempt.answers))
        .order_by(Attempt.started_at.desc())
    )
    att_res = await db.execute(att_stmt)
    attempts = att_res.scalars().all()

    completed_attempts = [a for a in attempts if a.status in ["submitted", "timed_out"]]
    needs_review_attempts = [a for a in attempts if a.status == "needs_review"]
    total_completed = len(completed_attempts)
    passed_count = sum(1 for a in completed_attempts if a.is_passed)
    failed_count = total_completed - passed_count
    pass_rate = round((passed_count / total_completed * 100), 1) if total_completed > 0 else 0.0
    avg_score = round(sum(a.score for a in completed_attempts) / total_completed, 1) if total_completed > 0 else 0.0

    attempt_details: List[AttemptAdminDetail] = []
    for a in attempts:
        time_spent = None
        if a.submitted_at and a.started_at:
            time_spent = int((a.submitted_at - a.started_at).total_seconds())

        pct = round((a.score / a.max_score * 100), 1) if a.max_score > 0 else 0.0
        unreviewed = sum(1 for ans in a.answers if not ans.is_reviewed)

        u_name = a.guest_name if a.is_guest else (a.user.full_name if a.user else "Удаленный пользователь")
        u_email = a.guest_email if a.is_guest else (a.user.email if a.user else "—")
        if not u_email:
            u_email = "—"

        attempt_details.append(
            AttemptAdminDetail(
                id=a.id,
                user_id=a.user.id if a.user else None,
                user_name=u_name,
                user_email=u_email,
                is_guest=a.is_guest,
                guest_name=a.guest_name,
                guest_email=a.guest_email,
                guest_phone=a.guest_phone,
                score=a.score,
                max_score=a.max_score,
                percentage=pct,
                is_passed=a.is_passed,
                status=a.status,
                needs_review=(a.status == "needs_review"),
                unreviewed_count=unreviewed,
                started_at=a.started_at,
                submitted_at=a.submitted_at,
                time_spent_seconds=time_spent,
            )
        )

    summary = TestAnalyticsSummary(
        total_attempts=len(attempts),
        passed_attempts=passed_count,
        failed_attempts=failed_count,
        needs_review_attempts=len(needs_review_attempts),
        pass_rate=pass_rate,
        average_score=avg_score,
        max_possible_points=max_possible,
    )

    return TestAnalyticsResponse(
        test_id=test.id,
        test_title=test.title,
        summary=summary,
        attempts=attempt_details,
    )
