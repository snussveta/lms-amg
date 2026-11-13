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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="w-8 h-8 border-3 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-2xl text-center border border-[#EEEEEE] shadow-sm">
        <XCircle className="w-10 h-10 mx-auto text-[#E84C3D] mb-2.5" />
        <h3 className="text-base font-bold text-[#222222] mb-1">Ошибка аналитики</h3>
        <p className="text-xs text-[#777777] mb-5">{error}</p>
        <Link to="/admin/tests" className="btn-primary text-xs inline-flex items-center gap-1.5 px-4 py-2">
          Вернуться к списку тестов
        </Link>
      </div>
    );
  }

  const { summary, attempts } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/admin/tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#777777] hover:text-[#141414] transition-colors mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад к списку тестов</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-black text-[#222222] flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-[#141414] shrink-0" />
          <span>Аналитика: {data.test_title}</span>
        </h1>
        <p className="text-[#777777] text-xs sm:text-sm mt-1">
          Детальный журнал попыток сотрудников и внешних гостей, статистика сдачи и ручная проверка ответов.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-sm hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-between text-[#777777] text-xs mb-1.5">
            <span className="font-semibold">Всего попыток</span>
            <Users className="w-4 h-4 text-[#141414]" />
          </div>
          <div className="text-2xl font-black text-[#222222]">{summary.total_attempts}</div>
          <div className="text-[11px] text-[#777777] mt-0.5">Зафиксировано</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-sm hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-between text-[#777777] text-xs mb-1.5">
            <span className="font-semibold">Успешно сдали</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{summary.passed_attempts}</div>
          <div className="text-[11px] text-[#777777] mt-0.5 font-medium">
            {summary.pass_rate}% от сданных
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-sm hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-between text-[#777777] text-xs mb-1.5">
            <span className="font-semibold">Не сдали</span>
            <XCircle className="w-4 h-4 text-[#E84C3D]" />
          </div>
          <div className="text-2xl font-black text-[#E84C3D]">{summary.failed_attempts}</div>
          <div className="text-[11px] text-[#777777] mt-0.5 font-medium">Ниже порога</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-sm hover:shadow-card-hover transition-all">
          <div className="flex items-center justify-between text-[#777777] text-xs mb-1.5">
            <span className="font-semibold">На проверке</span>
            <FileCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{summary.needs_review_attempts}</div>
          <div className="text-[11px] text-[#777777] mt-0.5 font-medium">Ждут оценки</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-sm hover:shadow-card-hover transition-all col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-[#777777] text-xs mb-1.5">
            <span className="font-semibold">Средний балл</span>
            <CheckCircle2 className="w-4 h-4 text-[#141414]" />
          </div>
          <div className="text-2xl font-black text-[#222222]">{summary.average_score}</div>
          <div className="text-[11px] text-[#777777] mt-0.5 font-medium">из {summary.max_possible_points} макс. б.</div>
        </div>
      </div>

      {/* Submissions Roster */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#EEEEEE] shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[#EEEEEE] flex items-center justify-between bg-white">
          <h3 className="font-bold text-[#222222] text-sm sm:text-base">Журнал сдачи теста</h3>
          <span className="text-xs font-semibold text-[#777777] bg-[#F5F5F7] px-2.5 py-1 rounded-lg border border-[#EEEEEE]">
            {attempts.length} записей
          </span>
        </div>

        {attempts.length === 0 ? (
          <div className="p-12 text-center text-[#777777] text-xs">
            По данному тесту пока нет завершенных или активных попыток.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] bg-[#F5F5F7] text-[11px] font-bold uppercase tracking-wider text-[#777777]">
                  <th className="py-3 px-4 sm:px-5">Участник</th>
                  <th className="py-3 px-4 sm:px-5">Тип</th>
                  <th className="py-3 px-4 sm:px-5">Статус</th>
                  <th className="py-3 px-4 sm:px-5">Баллы</th>
                  <th className="py-3 px-4 sm:px-5">Процент</th>
                  <th className="py-3 px-4 sm:px-5">Время</th>
                  <th className="py-3 px-4 sm:px-5">Дата сдачи</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] text-xs text-[#222222]">
                {attempts.map((att) => {
                  const isPassed = att.is_passed;
                  const isNeedsReview = att.status === 'needs_review';

                  return (
                    <tr key={att.id} className="hover:bg-[#F5F5F7]/70 transition-colors">
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="font-bold text-[#222222]">{att.user_name}</div>
                        <div className="text-[11px] text-[#777777]">{att.user_email}</div>
                        {att.guest_phone && (
                          <div className="text-[10px] text-[#777777]">Тел: {att.guest_phone}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5">
                        {att.is_guest ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F5F7] text-[#141414] border border-[#EEEEEE]">
                            <Globe className="w-3 h-3 text-[#141414]" />
                            Гость
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F5F7] text-[#777777] border border-[#EEEEEE]">
                            Сотрудник
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Требует проверки
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Сдан
                          </span>
                        ) : att.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#141414] border border-blue-200">
                            <Clock className="w-3 h-3 text-[#141414]" />
                            В процессе
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-[#E84C3D] border border-red-200">
                            <XCircle className="w-3 h-3 text-[#E84C3D]" />
                            Не сдан
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 font-mono">
                        <span className="font-bold text-[#222222]">{att.score}</span> / {att.max_score}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5">
                        <span
                          className={`font-black ${
                            isNeedsReview
                              ? 'text-amber-700'
                              : isPassed
                              ? 'text-emerald-600'
                              : 'text-[#E84C3D]'
                          }`}
                        >
                          {att.percentage}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-[#777777] text-[11px]">
                        {formatDuration(att.time_spent_seconds)}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-[#777777] text-[11px]">
                        {formatDate(att.submitted_at || att.started_at)}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isNeedsReview && (
                            <button
                              onClick={() => setReviewingAttemptId(att.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition-all min-h-[36px]"
                              title="Проверить развернутые ответы"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Проверить</span>
                            </button>
                          )}

                          <Link
                            to={`/test/${att.id}/result`}
                            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold min-h-[36px]"
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
