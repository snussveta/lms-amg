import asyncio
import json
import logging
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.google_token import UserGoogleToken
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/google", tags=["Google Account & Forms Integration"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class GoogleStatusResponse(BaseModel):
    configured: bool
    is_connected: bool
    google_email: Optional[str] = None
    redirect_uri: Optional[str] = None


class ExchangeCodeRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None


class ImportFormRequest(BaseModel):
    form_url_or_id: str


class ImportJsonRequest(BaseModel):
    json_content: str
    custom_title: Optional[str] = None


# ---------------------------------------------------------------------------
# Asynchronous HTTP Helper (Supports both httpx and urllib fallback)
# ---------------------------------------------------------------------------
async def _http_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    data: Optional[Dict[str, Any]] = None,
    params: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Robust async HTTP client using httpx when present, urllib in threadpool otherwise."""
    headers = headers or {}
    if params:
        query_str = urllib.parse.urlencode(params)
        url = f"{url}?{query_str}" if "?" not in url else f"{url}&{query_str}"

    try:
        import httpx  # type: ignore

        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET":
                resp = await client.get(url, headers=headers)
            else:
                resp = await client.post(url, headers=headers, json=data)
            resp.raise_for_status()
            return resp.json()
    except ImportError:
        pass

    # Urllib fallback in threadpool
    def _run_urllib():
        req = urllib.request.Request(url, headers=headers, method=method.upper())
        body_bytes = None
        if data is not None:
            body_bytes = json.dumps(data).encode("utf-8")
            req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, data=body_bytes, timeout=30) as response:
            content = response.read().decode("utf-8")
            return json.loads(content)

    try:
        return await asyncio.to_thread(_run_urllib)
    except urllib.error.HTTPError as he:
        err_body = he.read().decode("utf-8", errors="replace")
        logger.error(f"HTTP error from {url}: {he.code} - {err_body}")
        try:
            err_json = json.loads(err_body)
            detail = err_json.get("error_description") or err_json.get("error", {}).get("message") or err_body
        except Exception:
            detail = err_body
        raise HTTPException(
            status_code=he.code,
            detail=f"Ошибка сервиса Google: {detail}",
        )
    except Exception as e:
        logger.error(f"Request to {url} failed: {e}")
        raise HTTPException(status_code=502, detail=f"Не удалось связаться с Google: {str(e)}")


# ---------------------------------------------------------------------------
# Helper: Extract Form ID from URL or Raw String
# ---------------------------------------------------------------------------
def extract_form_id(url_or_id: str) -> str:
    clean = url_or_id.strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Укажите ссылку на Google Форму или её ID.")

    # Match /forms/d/(e/)?<form_id> or /forms/u/X/d/<form_id>
    m = re.search(r"/forms/(?:u/\d+/)?d/(?:e/)?([a-zA-Z0-9_-]+)", clean)
    if m:
        return m.group(1)

    # Direct ID check (typically 30+ chars of base64/hex)
    if re.match(r"^[a-zA-Z0-9_-]{20,}$", clean):
        return clean

    raise HTTPException(
        status_code=400,
        detail="Неверный формат ссылки на Google Форму. Пример: https://docs.google.com/forms/d/1FAIpQL.../edit",
    )


# ---------------------------------------------------------------------------
# Helper: Refresh Google Access Token if Expired
# ---------------------------------------------------------------------------
async def get_valid_google_token(token_row: UserGoogleToken, db: AsyncSession) -> str:
    now = datetime.now(timezone.utc)
    # If token has expires_at and expires within 2 minutes, refresh it
    needs_refresh = False
    if token_row.expires_at:
        diff = (token_row.expires_at - now).total_seconds()
        if diff < 120:
            needs_refresh = True

    if not needs_refresh:
        return token_row.access_token

    if not token_row.refresh_token:
        # Cannot refresh, use existing access_token
        return token_row.access_token

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return token_row.access_token

    logger.info(f"Refreshing Google access token for user {token_row.user_id}...")
    token_url = token_row.token_uri or "https://oauth2.googleapis.com/token"

    data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": token_row.refresh_token,
        "grant_type": "refresh_token",
    }

    try:
        resp = await _http_request("POST", token_url, data=data)
        new_access = resp.get("access_token")
        expires_in = resp.get("expires_in", 3600)

        token_row.access_token = new_access
        token_row.expires_at = datetime.fromtimestamp(now.timestamp() + expires_in, tz=timezone.utc)
        await db.commit()
        return new_access
    except Exception as e:
        logger.warning(f"Failed to refresh Google token: {e}. Will attempt using current access_token.")
        return token_row.access_token


# ---------------------------------------------------------------------------
# Core Parser: Convert Google Form Structure to LMS Test Data
# ---------------------------------------------------------------------------
def parse_google_form_dict(form_data: Dict[str, Any], default_title: Optional[str] = None) -> Dict[str, Any]:
    info = form_data.get("info", {})
    raw_title = info.get("title") or default_title or "Импортированный тест из Google Forms"
    description = info.get("description") or ""

    items = form_data.get("items", [])
    parsed_questions: List[Dict[str, Any]] = []

    order_counter = 0

    for item in items:
        # 1. Standard question item
        if "questionItem" in item:
            q_wrap = item["questionItem"]
            q_info = q_wrap.get("question", {})
            title = item.get("title") or q_info.get("questionId") or f"Вопрос {order_counter + 1}"
            q_desc = item.get("description") or ""
            if q_desc:
                title = f"{title}\n{q_desc}"

            grading = q_info.get("grading", {})
            points_val = grading.get("pointValue")
            points = max(0, int(points_val)) if points_val is not None else 1

            correct_answers_raw = grading.get("correctAnswers", {}).get("answers", [])
            correct_set = {str(a.get("value", "")).strip().lower() for a in correct_answers_raw if a.get("value")}

            # Choice question (RADIO, CHECKBOX, DROP_DOWN)
            if "choiceQuestion" in q_info:
                cq = q_info["choiceQuestion"]
                raw_type = cq.get("type", "RADIO")

                if raw_type == "CHECKBOX":
                    q_type = "multiple_choice"
                elif raw_type == "DROP_DOWN":
                    q_type = "dropdown"
                else:
                    q_type = "single_choice"

                options: List[Dict[str, Any]] = []
                for opt in cq.get("options", []):
                    opt_val = opt.get("value", "")
                    if not opt_val and opt.get("isOther"):
                        opt_val = "Другое..."

                    if not opt_val:
                        continue

                    is_correct = opt_val.strip().lower() in correct_set
                    options.append({"text": opt_val, "is_correct": is_correct})

                if options:
                    if q_type == "multiple_choice":
                        # If points_val was explicitly 0, preserve 0 points
                        if points_val is not None and int(points_val) == 0:
                            q_pts = 0
                        else:
                            # In multiple choice, max points equals the count of correct answers
                            correct_cnt = sum(1 for o in options if o["is_correct"])
                            q_pts = correct_cnt if correct_cnt > 0 else (points if points > 0 else 1)
                    else:
                        q_pts = points

                    parsed_questions.append(
                        {
                            "text": title,
                            "question_type": q_type,
                            "points": q_pts,
                            "order": order_counter,
                            "options": options,
                        }
                    )
                    order_counter += 1

            # Text question (Short answer or Paragraph) -> in LMS both map to manual_review (Текст (абзац))
            elif "textQuestion" in q_info:
                q_type = "manual_review"

                parsed_questions.append(
                    {
                        "text": title,
                        "question_type": q_type,
                        "points": points,
                        "order": order_counter,
                        "options": [],
                    }
                )
                order_counter += 1

            # Scale question (1 to 5, etc.)
            elif "scaleQuestion" in q_info:
                sq = q_info["scaleQuestion"]
                low = sq.get("low", 1)
                high = sq.get("high", 5)
                options = []
                for num in range(low, high + 1):
                    val_str = str(num)
                    is_correct = val_str in correct_set
                    options.append({"text": val_str, "is_correct": is_correct})

                parsed_questions.append(
                    {
                        "text": title,
                        "question_type": "single_choice",
                        "points": points,
                        "order": order_counter,
                        "options": options,
                    }
                )
                order_counter += 1

        # 2. Grid question group (Multiple choice grid or Checkbox grid)
        elif "questionGroupItem" in item:
            qg = item["questionGroupItem"]
            grid_title = item.get("title") or "Группа вопросов"
            grid_q = qg.get("grid", {})
            columns = grid_q.get("columns", {}).get("options", [])
            column_texts = [c.get("value", "") for c in columns if c.get("value")]

            sub_questions = qg.get("questions", [])
            for sq in sub_questions:
                row_title = sq.get("title") or "Строка"
                full_q_text = f"{grid_title} — {row_title}"

                grading = sq.get("grading", {})
                points_val = grading.get("pointValue")
                points = max(0, int(points_val)) if points_val is not None else 1

                correct_answers_raw = grading.get("correctAnswers", {}).get("answers", [])
                correct_set = {str(a.get("value", "")).strip().lower() for a in correct_answers_raw if a.get("value")}

                options = []
                for col_text in column_texts:
                    is_correct = col_text.strip().lower() in correct_set
                    options.append({"text": col_text, "is_correct": is_correct})

                if options:
                    parsed_questions.append(
                        {
                            "text": full_q_text,
                            "question_type": "single_choice",
                            "points": points,
                            "order": order_counter,
                            "options": options,
                        }
                    )
                    order_counter += 1

    return {
        "title": raw_title,
        "description": description,
        "questions": parsed_questions,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/status", response_model=GoogleStatusResponse)
async def get_google_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check if Google OAuth is configured on server and whether current user is connected.
    """
    configured = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    token_stmt = select(UserGoogleToken).where(UserGoogleToken.user_id == current_user.id)
    t_res = await db.execute(token_stmt)
    token_row = t_res.scalar_one_or_none()

    redirect_uri = settings.GOOGLE_REDIRECT_URI or f"{settings.FRONTEND_URL}/admin/google-callback"

    return GoogleStatusResponse(
        configured=configured,
        is_connected=token_row is not None,
        google_email=token_row.google_email if token_row else None,
        redirect_uri=redirect_uri,
    )


@router.get("/auth-url")
async def get_google_auth_url(
    redirect_uri: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Generate Google OAuth 2.0 authorization URL for connecting Google account.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=400,
            detail="GOOGLE_CLIENT_ID не настроен в конфигурации сервера (.env).",
        )

    target_redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI or f"{settings.FRONTEND_URL}/admin/google-callback"

    # Requested scopes: read Google Forms and user's Google email
    scopes = [
        "https://www.googleapis.com/auth/forms.body.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
    ]

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": target_redirect,
        "response_type": "code",
        "scope": " ".join(scopes),
        "access_type": "offline",
        "prompt": "consent",
        "state": f"user_{current_user.id}",
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"auth_url": auth_url, "redirect_uri": target_redirect}


@router.post("/exchange-code")
async def exchange_google_code(
    payload: ExchangeCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exchange authorization code for access & refresh tokens and store in database.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth учетные данные (GOOGLE_CLIENT_ID / SECRET) не настроены на сервере.",
        )

    target_redirect = (
        payload.redirect_uri or settings.GOOGLE_REDIRECT_URI or f"{settings.FRONTEND_URL}/admin/google-callback"
    )

    token_url = "https://oauth2.googleapis.com/token"
    token_params = {
        "code": payload.code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": target_redirect,
        "grant_type": "authorization_code",
    }

    try:
        token_resp = await _http_request("POST", token_url, data=token_params)
    except Exception as e:
        logger.error(f"Failed to exchange Google OAuth code: {e}")
        raise HTTPException(status_code=400, detail=f"Не удалось обменять код Google: {str(e)}")

    access_token = token_resp.get("access_token")
    refresh_token = token_resp.get("refresh_token")
    expires_in = token_resp.get("expires_in", 3600)

    if not access_token:
        raise HTTPException(status_code=400, detail="Google не вернул access_token.")

    # Fetch user email from Google Profile API
    google_email = None
    try:
        userinfo_resp = await _http_request(
            "GET",
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        google_email = userinfo_resp.get("email")
    except Exception as ue:
        logger.warning(f"Could not fetch Google userinfo email: {ue}")

    now = datetime.now(timezone.utc)
    expires_at = datetime.fromtimestamp(now.timestamp() + expires_in, tz=timezone.utc)

    # Upsert in database
    token_stmt = select(UserGoogleToken).where(UserGoogleToken.user_id == current_user.id)
    t_res = await db.execute(token_stmt)
    existing_token = t_res.scalar_one_or_none()

    if existing_token:
        existing_token.access_token = access_token
        if refresh_token:
            existing_token.refresh_token = refresh_token
        existing_token.google_email = google_email or existing_token.google_email
        existing_token.expires_at = expires_at
        existing_token.updated_at = now
    else:
        new_token = UserGoogleToken(
            user_id=current_user.id,
            google_email=google_email,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
        )
        db.add(new_token)

    await db.commit()

    return {
        "success": True,
        "is_connected": True,
        "google_email": google_email,
    }


@router.post("/disconnect")
async def disconnect_google(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Disconnect Google account and delete stored tokens.
    """
    await db.execute(delete(UserGoogleToken).where(UserGoogleToken.user_id == current_user.id))
    await db.commit()
    return {"success": True, "is_connected": False}


@router.post("/import-form")
async def import_google_form(
    payload: ImportFormRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import questions, options, correct answers and point values directly from Google Forms.
    """
    form_id = extract_form_id(payload.form_url_or_id)

    # Check connection
    token_stmt = select(UserGoogleToken).where(UserGoogleToken.user_id == current_user.id)
    t_res = await db.execute(token_stmt)
    token_row = t_res.scalar_one_or_none()

    if not token_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google аккаунт не подключен. Сначала нажмите «Подключить Google аккаунт».",
        )

    # Get valid access token (auto-refreshing if needed)
    access_token = await get_valid_google_token(token_row, db)

    # Fetch form data from Google Forms API
    forms_url = f"https://forms.googleapis.com/v1/forms/{form_id}"
    try:
        form_data = await _http_request(
            "GET",
            forms_url,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    except HTTPException as he:
        if he.status_code == 403 or he.status_code == 404:
            raise HTTPException(
                status_code=400,
                detail="Google Форма не найдена или у подключенного аккаунта нет к ней доступа. "
                "Убедитесь, что форма открыта для чтения/редактирования вашему Google-аккаунту.",
            )
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Не удалось получить данные формы из Google: {str(e)}",
        )

    # Parse questions & options
    parsed = parse_google_form_dict(form_data)
    questions_list = parsed["questions"]

    if not questions_list:
        raise HTTPException(
            status_code=400,
            detail="В указанной Google Форме не найдено ни одного подходящего вопроса.",
        )

    # Create Test in LMS
    new_test = Test(
        title=parsed["title"],
        description=parsed["description"],
        time_limit_minutes=30,
        passing_score=70,
        max_attempts=1,
        is_assigned_only=False,
        is_published=True,
        allow_guest=False,
        author_id=current_user.id,
    )
    db.add(new_test)
    await db.flush()

    total_pts = 0
    for q_data in questions_list:
        new_q = Question(
            test_id=new_test.id,
            text=q_data["text"],
            question_type=q_data["question_type"],
            points=q_data["points"],
            order=q_data["order"],
        )
        db.add(new_q)
        await db.flush()
        total_pts += new_q.points

        for opt_data in q_data.get("options", []):
            new_opt = QuestionOption(
                question_id=new_q.id,
                text=opt_data["text"],
                is_correct=opt_data["is_correct"],
            )
            db.add(new_opt)

    await db.commit()

    return {
        "success": True,
        "test_id": new_test.id,
        "title": new_test.title,
        "questions_count": len(questions_list),
        "total_points": total_pts,
    }


@router.post("/import-json")
async def import_form_from_json(
    payload: ImportJsonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fallback endpoint: Import questions from raw Google Forms JSON (exported via Google Apps Script or manual dump).
    Works immediately even before GOOGLE_CLIENT_ID is configured!
    """
    try:
        raw_dict = json.loads(payload.json_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Некорректный формат JSON: {str(e)}")

    parsed = parse_google_form_dict(raw_dict, default_title=payload.custom_title)
    questions_list = parsed["questions"]

    if not questions_list:
        raise HTTPException(
            status_code=400,
            detail="В переданном JSON не найдено ни одного вопроса.",
        )

    new_test = Test(
        title=parsed["title"],
        description=parsed["description"],
        time_limit_minutes=30,
        passing_score=70,
        max_attempts=1,
        is_assigned_only=False,
        is_published=True,
        allow_guest=False,
        author_id=current_user.id,
    )
    db.add(new_test)
    await db.flush()

    total_pts = 0
    for q_data in questions_list:
        new_q = Question(
            test_id=new_test.id,
            text=q_data["text"],
            question_type=q_data["question_type"],
            points=q_data["points"],
            order=q_data["order"],
        )
        db.add(new_q)
        await db.flush()
        total_pts += new_q.points

        for opt_data in q_data.get("options", []):
            new_opt = QuestionOption(
                question_id=new_q.id,
                text=opt_data["text"],
                is_correct=opt_data["is_correct"],
            )
            db.add(new_opt)

    await db.commit()

    return {
        "success": True,
        "test_id": new_test.id,
        "title": new_test.title,
        "questions_count": len(questions_list),
        "total_points": total_pts,
    }
