import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Eye,
  FileQuestion,
  Globe,
  HelpCircle,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export const TestCatalogPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned', 'completed', 'general', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTestModal, setSelectedTestModal] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchTests();
  }, []);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tests');
      const data = res.data || [];
      setTests(data);

      // Если у пользователя нет персональных назначений, но есть общедоступные тесты, переключаем на общедоступные
      const hasAssigned = data.some((t) => t.is_assigned);
      if (!hasAssigned && data.some((t) => !t.is_assigned_only)) {
        setActiveTab('general');
      }
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

  const isDeadlineUrgent = (dueStr) => {
    if (!dueStr) return false;
    try {
      const due = new Date(dueStr).getTime();
      const now = new Date().getTime();
      const diffHours = (due - now) / (1000 * 60 * 60);
      return diffHours <= 48 && diffHours > 0;
    } catch {
      return false;
    }
  };

  const isDeadlineExpired = (dueStr) => {
    if (!dueStr) return false;
    try {
      return new Date(dueStr).getTime() < new Date().getTime();
    } catch {
      return false;
    }
  };

  // Категории тестов
  const assignedTests = tests.filter((t) => t.is_assigned);
  const completedTests = tests.filter(
    (t) => t.user_attempt_status && t.user_attempt_status !== 'in_progress'
  );
  const generalTests = tests.filter((t) => !t.is_assigned_only);
  const pendingAssignedTests = assignedTests.filter(
    (t) => t.user_attempt_status !== 'passed'
  );

  // Фильтрация текущей вкладки с учетом поиска
  const getDisplayedTests = () => {
    let list = [];
    if (activeTab === 'assigned') {
      list = assignedTests;
    } else if (activeTab === 'completed') {
      list = completedTests;
    } else if (activeTab === 'general') {
      list = generalTests;
    } else {
      list = tests;
    }

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(term) ||
        (t.description && t.description.toLowerCase().includes(term))
    );
  };

  const displayedTests = getDisplayedTests();
  const passedCount = tests.filter((t) => t.user_attempt_status === 'passed').length;

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
              Личный кабинет сотрудника: проходите персонально назначенные тесты, контролируйте сроки дедлайнов и изучайте рецензии экзаменаторов.
            </p>
          </div>

          {/* Быстрые показатели */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[100px]">
              <div className="text-2xl font-bold text-amber-400">{assignedTests.length}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Назначено мне</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[100px]">
              <div className="text-2xl font-bold text-emerald-400">{passedCount}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Сдано тестов</div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-center min-w-[100px]">
              <div className="text-2xl font-bold text-white">{completedTests.length}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Всего попыток</div>
            </div>
          </div>
        </div>
      </div>

      {/* Напоминание об обязательном назначенном тесте, если есть дедлайн */}
      {pendingAssignedTests.some((t) => t.assignment_due_date && isDeadlineUrgent(t.assignment_due_date)) && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-300">
                Внимание: приближается срок сдачи назначенного теста!
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Пожалуйста, завершите назначенное тестирование до истечения указанного срока.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('assigned')}
            className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
          >
            Перейти к тестам
          </button>
        </div>
      )}

      {/* Главная навигация по разделам личного кабинета (Вкладки) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Вкладка 1: Назначенные мне тесты */}
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === 'assigned'
                ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Назначенные мне тесты</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'assigned'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {assignedTests.length}
            </span>
          </button>

          {/* Вкладка 2: Пройденные тесты */}
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === 'completed'
                ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Пройденные тесты</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'completed'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {completedTests.length}
            </span>
          </button>

          {/* Вкладка 3: Общие тесты компании */}
          {generalTests.length > 0 && (
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                activeTab === 'general'
                  ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Общие тесты компании</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'general'
                    ? 'bg-slate-900 text-slate-100'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {generalTests.length}
              </span>
            </button>
          )}

          {/* Вкладка 4: Все доступные */}
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-slate-100 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            <span>Все тесты</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {tests.length}
            </span>
          </button>
        </div>

        {/* Поисковая строка */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск тестов по названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10 text-xs py-2"
          />
        </div>
      </div>

      {/* Отображение сетки тестов */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-6 h-64 bg-slate-900/60 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : displayedTests.length === 0 ? (
        /* Пустые состояния для каждого раздела */
        <div className="rounded-2xl p-12 text-center max-w-lg mx-auto my-8 bg-slate-900 border border-slate-800">
          {activeTab === 'assigned' ? (
            <>
              <CheckSquare className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Нет назначенных тестов
              </h3>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {searchTerm
                  ? 'По вашему поисковому запросу назначенные тесты не найдены.'
                  : 'В настоящий момент у вас нет персональных назначений от руководства. Вы можете пройти общедоступные корпоративные тесты.'}
              </p>
              {generalTests.length > 0 && !searchTerm && (
                <button
                  onClick={() => setActiveTab('general')}
                  className="mt-5 btn-primary text-xs py-2 px-4"
                >
                  Смотреть общие тесты компании
                </button>
              )}
            </>
          ) : activeTab === 'completed' ? (
            <>
              <Award className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">
                Вы пока не завершили ни одного теста
              </h3>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                {searchTerm
                  ? 'По вашему запросу пройденные тесты не найдены.'
                  : 'После прохождения тестирования здесь появятся ваши набранные баллы, процент правильности и детальные рецензии проверяющих.'}
              </p>
              {assignedTests.length > 0 && (
                <button
                  onClick={() => setActiveTab('assigned')}
                  className="mt-5 btn-primary text-xs py-2 px-4"
                >
                  Перейти к назначенным тестам
                </button>
              )}
            </>
          ) : (
            <>
              <FileQuestion className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Тесты не найдены</h3>
              <p className="text-sm text-slate-400 mt-1">
                Попробуйте изменить поисковый запрос или переключить вкладку.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedTests.map((test) => {
            const hasPassed = test.user_attempt_status === 'passed';
            const hasFailed = test.user_attempt_status === 'failed';
            const needsReview = test.user_attempt_status === 'needs_review';
            const isInProgress = test.user_attempt_status === 'in_progress';
            const hasCompleted = hasPassed || hasFailed || needsReview;
            const isRetakeForbidden =
              test.can_attempt === false ||
              (hasCompleted && test.max_attempts && test.max_attempts <= 1);

            const isUrgent = isDeadlineUrgent(test.assignment_due_date);
            const isExpired = isDeadlineExpired(test.assignment_due_date);

            return (
              <div
                key={test.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors shadow-sm"
              >
                <div>
                  {/* Статусная шапка карточки */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {hasPassed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Сдан ({test.user_best_score} б.)
                      </span>
                    ) : needsReview ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        На проверке
                      </span>
                    ) : hasFailed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Не сдан ({test.user_best_score} б.)
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        В процессе
                      </span>
                    ) : test.is_assigned ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <CheckSquare className="w-3.5 h-3.5" />
                        Назначен вам
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        Общий доступ
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

                  {/* Название и описание */}
                  <h3 className="text-base font-semibold text-white line-clamp-2 leading-snug">
                    {test.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {test.description || 'Описание тестирования отсутствует.'}
                  </p>

                  {/* Дедлайн / Срок сдачи (для назначенных тестов) */}
                  {test.is_assigned && (
                    <div
                      className={`mt-3.5 p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        isExpired && !hasCompleted
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          : isUrgent && !hasCompleted
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        <span>
                          {test.assignment_due_date
                            ? `Дедлайн: ${formatDate(test.assignment_due_date)}`
                            : 'Срок: Бессрочно'}
                        </span>
                      </div>
                      {isExpired && !hasCompleted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                          Срок истек
                        </span>
                      )}
                      {isUrgent && !hasCompleted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Срочно
                        </span>
                      )}
                    </div>
                  )}

                  {/* Информационный блок для пройденных тестов */}
                  {hasCompleted && (
                    <div className="mt-3.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between">
                      <span className="text-slate-400">Результат аттестации:</span>
                      <span
                        className={`font-semibold ${
                          hasPassed
                            ? 'text-emerald-400'
                            : needsReview
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {needsReview
                          ? 'Ожидает рецензии преподавателя'
                          : `${test.user_best_score || 0} из ${test.total_points} баллов`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Мета-параметры и кнопки действий */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Вопросов</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {test.question_count}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Лимит</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {test.time_limit_minutes ? `${test.time_limit_minutes} мин` : 'Нет'}
                      </div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
                      <div className="text-slate-500 text-[11px]">Макс. балл</div>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {test.total_points}
                      </div>
                    </div>
                  </div>

                  {/* Кнопки действий */}
                  {hasCompleted ? (
                    <div className="space-y-2">
                      {/* Кнопка просмотра результатов и рецензии */}
                      <button
                        onClick={() => {
                          if (test.user_attempt_id) {
                            navigate(`/test/${test.user_attempt_id}/result`);
                          } else {
                            navigate('/my-attempts');
                          }
                        }}
                        className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                      >
                        <Eye className="w-4 h-4 text-slate-300" />
                        <span>Результаты и рецензия</span>
                      </button>

                      {/* Если повторное прохождение разрешено */}
                      {!isRetakeForbidden && (
                        <button
                          onClick={() => setSelectedTestModal(test)}
                          className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Пройти повторно</span>
                        </button>
                      )}
                    </div>
                  ) : isInProgress ? (
                    <button
                      onClick={() => setSelectedTestModal(test)}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      <Play className="w-4 h-4" />
                      <span>Продолжить попытку</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedTestModal(test)}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors bg-slate-100 text-slate-900 hover:bg-white"
                    >
                      <Play className="w-4 h-4" />
                      <span>Начать тест</span>
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
