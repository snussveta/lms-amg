import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Clock,
  Search,
  Square,
  Trash2,
  User,
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
  const [targetMode, setTargetMode] = useState('users'); // 'users' | 'department'
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('Все отделы');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (course?.id) {
      loadData();
    }
  }, [course?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, deptsRes, assignRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get(`/courses/${course.id}/assigned-users`),
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setAssignments(assignRes.data.assigned_users || []);
    } catch (err) {
      console.error('Ошибка загрузки данных назначения курса:', err);
      setError('Не удалось загрузить сотрудников и текущие назначения.');
    } finally {
      setLoading(false);
    }
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));

  // Filter employees by search term and department
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term);

    const userDept = u.department || 'СТО';
    const matchesDept =
      selectedDept === 'Все отделы' || userDept === selectedDept;

    return matchesSearch && matchesDept;
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

  const toggleSelectDept = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const selectAllDepts = () => {
    const allIds = departments.map((d) => d.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedDeptIds.includes(id));
    if (allSelected) {
      setSelectedDeptIds([]);
    } else {
      setSelectedDeptIds(allIds);
    }
  };

  const handleAssign = async () => {
    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      if (targetMode === 'department') {
        if (selectedDeptIds.length === 0) {
          setError('Пожалуйста, выберите хотя бы один отдел для назначения.');
          setSubmitting(false);
          return;
        }

        const payload = {
          department_ids: selectedDeptIds,
          deadline: dueDate ? new Date(dueDate).toISOString() : null,
        };

        const res = await api.post(`/courses/${course.id}/assign`, payload);
        setSuccessMsg(`Курс успешно назначен сотрудникам выбранных отделов (назначено: ${res.data.assigned_count}).`);
        setSelectedDeptIds([]);
      } else {
        if (selectedUserIds.length === 0) {
          setError('Пожалуйста, выберите хотя бы одного сотрудника для назначения курса.');
          setSubmitting(false);
          return;
        }

        const payload = {
          user_ids: selectedUserIds,
          deadline: dueDate ? new Date(dueDate).toISOString() : null,
        };

        const res = await api.post(`/courses/${course.id}/assign`, payload);
        setSuccessMsg(`Курс успешно назначен выбранным сотрудникам (${res.data.assigned_count}).`);
        setSelectedUserIds([]);
      }

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

  // Calculate approximate employees in selected depts
  const deptEmployeesCount = departments
    .filter((d) => selectedDeptIds.includes(d.id))
    .reduce((sum, d) => sum + (d.users_count || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#141414]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EEEEEE] flex items-center justify-between bg-white">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold text-[#222222] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#141414] shrink-0" />
              <span>Назначение курса</span>
            </h2>
            <div className="text-xs text-[#777777] mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#141414] truncate">«{course.title}»</span>
              <span className="px-2 py-0.5 rounded bg-[#F5F5F7] border border-[#EEEEEE] text-[10px] font-bold text-[#222222]">
                {course.department_tag}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#777777] hover:text-[#222222] transition-colors p-2 rounded-xl hover:bg-[#F5F5F7] shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#EEEEEE] bg-[#F5F5F7] px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              activeTab === 'assign'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <Users className="w-4 h-4 text-[#141414]" />
            <span>Назначить</span>
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 min-h-[44px] ${
              activeTab === 'list'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#141414]" />
            <span>Назначенные ({assignments.length})</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#E84C3D] text-xs flex items-center gap-2.5">
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
            {/* Target mode toggle: [По сотрудникам] | [Целому отделу] */}
            <div className="flex items-center gap-2 bg-[#F5F5F7] p-1 rounded-xl border border-[#EEEEEE] shrink-0">
              <button
                type="button"
                onClick={() => setTargetMode('users')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
                  targetMode === 'users'
                    ? 'bg-[#141414] text-white shadow-xs'
                    : 'text-[#777777] hover:text-[#222222]'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>По сотрудникам</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('department')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[40px] ${
                  targetMode === 'department'
                    ? 'bg-[#141414] text-white shadow-xs'
                    : 'text-[#777777] hover:text-[#222222]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Целому отделу</span>
              </button>
            </div>

            {/* Deadline Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F5F5F7] p-3 rounded-xl border border-[#EEEEEE] shrink-0">
              <div className="flex items-center gap-2 text-xs text-[#222222] flex-wrap">
                <Calendar className="w-4 h-4 text-[#141414] shrink-0" />
                <span className="shrink-0 font-semibold">Срок сдачи курса:</span>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white border border-[#EEEEEE] rounded-lg px-2.5 py-1 text-xs text-[#222222] focus:outline-none focus:border-[#141414] focus:ring-1 focus:ring-[#141414]/20"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="text-[11px] text-[#777777] hover:text-[#E84C3D] underline ml-1"
                  >
                    Сбросить срок
                  </button>
                )}
              </div>
            </div>

            {/* MODE A: BY DEPARTMENT */}
            {targetMode === 'department' ? (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#777777]">
                    Выберите отделы компании для массового назначения:
                  </span>
                  <button
                    type="button"
                    onClick={selectAllDepts}
                    className="text-xs font-bold text-[#141414] hover:underline"
                  >
                    {departments.length > 0 && selectedDeptIds.length === departments.length
                      ? 'Снять выбор'
                      : 'Выбрать все отделы'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto flex-1 p-1">
                  {departments.map((d) => {
                    const isSelected = selectedDeptIds.includes(d.id);
                    return (
                      <div
                        key={d.id}
                        onClick={() => toggleSelectDept(d.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-[#141414]/5 border-[#141414] text-[#222222]'
                            : 'bg-white border-[#EEEEEE] hover:bg-[#F5F5F7] text-[#222222]'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#141414]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#777777]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs truncate">{d.name}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-[#EEEEEE] text-[#141414] font-semibold">
                              {d.users_count || 0} сотр.
                            </span>
                          </div>
                          {d.description && (
                            <p className="text-[11px] text-[#777777] truncate mt-0.5">
                              {d.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dept Selection Summary */}
                <div className="pt-3 border-t border-[#EEEEEE] flex items-center justify-between text-xs shrink-0">
                  <span className="text-[#777777]">
                    Выбрано отделов:{' '}
                    <strong className="text-[#222222]">{selectedDeptIds.length}</strong> (~{deptEmployeesCount} сотрудников)
                  </span>
                  <button
                    onClick={handleAssign}
                    disabled={submitting || selectedDeptIds.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#002F5C] text-white text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] flex items-center gap-2"
                  >
                    {submitting ? 'Назначение...' : `Назначить ${selectedDeptIds.length} отдел(ам)`}
                  </button>
                </div>
              </div>
            ) : (
              /* MODE B: BY INDIVIDUAL USERS */
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#777777]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Поиск по ФИО или Email..."
                      className="input-field pl-9 text-xs bg-white w-full"
                    />
                  </div>

                  <div className="w-full sm:w-48">
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="input-field text-xs bg-white w-full"
                    >
                      <option value="Все отделы">Все отделы</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[#777777] shrink-0">
                  <span>
                    Найдено: <strong className="text-[#222222]">{filteredUsers.length}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="font-bold text-[#141414] hover:underline"
                  >
                    {filteredUsers.length > 0 &&
                    filteredUsers.every((u) => selectedUserIds.includes(u.id))
                      ? 'Снять выбор со всех'
                      : 'Выбрать всех отфильтрованных'}
                  </button>
                </div>

                {/* Users List with Checkboxes */}
                <div className="border border-[#EEEEEE] rounded-xl overflow-hidden divide-y divide-[#EEEEEE] flex-1 overflow-y-auto bg-white min-h-[160px]">
                  {loading ? (
                    <div className="p-8 text-center text-xs text-[#777777]">
                      Загрузка сотрудников...
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#777777]">
                      Сотрудники не найдены
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      const isAlreadyAssigned = assignedUserIds.has(u.id);

                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleSelectUser(u.id)}
                          className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#141414]/5'
                              : 'hover:bg-[#F5F5F7]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#141414] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-[#777777] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-[#222222] truncate flex items-center gap-2">
                                <span>{u.full_name}</span>
                                {isAlreadyAssigned && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                    Уже назначен
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-0.5">
                                <span>{u.email}</span>
                                <span>•</span>
                                <span>{u.department || 'СТО'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Users Selection Summary */}
                <div className="pt-3 border-t border-[#EEEEEE] flex items-center justify-between text-xs shrink-0">
                  <span className="text-[#777777]">
                    Выбрано сотрудников:{' '}
                    <strong className="text-[#222222]">{selectedUserIds.length}</strong>
                  </span>
                  <button
                    onClick={handleAssign}
                    disabled={submitting || selectedUserIds.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#002F5C] text-white text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] flex items-center gap-2"
                  >
                    {submitting ? 'Назначение...' : `Назначить курс (${selectedUserIds.length})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Assigned List */}
        {activeTab === 'list' && (
          <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border border-[#EEEEEE] rounded-xl overflow-hidden divide-y divide-[#EEEEEE] flex-1 overflow-y-auto bg-white">
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#777777]">
                  На данный момент курс еще никому не назначен.
                </div>
              ) : (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-[#F8F9FA] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[#222222] text-sm">
                        {a.full_name}
                      </div>
                      <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>{a.email}</span>
                        <span>•</span>
                        <span className="text-[#141414] font-semibold">{a.department || 'СТО'}</span>
                        <span>•</span>
                        <span>Дедлайн: {formatDate(a.deadline)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#141414]">
                          {a.progress_percent}%
                        </div>
                        <div className="text-[10px] text-[#777777]">
                          {a.status === 'completed'
                            ? 'Пройден'
                            : a.status === 'in_progress'
                            ? 'В процессе'
                            : 'Не начат'}
                        </div>
                      </div>

                      <button
                        onClick={() => handleRevoke(a.user_id)}
                        className="p-2 rounded-lg text-[#777777] hover:text-[#E84C3D] hover:bg-red-50 transition-colors"
                        title="Отозвать назначение"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
