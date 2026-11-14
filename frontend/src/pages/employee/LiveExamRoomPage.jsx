import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Flame,
  HelpCircle,
  Layers,
  Lock,
  LogOut,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../../components/ConfirmModal';

export const LiveExamRoomPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // User answers map: { [questionId]: { selected_option_ids: [], text_answer: '' } }
  const [userAnswers, setUserAnswers] = useState({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Live Timer & Countdown state
  const [countdown, setCountdown] = useState(null); // 3, 2, 1, or null
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);

  // Anti-cheat warnings
  const [cheatWarning, setCheatWarning] = useState('');
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    initRoom();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionId]);

  const initRoom = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Session
      const sRes = await api.get(`/exam/sessions/${sessionId}`);
      const sessionData = sRes.data;
      setSession(sessionData);

      // 2. Identify Participant
      let pId = sessionStorage.getItem(`exam_participant_${sessionId}`);
      let currentPart = null;

      if (pId) {
        currentPart = (sessionData.participants || []).find((p) => String(p.id) === String(pId));
      }

      if (!currentPart && user) {
        currentPart = (sessionData.participants || []).find((p) => p.user_id === user.id);
      }

      // If user is authenticated but not yet a participant, join automatically
      if (!currentPart && user) {
        const jRes = await api.post('/exam/join', {
          session_token: sessionData.session_token,
        });
        currentPart = jRes.data.participant;
      }

      if (currentPart) {
        setParticipant(currentPart);
        sessionStorage.setItem(`exam_participant_${sessionId}`, currentPart.id);

        if (currentPart.status === 'submitted') {
          setResult({
            score: currentPart.score,
            points_earned: currentPart.points_earned,
            total_points: currentPart.total_points,
            passed: currentPart.passed,
          });
        }
      }

      // 3. If in progress, fetch questions
      if (sessionData.status === 'in_progress' && currentPart) {
        await loadQuestions(currentPart.id);
      }

      // 4. Connect WebSocket
      setupWebSocket();

      // 5. Polling fallback every 3s
      pollTimerRef.current = setInterval(() => {
        checkSessionState();
      }, 3000);
    } catch (err) {
      console.error('Ошибка входа в зал экзамена:', err);
      setError(err.response?.data?.detail || 'Не удалось войти в зал экзамена.');
    } finally {
      setLoading(false);
    }
  };

  const checkSessionState = async () => {
    try {
      const sRes = await api.get(`/exam/sessions/${sessionId}`);
      const sData = sRes.data;
      setSession(sData);

      if (sData.status === 'in_progress' && questions.length === 0 && participant) {
        await loadQuestions(participant.id);
      }
    } catch {
      // quiet poll
    }
  };

  const loadQuestions = async (partId) => {
    try {
      const qRes = await api.get(`/exam/sessions/${sessionId}/questions?participant_id=${partId}`);
      setQuestions(qRes.data || []);
    } catch (err) {
      console.error('Ошибка загрузки вопросов:', err);
    }
  };

  // Synchronized Timer
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || !session.started_at) {
      return;
    }

    const updateTimer = () => {
      const started = new Date(session.started_at).getTime();
      const totalMs = session.time_limit_minutes * 60 * 1000;
      const endsAt = started + totalMs;
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((endsAt - now) / 1000));
      setTimeLeftSeconds(diffSec);

      if (diffSec === 0 && !submitting && !result && participant?.status === 'taking') {
        // Auto-submit when time is up
        handleAutoSubmit();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.status, session?.started_at, session?.time_limit_minutes, submitting, result, participant]);

  // Anti-Cheat: Tab Switching / Blur Listener
  useEffect(() => {
    if (session?.status !== 'in_progress' || result || participant?.status !== 'taking') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setCheatWarning('⚠️ Внимание! Переключение вкладок зафиксировано и передано экзаменатору!');
        setTimeout(() => setCheatWarning(''), 6000);

        if (participant?.id) {
          api.post(`/exam/sessions/${sessionId}/progress`, {
            participant_id: participant.id,
            current_question_index: currentQIndex,
            progress_percent: Math.round(((currentQIndex + 1) / (questions.length || 1)) * 100),
            switched_tab: true,
          }).catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.status, result, participant, currentQIndex, questions.length]);

  const setupWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/exam/ws/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleLiveEvent(msg);
        } catch {
          // heartbeat
        }
      };

      ws.onerror = () => {
        console.warn('LiveExam WS error, fallback active');
      };
    } catch (err) {
      console.warn('Could not connect live exam WS:', err);
    }
  };

  const handleLiveEvent = (msg) => {
    if (msg.type === 'EXAM_STARTED') {
      // Trigger dramatic 3-2-1 countdown!
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(() => {
        setCountdown(null);
        setSession((prev) => (prev ? { ...prev, status: 'in_progress', started_at: msg.started_at } : prev));
        if (participant) {
          loadQuestions(participant.id);
        }
      }, 3000);
    } else if (msg.type === 'TIME_EXTENDED') {
      setSession((prev) => (prev ? { ...prev, time_limit_minutes: msg.new_time_limit_minutes } : prev));
    } else if (msg.type === 'EXAM_FINISHED') {
      handleAutoSubmit();
    } else if (msg.type === 'PARTICIPANT_DISQUALIFIED') {
      if (participant && msg.participant_id === participant.id) {
        setParticipant((prev) => ({ ...prev, status: 'disqualified' }));
      }
    }
  };

  // Answer handlers
  const handleSelectOption = (questionId, optionId, isMultiple = false) => {
    setUserAnswers((prev) => {
      const current = prev[questionId] || { selected_option_ids: [], text_answer: '' };
      let newOptionIds = [];

      if (isMultiple) {
        newOptionIds = current.selected_option_ids.includes(optionId)
          ? current.selected_option_ids.filter((id) => id !== optionId)
          : [...current.selected_option_ids, optionId];
      } else {
        newOptionIds = [optionId];
      }

      return {
        ...prev,
        [questionId]: {
          ...current,
          selected_option_ids: newOptionIds,
        },
      };
    });

    // Report progress periodically
    if (participant?.id) {
      const answeredCount = Object.keys(userAnswers).length + 1;
      const prog = Math.round((answeredCount / (questions.length || 1)) * 100);
      api.post(`/exam/sessions/${sessionId}/progress`, {
        participant_id: participant.id,
        current_question_index: currentQIndex,
        progress_percent: prog,
        switched_tab: false,
      }).catch(() => {});
    }
  };

  const handleTextAnswer = (questionId, text) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        selected_option_ids: [],
        text_answer: text,
      },
    }));
  };

  // Submit
  const handleAutoSubmit = async () => {
    if (submitting || result) return;
    await doSubmit();
  };

  const doSubmit = async () => {
    if (!participant) return;
    try {
      setSubmitting(true);
      setError('');

      const answersPayload = Object.keys(userAnswers).map((qId) => ({
        question_id: parseInt(qId, 10),
        selected_option_ids: userAnswers[qId].selected_option_ids || [],
        text_answer: userAnswers[qId].text_answer || null,
      }));

      const res = await api.post(`/exam/sessions/${sessionId}/submit`, {
        participant_id: participant.id,
        answers: answersPayload,
      });

      setResult(res.data);
      setParticipant((prev) => ({ ...prev, status: 'submitted' }));
      setConfirmSubmitOpen(false);
    } catch (err) {
      console.error('Ошибка отправки экзамена:', err);
      setError('Не удалось отправить результаты: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="w-8 h-8 border-3 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 1. DISQUALIFIED SCREEN
  if (participant?.status === 'disqualified') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-red-200 shadow-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-[#E84C3D] flex items-center justify-center mx-auto border border-red-200">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#222222]">Вы дисквалифицированы</h2>
          <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">
            Экзаменатор остановил ваше тестирование за нарушение регламента (попытка списать или свертывание браузера).
          </p>
          <div className="pt-2">
            <Link to="/courses" className="btn-primary w-full py-3 inline-flex items-center justify-center">
              Вернуться в личный кабинет
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. RESULTS / FINISHED SCREEN
  if (result) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EEEEEE] shadow-2xl p-8 text-center space-y-5 animate-fade-in">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto border ${
              result.passed
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-red-50 text-[#E84C3D] border-red-200'
            }`}
          >
            {result.passed ? (
              <CheckCircle2 className="w-9 h-9" />
            ) : (
              <XCircle className="w-9 h-9" />
            )}
          </div>

          <div>
            <span
              className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                result.passed
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {result.passed ? 'Экзамен сдан' : 'Не сдан'}
            </span>
            <h2 className="text-2xl font-black text-[#222222] mt-3">
              {result.passed ? 'Поздравляем!' : 'Тестирование завершено'}
            </h2>
            <p className="text-xs text-[#777777] mt-1">
              Ваши ответы успешно отправлены и зафиксированы в протоколе.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#EEEEEE] grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                Итоговый балл
              </div>
              <div className="text-2xl font-black text-[#141414] mt-0.5">
                {result.score}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                Баллов набрано
              </div>
              <div className="text-2xl font-black text-[#141414] mt-0.5">
                {result.points_earned} / {result.total_points}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/courses"
              className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2 font-bold"
            >
              <BookOpen className="w-4 h-4" />
              <span>Вернуться к курсам</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. COUNTDOWN SCREEN (3... 2... 1...)
  if (countdown !== null) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col items-center justify-center p-4 select-none">
        <div className="text-center space-y-4 animate-scale-up">
          <div className="text-xs uppercase tracking-widest font-black text-[#E84C3D]">
            Приготовьтесь к старту
          </div>
          <div className="font-mono text-8xl sm:text-9xl font-black text-white">
            {countdown}
          </div>
          <div className="text-xs sm:text-sm text-white/70 max-w-xs mx-auto">
            Экзамен запускается синхронно для всех компьютеров в аудитории!
          </div>
        </div>
      </div>
    );
  }

  // 4. LOBBY WAITING SCREEN
  if (session?.status === 'waiting') {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-[#EEEEEE] shadow-2xl p-7 sm:p-9 text-center space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-[#141414] text-white flex items-center justify-center mx-auto shadow-lg relative">
            <Zap className="w-8 h-8 text-[#E84C3D] fill-current animate-pulse" />
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 absolute -top-1 -right-1 ring-4 ring-white" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-[#E84C3D] bg-[#FCECEB] px-3 py-1 rounded-full border border-[#F8D3D0]">
              Зал ожидания экзамена
            </span>
            <h1 className="text-2xl font-black text-[#222222] tracking-tight pt-2">
              {session.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#777777]">
              Тест: <strong>{session.test_title}</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-2 text-xs">
            <div className="flex items-center justify-center gap-2 text-[#141414] font-bold">
              <Clock className="w-4 h-4 text-[#E84C3D] animate-spin" />
              <span>Ожидание команды экзаменатора...</span>
            </div>
            <p className="text-[11px] text-[#777777] leading-relaxed">
              Вы успешно подключились к аудитории. Вопросы появятся на экране одновременно у всех сотрудников, как только экзаменатор нажмет «Старт».
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2 text-xs text-amber-900">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Правила проведения экзамена:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 leading-relaxed">
              <li>Лимит времени: <strong>{session.time_limit_minutes} минут</strong>.</li>
              <li>Проходной балл: <strong>{session.passing_score}%</strong>.</li>
              <li>
                <strong>Античит:</strong> свертывание браузера или переключение вкладок фиксируется в протоколе преподавателя!
              </li>
            </ul>
          </div>

          <div className="pt-2 text-xs text-[#777777] flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Ваш статус: готов к сдаче</span>
          </div>
        </div>
      </div>
    );
  }

  // 5. ACTIVE EXAM TAKING SCREEN
  const currentQ = questions[currentQIndex];

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-32">
      {/* Top Fixed Bar */}
      <div className="sticky top-0 z-30 bg-[#141414] text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-xs sm:text-sm truncate">
                {session.title}
              </span>
            </div>

            {/* Synchronized Timer */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                <Clock className="w-4 h-4 text-[#E84C3D]" />
                <span
                  className={`font-mono text-sm sm:text-base font-black ${
                    timeLeftSeconds <= 120 ? 'text-[#E84C3D] animate-pulse' : 'text-white'
                  }`}
                >
                  {formatTimer(timeLeftSeconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(true)}
                disabled={submitting}
                className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold min-h-[38px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Завершить</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-4">
        {/* Anti-cheat banner if triggered */}
        {cheatWarning && (
          <div className="p-3.5 rounded-2xl bg-[#FCECEB] border border-[#E84C3D] text-[#E84C3D] text-xs font-bold flex items-center gap-2 shadow-md animate-bounce">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{cheatWarning}</span>
          </div>
        )}

        {/* Question Navigator (Pills) */}
        <div className="bg-white rounded-2xl border border-[#EEEEEE] p-3 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {questions.map((q, idx) => {
              const isAnswered = Boolean(
                userAnswers[q.id]?.selected_option_ids?.length ||
                  userAnswers[q.id]?.text_answer?.trim()
              );
              const isCurrent = currentQIndex === idx;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentQIndex(idx)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 transition-all ${
                    isCurrent
                      ? 'bg-[#141414] text-white ring-2 ring-[#141414] shadow-sm'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold'
                      : 'bg-[#F5F5F7] text-[#777777] hover:bg-[#EEEEEE]'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question Card */}
        {currentQ && (
          <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-3 border-b border-[#EEEEEE] pb-3 text-xs">
              <span className="font-bold text-[#777777] uppercase tracking-wider">
                Вопрос {currentQIndex + 1} из {questions.length}
              </span>
              <span className="font-bold text-[#141414] bg-[#F5F5F7] px-2.5 py-1 rounded-lg border border-[#EEEEEE]">
                +{currentQ.points} {currentQ.points === 1 ? 'балл' : 'баллов'}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#222222] leading-relaxed">
              {currentQ.text}
            </h3>

            {/* Options */}
            <div className="space-y-3 pt-2">
              {/* Single Choice & Dropdown */}
              {(currentQ.question_type === 'single_choice' || currentQ.question_type === 'dropdown') && (
                <div className="space-y-2.5">
                  {currentQ.options?.map((opt) => {
                    const isSelected =
                      userAnswers[currentQ.id]?.selected_option_ids?.includes(opt.id) || false;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(currentQ.id, opt.id, false)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                          isSelected
                            ? 'bg-[#F0F5FA] border-[#141414] text-[#141414] font-bold ring-2 ring-[#141414]'
                            : 'bg-white border-[#EEEEEE] hover:border-[#CED4DA] hover:bg-[#F8F9FA] text-[#222222]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? 'border-[#141414] bg-[#141414] text-white'
                              : 'border-[#CED4DA] bg-white'
                          }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm leading-relaxed">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Multiple Choice */}
              {currentQ.question_type === 'multiple_choice' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#777777] font-semibold mb-1">
                    Выберите один или несколько правильных ответов:
                  </p>
                  {currentQ.options?.map((opt) => {
                    const isSelected =
                      userAnswers[currentQ.id]?.selected_option_ids?.includes(opt.id) || false;

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSelectOption(currentQ.id, opt.id, true)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 select-none ${
                          isSelected
                            ? 'bg-[#F0F5FA] border-[#141414] text-[#141414] font-bold ring-2 ring-[#141414]'
                            : 'bg-white border-[#EEEEEE] hover:border-[#CED4DA] hover:bg-[#F8F9FA] text-[#222222]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isSelected
                              ? 'border-[#141414] bg-[#141414] text-white'
                              : 'border-[#CED4DA] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-sm leading-relaxed">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Text / Short Answer */}
              {currentQ.question_type === 'text' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#777777]">
                    Ваш ответ:
                  </label>
                  <input
                    type="text"
                    value={userAnswers[currentQ.id]?.text_answer || ''}
                    onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                    placeholder="Введите ответ..."
                    className="input-field text-sm w-full bg-white font-mono"
                  />
                </div>
              )}

              {/* Manual Review / Paragraph */}
              {currentQ.question_type === 'manual_review' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#777777]">
                    Развернутый ответ (проверяется экзаменатором):
                  </label>
                  <textarea
                    rows={4}
                    value={userAnswers[currentQ.id]?.text_answer || ''}
                    onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
                    placeholder="Подробно опишите ваш ответ..."
                    className="input-field text-sm w-full bg-white resize-none"
                  />
                </div>
              )}
            </div>

            {/* Card Bottom: Prev / Next */}
            <div className="pt-4 border-t border-[#EEEEEE] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQIndex === 0}
                className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 min-h-[40px] disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Предыдущий</span>
              </button>

              {currentQIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold min-h-[40px]"
                >
                  <span>Следующий</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSubmitOpen(true)}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 font-bold min-h-[40px] bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Завершить экзамен</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmSubmitOpen && (
        <ConfirmModal
          isOpen={confirmSubmitOpen}
          onClose={() => setConfirmSubmitOpen(false)}
          onConfirm={doSubmit}
          title="Завершить и сдать экзамен?"
          message={`Вы ответили на ${
            Object.keys(userAnswers).length
          } из ${questions.length} вопросов. После отправки изменить ответы будет невозможно.`}
          confirmText="Да, отправить ответы"
        />
      )}
    </div>
  );
};
