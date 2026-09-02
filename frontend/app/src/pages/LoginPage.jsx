import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../context/AuthContext'
import toast from 'react-hot-toast'

// Demo credentials shown per tab
const DEMO_CREDS = [
  { role: 'admin',   email: 'admin@academiq.edu',   password: 'admin123',   label: 'Admin',   icon: '🛡️' },
  { role: 'teacher', email: 'teacher@academiq.edu', password: 'teacher123', label: 'Teacher', icon: '🎓' },
  { role: 'student', email: 'student@academiq.edu', password: 'student123', label: 'Student', icon: '📖' },
  { role: 'worker',  email: 'worker@academiq.edu',  password: 'worker123',  label: 'Worker',  icon: '📁' },
]

const ROLE_DESCRIPTIONS = {
  admin:   'Full platform access — user management, analytics, accreditation tools',
  teacher: 'Student records, RAG chat, parent contact, predictions',
  student: 'Read-only view of your own academic record and risk status',
  worker:  'Document upload & download only (NBA / NAAC reports)',
}

export default function LoginPage() {
  const [email, setEmail]       = useState('admin@academiq.edu')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading]   = useState(false)
  const [activeDemo, setActiveDemo] = useState('admin')
  const { login }               = useAuth()
  const navigate                = useNavigate()

  const fillDemo = (cred) => {
    setActiveDemo(cred.role)
    setEmail(cred.email)
    setPassword(cred.password)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome, ${user.name}!`)
      // Use server's redirect hint, fallback to ROLE_HOME map
      navigate(user.redirect || ROLE_HOME[user.role] || '/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed — check credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 32, alignItems: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>

        {/* ── Left: branding ── */}
        <div style={{ flex: 1, display: 'none', flexDirection: 'column', gap: 24 }} className="login-branding">
          <div>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>AcademiQ</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 15, marginTop: 6, lineHeight: 1.6 }}>
              AI-Powered Unified Academic Intelligence<br />& Accreditation Management Platform
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['NBA document Q&A via RAG + Llama 3.1', 'AI pass/fail risk prediction', 'Parent contact with Twilio proxy', 'Role-based access for all stakeholders'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--green)' }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: login card ── */}
        <div className="login-card" style={{ maxWidth: 440, margin: '0 auto' }}>
          <div className="login-logo">
            <div className="login-logo-icon">🎓</div>
            <div className="login-title">AcademiQ</div>
            <div className="login-sub">Sign in to your account</div>
          </div>

          {/* Demo role selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
              Quick demo — click a role:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {DEMO_CREDS.map(cred => (
                <button
                  type="button"
                  key={cred.role}
                  onClick={() => fillDemo(cred)}
                  style={{
                    background: activeDemo === cred.role ? 'rgba(79,142,247,0.15)' : 'var(--surface)',
                    border: `1px solid ${activeDemo === cred.role ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    color: activeDemo === cred.role ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{cred.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{cred.label}</div>
                </button>
              ))}
            </div>

            {activeDemo && (
              <div style={{
                marginTop: 8, padding: '8px 12px',
                background: 'rgba(79,142,247,0.05)',
                border: '1px solid rgba(79,142,247,0.12)',
                borderRadius: 'var(--radius-md)',
                fontSize: 11, color: 'var(--text-secondary)',
              }}>
                {ROLE_DESCRIPTIONS[activeDemo]}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@academiq.edu"
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Signing in…</>
                : 'Sign In →'
              }
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            B.E. CSE · Dept. of Computer Science & Engineering<br />
            Z10 Batch · 2025–26 Final Year Project
          </div>
        </div>
      </div>
    </div>
  )
}
