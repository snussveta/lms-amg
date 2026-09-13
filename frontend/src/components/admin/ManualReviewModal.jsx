import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  FileText,
  HelpCircle,
  MessageSquare,
  Save,
  X,
  XCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const ManualReviewModal = ({ attemptId, onClose, onReviewed }) => {
  const [attempt, setAttempt] = useState(null);
  const [reviews, setReviews] = useState({}); // { [qId]: { points_awarded: number, reviewer_comment: string } }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchAttemptDetails();
  }, [attemptId]);

  const fetchAttemptDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/attempts/${attemptId}/result`);
      const data = res.data;
      setAttempt(data);

      // Инициализируем баллы для вопросов на проверке
      const initialReviews = {};
      data.answers.forEach((ans) => {
        if (ans.question_type === 'manual_review' || !ans.is_reviewed) {
          initialReviews[ans.question_id] = {
            points_awarded: ans.points_awarded || 0,
            reviewer_comment: ans.reviewer_comment || '',
          };
        }
      });
      setReviews(initialReviews);
    } catch (err) {
      console.error('Ошибка загрузки данных попытки для проверки:', err);
      setError('Не удалось загрузить ответы попытки.');
    } finally {
      setLoading(false);
    }
  };

  const updateReview = (questionId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  };

  const handleSaveReview = async () => {
    // Валидация баллов
    for (const [qId, rev] of Object.entries(reviews)) {
      const ans = attempt.answers.find((a) => a.question_id === parseInt(qId, 10));
      if (!ans) continue;
      const pts = parseInt(rev.points_awarded, 10);
      if (isNaN(pts) || pts < 0 || pts > ans.points_max) {
        setError(`Балл за вопрос должен быть числом от 0 до ${ans.points_max}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setError('');

      const formattedReviews = Object.entries(reviews).map(([qId, rev]) => ({
        question_id: parseInt(qId, 10),
        points_awarded: parseInt(rev.points_awarded, 10) || 0,
        reviewer_comment: rev.reviewer_comment?.trim() || null,
      }));

      await api.post(`/attempts/${attemptId}/review`, {
        reviews: formattedReviews,
      });

      setSuccessMsg('Баллы и комментарии успешно сохранены. Итоговый результат пересчитан.');
      setTimeout(() => {
        if (onReviewed) onReviewed();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Ошибка сохранения проверки:', err);
      setError(getErrorMessage(err, 'Не удалось сохранить оценку.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-3xl w-full border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <span>Проверка развернутых ответов</span>
            </h2>
            {attempt && (
              <p className="text-xs text-slate-400 mt-0.5">
                {attempt.is_guest
                  ? `Гость: ${attempt.guest_name}`
                  : `Попытка #${attempt.id}`} • {attempt.test_title}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 flex items-start gap-2.5 text-emerald-300 text-xs">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-7 h-7 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !attempt ? (
            <div className="text-center py-8 text-xs text-slate-400">Данные попытки недоступны.</div>
          ) : (
            <>
              {/* Questions review roster */}
              <div className="space-y-4">
                {attempt.answers.map((ans, idx) => {
                  const isManual = ans.question_type === 'manual_review' || !ans.is_reviewed;
                  const currentRev = reviews[ans.question_id] || {
                    points_awarded: ans.points_awarded || 0,
                    reviewer_comment: ans.reviewer_comment || '',
                  };

                  return (
                    <div
                      key={ans.question_id}
                      className={`p-4 rounded-xl border transition-colors ${
                        isManual
                          ? 'bg-slate-900/90 border-slate-700/80'
                          : 'bg-slate-900/40 border-slate-800/80 opacity-75'
                      }`}
                    >
                      {/* Question title & points badge */}
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300">
                            Вопрос {idx + 1}
                          </span>
                          <span className="text-xs text-slate-400 capitalize">
                            {ans.question_type === 'manual_review'
                              ? 'Развернутый ответ (ручная проверка)'
                              : ans.question_type === 'single_choice'
                              ? 'Один вариант'
                              : ans.question_type === 'multiple_choice'
                              ? 'Несколько вариантов'
                              : 'Текстовый ответ'}
                          </span>
                        </div>

                        <span className="text-xs font-bold text-slate-300">
                          Макс. балл: {ans.points_max}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-semibold text-white mb-3">
                        {ans.question_text}
                      </h4>

                      {/* Employee submitted text */}
                      <div className="mb-3">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Ответ сотрудника:
                        </span>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono whitespace-pre-wrap">
                          {ans.user_text_answer || (
                            <span className="italic text-slate-500">Ответ не предоставлен</span>
                          )}
                        </div>
                      </div>

                      {/* Admin grading controls for manual questions */}
                      {isManual ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                              Выставить балл (0 - {ans.points_max})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={ans.points_max}
                              value={currentRev.points_awarded}
                              onChange={(e) =>
                                updateReview(ans.question_id, 'points_awarded', e.target.value)
                              }
                              className="input-field text-xs font-bold py-1.5"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                              Комментарий / Заметка проверяющего
                            </label>
                            <input
                              type="text"
                              value={currentRev.reviewer_comment}
                              onChange={(e) =>
                                updateReview(ans.question_id, 'reviewer_comment', e.target.value)
                              }
                              placeholder="Например: 'Тема раскрыта полностью, отличный аргумент'"
                              className="input-field text-xs py-1.5"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
                          <span>Автоматически проверено системой</span>
                          <span className="font-semibold text-slate-200">
                            Начислено: {ans.points_awarded} / {ans.points_max} б.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSaveReview}
            disabled={submitting || loading}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{submitting ? 'Сохранение...' : 'Подтвердить оценку'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
