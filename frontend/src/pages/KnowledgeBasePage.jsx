import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  File,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderArchive,
  Grid,
  HardDrive,
  ImageIcon,
  Layers,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  MoreVertical,
  Play,
  PlayCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api, { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const KnowledgeBasePage = () => {
  const { user, isAdmin } = useAuth();

  // Data states
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // all, video, presentation, document, image
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest, name, size
  const [viewMode, setViewMode] = useState('grid'); // grid, list

  // Modal states
  const [activeMediaModal, setActiveMediaModal] = useState(null); // File currently opened in player/viewer
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoPlayerRef = useRef(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDept, setUploadDept] = useState('Общий');
  const [uploadCategory, setUploadCategory] = useState('video');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Edit Modal states
  const [editingFile, setEditingFile] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDept, setEditDept] = useState('Общий');
  const [editCategory, setEditCategory] = useState('video');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Confirm Modal
  const [deletingFile, setDeletingFile] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast / Copy notification
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch files and stats
  useEffect(() => {
    fetchKnowledgeData();
  }, [selectedCategory, selectedDepartment, sortBy]);

  const fetchKnowledgeData = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (selectedCategory !== 'all') params.file_type = selectedCategory;
      if (selectedDepartment !== 'all') params.department = selectedDepartment;
      if (sortBy) params.sort_by = sortBy;

      const [filesRes, statsRes] = await Promise.all([
        api.get('/knowledge', { params }),
        api.get('/knowledge/stats'),
      ]);

      setFiles(filesRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Ошибка загрузки Базы знаний:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить материалы Базы знаний.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchKnowledgeData();
  };

  // Format bytes helper
  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes || bytes === 0) return '0 Б';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Auto-detect category from filename
  const detectCategoryFromName = (name) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'].includes(ext)) return 'video';
    if (['pdf', 'ppt', 'pptx'].includes(ext)) return 'presentation';
    if (['doc', 'docx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'csv'].includes(ext)) return 'document';
    if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(ext)) return 'image';
    return 'document';
  };

  // Handle file select for upload modal
  const handleSelectUploadFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const cat = detectCategoryFromName(file.name);
    setUploadCategory(cat);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setUploadTitle(cleanName);
    setUploadError('');
  };

  // Handle upload submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Пожалуйста, выберите файл для загрузки.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Укажите название материала.');
      return;
    }

    try {
      setUploading(true);
      setUploadError('');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDesc.trim());
      formData.append('department', uploadDept);
      formData.append('file_type', uploadCategory);

      const res = await api.post('/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      showToast('Материал успешно загружен в Базу знаний!');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadProgress(0);

      fetchKnowledgeData();
    } catch (err) {
      console.error('Ошибка загрузки материала:', err);
      setUploadError(getErrorMessage(err, 'Сбой при загрузке файла. Проверьте размер и формат.'));
    } finally {
      setUploading(false);
    }
  };

  // View action
  const handleOpenMedia = async (file) => {
    setActiveMediaModal(file);
    setPlaybackRate(1);
    try {
      await api.post(`/knowledge/${file.id}/view`);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, views_count: f.views_count + 1 } : f))
      );
    } catch {
      // Non-critical
    }
  };

  // Download action
  const handleDownload = async (file, e) => {
    if (e) e.stopPropagation();
    try {
      // Track download
      window.open(`/api/knowledge/download/${file.id}`, '_blank');
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, downloads_count: f.downloads_count + 1 } : f))
      );
      showToast(`Началось скачивание «${file.title}»`);
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка скачивания файла'));
    }
  };

  // Copy link action
  const handleCopyLink = (file, e) => {
    if (e) e.stopPropagation();
    const fullUrl = `${window.location.origin}${file.file_url}`;
    navigator.clipboard.writeText(fullUrl);
    showToast('Прямая ссылка на файл скопирована в буфер!');
  };

  // Open Edit Modal
  const handleOpenEdit = (file, e) => {
    if (e) e.stopPropagation();
    setEditingFile(file);
    setEditTitle(file.title);
    setEditDesc(file.description || '');
    setEditDept(file.department || 'Общий');
    setEditCategory(file.file_type || 'video');
  };

  // Save Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingFile) return;
    try {
      setSavingEdit(true);
      const res = await api.put(`/knowledge/${editingFile.id}`, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        department: editDept,
        file_type: editCategory,
      });

      setFiles((prev) => prev.map((f) => (f.id === editingFile.id ? res.data : f)));
      showToast('Сведения о материале обновлены');
      setEditingFile(null);
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка сохранения изменений'));
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete action
  const handleDeleteConfirm = async () => {
    if (!deletingFile) return;
    try {
      setDeleting(true);
      await api.delete(`/knowledge/${deletingFile.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== deletingFile.id));
      showToast(`Материал «${deletingFile.title}» удален.`);
      setDeletingFile(null);
      if (activeMediaModal?.id === deletingFile.id) {
        setActiveMediaModal(null);
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка при удалении файла'));
    } finally {
      setDeleting(false);
    }
  };

  // Change video playback rate
  const handleChangeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.playbackRate = rate;
    }
  };

  // Category visual metadata
  const categoryConfig = {
    video: {
      label: 'Видеоурок',
      icon: <Video className="w-4 h-4 text-indigo-400" />,
      badgeColor: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60',
      gradient: 'from-indigo-900/30 to-slate-900',
    },
    presentation: {
      label: 'Презентация',
      icon: <FileCode className="w-4 h-4 text-amber-400" />,
      badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
      gradient: 'from-amber-900/30 to-slate-900',
    },
    document: {
      label: 'Регламент / Документ',
      icon: <FileText className="w-4 h-4 text-emerald-400" />,
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
      gradient: 'from-emerald-900/30 to-slate-900',
    },
    image: {
      label: 'Схема / Фото',
      icon: <ImageIcon className="w-4 h-4 text-rose-400" />,
      badgeColor: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
      gradient: 'from-rose-900/30 to-slate-900',
    },
    other: {
      label: 'Файл',
      icon: <File className="w-4 h-4 text-slate-400" />,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      gradient: 'from-slate-800/40 to-slate-900',
    },
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/50 text-slate-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* ==================================================== */}
        {/* TOP HEADER & STATS                                   */}
        {/* ==================================================== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
              <FolderArchive className="w-4 h-4" />
              <span>База знаний и медиатека AMG</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Корпоративный архив знаний
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Единый каталог обучающих видеоуроков, презентаций стандартов, регламентов СТО и документов компании. Все материалы проверены методистами и готовы к изучению.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary py-2.5 px-5 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg hover:shadow-sky-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Загрузить материал</span>
            </button>
          )}
        </div>

        {/* ==================================================== */}
        {/* STATS OVERVIEW CARDS                                 */}
        {/* ==================================================== */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-medium truncate">Всего файлов</div>
                <div className="text-lg font-black text-white">{stats.total_files}</div>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-medium truncate">Видеоуроков</div>
                <div className="text-lg font-black text-indigo-300">{stats.videos_count}</div>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-medium truncate">Презентаций</div>
                <div className="text-lg font-black text-amber-300">{stats.presentations_count}</div>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-medium truncate">Регламентов</div>
                <div className="text-lg font-black text-emerald-300">{stats.documents_count}</div>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center gap-3.5 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-medium truncate">Объем на сервере</div>
                <div className="text-lg font-black text-purple-300">
                  {formatBytes(stats.total_size_bytes)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* FILTER & SEARCH CONTROLS                             */}
        {/* ==================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск видео, регламентов, презентаций по названию или описанию..."
                className="input-field pl-10 pr-10 text-xs sm:text-sm w-full py-2.5 bg-slate-900/90 border-slate-800 focus:border-sky-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    fetchKnowledgeData();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Department selector, sort & view toggle */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="input-field text-xs py-2 px-3 bg-slate-900 border-slate-800 w-auto"
              >
                <option value="all">Все отделы</option>
                <option value="СТО">СТО (Слесарный цех)</option>
                <option value="IT">IT и Безопасность</option>
                <option value="Продажи">Отдел продаж</option>
                <option value="Бухгалтерия">Бухгалтерия</option>
                <option value="Логистика">Логистика</option>
                <option value="Общий">Общие регламенты</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input-field text-xs py-2 px-3 bg-slate-900 border-slate-800 w-auto"
              >
                <option value="newest">Сначала новые</option>
                <option value="name">По названию (А-Я)</option>
                <option value="size">По размеру файла</option>
              </select>

              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-slate-800 text-sky-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Вид сеткой"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-slate-800 text-sky-400'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title="Вид списком"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {[
              { id: 'all', label: 'Все материалы', icon: <Layers className="w-3.5 h-3.5" /> },
              { id: 'video', label: 'Видеоуроки', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
              { id: 'presentation', label: 'Презентации', icon: <FileCode className="w-3.5 h-3.5 text-amber-400" /> },
              { id: 'document', label: 'Регламенты и документы', icon: <FileText className="w-3.5 h-3.5 text-emerald-400" /> },
              { id: 'image', label: 'Схемы и фото', icon: <ImageIcon className="w-3.5 h-3.5 text-rose-400" /> },
            ].map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-sky-500/15 border border-sky-500/40 text-sky-300 shadow-sm'
                      : 'bg-slate-900/60 border border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================== */}
        {/* CONTENT DISPLAY (GRID / LIST / EMPTY / LOADING)      */}
        {/* ==================================================== */}
        {loading ? (
          <div className="py-24 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Загрузка материалов Базы знаний...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-bold text-rose-200">{error}</div>
            <button onClick={fetchKnowledgeData} className="btn-secondary text-xs py-1.5 px-4">
              Повторить попытку
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="py-20 text-center space-y-4 glass-panel rounded-2xl border border-slate-800 p-8">
            <FolderArchive className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">Материалы не найдены</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              По выбранным критериям поиска ничего не найдено. Попробуйте сбросить фильтры или загрузить новый материал.
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Загрузить первый файл
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {files.map((file) => {
              const catInfo = categoryConfig[file.file_type] || categoryConfig.other;
              const isVideo = file.file_type === 'video';
              const isPresentation = file.file_type === 'presentation';

              return (
                <div
                  key={file.id}
                  onClick={() => handleOpenMedia(file)}
                  className="glass-panel group rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/60 cursor-pointer"
                >
                  {/* Card Header / Preview Area */}
                  <div
                    className={`h-40 bg-gradient-to-br ${catInfo.gradient} p-4 flex flex-col justify-between relative border-b border-slate-800/80 overflow-hidden`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 z-10">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${catInfo.badgeColor}`}
                      >
                        {catInfo.icon}
                        <span>{catInfo.label}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 border border-slate-700 text-slate-300">
                        {file.department}
                      </span>
                    </div>

                    {/* Centered Action Hover Icon */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isVideo ? (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg backdrop-blur-sm">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      ) : isPresentation ? (
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-lg backdrop-blur-sm">
                          <FileCode className="w-6 h-6" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg backdrop-blur-sm">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Bottom File Metadata in preview */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium z-10">
                      <span className="bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur">
                        {formatBytes(file.file_size_bytes)}
                      </span>
                      <span className="bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur truncate max-w-[150px]">
                        {file.file_name}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-300 transition-colors line-clamp-2 leading-snug">
                        {file.title}
                      </h3>
                      {file.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {file.description}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: Metadata & Actions */}
                    <div className="pt-3 border-t border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{formatDate(file.created_at)}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1" title="Просмотры">
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            {file.views_count}
                          </span>
                          <span className="flex items-center gap-1" title="Скачивания">
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            {file.downloads_count}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMedia(file);
                          }}
                          className="btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5"
                        >
                          {isVideo ? (
                            <>
                              <Play className="w-3 h-3 fill-current" />
                              <span>Смотреть</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Открыть</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={(e) => handleDownload(file, e)}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                          title="Скачать файл на компьютер"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => handleCopyLink(file, e)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                              title="Скопировать ссылку"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEdit(file, e)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                              title="Редактировать"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingFile(file);
                              }}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Тип</th>
                    <th className="py-3 px-4">Название материала</th>
                    <th className="py-3 px-4">Отдел</th>
                    <th className="py-3 px-4">Размер</th>
                    <th className="py-3 px-4">Дата</th>
                    <th className="py-3 px-4 text-center">Просмотры / Загрузки</th>
                    <th className="py-3 px-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {files.map((file) => {
                    const catInfo = categoryConfig[file.file_type] || categoryConfig.other;
                    return (
                      <tr
                        key={file.id}
                        onClick={() => handleOpenMedia(file)}
                        className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${catInfo.badgeColor}`}
                          >
                            {catInfo.icon}
                            <span>{catInfo.label}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-100 line-clamp-1">{file.title}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-sm">
                            {file.file_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300">
                            {file.department}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono">
                          {formatBytes(file.file_size_bytes)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{formatDate(file.created_at)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-slate-300 font-semibold">{file.views_count}</span>
                          <span className="text-slate-500 mx-1">/</span>
                          <span className="text-slate-400">{file.downloads_count}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMedia(file);
                              }}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              {file.file_type === 'video' ? 'Смотреть' : 'Открыть'}
                            </button>
                            <button
                              onClick={(e) => handleDownload(file, e)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="Скачать"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={(e) => handleCopyLink(file, e)}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                  title="Копировать ссылку"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleOpenEdit(file, e)}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                  title="Редактировать"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingFile(file);
                                  }}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* 1. INTERACTIVE MEDIA VIEWER MODAL                    */}
      {/* ==================================================== */}
      {activeMediaModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="glass-panel max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-800 text-sky-400 shrink-0">
                  {categoryConfig[activeMediaModal.file_type]?.icon || <File className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    {activeMediaModal.title}
                  </h2>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                      {activeMediaModal.department}
                    </span>
                    <span>{formatBytes(activeMediaModal.file_size_bytes)}</span>
                    <span>• {activeMediaModal.file_name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(activeMediaModal)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Скачать</span>
                </button>
                <button
                  onClick={() => setActiveMediaModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-black flex flex-col items-center justify-center p-2 sm:p-4">
              {activeMediaModal.file_type === 'video' ? (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl max-h-[68vh] flex items-center justify-center">
                    <video
                      key={activeMediaModal.file_url}
                      ref={videoPlayerRef}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-[65vh] object-contain rounded-xl"
                      src={activeMediaModal.file_url}
                    >
                      Ваш браузер не поддерживает встроенное воспроизведение видео.
                    </video>
                  </div>

                  {/* Speed Controls Bar */}
                  <div className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                    <span className="text-slate-400 font-medium">Скорость воспроизведения:</span>
                    <div className="flex items-center gap-1.5">
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleChangeSpeed(rate)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            playbackRate === rate
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeMediaModal.file_type === 'presentation' ||
                activeMediaModal.file_name.endsWith('.pdf') ? (
                <div className="w-full h-[70vh] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <iframe
                    src={activeMediaModal.file_url}
                    className="w-full h-full border-none"
                    title="Просмотр документа"
                  />
                </div>
              ) : activeMediaModal.file_type === 'image' ? (
                <div className="max-h-[70vh] flex items-center justify-center p-4">
                  <img
                    src={activeMediaModal.file_url}
                    alt={activeMediaModal.title}
                    className="max-h-[65vh] rounded-xl object-contain shadow-2xl border border-slate-800"
                  />
                </div>
              ) : (
                <div className="p-12 text-center space-y-4">
                  <FileText className="w-16 h-16 text-slate-600 mx-auto" />
                  <h3 className="text-lg font-bold text-white">{activeMediaModal.title}</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Прямой просмотр этого формата в браузере не поддерживается. Вы можете скачать файл на устройство.
                  </p>
                  <button
                    onClick={() => handleDownload(activeMediaModal)}
                    className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2 shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    Скачать файл ({formatBytes(activeMediaModal.file_size_bytes)})
                  </button>
                </div>
              )}

              {/* File description note if present */}
              {activeMediaModal.description && (
                <div className="w-full mt-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-400 block mb-1">Описание:</span>
                  {activeMediaModal.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. UPLOAD MODAL (ADMIN / METHODIST)                  */}
      {/* ==================================================== */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel max-w-xl w-full rounded-2xl border border-slate-700 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Загрузка материала в Базу знаний</h3>
              </div>
              <button
                onClick={() => {
                  if (!uploading) setShowUploadModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag & drop file area */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleSelectUploadFile}
                className="hidden"
                accept="video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,image/*"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/70 space-y-2 group"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400 mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                {uploadFile ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Выбран: {uploadFile.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Размер: {formatBytes(uploadFile.size)} • Нажмите для смены файла
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-slate-200">
                      Нажмите для выбора файла или перетащите сюда
                    </span>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Видео (MP4, MKV), презентации (PDF), регламенты (DOCX, XLS), схемы
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Название материала *</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Например, Регламент замены масла ДВС"
                    className="input-field text-xs py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Категория</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="input-field text-xs py-2 bg-slate-900"
                  >
                    <option value="video">Видеоурок</option>
                    <option value="presentation">Презентация</option>
                    <option value="document">Документ</option>
                    <option value="image">Схема / Фото</option>
                  </select>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Отдел компании</label>
                <select
                  value={uploadDept}
                  onChange={(e) => setUploadDept(e.target.value)}
                  className="input-field text-xs py-2 bg-slate-900"
                >
                  <option value="СТО">СТО (Слесарный цех)</option>
                  <option value="IT">IT и Информационная безопасность</option>
                  <option value="Продажи">Отдел продаж</option>
                  <option value="Бухгалтерия">Бухгалтерия</option>
                  <option value="Логистика">Логистика</option>
                  <option value="Общий">Общие регламенты</option>
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Описание / Аннотация</label>
                <textarea
                  rows={3}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Кратко опишите, какие навыки и стандарты рассматриваются..."
                  className="input-field text-xs py-2"
                />
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-sky-400">
                    <span>Загрузка на сервер...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Сохранить в базу</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. EDIT MODAL (ADMIN / METHODIST)                    */}
      {/* ==================================================== */}
      {editingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Редактирование материала</h3>
              <button onClick={() => setEditingFile(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Название</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field text-xs py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Отдел</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="input-field text-xs py-2 bg-slate-900"
                  >
                    <option value="СТО">СТО (Слесарный цех)</option>
                    <option value="IT">IT и Безопасность</option>
                    <option value="Продажи">Отдел продаж</option>
                    <option value="Бухгалтерия">Бухгалтерия</option>
                    <option value="Логистика">Логистика</option>
                    <option value="Общий">Общие регламенты</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Категория</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="input-field text-xs py-2 bg-slate-900"
                  >
                    <option value="video">Видеоурок</option>
                    <option value="presentation">Презентация</option>
                    <option value="document">Документ</option>
                    <option value="image">Схема / Фото</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Описание</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input-field text-xs py-2"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="btn-secondary text-xs py-1.5 px-3.5"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Сохранить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. DELETE CONFIRMATION MODAL                         */}
      {/* ==================================================== */}
      {deletingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-rose-900/60 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">Удалить материал?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Вы действительно хотите удалить «{deletingFile.title}»? Файл будет безвозвратно удален с сервера.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingFile(null)}
                className="btn-secondary text-xs py-2 px-4"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="btn-danger text-xs py-2 px-5 flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Да, удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
