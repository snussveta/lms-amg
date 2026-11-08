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

      await api.post('/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#003B73', '#E30613', '#6C757D', '#ffffff'],
      });
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

  // Category visual metadata aligned with corporate palette
  const categoryConfig = {
    video: {
      label: 'Видеоурок',
      icon: <Video className="w-4 h-4 text-[#003B73]" />,
      badgeColor: 'bg-blue-50 text-[#003B73] border-blue-200',
      gradient: 'from-[#003B73]/10 to-white',
    },
    presentation: {
      label: 'Презентация',
      icon: <FileCode className="w-4 h-4 text-amber-700" />,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      gradient: 'from-amber-50/60 to-white',
    },
    document: {
      label: 'Регламент / Документ',
      icon: <FileText className="w-4 h-4 text-emerald-700" />,
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      gradient: 'from-emerald-50/60 to-white',
    },
    image: {
      label: 'Схема / Фото',
      icon: <ImageIcon className="w-4 h-4 text-[#E30613]" />,
      badgeColor: 'bg-red-50 text-[#E30613] border-red-200',
      gradient: 'from-red-50/60 to-white',
    },
    other: {
      label: 'Файл',
      icon: <File className="w-4 h-4 text-[#6C757D]" />,
      badgeColor: 'bg-[#F4F5F7] text-[#6C757D] border-[#E0E0E0]',
      gradient: 'from-slate-100 to-white',
    },
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F4F5F7] text-[#212529] py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 bg-[#003B73] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border border-[#003B73]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* ==================================================== */}
        {/* TOP HEADER & STATS                                   */}
        {/* ==================================================== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-[#E0E0E0]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003B73]">
              <FolderArchive className="w-4 h-4" />
              <span>База знаний и медиатека AMG</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#212529]">
              Корпоративный архив знаний
            </h1>
            <p className="text-xs sm:text-sm text-[#6C757D] max-w-2xl leading-relaxed">
              Единый каталог обучающих видеоуроков, презентаций стандартов, регламентов СТО и документов компании. Все материалы проверены методистами и готовы к изучению.
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-primary py-2.5 px-5 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shrink-0 min-h-[44px]"
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
            <div className="bg-white p-4 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#003B73] shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#6C757D] font-semibold truncate">Всего файлов</div>
                <div className="text-xl font-black text-[#212529]">{stats.total_files}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#003B73] shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#6C757D] font-semibold truncate">Видеоуроков</div>
                <div className="text-xl font-black text-[#003B73]">{stats.videos_count}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#6C757D] font-semibold truncate">Презентаций</div>
                <div className="text-xl font-black text-amber-800">{stats.presentations_count}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#6C757D] font-semibold truncate">Регламентов</div>
                <div className="text-xl font-black text-emerald-700">{stats.documents_count}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-0.5 transition-all flex items-center gap-3.5 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E30613] shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#6C757D] font-semibold truncate">Объем на диске</div>
                <div className="text-xl font-black text-[#212529]">
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
              <Search className="w-4 h-4 text-[#6C757D] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск видео, регламентов, презентаций по названию..."
                className="input-field pl-10 pr-10 text-xs sm:text-sm w-full py-2.5 bg-white border-[#E0E0E0] text-[#212529] focus:border-[#003B73]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    fetchKnowledgeData();
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6C757D] hover:text-[#212529] p-1"
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
                className="input-field text-xs sm:text-sm py-2 px-3 bg-white border-[#E0E0E0] text-[#212529] w-auto min-h-[44px]"
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
                className="input-field text-xs sm:text-sm py-2 px-3 bg-white border-[#E0E0E0] text-[#212529] w-auto min-h-[44px]"
              >
                <option value="newest">Сначала новые</option>
                <option value="name">По названию (А-Я)</option>
                <option value="size">По размеру файла</option>
              </select>

              <div className="flex items-center rounded-xl bg-white border border-[#E0E0E0] p-1 h-[44px]">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[#003B73] text-white shadow-xs'
                      : 'text-[#6C757D] hover:text-[#212529]'
                  }`}
                  title="Вид сеткой"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[#003B73] text-white shadow-xs'
                      : 'text-[#6C757D] hover:text-[#212529]'
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
              { id: 'video', label: 'Видеоуроки', icon: <Video className="w-3.5 h-3.5" /> },
              { id: 'presentation', label: 'Презентации', icon: <FileCode className="w-3.5 h-3.5" /> },
              { id: 'document', label: 'Регламенты и документы', icon: <FileText className="w-3.5 h-3.5" /> },
              { id: 'image', label: 'Схемы и фото', icon: <ImageIcon className="w-3.5 h-3.5" /> },
            ].map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[40px] ${
                    active
                      ? 'bg-[#003B73] text-white shadow-sm border border-[#003B73]'
                      : 'bg-white border border-[#E0E0E0] text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7]'
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
            <Loader2 className="w-8 h-8 text-[#003B73] animate-spin mx-auto" />
            <p className="text-xs text-[#6C757D] font-medium">Загрузка материалов Базы знаний...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-[#E30613] mx-auto" />
            <div className="text-sm font-bold text-[#E30613]">{error}</div>
            <button onClick={fetchKnowledgeData} className="btn-secondary text-xs py-2 px-4">
              Повторить попытку
            </button>
          </div>
        ) : files.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-white rounded-2xl border border-[#E0E0E0] p-8 shadow-sm">
            <FolderArchive className="w-12 h-12 text-[#6C757D] mx-auto opacity-50" />
            <h3 className="text-base font-bold text-[#212529]">Материалы не найдены</h3>
            <p className="text-xs text-[#6C757D] max-w-sm mx-auto">
              По выбранным критериям поиска ничего не найдено. Попробуйте сбросить фильтры или загрузить новый материал.
            </p>
            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5 font-bold"
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
                  className="bg-white group rounded-2xl border border-[#E0E0E0] shadow-sm hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
                >
                  {/* Card Header / Preview Area */}
                  <div
                    className={`h-40 bg-gradient-to-br ${catInfo.gradient} p-4 flex flex-col justify-between relative border-b border-[#E0E0E0] overflow-hidden`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 z-10">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 shadow-2xs ${catInfo.badgeColor}`}
                      >
                        {catInfo.icon}
                        <span>{catInfo.label}</span>
                      </span>

                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white/90 border border-[#E0E0E0] text-[#212529] shadow-2xs">
                        {file.department}
                      </span>
                    </div>

                    {/* Centered Action Hover Icon */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {isVideo ? (
                        <div className="w-14 h-14 rounded-2xl bg-white/95 border border-[#E0E0E0] text-[#003B73] flex items-center justify-center group-hover:scale-110 group-hover:bg-[#003B73] group-hover:text-white transition-all shadow-md">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      ) : isPresentation ? (
                        <div className="w-14 h-14 rounded-2xl bg-white/95 border border-[#E0E0E0] text-amber-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#003B73] group-hover:text-white transition-all shadow-md">
                          <FileCode className="w-6 h-6" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-white/95 border border-[#E0E0E0] text-emerald-700 flex items-center justify-center group-hover:scale-110 group-hover:bg-[#003B73] group-hover:text-white transition-all shadow-md">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Bottom File Metadata in preview */}
                    <div className="flex items-center justify-between text-[11px] text-[#6C757D] font-semibold z-10">
                      <span className="bg-white/90 px-2 py-0.5 rounded-md border border-[#E0E0E0] shadow-2xs text-[#212529]">
                        {formatBytes(file.file_size_bytes)}
                      </span>
                      <span className="bg-white/90 px-2 py-0.5 rounded-md border border-[#E0E0E0] shadow-2xs truncate max-w-[150px] text-[#212529]">
                        {file.file_name}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="text-sm sm:text-base font-bold text-[#212529] group-hover:text-[#003B73] transition-colors line-clamp-2 leading-snug">
                        {file.title}
                      </h3>
                      {file.description && (
                        <p className="text-xs text-[#6C757D] line-clamp-2 leading-relaxed">
                          {file.description}
                        </p>
                      )}
                    </div>

                    {/* Card Footer: Metadata & Actions */}
                    <div className="pt-3 border-t border-[#E0E0E0] space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-[#6C757D]">
                        <span className="font-medium">{formatDate(file.created_at)}</span>
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1 font-semibold" title="Просмотры">
                            <Eye className="w-3.5 h-3.5 text-[#003B73]" />
                            {file.views_count}
                          </span>
                          <span className="flex items-center gap-1 font-semibold" title="Скачивания">
                            <Download className="w-3.5 h-3.5 text-[#003B73]" />
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
                          className="btn-primary text-xs py-2 px-3.5 flex-1 flex items-center justify-center gap-1.5 min-h-[38px] font-bold"
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
                          className="p-2 rounded-xl bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Скачать файл на компьютер"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => handleCopyLink(file, e)}
                              className="p-2 rounded-xl bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Скопировать ссылку"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleOpenEdit(file, e)}
                              className="p-2 rounded-xl bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                              title="Редактировать"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingFile(file);
                              }}
                              className="p-2 rounded-xl bg-white border border-[#E0E0E0] hover:bg-red-50 text-[#6C757D] hover:text-[#E30613] transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
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
          <div className="bg-white rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F4F5F7] text-[#6C757D] uppercase tracking-wider text-[10px] font-bold border-b border-[#E0E0E0]">
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
                <tbody className="divide-y divide-[#E0E0E0] text-[#212529]">
                  {files.map((file) => {
                    const catInfo = categoryConfig[file.file_type] || categoryConfig.other;
                    return (
                      <tr
                        key={file.id}
                        onClick={() => handleOpenMedia(file)}
                        className="hover:bg-[#F4F5F7]/70 transition-colors cursor-pointer"
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
                          <div className="font-bold text-[#212529] line-clamp-1">{file.title}</div>
                          <div className="text-[11px] text-[#6C757D] truncate max-w-sm">
                            {file.file_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-[#F4F5F7] border border-[#E0E0E0] text-[10px] font-bold text-[#212529]">
                            {file.department}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#6C757D] font-mono">
                          {formatBytes(file.file_size_bytes)}
                        </td>
                        <td className="py-3.5 px-4 text-[#6C757D]">{formatDate(file.created_at)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-[#212529] font-bold">{file.views_count}</span>
                          <span className="text-[#6C757D] mx-1">/</span>
                          <span className="text-[#6C757D]">{file.downloads_count}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMedia(file);
                              }}
                              className="btn-primary text-xs py-1 px-3 font-semibold min-h-[34px]"
                            >
                              {file.file_type === 'video' ? 'Смотреть' : 'Открыть'}
                            </button>
                            <button
                              onClick={(e) => handleDownload(file, e)}
                              className="p-1.5 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] min-h-[34px] min-w-[34px] flex items-center justify-center"
                              title="Скачать"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={(e) => handleCopyLink(file, e)}
                                  className="p-1.5 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] min-h-[34px] min-w-[34px] flex items-center justify-center"
                                  title="Копировать ссылку"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleOpenEdit(file, e)}
                                  className="p-1.5 rounded-lg bg-white border border-[#E0E0E0] hover:bg-[#F4F5F7] text-[#6C757D] hover:text-[#212529] min-h-[34px] min-w-[34px] flex items-center justify-center"
                                  title="Редактировать"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingFile(file);
                                  }}
                                  className="p-1.5 rounded-lg bg-white border border-[#E0E0E0] hover:bg-red-50 text-[#6C757D] hover:text-[#E30613] min-h-[34px] min-w-[34px] flex items-center justify-center"
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
        <div className="fixed inset-0 z-50 bg-[#003B73]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl border border-[#E0E0E0] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 bg-white border-b border-[#E0E0E0] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-[#003B73] shrink-0">
                  {categoryConfig[activeMediaModal.file_type]?.icon || <File className="w-5 h-5 text-[#003B73]" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#212529] truncate">
                    {activeMediaModal.title}
                  </h2>
                  <div className="text-xs text-[#6C757D] flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-[#F4F5F7] border border-[#E0E0E0] text-[10px] font-bold text-[#212529]">
                      {activeMediaModal.department}
                    </span>
                    <span>{formatBytes(activeMediaModal.file_size_bytes)}</span>
                    <span className="truncate max-w-xs">• {activeMediaModal.file_name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(activeMediaModal)}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Скачать</span>
                </button>
                <button
                  onClick={() => setActiveMediaModal(null)}
                  className="p-2 rounded-xl text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto bg-[#F4F5F7] flex flex-col items-center justify-center p-3 sm:p-5">
              {activeMediaModal.file_type === 'video' ? (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="w-full bg-[#212529] rounded-2xl overflow-hidden shadow-2xl max-h-[68vh] flex items-center justify-center">
                    <video
                      key={activeMediaModal.file_url}
                      ref={videoPlayerRef}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-[65vh] object-contain rounded-2xl"
                      src={activeMediaModal.file_url}
                    >
                      Ваш браузер не поддерживает встроенное воспроизведение видео.
                    </video>
                  </div>

                  {/* Speed Controls Bar */}
                  <div className="w-full p-3 rounded-xl bg-white border border-[#E0E0E0] shadow-sm flex items-center justify-between text-xs text-[#212529]">
                    <span className="text-[#6C757D] font-bold">Скорость воспроизведения:</span>
                    <div className="flex items-center gap-1.5">
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleChangeSpeed(rate)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[34px] ${
                            playbackRate === rate
                              ? 'bg-[#003B73] text-white shadow-xs'
                              : 'bg-[#F4F5F7] text-[#212529] hover:bg-[#E0E0E0]'
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
                <div className="w-full h-[70vh] rounded-2xl overflow-hidden border border-[#E0E0E0] bg-white shadow-md">
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
                    className="max-h-[65vh] rounded-2xl object-contain shadow-2xl border border-[#E0E0E0]"
                  />
                </div>
              ) : (
                <div className="p-12 text-center space-y-4 bg-white rounded-2xl border border-[#E0E0E0] max-w-md shadow-sm">
                  <FileText className="w-16 h-16 text-[#003B73] mx-auto" />
                  <h3 className="text-lg font-bold text-[#212529]">{activeMediaModal.title}</h3>
                  <p className="text-xs text-[#6C757D] max-w-sm mx-auto">
                    Прямой просмотр этого формата в браузере не поддерживается. Вы можете скачать файл на устройство.
                  </p>
                  <button
                    onClick={() => handleDownload(activeMediaModal)}
                    className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2 shadow-sm font-bold min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    Скачать файл ({formatBytes(activeMediaModal.file_size_bytes)})
                  </button>
                </div>
              )}

              {/* File description note if present */}
              {activeMediaModal.description && (
                <div className="w-full mt-3 p-4 rounded-xl bg-white border border-[#E0E0E0] text-xs text-[#212529] leading-relaxed shadow-sm">
                  <span className="font-bold text-[#003B73] block mb-1">Описание:</span>
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
        <div className="fixed inset-0 z-50 bg-[#003B73]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white max-w-xl w-full rounded-2xl border border-[#E0E0E0] p-5 sm:p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-[#003B73]" />
                <h3 className="text-base font-bold text-[#212529]">Загрузка материала в Базу знаний</h3>
              </div>
              <button
                onClick={() => {
                  if (!uploading) setShowUploadModal(false);
                }}
                className="text-[#6C757D] hover:text-[#212529] p-1 rounded-lg"
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
                className="border-2 border-dashed border-[#E0E0E0] hover:border-[#003B73] rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#F4F5F7] hover:bg-[#003B73]/5 space-y-2 group min-h-[120px] flex flex-col justify-center"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#003B73] mx-auto group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                {uploadFile ? (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Выбран: {uploadFile.name}
                    </div>
                    <div className="text-[11px] text-[#6C757D]">
                      Размер: {formatBytes(uploadFile.size)} • Нажмите для смены файла
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-[#212529]">
                      Нажмите для выбора файла или перетащите сюда
                    </span>
                    <div className="text-[11px] text-[#6C757D] mt-1">
                      Видео (MP4, MKV), презентации (PDF), регламенты (DOCX, XLS), схемы
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[#212529]">Название материала *</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Например, Регламент замены масла ДВС"
                    className="input-field text-xs sm:text-sm py-2 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#212529]">Категория</label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="input-field text-xs sm:text-sm py-2 bg-white"
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
                <label className="text-xs font-bold text-[#212529]">Отдел компании</label>
                <select
                  value={uploadDept}
                  onChange={(e) => setUploadDept(e.target.value)}
                  className="input-field text-xs sm:text-sm py-2 bg-white"
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
                <label className="text-xs font-bold text-[#212529]">Описание / Аннотация</label>
                <textarea
                  rows={3}
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Кратко опишите, какие навыки и стандарты рассматриваются..."
                  className="input-field text-xs sm:text-sm py-2 bg-white"
                />
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="space-y-2 p-3 rounded-xl bg-[#F4F5F7] border border-[#E0E0E0]">
                  <div className="flex items-center justify-between text-xs font-bold text-[#003B73]">
                    <span>Загрузка на сервер...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#E30613] transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#E30613] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E0E0E0]">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary text-xs py-2 px-4 min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-2 min-h-[44px] font-bold"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 bg-[#003B73]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white max-w-lg w-full rounded-2xl border border-[#E0E0E0] p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-3">
              <h3 className="text-base font-bold text-[#212529]">Редактирование материала</h3>
              <button onClick={() => setEditingFile(null)} className="text-[#6C757D] hover:text-[#212529] p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#212529]">Название</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="input-field text-xs sm:text-sm py-2 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#212529]">Отдел</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="input-field text-xs sm:text-sm py-2 bg-white"
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
                  <label className="text-xs font-bold text-[#212529]">Категория</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="input-field text-xs sm:text-sm py-2 bg-white"
                  >
                    <option value="video">Видеоурок</option>
                    <option value="presentation">Презентация</option>
                    <option value="document">Документ</option>
                    <option value="image">Схема / Фото</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#212529]">Описание</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="input-field text-xs sm:text-sm py-2 bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E0E0E0]">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="btn-secondary text-xs py-2 px-4 min-h-[44px]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 min-h-[44px] font-bold"
                >
                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
        <div className="fixed inset-0 z-50 bg-[#003B73]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-2xl border border-red-200 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-[#E30613] mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[#212529]">Удалить материал?</h3>
              <p className="text-xs text-[#6C757D] leading-relaxed">
                Вы действительно хотите удалить «{deletingFile.title}»? Файл будет безвозвратно удален с сервера.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeletingFile(null)}
                className="btn-secondary text-xs py-2 px-4 min-h-[44px]"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="btn-danger text-xs py-2 px-5 flex items-center gap-1.5 min-h-[44px] font-bold"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Да, удалить</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
