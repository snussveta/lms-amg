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
  const [videoSpeed, setVideoSpeed] = useState(1);

  const handleSpeedChange = (speed) => {
    setVideoSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  // Sidebar module collapse states
  const [collapsedModules, setCollapsedModules] = useState({});

  // Embedded Quiz state
  const [quizAttempt, setQuizAttempt] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [quizTimeLeft, setQuizTimeLeft] = useState(null);

  const toggleModuleCollapse = (moduleId) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

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

  // Video 10-Second Heartbeat & Resume Logic
  useEffect(() => {
    if (!activeLesson || activeLesson.lesson_type !== 'video' || !videoRef.current) return;

    const videoElement = videoRef.current;
    if (activeLesson.last_timestamp_seconds && activeLesson.last_timestamp_seconds > 0) {
      try {
        videoElement.currentTime = activeLesson.last_timestamp_seconds;
      } catch (e) {
        console.warn('Не удалось восстановить позицию видео:', e);
      }
    }
  }, [activeLesson?.id]);

  const lastSavedTimeRef = useRef(0);
  const handleVideoTimeUpdate = async () => {
    if (!videoRef.current || !activeLesson) return;
    const current = Math.floor(videoRef.current.currentTime);
    if (current > 0 && current - lastSavedTimeRef.current >= 10) {
      lastSavedTimeRef.current = current;
      try {
        await api.post(`/v1/courses/${id}/lessons/${activeLesson.id}/progress`, {
          status: 'in_progress',
          last_timestamp_seconds: current,
        });
      } catch {
        try {
          await api.post(`/courses/${id}/lessons/${activeLesson.id}/progress`, {
            status: 'in_progress',
            last_timestamp_seconds: current,
          });
        } catch {
          // ignore background progress failures
        }
      }
    }
  };

  const handleVideoEnded = async () => {
    await handleMarkStepCompleted();
  };

  const handleMarkStepCompleted = async () => {
    if (!activeLesson) return;
    try {
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
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка при фиксации шага.'));
    }
  };

  // Embedded Quiz Logic
  useEffect(() => {
    if (activeLesson?.lesson_type === 'quiz' && activeLesson.quiz_id) {
      initQuizAttempt(activeLesson.quiz_id);
    } else {
      setQuizAttempt(null);
      setQuizResult(null);
      setQuizTimeLeft(null);
    }
  }, [activeLesson?.id]);

  const initQuizAttempt = async (testId) => {
    try {
      setQuizLoading(true);
      setQuizResult(null);
      setQuizAnswers({});
      setQuizTimeLeft(null);

      let res;
      try {
        res = await api.post(`/attempts/start/${testId}`);
      } catch {
        res = await api.post(`/attempts/start?test_id=${testId}`);
      }

      const attemptData = res.data;
      setQuizAttempt(attemptData);

      if (attemptData?.expires_at) {
        const expires = new Date(attemptData.expires_at).getTime();
        const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
        setQuizTimeLeft(diff);
      }
    } catch (err) {
      console.error('Ошибка инициализации теста:', err);
    } finally {
      setQuizLoading(false);
    }
  };

  useEffect(() => {
    if (!quizAttempt?.expires_at || quizResult) return;

    const expires = new Date(quizAttempt.expires_at).getTime();
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setQuizTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(interval);
        handleSubmitQuiz();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [quizAttempt?.expires_at, quizResult]);

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

  const handleAnswerChange = (questionId, text) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        text_answer: text,
        answer_text: text,
      },
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizAttempt) return;
    const attemptId = quizAttempt.attempt_id || quizAttempt.id;
    if (!attemptId) return;

    try {
      setQuizSubmitting(true);
      const answersPayload = Object.entries(quizAnswers).map(([qId, ans]) => {
        const textVal = typeof ans === 'string' ? ans : (ans.answer_text || ans.text_answer || '');
        return {
          question_id: parseInt(qId, 10),
          selected_option_ids: ans.selected_option_ids || [],
          text_answer: textVal,
          answer_text: textVal,
        };
      });

      const res = await api.post(`/attempts/${attemptId}/submit`, {
        answers: answersPayload,
      });

      const result = res.data;
      setQuizResult(result);

      if (result.is_passed) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
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

  const handleSelectLesson = (lesson) => {
    if (lesson.is_locked) {
      alert('🔒 Этот шаг заблокирован. Пожалуйста, завершите предыдущие уроки курса, чтобы разблокировать доступ.');
      return;
    }
    setActiveLesson(lesson);
    // On small screens, close sidebar when lesson is picked
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

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

  // 1. Loading Skeleton
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col bg-[#F4F5F7] animate-fade-in">
        <div className="sticky top-14 sm:top-16 z-30 bg-white border-b border-[#E0E0E0] px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E0E0E0] animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-48 h-4 rounded bg-[#E0E0E0] animate-pulse" />
              <div className="w-24 h-3 rounded bg-[#E0E0E0] animate-pulse" />
            </div>
          </div>
          <div className="w-32 h-3 rounded bg-[#E0E0E0] animate-pulse" />
        </div>
        <div className="flex-1 flex p-6 max-w-5xl mx-auto w-full">
          <div className="w-full bg-white rounded-2xl p-8 border border-[#E0E0E0] space-y-4 animate-pulse">
            <div className="h-6 w-1/3 bg-[#F4F5F7] rounded" />
            <div className="h-4 w-3/4 bg-[#F4F5F7] rounded" />
            <div className="h-64 bg-[#F4F5F7] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !courseData) {
    return (
      <div className="min-h-[calc(100vh-56px)] bg-[#F4F5F7] flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 text-center space-y-5 border border-[#E0E0E0] rounded-2xl shadow-card">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF2F2] border border-[#FBD0D3] flex items-center justify-center mx-auto text-[#E30613]">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-[#212529]">Ошибка загрузки курса</h2>
            <p className="text-xs sm:text-sm text-[#6C757D] leading-relaxed">
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

  const allLessons = [];
  (courseData.modules || []).forEach((m) => {
    (m.lessons || []).forEach((l) => allLessons.push(l));
  });

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col bg-[#F4F5F7] text-[#212529]">
      {/* Top Header: Clean Corporate Bar */}
      <div className="sticky top-14 sm:top-16 z-30 bg-white/95 backdrop-blur border-b border-[#E0E0E0] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-[#F4F5F7] border border-[#E0E0E0] text-[#003B73] hover:bg-[#E0E0E0] transition-colors min-h-[40px] text-xs font-bold"
            title={sidebarOpen ? 'Скрыть программу курса' : 'Показать программу курса'}
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Программа</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-[#212529] truncate">
              {courseData.title}
            </h1>
            <div className="text-[11px] text-[#6C757D] truncate flex items-center gap-2">
              <span className="px-1.5 py-0.2 rounded bg-[#003B73]/10 text-[10px] font-bold text-[#003B73]">
                {courseData.department_tag || 'AMG'}
              </span>
              <span>{activeLesson?.title || 'Выберите урок'}</span>
            </div>
          </div>
        </div>

        {/* Course Progress Indicator */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-xs font-bold text-[#212529]">
              {courseData.progress_percent || 0}% пройдено
            </div>
            <div className="text-[10px] text-[#6C757D]">
              {courseData.completed_lessons || 0} из {courseData.total_lessons || allLessons.length} уроков
            </div>
          </div>
          <div className="w-20 sm:w-28 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${courseData.progress_percent || 0}%` }}
            />
          </div>

          <Link
            to="/courses"
            className="p-2 rounded-lg text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7] transition-colors"
            title="Выйти в каталог"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Main Two-Column Body with Responsive Drawer on Mobile */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-[#003B73]/40 backdrop-blur-xs z-40 animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* LEFT COLUMN: Navigation Sidebar */}
        <div
          className={`${
            sidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0'
          } shrink-0 transition-all duration-200 ease-in-out border-r border-[#E0E0E0] bg-white overflow-y-auto flex flex-col fixed md:static inset-y-0 left-0 z-50 md:z-auto shadow-2xl md:shadow-none`}
        >
          {sidebarOpen && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E0E0E0]">
                <div className="text-xs font-bold uppercase tracking-wider text-[#003B73] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  Содержание курса
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-[#6C757D] hover:bg-[#F4F5F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modules & Lessons List */}
              <div className="space-y-3">
                {(courseData.modules || []).map((mod) => {
                  const isCollapsed = Boolean(collapsedModules[mod.id]);
                  return (
                    <div key={mod.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleModuleCollapse(mod.id)}
                        className="w-full flex items-center justify-between text-[11px] font-bold text-[#6C757D] uppercase tracking-wider px-2 py-1.5 rounded hover:bg-[#F4F5F7] transition-colors text-left group"
                        title={isCollapsed ? 'Развернуть модуль' : 'Свернуть модуль'}
                      >
                        <span className="truncate group-hover:text-[#212529] transition-colors">{mod.title}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#6C757D] transition-transform duration-300 shrink-0 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                      </button>

                      <div
                        className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${
                          isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-[1000px] opacity-100'
                        }`}
                      >
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
                              className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-all select-none min-h-[38px] ${
                                isCurrent
                                  ? 'bg-[#F0F5FA] border border-[#B8D5ED] text-[#003B73] font-bold shadow-2xs'
                                  : isLocked
                                  ? 'opacity-40 text-[#6C757D] hover:bg-[#F4F5F7] cursor-not-allowed'
                                  : 'text-[#212529] hover:bg-[#F4F5F7]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : isLocked ? (
                                  <Lock className="w-3.5 h-3.5 text-[#6C757D] shrink-0" />
                                ) : isCurrent ? (
                                  <PlayCircle className="w-4 h-4 text-[#003B73] shrink-0" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-[#CED4DA] shrink-0" />
                                )}
                                <span className="truncate">{les.title}</span>
                              </div>

                              <div className="text-[#6C757D] shrink-0">
                                {iconMap[les.lesson_type] || <FileText className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CENTRAL WORKSPACE: CONTENT LEARNING PLAYER */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
          {!activeLesson ? (
            <div className="text-center py-20 text-[#6C757D] text-sm space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-[#CED4DA]" />
              <div>Выберите урок в меню слева для начала изучения.</div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {/* Active Lesson Header Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-[#E0E0E0] pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#003B73] text-white">
                    {activeLesson.lesson_type === 'article' && 'Лонгрид'}
                    {activeLesson.lesson_type === 'video' && 'Видеопрактикум'}
                    {activeLesson.lesson_type === 'presentation' && 'Презентация'}
                    {activeLesson.lesson_type === 'quiz' && 'Аттестация'}
                  </span>
                  <span className="text-xs text-[#6C757D] font-medium">Шаг урока</span>
                </div>

                {activeLesson.status === 'completed' && (
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Изучено</span>
                  </div>
                )}
              </div>

              {/* Lesson Title */}
              <h2 className="text-xl sm:text-2xl font-black text-[#212529] tracking-tight">
                {activeLesson.title}
              </h2>

              {/* 1. ARTICLE / LONGREAD RENDERER */}
              {activeLesson.lesson_type === 'article' && (
                <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 sm:p-8 shadow-card space-y-6">
                  <div className="space-y-5">
                    {parseBlocks(activeLesson.content_json).map((block, idx) => {
                      if (block.type === 'h1') {
                        return (
                          <h3 key={idx} className="text-xl sm:text-2xl font-black text-[#212529] mt-6 pb-2 border-b border-[#E0E0E0]">
                            {block.text || ''}
                          </h3>
                        );
                      }
                      if (block.type === 'h2') {
                        return (
                          <h4 key={idx} className="text-lg font-bold text-[#212529] mt-6">
                            {block.text || ''}
                          </h4>
                        );
                      }
                      if (block.type === 'paragraph') {
                        return (
                          <p key={idx} className="text-sm sm:text-base text-[#212529] leading-relaxed">
                            {block.text || ''}
                          </p>
                        );
                      }
                      if (block.type === 'callout') {
                        const calloutColors = {
                          danger: 'bg-[#FEF2F2] border-[#FBD0D3] text-[#E30613]',
                          warning: 'bg-amber-50 border-amber-200 text-amber-800',
                          info: 'bg-[#F0F5FA] border-[#B8D5ED] text-[#003B73]',
                          success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                        };
                        const variant = block.variant || 'info';
                        const calloutIcons = {
                          danger: <AlertCircle className="w-5 h-5 text-[#E30613] shrink-0" />,
                          warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
                          info: <Info className="w-5 h-5 text-[#003B73] shrink-0" />,
                          success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
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
                              <div className="text-xs sm:text-sm leading-relaxed">
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
                              <li key={iIdx} className="flex items-start gap-2 text-xs sm:text-sm text-[#212529]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E30613] mt-2 shrink-0" />
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
                              className="rounded-xl max-h-[500px] mx-auto border border-[#E0E0E0] shadow-md object-contain"
                            />
                            {block.caption && (
                              <div className="text-xs text-[#6C757D] italic">{block.caption}</div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className="text-sm sm:text-base text-[#212529] leading-relaxed">
                          {block.text || (typeof block === 'string' ? block : '')}
                        </p>
                      );
                    })}
                  </div>

                  {/* Bottom Action: Finish Article */}
                  <div className="pt-6 border-t border-[#E0E0E0] flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Материал изучен → Следующий шаг</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. VIDEO STREAMING PLAYER */}
              {activeLesson.lesson_type === 'video' && (
                <div className="space-y-5 pt-2 animate-fade-in">
                  <div className="w-full bg-black rounded-2xl overflow-hidden shadow-card flex items-center justify-center border border-[#E0E0E0]">
                    {activeLesson.file_url ? (
                      <video
                        key={activeLesson.file_url}
                        ref={videoRef}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-[70vh] rounded-2xl object-contain bg-black"
                        src={activeLesson.file_url.startsWith('http') ? activeLesson.file_url : `${activeLesson.file_url}`}
                        onLoadedMetadata={(e) => {
                          if (activeLesson.last_timestamp_seconds && activeLesson.last_timestamp_seconds > 0) {
                            try {
                              e.target.currentTime = activeLesson.last_timestamp_seconds;
                            } catch (err) {
                              console.warn('Не удалось применить таймкод:', err);
                            }
                          }
                          e.target.playbackRate = videoSpeed;
                        }}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={handleVideoEnded}
                      >
                        Ваш браузер не поддерживает встроенное видео.
                      </video>
                    ) : (
                      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center text-[#6C757D] gap-2 p-6 text-center">
                        <Video className="w-12 h-12 text-[#CED4DA]" />
                        <div className="text-sm font-bold text-[#212529]">Видеофайл еще не прикреплен</div>
                        <div className="text-xs">Зайдите в конструктор курса и добавьте видеоматериал.</div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E0E0E0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#6C757D] shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#003B73] shrink-0" />
                      <span>
                        {activeLesson.last_timestamp_seconds > 0
                          ? `Восстановлено с ${Math.round(activeLesson.last_timestamp_seconds)} сек. Позиция сохраняется каждые 10 сек.`
                          : 'Позиция просмотра сохраняется автоматически каждые 10 секунд.'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[#6C757D] text-[11px] font-semibold mr-1">Скорость:</span>
                      {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => handleSpeedChange(rate)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                            videoSpeed === rate
                              ? 'bg-[#003B73] text-white'
                              : 'bg-[#F4F5F7] text-[#495057] hover:bg-[#E0E0E0]'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E0E0E0] flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Урок просмотрен → Следующий шаг</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. PRESENTATION (PDF) VIEWER */}
              {activeLesson.lesson_type === 'presentation' && (
                <div className="space-y-5 pt-2 animate-fade-in">
                  <div className="rounded-2xl overflow-hidden border border-[#E0E0E0] bg-white min-h-[500px] shadow-card">
                    {activeLesson.file_url ? (
                      <iframe
                        src={activeLesson.file_url}
                        className="w-full h-[600px] border-none"
                        title="Презентация"
                      />
                    ) : (
                      <div className="p-16 text-center text-[#6C757D] space-y-2">
                        <FileCode className="w-10 h-10 mx-auto text-[#CED4DA]" />
                        <div className="text-sm font-bold text-[#212529]">Файл презентации еще не загружен</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#E0E0E0] flex justify-end">
                    <button
                      onClick={handleMarkStepCompleted}
                      className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Презентация изучена → Далее</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. QUIZ / TEST EMBEDDED */}
              {activeLesson.lesson_type === 'quiz' && (
                <div className="space-y-6 pt-2 animate-fade-in">
                  {quizLoading ? (
                    <div className="py-16 text-center text-[#6C757D] text-xs flex flex-col items-center gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-[#003B73] border-t-transparent animate-spin" />
                      <span>Загрузка контрольного теста...</span>
                    </div>
                  ) : quizResult ? (
                    <div className="p-8 rounded-2xl bg-white border border-[#E0E0E0] shadow-card text-center space-y-4 animate-fade-in">
                      {quizResult.is_passed ? (
                        <div className="space-y-3">
                          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
                          <h3 className="text-xl font-extrabold text-[#212529]">Тестирование успешно сдано!</h3>
                          <div className="text-sm text-emerald-700 font-bold">
                            Результат: {quizResult.score_percent}% (Проходной балл: {quizResult.test?.passing_score || 70}%)
                          </div>
                          <p className="text-xs text-[#6C757D] max-w-sm mx-auto">
                            Вы подтвердили квалификацию по этому разделу. Урок отмечен как пройденный!
                          </p>
                          <div className="pt-4">
                            <button
                              onClick={handleMarkStepCompleted}
                              className="btn-primary text-xs sm:text-sm py-2.5 px-6 inline-flex items-center gap-2"
                            >
                              <span>Перейти к следующему шагу →</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <AlertTriangle className="w-14 h-14 text-[#E30613] mx-auto" />
                          <h3 className="text-xl font-extrabold text-[#212529]">Тест не сдан</h3>
                          <div className="text-sm text-[#E30613] font-bold">
                            Ваш результат: {quizResult.score_percent}% (требуется {quizResult.test?.passing_score || 70}%)
                          </div>
                          <p className="text-xs text-[#6C757D] max-w-sm mx-auto">
                            Повторите теоретический материал и попробуйте пройти тестирование снова.
                          </p>
                          <button
                            onClick={() => initQuizAttempt(activeLesson.quiz_id)}
                            className="btn-secondary text-xs sm:text-sm py-2 px-4 inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Попробовать снова</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : quizAttempt ? (
                    <div className="space-y-6 animate-fade-in">
                      <div className="p-4 rounded-xl bg-white border border-[#E0E0E0] shadow-2xs flex items-center justify-between text-xs gap-3">
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#212529]">{quizAttempt.test?.title}</div>
                          <div className="text-[#6C757D]">
                            Проходной порог: {quizAttempt.test?.passing_score}% • Вопросов: {quizAttempt.test?.questions?.length || 0}
                          </div>
                        </div>

                        {quizTimeLeft !== null && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono font-bold text-xs shrink-0 ${
                            quizTimeLeft < 180
                              ? 'bg-[#FEF2F2] border-[#FBD0D3] text-[#E30613] animate-pulse'
                              : 'bg-[#F0F5FA] border-[#B8D5ED] text-[#003B73]'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(quizTimeLeft)}</span>
                          </div>
                        )}
                      </div>

                      {/* Questions List */}
                      <div className="space-y-4">
                        {(quizAttempt.test?.questions || []).map((q, qIdx) => {
                          const isMultiple = q.question_type === 'multiple_choice';
                          const isOpen =
                            q.type === 'text' ||
                            q.type === 'open' ||
                            q.type === 'free_text' ||
                            q.type === 'manual_review' ||
                            q.question_type === 'open' ||
                            q.question_type === 'text' ||
                            q.question_type === 'free_text' ||
                            q.question_type === 'manual_review';
                          const selected = quizAnswers[q.id]?.selected_option_ids || [];
                          const answerText =
                            typeof quizAnswers[q.id] === 'string'
                              ? quizAnswers[q.id]
                              : (quizAnswers[q.id]?.answer_text || quizAnswers[q.id]?.text_answer || '');

                          return (
                            <div key={q.id} className="p-5 rounded-2xl bg-white border border-[#E0E0E0] shadow-2xs space-y-3">
                              <div className="flex items-start gap-2.5">
                                <span className="px-2 py-0.5 rounded bg-[#003B73] text-xs font-bold text-white shrink-0">
                                  {qIdx + 1}
                                </span>
                                <div className="text-sm font-bold text-[#212529]">{q.text}</div>
                              </div>

                              {isOpen ? (
                                <div className="mt-3">
                                  <textarea
                                    rows={5}
                                    value={answerText}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    placeholder="Введите развернутый ответ на вопрос..."
                                    className="input-field text-sm leading-relaxed resize-y font-normal"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-2 pt-1">
                                  {(q.options || []).map((opt) => {
                                    const isChecked = selected.includes(opt.id);
                                    return (
                                      <div
                                        key={opt.id}
                                        onClick={() => handleSelectQuizOption(q.id, opt.id, isMultiple)}
                                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center gap-3 min-h-[44px] ${
                                          isChecked
                                            ? 'bg-[#F0F5FA] border-[#003B73] text-[#003B73] font-bold ring-1 ring-[#003B73]'
                                            : 'bg-white border-[#E0E0E0] text-[#212529] hover:bg-[#F8F9FA]'
                                        }`}
                                      >
                                        <div
                                          className={`w-4 h-4 rounded flex items-center justify-center ${
                                            isMultiple ? 'rounded' : 'rounded-full'
                                          } border ${
                                            isChecked ? 'border-[#003B73] bg-[#003B73]' : 'border-[#CED4DA] bg-white'
                                          }`}
                                        >
                                          {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                        </div>
                                        <span>{opt.text}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Submit Quiz */}
                      <div className="pt-4 border-t border-[#E0E0E0] flex justify-end">
                        <button
                          onClick={handleSubmitQuiz}
                          disabled={quizSubmitting}
                          className="btn-primary text-xs sm:text-sm py-2.5 px-6 flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>{quizSubmitting ? 'Проверка...' : 'Завершить тест и проверить ответы'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-[#6C757D] text-xs">
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
