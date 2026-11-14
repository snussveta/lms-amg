import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Clock,
  Percent,
  Play,
  RefreshCw,
  Shuffle,
  Users,
  X,
  Zap,
} from 'lucide-react';
import api from '../../api/client';

export const CreateExamSessionModal = ({ test, isOpen, onClose }) => {
  const navigate = useNavigate();

  const [title, setTitle] = useState(test ? `Экзамен: ${test.title}` : '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(test?.time_limit_minutes || 30);
  const [passingScore, setPassingScore] = useState(test?.passing_score || 70);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !test) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название экзаменационной сессии.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await api.post('/exam/sessions', {
        test_id: test.id,
        title: title.trim(),
        time_limit_minutes: parseInt(timeLimitMinutes, 10) || 30,
        passing_score: parseInt(passingScore, 10) || 70,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
      });

      onClose();
      navigate(`/admin/exam/${res.data.id}`);
    } catch (err) {
      console.error('Ошибка создания экзамена:', err);
      setError(err.response?.data?.detail || 'Не удалось создать сессию экзамена.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#141414]/65 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-[#EEEEEE] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-[#141414] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E84C3D] flex items-center justify-center text-white shadow-md">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-base !text-white text-white leading-tight">
                Запуск синхронного экзамена
              </h3>
              <p className="text-[11px] text-white/70 mt-0.5">
                Очная аттестация группы с общим стартом
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
        <form onSubmit={handleCreate} className="p-6 sm:p-7 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-2.5 text-[#E84C3D] text-xs animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
              Название сессии *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Аттестация отдела СТО — Ноябрь 2026"
              className="input-field text-sm w-full bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                Время на экзамен (мин)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  className="input-field pl-10 text-sm w-full bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#777777] mb-1">
                Проходной балл (%)
              </label>
              <div className="relative">
                <Percent className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(e.target.value)}
                  className="input-field pl-10 text-sm w-full bg-white"
                />
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-2.5 text-xs">
            <span className="font-bold text-[#222222] block">Защита от списывания:</span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-4 h-4"
              />
              <span className="text-[#495057]">Случайный порядок вопросов у каждого сотрудника</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-4 h-4"
              />
              <span className="text-[#495057]">Перемешивать варианты ответов внутри вопросов</span>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#EEEEEE]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#CCCCCC] text-xs font-semibold text-[#777777] hover:bg-[#F5F5F7] min-h-[42px]"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2 font-bold min-h-[42px] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Создание зала...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Открыть зал ожидания</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
