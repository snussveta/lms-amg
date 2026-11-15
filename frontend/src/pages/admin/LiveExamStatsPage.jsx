import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileQuestion,
  Filter,
  Hash,
  Lock,
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
  const { user, isAdmin } = useAuth();
  const isHead = user?.role === 'department_head';

  const [searchParams, setSearchParams] = useSearchParams();
  const activeSessionId = searchParams.get('session');

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
      can_review: isAdmin,
      managed_department: user?.department || null,
    },
    sessions: [],
    departments: [],
    items: [],
  });

  // Filters for Level 1 (Exams list)
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('all');

  // Filters for Level 2 (Participants inside an exam)
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantStatusFilter, setParticipantStatusFilter] = useState('all');
  const [participantDeptFilter, setParticipantDeptFilter] = useState('all');

  // Review modal
  const [reviewingAttemptId, setReviewingAttemptId] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [activeSessionId, participantDeptFilter, participantStatusFilter]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (activeSessionId) {
        params.session_id = parseInt(activeSessionId, 10);
      }
      if (!isHead && participantDeptFilter && participantDeptFilter !== 'all') {
        params.department = participantDeptFilter;
      }
      if (participantStatusFilter && participantStatusFilter !== 'all') {
        params.status_filter = participantStatusFilter;
      }
      if (participantSearch.trim() && activeSessionId) {
        params.search = participantSearch.trim();
      }

      const res = await api.get('/exam/stats', { params });
      setStatsData(res.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики экзаменов:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить данные экзаменов.'));
    } finally {
      setLoading(false);
    }
  };

  const handleParticipantSearchSubmit = (e) => {
    e.preventDefault();
    fetchStats();
  };

  const openExamDetails = (sessionId) => {
    setSearchParams({ session: sessionId });
    setParticipantSearch('');
    setParticipantStatusFilter('all');
  };

  const closeExamDetails = () => {
    setSearchParams({});
    setParticipantSearch('');
    setParticipantStatusFilter('all');
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

  // Currently selected session object
  const currentSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === parseInt(activeSessionId, 10)) || statsData.selected_session || null;
  }, [activeSessionId, sessions, statsData.selected_session]);

  // Filtered sessions list for Level 1
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (examStatusFilter !== 'all' && s.status !== examStatusFilter) {
        return false;
      }
      if (examSearch.trim()) {
        const query = examSearch.trim().toLowerCase();
        const matchesTitle = s.title?.toLowerCase().includes(query);
        const matchesTest = s.test_title?.toLowerCase().includes(query);
        const matchesPin = s.pin_code?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesTest && !matchesPin) return false;
      }
      return true;
    });
  }, [sessions, examStatusFilter, examSearch]);

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
          onClick={() => {
            if (activeSessionId) closeExamDetails();
          }}
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#141414] shadow-xs border border-[#E5E5E5] flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4 text-[#E84C3D]" />
          <span>Прошедшие экзамены и проверка</span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* LEVEL 1: LIST OF CONDUCTED EXAMS (If no exam is selected) */}
      {/* ========================================================================= */}
      {!activeSessionId ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#141414] text-white flex items-center justify-center shadow-sm">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                      {isHead ? 'Экзамены сотрудников отдела' : 'Прошедшие очные экзамены'}
                    </h1>
                    {isHead ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Lock className="w-3 h-3" />
                        Отдел: {user?.department || 'Мой отдел'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Shield className="w-3 h-3" />
                        Все экзамены компании
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#777777] mt-0.5">
                    {isHead
                      ? `Выберите экзамен для просмотра статистики и результатов сотрудников отдела «${user?.department || 'Ваш отдел'}»`
                      : 'Выберите экзаменационную сессию для просмотра результатов, контроля честности и проверки письменных работ'}
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
              <span>Обновить список</span>
            </button>
          </div>

          {/* Search & Status Filter for Exams List */}
          <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Поиск экзамена по названию, тесту или коду PIN..."
                className="input-field pl-9 text-xs sm:text-sm w-full bg-[#F5F5F7]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={examStatusFilter}
                onChange={(e) => setExamStatusFilter(e.target.value)}
                className="input-field text-xs sm:text-sm bg-white min-w-[160px]"
              >
                <option value="all">Все статусы ({sessions.length})</option>
                <option value="completed">Завершенные</option>
                <option value="in_progress">Экзамен идет</option>
                <option value="waiting">Ожидание старта</option>
              </select>
            </div>
          </div>

          {/* Error notification */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[#E84C3D] text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Exams Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl p-16 text-center space-y-3 border border-[#EEEEEE] shadow-card">
              <RefreshCw className="w-8 h-8 text-[#E84C3D] animate-spin mx-auto" />
              <div className="text-sm font-bold text-[#141414]">Загрузка экзаменационных сессий...</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center max-w-md mx-auto space-y-3 border border-[#EEEEEE] shadow-card">
              <BarChart3 className="w-12 h-12 text-[#CED4DA] mx-auto" />
              <h3 className="text-base font-bold text-[#222222]">Экзамены не найдены</h3>
              <p className="text-xs text-[#777777]">
                {examSearch || examStatusFilter !== 'all'
                  ? 'По выбранным критериям поиска сессий не найдено.'
                  : 'Очные экзамены еще не проводились. Создайте экзамен в разделе «Управление тестами».'}
              </p>
              <Link to="/admin/tests" className="btn-primary text-xs inline-flex items-center gap-1.5 px-4 py-2 mt-2">
                <FileQuestion className="w-4 h-4" />
                <span>Перейти к тестам</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSessions.map((s) => {
                const isCompleted = s.status === 'completed';
                const isInProgress = s.status === 'in_progress';
                const hasNeedsReview = s.needs_review_count > 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => openExamDetails(s.id)}
                    className="bg-white rounded-2xl border border-[#EEEEEE] hover:border-[#141414]/30 shadow-card hover:shadow-lg transition-all p-5 flex flex-col justify-between cursor-pointer group select-none relative overflow-hidden"
                  >
                    {/* Top status & PIN */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                              : isInProgress
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isCompleted ? 'Завершен' : isInProgress ? 'Экзамен идет' : 'Ожидание'}
                        </span>

                        <span className="font-mono text-xs font-bold bg-[#F0F5FA] text-[#141414] px-2.5 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
                          <Hash className="w-3 h-3 text-blue-500" />
                          <span>{s.pin_code}</span>
                        </span>
                      </div>

                      {/* Title & Test */}
                      <h3 className="font-bold text-base text-[#222222] group-hover:text-[#E84C3D] transition-colors line-clamp-1">
                        {s.title}
                      </h3>
                      <div className="text-xs text-[#777777] line-clamp-1 mt-0.5 font-medium">
                        Тест: {s.test_title}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-[#888888] mt-3">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(s.started_at || s.created_at)}</span>
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="mt-5 pt-4 border-t border-[#EEEEEE] space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-[#F5F5F7] p-2 rounded-xl border border-[#EEEEEE]">
                          <div className="text-[10px] text-[#777777] uppercase font-bold">Писали</div>
                          <div className="text-base font-black text-[#141414] mt-0.5">
                            {s.total_participants}
                          </div>
                        </div>

                        <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                          <div className="text-[10px] text-emerald-800 uppercase font-bold">Сдали</div>
                          <div className="text-base font-black text-emerald-700 mt-0.5">
                            {s.passed_count}
                          </div>
                        </div>

                        <div className="bg-red-50/70 p-2 rounded-xl border border-red-200">
                          <div className="text-[10px] text-[#E84C3D] uppercase font-bold">Не сдали</div>
                          <div className="text-base font-black text-[#E84C3D] mt-0.5">
                            {s.failed_count}
                          </div>
                        </div>
                      </div>

                      {/* Needs review alert pill */}
                      {hasNeedsReview && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                            <span>Требуют проверки: {s.needs_review_count}</span>
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase">
                              Оценить
                            </span>
                          )}
                        </div>
                      )}

                      {/* Open button */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-[#141414] group-hover:text-[#E84C3D] flex items-center gap-1 transition-colors">
                          <span>Открыть статистику и список</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>

                        {isInProgress && (
                          <Link
                            to={`/admin/exam/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#E84C3D] bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-1"
                            title="В комнату экзамена"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Комната</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* LEVEL 2: DETAILED STATS & PARTICIPANTS OF SELECTED EXAM */
        /* ========================================================================= */
        <div className="space-y-6 animate-fade-in">
          {/* Back button & Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
            <div>
              <button
                type="button"
                onClick={closeExamDetails}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E84C3D] hover:underline transition-colors mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад ко всем экзаменам</span>
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                  {currentSession?.title || `Экзамен #${activeSessionId}`}
                </h1>
                <span className="font-mono text-xs font-bold bg-[#F0F5FA] text-[#141414] px-2.5 py-1 rounded-lg border border-blue-200">
                  PIN: {currentSession?.pin_code || '—'}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    currentSession?.status === 'completed'
                      ? 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      : currentSession?.status === 'in_progress'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {currentSession?.status === 'completed'
                    ? 'Завершен'
                    : currentSession?.status === 'in_progress'
                    ? 'Экзамен идет'
                    : 'Ожидание'}
                </span>
              </div>

              <p className="text-xs text-[#777777] mt-1">
                Тест: <strong>{currentSession?.test_title || 'Тест'}</strong> • Дата:{' '}
                <strong>{formatDate(currentSession?.started_at || currentSession?.created_at)}</strong>
                {isHead && (
                  <span className="ml-2 text-amber-800 font-bold">
                    (Отображаются только сотрудники вашего отдела)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {currentSession?.status === 'in_progress' && (
                <Link
                  to={`/admin/exam/${activeSessionId}`}
                  className="btn-primary text-xs sm:text-sm py-2 px-4 flex items-center gap-1.5 font-bold shadow-sm"
                >
                  <Zap className="w-4 h-4" />
                  <span>В комнату экзамена</span>
                </Link>
              )}

              <button
                type="button"
                onClick={fetchStats}
                disabled={loading}
                className="btn-secondary text-xs sm:text-sm py-2 px-3.5 flex items-center gap-1.5 min-h-[40px] shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#E84C3D]' : ''}`} />
                <span>Обновить</span>
              </button>
            </div>
          </div>

          {/* KPI Cards specifically FOR THIS EXAM */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Total Participants */}
            <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-1">
              <div className="flex items-center justify-between text-[#777777]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Писали</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-[#222222]">
                {summary.total_participants ?? 0}
              </div>
              <div className="text-[11px] text-[#777777]">
                Сдали ответы: <span className="font-bold text-[#222222]">{summary.submitted_count ?? 0}</span>
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
                  ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
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
                {summary.needs_review_count > 0
                  ? isAdmin
                    ? 'Требуют оценки'
                    : 'Проверяется админом'
                  : 'Все проверено'}
              </div>
            </div>

            {/* Anti-cheat Violations */}
            <div
              className={`rounded-2xl p-4 border shadow-card space-y-1 ${
                summary.total_violations > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-[#EEEEEE]'
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
                Уход с экрана / ПКМ
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
                По проверенным
              </div>
            </div>
          </div>

          {/* Filter Toolbar for this Exam's Participants */}
          <div className="bg-white rounded-2xl p-4 border border-[#EEEEEE] shadow-card space-y-3">
            <form onSubmit={handleParticipantSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Поиск по имени сотрудника или email..."
                  className="input-field pl-9 text-xs sm:text-sm w-full bg-[#F5F5F7]"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                {/* Department Filter (Admin only) */}
                {!isHead ? (
                  <select
                    value={participantDeptFilter}
                    onChange={(e) => setParticipantDeptFilter(e.target.value)}
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
                  value={participantStatusFilter}
                  onChange={(e) => setParticipantStatusFilter(e.target.value)}
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

          {/* Table: WHO WROTE THIS EXAM */}
          <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EEEEEE] bg-[#FAFAFA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#141414]" />
                <h3 className="font-bold text-sm text-[#222222]">
                  Участники экзамена ({items.length})
                </h3>
              </div>
              <span className="text-xs text-[#777777]">
                Список сотрудников, сдававших данный экзамен
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#E84C3D] animate-spin mx-auto" />
                <div className="text-sm font-bold text-[#141414]">Загрузка участников экзамена...</div>
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center max-w-md mx-auto space-y-3">
                <Users className="w-12 h-12 text-[#CED4DA] mx-auto" />
                <h3 className="text-base font-bold text-[#222222]">Участники не найдены</h3>
                <p className="text-xs text-[#777777]">
                  По выбранным критериям поиска в данном экзамене нет записей.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-[#141414] text-white text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Сотрудник / Отдел</th>
                      <th className="py-3.5 px-4">Дата сдачи</th>
                      <th className="py-3.5 px-4 text-center">Баллы / Оценка</th>
                      <th className="py-3.5 px-4 text-center">Античит</th>
                      <th className="py-3.5 px-4 text-center">Статус</th>
                      <th className="py-3.5 px-4 text-right">{isAdmin ? 'Действия' : 'Инфо'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] text-xs">
                    {items.map((row) => {
                      const isSubmitted = row.status === 'submitted';
                      const isDisqualified = row.status === 'disqualified';
                      const isNeedsReview = row.needs_review || row.status === 'needs_review' || row.attempt_status === 'needs_review';
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

                          {/* Date */}
                          <td className="py-3.5 px-4 text-[#777777] whitespace-nowrap">
                            {formatDate(row.finished_at || row.joined_at)}
                          </td>

                          {/* Score (HIDDEN IF NEEDS REVIEW) */}
                          <td className="py-3.5 px-4 text-center">
                            {isNeedsReview ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                                  На проверке
                                </span>
                                <span className="text-[10px] text-[#777777] mt-0.5">
                                  Оценка формируется
                                </span>
                              </div>
                            ) : isSubmitted ? (
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
                                {isAdmin ? 'На проверке' : 'На проверке админом'}
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
                              {isAdmin && (
                                <>
                                  {isNeedsReview && row.attempt_id ? (
                                    <button
                                      type="button"
                                      onClick={() => setReviewingAttemptId(row.attempt_id)}
                                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#E84C3D] hover:bg-[#D33829] active:scale-95 transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
                                      title="Проверить развернутые ответы и выставить оценку"
                                    >
                                      <FileCheck className="w-3.5 h-3.5" />
                                      <span>Проверить работу</span>
                                    </button>
                                  ) : row.attempt_id ? (
                                    <button
                                      type="button"
                                      onClick={() => setReviewingAttemptId(row.attempt_id)}
                                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#555555] bg-[#F5F5F7] hover:bg-[#EEEEEE] hover:text-[#141414] transition-colors flex items-center gap-1 border border-[#EEEEEE]"
                                      title="Посмотреть проверенный протокол"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Протокол</span>
                                    </button>
                                  ) : null}
                                </>
                              )}

                              {!isAdmin && (
                                <span className="text-[#999999] text-[11px]">—</span>
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
        </div>
      )}

      {/* Manual Review Modal (Only Admins) */}
      {isAdmin && reviewingAttemptId && (
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
