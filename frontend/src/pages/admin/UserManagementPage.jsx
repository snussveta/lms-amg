import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Briefcase,
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
import { ConfirmModal } from '../../components/ConfirmModal';

export const UserManagementPage = () => {
  const { user: currentUser, isSuperAdmin, isAdmin, isDepartmentHead, isManager } = useAuth();
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
  const [confirmState, setConfirmState] = useState(null);

  // Register Employee Modal State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    password: '',
    department: '',
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
    department: '',
    department_id: null,
    role: 'employee',
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '', head_id: null });
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Assign Department Head Modal State
  const [headModalDept, setHeadModalDept] = useState(null);
  const [selectedHeadUserId, setSelectedHeadUserId] = useState(null);
  const [headSearchTerm, setHeadSearchTerm] = useState('');
  const [isSubmittingHead, setIsSubmittingHead] = useState(false);

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
    const initialDept = isDepartmentHead
      ? departments.find((d) => d.name === currentUser?.department || d.id === currentUser?.department_id) || null
      : (departments.length > 0 ? departments[0] : null);

    setRegisterForm({
      full_name: '',
      email: '',
      password: generateRandomPassword(),
      department: initialDept ? initialDept.name : (currentUser?.department || ''),
      department_id: initialDept ? initialDept.id : (currentUser?.department_id || null),
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
      : (targetUser.department || (departments[0]?.name || ''));
    const resolvedDeptId = matchedDept ? matchedDept.id : (departments[0]?.id || null);

    setEditForm({
      full_name: targetUser.full_name || '',
      email: targetUser.email || '',
      password: '',
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

  const requestDeleteUser = (targetUser) => {
    setConfirmState({
      title: 'Удаление сотрудника',
      message: `Вы уверены, что хотите удалить сотрудника «${targetUser.full_name}»?`,
      description: `Email: ${targetUser.email}. Доступ к платформе будет аннулирован, а история прохождения курсов и тестов удалена. Это действие необратимо.`,
      confirmText: 'Удалить сотрудника',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setUpdatingId(targetUser.id);
          await api.delete(`/users/${targetUser.id}`);
          setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
          setSuccessMsg(`Пользователь ${targetUser.full_name} успешно удален.`);
          setTimeout(() => setSuccessMsg(''), 4000);
          const dRes = await api.get('/departments');
          setDepartments(dRes.data || []);
        } catch (err) {
          console.error('Ошибка удаления пользователя:', err);
          setError(err.response?.data?.detail || 'Не удалось удалить пользователя.');
        } finally {
          setUpdatingId(null);
          setConfirmState(null);
        }
      },
    });
  };

  // Department CRUD
  const openCreateDeptModal = () => {
    setEditingDept(null);
    setDeptForm({ name: '', description: '', head_id: null });
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (dept) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      description: dept.description || '',
      head_id: dept.head_id || (dept.head ? dept.head.id : null),
    });
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
      const uRes = await api.get('/users');
      setUsers(uRes.data || []);
    } catch (err) {
      console.error('Ошибка сохранения отдела:', err);
      setError(err.response?.data?.detail || 'Не удалось сохранить отдел.');
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleAssignHead = async (deptId, userId) => {
    try {
      setIsSubmittingHead(true);
      setError('');
      const res = await api.post(`/departments/${deptId}/head`, { user_id: userId });
      setDepartments((prev) => prev.map((d) => (d.id === deptId ? res.data : d)));
      setSuccessMsg(
        userId
          ? `Руководитель отдела «${res.data.name}» успешно назначен.`
          : `Руководитель отдела «${res.data.name}» снят с должности.`
      );
      setTimeout(() => setSuccessMsg(''), 4000);
      setHeadModalDept(null);
      const uRes = await api.get('/users');
      setUsers(uRes.data || []);
    } catch (err) {
      console.error('Ошибка назначения руководителя отдела:', err);
      setError(err.response?.data?.detail || 'Не удалось назначить руководителя отдела.');
    } finally {
      setIsSubmittingHead(false);
    }
  };

  const requestDeleteDept = (dept) => {
    setConfirmState({
      title: 'Удаление отдела компании',
      message: `Вы уверены, что хотите удалить отдел «${dept.name}»?`,
      description: 'Все сотрудники этого отдела останутся в системе, но их принадлежность к отделу будет сброшена. Это действие необратимо.',
      confirmText: 'Удалить отдел',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setError('');
          await api.delete(`/departments/${dept.id}`);
          setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
          setSuccessMsg(`Отдел «${dept.name}» успешно удален.`);
          setTimeout(() => setSuccessMsg(''), 4000);
          loadAllData();
        } catch (err) {
          console.error('Ошибка удаления отдела:', err);
          setError(err.response?.data?.detail || 'Не удалось удалить отдел.');
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const requestDismissHead = (dept, headUser) => {
    if (!headUser) return;
    setConfirmState({
      title: 'Снятие руководителя отдела',
      message: `Снять ${headUser.full_name} с должности руководителя отдела «${dept.name}»?`,
      description: 'Полномочия руководителя отдела будут аннулированы, а роль сотрудника изменится на «Сотрудник».',
      confirmText: 'Снять с должности',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await handleAssignHead(dept.id, null);
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const candidateUsers = users.filter((u) => {
    if (!headModalDept) return false;
    const term = (headSearchTerm || '').toLowerCase().trim();
    if (!term) return true;
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      (u.department && u.department.toLowerCase().includes(term))
    );
  });

  const canDeleteUser = (u) => {
    if (!u || u.id === currentUser?.id) return false;
    if (isDepartmentHead) {
      return u.role === 'employee' && (
        (u.department_id && u.department_id === currentUser?.department_id) ||
        (u.department && u.department === currentUser?.department)
      );
    }
    if (isSuperAdmin) return true;
    if (currentUser?.role === 'admin') {
      return u.role === 'employee' || u.role === 'department_head';
    }
    return false;
  };

  const canEditUser = (u) => {
    if (!u) return false;
    if (isDepartmentHead) {
      return u.role === 'employee' && (
        (u.department_id && u.department_id === currentUser?.department_id) ||
        (u.department && u.department === currentUser?.department)
      );
    }
    if (isSuperAdmin) return true;
    if (currentUser?.role === 'admin') {
      return u.role !== 'superadmin';
    }
    return false;
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#141414]/10 border border-[#141414]/20 flex items-center justify-center text-[#141414]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                Управление персоналом и отделами AMG
              </h1>
              <p className="text-xs text-[#777777] mt-0.5">
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
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#EEEEEE] bg-white hover:bg-[#F5F5F7] text-[#141414] text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px] disabled:opacity-50"
              >
                <Mail className={`w-4 h-4 ${isSendingTestEmail ? 'animate-pulse text-[#E84C3D]' : 'text-[#141414]'}`} />
                <span>{isSendingTestEmail ? 'Отправка...' : 'Тест почты'}</span>
              </button>

              <button
                onClick={openRegisterModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E84C3D] hover:bg-[#D33829] text-white text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Зарегистрировать сотрудника</span>
              </button>
            </>
          ) : (
            <button
              onClick={openCreateDeptModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141414] hover:bg-[#002F5C] text-white text-xs sm:text-sm font-bold shadow-sm transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Создать отдел</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-[#E84C3D]/70 hover:text-[#E84C3D]">
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
      <div className="flex items-center gap-2 border-b border-[#EEEEEE]">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeTab === 'users'
              ? 'border-[#E84C3D] text-[#141414]'
              : 'border-transparent text-[#777777] hover:text-[#222222]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Сотрудники</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F5F5F7] text-[#777777] font-mono">
            {users.length}
          </span>
        </button>

        {!isDepartmentHead && (
          <button
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'departments'
                ? 'border-[#E84C3D] text-[#141414]'
                : 'border-transparent text-[#777777] hover:text-[#222222]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Отделы компании</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#F5F5F7] text-[#777777] font-mono">
              {departments.length}
            </span>
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: USERS */}
      {/* ============================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
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
                className="bg-white text-xs text-[#222222] font-medium rounded-xl border border-[#EEEEEE] px-3 py-2 focus:ring-2 focus:ring-[#141414]/20 focus:border-[#141414] min-h-[40px]"
              >
                <option value="all">Все отделы</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              {/* Role filter pills */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EEEEEE] shadow-2xs overflow-x-auto scrollbar-none">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'employee', label: 'Сотрудники' },
                  { id: 'department_head', label: 'Руководители' },
                  { id: 'admin', label: 'Администраторы' },
                  { id: 'superadmin', label: 'Суперадмины' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterRole(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      filterRole === tab.id
                        ? 'bg-[#141414] text-white shadow-sm'
                        : 'text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl overflow-hidden border border-[#EEEEEE] shadow-card">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#EEEEEE] bg-[#F5F5F7] text-[11px] font-bold uppercase tracking-wider text-[#777777]">
                    <th className="py-3.5 px-5">Сотрудник</th>
                    <th className="py-3.5 px-5">Логин / Email</th>
                    <th className="py-3.5 px-5">Отдел</th>
                    <th className="py-3.5 px-5">Роль</th>
                    <th className="py-3.5 px-5">Дата рег.</th>
                    <th className="py-3.5 px-5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEEEE] text-xs text-[#222222]">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-[#777777]">
                        Загрузка сотрудников...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-[#777777]">
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
                            <div className="font-bold text-[#222222] text-sm flex items-center gap-2">
                              <span>{u.full_name}</span>
                              {isSelf && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#141414]/10 text-[#141414] border border-[#141414]/20 font-semibold">
                                  Вы
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-5 font-mono text-[#777777]">
                            {u.email}
                          </td>

                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#141414]">
                              <Building2 className="w-3.5 h-3.5 text-[#141414]" />
                              {u.department || 'Без отдела'}
                            </span>
                          </td>

                          <td className="py-3.5 px-5">
                            {canEdit && !isDepartmentHead ? (
                              <select
                                value={u.role}
                                disabled={updatingId === u.id}
                                onChange={(e) => handleRoleChange(u, e.target.value)}
                                className="bg-white text-[#222222] text-xs rounded-lg border border-[#EEEEEE] py-1.5 px-2.5 focus:ring-2 focus:ring-[#141414]/20 focus:border-[#141414]"
                              >
                                <option value="employee">Сотрудник</option>
                                <option value="department_head">Руководитель отдела</option>
                                <option value="admin">Администратор</option>
                                {isSuperAdmin && <option value="superadmin">Суперадмин</option>}
                              </select>
                            ) : (
                              <RoleBadge role={u.role} />
                            )}
                          </td>

                          <td className="py-3.5 px-5 text-[#777777]">
                            {formatDate(u.created_at)}
                          </td>

                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canEditUser(u) && (
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="p-1.5 rounded-lg text-[#141414] hover:bg-[#141414]/10 transition-colors"
                                  title="Редактировать сотрудника / Сменить пароль"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}

                              {canDeleteUser(u) && (
                                <button
                                  onClick={() => requestDeleteUser(u)}
                                  disabled={updatingId === u.id}
                                  className="p-1.5 rounded-lg text-[#777777] hover:text-[#E84C3D] hover:bg-[#FCECEB] transition-colors"
                                  title="Удалить сотрудника"
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
        <div className="space-y-5">
          {/* Summary / Stats header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-[#EEEEEE] p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                Всего отделов
              </div>
              <div className="text-2xl font-black text-[#141414] mt-1">
                {departments.length}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#EEEEEE] p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                С руководителем
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {departments.filter((d) => d.head_id || d.head).length}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#EEEEEE] p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#777777] uppercase tracking-wider">
                Без руководителя
              </div>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {departments.filter((d) => !d.head_id && !d.head).length}
              </div>
            </div>
          </div>

          {departments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#EEEEEE] p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#141414]/5 text-[#141414] flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#222222]">Отделы еще не созданы</h3>
              <p className="text-xs text-[#777777] max-w-sm mx-auto mt-1 mb-4">
                Создайте структуру отделов вашей компании и назначьте руководителей для управления сотрудниками.
              </p>
              <button
                onClick={openCreateDeptModal}
                className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Создать первый отдел</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => {
                const deptEmployees = users.filter(
                  (u) => u.department_id === dept.id || u.department === dept.name
                );
                const currentHead = dept.head;

                return (
                  <div
                    key={dept.id}
                    className="bg-white rounded-2xl border border-[#EEEEEE] p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Dept Name + Actions */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#141414] text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-[#222222] truncate">
                              {dept.name}
                            </h3>
                            <span className="text-[11px] font-semibold text-[#777777]">
                              {deptEmployees.length} {deptEmployees.length === 1 ? 'сотрудник' : deptEmployees.length >= 2 && deptEmployees.length <= 4 ? 'сотрудника' : 'сотрудников'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEditDeptModal(dept)}
                            className="p-1.5 rounded-lg text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] transition-colors"
                            title="Редактировать отдел"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => requestDeleteDept(dept)}
                            className="p-1.5 rounded-lg text-[#777777] hover:text-[#E84C3D] hover:bg-[#FCECEB] transition-colors"
                            title="Удалить отдел"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-[#777777] line-clamp-2 mt-2 min-h-[32px]">
                        {dept.description || 'Корпоративное подразделение компании'}
                      </p>

                      {/* Руководитель отдела карточка */}
                      <div className="mt-4 p-3 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-[#777777] uppercase tracking-wider flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#E84C3D]" />
                            Руководитель отдела
                          </span>
                          {currentHead && isAdmin && (
                            <button
                              onClick={() => requestDismissHead(dept, currentHead)}
                              className="text-[11px] text-[#777777] hover:text-[#E84C3D] font-medium transition-colors"
                            >
                              Снять
                            </button>
                          )}
                        </div>

                        {currentHead ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[#141414] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                                {currentHead.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-[#222222] truncate">
                                  {currentHead.full_name}
                                </div>
                                <div className="text-[11px] text-[#777777] truncate">
                                  {currentHead.email}
                                </div>
                              </div>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setHeadModalDept(dept);
                                  setSelectedHeadUserId(currentHead.id);
                                  setHeadSearchTerm('');
                                }}
                                className="text-xs px-2.5 py-1 rounded-lg border border-[#333333] hover:border-[#E84C3D] hover:text-[#E84C3D] font-medium transition-all shrink-0 bg-white"
                              >
                                Сменить
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 py-0.5">
                            <span className="text-xs text-[#777777] italic">Не назначен</span>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setHeadModalDept(dept);
                                  setSelectedHeadUserId(null);
                                  setHeadSearchTerm('');
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-[#141414] hover:bg-[#E84C3D] text-white font-medium transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Назначить</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Employee preview avatars/names */}
                      <div className="mt-4 pt-3 border-t border-[#EEEEEE]">
                        <div className="text-[11px] font-semibold text-[#777777] mb-2">
                          Сотрудники отдела:
                        </div>
                        {deptEmployees.length === 0 ? (
                          <div className="text-[11px] text-[#777777] italic">
                            Пока нет прикрепленных сотрудников
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {deptEmployees.map((emp) => (
                              <span
                                key={emp.id}
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                  currentHead && currentHead.id === emp.id
                                    ? 'bg-[#141414] text-white border-[#141414]'
                                    : 'bg-[#F5F5F7] text-[#222222] border-[#EEEEEE]'
                                }`}
                              >
                                {emp.full_name}
                                {currentHead && currentHead.id === emp.id && ' (Руководитель)'}
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
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: REGISTER EMPLOYEE */}
      {/* ============================================================== */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#777777]">
                    Пароль для входа *
                  </label>
                  <button
                    type="button"
                    onClick={() => setRegisterForm({ ...registerForm, password: generateRandomPassword() })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#141414] hover:underline"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[11px] font-semibold text-[#141414] border border-[#EEEEEE] flex items-center gap-1"
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
                <p className="text-[11px] text-[#777777] mt-1">
                  Скопируйте и передайте эти данные сотруднику для входа в систему.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                    {departments.length === 0 ? (
                      <option value="">Нет созданных отделов</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))
                    )}
                    {registerForm.department &&
                      !departments.some((d) => d.name === registerForm.department) && (
                        <option value={registerForm.department}>
                          {registerForm.department}
                        </option>
                      )}
                  </select>
                </div>


              </div>

              {!isDepartmentHead && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                    Назначаемая роль
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegisterForm({ ...registerForm, role: 'employee' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        registerForm.role === 'employee'
                          ? 'bg-[#141414]/10 border-[#141414] text-[#141414] font-bold'
                          : 'border-[#EEEEEE] text-[#777777] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <div className="text-xs">Сотрудник</div>
                      <div className="text-[10px] text-[#777777] font-normal">Обучение и тесты</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegisterForm({ ...registerForm, role: 'department_head' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        registerForm.role === 'department_head'
                          ? 'bg-[#141414]/10 border-[#141414] text-[#141414] font-bold'
                          : 'border-[#EEEEEE] text-[#777777] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <div className="text-xs">Руководитель</div>
                      <div className="text-[10px] text-[#777777] font-normal">Управление отделом</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegisterForm({ ...registerForm, role: 'admin' })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        registerForm.role === 'admin'
                          ? 'bg-[#141414]/10 border-[#141414] text-[#141414] font-bold'
                          : 'border-[#EEEEEE] text-[#777777] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <div className="text-xs">Администратор</div>
                      <div className="text-[10px] text-[#777777] font-normal">Вся платформа</div>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-[#EEEEEE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#EEEEEE] text-xs font-semibold text-[#777777] hover:bg-[#F5F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2.5 rounded-xl bg-[#E84C3D] hover:bg-[#D33829] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
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
          <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#777777]">
                    Новый пароль (оставьте пустым, если не меняется)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, password: generateRandomPassword() })}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#141414] hover:underline"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[11px] font-semibold text-[#141414] border border-[#EEEEEE] flex items-center gap-1"
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
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                    {departments.length === 0 ? (
                      <option value="">Нет созданных отделов</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))
                    )}
                    {editForm.department &&
                      !departments.some((d) => d.name === editForm.department) && (
                        <option value={editForm.department}>
                          {editForm.department}
                        </option>
                      )}
                  </select>
                </div>


              </div>

              {!isDepartmentHead && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                    Роль в системе
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="input-field text-xs w-full bg-white"
                  >
                    <option value="employee">Сотрудник</option>
                    <option value="department_head">Руководитель отдела</option>
                    <option value="admin">Администратор</option>
                    {isSuperAdmin && <option value="superadmin">Суперадмин</option>}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-[#EEEEEE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-[#EEEEEE] text-xs font-semibold text-[#777777] hover:bg-[#F5F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#002F5C] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
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
          <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
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

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                  Руководитель отдела (опционально)
                </label>
                <select
                  value={deptForm.head_id || ''}
                  onChange={(e) =>
                    setDeptForm({
                      ...deptForm,
                      head_id: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="input-field text-xs w-full bg-white"
                >
                  <option value="">-- Без руководителя (назначить позже) --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email}) {u.department ? `— [${u.department}]` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#777777] mt-1">
                  Выбранный сотрудник получит роль «Руководитель отдела» и права на управление этим отделом.
                </p>
              </div>

              <div className="pt-4 border-t border-[#EEEEEE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#EEEEEE] text-xs font-semibold text-[#777777] hover:bg-[#F5F5F7] min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDept}
                  className="px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#002F5C] text-white text-xs font-bold shadow-sm transition-all min-h-[44px] flex items-center gap-2"
                >
                  {isSubmittingDept && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingDept ? 'Сохранить изменения' : 'Создать отдел'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ASSIGN / CHANGE DEPARTMENT HEAD */}
      {/* ============================================================== */}
      {headModalDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#EEEEEE] flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#E84C3D] flex items-center justify-center text-white shadow-sm">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Назначить руководителя отдела
                  </h3>
                  <p className="text-[11px] text-white/70">
                    Отдел «{headModalDept.name}»
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHeadModalDept(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Current Head Status Banner */}
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#777777]">
                    Текущий статус
                  </div>
                  <div className="text-xs font-semibold text-[#222222] mt-0.5 truncate">
                    {headModalDept.head ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        {headModalDept.head.full_name} ({headModalDept.head.email})
                      </span>
                    ) : (
                      <span className="text-[#777777] italic">Руководитель еще не назначен</span>
                    )}
                  </div>
                </div>

                {headModalDept.head && (
                  <button
                    type="button"
                    disabled={isSubmittingHead}
                    onClick={() => requestDismissHead(headModalDept, headModalDept.head)}
                    className="text-xs text-[#E84C3D] hover:underline font-bold shrink-0"
                  >
                    Снять
                  </button>
                )}
              </div>

              {/* Candidate Search & Selection */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1.5">
                  Выберите сотрудника для назначения
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type="text"
                    placeholder="Поиск по ФИО, логину или отделу..."
                    value={headSearchTerm}
                    onChange={(e) => setHeadSearchTerm(e.target.value)}
                    className="input-field pl-9 text-xs w-full"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-[#EEEEEE] rounded-xl p-2 bg-[#FAFAFA]">
                  {candidateUsers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#777777]">
                      Сотрудники не найдены
                    </div>
                  ) : (
                    candidateUsers.map((u) => {
                      const isSelected = selectedHeadUserId === u.id;
                      const isCurrentDept =
                        u.department_id === headModalDept.id ||
                        (u.department && u.department.toLowerCase() === headModalDept.name.toLowerCase());
                      const isAlreadyHead = u.role === 'department_head';

                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedHeadUserId(u.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-[#E84C3D] bg-[#FCECEB] ring-1 ring-[#E84C3D]'
                              : 'border-[#EEEEEE] bg-white hover:border-[#CCCCCC]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isSelected ? 'bg-[#E84C3D] text-white' : 'bg-[#141414] text-white'
                              }`}
                            >
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-[#222222] truncate flex items-center gap-1.5">
                                <span>{u.full_name}</span>
                                {isCurrentDept && (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                    в этом отделе
                                  </span>
                                )}
                                {isAlreadyHead && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">
                                    руководитель
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#777777] truncate">
                                {u.email} {u.department ? `• [${u.department}]` : '• [Без отдела]'}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 ml-2">
                            {isSelected ? (
                              <span className="w-5 h-5 rounded-full bg-[#E84C3D] text-white flex items-center justify-center text-xs font-bold">
                                ✓
                              </span>
                            ) : (
                              <span className="text-xs text-[#777777] hover:text-[#141414] font-medium">
                                Выбрать
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Informative Note */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-900 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Сотрудник получит роль <strong>«Руководитель отдела»</strong>, будет прикреплен к отделу <strong>«{headModalDept.name}»</strong> и сможет добавлять и удалять сотрудников своего отдела, а также назначать им курсы и тесты.
                </span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-[#F5F5F7] border-t border-[#EEEEEE] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setHeadModalDept(null)}
                className="px-4 py-2.5 rounded-xl border border-[#CCCCCC] text-xs font-semibold text-[#777777] hover:bg-white min-h-[42px]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!selectedHeadUserId || isSubmittingHead}
                onClick={() => handleAssignHead(headModalDept.id, selectedHeadUserId)}
                className="btn-primary text-xs py-2.5 px-5 flex items-center gap-1.5 min-h-[42px] disabled:opacity-50"
              >
                {isSubmittingHead && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Назначить руководителем</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={Boolean(confirmState)}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
          title={confirmState.title}
          message={confirmState.message}
          description={confirmState.description}
          confirmText={confirmState.confirmText || 'Удалить'}
          cancelText={confirmState.cancelText || 'Отмена'}
          variant={confirmState.variant || 'danger'}
        />
      )}
    </div>
  );
};
