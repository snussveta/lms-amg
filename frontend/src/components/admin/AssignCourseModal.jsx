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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#003B73]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E0E0E0] flex items-center justify-between bg-white">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold text-[#212529] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#003B73] shrink-0" />
              <span>Назначение курса сотрудникам</span>
            </h2>
            <div className="text-xs text-[#6C757D] mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#003B73] truncate">«{course.title}»</span>
              <span className="px-2 py-0.5 rounded bg-[#F4F5F7] border border-[#E0E0E0] text-[10px] font-bold text-[#212529]">
                {course.department_tag}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6C757D] hover:text-[#212529] transition-colors p-2 rounded-xl hover:bg-[#F4F5F7] shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E0E0E0] bg-[#F4F5F7] px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              activeTab === 'assign'
                ? 'border-[#003B73] text-[#003B73] bg-white rounded-t-lg'
                : 'border-transparent text-[#6C757D] hover:text-[#212529]'
            }`}
          >
            <Users className="w-4 h-4 text-[#003B73]" />
            <span>Назначить сотрудникам</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              activeTab === 'list'
                ? 'border-[#003B73] text-[#003B73] bg-white rounded-t-lg'
                : 'border-transparent text-[#6C757D] hover:text-[#212529]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#003B73]" />
            <span>Назначенные ({assignments.length})</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#E30613] text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2.5">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Assign Form */}
        {activeTab === 'assign' && (
          <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            {/* Filters & Search Grid */}
            <div className="space-y-3 shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6C757D]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Поиск по ФИО или Email..."
                    className="input-field pl-10 text-xs sm:text-sm bg-white"
                  />
                </div>

                {/* AutoMall Branch Filter */}
                <div className="w-full sm:w-52">
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="input-field text-xs sm:text-sm bg-white"
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
                    className="input-field text-xs sm:text-sm bg-white"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F4F5F7] p-3 rounded-xl border border-[#E0E0E0]">
                <div className="flex items-center gap-2 text-xs text-[#212529] flex-wrap">
                  <Calendar className="w-4 h-4 text-[#003B73] shrink-0" />
                  <span className="shrink-0 font-semibold">Срок сдачи:</span>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-white border border-[#E0E0E0] rounded-lg px-2.5 py-1 text-xs text-[#212529] focus:outline-none focus:border-[#003B73] focus:ring-1 focus:ring-[#003B73]/20"
                  />
                  {dueDate && (
                    <button
                      onClick={() => setDueDate('')}
                      className="text-[#6C757D] hover:text-[#212529] text-xs font-bold px-1"
                      title="Очистить дату"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto min-h-[38px]"
                >
                  <CheckSquare className="w-4 h-4 text-[#003B73]" />
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
            <div className="flex-1 overflow-y-auto border border-[#E0E0E0] rounded-xl bg-white divide-y divide-[#E0E0E0] min-h-[220px]">
              {loading ? (
                <div className="p-8 text-center text-[#6C757D] text-xs">Загрузка списка сотрудников...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-[#6C757D] text-xs space-y-1">
                  <div className="font-semibold text-[#212529]">Сотрудники по заданным критериям не найдены.</div>
                  <div className="text-[11px] text-[#6C757D]">Попробуйте изменить поисковый запрос или фильтр филиала.</div>
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
                          ? 'bg-[#003B73]/5 border-l-4 border-[#003B73]'
                          : 'hover:bg-[#F4F5F7]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="text-[#003B73]">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#003B73]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#6C757D]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#212529] truncate flex items-center gap-2">
                            <span>{u.full_name}</span>
                            {isAlreadyAssigned && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                                Уже назначен
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6C757D] truncate flex items-center gap-2 mt-0.5">
                            <span>{u.email}</span>
                            <span>•</span>
                            <span className="text-[#212529] font-medium">{u.branch || 'AutoMall Центральный'}</span>
                            <span>•</span>
                            <span>{u.department || 'СТО'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D] shrink-0">
                        {u.role === 'admin' ? 'Админ' : u.role === 'superadmin' ? 'Суперадмин' : 'Сотрудник'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-[#E0E0E0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-[#6C757D]">
                Выбрано сотрудников:{' '}
                <span className="font-bold text-[#003B73]">{selectedUserIds.length}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary text-xs py-2 px-4 flex-1 sm:flex-none"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={submitting || selectedUserIds.length === 0}
                  className="btn-primary text-xs py-2.5 px-5 flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? 'Назначение...' : `Назначить курс (${selectedUserIds.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Assigned Employees List */}
        {activeTab === 'list' && (
          <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            <div className="text-xs text-[#6C757D]">
              Сотрудники с активным доступом к курсу и мониторинг их прогресса:
            </div>

            <div className="flex-1 overflow-y-auto border border-[#E0E0E0] rounded-xl bg-white divide-y divide-[#E0E0E0] min-h-[260px]">
              {loading ? (
                <div className="p-8 text-center text-[#6C757D] text-xs">Загрузка назначений...</div>
              ) : assignments.length === 0 ? (
                <div className="p-12 text-center text-[#6C757D] text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-[#6C757D]" />
                  <div className="font-semibold text-[#212529]">Курс пока не назначен ни одному сотруднику.</div>
                  <button
                    onClick={() => setActiveTab('assign')}
                    className="text-[#003B73] hover:underline pt-1 text-xs font-bold"
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
                      className="p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F4F5F7] transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#212529]">{item.full_name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              isFinished
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : item.progress_percent > 0
                                ? 'bg-blue-50 border-blue-200 text-[#003B73]'
                                : 'bg-[#F4F5F7] border-[#E0E0E0] text-[#6C757D]'
                            }`}
                          >
                            {isFinished
                              ? 'Пройден'
                              : item.progress_percent > 0
                              ? 'В процессе'
                              : 'Не начат'}
                          </span>
                        </div>

                        <div className="text-[11px] text-[#6C757D] flex flex-wrap items-center gap-2">
                          <span>{item.email}</span>
                          <span>•</span>
                          <span className="text-[#212529] font-medium">{item.branch || 'AutoMall'}</span>
                          <span>•</span>
                          <span>{item.department || 'СТО'}</span>
                        </div>

                        {/* Progress Bar */}
                        <div className="pt-1 flex items-center gap-3">
                          <div className="flex-1 max-w-xs h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isFinished ? 'bg-emerald-500' : 'bg-[#E30613]'
                              }`}
                              style={{ width: `${item.progress_percent || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-[#6C757D]">
                            {item.progress_percent || 0}%
                          </span>
                        </div>
                      </div>

                      {/* Deadline & Revoke */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E0E0E0]">
                        <div className="text-right">
                          <div className="text-[10px] text-[#6C757D]">
                            Назначен: {formatDate(item.assigned_at)}
                          </div>
                          <div
                            className={`text-[11px] font-medium ${
                              isDeadlinePassed
                                ? 'text-[#E30613] font-bold'
                                : item.deadline
                                ? 'text-amber-800'
                                : 'text-[#6C757D]'
                            }`}
                          >
                            Дедлайн: {formatDate(item.deadline)}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRevoke(item.user_id)}
                          className="p-2 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-red-50 transition-colors"
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

            <div className="pt-3 border-t border-[#E0E0E0] flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs py-2 px-5 min-h-[44px]"
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
