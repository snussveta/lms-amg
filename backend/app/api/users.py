from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_password_reset_token,
    get_current_user,
    get_password_hash,
    require_role,
)
from app.core.email import send_welcome_email, send_test_smtp_email
from app.models.department import Department
from app.models.user import User
from app.schemas.user import (
    UserAdminCreate,
    UserAdminUpdate,
    UserResponse,
    UserUpdateRole,
    NotificationSettingsUpdate,
    TelegramLinkCodeResponse,
    UserFullStatisticsResponse,
    UserCourseStatItem,
    UserTestStatItem,
    UserAttestationStatItem,
    UserStatisticsSummary,
)

router = APIRouter(prefix="/users", tags=["Users Management"])


class TestEmailPayload(BaseModel):
    to_email: Optional[EmailStr] = None


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """
    Список сотрудников:
    - Администратор и суперадминистратор видят всех сотрудников компании.
    - Руководитель отдела видит сотрудников своего отдела.
    """
    if current_user.role == "department_head":
        result = await db.execute(
            select(User)
            .where(
                (User.department_id == current_user.department_id)
                | (User.department == current_user.department)
            )
            .order_by(User.id.asc())
        )
    else:
        result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: UserAdminCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """
    Регистрация нового сотрудника:
    - Администратор и суперадминистратор могут регистрировать любые роли в любых отделах.
    - Руководитель отдела может регистрировать сотрудников (role='employee') ТОЛЬКО в свой отдел.
    """
    email_clean = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email (логином) уже зарегистрирован в системе",
        )

    # Department head restrictions
    if current_user.role == "department_head":
        user_role = "employee"
        dept_name = current_user.department or "СТО"
        dept_id = current_user.department_id
    else:
        # Guard: admin cannot create superadmin
        if payload.role == "superadmin" and current_user.role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только суперадминистратор может создавать учетные записи суперадминистратора",
            )
        user_role = payload.role

        # Department sync: check both department_id and department string
        dept_obj = None
        if payload.department_id is not None and payload.department_id > 0:
            dept_res = await db.execute(select(Department).where(Department.id == payload.department_id))
            dept_obj = dept_res.scalar_one_or_none()

        if not dept_obj and payload.department is not None and payload.department.strip():
            clean_d = payload.department.strip()
            if clean_d.lower() not in ["без отдела", "none", "null"]:
                dept_res = await db.execute(select(Department).where(Department.name.ilike(clean_d)))
                dept_obj = dept_res.scalar_one_or_none()

        dept_name = None
        dept_id = None
        if dept_obj:
            dept_name = dept_obj.name
            dept_id = dept_obj.id
        elif payload.department and payload.department.strip():
            clean_d = payload.department.strip()
            if clean_d.lower() not in ["без отдела", "none", "null"]:
                dept_name = clean_d
                dept_id = None

    new_user = User(
        email=email_clean,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role=user_role,
        branch=payload.branch.strip() if payload.branch else None,
        department=dept_name,
        department_id=dept_id,
        category=max(1, min(4, payload.category)) if payload.category else 1,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Генерация одноразовой защищенной ссылки для быстрой установки постоянного пароля
    reset_token = create_password_reset_token(email=new_user.email)

    # Фоновая отправка письма с данными для входа и кнопкой мгновенной смены пароля
    background_tasks.add_task(
        send_welcome_email,
        to_email=new_user.email,
        full_name=new_user.full_name,
        password=payload.password,
        role=new_user.role,
        reset_token=reset_token,
    )

    return UserResponse.model_validate(new_user)


@router.post("/test-email")
async def test_email_configuration(
    background_tasks: BackgroundTasks,
    payload: Optional[TestEmailPayload] = None,
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Отправить тестовое письмо на указанный email (или текущему администратору) для проверки настроек SMTP."""
    target_email = (payload.to_email.strip() if (payload and payload.to_email) else current_user.email)
    background_tasks.add_task(send_test_smtp_email, to_email=target_email)
    return {
        "status": "queued",
        "message": f"Тестовое письмо отправлено на {target_email}. Проверьте почтовый ящик.",
    }


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """Обновление данных сотрудника (ФИО, отдел, роль, смена пароля)."""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    # If current user is department head:
    if current_user.role == "department_head":
        is_same_dept = (
            (target_user.department_id and target_user.department_id == current_user.department_id)
            or (target_user.department and target_user.department == current_user.department)
        )
        if not is_same_dept or target_user.role != "employee":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Руководитель отдела может редактировать только рядовых сотрудников своего отдела",
            )
        # Cannot change role or department
        payload.role = None
        payload.department = None
        payload.department_id = None
    else:
        # Guard: admin cannot modify superadmin
        if target_user.role == "superadmin" and current_user.role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только суперадминистратор может редактировать учетные записи суперадминов",
            )

        if payload.role is not None:
            if payload.role == "superadmin" and current_user.role != "superadmin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Только суперадминистратор может назначать роль суперадминистратора",
                )
            target_user.role = payload.role

        # Department update: resolve department object by ID or by name
        target_dept_obj = None
        if payload.department_id is not None and payload.department_id > 0:
            d_res = await db.execute(select(Department).where(Department.id == payload.department_id))
            target_dept_obj = d_res.scalar_one_or_none()

        if not target_dept_obj and payload.department is not None and payload.department.strip():
            clean_d = payload.department.strip()
            if clean_d.lower() not in ["без отдела", "none", "null"]:
                d_res = await db.execute(select(Department).where(Department.name.ilike(clean_d)))
                target_dept_obj = d_res.scalar_one_or_none()

        if target_dept_obj:
            target_user.department_id = target_dept_obj.id
            target_user.department = target_dept_obj.name
        elif payload.department is not None:
            clean_dept = payload.department.strip() if payload.department else ""
            if not clean_dept or clean_dept.lower() in ["без отдела", "none", "null"]:
                target_user.department = None
                target_user.department_id = None
                if target_user.role == "department_head":
                    target_user.role = "employee"
            else:
                target_user.department = clean_dept
                target_user.department_id = None
        elif payload.department_id == 0 or payload.department_id == -1:
            target_user.department = None
            target_user.department_id = None
            if target_user.role == "department_head":
                target_user.role = "employee"

    if payload.full_name is not None and payload.full_name.strip():
        target_user.full_name = payload.full_name.strip()

    if payload.email is not None and payload.email.lower().strip() != target_user.email:
        dup = await db.execute(select(User).where(User.email == payload.email.lower().strip()))
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует",
            )
        target_user.email = payload.email.lower().strip()

    if payload.branch is not None:
        target_user.branch = payload.branch.strip() if payload.branch else None

    if payload.category is not None:
        target_user.category = max(1, min(4, payload.category))

    if payload.password is not None and payload.password.strip():
        target_user.hashed_password = get_password_hash(payload.password.strip())

    await db.commit()
    await db.refresh(target_user)
    return UserResponse.model_validate(target_user)


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    role_update: UserUpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """
    Обновление роли пользователя:
    - Суперадминистратор может назначать любую роль ('superadmin', 'admin', 'department_head', 'employee').
    - Администратор может переключать между 'admin', 'department_head' и 'employee'.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    # Guard: admin cannot modify superadmin
    if target_user.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может редактировать учетные записи суперадминов",
        )

    # Guard: admin cannot grant superadmin role
    if role_update.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может назначать роль суперадминистратора",
        )

    # Guard: cannot demote self if superadmin and sole superadmin
    if target_user.id == current_user.id and target_user.role == "superadmin" and role_update.role != "superadmin":
        count_res = await db.execute(select(User).where(User.role == "superadmin"))
        superadmins = count_res.scalars().all()
        if len(superadmins) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя понизить единственного суперадминистратора системы",
            )

    target_user.role = role_update.role
    await db.commit()
    await db.refresh(target_user)
    return UserResponse.model_validate(target_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """Удаление пользователя (суперадминистратор, администратор или руководитель отдела для сотрудников своего отдела)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить собственный аккаунт",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if current_user.role == "department_head":
        is_same_dept = (
            (target_user.department_id and target_user.department_id == current_user.department_id)
            or (target_user.department and target_user.department == current_user.department)
        )
        if not is_same_dept or target_user.role != "employee":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Руководитель отдела может удалять только рядовых сотрудников своего отдела",
            )
    elif current_user.role == "admin":
        if target_user.role in ["superadmin", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Администратор не может удалять администраторов или суперадминистратора",
            )

    await db.delete(target_user)
    await db.commit()
    return None


# ==============================================================================
# УВЕДОМЛЕНИЯ И ПРИВЯЗКА TELEGRAM ДЛЯ АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
# ==============================================================================

@router.get("/me/notifications", response_model=dict)
async def get_my_notifications(current_user: User = Depends(get_current_user)):
    """Получить текущие настройки уведомлений и статус Telegram."""
    bot_name = (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@")
    return {
        "notify_email": current_user.notify_email,
        "notify_telegram": current_user.notify_telegram,
        "telegram_connected": bool(current_user.telegram_chat_id),
        "telegram_username": current_user.telegram_username,
        "bot_configured": bool(settings.TELEGRAM_BOT_TOKEN),
        "bot_username": bot_name,
    }


@router.put("/me/notifications", response_model=dict)
async def update_my_notifications(
    payload: NotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление тумблеров уведомлений (Email / Telegram)."""
    if payload.notify_email is not None:
        current_user.notify_email = payload.notify_email
    if payload.notify_telegram is not None:
        current_user.notify_telegram = payload.notify_telegram
    await db.commit()
    await db.refresh(current_user)
    bot_name = (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@")
    return {
        "status": "success",
        "notify_email": current_user.notify_email,
        "notify_telegram": current_user.notify_telegram,
        "telegram_connected": bool(current_user.telegram_chat_id),
        "telegram_username": current_user.telegram_username,
        "bot_configured": bool(settings.TELEGRAM_BOT_TOKEN),
        "bot_username": bot_name,
    }


@router.post("/me/telegram/generate-code", response_model=TelegramLinkCodeResponse)
async def generate_my_telegram_code(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Генерация 4-значного кода для привязки Telegram бота."""
    from app.core.telegram import generate_telegram_link_code
    from datetime import datetime, timezone, timedelta

    code = generate_telegram_link_code()
    current_user.telegram_link_code = code
    current_user.telegram_link_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    await db.commit()

    bot_name = (settings.TELEGRAM_BOT_USERNAME or "").lstrip("@")
    deep_link = f"https://t.me/{bot_name}?start={code}" if bot_name else None

    return TelegramLinkCodeResponse(
        code=code,
        bot_username=bot_name,
        deep_link=deep_link,
        expires_in_seconds=900,
    )


@router.delete("/me/telegram", status_code=status.HTTP_200_OK)
async def unlink_my_telegram(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отвязать Telegram от текущего аккаунта."""
    current_user.telegram_chat_id = None
    current_user.telegram_username = None
    current_user.telegram_link_code = None
    current_user.telegram_link_expires_at = None
    current_user.notify_telegram = False
    await db.commit()
    return {"status": "unlinked", "message": "Telegram успешно отключен"}


@router.get("/{user_id}/statistics", response_model=UserFullStatisticsResponse)
async def get_user_statistics(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Полная статистика по пользователю (все курсы, тесты, аттестации, пройденные им).
    - Администратор и суперадминистратор видят любого сотрудника.
    - Начальник отдела видит сотрудников своего отдела (и себя).
    - Сотрудник может просматривать только свою личную статистику.
    """
    from sqlalchemy.orm import selectinload
    from app.models.attempt import Attempt
    from app.models.course import (
        Course,
        CourseModule,
        CourseLesson,
        UserCourseEnrollment,
        CourseAssignment,
        UserLessonProgress,
    )

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Проверка прав доступа
    if current_user.role == "department_head":
        is_same_dept = False
        if current_user.department_id and target.department_id:
            is_same_dept = (current_user.department_id == target.department_id)
        elif current_user.department and target.department:
            is_same_dept = (current_user.department.strip().lower() == target.department.strip().lower())
        if not is_same_dept and target.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Вы можете просматривать статистику только сотрудников своего отдела",
            )
    elif current_user.role not in ["admin", "superadmin"]:
        if current_user.id != target.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для просмотра чужой статистики",
            )

    # 1. Курсы: получаем зачисления и назначения
    enroll_stmt = (
        select(UserCourseEnrollment)
        .options(
            selectinload(UserCourseEnrollment.course)
            .selectinload(Course.modules)
            .selectinload(CourseModule.lessons)
        )
        .where(UserCourseEnrollment.user_id == target.id)
    )
    enroll_res = await db.execute(enroll_stmt)
    enrollments = enroll_res.scalars().all()
    enroll_map = {e.course_id: e for e in enrollments}

    assign_stmt = (
        select(CourseAssignment)
        .options(
            selectinload(CourseAssignment.course)
            .selectinload(Course.modules)
            .selectinload(CourseModule.lessons)
        )
        .where(CourseAssignment.user_id == target.id)
    )
    assign_res = await db.execute(assign_stmt)
    assignments = assign_res.scalars().all()
    assign_map = {a.course_id: a for a in assignments}

    # Завершенные уроки пользователя
    prog_stmt = select(UserLessonProgress.lesson_id).where(
        UserLessonProgress.user_id == target.id,
        UserLessonProgress.status == "completed",
    )
    prog_res = await db.execute(prog_stmt)
    completed_lesson_ids = set(prog_res.scalars().all())

    all_course_ids = sorted(list(set(enroll_map.keys()).union(set(assign_map.keys()))))
    courses_stat_list: List[UserCourseStatItem] = []
    completed_courses_count = 0
    in_progress_courses_count = 0

    for cid in all_course_ids:
        enr = enroll_map.get(cid)
        asg = assign_map.get(cid)
        c_obj = (enr.course if enr else None) or (asg.course if asg else None)
        if not c_obj:
            continue

        all_lessons = []
        for m in getattr(c_obj, "modules", []):
            all_lessons.extend(getattr(m, "lessons", []))
        total_lessons_cnt = len(all_lessons)
        comp_lessons_cnt = sum(1 for les in all_lessons if les.id in completed_lesson_ids)

        if total_lessons_cnt > 0:
            calc_percent = int((comp_lessons_cnt / total_lessons_cnt) * 100)
        else:
            calc_percent = enr.progress_percent if enr else (100 if (asg and asg.is_completed) else 0)

        if calc_percent >= 100 or (enr and enr.status == "completed") or (asg and asg.is_completed):
            c_status = "completed"
            completed_courses_count += 1
        elif calc_percent > 0 or (enr and enr.status == "in_progress"):
            c_status = "in_progress"
            in_progress_courses_count += 1
        else:
            c_status = "not_started"

        courses_stat_list.append(
            UserCourseStatItem(
                course_id=c_obj.id,
                title=c_obj.title,
                cover_image_url=c_obj.cover_image_url,
                status=c_status,
                progress_percent=calc_percent,
                enrolled_at=enr.enrolled_at if enr else (asg.assigned_at if asg else None),
                completed_at=enr.completed_at if enr else None,
                deadline=asg.deadline if asg else None,
                total_lessons=total_lessons_cnt,
                completed_lessons=comp_lessons_cnt,
            )
        )

    # 2. Тесты и аттестации
    att_stmt = (
        select(Attempt)
        .options(selectinload(Attempt.test))
        .where(Attempt.user_id == target.id)
        .order_by(Attempt.started_at.desc())
    )
    att_res = await db.execute(att_stmt)
    attempts = att_res.scalars().all()

    tests_stat_list: List[UserTestStatItem] = []
    attestations_stat_list: List[UserAttestationStatItem] = []

    for a in attempts:
        if not a.test:
            continue
        time_spent = None
        if a.submitted_at and a.started_at:
            time_spent = int((a.submitted_at - a.started_at).total_seconds())

        pct = round((a.score / a.max_score * 100), 1) if a.max_score > 0 else 0.0

        if a.test.is_exam:
            attestations_stat_list.append(
                UserAttestationStatItem(
                    attempt_id=a.id,
                    test_id=a.test.id,
                    test_title=a.test.title,
                    status=a.status,
                    score=a.score,
                    max_score=a.max_score,
                    percentage=pct,
                    started_at=a.started_at,
                    submitted_at=a.submitted_at,
                    time_spent_seconds=time_spent,
                    category_before=a.category_before,
                    category_after=a.category_after,
                    category_action=a.category_action,
                )
            )
        else:
            tests_stat_list.append(
                UserTestStatItem(
                    attempt_id=a.id,
                    test_id=a.test.id,
                    test_title=a.test.title,
                    status=a.status,
                    score=a.score,
                    max_score=a.max_score,
                    percentage=pct,
                    started_at=a.started_at,
                    submitted_at=a.submitted_at,
                    time_spent_seconds=time_spent,
                )
            )

    summary = UserStatisticsSummary(
        total_courses=len(courses_stat_list),
        completed_courses=completed_courses_count,
        in_progress_courses=in_progress_courses_count,
        total_tests=len(tests_stat_list),
        total_attestations=len(attestations_stat_list),
        current_category=target.category or 1,
    )

    return UserFullStatisticsResponse(
        user=UserResponse.model_validate(target),
        summary=summary,
        courses=courses_stat_list,
        tests=tests_stat_list,
        attestations=attestations_stat_list,
    )
