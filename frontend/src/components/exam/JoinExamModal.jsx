import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  KeyRound,
  RefreshCw,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const JoinExamModal = ({ isOpen, onClose, initialCode = '' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pinCode, setPinCode] = useState(initialCode);
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePinChange = (e) => {
    // Only digits, maximum 6 chars
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPinCode(val);
    setError('');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanPin = pinCode.replace(/\D/g, '').trim();
    if (!cleanPin || cleanPin.length < 4) {
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

      const res = await api.post('/exam/join', {
        pin_code: cleanPin,
        guest_name: !user ? guestName.trim() : null,
      });

      const { session_id, participant } = res.data;

      // Save participant ID to sessionStorage for room recovery
      if (participant?.id) {
        sessionStorage.setItem(`exam_participant_${session_id}`, participant.id);
      }

      onClose();
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
    <div className="fixed inset-0 z-50 bg-[#141414]/65 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-[#141414] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E84C3D] flex items-center justify-center text-white shadow-md">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-base !text-white text-white leading-tight">
                Вход в очный экзамен
              </h3>
              <p className="text-[11px] text-white/70 mt-0.5">
                Синхронная аттестация по PIN-коду
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleJoin} className="p-6 sm:p-7 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#777777] mb-2 text-center">
              Введите 6-значный код экзамена:
            </label>
            <div className="flex justify-center">
              <input
                type="text"
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pinCode}
                onChange={handlePinChange}
                placeholder="000000"
                className="w-56 text-center text-3xl sm:text-4xl font-mono font-black tracking-widest py-3 px-4 rounded-2xl border-2 border-[#CED4DA] focus:border-[#E84C3D] focus:ring-4 focus:ring-[#E84C3D]/10 outline-none text-[#141414] bg-[#F5F5F7] transition-all"
              />
            </div>
            <p className="text-[11px] text-center text-[#777777] mt-2">
              Код отображается на экране инструктора в аудитории
            </p>
          </div>

          {!user && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                Ваше ФИО (для протокола) *
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="input-field text-sm w-full bg-white"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || pinCode.length < 4}
              className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 rounded-xl shadow-md min-h-[48px] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Подключение к залу...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Войти в зал ожидания</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
