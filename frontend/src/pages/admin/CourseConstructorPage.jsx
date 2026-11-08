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
  FolderArchive,
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
  Users,
  Video,
  X,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { AssignCourseModal } from '../../components/admin/AssignCourseModal';

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
  const [showAssignModal, setShowAssignModal] = useState(false);

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
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Knowledge Base Picker Modal
  const [showKnowledgePicker, setShowKnowledgePicker] = useState(false);
  const [knowledgeFiles, setKnowledgeFiles] = useState([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [knowledgePickerType, setKnowledgePickerType] = useState('video');
  const [knowledgeSearchTerm, setKnowledgeSearchTerm] = useState('');

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
                { type: 'callout', variant: 'warning', title: 'ВНИМАНИЕ', text: 'Соблюдение регламентов СТО проверяется службой контроля качества.' },
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

      // Ensure current activeLesson state is deeply merged into modules tree before saving
      const currentModules = modules.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => (activeLesson && l.id === activeLesson.id ? activeLesson : l)),
      }));

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
        for (const mod of currentModules) {
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
              file_url: les.file_url || null,
              file_size_bytes: les.file_size_bytes || 0,
              quiz_id: les.quiz_id || null,
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

        // Persist all modules and lessons across all sections
        for (const mod of currentModules) {
          let realModId = mod.id;
          if (typeof mod.id === 'string' && mod.id.startsWith('temp-')) {
            const modRes = await api.post(`/courses/${currentCId}/modules`, {
              title: mod.title,
              order_index: mod.order_index,
            });
            realModId = modRes.data.id;
          }

          for (const les of mod.lessons || []) {
            const lessonData = {
              title: les.title,
              order_index: les.order_index,
              lesson_type: les.lesson_type,
              content_json: typeof les.content_json === 'string' ? les.content_json : JSON.stringify(les.content_json),
              file_url: les.file_url || null,
              file_size_bytes: les.file_size_bytes || 0,
              quiz_id: les.quiz_id || null,
            };

            if (typeof les.id === 'string' && les.id.startsWith('temp-')) {
              await api.post(`/courses/${currentCId}/modules/${realModId}/lessons`, lessonData);
            } else if (typeof les.id === 'number') {
              await api.put(`/courses/${currentCId}/lessons/${les.id}`, lessonData);
            }
          }
        }
      }

      setSuccessMessage('Курс успешно сохранен!');
      setTimeout(() => setSuccessMessage(''), 3500);

      // Refresh full course data from server and preserve activeLesson reference
      if (currentCId) {
        const res = await api.get(`/courses/${currentCId}`);
        const freshModules = res.data.modules || [];
        setModules(freshModules);

        if (activeLesson) {
          let updatedActive = null;
          for (const m of freshModules) {
            const found = (m.lessons || []).find((l) => l.id === activeLesson.id || l.title === activeLesson.title);
            if (found) {
              updatedActive = found;
              setActiveModuleId(m.id);
              break;
            }
          }
          if (updatedActive) {
            setActiveLesson(updatedActive);
          } else if (freshModules.length > 0 && freshModules[0].lessons?.length > 0) {
            setActiveLesson(freshModules[0].lessons[0]);
            setActiveModuleId(freshModules[0].id);
          }
        }
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
      content_json:
        type === 'article'
          ? JSON.stringify([
              { type: 'h1', text: 'Заголовок инструкции' },
              { type: 'paragraph', text: 'Введите текст регламента или описания процесса...' },
            ])
          : '[]',
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
  // Active Lesson Field Updates (Atomic & Functional)
  // ----------------------------------------------------
  const updateActiveLessonFields = (fieldsObj) => {
    setActiveLesson((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...fieldsObj };
      setModules((prevMods) =>
        prevMods.map((m) => ({
          ...m,
          lessons: (m.lessons || []).map((l) => (l.id === updated.id ? updated : l)),
        }))
      );
      return updated;
    });
  };

  const updateActiveLessonField = (field, value) => {
    updateActiveLessonFields({ [field]: value });
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
  // Knowledge Base Picker Handlers
  // ----------------------------------------------------
  const handleOpenKnowledgePicker = async (type = 'video') => {
    setKnowledgePickerType(type);
    setShowKnowledgePicker(true);
    setLoadingKnowledge(true);
    setKnowledgeSearchTerm('');
    try {
      const res = await api.get('/knowledge', {
        params: { file_type: type },
      });
      setKnowledgeFiles(res.data || []);
    } catch (err) {
      console.error('Ошибка загрузки файлов из базы знаний:', err);
    } finally {
      setLoadingKnowledge(false);
    }
  };

  const handleSelectKnowledgeFile = async (kf) => {
    const shouldUpdateTitle =
      activeLesson &&
      (!activeLesson.title ||
        activeLesson.title.startsWith('Видеоурок') ||
        activeLesson.title.startsWith('Урок') ||
        activeLesson.title.startsWith('Презентация'));

    const fieldsToUpdate = {
      file_url: kf.file_url,
      file_size_bytes: kf.file_size_bytes || 0,
      lesson_type: knowledgePickerType === 'presentation' ? 'presentation' : 'video',
      ...(shouldUpdateTitle ? { title: kf.title } : {}),
    };

    updateActiveLessonFields(fieldsToUpdate);

    if (activeLesson && typeof activeLesson.id === 'number') {
      try {
        if (courseId) {
          await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, fieldsToUpdate);
        } else {
          await api.put(`/courses/lessons/${activeLesson.id}`, fieldsToUpdate);
        }
      } catch (err) {
        console.warn('Autosave file_url failed:', err);
      }
    }

    setShowKnowledgePicker(false);
    setSuccessMessage(`Материал «${kf.title}» прикреплен к уроку!`);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  // ----------------------------------------------------
  // Direct & Chunked Upload for Giant Videos & PDFs
  // ----------------------------------------------------
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    setUploadStatus('uploading');
    setUploadError('');

    const totalSize = file.size;
    const category = activeLesson?.lesson_type === 'presentation' ? 'presentation' : 'video';

    // 1. Direct stream upload for standard size files (< 100MB)
    if (totalSize < 100 * 1024 * 1024) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        if (activeLesson?.id && typeof activeLesson.id === 'number') {
          formData.append('lesson_id', activeLesson.id);
        }
        formData.append('title', activeLesson?.title || file.name);

        const res = await api.post('/v1/media/upload/direct', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (pe) => {
            if (pe.total) {
              setUploadProgress(Math.round((pe.loaded * 100) / pe.total));
            }
          },
        });

        const compData = res.data;
        const uploadedUrl = compData.file_url;
        const uploadedSize = compData.file_size_bytes || totalSize;

        setUploadStatus('completed');
        updateActiveLessonFields({
          file_url: uploadedUrl,
          file_size_bytes: uploadedSize,
          lesson_type: category,
        });

        if (activeLesson && typeof activeLesson.id === 'number') {
          try {
            if (courseId) {
              await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, {
                file_url: uploadedUrl,
                file_size_bytes: uploadedSize,
                lesson_type: category,
              });
            } else {
              await api.put(`/courses/lessons/${activeLesson.id}`, {
                file_url: uploadedUrl,
                file_size_bytes: uploadedSize,
                lesson_type: category,
              });
            }
          } catch (e) {
            console.warn('Autosave after direct upload failed:', e);
          }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (pdfInputRef.current) pdfInputRef.current.value = '';
        return;
      } catch (err) {
        console.warn('Прямая загрузка завершилась с ошибкой, переключение на чанки:', err);
      }
    }

    // 2. Chunked upload for giant files (100MB - 10GB)
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
      formData.append('category', category);
      if (activeLesson?.id && typeof activeLesson.id === 'number') {
        formData.append('lesson_id', activeLesson.id);
      }
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

        if (res.data.status === 'completed' || res.data.status === 'success') {
          const compData = res.data;
          const uploadedUrl = compData.file_url;
          const uploadedSize = compData.file_size_bytes || totalSize;

          setUploadStatus('completed');
          updateActiveLessonFields({
            file_url: uploadedUrl,
            file_size_bytes: uploadedSize,
            lesson_type: category,
          });

          if (activeLesson && typeof activeLesson.id === 'number') {
            try {
              if (courseId) {
                await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, {
                  file_url: uploadedUrl,
                  file_size_bytes: uploadedSize,
                  lesson_type: category,
                });
              } else {
                await api.put(`/courses/lessons/${activeLesson.id}`, {
                  file_url: uploadedUrl,
                  file_size_bytes: uploadedSize,
                  lesson_type: category,
                });
              }
            } catch (e2) {
              console.warn('Autosave file_url failed:', e2);
            }
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (pdfInputRef.current) pdfInputRef.current.value = '';
          break;
        }

        // Explicit complete fallback on final chunk
        if (chunkIndex === totalChunks - 1 && res.data.status !== 'completed' && res.data.status !== 'success') {
          try {
            const compPayload = {
              upload_id: uploadId,
              original_filename: file.name,
              category: activeLesson?.lesson_type === 'presentation' ? 'presentation' : 'video',
            };
            if (activeLesson?.id && typeof activeLesson.id === 'number') {
              compPayload.lesson_id = activeLesson.id;
            }
            const compRes = await api.post('/v1/media/upload/complete', compPayload);
            if (compRes.data && compRes.data.file_url) {
              const uploadedUrl = compRes.data.file_url;
              const uploadedSize = compRes.data.file_size_bytes || totalSize;

              setUploadStatus('completed');
              updateActiveLessonFields({
                file_url: uploadedUrl,
                file_size_bytes: uploadedSize,
                lesson_type: category,
              });

              if (activeLesson && typeof activeLesson.id === 'number') {
                try {
                  if (courseId) {
                    await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, {
                      file_url: uploadedUrl,
                      file_size_bytes: uploadedSize,
                      lesson_type: category,
                    });
                  } else {
                    await api.put(`/courses/lessons/${activeLesson.id}`, {
                      file_url: uploadedUrl,
                      file_size_bytes: uploadedSize,
                      lesson_type: category,
                    });
                  }
                } catch (e2) {
                  console.warn('Autosave file_url failed:', e2);
                }
              }
            }
          } catch (compErr) {
            console.warn('Complete call fallback:', compErr);
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
      } catch (err) {
        console.error('Ошибка отправки чанка:', err);
        setUploadStatus('error');
        setUploadError(getErrorMessage(err, `Сбой отправки чанка ${chunkIndex + 1}/${totalChunks}`));
        return;
      }
    }
  };

  // Autosave and switch lesson in editor
  const handleSelectLessonInEditor = async (nextLesson, nextModuleId) => {
    if (activeLesson && typeof activeLesson.id === 'number' && courseId) {
      try {
        await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, {
          title: activeLesson.title,
          order_index: activeLesson.order_index,
          lesson_type: activeLesson.lesson_type,
          content_json:
            typeof activeLesson.content_json === 'string'
              ? activeLesson.content_json
              : JSON.stringify(activeLesson.content_json),
          file_url: activeLesson.file_url || null,
          file_size_bytes: activeLesson.file_size_bytes || 0,
          quiz_id: activeLesson.quiz_id || null,
        });
      } catch (e) {
        console.warn('Autosave on switch failed:', e);
      }
    }
    setActiveLesson(nextLesson);
    setActiveModuleId(nextModuleId);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#F4F5F7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#003B73] animate-spin" />
          <span className="text-sm font-semibold text-[#6C757D]">Загрузка структуры курса...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 pb-28">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/courses"
            className="p-2.5 rounded-xl bg-white border border-[#E0E0E0] text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] transition-colors shadow-2xs"
            title="Назад к списку курсов"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-[#212529] tracking-tight">
                {isEditing ? 'Конструктор курса' : 'Новый обучающий курс'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#003B73]/10 border border-[#003B73]/20 text-[#003B73] uppercase tracking-wider">
                iSpring Module
              </span>
            </div>
            <p className="text-xs text-[#6C757D] mt-0.5">
              Настройка разделов, лонгридов, видео 5+ часов, презентаций и тестов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isEditing && (
            <>
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 min-h-[40px] px-3.5"
                title="Назначить курс сотрудникам"
              >
                <Users className="w-4 h-4 text-[#003B73]" />
                <span>Назначить курс</span>
              </button>

              <Link
                to={`/courses/${courseId}/learn`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-xs flex items-center gap-1.5 min-h-[40px] px-3.5"
              >
                <Eye className="w-4 h-4 text-[#003B73]" />
                <span>Плеер сотрудника</span>
              </Link>
            </>
          )}

          <button
            onClick={handleSaveCourse}
            disabled={saving}
            className="btn-primary text-xs flex items-center gap-1.5 min-h-[40px] px-5 font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Сохранение...' : 'Сохранить курс'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#E30613] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Course Core Settings Card */}
      <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-[#212529]">Название курса *</label>
            <input
              type="text"
              className="input-field font-bold text-sm bg-white"
              placeholder="Например: Диагностика тормозных систем AutoMall"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#212529]">Подразделение (Тег)</label>
            <select
              className="input-field text-sm bg-white"
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
            <label className="text-xs font-bold text-[#212529]">Краткое описание курса</label>
            <textarea
              rows={2}
              className="input-field text-xs bg-white"
              placeholder="Опишите цели обучения, приобретаемые навыки и регламенты..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#212529]">URL обложки курса (баннер)</label>
              <input
                type="text"
                className="input-field text-xs bg-white"
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
                className="w-4 h-4 rounded border-[#E0E0E0] text-[#003B73] focus:ring-[#003B73] cursor-pointer"
              />
              <label htmlFor="isPublished" className="text-xs font-bold text-[#212529] cursor-pointer">
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
          <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E0E0E0]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#003B73]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                  Структура курса
                </span>
              </div>
              <button
                onClick={handleAddModule}
                className="text-xs font-bold text-[#003B73] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Раздел</span>
              </button>
            </div>

            {/* Modules List */}
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {modules.length === 0 ? (
                <div className="text-center py-8 text-[#6C757D] text-xs">
                  Нет разделов. Нажмите «+ Раздел», чтобы добавить.
                </div>
              ) : (
                modules.map((mod, modIdx) => (
                  <div
                    key={mod.id}
                    className={`rounded-xl border transition-all ${
                      activeModuleId === mod.id
                        ? 'border-[#003B73] bg-[#003B73]/5 shadow-2xs'
                        : 'border-[#E0E0E0] bg-[#F4F5F7]/60'
                    }`}
                  >
                    {/* Module Header */}
                    <div className="p-2.5 flex items-center justify-between gap-2 border-b border-[#E0E0E0]">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#003B73] text-white shrink-0">
                          {modIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={mod.title}
                          onChange={(e) => handleUpdateModuleTitle(mod.id, e.target.value)}
                          className="bg-transparent text-xs font-bold text-[#212529] border-none focus:outline-none focus:ring-0 w-full truncate"
                          title="Кликните для редактирования названия"
                        />
                      </div>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleMoveModule(modIdx, 'up')}
                          disabled={modIdx === 0}
                          className="p-1.5 rounded text-[#6C757D] hover:text-[#212529] hover:bg-white disabled:opacity-20"
                          title="Поднять раздел выше"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveModule(modIdx, 'down')}
                          disabled={modIdx === modules.length - 1}
                          className="p-1.5 rounded text-[#6C757D] hover:text-[#212529] hover:bg-white disabled:opacity-20"
                          title="Опустить раздел ниже"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1.5 rounded text-[#6C757D] hover:text-[#E30613] hover:bg-red-50 transition-colors"
                          title="Удалить раздел"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Lessons inside module */}
                    <div className="p-2 space-y-1">
                      {(mod.lessons || []).map((les) => {
                        const isSelected = activeLesson?.id === les.id;
                        const iconMap = {
                          article: <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
                          video: <Video className="w-3.5 h-3.5 text-[#003B73] shrink-0" />,
                          presentation: <FileCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
                          quiz: <HelpCircle className="w-3.5 h-3.5 text-[#E30613] shrink-0" />,
                        };

                        return (
                          <div
                            key={les.id}
                            onClick={() => handleSelectLessonInEditor(les, mod.id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-all ${
                              isSelected
                                ? 'bg-[#003B73] text-white font-bold shadow-xs'
                                : 'text-[#212529] hover:bg-white hover:border-[#E0E0E0] border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {isSelected ? (
                                <span className="text-white shrink-0">{iconMap[les.lesson_type] || <FileText className="w-3.5 h-3.5" />}</span>
                              ) : (
                                iconMap[les.lesson_type] || <FileText className="w-3.5 h-3.5" />
                              )}
                              <span className="truncate">{les.title}</span>
                              {les.lesson_type === 'video' && les.file_url && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-sm" title="Видео прикреплено" />
                              )}
                              {les.lesson_type === 'presentation' && les.file_url && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-sm" title="Презентация прикреплена" />
                              )}
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLesson(mod.id, les.id);
                              }}
                              className={`p-1 rounded transition-colors ${
                                isSelected ? 'text-white/80 hover:text-white' : 'text-[#6C757D] hover:text-[#E30613]'
                              }`}
                              title="Удалить урок"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Add Lesson Dropdown Button */}
                      <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleAddLesson(mod.id, 'article')}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 min-h-[32px]"
                        >
                          <Plus className="w-3 h-3 text-emerald-600" />
                          <span>Лонгрид</span>
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'video')}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 min-h-[32px]"
                        >
                          <Plus className="w-3 h-3 text-[#003B73]" />
                          <span>Видео</span>
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'quiz')}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 min-h-[32px]"
                        >
                          <Plus className="w-3 h-3 text-[#E30613]" />
                          <span>Тест</span>
                        </button>
                        <button
                          onClick={() => handleAddLesson(mod.id, 'presentation')}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 min-h-[32px]"
                          title="Добавить презентацию (PDF)"
                        >
                          <Plus className="w-3 h-3 text-amber-600" />
                          <span>PDF</span>
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
            <div className="bg-white rounded-2xl border border-[#E0E0E0] p-12 text-center text-[#6C757D] space-y-3 shadow-sm">
              <Layers className="w-12 h-12 mx-auto text-[#6C757D] opacity-40" />
              <div className="text-base font-bold text-[#212529]">Урок не выбран</div>
              <p className="text-xs max-w-sm mx-auto leading-relaxed">
                Выберите урок в дереве слева или добавьте новый раздел и урок, чтобы приступить к верстке лонгрида или загрузке видео.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-5 sm:p-6 space-y-6">
              {/* Lesson General Header */}
              <div className="space-y-4 pb-5 border-b border-[#E0E0E0]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-bold text-[#212529]">Название урока</label>
                    <input
                      type="text"
                      className="input-field text-base font-bold text-[#212529] bg-white"
                      value={activeLesson.title}
                      onChange={(e) => updateActiveLessonField('title', e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-end">
                    <button
                      onClick={() => setPreviewMode(!previewMode)}
                      className={`btn-secondary text-xs flex items-center gap-1.5 min-h-[40px] px-3.5 ${
                        previewMode ? 'bg-[#003B73] text-white border-[#003B73]' : ''
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{previewMode ? 'Редактор' : 'Предпросмотр'}</span>
                    </button>
                  </div>
                </div>

                {/* Lesson Type Selector Tabs */}
                <div>
                  <label className="text-xs font-bold text-[#212529] block mb-2">Формат урока</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'article', label: 'Лонгрид / Статья', icon: FileText, color: 'text-emerald-600' },
                      { id: 'video', label: 'Видео (2–10 ГБ)', icon: Video, color: 'text-[#003B73]' },
                      { id: 'presentation', label: 'Презентация PDF', icon: FileCode, color: 'text-amber-600' },
                      { id: 'quiz', label: 'Тестирование', icon: HelpCircle, color: 'text-[#E30613]' },
                    ].map((t) => {
                      const Icon = t.icon;
                      const active = activeLesson.lesson_type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => updateActiveLessonField('lesson_type', t.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 min-h-[64px] ${
                            active
                              ? 'bg-[#003B73] border-[#003B73] text-white shadow-sm'
                              : 'bg-[#F4F5F7] border-[#E0E0E0] text-[#6C757D] hover:text-[#212529] hover:bg-[#E0E0E0]/60'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${active ? 'text-white' : t.color}`} />
                          <span className="text-xs font-bold">{t.label}</span>
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
                    <div className="prose max-w-none space-y-4 text-[#212529]">
                      {getParsedLongreadBlocks().map((block, idx) => {
                        if (block.type === 'h1') {
                          return <h1 key={idx} className="text-2xl font-black text-[#212529]">{block.text}</h1>;
                        }
                        if (block.type === 'h2') {
                          return <h2 key={idx} className="text-xl font-bold text-[#003B73] mt-6">{block.text}</h2>;
                        }
                        if (block.type === 'paragraph') {
                          return <p key={idx} className="text-sm text-[#212529] leading-relaxed">{block.text}</p>;
                        }
                        if (block.type === 'callout') {
                          const variants = {
                            danger: 'bg-red-50 border-red-200 text-[#E30613]',
                            warning: 'bg-amber-50 border-amber-200 text-amber-800',
                            info: 'bg-blue-50 border-blue-200 text-[#003B73]',
                            success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
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
                            <ul key={idx} className="list-disc list-inside space-y-1 text-xs text-[#212529]">
                              {(block.items || []).map((item, iIdx) => (
                                <li key={iIdx}>{item}</li>
                              ))}
                            </ul>
                          );
                        }
                        if (block.type === 'image') {
                          return (
                            <div key={idx} className="space-y-1.5 text-center my-4">
                              <img src={block.url} alt={block.caption} className="rounded-xl max-h-96 mx-auto border border-[#E0E0E0]" />
                              {block.caption && <div className="text-[11px] text-[#6C757D] italic">{block.caption}</div>}
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
                          <div key={bIdx} className="p-3.5 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0] relative group space-y-2">
                            <div className="flex items-center justify-between pb-1 border-b border-[#E0E0E0]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6C757D]">
                                Блок: {block.type}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeLongreadBlock(bIdx)}
                                className="text-[#6C757D] hover:text-[#E30613] transition-colors p-1 rounded"
                                title="Удалить блок"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* H1 / H2 / Paragraph text */}
                            {(block.type === 'h1' || block.type === 'h2' || block.type === 'paragraph') && (
                              <textarea
                                rows={block.type === 'paragraph' ? 3 : 1}
                                className="input-field text-xs bg-white"
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
                                    className="input-field text-xs font-bold bg-white"
                                    placeholder="Заголовок блока (например: ВНИМАНИЕ)"
                                    value={block.title || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'title', e.target.value)}
                                  />
                                  <select
                                    className="input-field text-xs bg-white"
                                    value={block.variant || 'warning'}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'variant', e.target.value)}
                                  >
                                    <option value="danger">Критично / Опасно (Красный)</option>
                                    <option value="warning">Регламент / Внимание (Янтарный)</option>
                                    <option value="info">Инфо / Инструкция (Синий)</option>
                                    <option value="success">Норма / Рекомендация (Зеленый)</option>
                                  </select>
                                </div>
                                <textarea
                                  rows={2}
                                  className="input-field text-xs bg-white"
                                  placeholder="Текст регламента..."
                                  value={block.text || ''}
                                  onChange={(e) => updateLongreadBlock(bIdx, 'text', e.target.value)}
                                />
                              </div>
                            )}

                            {/* List block */}
                            {block.type === 'list' && (
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-[#6C757D]">Пункты списка (по одному на строку)</label>
                                <textarea
                                  rows={3}
                                  className="input-field text-xs bg-white"
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
                                    className="input-field text-xs bg-white"
                                    placeholder="URL изображения..."
                                    value={block.url || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'url', e.target.value)}
                                  />
                                  <input
                                    type="text"
                                    className="input-field text-xs bg-white"
                                    placeholder="Подпись к фото..."
                                    value={block.caption || ''}
                                    onChange={(e) => updateLongreadBlock(bIdx, 'caption', e.target.value)}
                                  />
                                </div>
                                {block.url && (
                                  <div className="p-2 bg-white rounded-xl border border-[#E0E0E0] text-center">
                                    <img src={block.url} alt="Превью" className="max-h-40 mx-auto rounded" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Add Block Toolbar */}
                      <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-dashed border-[#E0E0E0] flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-[#212529]">Добавить блок в статью:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('h1')}
                            className="btn-secondary text-xs py-1.5 px-3 font-bold min-h-[34px]"
                          >
                            H1
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('h2')}
                            className="btn-secondary text-xs py-1.5 px-3 font-bold min-h-[34px]"
                          >
                            H2
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('paragraph')}
                            className="btn-secondary text-xs py-1.5 px-3 font-medium min-h-[34px]"
                          >
                            Параграф
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('callout')}
                            className="btn-secondary text-xs py-1.5 px-3 text-amber-800 font-bold min-h-[34px]"
                          >
                            Внимание / Регламент
                          </button>
                          <button
                            type="button"
                            onClick={() => addLongreadBlock('list')}
                            className="btn-secondary text-xs py-1.5 px-3 font-medium min-h-[34px] flex items-center gap-1"
                          >
                            <List className="w-3 h-3" />
                            Список
                          </button>
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="btn-secondary text-xs py-1.5 px-3 text-[#003B73] font-bold min-h-[34px] flex items-center gap-1"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            Загрузить фото
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
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                          Видеофайл лекции (MP4 / MKV / WebM)
                        </div>
                        <p className="text-xs text-[#6C757D] mt-0.5">
                          Поддерживаются видеофайлы длительностью 5+ часов и размером до 10 ГБ. Загрузите файл с ПК или выберите готовый из Базы знаний.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenKnowledgePicker('video')}
                          className="btn-secondary text-xs font-bold text-[#003B73] min-h-[38px] px-3.5 flex items-center gap-1.5"
                        >
                          <FolderArchive className="w-3.5 h-3.5" />
                          <span>Выбрать из Базы знаний</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-primary text-xs font-bold min-h-[38px] px-3.5 flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Загрузить видео с ПК</span>
                        </button>
                      </div>
                    </div>

                    {/* Hidden file input for chunked video upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/mkv,video/webm,video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Upload Progress Indicator */}
                    {uploadStatus === 'uploading' && (
                      <div className="p-4 rounded-xl bg-white border border-[#E0E0E0] shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#003B73]">
                            Чанковая загрузка на сервер: {uploadProgress}%
                          </span>
                          <span className="text-[#6C757D]">
                            Чанк {chunkStats.current} из {chunkStats.total} ({chunkStats.speed})
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#E0E0E0] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E30613] transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {uploadStatus === 'completed' && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>Видео успешно загружено и привязано к уроку! Автосохранение выполнено.</span>
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#E30613] text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {/* Embedded Video Preview Player with Replace Video Button OR Dropzone */}
                    {activeLesson.file_url ? (
                      <div className="rounded-2xl overflow-hidden border border-[#E0E0E0] bg-[#212529] p-3 space-y-3 shadow-md">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Видео успешно привязано к уроку</span>
                          </div>
                          {activeLesson.file_size_bytes > 0 && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/60 text-white">
                              {(activeLesson.file_size_bytes / (1024 * 1024)).toFixed(1)} МБ
                            </span>
                          )}
                        </div>

                        <video
                          key={activeLesson.file_url}
                          src={activeLesson.file_url.startsWith('http') ? activeLesson.file_url : `${activeLesson.file_url}`}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full max-h-[380px] rounded-xl object-contain bg-black border border-white/10"
                        />
                        <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1 text-xs text-white/80">
                          <span className="truncate max-w-sm font-mono text-[11px] text-white/60">
                            {activeLesson.file_url}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenKnowledgePicker('video')}
                              className="text-white hover:underline transition-colors font-bold"
                            >
                              Выбрать другое из Базы
                            </button>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-white hover:underline transition-colors font-bold"
                            >
                              Загрузить с ПК
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                updateActiveLessonFields({ file_url: null, file_size_bytes: 0 });
                                if (activeLesson && typeof activeLesson.id === 'number') {
                                  try {
                                    if (courseId) {
                                      await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, { file_url: null, file_size_bytes: 0 });
                                    } else {
                                      await api.put(`/courses/lessons/${activeLesson.id}`, { file_url: null, file_size_bytes: 0 });
                                    }
                                  } catch (errDel) {
                                    console.warn('Failed to clear video:', errDel);
                                  }
                                }
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors font-bold"
                            >
                              Удалить видео
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Drag and Drop Zone */
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#E0E0E0] hover:border-[#003B73] rounded-2xl p-8 text-center cursor-pointer transition-all bg-white hover:bg-[#003B73]/5 space-y-3 group"
                      >
                        <Upload className="w-8 h-8 text-[#003B73] group-hover:scale-110 transition-transform mx-auto" />
                        <div>
                          <span className="text-xs font-bold text-[#212529]">
                            Нажмите для выбора файла или перетащите видео сюда
                          </span>
                          <div className="text-[11px] text-[#6C757D] mt-1">
                            До 10 ГБ • Потоковая чанковая отправка • Стриминг Range (HTTP 206)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 3. PRESENTATION (PDF) UPLOAD & VIEWER          */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'presentation' && (
                <div className="space-y-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                          Презентация регламента (PDF)
                        </div>
                        <p className="text-xs text-[#6C757D] mt-0.5">
                          Интерактивный встроенный просмотр PDF-слайдов для сотрудников. Загрузите файл с ПК или выберите из Базы знаний.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenKnowledgePicker('presentation')}
                          className="btn-secondary text-xs font-bold text-amber-800 min-h-[38px] px-3.5 flex items-center gap-1.5"
                        >
                          <FolderArchive className="w-3.5 h-3.5" />
                          <span>Выбрать из Базы знаний</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="btn-secondary text-xs font-bold min-h-[38px] px-3.5 flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Загрузить PDF с ПК</span>
                        </button>
                      </div>
                    </div>

                    <div
                      onClick={() => pdfInputRef.current?.click()}
                      className="border-2 border-dashed border-[#E0E0E0] hover:border-[#003B73] rounded-2xl p-8 text-center cursor-pointer transition-all bg-white hover:bg-[#003B73]/5 space-y-3"
                    >
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <FileCode className="w-8 h-8 text-amber-600 mx-auto" />
                      <div>
                        <span className="text-xs font-bold text-[#212529]">
                          Нажмите для выбора PDF-файла презентации
                        </span>
                        <div className="text-[11px] text-[#6C757D] mt-1">
                          Интерактивный встроенный просмотр для сотрудников
                        </div>
                      </div>
                    </div>

                    {uploadStatus === 'uploading' && (
                      <div className="p-4 rounded-xl bg-white border border-[#E0E0E0] shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs text-amber-700 font-bold">
                          <span>Загрузка PDF: {uploadProgress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-[#E0E0E0] rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    {activeLesson.file_url ? (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Презентация успешно привязана</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenKnowledgePicker('presentation')}
                              className="text-amber-800 hover:underline transition-colors font-bold"
                            >
                              Выбрать другую из Базы
                            </button>
                            <button
                              type="button"
                              onClick={() => pdfInputRef.current?.click()}
                              className="text-[#003B73] hover:underline transition-colors font-bold"
                            >
                              Загрузить PDF
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                updateActiveLessonFields({ file_url: null, file_size_bytes: 0 });
                                if (activeLesson && typeof activeLesson.id === 'number') {
                                  try {
                                    if (courseId) {
                                      await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, { file_url: null, file_size_bytes: 0 });
                                    } else {
                                      await api.put(`/courses/lessons/${activeLesson.id}`, { file_url: null, file_size_bytes: 0 });
                                    }
                                  } catch (errDel) {
                                    console.warn('Failed to clear pdf:', errDel);
                                  }
                                }
                              }}
                              className="text-[#E30613] hover:underline transition-colors font-bold"
                            >
                              Удалить PDF
                            </button>
                          </div>
                        </div>
                        <iframe
                          src={activeLesson.file_url}
                          className="w-full h-[500px] rounded-2xl border border-[#E0E0E0] bg-white shadow-md"
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
                <div className="p-5 rounded-2xl bg-[#F4F5F7] border border-[#E0E0E0] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                        Привязка тестирования из Банка Тестов
                      </div>
                      <p className="text-xs text-[#6C757D] mt-0.5">
                        Сотрудник должен будет сдать этот тест для успешного завершения шага курса.
                      </p>
                    </div>

                    <Link
                      to="/admin/tests/new"
                      target="_blank"
                      className="btn-secondary text-xs flex items-center gap-1.5 min-h-[38px] px-3.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Создать новый тест</span>
                    </Link>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-[#212529]">Выберите готовый тест</label>
                    <select
                      className="input-field text-sm bg-white"
                      value={activeLesson.quiz_id || ''}
                      onChange={async (e) => {
                        const quizId = e.target.value ? Number(e.target.value) : null;
                        updateActiveLessonField('quiz_id', quizId);
                        if (activeLesson && typeof activeLesson.id === 'number') {
                          try {
                            await api.put(`/courses/lessons/${activeLesson.id}`, { quiz_id: quizId });
                          } catch {
                            if (courseId) {
                              try {
                                await api.put(`/courses/${courseId}/lessons/${activeLesson.id}`, { quiz_id: quizId });
                              } catch (errQ) {
                                console.warn('Не удалось автоматически сохранить quiz_id:', errQ);
                              }
                            }
                          }
                        }
                      }}
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
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-[#003B73] flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#003B73] shrink-0" />
                      <div className="font-medium">
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

      {/* Knowledge Base Picker Modal */}
      {showKnowledgePicker && (
        <div className="fixed inset-0 z-50 bg-[#003B73]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white max-w-2xl w-full max-h-[85vh] flex flex-col rounded-2xl border border-[#E0E0E0] p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
              <div className="flex items-center gap-2">
                <FolderArchive className="w-5 h-5 text-[#003B73]" />
                <h3 className="text-base font-bold text-[#212529]">
                  Выбрать {knowledgePickerType === 'presentation' ? 'презентацию' : 'видео'} из Базы знаний
                </h3>
              </div>
              <button
                onClick={() => setShowKnowledgePicker(false)}
                className="text-[#6C757D] hover:text-[#212529] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick search */}
            <div className="relative">
              <input
                type="text"
                value={knowledgeSearchTerm}
                onChange={(e) => setKnowledgeSearchTerm(e.target.value)}
                placeholder="Поиск по названию файла в Базе знаний..."
                className="input-field text-xs sm:text-sm py-2 w-full bg-white"
              />
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E0E0E0] max-h-[50vh] pr-1">
              {loadingKnowledge ? (
                <div className="py-12 text-center text-xs text-[#6C757D] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#003B73]" />
                  <span>Загрузка файлов из Базы знаний...</span>
                </div>
              ) : knowledgeFiles.filter(
                  (kf) =>
                    !knowledgeSearchTerm.trim() ||
                    kf.title.toLowerCase().includes(knowledgeSearchTerm.toLowerCase()) ||
                    kf.file_name.toLowerCase().includes(knowledgeSearchTerm.toLowerCase())
                ).length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FolderArchive className="w-8 h-8 text-[#6C757D] mx-auto opacity-50" />
                  <div className="text-xs text-[#6C757D]">
                    В Базе знаний пока нет загруженных {knowledgePickerType === 'presentation' ? 'презентаций' : 'видео'}.
                  </div>
                  <div className="text-[11px] text-[#6C757D]">
                    Вы можете загрузить файл с компьютера, и он автоматически сохранится в Базу знаний.
                  </div>
                </div>
              ) : (
                knowledgeFiles
                  .filter(
                    (kf) =>
                      !knowledgeSearchTerm.trim() ||
                      kf.title.toLowerCase().includes(knowledgeSearchTerm.toLowerCase()) ||
                      kf.file_name.toLowerCase().includes(knowledgeSearchTerm.toLowerCase())
                  )
                  .map((kf) => (
                    <div
                      key={kf.id}
                      className="py-3 px-3 flex items-center justify-between gap-3 hover:bg-[#F4F5F7] rounded-xl transition-colors group cursor-pointer"
                      onClick={() => handleSelectKnowledgeFile(kf)}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-bold text-[#212529] group-hover:text-[#003B73] transition-colors truncate">
                          {kf.title}
                        </div>
                        <div className="text-[11px] text-[#6C757D] flex items-center gap-2 truncate">
                          <span className="px-2 py-0.5 rounded bg-[#F4F5F7] border border-[#E0E0E0] text-[10px] text-[#212529] font-bold">
                            {kf.department}
                          </span>
                          <span>{kf.file_name}</span>
                          <span>• {(kf.file_size_bytes / (1024 * 1024)).toFixed(1)} МБ</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectKnowledgeFile(kf);
                        }}
                        className="btn-primary text-xs py-1.5 px-3.5 shrink-0 font-bold min-h-[34px]"
                      >
                        Прикрепить
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-[#E0E0E0] flex justify-end">
              <button
                type="button"
                onClick={() => setShowKnowledgePicker(false)}
                className="btn-secondary text-xs py-2 px-4 min-h-[40px]"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && courseId && (
        <AssignCourseModal
          course={{ id: courseId, title, department_tag: departmentTag }}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
};
