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
  UserPlus,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { TestAssignmentModal } from '../../components/admin/TestAssignmentModal';

export const TestCatalogPage = () => {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned', 'completed', 'general', 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTestModal, setSelectedTestModal] = useState(null);
  const [selectedTestForAssign, setSelectedTestForAssign] = useState(null);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Верхний информационный блок AMG */}
      <div className="rounded-2xl bg-white border border-[#EEEEEE] p-6 sm:p-8 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-[#F0F5FA] text-[#141414] border border-[#B8D5ED] mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-[#141414]" />
              AMG • Корпоративный портал аттестации
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#222222] tracking-tight">
              Здравствуйте, {user?.full_name || 'Сотрудник'}
            </h1>
            <p className="text-[#777777] text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Личный кабинет сотрудника: проходите персонально назначенные тесты, контролируйте сроки дедлайнов и изучайте рецензии экзаменаторов.
            </p>
          </div>

          {/* Быстрые показатели */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full lg:w-auto">
            <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-[#141414]">{assignedTests.length}</div>
              <div className="text-[11px] text-[#777777] font-medium mt-0.5">Назначено</div>
            </div>
            <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-emerald-600">{passedCount}</div>
              <div className="text-[11px] text-[#777777] font-medium mt-0.5">Сдано</div>
            </div>
            <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-3 sm:p-4 text-center">
              <div className="text-xl sm:text-2xl font-black text-[#222222]">{completedTests.length}</div>
              <div className="text-[11px] text-[#777777] font-medium mt-0.5">Попыток</div>
            </div>
          </div>
        </div>
      </div>

      {/* Напоминание об обязательном назначенном тесте, если есть дедлайн */}
      {pendingAssignedTests.some((t) => t.assignment_due_date && isDeadlineUrgent(t.assignment_due_date)) && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-amber-800">
                Внимание: приближается срок сдачи назначенного теста!
              </div>
              <div className="text-xs text-amber-700 mt-0.5">
                Пожалуйста, завершите назначенное тестирование до истечения указанного срока.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('assigned')}
            className="btn-primary text-xs py-2 px-3.5 whitespace-nowrap self-start sm:self-auto"
          >
            Перейти к тестам
          </button>
        </div>
      )}

      {/* Вкладки и поиск */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-4">
        {/* Scrollable tabs for mobile */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap min-h-[40px] ${
              activeTab === 'assigned'
                ? 'bg-[#141414] text-white shadow-sm'
                : 'bg-white text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] border border-[#EEEEEE]'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Назначенные мне</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'assigned'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F5F5F7] text-[#495057]'
              }`}
            >
              {assignedTests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap min-h-[40px] ${
              activeTab === 'completed'
                ? 'bg-[#141414] text-white shadow-sm'
                : 'bg-white text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] border border-[#EEEEEE]'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Пройденные</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'completed'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F5F5F7] text-[#495057]'
              }`}
            >
              {completedTests.length}
            </span>
          </button>

          {generalTests.length > 0 && (
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap min-h-[40px] ${
                activeTab === 'general'
                  ? 'bg-[#141414] text-white shadow-sm'
                  : 'bg-white text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] border border-[#EEEEEE]'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Общие тесты</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'general'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#F5F5F7] text-[#495057]'
                }`}
              >
                {generalTests.length}
              </span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap min-h-[40px] ${
              activeTab === 'all'
                ? 'bg-[#141414] text-white shadow-sm'
                : 'bg-white text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] border border-[#EEEEEE]'
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            <span>Все</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F5F5F7] text-[#495057]'
              }`}
            >
              {tests.length}
            </span>
          </button>
        </div>

        {/* Поисковая строка */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
          <input
            type="text"
            placeholder="Поиск тестов по названию..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Сетка тестов */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl p-6 h-64 bg-white border border-[#EEEEEE]"
            />
          ))}
        </div>
      ) : displayedTests.length === 0 ? (
        <div className="rounded-2xl p-12 text-center max-w-lg mx-auto my-8 bg-white border border-[#EEEEEE] shadow-card">
          {activeTab === 'assigned' ? (
            <>
              <CheckSquare className="w-12 h-12 mx-auto text-[#ADB5BD] mb-3" />
              <h3 className="text-lg font-bold text-[#222222]">
                Нет назначенных тестов
              </h3>
              <p className="text-xs sm:text-sm text-[#777777] mt-1 leading-relaxed">
                {searchTerm
                  ? 'По вашему поисковому запросу назначенные тесты не найдены.'
                  : 'В настоящий момент у вас нет персональных назначений от руководства. Вы можете пройти общедоступные корпоративные тесты.'}
              </p>
              {generalTests.length > 0 && !searchTerm && (
                <button
                  onClick={() => setActiveTab('general')}
                  className="mt-5 btn-primary text-xs py-2 px-4"
                >
                  Смотреть общие тесты
                </button>
              )}
            </>
          ) : activeTab === 'completed' ? (
            <>
              <Award className="w-12 h-12 mx-auto text-[#ADB5BD] mb-3" />
              <h3 className="text-lg font-bold text-[#222222]">
                Вы пока не завершили ни одного теста
              </h3>
              <p className="text-xs sm:text-sm text-[#777777] mt-1 leading-relaxed">
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
              <FileQuestion className="w-12 h-12 mx-auto text-[#ADB5BD] mb-3" />
              <h3 className="text-lg font-bold text-[#222222]">Тесты не найдены</h3>
              <p className="text-xs sm:text-sm text-[#777777] mt-1">
                Попробуйте изменить поисковый запрос или переключить вкладку.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
                className="bg-white border border-[#EEEEEE] rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:shadow-card-hover hover:border-[#CED4DA] transition-all duration-200 shadow-card hover:-translate-y-0.5 group"
              >
                <div>
                  {/* Статусная шапка карточки */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {hasPassed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Сдан ({test.user_best_score} б.)
                      </span>
                    ) : needsReview ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        На проверке
                      </span>
                    ) : hasFailed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0] shadow-2xs">
                        <AlertCircle className="w-3.5 h-3.5 text-[#E84C3D]" />
                        Не сдан ({test.user_best_score} б.)
                      </span>
                    ) : isInProgress ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#F0F5FA] text-[#141414] border border-[#B8D5ED] shadow-2xs">
                        <Clock className="w-3.5 h-3.5 animate-spin text-[#141414]" />
                        В процессе
                      </span>
                    ) : test.is_assigned ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#FCECEB] text-[#E84C3D] border border-[#F8D3D0] shadow-2xs">
                        <CheckSquare className="w-3.5 h-3.5 text-[#E84C3D]" />
                        Назначен вам
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F5F5F7] text-[#495057] border border-[#EEEEEE]">
                        <Globe className="w-3.5 h-3.5 text-[#777777]" />
                        Общий
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {test.max_attempts === 1 && (
                        <span className="text-[10px] text-[#777777] bg-[#F5F5F7] px-2 py-0.5 rounded border border-[#EEEEEE] font-medium">
                          1 попытка
                        </span>
                      )}
                      <span className="text-xs text-[#777777] font-semibold">
                        Порог: {test.passing_score}%
                      </span>
                    </div>
                  </div>

                  {/* Название и описание */}
                  <h3 className="text-base font-bold text-[#222222] group-hover:text-[#141414] transition-colors line-clamp-2 leading-snug">
                    {test.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#777777] mt-2 line-clamp-3 leading-relaxed">
                    {test.description || 'Описание тестирования отсутствует.'}
                  </p>

                  {/* Дедлайн / Срок сдачи (для назначенных тестов) */}
                  {test.is_assigned && (
                    <div
                      className={`mt-3.5 p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        isExpired && !hasCompleted
                          ? 'bg-[#FCECEB] border-[#F8D3D0] text-[#E84C3D]'
                          : isUrgent && !hasCompleted
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-[#F5F5F7] border-[#EEEEEE] text-[#495057]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-[#777777]" />
                        <span className="font-medium">
                          {test.assignment_due_date
                            ? `Дедлайн: ${formatDate(test.assignment_due_date)}`
                            : 'Срок: Бессрочно'}
                        </span>
                      </div>
                      {isExpired && !hasCompleted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E84C3D]">
                          Срок истек
                        </span>
                      )}
                      {isUrgent && !hasCompleted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          Срочно
                        </span>
                      )}
                    </div>
                  )}

                  {/* Информационный блок для пройденных тестов */}
                  {hasCompleted && (
                    <div className="mt-3.5 p-2.5 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] text-xs flex items-center justify-between">
                      <span className="text-[#777777]">Результат:</span>
                      <span
                        className={`font-bold ${
                          hasPassed
                            ? 'text-emerald-700'
                            : needsReview
                            ? 'text-amber-700'
                            : 'text-[#E84C3D]'
                        }`}
                      >
                        {needsReview
                          ? 'Ожидает рецензии'
                          : `${test.user_best_score || 0} из ${test.total_points} баллов`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Мета-параметры и кнопки действий */}
                <div className="mt-6 pt-4 border-t border-[#EEEEEE]">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-2">
                      <div className="text-[#777777] text-[11px]">Вопросов</div>
                      <div className="font-bold text-[#222222] mt-0.5">
                        {test.question_count}
                      </div>
                    </div>
                    <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-2">
                      <div className="text-[#777777] text-[11px]">Лимит</div>
                      <div className="font-bold text-[#222222] mt-0.5">
                        {test.time_limit_minutes ? `${test.time_limit_minutes} мин` : 'Нет'}
                      </div>
                    </div>
                    <div className="bg-[#F5F5F7] border border-[#EEEEEE] rounded-xl p-2">
                      <div className="text-[#777777] text-[11px]">Макс. балл</div>
                      <div className="font-bold text-[#222222] mt-0.5">
                        {test.total_points}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  {hasCompleted ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          if (test.user_attempt_id) {
                            navigate(`/test/${test.user_attempt_id}/result`);
                          } else {
                            navigate('/my-attempts');
                          }
                        }}
                        className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4 text-[#141414]" />
                        <span>Результаты и рецензия</span>
                      </button>

                      {!isRetakeForbidden && (
                        <button
                          onClick={() => setSelectedTestModal(test)}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Пройти повторно</span>
                        </button>
                      )}
                    </div>
                  ) : isInProgress ? (
                    <button
                      onClick={() => setSelectedTestModal(test)}
                      className="btn-accent w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Продолжить попытку</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedTestModal(test)}
                      className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      <span>Начать тест</span>
                    </button>
                  )}

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setSelectedTestForAssign(test)}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-[#CCCCCC] bg-white text-[#222222] hover:border-[#E84C3D] hover:text-[#E84C3D] font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm mt-2"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#E84C3D]" />
                      <span>Назначить сотрудникам</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальное окно назначения теста сотрудникам */}
      {selectedTestForAssign && (
        <TestAssignmentModal
          test={selectedTestForAssign}
          onClose={() => {
            setSelectedTestForAssign(null);
            fetchTests();
          }}
        />
      )}

      {/* Модальное окно подтверждения запуска теста */}
      {selectedTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#EEEEEE] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-[#222222] mb-2">{selectedTestModal.title}</h3>
            <p className="text-xs sm:text-sm text-[#777777] mb-6 leading-relaxed">
              {selectedTestModal.description || 'Вы собираетесь начать прохождение этого теста.'}
            </p>

            <div className="space-y-3 bg-[#F5F5F7] rounded-xl p-4 border border-[#EEEEEE] mb-6 text-xs text-[#222222]">
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Количество вопросов:</span>
                <span className="font-bold text-[#222222]">{selectedTestModal.question_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Проходной балл:</span>
                <span className="font-bold text-[#141414]">{selectedTestModal.passing_score}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Максимально баллов:</span>
                <span className="font-bold text-[#222222]">{selectedTestModal.total_points}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777777]">Ограничение по времени:</span>
                <span className="font-bold text-[#222222]">
                  {selectedTestModal.time_limit_minutes
                    ? `${selectedTestModal.time_limit_minutes} минут`
                    : 'Без ограничений'}
                </span>
              </div>
              {selectedTestModal.assignment_due_date && (
                <div className="flex items-center justify-between pt-2 border-t border-[#EEEEEE] text-amber-800 font-semibold">
                  <span>Срок сдачи (дедлайн):</span>
                  <span>{formatDate(selectedTestModal.assignment_due_date)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#EEEEEE] text-[11px] text-[#777777] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 flex-shrink-0 text-[#141414] mt-0.5" />
                <span>
                  Таймер запустится сразу после нажатия кнопки «Начать тестирование». Ответы сохраняются сервером автоматически.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedTestModal(null)}
                disabled={starting}
                className="btn-secondary text-xs sm:text-sm py-2.5"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => handleStartTest(selectedTestModal.id)}
                disabled={starting}
                className="btn-primary text-xs sm:text-sm py-2.5 min-w-[160px]"
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
