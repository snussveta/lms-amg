import asyncio
import logging
from datetime import datetime, timezone, timedelta
import secrets
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.assignment import TestAssignment
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User
from app.models.bank_question import BankQuestion, BankQuestionOption

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
                is_assigned_only=True,
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

            # Вопрос 4: Текстовый ввод (text)
            q4 = Question(
                test_id=test.id,
                text="Как называется аббревиатура метода защиты, требующего подтверждения входа в систему вторым фактором (например, кодом из SMS или приложения)?",
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

        # 5. Проверка и создание назначения для тестового сотрудника
        first_test_res = await db.execute(select(Test).order_by(Test.id.asc()))
        first_test = first_test_res.scalars().first()
        if first_test and demo_emp:
            res_assign = await db.execute(
                select(TestAssignment).where(
                    TestAssignment.test_id == first_test.id,
                    TestAssignment.user_id == demo_emp.id,
                )
            )
            if not res_assign.scalar_one_or_none():
                logger.info(f"Назначение теста '{first_test.title}' сотруднику {demo_emp.email}...")
                assign = TestAssignment(
                    test_id=first_test.id,
                    user_id=demo_emp.id,
                    assigned_by_id=superadmin.id,
                    due_date=datetime.now(timezone.utc) + timedelta(days=7),
                    status="pending",
                )
                db.add(assign)
                await db.flush()

        # 6. Второй демо-тест: Общекорпоративный (общий доступ для всех сотрудников)
        gen_test_res = await db.execute(
            select(Test).where(Test.title == "Корпоративный кодекс и ценности AMG")
        )
        if not gen_test_res.scalar_one_or_none():
            logger.info("Создание общекорпоративного теста: 'Корпоративный кодекс и ценности AMG'...")
            gen_test = Test(
                title="Корпоративный кодекс и ценности AMG",
                description="Вводный общекорпоративный тест для всех сотрудников компании со свободным доступом.",
                time_limit_minutes=20,
                passing_score=80,
                is_assigned_only=False,
                is_published=True,
                allow_guest=False,
                author_id=superadmin.id,
            )
            db.add(gen_test)
            await db.flush()

            gq1 = Question(
                test_id=gen_test.id,
                text="Какая главная цель является приоритетом компании AMG в работе с клиентами?",
                question_type="single_choice",
                points=25,
                order=0,
            )
            db.add(gq1)
            await db.flush()
            db.add_all([
                QuestionOption(question_id=gq1.id, text="Безупречное качество услуг и долгосрочное доверие", is_correct=True),
                QuestionOption(question_id=gq1.id, text="Максимальная сиюминутная прибыль любой ценой", is_correct=False),
                QuestionOption(question_id=gq1.id, text="Отказ от внедрения современных технологий", is_correct=False),
            ])

            gq2 = Question(
                test_id=gen_test.id,
                text="Какие принципы определяют стандарты деловой коммуникации внутри AMG?",
                question_type="multiple_choice",
                points=25,
                order=1,
            )
            db.add(gq2)
            await db.flush()
            db.add_all([
                QuestionOption(question_id=gq2.id, text="Взаимное уважение и конструктивный диалог", is_correct=True),
                QuestionOption(question_id=gq2.id, text="Прозрачность решений и ответственность за результат", is_correct=True),
                QuestionOption(question_id=gq2.id, text="Игнорирование обратной связи от коллег", is_correct=False),
            ])
            await db.flush()

        # 7. Seed Bank Questions across departments
        res_bq = await db.execute(select(BankQuestion))
        if not res_bq.scalars().first():
            logger.info("Инициализация банка вопросов по отделам...")
            bank_data = [
                {
                    "text": "Какой стандарт бухгалтерской отчетности является обязательным для применения в РФ?",
                    "type": "single_choice",
                    "department": "Бухгалтерия",
                    "points": 10,
                    "options": [
                        {"text": "РСБУ (Российские стандарты бухгалтерского учета)", "is_correct": True},
                        {"text": "US GAAP", "is_correct": False},
                        {"text": "Только управленческие регламенты", "is_correct": False},
                    ],
                },
                {
                    "text": "В каких случаях составляется акт сверки взаимных расчетов с контрагентом?",
                    "type": "multiple_choice",
                    "department": "Бухгалтерия",
                    "points": 15,
                    "options": [
                        {"text": "Перед составлением годовой бухгалтерской отчетности", "is_correct": True},
                        {"text": "При возникновении разногласий по суммам оплат и поставок", "is_correct": True},
                        {"text": "При завершении действия долгосрочного договора", "is_correct": True},
                        {"text": "Перед каждым телефонным звонком клиенту", "is_correct": False},
                    ],
                },
                {
                    "text": "Что представляет собой воронка продаж (Sales Funnel)?",
                    "type": "single_choice",
                    "department": "Продажи",
                    "points": 10,
                    "options": [
                        {"text": "Модель процесса продажи от первого контакта до заключения сделки", "is_correct": True},
                        {"text": "График выплаты премий менеджерам", "is_correct": False},
                        {"text": "Список всех действующих договоров за прошлый год", "is_correct": False},
                    ],
                },
                {
                    "text": "Опишите ключевые этапы отработки возражения клиента «У вас слишком дорого» в B2B-переговорах.",
                    "type": "manual_review",
                    "department": "Продажи",
                    "points": 25,
                    "options": [],
                },
                {
                    "text": "Какой протокол обеспечивает безопасную передачу зашифрованных гипертекстовых данных в веб?",
                    "type": "single_choice",
                    "department": "IT",
                    "points": 10,
                    "options": [
                        {"text": "HTTPS", "is_correct": True},
                        {"text": "HTTP", "is_correct": False},
                        {"text": "FTP", "is_correct": False},
                        {"text": "Telnet", "is_correct": False},
                    ],
                },
                {
                    "text": "Какие принципы лежат в основе концепции Zero Trust в сетевой безопасности?",
                    "type": "multiple_choice",
                    "department": "IT",
                    "points": 20,
                    "options": [
                        {"text": "Постоянная верификация любого субъекта и устройства", "is_correct": True},
                        {"text": "Предоставление минимально необходимых привилегий (Least Privilege)", "is_correct": True},
                        {"text": "Предположение об уже произошедшей компрометации (Assume Breach)", "is_correct": True},
                        {"text": "Полное доверие всему трафику внутри локальной корпоративной сети", "is_correct": False},
                    ],
                },
                {
                    "text": "Что такое инкотермс (Incoterms) в логистике и внешнеэкономической деятельности?",
                    "type": "single_choice",
                    "department": "Логистика",
                    "points": 10,
                    "options": [
                        {"text": "Международные правила толкования торговых терминов поставки товаров", "is_correct": True},
                        {"text": "Таможенная декларация на опасные грузы", "is_correct": False},
                        {"text": "Стандарт крепления контейнеров на судах", "is_correct": False},
                    ],
                },
                {
                    "text": "Какие документы необходимы водителю-экспедитору при перевозке груза по территории РФ?",
                    "type": "multiple_choice",
                    "department": "Логистика",
                    "points": 15,
                    "options": [
                        {"text": "Товарно-транспортная накладная (ТТН / Транспортная накладная)", "is_correct": True},
                        {"text": "Путевой лист с отметками медосмотра и техосмотра", "is_correct": True},
                        {"text": "Водительское удостоверение соответствующей категории", "is_correct": True},
                        {"text": "Договор купли-продажи жилой недвижимости", "is_correct": False},
                    ],
                },
                {
                    "text": "Какой номер экстренной службы спасения действует на всей территории РФ с мобильных телефонов?",
                    "type": "text",
                    "department": "Общий",
                    "points": 10,
                    "options": [
                        {"text": "112", "is_correct": True},
                    ],
                },
                {
                    "text": "Какие ценности лежат в основе корпоративной культуры AMG?",
                    "type": "manual_review",
                    "department": "Общий",
                    "points": 20,
                    "options": [],
                },
            ]

            for item in bank_data:
                bq = BankQuestion(
                    text=item["text"],
                    question_type=item["type"],
                    department=item["department"],
                    points=item["points"],
                )
                db.add(bq)
                await db.flush()

                for opt in item["options"]:
                    bopt = BankQuestionOption(
                        bank_question_id=bq.id,
                        text=opt["text"],
                        is_correct=opt["is_correct"],
                    )
                    db.add(bopt)

            logger.info("Банк вопросов успешно наполнен стартовыми вопросами по отделам.")

        await db.commit()
        logger.info("Сид данных успешно завершен.")


if __name__ == "__main__":
    asyncio.run(seed_data())
