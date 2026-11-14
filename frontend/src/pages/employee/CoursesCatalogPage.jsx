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
  UserPlus,
} from 'lucide-react';
import api, { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { AssignCourseModal } from '../../components/admin/AssignCourseModal';

export const CoursesCatalogPage = () => {
  const { user, isManager } = useAuth();
  const hasDepartment = Boolean(user?.department && user.department.trim());

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDept, setSelectedDept] = useState('Все');
  const [employeeTab, setEmployeeTab] = useState('assigned'); // 'assigned' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState(['Все']);
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState(null);

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await api.get('/departments');
        if (res.data && res.data.length > 0) {
          const names = res.data.map((d) => d.name);
          const uniqueNames = Array.from(new Set(['Все', ...names]));
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

  const filteredCourses = courses.filter((c) => {
    if (hasDepartment) {
      if (employeeTab === 'completed') {
        const isComp = c.user_status === 'completed' || c.user_progress_percent === 100;
        if (!isComp) return false;
      }
    }
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EEEEEE] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#141414]/10 border border-[#141414]/20 flex items-center justify-center text-[#141414]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#222222] tracking-tight">
                Обучающие курсы AMG
              </h1>
              <p className="text-xs text-[#777777] mt-0.5">
                Интерактивные программы квалификации: регламенты, видеоуроки, презентации и контрольные тесты
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {hasDepartment ? (
          /* Employee with Department: Just 2 clean tabs - Assigned & Completed */
          <div className="flex items-center gap-2 border-b border-[#EEEEEE] sm:border-0 pb-1 sm:pb-0">
            <button
              onClick={() => setEmployeeTab('assigned')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] ${
                employeeTab === 'assigned'
                  ? 'bg-[#141414] text-white shadow-sm'
                  : 'bg-white border border-[#EEEEEE] text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Назначенные</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  employeeTab === 'assigned' ? 'bg-white/20 text-white' : 'bg-[#F5F5F7] text-[#777777]'
                }`}
              >
                {courses.length}
              </span>
            </button>

            <button
              onClick={() => setEmployeeTab('completed')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[40px] ${
                employeeTab === 'completed'
                  ? 'bg-[#141414] text-white shadow-sm'
                  : 'bg-white border border-[#EEEEEE] text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 ${employeeTab === 'completed' ? 'text-emerald-400' : 'text-emerald-600'}`}
              />
              <span>Пройденные</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  employeeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-[#F5F5F7] text-[#777777]'
                }`}
              >
                {courses.filter((c) => c.user_status === 'completed' || c.user_progress_percent === 100).length}
              </span>
            </button>
          </div>
        ) : (
          /* General Catalog: Department tabs */
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all select-none min-h-[38px] ${
                  selectedDept === dept
                    ? 'bg-[#141414] text-white shadow-sm'
                    : 'bg-white border border-[#EEEEEE] text-[#777777] hover:text-[#222222] hover:bg-[#F5F5F7]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]" />
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
        <div className="p-4 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Assigned Alert Banner (only when on assigned tab) */}
      {!loading &&
        (!hasDepartment || employeeTab === 'assigned') &&
        courses.some((c) => c.is_assigned && c.user_status !== 'completed') && (
          <div className="p-4 rounded-xl bg-[#FCECEB] border border-[#F8D3D0] text-[#222222] text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E84C3D]/10 text-[#E84C3D] flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-[#E84C3D]">Вам назначены обязательные курсы!</span>{' '}
                <span className="text-[#777777]">
                  (Курсов к прохождению:{' '}
                  {courses.filter((c) => c.is_assigned && c.user_status !== 'completed').length})
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#E84C3D] uppercase tracking-wider bg-white px-2.5 py-1 rounded border border-[#F8D3D0]">
              Приоритет обучения
            </span>
          </div>
        )}

      {/* Courses Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 space-y-4 border border-[#EEEEEE] h-80">
              <div className="h-36 bg-[#F5F5F7] rounded-lg" />
              <div className="h-4 bg-[#F5F5F7] rounded w-3/4" />
              <div className="h-3 bg-[#F5F5F7] rounded w-full" />
              <div className="h-3 bg-[#F5F5F7] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white border border-[#EEEEEE] rounded-2xl p-12 text-center text-[#777777] space-y-3 shadow-card animate-fade-in">
          {hasDepartment && employeeTab === 'completed' ? (
            <>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-base font-bold text-[#222222]">У вас пока нет пройденных курсов</div>
              <p className="text-xs sm:text-sm text-[#777777] max-w-sm mx-auto">
                Здесь будут отображаться все завершенные курсы и ваши результаты. Перейдите во вкладку «Назначенные», чтобы приступить к обучению.
              </p>
              <button
                type="button"
                onClick={() => setEmployeeTab('assigned')}
                className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-1.5 font-bold"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Перейти к назначенным</span>
              </button>
            </>
          ) : (
            <>
              <Layers className="w-10 h-10 mx-auto text-[#CED4DA]" />
              <div className="text-base font-bold text-[#222222]">Нет доступных курсов</div>
              <p className="text-xs sm:text-sm text-[#777777] max-w-sm mx-auto">
                {searchQuery
                  ? 'По вашему запросу курсов не найдено. Попробуйте изменить формулировку.'
                  : 'В этом разделе пока нет обучающих программ.'}
              </p>
            </>
          )}
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
                className="bg-white border border-[#EEEEEE] rounded-xl overflow-hidden shadow-card hover:shadow-card-hover hover:border-[#CED4DA] transition-all duration-200 flex flex-col justify-between group hover:-translate-y-0.5"
              >
                {/* Banner */}
                <div className="h-40 relative overflow-hidden bg-[#141414] border-b border-[#EEEEEE]">
                  {course.cover_image_url ? (
                    <img
                      src={course.cover_image_url}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#141414] to-[#1C1C1C]">
                      <GraduationCap className="w-12 h-12 text-white/30" />
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/95 backdrop-blur border border-[#EEEEEE] text-[#141414] uppercase tracking-wider shadow-2xs">
                      {course.department_tag || 'Общий'}
                    </span>
                    {course.is_assigned && (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-[#FCECEB] border border-[#F8D3D0] text-[#E84C3D] shadow-2xs">
                        Обязательный • Назначен вам
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
                    <h3 className="text-base font-bold text-[#222222] group-hover:text-[#141414] transition-colors line-clamp-2">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[#777777] line-clamp-2 leading-relaxed">
                      {course.description || 'Описание курса...'}
                    </p>

                    {isCompleted ? (
                      <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-medium inline-flex items-center gap-1.5 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>
                          {course.completed_at
                            ? `Пройден: ${new Date(course.completed_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}`
                            : 'Курс успешно завершен (100%)'}
                        </span>
                      </div>
                    ) : (
                      course.assignment_deadline && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 font-medium inline-flex items-center gap-1.5 mt-1">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                          <span>Срок сдачи: {new Date(course.assignment_deadline).toLocaleDateString('ru-RU')}</span>
                        </div>
                      )
                    )}
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#EEEEEE]">
                    <div className="flex items-center justify-between text-xs text-[#777777]">
                      <span>{course.modules_count || 1} разделов • {course.lessons_count || 1} уроков</span>
                      <span className="font-bold text-[#222222]">{progress}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-[#EEEEEE] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isCompleted ? 'bg-emerald-500' : 'bg-[#E84C3D]'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-4 bg-[#F5F5F7] border-t border-[#EEEEEE] space-y-2">
                  <Link
                    to={`/courses/${course.id}/learn`}
                    className="btn-primary w-full text-xs sm:text-sm py-2.5 flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {isCompleted ? 'Повторить материал' : isInProgress ? 'Продолжить курс' : 'Начать обучение'}
                    </span>
                  </Link>

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setSelectedCourseForAssign(course)}
                      className="w-full text-xs py-2 px-3 rounded-lg border border-[#CCCCCC] bg-white text-[#222222] hover:border-[#E84C3D] hover:text-[#E84C3D] font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#E84C3D]" />
                      <span>Назначить сотрудникам</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCourseForAssign && (
        <AssignCourseModal
          course={selectedCourseForAssign}
          onClose={() => setSelectedCourseForAssign(null)}
          onAssigned={() => {
            setSelectedCourseForAssign(null);
            fetchCourses();
          }}
        />
      )}
    </div>
  );
};
