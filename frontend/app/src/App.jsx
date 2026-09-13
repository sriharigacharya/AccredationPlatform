import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth, ROLE_HOME } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import { Menu } from 'lucide-react'

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
import TeacherClassesPage from './pages/TeacherClassesPage'

import MockDeviceKiosk    from './pages/MockDeviceKiosk'
import TimetablePage      from './pages/TimetablePage'
import FacultyAttendancePage from './pages/FacultyAttendancePage'


// ── Route guard ────────────────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-canvas)',
        gap: 16
      }}>
        <div className="spinner spinner-lg" />
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Verifying credentials…</span>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />
  }

  return children
}

// ── Shell with responsive sidebar ──────────────────────────────────────────────
function AppLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="main-content">
        {/* Mobile Header Bar */}
        <div className="mobile-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              AcademiQ
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            CSE Portal
          </span>
        </div>

        {children}
      </div>
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

      {/* Standalone Biometric Terminal Kiosk (Public / Gate Terminal) */}
      <Route path="/mock-device" element={<MockDeviceKiosk />} />

      {/* Timetable — admin + teacher + student */}
      <Route path="/timetable" element={
        <ProtectedRoute roles={['admin', 'teacher', 'student']}>
          <AppLayout><TimetablePage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Faculty Attendance & Live Roster — admin + teacher */}
      <Route path="/faculty-attendance" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><FacultyAttendancePage /></AppLayout>
        </ProtectedRoute>
      } />


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

      {/* Classes, Attendance & Marks — admin + teacher */}
      <Route path="/classes" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
          <AppLayout><TeacherClassesPage /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Assignments — admin + teacher + student */}
      <Route path="/assignments" element={
        <ProtectedRoute roles={['admin', 'teacher', 'student']}>
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

      {/* RAG Chat — admin + teacher (no students, no worker) */}
      <Route path="/chat" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
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

      {/* Reports — admin + teacher (no students, no worker) */}
      <Route path="/reports" element={
        <ProtectedRoute roles={['admin', 'teacher']}>
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
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              boxShadow: 'var(--shadow-md)',
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--danger)',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
