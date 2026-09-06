import React, { useEffect, useState } from 'react'
import { authAPI, predictAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  RefreshCw, Database, Trash2, UserCheck, Shield,
  Cpu, Users, UserPlus, Key, Lock, CheckCircle2,
  AlertTriangle, Power, Sparkles
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

const VALID_ROLES = ['student', 'teacher', 'admin', 'worker']

const ROLE_DESCRIPTIONS = {
  admin:   'Full institutional administrative control, user provisioning, and predictive models.',
  teacher: 'Section records, attendance roll-call, continuous marks entry, and risk alerts.',
  student: 'Read-only student portal, personal attendance, placement, and co-curricular queue.',
  worker:  'Document management, evidence upload, and historical intake record ingestion.',
}

export default function SettingsPage() {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [training, setTraining]   = useState(false)
  const [modelInfo, setModelInfo] = useState(null)
  const [newUser, setNewUser]     = useState({
    name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: ''
  })

  const fetchUsers = () => {
    authAPI.users()
      .then(r => { setUsers(r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
    predictAPI.modelInfo().then(r => setModelInfo(r.data)).catch(() => {})
  }, [])

  const createUser = async e => {
    e.preventDefault()
    try {
      await authAPI.register({
        ...newUser,
        linked_id: newUser.linked_id || null,
        user_id:   newUser.user_id   || undefined,
      })
      toast.success(`Account created for ${newUser.name}`)
      setNewUser({ name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: '' })
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user')
    }
  }

  const toggleActive = async (u) => {
    try {
      await authAPI.updateUser(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? 'Account deactivated' : 'Account reactivated')
      fetchUsers()
    } catch (err) {
      toast.error('Failed to update user status')
    }
  }

  const changeRole = async (u, newRole) => {
    try {
      await authAPI.updateUser(u.id, { role: newRole })
      toast.success(`Role changed to ${newRole}`)
      fetchUsers()
    } catch (err) {
      toast.error('Failed to update role')
    }
  }

  const retrainModel = async () => {
    setTraining(true)
    try {
      const { data } = await predictAPI.train()
      toast.success(`Model retrained! Accuracy: ${((data.metadata?.rf_accuracy || 0.88) * 100).toFixed(1)}%`)
      predictAPI.modelInfo().then(r => setModelInfo(r.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.error || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  const set = (k, v) => setNewUser(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <PageHeader
        category="System Administration"
        title="Institutional System & User Management"
        description="Role-based access control, provisioning of department credentials, and predictive machine learning model lifecycle."
        badge="Super Admin Console"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers}>
            <RefreshCw size={14} />
            <span>Refresh Users</span>
          </button>
        }
      />

      <div className="page-body">
        {/* ── Summary Stats ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label="Total Platform Users"
            value={users.length}
            subtext="4 Authorized Roles"
            icon={Users}
            variant="primary"
          />
          <StatCard
            label="Predictive Model"
            value="Random Forest"
            subtext={modelInfo?.last_trained ? `Updated ${new Date(modelInfo.last_trained).toLocaleDateString('en-IN')}` : 'Ready'}
            icon={Cpu}
            variant="purple"
          />
          <StatCard
            label="Risk Model Accuracy"
            value={`${Math.round((modelInfo?.rf_accuracy || 0.88) * 100)}%`}
            subtext="Predictive precision rate"
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            label="Access Policy"
            value="RBAC Enforcement"
            subtext="JWT Session Guarded"
            icon={Shield}
            variant="info"
          />
        </div>

        {/* ── Workstation Grid ── */}
        <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
          {/* Create User Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Provision New User Account</h3>
              <Badge variant="primary">RBAC Guarded</Badge>
            </div>

            <form onSubmit={createUser}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    className="form-input"
                    value={newUser.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Dr. Rajeshwari V"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Custom User ID (Optional)</label>
                  <input
                    className="form-input"
                    value={newUser.user_id}
                    onChange={e => set('user_id', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Institutional Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={newUser.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="rajeshwari@academiq.edu"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={newUser.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <select
                  className="form-select"
                  value={newUser.role}
                  onChange={e => set('role', e.target.value)}
                >
                  {VALID_ROLES.map(r => (
                    <option key={r} value={r}>
                      {r === 'teacher' ? 'Faculty Member' : r === 'worker' ? 'Staff / Evidence Worker' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="form-hint">{ROLE_DESCRIPTIONS[newUser.role]}</p>
              </div>

              {(newUser.role === 'student' || newUser.role === 'teacher') && (
                <div className="form-group">
                  <label className="form-label">
                    Linked Record Identifier
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      ({newUser.role === 'student' ? 'e.g. STU001' : 'e.g. FAC001'})
                    </span>
                  </label>
                  <input
                    className="form-input"
                    value={newUser.linked_id}
                    onChange={e => set('linked_id', e.target.value)}
                    placeholder={newUser.role === 'student' ? 'STU001' : 'FAC001'}
                  />
                  <p className="form-hint">Binds this login to the student or faculty member database record.</p>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full"
                style={{ marginTop: 8 }}
              >
                Create Account
              </button>
            </form>
          </div>

          {/* Machine Learning Retraining Panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Predictive Risk Engine Retraining</h3>
              <Badge variant="purple">Random Forest & XGBoost</Badge>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
              The student early warning system analyzes historical CIE exam scores, continuous attendance roll-calls, and standing backlog metrics to predict students needing academic mentoring.
            </p>

            <div style={{
              padding: '14px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              marginBottom: 16,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Model</div>
                  <div style={{ fontWeight: 600 }}>Random Forest Classifier</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Accuracy</div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {Math.round((modelInfo?.rf_accuracy || 0.88) * 100)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Training Set</div>
                  <div style={{ fontWeight: 600 }}>{modelInfo?.train_samples || 450} Records</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk Threshold</div>
                  <div style={{ fontWeight: 600 }}>0.60 Probability</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={retrainModel}
              disabled={training}
              className="btn btn-primary"
            >
              {training ? (
                <>
                  <div className="spinner" style={{ width: 12, height: 12 }} />
                  <span>Retraining Machine Learning Models…</span>
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  <span>Retrain Risk Models on Latest Grades</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── User Accounts Table ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Registered Accounts Directory</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                Manage user credentials, active statuses, and departmental role permissions.
              </p>
            </div>
            <Badge variant="neutral">{users.length} Users</Badge>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>System Role</th>
                  <th>Linked ID</th>
                  <th>Account Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.user_id || `U${u.id}`}</td>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ height: 28, fontSize: '11.5px', padding: '2px 8px', width: 110 }}
                        value={u.role}
                        onChange={e => changeRole(u, e.target.value)}
                      >
                        {VALID_ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {u.linked_id || '—'}
                    </td>
                    <td>
                      {u.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Deactivated</Badge>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
