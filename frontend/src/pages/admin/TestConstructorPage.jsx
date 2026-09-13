import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckSquare,
  Copy,
  Globe,
  HelpCircle,
  MoveDown,
  MoveUp,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const TestConstructorPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(testId);

  // Настройки теста
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [hasTimeLimit, setHasTimeLimit] = useState(true);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [isPublished, setIsPublished] = useState(true);
  const [allowGuest, setAllowGuest] = useState(false);
  const [isAssignedOnly, setIsAssignedOnly] = useState(true);
  const [disallowRetake, setDisallowRetake] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [publicToken, setPublicToken] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Вопросы
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Банк вопросов: модалка импорта
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankDepartments, setBankDepartments] = useState(['Все', 'Общий', 'Бухгалтерия', 'Продажи', 'IT', 'Логистика']);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDept, setBankDept] = useState('Все');
  const [selectedBankIds, setSelectedBankIds] = useState([]);

  useEffect(() => {
    if (isEditing) {
      fetchExistingTest();
    } else {
      // Начальный вопрос по умолчанию для нового теста
      setQuestions([
        {
          id: Date.now(),
          text: '',
          question_type: 'single_choice',
          points: 10,
          order: 0,
          options: [
            { text: 'Вариант 1', is_correct: true },
            { text: 'Вариант 2', is_correct: false },
          ],
        },
      ]);
    }
  }, [testId]);

  const fetchExistingTest = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/tests/${testId}`);
      const t = res.data;
      setTitle(t.title);
      setDescription(t.description || '');
      setPassingScore(t.passing_score);
      setIsPublished(t.is_published);
      setIsAssignedOnly(t.is_assigned_only !== undefined && t.is_assigned_only !== null ? Boolean(t.is_assigned_only) : true);
      setAllowGuest(Boolean(t.allow_guest));
      setPublicToken(t.public_token || '');

      if (t.max_attempts !== undefined && t.max_attempts !== null) {
        setDisallowRetake(true);
        setMaxAttempts(t.max_attempts);
      } else {
        setDisallowRetake(false);
        setMaxAttempts(1);
      }

      if (t.time_limit_minutes) {
        setHasTimeLimit(true);
        setTimeLimitMinutes(t.time_limit_minutes);
      } else {
        setHasTimeLimit(false);
        setTimeLimitMinutes(15);
      }

      setQuestions(
        (t.questions || []).map((q, idx) => ({
          ...q,
          order: idx,
          options: q.options || [],
        }))
      );
    } catch (err) {
      console.error('Ошибка загрузки теста:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить параметры теста.'));
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = (type) => {
    let defaultOptions = [];
    if (type === 'single_choice' || type === 'multiple_choice') {
      defaultOptions = [
        { text: 'Вариант 1', is_correct: true },
        { text: 'Вариант 2', is_correct: false },
      ];
    } else if (type === 'text') {
      defaultOptions = [{ text: '', is_correct: true }];
    } else if (type === 'manual_review') {
      // Для ручной проверки варианты не нужны
      defaultOptions = [];
    }

    const newQ = {
      id: Date.now(),
      text: '',
      question_type: type,
      points: 10,
      order: questions.length,
      options: defaultOptions,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const updateQuestion = (index, field, value) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const deleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('В тесте должен быть хотя бы один вопрос.');
      return;
    }
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const moveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const addOption = (qIndex) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      q.options = [...q.options, { text: '', is_correct: false }];
      copy[qIndex] = q;
      return copy;
    });
  };

  const updateOptionText = (qIndex, optIndex, text) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      const opts = [...q.options];
      opts[optIndex] = { ...opts[optIndex], text };
      q.options = opts;
      copy[qIndex] = q;
      return copy;
    });
  };

  const deleteOption = (qIndex, optIndex) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      if (q.options.length <= 1) return copy;
      q.options = q.options.filter((_, idx) => idx !== optIndex);
      copy[qIndex] = q;
      return copy;
    });
  };

  const setCorrectOption = (qIndex, optIndex) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const q = { ...copy[qIndex] };
      if (q.question_type === 'single_choice') {
        q.options = q.options.map((opt, idx) => ({
          ...opt,
          is_correct: idx === optIndex,
        }));
      } else if (q.question_type === 'multiple_choice') {
        const opts = [...q.options];
        opts[optIndex] = { ...opts[optIndex], is_correct: !opts[optIndex].is_correct };
        q.options = opts;
      }
      copy[qIndex] = q;
      return copy;
    });
  };

  const handleCopyLink = () => {
    if (!publicToken) return;
    const url = `${window.location.origin}/t/${publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSave = async (saveAsDraft = false) => {
    setError('');

    if (!title.trim()) {
      setError('Пожалуйста, укажите название теста.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (questions.length === 0) {
      setError('Добавьте хотя бы один вопрос в тест.');
      return;
    }

    // Валидация вопросов
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Вопрос #${i + 1} не содержит формулировки текста.`);
        return;
      }

      if (q.question_type === 'text') {
        const hasKeyword = q.options.some((opt) => opt.text.trim().length > 0);
        if (!hasKeyword) {
          setError(`В вопросе #${i + 1} (текстовый ответ) укажите хотя бы одно ключевое слово.`);
          return;
        }
      } else if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
        if (q.options.length < 2) {
          setError(`В вопросе #${i + 1} должно быть минимум 2 варианта ответа.`);
          return;
        }
        const hasCorrect = q.options.some((opt) => opt.is_correct);
        if (!hasCorrect) {
          setError(`В вопросе #${i + 1} необходимо отметить хотя бы один правильный вариант.`);
          return;
        }
      }
      // Для 'manual_review' варианты ответа не требуются
    }

    setSaving(true);

    try {
      const publishStatus = saveAsDraft ? false : isPublished;

      const payload = {
        title: title.trim(),
        description: description.trim(),
        time_limit_minutes: hasTimeLimit ? parseInt(timeLimitMinutes, 10) : null,
        passing_score: parseInt(passingScore, 10),
        max_attempts: disallowRetake ? (parseInt(maxAttempts, 10) || 1) : null,
        is_assigned_only: isAssignedOnly,
        is_published: publishStatus,
        allow_guest: allowGuest,
        public_token: publicToken || null,
        questions: questions.map((q, idx) => ({
          text: q.text.trim(),
          question_type: q.question_type,
          points: parseInt(q.points, 10) || 1,
          order: idx,
          options:
            q.question_type === 'manual_review'
              ? []
              : q.options.map((opt) => ({
                  text: opt.text.trim(),
                  is_correct: q.question_type === 'text' ? true : opt.is_correct,
                })),
        })),
      };

      if (isEditing) {
        await api.put(`/tests/${testId}`, payload);
      } else {
        await api.post('/tests', payload);
      }

      navigate('/admin/tests');
    } catch (err) {
      console.error('Ошибка сохранения теста:', err);
      setError(getErrorMessage(err, 'Не удалось сохранить тест. Проверьте правильность полей.'));
    } finally {
      setSaving(false);
    }
  };

  const openBankModal = async () => {
    setIsBankModalOpen(true);
    setSelectedBankIds([]);
    setBankSearch('');
    setBankDept('Все');
    try {
      setBankLoading(true);
      const [qRes, dRes] = await Promise.all([
        api.get('/bank-questions'),
        api.get('/bank-questions/departments'),
      ]);
      setBankQuestions(qRes.data || []);
      if (Array.isArray(dRes.data)) {
        setBankDepartments(['Все', ...dRes.data]);
      }
    } catch (err) {
      console.error('Ошибка загрузки банка вопросов:', err);
    } finally {
      setBankLoading(false);
    }
  };

  const toggleBankQuestionSelect = (id) => {
    setSelectedBankIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredBankQuestions = bankQuestions.filter((q) => {
    const matchesDept = bankDept === 'Все' || q.department === bankDept;
    const matchesSearch =
      !bankSearch.trim() ||
      q.text.toLowerCase().includes(bankSearch.toLowerCase()) ||
      q.department.toLowerCase().includes(bankSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const toggleSelectAllBank = () => {
    const visibleIds = filteredBankQuestions.map((q) => q.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedBankIds.includes(id));
    if (allSelected) {
      setSelectedBankIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedBankIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleImportFromBank = () => {
    const toImport = bankQuestions.filter((bq) => selectedBankIds.includes(bq.id));
    const newItems = toImport.map((bq, idx) => ({
      id: Date.now() + idx,
      text: bq.text,
      question_type: bq.question_type,
      points: bq.points || 10,
      order: questions.length + idx,
      options: (bq.options || []).map((opt) => ({
        text: opt.text,
        is_correct: opt.is_correct,
      })),
    }));
    setQuestions((prev) => [...prev, ...newItems]);
    setIsBankModalOpen(false);
    setSelectedBankIds([]);
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'single_choice':
        return 'Один вариант';
      case 'multiple_choice':
        return 'Несколько вариантов';
      case 'manual_review':
        return 'Ручная проверка';
      case 'text':
        return 'Текстовый ответ';
      default:
        return type;
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + (parseInt(q.points, 10) || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/admin/tests"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Назад к списку тестов
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {isEditing ? 'Редактирование теста' : 'Конструктор теста'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Настройка параметров, выбор типов вопросов и регламентов прохождения.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Всего баллов: </span>
            <span className="font-bold text-slate-100">{totalPoints} б.</span>
          </div>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn-secondary text-xs"
          >
            В черновик
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Сохранение...' : 'Сохранить тест'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-2.5 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* General Parameters */}
      <div className="glass-panel p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2.5">
          1. Общие параметры теста
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Название теста *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Информационная безопасность и защита данных 2026"
              className="input-field"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Описание / Инструкции для тестируемого
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание тем теста, правил прохождения и критериев аттестации..."
              className="input-field resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Проходной порог (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              className="input-field"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Минимальный процент набранных баллов для зачета теста.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Ограничение времени (минуты)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="1440"
                disabled={!hasTimeLimit}
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                className="input-field disabled:opacity-30"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hasTimeLimit}
                  onChange={(e) => setHasTimeLimit(!e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-slate-200 focus:ring-slate-500 w-3.5 h-3.5"
                />
                Без лимита
              </label>
            </div>
          </div>

          {/* Status & Guest Access Toggles */}
          <div className="md:col-span-2 pt-3 border-t border-slate-800/80 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-slate-200 focus:ring-slate-500 w-4 h-4"
              />
              <span className="text-xs font-semibold text-white">Опубликовать тест сразу</span>
              <span className="text-[11px] text-slate-400">
                (Снимите галочку, чтобы сохранить как черновик `draft`)
              </span>
            </label>

            {/* Guest Access Toggle */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowGuest}
                  onChange={(e) => setAllowGuest(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-slate-200 focus:ring-slate-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Разрешить прохождение по прямой ссылке без регистрации
                </span>
              </label>

              {allowGuest && (
                <div className="pt-1 pl-6">
                  <p className="text-[11px] text-slate-400 mb-2">
                    Гости смогут проходить тест, указав только свое ФИО. Ссылка генерируется автоматически при сохранении теста.
                  </p>
                  {publicToken && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/t/${publicToken}`}
                        className="input-field text-xs font-mono py-1 text-slate-300 max-w-md select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 whitespace-nowrap"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Копировать</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Retake Limit Toggle */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={disallowRetake}
                  onChange={(e) => setDisallowRetake(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-slate-200 focus:ring-slate-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Запретить повторное прохождение
                </span>
              </label>
              <p className="text-[11px] text-slate-400 pl-6">
                Сотрудник сможет пройти тестирование только 1 раз. При включении тумблера повторные попытки будут строго заблокированы платформой.
              </p>
            </div>

            {/* Visibility / Access Mode Selection */}
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Видимость и права доступа к тесту</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                    isAssignedOnly
                      ? 'bg-slate-900 border-slate-600 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="access_mode"
                      checked={isAssignedOnly}
                      onChange={() => setIsAssignedOnly(true)}
                      className="text-slate-100 focus:ring-slate-500 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-semibold text-slate-100">
                      Доступен только назначенным сотрудникам
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                    По умолчанию. Тест появится в каталоге исключительно у сотрудников, которым назначено персональное прохождение.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                    !isAssignedOnly
                      ? 'bg-slate-900 border-slate-600 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="access_mode"
                      checked={!isAssignedOnly}
                      onChange={() => setIsAssignedOnly(false)}
                      className="text-slate-100 focus:ring-slate-500 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                    />
                    <span className="text-xs font-semibold text-slate-100">
                      Общий доступ для всех сотрудников компании
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 pl-5 leading-relaxed">
                    Тест доступен для прохождения всем авторизованным сотрудникам без необходимости индивидуального назначения.
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Questions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>2. Список вопросов</span>
            <span className="text-xs font-normal text-slate-400">({questions.length})</span>
          </h2>

          {/* Quick Add Question Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={openBankModal}
              className="btn-secondary text-[11px] py-1 px-3 flex items-center gap-1.5 text-sky-400 border-sky-500/30 hover:bg-sky-950/40 font-medium shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Добавить из банка вопросов</span>
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1 hidden sm:block" />
            <button
              type="button"
              onClick={() => addQuestion('single_choice')}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Один вариант
            </button>
            <button
              type="button"
              onClick={() => addQuestion('multiple_choice')}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Несколько
            </button>
            <button
              type="button"
              onClick={() => addQuestion('manual_review')}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-slate-200 border-slate-700 hover:border-slate-500"
            >
              <Plus className="w-3 h-3" />
              Ручной ввод
            </button>
            <button
              type="button"
              onClick={() => addQuestion('text')}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-slate-400"
            >
              <Plus className="w-3 h-3" />
              Ключевое слово
            </button>
          </div>
        </div>

        {/* Question Cards */}
        {questions.map((q, qIndex) => (
          <div
            key={q.id || qIndex}
            className="glass-panel p-5 border border-slate-800 shadow-sm relative group"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3 mb-3 pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center text-xs font-bold">
                  {qIndex + 1}
                </span>

                <select
                  value={q.question_type}
                  onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs rounded-md border border-slate-800 py-1 px-2 focus:ring-1 focus:ring-slate-400"
                >
                  <option value="single_choice">Один вариант (1 правильный)</option>
                  <option value="multiple_choice">Несколько вариантов (чекбоксы)</option>
                  <option value="manual_review">Развернутый ответ (ручная проверка админом)</option>
                  <option value="text">Текстовый ответ (авто по ключевым словам)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                  <span className="text-[11px] text-slate-400">Баллы:</span>
                  <input
                    type="number"
                    min="1"
                    value={q.points}
                    onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)}
                    className="w-10 bg-transparent text-xs font-bold text-white text-center focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, -1)}
                  disabled={qIndex === 0}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                  title="Поднять выше"
                >
                  <MoveUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, 1)}
                  disabled={qIndex === questions.length - 1}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20"
                  title="Опустить ниже"
                >
                  <MoveDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteQuestion(qIndex)}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                  title="Удалить вопрос"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="mb-3">
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                placeholder="Введите текст вопроса..."
                className="input-field text-xs sm:text-sm font-medium"
              />
            </div>

            {/* Options based on type */}
            <div>
              {q.question_type === 'manual_review' ? (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
                    <HelpCircle className="w-4 h-4 text-slate-400" />
                    <span>Открытый вопрос со свободным текстовым ответом</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Сотрудник вводит развернутый текст ответа. Вопрос не оценивается автоматически. После сдачи теста попытка переходит в статус «Требует проверки», и проверяющий выставляет балл вручную (от 0 до {q.points}).
                  </p>
                </div>
              ) : q.question_type === 'text' ? (
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Принимаемые ключевые слова:
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-[11px] text-slate-300 hover:text-white font-medium"
                    >
                      + Добавить синоним
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                          placeholder="Например: 2FA, MFA..."
                          className="input-field text-xs py-1.5 font-mono"
                        />
                        {q.options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteOption(qIndex, optIndex)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1.5 block">
                    Регистр букв не учитывается.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>
                      {q.question_type === 'single_choice'
                        ? 'Выберите правильный вариант (радиокнопка):'
                        : 'Отметьте все правильные варианты (чекбоксы):'}
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-[11px] text-slate-300 hover:text-white font-semibold"
                    >
                      + Добавить вариант
                    </button>
                  </div>

                  {q.options.map((opt, optIndex) => (
                    <div
                      key={optIndex}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all ${
                        opt.is_correct
                          ? 'bg-slate-800/80 border-slate-700 text-white'
                          : 'bg-slate-950 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectOption(qIndex, optIndex)}
                        className={`w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors ${
                          q.question_type === 'single_choice'
                            ? `rounded-full border ${
                                opt.is_correct
                                  ? 'border-slate-100 bg-slate-100 text-slate-950'
                                  : 'border-slate-700 hover:border-slate-500'
                              }`
                            : `rounded border ${
                                opt.is_correct
                                  ? 'border-slate-100 bg-slate-100 text-slate-950'
                                  : 'border-slate-700 hover:border-slate-500'
                              }`
                        }`}
                      >
                        {opt.is_correct && <Check className="w-3 h-3 text-slate-950" />}
                      </button>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                        placeholder={`Вариант ${optIndex + 1}`}
                        className="input-field text-xs py-1"
                      />

                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => deleteOption(qIndex, optIndex)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Удалить вариант"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Модальное окно импорта вопросов из банка вопросов */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">
                  Импорт вопросов из банка вопросов
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Фильтры банка: Поиск + Отделы */}
            <div className="space-y-3 pb-3 border-b border-slate-800/80 flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по тексту вопроса или теме..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                />
              </div>

              {/* Табы отделов */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {bankDepartments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setBankDept(dept)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      bankDept === dept
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={toggleSelectAllBank}
                  className="text-sky-400 hover:text-sky-300 font-medium"
                >
                  {filteredBankQuestions.length > 0 &&
                  filteredBankQuestions.every((q) => selectedBankIds.includes(q.id))
                    ? 'Снять выбор со всех'
                    : 'Выбрать все отфильтрованные'}
                </button>
                <span>Найдено в банке: {filteredBankQuestions.length}</span>
              </div>
            </div>

            {/* Список вопросов */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[220px]">
              {bankLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-slate-950/70 border border-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : filteredBankQuestions.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  {bankQuestions.length === 0
                    ? 'Банк вопросов пуст. Создайте вопросы в разделе «Банк вопросов».'
                    : 'По заданному фильтру и поисковому запросу ничего не найдено.'}
                </div>
              ) : (
                filteredBankQuestions.map((bq) => {
                  const isSelected = selectedBankIds.includes(bq.id);
                  return (
                    <div
                      key={bq.id}
                      onClick={() => toggleBankQuestionSelect(bq.id)}
                      className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-sky-950/20 border-sky-500/40 text-slate-100'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px]">
                            {bq.department}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {getQuestionTypeLabel(bq.question_type)}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {bq.points} б.
                          </span>
                        </div>
                        <p className="text-slate-200 font-medium leading-relaxed">
                          {bq.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Футер модалки */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-shrink-0">
              <div className="text-xs text-slate-300">
                Выбрано вопросов: <strong className="text-white">{selectedBankIds.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleImportFromBank}
                  disabled={selectedBankIds.length === 0}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Импортировать выбранные ({selectedBankIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-3 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              Вопросов: <strong className="text-white">{questions.length}</strong>
            </span>
            <span>
              Всего баллов: <strong className="text-slate-200">{totalPoints} б.</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/admin/tests" className="btn-secondary text-xs">
              Отмена
            </Link>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-secondary text-xs"
            >
              Сохранить в черновик
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-primary text-xs"
            >
              {saving ? 'Сохранение...' : 'Опубликовать тест'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
