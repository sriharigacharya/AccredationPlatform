import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, predictAPI } from '../api/client'
import { Search, Plus, ChevronRight, AlertTriangle, Users, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RISK_COLOR = { High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-success', none: 'badge-neutral' }

const SECTION_META = {
  A: { label: 'Section A', sem: 'Sem 3', color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
  B: { label: 'Section B', sem: 'Sem 5', color: '#7c5df7', bg: 'rgba(124,93,247,0.12)' },
  C: { label: 'Section C', sem: 'Sem 7', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
}

export default function StudentsPage() {
  const [students, setStudents]     = useState([])
  const [risks, setRisks]           = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [semFilter, setSemFilter]   = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [showForm, setShowForm]     = useState(false)
  const navigate = useNavigate()

  const fetchStudents = () => {
    setLoading(true)
    studentsAPI.list({
      search:   search   || undefined,
      semester: semFilter || undefined,
      section:  sectionFilter || undefined,
    })
      .then(r => { setStudents(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchStudents() }, [search, semFilter, sectionFilter])

  // Batch risk predictions whenever student list changes
  useEffect(() => {
    if (!students.length) return
    predictAPI.batch(students).then(r => {
      const m = {}
      r.data.predictions.forEach(p => { m[p.student_id] = p })
      setRisks(m)
    }).catch(() => {})
  }, [students])

  // Section summary counts — computed from ALL students regardless of current filter
  const [allStudents, setAllStudents] = useState([])
  useEffect(() => {
    studentsAPI.list({}).then(r => setAllStudents(r.data)).catch(() => {})
  }, [])

  const sectionSummary = useMemo(() => {
    const counts = { A: { total: 0, pass: 0, fail: 0 }, B: { total: 0, pass: 0, fail: 0 }, C: { total: 0, pass: 0, fail: 0 } }
    allStudents.forEach(s => {
      const sec = s.section
      if (!counts[sec]) return
      counts[sec].total++
      if (s.final_result === 'Pass') counts[sec].pass++
      else if (s.final_result === 'Fail') counts[sec].fail++
    })
    return counts
  }, [allStudents])

  const highRiskCount = Object.values(risks).filter(r => r.risk_level === 'High').length

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">👥 Students</h1>
            <p className="page-desc">
              {students.length} students shown
              {highRiskCount > 0 && <> · <span style={{ color: 'var(--red)', fontWeight: 600 }}>{highRiskCount} high risk</span></>}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Student
          </button>
        </div>

        {/* ── Section summary cards ── */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {Object.entries(SECTION_META).map(([sec, meta]) => {
            const s = sectionSummary[sec]
            const isActive = sectionFilter === sec
            return (
              <button
                key={sec}
                onClick={() => setSectionFilter(isActive ? '' : sec)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: isActive ? meta.bg : 'var(--bg-800)',
                  border: `1.5px solid ${isActive ? meta.color : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{meta.sem}</span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{s?.total ?? 0}</span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <div style={{ color: '#34d399' }}>✓ {s?.pass ?? 0} passed</div>
                    <div style={{ color: '#f87171' }}>✗ {s?.fail ?? 0} failed</div>
                  </div>
                </div>
              </button>
            )
          })}

          {/* All sections / clear */}
          <button
            onClick={() => { setSectionFilter(''); setSemFilter('') }}
            style={{
              padding: '12px 16px',
              background: (!sectionFilter && !semFilter) ? 'rgba(255,255,255,0.06)' : 'var(--bg-800)',
              border: `1.5px solid ${(!sectionFilter && !semFilter) ? 'rgba(255,255,255,0.2)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minWidth: 80,
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={18} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>All</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{allStudents.length}</span>
          </button>
        </div>

        {/* ── Search + semester filter ── */}
        <div className="header-actions" style={{ marginTop: 12 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <Search size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
            />
          </div>
          <select
            className="form-select"
            style={{ width: 150 }}
            value={semFilter}
            onChange={e => setSemFilter(e.target.value)}
          >
            <option value="">All Semesters</option>
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          {(sectionFilter || semFilter || search) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSectionFilter(''); setSemFilter(''); setSearch('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Filter size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {showForm && <AddStudentForm onClose={() => { setShowForm(false); fetchStudents() }} />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
          </div>
        ) : students.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: 60,
            background: 'var(--bg-800)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}>
            <Users size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No students found</div>
            <div className="text-muted text-sm">Try adjusting your search or filters</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Section</th>
                  <th>Sem</th>
                  <th>Attendance</th>
                  <th>SGPA</th>
                  <th>GPA</th>
                  <th>Backlogs</th>
                  <th>Engagement</th>
                  <th>Result</th>
                  <th>AI Risk</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const risk = risks[s.student_id]
                  const secMeta = SECTION_META[s.section]
                  return (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/students/${s.student_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div className="text-xs text-muted">{s.student_id}</div>
                      </td>
                      <td>
                        {secMeta ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background: secMeta.bg,
                            color: secMeta.color,
                            border: `1px solid ${secMeta.color}40`,
                          }}>
                            {s.section}
                          </span>
                        ) : (s.section || '—')}
                      </td>
                      <td>Sem {s.semester}</td>
                      <td>
                        <span className={
                          s.attendance_pct < 60 ? 'risk-high' :
                          s.attendance_pct < 75 ? 'risk-medium' : 'risk-low'
                        }>
                          {s.attendance_pct?.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          color: (s.sgpa || 0) >= 8 ? '#34d399' : (s.sgpa || 0) >= 6 ? 'var(--text-primary)' : '#f87171',
                        }}>
                          {(s.sgpa || s.previous_gpa || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>{s.previous_gpa}</td>
                      <td>{s.backlogs > 0 ? <span className="risk-high">{s.backlogs}</span> : '0'}</td>
                      <td>
                        <span className={`badge ${
                          s.engagement === 'High' ? 'badge-success' :
                          s.engagement === 'Medium' ? 'badge-info' : 'badge-danger'
                        }`}>
                          {s.engagement}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          s.final_result === 'Pass' ? 'badge-success' :
                          s.final_result === 'Fail' ? 'badge-danger' : 'badge-neutral'
                        }`}>
                          {s.final_result || '—'}
                        </span>
                      </td>
                      <td>
                        {risk ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {risk.risk_level === 'High' && <AlertTriangle size={12} color="var(--red)" />}
                            <span className={`badge ${RISK_COLOR[risk.risk_level]}`}>
                              {(risk.risk_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <div className="skeleton" style={{ width: 50, height: 20 }} />
                        )}
                      </td>
                      <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AddStudentForm({ onClose }) {
  const [data, setData] = useState({
    student_id: '', name: '', email: '', phone: '',
    section: 'A', semester: 3,
    attendance_pct: 75, internal_marks: 60,
    assignment_score_pct: 70, previous_gpa: 7.0, backlogs: 0,
    course_performance_pct: 68, engagement: 'Medium',
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await studentsAPI.create(data)
      toast.success('Student added!')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add student')
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
        <div style={{ fontWeight: 600, fontSize: 16 }}>➕ Add New Student</div>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
      </div>
      <form onSubmit={submit}>
        <div className="grid-3" style={{ gap: 12 }}>
          {[
            ['student_id', 'Student ID',  'text',  'STU101'],
            ['name',       'Full Name',   'text',  'Jane Doe'],
            ['email',      'Email',       'email', 'jane@student.edu'],
            ['phone',      'Phone',       'text',  '9876543210'],
          ].map(([k, label, type, ph]) => (
            <div key={k} className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{label}</label>
              <input type={type} className="form-input" value={data[k]}
                onChange={e => set(k, e.target.value)} placeholder={ph} />
            </div>
          ))}

          {/* Section + Semester side by side */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Section</label>
            <select className="form-select" value={data.section} onChange={e => set('section', e.target.value)}>
              <option value="A">A (Sem 3)</option>
              <option value="B">B (Sem 5)</option>
              <option value="C">C (Sem 7)</option>
            </select>
          </div>

          {[
            ['semester',              'Semester',     1,   8,   1],
            ['attendance_pct',        'Attendance %', 0,   100, 0.1],
            ['internal_marks',        'Internal Marks',0,  100, 1],
            ['assignment_score_pct',  'Assignment %', 0,   100, 0.1],
            ['previous_gpa',          'Previous GPA', 0,   10,  0.1],
            ['backlogs',              'Backlogs',     0,   10,  1],
            ['course_performance_pct','Course Perf %',0,   100, 0.1],
          ].map(([k, label, min, max, step]) => (
            <div key={k} className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{label}</label>
              <input type="number" className="form-input" value={data[k]}
                min={min} max={max} step={step}
                onChange={e => set(k, parseFloat(e.target.value))} />
            </div>
          ))}

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Engagement</label>
            <select className="form-select" value={data.engagement} onChange={e => set('engagement', e.target.value)}>
              {['Low', 'Medium', 'High'].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-sm mt-md">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Add Student'}
          </button>
        </div>
      </form>
    </div>
  )
}

