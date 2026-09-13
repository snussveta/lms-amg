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
      setUsers(usersRes.data);
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
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAll = () => {
    const allFilteredIds = filteredUsers.map((u) => u.id);
    const allSelected = allFilteredIds.every((id) => selectedUserIds.includes(id));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel max-w-2xl w-full border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <span>Назначение теста сотрудникам</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
              {test.title}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 px-5 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('assign')}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'assign'
                ? 'border-slate-200 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Назначить сотрудникам
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-slate-200 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Назначенные сотрудники</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {assignments.length}
            </span>
          </button>
        </div>

        {/* Notification banners */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 flex items-start gap-2.5 text-emerald-300 text-xs">
            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-7 h-7 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'assign' ? (
            <div className="space-y-4">
              {/* Optional Deadline */}
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Дедлайн сдачи (опционально):</span>
                </div>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input-field text-xs py-1.5 max-w-xs"
                />
              </div>

              {/* Search & Select All */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Поиск по ФИО или email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field pl-9 text-xs py-1.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={selectAll}
                  className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
                >
                  Выбрать всех
                </button>
              </div>

              {/* Users list with checkboxes */}
              <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/80 max-h-64 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
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
                            ? 'bg-slate-800/60 text-white'
                            : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-slate-100" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                          <div>
                            <div className="font-semibold text-slate-200">{u.full_name}</div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </div>
                        </div>

                        {isAlreadyAssigned && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
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
                <div className="py-10 text-center text-xs text-slate-500">
                  Тест пока никому не назначен. Перейдите во вкладку «Назначить сотрудникам».
                </div>
              ) : (
                <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/80 max-h-80 overflow-y-auto">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 flex items-center justify-between text-xs gap-3 hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-200 truncate">
                          {a.user_name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {a.user_email} • Дедлайн: {formatDate(a.due_date)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {a.attempt_status === 'passed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-900/60">
                            Сдан ({a.score} б.)
                          </span>
                        ) : a.attempt_status === 'needs_review' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-900/60">
                            На проверке
                          </span>
                        ) : a.attempt_status === 'failed' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-900/60">
                            Не сдан ({a.score} б.)
                          </span>
                        ) : a.attempt_status === 'in_progress' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/40 text-blue-300 border border-blue-900/60">
                            В процессе
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            Ожидает сдачи
                          </span>
                        )}

                        <button
                          onClick={() => handleRevoke(a.user_id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Отозвать назначение"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeTab === 'assign' && (
              <span>
                Выбрано для назначения: <strong className="text-slate-200">{selectedUserIds.length}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Закрыть
            </button>
            {activeTab === 'assign' && (
              <button
                type="button"
                onClick={handleAssign}
                disabled={submitting || selectedUserIds.length === 0}
                className="btn-primary text-xs"
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
