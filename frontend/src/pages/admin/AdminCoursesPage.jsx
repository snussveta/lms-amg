import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { AssignCourseModal } from '../../components/admin/AssignCourseModal';

export const AdminCoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningCourse, setAssigningCourse] = useState(null);

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
      setError(getErrorMessage(err, 'Не удалось загрузить список курсов.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId, title) => {
    if (!window.confirm(`Вы уверены, что хотите удалить курс «${title}» со всеми материалами?`)) {
      return;
    }

    try {
      await api.delete(`/courses/${courseId}`);
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch (err) {
      alert(getErrorMessage(err, 'Ошибка при удалении курса.'));
    }
  };

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <GraduationCap className="w-6 h-6 text-sky-400" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Управление курсами
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Конструктор программ обучения, лонгридов, 5+ часовых видеолекций и аттестаций
          </p>
        </div>

        <Link
          to="/admin/courses/new"
          className="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Создать курс
        </Link>
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
          <div className="text-sm font-semibold text-slate-400">Курсы не найдены</div>
          <p className="text-xs max-w-sm mx-auto">
            {searchQuery
              ? 'По вашему запросу ничего не найдено.'
              : 'В выбранном подразделении еще не создано обучающих курсов.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="glass-card flex flex-col justify-between overflow-hidden group hover:border-slate-700"
            >
              {/* Card Banner */}
              <div className="h-36 relative overflow-hidden bg-slate-900 border-b border-slate-800/80">
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
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-200 uppercase tracking-wider">
                    {course.department_tag}
                  </span>
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur ${
                      course.is_published
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                        : 'bg-amber-950/80 border border-amber-800 text-amber-400'
                    }`}
                  >
                    {course.is_published ? 'Опубликован' : 'Черновик'}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-400 transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {course.description || 'Описание курса не заполнено.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>{course.modules_count} разделов</span>
                    <span>•</span>
                    <span>{course.lessons_count} уроков</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between gap-2">
                <Link
                  to={`/courses/${course.id}/learn`}
                  target="_blank"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1"
                  title="Предпросмотр плеера сотрудника"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Плеер
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAssigningCourse(course)}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 hover:border-sky-500 hover:text-sky-400"
                    title="Назначить курс сотрудникам"
                  >
                    <Users className="w-3 h-3 text-sky-400" />
                    Назначить
                  </button>

                  <Link
                    to={`/admin/courses/${course.id}/edit`}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    Редактор
                  </Link>

                  <button
                    onClick={() => handleDeleteCourse(course.id, course.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Удалить курс"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assignment Modal */}
      {assigningCourse && (
        <AssignCourseModal
          course={assigningCourse}
          onClose={() => setAssigningCourse(null)}
          onAssigned={fetchCourses}
        />
      )}
    </div>
  );
};
