from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash, require_role
from app.models.department import Department
from app.models.user import User
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserResponse, UserUpdateRole

router = APIRouter(prefix="/users", tags=["Users Management"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Список всех зарегистрированных сотрудников (для администратора и суперадмина)."""
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    payload: UserAdminCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """
    Регистрация нового сотрудника администратором:
    Администратор указывает ФИО, email (логин), пароль, филиал, отдел и роль.
    """
    email_clean = payload.email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email_clean))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email (логином) уже зарегистрирован в системе",
        )

    # Guard: admin cannot create superadmin
    if payload.role == "superadmin" and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только суперадминистратор может создавать учетные записи суперадминистратора",
        )

    # Department sync: check both department_id and department string
    dept_obj = None
    if payload.department_id is not None and payload.department_id > 0:
        dept_res = await db.execute(select(Department).where(Department.id == payload.department_id))
        dept_obj = dept_res.scalar_one_or_none()

    if not dept_obj and payload.department is not None and payload.department.strip():
        dept_res = await db.execute(select(Department).where(Department.name.ilike(payload.department.strip())))
        dept_obj = dept_res.scalar_one_or_none()

    dept_name = dept_obj.name if dept_obj else (payload.department.strip() if payload.department else "СТО")
    dept_id = dept_obj.id if dept_obj else None

    new_user = User(
        email=email_clean,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        branch=payload.branch.strip() if payload.branch else "AutoMall Центральный",
        department=dept_name,
        department_id=dept_id,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Обновление данных сотрудника (ФИО, филиал, отдел, роль, смена пароля)."""
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

    if payload.role is not None:
        if payload.role == "superadmin" and current_user.role != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Только суперадминистратор может назначать роль суперадминистратора",
            )
        target_user.role = payload.role

    if payload.full_name is not None and payload.full_name.strip():
        target_user.full_name = payload.full_name.strip()

    if payload.email is not None and payload.email.lower().strip() != target_user.email:
        # Check uniqueness
        dup = await db.execute(select(User).where(User.email == payload.email.lower().strip()))
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь с таким email уже существует",
            )
        target_user.email = payload.email.lower().strip()

    if payload.branch is not None:
        target_user.branch = payload.branch.strip()

    # Department update: resolve department object by ID or by name
    target_dept_obj = None
    if payload.department_id is not None and payload.department_id > 0:
        d_res = await db.execute(select(Department).where(Department.id == payload.department_id))
        target_dept_obj = d_res.scalar_one_or_none()

    if not target_dept_obj and payload.department is not None and payload.department.strip():
        d_res = await db.execute(select(Department).where(Department.name.ilike(payload.department.strip())))
        target_dept_obj = d_res.scalar_one_or_none()

    if target_dept_obj:
        target_user.department_id = target_dept_obj.id
        target_user.department = target_dept_obj.name
    elif payload.department is not None and payload.department.strip():
        target_user.department = payload.department.strip()
        target_user.department_id = None

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
    - Суперадминистратор может назначать любую роль ('superadmin', 'admin', 'employee').
    - Администратор может переключать только между 'admin' и 'employee'.
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
    current_user: User = Depends(require_role("superadmin")),
):
    """Удаление пользователя (только суперадминистратор)."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить собственный аккаунт",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    await db.delete(user)
    await db.commit()
    return None
