from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentResponse, DepartmentUpdate

router = APIRouter(prefix="/departments", tags=["Departments Management"])


@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получение списка всех отделов компании с количеством прикрепленных сотрудников.
    Доступно всем авторизованным пользователям для фильтров и выпадающих списков.
    """
    stmt = (
        select(
            Department,
            func.count(User.id).label("users_count"),
        )
        .outerjoin(
            User,
            (User.department_id == Department.id) | (User.department == Department.name),
        )
        .group_by(Department.id)
        .order_by(Department.id.asc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    output = []
    for dept, count in rows:
        output.append(
            DepartmentResponse(
                id=dept.id,
                name=dept.name,
                description=dept.description or "",
                created_at=dept.created_at,
                users_count=count,
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

    dept = Department(
        name=name_clean,
        description=payload.description.strip() if payload.description else "",
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description or "",
        created_at=dept.created_at,
        users_count=0,
    )


@router.put("/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: int,
    payload: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Редактирование названия и описания отдела."""
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
            # Check uniqueness
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

    await db.commit()
    await db.refresh(dept)

    # Get users count
    count_res = await db.execute(
        select(func.count(User.id)).where((User.department_id == dept.id) | (User.department == dept.name))
    )
    users_count = count_res.scalar() or 0

    return DepartmentResponse(
        id=dept.id,
        name=dept.name,
        description=dept.description or "",
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
    user_stmt = select(User).where(User.department_id == dept.id)
    u_res = await db.execute(user_stmt)
    for u in u_res.scalars().all():
        u.department_id = None
        u.department = "Общий"

    await db.delete(dept)
    await db.commit()
    return None

