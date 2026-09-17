import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Layers,
  List,
  Loader2,
  MoveDown,
  MoveUp,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const CourseConstructorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id && id !== 'new');

  // Course general info
  const [courseId, setCourseId] = useState(isEditing ? parseInt(id, 10) : null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentTag, setDepartmentTag] = useState('СТО');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // Modules and Lessons Tree
  const [modules, setModules] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null); // Selected lesson for editor
  const [activeModuleId, setActiveModuleId] = useState(null);

  // Editor states
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // Available tests for quiz lesson type
  const [availableTests, setAvailableTests] = useState([]);

  // Video Chunked Upload State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'processing', 'completed', 'error'
  const [uploadError, setUploadError] = useState('');
  const [chunkStats, setChunkStats] = useState({ current: 0, total: 0, speed: '' });
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Fetch course data and tests on load
  useEffect(() => {
    fetchTests();
    if (isEditing) {
      fetchCourseData();
    } else {
      // Default structure for a new course
      setModules([
        {
          id: 'temp-mod-1',
          title: 'Раздел 1: Введение и стандарты',
          order_index: 0,
          lessons: [
            {
              id: 'temp-les-1',
              title: 'Вводный регламент и техника безопасности',
              order_index: 0,
              lesson_type: 'article',
              content_json: JSON.stringify([
                { type: 'h1', text: 'Стандарты работы сервисного участка' },
                { type: 'paragraph', text: 'Ознакомьтесь с регламентом проведения работ и требованиями безопасности.' },
                { type: 'callout', variant: 'warning', title: 'ВНИМАНИЕ', text: 'Соблюдение регламентов СТО проверяется службой контроля качества.' }
              ]),
              file_url: '',
              file_size_bytes: 0,
              quiz_id: null,
            },
          ],
        },
      ]);
    }
  }, [id]);

  // Set initial active lesson when modules load
  useEffect(() => {
    if (!activeLesson && modules.length > 0 && modules[0].lessons?.length > 0) {
      setActiveLesson(modules[0].lessons[0]);
      setActiveModuleId(modules[0].id);
    }
  }, [modules]);

  const fetchTests = async () => {
    try {
      const res = await api.get('/tests');
      setAvailableTests(res.data || []);
    } catch (err) {
      console.error('Ошибка загрузки списка тестов:', err);
    }
  };

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/courses/${id}`);
      const data = res.data;
      setTitle(data.title);
      setDescription(data.description || '');
      setDepartmentTag(data.department_tag || 'СТО');
      setCoverImageUrl(data.cover_image_url || '');
      setIsPublished(Boolean(data.is_published));
      setModules(data.modules || []);

      if (data.modules?.length > 0 && data.modules[0].lessons?.length > 0) {
        setActiveLesson(data.modules[0].lessons[0]);
        setActiveModuleId(data.modules[0].id);
      }
    } catch (err) {
      console.error('Ошибка загрузки курса:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить данные курса.'));
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Save Course
  // ----------------------------------------------------
  const handleSaveCourse = async () => {
    if (!title.trim()) {
      setError('Укажите название курса.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');

      let currentCId = courseId;

      if (!isEditing || !currentCId) {
        // Create Course
        const payload = {
          title,
          description,
          department_tag: departmentTag,
          cover_image_url: coverImageUrl,
          is_published: isPublished,
        };
        const res = await api.post('/courses', payload);
        currentCId = res.data.id;
        setCourseId(currentCId);

        // Save custom modules & lessons from initial template
        for (const mod of modules) {
          const modRes = await api.post(`/courses/${currentCId}/modules`, {
            title: mod.title,
            order_index: mod.order_index,
          });
          const createdModId = modRes.data.id;

          for (const les of mod.lessons || []) {
            await api.post(`/courses/${currentCId}/modules/${createdModId}/lessons`, {
              title: les.title,
              order_index: les.order_index,
              lesson_type: les.lesson_type,
              content_json: typeof les.content_json === 'string' ? les.content_json : JSON.stringify(les.content_json),
              file_url: les.file_url,
              file_size_bytes: les.file_size_bytes,
              quiz_id: les.quiz_id,
            });
          }
        }
        navigate(`/admin/courses/${currentCId}/edit`, { replace: true });
      } else {
        // Update existing course general info
        await api.put(`/courses/${currentCId}`, {
          title,
          description,
          department_tag: departmentTag,
          cover_image_url: coverImageUrl,
          is_published: isPublished,
        });

        // Save active lesson if modified
        if (activeLesson && typeof activeLesson.id === 'number') {
          await api.put(`/courses/${currentCId}/lessons/${activeLesson.id}`, {
            title: activeLesson.title,
            order_index: activeLesson.order_index,
            lesson_type: activeLesson.lesson_type,
            content_json: typeof activeLesson.content_json === 'string' ? activeLesson.content_json : JSON.stringify(activeLesson.content_json),
            file_url: activeLesson.file_url,
            file_size_bytes: activeLesson.file_size_bytes,
            quiz_id: activeLesson.quiz_id,
          });
        }
      }

      setSuccessMessage('Курс успешно сохранен!');
      setTimeout(() => setSuccessMessage(''), 3500);

      // Refresh full course data to get accurate IDs
      if (currentCId) {
        const res = await api.get(`/courses/${currentCId}`);
        setModules(res.data.modules || []);
      }
    } catch (err) {
      console.error('Ошибка сохранения курса:', err);
      setError(getErrorMessage(err, 'Не удалось сохранить курс.'));
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // Module Tree Management
  // ----------------------------------------------------
  const handleAddModule = async () => {
    const newModTitle = `Раздел ${modules.length + 1}: Новый модуль`;
    if (isEditing && courseId) {
      try {
        const res = await api.post(`/courses/${courseId}/modules`, {
          title: newModTitle,
          order_index: modules.length,
        });
        setModules([...modules, { ...res.data, lessons: [] }]);
      } catch (err) {
        setError(getErrorMessage(err, 'Не удалось добавить раздел.'));
      }
    } else {
      setModules([
        ...modules,
        {
          id: `temp-mod-${Date.now()}`,
          title: newModTitle,
          order_index: modules.length,
          lessons: [],
        },
      ]);
    }
  };

  const handleUpdateModuleTitle = async (moduleId, newTitle) => {
    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, title: newTitle } : m))
    );
    if (isEditing && courseId && typeof moduleId === 'number') {
      try {
        await api.put(`/courses/${courseId}/modules/${moduleId}`, { title: newTitle });
      } catch (err) {
        console.error('Ошибка обновления названия раздела:', err);
      }
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Удалить этот раздел и все входящие в него уроки?')) return;

    if (isEditing && courseId && typeof moduleId === 'number') {
      try {
        await api.delete(`/courses/${courseId}/modules/${moduleId}`);
      } catch (err) {
        setError(getErrorMessage(err, 'Не удалось удалить раздел.'));
        return;
      }
    }

    const updated = modules.filter((m) => m.id !== moduleId);
    setModules(updated);
    if (activeModuleId === moduleId) {
      if (updated.length > 0) {
        setActiveModuleId(updated[0].id);
        setActiveLesson(updated[0].lessons?.[0] || null);
      } else {
        setActiveModuleId(null);
        setActiveLesson(null);
      }
    }
  };

  const handleAddLesson = async (moduleId, type = 'article') => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const lessonCount = (mod.lessons || []).length;
    const typeNames = {
      article: 'Лонгрид: Инструкция',
      video: 'Видеоурок: Практикум',
      presentation: 'Презентация регламента',
      quiz: 'Тестирование знаний',
    };
    const newLessonData = {
      title: `${typeNames[type] || 'Урок'} ${lessonCount + 1}`,
      order_index: lessonCount,
      lesson_type: type,
      content_json: type === 'article' ? JSON.stringify([
        { type: 'h1', text: 'Заголовок инструкции' },
        { type: 'paragraph', text: 'Введите текст регламента или описания процесса...' }
      ]) : '[]',
      file_url: '',
      file_size_bytes: 0,
      quiz_id: null,
    };

    if (isEditing && courseId && typeof moduleId === 'number') {
      try {
        const res = await api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, newLessonData);
        const created = res.data;
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId ? { ...m, lessons: [...(m.lessons || []), created] } : m
          )
        );
        setActiveLesson(created);
        setActiveModuleId(moduleId);
      } catch (err) {
        setError(getErrorMessage(err, 'Не удалось создать урок.'));
      }
    } else {
      const tempLesson = {
        ...newLessonData,
        id: `temp-les-${Date.now()}`,
        module_id: moduleId,
      };
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...(m.lessons || []), tempLesson] } : m
        )
      );
      setActiveLesson(tempLesson);
      setActiveModuleId(moduleId);
    }
  };

  const handleDeleteLesson = async (moduleId, lessonId) => {
    if (!window.confirm('Удалить этот урок?')) return;

    if (isEditing && courseId && typeof lessonId === 'number') {
      try {
        await api.delete(`/courses/${courseId}/lessons/${lessonId}`);
      } catch (err) {
        setError(getErrorMessage(err, 'Не удалось удалить урок.'));
        return;
      }
    }

    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId
          ? { ...m, lessons: (m.lessons || []).filter((l) => l.id !== lessonId) }
          : m
      )
    );

    if (activeLesson?.id === lessonId) {
      setActiveLesson(null);
    }
  };

  // Move Module Up / Down
  const handleMoveModule = (index, direction) => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;

    const updated = [...modules];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    updated.forEach((m, idx) => (m.order_index = idx));
    setModules(updated);

    if (isEditing && courseId) {
      api.post(`/courses/${courseId}/reorder`, {
        modules: updated.filter((m) => typeof m.id === 'number').map((m) => ({ id: m.id, order_index: m.order_index })),
        lessons: [],
      }).catch(console.error);
    }
  };

  // ----------------------------------------------------
  // Active Lesson Field Updates
  // ----------------------------------------------------
  const updateActiveLessonField = (field, value) => {
    if (!activeLesson) return;
    const updated = { ...activeLesson, [field]: value };
    setActiveLesson(updated);

    // Update in modules tree
    setModules((prev) =>
      prev.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => (l.id === updated.id ? updated : l)),
      }))
    );
  };

  // Parse longread content blocks
  const getParsedLongreadBlocks = () => {
    if (!activeLesson?.content_json) return [];
    try {
      if (Array.isArray(activeLesson.content_json)) return activeLesson.content_json;
      return JSON.parse(activeLesson.content_json);
    } catch {
      return [{ type: 'paragraph', text: activeLesson.content_json }];
    }
  };

  const updateLongreadBlocks = (newBlocks) => {
    updateActiveLessonField('content_json', JSON.stringify(newBlocks));
  };

  const addLongreadBlock = (type) => {
    const blocks = getParsedLongreadBlocks();
    let newBlock = { type };
    if (type === 'h1') newBlock.text = 'Новый заголовок H1';
    else if (type === 'h2') newBlock.text = 'Подзаголовок H2';
    else if (type === 'paragraph') newBlock.text = 'Текст описания или инструкции...';
    else if (type === 'callout') {
      newBlock.variant = 'warning';
      newBlock.title = 'РЕГЛАМЕНТ СТО';
      newBlock.text = 'Обязательное требование к исполнению.';
    } else if (type === 'list') {
      newBlock.items = ['Пункт регламента 1', 'Пункт регламента 2'];
    } else if (type === 'image') {
      newBlock.url = '';
      newBlock.caption = 'Схема узла или деталь авто';
    }
    updateLongreadBlocks([...blocks, newBlock]);
  };

  const updateLongreadBlock = (index, field, value) => {
    const blocks = getParsedLongreadBlocks();
    blocks[index] = { ...blocks[index], [field]: value };
    updateLongreadBlocks(blocks);
  };

  const removeLongreadBlock = (index) => {
    const blocks = getParsedLongreadBlocks();
    blocks.splice(index, 1);
    updateLongreadBlocks(blocks);
  };

  // Image direct upload for longread
  const handleUploadLongreadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/v1/media/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = res.data.file_url;
      const blocks = getParsedLongreadBlocks();
      updateLongreadBlocks([...blocks, { type: 'image', url: imageUrl, caption: file.name }]);
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка загрузки изображения.'));
    }
  };

  // ----------------------------------------------------
  // Chunked Upload for Giant Videos (2-10 GB) & PDFs
  // ----------------------------------------------------
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadError('');
    setChunkStats({ current: 0, total: totalChunks, speed: '' });

    const startTime = Date.now();
    let uploadedBytes = 0;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = file.slice(start, end);

      const formData = new FormData();
      formData.append('upload_id', uploadId);
      formData.append('chunk_index', chunkIndex);
      formData.append('total_chunks', totalChunks);
      formData.append('original_filename', file.name);
      formData.append('category', activeLesson?.lesson_type === 'presentation' ? 'presentation' : 'video');
      formData.append('chunk_file', chunkBlob, file.name);

      try {
        const res = await api.post('/v1/media/upload/chunk', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedBytes += chunkBlob.size;
        const percent = Math.round((uploadedBytes / totalSize) * 100);
        setUploadProgress(percent);

        const elapsedSec = (Date.now() - startTime) / 1000;
        const mbPerSec = (uploadedBytes / (1024 * 1024) / (elapsedSec || 1)).toFixed(1);
        setChunkStats({
          current: chunkIndex + 1,
          total: totalChunks,
          speed: `${mbPerSec} МБ/с`,
        });

        if (res.data.status === 'completed') {
          setUploadStatus('completed');
          updateActiveLessonField('file_url', res.data.file_url);
          updateActiveLessonField('file_size_bytes', res.data.file_size_bytes);
          break;
        }
      } catch (err) {
        console.error('Ошибка отправки чанка:', err);
        setUploadStatus('error');
        setUploadError(getErrorMessage(err, `Сбой отправки чанка ${chunkIndex + 1}/${totalChunks}`));
        return;
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <span className="text-sm text-slate-400">Загрузка структуры курса...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/courses"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Назад к списку курсов"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                {isEditing ? 'Конструктор курса' : 'Новый обучающий курс'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-950/70 border border-sky-800/80 text-sky-400 uppercase tracking-wider">
                iSpring Module
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Настройка разделов, лонгридов, видео 5+ часов, презентаций и тестов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isEditing && (
            <Link
              to={`/courses/${courseId}/learn`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              Плеер сотрудника
            </Link>
          )}

          <button
            onClick={handleSaveCourse}
            disabled={saving}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Сохранение...' : 'Сохранить курс'}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Course Core Settings Card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Название курса *</label>
            <input
              type="text"
              className="input-field font-semibold text-sm"
              placeholder="Например: Диагностика тормозных систем AutoMall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Подразделение (Тег)</label>
            <select
              className="input-field text-sm"
              value={departmentTag}
              onChange={(e) => setDepartmentTag(e.target.value)}
            >
              <option value="СТО">СТО (Слесарный цех / Мастера)</option>
              <option value="Склад">Склад (Логистика / Запчасти)</option>
              <option value="Продажи">Продажи (Мастера-консультанты)</option>
              <option value="Общий">Общий регламент компании</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Краткое описание курса</label>
            <textarea
              rows={2}
              className="input-field text-xs"
              placeholder="Опишите цели обучения, приобретаемые навыки и регламенты..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">URL обложки курса (баннер)</label>
              <input
                type="text"
                className="input-field text-xs"
                placeholder="https://... или путь к фото"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-sky-500 bg-slate-900 focus:ring-0"
              />
              <label htmlFor="isPublished" className="text-xs font-medium text-slate-300 cursor-pointer">
                Опубликовать курс для сотрудников
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Workspace: Left Structure Tree + Right Lesson Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ==================================================== */}
        {/* LEFT COLUMN: COURSE STRUCTURE TREE (4 cols)         */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Структура курса
                </span>
              </div>
              <button
                onClick={handleAddModule}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Раздел
              </button>
            </div>

            {/* Modules List */}
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {modules.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Нет разделов. Нажмите «+ Раздел», чтобы добавить.
                </div>
              ) : (
                modules.map((mod, modIdx) => (
                  <div
                    key={mod.id}
                    className={`rounded-lg border transition-all ${
                      activeModuleId === mod.id
                        ? 'border-slate-700 bg-slate-900/90'
                        : 'border-slate-800/80 bg-slate-900/40'
                    }`}
                  >
                    {/* Module Header */}
                    <div className="p-2.5 flex items-center justify-between gap-2 border-b border-slate-800/60">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {modIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={mod.title}
                          onChange={(e) => handleUpdateModuleTitle(mod.id, e.target.value)}
                          className="bg-transparent text-xs font-bold text-slate-200 border-none focus:outline-none focus:ring-0 w-full truncate"
                          title="Кликните для редактирования названия"
                        />
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleMoveModule(modIdx, 'up')}
                          disabled={modIdx === 0}
                          className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                          title="Поднять раздел выше"
                        >
                          <MoveUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleMoveModule(modIdx, 'down')}
                          disabled={modIdx === modules.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                          title="Опустить раздел ниже"
                        >
                          <MoveDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Удалить раздел"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Lessons inside module */}
                    <div className="p-2 space-y-1">
                      {(mod.lessons || []).map((les, lesIdx) => {
                        const isSelected = activeLesson?.id === les.id;
                        const iconMap = {
                          article: <FileText className="w-3.5 h-3.5 text-emerald-400" />,
                          video: <Video className="w-3.5 h-3.5 text-rose-400" />,
                          presentation: <FileCode className="w-3.5 h-3.5 text-amber-400" />,
                          quiz: <HelpCircle className="w-3.5 h-3.5 text-sky-400" />,
                        };

                        return (
                          <div
                            key={les.id}
                            onClick={() => {
                              setActiveLesson(les);
                              setActiveModuleId(mod.id);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                              isSelected
                                ? 'bg-slate-800 text-white font-medium shadow-sm border border-slate-700'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {iconMap[les.lesson_type] || <FileText className="w-3.5 h-3.5" />}
                              <span className="truncate">{les.title}</span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLesson(mod.id, les.id);
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors opacity-60 hover:opacity-100"
                              title="Удалить урок"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add Lesson Dropdown Button */}
                      <div className="pt-1.5 flex items-center gap-1">
                        <button
                          onClick={() => handleAddLesson(mod.id, 'article')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-emerald-400" />
                          Лонгрид
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'video')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-rose-400" />
                          Видео
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'quiz')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3 text-sky-400" />
                          Тест
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'presentation')}
                          className="text-[11px] px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-medium transition-colors"
                          title="Добавить презентацию (PDF)"
                        >
                          <Plus className="w-3 h-3 text-amber-400" />
                          PDF
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: WORKSPACE FOR SELECTED LESSON (8 cols) */}
        {/* ==================================================== */}
        <div className="lg:col-span-8">
          {!activeLesson ? (
            <div className="glass-panel p-12 text-center text-slate-500 space-y-3">
              <Layers className="w-10 h-10 mx-auto text-slate-600" />
              <div className="text-sm font-semibold text-slate-400">Урок не выбран</div>
              <p className="text-xs max-w-sm mx-auto">
                Выберите урок в дереве слева или добавьте новый раздел и урок, чтобы приступить к верстке лонгрида или загрузке видео.
              </p>
            </div>
          ) : (
            <div className="glass-panel p-6 space-y-6">
              {/* Lesson General Header */}
              <div className="space-y-4 pb-5 border-b border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-400">Название урока</label>
                    <input
                      type="text"
                      className="input-field text-base font-bold text-slate-100 mt-1"
                      value={activeLesson.title}
                      onChange={(e) => updateActiveLessonField('title', e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-end">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`btn-secondary text-xs flex items-center gap-1.5 ${
                        previewMode ? 'bg-slate-800 text-sky-400 border-sky-800' : ''
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {previewMode ? 'Редактор' : 'Предпросмотр'}
                    </button>
                  </div>
                </div>

                {/* Lesson Type Selector Tabs */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Формат урока</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'article', label: 'Лонгрид / Статья', icon: FileText, color: 'text-emerald-400' },
                      { id: 'video', label: 'Видео (2–10 ГБ)', icon: Video, color: 'text-rose-400' },
                      { id: 'presentation', label: 'Презентация PDF', icon: FileCode, color: 'text-amber-400' },
                      { id: 'quiz', label: 'Тестирование', icon: HelpCircle, color: 'text-sky-400' },
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = activeLesson.lesson_type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateActiveLessonField('lesson_type', t.id)}
                          className={`p-3 rounded-lg border text-left transition-all flex flex-col gap-1.5 ${
                            active
                              ? 'bg-slate-800 border-slate-600 text-white shadow-sm'
                              : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${t.color}`} />
                          <span className="text-xs font-semibold">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ============================================== */}
              {/* 1. ARTICLE / LONGREAD WYSIWYG BLOCK BUILDER    */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'article' && (
                <div className="space-y-6">
                  {previewMode ? (
                    /* Read Mode Preview */
                    <div className="prose prose-invert max-w-none space-y-4">
                      {getParsedLongreadBlocks().map((block, idx) => {
                        if (block.type === 'h1') {
                          return <h1 key={idx} className="text-2xl font-black text-slate-100">{block.text}</h1>;
                        }
                        if (block.type === 'h2') {
                          return <h2 key={idx} className="text-xl font-bold text-slate-200 mt-6">{block.text}</h2>;
                        }
                        if (block.type === 'paragraph') {
                          return <p key={idx} className="text-sm text-slate-300 leading-relaxed">{block.text}</p>;
                        }
                        if (block.type === 'callout') {
                          const variants = {
                            danger: 'bg-rose-950/30 border-rose-900/60 text-rose-300',
                            warning: 'bg-amber-950/30 border-amber-900/60 text-amber-300',
                            info: 'bg-sky-950/30 border-sky-900/60 text-sky-300',
                            success: 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300',
                          };
                          return (
                            <div key={idx} className={`p-4 rounded-xl border ${variants[block.variant] || variants.info}`}>
                              <div className="font-bold text-xs uppercase tracking-wider mb-1">{block.title || 'Регламент'}</div>
                              <div className="text-xs leading-relaxed">{block.text}</div>
                            </div>
                          );
                        }
                        if (block.type === 'list') {
                          return (
                            <ul key={idx} className="list-disc list-inside space-y-1 text-xs text-slate-300">
                              {(block.items || []).map((item, iIdx) => (
                                <li key={iIdx}>{item}</li>
                              ))}
                            </ul>
                          );
                        }
                        if (block.type === 'image') {
                          return (
                            <div key={idx} className="space-y-1.5 text-center my-4">
                              <img src={block.url} alt={block.caption} className="rounded-lg max-h-96 mx-auto border border-slate-800" />
                              {block.caption && <div className="text-[11px] text-slate-400 italic">{block.caption}</div>}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="space-y-4">
                      {/* Blocks List */}
                      <div className="space-y-3">
                        {getParsedLongreadBlocks().map((block, bIdx) => (
                          <div key={bIdx} className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 relative group space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Блок: {block.type}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeLongreadBlock(bIdx)}
                                className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                                title="Удалить блок"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* H1 / H2 / Paragraph text */}
                            {(block.type === 'h1' || block.type === 'h2' || block.type === 'paragraph') && (
                              <textarea
                                rows={block.type === 'paragraph' ? 3 : 1}
                                className="input-field text-xs"
                                value={block.text || ''}
                                onChange={(e) => updateLongreadBlock(bIdx, 'text', e.target.value)}
                                placeholder={block.type === 'paragraph' ? 'Текст описания или регламента...' : 'Заголовок...'}
                              />
                            )}

                            {/* Callout box */}
                            {block.type === 'callout' && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    className="input-field text-xs font-bold"
                                    placeholder="Заголовок блока (например: ВНИМАНИЕ)"
                                    value={block.title || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'title', e.target.value)}
                                  />
                                  <select
                                    className="input-field text-xs"
                                    value={block.variant || 'warning'}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'variant', e.target.value)}
                                  >
                                    <option value="danger">Критично / Опасно (Розовый)</option>
                                    <option value="warning">Регламент / Внимание (Янтарный)</option>
                                    <option value="info">Инфо / Инструкция (Синий)</option>
                                    <option value="success">Норма / Рекомендация (Зеленый)</option>
                                  </select>
                                </div>
                                <textarea
                                  rows={2}
                                  className="input-field text-xs"
                                  placeholder="Текст регламента..."
                                  value={block.text || ''}
                                  onChange={(e) => updateLongreadBlock(bIdx, 'text', e.target.value)}
                                />
                              </div>
                            )}

                            {/* List block */}
                            {block.type === 'list' && (
                              <div className="space-y-1.5">
                                <label className="text-[11px] text-slate-400">Пункты списка (по одному на строку)</label>
                                <textarea
                                  rows={3}
                                  className="input-field text-xs"
                                  value={(block.items || []).join('\n')}
                                  onChange={(e) =>
                                    updateLongreadBlock(bIdx, 'items', e.target.value.split('\n'))
                                  }
                                />
                              </div>
                            )}

                            {/* Image block */}
                            {block.type === 'image' && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    className="input-field text-xs"
                                    placeholder="URL изображения..."
                                    value={block.url || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'url', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    className="input-field text-xs"
                                    placeholder="Подпись к фото..."
                                    value={block.caption || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'caption', e.target.value)}
                                  />
                                </div>
                                {block.url && (
                                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-center">
                                    <img src={block.url} alt="Превью" className="max-h-40 mx-auto rounded" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Block Toolbar */}
                      <div className="p-3 rounded-lg bg-slate-900/60 border border-dashed border-slate-800 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-semibold text-slate-400">Добавить блок в статью:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('h1')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
                          >
                            H1
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('h2')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
                          >
                            H2
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('paragraph')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                          >
                            Параграф
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('callout')}
                            className="px-2.5 py-1 rounded bg-amber-950/50 hover:bg-amber-900/60 border border-amber-900/50 text-xs font-semibold text-amber-300 transition-colors"
                          >
                            Внимание / Регламент
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('list')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1"
                          >
                            <List className="w-3 h-3" />
                            Список
                          </button>
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="px-2.5 py-1 rounded bg-sky-950/50 hover:bg-sky-900/60 border border-sky-900/50 text-xs font-semibold text-sky-300 transition-colors flex items-center gap-1"
                          >
                            <ImageIcon className="w-3 h-3" />
                            Загрузить фото авто
                          </button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadLongreadImage}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================== */}
              {/* 2. GIANT VIDEO CHUNKED UPLOAD (2-10 GB)         */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'video' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Загрузка видеофайла лекции (MP4 / MKV / WebM)
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Поддерживаются видеофайлы длительностью 5+ часов и размером от 2 до 10 ГБ. Загрузка производится чанками по 10 МБ без перегрузки RAM сервера.
                        </p>
                      </div>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-950/50 hover:bg-slate-950 space-y-3"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/mkv,video/webm,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-sky-400 mx-auto" />
                      <div>
                        <span className="text-xs font-semibold text-slate-200">
                          Нажмите для выбора файла или перетащите тяжелое видео сюда
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          До 10 ГБ • Потоковая чанковая отправка • Стриминг Range (HTTP 206)
                        </div>
                      </div>
                    </div>

                    {/* Upload Progress Indicator */}
                    {uploadStatus === 'uploading' && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-sky-400">
                            Чанковая загрузка на сервер: {uploadProgress}%
                          </span>
                          <span className="text-slate-400">
                            Чанк {chunkStats.current} из {chunkStats.total} ({chunkStats.speed})
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadStatus === 'completed' && (
                      <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>Видео успешно загружено и склеено на сервере! Стриминг готов к перемотке.</span>
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {/* Preview Player if file_url exists */}
                    {activeLesson.file_url ? (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Проверка плеера (HTTP 206 Range Stream):</span>
                          <span className="font-mono text-[11px] text-slate-500">{activeLesson.file_url}</span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-[420px]">
                          <video
                            controls
                            className="w-full h-full object-contain"
                            src={activeLesson.file_url}
                            preload="metadata"
                          >
                            Ваш браузер не поддерживает HTML5 видео.
                          </video>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 3. PRESENTATION (PDF) UPLOAD & VIEWER          */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'presentation' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Загрузка презентации регламента (PDF)
                    </div>

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-950/50 hover:bg-slate-950 space-y-3"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <FileCode className="w-8 h-8 text-amber-400 mx-auto" />
                      <div>
                        <span className="text-xs font-semibold text-slate-200">
                          Нажмите для выбора PDF-файла презентации
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Интерактивный встроенный просмотр для сотрудников
                        </div>
                      </div>
                    </div>

                    {uploadStatus === 'uploading' && (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                          <span>Загрузка PDF: {uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {activeLesson.file_url ? (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs text-slate-400">Предпросмотр презентации:</span>
                        <iframe
                          src={activeLesson.file_url}
                          className="w-full h-[500px] rounded-xl border border-slate-800 bg-slate-950"
                          title="Презентация"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 4. QUIZ ATTACHMENT FROM QUESTION BANK          */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'quiz' && (
                <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Привязка тестирования из Банка Тестов
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Сотрудник должен будет сдать этот тест для успешного завершения шага курса.
                      </p>
                    </div>

                    <Link
                      to="/admin/tests/new"
                      target="_blank"
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Создать новый тест
                    </Link>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-slate-300">Выберите готовый тест</label>
                    <select
                      className="input-field text-sm"
                      value={activeLesson.quiz_id || ''}
                      onChange={(e) =>
                        updateActiveLessonField(
                          'quiz_id',
                          e.target.value ? parseInt(e.target.value, 10) : null
                        )
                      }
                    >
                      <option value="">-- Выберите тест из списка --</option>
                      {availableTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} (Проходной балл: {t.passing_score}%, Вопросов: {t.questions_count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeLesson.quiz_id && (
                    <div className="p-3.5 rounded-lg bg-sky-950/30 border border-sky-800/50 text-xs text-sky-200 flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        Тест успешно привязан. В плеере сотрудника он будет запущен бесшовно с лимитом в 1 попытку и проверкой проходного балла.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
