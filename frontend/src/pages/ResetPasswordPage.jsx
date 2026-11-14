import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { setAuthData } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    !token ? 'В ссылке отсутствует защитный ключ токена. Пожалуйста, проверьте ссылку из письма.' : ''
  );
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('В ссылке отсутствует защитный ключ токена.');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают. Пожалуйста, проверьте правильность ввода.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await api.post('/auth/reset-password', {
        token,
        new_password: password,
      });

      setSuccess(true);
      if (res.data?.access_token && res.data?.user) {
        setAuthData(res.data.access_token, res.data.user);
      }

      setTimeout(() => {
        if (res.data?.user?.role === 'admin' || res.data?.user?.role === 'superadmin') {
          navigate('/admin');
        } else {
          navigate('/courses');
        }
      }, 1500);
    } catch (err) {
      console.error('Ошибка установки пароля:', err);
      setError(
        err.response?.data?.detail ||
          'Не удалось установить новый пароль. Возможно, ссылка устарела или уже была использована.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#141414] text-white shadow-md relative">
            <KeyRound className="w-7 h-7 text-[#E84C3D]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#E84C3D] absolute -top-0.5 -right-0.5 ring-2 ring-white" />
          </div>
          <h1 className="text-2xl font-black text-[#222222] tracking-tight">
            Установка нового пароля
          </h1>
          <p className="text-xs sm:text-sm text-[#777777]">
            Задайте постоянный пароль для входа в обучающий центр AutoMall
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-xl p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2 animate-fade-in">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-emerald-900">
                Пароль успешно установлен!
              </div>
              <p className="text-xs text-emerald-700">
                Выполняется вход в личный кабинет...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                  Новый пароль *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    disabled={!token || loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="input-field pl-10 pr-10 text-xs sm:text-sm w-full bg-white disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#222222]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                  Повторите новый пароль *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    disabled={!token || loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите введенный пароль"
                    className="input-field pl-10 pr-10 text-xs sm:text-sm w-full bg-white disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#222222]"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!token || loading}
                  className="btn-primary w-full text-xs sm:text-sm py-3 flex items-center justify-center gap-2 font-bold min-h-[46px] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Сохранение пароля...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Сохранить пароль и войти</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 border-t border-[#EEEEEE] text-center">
            <Link
              to="/login"
              className="text-xs text-[#777777] hover:text-[#E84C3D] font-medium transition-colors"
            >
              Вернуться на страницу входа
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
