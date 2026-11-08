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

      if (res.data.is_passed && res.data.status !== 'needs_review') {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#003B73', '#E30613', '#10b981'],
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#003B73] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[#6C757D] text-sm">Формирование отчета результатов тестирования AMG...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white border border-[#E0E0E0] rounded-2xl text-center shadow-card">
        <XCircle className="w-12 h-12 mx-auto text-[#E30613] mb-3" />
        <h3 className="text-lg font-bold text-[#212529] mb-2">Ошибка загрузки результатов</h3>
        <p className="text-sm text-[#6C757D] mb-6">{error}</p>
        <Link to="/tests" className="btn-primary text-sm">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const isNeedsReview = result.status === 'needs_review';
  const isPassed = result.is_passed && !isNeedsReview;
  const isFailed = !result.is_passed && !isNeedsReview;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Главный итоговый баннер результатов */}
      <div
        className={`rounded-2xl p-6 sm:p-8 border shadow-card bg-white ${
          isNeedsReview
            ? 'border-amber-200'
            : isPassed
            ? 'border-emerald-200'
            : 'border-[#FBD0D3]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          {/* Иконка статуса */}
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isNeedsReview
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : isPassed
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-[#FEF2F2] text-[#E30613] border border-[#FBD0D3]'
            }`}
          >
            {isNeedsReview ? (
              <Clock className="w-8 h-8" />
            ) : isPassed ? (
              <Award className="w-8 h-8 text-emerald-600" />
            ) : (
              <XCircle className="w-8 h-8 text-[#E30613]" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isNeedsReview
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-[#FEF2F2] text-[#E30613] border border-[#FBD0D3]'
                }`}
              >
                {isNeedsReview
                  ? 'Ожидает проверки экзаменатором'
                  : isPassed
                  ? 'Тест успешно сдан'
                  : 'Тест не сдан'}
              </span>
              <span className="text-xs text-[#6C757D] font-medium">
                Порог сдачи: {result.passing_score}%
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#212529] tracking-tight">
              {result.test_title}
            </h1>
            <p className="text-[#6C757D] text-xs sm:text-sm mt-1.5 leading-relaxed">
              {isNeedsReview
                ? 'В тесте содержатся развернутые вопросы со свободным ответом. Итоговая оценка и статус будут пересчитаны после проверки экзаменатором.'
                : isPassed
                ? 'Поздравляем! Вы успешно преодолели квалификационный порог корпоративного стандарта AMG.'
                : 'К сожалению, набранных баллов недостаточно для преодоления порога сдачи. Ознакомьтесь с разбором ответов ниже.'}
            </p>
          </div>
        </div>

        {/* Метрики */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 sm:mt-8 pt-6 border-t border-[#E0E0E0]">
          <div className="bg-[#F4F5F7] rounded-xl p-3 sm:p-4 text-center border border-[#E0E0E0]">
            <div className="text-xs text-[#6C757D]">Набранный балл</div>
            <div className="text-xl font-bold text-[#212529] mt-0.5">
              {result.score} <span className="text-xs text-[#6C757D] font-normal">/ {result.max_score}</span>
            </div>
          </div>

          <div className="bg-[#F4F5F7] rounded-xl p-3 sm:p-4 text-center border border-[#E0E0E0]">
            <div className="text-xs text-[#6C757D]">Процент сдачи</div>
            <div
              className={`text-xl font-bold mt-0.5 ${
                isNeedsReview
                  ? 'text-amber-700'
                  : isPassed
                  ? 'text-emerald-700'
                  : 'text-[#E30613]'
              }`}
            >
              {result.percentage}%
            </div>
          </div>

          <div className="bg-[#F4F5F7] rounded-xl p-3 sm:p-4 text-center border border-[#E0E0E0]">
            <div className="text-xs text-[#6C757D]">Время теста</div>
            <div className="text-xl font-bold text-[#212529] mt-0.5">
              {formatDuration(result.time_spent_seconds)}
            </div>
          </div>

          <div className="bg-[#F4F5F7] rounded-xl p-3 sm:p-4 text-center border border-[#E0E0E0]">
            <div className="text-xs text-[#6C757D]">Статус попытки</div>
            <div className="text-sm font-bold text-[#212529] mt-1">
              {isNeedsReview ? 'На проверке' : isPassed ? 'Сдано' : 'Не сдано'}
            </div>
          </div>
        </div>
      </div>

      {/* Кнопки перехода */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/tests" className="btn-secondary text-xs sm:text-sm py-2 sm:py-2.5">
            В каталог тестов
          </Link>
          <Link to="/my-attempts" className="btn-secondary text-xs sm:text-sm py-2 sm:py-2.5 flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#003B73]" />
            <span>История моих попыток</span>
          </Link>
        </div>

        <button
          onClick={() => navigate('/tests')}
          className="btn-primary text-xs sm:text-sm py-2 sm:py-2.5 flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Пройти повторно</span>
        </button>
      </div>

      {/* Разбор вопросов */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#212529]">
            Подробный разбор вопросов ({result.answers.length})
          </h2>
        </div>

        {result.answers.map((ans, idx) => {
          const isManual = ans.question_type === 'manual_review';
          const isCorrect = ans.is_correct;

          return (
            <div
              key={ans.question_id}
              className={`bg-white rounded-xl p-5 border shadow-2xs transition-colors ${
                isManual && !ans.is_reviewed
                  ? 'border-amber-200'
                  : isCorrect
                  ? 'border-emerald-200'
                  : 'border-[#FBD0D3]'
              }`}
            >
              {/* Шапка вопроса */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#003B73] text-white">
                    Вопрос {idx + 1}
                  </span>
                  <span className="text-xs text-[#6C757D]">
                    {getQuestionTypeLabel(ans.question_type)}
                  </span>
                </div>

                <div>
                  {isManual && !ans.is_reviewed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Ожидает оценки (? / {ans.points_max} б.)
                    </span>
                  ) : isCorrect ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      +{ans.points_awarded} из {ans.points_max} б.
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FEF2F2] text-[#E30613] border border-[#FBD0D3]">
                      <XCircle className="w-3.5 h-3.5 text-[#E30613]" />
                      {ans.points_awarded} из {ans.points_max} б.
                    </span>
                  )}
                </div>
              </div>

              {/* Текст вопроса */}
              <h4 className="text-sm sm:text-base font-bold text-[#212529] mb-4 leading-relaxed">
                {ans.question_text}
              </h4>

              {/* Детали ответа */}
              <div className="space-y-3 bg-[#F4F5F7] rounded-xl p-4 border border-[#E0E0E0] text-xs">
                {/* Ответ пользователя */}
                <div>
                  <span className="font-bold text-[#6C757D] block mb-1">
                    Ваш ответ:
                  </span>
                  {ans.question_type === 'text' || isManual ? (
                    <div className="p-3 rounded-lg bg-white border border-[#E0E0E0] font-sans text-[#212529] whitespace-pre-wrap leading-relaxed">
                      {ans.user_text_answer || <span className="italic text-[#6C757D]">Ответ не был введен</span>}
                    </div>
                  ) : (
                    <div className="text-[#212529]">
                      {ans.user_selected_option_ids && ans.user_selected_option_ids.length > 0 ? (
                        <span className="font-semibold text-[#212529]">
                          Выбрано вариантов: {ans.user_selected_option_ids.length}
                        </span>
                      ) : (
                        <span className="italic text-[#6C757D]">Ни один вариант не выбран</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Рецензия и комментарий проверяющего */}
                {(isManual || ans.question_type === 'text' || ans.reviewer_comment || !ans.is_reviewed) && (
                  <div className="pt-3 border-t border-[#E0E0E0]">
                    <span className="font-bold text-[#212529] flex items-center gap-1.5 mb-2 text-xs">
                      <MessageSquare className="w-4 h-4 text-[#003B73]" />
                      Оценка экзаменатора AMG:
                    </span>
                    <div className="p-3 rounded-lg bg-white border border-[#E0E0E0] text-[#212529]">
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                        <span className="font-bold text-[#212529]">
                          Выставлено баллов: <span className="text-emerald-700">{ans.points_awarded}</span> из {ans.points_max}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                          ans.is_reviewed
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {ans.is_reviewed ? 'Проверено' : 'Ожидает проверки'}
                        </span>
                      </div>
                      {ans.reviewer_comment ? (
                        <div className="mt-2 text-[#212529] bg-[#F4F5F7] p-2.5 rounded border border-[#E0E0E0]">
                          <div className="text-[11px] text-[#6C757D] mb-1 font-semibold">Комментарий проверяющего:</div>
                          <p className="italic text-[#212529]">{ans.reviewer_comment}</p>
                        </div>
                      ) : ans.is_reviewed ? (
                        <p className="text-[#6C757D] italic text-xs mt-1">Оценка выставлена без текстового комментария.</p>
                      ) : (
                        <p className="text-amber-800 italic text-xs mt-1">Ответ передан на проверку экзаменатору.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Эталонный правильный ответ */}
                {!isManual && (
                  <div className="pt-2 border-t border-[#E0E0E0]">
                    <span className="font-bold text-[#6C757D] block mb-1">
                      Правильный ответ:
                    </span>
                    {ans.correct_option_texts && ans.correct_option_texts.length > 0 ? (
                      <ul className="list-disc list-inside space-y-1 text-emerald-800 font-semibold">
                        {ans.correct_option_texts.map((t, optIdx) => (
                          <li key={optIdx}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[#6C757D]">—</span>
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
