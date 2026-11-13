import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileQuestion,
  FolderArchive,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './RoleBadge';

export const Navbar = () => {
  const { user, logout, isAdmin, isDepartmentHead, isManager } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAdminDropdownOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/courses');
    }
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const isAdminSectionActive =
    location.pathname.startsWith('/admin') ||
    location.pathname.includes('constructor') ||
    location.pathname.includes('question-bank');

  return (
    <>
      {/* Top Main Navigation Bar */}
      <nav className="sticky top-0 z-40 w-full bg-[#141414] text-white border-b border-[#242424] shadow-sm select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Brand AMG LMS (Clean typography badge, no external logo image) */}
            <div className="flex items-center gap-6 lg:gap-8">
              <Link to="/" className="flex items-center gap-3 group focus:outline-none">
                <div className="w-9 h-9 rounded-xl bg-[#242424] border border-[#383838] flex items-center justify-center text-white group-hover:bg-[#2e2e2e] transition-all relative shadow-sm">
                  <GraduationCap className="w-5 h-5 text-white" />
                  <span className="w-2 h-2 rounded-full bg-[#E84C3D] absolute -top-0.5 -right-0.5 ring-2 ring-[#141414]" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-black text-white tracking-tight leading-none">
                      AMG
                    </span>
                    <span className="text-[10px] font-bold text-white bg-[#E84C3D] px-1.5 py-0.5 rounded leading-tight tracking-wider uppercase">
                      LMS
                    </span>
                  </div>
                  <span className="text-[10px] text-[#888888] font-medium tracking-wider uppercase mt-0.5 hidden xs:inline-block">
                    Корпоративное обучение
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
              {user && (
                <div className="hidden md:flex items-center gap-1">
                  <Link
                    to="/courses"
                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                      isActive('/courses') || location.pathname === '/'
                        ? 'bg-[#242424] text-white font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#E84C3D] after:rounded-full'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-white/90" />
                    Курсы
                  </Link>

                  <Link
                    to={isAdmin ? '/admin/tests' : '/tests'}
                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                      isActive('/tests') || isActive('/admin/tests')
                        ? 'bg-[#242424] text-white font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#E84C3D] after:rounded-full'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FileQuestion className="w-4 h-4 text-white/90" />
                    Тесты
                  </Link>

                  {!isAdmin && (
                    <Link
                      to="/my-attempts"
                      className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                        isActive('/my-attempts')
                          ? 'bg-[#242424] text-white font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#E84C3D] after:rounded-full'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <History className="w-4 h-4 text-white/90" />
                      Мои результаты
                    </Link>
                  )}

                  <Link
                    to="/knowledge-base"
                    className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                      isActive('/knowledge-base')
                        ? 'bg-[#242424] text-white font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#E84C3D] after:rounded-full'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <FolderArchive className="w-4 h-4 text-white/90" />
                    База знаний
                  </Link>

                  {(isAdmin || isDepartmentHead) && (
                    <Link
                      to="/admin/users"
                      className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 relative ${
                        isActive('/admin/users')
                          ? 'bg-[#242424] text-white font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-[#E84C3D] after:rounded-full'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Users className="w-4 h-4 text-white/90" />
                      {isDepartmentHead ? 'Сотрудники отдела' : 'Сотрудники'}
                    </Link>
                  )}

                  {isAdmin && (
                    <>
                      <div className="w-px h-5 bg-white/20 mx-2" />

                      {/* Admin Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                          className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${
                            isAdminSectionActive
                              ? 'bg-[#242424] text-white font-semibold'
                              : 'text-white/70 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <Shield className="w-4 h-4 text-[#E84C3D]" />
                          <span>Управление</span>
                          <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                        </button>

                        {adminDropdownOpen && (
                          <div
                            className="absolute left-0 mt-2 w-56 rounded-xl bg-white text-[#222222] shadow-xl border border-[#EEEEEE] py-1.5 z-50 animate-fade-in"
                            onMouseLeave={() => setAdminDropdownOpen(false)}
                          >
                            <div className="px-3 py-1.5 text-[10px] font-bold text-[#777777] uppercase tracking-wider border-b border-[#EEEEEE]">
                              Администрирование AMG
                            </div>
                            <Link
                              to="/admin/courses"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium hover:bg-[#F5F5F7] hover:text-[#E84C3D] transition-colors"
                            >
                              <GraduationCap className="w-4 h-4 text-[#E84C3D]" />
                              Управление курсами
                            </Link>
                            <Link
                              to="/admin/tests"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium hover:bg-[#F5F5F7] hover:text-[#E84C3D] transition-colors"
                            >
                              <LayoutDashboard className="w-4 h-4 text-[#E84C3D]" />
                              Управление тестами
                            </Link>
                            <Link
                              to="/admin/question-bank"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium hover:bg-[#F5F5F7] hover:text-[#E84C3D] transition-colors"
                            >
                              <BookOpen className="w-4 h-4 text-[#E84C3D]" />
                              Банк вопросов
                            </Link>
                            <Link
                              to="/admin/users"
                              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium hover:bg-[#F5F5F7] hover:text-[#E84C3D] transition-colors border-t border-[#EEEEEE]"
                            >
                              <Users className="w-4 h-4 text-[#E84C3D]" />
                              Сотрудники и роли
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Desktop User Profile & Actions */}
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2.5 pr-2 border-r border-white/15">
                  <div className="w-8 h-8 rounded-full bg-[#242424] border border-[#3D3D3D] flex items-center justify-center font-bold text-xs text-white">
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white leading-tight">
                        {user.full_name}
                      </span>
                      <RoleBadge role={user.role} />
                    </div>
                    <span className="text-[11px] text-[#888888] truncate max-w-[170px]">
                      {user.email}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  title="Выйти из системы"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                >
                  Войти
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#E84C3D] hover:bg-[#D33829] transition-all shadow-sm"
                >
                  Регистрация
                </Link>
              </div>
            )}

            {/* Mobile Menu Hamburger Button (44px touch target) */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:bg-white/20 transition-colors focus:outline-none"
                aria-label="Открыть меню"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Full Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#242424] bg-[#141414] text-white px-4 pt-3 pb-6 space-y-3 animate-fade-in shadow-xl">
            {user ? (
              <>
                {/* User Info Card on Mobile */}
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-sm text-white shrink-0">
                      {user.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-white truncate">
                        {user.full_name}
                      </div>
                      <div className="text-xs text-white/70 truncate">{user.email}</div>
                    </div>
                  </div>
                  <RoleBadge role={user.role} />
                </div>

                {/* Main Navigation Links */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider px-2 pt-1 pb-1">
                    Обучение и аттестация
                  </div>
                  <Link
                    to="/courses"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isActive('/courses')
                        ? 'bg-white/20 text-white font-semibold'
                        : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 text-white/80" />
                    <span>Курсы обучения</span>
                  </Link>
                  {!isAdmin && (
                    <Link
                      to="/tests"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        isActive('/tests')
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <FileQuestion className="w-4 h-4 text-white/80" />
                      <span>Каталог тестов</span>
                    </Link>
                  )}
                  {!isAdmin && (
                    <Link
                      to="/my-attempts"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        isActive('/my-attempts')
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <History className="w-4 h-4 text-white/80" />
                      <span>Мои результаты</span>
                    </Link>
                  )}
                  <Link
                    to="/knowledge-base"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      isActive('/knowledge-base')
                        ? 'bg-white/20 text-white font-semibold'
                        : 'text-white/90 hover:bg-white/10'
                    }`}
                  >
                    <FolderArchive className="w-4 h-4 text-white/80" />
                    <span>База знаний</span>
                  </Link>

                  {isDepartmentHead && (
                    <Link
                      to="/admin/users"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                        isActive('/admin/users')
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/90 hover:bg-white/10'
                      }`}
                    >
                      <Users className="w-4 h-4 text-white/80" />
                      <span>Сотрудники отдела</span>
                    </Link>
                  )}
                </div>

                {/* Admin Links */}
                {isAdmin && (
                  <div className="space-y-1 pt-2 border-t border-white/15">
                    <div className="text-[10px] font-bold text-[#E84C3D] uppercase tracking-wider px-2 pb-1">
                      Администрирование AMG
                    </div>
                    <Link
                      to="/admin/courses"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 min-h-[40px]"
                    >
                      <GraduationCap className="w-4 h-4 text-[#E84C3D]" />
                      <span>Управление курсами</span>
                    </Link>
                    <Link
                      to="/admin/tests"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 min-h-[40px]"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#E84C3D]" />
                      <span>Управление тестами</span>
                    </Link>
                    <Link
                      to="/admin/question-bank"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 min-h-[40px]"
                    >
                      <BookOpen className="w-4 h-4 text-[#E84C3D]" />
                      <span>Банк вопросов</span>
                    </Link>
                    <Link
                      to="/admin/users"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-white/90 hover:bg-white/10 min-h-[40px]"
                    >
                      <Users className="w-4 h-4 text-[#E84C3D]" />
                      <span>Сотрудники и роли</span>
                    </Link>
                  </div>
                )}

                <div className="pt-2 border-t border-white/15">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#E84C3D] hover:bg-[#D33829] transition-colors min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти из системы</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg font-semibold text-xs text-white bg-white/10 border border-white/20 min-h-[44px] flex items-center justify-center"
                >
                  Войти в систему
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-lg font-semibold text-xs text-white bg-[#E84C3D] hover:bg-[#D33829] min-h-[44px] flex items-center justify-center"
                >
                  Зарегистрироваться
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Mobile Bottom Dock for Quick Thumb Navigation */}
      {user && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#EEEEEE] shadow-lg flex items-center justify-around px-1 py-1 safe-area-bottom select-none">
          <Link
            to="/courses"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center transition-colors ${
              isActive('/courses') || location.pathname === '/'
                ? 'text-[#141414] font-bold'
                : 'text-[#777777] hover:text-[#222222]'
            }`}
          >
            <GraduationCap className={`w-5 h-5 ${isActive('/courses') || location.pathname === '/' ? 'text-[#E84C3D]' : 'currentColor'}`} />
            <span className="text-[10px] mt-0.5 leading-tight">Курсы</span>
          </Link>

          <Link
            to={isAdmin ? '/admin/tests' : '/tests'}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center transition-colors ${
              isActive('/tests') || isActive('/admin/tests')
                ? 'text-[#141414] font-bold'
                : 'text-[#777777] hover:text-[#222222]'
            }`}
          >
            <FileQuestion className={`w-5 h-5 ${isActive('/tests') || isActive('/admin/tests') ? 'text-[#E84C3D]' : 'currentColor'}`} />
            <span className="text-[10px] mt-0.5 leading-tight">Тесты</span>
          </Link>

          {!isManager ? (
            <Link
              to="/my-attempts"
              className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center transition-colors ${
                isActive('/my-attempts')
                  ? 'text-[#141414] font-bold'
                  : 'text-[#777777] hover:text-[#222222]'
              }`}
            >
              <History className={`w-5 h-5 ${isActive('/my-attempts') ? 'text-[#E84C3D]' : 'currentColor'}`} />
              <span className="text-[10px] mt-0.5 leading-tight">Результаты</span>
            </Link>
          ) : (
            <Link
              to="/admin/users"
              className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center transition-colors ${
                isActive('/admin/users')
                  ? 'text-[#141414] font-bold'
                  : 'text-[#777777] hover:text-[#222222]'
              }`}
            >
              <Users className={`w-5 h-5 ${isActive('/admin/users') ? 'text-[#E84C3D]' : 'currentColor'}`} />
              <span className="text-[10px] mt-0.5 leading-tight">{isDepartmentHead ? 'Отдел' : 'Сотрудники'}</span>
            </Link>
          )}

          <Link
            to="/knowledge-base"
            className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center transition-colors ${
              isActive('/knowledge-base')
                ? 'text-[#141414] font-bold'
                : 'text-[#777777] hover:text-[#222222]'
            }`}
          >
            <FolderArchive className={`w-5 h-5 ${isActive('/knowledge-base') ? 'text-[#E84C3D]' : 'currentColor'}`} />
            <span className="text-[10px] mt-0.5 leading-tight">База знаний</span>
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg text-center text-[#777777] hover:text-[#141414] transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 leading-tight">Меню</span>
          </button>
        </div>
      )}
    </>
  );
};
