import asyncio
import json
import logging
import random
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

try:
    import httpx
except ImportError:
    httpx = None

from sqlalchemy import select

from app.core.config import settings

logger = logging.getLogger("telegram")


def _sync_http_post(url: str, payload: dict, timeout: float = 10.0) -> tuple[int, str]:
    """Синхронный POST-запрос через стандартную библиотеку urllib (на случай отсутствия httpx)."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "AMG-LMS-Telegram/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")


def _sync_http_get(url: str, params: dict, timeout: float = 25.0) -> tuple[int, dict]:
    """Синхронный GET-запрос через стандартную библиотеку urllib (на случай отсутствия httpx)."""
    query = urllib.parse.urlencode(params)
    full_url = f"{url}?{query}" if query else url
    req = urllib.request.Request(
        full_url,
        headers={"User-Agent": "AMG-LMS-Telegram/1.0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8", errors="ignore"))
    except urllib.error.HTTPError as e:
        return e.code, {}


def is_telegram_configured() -> bool:
    """Проверка, настроен ли Telegram бот в .env файле."""
    return bool(settings.TELEGRAM_BOT_TOKEN and len(settings.TELEGRAM_BOT_TOKEN.strip()) > 10)


def generate_telegram_link_code() -> str:
    """Генерация легко запоминающегося 4-значного цифрового кода."""
    return f"{random.randint(1000, 9999)}"


async def send_telegram_message(
    chat_id: str,
    text: str,
    reply_markup: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Отправка сообщения пользователю в Telegram через Bot API.
    Поддерживает HTML-разметку и инлайн-кнопки.
    """
    if not is_telegram_configured() or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload: Dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        if httpx is not None:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                status_code = res.status_code
                resp_text = res.text
        else:
            status_code, resp_text = await asyncio.to_thread(_sync_http_post, url, payload, 10.0)

        if status_code == 200:
            logger.info(f"[Telegram] Сообщение успешно отправлено в чат {chat_id}")
            return True
        else:
            logger.warning(f"[Telegram] Ошибка отправки в чат {chat_id}: {status_code} {resp_text}")
            return False
    except Exception as e:
        logger.error(f"[Telegram] Исключение при отправке сообщения в чат {chat_id}: {e}")
        return False


# ==============================================================================
# ШАБЛОНЫ УВЕДОМЛЕНИЙ TELEGRAM
# ==============================================================================

async def notify_telegram_test_assigned(
    chat_id: str,
    user_name: str,
    test_title: str,
    due_date: Optional[str] = None,
    test_id: Optional[int] = None,
) -> bool:
    """Уведомление о персональном назначении теста."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    target_link = f"{base_url}/tests"

    due_str = f"⏰ <b>Дедлайн сдачи:</b> {due_date}\n" if due_date else "⏰ <b>Срок:</b> Без ограничений по времени\n"

    text = (
        f"📋 <b>AMG LMS • Назначено тестирование</b>\n\n"
        f"Здравствуйте, <b>{user_name}</b>!\n"
        f"Вам назначен тест для аттестации:\n\n"
        f"📝 <b>«{test_title}»</b>\n"
        f"{due_str}\n"
        f"Пожалуйста, пройдите тестирование вовремя."
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "🚀 Открыть и пройти тест",
                    "url": target_link,
                }
            ]
        ]
    }

    return await send_telegram_message(chat_id, text, reply_markup=reply_markup)


async def notify_telegram_course_assigned(
    chat_id: str,
    user_name: str,
    course_title: str,
    deadline: Optional[str] = None,
    course_id: Optional[int] = None,
) -> bool:
    """Уведомление о назначении обучающего курса."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    target_link = f"{base_url}/courses/{course_id}/learn" if course_id else f"{base_url}/courses"

    deadline_str = f"⏰ <b>Срок прохождения:</b> {deadline}\n" if deadline else ""

    text = (
        f"🎓 <b>AMG LMS • Назначен обучающий курс</b>\n\n"
        f"Здравствуйте, <b>{user_name}</b>!\n"
        f"Вам открыт доступ к корпоративному курсу:\n\n"
        f"📖 <b>«{course_title}»</b>\n"
        f"{deadline_str}\n"
        f"Приступайте к изучению материалов в удобное время."
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "📖 Начать обучение",
                    "url": target_link,
                }
            ]
        ]
    }

    return await send_telegram_message(chat_id, text, reply_markup=reply_markup)


async def notify_telegram_test_result(
    chat_id: str,
    user_name: str,
    test_title: str,
    score: float,
    max_score: float,
    percentage: float,
    is_passed: bool,
) -> bool:
    """Уведомление о результатах прохождения теста или экзамена."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    status_icon = "✅" if is_passed else "❌"
    status_text = "Тест успешно сдан!" if is_passed else "Тест не сдан (порог не пройден)"

    text = (
        f"📊 <b>AMG LMS • Результат аттестации</b>\n\n"
        f"Здравствуйте, <b>{user_name}</b>!\n"
        f"Ваш результат проверки теста <b>«{test_title}»</b>:\n\n"
        f"{status_icon} <b>Статус:</b> {status_text}\n"
        f"🎯 <b>Набрано баллов:</b> {score} из {max_score} ({percentage}%)\n"
    )

    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "📋 Посмотреть рецензию",
                    "url": f"{base_url}/my-attempts",
                }
            ]
        ]
    }

    return await send_telegram_message(chat_id, text, reply_markup=reply_markup)


async def send_bulk_test_assigned_telegram(
    users: List[Dict[str, Any]],
    test_title: str,
    due_date: Optional[str] = None,
    test_id: Optional[int] = None,
) -> None:
    """Массовая отправка Telegram-уведомлений о назначенном тесте."""
    for u in users:
        chat_id = u.get("telegram_chat_id")
        user_name = u.get("full_name") or "Сотрудник"
        if chat_id:
            try:
                await notify_telegram_test_assigned(
                    chat_id=chat_id,
                    user_name=user_name,
                    test_title=test_title,
                    due_date=due_date,
                    test_id=test_id,
                )
                await asyncio.sleep(0.05)
            except Exception as e:
                logger.error(f"[Telegram Bulk] Ошибка отправки пользователю {user_name} ({chat_id}): {e}")


async def send_bulk_course_assigned_telegram(
    users: List[Dict[str, Any]],
    course_title: str,
    deadline: Optional[str] = None,
    course_id: Optional[int] = None,
) -> None:
    """Массовая отправка Telegram-уведомлений о назначенном курсе."""
    for u in users:
        chat_id = u.get("telegram_chat_id")
        user_name = u.get("full_name") or "Сотрудник"
        if chat_id:
            try:
                await notify_telegram_course_assigned(
                    chat_id=chat_id,
                    user_name=user_name,
                    course_title=course_title,
                    deadline=deadline,
                    course_id=course_id,
                )
                await asyncio.sleep(0.05)
            except Exception as e:
                logger.error(f"[Telegram Bulk] Ошибка отправки курса пользователю {user_name} ({chat_id}): {e}")


# ==============================================================================
# ФОНОВЫЙ ОПРОСИК (LONG-POLLING) TELEGRAM БОТА
# ==============================================================================

_poller_task: Optional[asyncio.Task] = None


async def start_telegram_bot_poller() -> None:
    """Запуск фонового поллинга Telegram бота."""
    global _poller_task
    if not is_telegram_configured():
        logger.info("[Telegram] Бот не настроен (TELEGRAM_BOT_TOKEN не указан в .env). Поллинг отключен.")
        return

    if _poller_task is None or _poller_task.done():
        logger.info("[Telegram] Запуск фонового поллера Telegram бота...")
        _poller_task = asyncio.create_task(run_telegram_bot_poller())


async def stop_telegram_bot_poller() -> None:
    """Остановка фонового поллера при завершении приложения."""
    global _poller_task
    if _poller_task and not _poller_task.done():
        _poller_task.cancel()
        try:
            await _poller_task
        except asyncio.CancelledError:
            pass
        logger.info("[Telegram] Поллер Telegram бота остановлен.")


async def run_telegram_bot_poller() -> None:
    """
    Основной цикл long-polling для получения сообщений от пользователей.
    Привязывает аккаунт по 4-значному коду.
    """
    # Ленивый импорт, чтобы избежать циклических зависимостей
    from app.core.database import AsyncSessionLocal
    from app.models.user import User

    token = settings.TELEGRAM_BOT_TOKEN
    offset = 0

    logger.info("[Telegram] Фоновый опрос обновлений Telegram запущен.")

    while True:
        try:
            url = f"https://api.telegram.org/bot{token}/getUpdates"
            params = {"offset": offset, "timeout": 20}

            if httpx is not None:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    res = await client.get(url, params=params)
                    status_code = res.status_code
                    data = res.json() if status_code == 200 else {}
            else:
                status_code, data = await asyncio.to_thread(_sync_http_get, url, params, 25.0)

            if status_code == 200:
                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    message = update.get("message")
                    if not message:
                        continue

                    chat_id = str(message["chat"]["id"])
                    text = (message.get("text") or "").strip()
                    from_user = message.get("from", {})
                    username = from_user.get("username")
                    first_name = from_user.get("first_name", "Сотрудник")

                    # Обработка команд и кодов
                    await _handle_incoming_telegram_message(
                        chat_id=chat_id,
                        text=text,
                        username=username,
                        first_name=first_name,
                    )
            elif status_code in [401, 404]:
                logger.error(f"[Telegram] Неверный токен бота ({status_code}). Поллинг приостановлен на 60 сек.")
                await asyncio.sleep(60)
            else:
                await asyncio.sleep(5)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"[Telegram Poller Warning]: {e}")
            await asyncio.sleep(5)


async def _handle_incoming_telegram_message(
    chat_id: str,
    text: str,
    username: Optional[str],
    first_name: str,
) -> None:
    """Обработка одного входящего сообщения в бота."""
    from app.core.database import AsyncSessionLocal
    from app.models.user import User

    # Извлечение кода из сообщения (поддерживаются форматы: "1234", "/start 1234", "/link 1234")
    code = None
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) > 1:
            code = parts[1].strip()
    elif text.startswith("/link"):
        parts = text.split(maxsplit=1)
        if len(parts) > 1:
            code = parts[1].strip()
    elif len(text) in [4, 5, 6] and text.isalnum():
        code = text.strip()

    # Если отправлен код привязки
    if code:
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            stmt = select(User).where(User.telegram_link_code == code.upper())
            res = await db.execute(stmt)
            user = res.scalar_one_or_none()

            if user:
                # Проверка срока действия кода (15 минут)
                if user.telegram_link_expires_at and user.telegram_link_expires_at < now:
                    await send_telegram_message(
                        chat_id,
                        "⚠️ <b>Срок действия кода истек</b>\n\n"
                        "Сгенерируйте новый 4-значный код в личном кабинете на обучающем портале.",
                    )
                    return

                # Привязываем Telegram
                user.telegram_chat_id = chat_id
                user.telegram_username = username
                user.telegram_link_code = None
                user.telegram_link_expires_at = None
                user.notify_telegram = True
                await db.commit()

                portal_url = settings.FRONTEND_URL.rstrip('/')
                await send_telegram_message(
                    chat_id,
                    f"🎉 <b>Telegram успешно подключен!</b>\n\n"
                    f"Здравствуйте, <b>{user.full_name}</b>!\n"
                    f"Ваш Telegram привязан к системе корпоративного обучения <b>AMG LMS</b> (аккаунт: {user.email}).\n\n"
                    f"🔔 <i>Теперь уведомления о назначенных курсах, тестах и дедлайнах будут приходить прямо в этот чат.</i>\n\n"
                    f"Управлять уведомлениями вы всегда можете в личном кабинете на портале: {portal_url}",
                )
                logger.info(f"[Telegram] Пользователь {user.email} (ID: {user.id}) успешно привязал Telegram chat_id={chat_id}")
                return
            else:
                await send_telegram_message(
                    chat_id,
                    "❌ <b>Неверный код подключения</b>\n\n"
                    "Проверьте правильность кода или сгенерируйте новый в личном кабинете на обучающем портале.",
                )
                return

    # Команда отвязки
    if text in ["/unlink", "/stop", "отключить"]:
        async with AsyncSessionLocal() as db:
            stmt = select(User).where(User.telegram_chat_id == chat_id)
            res = await db.execute(stmt)
            user = res.scalar_one_or_none()
            if user:
                user.telegram_chat_id = None
                user.telegram_username = None
                user.notify_telegram = False
                await db.commit()
                await send_telegram_message(
                    chat_id,
                    "🔕 <b>Telegram отключен от обучающего портала.</b>\n\n"
                    "Вы больше не будете получать уведомления в этот чат.",
                )
                return
            else:
                await send_telegram_message(chat_id, "Ваш аккаунт не был привязан к обучающему порталу.")
                return

    # Команда статуса
    if text in ["/status", "/info", "статус"]:
        async with AsyncSessionLocal() as db:
            stmt = select(User).where(User.telegram_chat_id == chat_id)
            res = await db.execute(stmt)
            user = res.scalar_one_or_none()
            if user:
                notify_status = "✅ Включены" if user.notify_telegram else "🔕 Отключены"
                await send_telegram_message(
                    chat_id,
                    f"👤 <b>Статус подключения:</b> Активен\n"
                    f"• <b>Сотрудник:</b> {user.full_name}\n"
                    f"• <b>Email:</b> {user.email}\n"
                    f"• <b>Уведомления в Telegram:</b> {notify_status}",
                )
                return

    # Приветствие по умолчанию
    portal_url = settings.FRONTEND_URL.rstrip('/')
    await send_telegram_message(
        chat_id,
        f"👋 <b>Здравствуйте, {first_name}!</b>\n\n"
        f"Это официальный бот корпоративного портала обучения <b>AMG LMS</b>.\n\n"
        f"<b>Чтобы подключить уведомления:</b>\n"
        f"1. Войдите в свой личный кабинет: {portal_url}\n"
        f"2. Нажмите на свой профиль в правом верхнем углу.\n"
        f"3. В блоке «Уведомления» нажмите <b>«Подключить Telegram»</b>.\n"
        f"4. Отправьте полученный 4-значный код в этот чат.\n\n"
        f"<i>После привязки вам будут приходить оповещения о назначенных тестах и курсах.</i>",
    )
