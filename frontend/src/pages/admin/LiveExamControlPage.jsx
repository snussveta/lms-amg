import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Trash2,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '../../api/client';
import { ConfirmModal } from '../../components/ConfirmModal';

export const LiveExamControlPage = () => {
  const { sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [confirmState, setConfirmState] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const wsRef = useRef(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    loadSession();
    setupWebSocket();

    // Polling fallback every 3 seconds for guaranteed real-time updates
    pollTimerRef.current = setInterval(() => {
      fetchLatestParticipants();
    }, 3000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/exam/sessions/${sessionId}`);
      setSession(res.data);
      setParticipants(res.data.participants || []);
    } catch (err) {
      console.error('Ошибка загрузки сессии экзамена:', err);
      setError('Не удалось загрузить данные экзаменационной сессии.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestParticipants = async () => {
    try {
      const res = await api.get(`/exam/sessions/${sessionId}`);
      setSession(res.data);
      setParticipants(res.data.participants || []);
    } catch (err) {
      // quiet poll
    }
  };

  // Synchronized countdown timer calculation
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
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.status, session?.started_at, session?.time_limit_minutes]);

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

      ws.onerror = (e) => {
        console.warn('LiveExam WS error, falling back to HTTP polling');
      };
    } catch (err) {
      console.warn('Could not connect live exam WS:', err);
    }
  };

  const handleLiveEvent = (msg) => {
    if (msg.type === 'PARTICIPANT_JOINED') {
      setParticipants((prev) => {
        if (prev.some((p) => p.id === msg.participant.id)) return prev;
        return [...prev, msg.participant];
      });
    } else if (msg.type === 'PARTICIPANT_PROGRESS') {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === msg.participant_id
            ? {
              ...p,
              current_question_index: msg.current_question_index,
              progress_percent: msg.progress_percent,
              tab_switches_count: msg.tab_switches_count,
              right_clicks_count: msg.right_clicks_count || p.right_clicks_count || 0,
            }
            : p
        )
      );
    } else if (msg.type === 'PARTICIPANT_SUBMITTED') {
      setParticipants((prev) =>
        prev.map((p) => (p.id === msg.participant.id ? msg.participant : p))
      );
    } else if (msg.type === 'EXAM_STARTED') {
      setSession((prev) => (prev ? { ...prev, status: 'in_progress', started_at: msg.started_at } : prev));
    } else if (msg.type === 'TIME_EXTENDED') {
      setSession((prev) => (prev ? { ...prev, time_limit_minutes: msg.new_time_limit_minutes } : prev));
    } else if (msg.type === 'EXAM_FINISHED') {
      setSession((prev) => (prev ? { ...prev, status: 'completed' } : prev));
    }
  };

  const handleCopyCode = () => {
    if (!session?.pin_code) return;
    navigator.clipboard.writeText(session.pin_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!session?.pin_code) return;
    const link = `${window.location.origin}/exam/join?code=${session.pin_code}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Start Exam
  const handleStartExam = async () => {
    if (participants.length === 0) {
      alert('В зале ожидания пока нет ни одного сотрудника. Подождите, пока участники подключатся по PIN-коду.');
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/exam/sessions/${sessionId}/start`);
      await loadSession();
    } catch (err) {
      console.error('Ошибка старта экзамена:', err);
      alert('Не удалось запустить экзамен: ' + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Extend time
  const handleExtendTime = async (minutes = 5) => {
    try {
      setActionLoading(true);
      await api.post(`/exam/sessions/${sessionId}/extend?added_minutes=${minutes}`);
      await fetchLatestParticipants();
    } catch (err) {
      console.error('Ошибка продления времени:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Finish Exam
  const requestFinishExam = () => {
    setConfirmState({
      title: 'Завершить экзамен для всех?',
      message: 'Все участники будут принудительно остановлены, а их ответы отправлены на проверку.',
      confirmText: 'Завершить экзамен',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          await api.post(`/exam/sessions/${sessionId}/finish`);
          await loadSession();
        } catch (err) {
          console.error('Ошибка завершения:', err);
        } finally {
          setActionLoading(false);
          setConfirmState(null);
        }
      },
    });
  };

  // Disqualify
  const requestDisqualify = (p) => {
    setConfirmState({
      title: 'Дисквалифицировать сотрудника?',
      message: `Вы уверены, что хотите дисквалифицировать «${p.full_name}» за нарушение правил (списывание)? Доступ будет аннулирован, а результат обнулен.`,
      confirmText: 'Дисквалифицировать',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await api.post(`/exam/sessions/${sessionId}/disqualify/${p.id}`);
          await fetchLatestParticipants();
        } catch (err) {
          console.error('Ошибка дисквалификации:', err);
        } finally {
          setConfirmState(null);
        }
      },
    });
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

  if (error || !session) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-[#E84C3D] mx-auto mb-3" />
        <h2 className="text-lg font-bold text-[#222222]">{error || 'Сессия не найдена'}</h2>
        <Link to="/admin/tests" className="btn-primary mt-4 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Вернуться к тестам</span>
        </Link>
      </div>
    );
  }

  const isWaiting = session.status === 'waiting';
  const isInProgress = session.status === 'in_progress';
  const isCompleted = session.status === 'completed';

  const submittedCount = participants.filter((p) => p.status === 'submitted').length;
  const passedCount = participants.filter((p) => p.status === 'submitted' && p.passed).length;
  const avgScore =
    submittedCount > 0
      ? Math.round(
        participants
          .filter((p) => p.status === 'submitted')
          .reduce((sum, p) => sum + (p.score || 0), 0) / submittedCount
      )
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/admin/tests"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#777777] hover:text-[#141414] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Назад к тестам</span>
            </Link>
            <span className="text-[#DDDDDD]">•</span>
            <Link
              to="/admin/exam-stats"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E84C3D] hover:underline transition-colors"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Журнал статистики экзаменов</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
              {session.title}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${isWaiting
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : isInProgress
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                  : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                }`}
            >
              {isWaiting ? 'Ожидание старта' : isInProgress ? 'Экзамен идет' : 'Завершен'}
            </span>
          </div>
          <p className="text-xs text-[#777777] mt-1">
            Тест: <strong>{session.test_title}</strong> • Лимит:{' '}
            <strong>{session.time_limit_minutes} мин.</strong> • Проходной:{' '}
            <strong>{session.passing_score}%</strong>
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isInProgress && (
            <>
              <button
                type="button"
                onClick={() => handleExtendTime(5)}
                disabled={actionLoading}
                className="btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5 min-h-[42px] font-bold"
                title="Добавить 5 минут к общему таймеру"
              >
                <Plus className="w-4 h-4 text-[#E84C3D]" />
                <span>+5 мин.</span>
              </button>

              <button
                type="button"
                onClick={requestFinishExam}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 min-h-[42px]"
              >
                <StopCircle className="w-4 h-4" />
                <span>Завершить для всех</span>
              </button>
            </>
          )}

          {isWaiting && (
            <button
              type="button"
              onClick={handleStartExam}
              disabled={actionLoading || participants.length === 0}
              className="btn-primary text-xs sm:text-sm px-6 py-2.5 flex items-center gap-2 font-black shadow-lg min-h-[44px] disabled:opacity-50"
            >
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>НАЧАТЬ ЭКЗАМЕН ДЛЯ ВСЕХ ({participants.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* PIN Code & Join Link Hero Banner */}
      <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-md p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-black uppercase tracking-wider text-[#E84C3D]">
            <Zap className="w-4 h-4 fill-current" />
            <span>Код для входа сотрудников в аудитории:</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-3">
            <span className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-[#141414] bg-[#F5F5F7] px-5 py-2 rounded-2xl border border-[#CED4DA] select-all shadow-inner">
              {session.pin_code.slice(0, 3)} {session.pin_code.slice(3)}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-3 rounded-2xl bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#CED4DA] transition-colors"
              title="Скопировать PIN-код"
            >
              {copiedCode ? (
                <Check className="w-5 h-5 text-emerald-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-[#777777]">
            Сотрудники нажимают на кнопку <strong>«Войти в экзамен»</strong> на портале и вводят этот код.
          </p>
        </div>

        {/* Direct Link & Timer / Stats */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {isInProgress ? (
            <div className="bg-[#141414] text-white p-5 rounded-2xl text-center shadow-lg w-full sm:w-auto min-w-[200px]">
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E84C3D]" />
                <span>Осталось времени:</span>
              </div>
              <div
                className={`font-mono text-3xl sm:text-4xl font-black ${timeLeftSeconds <= 120 ? 'text-[#E84C3D] animate-pulse' : 'text-white'
                  }`}
              >
                {formatTimer(timeLeftSeconds)}
              </div>
            </div>
          ) : isCompleted ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl text-center shadow-xs">
              <div className="text-xs font-bold">Экзамен завершен</div>
              <div className="text-xl font-black mt-1">
                {passedCount} из {submittedCount} сдали ({avgScore}%)
              </div>
            </div>
          ) : null}

          {/* Direct Link Share Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="btn-secondary text-xs px-4 py-3 rounded-2xl flex items-center gap-2 w-full sm:w-auto justify-center font-bold shadow-xs min-h-[46px]"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-bold">Ссылка скопирована</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                <span>Скопировать прямую ссылку</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Participants Monitor (Live Table / Lobby) */}
      <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#EEEEEE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#141414] text-white flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#222222]">
                Участники экзамена ({participants.length})
              </h3>
              <p className="text-xs text-[#777777]">
                {isWaiting
                  ? 'Список сотрудников, ожидающих старта в лобби'
                  : isInProgress
                    ? 'Мониторинг процесса сдачи и контроль нарушений (античит)'
                    : 'Итоговый протокол сдачи экзамена'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              В сети: {participants.filter((p) => p.status !== 'disqualified').length}
            </span>
            {isInProgress && (
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Сдали: {submittedCount} / {participants.length}
              </span>
            )}
          </div>
        </div>

        {/* Participants Table */}
        {participants.length === 0 ? (
          <div className="p-16 text-center text-[#777777] space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] text-[#141414] flex items-center justify-center mx-auto mb-2 animate-bounce">
              <Users className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-[#222222]">Зал ожидания пуст</h4>
            <p className="text-xs text-[#777777] max-w-sm mx-auto">
              Попросите сотрудников нажать кнопку <strong>«Войти в экзамен»</strong> на портале и ввести код{' '}
              <strong className="text-[#141414] font-mono">{session.pin_code}</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F5F5F7] text-[#777777] font-bold uppercase text-[11px] tracking-wider border-b border-[#EEEEEE]">
                <tr>
                  <th className="py-3 px-5">№</th>
                  <th className="py-3 px-5">Сотрудник</th>
                  <th className="py-3 px-5">Отдел</th>
                  <th className="py-3 px-5">Статус / Прогресс</th>
                  <th className="py-3 px-5">Нарушения (Античит)</th>
                  <th className="py-3 px-5">Результат</th>
                  <th className="py-3 px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE]">
                {participants.map((p, idx) => {
                  const isDisqualified = p.status === 'disqualified';
                  const isSubmitted = p.status === 'submitted';
                  const isTaking = p.status === 'taking';

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#F8F9FA] transition-colors ${isDisqualified ? 'bg-red-50/50 opacity-60' : ''
                        }`}
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-[#777777]">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#222222] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#141414] text-white flex items-center justify-center text-xs font-black shrink-0">
                            {p.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{p.full_name}</div>
                            {p.email && (
                              <div className="text-[11px] text-[#777777] font-mono">
                                {p.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 font-semibold text-[#141414]">
                        {p.department || '—'}
                      </td>

                      <td className="py-3.5 px-5">
                        {isDisqualified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                            <XCircle className="w-3.5 h-3.5" />
                            Дисквалифицирован
                          </span>
                        ) : isSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Сдал ответы
                          </span>
                        ) : isTaking ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                                Вопрос {p.current_question_index + 1}
                              </span>
                              <span className="text-[11px] text-[#777777]">
                                ({p.progress_percent}%)
                              </span>
                            </div>
                            <div className="w-28 h-1.5 bg-[#EEEEEE] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 transition-all duration-300"
                                style={{ width: `${p.progress_percent}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            В лобби, готов
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        {((p.tab_switches_count || 0) > 0 || (p.right_clicks_count || 0) > 0) ? (
                          <div className="flex flex-col gap-1 items-start">
                            {p.tab_switches_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0]">
                                <ShieldAlert className="w-3 h-3" />
                                Уход с экрана ({p.tab_switches_count}x)
                              </span>
                            )}
                            {p.right_clicks_count > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                🖱️ Правая кнопка ({p.right_clicks_count}x)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Чисто (0)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5">
                        {isSubmitted ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-black ${p.passed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                                }`}
                            >
                              {p.score}% ({p.passed ? 'Сдал' : 'Не сдал'})
                            </span>
                            <span className="text-[11px] text-[#777777]">
                              {p.points_earned} / {p.total_points} б.
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#777777]">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        {!isDisqualified && (
                          <button
                            type="button"
                            onClick={() => requestDisqualify(p)}
                            className="p-1.5 rounded-lg text-[#777777] hover:text-[#E84C3D] hover:bg-[#FCECEB] transition-colors"
                            title="Дисквалифицировать за списывание"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={Boolean(confirmState)}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          variant={confirmState.variant}
        />
      )}
    </div>
  );
};
