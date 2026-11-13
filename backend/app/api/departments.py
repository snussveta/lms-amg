from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.department import Department
from app.models.user import User
from app.schemas.department import (
    DepartmentAssignHeadRequest,
    DepartmentCreate,
    DepartmentHeadInfo,
    DepartmentResponse,
    DepartmentUpdate,
)

router = APIRouter(prefix="/departments", tags=["Departments Management"])


@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получение списка всех отделов компании с информацией о руководителе
    и количестве прикрепленных сотрудников.
    Доступно всем авторизованным пользователям для фильтров и выпадающих списков.
    """
    # 1. Fetch departments with head relationship
    dept_stmt = (
        select(Department)
        .options(selectinload(Department.head))
        .order_by(Department.id.asc())
    )
    dept_res = await db.execute(dept_stmt)
    depts = dept_res.scalars().all()

    # 2. Get user counts per department
    count_stmt = (
        select(
            Department.id,
            func.count(User.id).label("users_count"),
        )
        .outerjoin(
            User,
            (User.department_id == Department.id) | (User.department == Department.name),
        )
        .group_by(Department.id)
    )
    count_res = await db.execute(count_stmt)
    count_map = {d_id: c for d_id, c in count_res.all()}

    # 3. Fallback check for active department_heads if head_id is not set
    head_stmt = select(User).where(User.role == "department_head", User.is_active.is_(True))
    head_res = await db.execute(head_stmt)
    active_heads = head_res.scalars().all()
    fallback_head_by_dept_id = {h.department_id: h for h in active_heads if h.department_id}
    fallback_head_by_dept_name = {h.department.lower(): h for h in active_heads if h.department}

    output = []
    for dept in depts:
        head_user = dept.head
        if not head_user:
            head_user = fallback_head_by_dept_id.get(dept.id) or fallback_head_by_dept_name.get(dept.name.lower())

        head_info = None
        if head_user:
            head_info = DepartmentHeadInfo(
                id=head_user.id,
                full_name=head_user.full_name,
                email=head_user.email,
                role=head_user.role,
            )

        output.append(
            DepartmentResponse(
                id=dept.id,
                name=dept.name,
                description=dept.description or "",
                head_id=head_user.id if head_user else None,
                head=head_info,
                created_at=dept.created_at,
                users_count=count_map.get(dept.id, 0),
            )
        )
    return output


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Создание нового отдела компании (только для администраторов)."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Название отдела не может быть пустым",
        )

    # Check for existing department with this name
    existing = await db.execute(select(Department).where(Department.name.ilike(name_clean)))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Отдел «{name_clean}» уже существует",
        )

    head_user = None
    if payload.head_id:
        h_res = await db.execute(select(User).where(User.id == payload.head_id))
        head_user = h_res.scalar_one_or_none()
        if head_user and head_user.role == "employee":
            head_user.role = "department_head"

    dept = Department(
        name=name_clean,
        description=payload.description.strip() if payload.description else "",
        head_id=head_user.id if head_user else None,
    )
    db.add(dept)
    await db.flush()

    if head_user:
        head_user.department_id = dept.id
        head_user.department = dept.name

    await db.commit()
    await db.refresh(dept)

    head_info = None
    if head_user:
        head_info = DepartmentHeadInfo(
            id=head_user.id,
            full_name=head_user.full_name,
            email=head_user.email,
            role=head_user.role,
        )

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description or "",
        head_id=dept.head_id,
        head=head_info,
        created_at=dept.created_at,
        users_count=1 if head_user else 0,
    )


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Редактирование названия, описания и руководителя отдела."""
    res = await db.execute(select(Department).where(Department.id == department_id))
    dept = res.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Отдел не найден",
        )

    old_name = dept.name
    if payload.name is not None and payload.name.strip():
        new_name = payload.name.strip()
        if new_name.lower() != dept.name.lower():
            dup = await db.execute(select(Department).where(Department.name.ilike(new_name)))
            if dup.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Отдел с названием «{new_name}» уже существует",
                )
        dept.name = new_name

        # Update users text department if they were linked by name
        user_stmt = select(User).where((User.department_id == dept.id) | (User.department == old_name))
        u_res = await db.execute(user_stmt)
        for u in u_res.scalars().all():
            u.department = new_name
            u.department_id = dept.id

    if payload.description is not None:
        dept.description = payload.description.strip()

    if payload.head_id is not None:
        if payload.head_id == 0 or payload.head_id == -1:
            # Clear head
            dept.head_id = None
        else:
            h_res = await db.execute(select(User).where(User.id == payload.head_id))
            target_user = h_res.scalar_one_or_none()
            if target_user:
                if target_user.role == "employee":
                    target_user.role = "department_head"
                target_user.department_id = dept.id
                target_user.department = dept.name
                dept.head_id = target_user.id

    await db.commit()
    await db.refresh(dept)

    # Get users count and head info
    count_res = await db.execute(
        select(func.count(User.id)).where((User.department_id == dept.id) | (User.department == dept.name))
    )
    users_count = count_res.scalar() or 0

    head_user = None
    if dept.head_id:
        h_res = await db.execute(select(User).where(User.id == dept.head_id))
        head_user = h_res.scalar_one_or_none()

    head_info = None
    if head_user:
        head_info = DepartmentHeadInfo(
            id=head_user.id,
            full_name=head_user.full_name,
            email=head_user.email,
            role=head_user.role,
        )

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description or "",
        head_id=dept.head_id,
        head=head_info,
        created_at=dept.created_at,
        users_count=users_count,
    )


@router.post("/{department_id}/head", response_model=DepartmentResponse)
@router.put("/{department_id}/head", response_model=DepartmentResponse)
async def assign_department_head(
    department_id: int,
    payload: DepartmentAssignHeadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """
    Назначение или снятие руководителя отдела.
    При передаче user_id: назначает указанного пользователя руководителем данного отдела.
    При передаче user_id = null: снимает руководителя с отдела.
    """
    res = await db.execute(select(Department).where(Department.id == department_id))
    dept = res.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Отдел не найден",
        )

    prev_head_id = dept.head_id

    if payload.user_id:
        u_res = await db.execute(select(User).where(User.id == payload.user_id))
        new_head = u_res.scalar_one_or_none()
        if not new_head:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Пользователь для назначения руководителем не найден",
            )

        # If previous head was someone else, return their role to employee
        if prev_head_id and prev_head_id != new_head.id:
            old_h_res = await db.execute(select(User).where(User.id == prev_head_id))
            old_head = old_h_res.scalar_one_or_none()
            if old_head and old_head.role == "department_head":
                old_head.role = "employee"

        # Demote any other department_head users attached to this department
        other_heads_stmt = select(User).where(
            User.role == "department_head",
            User.id != new_head.id,
            (User.department_id == dept.id) | (User.department == dept.name),
        )
        other_heads_res = await db.execute(other_heads_stmt)
        for oh in other_heads_res.scalars().all():
            oh.role = "employee"

        # Promote target user if they are employee
        if new_head.role == "employee":
            new_head.role = "department_head"

        new_head.department_id = dept.id
        new_head.department = dept.name
        dept.head_id = new_head.id
    else:
        # Unassign head
        if prev_head_id:
            old_h_res = await db.execute(select(User).where(User.id == prev_head_id))
            old_head = old_h_res.scalar_one_or_none()
            if old_head and old_head.role == "department_head":
                old_head.role = "employee"

        other_heads_stmt = select(User).where(
            User.role == "department_head",
            (User.department_id == dept.id) | (User.department == dept.name),
        )
        other_heads_res = await db.execute(other_heads_stmt)
        for oh in other_heads_res.scalars().all():
            oh.role = "employee"

        dept.head_id = None

    await db.commit()
    await db.refresh(dept)

    # Get users count and head info
    count_res = await db.execute(
        select(func.count(User.id)).where((User.department_id == dept.id) | (User.department == dept.name))
    )
    users_count = count_res.scalar() or 0

    head_user = None
    if dept.head_id:
        h_res = await db.execute(select(User).where(User.id == dept.head_id))
        head_user = h_res.scalar_one_or_none()

    head_info = None
    if head_user:
        head_info = DepartmentHeadInfo(
            id=head_user.id,
            full_name=head_user.full_name,
            email=head_user.email,
            role=head_user.role,
        )

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description or "",
        head_id=dept.head_id,
        head=head_info,
        created_at=dept.created_at,
        users_count=users_count,
    )


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    department_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Удаление отдела компании."""
    res = await db.execute(select(Department).where(Department.id == department_id))
    dept = res.scalar_one_or_none()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Отдел не найден",
        )

    # Detach users from this department safely
    user_stmt = select(User).where((User.department_id == dept.id) | (User.department == dept.name))
    u_res = await db.execute(user_stmt)
    for u in u_res.scalars().all():
        u.department_id = None
        u.department = None
        if u.role == "department_head":
            u.role = "employee"

    await db.delete(dept)
    await db.commit()
    return None
