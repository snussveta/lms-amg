import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  RotateCcw,
  AlertCircle,
  XCircle,
  FileEdit,
  MessageSquare,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api, { getErrorMessage } from '../../api/client';

export const TestResultPage = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResult();
  }, [attemptId]);

  const fetchResult = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/attempts/${attemptId}/result`);
      setResult(res.data);

      // Запуск конфетти только если тест успешно сдан и не ожидает проверки
      if (res.data.is_passed && res.data.status !== 'needs_review') {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#475569', '#10b981', '#38bdf8'],
        });
      }
    } catch (err) {
      console.error('Не удалось загрузить результат:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить результаты тестирования.'));
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} сек`;
    return `${mins} мин ${secs} сек`;
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm">Формирование отчета результатов тестирования...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
        <XCircle className="w-12 h-12 mx-auto text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-white mb-2">Ошибка загрузки результатов</h3>
        <p className="text-sm text-slate-400 mb-6">{error}</p>
        <Link to="/" className="btn-primary text-sm">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const isNeedsReview = result.status === 'needs_review';
  const isPassed = result.is_passed && !isNeedsReview;
  const isFailed = !result.is_passed && !isNeedsReview;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Главный итоговый баннер результатов */}
      <div
        className={`rounded-2xl p-6 sm:p-8 border shadow-sm ${
          isNeedsReview
            ? 'bg-slate-900 border-amber-500/30'
            : isPassed
            ? 'bg-slate-900 border-emerald-500/30'
            : 'bg-slate-900 border-rose-500/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {/* Иконка статуса */}
          <div
            className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isNeedsReview
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : isPassed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {isNeedsReview ? (
              <Clock className="w-8 h-8" />
            ) : isPassed ? (
              <Award className="w-8 h-8" />
            ) : (
              <XCircle className="w-8 h-8" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
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
                  ? 'Тест успешно сдан'
                  : 'Тест не сдан'}
              </span>
              <span className="text-xs text-slate-400">
                Порог сдачи: {result.passing_score}%
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {result.test_title}
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
              {isNeedsReview
                ? 'В тесте содержатся развернутые вопросы со свободным ответом. Итоговая оценка и статус будут пересчитаны после проверки администратором.'
                : isPassed
                ? 'Поздравляем! Вы успешно преодолели квалификационный порог корпоративного стандарта AMG.'
                : 'К сожалению, набранных баллов недостаточно для преодоления порога сдачи. Ознакомьтесь с разбором ответов ниже.'}
            </p>
          </div>
        </div>

        {/* Метрики */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
            <div className="text-xs text-slate-400">Набранный балл</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {result.score} <span className="text-xs text-slate-500 font-normal">/ {result.max_score}</span>
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
            <div className="text-xs text-slate-400">Процент выполнения</div>
            <div
              className={`text-xl font-bold mt-0.5 ${
                isNeedsReview
                  ? 'text-amber-400'
                  : isPassed
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {result.percentage}%
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
            <div className="text-xs text-slate-400">Затрачено времени</div>
            <div className="text-xl font-bold text-slate-200 mt-0.5">
              {formatDuration(result.time_spent_seconds)}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 text-center border border-slate-800">
            <div className="text-xs text-slate-400">Статус попытки</div>
            <div className="text-sm font-bold text-slate-200 mt-1">
              {isNeedsReview ? 'На проверке администратором' : isPassed ? 'Сдано' : 'Не сдано'}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки перехода */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="btn-secondary text-sm flex items-center gap-2">
            В каталог тестов
          </Link>
          <Link to="/my-attempts" className="btn-secondary text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            История моих попыток
          </Link>
        </div>

        <button
          onClick={() => navigate('/')}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Пройти повторно
        </button>
      </div>

      {/* Разбор вопросов */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            Подробный разбор вопросов ({result.answers.length})
          </h2>
        </div>

        {result.answers.map((ans, idx) => {
          const isManual = ans.question_type === 'manual_review';
          const isCorrect = ans.is_correct;

          return (
            <div
              key={ans.question_id}
              className={`bg-slate-900 rounded-xl p-5 border transition-colors ${
                isManual && !ans.is_reviewed
                  ? 'border-amber-500/30'
                  : isCorrect
                  ? 'border-slate-800'
                  : 'border-rose-500/20'
              }`}
            >
              {/* Шапка вопроса */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                    Вопрос {idx + 1}
                  </span>
                  <span className="text-xs text-slate-400">
                    {getQuestionTypeLabel(ans.question_type)}
                  </span>
                </div>

                <div>
                  {isManual && !ans.is_reviewed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5" />
                      Ожидает оценки (? / {ans.points_max} б.)
                    </span>
                  ) : isCorrect ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      +{ans.points_awarded} из {ans.points_max} б.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5" />
                      {ans.points_awarded} из {ans.points_max} б.
                    </span>
                  )}
                </div>
              </div>

              {/* Текст вопроса */}
              <h4 className="text-sm font-medium text-white mb-4 leading-relaxed">
                {ans.question_text}
              </h4>

              {/* Детали ответа */}
              <div className="space-y-3 bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-xs">
                {/* Ответ пользователя */}
                <div>
                  <span className="font-semibold text-slate-400 block mb-1">
                    Ваш ответ:
                  </span>
                  {ans.question_type === 'text' || isManual ? (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-sans text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {ans.user_text_answer || <span className="italic text-slate-500">Ответ не был введен</span>}
                    </div>
                  ) : (
                    <div className="text-slate-300">
                      {ans.user_selected_option_ids && ans.user_selected_option_ids.length > 0 ? (
                        <span className="font-medium text-slate-200">
                          Выбрано вариантов: {ans.user_selected_option_ids.length}
                        </span>
                      ) : (
                        <span className="italic text-slate-500">Ни один вариант не выбран</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Рецензия и комментарий проверяющего для открытых или проверенных вопросов */}
                {(isManual || ans.question_type === 'text' || ans.reviewer_comment || !ans.is_reviewed) && (
                  <div className="pt-3 border-t border-slate-800">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5 mb-2 text-xs">
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      Проверка и оценка администратора AMG:
                    </span>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-white">
                          Выставлено баллов: <span className="text-emerald-400 font-bold">{ans.points_awarded}</span> из {ans.points_max}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                          ans.is_reviewed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {ans.is_reviewed ? 'Проверено' : 'Ожидает проверки администратором'}
                        </span>
                      </div>
                      {ans.reviewer_comment ? (
                        <div className="mt-2 text-slate-300 bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
                          <div className="text-[11px] text-slate-400 mb-1 font-medium">Комментарий экзаменатора:</div>
                          <p className="italic text-slate-100">{ans.reviewer_comment}</p>
                        </div>
                      ) : ans.is_reviewed ? (
                        <p className="text-slate-500 italic text-xs mt-1">Баллы выставлены без текстового комментария.</p>
                      ) : (
                        <p className="text-amber-400/80 italic text-xs mt-1">Ответ отправлен на проверку. Администратор оценит его в ближайшее время.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Эталонный правильный ответ (только для тестовых вопросов) */}
                {!isManual && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="font-semibold text-slate-400 block mb-1">
                      Правильный ответ:
                    </span>
                    {ans.correct_option_texts && ans.correct_option_texts.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-slate-300 font-medium">
                        {ans.correct_option_texts.map((t, optIdx) => (
                          <li key={optIdx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
