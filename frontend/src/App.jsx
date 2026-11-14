import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

// Auth Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Employee Pages
import { TestCatalogPage } from './pages/employee/TestCatalogPage';
import { TakeTestPage } from './pages/employee/TakeTestPage';
import { TestResultPage } from './pages/employee/TestResultPage';
import { MyAttemptsPage } from './pages/employee/MyAttemptsPage';
import { CoursesCatalogPage } from './pages/employee/CoursesCatalogPage';
import { CoursePlayerPage } from './pages/employee/CoursePlayerPage';

// Admin Pages
import { AdminTestsPage } from './pages/admin/AdminTestsPage';
import { TestConstructorPage } from './pages/admin/TestConstructorPage';
import { TestAnalyticsPage } from './pages/admin/TestAnalyticsPage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { QuestionBankPage } from './pages/admin/QuestionBankPage';
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage';
import { CourseConstructorPage } from './pages/admin/CourseConstructorPage';

// Knowledge Base Page
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';

// Public Guest Test Page
import { GuestTakeTestPage } from './pages/public/GuestTakeTestPage';

// Synchronous Live Exam Pages
import { DirectJoinExamPage } from './pages/public/DirectJoinExamPage';
import { LiveExamRoomPage } from './pages/employee/LiveExamRoomPage';
import { LiveExamControlPage } from './pages/admin/LiveExamControlPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#222222] selection:bg-[#E84C3D] selection:text-white">
          <Navbar />
          <div className="flex-1 pb-20 md:pb-6">
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Public Guest Testing Routes (без авторизации) */}
              <Route path="/t/:token" element={<GuestTakeTestPage />} />
              <Route path="/public-test/:testId" element={<GuestTakeTestPage />} />

              {/* Synchronous Live Exam Routes */}
              <Route path="/exam/join" element={<DirectJoinExamPage />} />
              <Route path="/exam/join/:code" element={<DirectJoinExamPage />} />
              <Route path="/exam/room/:sessionId" element={<LiveExamRoomPage />} />
              <Route
                path="/admin/exam/:sessionId"
                element={
                  <ProtectedRoute requireManager>
                    <LiveExamControlPage />
                  </ProtectedRoute>
                }
              />

              {/* Employee Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <CoursesCatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses"
                element={
                  <ProtectedRoute>
                    <CoursesCatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/courses/:id/learn"
                element={
                  <ProtectedRoute>
                    <CoursePlayerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tests"
                element={
                  <ProtectedRoute>
                    <TestCatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-attempts"
                element={
                  <ProtectedRoute>
                    <MyAttemptsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/knowledge-base"
                element={
                  <ProtectedRoute>
                    <KnowledgeBasePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/test/:attemptId"
                element={
                  <ProtectedRoute>
                    <TakeTestPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/test/:attemptId/result"
                element={
                  <ProtectedRoute>
                    <TestResultPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin/courses"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminCoursesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/courses/new"
                element={
                  <ProtectedRoute requireAdmin>
                    <CourseConstructorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/courses/:id/edit"
                element={
                  <ProtectedRoute requireAdmin>
                    <CourseConstructorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tests"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminTestsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tests/new"
                element={
                  <ProtectedRoute requireAdmin>
                    <TestConstructorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tests/:testId/edit"
                element={
                  <ProtectedRoute requireAdmin>
                    <TestConstructorPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/tests/:testId/analytics"
                element={
                  <ProtectedRoute requireAdmin>
                    <TestAnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/question-bank"
                element={
                  <ProtectedRoute requireAdmin>
                    <QuestionBankPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireManager>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
