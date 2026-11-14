import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Circle,
  CircleDot,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileEdit,
  FileText,
  Globe,
  GripVertical,
  HelpCircle,
  Layers,
  ListOrdered,
  Lock,
  Minus,
  MoveDown,
  MoveUp,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const TestConstructorPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(testId && testId !== 'new');

  // Top Tabs: 'questions' | 'settings'
  const [activeTab, setActiveTab] = useState('questions');

  // Active question card (focused like in Google Forms)
  const [activeQIndex, setActiveQIndex] = useState(0);

  // Answer Key Mode for individual questions (like Google Forms "Ответы и баллы")
  const [answerKeyMode, setAnswerKeyMode] = useState({});

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
      required: true,
      options: [
        { text: 'Вариант 1', is_correct: true },
        { text: 'Вариант 2', is_correct: false },
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

      setTitle(data.title || '');
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
            required: true,
            options:
              q.options && q.options.length > 0
                ? q.options.map((opt) => ({
                    id: opt.id,
                    text: opt.text,
                    is_correct: Boolean(opt.is_correct),
                  }))
                : [
                    { text: 'Вариант 1', is_correct: true },
                    { text: 'Вариант 2', is_correct: false },
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

  // Google Forms: Question Management
  const addQuestion = (type = 'single_choice', insertAfterIndex = null) => {
    const newQ = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: '',
      question_type: type,
      points: 1,
      required: true,
      options:
        type === 'manual_review'
          ? []
          : type === 'text'
          ? [{ text: '', is_correct: true }]
          : [
              { text: 'Вариант 1', is_correct: true },
              { text: 'Вариант 2', is_correct: false },
            ],
    };

    if (insertAfterIndex !== null && insertAfterIndex >= 0 && insertAfterIndex < questions.length) {
      const updated = [...questions];
      updated.splice(insertAfterIndex + 1, 0, newQ);
      setQuestions(updated);
      setActiveQIndex(insertAfterIndex + 1);
    } else {
      setQuestions([...questions, newQ]);
      setActiveQIndex(questions.length);
    }
  };

  // Google Forms: Duplicate Question
  const duplicateQuestion = (index) => {
    const sourceQ = questions[index];
    const clonedQ = {
      ...sourceQ,
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: sourceQ.text ? `${sourceQ.text} (копия)` : '',
      options: (sourceQ.options || []).map((opt) => ({
        ...opt,
        id: undefined,
      })),
    };
    const updated = [...questions];
    updated.splice(index + 1, 0, clonedQ);
    setQuestions(updated);
    setActiveQIndex(index + 1);
  };

  const deleteQuestion = (index) => {
    if (questions.length <= 1) {
      alert('В форме должен присутствовать хотя бы один вопрос.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
    if (activeQIndex >= updated.length) {
      setActiveQIndex(updated.length - 1);
    }
  };

  const moveQuestion = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setQuestions(updated);
    setActiveQIndex(targetIndex);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // При смене типа обновляем структуру вариантов
    if (field === 'question_type') {
      if (value === 'manual_review') {
        updated[index].options = [];
      } else if (value === 'text') {
        if (!updated[index].options || updated[index].options.length === 0) {
          updated[index].options = [{ text: '', is_correct: true }];
        }
      } else {
        if (!updated[index].options || updated[index].options.length === 0) {
          updated[index].options = [
            { text: 'Вариант 1', is_correct: true },
            { text: 'Вариант 2', is_correct: false },
          ];
        }
      }
    }

    setQuestions(updated);
  };

  // Options Management
  const addOption = (qIndex, customLabel = null) => {
    const updated = [...questions];
    const nextNum = (updated[qIndex].options?.length || 0) + 1;
    const text = customLabel || `Вариант ${nextNum}`;
    updated[qIndex].options.push({ text, is_correct: false });
    setQuestions(updated);
  };

  const deleteOption = (qIndex, optIndex) => {
    const updated = [...questions];
    if (updated[qIndex].options.length <= 1) {
      alert('В вопросе должен оставаться хотя бы один вариант ответа.');
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

  const toggleOptionCorrect = (qIndex, optIndex) => {
    const updated = [...questions];
    const qType = updated[qIndex].question_type;

    if (qType === 'single_choice' || qType === 'dropdown') {
      updated[qIndex].options.forEach((opt, idx) => {
        opt.is_correct = idx === optIndex;
      });
    } else if (qType === 'multiple_choice') {
      updated[qIndex].options[optIndex].is_correct = !updated[qIndex].options[optIndex].is_correct;
    } else if (qType === 'text') {
      updated[qIndex].options[optIndex].is_correct = true;
    }
    setQuestions(updated);
  };

  const toggleAnswerKey = (qIndex) => {
    setAnswerKeyMode((prev) => ({
      ...prev,
      [qIndex]: !prev[qIndex],
    }));
  };

  // Validation
  const validateTest = () => {
    if (!title.trim()) {
      setError('Пожалуйста, введите название формы теста.');
      setActiveTab('questions');
      return false;
    }
    if (questions.length === 0) {
      setError('Форма должна содержать минимум 1 вопрос.');
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Вопрос #${i + 1} не содержит формулировки.`);
        setActiveQIndex(i);
        setActiveTab('questions');
        return false;
      }

      if (q.question_type !== 'manual_review') {
        if (!q.options || q.options.length < 1) {
          setError(`Вопрос #${i + 1} должен содержать варианты ответов.`);
          setActiveQIndex(i);
          setActiveTab('questions');
          return false;
        }

        const emptyOption = q.options.some((o) => !o.text.trim());
        if (emptyOption) {
          setError(`Вопрос #${i + 1} содержит пустые варианты ответов.`);
          setActiveQIndex(i);
          setActiveTab('questions');
          return false;
        }

        const hasCorrect = q.options.some((o) => o.is_correct);
        if (!hasCorrect) {
          setError(`В вопросе #${i + 1} укажите правильный ответ (нажмите «Ответы и баллы»).`);
          setActiveQIndex(i);
          setActiveTab('questions');
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
          order: idx,
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
      setError(getErrorMessage(err, 'Не удалось сохранить тест. Проверьте правильность заполнения.'));
    } finally {
      setSaving(false);
    }
  };

  // Question Bank
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

  const handleImportFromBank = () => {
    const toImport = bankQuestions.filter((q) => selectedBankIds.includes(q.id));
    const newItems = toImport.map((bq) => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      text: bq.text,
      question_type: bq.question_type || 'single_choice',
      points: bq.points || 1,
      required: true,
      options: (bq.options || []).map((opt) => ({
        text: opt.text,
        is_correct: Boolean(opt.is_correct),
      })),
    }));
    setQuestions((prev) => [...prev, ...newItems]);
    setIsBankModalOpen(false);
    setSelectedBankIds([]);
  };

  const totalPoints = questions.reduce((sum, q) => sum + (parseInt(q.points, 10) || 0), 0);

  const QUESTION_TYPES = [
    {
      id: 'single_choice',
      label: 'Один из списка',
      icon: CircleDot,
      desc: 'Выбор одного верного варианта',
    },
    {
      id: 'multiple_choice',
      label: 'Несколько из списка',
      icon: CheckSquare,
      desc: 'Чекбоксы с несколькими верными ответами',
    },
    {
      id: 'dropdown',
      label: 'Раскрывающийся список',
      icon: ListOrdered,
      desc: 'Выпадающий селектор из вариантов',
    },
    {
      id: 'text',
      label: 'Текст (строка)',
      icon: FileText,
      desc: 'Краткий текстовый ответ по ключевым словам',
    },
    {
      id: 'manual_review',
      label: 'Текст (абзац)',
      icon: FileEdit,
      desc: 'Развернутый ответ с ручной проверкой экзаменатором',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="w-8 h-8 border-3 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-36">
      {/* Google Forms Top Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#EEEEEE] shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            {/* Left Brand & Title */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/admin/tests"
                className="p-2 rounded-xl text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] transition-colors shrink-0"
                title="Назад к списку тестов"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#222222] truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                    {title ? title : 'Конструктор теста'}
                  </span>
                </div>
              </div>
            </div>

            {/* Center Tabs: Вопросы / Настройки */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'questions'
                    ? 'border-[#E84C3D] text-[#141414]'
                    : 'border-transparent text-[#777777] hover:text-[#222222]'
                }`}
              >
                <span>Вопросы</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#F5F5F7] font-mono">
                  {questions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'border-[#E84C3D] text-[#141414]'
                    : 'border-transparent text-[#777777] hover:text-[#222222]'
                }`}
              >
                <SettingsIcon className="w-3.5 h-3.5" />
                <span>Настройки</span>
              </button>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center px-2.5 py-1 rounded-lg bg-[#F5F5F7] border border-[#EEEEEE] text-xs font-bold text-[#141414]">
                <span>Всего: {totalPoints} б.</span>
              </div>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-secondary text-xs px-3 py-1.5 min-h-[38px] hidden md:inline-flex"
                title="Сохранить как черновик"
              >
                В черновик
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 font-bold min-h-[38px]"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 relative">
        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-[#FCECEB] border border-[#F8D3D0] flex items-start gap-3 text-[#E84C3D] text-xs sm:text-sm shadow-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-[#E84C3D]/70 hover:text-[#E84C3D]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 1: QUESTIONS (GOOGLE FORMS EDITOR)                         */}
        {/* ============================================================== */}
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {/* Google Forms Header Card */}
            <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-sm overflow-hidden border-t-8 border-t-[#E84C3D]">
              <div className="p-6 sm:p-8 space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Новая форма теста"
                  className="w-full text-2xl sm:text-3xl font-black text-[#222222] border-b-2 border-transparent hover:border-[#EEEEEE] focus:border-[#E84C3D] focus:outline-none transition-colors pb-1 placeholder:text-[#CED4DA]"
                />
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Описание формы / Инструкции для тестируемого..."
                  className="w-full text-xs sm:text-sm text-[#495057] border-b border-transparent hover:border-[#EEEEEE] focus:border-[#141414] focus:outline-none transition-colors pb-1 resize-none placeholder:text-[#CED4DA]"
                />
              </div>
            </div>

            {/* Questions List */}
            {questions.map((q, qIndex) => {
              const isActive = activeQIndex === qIndex;
              const isKeyMode = Boolean(answerKeyMode[qIndex]);
              const currentTypeObj =
                QUESTION_TYPES.find((t) => t.id === q.question_type) || QUESTION_TYPES[0];
              const IconComponent = currentTypeObj.icon;

              return (
                <div
                  key={q.id || qIndex}
                  onClick={() => setActiveQIndex(qIndex)}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isActive
                      ? 'border-[#CED4DA] shadow-lg border-l-8 border-l-[#E84C3D]'
                      : 'border-[#EEEEEE] shadow-xs hover:border-[#CED4DA]'
                  }`}
                >
                  <div className="p-5 sm:p-6 space-y-5">
                    {/* Top Row: Question Title & Question Type Selector */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3">
                      <div className="flex-1 flex items-start gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-[#141414] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-2xs">
                          {qIndex + 1}
                        </span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={q.text}
                            onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                            placeholder="Вопрос без заголовка"
                            className="w-full text-sm sm:text-base font-bold text-[#222222] bg-[#F5F5F7] border border-transparent hover:border-[#CED4DA] focus:border-[#141414] focus:bg-white rounded-xl px-3.5 py-2.5 transition-all outline-none"
                          />
                        </div>
                      </div>

                      {/* Question Type Dropdown (Google Forms Style) */}
                      <div className="sm:w-64 shrink-0">
                        <select
                          value={q.question_type}
                          onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                          className="w-full bg-white text-[#222222] text-xs font-bold rounded-xl border border-[#CED4DA] py-2.5 px-3 focus:ring-2 focus:ring-[#141414]/20 focus:border-[#141414] min-h-[42px] cursor-pointer shadow-2xs"
                        >
                          {QUESTION_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Question Options Body */}
                    <div className="pt-2">
                      {/* 1. SINGLE CHOICE & DROPDOWN */}
                      {(q.question_type === 'single_choice' || q.question_type === 'dropdown') && (
                        <div className="space-y-2.5">
                          {q.options.map((opt, optIndex) => (
                            <div
                              key={optIndex}
                              className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                                opt.is_correct
                                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                                  : 'border-transparent hover:border-[#EEEEEE]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleOptionCorrect(qIndex, optIndex)}
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                  opt.is_correct
                                    ? 'bg-emerald-600 text-white'
                                    : 'border-2 border-[#CED4DA] text-transparent hover:border-emerald-600'
                                }`}
                                title="Нажмите, чтобы отметить как правильный ответ"
                              >
                                {opt.is_correct ? (
                                  <Check className="w-3 h-3 stroke-[3]" />
                                ) : (
                                  <Circle className="w-3 h-3 text-transparent" />
                                )}
                              </button>

                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                                placeholder={`Вариант ${optIndex + 1}`}
                                className="flex-1 text-xs sm:text-sm bg-transparent border-b border-[#EEEEEE] hover:border-[#CED4DA] focus:border-[#141414] focus:outline-none py-1.5 transition-colors"
                              />

                              {opt.is_correct && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                                  Правильный
                                </span>
                              )}

                              {q.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => deleteOption(qIndex, optIndex)}
                                  className="p-1 text-[#777777] hover:text-[#E84C3D] rounded-lg transition-colors"
                                  title="Удалить вариант"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}

                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => addOption(qIndex)}
                              className="text-xs font-bold text-[#E84C3D] hover:underline inline-flex items-center gap-1.5 px-2 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Добавить вариант</span>
                            </button>
                            <span className="text-xs text-[#CED4DA]">или</span>
                            <button
                              type="button"
                              onClick={() => addOption(qIndex, 'Другое...')}
                              className="text-xs text-[#777777] hover:text-[#141414] hover:underline"
                            >
                              добавить вариант «Другое»
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. MULTIPLE CHOICE */}
                      {q.question_type === 'multiple_choice' && (
                        <div className="space-y-2.5">
                          <p className="text-[11px] text-[#777777] font-semibold mb-1">
                            Отметьте галочками все правильные варианты ответов (несколько правильных):
                          </p>
                          {q.options.map((opt, optIndex) => (
                            <div
                              key={optIndex}
                              className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${
                                opt.is_correct
                                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                                  : 'border-transparent hover:border-[#EEEEEE]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => toggleOptionCorrect(qIndex, optIndex)}
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                  opt.is_correct
                                    ? 'bg-emerald-600 text-white'
                                    : 'border-2 border-[#CED4DA] text-transparent hover:border-emerald-600'
                                }`}
                                title="Переключить правильность ответа"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </button>

                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                                placeholder={`Вариант ${optIndex + 1}`}
                                className="flex-1 text-xs sm:text-sm bg-transparent border-b border-[#EEEEEE] hover:border-[#CED4DA] focus:border-[#141414] focus:outline-none py-1.5 transition-colors"
                              />

                              {opt.is_correct && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                                  Правильный
                                </span>
                              )}

                              {q.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => deleteOption(qIndex, optIndex)}
                                  className="p-1 text-[#777777] hover:text-[#E84C3D] rounded-lg transition-colors"
                                  title="Удалить вариант"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}

                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => addOption(qIndex)}
                              className="text-xs font-bold text-[#E84C3D] hover:underline inline-flex items-center gap-1.5 px-2 py-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Добавить вариант</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. SHORT TEXT (Краткий текстовый ответ) */}
                      {q.question_type === 'text' && (
                        <div className="space-y-3 p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE]">
                          <div className="text-xs text-[#777777] border-b border-[#CED4DA] pb-2 font-mono">
                            Краткий ответ (вводится пользователем вручную)
                          </div>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#222222] block mb-1">
                              Принимаемые правильные ответы (синонимы):
                            </span>
                            <div className="space-y-2">
                              {q.options.map((opt, optIndex) => (
                                <div key={optIndex} className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-[#777777] w-6">
                                    {optIndex + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                                    placeholder="Например: ABS, Антиблокировочная система..."
                                    className="input-field text-xs sm:text-sm bg-white flex-1"
                                  />
                                  {q.options.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => deleteOption(qIndex, optIndex)}
                                      className="p-1.5 text-[#777777] hover:text-[#E84C3D]"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => addOption(qIndex, '')}
                              className="text-xs font-bold text-[#E84C3D] hover:underline mt-2 inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Добавить еще один правильный вариант</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 4. PARAGRAPH (Развернутый ответ / ручная проверка) */}
                      {q.question_type === 'manual_review' && (
                        <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-2 text-xs">
                          <div className="flex items-center gap-2 font-bold text-[#222222]">
                            <FileEdit className="w-4 h-4 text-[#141414]" />
                            <span>Развернутый ответ (абзац)</span>
                          </div>
                          <div className="text-[#777777] border-b border-[#CED4DA] pb-2 font-mono">
                            Текст развернутого ответа... (многострочное поле ввода)
                          </div>
                          <p className="text-[11px] text-[#777777] leading-relaxed">
                            Сотрудник дает свободный ответ. Этот вопрос не оценивается автоматически. После сдачи теста результат направляется экзаменатору для ручного выставления баллов (от 0 до {q.points}).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Google Forms Bottom Bar for Question */}
                    <div className="pt-4 border-t border-[#EEEEEE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      {/* Left: Answer Key / Баллы */}
                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 bg-[#F5F5F7] px-3 py-1.5 rounded-xl border border-[#EEEEEE]">
                          <span className="font-bold text-[#777777] text-[11px] uppercase tracking-wider">
                            Баллы:
                          </span>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={q.points}
                            onChange={(e) =>
                              updateQuestion(qIndex, 'points', parseInt(e.target.value, 10) || 1)
                            }
                            className="w-12 bg-white text-center font-bold text-xs text-[#141414] rounded border border-[#CED4DA] py-0.5 focus:outline-none focus:border-[#141414]"
                          />
                        </div>

                        {q.question_type !== 'manual_review' && (
                          <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              Правильных:{' '}
                              {q.options.filter((o) => o.is_correct).length}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions (Duplicate, Delete, Required, Move) */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => duplicateQuestion(qIndex)}
                          className="p-2 rounded-xl text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] transition-colors"
                          title="Создать копию вопроса (дублировать)"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteQuestion(qIndex)}
                          className="p-2 rounded-xl text-[#777777] hover:text-[#E84C3D] hover:bg-[#FCECEB] transition-colors"
                          title="Удалить вопрос"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="w-px h-5 bg-[#EEEEEE] mx-1" />

                        {/* Reorder Up/Down */}
                        <button
                          type="button"
                          onClick={() => moveQuestion(qIndex, -1)}
                          disabled={qIndex === 0}
                          className="p-2 rounded-xl text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] disabled:opacity-20 transition-colors"
                          title="Переместить выше"
                        >
                          <MoveUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(qIndex, 1)}
                          disabled={qIndex === questions.length - 1}
                          className="p-2 rounded-xl text-[#777777] hover:text-[#141414] hover:bg-[#F5F5F7] disabled:opacity-20 transition-colors"
                          title="Переместить ниже"
                        >
                          <MoveDown className="w-4 h-4" />
                        </button>

                        <div className="w-px h-5 bg-[#EEEEEE] mx-1" />

                        {/* Required Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none pl-1">
                          <span className="text-xs font-semibold text-[#777777]">Обязательный</span>
                          <input
                            type="checkbox"
                            checked={q.required !== false}
                            onChange={(e) => updateQuestion(qIndex, 'required', e.target.checked)}
                            className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-4 h-4 cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SETTINGS (GOOGLE FORMS QUIZ CONFIGURATION)              */}
        {/* ============================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-5 animate-fade-in">
            {/* 1. Quiz Grading Card */}
            <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 border-b border-[#EEEEEE] pb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#222222]">Тест и оценивание ответов</h3>
                  <p className="text-xs text-[#777777]">
                    Параметры начисления баллов, проходного порога и аттестации
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE]">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#222222] block">
                      Проходной порог аттестации (%)
                    </span>
                    <span className="text-[11px] text-[#777777]">
                      Минимальный процент набранных баллов для успешной сдачи теста
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                      className="input-field w-20 text-center font-bold text-sm bg-white"
                    />
                    <span className="font-bold text-xs text-[#777777]">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE]">
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#222222] block">
                      Ограничение времени на прохождение
                    </span>
                    <span className="text-[11px] text-[#777777]">
                      Таймер обратного отсчета для тестируемого сотрудника
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      disabled={!hasTimeLimit}
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(e.target.value)}
                      className="input-field w-20 text-center font-bold text-sm bg-white disabled:opacity-40"
                    />
                    <span className="text-xs text-[#777777]">мин.</span>
                    <label className="flex items-center gap-1.5 text-xs text-[#222222] font-semibold cursor-pointer pl-2">
                      <input
                        type="checkbox"
                        checked={!hasTimeLimit}
                        onChange={(e) => setHasTimeLimit(!e.target.checked)}
                        className="rounded border-[#CED4DA] text-[#141414] focus:ring-[#141414] w-4 h-4 cursor-pointer"
                      />
                      <span>Без лимита</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Security & Attempts Card */}
            <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 border-b border-[#EEEEEE] pb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#222222]">Защита от списывания и попытки</h3>
                  <p className="text-xs text-[#777777]">
                    Ограничение повторного прохождения и регламент сдачи
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disallowRetake}
                    onChange={(e) => setDisallowRetake(e.target.checked)}
                    className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#222222] block">
                      Запретить повторное прохождение (Строго 1 попытка)
                    </span>
                    <span className="text-[11px] text-[#777777] leading-relaxed">
                      При включении этой опции сотрудник сможет пройти тестирование только один раз. Вторая попытка будет заблокирована.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="rounded border-[#CED4DA] text-[#141414] focus:ring-[#141414] w-5 h-5 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#222222] block">
                      Опубликовать тест сразу
                    </span>
                    <span className="text-[11px] text-[#777777] leading-relaxed">
                      Снимите отметку, чтобы сохранить тест как закрытый черновик (Draft).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* 3. Access Mode & Guest Testing */}
            <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-sm p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 border-b border-[#EEEEEE] pb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#222222]">Режим доступа и ссылки</h3>
                  <p className="text-xs text-[#777777]">
                    Распределение между сотрудниками и гостевой доступ
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-colors ${
                      isAssignedOnly
                        ? 'bg-white border-[#141414] ring-2 ring-[#141414]/10 shadow-sm'
                        : 'bg-[#F5F5F7] border-[#EEEEEE] text-[#777777]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="access_mode"
                        checked={isAssignedOnly}
                        onChange={() => setIsAssignedOnly(true)}
                        className="text-[#141414] focus:ring-[#141414] border-[#CED4DA] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-[#222222]">
                        Только назначенным сотрудникам
                      </span>
                    </div>
                    <span className="text-[11px] text-[#777777] pl-6 leading-relaxed">
                      По умолчанию. Тест виден только сотрудникам, которым назначено персональное прохождение.
                    </span>
                  </label>

                  <label
                    className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-colors ${
                      !isAssignedOnly
                        ? 'bg-white border-[#141414] ring-2 ring-[#141414]/10 shadow-sm'
                        : 'bg-[#F5F5F7] border-[#EEEEEE] text-[#777777]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        name="access_mode"
                        checked={!isAssignedOnly}
                        onChange={() => setIsAssignedOnly(false)}
                        className="text-[#141414] focus:ring-[#141414] border-[#CED4DA] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-[#222222]">
                        Общий доступ для всех сотрудников
                      </span>
                    </div>
                    <span className="text-[11px] text-[#777777] pl-6 leading-relaxed">
                      Тест отображается в общем каталоге и открыт для самостоятельного прохождения всеми.
                    </span>
                  </label>
                </div>

                {/* Direct Link / Guest Mode */}
                <div className="p-4 rounded-xl bg-[#F5F5F7] border border-[#EEEEEE] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowGuest}
                      onChange={(e) => setAllowGuest(e.target.checked)}
                      className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-[#222222] flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-[#E84C3D]" />
                      Разрешить прохождение по прямой ссылке без авторизации (Гости)
                    </span>
                  </label>

                  {allowGuest && (
                    <div className="pt-2 pl-6 space-y-2">
                      <p className="text-[11px] text-[#777777] leading-relaxed">
                        Гости смогут проходить тест без логина, указав свое ФИО перед стартом.
                      </p>
                      {publicToken ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/t/${publicToken}`}
                            className="input-field text-xs font-mono py-2 text-[#222222] flex-1 select-all bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleCopyLink}
                            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 whitespace-nowrap min-h-[40px]"
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
                      ) : (
                        <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                          Ссылка сгенерируется автоматически при первом сохранении теста.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* GOOGLE FORMS FLOATING ACTION TOOLBAR (RIGHT OR BOTTOM)        */}
        {/* ============================================================== */}
        <div className="fixed bottom-6 right-6 md:right-8 z-40 flex md:flex-col items-center gap-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#CED4DA] shadow-2xl">
          <button
            type="button"
            onClick={() => addQuestion('single_choice', activeQIndex)}
            className="w-11 h-11 rounded-xl bg-[#E84C3D] hover:bg-[#D33829] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95"
            title="Добавить вопрос"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={openBankModal}
            className="w-11 h-11 rounded-xl bg-[#141414] hover:bg-[#2A2A2A] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95"
            title="Импортировать вопросы из банка"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'questions' ? 'settings' : 'questions')}
            className="w-11 h-11 rounded-xl bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#EEEEEE] flex items-center justify-center shadow-xs transition-transform hover:scale-105"
            title={activeTab === 'questions' ? 'Открыть настройки' : 'Вернуться к вопросам'}
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* QUESTION BANK IMPORT MODAL                                     */}
      {/* ============================================================== */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141414]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#EEEEEE] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-[#141414] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-[#E84C3D]" />
                <h3 className="font-bold text-base !text-white text-white">
                  Импорт вопросов из корпоративного банка
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Filter & Search */}
            <div className="p-4 bg-[#F5F5F7] border-b border-[#EEEEEE] flex items-center gap-3 flex-wrap">
              <div className="flex-1 relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
                <input
                  type="text"
                  placeholder="Поиск по тексту вопроса или теме..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="input-field pl-9 text-xs w-full bg-white"
                />
              </div>

              <span className="text-xs font-bold text-[#777777]">
                Выбрано: {selectedBankIds.length}
              </span>
            </div>

            {/* Questions List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {bankLoading ? (
                <div className="py-12 text-center text-xs text-[#777777]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#141414]" />
                  Загрузка банка вопросов...
                </div>
              ) : filteredBankQuestions.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777777]">
                  Вопросов в банке не найдено.
                </div>
              ) : (
                filteredBankQuestions.map((bq) => {
                  const isSelected = selectedBankIds.includes(bq.id);
                  return (
                    <div
                      key={bq.id}
                      onClick={() => toggleBankQuestionSelect(bq.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#FCECEB]/60 border-[#E84C3D] shadow-xs'
                          : 'bg-white border-[#EEEEEE] hover:border-[#CED4DA]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-[#CED4DA] text-[#E84C3D] focus:ring-[#E84C3D] w-4 h-4 mt-0.5 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[#222222] mb-1">
                          {bq.text}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#777777] flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-[#F5F5F7] font-semibold text-[#141414]">
                            {bq.question_type === 'single_choice'
                              ? 'Один вариант'
                              : bq.question_type === 'multiple_choice'
                              ? 'Несколько'
                              : bq.question_type === 'dropdown'
                              ? 'Список'
                              : bq.question_type === 'manual_review'
                              ? 'Развернутый'
                              : 'Текстовый'}
                          </span>
                          <span>{bq.points || 1} б.</span>
                          {bq.topic && <span>• Тема: {bq.topic}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#F5F5F7] border-t border-[#EEEEEE] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#CCCCCC] text-xs font-semibold text-[#777777] hover:bg-white min-h-[40px]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={selectedBankIds.length === 0}
                onClick={handleImportFromBank}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 font-bold min-h-[40px] disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Импортировать ({selectedBankIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
