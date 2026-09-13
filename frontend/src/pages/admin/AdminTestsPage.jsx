import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  FileQuestion,
  Globe,
  Plus,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { TestAssignmentModal } from '../../components/admin/TestAssignmentModal';

export const AdminTestsPage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [assigningTest, setAssigningTest] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tests');
      setTests(res.data);
    } catch (err) {
      console.error('Ошибка загрузки тестов:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (test) => {
    try {
      await api.put(`/tests/${test.id}`, {
        is_published: !test.is_published,
      });
      setTests((prev) =>
        prev.map((t) => (t.id === test.id ? { ...t, is_published: !t.is_published } : t))
      );
    } catch (err) {
      console.error('Ошибка переключения статуса публикации:', err);
      alert(getErrorMessage(err, 'Не удалось обновить статус публикации.'));
    }
  };

  const handleDelete = async (testId) => {
    if (
      !window.confirm(
        'Вы действительно хотите удалить этот тест? Все связанные вопросы, назначения и попытки сотрудников будут удалены навсегда.'
      )
    ) {
      return;
    }

    try {
      setDeletingId(testId);
      await api.delete(`/tests/${testId}`);
      setTests((prev) => prev.filter((t) => t.id !== testId));
    } catch (err) {
      console.error('Ошибка удаления теста:', err);
      alert(getErrorMessage(err, 'Не удалось удалить тест.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyPublicLink = (publicToken) => {
    const url = `${window.location.origin}/t/${publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(publicToken);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Управление корпоративными тестами
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Создание, редактирование, публикация, назначение сотрудникам и аудит результатов AMG.
          </p>
        </div>

        <Link
          to="/admin/tests/new"
          className="btn-primary text-xs sm:text-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Создать новый тест</span>
        </Link>
      </div>

      {/* Tests Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl h-20 animate-pulse bg-slate-900/60" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="glass-panel rounded-xl p-12 text-center max-w-md mx-auto my-8 border border-slate-800">
          <FileQuestion className="w-10 h-10 mx-auto text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-200">Тесты еще не созданы</h3>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Начните с создания первого теста для сотрудников или кандидатов.
          </p>
          <Link to="/admin/tests/new" className="btn-primary text-xs">
            Создать тест
          </Link>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden border border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-5">Название и описание</th>
                  <th className="py-3 px-5">Статус</th>
                  <th className="py-3 px-5">Вопросы</th>
                  <th className="py-3 px-5">Проходной балл</th>
                  <th className="py-3 px-5">Регламент</th>
                  <th className="py-3 px-5">Публичная ссылка</th>
                  <th className="py-3 px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs text-slate-300">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-5 max-w-sm">
                      <div className="font-semibold text-slate-100 text-sm">{t.title}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {t.description || 'Описание отсутствует'}
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <button
                        onClick={() => handleTogglePublish(t)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                          t.is_published
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60 hover:bg-emerald-900/50'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
                        }`}
                        title="Нажмите для переключения статуса"
                      >
                        {t.is_published ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Опубликован
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            Черновик
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-200">{t.question_count} вопр.</div>
                      <div className="text-[11px] text-slate-400">{t.total_points} макс. б.</div>
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-slate-200">
                      {t.passing_score}%
                    </td>

                    <td className="py-3.5 px-5 text-slate-300 text-[11px]">
                      {t.time_limit_minutes ? `${t.time_limit_minutes} мин` : 'Без лимита'}
                    </td>

                    <td className="py-3.5 px-5">
                      {t.allow_guest && t.public_token ? (
                        <button
                          onClick={() => handleCopyPublicLink(t.public_token)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                            copiedToken === t.public_token
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                              : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                          title="Скопировать ссылку для гостей"
                        >
                          {copiedToken === t.public_token ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Скопировано!</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span>Ссылка гостя</span>
                              <Copy className="w-3 h-3 text-slate-500" />
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Отключена</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Назначить сотрудникам */}
                        <button
                          onClick={() => setAssigningTest(t)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          title="Назначить сотрудникам"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>

                        {/* Аналитика */}
                        <Link
                          to={`/admin/tests/${t.id}/analytics`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          title="Аналитика и попытки"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Редактировать в конструкторе */}
                        <Link
                          to={`/admin/tests/${t.id}/edit`}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                          title="Редактировать тест"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>

                        {/* Удалить */}
                        <button
                          onClick={() => handleDelete(t.id)}
                          disabled={deletingId === t.id}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 border border-slate-700 transition-colors"
                          title="Удалить тест"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {assigningTest && (
        <TestAssignmentModal
          test={assigningTest}
          onClose={() => {
            setAssigningTest(null);
            fetchTests();
          }}
        />
      )}
    </div>
  );
};
