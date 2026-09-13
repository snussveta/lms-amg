import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Edit2,
  Filter,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
  AlertCircle,
  HelpCircle,
  Clock,
  FileText,
  CheckSquare,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

const DEFAULT_DEPARTMENTS = ['Общий', 'Бухгалтерия', 'Продажи', 'IT', 'Логистика'];

export const QuestionBankPage = () => {
  const [questions, setQuestions] = useState([]);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form State inside Modal
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState('single_choice');
  const [formDept, setFormDept] = useState('Общий');
  const [formCustomDept, setFormCustomDept] = useState('');
  const [formPoints, setFormPoints] = useState(10);
  const [formOptions, setFormOptions] = useState([
    { text: 'Вариант 1', is_correct: true },
    { text: 'Вариант 2', is_correct: false },
  ]);

  useEffect(() => {
    fetchDepartments();
    fetchQuestions();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/bank-questions/departments');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setDepartments(res.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки списка отделов:', err);
    }
  };

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/bank-questions');
      setQuestions(res.data);
    } catch (err) {
      console.error('Ошибка загрузки банка вопросов:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить банк вопросов.'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingQuestion(null);
    setFormText('');
    setFormType('single_choice');
    setFormDept(selectedDept !== 'Все' ? selectedDept : 'Общий');
    setFormCustomDept('');
    setFormPoints(10);
    setFormOptions([
      { text: 'Вариант 1', is_correct: true },
      { text: 'Вариант 2', is_correct: false },
    ]);
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (q) => {
    setEditingQuestion(q);
    setFormText(q.text);
    setFormType(q.question_type);
    if (departments.includes(q.department)) {
      setFormDept(q.department);
      setFormCustomDept('');
    } else {
      setFormDept('custom');
      setFormCustomDept(q.department);
    }
    setFormPoints(q.points);
    setFormOptions(
      q.options && q.options.length > 0
        ? q.options.map((opt) => ({ text: opt.text, is_correct: opt.is_correct }))
        : []
    );
    setModalError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingQuestion(null);
    setModalError('');
  };

  const handleTypeChange = (newType) => {
    setFormType(newType);
    if (newType === 'single_choice' || newType === 'multiple_choice') {
      if (formOptions.length === 0) {
        setFormOptions([
          { text: 'Вариант 1', is_correct: true },
          { text: 'Вариант 2', is_correct: false },
        ]);
      }
    } else if (newType === 'text') {
      if (formOptions.length === 0) {
        setFormOptions([{ text: '', is_correct: true }]);
      }
    } else if (newType === 'manual_review') {
      setFormOptions([]);
    }
  };

  const handleAddOption = () => {
    setFormOptions((prev) => [
      ...prev,
      { text: `Вариант ${prev.length + 1}`, is_correct: false },
    ]);
  };

  const handleOptionTextChange = (index, text) => {
    setFormOptions((prev) => {
      const updated = [...prev];
      updated[index].text = text;
      return updated;
    });
  };

  const handleOptionCorrectToggle = (index) => {
    setFormOptions((prev) => {
      if (formType === 'single_choice') {
        return prev.map((opt, i) => ({
          ...opt,
          is_correct: i === index,
        }));
      } else {
        const updated = [...prev];
        updated[index].is_correct = !updated[index].is_correct;
        return updated;
      }
    });
  };

  const handleRemoveOption = (index) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!formText.trim()) {
      setModalError('Пожалуйста, введите текст вопроса.');
      return;
    }

    const finalDept = formDept === 'custom' ? formCustomDept.trim() : formDept.trim();
    if (!finalDept) {
      setModalError('Пожалуйста, укажите отдел или направление вопроса.');
      return;
    }

    // Validation for options
    if (formType === 'single_choice' || formType === 'multiple_choice') {
      if (formOptions.length < 2) {
        setModalError('Необходимо добавить как минимум два варианта ответа.');
        return;
      }
      const hasEmpty = formOptions.some((opt) => !opt.text.trim());
      if (hasEmpty) {
        setModalError('Заполните текст всех вариантов ответа.');
        return;
      }
      const hasCorrect = formOptions.some((opt) => opt.is_correct);
      if (!hasCorrect) {
        setModalError('Отметьте хотя бы один правильный вариант ответа.');
        return;
      }
    } else if (formType === 'text') {
      if (formOptions.length > 0 && !formOptions[0].text.trim()) {
        setModalError('Введите эталонное ключевое слово или фразу для автоматической проверки.');
        return;
      }
    }

    const payload = {
      text: formText.trim(),
      question_type: formType,
      department: finalDept,
      points: parseInt(formPoints, 10) || 10,
      options: formOptions.map((opt) => ({
        text: opt.text.trim(),
        is_correct: opt.is_correct,
      })),
    };

    try {
      setModalSaving(true);
      setModalError('');

      if (editingQuestion) {
        await api.put(`/bank-questions/${editingQuestion.id}`, payload);
      } else {
        await api.post('/bank-questions', payload);
      }

      await fetchQuestions();
      await fetchDepartments();
      closeModal();
    } catch (err) {
      console.error('Ошибка сохранения вопроса в банке:', err);
      setModalError(getErrorMessage(err, 'Не удалось сохранить вопрос.'));
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот вопрос из банка?')) {
      return;
    }
    try {
      await api.delete(`/bank-questions/${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      await fetchDepartments();
    } catch (err) {
      console.error('Ошибка удаления вопроса:', err);
      alert(getErrorMessage(err, 'Не удалось удалить вопрос из банка.'));
    }
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

  const filteredQuestions = questions.filter((q) => {
    const matchesDept = selectedDept === 'Все' || q.department === selectedDept;
    const matchesSearch =
      !searchQuery.trim() ||
      q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-sky-400" />
            Банк вопросов AMG
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Централизованное хранилище вопросов с категоризацией по отделам для быстрого импорта в любые тесты.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary text-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить вопрос</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Панель фильтров: Отделы + Поиск */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск вопроса по ключевым словам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600 transition-colors"
            />
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5 self-end md:self-auto">
            <span>Всего в банке:</span>
            <span className="font-semibold text-white">{questions.length}</span>
            <span>вопросов</span>
          </div>
        </div>

        {/* Табы отделов */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedDept('Все')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedDept === 'Все'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            Все отделы ({questions.length})
          </button>
          {departments.map((dept) => {
            const count = questions.filter((q) => q.department === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedDept === dept
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <span>{dept}</span>
                <span className="text-[11px] opacity-70 bg-slate-950/60 px-1.5 py-0.2 rounded">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Список вопросов */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-md mx-auto my-8">
          <BookOpen className="w-12 h-12 mx-auto text-slate-500 mb-3" />
          <h3 className="text-lg font-semibold text-slate-200">Вопросы не найдены</h3>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            {searchQuery || selectedDept !== 'Все'
              ? 'Попробуйте сбросить фильтры поиска или выбрать другой отдел.'
              : 'В банке вопросов пока нет записей. Создайте первый вопрос!'}
          </p>
          <button onClick={openCreateModal} className="btn-primary text-sm">
            Добавить вопрос
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="flex-1 space-y-2">
                {/* Бейджи */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-md font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {q.department}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {getQuestionTypeLabel(q.question_type)}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {q.points} б.
                  </span>
                </div>

                {/* Текст вопроса */}
                <h3 className="text-base font-semibold text-white leading-relaxed">
                  {q.text}
                </h3>

                {/* Варианты ответов (превью) */}
                {q.options && q.options.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                          opt.is_correct
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 font-medium'
                            : 'bg-slate-950/60 text-slate-400 border-slate-800'
                        }`}
                      >
                        {opt.is_correct ? (
                          <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 flex-shrink-0" />
                        )}
                        <span className="line-clamp-1">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Кнопки управления */}
              <div className="flex items-center gap-2 self-end md:self-start flex-shrink-0">
                <button
                  onClick={() => openEditModal(q)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                  title="Редактировать вопрос"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900 transition-colors"
                  title="Удалить вопрос"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно создания / редактирования вопроса */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                {editingQuestion ? 'Редактирование вопроса в банке' : 'Новый вопрос в банк'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Отдел и Тип */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Отдел / Направление *
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                  >
                    {DEFAULT_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    {departments
                      .filter((d) => !DEFAULT_DEPARTMENTS.includes(d))
                      .map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    <option value="custom">+ Ввести другой отдел...</option>
                  </select>

                  {formDept === 'custom' && (
                    <input
                      type="text"
                      placeholder="Название отдела..."
                      value={formCustomDept}
                      onChange={(e) => setFormCustomDept(e.target.value)}
                      className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Тип вопроса *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                  >
                    <option value="single_choice">Один вариант (Single Choice)</option>
                    <option value="multiple_choice">Несколько вариантов (Multiple Choice)</option>
                    <option value="text">Текстовый ответ (Автопроверка)</option>
                    <option value="manual_review">Ручная проверка администратором</option>
                  </select>
                </div>
              </div>

              {/* Баллы */}
              <div className="w-36">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Баллы
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                  required
                />
              </div>

              {/* Текст вопроса */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Текст вопроса *
                </label>
                <textarea
                  rows={3}
                  placeholder="Введите формулировку вопроса..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600"
                  required
                />
              </div>

              {/* Варианты ответов */}
              {(formType === 'single_choice' || formType === 'multiple_choice') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Варианты ответа (отметьте правильные)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Добавить вариант
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOptionCorrectToggle(idx)}
                          className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                            opt.is_correct
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800 border border-slate-700 text-transparent hover:border-slate-500'
                          }`}
                          title="Отметить как правильный"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          placeholder={`Вариант ${idx + 1}`}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                        />
                        {formOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formType === 'text' && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Эталонный текстовый ответ (регистронезависимый)
                  </label>
                  <input
                    type="text"
                    placeholder="Например: 2FA или Инкотермс"
                    value={formOptions[0]?.text || ''}
                    onChange={(e) => setFormOptions([{ text: e.target.value, is_correct: true }])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ответ пользователя будет автоматически сверен с этим образцом без учета регистра.
                  </p>
                </div>
              )}

              {formType === 'manual_review' && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Открытый вопрос для развернутого ответа. Проверяется администратором вручную с выставлением баллов и рецензии. Варианты ответа не требуются.
                  </span>
                </div>
              )}

              {/* Кнопки модалки */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={modalSaving}
                  className="btn-secondary text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="btn-primary text-sm min-w-[120px]"
                >
                  {modalSaving ? 'Сохранение...' : editingQuestion ? 'Обновить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
