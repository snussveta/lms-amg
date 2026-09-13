import asyncio
import logging
import secrets
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")


async def seed_data() -> None:
    # 1. Initialize DB tables and migrations
    logger.info("Проверка соединения с базой данных и инициализация таблиц...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # 2. Seed Superadmin
        superadmin_email = settings.FIRST_SUPERADMIN_EMAIL.lower()
        res = await db.execute(select(User).where(User.email == superadmin_email))
        superadmin = res.scalar_one_or_none()

        if not superadmin:
            logger.info(f"Создание суперадминистратора: {superadmin_email}")
            superadmin = User(
                email=superadmin_email,
                full_name="Администратор AMG",
                hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD),
                role="superadmin",
                is_active=True,
            )
            db.add(superadmin)
            await db.flush()
        else:
            logger.info(f"Суперадминистратор {superadmin_email} уже существует.")

        # 3. Seed Demo Employee
        demo_emp_email = "employee@company.com"
        res_emp = await db.execute(select(User).where(User.email == demo_emp_email))
        demo_emp = res_emp.scalar_one_or_none()
        if not demo_emp:
            logger.info(f"Создание тестового сотрудника: {demo_emp_email}")
            demo_emp = User(
                email=demo_emp_email,
                full_name="Алексей Смирнов (Сотрудник)",
                hashed_password=get_password_hash("employee123"),
                role="employee",
                is_active=True,
            )
            db.add(demo_emp)
            await db.flush()

        # 4. Seed Demo Corporate Test
        res_test = await db.execute(select(Test))
        existing_test = res_test.scalars().first()

        if not existing_test:
            logger.info("Создание демонстрационного теста AMG: 'Информационная безопасность и защита данных 2026'...")
            test = Test(
                title="Информационная безопасность и защита данных 2026",
                description="Обязательное корпоративное тестирование по защите конфиденциальной информации, противодействию фишингу и регламентам информационной безопасности AMG.",
                time_limit_minutes=15,
                passing_score=70,
                is_published=True,
                allow_guest=True,
                public_token=secrets.token_urlsafe(16),
                author_id=superadmin.id,
            )
            db.add(test)
            await db.flush()

            # Вопрос 1: Один вариант (single_choice)
            q1 = Question(
                test_id=test.id,
                text="Какое действие является наиболее безопасным при получении подозрительного письма с требованием срочно подтвердить учетные данные?",
                question_type="single_choice",
                points=20,
                order=0,
            )
            db.add(q1)
            await db.flush()
            db.add_all([
                QuestionOption(question_id=q1.id, text="Перейти по ссылке и ввести пароль, чтобы учетную запись не заблокировали", is_correct=False),
                QuestionOption(question_id=q1.id, text="Переслать письмо в отдел информационной безопасности и не открывать вложения", is_correct=True),
                QuestionOption(question_id=q1.id, text="Ответить отправителю и спросить, действительно ли это письмо от службы поддержки", is_correct=False),
                QuestionOption(question_id=q1.id, text="Переслать письмо всем коллегам по отделу", is_correct=False),
            ])

            # Вопрос 2: Несколько вариантов (multiple_choice)
            q2 = Question(
                test_id=test.id,
                text="Какие из приведенных мер являются обязательными для надежной парольной защиты в компании? (Выберите все подходящие варианты)",
                question_type="multiple_choice",
                points=30,
                order=1,
            )
            db.add(q2)
            await db.flush()
            db.add_all([
                QuestionOption(question_id=q2.id, text="Использовать длину пароля не менее 12 символов с буквами разного регистра, цифрами и знаками", is_correct=True),
                QuestionOption(question_id=q2.id, text="Обязательно подключать двухфакторную аутентификацию (2FA/MFA) на всех корпоративных сервисах", is_correct=True),
                QuestionOption(question_id=q2.id, text="Использовать один и тот же пароль для рабочей почты и личных социальных сетей", is_correct=False),
                QuestionOption(question_id=q2.id, text="Никогда не передавать рабочие пароли через незашифрованные мессенджеры", is_correct=True),
            ])

            # Вопрос 3: Ручная проверка администратором (manual_review)
            q3 = Question(
                test_id=test.id,
                text="Опишите алгоритм ваших действий, если вы обнаружили, что на рабочем компьютере зашифрованы файлы подозрительной программой-вымогателем.",
                question_type="manual_review",
                points=30,
                order=2,
            )
            db.add(q3)
            await db.flush()

            # Вопрос 4: Текстовый ответ с ключевым словом (text)
            q4 = Question(
                test_id=test.id,
                text="Назовите общепринятую аббревиатуру технологии двухфакторной или многофакторной аутентификации (3 буквы на латинице):",
                question_type="text",
                points=20,
                order=3,
            )
            db.add(q4)
            await db.flush()
            db.add_all([
                QuestionOption(question_id=q4.id, text="2FA", is_correct=True),
                QuestionOption(question_id=q4.id, text="MFA", is_correct=True),
            ])

            logger.info("Демонстрационный тест и вопросы успешно инициализированы.")

        await db.commit()
        logger.info("Сид данных успешно завершен.")


if __name__ == "__main__":
    asyncio.run(seed_data())
