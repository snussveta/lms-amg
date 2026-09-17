import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCode,
  FileText,
  GraduationCap,
  HelpCircle,
  Info,
  Lock,
  Menu,
  Play,
  PlayCircle,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Video,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api, { getErrorMessage } from '../../api/client';

export const CoursePlayerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [courseData, setCourseData] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Video playback & syncing state
  const videoRef = useRef(null);

  // Embedded Quiz state
  const [quizAttempt, setQuizAttempt] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  // Load course state on initial mount or when ID changes
  useEffect(() => {
    fetchCourseLearnState();
  }, [id]);

  const fetchCourseLearnState = async (preserveLessonId = null) => {
    try {
      setLoading(true);
      setError('');

      let res;
      try {
        res = await api.get(`/v1/courses/${id}/learn`);
      } catch {
        res = await api.get(`/courses/${id}/learn`);
      }

      const data = res.data;
      setCourseData(data);

      // Find active lesson: preserved, or current_lesson_id, or first unlocked
      let targetLesson = null;
      const allLessons = [];
      (data?.modules || []).forEach((m) => {
        (m?.lessons || []).forEach((l) => allLessons.push(l));
      });

      if (preserveLessonId) {
        targetLesson = allLessons.find((l) => l.id === preserveLessonId);
      }
      if (!targetLesson && data?.current_lesson_id) {
        targetLesson = allLessons.find((l) => l.id === data.current_lesson_id);
      }
      if (!targetLesson && allLessons.length > 0) {
        targetLesson = allLessons.find((l) => !l.is_locked) || allLessons[0];
      }

      setActiveLesson(targetLesson);
    } catch (err) {
      console.error('Ошибка загрузки плеера курса:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить материалы курса.'));
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // Video 10-Second Heartbeat & Resume Logic
  // ----------------------------------------------------
  useEffect(() => {
    if (!activeLesson || activeLesson.lesson_type !== 'video' || !videoRef.current) return;

    const videoElement = videoRef.current;

    // Restore last timestamp offset
    if (activeLesson.last_timestamp_seconds && activeLesson.last_timestamp_seconds > 0) {
      try {
        videoElement.currentTime = activeLesson.last_timestamp_seconds;
      } catch (e) {
        console.warn('Не удалось восстановить позицию видео:', e);
      }
    }

    // Interval to sync playback position to backend every 10 seconds
    const interval = setInterval(() => {
      if (!videoElement.paused && !videoElement.ended) {
        syncVideoProgress(videoElement.currentTime, false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeLesson?.id]);

  const syncVideoProgress = async (timestamp, isCompleted = false) => {
    if (!activeLesson) return;
    try {
      await api.post(`/courses/${id}/lessons/${activeLesson.id}/progress`, {
        last_timestamp_seconds: timestamp,
        status: isCompleted ? 'completed' : 'in_progress',
      });
      if (isCompleted) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        fetchCourseLearnState(activeLesson.id);
      }
    } catch (err) {
      console.error('Ошибка синхронизации таймкода видео:', err);
    }
  };

  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    // If 90%+ watched and not yet completed
    if (video.currentTime / video.duration >= 0.9 && activeLesson?.status !== 'completed') {
      syncVideoProgress(video.currentTime, true);
    }
  };

  const handleVideoEnded = () => {
    const video = videoRef.current;
    if (video) {
      syncVideoProgress(video.currentTime, true);
    }
  };

  // ----------------------------------------------------
  // Mark Step as Completed & Advance to Next
  // ----------------------------------------------------
  const handleMarkStepCompleted = async () => {
    if (!activeLesson) return;
    try {
      // 1. Send complete signal to dedicated complete endpoint
      try {
        await api.post(`/v1/courses/${id}/lessons/${activeLesson.id}/complete`);
      } catch {
        try {
          await api.post(`/courses/${id}/lessons/${activeLesson.id}/complete`);
        } catch {
          await api.post(`/courses/${id}/lessons/${activeLesson.id}/progress`, {
            status: 'completed',
            last_timestamp_seconds: 0,
          });
        }
      }

      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });

      // 2. Refresh state and advance to next lesson
      let res;
      try {
        res = await api.get(`/v1/courses/${id}/learn`);
      } catch {
        res = await api.get(`/courses/${id}/learn`);
      }
      const updatedData = res.data;
      setCourseData(updatedData);

      const allLessons = [];
      (updatedData?.modules || []).forEach((m) => {
        (m?.lessons || []).forEach((l) => allLessons.push(l));
      });

      const currentIdx = allLessons.findIndex((l) => l.id === activeLesson.id);
      if (currentIdx !== -1 && currentIdx + 1 < allLessons.length) {
        const nextLesson = allLessons[currentIdx + 1];
        setActiveLesson(nextLesson);
      } else if (currentIdx === allLessons.length - 1) {
        // Entire course finished!
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка при фиксации шага.'));
    }
  };

  // ----------------------------------------------------
  // Embedded Quiz Logic
  // ----------------------------------------------------
  useEffect(() => {
    if (activeLesson?.lesson_type === 'quiz' && activeLesson.quiz_id) {
      initQuizAttempt(activeLesson.quiz_id);
    } else {
      setQuizAttempt(null);
      setQuizResult(null);
    }
  }, [activeLesson?.id]);

  const initQuizAttempt = async (testId) => {
    try {
      setQuizLoading(true);
      setQuizResult(null);
      setQuizAnswers({});

      const res = await api.post(`/attempts/start/${testId}`);
      setQuizAttempt(res.data);
    } catch (err) {
      console.error('Ошибка инициализации теста:', err);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectQuizOption = (questionId, optionId, isMultiple) => {
    setQuizAnswers((prev) => {
      const current = prev[questionId]?.selected_option_ids || [];
      let nextOptions = [];
      if (isMultiple) {
        nextOptions = current.includes(optionId)
          ? current.filter((opt) => opt !== optionId)
          : [...current, optionId];
      } else {
        nextOptions = [optionId];
      }
      return {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          selected_option_ids: nextOptions,
        },
      };
    });
  };

  const handleSubmitQuiz = async () => {
    if (!quizAttempt) return;
    try {
      setQuizSubmitting(true);
      const answersPayload = Object.entries(quizAnswers).map(([qId, ans]) => ({
        question_id: parseInt(qId, 10),
        selected_option_ids: ans.selected_option_ids || [],
        text_answer: ans.text_answer || '',
      }));

      const res = await api.post(`/attempts/${quizAttempt.id}/submit`, {
        answers: answersPayload,
      });

      const result = res.data;
      setQuizResult(result);

      if (result.is_passed) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        // Mark lesson progress completed
        try {
          await api.post(`/v1/courses/${id}/lessons/${activeLesson.id}/complete`);
        } catch {
          await api.post(`/courses/${id}/lessons/${activeLesson.id}/progress`, {
            status: 'completed',
          });
        }
        fetchCourseLearnState(activeLesson.id);
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка при отправке ответов на тест.'));
    } finally {
      setQuizSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Lesson Selection with Step-by-Step Lock Enforcement
  // ----------------------------------------------------
  const handleSelectLesson = (lesson) => {
    if (lesson.is_locked) {
      alert('🔒 Этот шаг заблокирован. Пожалуйста, завершите предыдущие уроки курса, чтобы разблокировать доступ.');
      return;
    }
    setActiveLesson(lesson);
  };

  // Safe parsing helper for longread blocks
  const parseBlocks = (content) => {
    if (!content) return [];
    let parsed = content;
    if (typeof content === 'string') {
      try {
        parsed = JSON.parse(content);
      } catch {
        return [{ type: 'paragraph', text: content }];
      }
    }
    if (!Array.isArray(parsed)) {
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.blocks)) {
          parsed = parsed.blocks;
        } else {
          parsed = [parsed];
        }
      } else {
        parsed = [{ type: 'paragraph', text: String(parsed || '') }];
      }
    }
    return parsed.map((block) => {
      if (typeof block === 'string') {
        return { type: 'paragraph', text: block };
      }
      if (!block || typeof block !== 'object') {
        return { type: 'paragraph', text: String(block || '') };
      }
      return block;
    });
  };

  // Video streaming URL builder
  const getVideoUrl = (lesson) => {
    if (!lesson || !lesson.file_url) return '';
    let url = lesson.file_url.trim();
    if (!url) return '';

    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (url.startsWith('/api/v1/media/stream/')) {
      // standard v1 format
    } else if (url.startsWith('/api/media/stream/')) {
      url = url.replace('/api/media/stream/', '/api/v1/media/stream/');
    } else if (url.startsWith('/')) {
      // other local path
    } else {
      url = `/api/v1/media/stream/${url}`;
    }

    const token = localStorage.getItem('token');
    if (token && !url.includes('token=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}token=${encodeURIComponent(token)}`;
    }
    return url;
  };

  // ====================================================
  // 1. LOADING SKELETON STATE
  // ====================================================
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col bg-slate-950 text-slate-100 animate-fade-in">
        {/* Skeleton Top Bar */}
        <div className="sticky top-14 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
            <div className="space-y-1.5 min-w-0">
              <div className="w-44 sm:w-64 h-4 rounded bg-slate-800 animate-pulse" />
              <div className="w-24 h-3 rounded bg-slate-800/60 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-28 h-3 rounded bg-slate-800 animate-pulse hidden sm:block" />
            <div className="w-8 h-8 rounded-lg bg-slate-800 animate-pulse" />
          </div>
        </div>

        {/* Skeleton Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 border-r border-slate-800 bg-slate-900/60 p-4 space-y-4 hidden md:block shrink-0">
            <div className="w-32 h-3.5 rounded bg-slate-800 animate-pulse" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-slate-800/40 animate-pulse" />
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 sm:p-10 max-w-4xl mx-auto w-full space-y-6">
            <div className="w-28 h-5 rounded bg-slate-800 animate-pulse" />
            <div className="w-3/4 h-8 rounded bg-slate-800 animate-pulse" />
            <div className="space-y-3 pt-4">
              <div className="w-full h-4 rounded bg-slate-800/60 animate-pulse" />
              <div className="w-full h-4 rounded bg-slate-800/60 animate-pulse" />
              <div className="w-5/6 h-4 rounded bg-slate-800/60 animate-pulse" />
            </div>
            <div className="h-64 rounded-2xl bg-slate-800/30 animate-pulse mt-8 border border-slate-800/60" />
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // 2. ERROR STATE
  // ====================================================
  if (error || !courseData) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-slate-950 flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 text-center space-y-5 border border-slate-800 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/50 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-100">Ошибка загрузки курса</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {error || 'Курс не найден или у вас нет доступа к его прохождению.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fetchCourseLearnState()}
              className="btn-secondary text-xs w-full sm:w-auto py-2.5 px-4 flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Попробовать снова
            </button>
            <Link
              to="/courses"
              className="btn-primary text-xs w-full sm:w-auto py-2.5 px-5 flex items-center justify-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Каталог курсов
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate lessons flat list
  const allLessons = [];
  (courseData.modules || []).forEach((m) => {
    (m.lessons || []).forEach((l) => allLessons.push(l));
  });

  // ====================================================
  // 3. EMPTY STATE (No modules or no lessons yet)
  // ====================================================
  if (!courseData.modules || courseData.modules.length === 0 || allLessons.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-slate-950 flex flex-col text-slate-100">
        <div className="sticky top-14 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/courses"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Вернуться к курсам"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {courseData.title}
              </h1>
              <span className="text-[10px] text-slate-400 font-semibold">
                {courseData.department_tag}
              </span>
            </div>
          </div>
          <Link to="/courses" className="btn-secondary text-xs py-1.5 px-3">
            В каталог
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-8 text-center space-y-4 border border-slate-800 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center mx-auto text-amber-400">
              <BookOpen className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">В курсе пока нет уроков</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Методисты и авторы программы еще наполняют этот курс учебными материалами. Загляните сюда чуть позже или выберите другой курс.
            </p>
            <div className="pt-2">
              <Link to="/courses" className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Вернуться к каталогу курсов
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // 4. MAIN INTERACTIVE PLAYER INTERFACE
  // ====================================================
  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header: iSpring Style Bar */}
      <div className="sticky top-14 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={sidebarOpen ? 'Скрыть структуру курса' : 'Показать структуру курса'}
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
              {courseData.title}
            </h1>
            <div className="text-[11px] text-slate-400 truncate flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                {courseData.department_tag}
              </span>
              <span>{activeLesson?.title || 'Выберите шаг'}</span>
            </div>
          </div>
        </div>

        {/* Course Progress Indicator */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-xs font-bold text-slate-200">
              {courseData.progress_percent || 0}% пройдено
            </div>
            <div className="text-[10px] text-slate-400">
              {courseData.completed_lessons || 0} из {courseData.total_lessons || allLessons.length} уроков
            </div>
          </div>
          <div className="w-24 sm:w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${courseData.progress_percent || 0}%` }}
            />
          </div>

          <Link
            to="/courses"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Выйти в каталог"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Main Two-Column Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* ==================================================== */}
        {/* LEFT COLUMN: iSpring Navigation Sidebar (Collapsible)*/}
        {/* ==================================================== */}
        <div
          className={`${
            sidebarOpen ? 'w-80' : 'w-0'
          } shrink-0 transition-all duration-200 ease-in-out border-r border-slate-800 bg-slate-900/60 overflow-y-auto flex flex-col`}
        >
          {sidebarOpen && (
            <div className="p-4 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                Содержание курса
              </div>

              {/* Modules & Lessons List */}
              <div className="space-y-3">
                {(courseData.modules || []).map((mod) => (
                  <div key={mod.id} className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
                      {mod.title}
                    </div>

                    <div className="space-y-1">
                      {(mod.lessons || []).map((les) => {
                        const isCurrent = activeLesson?.id === les.id;
                        const isCompleted = les.status === 'completed';
                        const isLocked = les.is_locked;

                        const iconMap = {
                          article: <FileText className="w-3.5 h-3.5" />,
                          video: <Video className="w-3.5 h-3.5" />,
                          presentation: <FileCode className="w-3.5 h-3.5" />,
                          quiz: <HelpCircle className="w-3.5 h-3.5" />,
                        };

                        return (
                          <div
                            key={les.id}
                            onClick={() => handleSelectLesson(les)}
                            className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all ${
                              isCurrent
                                ? 'bg-sky-950/70 border border-sky-800/80 text-white font-medium shadow-sm'
                                : isLocked
                                ? 'opacity-40 text-slate-500 hover:bg-slate-900 cursor-not-allowed'
                                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {/* Status Icon */}
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              ) : isCurrent ? (
                                <PlayCircle className="w-4 h-4 text-sky-400 shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                              )}

                              <span className="truncate">{les.title}</span>
                            </div>

                            <div className="text-slate-500 shrink-0">
                              {iconMap[les.lesson_type] || <FileText className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ==================================================== */}
        {/* CENTRAL WORKSPACE: CONTENT LEARNING PLAYER           */}
        {/* ==================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col justify-between">
          {!activeLesson ? (
            <div className="text-center py-20 text-slate-500 text-sm space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
              <div>Выберите урок в меню слева для начала изучения.</div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {/* Active Lesson Header Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                    {activeLesson.lesson_type === 'article' && 'Лонгрид'}
                    {activeLesson.lesson_type === 'video' && 'Видеопрактикум'}
                    {activeLesson.lesson_type === 'presentation' && 'Презентация'}
                    {activeLesson.lesson_type === 'quiz' && 'Аттестация'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Шаг урока</span>
                </div>

                {activeLesson.status === 'completed' && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Изучено</span>
                  </div>
                )}
              </div>

              {/* Lesson Title */}
              <h2 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                {activeLesson.title}
              </h2>

              {/* ============================================== */}
              {/* 1. ARTICLE / LONGREAD RENDERER                 */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'article' && (
                <div className="space-y-6 pt-2">
                  <div className="space-y-5">
                    {parseBlocks(activeLesson.content_json).map((block, idx) => {
                      if (block.type === 'h1') {
                        return (
                          <h3 key={idx} className="text-xl sm:text-2xl font-black text-slate-100 mt-6 pb-2 border-b border-slate-800">
                            {block.text || ''}
                          </h3>
                        );
                      }
                      if (block.type === 'h2') {
                        return (
                          <h4 key={idx} className="text-lg font-bold text-slate-200 mt-6">
                            {block.text || ''}
                          </h4>
                        );
                      }
                      if (block.type === 'paragraph') {
                        return (
                          <p key={idx} className="text-sm sm:text-base text-slate-300 leading-relaxed">
                            {block.text || ''}
                          </p>
                        );
                      }
                      if (block.type === 'callout') {
                        const calloutColors = {
                          danger: 'bg-rose-950/40 border-rose-800/80 text-rose-200',
                          warning: 'bg-amber-950/40 border-amber-800/80 text-amber-200',
                          info: 'bg-sky-950/40 border-sky-800/80 text-sky-200',
                          success: 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200',
                        };
                        const variant = block.variant || 'info';
                        const calloutIcons = {
                          danger: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
                          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
                          info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
                          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
                        };
                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border flex items-start gap-3.5 my-4 ${
                              calloutColors[variant] || calloutColors.info
                            }`}
                          >
                            {calloutIcons[variant] || calloutIcons.info}
                            <div className="space-y-1">
                              <div className="text-xs font-bold uppercase tracking-wider">
                                {block.title || 'Регламент'}
                              </div>
                              <div className="text-xs sm:text-sm leading-relaxed opacity-90">
                                {block.text || ''}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      if (block.type === 'list') {
                        return (
                          <ul key={idx} className="space-y-2 my-3 pl-2">
                            {(block.items || []).map((item, iIdx) => (
                              <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-2 shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      if (block.type === 'image') {
                        return (
                          <div key={idx} className="my-6 space-y-2 text-center">
                            <img
                              src={block.url}
                              alt={block.caption || 'Иллюстрация'}
                              className="rounded-xl max-h-[500px] mx-auto border border-slate-800 shadow-lg object-contain"
                            />
                            {block.caption && (
                              <div className="text-xs text-slate-400 italic">{block.caption}</div>
                            )}
                          </div>
                        );
                      }
                      // Fallback for any unknown block structure
                      return (
                        <p key={idx} className="text-sm sm:text-base text-slate-300 leading-relaxed">
                          {block.text || (typeof block === 'string' ? block : '')}
                        </p>
                      );
                    })}
                  </div>

                  {/* Bottom Action: Finish Article */}
                  <div className="pt-8 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2 shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      Материал изучен → Следующий шаг
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 2. VIDEO STREAMING PLAYER (Range HTTP 206)     */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'video' && (
                <div className="space-y-6 pt-2">
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video max-h-[540px] shadow-2xl relative">
                    {activeLesson.file_url ? (
                      <video
                        ref={videoRef}
                        controls
                        crossOrigin="use-credentials"
                        className="w-full h-full object-contain"
                        src={getVideoUrl(activeLesson)}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={handleVideoEnded}
                        preload="metadata"
                      >
                        Ваш браузер не поддерживает встроенное видео.
                      </video>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
                        <Video className="w-12 h-12 text-slate-700" />
                        <div className="text-sm font-semibold">Видеофайл еще не загружен методистом</div>
                        <div className="text-xs">Зайдите в конструктор курса и прикрепите видео лекции.</div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-sky-400" />
                      <span>Позиция просмотра сохраняется автоматически каждые 10 секунд.</span>
                    </div>
                    {activeLesson.last_timestamp_seconds > 0 && (
                      <span className="text-[11px] text-slate-500">
                        Восстановлено с {Math.round(activeLesson.last_timestamp_seconds)} сек
                      </span>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2 shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      Урок просмотрен → Следующий шаг
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 3. PRESENTATION (PDF) VIEWER                   */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'presentation' && (
                <div className="space-y-6 pt-2">
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 min-h-[500px]">
                    {activeLesson.file_url ? (
                      <iframe
                        src={activeLesson.file_url}
                        className="w-full h-[600px] border-none"
                        title="Презентация"
                      />
                    ) : (
                      <div className="p-16 text-center text-slate-500 space-y-2">
                        <FileCode className="w-10 h-10 mx-auto text-slate-700" />
                        <div className="text-sm font-semibold">Файл презентации PDF еще не загружен</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Презентация изучена → Далее
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================== */}
              {/* 4. QUIZ / TEST EMBEDDED TAKING                 */}
              {/* ============================================== */}
              {activeLesson.lesson_type === 'quiz' && (
                <div className="space-y-6 pt-2">
                  {quizLoading ? (
                    <div className="py-16 text-center text-slate-400 text-xs">Загрузка вопросов теста...</div>
                  ) : quizResult ? (
                    /* Quiz Results Card */
                    <div className="p-8 rounded-2xl glass-panel text-center space-y-4">
                      {quizResult.is_passed ? (
                        <div className="space-y-3">
                          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
                          <h3 className="text-xl font-bold text-slate-100">Тестирование успешно сдано!</h3>
                          <div className="text-sm text-emerald-300 font-semibold">
                            Результат: {quizResult.score_percent}% (Проходной балл: {quizResult.test?.passing_score || 70}%)
                          </div>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Вы подтвердили квалификацию по этому разделу. Урок отмечен как пройденный!
                          </p>
                          <div className="pt-4">
                            <button
                              onClick={handleMarkStepCompleted}
                              className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2"
                            >
                              Перейти к следующему шагу →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <AlertTriangle className="w-14 h-14 text-rose-400 mx-auto" />
                          <h3 className="text-xl font-bold text-slate-100">Тест не сдан</h3>
                          <div className="text-sm text-rose-300 font-semibold">
                            Ваш результат: {quizResult.score_percent}% (требуется {quizResult.test?.passing_score || 70}%)
                          </div>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Повторите теоретический материал лонгрида и попробуйте пройти тестирование снова.
                          </p>
                          <button
                            onClick={() => initQuizAttempt(activeLesson.quiz_id)}
                            className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Попробовать снова
                          </button>
                        </div>
                      )}
                    </div>
                  ) : quizAttempt ? (
                    /* Active Quiz Form */
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-slate-200">{quizAttempt.test?.title}</div>
                          <div className="text-slate-400">
                            Проходной порог: {quizAttempt.test?.passing_score}% • Вопросов: {quizAttempt.test?.questions?.length || 0}
                          </div>
                        </div>
                      </div>

                      {/* Questions List */}
                      <div className="space-y-5">
                        {(quizAttempt.test?.questions || []).map((q, qIdx) => {
                          const isMultiple = q.question_type === 'multiple_choice';
                          const selected = quizAnswers[q.id]?.selected_option_ids || [];

                          return (
                            <div key={q.id} className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                              <div className="flex items-start gap-2.5">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-bold text-slate-300">
                                  {qIdx + 1}
                                </span>
                                <div className="text-sm font-semibold text-slate-100">{q.text}</div>
                              </div>

                              {/* Options */}
                              <div className="space-y-2 pt-1">
                                {(q.options || []).map((opt) => {
                                  const isChecked = selected.includes(opt.id);
                                  return (
                                    <div
                                      key={opt.id}
                                      onClick={() => handleSelectQuizOption(q.id, opt.id, isMultiple)}
                                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-3 ${
                                        isChecked
                                          ? 'bg-sky-950/60 border-sky-700 text-white font-medium'
                                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                                      }`}
                                    >
                                      <div
                                        className={`w-4 h-4 rounded flex items-center justify-center ${
                                          isMultiple ? 'rounded' : 'rounded-full'
                                        } border ${
                                          isChecked ? 'border-sky-400 bg-sky-500' : 'border-slate-600'
                                        }`}
                                      >
                                        {isChecked && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                                      </div>
                                      <span>{opt.text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit Quiz */}
                      <div className="pt-4 border-t border-slate-800 flex justify-end">
                        <button
                          onClick={handleSubmitQuiz}
                          disabled={quizSubmitting}
                          className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          {quizSubmitting ? 'Проверка...' : 'Завершить тест и проверить ответы'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      К этому уроку еще не привязан тест.
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
