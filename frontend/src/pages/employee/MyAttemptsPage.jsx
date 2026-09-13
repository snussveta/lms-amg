import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileQuestion,
  History,
  XCircle,
  Play,
} from 'lucide-react';
import api from '../../api/client';

export const MyAttemptsPage = () => {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttempts();
  }, []);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/attempts/my');
      setAttempts(res.data);
    } catch (err) {
      console.error('Ошибка загрузки истории попыток:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <History className="w-6 h-6 text-slate-400" />
            История моих тестирований
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Просмотр всех пройденных тестов платформы AMG, набранных баллов и статусов проверки.
          </p>
        </div>

        <Link to="/" className="btn-primary text-sm self-start sm:self-auto">
          Каталог тестов
        </Link>
      </div>

      {/* Список попыток */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse bg-slate-900 border border-slate-800" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto my-8">
          <FileQuestion className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">Попыток не найдено</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Вы пока еще не проходили ни одного теста в корпоративной системе.
          </p>
          <Link to="/" className="btn-primary text-sm">
            Выбрать первый тест
          </Link>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">Название теста</th>
                  <th className="py-3.5 px-5">Статус</th>
                  <th className="py-3.5 px-5">Баллы</th>
                  <th className="py-3.5 px-5">Результат</th>
                  <th className="py-3.5 px-5">Дата завершения</th>
                  <th className="py-3.5 px-5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-sm text-slate-300">
                {attempts.map((att) => {
                  const isNeedsReview = att.status === 'needs_review';
                  const isPassed = att.is_passed && !isNeedsReview;
                  const isInProgress = att.status === 'in_progress';
                  const isCompleted = att.status === 'submitted' || isNeedsReview;

                  return (
                    <tr key={att.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-4 px-5 font-medium text-white">
                        {att.test_title}
                      </td>

                      <td className="py-4 px-5">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" />
                            На проверке
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Сдан
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            В процессе
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3.5 h-3.5" />
                            Не сдан
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 font-mono text-xs">
                        <span className="font-semibold text-white text-sm">{att.score}</span> / {att.max_score} б.
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`font-semibold ${
                            isNeedsReview
                              ? 'text-amber-400'
                              : isPassed
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {att.percentage}%
                        </span>
                      </td>

                      <td className="py-4 px-5 text-xs text-slate-400">
                        {formatDate(att.submitted_at || att.started_at)}
                      </td>

                      <td className="py-4 px-5 text-right">
                        {isCompleted || att.status === 'timed_out' ? (
                          <Link
                            to={`/test/${att.id}/result`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                          >
                            <span>Разбор ответов</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <Link
                            to={`/test/${att.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-white text-slate-900 text-xs font-medium transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            <span>Продолжить</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
