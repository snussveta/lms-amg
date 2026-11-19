import React, { useState, useEffect } from 'react';
import {
  X,
  Award,
  BookOpen,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  Percent,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const UserStatisticsModal = ({ user, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'courses' | 'tests' | 'attestations'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user?.id) {
      loadStats();
    }
  }, [user?.id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/users/${user.id}/statistics`);
      setStats(res.data);
    } catch (err) {
      console.error('Ошибка загрузки статистики сотрудника:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить статистику сотрудника.'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} сек`;
    return `${m} мин ${s} сек`;
  };

  const roleLabels = {
    superadmin: 'Суперадминистратор',
    admin: 'Администратор',
    department_head: 'Руководитель отдела',
    employee: 'Сотрудник',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#141414]/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EEEEEE] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="w-11 h-11 rounded-xl bg-[#141414] text-white flex items-center justify-center font-black text-sm shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'С'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-[#222222] truncate">
                  {user?.full_name || 'Сотрудник'}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#141414] text-white">
                  Категория {stats?.summary?.current_category || user?.category || 1}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F5F5F7] text-[#777777] border border-[#EEEEEE]">
                  {roleLabels[user?.role] || user?.role}
                </span>
              </div>
              <p className="text-xs text-[#777777] mt-0.5 truncate">
                {user?.email} • {user?.department || 'Без отдела'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] transition-colors shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#EEEEEE] bg-[#F5F5F7] px-4 sm:px-5 overflow-x-auto shrink-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <Layers className="w-4 h-4 text-[#141414]" />
            <span>Обзор и показатели</span>
          </button>

          <button
            onClick={() => setActiveTab('courses')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'courses'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#141414]" />
            <span>Курсы ({stats?.courses?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'tests'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <FileText className="w-4 h-4 text-[#141414]" />
            <span>Тесты ({stats?.tests?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('attestations')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'attestations'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <Award className="w-4 h-4 text-[#E84C3D]" />
            <span>Аттестации ({stats?.attestations?.length || 0})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#FAFAFC]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-[#777777] font-medium">Загрузка статистики сотрудника...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-[#E84C3D] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-white p-4 rounded-xl border border-[#EEEEEE] shadow-2xs">
                      <div className="flex items-center justify-between text-[#777777] mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Категория</span>
                        <Award className="w-4 h-4 text-[#E84C3D]" />
                      </div>
                      <div className="text-2xl font-black text-[#141414]">
                        Уровень {stats.summary.current_category}
                      </div>
                      <div className="text-[11px] text-[#777777] mt-0.5 font-medium">
                        Квалификация
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#EEEEEE] shadow-2xs">
                      <div className="flex items-center justify-between text-[#777777] mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Курсы</span>
                        <BookOpen className="w-4 h-4 text-[#141414]" />
                      </div>
                      <div className="text-2xl font-black text-[#141414]">
                        {stats.summary.completed_courses} <span className="text-xs font-normal text-[#777777]">/ {stats.summary.total_courses}</span>
                      </div>
                      <div className="text-[11px] text-[#777777] mt-0.5 font-medium">
                        Завершено курсов
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#EEEEEE] shadow-2xs">
                      <div className="flex items-center justify-between text-[#777777] mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Тесты</span>
                        <FileText className="w-4 h-4 text-[#141414]" />
                      </div>
                      <div className="text-2xl font-black text-[#141414]">
                        {stats.summary.total_tests}
                      </div>
                      <div className="text-[11px] text-[#777777] mt-0.5 font-medium">
                        Пройдено тестов
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#EEEEEE] shadow-2xs">
                      <div className="flex items-center justify-between text-[#777777] mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Аттестации</span>
                        <GraduationCap className="w-4 h-4 text-[#E84C3D]" />
                      </div>
                      <div className="text-2xl font-black text-[#E84C3D]">
                        {stats.summary.total_attestations}
                      </div>
                      <div className="text-[11px] text-[#777777] mt-0.5 font-medium">
                        Аттестационных срезов
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity Sections */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recent Attestations Preview */}
                    <div className="bg-white p-5 rounded-2xl border border-[#EEEEEE] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#222222] flex items-center gap-2">
                          <Award className="w-4 h-4 text-[#E84C3D]" />
                          <span>Последние аттестации</span>
                        </h3>
                        {stats.attestations.length > 0 && (
                          <button
                            onClick={() => setActiveTab('attestations')}
                            className="text-xs font-bold text-[#E84C3D] hover:underline"
                          >
                            Все ({stats.attestations.length})
                          </button>
                        )}
                      </div>

                      {stats.attestations.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#777777]">
                          Сотрудник еще не проходил аттестации
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stats.attestations.slice(0, 3).map((a) => (
                            <div
                              key={a.attempt_id}
                              className="p-3 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-[#222222] truncate">{a.test_title}</div>
                                <div className="text-[11px] text-[#777777] mt-0.5">{formatDate(a.submitted_at || a.started_at)}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-bold text-[#222222]">{a.percentage}%</span>
                                {a.category_action === 'promoted' && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> ↑Кат. {a.category_after}
                                  </span>
                                )}
                                {a.category_action === 'demoted' && (
                                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" /> ↓Кат. {a.category_after}
                                  </span>
                                )}
                                {a.category_action === 'retained' && (
                                  <span className="px-2 py-0.5 rounded bg-zinc-200 text-[#222222] font-bold text-[10px] flex items-center gap-1">
                                    <Minus className="w-3 h-3" /> Кат. {a.category_after}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Courses Preview */}
                    <div className="bg-white p-5 rounded-2xl border border-[#EEEEEE] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#222222] flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-[#141414]" />
                          <span>Назначенные и изучаемые курсы</span>
                        </h3>
                        {stats.courses.length > 0 && (
                          <button
                            onClick={() => setActiveTab('courses')}
                            className="text-xs font-bold text-[#141414] hover:underline"
                          >
                            Все ({stats.courses.length})
                          </button>
                        )}
                      </div>

                      {stats.courses.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#777777]">
                          Курсы пока не назначены
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {stats.courses.slice(0, 3).map((c) => (
                            <div
                              key={c.course_id}
                              className="p-3 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-[#222222] truncate">{c.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    c.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : c.status === 'in_progress'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-zinc-200 text-[#777777]'
                                  }`}
                                >
                                  {c.status === 'completed' ? 'Завершен' : c.status === 'in_progress' ? 'В процессе' : 'Не начат'}
                                </span>
                              </div>
                              <div className="w-full bg-[#EEEEEE] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-[#141414] h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${c.progress_percent}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COURSES */}
              {activeTab === 'courses' && (
                <div className="space-y-3">
                  {stats.courses.length === 0 ? (
                    <div className="bg-white p-12 text-center text-xs text-[#777777] rounded-2xl border border-[#EEEEEE]">
                      Сотруднику не назначен ни один курс.
                    </div>
                  ) : (
                    stats.courses.map((c) => (
                      <div
                        key={c.course_id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-[#EEEEEE] shadow-2xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[#222222] truncate">{c.title}</h4>
                            <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-0.5 flex-wrap">
                              <span>Уроков пройдено: <strong>{c.completed_lessons} / {c.total_lessons}</strong></span>
                              {c.deadline && (
                                <>
                                  <span>•</span>
                                  <span>Дедлайн: {formatDate(c.deadline)}</span>
                                </>
                              )}
                              {c.completed_at && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-medium">Завершен: {formatDate(c.completed_at)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
                              c.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : c.status === 'in_progress'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#F5F5F7] text-[#777777] border border-[#EEEEEE]'
                            }`}
                          >
                            {c.status === 'completed' ? 'Завершен (100%)' : c.status === 'in_progress' ? `В процессе (${c.progress_percent}%)` : 'Не начат (0%)'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-[#F5F5F7] rounded-full h-2 overflow-hidden border border-[#EEEEEE]">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              c.status === 'completed' ? 'bg-emerald-500' : 'bg-[#141414]'
                            }`}
                            style={{ width: `${c.progress_percent}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: TESTS (REGULAR TESTS) */}
              {activeTab === 'tests' && (
                <div className="space-y-3">
                  {stats.tests.length === 0 ? (
                    <div className="bg-white p-12 text-center text-xs text-[#777777] rounded-2xl border border-[#EEEEEE]">
                      Сотрудник пока не проходил обычные тесты.
                    </div>
                  ) : (
                    stats.tests.map((t) => (
                      <div
                        key={t.attempt_id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-[#EEEEEE] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-[#222222] truncate">{t.test_title}</h4>
                          <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#777777]" />
                              {formatDate(t.submitted_at || t.started_at)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#777777]" />
                              {formatDuration(t.time_spent_seconds)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-[#222222]">
                              {t.percentage}%
                            </div>
                            <div className="text-[11px] text-[#777777]">
                              {t.score} из {t.max_score} б.
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              t.status === 'needs_review'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : t.status === 'in_progress'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {t.status === 'needs_review'
                              ? 'На проверке'
                              : t.status === 'in_progress'
                              ? 'В процессе'
                              : 'Завершен'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: ATTESTATIONS */}
              {activeTab === 'attestations' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    💡 <strong>Аттестации</strong> — контрольные срезы знаний, по результатам которых пересчитывается квалификационная категория сотрудника (Уровни 1 — 4).
                  </div>

                  {stats.attestations.length === 0 ? (
                    <div className="bg-white p-12 text-center text-xs text-[#777777] rounded-2xl border border-[#EEEEEE]">
                      Сотрудник пока не проходил аттестации.
                    </div>
                  ) : (
                    stats.attestations.map((a) => (
                      <div
                        key={a.attempt_id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-[#EEEEEE] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-[#E84C3D] border border-red-200 uppercase tracking-wider">
                              Аттестация
                            </span>
                            <h4 className="font-bold text-sm text-[#222222] truncate">{a.test_title}</h4>
                          </div>

                          <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-[#777777]" />
                              {formatDate(a.submitted_at || a.started_at)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#777777]" />
                              {formatDuration(a.time_spent_seconds)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-[#222222]">
                              {a.percentage}%
                            </div>
                            <div className="text-[11px] text-[#777777]">
                              {a.score} из {a.max_score} б.
                            </div>
                          </div>

                          {/* Category Action Badge */}
                          {a.category_action === 'promoted' ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1.5">
                              <TrendingUp className="w-4 h-4 text-emerald-600" />
                              <span>Кат. {a.category_before} → <strong>Кат. {a.category_after}</strong> (+1)</span>
                            </span>
                          ) : a.category_action === 'demoted' ? (
                            <span className="px-3 py-1.5 rounded-xl bg-red-50 text-red-800 border border-red-200 font-bold text-xs flex items-center gap-1.5">
                              <TrendingDown className="w-4 h-4 text-[#E84C3D]" />
                              <span>Кат. {a.category_before} → <strong>Кат. {a.category_after}</strong> (-1)</span>
                            </span>
                          ) : a.category_action === 'retained' ? (
                            <span className="px-3 py-1.5 rounded-xl bg-zinc-100 text-[#222222] border border-[#EEEEEE] font-bold text-xs flex items-center gap-1.5">
                              <Minus className="w-4 h-4 text-[#777777]" />
                              <span>Кат. {a.category_after} (Подтверждена)</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[#777777] border border-[#EEEEEE] font-semibold text-xs">
                              {a.status === 'needs_review' ? 'На проверке' : 'Завершена'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#EEEEEE] bg-white flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn-dark-pill text-xs py-2 px-5 min-h-[40px]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
