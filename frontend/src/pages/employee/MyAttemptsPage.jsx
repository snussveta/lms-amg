import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileQuestion,
  History,
  XCircle,
  Play,
  AlertCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const MyAttemptsPage = () => {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAttempts();
  }, []);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/attempts/my');
      setAttempts(res.data || []);
    } catch (err) {
      console.error('Ошибка загрузки истории попыток:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить историю попыток.'));
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

  const handleRowClick = (att) => {
    const isCompleted = att.status === 'submitted' || att.status === 'needs_review' || att.status === 'timed_out';
    if (isCompleted) {
      navigate(`/test/${att.id}/result`);
    } else {
      navigate(`/test/${att.id}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#212529] flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#003B73]/10 border border-[#003B73]/20 flex items-center justify-center text-[#003B73]">
              <History className="w-5 h-5" />
            </div>
            <span>История моих тестирований</span>
          </h1>
          <p className="text-[#6C757D] text-xs sm:text-sm mt-1">
            Просмотр всех пройденных тестов платформы AMG, набранных баллов и статусов проверки.
          </p>
        </div>

        <Link to="/tests" className="btn-primary text-xs sm:text-sm self-start sm:self-auto">
          Каталог тестов
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FBD0D3] text-[#E30613] text-xs sm:text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Список попыток */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl h-16 animate-pulse bg-white border border-[#E0E0E0]" />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center max-w-md mx-auto my-8 shadow-card">
          <FileQuestion className="w-12 h-12 mx-auto text-[#ADB5BD] mb-3" />
          <h3 className="text-base font-bold text-[#212529]">Попыток не найдено</h3>
          <p className="text-xs sm:text-sm text-[#6C757D] mt-1 mb-6">
            Вы пока еще не проходили ни одного теста в корпоративной системе.
          </p>
          <Link to="/tests" className="btn-primary text-xs sm:text-sm">
            Выбрать первый тест
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden border border-[#E0E0E0] shadow-card">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#E0E0E0] bg-[#F4F5F7] text-[11px] font-bold uppercase tracking-wider text-[#6C757D]">
                  <th className="py-3.5 px-5">Название теста</th>
                  <th className="py-3.5 px-5">Статус</th>
                  <th className="py-3.5 px-5">Баллы</th>
                  <th className="py-3.5 px-5">Результат</th>
                  <th className="py-3.5 px-5">Дата</th>
                  <th className="py-3.5 px-5 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0] text-sm text-[#212529]">
                {attempts.map((att) => {
                  const isNeedsReview = att.status === 'needs_review';
                  const isPassed = att.is_passed && !isNeedsReview;
                  const isInProgress = att.status === 'in_progress';
                  const isCompleted = att.status === 'submitted' || isNeedsReview || att.status === 'timed_out';

                  return (
                    <tr
                      key={att.id}
                      onClick={() => handleRowClick(att)}
                      className="hover:bg-[#F8F9FA] transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-5 font-bold text-[#212529] group-hover:text-[#003B73] transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{att.test_title}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity text-[#003B73]" />
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        {isNeedsReview ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5" />
                            На проверке
                          </span>
                        ) : isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Сдано
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0F5FA] text-[#003B73] border border-[#B8D5ED]">
                            <Clock className="w-3.5 h-3.5 animate-spin text-[#003B73]" />
                            В процессе
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF2F2] text-[#E30613] border border-[#FBD0D3]">
                            <XCircle className="w-3.5 h-3.5 text-[#E30613]" />
                            Не сдано
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 font-mono text-xs">
                        <span className="font-bold text-[#212529] text-sm">{att.score}</span> / {att.max_score} б.
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`font-bold ${
                            isNeedsReview
                              ? 'text-amber-700'
                              : isPassed
                              ? 'text-emerald-700'
                              : 'text-[#E30613]'
                          }`}
                        >
                          {att.percentage}%
                        </span>
                      </td>

                      <td className="py-4 px-5 text-xs text-[#6C757D]">
                        {formatDate(att.submitted_at || att.started_at)}
                      </td>

                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {isCompleted ? (
                          <Link
                            to={`/test/${att.id}/result`}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            <span>Разбор</span>
                            <ExternalLink className="w-3 h-3 ml-1 text-[#003B73]" />
                          </Link>
                        ) : (
                          <Link
                            to={`/test/${att.id}`}
                            className="btn-primary text-xs py-1.5 px-3"
                          >
                            <Play className="w-3 h-3 mr-1" />
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
