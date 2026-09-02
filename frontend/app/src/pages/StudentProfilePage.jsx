import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentsAPI, parentsAPI, contactAPI, predictAPI, placementsAPI } from '../api/client'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
         BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
         PieChart, Pie } from 'recharts'
import { ArrowLeft, Phone, MessageSquare, AlertTriangle, Briefcase,
         ShieldCheck, CheckCircle2, XCircle, ExternalLink, Clock, Lock, Unlock } from 'lucide-react'
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

export default function StudentProfilePage() {
  const { id }           = useParams()
  const navigate         = useNavigate()
  const [student, setStudent]   = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [parent, setParent]     = useState(null)
  const [placement, setPlacement] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [calling, setCalling]   = useState(false)
  const [smsMsg, setSmsMsg]     = useState('')
  const [showSms, setShowSms]   = useState(false)

  useEffect(() => {
    Promise.all([
      studentsAPI.get(id),
      studentsAPI.analytics(id),
      parentsAPI.get(id).catch(() => null),
      placementsAPI.getForStudent(id).catch(() => ({ data: null })),
    ]).then(([s, a, p, pl]) => {
      setStudent(s.data)
      setAnalytics(a.data)
      setParent(p?.data || null)
      if (pl?.data && pl.data.id) {
        setPlacement(pl.data)
      }
      // Run prediction
      predictAPI.student(s.data).then(r => setPrediction(r.data)).catch(() => {})
      setLoading(false)
    }).catch(() => { toast.error('Student not found'); navigate('/students') })
  }, [id])

  const handleVerifyPlacement = async () => {
    if (!placement?.id) return
    try {
      const { data } = await placementsAPI.verify(placement.id)
      setPlacement(data)
      toast.success('Placement record verified for NBA Criterion 4.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleUnverifyPlacement = async () => {
    if (!placement?.id) return
    try {
      const { data } = await placementsAPI.unverify(placement.id)
      setPlacement(data)
      toast.success('Placement verification reopened for student edits.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen')
    }
  }


  const handleCall = async () => {
    if (!parent) { toast.error('No parent contact on record'); return }
    if (!parent.consent_to_contact) { toast.error('Parent has not given contact consent'); return }
    setCalling(true)
    try {
      const { data } = await contactAPI.call(id)
      toast.success(data.status === 'mock'
        ? `📞 Mock call: ${data.message}`
        : 'Call initiated successfully!'
      )
    } catch (err) {
      toast.error(err.response?.data?.error || 'Call failed')
    } finally { setCalling(false) }
  }

  const handleSms = async () => {
    if (!smsMsg.trim()) { toast.error('Enter a message'); return }
    try {
      const { data } = await contactAPI.sms(id, smsMsg)
      toast.success(data.status === 'mock' ? `📱 Mock SMS: ${data.message}` : 'SMS sent!')
      setSmsMsg(''); setShowSms(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'SMS failed')
    }
  }

  // ── Derived data ───────────────────────────────────────────────────
  const courses = useMemo(() => student?.courses || [], [student])
  const sgpa = student?.sgpa || 0
  const totalCredits = useMemo(() => courses.reduce((s, c) => s + (c.credits || 4), 0), [courses])

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

  const cieVsSee = useMemo(() => courses.map(c => ({
    name: c.code || c.name?.substring(0, 8),
    CIE: c.cie_reduced || 0,
    SEE: c.see_reduced || 0,
  })), [courses])

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

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
  if (!student) return null

  const riskScore = prediction?.risk_score ?? 0
  const riskLevel = prediction?.risk_level ?? analytics?.overall_risk ?? 'none'
  const riskColor = riskLevel === 'High' ? 'var(--red)' : riskLevel === 'Medium' ? 'var(--amber)' : 'var(--green)'

  return (
    <div className="page-enter">
      <div className="page-header">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/students')} style={{ marginBottom: 12 }}>
          <ArrowLeft size={14} /> Back to Students
        </button>
        <div className="flex items-center justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--grad-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: 'white',
            }}>
              {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <h1 className="page-title">{student.name}</h1>
              <p className="page-desc">{student.student_id} · Section {student.section} · Semester {student.semester} · {student.email}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="badge badge-neutral" style={{ fontSize: 13, padding: '4px 10px' }}>
              SGPA: <strong>{sgpa.toFixed(2)}</strong>
            </span>
            {riskLevel !== 'none' && (
              <span className={`badge badge-${riskLevel === 'High' ? 'danger' : riskLevel === 'Medium' ? 'warning' : 'success'}`}>
                {riskLevel === 'High' && <AlertTriangle size={11} />} {riskLevel} Risk
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ── Summary Cards ───────────────────────────────────────────── */}
        <div className="grid-4 mb-lg" style={{ gap: 12 }}>
          <div className="card" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 4,
              background: sgpa >= 8 ? 'var(--green)' : sgpa >= 6 ? 'var(--amber)' : 'var(--red)',
            }} />
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4, marginTop: 8 }}>SGPA</div>
            <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: sgpa >= 8 ? 'var(--green)' : sgpa >= 6 ? 'var(--text-primary)' : 'var(--red)' }}>
              {sgpa.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>out of 10.0</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Attendance</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: student.attendance_pct < 75 ? 'var(--red)' : 'var(--text-primary)' }}>
              {student.attendance_pct?.toFixed(1)}%
            </div>
            {student.attendance_pct < 75 && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ Below 75%</div>}
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Credits</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>{totalCredits}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{courses.length} courses</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Result</div>
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
                      <td style={{...tdCenter, borderLeft: '2px solid var(--border)', fontWeight: 600}}>{c.cie_reduced}</td>
                      <td style={{...tdCenter, fontWeight: 600}}>{c.see_reduced}</td>
                      <td style={{
                        ...tdCenter, borderLeft: '2px solid var(--border)',
                        fontWeight: 700, fontSize: 15,
                        color: c.total >= 50 ? 'var(--text-primary)' : 'var(--red)',
                      }}>
                        {c.total}
                      </td>
                      <td style={tdCenter}>
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
              {courses.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-800)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700 }}>Semester Average</td>
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
                    <td colSpan={2} style={{ ...tdCenter, fontWeight: 700, fontSize: 16 }}>SGPA: {sgpa.toFixed(2)}</td>
                    <td style={{ ...tdCenter, fontWeight: 600 }}>{student.attendance_pct?.toFixed(1)}%</td>
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
          {/* CIE vs SEE */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>CIE vs SEE</div>
            {cieVsSee.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cieVsSee} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#8b9ab4', fontSize: 10 }} />
                  <YAxis domain={[0, 50]} tick={{ fill: '#8b9ab4', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-700)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Bar dataKey="CIE" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="SEE" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="skeleton" style={{ height: 200 }} />}
          </div>

          {/* AI Prediction */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>🤖 AI Risk Prediction</div>
            {prediction ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontSize: 48, fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                    {(riskScore * 100).toFixed(0)}%
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Fail Risk Score</div>
                  <div className={`badge badge-${riskLevel === 'High' ? 'danger' : riskLevel === 'Medium' ? 'warning' : 'success'}`} style={{ marginTop: 8 }}>
                    {prediction.prediction} · {riskLevel} Risk
                  </div>
                </div>
                <div className="risk-bar">
                  <div className="risk-fill" style={{ width: `${riskScore * 100}%`, background: riskColor }} />
                </div>
                {prediction.feature_importance && (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <div className="text-xs text-muted mb-sm" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Key Factors</div>
                    {Object.entries(prediction.feature_importance)
                      .sort(([,a],[,b]) => b - a).slice(0, 4)
                      .map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{k.replace(/_/g, ' ')}</span>
                          <span style={{ fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : <div className="skeleton" style={{ height: 180 }} />}
          </div>

          {/* Parent Contact */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>👪 Parent Contact</div>
            {parent ? (
              <div>
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{parent.parent_name}</div>
                  <div className="text-muted text-sm">{parent.relationship}</div>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    📱 {parent.primary_mobile}
                    {parent.alternate_mobile && <div>📱 {parent.alternate_mobile} (alt)</div>}
                  </div>
                  <div className="mt-sm">
                    <span className={`badge ${parent.consent_to_contact ? 'badge-success' : 'badge-danger'}`}>
                      {parent.consent_to_contact ? '✓ Consent given' : '✗ No consent'}
                    </span>
                    <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
                      Prefers {parent.preferred_contact_method}
                    </span>
                  </div>
                </div>

                {!parent.consent_to_contact && (
                  <div className="alert alert-warning" style={{ fontSize: 12, marginBottom: 12 }}>
                    ⚠️ Parent has not given contact consent. Calls and SMS are blocked.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-success btn-sm" onClick={handleCall} disabled={calling || !parent.consent_to_contact}>
                    <Phone size={14} /> {calling ? 'Calling…' : 'Call'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSms(!showSms)} disabled={!parent.consent_to_contact}>
                    <MessageSquare size={14} /> SMS
                  </button>
                </div>

                {showSms && (
                  <div style={{ marginTop: 12 }}>
                    <textarea className="form-textarea" value={smsMsg} onChange={e => setSmsMsg(e.target.value)}
                      placeholder="Type message to parent…" style={{ minHeight: 80, marginBottom: 8 }} />
                    <button className="btn btn-primary btn-sm" onClick={handleSms} disabled={!smsMsg.trim()}>Send SMS</button>
                  </div>
                )}

                <div className="alert alert-info mt-sm" style={{ fontSize: 11 }}>
                  📝 Numbers are masked. Calls use Twilio proxy when enabled.
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📵</div>
                <div>No parent record found</div>
              </div>
            )}
          </div>
        </div>

        {/* ── PLACEMENT & OFFER LETTER CARD (CRITERION 4) ────────────── */}
        <div className="card mb-lg" style={{ border: placement?.verified_by_admin ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(79,142,247,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>💼 Placement & Career Outcomes</h2>
                {placement?.verified_by_admin ? (
                  <span className="status-badge approved" style={{ fontSize: 11 }}>
                    <ShieldCheck size={13} /> Verified by Admin
                  </span>
                ) : placement?.status && placement.status !== 'not_placed' ? (
                  <span className="status-badge pending" style={{ fontSize: 11 }}>
                    <Clock size={13} /> Pending Verification
                  </span>
                ) : (
                  <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-muted)' }}>
                    No Submission
                  </span>
                )}
              </div>
              <p className="text-muted text-xs" style={{ marginTop: 2 }}>
                Student self-submitted career record and verified offer letter for NBA Criterion 4.5.
              </p>
            </div>

            {placement?.id && (
              <div style={{ display: 'flex', gap: 8 }}>
                {!placement.verified_by_admin ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleVerifyPlacement}
                  >
                    <CheckCircle2 size={14} /> Verify Placement
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleUnverifyPlacement}
                    title="Reopen to allow student to edit record"
                  >
                    <Unlock size={14} /> Reopen for Edits
                  </button>
                )}
              </div>
            )}
          </div>

          {placement?.id ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div>
                  <div className="text-muted text-xs">CAREER STATUS</div>
                  <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', color: 'var(--text-primary)', marginTop: 2 }}>
                    {placement.status?.replace('_', ' ')}
                  </div>
                </div>

                <div>
                  <div className="text-muted text-xs">COMPANY / INSTITUTION</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginTop: 2 }}>
                    {placement.company_or_institution || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-muted text-xs">ROLE / PROGRAM</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {placement.role_or_program || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-muted text-xs">CTC / STIPEND</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)', marginTop: 2 }}>
                    {placement.ctc_or_stipend || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-muted text-xs">ACADEMIC & COHORT YEAR</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {placement.academic_year} (Batch {placement.final_year_cohort_year})
                  </div>
                </div>

                <div>
                  <div className="text-muted text-xs">OFFER LETTER DOCUMENT</div>
                  {placement.offer_letter_path ? (
                    <a
                      href={`/api/v1/offer-letters/${placement.offer_letter_path}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginTop: 4, textDecoration: 'none' }}
                    >
                      <ExternalLink size={13} /> View Offer Letter
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not uploaded</span>
                  )}
                </div>
              </div>

              {placement.verified_by_admin && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={13} /> Verified by {placement.verified_by || 'Admin'} on {placement.verified_at ? new Date(placement.verified_at).toLocaleDateString() : 'N/A'}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: 13 }}>
              No placement or offer letter details submitted yet by student.
            </div>
          )}
        </div>

        {/* ── Grade Distribution + Risk Flags ─────────────────────────── */}
        <div className="grid-2 mb-lg">

          {/* Grade Distribution */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>Grade Distribution</div>
            {gradeDistribution.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={gradeDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3} stroke="none">
                      {gradeDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-700)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {gradeDistribution.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{g.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="skeleton" style={{ height: 180 }} />}
          </div>

          {/* Risk flags */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 'var(--space-md)' }}>⚠️ Risk Flags</div>
            {analytics?.risk_flags?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {analytics.risk_flags.map((flag, i) => (
                  <div key={i} className={`alert alert-${flag.severity === 'high' ? 'error' : flag.severity === 'medium' ? 'warning' : 'info'}`}>
                    {flag.message}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                No risk flags detected
              </div>
            )}
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
