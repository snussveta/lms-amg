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

export const QuestionBankPage = () => {
  const [questions, setQuestions] = useState([]);
  const [departments, setDepartments] = useState([]);
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
  const [formDept, setFormDept] = useState('');
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
      setQuestions(res.data || []);
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
    if (q.options && q.options.length > 0) {
      setFormOptions(q.options.map((opt) => ({ text: opt.text, is_correct: opt.is_correct })));
    } else if (q.question_type === 'text') {
      setFormOptions([{ text: '', is_correct: true }]);
    } else {
      setFormOptions([
        { text: 'Вариант 1', is_correct: true },
        { text: 'Вариант 2', is_correct: false },
      ]);
    }
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
    if (newType === 'text') {
      setFormOptions([{ text: '', is_correct: true }]);
    } else if (newType === 'manual_review') {
      setFormOptions([]);
    } else {
      if (formOptions.length === 0) {
        setFormOptions([
          { text: 'Вариант 1', is_correct: true },
          { text: 'Вариант 2', is_correct: false },
        ]);
      }
    }
  };

  const handleAddOption = () => {
    setFormOptions((prev) => [...prev, { text: `Вариант ${prev.length + 1}`, is_correct: false }]);
  };

  const handleRemoveOption = (index) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionTextChange = (index, value) => {
    setFormOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, text: value } : opt))
    );
  };

  const handleOptionCorrectToggle = (index) => {
    if (formType === 'single_choice') {
      setFormOptions((prev) =>
        prev.map((opt, i) => ({ ...opt, is_correct: i === index }))
      );
    } else {
      setFormOptions((prev) =>
        prev.map((opt, i) => (i === index ? { ...opt, is_correct: !opt.is_correct } : opt))
      );
    }
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!formText.trim()) {
      setModalError('Пожалуйста, введите текст вопроса.');
      return;
    }

    const finalDept = formDept === 'custom' ? formCustomDept.trim() : formDept;
    if (!finalDept) {
      setModalError('Укажите название отдела.');
      return;
    }

    if (formType === 'single_choice' || formType === 'multiple_choice') {
      if (formOptions.length < 2) {
        setModalError('Добавьте как минимум два варианта ответа.');
        return;
      }
      const hasCorrect = formOptions.some((opt) => opt.is_correct);
      if (!hasCorrect) {
        setModalError('Отметьте хотя бы один правильный вариант ответа.');
        return;
      }
      const hasEmpty = formOptions.some((opt) => !opt.text.trim());
      if (hasEmpty) {
        setModalError('Заполните текст всех вариантов ответов.');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#141414]/10 border border-[#141414]/20 flex items-center justify-center text-[#141414]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                Банк вопросов AMG
              </h1>
              <p className="text-xs text-[#777777] mt-0.5">
                Централизованное хранилище тестовых вопросов с категоризацией по отделам
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить вопрос</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] text-xs sm:text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Панель фильтров: Отделы + Поиск */}
      <div className="bg-white border border-[#EEEEEE] rounded-2xl p-4 sm:p-5 space-y-4 shadow-card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#777777] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск вопроса по ключевым словам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 text-xs sm:text-sm"
            />
          </div>

          <div className="text-xs text-[#777777] flex items-center gap-1.5 self-end md:self-auto">
            <span>Всего в банке:</span>
            <span className="font-bold text-[#141414]">{questions.length}</span>
            <span>вопросов</span>
          </div>
        </div>

        {/* Табы отделов */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setSelectedDept('Все')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none min-h-[36px] ${
              selectedDept === 'Все'
                ? 'bg-[#141414] text-white shadow-sm'
                : 'bg-white border border-[#EEEEEE] text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
            }`}
          >
            Все ({questions.length})
          </button>
          {departments.map((dept) => {
            const count = questions.filter((q) => q.department === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 select-none min-h-[36px] ${
                  selectedDept === dept
                    ? 'bg-[#141414] text-white shadow-sm'
                    : 'bg-white border border-[#EEEEEE] text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
                }`}
              >
                <span>{dept}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedDept === dept ? 'bg-white/20 text-white' : 'bg-[#F5F5F7] text-[#777777]'
                }`}>
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
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#EEEEEE] animate-pulse" />
          ))}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white border border-[#EEEEEE] rounded-2xl p-12 text-center max-w-md mx-auto my-8 shadow-card">
          <BookOpen className="w-12 h-12 mx-auto text-[#CED4DA] mb-3" />
          <h3 className="text-base font-bold text-[#222222]">Вопросы не найдены</h3>
          <p className="text-xs sm:text-sm text-[#777777] mt-1 mb-6">
            {searchQuery || selectedDept !== 'Все'
              ? 'Попробуйте сбросить фильтры поиска или выбрать другой отдел.'
              : 'В банке вопросов пока нет записей. Создайте первый вопрос!'}
          </p>
          <button onClick={openCreateModal} className="btn-primary text-xs sm:text-sm">
            Добавить вопрос
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-white border border-[#EEEEEE] rounded-2xl p-5 hover:border-[#CED4DA] hover:shadow-card-hover transition-all duration-200 shadow-card flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-md font-bold bg-[#F0F5FA] text-[#141414] border border-[#B8D5ED]">
                    {q.department}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md font-medium bg-[#F5F5F7] text-[#495057] border border-[#EEEEEE]">
                    {getQuestionTypeLabel(q.question_type)}
                  </span>
                  <span className="text-[#777777] font-bold font-mono">
                    {q.points} б.
                  </span>
                </div>

                <h3 className="text-base font-bold text-[#222222] leading-relaxed">
                  {q.text}
                </h3>

                {q.options && q.options.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {q.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                          opt.is_correct
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
                            : 'bg-[#F5F5F7] text-[#495057] border-[#EEEEEE]'
                        }`}
                      >
                        {opt.is_correct ? (
                          <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#CED4DA] flex-shrink-0" />
                        )}
                        <span className="line-clamp-1">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Управление */}
              <div className="flex items-center gap-2 self-end md:self-start flex-shrink-0">
                <button
                  onClick={() => openEditModal(q)}
                  className="p-2 rounded-lg bg-[#F5F5F7] hover:bg-[#EEEEEE] text-[#141414] border border-[#EEEEEE] transition-colors"
                  title="Редактировать вопрос"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-2 rounded-lg bg-[#FCECEB] hover:bg-[#FDE8E9] text-[#E84C3D] border border-[#F8D3D0] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/40 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="bg-white border border-[#EEEEEE] rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#EEEEEE] mb-5">
              <h3 className="text-lg font-bold text-[#222222] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#141414]" />
                <span>{editingQuestion ? 'Редактирование вопроса в банке' : 'Новый вопрос в банк AMG'}</span>
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                    Отдел / Направление *
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="input-field text-sm"
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
                      className="mt-2 input-field text-sm"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                    Тип вопроса *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="single_choice">Один вариант (Single Choice)</option>
                    <option value="multiple_choice">Несколько вариантов (Multiple Choice)</option>
                    <option value="text">Текстовый ответ (Автопроверка)</option>
                    <option value="manual_review">Ручная проверка экзаменатором</option>
                  </select>
                </div>
              </div>

              <div className="w-36">
                <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                  Баллы
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formPoints}
                  onChange={(e) => setFormPoints(e.target.value)}
                  className="input-field text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                  Текст вопроса *
                </label>
                <textarea
                  rows={3}
                  placeholder="Введите формулировку вопроса..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  className="input-field text-sm"
                  required
                />
              </div>

              {(formType === 'single_choice' || formType === 'multiple_choice') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#777777] uppercase tracking-wider">
                      Варианты ответа (отметьте правильные)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs text-[#141414] hover:text-[#E84C3D] flex items-center gap-1 font-bold transition-colors"
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
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                            opt.is_correct
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#F5F5F7] border border-[#EEEEEE] text-transparent hover:border-[#CED4DA]'
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
                          className="flex-1 input-field text-sm"
                        />
                        {formOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-2 text-[#777777] hover:text-[#E84C3D] transition-colors"
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
                  <label className="block text-xs font-semibold text-[#777777] uppercase tracking-wider mb-1.5">
                    Эталонный текстовый ответ
                  </label>
                  <input
                    type="text"
                    placeholder="Например: 2FA или Инкотермс"
                    value={formOptions[0]?.text || ''}
                    onChange={(e) => setFormOptions([{ text: e.target.value, is_correct: true }])}
                    className="input-field text-sm"
                  />
                  <p className="text-[11px] text-[#777777] mt-1">
                    Ответ пользователя будет автоматически сверен с этим образцом без учета регистра.
                  </p>
                </div>
              )}

              {formType === 'manual_review' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <span>
                    Открытый вопрос для развернутого ответа. Проверяется экзаменатором AMG вручную.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EEEEEE]">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={modalSaving}
                  className="btn-secondary text-xs sm:text-sm py-2.5"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="btn-primary text-xs sm:text-sm py-2.5 min-w-[130px]"
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
