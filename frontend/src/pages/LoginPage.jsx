import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(email, password);
      if (
        location.state?.from?.pathname &&
        location.state.from.pathname !== '/' &&
        location.state.from.pathname !== '/login'
      ) {
        navigate(location.state.from.pathname, { replace: true });
      } else if (userData.role === 'admin' || userData.role === 'superadmin') {
        navigate('/admin/tests', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Неверный email или пароль. Повторите попытку.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="AutoMall Group"
              className="h-10 sm:h-12 w-auto max-w-[260px] object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#212529]">
            Вход в систему
          </h1>
          <p className="text-[#6C757D] text-xs sm:text-sm mt-1.5 max-w-sm mx-auto">
            Корпоративный портал обучения и аттестации сотрудников
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E0E0E0] shadow-card">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FBD0D3] flex items-start gap-2.5 text-[#E30613] text-xs sm:text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6C757D] mb-1.5">
                Корпоративный Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C757D]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6C757D]">
                  Пароль
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C757D]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-3 font-semibold flex items-center justify-center gap-2 text-sm shadow-md"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Войти в систему</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs sm:text-sm text-[#6C757D] mt-6">
          Нет учетной записи?{' '}
          <Link
            to="/register"
            className="text-[#003B73] hover:text-[#E30613] font-semibold underline underline-offset-4 transition-colors"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
};
