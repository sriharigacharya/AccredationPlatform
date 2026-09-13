import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, FileText,
  MessageSquare, Phone, Settings, LogOut, BookOpen,
  Upload, User, ClipboardList, Calendar, ClipboardCheck,
  Clock, Fingerprint, X
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    label: 'Core',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   roles: ['admin', 'teacher'] },
      { to: '/my-record',  icon: User,            label: 'My Record',   roles: ['student'] },
      { to: '/timetable',  icon: Clock,           label: 'Timetable',   roles: ['admin', 'teacher', 'student'] },
      { to: '/documents',  icon: FileText,        label: 'Documents',   roles: ['admin', 'teacher', 'worker'] },
    ],
  },
  {
    label: 'Academic Operations',
    items: [
      { to: '/faculty-attendance', icon: Fingerprint,   label: 'Faculty Attendance', roles: ['admin', 'teacher'] },
      { to: '/classes',            icon: ClipboardCheck, label: 'Classes & Marks',    roles: ['admin', 'teacher'] },
      { to: '/students',           icon: Users,          label: 'Students',           roles: ['admin', 'teacher'] },
      { to: '/faculty',            icon: GraduationCap,  label: 'Faculty',            roles: ['admin', 'teacher'] },
      { to: '/assignments',        icon: BookOpen,       label: 'Assignments',        roles: ['admin', 'teacher', 'student'] },
      { to: '/events',             icon: Calendar,       label: 'Events & Clubs',     roles: ['admin', 'teacher', 'student', 'worker'] },
      { to: '/historical-data',    icon: Upload,         label: 'Historical Data',    roles: ['admin', 'teacher', 'worker'] },
    ],
  },

  {
    label: 'Intelligence & Reports',
    items: [
      { to: '/chat',    icon: MessageSquare, label: 'AI Document Q&A', roles: ['admin', 'teacher'] },
      { to: '/reports', icon: ClipboardList, label: 'Accreditation Reports', roles: ['admin', 'teacher'] },
      { to: '/contact', icon: Phone,         label: 'Parent Contact',  roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/settings', icon: Settings, label: 'System Settings', roles: ['admin'] },
    ],
  },
]

const ROLE_STYLE = {
  admin:   { bg: 'var(--danger-subtle)',  border: 'var(--danger-border)',  color: 'var(--danger)',  label: 'Admin' },
  teacher: { bg: 'var(--primary-subtle)', border: 'var(--primary-border)', color: 'var(--primary)', label: 'Faculty' },
  student: { bg: 'var(--success-subtle)', border: 'var(--success-border)', color: 'var(--success)', label: 'Student' },
  worker:  { bg: 'var(--warning-subtle)', border: 'var(--warning-border)', color: 'var(--warning)', label: 'Staff' },
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  if (!user) return null

  const role = user.role || 'student'
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  const roleStyle = ROLE_STYLE[role] || ROLE_STYLE.student

  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <>
      <div
        className={`mobile-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <NavLink
            to={role === 'student' ? '/my-record' : role === 'worker' ? '/documents' : '/dashboard'}
            className="sidebar-brand"
            onClick={onClose}
          >
            <div className="brand-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <div className="brand-name">AcademiQ</div>
              <div className="brand-sub">Academic Intelligence</div>
            </div>
          </NavLink>

          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ display: 'none', marginRight: 12 }}
            id="mobile-sidebar-close"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Institutional Department & Role Banner */}
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.015)'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
            CSE Dept · Tier-II
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: roleStyle.bg,
            border: `1px solid ${roleStyle.border}`,
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            color: roleStyle.color,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: roleStyle.color }} />
            {roleStyle.label}
          </span>
        </div>

        {/* Navigation items */}
        <nav className="sidebar-nav">
          {visibleSections.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon className="nav-icon" size={17} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User profile & Single Sign Out */}
        <div className="sidebar-footer">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.name || 'User'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {user.email || user.user_id || 'Signed In'}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="btn btn-ghost btn-icon"
              title="Sign Out"
              aria-label="Sign Out"
              style={{ color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
