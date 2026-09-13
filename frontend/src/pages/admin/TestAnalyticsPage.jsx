import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileQuestion,
  Globe,
  Users,
  XCircle,
} from 'lucide-react';
import api from '../../api/client';
import { ManualReviewModal } from '../../components/admin/ManualReviewModal';

export const TestAnalyticsPage = () => {
  const { testId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingAttemptId, setReviewingAttemptId] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [testId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tests/${testId}/analytics`);
      setData(res.data);
    } catch (err) {
      console.error('Ошибка загрузки аналитики теста:', err);
      setError('Не удалось загрузить аналитические данные по данному тесту.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} мин ${secs} сек`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 glass-panel rounded-xl text-center border border-slate-800">
        <XCircle className="w-10 h-10 mx-auto text-rose-400 mb-2.5" />
        <h3 className="text-base font-bold text-white mb-1">Ошибка аналитики</h3>
        <p className="text-xs text-slate-400 mb-5">{error}</p>
        <Link to="/admin/tests" className="btn-primary text-xs">
          Вернуться к списку тестов
        </Link>
      </div>
    );
  }

  const { summary, attempts } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin/tests"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад к списку тестов
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-slate-300" />
          Аналитика: {data.test_title}
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
          Детальный журнал попыток сотрудников и внешних гостей, сдача и ручная проверка ответов.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="glass-panel rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Всего попыток</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-white">{summary.total_attempts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Зафиксировано</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Успешно сдали</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{summary.passed_attempts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.pass_rate}% от сданных
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Не сдали</span>
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{summary.failed_attempts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ниже порога</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>На проверке</span>
            <FileCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{summary.needs_review_attempts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Ждут оценки админа</div>
        </div>

        <div className="glass-panel rounded-xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Средний балл</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
          </div>
          <div className="text-2xl font-black text-slate-100">{summary.average_score}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">из {summary.max_possible_points} макс. б.</div>
        </div>
      </div>

      {/* Submissions Roster */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800 shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Журнал сдачи теста</h3>
          <span className="text-xs text-slate-500">
            {attempts.length} записей
          </span>
        </div>

        {attempts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            По данному тесту пока нет завершенных или активных попыток.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-5">Участник</th>
                  <th className="py-3 px-5">Тип доступа</th>
                  <th className="py-3 px-5">Статус</th>
                  <th className="py-3 px-5">Баллы</th>
                  <th className="py-3 px-5">Процент</th>
                  <th className="py-3 px-5">Время</th>
                  <th className="py-3 px-5">Дата сдачи</th>
                  <th className="py-3 px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                {attempts.map((att) => {
                  const isPassed = att.is_passed;
                  const isNeedsReview = att.status === 'needs_review';

                  return (
                    <tr key={att.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-semibold text-slate-100">{att.user_name}</div>
                        <div className="text-[11px] text-slate-400">{att.user_email}</div>
                        {att.guest_phone && (
                          <div className="text-[10px] text-slate-500">Тел: {att.guest_phone}</div>
                        )}
                      </td>

                      <td className="py-3 px-5">
                        {att.is_guest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                            <Globe className="w-3 h-3 text-slate-400" />
                            Гость
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                            Сотрудник
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-5">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-900/60 animate-pulse">
                            <Clock className="w-3 h-3" />
                            Требует проверки
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-900/60">
                            <CheckCircle2 className="w-3 h-3" />
                            Сдан
                          </span>
                        ) : att.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950/40 text-blue-300 border border-blue-900/60">
                            <Clock className="w-3 h-3" />
                            В процессе
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-900/60">
                            <XCircle className="w-3 h-3" />
                            Не сдан
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-5 font-mono">
                        <span className="font-bold text-white">{att.score}</span> / {att.max_score}
                      </td>

                      <td className="py-3 px-5">
                        <span
                          className={`font-bold ${
                            isNeedsReview
                              ? 'text-amber-400'
                              : isPassed
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {att.percentage}%
                        </span>
                      </td>

                      <td className="py-3 px-5 text-slate-400 text-[11px]">
                        {formatDuration(att.time_spent_seconds)}
                      </td>

                      <td className="py-3 px-5 text-slate-400 text-[11px]">
                        {formatDate(att.submitted_at || att.started_at)}
                      </td>

                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isNeedsReview && (
                            <button
                              onClick={() => setReviewingAttemptId(att.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 text-xs font-semibold border border-amber-800/80 transition-colors"
                              title="Проверить развернутые ответы"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Проверить</span>
                            </button>
                          )}

                          <Link
                            to={`/test/${att.id}/result`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                          >
                            <span>Детали</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Review Modal */}
      {reviewingAttemptId && (
        <ManualReviewModal
          attemptId={reviewingAttemptId}
          onClose={() => setReviewingAttemptId(null)}
          onReviewed={() => {
            fetchAnalytics();
          }}
        />
      )}
    </div>
  );
};
