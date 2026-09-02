import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, GraduationCap, FileText,
  MessageSquare, Phone, Settings, LogOut, BookOpen,
  Upload, User, ClipboardList, Calendar, ClipboardCheck
} from 'lucide-react'

/*
  Role → nav items:
  admin   → everything
  teacher → dashboard, students, faculty, assignments, events, documents, chat, contact
  student → my-record, events, chat, reports
  worker  → documents, events
*/

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',   roles: ['admin', 'teacher'] },
      { to: '/my-record',  icon: User,            label: 'My Record',   roles: ['student'] },
      { to: '/documents',  icon: FileText,         label: 'Documents',   roles: ['admin', 'teacher', 'worker'] },
    ],
  },
  {
    label: 'Academic',
    items: [
      { to: '/classes',         icon: ClipboardCheck,label: 'Classes & Marks', roles: ['admin', 'teacher'] },
      { to: '/students',        icon: Users,         label: 'Students',        roles: ['admin', 'teacher'] },
      { to: '/faculty',         icon: GraduationCap, label: 'Faculty',         roles: ['admin', 'teacher'] },
      { to: '/assignments',     icon: BookOpen,      label: 'Assignments',     roles: ['admin', 'teacher'] },
      { to: '/events',          icon: Calendar,      label: 'Events',          roles: ['admin', 'teacher', 'student', 'worker'] },
      { to: '/historical-data', icon: Upload,        label: 'Historical Data', roles: ['admin', 'teacher', 'worker'] },
    ],
  },


  {
    label: 'Tools',
    items: [
      { to: '/chat',    icon: MessageSquare, label: 'AI Q&A',   roles: ['admin', 'teacher', 'student'] },
      { to: '/reports', icon: ClipboardList, label: 'Reports',  roles: ['admin', 'teacher', 'student'] },
      { to: '/contact', icon: Phone,         label: 'Contact',  roles: ['admin', 'teacher'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings',   icon: Settings,         label: 'Settings',    roles: ['admin'] },
    ],
  },
]

// Role badge colors
const ROLE_STYLE = {
  admin:   { bg: 'rgba(248,113,113,0.15)',  color: '#f87171',  label: 'Admin'   },
  teacher: { bg: 'rgba(79,142,247,0.15)',   color: '#4f8ef7',  label: 'Teacher' },
  student: { bg: 'rgba(52,211,153,0.15)',   color: '#34d399',  label: 'Student' },
  worker:  { bg: 'rgba(251,191,36,0.15)',   color: '#fbbf24',  label: 'Worker'  },
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  if (!user) return null

  const role     = user.role || 'student'
  const initials = user.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const roleStyle = ROLE_STYLE[role] || ROLE_STYLE.student

  // Filter sections to only show items for current role; skip empty sections
  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(role)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <aside className="sidebar">
      {/* Brand */}
      <NavLink to={role === 'student' ? '/my-record' : role === 'worker' ? '/documents' : '/dashboard'}
        className="sidebar-brand" style={{ textDecoration: 'none' }}>
        <div className="brand-icon">🎓</div>
        <div>
          <div className="brand-name">AcademiQ</div>
          <div className="brand-sub">AI Platform</div>
        </div>
      </NavLink>

      {/* Role badge */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: roleStyle.bg, border: `1px solid ${roleStyle.color}30`,
          borderRadius: 'var(--radius-full)', padding: '4px 10px',
          fontSize: 11, fontWeight: 700, color: roleStyle.color, letterSpacing: 0.5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleStyle.color, flexShrink: 0 }} />
          {roleStyle.label.toUpperCase()}
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {visibleSections.map(section => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon className="nav-icon" size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User card & Logout */}
      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px' }}>
        <div className="user-card" style={{ padding: 0, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name truncate" style={{ fontSize: 13 }}>{user.name || 'User'}</div>
            <div className="user-role" style={{ color: roleStyle.color, fontSize: 11 }}>{roleStyle.label}</div>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost btn-xs"
            title="Sign out"
            style={{
              padding: 6,
              color: '#f87171',
              background: 'rgba(248,113,113,0.1)',
              borderRadius: 6,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={15} />
          </button>
        </div>

        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          id="logout-btn"
          title="Sign out of AcademiQ"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            color: '#f87171',
            borderColor: 'rgba(248,113,113,0.35)',
            background: 'rgba(248,113,113,0.08)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
          }}
        >
          <LogOut size={13} />
          <span>Sign Out</span>
        </button>
      </div>

    </aside>
  )
}

