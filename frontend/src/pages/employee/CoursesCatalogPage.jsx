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
      let res;
      try {
        res = await api.get('/courses/my', { params });
      } catch {
        res = await api.get('/courses', { params });
      }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E0E0E0] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003B73]/10 border border-[#003B73]/20 flex items-center justify-center text-[#003B73]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#212529] tracking-tight">
                Обучающие курсы AMG
              </h1>
              <p className="text-xs text-[#6C757D] mt-0.5">
                Интерактивные программы квалификации: регламенты, видеоуроки, презентации и контрольные тесты
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Department tabs: scrollable on mobile */}
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

        {/* Search */}
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C757D]" />
          <input
            type="text"
            className="input-field pl-9 text-xs sm:text-sm"
            placeholder="Поиск курсов по названию..."
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 space-y-4 border border-[#E0E0E0] h-80">
              <div className="h-36 bg-[#F4F5F7] rounded-lg" />
              <div className="h-4 bg-[#F4F5F7] rounded w-3/4" />
              <div className="h-3 bg-[#F4F5F7] rounded w-full" />
              <div className="h-3 bg-[#F4F5F7] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-2xl p-12 text-center text-[#6C757D] space-y-3 shadow-card animate-fade-in">
          <Layers className="w-10 h-10 mx-auto text-[#CED4DA]" />
          <div className="text-base font-bold text-[#212529]">Нет доступных курсов</div>
          <p className="text-xs sm:text-sm text-[#6C757D] max-w-sm mx-auto">
            {searchQuery
              ? 'По вашему запросу курсов не найдено. Попробуйте изменить формулировку.'
              : 'В этом подразделении пока нет опубликованных обучающих программ.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 animate-fade-in">
          {filteredCourses.map((course) => {
            const isCompleted = course.user_status === 'completed';
            const isInProgress = course.user_status === 'in_progress';
            const progress = course.user_progress_percent || 0;

            return (
              <div
                key={course.id}
                className="bg-white border border-[#E0E0E0] rounded-xl overflow-hidden shadow-card hover:shadow-card-hover hover:border-[#CED4DA] transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
              >
                {/* Banner */}
                <div className="h-40 relative overflow-hidden bg-[#003B73] border-b border-[#E0E0E0]">
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

                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/95 backdrop-blur border border-[#E0E0E0] text-[#003B73] uppercase tracking-wider shadow-2xs">
                      {course.department_tag || 'Общий'}
                    </span>
                    {course.is_assigned && (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] border border-[#FBD0D3] text-[#E30613] shadow-2xs">
                        Назначен вам
                      </span>
                    )}
                  </div>

                  {isCompleted && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 backdrop-blur border border-emerald-200 text-emerald-700 flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Пройден
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[#212529] group-hover:text-[#003B73] transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[#6C757D] line-clamp-2 leading-relaxed">
                      {course.description || 'Описание курса...'}
                    </p>

                    {course.assignment_deadline && !isCompleted && (
                      <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 font-medium inline-flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span>Срок сдачи: {new Date(course.assignment_deadline).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#E0E0E0]">
                    <div className="flex items-center justify-between text-xs text-[#6C757D]">
                      <span>{course.modules_count || 1} разделов • {course.lessons_count || 1} уроков</span>
                      <span className="font-bold text-[#212529]">{progress}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-[#E0E0E0] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-[#E30613]'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-[#F4F5F7] border-t border-[#E0E0E0]">
                  <Link
                    to={`/courses/${course.id}/learn`}
                    className="btn-primary w-full text-xs sm:text-sm py-2.5 flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {isCompleted ? 'Повторить материал' : isInProgress ? 'Продолжить курс' : 'Начать обучение'}
                    </span>
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
