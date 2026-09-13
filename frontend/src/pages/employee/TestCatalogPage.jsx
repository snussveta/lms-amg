import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Clock,
  FileQuestion,
  HelpCircle,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  AlertCircle,
  Calendar,
  Eye,
  CheckSquare,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const TestCatalogPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, assigned, new, needs_review, passed, failed
  const [selectedTestModal, setSelectedTestModal] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tests');
      setTests(res.data);
    } catch (err) {
      console.error('Не удалось загрузить тесты:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async (testId) => {
    try {
      setStarting(true);
      const res = await api.post(`/attempts/start?test_id=${testId}`);
      setSelectedTestModal(null);
      navigate(`/test/${res.data.attempt_id}`);
    } catch (err) {
      console.error('Ошибка запуска тестирования:', err);
      alert(getErrorMessage(err, 'Не удалось запустить тестирование. Попробуйте еще раз.'));
    } finally {
      setStarting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const assignedPendingTests = tests.filter(
    (t) => t.is_assigned && t.user_attempt_status !== 'passed'
  );

  const filteredTests = tests.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterStatus === 'assigned') return t.is_assigned;
    if (filterStatus === 'passed') return t.user_attempt_status === 'passed';
    if (filterStatus === 'failed') return t.user_attempt_status === 'failed';
    if (filterStatus === 'needs_review') return t.user_attempt_status === 'needs_review';
    if (filterStatus === 'new') return !t.user_attempt_status;
    return true;
  });

  const passedCount = tests.filter((t) => t.user_attempt_status === 'passed').length;
  const needsReviewCount = tests.filter((t) => t.user_attempt_status === 'needs_review').length;
  const assignedCount = tests.filter((t) => t.is_assigned).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Верхний информационный блок AMG */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              AMG • Корпоративный портал аттестации
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Здравствуйте, {user?.full_name || 'Сотрудник'}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">
              Проходите назначенные и общедоступные тесты, подтверждайте квалификацию и отслеживайте результаты аттестации.
            </p>
          </div>

          {/* Быстрые показатели */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[90px]">
              <div className="text-2xl font-bold text-white">{tests.length}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Всего тестов</div>
            </div>
            {assignedCount > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[90px]">
                <div className="text-2xl font-bold text-slate-200">{assignedCount}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">Назначено</div>
              </div>
            )}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[90px]">
              <div className="text-2xl font-bold text-emerald-400">{passedCount}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Сдано</div>
            </div>
          </div>
        </div>
      </div>

      {/* Блок обязательных назначенных тестов, если они есть */}
      {assignedPendingTests.length > 0 && (
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">
              Тесты, требующие прохождения ({assignedPendingTests.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedPendingTests.map((test) => (
              <div
                key={test.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      Ожидает сдачи
                    </span>
                    {test.assignment_due_date && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        До {formatDate(test.assignment_due_date)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white text-sm line-clamp-1">{test.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {test.description || 'Назначенный тест для проверки компетенций.'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTestModal(test)}
                  className="mt-4 w-full py-2 px-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-900 hover:bg-white flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  Пройти тест
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Панель фильтров и поиска */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск тестов по названию или теме..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 text-sm"
          />
        </div>

        {/* Вкладки фильтрации */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: 'Все тесты' },
            { id: 'assigned', label: `Назначенные (${assignedCount})` },
            { id: 'new', label: 'Не начатые' },
            { id: 'needs_review', label: `На проверке (${needsReviewCount})` },
            { id: 'passed', label: 'Сданные' },
            { id: 'failed', label: 'Пересдача' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterStatus === tab.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Сетка тестов */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl p-6 h-64 bg-slate-900/60 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="rounded-2xl p-12 text-center max-w-md mx-auto my-12 bg-slate-900 border border-slate-800">
          <FileQuestion className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">Тесты не найдены</h3>
          <p className="text-sm text-slate-400 mt-1">
            {searchTerm
              ? 'Попробуйте изменить поисковый запрос или фильтры.'
              : 'В каталоге пока нет опубликованных тестов.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.map((test) => {
            const hasPassed = test.user_attempt_status === 'passed';
            const hasFailed = test.user_attempt_status === 'failed';
            const needsReview = test.user_attempt_status === 'needs_review';
            const isInProgress = test.user_attempt_status === 'in_progress';
            const hasCompleted = hasPassed || hasFailed || needsReview;
            const isRetakeForbidden = test.can_attempt === false || (hasCompleted && test.max_attempts && test.max_attempts <= 1);

            return (
              <div
                key={test.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                {/* Статусная шапка карточки */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {hasPassed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Сдан ({test.user_best_score} б.)
                      </span>
                    ) : needsReview ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        Ожидает проверки
                      </span>
                    ) : hasFailed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Не сдан ({test.user_best_score} б.)
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        В процессе
                      </span>
                    ) : test.is_assigned ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <CheckSquare className="w-3.5 h-3.5" />
                        Назначен
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        Готов к сдаче
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {test.max_attempts === 1 && (
                        <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                          1 попытка
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-medium">
                        Порог: {test.passing_score}%
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-white line-clamp-2">
                    {test.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {test.description || 'Описание тестирования отсутствует.'}
                  </p>

                  {test.assignment_due_date && (
                    <div className="mt-3 text-xs text-amber-400/90 flex items-center gap-1.5 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Срок сдачи: {formatDate(test.assignment_due_date)}</span>
                    </div>
                  )}
                </div>

                {/* Мета-параметры и кнопка */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Вопросов</div>
                      <div className="font-semibold text-slate-200 mt-0.5">{test.question_count}</div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Лимит</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {test.time_limit_minutes ? `${test.time_limit_minutes} мин` : 'Нет'}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Макс. балл</div>
                      <div className="font-semibold text-slate-200 mt-0.5">{test.total_points}</div>
                    </div>
                  </div>

                  {/* Кнопка действия */}
                  {isRetakeForbidden ? (
                    <button
                      onClick={() => {
                        if (test.user_attempt_id) {
                          navigate(`/test/${test.user_attempt_id}/result`);
                        } else {
                          navigate('/my-attempts');
                        }
                      }}
                      className="w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Тест уже пройден</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedTestModal(test)}
                      className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                        hasPassed
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : needsReview
                          ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                          : 'bg-slate-100 text-slate-900 hover:bg-white'
                      }`}
                    >
                      {hasPassed || needsReview ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          Пройти повторно
                        </>
                      ) : isInProgress ? (
                        <>
                          <Play className="w-4 h-4" />
                          Продолжить попытку
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Начать тест
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно подтверждения запуска теста */}
      {selectedTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2">{selectedTestModal.title}</h3>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {selectedTestModal.description || 'Вы собираетесь начать прохождение этого теста.'}
            </p>

            <div className="space-y-3 bg-slate-950/70 rounded-xl p-4 border border-slate-800 mb-6 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Количество вопросов:</span>
                <span className="font-semibold text-slate-200">{selectedTestModal.question_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Проходной балл:</span>
                <span className="font-semibold text-white">{selectedTestModal.passing_score}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Максимально баллов:</span>
                <span className="font-semibold text-slate-200">{selectedTestModal.total_points}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Ограничение по времени:</span>
                <span className="font-semibold text-slate-200">
                  {selectedTestModal.time_limit_minutes
                    ? `${selectedTestModal.time_limit_minutes} минут`
                    : 'Без ограничений'}
                </span>
              </div>
              {selectedTestModal.assignment_due_date && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-amber-400">
                  <span>Срок выполнения (дедлайн):</span>
                  <span className="font-semibold">{formatDate(selectedTestModal.assignment_due_date)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 flex-shrink-0 text-slate-500 mt-0.5" />
                <span>
                  Таймер запустится сразу после нажатия кнопки «Начать тестирование». Ответы сохраняются в процессе прохождения.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedTestModal(null)}
                disabled={starting}
                className="btn-secondary text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleStartTest(selectedTestModal.id)}
                disabled={starting}
                className="btn-primary text-sm min-w-[150px]"
              >
                {starting ? 'Запуск...' : 'Начать тестирование'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
