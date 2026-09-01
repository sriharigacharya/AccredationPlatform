import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, predictAPI, parentsAPI, assignmentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
         BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
         PieChart, Pie } from 'recharts'
import { FileText, Briefcase, Calendar, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Grade helpers ─────────────────────────────────────────────────────────
const GRADE_TABLE = [
  { min: 90, grade: 'S', gp: 10, color: '#10b981' },
  { min: 80, grade: 'A', gp: 9,  color: '#34d399' },
  { min: 70, grade: 'B', gp: 8,  color: '#60a5fa' },
  { min: 60, grade: 'C', gp: 7,  color: '#818cf8' },
  { min: 55, grade: 'D', gp: 6,  color: '#f59e0b' },
  { min: 50, grade: 'E', gp: 5,  color: '#f97316' },
  { min: 0,  grade: 'F', gp: 0,  color: '#ef4444' },
]

function getGradeInfo(total) {
  for (const g of GRADE_TABLE) {
    if (total >= g.min) return g
  }
  return GRADE_TABLE[GRADE_TABLE.length - 1]
}

function getGradeColor(grade) {
  const entry = GRADE_TABLE.find(g => g.grade === grade)
  return entry?.color || '#6b7280'
}

/**
 * Student's own read-only academic record.
 * Fetches by linked_id from JWT (forwarded as X-Linked-Id by gateway).
 */
export default function MyRecordPage() {
  const { user }           = useAuth()
  const [student, setStudent] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [parent, setParent] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.linked_id) {
      setLoading(false)
      return
    }
    Promise.all([
      studentsAPI.get(user.linked_id),
      parentsAPI.get(user.linked_id).catch(() => null),
      assignmentsAPI.myList().catch(() => ({ data: [] })),
    ]).then(([s, p, a]) => {
      setStudent(s.data)
      setParent(p?.data || null)
      setAssignments(a?.data || [])
      return predictAPI.student(s.data)
    }).then(r => {
      setPrediction(r.data)
    }).catch(err => {
      toast.error('Could not load your record.')
    }).finally(() => setLoading(false))
  }, [user])

  // ── Derived data ───────────────────────────────────────────────────
  const courses = useMemo(() => student?.courses || [], [student])
  const sgpa = student?.sgpa || 0
  const totalCredits = useMemo(() => courses.reduce((s, c) => s + (c.credits || 4), 0), [courses])

  // Grade distribution for donut
  const gradeDistribution = useMemo(() => {
    const counts = {}
    courses.forEach(c => {
      const g = c.grade || 'F'
      counts[g] = (counts[g] || 0) + 1
    })
    return Object.entries(counts).map(([grade, count]) => ({
      name: grade, value: count, color: getGradeColor(grade),
    }))
  }, [courses])

  // CIE vs SEE comparison bar data
  const cieVsSee = useMemo(() => courses.map(c => ({
    name: c.code || c.name?.substring(0, 8),
    CIE: c.cie_reduced || 0,
    SEE: c.see_reduced || 0,
  })), [courses])

  // Radar data
  const radarData = useMemo(() => {
    if (!student) return []
    const avgCIE = courses.length > 0
      ? courses.reduce((s, c) => s + (c.cie_reduced || 0), 0) / courses.length : 0
    const avgSEE = courses.length > 0
      ? courses.reduce((s, c) => s + (c.see_reduced || 0), 0) / courses.length : 0
    return [
      { subject: 'Attendance', value: student.attendance_pct || 0 },
      { subject: 'CIE (/50)',  value: avgCIE },
      { subject: 'SEE (/50)',  value: avgSEE },
      { subject: 'SGPA × 5',  value: sgpa * 5 },
      { subject: 'Credits',   value: Math.min(totalCredits, 50) },
    ]
  }, [student, courses, sgpa, totalCredits])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  )

  if (!user?.linked_id) return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">My Academic Record</h1>
      </div>
      <div className="page-body">
        <div className="alert alert-warning">
          ⚠️ Your account has no linked student ID. Contact your administrator.
        </div>
      </div>
    </div>
  )

  if (!student) return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">My Academic Record</h1>
      </div>
      <div className="page-body">
        <div className="alert alert-error">Student record not found for ID: {user.linked_id}</div>
      </div>
    </div>
  )

  const riskScore = prediction?.risk_score ?? 0
  const riskLevel = prediction?.risk_level ?? 'Low'
  const riskColor = riskLevel === 'High' ? 'var(--red)' : riskLevel === 'Medium' ? 'var(--amber)' : 'var(--green)'

  return (
    <div className="page-enter">
      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'white',
            }}>
              {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h1 className="page-title">{student.name}</h1>
              <p className="page-desc">{student.student_id} · Section {student.section} · Semester {student.semester}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge badge-info">📖 Student View (Read-only)</span>
            {prediction && (
              <span className={`badge badge-${riskLevel === 'High' ? 'danger' : riskLevel === 'Medium' ? 'warning' : 'success'}`}>
                AI Risk: {riskLevel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Read-only notice */}
        <div className="alert alert-info mb-lg">
          ℹ️ This is a read-only view of your academic record. Contact your teacher or admin to update any information.
        </div>

        {/* ── SGPA + Summary Cards ────────────────────────────────────── */}
        <div className="grid-4 mb-lg" style={{ gap: 12 }}>
          {/* SGPA Card */}
          <div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: sgpa >= 8 ? 'var(--green)' : sgpa >= 6 ? 'var(--amber)' : 'var(--red)',
            }} />
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4, marginTop: 8 }}>
              SGPA
            </div>
            <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: sgpa >= 8 ? 'var(--green)' : sgpa >= 6 ? 'var(--text-primary)' : 'var(--red)' }}>
              {sgpa.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>out of 10.0</div>
          </div>

          {/* Attendance */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>
              Attendance
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: student.attendance_pct < 75 ? 'var(--red)' : 'var(--text-primary)' }}>
              {student.attendance_pct?.toFixed(1)}%
            </div>
            {student.attendance_pct < 75 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ Below 75% threshold</div>}
          </div>

          {/* Total Credits */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>
              Credits
            </div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{totalCredits}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{courses.length} courses</div>
          </div>

          {/* Result */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>
              Result
            </div>
            <div style={{
              fontSize: 28, fontWeight: 700,
              color: student.final_result === 'Pass' ? 'var(--green)' : student.final_result === 'Fail' ? 'var(--red)' : 'var(--text-secondary)',
            }}>
              {student.final_result || 'Pending'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {student.backlogs > 0 ? `${student.backlogs} backlog(s)` : 'No backlogs'}
            </div>
          </div>
        </div>

        {/* ── Course-wise Grade Table ────────────────────────────────── */}
        <div className="card mb-lg">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 Course-wise Evaluation Breakdown
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>Semester {student.semester}</span>
          </div>

          {/* Evaluation scheme legend */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12,
            background: 'var(--bg-800)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-secondary)',
          }}>
            <span>CIE 1 <strong>/25</strong></span>
            <span>CIE 2 <strong>/25</strong></span>
            <span>Quiz 1 <strong>/10</strong></span>
            <span>Quiz 2 <strong>/10</strong></span>
            <span>Exp. Learning <strong>/30</strong></span>
            <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>CIE Total <strong>/100 → /50</strong></span>
            <span>SEE <strong>/100 → /50</strong></span>
            <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>Grand Total <strong>/100</strong></span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>Course</th>
                  <th style={thStyleCenter}>CIE 1<br/><span style={subHead}>/25</span></th>
                  <th style={thStyleCenter}>CIE 2<br/><span style={subHead}>/25</span></th>
                  <th style={thStyleCenter}>Quiz 1<br/><span style={subHead}>/10</span></th>
                  <th style={thStyleCenter}>Quiz 2<br/><span style={subHead}>/10</span></th>
                  <th style={thStyleCenter}>EL<br/><span style={subHead}>/30</span></th>
                  <th style={{...thStyleCenter, borderLeft: '2px solid var(--border)'}}>CIE<br/><span style={subHead}>/50</span></th>
                  <th style={thStyleCenter}>SEE<br/><span style={subHead}>/50</span></th>
                  <th style={{...thStyleCenter, borderLeft: '2px solid var(--border)'}}>Total<br/><span style={subHead}>/100</span></th>
                  <th style={thStyleCenter}>Grade</th>
                  <th style={thStyleCenter}>GP</th>
                  <th style={thStyleCenter}>Att%</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => {
                  const gradeInfo = getGradeInfo(c.total || 0)
                  const attLow = (c.attendance_pct || 0) < 75
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.code} · {c.credits} credits</div>
                      </td>
                      <td style={tdCenter}>{c.cie1}</td>
                      <td style={tdCenter}>{c.cie2}</td>
                      <td style={tdCenter}>{c.quiz1}</td>
                      <td style={tdCenter}>{c.quiz2}</td>
                      <td style={tdCenter}>{c.el}</td>
                      <td style={{...tdCenter, borderLeft: '2px solid var(--border)', fontWeight: 600}}>
                        {c.cie_reduced}
                      </td>
                      <td style={{...tdCenter, fontWeight: 600}}>{c.see_reduced}</td>
                      <td style={{
                        ...tdCenter, borderLeft: '2px solid var(--border)',
                        fontWeight: 700, fontSize: 15,
                        color: c.total >= 50 ? 'var(--text-primary)' : 'var(--red)',
                      }}>
                        {c.total}
                      </td>
                      <td style={{ ...tdCenter }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                          fontSize: 12, fontWeight: 700,
                          background: gradeInfo.color + '22', color: gradeInfo.color,
                        }}>
                          {c.grade}
                        </span>
                      </td>
                      <td style={{ ...tdCenter, fontWeight: 600 }}>{c.grade_points}</td>
                      <td style={{ ...tdCenter, color: attLow ? 'var(--red)' : 'var(--text-secondary)' }}>
                        {c.attendance_pct?.toFixed(1)}%
                        {attLow && <span style={{ fontSize: 10 }}> ⚠</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              {courses.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-800)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                      Semester Average
                    </td>
                    <td colSpan={5} style={{ ...tdCenter, color: 'var(--text-muted)', fontSize: 11 }}>
                      CIE Raw Avg: {(courses.reduce((s, c) => s + (c.cie_raw || 0), 0) / courses.length).toFixed(1)}/100
                    </td>
                    <td style={{...tdCenter, borderLeft: '2px solid var(--border)', fontWeight: 700 }}>
                      {(courses.reduce((s, c) => s + (c.cie_reduced || 0), 0) / courses.length).toFixed(1)}
                    </td>
                    <td style={{...tdCenter, fontWeight: 700 }}>
                      {(courses.reduce((s, c) => s + (c.see_reduced || 0), 0) / courses.length).toFixed(1)}
                    </td>
                    <td style={{...tdCenter, borderLeft: '2px solid var(--border)', fontWeight: 700, fontSize: 16 }}>
                      {(courses.reduce((s, c) => s + (c.total || 0), 0) / courses.length).toFixed(1)}
                    </td>
                    <td colSpan={2} style={{ ...tdCenter, fontWeight: 700, fontSize: 16 }}>
                      SGPA: {sgpa.toFixed(2)}
                    </td>
                    <td style={{ ...tdCenter, fontWeight: 600 }}>
                      {student.attendance_pct?.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {courses.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
              No course evaluation data available for this semester.
            </div>
          )}
        </div>

        {/* ── Charts Row ─────────────────────────────────────────────── */}
        <div className="grid-3 mb-lg">
          {/* CIE vs SEE Bar Chart */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>CIE vs SEE Comparison</div>
            {cieVsSee.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cieVsSee} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#8b9ab4', fontSize: 10 }} />
                  <YAxis domain={[0, 50]} tick={{ fill: '#8b9ab4', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-700)', border: '1px solid var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="CIE" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="SEE" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="skeleton" style={{ height: 200 }} />}
          </div>

          {/* Performance Radar */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>Performance Overview</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#8b9ab4', fontSize: 11 }} />
                <Radar dataKey="value" fill="#4f8ef7" fillOpacity={0.2} stroke="#4f8ef7" strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Grade Distribution Donut */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>Grade Distribution</div>
            {gradeDistribution.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={gradeDistribution}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={70}
                      dataKey="value"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {gradeDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-700)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {gradeDistribution.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{g.value} course{g.value > 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="skeleton" style={{ height: 180 }} />}
          </div>
        </div>

        {/* ── AI Risk + Parent Row ────────────────────────────────────── */}
        <div className="grid-2 mb-lg">
          {/* AI Risk */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>🤖 AI Risk Assessment</div>
            {prediction ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 52, fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                  {(riskScore * 100).toFixed(0)}%
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Fail Risk Score</div>
                <div className={`badge badge-${riskLevel === 'High' ? 'danger' : riskLevel === 'Medium' ? 'warning' : 'success'}`}
                  style={{ marginTop: 12 }}>
                  {prediction.prediction} — {riskLevel} Risk
                </div>
                <div className="risk-bar" style={{ marginTop: 16 }}>
                  <div className="risk-fill" style={{ width: `${riskScore * 100}%`, background: riskColor }} />
                </div>
                {riskLevel === 'High' && (
                  <div className="alert alert-error mt-md" style={{ fontSize: 12, textAlign: 'left' }}>
                    ⚠️ Your risk score is high. Please speak to your teacher immediately.
                  </div>
                )}
              </div>
            ) : <div className="skeleton" style={{ height: 160 }} />}
          </div>

          {/* Parent contact on file */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>👪 Parent Contact on File</div>
            {parent ? (
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{parent.parent_name}</div>
                <div className="text-muted">{parent.relationship}</div>
                <div style={{ marginTop: 10 }}>
                  {/* Mask number for student view */}
                  <div>📱 {parent.primary_mobile?.replace(/\d(?=\d{4})/g, '*')}</div>
                </div>
                <div className="mt-md">
                  <span className={`badge ${parent.consent_to_contact ? 'badge-success' : 'badge-neutral'}`}>
                    {parent.consent_to_contact ? '✓ Contact consent given' : 'No contact consent'}
                  </span>
                </div>
                <div className="alert alert-info mt-md" style={{ fontSize: 11 }}>
                  Number is masked for privacy. Your teacher or admin can initiate contact.
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📵</div>
                No parent contact on file
              </div>
            )}
          </div>
        </div>

        {/* ── My Assignments & Projects Widget ────────────────────────── */}
        <div className="card mb-lg">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              📝 My Assignments & Projects
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>{assignments.length} assigned</span>
            </div>
          </div>

          {assignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={32} color="#34d399" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
              <div style={{ fontWeight: 600 }}>All caught up!</div>
              <div style={{ fontSize: 12 }}>No pending homework or projects assigned to you.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {assignments.map(a => {
                const isProject = a.type === 'project'
                const isOverdue = a.due_date && new Date(a.due_date) < new Date()
                const badgeBg = isProject ? 'rgba(124,93,247,0.15)' : 'rgba(79,142,247,0.15)'
                const badgeColor = isProject ? '#a78bfa' : '#60a5fa'

                return (
                  <div key={a.id} style={{
                    background: 'var(--bg-800)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 4,
                          fontSize: 11, fontWeight: 700,
                          background: badgeBg, color: badgeColor,
                          textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                          {isProject ? <Briefcase size={12} /> : <FileText size={12} />}
                          {a.type}
                        </span>
                        {a.due_date && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-muted)',
                            fontWeight: isOverdue ? 700 : 500,
                          }}>
                            {isOverdue ? <Clock size={12} /> : <Calendar size={12} />}
                            {new Date(a.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            {isOverdue && ' (Past due)'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {a.title}
                      </div>
                      {a.description && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)',
                          lineHeight: 1.4, marginBottom: 8,
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          {a.description}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8, marginTop: 6 }}>
                      Assigned by: <strong>{a.faculty_id}</strong>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Evaluation Scheme Info ──────────────────────────────────── */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>📋 Evaluation Scheme</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={schemeCard}>
              <div style={schemeLabel}>Continuous Internal Evaluation (CIE)</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                CIE 1: 25 marks<br/>
                CIE 2: 25 marks<br/>
                Quiz 1: 10 marks<br/>
                Quiz 2: 10 marks<br/>
                Experiential Learning: 30 marks<br/>
                <strong style={{ color: 'var(--text-primary)' }}>Total: 100 → Reduced to 50</strong>
              </div>
            </div>
            <div style={schemeCard}>
              <div style={schemeLabel}>Semester End Examination (SEE)</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Final Exam: 100 marks<br/>
                <strong style={{ color: 'var(--text-primary)' }}>Reduced to 50</strong>
              </div>
            </div>
            <div style={schemeCard}>
              <div style={schemeLabel}>Grade Scale</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {GRADE_TABLE.map(g => (
                  <span key={g.grade} style={{ display: 'inline-block', marginRight: 12 }}>
                    <span style={{ fontWeight: 700, color: g.color }}>{g.grade}</span> ≥{g.min}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Table styles ─────────────────────────────────────────────────────────
const thStyle = {
  textAlign: 'left', padding: '8px 12px', fontSize: 11,
  textTransform: 'uppercase', letterSpacing: '0.5px',
  color: 'var(--text-muted)', fontWeight: 600,
}
const thStyleCenter = { ...thStyle, textAlign: 'center' }
const subHead = { fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', opacity: 0.7 }
const tdCenter = { textAlign: 'center', padding: '10px 8px' }
const schemeCard = {
  background: 'var(--bg-800)', borderRadius: 'var(--radius-md)',
  padding: 'var(--space-md)', border: '1px solid var(--border)',
}
const schemeLabel = {
  fontSize: 12, fontWeight: 600, marginBottom: 8,
  textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)',
}
