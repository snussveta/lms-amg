import logging
import smtplib
import ssl
import re
import html
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger("lms_app.email")


def _is_smtp_configured() -> bool:
    """Check if SMTP credentials are provided in settings."""
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def _format_datetime(dt_val: Any) -> str:
    """Helper to format ISO or datetime object to readable Russian date."""
    if not dt_val:
        return "Без дедлайна"
    try:
        if isinstance(dt_val, str):
            dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        else:
            dt = dt_val
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(dt_val)


def _build_html_container(title: str, content_html: str, action_url: Optional[str] = None, action_label: Optional[str] = None) -> str:
    """
    Renders corporate branded responsive HTML email template for AutoMall LMS.
    Colors: Dark Blue (#141414), Accent Red (#E84C3D), Background (#F5F5F7).
    """
    action_button_html = ""
    if action_url and action_label:
        action_button_html = f"""
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px; margin-bottom: 24px;">
            <tr>
                <td align="center">
                    <a href="{action_url}" target="_blank" style="display: inline-block; background-color: #E84C3D; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(227, 6, 19, 0.25);">
                        {action_label} &rarr;
                    </a>
                </td>
            </tr>
        </table>
        """

    frontend_link = settings.FRONTEND_URL.rstrip('/')

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #222222;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #F5F5F7; padding: 30px 10px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E0E0E0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <!-- Brand Header -->
                    <tr>
                        <td style="background-color: #141414; padding: 24px 30px; text-align: left;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <div style="display: inline-block; background: #242424; border: 1px solid rgba(255,255,255,0.15); padding: 7px 16px; border-radius: 8px;">
                                            <span style="font-size: 14px; font-weight: 900; color: #FFFFFF; letter-spacing: 0.5px; text-transform: uppercase;">
                                                Учебный центр <span style="color: #E84C3D;">AUTOMALL</span>
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 30px 24px 30px; font-size: 14px; line-height: 1.6; color: #222222;">
                            {content_html}
                            {action_button_html}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F8F9FA; padding: 20px 30px; border-top: 1px solid #EAEAEA; text-align: center; font-size: 12px; color: #777777; line-height: 1.5;">
                            Это автоматическое уведомление платформы квалификации AutoMall.<br>
                            Портал обучения: <a href="{frontend_link}" target="_blank" style="color: #E84C3D; text-decoration: underline; font-weight: bold;">{frontend_link}</a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


def send_email_sync(to_email: str, subject: str, html_content: str) -> bool:
    """
    Synchronous SMTP sender with automatic SSL/TLS negotiation, timeouts,
    and safe exception handling.
    """
    if not _is_smtp_configured():
        logger.info(f"[Email Skipped] SMTP not configured. Would send '{subject}' to <{to_email}>")
        return False

    from_email = settings.SMTP_FROM_EMAIL or settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
    from_name = settings.EMAILS_FROM_NAME or settings.SMTP_FROM_NAME or "AMG LMS Portal"
    from_header = f"{from_name} <{from_email}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to_email
    msg["Date"] = formatdate(localtime=True)
    sender_domain = from_email.split("@")[-1] if "@" in from_email else None
    msg["Message-ID"] = make_msgid(domain=sender_domain)
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"

    # Plain text alternative version (avoids spam filter penalties for HTML-only mail)
    clean_text = re.sub(r'<style[^>]*>.*?</style>', '', html_content, flags=re.DOTALL)
    clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
    clean_text = html.unescape(clean_text)
    clean_text = re.sub(r'[ \t]+', ' ', clean_text)
    clean_text = re.sub(r'\n\s*\n', '\n\n', clean_text).strip()

    part_text = MIMEText(clean_text, "plain", "utf-8")
    msg.attach(part_text)

    # HTML version
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_html)

    port = settings.SMTP_PORT
    host = settings.SMTP_HOST

    # Auto-determine SSL vs TLS by port or setting
    use_ssl = settings.SMTP_SSL or (port == 465)
    use_tls = settings.SMTP_TLS or (port == 587)

    try:
        if use_ssl:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=ctx, timeout=12) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=12) as server:
                if use_tls:
                    ctx = ssl.create_default_context()
                    server.starttls(context=ctx)
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

        logger.info(f"Email successfully sent to <{to_email}>. Subject: '{subject}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to <{to_email}> via {host}:{port}: {e}")
        return False


# ==============================================================================
# 1. WELCOME / REGISTRATION EMAIL
# ==============================================================================

def send_welcome_email(to_email: str, full_name: str, password: str, role: str = "Сотрудник") -> bool:
    """Sends login credentials when a new employee is registered by admin."""
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    subject = "Доступ к обучающей платформе AutoMall"

    role_title = "Администратор" if role in ["admin", "superadmin"] else "Сотрудник"

    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Здравствуйте, {full_name}!
    </h2>
    <p style="margin-bottom: 20px; font-size: 14px; color: #495057;">
        Вам открыт доступ к корпоративному учебному центру <strong>AutoMall</strong> для прохождения обучающих программ, регламентов и тестирований.
    </p>

    <div style="background-color: #F5F5F7; border: 1px solid #E0E0E0; border-radius: 10px; padding: 18px 20px; margin-bottom: 20px;">
        <div style="font-size: 11px; text-transform: uppercase; font-weight: bold; color: #777777; letter-spacing: 0.5px; margin-bottom: 12px;">
            Ваши учетные данные для входа:
        </div>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
            <tr>
                <td style="padding: 4px 0; color: #777777; width: 110px;">Логин (Email):</td>
                <td style="padding: 4px 0; font-weight: bold; color: #222222;">{to_email}</td>
            </tr>
            <tr>
                <td style="padding: 4px 0; color: #777777;">Пароль:</td>
                <td style="padding: 4px 0;">
                    <span style="font-family: monospace; font-size: 15px; font-weight: bold; background: #FFFFFF; border: 1px solid #CED4DA; padding: 2px 8px; border-radius: 4px; color: #141414;">
                        {password}
                    </span>
                </td>
            </tr>
            <tr>
                <td style="padding: 4px 0; color: #777777;">Роль:</td>
                <td style="padding: 4px 0; color: #222222;">{role_title}</td>
            </tr>
        </table>
    </div>

    <p style="font-size: 13px; color: #777777; margin-bottom: 0;">
        Вы можете войти с компьютера или телефона. Рекомендуем сохранить данные для входа.
    </p>
    """

    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=login_url,
        action_label="Войти в личный кабинет",
    )
    return send_email_sync(to_email, subject, html)


# ==============================================================================
# 2. COURSE ASSIGNED EMAIL
# ==============================================================================

def send_course_assigned_email(
    to_email: str,
    full_name: str,
    course_title: str,
    course_id: int,
    deadline: Optional[Any] = None,
) -> bool:
    """Notifies employee about a newly assigned course."""
    course_url = f"{settings.FRONTEND_URL.rstrip('/')}/courses/{course_id}/learn"
    subject = f"Вам назначен обучающий курс: «{course_title}»"

    deadline_str = _format_datetime(deadline)

    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Здравствуйте, {full_name}!
    </h2>
    <p style="font-size: 14px; color: #495057;">
        Вам назначен обязательный обучающий курс в системе AutoMall:
    </p>

    <div style="background-color: #F5F5F7; border-left: 4px solid #141414; border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 800; color: #141414; margin-bottom: 6px;">
            {course_title}
        </div>
        <div style="font-size: 13px; color: #777777;">
            <strong>Срок прохождения:</strong> {deadline_str}
        </div>
    </div>

    <p style="font-size: 13px; color: #495057;">
        Курс содержит видеолекции, практические регламенты и контрольные вопросы. Весь прогресс сохраняется автоматически.
    </p>
    """

    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=course_url,
        action_label="Начать обучение",
    )
    return send_email_sync(to_email, subject, html)


def send_bulk_course_assigned_email(
    users: List[Dict[str, str]],
    course_title: str,
    course_id: int,
    deadline: Optional[Any] = None,
) -> None:
    """Helper to send course assignment notification to multiple users in background."""
    for u in users:
        email = u.get("email")
        name = u.get("full_name") or "Сотрудник"
        if email:
            send_course_assigned_email(
                to_email=email,
                full_name=name,
                course_title=course_title,
                course_id=course_id,
                deadline=deadline,
            )


# ==============================================================================
# 3. TEST / CERTIFICATION ASSIGNED EMAIL
# ==============================================================================

def send_test_assigned_email(
    to_email: str,
    full_name: str,
    test_title: str,
    test_id: int,
    passing_score: int,
    due_date: Optional[Any] = None,
) -> bool:
    """Notifies employee about a test/certification assigned to them."""
    test_url = f"{settings.FRONTEND_URL.rstrip('/')}/tests/{test_id}"
    subject = f"Вам назначена аттестация: «{test_title}»"

    due_str = _format_datetime(due_date)

    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Здравствуйте, {full_name}!
    </h2>
    <p style="font-size: 14px; color: #495057;">
        Вам назначено контрольное тестирование квалификации:
    </p>

    <div style="background-color: #F5F5F7; border-left: 4px solid #E84C3D; border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 20px 0;">
        <div style="font-size: 16px; font-weight: 800; color: #222222; margin-bottom: 6px;">
            {test_title}
        </div>
        <div style="font-size: 13px; color: #495057; line-height: 1.6;">
            <strong>Проходной балл:</strong> {passing_score}%<br>
            <strong>Срок сдачи:</strong> {due_str}
        </div>
    </div>

    <p style="font-size: 13px; color: #777777;">
        Пожалуйста, завершите аттестацию в установленный срок.
    </p>
    """

    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=test_url,
        action_label="Перейти к тестированию",
    )
    return send_email_sync(to_email, subject, html)


def send_bulk_test_assigned_email(
    users: List[Dict[str, str]],
    test_title: str,
    test_id: int,
    passing_score: int,
    due_date: Optional[Any] = None,
) -> None:
    """Helper to send test assignment notification to multiple users in background."""
    for u in users:
        email = u.get("email")
        name = u.get("full_name") or "Сотрудник"
        if email:
            send_test_assigned_email(
                to_email=email,
                full_name=name,
                test_title=test_title,
                test_id=test_id,
                passing_score=passing_score,
                due_date=due_date,
            )


# ==============================================================================
# 4. TEST RESULT / GRADE NOTIFICATION EMAIL
# ==============================================================================

def send_test_result_email(
    to_email: str,
    full_name: str,
    test_title: str,
    score: float,
    max_score: float,
    percentage: float,
    passing_score: int,
    is_passed: bool,
) -> bool:
    """Notifies employee when their test attempt is graded and result is finalized."""
    results_url = f"{settings.FRONTEND_URL.rstrip('/')}/my-results"
    
    if is_passed:
        status_text = "Тест успешно сдан"
        status_badge_bg = "#ECFDF5"
        status_badge_color = "#047857"
        status_badge_border = "#A7F3D0"
        status_icon = "&#10003;"
    else:
        status_text = "Тест не сдан"
        status_badge_bg = "#FCECEB"
        status_badge_color = "#E84C3D"
        status_badge_border = "#F8D3D0"
        status_icon = "&#10007;"

    subject = f"Результат теста «{test_title}»: {status_text} ({percentage}%)"

    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Здравствуйте, {full_name}!
    </h2>
    <p style="font-size: 14px; color: #495057;">
        Ваш результат аттестации по теме <strong>«{test_title}»</strong>:
    </p>

    <!-- Result Banner -->
    <div style="background-color: {status_badge_bg}; border: 1px solid {status_badge_border}; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <div style="font-size: 26px; font-weight: 900; color: {status_badge_color}; margin-bottom: 6px;">
            {status_icon} {status_text}
        </div>
        <div style="font-size: 32px; font-weight: 900; color: #141414; margin-bottom: 8px;">
            {percentage}%
        </div>
        <div style="font-size: 13px; color: #777777;">
            Набрано баллов: <strong>{score}</strong> из <strong>{max_score}</strong> (проходной порог: {passing_score}%)
        </div>
    </div>

    <p style="font-size: 13px; color: #777777;">
        Подробный разбор ошибок и комментарии проверяющего доступны в разделе «Мои результаты».
    </p>
    """

    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=results_url,
        action_label="Посмотреть разбор результатов",
    )
    return send_email_sync(to_email, subject, html)


# ==============================================================================
# 5. COURSE COMPLETED CONGRATULATIONS EMAIL
# ==============================================================================

def send_course_completed_email(
    to_email: str,
    full_name: str,
    course_title: str,
) -> bool:
    """Sends congratulations when an employee completes all modules of a course."""
    results_url = f"{settings.FRONTEND_URL.rstrip('/')}/courses"
    subject = f"Поздравляем! Курс «{course_title}» успешно завершен"

    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Поздравляем, {full_name}!
    </h2>
    <p style="font-size: 14px; color: #495057;">
        Вы успешно изучили все материалы и завершили обучающий курс:
    </p>

    <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <div style="font-size: 18px; font-weight: 800; color: #047857; margin-bottom: 4px;">
            &#10003; Курс пройден на 100%
        </div>
        <div style="font-size: 16px; font-weight: bold; color: #141414;">
            «{course_title}»
        </div>
    </div>

    <p style="font-size: 13px; color: #777777;">
        Данные об успешном прохождении курса зафиксированы в корпоративном реестре квалификации AutoMall.
    </p>
    """

    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=results_url,
        action_label="Перейти к каталогу курсов",
    )
    return send_email_sync(to_email, subject, html)


# ==============================================================================
# 6. TEST SMTP DIAGNOSTIC EMAIL
# ==============================================================================

def send_test_smtp_email(to_email: str) -> bool:
    """Diagnostic check to test SMTP configuration from admin panel."""
    subject = "Тестовое сообщение почтового сервера AutoMall LMS"
    content = f"""
    <h2 style="margin-top: 0; color: #141414; font-size: 20px; font-weight: 800;">
        Связь с почтовым сервером успешно установлена!
    </h2>
    <p style="font-size: 14px; color: #495057;">
        Это тестовое письмо подтверждает, что настройки SMTP в файле конфигурации <code>.env</code> работают корректно.
    </p>
    <div style="background-color: #F5F5F7; border: 1px solid #E0E0E0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #495057; font-family: monospace;">
        SMTP Сервер: {settings.SMTP_HOST}:{settings.SMTP_PORT}<br>
        Пользователь: {settings.SMTP_USER}<br>
        Отправитель: {settings.SMTP_FROM_NAME}
    </div>
    """
    html = _build_html_container(
        title=subject,
        content_html=content,
        action_url=settings.FRONTEND_URL,
        action_label="Открыть систему LMS",
    )
    return send_email_sync(to_email, subject, html)

