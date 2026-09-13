import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Check,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../../components/RoleBadge';

export const UserManagementPage = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Ошибка загрузки сотрудников:', err);
      setError('Не удалось загрузить список пользователей.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;

    try {
      setUpdatingId(targetUser.id);
      setError('');
      setSuccessMsg('');

      const res = await api.patch(`/users/${targetUser.id}/role`, {
        role: newRole,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: res.data.role } : u))
      );

      setSuccessMsg(`Роль для ${targetUser.full_name} успешно изменена на "${newRole}".`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Ошибка изменения роли:', err);
      setError(err.response?.data?.detail || 'Не удалось обновить роль пользователя.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!window.confirm(`Вы уверены, что хотите удалить сотрудника "${targetUser.full_name}"?`)) {
      return;
    }

    try {
      setUpdatingId(targetUser.id);
      await api.delete(`/users/${targetUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setSuccessMsg(`Пользователь ${targetUser.full_name} удален.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Ошибка удаления пользователя:', err);
      setError(err.response?.data?.detail || 'Не удалось удалить пользователя.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (filterRole === 'superadmin') return u.role === 'superadmin';
    if (filterRole === 'admin') return u.role === 'admin';
    if (filterRole === 'employee') return u.role === 'employee';
    return true;
  });

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-slate-400" />
            Сотрудники и права доступа
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Управление участниками организации AMG, назначение прав администраторов и аудит учетных записей.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Всего в системе: </span>
            <span className="font-bold text-white">{users.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 flex items-start gap-2.5 text-emerald-300 text-xs">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Поиск по ФИО или корпоративному email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 text-xs py-1.5"
          />
        </div>

        {/* Role filters */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {[
            { id: 'all', label: 'Все' },
            { id: 'employee', label: 'Сотрудники' },
            { id: 'admin', label: 'Администраторы' },
            { id: 'superadmin', label: 'Суперадмины' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRole(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filterRole === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-slate-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-5">Сотрудник</th>
                <th className="py-3 px-5">Email</th>
                <th className="py-3 px-5">Текущая роль</th>
                <th className="py-3 px-5">Дата регистрации</th>
                <th className="py-3 px-5">Изменить роль</th>
                {isSuperAdmin && <th className="py-3 px-5 text-right">Удаление</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const canEdit =
                  isSuperAdmin || (currentUser?.role === 'admin' && u.role !== 'superadmin');

                return (
                  <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-5">
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            Вы
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-5 text-slate-400 font-mono">
                      {u.email}
                    </td>

                    <td className="py-3 px-5">
                      <RoleBadge role={u.role} />
                    </td>

                    <td className="py-3 px-5 text-slate-400">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="py-3 px-5">
                      {canEdit ? (
                        <select
                          value={u.role}
                          disabled={updatingId === u.id}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="bg-slate-950 text-slate-200 text-xs rounded-md border border-slate-800 py-1 px-2 focus:ring-1 focus:ring-slate-400"
                        >
                          <option value="employee">Сотрудник</option>
                          <option value="admin">Администратор</option>
                          {isSuperAdmin && <option value="superadmin">Суперадмин</option>}
                        </select>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Нет прав</span>
                      )}
                    </td>

                    {isSuperAdmin && (
                      <td className="py-3 px-5 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={updatingId === u.id}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                            title="Удалить аккаунт"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
