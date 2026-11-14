import random
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exam_manager import live_exam_manager
from app.core.security import get_current_user, require_role
from app.models.attempt import Attempt, AttemptAnswer
from app.models.exam import ExamParticipant, ExamSession
from app.models.question import Question, QuestionOption
from app.models.test import Test
from app.models.user import User
from app.schemas.exam import (
    ExamJoinRequest,
    ExamParticipantResponse,
    ExamProgressReport,
    ExamSessionCreate,
    ExamSessionDetailResponse,
    ExamSubmitRequest,
)
from app.schemas.test import QuestionEmployeeResponse, QuestionOptionEmployeeResponse

router = APIRouter(prefix="/exam", tags=["Live Synchronous Exam"])


def _generate_pin() -> str:
    """Generates a readable 6-digit numeric PIN for joining exams."""
    return str(random.randint(100000, 999999))


def _map_participant_response(p: ExamParticipant) -> ExamParticipantResponse:
    full_name = p.user.full_name if p.user else (p.guest_name or "Гость")
    email = p.user.email if p.user else None
    dept = p.user.department if p.user else None
    is_needs_review = False
    if hasattr(p, "attempt") and p.attempt and p.attempt.status == "needs_review":
        is_needs_review = True

    return ExamParticipantResponse(
        id=p.id,
        session_id=p.session_id,
        user_id=p.user_id,
        full_name=full_name,
        email=email,
        department=dept,
        status=p.status,
        current_question_index=p.current_question_index,
        progress_percent=p.progress_percent,
        tab_switches_count=p.tab_switches_count,
        right_clicks_count=getattr(p, "right_clicks_count", 0),
        score=p.score if not is_needs_review else 0.0,
        points_earned=p.points_earned if not is_needs_review else 0,
        total_points=p.total_points,
        passed=p.passed if not is_needs_review else False,
        needs_review=is_needs_review,
        attempt_id=p.attempt_id,
        joined_at=p.joined_at,
        finished_at=p.finished_at,
    )


# ==============================================================================
# 1. EXAMINER: CREATE & MANAGE SESSIONS
# ==============================================================================


@router.post("/sessions", response_model=ExamSessionDetailResponse)
async def create_exam_session(
    payload: ExamSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """Создание синхронной экзаменационной сессии для очной сдачи."""
    # Check test exists
    test_res = await db.execute(select(Test).where(Test.id == payload.test_id))
    test = test_res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    # Generate unique PIN among active sessions
    pin = _generate_pin()
    session_token = uuid.uuid4().hex

    session = ExamSession(
        test_id=test.id,
        creator_id=current_user.id,
        title=payload.title.strip(),
        pin_code=pin,
        session_token=session_token,
        status="waiting",
        time_limit_minutes=payload.time_limit_minutes or test.time_limit_minutes or 30,
        passing_score=payload.passing_score if payload.passing_score is not None else test.passing_score,
        shuffle_questions=payload.shuffle_questions if payload.shuffle_questions is not None else True,
        shuffle_options=payload.shuffle_options if payload.shuffle_options is not None else True,
        detect_tab_switches=payload.detect_tab_switches if payload.detect_tab_switches is not None else True,
        detect_right_clicks=payload.detect_right_clicks if payload.detect_right_clicks is not None else True,
        block_copy_paste=payload.block_copy_paste if payload.block_copy_paste is not None else True,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return ExamSessionDetailResponse(
        id=session.id,
        test_id=test.id,
        test_title=test.title,
        title=session.title,
        pin_code=session.pin_code,
        session_token=session.session_token,
        status=session.status,
        time_limit_minutes=session.time_limit_minutes,
        passing_score=session.passing_score,
        shuffle_questions=session.shuffle_questions,
        shuffle_options=session.shuffle_options,
        detect_tab_switches=session.detect_tab_switches,
        detect_right_clicks=session.detect_right_clicks,
        block_copy_paste=session.block_copy_paste,
        started_at=session.started_at,
        ended_at=session.ended_at,
        created_at=session.created_at,
        creator_name=current_user.full_name,
        participants_count=0,
        participants=[],
    )


@router.get("/sessions", response_model=List[ExamSessionDetailResponse])
async def list_exam_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """Список активных и завершенных экзаменационных сессий."""
    stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.test),
            selectinload(ExamSession.creator),
            selectinload(ExamSession.participants).selectinload(ExamParticipant.user),
        )
        .order_by(desc(ExamSession.created_at))
        .limit(50)
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    result = []
    for s in sessions:
        participants_resp = [_map_participant_response(p) for p in s.participants]
        result.append(
            ExamSessionDetailResponse(
                id=s.id,
                test_id=s.test_id,
                test_title=s.test.title if s.test else "Тест",
                title=s.title,
                pin_code=s.pin_code,
                session_token=s.session_token,
                status=s.status,
                time_limit_minutes=s.time_limit_minutes,
                passing_score=s.passing_score,
                shuffle_questions=s.shuffle_questions,
                shuffle_options=s.shuffle_options,
                detect_tab_switches=getattr(s, "detect_tab_switches", True),
                detect_right_clicks=getattr(s, "detect_right_clicks", True),
                block_copy_paste=getattr(s, "block_copy_paste", True),
                started_at=s.started_at,
                ended_at=s.ended_at,
                created_at=s.created_at,
                creator_name=s.creator.full_name if s.creator else None,
                participants_count=len(s.participants),
                participants=participants_resp,
            )
        )
    return result


@router.get("/sessions/{session_id}", response_model=ExamSessionDetailResponse)
async def get_exam_session_detail(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Получение детальной информации о сессии и списка участников."""
    stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.test),
            selectinload(ExamSession.creator),
            selectinload(ExamSession.participants).selectinload(ExamParticipant.user),
        )
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    s = res.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Экзаменационная сессия не найдена")

    participants_resp = [_map_participant_response(p) for p in s.participants]
    return ExamSessionDetailResponse(
        id=s.id,
        test_id=s.test_id,
        test_title=s.test.title if s.test else "Тест",
        title=s.title,
        pin_code=s.pin_code,
        session_token=s.session_token,
        status=s.status,
        time_limit_minutes=s.time_limit_minutes,
        passing_score=s.passing_score,
        shuffle_questions=s.shuffle_questions,
        shuffle_options=s.shuffle_options,
        detect_tab_switches=getattr(s, "detect_tab_switches", True),
        detect_right_clicks=getattr(s, "detect_right_clicks", True),
        block_copy_paste=getattr(s, "block_copy_paste", True),
        started_at=s.started_at,
        ended_at=s.ended_at,
        created_at=s.created_at,
        creator_name=s.creator.full_name if s.creator else None,
        participants_count=len(s.participants),
        participants=participants_resp,
    )


# ==============================================================================
# 2. JOIN EXAM (BY PIN OR DIRECT LINK)
# ==============================================================================


@router.post("/join")
async def join_exam_session(
    payload: ExamJoinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Присоединение к экзаменационной сессии:
    - по 6-значному PIN-коду, ИЛИ
    - по прямой ссылке с session_token.
    """
    stmt = select(ExamSession).options(
        selectinload(ExamSession.test),
        selectinload(ExamSession.participants).selectinload(ExamParticipant.user),
    )

    clean_pin = (payload.pin_code or "").replace(" ", "").replace("-", "").strip()
    if clean_pin:
        stmt = stmt.where(ExamSession.pin_code == clean_pin)
    elif payload.session_token:
        stmt = stmt.where(ExamSession.session_token == payload.session_token.strip())
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать PIN-код или токен экзаменационной сессии",
        )

    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Экзаменационная сессия с таким кодом не найдена. Проверьте код и попробуйте снова.",
        )

    if session.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данный экзамен уже завершен.",
        )

    if session.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Данная экзаменационная сессия была отменена экзаменатором.",
        )

    # Check if this user is already in session
    existing_participant = None
    if current_user:
        for p in session.participants:
            if p.user_id == current_user.id:
                existing_participant = p
                break

    if not existing_participant:
        guest_name = None
        if not current_user:
            guest_name = (payload.guest_name or "").strip()
            if not guest_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Для гостевого входа укажите ваше ФИО",
                )

        initial_status = "taking" if session.status == "in_progress" else "waiting"
        new_participant = ExamParticipant(
            session_id=session.id,
            user_id=current_user.id if current_user else None,
            guest_name=guest_name,
            status=initial_status,
        )
        db.add(new_participant)
        await db.commit()
        await db.refresh(new_participant)

        # Reload participant with user relation for broadcasting
        p_stmt = (
            select(ExamParticipant)
            .options(selectinload(ExamParticipant.user))
            .where(ExamParticipant.id == new_participant.id)
        )
        p_res = await db.execute(p_stmt)
        existing_participant = p_res.scalar_one()

        # Broadcast new participant to examiner dashboard
        await live_exam_manager.broadcast(
            session.id,
            {
                "type": "PARTICIPANT_JOINED",
                "participant": _map_participant_response(existing_participant).model_dump(mode="json"),
            },
        )

    return {
        "session_id": session.id,
        "title": session.title,
        "test_title": session.test.title if session.test else "Тест",
        "status": session.status,
        "pin_code": session.pin_code,
        "session_token": session.session_token,
        "time_limit_minutes": session.time_limit_minutes,
        "started_at": session.started_at,
        "participant": _map_participant_response(existing_participant),
    }


# ==============================================================================
# 3. LIVE CONTROLS (START / EXTEND / FINISH / DISQUALIFY)
# ==============================================================================


@router.post("/sessions/{session_id}/start")
async def start_exam_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Синхронный запуск экзамена для всех подключенных участников в комнате."""
    stmt = (
        select(ExamSession)
        .options(selectinload(ExamSession.participants))
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")

    now = datetime.now(timezone.utc)
    session.status = "in_progress"
    session.started_at = now

    for p in session.participants:
        if p.status == "waiting":
            p.status = "taking"

    await db.commit()

    # Broadcast START event to all screens in the room
    await live_exam_manager.broadcast(
        session.id,
        {
            "type": "EXAM_STARTED",
            "started_at": now.isoformat(),
            "time_limit_minutes": session.time_limit_minutes,
        },
    )

    return {"status": "in_progress", "started_at": now}


@router.post("/sessions/{session_id}/extend")
async def extend_exam_session_time(
    session_id: int,
    added_minutes: int = Query(5, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Продление времени экзамена экзаменатором на X минут."""
    res = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")

    session.time_limit_minutes += added_minutes
    await db.commit()

    await live_exam_manager.broadcast(
        session.id,
        {
            "type": "TIME_EXTENDED",
            "added_minutes": added_minutes,
            "new_time_limit_minutes": session.time_limit_minutes,
        },
    )

    return {"status": "extended", "time_limit_minutes": session.time_limit_minutes}


@router.post("/sessions/{session_id}/finish")
async def finish_exam_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Принудительное завершение экзамена экзаменатором для всей группы."""
    res = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сессия не найдена")

    now = datetime.now(timezone.utc)
    session.status = "completed"
    session.ended_at = now
    await db.commit()

    await live_exam_manager.broadcast(
        session.id,
        {
            "type": "EXAM_FINISHED",
            "ended_at": now.isoformat(),
        },
    )

    return {"status": "completed", "ended_at": now}


@router.post("/sessions/{session_id}/disqualify/{participant_id}")
async def disqualify_participant(
    session_id: int,
    participant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin")),
):
    """Дисквалификация сотрудника за нарушение правил (списывание)."""
    p_res = await db.execute(
        select(ExamParticipant).where(
            ExamParticipant.id == participant_id, ExamParticipant.session_id == session_id
        )
    )
    participant = p_res.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Участник не найден")

    participant.status = "disqualified"
    participant.finished_at = datetime.now(timezone.utc)
    await db.commit()

    await live_exam_manager.broadcast(
        session_id,
        {
            "type": "PARTICIPANT_DISQUALIFIED",
            "participant_id": participant.id,
        },
    )

    return {"status": "disqualified", "participant_id": participant.id}


# ==============================================================================
# 4. PARTICIPANT: PROGRESS, ANTI-CHEAT & SUBMIT
# ==============================================================================


@router.post("/sessions/{session_id}/progress")
async def report_progress(
    session_id: int,
    payload: ExamProgressReport,
    db: AsyncSession = Depends(get_db),
):
    """Периодический отчет о прогрессе и фиксация переключения вкладок (античит)."""
    p_res = await db.execute(
        select(ExamParticipant).where(
            ExamParticipant.id == payload.participant_id, ExamParticipant.session_id == session_id
        )
    )
    participant = p_res.scalar_one_or_none()
    if not participant or participant.status == "disqualified":
        return {"status": "ignored"}

    participant.current_question_index = payload.current_question_index
    participant.progress_percent = payload.progress_percent
    if payload.switched_tab:
        participant.tab_switches_count += 1
    if payload.right_clicked:
        participant.right_clicks_count = getattr(participant, "right_clicks_count", 0) + 1

    await db.commit()

    # Broadcast live update to examiner dashboard
    await live_exam_manager.broadcast(
        session_id,
        {
            "type": "PARTICIPANT_PROGRESS",
            "participant_id": participant.id,
            "current_question_index": participant.current_question_index,
            "progress_percent": participant.progress_percent,
            "tab_switches_count": participant.tab_switches_count,
            "right_clicks_count": getattr(participant, "right_clicks_count", 0),
        },
    )

    return {
        "status": "ok",
        "tab_switches_count": participant.tab_switches_count,
        "right_clicks_count": getattr(participant, "right_clicks_count", 0),
    }


@router.get("/sessions/{session_id}/questions", response_model=List[QuestionEmployeeResponse])
async def get_exam_questions(
    session_id: int,
    participant_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Получение списка вопросов экзамена для участника.
    Вопросы очищены от правильных ответов (Anti-Cheat).
    """
    # Verify participant and session
    participant = None
    if participant_id:
        p_res = await db.execute(
            select(ExamParticipant).where(
                ExamParticipant.id == participant_id, ExamParticipant.session_id == session_id
            )
        )
        participant = p_res.scalar_one_or_none()

    if not participant and current_user:
        p_res = await db.execute(
            select(ExamParticipant).where(
                ExamParticipant.user_id == current_user.id, ExamParticipant.session_id == session_id
            )
        )
        participant = p_res.scalar_one_or_none()

    if not participant or participant.status == "disqualified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к вопросам заблокирован или вы дисквалифицированы.",
        )

    s_res = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = s_res.scalar_one_or_none()
    if not session or session.status not in ["in_progress", "completed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Экзамен еще не начат инструктором. Ожидайте старта в лобби.",
        )

    # Fetch questions with options
    q_stmt = (
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.test_id == session.test_id)
        .order_by(Question.order, Question.id)
    )
    q_res = await db.execute(q_stmt)
    raw_questions = q_res.scalars().all()

    # Optional shuffle (deterministic per participant_id for stable reload)
    questions_list = list(raw_questions)
    if session.shuffle_questions:
        rng = random.Random(participant.id + session.id)
        rng.shuffle(questions_list)

    result = []
    for q in questions_list:
        opts = list(q.options)
        if session.shuffle_options and q.question_type in ["single_choice", "multiple_choice", "dropdown"]:
            rng_opt = random.Random(participant.id + q.id)
            rng_opt.shuffle(opts)

        result.append(
            QuestionEmployeeResponse(
                id=q.id,
                test_id=q.test_id,
                text=q.text,
                question_type=q.question_type,
                points=q.points,
                order=q.order,
                options=[
                    QuestionOptionEmployeeResponse(
                        id=opt.id,
                        question_id=opt.question_id,
                        text=opt.text,
                    )
                    for opt in opts
                ],
            )
        )

    return result


@router.post("/sessions/{session_id}/submit")
async def submit_exam_answers(
    session_id: int,
    payload: ExamSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Отправка ответов участника, проверка правильности, подсчет баллов
    и сохранение протокола сдачи (Attempt).
    """
    p_stmt = (
        select(ExamParticipant)
        .options(selectinload(ExamParticipant.user))
        .where(
            ExamParticipant.id == payload.participant_id, ExamParticipant.session_id == session_id
        )
    )
    p_res = await db.execute(p_stmt)
    participant = p_res.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Участник не найден")

    if participant.status in ["submitted", "disqualified"]:
        return {
            "status": participant.status,
            "score": participant.score,
            "points_earned": participant.points_earned,
            "total_points": participant.total_points,
            "passed": participant.passed,
        }

    s_res = await db.execute(select(ExamSession).where(ExamSession.id == session_id))
    session = s_res.scalar_one_or_none()

    # Load questions to grade
    q_stmt = (
        select(Question)
        .options(selectinload(Question.options))
        .where(Question.test_id == session.test_id)
    )
    q_res = await db.execute(q_stmt)
    questions = q_res.scalars().all()
    q_map = {q.id: q for q in questions}

    user_answers_map = {a.question_id: a for a in payload.answers}

    total_possible_points = sum(q.points for q in questions)
    earned_points = 0
    now = datetime.now(timezone.utc)

    # Create permanent Attempt record
    attempt = Attempt(
        test_id=session.test_id,
        user_id=participant.user_id,
        is_guest=participant.user_id is None,
        guest_name=participant.guest_name,
        status="in_progress",
        started_at=session.started_at or now,
    )
    db.add(attempt)
    await db.flush()

    has_unreviewed = False

    for q in questions:
        ans = user_answers_map.get(q.id)
        selected_ids = ans.selected_option_ids if ans and ans.selected_option_ids else []
        text_ans = (ans.text_answer or "").strip() if ans and ans.text_answer else None

        correct_options = [opt for opt in q.options if opt.is_correct]
        correct_option_ids = [opt.id for opt in correct_options]

        is_correct = False
        points_awarded = 0
        is_reviewed = True

        if q.question_type in ["single_choice", "dropdown"]:
            if len(selected_ids) == 1 and selected_ids[0] in correct_option_ids:
                is_correct = True
                points_awarded = q.points
        elif q.question_type == "multiple_choice":
            if set(selected_ids) == set(correct_option_ids) and len(correct_option_ids) > 0:
                is_correct = True
                points_awarded = q.points
        elif q.question_type == "text":
            clean_text = (text_ans or "").strip().lower()
            if correct_options:
                if clean_text:
                    for opt in correct_options:
                        if opt.text.strip().lower() == clean_text:
                            is_correct = True
                            points_awarded = q.points
                            break
            else:
                is_reviewed = False
                has_unreviewed = True
                points_awarded = 0
        elif q.question_type in ["manual_review", "open", "free_text"]:
            is_correct = False
            points_awarded = 0
            is_reviewed = False
            has_unreviewed = True

        earned_points += points_awarded

        attempt_ans = AttemptAnswer(
            attempt_id=attempt.id,
            question_id=q.id,
            selected_option_ids=selected_ids,
            text_answer=text_ans if text_ans else None,
            is_correct=is_correct,
            points_awarded=points_awarded,
            is_reviewed=is_reviewed,
        )
        db.add(attempt_ans)

    score_percent = round((earned_points / total_possible_points * 100), 1) if total_possible_points > 0 else 0.0
    passed = (score_percent >= session.passing_score) if not has_unreviewed else False

    attempt.score = int(round(score_percent)) if not has_unreviewed else 0
    attempt.max_score = int(total_possible_points)
    attempt.is_passed = passed if not has_unreviewed else False
    attempt.status = "needs_review" if has_unreviewed else "submitted"
    attempt.submitted_at = now

    # Update participant: if needs manual review, score and passed are not set until reviewed
    participant.status = "submitted"
    participant.score = score_percent if not has_unreviewed else 0.0
    participant.points_earned = earned_points if not has_unreviewed else 0
    participant.total_points = total_possible_points
    participant.passed = passed if not has_unreviewed else False
    participant.attempt_id = attempt.id
    participant.progress_percent = 100
    participant.finished_at = now

    await db.commit()
    await db.refresh(participant)

    # Broadcast completion to examiner dashboard
    await live_exam_manager.broadcast(
        session_id,
        {
            "type": "PARTICIPANT_SUBMITTED",
            "participant": _map_participant_response(participant).model_dump(mode="json"),
        },
    )

    return {
        "status": "needs_review" if has_unreviewed else "submitted",
        "score": None if has_unreviewed else score_percent,
        "points_earned": None if has_unreviewed else earned_points,
        "total_points": total_possible_points,
        "passed": None if has_unreviewed else passed,
        "needs_review": has_unreviewed,
        "attempt_id": attempt.id,
    }


# ==============================================================================
# 5. EXAM STATISTICS & PROTOCOLS (RBAC: ADMIN VS DEPARTMENT HEAD)
# ==============================================================================


@router.get("/stats")
async def get_exam_statistics(
    session_id: Optional[int] = Query(None),
    test_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "superadmin", "department_head")),
):
    """
    Статистика по проведенным очным экзаменам.
    - Администраторы и суперадминистраторы: видят всех сотрудников и сессии, могут проверять.
    - Начальники отделов: строго ограничены только сотрудниками своего отдела.
    """
    is_head = current_user.role == "department_head"
    user_dept = current_user.department or ""

    stmt = (
        select(ExamParticipant)
        .join(ExamSession, ExamParticipant.session_id == ExamSession.id)
        .outerjoin(User, ExamParticipant.user_id == User.id)
        .outerjoin(Test, ExamSession.test_id == Test.id)
        .outerjoin(Attempt, ExamParticipant.attempt_id == Attempt.id)
        .options(
            selectinload(ExamParticipant.session).selectinload(ExamSession.test),
            selectinload(ExamParticipant.user),
            selectinload(ExamParticipant.attempt),
        )
        .order_by(desc(ExamParticipant.joined_at))
    )

    # RBAC Filter: Department Head strictly restricted to their department
    if is_head:
        if current_user.department_id:
            stmt = stmt.where(User.department_id == current_user.department_id)
        elif user_dept:
            stmt = stmt.where(User.department == user_dept)
        else:
            stmt = stmt.where(User.id == current_user.id)
    else:
        if department and department != "all":
            stmt = stmt.where(User.department == department)

    if session_id:
        stmt = stmt.where(ExamParticipant.session_id == session_id)

    if test_id:
        stmt = stmt.where(ExamSession.test_id == test_id)

    if status_filter and status_filter != "all":
        if status_filter == "passed":
            stmt = stmt.where(ExamParticipant.passed == True, ExamParticipant.status == "submitted")
        elif status_filter == "failed":
            stmt = stmt.where(ExamParticipant.passed == False, ExamParticipant.status == "submitted")
        elif status_filter == "needs_review":
            stmt = stmt.where(Attempt.status == "needs_review")
        else:
            stmt = stmt.where(ExamParticipant.status == status_filter)

    if search:
        search_term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.full_name).like(search_term),
                func.lower(User.email).like(search_term),
                func.lower(ExamParticipant.guest_name).like(search_term),
                func.lower(ExamSession.title).like(search_term),
            )
        )

    res = await db.execute(stmt)
    participants = res.scalars().all()

    # Sessions for filter dropdown
    sessions_stmt = select(ExamSession).order_by(desc(ExamSession.created_at)).limit(100)
    s_res = await db.execute(sessions_stmt)
    all_sessions = s_res.scalars().all()

    # Unique departments for filter dropdown
    dept_stmt = select(User.department).where(User.department.isnot(None), User.department != "").distinct()
    dept_res = await db.execute(dept_stmt)
    all_departments = sorted([d[0] for d in dept_res.all() if d[0]])

    items = []
    total_score_sum = 0
    submitted_count = 0
    passed_count = 0
    failed_count = 0
    needs_review_count = 0
    disqualified_count = 0
    total_violations = 0

    for p in participants:
        s = p.session
        t = s.test if s else None
        att = p.attempt

        full_name = p.user.full_name if p.user else (p.guest_name or "Гость")
        email = p.user.email if p.user else None
        dept = p.user.department if p.user else "—"

        is_needs_review = att.status == "needs_review" if att else False

        if p.status == "submitted":
            if is_needs_review:
                needs_review_count += 1
            else:
                submitted_count += 1
                total_score_sum += p.score
                if p.passed:
                    passed_count += 1
                else:
                    failed_count += 1
        elif p.status == "disqualified":
            disqualified_count += 1

        total_violations += (p.tab_switches_count or 0) + (getattr(p, "right_clicks_count", 0) or 0)

        items.append({
            "id": p.id,
            "session_id": s.id if s else None,
            "session_title": s.title if s else "Экзамен",
            "session_status": s.status if s else "unknown",
            "pin_code": s.pin_code if s else "",
            "test_id": t.id if t else (s.test_id if s else None),
            "test_title": t.title if t else "Тест",
            "user_id": p.user_id,
            "full_name": full_name,
            "email": email,
            "department": dept,
            "status": "needs_review" if is_needs_review else p.status,
            "score": p.score if not is_needs_review else None,
            "points_earned": p.points_earned if not is_needs_review else None,
            "total_points": p.total_points,
            "passed": p.passed if not is_needs_review else None,
            "tab_switches_count": p.tab_switches_count,
            "right_clicks_count": getattr(p, "right_clicks_count", 0),
            "attempt_id": p.attempt_id,
            "attempt_status": att.status if att else None,
            "needs_review": is_needs_review,
            "joined_at": p.joined_at,
            "finished_at": p.finished_at,
        })

    avg_score = round(total_score_sum / submitted_count, 1) if submitted_count > 0 else 0.0

    return {
        "summary": {
            "total_participants": len(participants),
            "submitted_count": submitted_count,
            "passed_count": passed_count,
            "failed_count": failed_count,
            "needs_review_count": needs_review_count,
            "disqualified_count": disqualified_count,
            "total_violations": total_violations,
            "average_score": avg_score,
            "user_role": current_user.role,
            "can_review": current_user.role in ("admin", "superadmin"),
            "managed_department": user_dept if is_head else None,
        },
        "sessions": [
            {"id": s.id, "title": s.title, "pin_code": s.pin_code, "status": s.status}
            for s in all_sessions
        ],
        "departments": all_departments,
        "items": items,
    }


# ==============================================================================
# 5. WEBSOCKET REAL-TIME SYNC
# ==============================================================================


@router.websocket("/ws/{session_id}")
async def exam_websocket_endpoint(websocket: WebSocket, session_id: int):
    """
    WebSocket канал сессии для мгновенной рассылки сигналов:
    START_EXAM, EXTEND_TIME, FINISH_EXAM, PARTICIPANT_PROGRESS.
    """
    await live_exam_manager.connect(session_id, websocket)
    try:
        while True:
            # Keep connection open and receive heartbeats / pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await live_exam_manager.disconnect(session_id, websocket)
    except Exception:
        await live_exam_manager.disconnect(session_id, websocket)
