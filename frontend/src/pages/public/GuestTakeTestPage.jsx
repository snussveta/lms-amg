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

  const [stage, setStage] = useState('info');

  const [testInfo, setTestInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState('');

  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
  });
  const [formError, setFormError] = useState('');
  const [starting, setStarting] = useState(false);

  const [attemptId, setAttemptId] = useState(null);
  const [guestToken, setGuestToken] = useState(null);
  const [testData, setTestData] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const answersRef = useRef(userAnswers);
  answersRef.current = userAnswers;
  const guestTokenRef = useRef(guestToken);
  guestTokenRef.current = guestToken;
  const attemptIdRef = useRef(attemptId);
  attemptIdRef.current = attemptId;

  const [resultData, setResultData] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

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
          colors: ['#141414', '#E84C3D', '#10b981'],
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

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#777777] text-sm">Загрузка параметров тестирования AMG...</p>
        </div>
      </div>
    );
  }

  if (infoError || !testInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#F5F5F7]">
        <div className="max-w-md w-full p-8 bg-white border border-[#EEEEEE] rounded-2xl text-center shadow-card">
          <AlertCircle className="w-12 h-12 mx-auto text-[#E84C3D] mb-3" />
          <h3 className="text-lg font-bold text-[#222222] mb-2">Тестирование недоступно</h3>
          <p className="text-sm text-[#777777] mb-6">{infoError}</p>
          <Link to="/login" className="btn-secondary text-sm">
            Войти в личный кабинет
          </Link>
        </div>
      </div>
    );
  }

  // STAGE 1: Guest Info Form
  if (stage === 'info') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F5F5F7]">
        <div className="max-w-lg w-full bg-white border border-[#EEEEEE] rounded-2xl p-6 sm:p-8 shadow-card">
          {/* Header */}
          <div className="flex items-center justify-between pb-5 mb-5 border-b border-[#EEEEEE]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#141414] flex items-center justify-center text-xs font-black text-white tracking-wider">
                AMG
              </div>
              <span className="text-xs font-bold text-[#777777] uppercase tracking-wider">
                Гостевой доступ
              </span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-semibold">
              Открытый тест
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-[#222222] mb-2">{testInfo.title}</h1>
          <p className="text-xs sm:text-sm text-[#777777] mb-6 leading-relaxed">
            {testInfo.description || 'Пройдите онлайн-тестирование для подтверждения квалификации.'}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-6 bg-[#F5F5F7] p-3 rounded-xl border border-[#EEEEEE]">
            <div>
              <div className="text-[#777777] text-[11px]">Вопросов</div>
              <div className="font-bold text-[#222222] mt-0.5">{testInfo.question_count}</div>
            </div>
            <div>
              <div className="text-[#777777] text-[11px]">Лимит</div>
              <div className="font-bold text-[#222222] mt-0.5">
                {testInfo.time_limit_minutes ? `${testInfo.time_limit_minutes} мин` : 'Нет'}
              </div>
            </div>
            <div>
              <div className="text-[#777777] text-[11px]">Порог</div>
              <div className="font-bold text-[#141414] mt-0.5">{testInfo.passing_score}%</div>
            </div>
          </div>

          <form onSubmit={handleStartGuestAttempt} className="space-y-4">
            {formError && (
              <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                Ваше ФИО <span className="text-[#E84C3D]">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  required
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  className="input-field pl-9 text-sm"
                />
              </div>
              <span className="text-[11px] text-[#777777] mt-1 block">
                ФИО будет зафиксировано в протоколе аттестации AMG.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                  Email (опционально)
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
                <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
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
                className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                {starting ? 'Инициализация...' : 'Начать тестирование'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // STAGE 2: Guest In-Progress Testing
  if (stage === 'testing') {
    const questions = testData?.questions || [];
    const currentQuestion = questions[currentQIndex];
    const answeredCount = questions.filter(isQuestionAnswered).length;
    const isUrgentTimer = timeLeft !== null && timeLeft <= 120;

    return (
      <div className="min-h-screen pb-16 bg-[#F5F5F7]">
        <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur border-b border-[#EEEEEE] shadow-xs">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 truncate">
              <div className="w-7 h-7 rounded bg-[#141414] flex items-center justify-center text-[10px] font-black text-white shrink-0">
                AMG
              </div>
              <h2 className="text-sm font-bold text-[#222222] truncate max-w-[200px] sm:max-w-sm">
                {testData.title}
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#F5F5F7] text-[#777777] border border-[#EEEEEE] shrink-0">
                {formData.guest_name}
              </span>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {timeLeft !== null && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs sm:text-sm font-bold border ${
                    isUrgentTimer
                      ? 'bg-[#FCECEB] text-[#E84C3D] border-[#F8D3D0] animate-pulse'
                      : 'bg-[#F0F5FA] text-[#141414] border-[#B8D5ED]'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{formatTimer(timeLeft)}</span>
                </div>
              )}

              <button
                onClick={() => setShowConfirmModal(true)}
                disabled={submitting}
                className="btn-primary py-1.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Завершить</span>
              </button>
            </div>
          </div>

          <div className="w-full bg-[#EEEEEE] h-1">
            <div
              className="bg-[#E84C3D] h-1 transition-all duration-300"
              style={{
                width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
              }}
            />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#EEEEEE] text-xs text-[#777777] shadow-2xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#141414]" />
              <span>
                Гость: <strong className="text-[#222222]">{formData.guest_name}</strong>
              </span>
            </div>
            <span>Отвечено: {answeredCount} из {questions.length}</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {questions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q);
              const isCurrent = idx === currentQIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQIndex(idx)}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all relative ${
                    isCurrent
                      ? 'bg-[#141414] text-white shadow-sm ring-2 ring-[#141414]/20'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-white text-[#777777] border border-[#EEEEEE] hover:bg-[#F5F5F7]'
                  }`}
                >
                  {idx + 1}
                  {isAnswered && !isCurrent && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </button>
              );
            })}
          </div>

          {currentQuestion && (
            <div className="bg-white border border-[#EEEEEE] rounded-2xl p-5 sm:p-8 shadow-card">
              <div className="flex items-center justify-between gap-2 mb-5 pb-4 border-b border-[#EEEEEE]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#141414] text-white">
                    Вопрос {currentQIndex + 1} из {questions.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F5F5F7] text-[#495057] border border-[#EEEEEE]">
                    {getQuestionTypeLabel(currentQuestion.question_type)}
                  </span>
                </div>
                <span className="text-xs font-bold text-[#141414] bg-[#F0F5FA] px-2.5 py-1 rounded-md border border-[#B8D5ED]">
                  +{currentQuestion.points} {currentQuestion.points === 1 ? 'балл' : 'баллов'}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[#222222] leading-relaxed mb-6">
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
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 min-h-[50px] select-none ${
                            isSelected
                              ? 'bg-[#F0F5FA] border-[#141414] text-[#141414] font-bold ring-1 ring-[#141414]'
                              : 'bg-white border-[#EEEEEE] hover:bg-[#F8F9FA] text-[#222222]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected ? 'border-[#141414] bg-[#141414]' : 'border-[#CED4DA] bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm leading-relaxed">{option.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.question_type === 'multiple_choice' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-[#777777] font-medium mb-1">
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
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 min-h-[50px] select-none ${
                            isSelected
                              ? 'bg-[#F0F5FA] border-[#141414] text-[#141414] font-bold ring-1 ring-[#141414]'
                              : 'bg-white border-[#EEEEEE] hover:bg-[#F8F9FA] text-[#222222]'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected ? 'border-[#141414] bg-[#141414]' : 'border-[#CED4DA] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                          <span className="text-sm leading-relaxed">{option.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.question_type === 'manual_review' && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                      <FileEdit className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
                      <span>
                        Данный вопрос проверяется экзаменатором AMG вручную.
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
                    <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider">
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

              <div className="flex items-center justify-between pt-4 border-t border-[#EEEEEE] gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                  className="btn-secondary text-xs sm:text-sm flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Назад</span>
                </button>

                {currentQIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="btn-accent text-xs sm:text-sm flex items-center gap-2"
                  >
                    <span>Далее</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="btn-primary text-xs sm:text-sm flex items-center gap-2"
                  >
                    <span>Завершить тест</span>
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-[#EEEEEE] rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
              <h3 className="text-xl font-extrabold text-[#222222] mb-2">Завершить тестирование?</h3>
              <p className="text-xs sm:text-sm text-[#777777] mb-4">
                Вы ответили на <span className="font-bold text-[#222222]">{answeredCount}</span> из{' '}
                <span className="font-bold text-[#222222]">{questions.length}</span> вопросов.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="btn-secondary text-xs sm:text-sm py-2.5"
                >
                  Продолжить
                </button>
                <button
                  type="button"
                  onClick={() => submitTest(false)}
                  disabled={submitting}
                  className="btn-primary text-xs sm:text-sm py-2.5 min-w-[140px]"
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

  // STAGE 3: Guest Results Display
  if (stage === 'result') {
    if (loadingResult || !resultData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[#777777] text-sm">Подсчет результатов тестирования AMG...</p>
          </div>
        </div>
      );
    }

    const isNeedsReview = resultData.status === 'needs_review';
    const isPassed = resultData.is_passed && !isNeedsReview;

    return (
      <div className="min-h-screen p-4 sm:p-6 bg-[#F5F5F7]">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between bg-white border border-[#EEEEEE] rounded-xl px-4 py-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-[#141414] flex items-center justify-center text-xs font-black text-white">
                AMG
              </div>
              <span className="text-sm font-bold text-[#222222]">Результат тестирования</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F5F5F7] text-[#495057] border border-[#EEEEEE] font-medium">
              Гость: {formData.guest_name}
            </span>
          </div>

          <div
            className={`rounded-2xl p-6 sm:p-8 border shadow-card bg-white ${
              isNeedsReview
                ? 'border-amber-200'
                : isPassed
                ? 'border-emerald-200'
                : 'border-[#F8D3D0]'
            }`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  isNeedsReview
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0]'
                }`}
              >
                {isNeedsReview ? (
                  <Clock className="w-7 h-7 text-amber-600" />
                ) : isPassed ? (
                  <Award className="w-7 h-7 text-emerald-600" />
                ) : (
                  <XCircle className="w-7 h-7 text-[#E84C3D]" />
                )}
              </div>
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider mb-1 ${
                    isNeedsReview
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0]'
                  }`}
                >
                  {isNeedsReview
                    ? 'Ожидает проверки экзаменатором'
                    : isPassed
                    ? 'Тест сдан успешно'
                    : 'Тест не сдан'}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-[#222222]">{resultData.test_title}</h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#777777] leading-relaxed mb-6">
              {isNeedsReview
                ? 'Ваши ответы зафиксированы в базе данных AMG. Тест содержит вопросы со свободным ответом, которые будут проверены экзаменатором. Итоговый балл обновится после ручной проверки.'
                : isPassed
                ? 'Поздравляем! Ваш результат удовлетворяет требованиям корпоративного стандарта AMG.'
                : 'К сожалению, набранного балла недостаточно для преодоления проходного порога.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#EEEEEE]">
              <div className="bg-[#F5F5F7] rounded-xl p-3 text-center border border-[#EEEEEE]">
                <div className="text-xs text-[#777777]">Баллы</div>
                <div className="text-lg font-bold text-[#222222] mt-0.5">
                  {resultData.score} / {resultData.max_score}
                </div>
              </div>
              <div className="bg-[#F5F5F7] rounded-xl p-3 text-center border border-[#EEEEEE]">
                <div className="text-xs text-[#777777]">Процент</div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    isNeedsReview
                      ? 'text-amber-700'
                      : isPassed
                      ? 'text-emerald-700'
                      : 'text-[#E84C3D]'
                  }`}
                >
                  {resultData.percentage}%
                </div>
              </div>
              <div className="bg-[#F5F5F7] rounded-xl p-3 text-center border border-[#EEEEEE]">
                <div className="text-xs text-[#777777]">Время</div>
                <div className="text-lg font-bold text-[#222222] mt-0.5">
                  {formatDuration(resultData.time_spent_seconds)}
                </div>
              </div>
              <div className="bg-[#F5F5F7] rounded-xl p-3 text-center border border-[#EEEEEE]">
                <div className="text-xs text-[#777777]">Порог сдачи</div>
                <div className="text-lg font-bold text-[#141414] mt-0.5">
                  {resultData.passing_score}%
                </div>
              </div>
            </div>
          </div>

          {/* Список ответов */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-[#222222]">Разбор ваших ответов</h2>

            {resultData.answers.map((ans, idx) => {
              const isManual = ans.question_type === 'manual_review';
              const isCorrect = ans.is_correct;

              return (
                <div
                  key={ans.question_id}
                  className="bg-white border border-[#EEEEEE] rounded-xl p-4 sm:p-5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#777777]">
                      Вопрос {idx + 1} • {getQuestionTypeLabel(ans.question_type)}
                    </span>
                    {isManual && !ans.is_reviewed ? (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        На проверке (? / {ans.points_max} б.)
                      </span>
                    ) : isCorrect ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        +{ans.points_awarded} из {ans.points_max} б.
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-[#E84C3D] bg-[#FCECEB] border border-[#F8D3D0] px-2 py-0.5 rounded-full">
                        0 из {ans.points_max} б.
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-[#222222] font-bold">{ans.question_text}</p>

                  <div className="bg-[#F5F5F7] p-3 rounded-lg border border-[#EEEEEE] text-xs">
                    <span className="text-[#777777] font-bold block mb-1">Ваш ответ:</span>
                    <p className="text-[#222222] whitespace-pre-wrap">
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
