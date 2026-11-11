import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  Edit2,
  Key,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from '../../components/RoleBadge';

export const UserManagementPage = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'departments'
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Register Employee Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    password: '',
    branch: 'AutoMall Центральный',
    department: 'СТО',
    department_id: null,
    role: 'employee',
  });
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Edit Employee Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    password: '',
    branch: 'AutoMall Центральный',
    department: 'СТО',
    department_id: null,
    role: 'employee',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  const handleSendTestEmail = async () => {
    try {
      setIsSendingTestEmail(true);
      setError('');
      setSuccessMsg('');
      const res = await api.post('/users/test-email');
      setSuccessMsg(res.data?.message || 'Тестовое письмо поставлено в очередь отправки. Проверьте ваш почтовый ящик.');
      setTimeout(() => setSuccessMsg(''), 8000);
    } catch (err) {
      console.error('Ошибка отправки тестового письма:', err);
      setError(err.response?.data?.detail || 'Не удалось отправить тестовое письмо. Проверьте настройки SMTP в .env на сервере.');
    } finally {
      setIsSendingTestEmail(false);
    }
  };
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usersRes, deptsRes] = await Promise.all([
        api.get('/users'),
        api.get('/departments'),
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError('Не удалось загрузить список сотрудников и отделов.');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleCopyPassword = (pwd) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Open Register Modal
  const openRegisterModal = () => {
    const initialDept = departments.length > 0 ? departments[0] : null;
    setRegisterForm({
      full_name: '',
      email: '',
      password: generateRandomPassword(),
      branch: 'AutoMall Центральный',
      department: initialDept ? initialDept.name : 'СТО',
      department_id: initialDept ? initialDept.id : null,
      role: 'employee',
    });
    setCopiedPassword(false);
    setIsRegisterModalOpen(true);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerForm.full_name.trim() || !registerForm.email.trim() || !registerForm.password.trim()) {
      setError('Пожалуйста, заполните ФИО, логин (email) и пароль сотрудника.');
      return;
    }

    try {
      setIsSubmittingUser(true);
      setError('');
      const matchedDept = departments.find(
        (d) => d.name === registerForm.department || d.id === registerForm.department_id
      );
      const payload = {
        ...registerForm,
        branch: registerForm.branch.trim(),
        department: matchedDept ? matchedDept.name : registerForm.department,
        department_id: matchedDept ? matchedDept.id : registerForm.department_id,
      };

      const res = await api.post('/users', payload);
      setUsers((prev) => [res.data, ...prev]);
      setIsRegisterModalOpen(false);
      setSuccessMsg(`Сотрудник ${res.data.full_name} успешно зарегистрирован. Логин: ${res.data.email}`);
      setTimeout(() => setSuccessMsg(''), 5000);
      // Refresh departments count
      const dRes = await api.get('/departments');
      setDepartments(dRes.data || []);
    } catch (err) {
      console.error('Ошибка регистрации сотрудника:', err);
      setError(err.response?.data?.detail || 'Не удалось зарегистрировать сотрудника.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Open Edit Employee Modal
  const openEditModal = (targetUser) => {
    setEditingUser(targetUser);
    const matchedDept = departments.find(
      (d) =>
        (targetUser.department_id && d.id === targetUser.department_id) ||
        (targetUser.department && d.name.toLowerCase() === targetUser.department.toLowerCase())
    );
    const resolvedDeptName = matchedDept
      ? matchedDept.name
      : (targetUser.department || (departments[0]?.name || 'Общий'));
    const resolvedDeptId = matchedDept ? matchedDept.id : (departments[0]?.id || null);

    setEditForm({
      full_name: targetUser.full_name || '',
      email: targetUser.email || '',
      password: '',
      branch: targetUser.branch || 'AutoMall Центральный',
      department: resolvedDeptName,
      department_id: resolvedDeptId,
      role: targetUser.role || 'employee',
    });
    setIsSubmittingEdit(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmittingEdit(true);
      setError('');
      const matchedDept = departments.find(
        (d) => d.name === editForm.department || d.id === editForm.department_id
      );
      const payload = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        branch: editForm.branch.trim(),
        department: matchedDept ? matchedDept.name : editForm.department,
        department_id: matchedDept ? matchedDept.id : editForm.department_id,
        role: editForm.role,
      };
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await api.patch(`/users/${editingUser.id}`, payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)));
      setEditingUser(null);
      setSuccessMsg(`Данные сотрудника ${res.data.full_name} успешно обновлены.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      const dRes = await api.get('/departments');
      setDepartments(dRes.data || []);
    } catch (err) {
      console.error('Ошибка обновления сотрудника:', err);
      setError(err.response?.data?.detail || 'Не удалось обновить данные сотрудника.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Direct Role Change
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
      const dRes = await api.get('/departments');
      setDepartments(dRes.data || []);
    } catch (err) {
      console.error('Ошибка удаления пользователя:', err);
      setError(err.response?.data?.detail || 'Не удалось удалить пользователя.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Department CRUD
  const openCreateDeptModal = () => {
    setEditingDept(null);
    setDeptForm({ name: '', description: '' });
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (dept) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setIsDeptModalOpen(true);
  };

  const handleDeptSubmit = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) {
      setError('Укажите название отдела');
      return;
    }

    try {
      setIsSubmittingDept(true);
      setError('');
      if (editingDept) {
        const res = await api.put(`/departments/${editingDept.id}`, deptForm);
        setDepartments((prev) =>
          prev.map((d) => (d.id === editingDept.id ? res.data : d))
        );
        setSuccessMsg(`Отдел «${res.data.name}» успешно обновлен.`);
      } else {
        const res = await api.post('/departments', deptForm);
        setDepartments((prev) => [...prev, res.data]);
        setSuccessMsg(`Отдел «${res.data.name}» успешно создан.`);
      }
      setIsDeptModalOpen(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Ошибка сохранения отдела:', err);
      setError(err.response?.data?.detail || 'Не удалось сохранить отдел.');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!window.confirm(`Вы уверены, что хотите удалить отдел «${dept.name}»? Прикрепленные сотрудники перейдут в общий отдел.`)) {
      return;
    }

    try {
      setError('');
      await api.delete(`/departments/${dept.id}`);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      setSuccessMsg(`Отдел «${dept.name}» удален.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadAllData();
    } catch (err) {
      console.error('Ошибка удаления отдела:', err);
      setError(err.response?.data?.detail || 'Не удалось удалить отдел.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term) ||
      u.branch?.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterDept !== 'all' && u.department !== filterDept) return false;
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
                Управление персоналом и отделами AMG
              </h1>
              <p className="text-xs text-[#6C757D] mt-0.5">
                Регистрация сотрудников, распределение по отделам и управление доступом
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'users' ? (
            <>
              <button
                onClick={handleSendTestEmail}
                disabled={isSendingTestEmail}
                title="Отправить тестовое письмо на почту администратора для проверки SMTP"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E0E0E0] bg-white hover:bg-[#F4F5F7] text-[#003B73] text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px] disabled:opacity-50"
              >
                <Mail className={`w-4 h-4 ${isSendingTestEmail ? 'animate-pulse text-[#E30613]' : 'text-[#003B73]'}`} />
                <span>{isSendingTestEmail ? 'Отправка...' : 'Тест почты'}</span>
              </button>

              <button
                onClick={openRegisterModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E30613] hover:bg-[#C70510] text-white text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Зарегистрировать сотрудника</span>
              </button>
            </>
          ) : (
            <button
              onClick={openCreateDeptModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#003B73] hover:bg-[#002F5C] text-white text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Создать отдел</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FBD0D3] flex items-start gap-2.5 text-[#E30613] text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-[#E30613]/70 hover:text-[#E30613]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-700 text-xs font-semibold animate-fade-in">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700/70 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E0E0E0]">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-[#E30613] text-[#003B73]'
              : 'border-transparent text-[#6C757D] hover:text-[#212529]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Сотрудники</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F4F5F7] text-[#6C757D] font-mono">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-[#E30613] text-[#003B73]'
              : 'border-transparent text-[#6C757D] hover:text-[#212529]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Отделы компании</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F4F5F7] text-[#6C757D] font-mono">
            {departments.length}
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: USERS */}
      {/* ============================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C757D]" />
              <input
                type="text"
                placeholder="Поиск по ФИО, логину, отделу или филиалу..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 text-xs sm:text-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Department filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="bg-white text-xs text-[#212529] font-medium rounded-xl border border-[#E0E0E0] px-3 py-2 focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73] min-h-[40px]"
              >
                <option value="all">Все отделы</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Role filter pills */}
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
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl overflow-hidden border border-[#E0E0E0] shadow-card">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#E0E0E0] bg-[#F4F5F7] text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">
                    <th className="py-3.5 px-5">Сотрудник</th>
                    <th className="py-3.5 px-5">Логин / Email</th>
                    <th className="py-3.5 px-5">Отдел и Филиал</th>
                    <th className="py-3.5 px-5">Роль</th>
                    <th className="py-3.5 px-5">Дата рег.</th>
                    <th className="py-3.5 px-5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E0E0] text-xs text-[#212529]">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-[#6C757D]">
                        Загрузка сотрудников...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-[#6C757D]">
                        По заданным критериям сотрудники не найдены.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      const canEdit =
                        isSuperAdmin || (currentUser?.role === 'admin' && u.role !== 'superadmin');

                      return (
                        <tr key={u.id} className="hover:bg-[#F8F9FA] transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-[#212529] text-sm flex items-center gap-2">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#003B73]/10 text-[#003B73] border border-[#003B73]/20 font-semibold">
                                  Вы
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 font-mono text-[#6C757D]">
                            {u.email}
                          </td>

                          <td className="py-3.5 px-5">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-semibold text-[#003B73]">
                                <Building2 className="w-3.5 h-3.5 text-[#003B73]" />
                                {u.department || 'СТО'}
                              </span>
                              <span className="text-[11px] text-[#6C757D]">
                                {u.branch || 'AutoMall Центральный'}
                              </span>
                            </div>
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
                              <RoleBadge role={u.role} />
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-[#6C757D]">
                            {formatDate(u.created_at)}
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="p-1.5 rounded-lg text-[#003B73] hover:bg-[#003B73]/10 transition-colors"
                                  title="Редактировать сотрудника / Сменить пароль"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              {isSuperAdmin && !isSelf && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  disabled={updatingId === u.id}
                                  className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-[#FEF2F2] transition-colors"
                                  title="Удалить аккаунт"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DEPARTMENTS */}
      {/* ============================================================== */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const deptEmployees = users.filter(
                (u) => u.department_id === dept.id || u.department === dept.name
              );

              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-2xl border border-[#E0E0E0] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#003B73]/10 border border-[#003B73]/20 flex items-center justify-center text-[#003B73]">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#212529]">
                            {dept.name}
                          </h3>
                          <span className="text-[11px] font-semibold text-[#003B73]">
                            {deptEmployees.length} {deptEmployees.length === 1 ? 'сотрудник' : deptEmployees.length >= 2 && deptEmployees.length <= 4 ? 'сотрудника' : 'сотрудников'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditDeptModal(dept)}
                          className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#003B73] hover:bg-[#F4F5F7] transition-colors"
                          title="Редактировать отдел"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDept(dept)}
                          className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-[#FEF2F2] transition-colors"
                          title="Удалить отдел"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#6C757D] line-clamp-2 mt-2 min-h-[32px]">
                      {dept.description || 'Корпоративное подразделение компании'}
                    </p>

                    {/* Employee preview avatars/names */}
                    <div className="mt-4 pt-3 border-t border-[#E0E0E0]">
                      <div className="text-[11px] font-semibold text-[#6C757D] mb-2">
                        Сотрудники отдела:
                      </div>
                      {deptEmployees.length === 0 ? (
                        <div className="text-[11px] text-[#6C757D] italic">
                          Пока нет прикрепленных сотрудников
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {deptEmployees.map((emp) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F4F5F7] text-[11px] text-[#212529] font-medium border border-[#E0E0E0]"
                            >
                              {emp.full_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: REGISTER EMPLOYEE */}
      {/* ============================================================== */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#003B73] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Зарегистрировать сотрудника</h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  ФИО сотрудника *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Иванов Иван Иванович"
                  value={registerForm.full_name}
                  onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Логин / Корпоративный Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ivanov@company.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="input-field text-sm w-full font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">
                    Пароль для входа *
                  </label>
                  <button
                    type="button"
                    onClick={() => setRegisterForm({ ...registerForm, password: generateRandomPassword() })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003B73] hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Сгенерировать
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="input-field text-sm w-full font-mono pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyPassword(registerForm.password)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#F4F5F7] hover:bg-[#E0E0E0] text-[11px] font-semibold text-[#003B73] border border-[#E0E0E0] flex items-center gap-1"
                  >
                    {copiedPassword ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Скопирован</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#6C757D] mt-1">
                  Скопируйте и передайте эти данные сотруднику для входа в систему.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                    Отдел компании
                  </label>
                  <select
                    value={registerForm.department || ''}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const d = departments.find((dept) => dept.name === selectedName);
                      setRegisterForm({
                        ...registerForm,
                        department: selectedName,
                        department_id: d ? d.id : null,
                      });
                    }}
                    className="input-field text-xs w-full bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {registerForm.department &&
                      !departments.some((d) => d.name === registerForm.department) && (
                        <option value={registerForm.department}>
                          {registerForm.department}
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                    Филиал компании
                  </label>
                  <input
                    type="text"
                    list="branch-list-reg"
                    value={registerForm.branch}
                    onChange={(e) => setRegisterForm({ ...registerForm, branch: e.target.value })}
                    placeholder="Например: AutoMall Центральный или КСМ"
                    className="input-field text-xs w-full bg-white"
                  />
                  <datalist id="branch-list-reg">
                    <option value="AutoMall Центральный" />
                    <option value="AutoMall Север" />
                    <option value="AutoMall Юг" />
                    <option value="AutoMall Восток" />
                    <option value="AutoMall Петриканы" />
                    <option value="AutoMall Рышкановка" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Назначаемая роль
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterForm({ ...registerForm, role: 'employee' })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      registerForm.role === 'employee'
                        ? 'bg-[#003B73]/10 border-[#003B73] text-[#003B73] font-bold'
                        : 'border-[#E0E0E0] text-[#6C757D] hover:bg-[#F4F5F7]'
                    }`}
                  >
                    <div className="text-xs">Сотрудник</div>
                    <div className="text-[10px] text-[#6C757D] font-normal">Курсы и тесты</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegisterForm({ ...registerForm, role: 'admin' })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      registerForm.role === 'admin'
                        ? 'bg-[#003B73]/10 border-[#003B73] text-[#003B73] font-bold'
                        : 'border-[#E0E0E0] text-[#6C757D] hover:bg-[#F4F5F7]'
                    }`}
                  >
                    <div className="text-xs">Администратор</div>
                    <div className="text-[10px] text-[#6C757D] font-normal">Управление платформой</div>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E0E0E0] text-xs font-semibold text-[#6C757D] hover:bg-[#F4F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2.5 rounded-xl bg-[#E30613] hover:bg-[#C70510] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
                >
                  {isSubmittingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Создать аккаунт</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: EDIT EMPLOYEE & RESET PASSWORD */}
      {/* ============================================================== */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#003B73] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">Редактирование сотрудника</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  ФИО сотрудника *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Логин / Email *
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input-field text-sm w-full font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">
                    Новый пароль (оставьте пустым, если не меняется)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, password: generateRandomPassword() })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#003B73] hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Сгенерировать
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Введите новый пароль для сброса"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="input-field text-sm w-full font-mono pr-20"
                  />
                  {editForm.password && (
                    <button
                      type="button"
                      onClick={() => handleCopyPassword(editForm.password)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#F4F5F7] hover:bg-[#E0E0E0] text-[11px] font-semibold text-[#003B73] border border-[#E0E0E0] flex items-center gap-1"
                    >
                      {copiedPassword ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Скопирован</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                    Отдел компании
                  </label>
                  <select
                    value={editForm.department || ''}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      const d = departments.find((dept) => dept.name === selectedName);
                      setEditForm({
                        ...editForm,
                        department: selectedName,
                        department_id: d ? d.id : null,
                      });
                    }}
                    className="input-field text-xs w-full bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {editForm.department &&
                      !departments.some((d) => d.name === editForm.department) && (
                        <option value={editForm.department}>
                          {editForm.department}
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                    Филиал компании
                  </label>
                  <input
                    type="text"
                    list="branch-list-edit"
                    value={editForm.branch}
                    onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                    placeholder="Например: AutoMall Центральный или КСМ"
                    className="input-field text-xs w-full bg-white"
                  />
                  <datalist id="branch-list-edit">
                    <option value="AutoMall Центральный" />
                    <option value="AutoMall Север" />
                    <option value="AutoMall Юг" />
                    <option value="AutoMall Восток" />
                    <option value="AutoMall Петриканы" />
                    <option value="AutoMall Рышкановка" />
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Роль в системе
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="input-field text-xs w-full bg-white"
                >
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Администратор</option>
                  {isSuperAdmin && <option value="superadmin">Суперадмин</option>}
                </select>
              </div>

              <div className="pt-4 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#E0E0E0] text-xs font-semibold text-[#6C757D] hover:bg-[#F4F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#003B73] hover:bg-[#002F5C] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
                >
                  {isSubmittingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Сохранить изменения</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CREATE / EDIT DEPARTMENT */}
      {/* ============================================================== */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#003B73] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-white" />
                <h3 className="font-bold text-base">
                  {editingDept ? 'Редактировать отдел' : 'Создать новый отдел'}
                </h3>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeptSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Название отдела *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: СТО, Отдел логистики, Бухгалтерия..."
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="input-field text-sm w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6C757D] mb-1">
                  Описание деятельности отдела
                </label>
                <textarea
                  rows="3"
                  placeholder="Краткое описание функций и задач подразделения..."
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="input-field text-xs w-full resize-none"
                />
              </div>

              <div className="pt-4 border-t border-[#E0E0E0] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E0E0E0] text-xs font-semibold text-[#6C757D] hover:bg-[#F4F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDept}
                  className="px-5 py-2.5 rounded-xl bg-[#003B73] hover:bg-[#002F5C] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
                >
                  {isSubmittingDept && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingDept ? 'Сохранить изменения' : 'Создать отдел'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
