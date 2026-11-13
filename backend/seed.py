import asyncio
import logging
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


async def seed_data() -> None:
    # 1. Initialize DB tables and migrations
    logger.info("Проверка соединения с базой данных и инициализация таблиц...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # 2. Seed Default Departments (только отделы компании, без лишних филиалов и демо-данных)
        default_departments = [
            ("СТО", "Станция технического обслуживания и слесарный цех"),
            ("Склад", "Склад запчастей, комплектующих и инструментов"),
            ("Продажи", "Отдел продаж автомобилей и сервисных услуг"),
            ("Бухгалтерия", "Бухгалтерский учет и финансы"),
            ("Логистика", "Транспортная логистика и снабжение"),
            ("IT", "Информационные технологии и системное администрирование"),
            ("Общий", "Общекорпоративный отдел"),
        ]
        for name, desc in default_departments:
            d_res = await db.execute(select(Department).where(Department.name == name))
            if not d_res.scalar_one_or_none():
                logger.info(f"Создание отдела: {name}")
                db.add(Department(name=name, description=desc))
        await db.flush()

        # 3. Seed Superadmin
        superadmin_email = settings.FIRST_SUPERADMIN_EMAIL.lower().strip()
        res = await db.execute(select(User).where(User.email == superadmin_email))
        superadmin = res.scalar_one_or_none()

        if not superadmin:
            logger.info(f"Создание суперадминистратора: {superadmin_email}")
            superadmin = User(
                email=superadmin_email,
                full_name=settings.FIRST_SUPERADMIN_NAME or "Администратор AMG",
                hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD),
                role="superadmin",
                is_active=True,
                department="IT",
            )
            db.add(superadmin)
            await db.flush()
        else:
            logger.info(f"Суперадминистратор {superadmin_email} найден. Синхронизация пароля из .env...")
            superadmin.hashed_password = get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD)
            superadmin.role = "superadmin"
            superadmin.is_active = True
            await db.flush()

        await db.commit()
        logger.info("Инициализация успешно завершена: созданы отделы и суперадминистратор.")


if __name__ == "__main__":
    asyncio.run(seed_data())
