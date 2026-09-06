import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, ROLE_HOME } from '../context/AuthContext'
import { Shield, GraduationCap, BookOpen, Folder, ArrowRight, CheckCircle2, Lock, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

// Demo credentials with clean Lucide icons
const DEMO_CREDS = [
  { role: 'admin',   email: 'admin@academiq.edu',   password: 'admin123',   label: 'Admin',   icon: Shield },
  { role: 'teacher', email: 'teacher@academiq.edu', password: 'teacher123', label: 'Faculty', icon: GraduationCap },
  { role: 'student', email: 'student@academiq.edu', password: 'student123', label: 'Student', icon: BookOpen },
  { role: 'worker',  email: 'worker@academiq.edu',  password: 'worker123',  label: 'Staff',   icon: Folder },
]

const ROLE_DESCRIPTIONS = {
  admin:   'Full institutional administrative control, user provisioning, predictive models & accreditation compilation.',
  teacher: 'Course section records, attendance roll-call, continuous marks entry, RAG query & at-risk student monitoring.',
  student: 'Personal academic progress, attendance compliance, placement reporting & co-curricular achievement queue.',
  worker:  'Document management, accreditation evidence upload & historical batch enrollment ingestion.',
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
    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.name}!`)
      navigate(user.redirect || ROLE_HOME[user.role] || '/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6) var(--space-4)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 1020,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-10)',
        alignItems: 'center',
      }} className="login-grid-responsive">

        {/* ── Left Column: Institutional Branding ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div>
            <div style={{
              width: 44,
              height: 44,
              backgroundColor: 'var(--primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              marginBottom: 'var(--space-4)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}>
              AcademiQ
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              AI-Powered Unified Academic Intelligence, Accreditation Automation & Predictive Analytics Suite.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              'Automated NBA Tier-II GAPC V4.0 SAR Compilation & Live Preview',
              'Real-Time Random Forest & XGBoost Academic Risk Early Warning',
              'DPDP Act 2023 Compliant Privacy-First Parent Communication Bridge',
              'BGE-M3 Vector Embedding & Llama 3.1 RAG Document Intelligence',
            ].map((feature, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckCircle2 size={16} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {feature}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            padding: '12px 14px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-primary)' }}>Institutional Deployment:</strong> Department of Computer Science & Engineering · Academic Batch 2025–26.
          </div>
        </div>

        {/* ── Right Column: Sign In Card ── */}
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Sign In to Portal
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Enter your credentials to access your authorized role.
            </p>
          </div>

          {/* Quick Demo Role Selector */}
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}>
              Instant Demo Role Switcher
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {DEMO_CREDS.map(cred => {
                const Icon = cred.icon
                const isSelected = activeDemo === cred.role
                return (
                  <button
                    type="button"
                    key={cred.role}
                    onClick={() => fillDemo(cred)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 4px',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={16} />
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{cred.label}</span>
                  </button>
                )
              })}
            </div>

            {activeDemo && (
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: 1.45,
              }}>
                {ROLE_DESCRIPTIONS[activeDemo]}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">Institutional Email</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@academiq.edu"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary w-full"
              style={{ padding: '10px 16px', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  <span>Verifying credentials…</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <div style={{
            marginTop: 'var(--space-6)',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 'var(--space-4)',
          }}>
            AcademiQ Enterprise · B.E. CSE Final Year Mini-Project · Z10 Batch
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 820px) {
          .login-grid-responsive {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
        }
      `}</style>
    </div>
  )
}
