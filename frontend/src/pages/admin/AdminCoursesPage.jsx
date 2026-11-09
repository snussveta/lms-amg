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
  const [departments, setDepartments] = useState(['Все', 'СТО', 'Склад', 'Продажи', 'Общий']);

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (res.data && res.data.length > 0) {
          const names = res.data.map((d) => d.name);
          const uniqueNames = Array.from(new Set(['Все', ...names, 'Общий']));
          setDepartments(uniqueNames);
        }
      } catch (err) {
        console.error('Ошибка загрузки подразделений:', err);
      }
    };
    loadDepts();
  }, []);

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

  const handleTogglePublish = async (course, e) => {
    if (e) e.stopPropagation();
    const nextState = !course.is_published;
    try {
      await api.put(`/courses/${course.id}`, {
        is_published: nextState,
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: nextState } : c))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Не удалось изменить статус публикации курса.'));
    }
  };

  const handleTogglePublic = async (course, e) => {
    if (e) e.stopPropagation();
    const nextPublic = !course.is_public;
    try {
      await api.put(`/courses/${course.id}`, {
        is_public: nextPublic,
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_public: nextPublic } : c))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Не удалось изменить режим доступа к курсу.'));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003B73]/10 border border-[#003B73]/20 flex items-center justify-center text-[#003B73]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#212529] tracking-tight">
                Управление курсами AMG
              </h1>
              <p className="text-xs text-[#6C757D] mt-0.5">
                Конструктор программ обучения, лонгридов, видеолекций и контрольных аттестаций
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/admin/courses/new"
          className="btn-primary text-xs sm:text-sm flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Создать курс</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none min-h-[38px] ${
                selectedDept === dept
                  ? 'bg-[#003B73] text-white shadow-sm'
                  : 'bg-white border border-[#E0E0E0] text-[#6C757D] hover:text-[#212529] hover:bg-[#F4F5F7]'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D]" />
          <input
            type="text"
            className="input-field pl-9 text-xs sm:text-sm"
            placeholder="Поиск по курсам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FBD0D3] text-[#E30613] text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Courses Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-[#003B73] animate-spin" />
            <span className="text-xs text-[#6C757D]">Загрузка каталога курсов...</span>
          </div>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center text-[#6C757D] space-y-3 shadow-card">
          <Layers className="w-10 h-10 mx-auto text-[#CED4DA]" />
          <div className="text-base font-bold text-[#212529]">Курсы не найдены</div>
          <p className="text-xs sm:text-sm text-[#6C757D] max-w-sm mx-auto">
            {searchQuery
              ? 'По вашему запросу ничего не найдено.'
              : 'В выбранном подразделении еще не создано обучающих курсов.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-card hover:shadow-card-hover hover:border-[#CED4DA] transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
            >
              {/* Card Banner */}
              <div className="h-36 relative overflow-hidden bg-[#003B73] border-b border-[#E0E0E0]">
                {course.cover_image_url ? (
                  <img
                    src={course.cover_image_url}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#003B73] to-[#002447]">
                    <GraduationCap className="w-12 h-12 text-white/30" />
                  </div>
                )}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/95 backdrop-blur border border-[#E0E0E0] text-[#003B73] uppercase tracking-wider shadow-2xs">
                    {course.department_tag || 'Общий'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePublic(course, e)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur shadow-2xs transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 ${
                      course.is_public
                        ? 'bg-blue-50 border border-blue-200 text-[#003B73]'
                        : 'bg-purple-50 border border-purple-200 text-purple-700'
                    }`}
                    title={
                      course.is_public
                        ? 'Общий доступ (виден всем в каталоге). Нажмите, чтобы ограничить доступ'
                        : 'Только назначенным (виден только выбранным). Нажмите, чтобы открыть для всех'
                    }
                  >
                    {course.is_public ? '🌐 Для всех' : '🔒 Назначенным'}
                  </button>
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <button
                    type="button"
                    onClick={(e) => handleTogglePublish(course, e)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur shadow-2xs transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 ${
                      course.is_published
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100'
                    }`}
                    title={
                      course.is_published
                        ? 'Курс опубликован. Нажмите, чтобы скрыть в черновик'
                        : 'Черновик. Нажмите, чтобы опубликовать для сотрудников'
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        course.is_published ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {course.is_published ? 'Опубликован' : 'Черновик'}
                  </button>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-[#212529] group-hover:text-[#003B73] transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="text-xs text-[#6C757D] line-clamp-2 leading-relaxed">
                    {course.description || 'Описание курса не заполнено.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#E0E0E0] flex items-center justify-between text-xs text-[#6C757D]">
                  <div className="flex items-center gap-3">
                    <span>{course.modules_count || 1} разделов</span>
                    <span>•</span>
                    <span>{course.lessons_count || 1} уроков</span>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-4 py-3 bg-[#F4F5F7] border-t border-[#E0E0E0] flex items-center justify-between gap-2">
                <Link
                  to={`/courses/${course.id}/learn`}
                  target="_blank"
                  className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#003B73] hover:bg-white text-xs flex items-center gap-1 font-medium"
                  title="Предпросмотр плеера сотрудника"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Плеер</span>
                </Link>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAssigningCourse(course)}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                    title="Назначить курс сотрудникам"
                  >
                    <Users className="w-3 h-3 text-[#003B73]" />
                    <span>Назначить</span>
                  </button>

                  <Link
                    to={`/admin/courses/${course.id}/edit`}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    <span>Редактор</span>
                  </Link>

                  <button
                    onClick={() => handleDeleteCourse(course.id, course.title)}
                    className="p-1.5 rounded-lg text-[#6C757D] hover:text-[#E30613] hover:bg-[#FEF2F2] transition-colors"
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
