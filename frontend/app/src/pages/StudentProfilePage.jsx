import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { studentsAPI, parentsAPI, contactAPI, predictAPI, placementsAPI, reportsAPI } from '../api/client'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie
} from 'recharts'
import {
  ArrowLeft, Phone, MessageSquare, AlertTriangle, Briefcase,
  ShieldCheck, CheckCircle2, XCircle, ExternalLink, Clock,
  Lock, Unlock, Award, BookOpen, User, Check, Download, FileText,
  Edit3, PhoneCall, PhoneOff, Brain, TrendingUp, Info
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Modal from '../components/Modal'

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
  if (typeof grade === 'string' && grade.startsWith('CIE')) {
    const match = grade.match(/\((\d+(\.\d+)?)/)
    if (match) {
      return getGradeInfo(parseFloat(match[1])).color
    }
  }
  const entry = GRADE_TABLE.find(g => g.grade === grade)
  return entry?.color || '#94a3b8'
}

export default function StudentProfilePage() {
  const { id }                     = useParams()
  const navigate                   = useNavigate()
  const [student, setStudent]       = useState(null)
  const [analytics, setAnalytics]   = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [parent, setParent]         = useState(null)
  const [placement, setPlacement]   = useState(null)
  const [loading, setLoading]       = useState(true)
  const [calling, setCalling]       = useState(false)
  const [smsMsg, setSmsMsg]         = useState('')
  const [showSms, setShowSms]       = useState(false)
  const [showEditParent, setShowEditParent] = useState(false)
  const [parentForm, setParentForm] = useState({
    parent_name: '',
    relationship: 'Father',
    primary_mobile: '',
    alternate_mobile: '',
    consent_to_contact: true,
  })
  const [savingParent, setSavingParent] = useState(false)
  const [activeCall, setActiveCall]     = useState(null)
  const [callDuration, setCallDuration] = useState(0)

  useEffect(() => {
    let timer
    if (activeCall) {
      timer = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [activeCall])

  useEffect(() => {
    // 1. Fetch core student profile
    studentsAPI.get(id)
      .then((sRes) => {
        const sData = sRes.data
        setStudent(sData)
        const canonicalId = sData.student_id || id

        // 2. Fetch auxiliary records in parallel; protect against auxiliary 404s/network errors
        Promise.allSettled([
          studentsAPI.analytics(canonicalId),
          parentsAPI.get(canonicalId),
          placementsAPI.getForStudent(canonicalId),
          predictAPI.student(sData),
        ]).then(([aRes, pRes, plRes, predRes]) => {
          if (aRes.status === 'fulfilled' && aRes.value?.data) {
            setAnalytics(aRes.value.data)
          }
          if (pRes.status === 'fulfilled' && pRes.value?.data) {
            setParent(pRes.value.data)
          }
          if (plRes.status === 'fulfilled' && plRes.value?.data?.id) {
            setPlacement(plRes.value.data)
          }
          if (predRes.status === 'fulfilled' && predRes.value?.data) {
            setPrediction(predRes.value.data)
          }
          setLoading(false)
        })
      })
      .catch((err) => {
        console.error('Failed to load student profile:', err)
        toast.error('Student record not found')
        navigate('/students')
      })
  }, [id, navigate])

  const handleVerifyPlacement = async () => {
    if (!placement?.id) return
    try {
      const { data } = await placementsAPI.verify(placement.id)
      setPlacement({ ...data, is_verified: true, verified_by_admin: true })
      toast.success('Placement verified for NBA Criterion 4.5')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleUnverifyPlacement = async () => {
    if (!placement?.id) return
    try {
      const { data } = await placementsAPI.unverify(placement.id)
      setPlacement({ ...data, is_verified: false, verified_by_admin: false })
      toast.success('Placement unlocked for student revisions')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen')
    }
  }

  const handleViewOfferLetter = async (filename) => {
    if (!filename) {
      toast.error('No offer letter document attached')
      return
    }
    const t = toast.loading('Retrieving offer letter proof document…')
    try {
      const res = await placementsAPI.downloadOfferLetter(filename)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.dismiss(t)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not open proof document', { id: t })
    }
  }

  const handleOpenEditParent = () => {
    setParentForm({
      parent_name: parent?.parent_name || '',
      relationship: parent?.relationship || 'Father',
      primary_mobile: parent?.primary_mobile || '',
      alternate_mobile: parent?.alternate_mobile || '',
      consent_to_contact: parent?.consent_to_contact ?? true,
    })
    setShowEditParent(true)
  }

  const handleSaveParent = async (e) => {
    if (e) e.preventDefault()
    if (!parentForm.parent_name.trim() || !parentForm.primary_mobile.trim()) {
      toast.error('Parent name and primary mobile number are required')
      return
    }
    setSavingParent(true)
    try {
      const stuId = student?.student_id || id
      const { data } = await parentsAPI.upsert({
        student_id: stuId,
        ...parentForm,
      })
      setParent(data)
      toast.success('Parent contact details updated successfully!')
      setShowEditParent(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update parent contact')
    } finally {
      setSavingParent(false)
    }
  }

  const handleCall = async () => {
    if (!parent) { toast.error('No parent record found'); return }
    if (!parent.consent_to_contact) { toast.error('Parent contact consent has not been provided'); return }
    setCalling(true)
    try {
      const stuId = student?.student_id || id
      const { data } = await contactAPI.call(stuId)
      setActiveCall({
        studentName: student?.name,
        parentName: parent.parent_name,
        relationship: parent.relationship,
        phone: parent.primary_mobile,
        status: data.status === 'mock' ? 'connected' : 'ringing',
        message: data.message || '',
      })
      setCallDuration(0)
      toast.success(data.status === 'mock'
        ? `Demo proxy call initiated to ${parent.parent_name}`
        : 'Encrypted call initiated successfully!'
      )
    } catch (err) {
      toast.error(err.response?.data?.error || 'Call failed')
    } finally {
      setCalling(false)
    }
  }

  const handleSms = async () => {
    if (!smsMsg.trim()) { toast.error('Enter SMS message content'); return }
    try {
      const stuId = student?.student_id || id
      const { data } = await contactAPI.sms(stuId, smsMsg)
      toast.success(data.status === 'mock' ? `Mock SMS: ${data.message}` : 'SMS dispatched!')
      setSmsMsg('')
      setShowSms(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'SMS failed')
    }
  }

  const [downloadingReport, setDownloadingReport] = useState(false)

  const handleDownloadReport = async () => {
    if (!student) return
    setDownloadingReport(true)
    const t = toast.loading('Assembling official student dossier (PDF)…')
    try {
      const res = await reportsAPI.generateStudent({
        student_id: student.student_id || student.id,
        format: 'pdf',
      })
      const reportId = res.data?.report_id
      if (reportId) {
        const dlRes = await reportsAPI.downloadPdf(reportId)
        const blob = new Blob([dlRes.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `Student_Dossier_${student.student_id || student.id}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success('Official student report downloaded successfully', { id: t })
      } else {
        toast.error('Could not retrieve generated report ID', { id: t })
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate report', { id: t })
    } finally {
      setDownloadingReport(false)
    }
  }

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

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '60px auto 16px' }} />
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Assembling student academic dossier…</p>
      </div>
    )
  }

  if (!student) return null

  const riskLevel = prediction?.risk_level ?? analytics?.overall_risk ?? 'none'

  return (
    <div>
      <div style={{ padding: 'var(--space-4) var(--space-8) 0' }}>
        <button
          type="button"
          onClick={() => navigate('/students')}
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 10 }}
        >
          <ArrowLeft size={14} />
          <span>Back to Students Roster</span>
        </button>
      </div>

      <PageHeader
        category="Student Dossier"
        title={student.name}
        description={`Roll Number: ${student.student_id} · Semester ${student.semester} Section ${student.section} · ${student.email} · 📞 ${student.phone || '8660042249'}`}
        badge={`SGPA: ${sgpa ? sgpa.toFixed(2) : 'Pending'}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {student.is_club_head && (
              <Badge variant="primary" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 600 }}>
                👑 Club Head ({student.lead_clubs?.map(c => c.name).join(', ')})
              </Badge>
            )}
            {riskLevel === 'High' ? (
              <Badge variant="danger" icon={AlertTriangle}>High Risk</Badge>
            ) : riskLevel === 'Medium' ? (
              <Badge variant="warning">Medium Risk</Badge>
            ) : (
              <Badge variant="success">Satisfactory</Badge>
            )}
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="btn btn-secondary btn-sm"
              title="Download Official PDF Dossier"
            >
              <Download size={14} />
              <span>{downloadingReport ? 'Generating…' : 'Official Report (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSms(true)}
              className="btn btn-secondary btn-sm"
              disabled={!parent?.consent_to_contact}
            >
              <MessageSquare size={14} />
              <span>Message Guardian</span>
            </button>
            <button
              type="button"
              onClick={handleCall}
              disabled={calling || !parent?.consent_to_contact}
              className="btn btn-primary btn-sm"
            >
              <Phone size={14} />
              <span>{calling ? 'Calling…' : 'Proxy Call'}</span>
            </button>
          </div>
        }
      />

      <div className="page-body">
        {/* ── Metric Highlights ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label="Current SGPA"
            value={sgpa ? sgpa.toFixed(2) : 'Pending'}
            subtext={student.previous_gpa ? `Past CGPA: ${student.previous_gpa.toFixed(2)}` : 'Awaiting CIE test marks'}
            variant="primary"
            icon={Award}
          />
          <StatCard
            label="Attendance Rate"
            value={`${Number(student.attendance_pct ?? 75).toFixed(1)}%`}
            subtext={
              Number(student.attendance_pct ?? 75) < 75
                ? "Critical deficit (<75% threshold)"
                : Number(student.attendance_pct ?? 75) < 85
                ? "Warning: Moderate (<85% threshold)"
                : "Satisfactory compliance (≥85%)"
            }
            variant={
              Number(student.attendance_pct ?? 75) < 75
                ? "danger"
                : Number(student.attendance_pct ?? 75) < 85
                ? "warning"
                : "success"
            }
            isPositive={Number(student.attendance_pct ?? 75) >= 85}
          />
          <StatCard
            label="Enrolled Credits"
            value={totalCredits}
            subtext={`${courses.length} Active Courses`}
            variant="default"
            icon={BookOpen}
          />
          <StatCard
            label="Active Backlogs"
            value={student.backlogs ?? 0}
            subtext={student.backlogs > 0 ? "Subject backlogs standing" : "Clear academic standing"}
            variant={student.backlogs > 0 ? "danger" : "success"}
            isPositive={student.backlogs === 0}
          />
        </div>

        {/* ── Competency Analytics ── */}
        <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
          {/* Radar Competencies */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Curricular Competency Radar</h3>
            </div>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" stroke="var(--text-muted)" fontSize={10} />
                  <Radar name="Student Profile" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CIE vs SEE Performance */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">CIE vs. SEE Marks</h3>
            </div>
            <div style={{ height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cieVsSee} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="CIE" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="SEE" fill="var(--success)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grade Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Grade Distribution</h3>
            </div>
            <div style={{ height: 210, display: 'flex', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gradeDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                    {gradeDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Registered Courses Table ── */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <h3 className="card-title">Registered Semester Course Evaluation</h3>
            <Badge variant="neutral">{courses.length} Courses</Badge>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th>Credits</th>
                  <th>CIE (/50)</th>
                  <th>SEE (/50)</th>
                  <th>Total (/100)</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No registered course records found for this semester.
                    </td>
                  </tr>
                ) : (
                  courses.map(c => {
                    const hasSee = c.see_reduced !== null && c.see_reduced !== undefined
                    const total = hasSee ? Math.round(((c.cie_reduced || 0) + (c.see_reduced || 0)) * 10) / 10 : null
                    const evalScore = hasSee ? total : (c.cie_raw ?? ((c.cie_reduced || 0) * 2))
                    const g = getGradeInfo(evalScore)
                    return (
                      <tr key={c.code || c.name}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.code}</td>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td className="tabular-nums">{c.credits || 4}</td>
                        <td className="tabular-nums">{c.cie_reduced ?? '—'}</td>
                        <td className="tabular-nums">{c.see_reduced ?? '—'}</td>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>{hasSee ? total : '—'}</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2px 8px',
                            minWidth: 28,
                            height: 24,
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: `${g.color}20`,
                            color: g.color,
                            fontWeight: 700,
                            fontSize: '12px',
                            whiteSpace: 'nowrap',
                          }}>
                            {c.grade || g.grade}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ML Risk Assessment Card ── */}
        {(() => {
          // Resolve flags from live prediction (preferred) or DB-persisted fields
          const liveFlags   = prediction?.flags ?? []
          const dbFlagsRaw  = student?.ml_risk_flags
          const dbFlags     = dbFlagsRaw
            ? (typeof dbFlagsRaw === 'string' ? (() => { try { return JSON.parse(dbFlagsRaw) } catch { return [] } })() : dbFlagsRaw)
            : []
          const flags       = liveFlags.length > 0 ? liveFlags : dbFlags

          const score       = prediction?.risk_score ?? student?.ml_risk_score ?? null
          const level       = prediction?.risk_level  ?? student?.ml_risk_level  ?? 'Low'
          const lowConf     = prediction?.low_confidence ?? student?.ml_low_confidence ?? false
          const missingFlds = prediction?.missing_fields ?? []
          const computedAt  = student?.ml_risk_computed_at ?? null

          const levelColor = level === 'High' ? 'var(--danger)' : level === 'Medium' ? 'var(--warning)' : 'var(--success)'
          const levelBg    = level === 'High' ? 'rgba(239,68,68,0.1)' : level === 'Medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'

          const severityColor = (sev) => sev === 'high' ? 'var(--danger)' : sev === 'medium' ? 'var(--warning)' : 'var(--text-muted)'
          const severityBg    = (sev) => sev === 'high' ? 'rgba(239,68,68,0.12)' : sev === 'medium' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.12)'

          const codeLabel = (code) => {
            const map = {
              DETENTION_RISK: 'Detention Risk',
              ACTIVE_BACKLOG: 'Active Backlogs',
              LOW_ATTENDANCE: 'Low Attendance',
              LOW_CIE:        'Low CIE Marks',
              LOW_GPA:        'Low GPA',
            }
            return map[code] || code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          }

          return (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Brain size={16} style={{ color: levelColor }} />
                  <h3 className="card-title" style={{ margin: 0 }}>ML Risk Assessment</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {lowConf && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: '11px', color: 'var(--warning)', fontWeight: 500,
                    }}>
                      <Info size={12} /> Low Confidence
                    </span>
                  )}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: '999px',
                    backgroundColor: levelBg, color: levelColor,
                    fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em',
                  }}>
                    {level === 'High' ? '🚨' : level === 'Medium' ? '⚠️' : '✅'} {level} Risk
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px 20px' }}>
                {/* Score meter */}
                {score !== null && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <TrendingUp size={12} /> Failure Probability Score
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: levelColor, fontFamily: 'var(--font-mono)' }}>
                        {(score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      height: 8, borderRadius: 4,
                      background: 'rgba(255,255,255,0.07)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(score * 100, 100)}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, var(--success), ${levelColor})`,
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Low Risk (0%)</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>High Risk (100%)</span>
                    </div>
                  </div>
                )}

                {/* Risk Flags */}
                {flags.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 10 }}>
                      Risk Flags ({flags.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {flags.map((flag, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: severityBg(flag.severity),
                          border: `1px solid ${severityColor(flag.severity)}30`,
                        }}>
                          <AlertTriangle size={14} style={{ color: severityColor(flag.severity), marginTop: 1, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{
                                fontSize: '12px', fontWeight: 700,
                                color: severityColor(flag.severity),
                              }}>
                                {codeLabel(flag.code)}
                              </span>
                              <span style={{
                                fontSize: '10px', fontWeight: 600,
                                padding: '1px 6px', borderRadius: 999,
                                background: severityBg(flag.severity),
                                color: severityColor(flag.severity),
                                textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>
                                {flag.severity}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {flag.message}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  }}>
                    <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>
                      No active risk flags — student is within all policy thresholds.
                    </span>
                  </div>
                )}

                {/* Low confidence / missing fields notice */}
                {lowConf && missingFlds.length > 0 && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    fontSize: '11px', color: 'var(--text-muted)',
                  }}>
                    <Info size={11} style={{ display: 'inline', marginRight: 5 }} />
                    Prediction confidence is reduced — missing data fields: {missingFlds.join(', ')}
                  </div>
                )}

                {/* Timestamp */}
                {computedAt && (
                  <div style={{ marginTop: 12, fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
                    Last computed: {new Date(computedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Bottom Grid: Placement & Parent Contact Cards ── */}
        <div className="grid-2">
          {/* Placement Status Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Placement & Higher Studies (Crit. 4.5)</h3>
              {Boolean(placement?.is_verified ?? placement?.verified_by_admin) ? (
                <Badge variant="success" icon={ShieldCheck}>Verified</Badge>
              ) : (
                <Badge variant="warning" icon={Clock}>Pending Audit</Badge>
              )}
            </div>

            {placement ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{placement.status?.replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Package / Stipend</div>
                    <div style={{ fontWeight: 600 }}>{placement.ctc_or_stipend || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Company / Institution</div>
                    <div style={{ fontWeight: 600 }}>{placement.company_or_institution || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role / Program</div>
                    <div style={{ fontWeight: 600 }}>{placement.role_or_program || '—'}</div>
                  </div>
                </div>

                {/* Offer Letter Document Preview Button */}
                {placement.has_offer_letter || placement.offer_letter_path ? (
                  <div style={{ marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => handleViewOfferLetter(placement.offer_letter_path)}
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 6, color: 'var(--primary)' }}
                      title="View student offer letter / admission proof"
                    >
                      <FileText size={13} />
                      <span>View Offer Letter / Proof Document</span>
                    </button>
                  </div>
                ) : null}

                <div style={{ display: 'flex', gap: 8 }}>
                  {Boolean(placement?.is_verified ?? placement?.verified_by_admin) ? (
                    <button type="button" onClick={handleUnverifyPlacement} className="btn btn-secondary btn-sm">
                      <Unlock size={14} /> Reopen for Student Edits
                    </button>
                  ) : (
                    <button type="button" onClick={handleVerifyPlacement} className="btn btn-primary btn-sm">
                      <ShieldCheck size={14} /> Verify Placement for Criterion 4
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No placement record reported by this student yet.
              </div>
            )}
          </div>

          {/* Parent & Guardian Privacy Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Parent / Guardian Contact (DPDP Act)</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleOpenEditParent}
                  className="btn btn-secondary btn-xs"
                  style={{ gap: 4 }}
                >
                  <Edit3 size={12} /> Edit Details
                </button>
                {parent?.consent_to_contact ? (
                  <Badge variant="success">Consent Verified</Badge>
                ) : (
                  <Badge variant="danger">No Consent</Badge>
                )}
              </div>
            </div>

            {parent ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parent Name</div>
                    <div style={{ fontWeight: 600 }}>{parent.parent_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Relationship</div>
                    <div style={{ fontWeight: 600 }}>{parent.relationship}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact Phone</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{parent.primary_mobile || '8660042249'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Channel</div>
                    <div style={{ fontWeight: 600 }}>Encrypted Voice / SMS</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleCall}
                    disabled={calling || !parent.consent_to_contact}
                    className="btn btn-primary btn-sm"
                  >
                    <Phone size={13} /> {calling ? 'Connecting…' : 'Initiate Proxy Call'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSms(true)}
                    disabled={!parent.consent_to_contact}
                    className="btn btn-secondary btn-sm"
                  >
                    <MessageSquare size={13} /> Send Alert SMS
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                <div style={{ marginBottom: 10 }}>No parent profile linked to this student record.</div>
                <button
                  type="button"
                  onClick={handleOpenEditParent}
                  className="btn btn-primary btn-xs"
                  style={{ gap: 4 }}
                >
                  <Edit3 size={12} /> Add Parent Contact
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Guardian SMS Modal ── */}
        <Modal
          isOpen={showSms}
          onClose={() => setShowSms(false)}
          title={`Send Academic Alert to Guardian of ${student?.name || ''}`}
          maxWidth={500}
          footer={
            <>
              <button type="button" onClick={() => setShowSms(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleSms} className="btn btn-primary btn-sm">
                Send SMS Alert
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Alert Message</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={smsMsg}
              onChange={e => setSmsMsg(e.target.value)}
              placeholder="State official message regarding academic standing or attendance..."
            />
          </div>
        </Modal>

        {/* ── Edit Parent Details Modal ── */}
        <Modal
          isOpen={showEditParent}
          onClose={() => setShowEditParent(false)}
          title={`Parent / Guardian Contact — ${student?.name || ''}`}
          maxWidth={500}
          footer={
            <>
              <button type="button" onClick={() => setShowEditParent(false)} className="btn btn-secondary btn-sm" disabled={savingParent}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveParent} className="btn btn-primary btn-sm" disabled={savingParent}>
                {savingParent ? 'Saving…' : 'Save Parent Contact'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSaveParent}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Parent / Guardian Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={parentForm.parent_name}
                onChange={e => setParentForm(f => ({ ...f, parent_name: e.target.value }))}
                placeholder="e.g., Rajesh Sharma"
                required
              />
            </div>

            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select
                  className="form-select"
                  value={parentForm.relationship}
                  onChange={e => setParentForm(f => ({ ...f, relationship: e.target.value }))}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Primary Mobile Number *</label>
                <input
                  type="text"
                  className="form-input"
                  value={parentForm.primary_mobile}
                  onChange={e => setParentForm(f => ({ ...f, primary_mobile: e.target.value }))}
                  placeholder="e.g., +91 9876543210"
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Alternate Mobile (Optional)</label>
              <input
                type="text"
                className="form-input"
                value={parentForm.alternate_mobile || ''}
                onChange={e => setParentForm(f => ({ ...f, alternate_mobile: e.target.value }))}
                placeholder="e.g., 9123456780"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={parentForm.consent_to_contact}
                  onChange={e => setParentForm(f => ({ ...f, consent_to_contact: e.target.checked }))}
                />
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  DPDP Act 2023 Explicit Consent Granted for Official Institutional Communications
                </span>
              </label>
            </div>
          </form>
        </Modal>

        {/* ── Active Call Demo Modal ── */}
        {activeCall && (
          <Modal
            isOpen={true}
            onClose={() => setActiveCall(null)}
            title="Encrypted Voice Call — DPDP Act Compliant Proxy"
            maxWidth={460}
          >
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                border: '2px solid var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <PhoneCall size={32} color="var(--primary)" />
              </div>

              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                {activeCall.parentName} ({activeCall.relationship})
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 14 }}>
                Ward: {activeCall.studentName} · Target: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeCall.phone}</span>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: '16px',
                backgroundColor: '#ecfdf5', color: '#065f46',
                fontSize: '13px', fontWeight: 600, marginBottom: 16
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
                Call Connected · {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
              </div>

              <div style={{
                backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'left',
                fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 20
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  📞 Telecom Proxy Bridge Active
                </div>
                <div>
                  Virtual telecom bridge active. Connected to verified contact number <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeCall.phone || '8660042249'}</span>.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ padding: '8px 24px', borderRadius: '20px' }}
                onClick={() => {
                  setActiveCall(null)
                  toast.success('Call ended')
                }}
              >
                <PhoneOff size={14} /> End Call
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
