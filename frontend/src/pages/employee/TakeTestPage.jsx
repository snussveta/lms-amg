import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileEdit,
  Send,
  ShieldCheck,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const TakeTestPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [startedAt, setStartedAt] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Map of answers: { [question_id]: { selected_option_ids: number[], text_answer: string } }
  const [userAnswers, setUserAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const answersRef = useRef(userAnswers);
  answersRef.current = userAnswers;

  // 1. Fetch attempt data
  useEffect(() => {
    fetchAttempt();
  }, [attemptId]);

  const fetchAttempt = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/attempts/${attemptId}`);
      const data = res.data;
      setTest(data.test);
      setStartedAt(new Date(data.started_at));

      if (data.expires_at) {
        setExpiresAt(new Date(data.expires_at));
      }
    } catch (err) {
      console.error('Ошибка загрузки сессии тестирования:', err);
      if (err.response?.status === 400) {
        navigate(`/test/${attemptId}/result`, { replace: true });
        return;
      }
      setError(getErrorMessage(err, 'Не удалось загрузить сессию тестирования. Вернитесь в каталог.'));
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Answers
  const submitTest = useCallback(async (isAutoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answersRef.current).map(([qId, ans]) => {
        const val = ans.text_answer || ans.answer_text || '';
        return {
          question_id: parseInt(qId, 10),
          selected_option_ids: ans.selected_option_ids || [],
          text_answer: val,
          answer_text: val,
        };
      });

      await api.post(`/attempts/${attemptId}/submit`, {
        answers: formattedAnswers,
      });

      navigate(`/test/${attemptId}/result`, { replace: true });
    } catch (err) {
      console.error('Ошибка отправки ответов:', err);
      alert(getErrorMessage(err, 'Не удалось отправить результаты. Проверьте сеть и повторите попытку.'));
      setSubmitting(false);
    }
  }, [attemptId, navigate, submitting]);

  // 3. Countdown Timer Sync
  useEffect(() => {
    if (!expiresAt) return;

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
  }, [expiresAt, submitTest]);

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

  const isQuestionAnswered = (question) => {
    const ans = userAnswers[question.id];
    if (!ans) return false;
    if (ans.selected_option_ids && ans.selected_option_ids.length > 0) return true;
    if (ans.text_answer && ans.text_answer.trim().length > 0) return true;
    if (ans.answer_text && ans.answer_text.trim().length > 0) return true;
    return false;
  };

  const formatTimer = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice':
        return 'Один правильный ответ';
      case 'multiple_choice':
        return 'Несколько правильных ответов';
      case 'manual_review':
        return 'Развернутый ответ (ручная проверка)';
      case 'text':
        return 'Точный текстовый ввод';
      default:
        return 'Вопрос';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#003B73] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#6C757D] text-sm">Подготовка экзаменационной сессии AMG...</p>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white border border-[#E0E0E0] rounded-2xl text-center shadow-card">
        <AlertCircle className="w-12 h-12 mx-auto text-[#E30613] mb-3" />
        <h3 className="text-lg font-bold text-[#212529] mb-2">Ошибка доступа к тестированию</h3>
        <p className="text-sm text-[#6C757D] mb-6">{error || 'Сессия не найдена.'}</p>
        <button onClick={() => navigate('/tests')} className="btn-primary text-sm">
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const questions = test.questions || [];
  const currentQuestion = questions[currentQIndex];
  const answeredCount = questions.filter(isQuestionAnswered).length;
  const isUrgentTimer = timeLeft !== null && timeLeft <= 120;

  return (
    <div className="min-h-screen pb-20 bg-[#F4F5F7]">
      {/* Липкая верхняя панель с прогрессом и таймером */}
      <header className="sticky top-14 sm:top-16 z-30 w-full bg-white/95 backdrop-blur border-b border-[#E0E0E0] shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Название теста и статус ответа */}
          <div className="flex items-center gap-3 truncate min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#212529] truncate max-w-[200px] sm:max-w-sm">
              {test.title}
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded text-xs font-semibold bg-[#F4F5F7] text-[#495057] border border-[#E0E0E0] shrink-0">
              Отвечено: {answeredCount} из {questions.length}
            </span>
          </div>

          {/* Таймер и кнопка отправки */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs sm:text-sm font-bold border transition-colors ${isUrgentTimer
                  ? 'bg-[#FEF2F2] text-[#E30613] border-[#FBD0D3] animate-pulse'
                  : 'bg-[#F0F5FA] text-[#003B73] border-[#B8D5ED]'
                  }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTimer(timeLeft)}</span>
              </div>
            )}

            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={submitting}
              className="btn-primary py-1.5 px-3 sm:px-4 text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Завершить</span>
            </button>
          </div>
        </div>

        {/* Индикатор прогресса в корпоративном красном акценте */}
        <div className="w-full bg-[#E0E0E0] h-1">
          <div
            className="bg-[#E30613] h-1 transition-all duration-300"
            style={{
              width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
            }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6 space-y-5 sm:space-y-6">
        {/* Информационная строка */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E0E0E0] text-xs text-[#6C757D] shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#003B73]" />
            <span>Сессия тестирования AMG • Ответы фиксируются сервером</span>
          </div>
          <span className="font-mono text-[#6C757D]">Попытка #{attemptId}</span>
        </div>

        {/* Панель номеров вопросов (горизонтальный скролл на мобильных) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {questions.map((q, idx) => {
            const isAnswered = isQuestionAnswered(q);
            const isCurrent = idx === currentQIndex;

            return (
              <button
                key={q.id}
                onClick={() => setCurrentQIndex(idx)}
                className={`flex-shrink-0 w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all select-none relative ${isCurrent
                  ? 'bg-[#003B73] text-white shadow-sm ring-2 ring-[#003B73]/20'
                  : isAnswered
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-[#6C757D] border border-[#E0E0E0] hover:text-[#212529] hover:bg-[#F4F5F7]'
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

        {/* Карточка текущего вопроса */}
        {currentQuestion && (
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 sm:p-8 shadow-card">
            {/* Заголовок вопроса */}
            <div className="flex items-center justify-between gap-2 mb-5 pb-4 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#003B73] text-white">
                  Вопрос {currentQIndex + 1} из {questions.length}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F4F5F7] text-[#495057] border border-[#E0E0E0]">
                  {getQuestionTypeLabel(currentQuestion.question_type || currentQuestion.type)}
                </span>
              </div>
              <span className="text-xs font-bold text-[#003B73] bg-[#F0F5FA] px-2.5 py-1 rounded-md border border-[#B8D5ED]">
                +{currentQuestion.points} {currentQuestion.points === 1 ? 'балл' : 'баллов'}
              </span>
            </div>

            {/* Текст вопроса */}
            <h3 className="text-base sm:text-lg font-bold text-[#212529] leading-relaxed mb-6">
              {currentQuestion.text}
            </h3>

            {/* Варианты ответов / поле ввода */}
            <div className="space-y-3 mb-8">
              {(currentQuestion.question_type === 'single_choice' || currentQuestion.type === 'single_choice') && (
                <div className="space-y-2.5">
                  {currentQuestion.options?.map((option) => {
                    const isSelected =
                      userAnswers[currentQuestion.id]?.selected_option_ids?.includes(option.id) ||
                      false;

                    return (
                      <div
                        key={option.id}
                        onClick={() => handleSingleChoiceSelect(currentQuestion.id, option.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 min-h-[50px] select-none ${isSelected
                          ? 'bg-[#F0F5FA] border-[#003B73] text-[#003B73] font-semibold ring-1 ring-[#003B73]'
                          : 'bg-white border-[#E0E0E0] hover:border-[#CED4DA] hover:bg-[#F8F9FA] text-[#212529]'
                          }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected
                            ? 'border-[#003B73] bg-[#003B73] text-white'
                            : 'border-[#ADB5BD] bg-white'
                            }`}
                        >
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm select-none leading-relaxed">
                          {option.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {(currentQuestion.question_type === 'multiple_choice' || currentQuestion.type === 'multiple_choice') && (
                <div className="space-y-2.5">
                  <p className="text-xs text-[#6C757D] font-medium mb-1">
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
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 min-h-[50px] select-none ${isSelected
                          ? 'bg-[#F0F5FA] border-[#003B73] text-[#003B73] font-semibold ring-1 ring-[#003B73]'
                          : 'bg-white border-[#E0E0E0] hover:border-[#CED4DA] hover:bg-[#F8F9FA] text-[#212529]'
                          }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isSelected
                            ? 'border-[#003B73] bg-[#003B73] text-white'
                            : 'border-[#ADB5BD] bg-white'
                            }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                        <span className="text-sm select-none leading-relaxed">
                          {option.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Развернутый ответ */}
              {(['manual_review', 'open', 'free_text'].includes(currentQuestion.question_type) || ['manual_review', 'open', 'free_text'].includes(currentQuestion.type)) && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                    <FileEdit className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
                    <span>
                      Данный вопрос требует развернутого ответа в свободной форме. После завершения теста ответ будет проверен экзаменатором.
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || ''}
                    onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Введите ваш развернутый ответ на вопрос..."
                    className="input-field text-sm leading-relaxed resize-y font-normal"
                  />
                  <div className="flex items-center justify-between text-xs text-[#6C757D]">
                    <span>Символов: {(userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || '').length}</span>
                    <span>Максимальный балл: {currentQuestion.points}</span>
                  </div>
                </div>
              )}

              {/* Текстовый ввод */}
              {(currentQuestion.question_type === 'text' || currentQuestion.type === 'text') && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#6C757D] uppercase tracking-wider">
                    Ваш ответ
                  </label>
                  <textarea
                    rows={4}
                    value={userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || ''}
                    onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Введите точный ответ..."
                    className="input-field text-sm resize-none font-normal"
                  />
                  <span className="text-xs text-[#6C757D] block">
                    Ответ проверяется автоматически без учета регистра символов.
                  </span>
                </div>
              )}
            </div>

            {/* Кнопки навигации */}
            <div className="flex items-center justify-between pt-4 border-t border-[#E0E0E0] gap-3">
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

      {/* Модальное окно подтверждения отправки ответов */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#003B73]/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E0E0E0] rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl">
            <h3 className="text-xl font-extrabold text-[#212529] mb-2">Завершить тестирование?</h3>
            <p className="text-xs sm:text-sm text-[#6C757D] mb-4">
              Вы ответили на <span className="font-bold text-[#212529]">{answeredCount}</span> из{' '}
              <span className="font-bold text-[#212529]">{questions.length}</span> вопросов.
            </p>

            {answeredCount < questions.length && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 text-xs leading-relaxed">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-700" />
                <span>
                  Осталось неотвеченных вопросов: {questions.length - answeredCount}. За пропущенные вопросы будет начислено 0 баллов.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="btn-secondary text-xs sm:text-sm py-2.5"
              >
                Вернуться к тесту
              </button>
              <button
                type="button"
                onClick={() => submitTest(false)}
                disabled={submitting}
                className="btn-primary text-xs sm:text-sm py-2.5 min-w-[150px]"
              >
                {submitting ? 'Отправка...' : 'Подтвердить и сдать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
