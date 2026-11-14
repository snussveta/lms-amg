import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  GraduationCap,
  KeyRound,
  RefreshCw,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const DirectJoinExamPage = () => {
  const { code: urlCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const codeFromQuery = searchParams.get('code') || searchParams.get('pin');
  const tokenFromQuery = searchParams.get('token');
  const initialCode = (urlCode || codeFromQuery || '').replace(/\D/g, '').slice(0, 6);

  const [pinCode, setPinCode] = useState(initialCode);
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-join if user is already logged in and PIN / token is provided
  useEffect(() => {
    if (user && (initialCode.length === 6 || tokenFromQuery)) {
      handleAutoJoin();
    }
  }, [user, initialCode, tokenFromQuery]);

  const handleAutoJoin = async () => {
    try {
      setLoading(true);
      setError('');
      const payload = tokenFromQuery
        ? { session_token: tokenFromQuery }
        : { pin_code: initialCode };

      const res = await api.post('/exam/join', payload);
      const { session_id, participant } = res.data;

      if (participant?.id) {
        sessionStorage.setItem(`exam_participant_${session_id}`, participant.id);
      }

      navigate(`/exam/room/${session_id}`);
    } catch (err) {
      console.warn('Авто-подключение не удалось, ввод вручную:', err);
      // Don't show hard error if auto-joining fails silently on fresh load, let user submit
      setError(err.response?.data?.detail || '');
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanPin = pinCode.replace(/\D/g, '').trim();

    if (!tokenFromQuery && (!cleanPin || cleanPin.length < 4)) {
      setError('Введите корректный 6-значный PIN-код экзамена.');
      return;
    }

    if (!user && !guestName.trim()) {
      setError('Пожалуйста, введите ваше ФИО для входа.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        guest_name: !user ? guestName.trim() : null,
      };

      if (tokenFromQuery) {
        payload.session_token = tokenFromQuery;
      } else {
        payload.pin_code = cleanPin;
      }

      const res = await api.post('/exam/join', payload);
      const { session_id, participant } = res.data;

      if (participant?.id) {
        sessionStorage.setItem(`exam_participant_${session_id}`, participant.id);
      }

      navigate(`/exam/room/${session_id}`);
    } catch (err) {
      console.error('Ошибка входа в экзамен:', err);
      setError(
        err.response?.data?.detail ||
          'Не удалось подключиться к экзамену. Проверьте правильность PIN-кода.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#F9F9FB]">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EEEEEE] shadow-xl overflow-hidden flex flex-col animate-fade-in">
        {/* Brand Header */}
        <div className="px-6 py-6 bg-[#141414] text-white text-center relative">
          <div className="w-12 h-12 rounded-2xl bg-[#E84C3D] mx-auto flex items-center justify-center text-white shadow-lg mb-3">
            <Zap className="w-6 h-6 fill-current" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            Вход в экзаменационный зал
          </h2>
          <p className="text-xs text-white/70 mt-1 max-w-xs mx-auto">
            Очная аттестация AMG. Введите PIN-код, полученный от экзаменатора.
          </p>
        </div>

        {/* Content Form */}
        <form onSubmit={handleJoin} className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          {/* User Status / Identity */}
          {user ? (
            <div className="p-3 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#141414] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-[#141414] truncate">
                  {user.full_name}
                </div>
                <div className="text-[11px] text-[#777777] truncate">{user.email}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white border border-[#DDDDDD] text-[#555555]">
                В сети
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#777777] mb-1.5">
                Ваше имя и фамилия *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Иван Иванов"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#D5D5D5] bg-white text-sm text-[#141414] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#E84C3D] focus:border-transparent transition-all"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-[#888888]">
                  Или авторизуйтесь для сохранения в профиль:
                </span>
                <Link
                  to="/login"
                  className="text-[11px] font-semibold text-[#E84C3D] hover:underline"
                >
                  Войти
                </Link>
              </div>
            </div>
          )}

          {/* PIN Input */}
          {!tokenFromQuery && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#777777] mb-2 text-center">
                6-значный код экзамена:
              </label>
              <div className="flex justify-center">
                <input
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => {
                    setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  placeholder="000000"
                  className="w-56 tracking-[0.4em] text-center text-3xl font-mono font-black py-3 px-4 rounded-2xl border-2 border-[#141414] focus:border-[#E84C3D] focus:ring-4 focus:ring-[#E84C3D]/10 outline-none text-[#141414] bg-[#FAFAFA] transition-all"
                />
              </div>
            </div>
          )}

          {/* Info Badge */}
          <div className="p-3 rounded-xl bg-[#F0F7FF] border border-[#D0E2FF] flex items-center gap-2.5 text-[#0066CC] text-xs">
            <Users className="w-4 h-4 shrink-0 text-[#0066CC]" />
            <span>
              После входа вы попадете в зал ожидания. Вопросы откроются автоматически, когда инструктор запустит экзамен.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (!tokenFromQuery && pinCode.length < 4)}
            className="w-full py-3.5 px-5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#E84C3D] to-[#D33829] hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-[#E84C3D]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Подключение...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Присоединиться к экзамену</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
