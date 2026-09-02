import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth, ROLE_HOME } from './context/AuthContext'
import Sidebar from './components/Sidebar'

// Pages
import LoginPage          from './pages/LoginPage'
import DashboardPage      from './pages/DashboardPage'
import StudentsPage       from './pages/StudentsPage'
import StudentProfilePage from './pages/StudentProfilePage'
import FacultyPage        from './pages/FacultyPage'
import DocumentsPage      from './pages/DocumentsPage'
import RAGChatPage        from './pages/RAGChatPage'
import ContactPage        from './pages/ContactPage'
import SettingsPage       from './pages/SettingsPage'
import MyRecordPage       from './pages/MyRecordPage'
import ReportsPage        from './pages/ReportsPage'
import AssignmentsPage    from './pages/AssignmentsPage'
import EventsPage         from './pages/EventsPage'
import HistoricalDataPage from './pages/HistoricalDataPage'


// ── Route guard ────────────────────────────────────────────────────────────────
// roles prop = array of roles allowed; null/undefined = any authenticated user
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  // Role guard — redirect to the role's own home on mismatch
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />
  }

  return children
}

// ── Shell with sidebar ─────────────────────────────────────────────────────────
function AppLayout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  )
}

// ── Root redirect — role-aware ─────────────────────────────────────────────────
function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  return <Navigate to={ROLE_HOME[user.role] || '/dashboard'} replace />
}

// ── All routes ─────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to={ROLE_HOME[user.role] || '/dashboard'} replace /> : <LoginPage />}
      />

      {/* Admin + Teacher shared dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><DashboardPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Student-only: own record (read-only) */}
      <Route path="/my-record" element={
        <ProtectedRoute roles={['student']}>
          <AppLayout><MyRecordPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Students management — admin + teacher */}
      <Route path="/students" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><StudentsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/students/:id" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><StudentProfilePage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Faculty — admin + teacher */}
      <Route path="/faculty" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><FacultyPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Assignments — admin + teacher (Faculty) */}
      <Route path="/assignments" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><AssignmentsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Events — admin + teacher + student + worker */}
      <Route path="/events" element={
        <ProtectedRoute roles={['admin', 'teacher', 'student', 'worker']}>
          <AppLayout><EventsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Documents — admin + teacher + worker */}
      <Route path="/documents" element={
        <ProtectedRoute roles={['admin', 'teacher', 'worker']}>
          <AppLayout><DocumentsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* RAG Chat — admin + teacher + student (not worker) */}
      <Route path="/chat" element={
        <ProtectedRoute roles={['admin', 'teacher', 'student']}>
          <AppLayout><RAGChatPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Parent contact — admin + teacher only */}
      <Route path="/contact" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><ContactPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Admin-only settings */}
      <Route path="/settings" element={
        <ProtectedRoute roles={['admin']}>
          <AppLayout><SettingsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Reports — admin + teacher + student (not worker) */}
      <Route path="/reports" element={
        <ProtectedRoute roles={['admin', 'teacher', 'student']}>
          <AppLayout><ReportsPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Historical Data Upload & Verification — admin + teacher (read-only) + worker */}
      <Route path="/historical-data" element={
        <ProtectedRoute roles={['admin', 'teacher', 'worker']}>
          <AppLayout><HistoricalDataPage /></AppLayout>
        </ProtectedRoute>
      } />


      {/* Root → role-aware redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Catch-all → role-aware redirect */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

// ── App root ───────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-700)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13.5px',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
