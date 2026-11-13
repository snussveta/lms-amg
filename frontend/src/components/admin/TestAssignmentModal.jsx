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
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const TestAssignmentModal = ({ test, onClose }) => {
  const [activeTab, setActiveTab] = useState('assign'); // 'assign' | 'list'
  const [targetMode, setTargetMode] = useState('users'); // 'users' | 'department'
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadData();
  }, [test.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, deptsRes, assignRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
        api.get(`/tests/${test.id}/assignments`),
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setAssignments(assignRes.data.assignments || []);
    } catch (err) {
      console.error('Ошибка загрузки данных назначения:', err);
      setError('Не удалось загрузить список пользователей и назначений.');
    } finally {
      setLoading(false);
    }
  };

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));

  // Фильтрация пользователей по поиску
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term)
    );
  });

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
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
          setError('Пожалуйста, выберите хотя бы один отдел для назначения теста.');
          setSubmitting(false);
          return;
        }

        const payload = {
          department_ids: selectedDeptIds,
          assign_all: false,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        };

        const res = await api.post(`/tests/${test.id}/assign`, payload);
        setSuccessMsg(res.data.message || 'Тест успешно назначен выбранным отделам.');
        setSelectedDeptIds([]);
      } else {
        if (selectedUserIds.length === 0) {
          setError('Пожалуйста, выберите хотя бы одного сотрудника для назначения.');
          setSubmitting(false);
          return;
        }

        const payload = {
          user_ids: selectedUserIds,
          assign_all: false,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        };

        const res = await api.post(`/tests/${test.id}/assign`, payload);
        setSuccessMsg(res.data.message || 'Тест успешно назначен сотрудникам.');
        setSelectedUserIds([]);
      }

      setDueDate('');

      // Перезагружаем список
      const assignRes = await api.get(`/tests/${test.id}/assignments`);
      setAssignments(assignRes.data.assignments || []);

      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab('list');
      }, 1200);
    } catch (err) {
      console.error('Ошибка назначения теста:', err);
      setError(getErrorMessage(err, 'Не удалось сохранить назначения.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Отозвать назначение у данного сотрудника?')) return;

    try {
      await api.delete(`/tests/${test.id}/assignments/${userId}`);
      setAssignments((prev) => prev.filter((a) => a.user_id !== userId));
    } catch (err) {
      console.error('Ошибка отзыва назначения:', err);
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

  const deptEmployeesCount = departments
    .filter((d) => selectedDeptIds.includes(d.id))
    .reduce((sum, d) => sum + (d.users_count || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#141414]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EEEEEE] flex items-center justify-between bg-white">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold text-[#222222] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#141414] shrink-0" />
              <span>Назначение теста</span>
            </h2>
            <p className="text-xs text-[#141414] font-semibold mt-0.5 truncate max-w-md">
              «{test.title}»
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] transition-colors shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#EEEEEE] bg-[#F5F5F7] px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
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
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-[#141414] text-[#141414] bg-white rounded-t-lg'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#141414]" />
            <span>Назначенные ({assignments.length})</span>
          </button>
        </div>

        {/* Notification banners */}
        {error && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[#E84C3D] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-700 text-xs">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-7 h-7 border-2 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'assign' ? (
            <div className="space-y-4">
              {/* Target mode toggle: [По сотрудникам] | [Целому отделу] */}
              <div className="flex items-center gap-2 bg-[#F5F5F7] p-1 rounded-xl border border-[#EEEEEE]">
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

              {/* Optional Deadline */}
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#222222] font-semibold">
                  <Calendar className="w-4 h-4 text-[#141414]" />
                  <span>Дедлайн сдачи (опционально):</span>
                </div>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-field text-xs sm:text-sm py-1.5 max-w-xs bg-white"
                />
              </div>

              {/* MODE A: BY DEPARTMENT */}
              {targetMode === 'department' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#777777]">
                      Выберите отделы для назначения теста:
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
                    {departments.map((d) => {
                      const isSelected = selectedDeptIds.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          onClick={() => toggleSelectDept(d.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
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
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#EEEEEE] text-[#141414] font-semibold">
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

                  {/* Summary & Assign Button */}
                  <div className="pt-3 border-t border-[#EEEEEE] flex items-center justify-between text-xs">
                    <span className="text-[#777777]">
                      Выбрано отделов:{' '}
                      <strong className="text-[#222222]">{selectedDeptIds.length}</strong> (~{deptEmployeesCount} сотр.)
                    </span>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={submitting || selectedDeptIds.length === 0}
                      className="btn-primary text-xs py-2 px-5 min-h-[44px]"
                    >
                      {submitting ? 'Назначение...' : `Назначить ${selectedDeptIds.length} отдел(ам)`}
                    </button>
                  </div>
                </div>
              ) : (
                /* MODE B: BY INDIVIDUAL USERS */
                <div className="space-y-4">
                  {/* Search & Select All */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                      <input
                        type="text"
                        placeholder="Поиск по ФИО, логину или отделу..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field pl-9 text-xs sm:text-sm py-2 bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={selectAll}
                      className="btn-secondary text-xs py-2 px-3 whitespace-nowrap min-h-[44px]"
                    >
                      Выбрать всех
                    </button>
                  </div>

                  {/* Users list with checkboxes */}
                  <div className="border border-[#EEEEEE] rounded-xl overflow-hidden divide-y divide-[#EEEEEE] max-h-64 overflow-y-auto bg-white">
                    {filteredUsers.length === 0 ? (
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
                              isSelected ? 'bg-[#141414]/5' : 'hover:bg-[#F5F5F7]'
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

                  {/* Action button */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-[#777777]">
                      Выбрано: <strong className="text-[#222222]">{selectedUserIds.length}</strong> сотр.
                    </span>
                    <button
                      type="button"
                      onClick={handleAssign}
                      disabled={submitting || selectedUserIds.length === 0}
                      className="btn-primary text-xs py-2 px-5 min-h-[44px]"
                    >
                      {submitting ? 'Назначение...' : `Назначить выбранным (${selectedUserIds.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: LIST */
            <div className="border border-[#EEEEEE] rounded-xl overflow-hidden divide-y divide-[#EEEEEE] max-h-80 overflow-y-auto bg-white">
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#777777]">
                  На данный момент тест еще никому не назначен.
                </div>
              ) : (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 flex items-center justify-between text-xs hover:bg-[#F8F9FA] transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-bold text-[#222222] text-sm">
                        {a.user_name}
                      </div>
                      <div className="text-[11px] text-[#777777] flex items-center gap-2 mt-0.5">
                        <span>{a.user_email}</span>
                        <span>•</span>
                        <span>Дедлайн: {formatDate(a.due_date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : a.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-[#F5F5F7] text-[#777777]'
                        }`}
                      >
                        {a.status === 'completed'
                          ? 'Сдан'
                          : a.status === 'in_progress'
                          ? 'Проходит'
                          : 'Ожидает'}
                      </span>

                      <button
                        onClick={() => handleRevoke(a.user_id)}
                        className="p-1.5 rounded-lg text-[#777777] hover:text-[#E84C3D] hover:bg-red-50 transition-colors"
                        title="Отозвать назначение"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
