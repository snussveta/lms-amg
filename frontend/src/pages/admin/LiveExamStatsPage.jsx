import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  FileQuestion,
  Filter,
  Lock,
  MousePointer,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ManualReviewModal } from '../../components/admin/ManualReviewModal';

export const LiveExamStatsPage = () => {
  const { user } = useAuth();
  const isHead = user?.role === 'department_head';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statsData, setStatsData] = useState({
    summary: {
      total_participants: 0,
      submitted_count: 0,
      passed_count: 0,
      failed_count: 0,
      needs_review_count: 0,
      disqualified_count: 0,
      total_violations: 0,
      average_score: 0.0,
      user_role: user?.role,
      managed_department: user?.department || null,
    },
    sessions: [],
    departments: [],
    items: [],
  });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSessionId, setSelectedSessionId] = useState('all');

  // Review modal
  const [reviewingAttemptId, setReviewingAttemptId] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [selectedDept, selectedStatus, selectedSessionId]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (selectedSessionId && selectedSessionId !== 'all') {
        params.session_id = parseInt(selectedSessionId, 10);
      }
      if (!isHead && selectedDept && selectedDept !== 'all') {
        params.department = selectedDept;
      }
      if (selectedStatus && selectedStatus !== 'all') {
        params.status_filter = selectedStatus;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const res = await api.get('/exam/stats', { params });
      setStatsData(res.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики экзаменов:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить журнал очных экзаменов.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStats();
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const summary = statsData.summary || {};
  const items = statsData.items || [];
  const sessions = statsData.sessions || [];
  const departments = statsData.departments || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEEEEE] pb-3">
        <Link
          to="/admin/tests"
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#777777] hover:text-[#141414] hover:bg-white transition-all flex items-center gap-2 border border-transparent"
        >
          <FileQuestion className="w-4 h-4 text-[#777777]" />
          <span>Управление тестами</span>
        </Link>
        <Link
          to="/admin/exam-stats"
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#141414] shadow-xs border border-[#E5E5E5] flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4 text-[#E84C3D]" />
          <span>Статистика очных экзаменов</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#141414] text-white flex items-center justify-center shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                  Статистика очных экзаменов
                </h1>
                {isHead ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Lock className="w-3 h-3" />
                    Отдел: {user?.department || 'Мой отдел'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Shield className="w-3 h-3" />
                    Все подразделения
                  </span>
                )}
              </div>
              <p className="text-xs text-[#777777] mt-0.5">
                {isHead
                  ? `Журнал результатов и проверка работ сотрудников отдела «${user?.department || 'Ваш отдел'}»`
                  : 'Сводные данные, аудит честности сдачи (античит) и проверка развернутых ответов сотрудников'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5 self-start sm:self-auto min-h-[40px] shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E84C3D]' : ''}`} />
          <span>Обновить данные</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Participants */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-1">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Участников</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-[#222222]">
            {summary.total_participants ?? 0}
          </div>
          <div className="text-[11px] text-[#777777]">
            Сдали: <span className="font-bold text-[#222222]">{summary.submitted_count ?? 0}</span>
          </div>
        </div>

        {/* Passed */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-1">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Сдали успешно</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {summary.passed_count ?? 0}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {summary.submitted_count > 0
              ? `${Math.round((summary.passed_count / summary.submitted_count) * 100)}% от сдавших`
              : '0%'}
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-1">
          <div className="flex items-center justify-between text-[#E84C3D]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Не сдали</span>
            <XCircle className="w-4 h-4 text-[#E84C3D]" />
          </div>
          <div className="text-2xl font-black text-[#E84C3D]">
            {summary.failed_count ?? 0}
          </div>
          <div className="text-[11px] text-[#777777]">
            Ниже порога
          </div>
        </div>

        {/* Needs Review */}
        <div
          className={`rounded-2xl p-4 border shadow-card space-y-1 ${
            summary.needs_review_count > 0
              ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300'
              : 'bg-white border-[#EEEEEE]'
          }`}
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">На проверке</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {summary.needs_review_count ?? 0}
          </div>
          <div className="text-[11px] text-amber-800 font-medium">
            {summary.needs_review_count > 0 ? 'Требуют оценки' : 'Все проверено'}
          </div>
        </div>

        {/* Anti-cheat Violations */}
        <div
          className={`rounded-2xl p-4 border shadow-card space-y-1 ${
            summary.total_violations > 0
              ? 'bg-red-50/50 border-red-200'
              : 'bg-white border-[#EEEEEE]'
          }`}
        >
          <div className="flex items-center justify-between text-[#E84C3D]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Нарушений</span>
            <ShieldAlert className="w-4 h-4 text-[#E84C3D]" />
          </div>
          <div className="text-2xl font-black text-[#E84C3D]">
            {summary.total_violations ?? 0}
          </div>
          <div className="text-[11px] text-[#777777]">
            Уход с вкладки / ПКМ
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-1">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Средний балл</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-[#222222]">
            {summary.average_score ?? 0}%
          </div>
          <div className="text-[11px] text-[#777777]">
            По завершенным
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени сотрудника, email или названию сессии..."
              className="input-field pl-9 text-xs sm:text-sm w-full bg-[#F5F5F7]"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Department Filter (Admin only) */}
            {!isHead ? (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="input-field text-xs sm:text-sm bg-white min-w-[150px]"
              >
                <option value="all">Все отделы</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" />
                <span>Отдел: {user?.department || 'Мой'}</span>
              </div>
            )}

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-field text-xs sm:text-sm bg-white min-w-[140px]"
            >
              <option value="all">Все статусы</option>
              <option value="passed">Сдали успешно</option>
              <option value="failed">Не сдали</option>
              <option value="needs_review">Требуют проверки</option>
              <option value="submitted">Все завершенные</option>
              <option value="disqualified">Дисквалифицирован</option>
              <option value="taking">В процессе сдачи</option>
              <option value="waiting">В лобби</option>
            </select>

            {/* Session Filter */}
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="input-field text-xs sm:text-sm bg-white max-w-[200px] truncate"
            >
              <option value="all">Все экзамены</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} (код {s.pin_code})
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 font-bold shrink-0 min-h-[40px]"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Фильтр</span>
            </button>
          </div>
        </form>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[#E84C3D] text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[#E84C3D] animate-spin mx-auto" />
            <div className="text-sm font-bold text-[#141414]">Загрузка протоколов экзаменов...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center max-w-md mx-auto space-y-3">
            <BarChart3 className="w-12 h-12 text-[#CED4DA] mx-auto" />
            <h3 className="text-base font-bold text-[#222222]">Записей не найдено</h3>
            <p className="text-xs text-[#777777]">
              {isHead
                ? 'Сотрудники вашего отдела пока не участвовали в очных экзаменах по выбранным фильтрам.'
                : 'По выбранным критериям поиска и фильтрации нет данных об участниках.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#141414] text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Сотрудник / Отдел</th>
                  <th className="py-3.5 px-4">Сессия экзамена</th>
                  <th className="py-3.5 px-4">Дата сдачи</th>
                  <th className="py-3.5 px-4 text-center">Баллы / Оценка</th>
                  <th className="py-3.5 px-4 text-center">Античит</th>
                  <th className="py-3.5 px-4 text-center">Статус</th>
                  <th className="py-3.5 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] text-xs">
                {items.map((row) => {
                  const isSubmitted = row.status === 'submitted';
                  const isDisqualified = row.status === 'disqualified';
                  const isNeedsReview = row.needs_review || row.attempt_status === 'needs_review';
                  const totalViolations = (row.tab_switches_count || 0) + (row.right_clicks_count || 0);

                  return (
                    <tr key={row.id} className="hover:bg-[#F9FAFB] transition-colors">
                      {/* Employee / Dept */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#141414] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {row.full_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-[#222222] text-sm leading-snug">
                              {row.full_name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {row.email && (
                                <span className="text-[11px] text-[#777777]">{row.email}</span>
                              )}
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F5F5F7] text-[#555555] border border-[#EEEEEE]">
                                {row.department || 'Без отдела'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Session / Test */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#222222] text-xs">
                          {row.session_title}
                        </div>
                        <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-0.5">
                          <span>{row.test_title}</span>
                          {row.pin_code && (
                            <span className="font-mono font-bold text-[#141414] bg-[#F0F5FA] px-1.5 py-0.2 rounded border border-blue-200 text-[10px]">
                              PIN: {row.pin_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-[#777777] whitespace-nowrap">
                        {formatDate(row.finished_at || row.joined_at)}
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4 text-center">
                        {isSubmitted ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`text-sm font-black ${
                                row.passed ? 'text-emerald-600' : 'text-[#E84C3D]'
                              }`}
                            >
                              {row.score}%
                            </span>
                            <span className="text-[10px] text-[#777777]">
                              {row.points_earned} / {row.total_points} б.
                            </span>
                          </div>
                        ) : isDisqualified ? (
                          <span className="text-xs font-bold text-[#E84C3D]">0%</span>
                        ) : (
                          <span className="text-xs text-[#777777] italic">В процессе</span>
                        )}
                      </td>

                      {/* Anti-cheat audit */}
                      <td className="py-3.5 px-4 text-center">
                        {totalViolations === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            <span>Чисто</span>
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-[#E84C3D] border border-red-200">
                              <ShieldAlert className="w-3 h-3 text-[#E84C3D]" />
                              <span>{totalViolations} наруш.</span>
                            </span>
                            <div className="text-[10px] text-[#777777] space-x-1">
                              {row.tab_switches_count > 0 && (
                                <span>{row.tab_switches_count} окон</span>
                              )}
                              {row.right_clicks_count > 0 && (
                                <span>{row.right_clicks_count} ПКМ</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isDisqualified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            Дисквалифицирован
                          </span>
                        ) : isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3" />
                            На проверке
                          </span>
                        ) : isSubmitted && row.passed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Сдал
                          </span>
                        ) : isSubmitted && !row.passed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-[#E84C3D] border border-red-200">
                            <XCircle className="w-3 h-3" />
                            Не сдал
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Пишет тест
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isNeedsReview && row.attempt_id ? (
                            <button
                              type="button"
                              onClick={() => setReviewingAttemptId(row.attempt_id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Проверить</span>
                            </button>
                          ) : row.attempt_id ? (
                            <button
                              type="button"
                              onClick={() => setReviewingAttemptId(row.attempt_id)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#555555] bg-[#F5F5F7] hover:bg-[#EEEEEE] hover:text-[#141414] transition-colors flex items-center gap-1 border border-[#EEEEEE]"
                              title="Посмотреть протокол и ответы"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Протокол</span>
                            </button>
                          ) : null}

                          {row.session_status === 'in_progress' && (
                            <Link
                              to={`/admin/exam/${row.session_id}`}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#E84C3D] bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1 border border-red-200"
                              title="Перейти в пульт управления сессией"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Сессия</span>
                            </Link>
                          )}
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
            setReviewingAttemptId(null);
            fetchStats();
          }}
        />
      )}
    </div>
  );
};