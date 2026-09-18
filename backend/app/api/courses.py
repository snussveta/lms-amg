from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.course import (
    Course,
    CourseModule,
    CourseLesson,
    UserCourseEnrollment,
    UserLessonProgress,
    CourseAssignment,
)
from app.models.test import Test
from app.models.attempt import Attempt
from app.models.user import User
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseListItemResponse,
    CourseDetailResponse,
    CourseModuleCreate,
    CourseModuleUpdate,
    CourseModuleResponse,
    CourseLessonCreate,
    CourseLessonUpdate,
    CourseLessonResponse,
    CourseReorderRequest,
    CourseLearnResponse,
    CourseLearnModuleItem,
    CourseLearnLessonItem,
    LessonProgressUpdate,
    CourseAssignRequest,
    CourseAssignedUserItem,
    CourseAssignedUsersResponse,
)

router = APIRouter(prefix="/courses", tags=["Courses"])


# ==========================================
# 1. COURSES LIST & CRUD (ADMIN / EMPLOYEE)
# ==========================================

@router.get("", response_model=List[CourseListItemResponse])
async def get_courses(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List courses:
    - Employees see only published courses (with their enrollment/progress state).
    - Admins see all courses (published & drafts) across departments.
    """
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(CourseModule.lessons),
            selectinload(Course.author),
        )
        .order_by(Course.created_at.desc())
    )

    if current_user.role == "employee":
        stmt = stmt.where(Course.is_published == True)
        if department and department != "Все":
            stmt = stmt.where(
                (Course.department_tag == department) | (Course.department_tag == "Общий")
            )
    else:
        if department and department != "Все":
            stmt = stmt.where(Course.department_tag == department)

    result = await db.execute(stmt)
    courses = result.scalars().all()

    # If employee, fetch enrollments and personal assignments
    enrollments_map = {}
    assignments_map = {}
    if current_user.role == "employee":
        enr_stmt = select(UserCourseEnrollment).where(UserCourseEnrollment.user_id == current_user.id)
        enr_res = await db.execute(enr_stmt)
        for enr in enr_res.scalars().all():
            enrollments_map[enr.course_id] = enr

        assign_stmt = select(CourseAssignment).where(CourseAssignment.user_id == current_user.id)
        assign_res = await db.execute(assign_stmt)
        for a in assign_res.scalars().all():
            assignments_map[a.course_id] = a

    response_items = []
    for c in courses:
        modules_cnt = len(c.modules)
        lessons_cnt = sum(len(m.lessons) for m in c.modules)
        
        user_status = "not_started"
        user_progress_percent = 0
        if c.id in enrollments_map:
            user_status = enrollments_map[c.id].status
            user_progress_percent = enrollments_map[c.id].progress_percent

        assignment = assignments_map.get(c.id)
        is_assigned = assignment is not None
        deadline = assignment.deadline if assignment else None

        response_items.append(
            CourseListItemResponse(
                id=c.id,
                title=c.title,
                description=c.description or "",
                department_tag=c.department_tag,
                cover_image_url=c.cover_image_url,
                is_published=c.is_published,
                is_public=c.is_public,
                author_id=c.author_id,
                author_name=c.author.full_name if c.author else None,
                modules_count=modules_cnt,
                lessons_count=lessons_cnt,
                created_at=c.created_at,
                updated_at=c.updated_at,
                user_status=user_status,
                user_progress_percent=user_progress_percent,
                is_assigned=is_assigned,
                assignment_deadline=deadline,
            )
        )

    return response_items


@router.get("/my", response_model=List[CourseListItemResponse])
async def get_my_courses(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns courses available to the employee:
    Only published courses that are either:
    1. Assigned personally to this employee in course_assignments, OR
    2. Open/public courses where is_public == True.
    """
    # 1. Fetch personal assignments
    assign_stmt = select(CourseAssignment).where(CourseAssignment.user_id == current_user.id)
    assign_res = await db.execute(assign_stmt)
    assignments = assign_res.scalars().all()
    assignments_map = {a.course_id: a for a in assignments}
    assigned_course_ids = list(assignments_map.keys())

    # 2. Build course filter: must be published and (is_public OR id in assigned_course_ids)
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(CourseModule.lessons),
            selectinload(Course.author),
        )
        .where(Course.is_published == True)
    )

    if assigned_course_ids:
        stmt = stmt.where((Course.is_public == True) | (Course.id.in_(assigned_course_ids)))
    else:
        stmt = stmt.where(Course.is_public == True)

    if department and department != "Все":
        stmt = stmt.where((Course.department_tag == department) | (Course.department_tag == "Общий"))

    stmt = stmt.order_by(Course.created_at.desc())
    result = await db.execute(stmt)
    courses = result.scalars().all()

    # 3. Load enrollments for progress
    enr_stmt = select(UserCourseEnrollment).where(UserCourseEnrollment.user_id == current_user.id)
    enr_res = await db.execute(enr_stmt)
    enrollments_map = {e.course_id: e for e in enr_res.scalars().all()}

    response_items = []
    for c in courses:
        modules_cnt = len(c.modules)
        lessons_cnt = sum(len(m.lessons) for m in c.modules)
        
        user_status = "not_started"
        user_progress_percent = 0
        if c.id in enrollments_map:
            user_status = enrollments_map[c.id].status
            user_progress_percent = enrollments_map[c.id].progress_percent

        assignment = assignments_map.get(c.id)
        is_assigned = assignment is not None
        deadline = assignment.deadline if assignment else None

        response_items.append(
            CourseListItemResponse(
                id=c.id,
                title=c.title,
                description=c.description or "",
                department_tag=c.department_tag,
                cover_image_url=c.cover_image_url,
                is_published=c.is_published,
                is_public=c.is_public,
                author_id=c.author_id,
                author_name=c.author.full_name if c.author else None,
                modules_count=modules_cnt,
                lessons_count=lessons_cnt,
                created_at=c.created_at,
                updated_at=c.updated_at,
                user_status=user_status,
                user_progress_percent=user_progress_percent,
                is_assigned=is_assigned,
                assignment_deadline=deadline,
            )
        )

    # Sort: assigned first, then by deadline
    response_items.sort(key=lambda x: (not x.is_assigned, x.assignment_deadline or datetime.max.replace(tzinfo=timezone.utc)))

    return response_items


@router.post("", response_model=CourseDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Create a new training course (draft by default)."""
    new_course = Course(
        title=payload.title,
        description=payload.description or "",
        department_tag=payload.department_tag,
        cover_image_url=payload.cover_image_url,
        is_published=payload.is_published,
        is_public=payload.is_public if payload.is_public is not None else True,
        author_id=current_user.id,
    )
    db.add(new_course)
    await db.commit()
    await db.refresh(new_course)

    # Automatically add a default first module for convenience
    first_module = CourseModule(
        course_id=new_course.id,
        title="Раздел 1: Введение",
        order_index=0,
    )
    db.add(first_module)
    await db.commit()

    # Re-query with eager loads
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(CourseModule.lessons),
            selectinload(Course.author),
        )
        .where(Course.id == new_course.id)
    )
    res = await db.execute(stmt)
    full_course = res.scalar_one()

    return full_course


@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course_detail(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full course structure for editor or viewer."""
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(CourseModule.lessons).selectinload(CourseLesson.quiz),
            selectinload(Course.author),
        )
        .where(Course.id == course_id)
    )
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    # Serialize modules and lessons with quiz details
    modules_out = []
    for mod in sorted(course.modules, key=lambda m: m.order_index):
        lessons_out = []
        for les in sorted(mod.lessons, key=lambda l: l.order_index):
            lessons_out.append(
                CourseLessonResponse(
                    id=les.id,
                    module_id=les.module_id,
                    title=les.title,
                    order_index=les.order_index,
                    lesson_type=les.lesson_type,
                    content_json=les.content_json,
                    file_url=les.file_url,
                    file_size_bytes=les.file_size_bytes,
                    quiz_id=les.quiz_id,
                    quiz_title=les.quiz.title if les.quiz else None,
                    quiz_passing_score=les.quiz.passing_score if les.quiz else None,
                )
            )
        modules_out.append(
            CourseModuleResponse(
                id=mod.id,
                course_id=mod.course_id,
                title=mod.title,
                order_index=mod.order_index,
                lessons=lessons_out,
            )
        )

    return CourseDetailResponse(
        id=course.id,
        title=course.title,
        description=course.description or "",
        department_tag=course.department_tag,
        cover_image_url=course.cover_image_url,
        is_published=course.is_published,
        is_public=course.is_public,
        author_id=course.author_id,
        author_name=course.author.full_name if course.author else None,
        created_at=course.created_at,
        updated_at=course.updated_at,
        modules=modules_out,
    )


@router.put("/{course_id}", response_model=CourseDetailResponse)
async def update_course(
    course_id: int,
    payload: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Update course basic properties (title, description, department, published, is_public)."""
    stmt = select(Course).where(Course.id == course_id)
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    if payload.title is not None:
        course.title = payload.title
    if payload.description is not None:
        course.description = payload.description
    if payload.department_tag is not None:
        course.department_tag = payload.department_tag
    if payload.cover_image_url is not None:
        course.cover_image_url = payload.cover_image_url
    if payload.is_published is not None:
        course.is_published = payload.is_published
    if payload.is_public is not None:
        course.is_public = payload.is_public

    course.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return await get_course_detail(course_id, db, current_user)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Delete a course and cascade its modules, lessons, and enrollment records."""
    stmt = select(Course).where(Course.id == course_id)
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    await db.delete(course)
    await db.commit()
    return None


# ==========================================
# 2. MODULES MANAGEMENT
# ==========================================

@router.post("/{course_id}/modules", response_model=CourseModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(
    course_id: int,
    payload: CourseModuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Add a new module to a course."""
    # Find next order index
    count_stmt = select(func.count(CourseModule.id)).where(CourseModule.course_id == course_id)
    count_res = await db.execute(count_stmt)
    order_idx = payload.order_index or count_res.scalar() or 0

    new_mod = CourseModule(
        course_id=course_id,
        title=payload.title,
        order_index=order_idx,
    )
    db.add(new_mod)
    await db.commit()
    await db.refresh(new_mod)

    return CourseModuleResponse(
        id=new_mod.id,
        course_id=new_mod.course_id,
        title=new_mod.title,
        order_index=new_mod.order_index,
        lessons=[],
    )


@router.put("/{course_id}/modules/{module_id}", response_model=CourseModuleResponse)
async def update_module(
    course_id: int,
    module_id: int,
    payload: CourseModuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Update module title or order."""
    stmt = select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id)
    res = await db.execute(stmt)
    mod = res.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Модуль не найден")

    if payload.title is not None:
        mod.title = payload.title
    if payload.order_index is not None:
        mod.order_index = payload.order_index

    await db.commit()
    await db.refresh(mod)
    return mod


@router.delete("/{course_id}/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    course_id: int,
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Delete a module and all its lessons."""
    stmt = select(CourseModule).where(CourseModule.id == module_id, CourseModule.course_id == course_id)
    res = await db.execute(stmt)
    mod = res.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Модуль не найден")

    await db.delete(mod)
    await db.commit()
    return None


# ==========================================
# 3. LESSONS MANAGEMENT
# ==========================================

@router.post("/{course_id}/modules/{module_id}/lessons", response_model=CourseLessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    course_id: int,
    module_id: int,
    payload: CourseLessonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Add a new lesson (longread, video, presentation, or quiz) to a module."""
    # Find next order index
    count_stmt = select(func.count(CourseLesson.id)).where(CourseLesson.module_id == module_id)
    count_res = await db.execute(count_stmt)
    order_idx = payload.order_index or count_res.scalar() or 0

    new_lesson = CourseLesson(
        module_id=module_id,
        title=payload.title,
        order_index=order_idx,
        lesson_type=payload.lesson_type,
        content_json=payload.content_json or "[]",
        file_url=payload.file_url,
        file_size_bytes=payload.file_size_bytes,
        quiz_id=payload.quiz_id,
    )
    db.add(new_lesson)
    await db.commit()
    await db.refresh(new_lesson)

    quiz_title = None
    quiz_pass = None
    if new_lesson.quiz_id:
        q_res = await db.execute(select(Test).where(Test.id == new_lesson.quiz_id))
        quiz_obj = q_res.scalar_one_or_none()
        if quiz_obj:
            quiz_title = quiz_obj.title
            quiz_pass = quiz_obj.passing_score

    return CourseLessonResponse(
        id=new_lesson.id,
        module_id=new_lesson.module_id,
        title=new_lesson.title,
        order_index=new_lesson.order_index,
        lesson_type=new_lesson.lesson_type,
        content_json=new_lesson.content_json,
        file_url=new_lesson.file_url,
        file_size_bytes=new_lesson.file_size_bytes,
        quiz_id=new_lesson.quiz_id,
        quiz_title=quiz_title,
        quiz_passing_score=quiz_pass,
    )


@router.put("/{course_id}/lessons/{lesson_id}", response_model=CourseLessonResponse)
@router.patch("/{course_id}/lessons/{lesson_id}", response_model=CourseLessonResponse)
@router.put("/lessons/{lesson_id}", response_model=CourseLessonResponse)
@router.patch("/lessons/{lesson_id}", response_model=CourseLessonResponse)
async def update_lesson(
    lesson_id: int,
    payload: CourseLessonUpdate,
    course_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Update lesson content, video/pdf URL, or attached quiz."""
    stmt = (
        select(CourseLesson)
        .options(selectinload(CourseLesson.quiz))
        .where(CourseLesson.id == lesson_id)
    )
    res = await db.execute(stmt)
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Урок не найден")

    if payload.title is not None:
        lesson.title = payload.title
    if payload.order_index is not None:
        lesson.order_index = payload.order_index
    if payload.lesson_type is not None:
        lesson.lesson_type = payload.lesson_type
    if payload.content_json is not None:
        lesson.content_json = payload.content_json
    if payload.file_url is not None:
        clean_url = payload.file_url.strip() if isinstance(payload.file_url, str) and payload.file_url.strip() else None
        lesson.file_url = clean_url
        # Auto-adjust lesson type if media file is attached and type was generic article
        if clean_url:
            clean_url_lower = clean_url.lower()
            if "/videos/" in clean_url_lower or any(clean_url_lower.endswith(ext) for ext in [".mp4", ".webm", ".mkv", ".mov"]):
                if lesson.lesson_type in ["article", ""]:
                    lesson.lesson_type = "video"
            elif "/presentations/" in clean_url_lower or clean_url_lower.endswith(".pdf"):
                if lesson.lesson_type in ["article", ""]:
                    lesson.lesson_type = "presentation"
    if payload.file_size_bytes is not None:
        lesson.file_size_bytes = payload.file_size_bytes
    if payload.quiz_id is not None:
        lesson.quiz_id = payload.quiz_id if payload.quiz_id > 0 else None

    await db.commit()
    await db.refresh(lesson)

    # Re-fetch with quiz relation
    res = await db.execute(
        select(CourseLesson).options(selectinload(CourseLesson.quiz)).where(CourseLesson.id == lesson.id)
    )
    lesson = res.scalar_one()

    return CourseLessonResponse(
        id=lesson.id,
        module_id=lesson.module_id,
        title=lesson.title,
        order_index=lesson.order_index,
        lesson_type=lesson.lesson_type,
        content_json=lesson.content_json,
        file_url=lesson.file_url,
        file_size_bytes=lesson.file_size_bytes,
        quiz_id=lesson.quiz_id,
        quiz_title=lesson.quiz.title if lesson.quiz else None,
        quiz_passing_score=lesson.quiz.passing_score if lesson.quiz else None,
    )


@router.delete("/{course_id}/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    course_id: int,
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Delete a lesson from module."""
    stmt = select(CourseLesson).where(CourseLesson.id == lesson_id)
    res = await db.execute(stmt)
    lesson = res.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Урок не найден")

    await db.delete(lesson)
    await db.commit()
    return None


@router.post("/{course_id}/reorder", status_code=status.HTTP_200_OK)
async def reorder_course(
    course_id: int,
    payload: CourseReorderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Update order indices of modules and lessons (e.g. after drag-and-drop)."""
    for m in payload.modules:
        await db.execute(
            CourseModule.__table__.update()
            .where(CourseModule.id == m.id, CourseModule.course_id == course_id)
            .values(order_index=m.order_index)
        )
    for l in payload.lessons:
        await db.execute(
            CourseLesson.__table__.update()
            .where(CourseLesson.id == l.id)
            .values(order_index=l.order_index, module_id=l.module_id)
        )
    await db.commit()
    return {"status": "reordered_successfully"}


# ==========================================
# 4. EMPLOYEE LEARNING PLAYER & STEP LOCKING
# ==========================================

@router.get("/{course_id}/learn", response_model=CourseLearnResponse)
async def get_course_learn_state(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns full iSpring Player structure for the employee.
    Enforces the sequential step-by-step lock rule:
    - Step 1 is unlocked.
    - Step N+1 is locked until Step N status == 'completed'.
    """
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(CourseModule.lessons).selectinload(CourseLesson.quiz),
        )
        .where(Course.id == course_id)
    )
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    # Ensure enrollment exists for user
    enr_stmt = select(UserCourseEnrollment).where(
        UserCourseEnrollment.user_id == current_user.id,
        UserCourseEnrollment.course_id == course_id,
    )
    enr_res = await db.execute(enr_stmt)
    enrollment = enr_res.scalar_one_or_none()
    if not enrollment:
        enrollment = UserCourseEnrollment(
            user_id=current_user.id,
            course_id=course_id,
            status="in_progress",
            progress_percent=0,
        )
        db.add(enrollment)
        await db.commit()

    # Load all user lesson progresses for this course
    prog_stmt = (
        select(UserLessonProgress)
        .join(CourseLesson, UserLessonProgress.lesson_id == CourseLesson.id)
        .join(CourseModule, CourseLesson.module_id == CourseModule.id)
        .where(
            UserLessonProgress.user_id == current_user.id,
            CourseModule.course_id == course_id,
        )
    )
    prog_res = await db.execute(prog_stmt)
    user_progress_map = {p.lesson_id: p for p in prog_res.scalars().all()}

    # Flatten all lessons in sequential order to apply lock rules
    sorted_modules = sorted(course.modules, key=lambda m: m.order_index)
    all_sequential_lessons = []
    for mod in sorted_modules:
        for les in sorted(mod.lessons, key=lambda l: l.order_index):
            all_sequential_lessons.append(les)

    total_lessons = len(all_sequential_lessons)
    completed_count = 0
    current_active_lesson_id = None

    # Step locking logic:
    # A lesson is unlocked if it's the very first lesson OR if previous lesson is completed.
    # If user is admin/superadmin, locks can be bypassed for review.
    is_admin_bypass = current_user.role in ["admin", "superadmin"]

    lesson_lock_status = {}
    prev_step_completed = True  # First step is always unlocked

    for idx, les in enumerate(all_sequential_lessons):
        prog = user_progress_map.get(les.id)
        is_completed = prog.status == "completed" if prog else False
        if is_completed:
            completed_count += 1

        is_locked = not prev_step_completed and not is_admin_bypass
        lesson_lock_status[les.id] = is_locked

        if not is_locked and not is_completed and current_active_lesson_id is None:
            current_active_lesson_id = les.id

        # For the next step to be unlocked, current step must be completed
        prev_step_completed = is_completed

    # If all completed or none selected, set current to first or last
    if current_active_lesson_id is None and all_sequential_lessons:
        current_active_lesson_id = all_sequential_lessons[0].id

    progress_percent = int((completed_count / total_lessons * 100)) if total_lessons > 0 else 0

    # Build response tree
    modules_payload = []
    for mod in sorted_modules:
        lessons_payload = []
        for les in sorted(mod.lessons, key=lambda l: l.order_index):
            prog = user_progress_map.get(les.id)
            les_status = prog.status if prog else "not_started"
            last_timestamp = prog.last_timestamp_seconds if prog else 0.0

            # Check if linked quiz has already been passed
            quiz_passed = False
            if les.quiz_id:
                quiz_pass_stmt = select(Attempt).where(
                    Attempt.user_id == current_user.id,
                    Attempt.test_id == les.quiz_id,
                    Attempt.is_passed == True,
                )
                q_pass_res = await db.execute(quiz_pass_stmt)
                if q_pass_res.scalar_one_or_none():
                    quiz_passed = True

            lessons_payload.append(
                CourseLearnLessonItem(
                    id=les.id,
                    module_id=les.module_id,
                    title=les.title,
                    order_index=les.order_index,
                    lesson_type=les.lesson_type,
                    content_json=les.content_json,
                    file_url=les.file_url,
                    file_size_bytes=les.file_size_bytes,
                    quiz_id=les.quiz_id,
                    quiz_title=les.quiz.title if les.quiz else None,
                    quiz_passing_score=les.quiz.passing_score if les.quiz else None,
                    quiz_has_passed=quiz_passed,
                    status=les_status,
                    last_timestamp_seconds=last_timestamp,
                    is_locked=lesson_lock_status.get(les.id, False),
                )
            )
        modules_payload.append(
            CourseLearnModuleItem(
                id=mod.id,
                title=mod.title,
                order_index=mod.order_index,
                lessons=lessons_payload,
            )
        )

    # Sync enrollment progress percent
    if enrollment.progress_percent != progress_percent:
        enrollment.progress_percent = progress_percent
        if progress_percent >= 100:
            enrollment.status = "completed"
            enrollment.completed_at = datetime.now(timezone.utc)
        elif progress_percent > 0:
            enrollment.status = "in_progress"
        await db.commit()

    return CourseLearnResponse(
        course_id=course.id,
        title=course.title,
        description=course.description or "",
        department_tag=course.department_tag,
        total_lessons=total_lessons,
        completed_lessons=completed_count,
        progress_percent=progress_percent,
        modules=modules_payload,
        current_lesson_id=current_active_lesson_id,
    )


@router.post("/{course_id}/lessons/{lesson_id}/progress")
async def update_lesson_progress(
    course_id: int,
    lesson_id: int,
    payload: LessonProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Saves current lesson playback offset (every 10s for video)
    and marks step as 'completed' when employee finishes reading/watching/testing.
    """
    stmt = (
        select(UserLessonProgress)
        .where(
            UserLessonProgress.user_id == current_user.id,
            UserLessonProgress.lesson_id == lesson_id,
        )
    )
    res = await db.execute(stmt)
    prog = res.scalar_one_or_none()

    if not prog:
        prog = UserLessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            status=payload.status or "in_progress",
            last_timestamp_seconds=payload.last_timestamp_seconds or 0.0,
        )
        db.add(prog)
    else:
        if payload.last_timestamp_seconds is not None:
            prog.last_timestamp_seconds = payload.last_timestamp_seconds
        if payload.status:
            # Only upgrade or preserve completed
            if payload.status == "completed":
                prog.status = "completed"
                prog.completed_at = datetime.now(timezone.utc)
            elif prog.status != "completed":
                prog.status = payload.status
        prog.updated_at = datetime.now(timezone.utc)

    await db.commit()

    # Recalculate total course completion
    return {"status": "saved", "lesson_id": lesson_id, "lesson_status": prog.status, "timestamp": prog.last_timestamp_seconds}


@router.post("/{course_id}/lessons/{lesson_id}/complete")
async def mark_lesson_complete(
    course_id: int,
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks a lesson as 'completed' for current employee.
    Recalculates total course completion percent and updates enrollment & assignment.
    """
    # 1. Update or create lesson progress
    prog_stmt = select(UserLessonProgress).where(
        UserLessonProgress.user_id == current_user.id,
        UserLessonProgress.lesson_id == lesson_id,
    )
    prog_res = await db.execute(prog_stmt)
    prog = prog_res.scalar_one_or_none()

    if not prog:
        prog = UserLessonProgress(
            user_id=current_user.id,
            lesson_id=lesson_id,
            status="completed",
            last_timestamp_seconds=0.0,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(prog)
    else:
        prog.status = "completed"
        prog.completed_at = datetime.now(timezone.utc)
        prog.updated_at = datetime.now(timezone.utc)

    await db.flush()

    # 2. Count total lessons in course and completed lessons for user
    total_lessons_stmt = (
        select(func.count(CourseLesson.id))
        .join(CourseModule, CourseLesson.module_id == CourseModule.id)
        .where(CourseModule.course_id == course_id)
    )
    total_res = await db.execute(total_lessons_stmt)
    total_lessons = total_res.scalar_one() or 0

    completed_stmt = (
        select(func.count(UserLessonProgress.id))
        .join(CourseLesson, UserLessonProgress.lesson_id == CourseLesson.id)
        .join(CourseModule, CourseLesson.module_id == CourseModule.id)
        .where(
            UserLessonProgress.user_id == current_user.id,
            CourseModule.course_id == course_id,
            UserLessonProgress.status == "completed",
        )
    )
    comp_res = await db.execute(completed_stmt)
    completed_lessons = comp_res.scalar_one() or 0

    progress_percent = int(completed_lessons / total_lessons * 100) if total_lessons > 0 else 100
    is_course_completed = progress_percent >= 100

    # 3. Update enrollment
    enr_stmt = select(UserCourseEnrollment).where(
        UserCourseEnrollment.user_id == current_user.id,
        UserCourseEnrollment.course_id == course_id,
    )
    enr_res = await db.execute(enr_stmt)
    enrollment = enr_res.scalar_one_or_none()
    if not enrollment:
        enrollment = UserCourseEnrollment(
            user_id=current_user.id,
            course_id=course_id,
            status="completed" if is_course_completed else "in_progress",
            progress_percent=progress_percent,
            completed_at=datetime.now(timezone.utc) if is_course_completed else None,
        )
        db.add(enrollment)
    else:
        enrollment.progress_percent = progress_percent
        if is_course_completed:
            enrollment.status = "completed"
            enrollment.completed_at = datetime.now(timezone.utc)
        elif progress_percent > 0:
            enrollment.status = "in_progress"

    # 4. If assignment exists, mark completed if 100%
    assign_stmt = select(CourseAssignment).where(
        CourseAssignment.course_id == course_id,
        CourseAssignment.user_id == current_user.id,
    )
    assign_res = await db.execute(assign_stmt)
    assignment = assign_res.scalar_one_or_none()
    if assignment and is_course_completed:
        assignment.is_completed = True

    await db.commit()

    return {
        "status": "completed",
        "lesson_id": lesson_id,
        "course_id": course_id,
        "progress_percent": progress_percent,
        "completed_lessons": completed_lessons,
        "total_lessons": total_lessons,
        "is_course_completed": is_course_completed,
    }


# ==========================================
# 5. COURSE ASSIGNMENT MANAGEMENT
# ==========================================

@router.post("/{course_id}/assign")
async def assign_course_to_users(
    course_id: int,
    payload: CourseAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """
    Assign a course to a list of employees.
    If already assigned, updates deadline.
    Also ensures user enrollment is initialized.
    """
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    if not payload.user_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Список сотрудников не может быть пустым")

    # Fetch existing assignments for this course and users
    existing_stmt = select(CourseAssignment).where(
        CourseAssignment.course_id == course_id,
        CourseAssignment.user_id.in_(payload.user_ids),
    )
    existing_res = await db.execute(existing_stmt)
    existing_map = {a.user_id: a for a in existing_res.scalars().all()}

    # Fetch existing enrollments
    enr_stmt = select(UserCourseEnrollment).where(
        UserCourseEnrollment.course_id == course_id,
        UserCourseEnrollment.user_id.in_(payload.user_ids),
    )
    enr_res = await db.execute(enr_stmt)
    enr_map = {e.user_id: e for e in enr_res.scalars().all()}

    for uid in payload.user_ids:
        if uid in existing_map:
            existing_map[uid].deadline = payload.deadline
            existing_map[uid].assigned_at = datetime.now(timezone.utc)
        else:
            new_assign = CourseAssignment(
                course_id=course_id,
                user_id=uid,
                assigned_by_id=current_user.id,
                assigned_at=datetime.now(timezone.utc),
                deadline=payload.deadline,
                is_completed=False,
            )
            db.add(new_assign)

        if uid not in enr_map:
            new_enr = UserCourseEnrollment(
                user_id=uid,
                course_id=course_id,
                status="not_started",
                progress_percent=0,
            )
            db.add(new_enr)

    await db.commit()
    return {
        "status": "assigned",
        "course_id": course_id,
        "assigned_count": len(payload.user_ids),
    }


@router.delete("/{course_id}/assign/{user_id}")
async def revoke_course_assignment(
    course_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """Revoke course assignment from an employee."""
    stmt = select(CourseAssignment).where(
        CourseAssignment.course_id == course_id,
        CourseAssignment.user_id == user_id,
    )
    res = await db.execute(stmt)
    assignment = res.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Назначение для данного сотрудника не найдено",
        )

    await db.delete(assignment)
    await db.commit()
    return {"status": "revoked", "course_id": course_id, "user_id": user_id}


@router.get("/{course_id}/assigned-users", response_model=CourseAssignedUsersResponse)
async def get_course_assigned_users(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "superadmin"])),
):
    """
    Get all employees assigned to this course, including their progress status,
    completion percent, branch/department, and deadline.
    """
    course_res = await db.execute(select(Course).where(Course.id == course_id))
    course = course_res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    stmt = (
        select(CourseAssignment)
        .options(selectinload(CourseAssignment.user))
        .where(CourseAssignment.course_id == course_id)
        .order_by(CourseAssignment.assigned_at.desc())
    )
    res = await db.execute(stmt)
    assignments = res.scalars().all()

    user_ids = [a.user_id for a in assignments]
    enr_map = {}
    if user_ids:
        enr_stmt = select(UserCourseEnrollment).where(
            UserCourseEnrollment.course_id == course_id,
            UserCourseEnrollment.user_id.in_(user_ids),
        )
        enr_res = await db.execute(enr_stmt)
        for e in enr_res.scalars().all():
            enr_map[e.user_id] = e

    items = []
    for a in assignments:
        u = a.user
        enr = enr_map.get(a.user_id)
        prog_pct = enr.progress_percent if enr else 0
        enr_status = enr.status if enr else "not_started"
        if a.is_completed:
            enr_status = "completed"

        items.append(
            CourseAssignedUserItem(
                id=a.id,
                user_id=a.user_id,
                full_name=u.full_name if u else f"User #{a.user_id}",
                email=u.email if u else "",
                branch=getattr(u, "branch", "AutoMall Центральный") if u else None,
                department=getattr(u, "department", "СТО") if u else None,
                assigned_at=a.assigned_at,
                deadline=a.deadline,
                is_completed=a.is_completed or (prog_pct >= 100),
                progress_percent=prog_pct,
                status=enr_status,
            )
        )

    return CourseAssignedUsersResponse(
        course_id=course_id,
        assigned_users=items,
    )
