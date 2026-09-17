import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Search,
  Square,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
  AlertCircle,
  Building2,
  GraduationCap,
  Percent,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const AssignCourseModal = ({ course, onClose, onAssigned }) => {
  const [activeTab, setActiveTab] = useState('assign'); // 'assign' | 'list'
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('Все филиалы');
  const [selectedDept, setSelectedDept] = useState('Все отделы');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const branches = [
    'Все филиалы',
    'AutoMall Центральный',
    'AutoMall Север',
    'AutoMall Юг',
    'AutoMall Восток',
  ];

  const departments = ['Все отделы', 'СТО', 'Склад', 'Продажи', 'Общий'];

  useEffect(() => {
    if (course?.id) {
      loadData();
    }
  }, [course?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, assignRes] = await Promise.all([
        api.get('/users'),
        api.get(`/courses/${course.id}/assigned-users`),
      ]);
      setUsers(usersRes.data || []);
      setAssignments(assignRes.data.assigned_users || []);
    } catch (err) {
      console.error('Ошибка загрузки данных назначения курса:', err);
      setError('Не удалось загрузить сотрудников и текущие назначения.');
    } finally {
      setLoading(false);
    }
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));

  // Filter employees by search term, AutoMall branch and department
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term);

    const userBranch = u.branch || 'AutoMall Центральный';
    const userDept = u.department || 'СТО';

    const matchesBranch =
      selectedBranch === 'Все филиалы' || userBranch === selectedBranch;

    const matchesDept =
      selectedDept === 'Все отделы' || userDept === selectedDept;

    return matchesSearch && matchesBranch && matchesDept;
  });

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredUsers.map((u) => u.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) {
      setError('Пожалуйста, выберите хотя бы одного сотрудника для назначения курса.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      const payload = {
        user_ids: selectedUserIds,
        deadline: dueDate ? new Date(dueDate).toISOString() : null,
      };

      await api.post(`/courses/${course.id}/assign`, payload);
      setSuccessMsg(`Курс успешно назначен выбранным сотрудникам (${selectedUserIds.length}).`);
      setSelectedUserIds([]);
      setDueDate('');

      // Reload assignments list
      const assignRes = await api.get(`/courses/${course.id}/assigned-users`);
      setAssignments(assignRes.data.assigned_users || []);

      if (onAssigned) {
        onAssigned();
      }

      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab('list');
      }, 1200);
    } catch (err) {
      console.error('Ошибка назначения курса:', err);
      setError(getErrorMessage(err, 'Не удалось сохранить назначения курса.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Отозвать назначение курса у данного сотрудника?')) return;

    try {
      await api.delete(`/courses/${course.id}/assign/${userId}`);
      setAssignments((prev) => prev.filter((a) => a.user_id !== userId));
      if (onAssigned) {
        onAssigned();
      }
    } catch (err) {
      console.error('Ошибка отзыва назначения курса:', err);
      alert(getErrorMessage(err, 'Не удалось отозвать назначение.'));
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Без дедлайна';
    const d = new Date(isoString);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-3xl w-full border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sky-400" />
              <span>Назначение курса сотрудникам</span>
            </h2>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span className="font-semibold text-slate-200">«{course.title}»</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                {course.department_tag}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-5">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'assign'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Назначить сотрудникам</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Назначенные ({assignments.length})</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-5 mt-4 p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-5 mt-4 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Assign Form */}
        {activeTab === 'assign' && (
          <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
            {/* Filters & Search Grid */}
            <div className="space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Поиск сотрудника по ФИО или Email..."
                    className="input-field pl-9 text-xs"
                  />
                </div>

                {/* AutoMall Branch Filter */}
                <div className="w-full sm:w-56">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="input-field text-xs bg-slate-900"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Filter */}
                <div className="w-full sm:w-40">
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="input-field text-xs bg-slate-900"
                  >
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deadline & Quick Select Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Calendar className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="shrink-0 font-medium">Срок прохождения:</span>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  {dueDate && (
                    <button
                      onClick={() => setDueDate('')}
                      className="text-slate-500 hover:text-slate-300 text-xs"
                      title="Очистить дату"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                  <span>
                    {filteredUsers.length > 0 &&
                    filteredUsers.every((u) => selectedUserIds.includes(u.id))
                      ? 'Снять выбор со всех'
                      : `Выбрать всех (${filteredUsers.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Employees List */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/30 divide-y divide-slate-800/60 min-h-[220px]">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">Загрузка списка сотрудников...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs space-y-1">
                  <div>Сотрудники по заданным критериям не найдены.</div>
                  <div className="text-[11px] text-slate-600">Попробуйте изменить поисковый запрос или фильтр филиала.</div>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.id);
                  const isAlreadyAssigned = assignedUserIds.has(u.id);

                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-950/40 border-l-2 border-sky-400'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="text-slate-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-sky-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 truncate flex items-center gap-2">
                            <span>{u.full_name}</span>
                            {isAlreadyAssigned && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800 text-[10px] font-medium text-amber-400">
                                Уже назначен
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-2 mt-0.5">
                            <span>{u.email}</span>
                            <span>•</span>
                            <span className="text-slate-300">{u.branch || 'AutoMall Центральный'}</span>
                            <span>•</span>
                            <span className="text-slate-400">{u.department || 'СТО'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                        {u.role === 'admin' ? 'Админ' : u.role === 'superadmin' ? 'Суперадмин' : 'Сотрудник'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-400">
                Выбрано сотрудников:{' '}
                <span className="font-bold text-sky-400">{selectedUserIds.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={submitting || selectedUserIds.length === 0}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-lg"
                >
                  <Check className="w-3.5 h-3.5" />
                  {submitting ? 'Назначение...' : `Назначить курс (${selectedUserIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Assigned Employees List */}
        {activeTab === 'list' && (
          <div className="p-5 flex-1 flex flex-col min-h-0 space-y-4">
            <div className="text-xs text-slate-400">
              Сотрудники с активным доступом к курсу и мониторинг их прогресса:
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-900/30 divide-y divide-slate-800/60 min-h-[260px]">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">Загрузка назначений...</div>
              ) : assignments.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600" />
                  <div>Курс пока не назначен ни одному сотруднику.</div>
                  <button
                    onClick={() => setActiveTab('assign')}
                    className="text-sky-400 hover:underline pt-1 text-xs"
                  >
                    Перейти к назначению →
                  </button>
                </div>
              ) : (
                assignments.map((item) => {
                  const isFinished = item.is_completed || item.progress_percent >= 100;
                  const isDeadlinePassed =
                    item.deadline && new Date(item.deadline) < new Date() && !isFinished;

                  return (
                    <div
                      key={item.id || item.user_id}
                      className="p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{item.full_name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              isFinished
                                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                                : item.progress_percent > 0
                                ? 'bg-sky-950/80 border border-sky-800 text-sky-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isFinished
                              ? 'Пройден'
                              : item.progress_percent > 0
                              ? 'В процессе'
                              : 'Не начат'}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                          <span>{item.email}</span>
                          <span>•</span>
                          <span className="text-slate-300">{item.branch || 'AutoMall'}</span>
                          <span>•</span>
                          <span className="text-slate-400">{item.department || 'СТО'}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="pt-1 flex items-center gap-3">
                          <div className="flex-1 max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isFinished ? 'bg-emerald-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${item.progress_percent || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.progress_percent || 0}%
                          </span>
                        </div>
                      </div>

                      {/* Deadline & Revoke */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500">
                            Назначен: {formatDate(item.assigned_at)}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              isDeadlinePassed
                                ? 'text-rose-400'
                                : item.deadline
                                ? 'text-amber-300'
                                : 'text-slate-400'
                            }`}
                          >
                            Дедлайн: {formatDate(item.deadline)}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRevoke(item.user_id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Отозвать назначение"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs py-2 px-5"
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
