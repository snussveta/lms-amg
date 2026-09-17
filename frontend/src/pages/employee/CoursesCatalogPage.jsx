import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Loader2,
  Play,
  Search,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';

export const CoursesCatalogPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');

  const departments = ['Все', 'СТО', 'Склад', 'Продажи', 'Общий'];

  useEffect(() => {
    fetchCourses();
  }, [selectedDept]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (selectedDept !== 'Все') params.department = selectedDept;
      const res = await api.get('/courses', { params });
      setCourses(res.data || []);
    } catch (err) {
      console.error('Ошибка загрузки курсов:', err);
      setError(getErrorMessage(err, 'Не удалось загрузить каталог курсов.'));
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Обучающие курсы
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Интерактивные программы квалификации: регламенты, видеоуроки, презентации и контрольные тесты
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDept === dept
                  ? 'bg-slate-100 text-slate-950 shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            className="input-field text-xs"
            placeholder="Поиск по курсам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Courses Grid */}
      {loading ? (
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
            <span className="text-xs text-slate-400">Загрузка каталога курсов...</span>
          </div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-500 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-slate-600" />
          <div className="text-sm font-semibold text-slate-400">Нет доступных курсов</div>
          <p className="text-xs max-w-sm mx-auto">
            {searchQuery
              ? 'По вашему запросу курсов не найдено.'
              : 'В этом подразделении пока нет опубликованных курсов.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isCompleted = course.user_status === 'completed';
            const isInProgress = course.user_status === 'in_progress';
            const progress = course.user_progress_percent || 0;

            return (
              <div
                key={course.id}
                className="glass-card flex flex-col justify-between overflow-hidden group hover:border-slate-700"
              >
                {/* Banner */}
                <div className="h-40 relative overflow-hidden bg-slate-900 border-b border-slate-800/80">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                      <GraduationCap className="w-12 h-12 text-slate-700" />
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-200 uppercase tracking-wider">
                      {course.department_tag}
                    </span>
                  </div>

                  {isCompleted && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/90 backdrop-blur border border-emerald-800 text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Пройден
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {course.description || 'Описание курса...'}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{course.modules_count} разделов • {course.lessons_count} уроков</span>
                      <span className="font-semibold text-slate-300">{progress}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-slate-950/50 border-t border-slate-800">
                  <Link
                    to={`/courses/${course.id}/learn`}
                    className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isCompleted ? 'Повторить материал' : isInProgress ? 'Продолжить курс' : 'Начать курс'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
