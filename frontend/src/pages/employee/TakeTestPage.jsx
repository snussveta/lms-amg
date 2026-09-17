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

  // Keep a ref to userAnswers for timer auto-submit callback
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
      // If already submitted, redirect to result
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
        // Time is up -> auto submit!
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
        answer_text: text,
      },
    }));
  };

  const isQuestionAnswered = (q) => {
    const ans = userAnswers[q.id];
    if (!ans) return false;
    const qType = q.question_type || q.type;
    if (['text', 'manual_review', 'open', 'free_text'].includes(qType)) {
      const textVal = ans.text_answer || ans.answer_text || '';
      return textVal.trim().length > 0;
    }
    return ans.selected_option_ids && ans.selected_option_ids.length > 0;
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice':
        return 'Один вариант ответа';
      case 'multiple_choice':
        return 'Несколько вариантов ответа';
      case 'manual_review':
        return 'Развернутый ответ (ручная проверка)';
      case 'text':
        return 'Текстовый ответ';
      default:
        return type;
    }
  };

  // Format timer
  const formatTimer = (totalSeconds) => {
    if (totalSeconds === null) return null;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Подготовка сессии тестирования...</p>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Ошибка доступа к тестированию</h3>
        <p className="text-sm text-slate-400 mb-6">{error || 'Сессия не найдена.'}</p>
        <button onClick={() => navigate('/')} className="btn-primary text-sm">
          Вернуться в каталог
        </button>
      </div>
    );
  }

  const questions = test.questions || [];
  const currentQuestion = questions[currentQIndex];
  const answeredCount = questions.filter(isQuestionAnswered).length;
  const isUrgentTimer = timeLeft !== null && timeLeft <= 120; // less than 2 minutes

  return (
    <div className="min-h-screen pb-16 bg-slate-950">
      {/* Липкая верхняя панель с прогрессом и таймером */}
      <header className="sticky top-16 z-30 w-full bg-slate-900/90 backdrop-blur border-b border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Название теста и статус ответа */}
          <div className="flex items-center gap-3 truncate">
            <h2 className="text-sm sm:text-base font-semibold text-white truncate max-w-[240px] sm:max-w-sm">
              {test.title}
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Отвечено: {answeredCount} из {questions.length}
            </span>
          </div>

          {/* Таймер и кнопка отправки */}
          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold border transition-colors ${
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

        {/* Индикатор прогресса */}
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
        {/* Информационная строка */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-300" />
            <span>Сессия тестирования AMG • Ответы фиксируются сервером</span>
          </div>
          <span className="hidden sm:inline font-mono text-slate-500">Попытка #{attemptId}</span>
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
            {/* Заголовок вопроса */}
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

            {/* Текст вопроса */}
            <h3 className="text-lg font-medium text-white leading-relaxed mb-6">
              {currentQuestion.text}
            </h3>

            {/* Варианты ответов / поле ввода */}
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

              {/* Ручной ввод развернутого ответа с проверкой администратором / открытый вопрос */}
              {(['manual_review', 'open', 'free_text'].includes(currentQuestion.question_type) || ['manual_review', 'open', 'free_text'].includes(currentQuestion.type)) && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300/90">
                    <FileEdit className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      Данный вопрос требует развернутого ответа в свободной форме. После завершения теста ответ будет сохранен и передан методисту/экзаменатору на проверку.
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || ''}
                    onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Введите ваш развернутый ответ на вопрос..."
                    className="input-field text-sm leading-relaxed resize-y font-normal"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Символов: {(userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || '').length}</span>
                    <span>Максимальный балл за ответ: {currentQuestion.points}</span>
                  </div>
                </div>
              )}

              {/* Стандартный текстовый ввод */}
              {(currentQuestion.question_type === 'text' || currentQuestion.type === 'text') && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Ваш ответ
                  </label>
                  <textarea
                    rows={4}
                    value={userAnswers[currentQuestion.id]?.text_answer || userAnswers[currentQuestion.id]?.answer_text || ''}
                    onChange={(e) => handleTextAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Введите точный ответ..."
                    className="input-field text-sm resize-none font-normal"
                  />
                  <span className="text-xs text-slate-500 block">
                    Ответ проверяется автоматически без учета регистра символов.
                  </span>
                </div>
              )}
            </div>

            {/* Кнопки навигации */}
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

      {/* Модальное окно подтверждения отправки ответов */}
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
                  Осталось неотвеченных вопросов: {questions.length - answeredCount}. За пропущенные вопросы будет начислено 0 баллов.
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
                Вернуться к тесту
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
};
