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
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const TestAssignmentModal = ({ test, onClose }) => {
  const [activeTab, setActiveTab] = useState('assign'); // 'assign' | 'list'
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
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
      const [usersRes, assignRes] = await Promise.all([
        api.get('/users'),
        api.get(`/tests/${test.id}/assignments`),
      ]);
      setUsers(usersRes.data || []);
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
      u.email?.toLowerCase().includes(term)
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

  const handleAssign = async () => {
    if (selectedUserIds.length === 0) {
      setError('Пожалуйста, выберите хотя бы одного сотрудника для назначения.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      const payload = {
        user_ids: selectedUserIds,
        assign_all: false,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };

      await api.post(`/tests/${test.id}/assign`, payload);
      setSuccessMsg(`Тест успешно назначен выбранным сотрудникам (${selectedUserIds.length}).`);
      setSelectedUserIds([]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#003B73]/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E0E0E0] flex items-center justify-between bg-white">
          <div className="min-w-0 pr-3">
            <h2 className="text-base sm:text-lg font-bold text-[#212529] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#003B73] shrink-0" />
              <span>Назначение теста сотрудникам</span>
            </h2>
            <p className="text-xs text-[#003B73] font-semibold mt-0.5 truncate max-w-md">
              «{test.title}»
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] transition-colors shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#E0E0E0] bg-[#F4F5F7] px-4 sm:px-5">
          <button
            onClick={() => setActiveTab('assign')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
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
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all min-h-[44px] flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-[#003B73] text-[#003B73] bg-white rounded-t-lg'
                : 'border-transparent text-[#6C757D] hover:text-[#212529]'
            }`}
          >
            <UserCheck className="w-4 h-4 text-[#003B73]" />
            <span>Назначенные ({assignments.length})</span>
          </button>
        </div>

        {/* Notification banners */}
        {error && (
          <div className="mx-4 sm:mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[#E30613] text-xs">
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
              <div className="w-7 h-7 border-2 border-[#003B73] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'assign' ? (
            <div className="space-y-4">
              {/* Optional Deadline */}
              <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[#212529] font-semibold">
                  <Calendar className="w-4 h-4 text-[#003B73]" />
                  <span>Дедлайн сдачи (опционально):</span>
                </div>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-field text-xs sm:text-sm py-1.5 max-w-xs bg-white"
                />
              </div>

              {/* Search & Select All */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D]" />
                  <input
                    type="text"
                    placeholder="Поиск по ФИО или email..."
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
              <div className="border border-[#E0E0E0] rounded-xl overflow-hidden divide-y divide-[#E0E0E0] max-h-64 overflow-y-auto bg-white">
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#6C757D]">
                    Пользователи не найдены
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
                            ? 'bg-[#003B73]/5 border-l-4 border-[#003B73]'
                            : 'hover:bg-[#F4F5F7] text-[#212529]'
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
                            <div className="font-semibold text-[#212529] truncate">{u.full_name}</div>
                            <div className="text-[11px] text-[#6C757D] truncate">{u.email}</div>
                          </div>
                        </div>

                        {isAlreadyAssigned && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200 shrink-0 font-medium">
                            Уже назначен
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Assigned list tab */
            <div className="space-y-3">
              {assignments.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6C757D]">
                  Тест пока никому не назначен. Перейдите во вкладку «Назначить сотрудникам».
                </div>
              ) : (
                <div className="border border-[#E0E0E0] rounded-xl overflow-hidden divide-y divide-[#E0E0E0] max-h-80 overflow-y-auto bg-white">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 flex items-center justify-between text-xs gap-3 hover:bg-[#F4F5F7] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#212529] truncate">
                          {a.user_name}
                        </div>
                        <div className="text-[11px] text-[#6C757D] truncate">
                          {a.user_email} • Дедлайн: {formatDate(a.due_date)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {a.attempt_status === 'passed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Сдан ({a.score} б.)
                          </span>
                        ) : a.attempt_status === 'needs_review' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            На проверке
                          </span>
                        ) : a.attempt_status === 'failed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-[#E30613] border border-red-200">
                            Не сдан ({a.score} б.)
                          </span>
                        ) : a.attempt_status === 'in_progress' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#003B73] border border-blue-200">
                            В процессе
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F4F5F7] text-[#6C757D] border border-[#E0E0E0]">
                            Ожидает сдачи
                          </span>
                        )}

                        <button
                          onClick={() => handleRevoke(a.user_id)}
                          className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-red-50 transition-colors"
                          title="Отозвать назначение"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E0E0E0] flex items-center justify-between bg-white">
          <div className="text-xs text-[#6C757D]">
            {activeTab === 'assign' && (
              <span>
                Выбрано: <strong className="text-[#003B73] font-bold">{selectedUserIds.length}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs min-h-[44px] px-4"
            >
              Закрыть
            </button>
            {activeTab === 'assign' && (
              <button
                type="button"
                onClick={handleAssign}
                disabled={submitting || selectedUserIds.length === 0}
                className="btn-primary text-xs min-h-[44px] px-5"
              >
                {submitting ? 'Назначение...' : `Подтвердить назначение (${selectedUserIds.length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
