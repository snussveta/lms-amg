import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Globe,
  HelpCircle,
  MoveDown,
  MoveUp,
  Percent,
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
  const isEditing = Boolean(testId && testId !== 'new');

  // Основные метаданные теста
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [hasTimeLimit, setHasTimeLimit] = useState(true);
  const [isPublished, setIsPublished] = useState(true);
  const [allowGuest, setAllowGuest] = useState(false);
  const [disallowRetake, setDisallowRetake] = useState(false);
  const [isAssignedOnly, setIsAssignedOnly] = useState(true);
  const [publicToken, setPublicToken] = useState(null);

  // Вопросы теста
  const [questions, setQuestions] = useState([
    {
      id: 'temp-1',
      text: '',
      question_type: 'single_choice',
      points: 1,
      options: [
        { text: '', is_correct: true },
        { text: '', is_correct: false },
      ],
    },
  ]);

  // Bank of questions modal states
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankDept, setBankDept] = useState('Все');
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState([]);

  // Статусы сохранения
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isEditing) {
      loadTest();
    }
  }, [testId]);

  const loadTest = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/tests/${testId}`);
      const data = res.data;

      setTitle(data.title);
      setDescription(data.description || '');
      setPassingScore(data.passing_score ?? 70);
      setIsPublished(Boolean(data.is_published));
      setAllowGuest(Boolean(data.allow_guest));
      setDisallowRetake(Boolean(data.disallow_retake));
      setIsAssignedOnly(data.is_assigned_only !== undefined ? Boolean(data.is_assigned_only) : true);
      setPublicToken(data.public_token || null);

      if (data.time_limit_minutes) {
        setHasTimeLimit(true);
        setTimeLimitMinutes(data.time_limit_minutes);
      } else {
        setHasTimeLimit(false);
        setTimeLimitMinutes(30);
      }

      if (data.questions && data.questions.length > 0) {
        setQuestions(
          data.questions.map((q) => ({
            id: q.id,
            text: q.text,
            question_type: q.question_type,
            points: q.points || 1,
            options:
              q.options && q.options.length > 0
                ? q.options.map((opt) => ({
                    id: opt.id,
                    text: opt.text,
                    is_correct: Boolean(opt.is_correct),
                  }))
                : [
                    { text: '', is_correct: true },
                    { text: '', is_correct: false },
                  ],
          }))
        );
      }
    } catch (err) {
      console.error('Ошибка загрузки теста:', err);
      setError('Не удалось загрузить данные теста.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!publicToken) return;
    const link = `${window.location.origin}/t/${publicToken}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Управление списком вопросов
  const addQuestion = (type = 'single_choice') => {
    const newQ = {
      id: `temp-${Date.now()}`,
      text: '',
      question_type: type,
      points: 1,
      options:
        type === 'manual_review'
          ? []
          : [
              { text: '', is_correct: true },
              { text: '', is_correct: false },
            ],
    };
    setQuestions([...questions, newQ]);
  };

  const deleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('В тесте должен присутствовать хотя бы один вопрос.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const moveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // Если меняется тип на manual_review - очищаем варианты
    if (field === 'question_type') {
      if (value === 'manual_review') {
        updated[index].options = [];
      } else if (updated[index].options.length === 0) {
        updated[index].options = [
          { text: '', is_correct: true },
          { text: '', is_correct: false },
        ];
      }
    }

    setQuestions(updated);
  };

  // Управление вариантами ответов внутри вопроса
  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex].options.push({ text: '', is_correct: false });
    setQuestions(updated);
  };

  const deleteOption = (qIndex, optIndex) => {
    const updated = [...questions];
    if (updated[qIndex].options.length <= 2) {
      alert('Вопрос должен иметь минимум 2 варианта ответа.');
      return;
    }
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== optIndex);
    setQuestions(updated);
  };

  const updateOptionText = (qIndex, optIndex, text) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex].text = text;
    setQuestions(updated);
  };

  const setCorrectOption = (qIndex, optIndex) => {
    const updated = [...questions];
    const qType = updated[qIndex].question_type;

    if (qType === 'single_choice') {
      // Снимаем выбор со всех и ставим текущий
      updated[qIndex].options.forEach((opt, idx) => {
        opt.is_correct = idx === optIndex;
      });
    } else if (qType === 'multiple_choice') {
      // Переключаем значение
      updated[qIndex].options[optIndex].is_correct = !updated[qIndex].options[optIndex].is_correct;
    }
    setQuestions(updated);
  };

  // Валидация перед сохранением
  const validateTest = () => {
    if (!title.trim()) {
      setError('Пожалуйста, введите название теста.');
      return false;
    }
    if (questions.length === 0) {
      setError('Тест должен содержать минимум 1 вопрос.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Вопрос #${i + 1} не заполнен.`);
        return false;
      }

      if (q.question_type !== 'manual_review') {
        if (!q.options || q.options.length < 2) {
          setError(`Вопрос #${i + 1} должен содержать как минимум 2 варианта ответа.`);
          return false;
        }

        const emptyOption = q.options.some((o) => !o.text.trim());
        if (emptyOption) {
          setError(`Вопрос #${i + 1} содержит незаполненные варианты ответов.`);
          return false;
        }

        const hasCorrect = q.options.some((o) => o.is_correct);
        if (!hasCorrect) {
          setError(`В вопросе #${i + 1} не выбран ни один правильный ответ.`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSave = async (forceDraft = false) => {
    setError('');
    if (!validateTest()) return;

    try {
      setSaving(true);

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        passing_score: parseInt(passingScore, 10) || 70,
        time_limit_minutes: hasTimeLimit ? parseInt(timeLimitMinutes, 10) || null : null,
        is_published: forceDraft ? false : isPublished,
        allow_guest: allowGuest,
        disallow_retake: disallowRetake,
        is_assigned_only: isAssignedOnly,
        questions: questions.map((q, idx) => ({
          text: q.text.trim(),
          question_type: q.question_type,
          points: parseInt(q.points, 10) || 1,
          order_index: idx,
          options:
            q.question_type === 'manual_review'
              ? []
              : q.options.map((opt) => ({
                  text: opt.text.trim(),
                  is_correct: Boolean(opt.is_correct),
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

  // Подгрузка банка вопросов
  const openBankModal = async () => {
    setIsBankModalOpen(true);
    setSelectedBankIds([]);
    try {
      setBankLoading(true);
      const res = await api.get('/question-bank');
      setBankQuestions(res.data || []);
    } catch (err) {
      console.error('Ошибка загрузки банка вопросов:', err);
    } finally {
      setBankLoading(false);
    }
  };

  const bankDepartments = ['Все', 'СТО', 'IT', 'Продажи', 'Общий'];

  const filteredBankQuestions = bankQuestions.filter((q) => {
    const matchesDept = bankDept === 'Все' || q.department === bankDept;
    const matchesSearch =
      !bankSearch.trim() ||
      q.text.toLowerCase().includes(bankSearch.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(bankSearch.toLowerCase()));
    return matchesDept && matchesSearch;
  });

  const toggleBankQuestionSelect = (qId) => {
    setSelectedBankIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const toggleSelectAllBank = () => {
    const currentFilteredIds = filteredBankQuestions.map((q) => q.id);
    const allSelected = currentFilteredIds.every((id) => selectedBankIds.includes(id));
    if (allSelected) {
      setSelectedBankIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedBankIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleImportFromBank = () => {
    const toImport = bankQuestions.filter((q) => selectedBankIds.includes(q.id));
    const newItems = toImport.map((bq) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      text: bq.text,
      question_type: bq.question_type,
      points: bq.points || 1,
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
        <div className="w-8 h-8 border-3 border-[#003B73] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-32">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/admin/tests"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6C757D] hover:text-[#003B73] transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад к списку тестов</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-[#212529]">
            {isEditing ? 'Редактирование теста' : 'Конструктор теста'}
          </h1>
          <p className="text-[#6C757D] text-xs sm:text-sm mt-0.5">
            Настройка параметров, выбор типов вопросов и регламентов прохождения.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-[#E0E0E0] shadow-2xs text-xs">
            <span className="text-[#6C757D]">Всего баллов: </span>
            <span className="font-bold text-[#003B73]">{totalPoints} б.</span>
          </div>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="btn-secondary text-xs min-h-[40px] px-3.5"
          >
            В черновик
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="btn-primary text-xs flex items-center gap-1.5 min-h-[40px] px-4 font-bold"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Сохранение...' : 'Сохранить тест'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[#E30613] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* General Parameters */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-5 sm:p-6 mb-6 space-y-4">
        <h2 className="text-sm font-bold text-[#212529] border-b border-[#E0E0E0] pb-2.5">
          1. Общие параметры теста
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#212529]">
              Название теста *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Информационная безопасность и защита данных 2026"
              className="input-field bg-white"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#212529]">
              Описание / Инструкции для тестируемого
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание тем теста, правил прохождения и критериев аттестации..."
              className="input-field resize-none bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#212529]">
              Проходной порог (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
              className="input-field bg-white"
            />
            <span className="text-[11px] text-[#6C757D] block">
              Минимальный процент набранных баллов для зачета теста.
            </span>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#212529]">
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
                className="input-field disabled:opacity-40 bg-white"
              />
              <label className="flex items-center gap-1.5 text-xs text-[#212529] font-medium whitespace-nowrap cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={!hasTimeLimit}
                  onChange={(e) => setHasTimeLimit(!e.target.checked)}
                  className="rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] w-4 h-4 cursor-pointer"
                />
                Без лимита
              </label>
            </div>
          </div>

          {/* Status & Guest Access Toggles */}
          <div className="md:col-span-2 pt-3 border-t border-[#E0E0E0] space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold text-[#212529]">Опубликовать тест сразу</span>
              <span className="text-[11px] text-[#6C757D]">
                (Снимите галочку, чтобы сохранить как черновик `draft`)
              </span>
            </label>

            {/* Guest Access Toggle */}
            <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowGuest}
                  onChange={(e) => setAllowGuest(e.target.checked)}
                  className="rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-[#212529] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#003B73]" />
                  Разрешить прохождение по прямой ссылке без регистрации
                </span>
              </label>

              {allowGuest && (
                <div className="pt-1 pl-6">
                  <p className="text-[11px] text-[#6C757D] mb-2 leading-relaxed">
                    Гости смогут проходить тест, указав только свое ФИО. Ссылка генерируется автоматически при сохранении теста.
                  </p>
                  {publicToken && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/t/${publicToken}`}
                        className="input-field text-xs font-mono py-1.5 text-[#212529] max-w-md select-all bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleCopyLink}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 whitespace-nowrap min-h-[38px]"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
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
            <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={disallowRetake}
                  onChange={(e) => setDisallowRetake(e.target.checked)}
                  className="rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-bold text-[#212529] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#003B73]" />
                  Запретить повторное прохождение
                </span>
              </label>
              <p className="text-[11px] text-[#6C757D] pl-6 leading-relaxed">
                Сотрудник сможет пройти тестирование только 1 раз. При включении тумблера повторные попытки будут строго заблокированы платформой.
              </p>
            </div>

            {/* Visibility / Access Mode Selection */}
            <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#212529]">
                <Users className="w-4 h-4 text-[#003B73]" />
                <span>Видимость и права доступа к тесту</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                    isAssignedOnly
                      ? 'bg-white border-[#003B73] shadow-sm ring-1 ring-[#003B73]/20'
                      : 'bg-white/60 border-[#E0E0E0] text-[#6C757D] hover:border-[#003B73]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="access_mode"
                      checked={isAssignedOnly}
                      onChange={() => setIsAssignedOnly(true)}
                      className="text-[#003B73] focus:ring-[#003B73] border-[#E0E0E0] w-4 h-4"
                    />
                    <span className="text-xs font-bold text-[#212529]">
                      Доступен только назначенным сотрудникам
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6C757D] pl-6 leading-relaxed">
                    По умолчанию. Тест появится в каталоге исключительно у сотрудников, которым назначено персональное прохождение.
                  </span>
                </label>

                <label
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                    !isAssignedOnly
                      ? 'bg-white border-[#003B73] shadow-sm ring-1 ring-[#003B73]/20'
                      : 'bg-white/60 border-[#E0E0E0] text-[#6C757D] hover:border-[#003B73]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="access_mode"
                      checked={!isAssignedOnly}
                      onChange={() => setIsAssignedOnly(false)}
                      className="text-[#003B73] focus:ring-[#003B73] border-[#E0E0E0] w-4 h-4"
                    />
                    <span className="text-xs font-bold text-[#212529]">
                      Общий доступ для всех сотрудников компании
                    </span>
                  </div>
                  <span className="text-[11px] text-[#6C757D] pl-6 leading-relaxed">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#212529] flex items-center gap-2">
            <span>2. Список вопросов</span>
            <span className="text-xs font-normal text-[#6C757D]">({questions.length})</span>
          </h2>

          {/* Quick Add Question Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={openBankModal}
              className="btn-secondary text-[11px] py-1.5 px-3 flex items-center gap-1.5 text-[#003B73] border-[#003B73]/30 hover:bg-[#003B73]/5 font-bold shadow-2xs min-h-[36px]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Добавить из банка вопросов</span>
            </button>
            <div className="w-px h-4 bg-[#E0E0E0] mx-1 hidden sm:block" />
            <button
              type="button"
              onClick={() => addQuestion('single_choice')}
              className="btn-secondary text-[11px] py-1.5 px-2.5 flex items-center gap-1 min-h-[36px]"
            >
              <Plus className="w-3 h-3" />
              Один вариант
            </button>
            <button
              type="button"
              onClick={() => addQuestion('multiple_choice')}
              className="btn-secondary text-[11px] py-1.5 px-2.5 flex items-center gap-1 min-h-[36px]"
            >
              <Plus className="w-3 h-3" />
              Несколько
            </button>
            <button
              type="button"
              onClick={() => addQuestion('manual_review')}
              className="btn-secondary text-[11px] py-1.5 px-2.5 flex items-center gap-1 min-h-[36px]"
            >
              <Plus className="w-3 h-3" />
              Ручной ввод
            </button>
            <button
              type="button"
              onClick={() => addQuestion('text')}
              className="btn-secondary text-[11px] py-1.5 px-2.5 flex items-center gap-1 text-[#6C757D] min-h-[36px]"
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
            className="bg-white rounded-2xl p-5 border border-[#E0E0E0] shadow-sm relative group space-y-3"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#E0E0E0] flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#003B73] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {qIndex + 1}
                </span>

                <select
                  value={q.question_type}
                  onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                  className="bg-[#F4F5F7] text-[#212529] text-xs font-bold rounded-lg border border-[#E0E0E0] py-1 px-2.5 focus:border-[#003B73] min-h-[34px]"
                >
                  <option value="single_choice">Один вариант (1 правильный)</option>
                  <option value="multiple_choice">Несколько вариантов (чекбоксы)</option>
                  <option value="manual_review">Развернутый ответ (ручная проверка админом)</option>
                  <option value="text">Текстовый ответ (авто по ключевым словам)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-[#F4F5F7] px-2.5 py-1 rounded-lg border border-[#E0E0E0]">
                  <span className="text-[11px] font-bold text-[#6C757D]">Баллы:</span>
                  <input
                    type="number"
                    min="1"
                    value={q.points}
                    onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)}
                    className="w-10 bg-transparent text-xs font-bold text-[#003B73] text-center focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, -1)}
                  disabled={qIndex === 0}
                  className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] disabled:opacity-20 transition-colors"
                  title="Поднять выше"
                >
                  <MoveUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveQuestion(qIndex, 1)}
                  disabled={qIndex === questions.length - 1}
                  className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] disabled:opacity-20 transition-colors"
                  title="Опустить ниже"
                >
                  <MoveDown className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteQuestion(qIndex)}
                  className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-red-50 transition-colors"
                  title="Удалить вопрос"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <input
                type="text"
                value={q.text}
                onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                placeholder="Введите текст вопроса..."
                className="input-field text-xs sm:text-sm font-semibold bg-white"
              />
            </div>

            {/* Options based on type */}
            <div>
              {q.question_type === 'manual_review' ? (
                <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] text-xs">
                  <div className="flex items-center gap-2 text-[#003B73] font-bold mb-1">
                    <HelpCircle className="w-4 h-4 text-[#003B73]" />
                    <span>Открытый вопрос со свободным текстовым ответом</span>
                  </div>
                  <p className="text-[11px] text-[#6C757D] leading-relaxed">
                    Сотрудник вводит развернутый текст ответа. Вопрос не оценивается автоматически. После сдачи теста попытка переходит в статус «Требует проверки», и проверяющий выставляет балл вручную (от 0 до {q.points}).
                  </p>
                </div>
              ) : q.question_type === 'text' ? (
                <div className="bg-[#F4F5F7] p-3.5 rounded-xl border border-[#E0E0E0]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#212529]">
                      Принимаемые ключевые слова:
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-[11px] text-[#003B73] hover:underline font-bold"
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
                          className="input-field text-xs py-1.5 font-mono bg-white"
                        />
                        {q.options.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteOption(qIndex, optIndex)}
                            className="p-1.5 text-[#6C757D] hover:text-[#E30613]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] text-[#6C757D] mt-1.5 block">
                    Регистр букв не учитывается.
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#6C757D] flex items-center justify-between">
                    <span>
                      {q.question_type === 'single_choice'
                        ? 'Выберите правильный вариант (радиокнопка):'
                        : 'Отметьте все правильные варианты (чекбоксы):'}
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(qIndex)}
                      className="text-[11px] text-[#003B73] hover:underline font-bold"
                    >
                      + Добавить вариант
                    </button>
                  </div>

                  {q.options.map((opt, optIndex) => (
                    <div
                      key={optIndex}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                        opt.is_correct
                          ? 'bg-[#003B73]/5 border-[#003B73] text-[#212529]'
                          : 'bg-white border-[#E0E0E0] text-[#212529]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setCorrectOption(qIndex, optIndex)}
                        className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-colors ${
                          q.question_type === 'single_choice'
                            ? `rounded-full border ${
                                opt.is_correct
                                  ? 'border-[#003B73] bg-[#003B73] text-white'
                                  : 'border-[#E0E0E0] hover:border-[#003B73]'
                              }`
                            : `rounded-md border ${
                                opt.is_correct
                                  ? 'border-[#003B73] bg-[#003B73] text-white'
                                  : 'border-[#E0E0E0] hover:border-[#003B73]'
                              }`
                        }`}
                      >
                        {opt.is_correct && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                        placeholder={`Вариант ${optIndex + 1}`}
                        className="input-field text-xs py-1.5 bg-white"
                      />

                      {q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => deleteOption(qIndex, optIndex)}
                          className="p-1.5 text-[#6C757D] hover:text-[#E30613] transition-colors"
                          title="Удалить вариант"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#003B73]/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-[#E0E0E0] rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl relative my-8 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E0E0] mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#003B73]" />
                <h3 className="text-base font-bold text-[#212529]">
                  Импорт вопросов из банка вопросов
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Фильтры банка: Поиск + Отделы */}
            <div className="space-y-3 pb-3 border-b border-[#E0E0E0] flex-shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-[#6C757D] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по тексту вопроса или теме..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="input-field pl-10 text-xs sm:text-sm bg-white"
                />
              </div>

              {/* Табы отделов */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {bankDepartments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setBankDept(dept)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors min-h-[34px] ${
                      bankDept === dept
                        ? 'bg-[#003B73] text-white shadow-2xs'
                        : 'bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] border border-[#E0E0E0]'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-[#6C757D] pt-1">
                <button
                  type="button"
                  onClick={toggleSelectAllBank}
                  className="text-[#003B73] hover:underline font-bold"
                >
                  {filteredBankQuestions.length > 0 &&
                  filteredBankQuestions.every((q) => selectedBankIds.includes(q.id))
                    ? 'Снять выбор со всех'
                    : 'Выбрать все отфильтрованные'}
                </button>
                <span className="font-medium">Найдено: {filteredBankQuestions.length}</span>
              </div>
            </div>

            {/* Список вопросов */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-[220px]">
              {bankLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-[#F4F5F7] animate-pulse" />
                  ))}
                </div>
              ) : filteredBankQuestions.length === 0 ? (
                <div className="p-8 text-center text-[#6C757D] text-xs">
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
                          ? 'bg-[#003B73]/5 border-[#003B73] text-[#212529]'
                          : 'bg-white border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#212529]'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] w-4 h-4 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-bold bg-[#F4F5F7] text-[#003B73] border border-[#E0E0E0] text-[10px]">
                            {bq.department}
                          </span>
                          <span className="text-[#6C757D] text-[11px]">
                            {getQuestionTypeLabel(bq.question_type)}
                          </span>
                          <span className="text-[#6C757D] font-mono text-[11px]">
                            {bq.points} б.
                          </span>
                        </div>
                        <p className="text-[#212529] font-medium leading-relaxed">
                          {bq.text}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Футер модалки */}
            <div className="pt-3 border-t border-[#E0E0E0] flex items-center justify-between flex-shrink-0">
              <div className="text-xs text-[#6C757D]">
                Выбрано: <strong className="text-[#003B73] font-bold">{selectedBankIds.length}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="btn-secondary text-xs min-h-[40px] px-4"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleImportFromBank}
                  disabled={selectedBankIds.length === 0}
                  className="btn-primary text-xs flex items-center gap-1.5 min-h-[40px] px-5 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Импортировать ({selectedBankIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-[#E0E0E0] p-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-[#6C757D]">
            <span>
              Вопросов: <strong className="text-[#212529]">{questions.length}</strong>
            </span>
            <span className="hidden sm:inline">•</span>
            <span>
              Баллов: <strong className="text-[#003B73]">{totalPoints} б.</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/admin/tests" className="btn-secondary text-xs min-h-[38px] px-3.5">
              Отмена
            </Link>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-secondary text-xs min-h-[38px] px-3.5"
            >
              В черновик
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-primary text-xs min-h-[38px] px-4 font-bold"
            >
              {saving ? 'Сохранение...' : 'Опубликовать тест'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
