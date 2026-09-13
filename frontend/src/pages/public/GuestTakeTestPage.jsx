import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  FileQuestion,
  HelpCircle,
  Send,
  ShieldCheck,
  User,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api, { getErrorMessage } from '../../api/client';

export const GuestTakeTestPage = () => {
  const { token, testId } = useParams();
  const identifier = token || testId;

  // Flow stage: 'info' (guest form) -> 'testing' (in progress) -> 'result' (completed)
  const [stage, setStage] = useState('info');

  // 1. Info stage data
  const [testInfo, setTestInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState('');

  // Guest registration form state
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
  });
  const [formError, setFormError] = useState('');
  const [starting, setStarting] = useState(false);

  // 2. Testing stage data
  const [attemptId, setAttemptId] = useState(null);
  const [guestToken, setGuestToken] = useState(null);
  const [testData, setTestData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Ref for timer auto-submit
  const answersRef = useRef(userAnswers);
  answersRef.current = userAnswers;
  const guestTokenRef = useRef(guestToken);
  guestTokenRef.current = guestToken;
  const attemptIdRef = useRef(attemptId);
  attemptIdRef.current = attemptId;

  // 3. Result stage data
  const [resultData, setResultData] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Load public test information on mount
  useEffect(() => {
    fetchTestInfo();
  }, [identifier]);

  const fetchTestInfo = async () => {
    try {
      setLoadingInfo(true);
      setInfoError('');
      const res = await api.get(`/public/tests/${identifier}`);
      setTestInfo(res.data);
    } catch (err) {
      console.error('Ошибка получения информации о тесте:', err);
      setInfoError(
        getErrorMessage(
          err,
          'Тестирование по данной ссылке недоступно или было отозвано администратором.'
        )
      );
    } finally {
      setLoadingInfo(false);
    }
  };

  // Start guest attempt
  const handleStartGuestAttempt = async (e) => {
    e.preventDefault();
    if (!formData.guest_name.trim()) {
      setFormError('Пожалуйста, укажите ваше ФИО для допуска к тестированию.');
      return;
    }
    setFormError('');
    setStarting(true);

    try {
      const res = await api.post(`/public/tests/${identifier}/start`, {
        guest_name: formData.guest_name.trim(),
        guest_email: formData.guest_email.trim() || null,
        guest_phone: formData.guest_phone.trim() || null,
      });

      const data = res.data;
      setAttemptId(data.attempt_id);
      setGuestToken(data.guest_session_token);
      setTestData(data.test);
      if (data.expires_at) {
        setExpiresAt(new Date(data.expires_at));
      }
      setStage('testing');
    } catch (err) {
      console.error('Ошибка старта гостевого тестирования:', err);
      setFormError(getErrorMessage(err, 'Не удалось начать тестирование. Попробуйте еще раз.'));
    } finally {
      setStarting(false);
    }
  };

  // Submit guest answers
  const submitTest = useCallback(async (isAutoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);

    const curAttemptId = attemptIdRef.current;
    const curToken = guestTokenRef.current;

    try {
      const formattedAnswers = Object.entries(answersRef.current).map(([qId, ans]) => ({
        question_id: parseInt(qId, 10),
        selected_option_ids: ans.selected_option_ids || [],
        text_answer: ans.text_answer || '',
      }));

      await api.post(
        `/public/attempts/${curAttemptId}/submit?session_token=${encodeURIComponent(curToken)}`,
        { answers: formattedAnswers },
        { headers: { 'X-Guest-Token': curToken } }
      );

      // Load results
      setLoadingResult(true);
      setStage('result');

      const resultRes = await api.get(
        `/public/attempts/${curAttemptId}/result?session_token=${encodeURIComponent(curToken)}`,
        {
          headers: { 'X-Guest-Token': curToken },
        }
      );
      setResultData(resultRes.data);

      if (resultRes.data.is_passed && resultRes.data.status !== 'needs_review') {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#475569', '#10b981', '#38bdf8'],
        });
      }
    } catch (err) {
      console.error('Ошибка отправки результатов гостя:', err);
      alert(getErrorMessage(err, 'Не удалось отправить результаты. Проверьте соединение.'));
      setSubmitting(false);
    } finally {
      setLoadingResult(false);
    }
  }, [submitting]);

  // Countdown Timer Sync
  useEffect(() => {
    if (!expiresAt || stage !== 'testing') return;

    const updateTimer = () => {
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffSec = Math.max(0, Math.floor(diffMs / 1000));
      setTimeLeft(diffSec);

      if (diffSec <= 0) {
        clearInterval(interval);
        submitTest(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, stage, submitTest]);

  // Answer handlers
  const handleSingleChoiceSelect = (questionId, optionId) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        selected_option_ids: [optionId],
        text_answer: '',
      },
    }));
  };

  const handleMultipleChoiceToggle = (questionId, optionId) => {
    setUserAnswers((prev) => {
      const existing = prev[questionId]?.selected_option_ids || [];
      const updated = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];

      return {
        ...prev,
        [questionId]: {
          selected_option_ids: updated,
          text_answer: '',
        },
      };
    });
  };

  const handleTextAnswerChange = (questionId, text) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: {
        selected_option_ids: [],
        text_answer: text,
      },
    }));
  };

  const isQuestionAnswered = (q) => {
    const ans = userAnswers[q.id];
    if (!ans) return false;
    if (q.question_type === 'text' || q.question_type === 'manual_review') {
      return !!ans.text_answer && ans.text_answer.trim().length > 0;
    }
    return ans.selected_option_ids && ans.selected_option_ids.length > 0;
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice':
        return 'Один вариант';
      case 'multiple_choice':
        return 'Несколько вариантов';
      case 'manual_review':
        return 'Развернутый ответ (ручная проверка)';
      case 'text':
        return 'Текстовый ответ';
      default:
        return type;
    }
  };

  const formatTimer = (totalSeconds) => {
    if (totalSeconds === null) return null;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} сек`;
    return `${mins} мин ${secs} сек`;
  };

  // ----------------------------------------------------
  // RENDER: Loading / Error
  // ----------------------------------------------------
  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Загрузка параметров тестирования AMG...</p>
        </div>
      </div>
    );
  }

  if (infoError || !testInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center shadow-lg">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
          <h3 className="text-lg font-bold text-white mb-2">Тестирование недоступно</h3>
          <p className="text-sm text-slate-400 mb-6">{infoError}</p>
          <Link to="/login" className="btn-secondary text-sm">
            Войти в личный кабинет
          </Link>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER STAGE 1: Guest Information Entry Form
  // ----------------------------------------------------
  if (stage === 'info') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-950">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
          {/* Брендинг AMG */}
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white tracking-wider">
                AMG
              </div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Гостевой доступ
              </span>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded">
              Открытый тест
            </span>
          </div>

          {/* Информация о тесте */}
          <h1 className="text-2xl font-bold text-white mb-2">{testInfo.title}</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {testInfo.description || 'Пройдите онлайн-тестирование для подтверждения знаний.'}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-6 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div>
              <div className="text-slate-500 text-[11px]">Вопросов</div>
              <div className="font-semibold text-slate-200 mt-0.5">{testInfo.question_count}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Лимит времени</div>
              <div className="font-semibold text-slate-200 mt-0.5">
                {testInfo.time_limit_minutes ? `${testInfo.time_limit_minutes} мин` : 'Нет'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Порог сдачи</div>
              <div className="font-semibold text-slate-200 mt-0.5">{testInfo.passing_score}%</div>
            </div>
          </div>

          {/* Форма идентификации гостя */}
          <form onSubmit={handleStartGuestAttempt} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ваше ФИО <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  className="input-field pl-9 text-sm"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                ФИО будет зафиксировано в протоколе сдачи теста для экзаменатора.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Электронная почта (опционально)
                </label>
                <input
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                  placeholder="example@mail.ru"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Телефон (опционально)
                </label>
                <input
                  type="tel"
                  value={formData.guest_phone}
                  onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                  placeholder="+7 (999) 000-00-00"
                  className="input-field text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={starting}
                className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-slate-100 text-slate-900 hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                {starting ? 'Инициализация...' : 'Начать тестирование'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER STAGE 2: Guest In-Progress Testing
  // ----------------------------------------------------
  if (stage === 'testing') {
    const questions = testData?.questions || [];
    const currentQuestion = questions[currentQIndex];
    const answeredCount = questions.filter(isQuestionAnswered).length;
    const isUrgentTimer = timeLeft !== null && timeLeft <= 120;

    return (
      <div className="min-h-screen pb-16 bg-slate-950">
        {/* Верхняя липкая полоса */}
        <header className="sticky top-0 z-30 w-full bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate">
              <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                AMG
              </div>
              <h2 className="text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-sm">
                {testData.title}
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                {formData.guest_name}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {timeLeft !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold border ${
                    isUrgentTimer
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                      : 'bg-slate-950 text-slate-200 border-slate-800'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              )}

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={submitting}
                className="btn-primary py-1.5 px-3.5 text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Завершить</span>
              </button>
            </div>
          </div>

          <div className="w-full bg-slate-800 h-1">
            <div
              className="bg-slate-300 h-1 transition-all duration-300"
              style={{
                width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
              }}
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* Информационная строка гостя */}
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-300" />
              <span>
                Гостевой сеанс: <strong className="text-white">{formData.guest_name}</strong>
              </span>
            </div>
            <span className="text-slate-500">Отвечено: {answeredCount} из {questions.length}</span>
          </div>

          {/* Панель номеров вопросов */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {questions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q);
              const isCurrent = idx === currentQIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`flex-shrink-0 w-9 h-9 rounded-lg font-semibold text-xs flex items-center justify-center transition-colors relative ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-900 shadow-sm'
                      : isAnswered
                      ? 'bg-slate-800 text-emerald-400 border border-slate-700 hover:bg-slate-750'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {idx + 1}
                  {isAnswered && !isCurrent && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Карточка текущего вопроса */}
          {currentQuestion && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                    Вопрос {currentQIndex + 1} из {questions.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/80">
                    {getQuestionTypeLabel(currentQuestion.question_type)}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                  +{currentQuestion.points} {currentQuestion.points === 1 ? 'балл' : 'баллов'}
                </span>
              </div>

              <h3 className="text-lg font-medium text-white leading-relaxed mb-6">
                {currentQuestion.text}
              </h3>

              <div className="space-y-3 mb-8">
                {currentQuestion.question_type === 'single_choice' && (
                  <div className="space-y-2.5">
                    {currentQuestion.options?.map((option) => {
                      const isSelected =
                        userAnswers[currentQuestion.id]?.selected_option_ids?.includes(option.id) ||
                        false;

                      return (
                        <div
                          key={option.id}
                          onClick={() => handleSingleChoiceSelect(currentQuestion.id, option.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-slate-800/90 border-slate-500 text-white'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                              isSelected
                                ? 'border-slate-200 bg-slate-200 text-slate-900'
                                : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />}
                          </div>
                          <span className="text-sm select-none leading-relaxed">
                            {option.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.question_type === 'multiple_choice' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-400 font-medium mb-1">
                      Выберите один или несколько правильных вариантов:
                    </p>
                    {currentQuestion.options?.map((option) => {
                      const isSelected =
                        userAnswers[currentQuestion.id]?.selected_option_ids?.includes(option.id) ||
                        false;

                      return (
                        <div
                          key={option.id}
                          onClick={() => handleMultipleChoiceToggle(currentQuestion.id, option.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-slate-800/90 border-slate-500 text-white'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-1 transition-colors ${
                              isSelected
                                ? 'border-slate-200 bg-slate-200 text-slate-900'
                                : 'border-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-slate-900 stroke-[3]" />}
                          </div>
                          <span className="text-sm select-none leading-relaxed">
                            {option.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.question_type === 'manual_review' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300/90">
                      <FileEdit className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                      <span>
                        Данный вопрос проверяется администратором вручную. Ответ оценивается от 0 до {currentQuestion.points} баллов.
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={userAnswers[currentQuestion.id]?.text_answer || ''}
                      onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Введите развернутый ответ на вопрос..."
                      className="input-field text-sm leading-relaxed resize-y font-normal"
                    />
                  </div>
                )}

                {currentQuestion.question_type === 'text' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Ваш ответ
                    </label>
                    <textarea
                      rows={4}
                      value={userAnswers[currentQuestion.id]?.text_answer || ''}
                      onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Введите точный ответ..."
                      className="input-field text-sm resize-none font-normal"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </button>

                {currentQIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    Далее
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    Завершить тест
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Модальное окно подтверждения отправки */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Завершить тестирование?</h3>
              <p className="text-sm text-slate-300 mb-4">
                Вы ответили на <span className="font-bold text-white">{answeredCount}</span> из{' '}
                <span className="font-bold text-white">{questions.length}</span> вопросов.
              </p>

              {answeredCount < questions.length && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300 text-xs leading-relaxed">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    Осталось неотвеченных вопросов: {questions.length - answeredCount}. За них будет начислено 0 баллов.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="btn-secondary text-sm"
                >
                  Продолжить
                </button>
                <button
                  type="button"
                  onClick={() => submitTest(false)}
                  disabled={submitting}
                  className="btn-primary text-sm min-w-[140px]"
                >
                  {submitting ? 'Отправка...' : 'Подтвердить и сдать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER STAGE 3: Guest Results Display
  // ----------------------------------------------------
  if (stage === 'result') {
    if (loadingResult || !resultData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 text-sm">Обработка и подсчет результатов тестирования...</p>
          </div>
        </div>
      );
    }

    const isNeedsReview = resultData.status === 'needs_review';
    const isPassed = resultData.is_passed && !isNeedsReview;

    return (
      <div className="min-h-screen p-4 sm:p-6 bg-slate-950">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Верхняя панель бренда */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-white">
                AMG
              </div>
              <span className="text-sm font-semibold text-white">Результат тестирования</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Гость: {formData.guest_name}
            </span>
          </div>

          {/* Итоговый баннер */}
          <div
            className={`rounded-2xl p-6 sm:p-8 border ${
              isNeedsReview
                ? 'bg-slate-900 border-amber-500/30'
                : isPassed
                ? 'bg-slate-900 border-emerald-500/30'
                : 'bg-slate-900 border-rose-500/30'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isNeedsReview
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : isPassed
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {isNeedsReview ? (
                  <Clock className="w-7 h-7" />
                ) : isPassed ? (
                  <Award className="w-7 h-7" />
                ) : (
                  <XCircle className="w-7 h-7" />
                )}
              </div>
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isNeedsReview
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                      : isPassed
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}
                >
                  {isNeedsReview
                    ? 'Ожидает проверки администратором'
                    : isPassed
                    ? 'Тест сдан успешно'
                    : 'Тест не сдан'}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white">{resultData.test_title}</h1>
              </div>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              {isNeedsReview
                ? 'Ваши ответы зафиксированы в базе данных AMG. Тест содержит вопросы со свободным ответом, которые будут проверены экзаменатором. Итоговый балл обновится после ручной проверки.'
                : isPassed
                ? 'Поздравляем! Ваш результат удовлетворяет требованиям аттестации AMG.'
                : 'К сожалению, набранного балла недостаточно для преодоления проходного порога.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
              <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
                <div className="text-xs text-slate-400">Баллы</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {resultData.score} / {resultData.max_score}
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
                <div className="text-xs text-slate-400">Процент</div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isNeedsReview
                      ? 'text-amber-400'
                      : isPassed
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {resultData.percentage}%
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
                <div className="text-xs text-slate-400">Время</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5">
                  {formatDuration(resultData.time_spent_seconds)}
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
                <div className="text-xs text-slate-400">Порог сдачи</div>
                <div className="text-lg font-bold text-slate-200 mt-0.5">
                  {resultData.passing_score}%
                </div>
              </div>
            </div>
          </div>

          {/* Список ответов */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white">Разбор ваших ответов</h2>

            {resultData.answers.map((ans, idx) => {
              const isManual = ans.question_type === 'manual_review';
              const isCorrect = ans.is_correct;

              return (
                <div
                  key={ans.question_id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Вопрос {idx + 1} • {getQuestionTypeLabel(ans.question_type)}
                    </span>
                    {isManual && !ans.is_reviewed ? (
                      <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        На проверке (? / {ans.points_max} б.)
                      </span>
                    ) : isCorrect ? (
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        +{ans.points_awarded} из {ans.points_max} б.
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                        0 из {ans.points_max} б.
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-white font-medium">{ans.question_text}</p>

                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-semibold block mb-1">Ваш ответ:</span>
                    <p className="text-slate-200 whitespace-pre-wrap">
                      {ans.user_text_answer ||
                        (ans.user_selected_option_ids?.length
                          ? `Выбран(ы) вариант(ы) №${ans.user_selected_option_ids.join(', ')}`
                          : 'Ответ не был предоставлен')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 text-center">
            <button
              onClick={() => {
                setStage('info');
                setUserAnswers({});
                setResultData(null);
              }}
              className="btn-secondary text-sm"
            >
              Вернуться к началу
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
