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
  Zap,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { TestAssignmentModal } from '../../components/admin/TestAssignmentModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { CreateExamSessionModal } from '../../components/exam/CreateExamSessionModal';

export const AdminTestsPage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [assigningTest, setAssigningTest] = useState(null);
  const [examTest, setExamTest] = useState(null);
  const [confirmDeleteTest, setConfirmDeleteTest] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tests');
      setTests(res.data || []);
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

  const requestDeleteTest = (test) => {
    setConfirmDeleteTest({
      test,
      onConfirm: async () => {
        try {
          setDeletingId(test.id);
          await api.delete(`/tests/${test.id}`);
          setTests((prev) => prev.filter((t) => t.id !== test.id));
        } catch (err) {
          console.error('Ошибка удаления теста:', err);
          alert(getErrorMessage(err, 'Не удалось удалить тест.'));
        } finally {
          setDeletingId(null);
          setConfirmDeleteTest(null);
        }
      },
    });
  };

  const handleCopyPublicLink = (publicToken) => {
    const url = `${window.location.origin}/t/${publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(publicToken);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#EEEEEE] pb-3">
        <Link
          to="/admin/tests"
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white text-[#141414] shadow-xs border border-[#E5E5E5] flex items-center gap-2"
        >
          <FileQuestion className="w-4 h-4 text-[#E84C3D]" />
          <span>Управление тестами</span>
        </Link>
        <Link
          to="/admin/exam-stats"
          className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#777777] hover:text-[#141414] hover:bg-white transition-all flex items-center gap-2 border border-transparent"
        >
          <BarChart3 className="w-4 h-4 text-[#777777]" />
          <span>Статистика очных экзаменов</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#141414]/10 border border-[#141414]/20 flex items-center justify-center text-[#141414]">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                Управление тестами AMG
              </h1>
              <p className="text-xs text-[#777777] mt-0.5">
                Создание, редактирование, публикация, назначение сотрудникам и аудит результатов аттестации
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/admin/tests/new"
          className="btn-primary text-xs sm:text-sm flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Создать новый тест</span>
        </Link>
      </div>

      {/* Tests Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl h-20 animate-pulse bg-white border border-[#EEEEEE]" />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center max-w-md mx-auto my-8 border border-[#EEEEEE] shadow-card">
          <FileQuestion className="w-10 h-10 mx-auto text-[#CED4DA] mb-3" />
          <h3 className="text-base font-bold text-[#222222]">Тесты еще не созданы</h3>
          <p className="text-xs sm:text-sm text-[#777777] mt-1 mb-5">
            Начните с создания первого теста для сотрудников или кандидатов компании.
          </p>
          <Link to="/admin/tests/new" className="btn-primary text-xs sm:text-sm">
            Создать тест
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden border border-[#EEEEEE] shadow-card">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-[#EEEEEE] bg-[#F5F5F7] text-[11px] font-bold uppercase tracking-wider text-[#777777]">
                  <th className="py-3 px-5">Название и описание</th>
                  <th className="py-3 px-5">Статус</th>
                  <th className="py-3 px-5">Вопросы</th>
                  <th className="py-3 px-5">Проходной балл</th>
                  <th className="py-3 px-5">Регламент</th>
                  <th className="py-3 px-5">Публичная ссылка</th>
                  <th className="py-3 px-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] text-xs text-[#222222]">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F8F9FA] transition-colors">
                    <td className="py-3.5 px-5 max-w-sm">
                      <div className="font-bold text-[#222222] text-sm">{t.title}</div>
                      <div className="text-[11px] text-[#777777] truncate mt-0.5">
                        {t.description || 'Описание отсутствует'}
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1.5 items-start">
                        <button
                          onClick={() => handleTogglePublish(t)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                            t.is_published
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Нажмите для переключения статуса"
                        >
                          {t.is_published ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Опубликован
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-amber-600" />
                              Черновик
                            </>
                          )}
                        </button>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            t.is_assigned_only
                              ? 'bg-[#FCECEB] text-[#E84C3D] border-[#F8D3D0]'
                              : 'bg-[#F0F5FA] text-[#141414] border-[#B8D5ED]'
                          }`}
                        >
                          {t.is_assigned_only ? 'Только назначенные' : 'Общий доступ'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#222222]">{t.question_count} вопр.</div>
                      <div className="text-[11px] text-[#777777]">{t.total_points} макс. б.</div>
                    </td>

                    <td className="py-3.5 px-5 font-bold text-[#141414]">
                      {t.passing_score}%
                    </td>

                    <td className="py-3.5 px-5 text-[#222222] text-[11px]">
                      {t.time_limit_minutes ? `${t.time_limit_minutes} мин` : 'Без лимита'}
                    </td>

                    <td className="py-3.5 px-5">
                      {t.allow_guest && t.public_token ? (
                        <button
                          onClick={() => handleCopyPublicLink(t.public_token)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                            copiedToken === t.public_token
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-white border-[#EEEEEE] text-[#141414] hover:bg-[#F5F5F7]'
                          }`}
                          title="Скопировать ссылку для гостей"
                        >
                          {copiedToken === t.public_token ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Скопировано!</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3 h-3 text-[#141414]" />
                              <span>Ссылка гостя</span>
                              <Copy className="w-3 h-3 text-[#777777]" />
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#777777] italic">Отключена</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setExamTest(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#2e2e2e] text-white text-[11px] font-bold shadow-sm transition-all"
                          title="Запустить синхронный экзамен по PIN-коду"
                        >
                          <Zap className="w-3.5 h-3.5 fill-[#E84C3D] text-[#E84C3D]" />
                          <span>Экзамен</span>
                        </button>

                        <button
                          onClick={() => setAssigningTest(t)}
                          className="p-2 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#EEEEEE] transition-colors"
                          title="Назначить сотрудникам"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </button>

                        <Link
                          to={`/admin/tests/${t.id}/analytics`}
                          className="p-2 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#EEEEEE] transition-colors"
                          title="Аналитика и попытки"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </Link>

                        <Link
                          to={`/admin/tests/${t.id}/edit`}
                          className="p-2 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#EEEEEE] transition-colors"
                          title="Редактировать тест"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          onClick={() => requestDeleteTest(t)}
                          disabled={deletingId === t.id}
                          className="p-2 rounded-lg bg-[#FCECEB] hover:bg-[#FDE8E9] text-[#E84C3D] border border-[#F8D3D0] transition-colors"
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

      {/* Custom Confirmation Modal */}
      {confirmDeleteTest && (
        <ConfirmModal
          isOpen={Boolean(confirmDeleteTest)}
          onClose={() => setConfirmDeleteTest(null)}
          onConfirm={confirmDeleteTest.onConfirm}
          title="Удаление тестирования"
          message={`Вы уверены, что хотите удалить тест «${confirmDeleteTest.test.title}»?`}
          description="Все связанные вопросы, персональные назначения и результаты прохождения сотрудников будут безвозвратно удалены."
          confirmText="Удалить тест"
          variant="danger"
        />
      )}
      {/* Create Exam Session Modal */}
      {examTest && (
        <CreateExamSessionModal
          test={examTest}
          isOpen={Boolean(examTest)}
          onClose={() => setExamTest(null)}
        />
      )}
    </div>
  );
};
