import React, { useEffect, useState } from 'react'
import { authAPI, predictAPI } from '../api/client'
import toast from 'react-hot-toast'
import { RefreshCw, Database, Trash2, UserCheck } from 'lucide-react'

const VALID_ROLES = ['student', 'teacher', 'admin', 'worker']

const ROLE_BADGE = {
  admin:   'badge-danger',
  teacher: 'badge-info',
  student: 'badge-success',
  worker:  'badge-warning',
}

const ROLE_DESCRIPTIONS = {
  admin:   'Full platform access — manage users, all data, accreditation tools',
  teacher: 'Student records (read/write), RAG chat, contact parent, predictions',
  student: 'Read-only own academic record and AI risk score',
  worker:  'Document upload/download only — no student data or contact access',
}

export default function SettingsPage() {
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [training, setTraining] = useState(false)
  const [modelInfo, setModelInfo] = useState(null)
  const [newUser, setNewUser]   = useState({
    name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: ''
  })

  const fetchUsers = () => {
    authAPI.users()
      .then(r => { setUsers(r.data); setLoading(false) })
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
      toast.success(`${newUser.role} account created for ${newUser.name}!`)
      setNewUser({ name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: '' })
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user')
    }
  }

  const toggleActive = async (user) => {
    try {
      await authAPI.updateUser(user.id, { is_active: !user.is_active })
      toast.success(user.is_active ? 'Account deactivated' : 'Account reactivated')
      fetchUsers()
    } catch (err) { toast.error('Failed to update user') }
  }

  const changeRole = async (user, newRole) => {
    try {
      await authAPI.updateUser(user.id, { role: newRole })
      toast.success(`Role changed to ${newRole}`)
      fetchUsers()
    } catch (err) { toast.error('Failed to update role') }
  }

  const retrainModel = async () => {
    setTraining(true)
    try {
      const { data } = await predictAPI.train()
      toast.success(`Model retrained! RF accuracy: ${(data.metadata?.rf_accuracy * 100).toFixed(1)}%`)
      predictAPI.modelInfo().then(r => setModelInfo(r.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.error || 'Training failed')
    } finally { setTraining(false) }
  }

  const set = (k, v) => setNewUser(prev => ({ ...prev, [k]: v }))

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">⚙️ Admin Settings</h1>
        <p className="page-desc">User management (4 roles), AI model retraining, system configuration</p>
      </div>

      <div className="page-body">
        <div className="grid-2 mb-lg">
          {/* ── Create User ── */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 'var(--space-md)' }}>Create User Account</div>

            <form onSubmit={createUser}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input className="form-input" value={newUser.name} onChange={e => set('name', e.target.value)} placeholder="Dr. Full Name" required />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">User ID (optional)</label>
                  <input className="form-input" value={newUser.user_id} onChange={e => set('user_id', e.target.value)} placeholder="U005 (auto if blank)" />
                </div>
              </div>

              <div className="form-group mt-md">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={newUser.email} onChange={e => set('email', e.target.value)} placeholder="user@academiq.edu" required />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" value={newUser.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" required />
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={newUser.role} onChange={e => set('role', e.target.value)}>
                  {VALID_ROLES.map(r => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
                <div className="form-hint">{ROLE_DESCRIPTIONS[newUser.role]}</div>
              </div>

              {(newUser.role === 'student' || newUser.role === 'teacher') && (
                <div className="form-group">
                  <label className="form-label">
                    Linked ID
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      ({newUser.role === 'student' ? 'student_id e.g. STU001' : 'faculty_id e.g. FAC001'})
                    </span>
                  </label>
                  <input className="form-input" value={newUser.linked_id} onChange={e => set('linked_id', e.target.value)}
                    placeholder={newUser.role === 'student' ? 'STU001' : 'FAC001'} />
                  <div className="form-hint">Links this account to the corresponding academic record</div>
                </div>
              )}

              <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
                Create {newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} Account
              </button>
            </form>
          </div>

          {/* ── AI Model ── */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={16} color="var(--accent)" /> AI Model Management
            </div>
            {modelInfo && (
              <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div className="grid-2" style={{ gap: 12 }}>
                  {[
                    ['RF Accuracy',       `${((modelInfo.rf_accuracy || 0) * 100).toFixed(1)}%`],
                    ['XGB Accuracy',      modelInfo.xgb_accuracy ? `${(modelInfo.xgb_accuracy * 100).toFixed(1)}%` : 'N/A'],
                    ['Training Samples',  modelInfo.training_samples?.toLocaleString()],
                    ['Features',          modelInfo.features?.length],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-xs text-muted">{k}</div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }}
              onClick={retrainModel} disabled={training}>
              <RefreshCw size={15} style={{ animation: training ? 'spin 1s linear infinite' : 'none' }} />
              {training ? 'Training…' : 'Retrain Model on Current Data'}
            </button>
            <div className="alert alert-info mt-md" style={{ fontSize: 12 }}>
              Fetches all student records from the DB and retrains Random Forest + XGBoost. ~10 seconds.
            </div>

            {/* Role permission summary */}
            <div style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-md)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>🔐 Role Permissions</div>
              {VALID_ROLES.map(r => (
                <div key={r} style={{ marginBottom: 12 }}>
                  <span className={`badge ${ROLE_BADGE[r]}`} style={{ marginBottom: 4 }}>{r}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 4 }}>
                    {ROLE_DESCRIPTIONS[r]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Users table ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-md">
            <div style={{ fontWeight: 600, fontSize: 15 }}>System Users ({users.length})</div>
            <button className="btn btn-secondary btn-sm" onClick={fetchUsers} id="refresh-users-btn">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User ID</th><th>Name</th><th>Email</th><th>Role</th>
                    <th>Linked ID</th><th>Status</th><th>Created</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{u.user_id}</td>
                      <td style={{ fontWeight: 600 }}>{u.name}</td>
                      <td style={{ fontSize: 12 }}>{u.email}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={e => changeRole(u, e.target.value)}
                          className="form-select"
                          style={{ padding: '3px 8px', fontSize: 12, width: 'auto', minWidth: 90 }}
                        >
                          {VALID_ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                        {u.linked_id || '—'}
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleActive(u)}
                          title={u.is_active ? 'Deactivate' : 'Reactivate'}
                        >
                          <UserCheck size={13} />
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
