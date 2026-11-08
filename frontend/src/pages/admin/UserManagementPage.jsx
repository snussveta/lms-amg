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
      setUsers(res.data || []);
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
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ru-RU', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003B73]/10 border border-[#003B73]/20 flex items-center justify-center text-[#003B73]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#212529] tracking-tight">
                Сотрудники и права доступа AMG
              </h1>
              <p className="text-xs text-[#6C757D] mt-0.5">
                Управление участниками организации, назначение ролей и аудит учетных записей
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E0E0E0] text-xs shadow-2xs">
            <span className="text-[#6C757D]">Всего сотрудников: </span>
            <span className="font-bold text-[#003B73]">{users.length}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FBD0D3] flex items-start gap-2.5 text-[#E30613] text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-700 text-xs font-semibold">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C757D]" />
          <input
            type="text"
            placeholder="Поиск по ФИО или корпоративному email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 text-xs sm:text-sm"
          />
        </div>

        {/* Role filters */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E0E0E0] shadow-2xs overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'Все' },
            { id: 'employee', label: 'Сотрудники' },
            { id: 'admin', label: 'Администраторы' },
            { id: 'superadmin', label: 'Суперадмины' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRole(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                filterRole === tab.id
                  ? 'bg-[#003B73] text-white shadow-sm'
                  : 'text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl overflow-hidden border border-[#E0E0E0] shadow-card">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-[#E0E0E0] bg-[#F4F5F7] text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">
                <th className="py-3.5 px-5">Сотрудник</th>
                <th className="py-3.5 px-5">Email</th>
                <th className="py-3.5 px-5">Текущая роль</th>
                <th className="py-3.5 px-5">Дата регистрации</th>
                <th className="py-3.5 px-5">Изменить роль</th>
                {isSuperAdmin && <th className="py-3.5 px-5 text-right">Удаление</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0] text-xs text-[#212529]">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const canEdit =
                  isSuperAdmin || (currentUser?.role === 'admin' && u.role !== 'superadmin');

                return (
                  <tr key={u.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#212529] text-sm flex items-center gap-2">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F4F5F7] text-[#6C757D] border border-[#E0E0E0] font-semibold">
                            Вы
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-[#6C757D] font-mono">
                      {u.email}
                    </td>

                    <td className="py-3.5 px-5">
                      <RoleBadge role={u.role} />
                    </td>

                    <td className="py-3.5 px-5 text-[#6C757D]">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="py-3.5 px-5">
                      {canEdit ? (
                        <select
                          value={u.role}
                          disabled={updatingId === u.id}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className="bg-white text-[#212529] text-xs rounded-lg border border-[#E0E0E0] py-1.5 px-2.5 focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73]"
                        >
                          <option value="employee">Сотрудник</option>
                          <option value="admin">Администратор</option>
                          {isSuperAdmin && <option value="superadmin">Суперадмин</option>}
                        </select>
                      ) : (
                        <span className="text-[#6C757D] text-xs italic">Нет прав</span>
                      )}
                    </td>

                    {isSuperAdmin && (
                      <td className="py-3.5 px-5 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={updatingId === u.id}
                            className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-[#FEF2F2] transition-colors"
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
