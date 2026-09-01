import React, { useEffect, useState, useMemo } from 'react'
import { assignmentsAPI, studentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Plus, FileText, Briefcase, Users, User, Layers, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const TYPE_META = {
  homework: { icon: FileText,  color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)',  label: 'Homework' },
  project:  { icon: Briefcase, color: '#7c5df7', bg: 'rgba(124,93,247,0.12)', label: 'Project'  },
}

const TARGET_META = {
  student: { icon: User,   label: 'Student' },
  section: { icon: Users,  label: 'Section' },
  batch:   { icon: Layers, label: 'Batch (Semester)' },
}

export default function AssignmentsPage() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [expandedId, setExpandedId]   = useState(null)
  const [expandedStudents, setExpandedStudents] = useState([])

  const isFaculty = user?.role === 'admin' || user?.role === 'teacher'

  const fetchAssignments = () => {
    setLoading(true)
    assignmentsAPI.list({ faculty_id: user?.linked_id || '' })
      .then(r => { setAssignments(r.data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }

  useEffect(() => { fetchAssignments() }, [])

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    try {
      const { data } = await assignmentsAPI.students(id)
      setExpandedStudents(data.students || [])
      setExpandedId(id)
    } catch { setExpandedStudents([]); setExpandedId(id) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this assignment?')) return
    try {
      await assignmentsAPI.delete(id)
      toast.success('Assignment deleted')
      fetchAssignments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const hw = assignments.filter(a => a.type === 'homework').length
    const pj = assignments.filter(a => a.type === 'project').length
    const upcoming = assignments.filter(a => a.due_date && new Date(a.due_date) > new Date()).length
    const overdue = assignments.filter(a => a.due_date && new Date(a.due_date) <= new Date()).length
    return { total: assignments.length, hw, pj, upcoming, overdue }
  }, [assignments])

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">📋 Assignments</h1>
            <p className="page-desc">{stats.total} assignment{stats.total !== 1 ? 's' : ''} created</p>
          </div>
          {isFaculty && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              <Plus size={16} /> Create Assignment
            </button>
          )}
        </div>

        {/* Stats cards */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {[
            { label: 'Homework',  value: stats.hw,       color: TYPE_META.homework.color, bg: TYPE_META.homework.bg },
            { label: 'Projects',  value: stats.pj,       color: TYPE_META.project.color,  bg: TYPE_META.project.bg },
            { label: 'Upcoming',  value: stats.upcoming,  color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
            { label: 'Past Due',  value: stats.overdue,   color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: '12px 16px', background: s.bg,
              border: `1px solid ${s.color}30`, borderRadius: 'var(--radius-md)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-body">
        {showForm && <CreateAssignmentForm onClose={() => { setShowForm(false); fetchAssignments() }} />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
          </div>
        ) : assignments.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 60,
            background: 'var(--bg-800)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <FileText size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No assignments yet</div>
            <div className="text-muted text-sm">Create your first homework or project assignment</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignments.map(a => {
              const typeMeta = TYPE_META[a.type] || TYPE_META.homework
              const targetMeta = TARGET_META[a.target_type] || TARGET_META.student
              const isOverdue = a.due_date && new Date(a.due_date) <= new Date()
              const isExpanded = expandedId === a.id
              const TypeIcon = typeMeta.icon
              const TargetIcon = targetMeta.icon

              return (
                <div key={a.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                    cursor: 'pointer',
                  }} onClick={() => toggleExpand(a.id)}>
                    {/* Type icon */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius-md)',
                      background: typeMeta.bg, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexShrink: 0,
                    }}>
                      <TypeIcon size={20} color={typeMeta.color} />
                    </div>

                    {/* Title & meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <TargetIcon size={12} /> {targetMeta.label}: {a.target_id}
                        </span>
                        <span>{a.student_count} student{a.student_count !== 1 ? 's' : ''}</span>
                        {a.due_date && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: isOverdue ? 'var(--red)' : 'var(--text-secondary)',
                          }}>
                            <Calendar size={12} />
                            {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {isOverdue && ' (overdue)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <span className={`badge`} style={{
                      background: typeMeta.bg, color: typeMeta.color,
                      border: `1px solid ${typeMeta.color}40`, fontSize: 11,
                    }}>
                      {typeMeta.label}
                    </span>

                    {isFaculty && (
                      <button className="btn btn-icon btn-secondary btn-sm"
                        onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                        title="Delete" style={{ padding: 6 }}>
                        <Trash2 size={14} />
                      </button>
                    )}

                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{
                      padding: '12px 20px 16px', borderTop: '1px solid var(--border)',
                      background: 'var(--bg-800)', animation: 'fadeSlideUp 0.2s ease',
                    }}>
                      {a.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                          {a.description}
                        </div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                        Assigned Students ({expandedStudents.length})
                      </div>
                      {expandedStudents.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {expandedStudents.map(s => (
                            <div key={s.student_id} style={{
                              background: 'var(--bg-900)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                              fontSize: 12,
                            }}>
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                                {s.student_id} · {s.section}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted text-sm">No student data available</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


// ── Create Assignment Form ───────────────────────────────────────────────────
function CreateAssignmentForm({ onClose }) {
  const [data, setData] = useState({
    type: 'homework',
    title: '',
    description: '',
    target_type: 'section',
    target_id: 'A',
    due_date: '',
  })
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([])

  // Load student IDs for the student target picker
  useEffect(() => {
    studentsAPI.list({}).then(r => setStudents(r.data)).catch(() => {})
  }, [])

  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    if (!data.title.trim()) { toast.error('Title is required'); return }
    setLoading(true)
    try {
      await assignmentsAPI.create(data)
      toast.success('Assignment created!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create')
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', marginBottom: 'var(--space-lg)',
      animation: 'fadeSlideUp 0.25s ease',
    }}>
      <div className="flex items-center justify-between mb-md">
        <div style={{ fontWeight: 600, fontSize: 16 }}>➕ New Assignment</div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
      </div>

      <form onSubmit={submit}>
        {/* Type toggle */}
        <div className="form-group" style={{ margin: '0 0 16px 0' }}>
          <label className="form-label">Assignment Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['homework', 'project'].map(t => {
              const meta = TYPE_META[t]
              const active = data.type === t
              return (
                <button key={t} type="button" onClick={() => set('type', t)} style={{
                  flex: 1, padding: '12px 16px', border: `2px solid ${active ? meta.color : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', background: active ? meta.bg : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.15s ease', color: active ? meta.color : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 500, fontSize: 13,
                }}>
                  <meta.icon size={18} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Title</label>
            <input type="text" className="form-input" value={data.title}
              onChange={e => set('title', e.target.value)} placeholder="e.g. Linear Algebra Problem Set 3" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Due Date</label>
            <input type="datetime-local" className="form-input" value={data.due_date}
              onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ margin: '0 0 12px 0' }}>
          <label className="form-label">Description (optional)</label>
          <textarea className="form-textarea" value={data.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Instructions, requirements, links…"
            style={{ minHeight: 80 }} />
        </div>

        {/* Target */}
        <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Assign To</label>
            <select className="form-select" value={data.target_type}
              onChange={e => {
                set('target_type', e.target.value)
                // Reset target_id to sensible default
                if (e.target.value === 'section') set('target_id', 'A')
                else if (e.target.value === 'batch') set('target_id', '3')
                else set('target_id', students[0]?.student_id || '')
              }}>
              <option value="section">Section (A / B / C)</option>
              <option value="batch">Batch (Semester)</option>
              <option value="student">Individual Student</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">
              {data.target_type === 'student' ? 'Student' :
               data.target_type === 'section' ? 'Section' : 'Semester'}
            </label>
            {data.target_type === 'section' ? (
              <select className="form-select" value={data.target_id}
                onChange={e => set('target_id', e.target.value)}>
                <option value="A">Section A (Sem 3)</option>
                <option value="B">Section B (Sem 5)</option>
                <option value="C">Section C (Sem 7)</option>
              </select>
            ) : data.target_type === 'batch' ? (
              <select className="form-select" value={data.target_id}
                onChange={e => set('target_id', e.target.value)}>
                {[1,2,3,4,5,6,7,8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            ) : (
              <select className="form-select" value={data.target_id}
                onChange={e => set('target_id', e.target.value)}>
                {students.map(s => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.name} ({s.student_id})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-sm">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Assignment'}
          </button>
        </div>
      </form>
    </div>
  )
}
