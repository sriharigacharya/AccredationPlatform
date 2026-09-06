import React, { useEffect, useState, useMemo } from 'react'
import {
  studentsAPI, predictAPI, parentsAPI, assignmentsAPI,
  placementsAPI, achievementsAPI
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie
} from 'recharts'
import {
  FileText, Briefcase, Calendar, CheckCircle2, Clock, Upload,
  Lock, ShieldCheck, Building, GraduationCap, Rocket, FileCheck,
  ExternalLink, Trophy, Medal, Plus, Trash2, Image, Users,
  AlertCircle, X, Award, BookOpen, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

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

export default function MyRecordPage() {
  const { user }             = useAuth()
  const [student, setStudent] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [parent, setParent]   = useState(null)
  const [assignments, setAssignments] = useState([])
  const [placement, setPlacement] = useState(null)
  const [placementForm, setPlacementForm] = useState({
    status: 'not_placed',
    company_or_institution: '',
    role_or_program: '',
    ctc_or_stipend: '',
    academic_year: '2025-26',
    final_year_cohort_year: 2026,
  })
  const [offerFile, setOfferFile] = useState(null)
  const [savingPlacement, setSavingPlacement] = useState(false)

  // Achievements
  const [achievements, setAchievements] = useState([])
  const [showAchievementModal, setShowAchievementModal] = useState(false)
  const [submittingAchievement, setSubmittingAchievement] = useState(false)
  const [achievementForm, setAchievementForm] = useState({
    event_name: '',
    organizing_body: '',
    activity_type: 'technical',
    event_scope: 'national',
    event_date: new Date().toISOString().split('T')[0],
    academic_year: '2025-26',
    venue: '',
    result_description: '',
    student_ids: '',
    remarks: '',
  })
  const [proofDocFile, setProofDocFile] = useState(null)
  const [photoFiles, setPhotoFiles] = useState([])

  const [loading, setLoading] = useState(true)

  const fetchMyAchievements = () => {
    achievementsAPI.myList()
      .then(res => setAchievements(res.data || []))
      .catch(() => {})
  }

  useEffect(() => {
    if (!user?.linked_id) {
      setLoading(false)
      return
    }
    Promise.all([
      studentsAPI.get(user.linked_id),
      parentsAPI.get(user.linked_id).catch(() => null),
      assignmentsAPI.myList().catch(() => ({ data: [] })),
      placementsAPI.myPlacement().catch(() => ({ data: null })),
      achievementsAPI.myList().catch(() => ({ data: [] })),
    ]).then(([s, p, a, pl, ach]) => {
      setStudent(s.data)
      setParent(p?.data || null)
      setAssignments(a?.data || [])
      setAchievements(ach?.data || [])
      if (pl?.data) {
        setPlacement(pl.data)
        setPlacementForm({
          status: pl.data.status || 'not_placed',
          company_or_institution: pl.data.company_or_institution || '',
          role_or_program: pl.data.role_or_program || '',
          ctc_or_stipend: pl.data.ctc_or_stipend || '',
          academic_year: pl.data.academic_year || '2025-26',
          final_year_cohort_year: pl.data.final_year_cohort_year || 2026,
        })
      }
      return predictAPI.student(s.data)
    }).then(r => {
      setPrediction(r?.data)
    }).catch(() => {
      toast.error('Could not load your academic record')
    }).finally(() => setLoading(false))
  }, [user])

  const handleAchievementSubmit = async (e) => {
    e.preventDefault()
    if (!achievementForm.event_name.trim() || !achievementForm.organizing_body.trim() || !achievementForm.venue.trim() || !achievementForm.result_description.trim()) {
      toast.error('Please complete all required fields')
      return
    }
    if (!proofDocFile) {
      toast.error('Certificate or proof document is required')
      return
    }

    setSubmittingAchievement(true)
    const formData = new FormData()
    formData.append('event_name', achievementForm.event_name.trim())
    formData.append('organizing_body', achievementForm.organizing_body.trim())
    formData.append('activity_type', achievementForm.activity_type)
    formData.append('event_scope', achievementForm.event_scope)
    formData.append('event_date', achievementForm.event_date)
    formData.append('academic_year', achievementForm.academic_year)
    formData.append('venue', achievementForm.venue.trim())
    formData.append('result_description', achievementForm.result_description.trim())
    if (achievementForm.remarks.trim()) {
      formData.append('remarks', achievementForm.remarks.trim())
    }
    formData.append('proof_file', proofDocFile)
    for (let i = 0; i < photoFiles.length; i++) {
      formData.append('photos', photoFiles[i])
    }

    try {
      await achievementsAPI.create(formData)
      toast.success('Achievement submitted for faculty verification!')
      setShowAchievementModal(false)
      setAchievementForm({
        event_name: '',
        organizing_body: '',
        activity_type: 'technical',
        event_scope: 'national',
        event_date: new Date().toISOString().split('T')[0],
        academic_year: '2025-26',
        venue: '',
        result_description: '',
        student_ids: '',
        remarks: '',
      })
      setProofDocFile(null)
      setPhotoFiles([])
      fetchMyAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed')
    } finally {
      setSubmittingAchievement(false)
    }
  }

  const handlePlacementSubmit = async (e) => {
    e.preventDefault()
    setSavingPlacement(true)
    const formData = new FormData()
    formData.append('status', placementForm.status)
    formData.append('company_or_institution', placementForm.company_or_institution.trim())
    formData.append('role_or_program', placementForm.role_or_program.trim())
    formData.append('ctc_or_stipend', placementForm.ctc_or_stipend.trim())
    formData.append('academic_year', placementForm.academic_year)
    formData.append('final_year_cohort_year', placementForm.final_year_cohort_year)
    if (offerFile) {
      formData.append('offer_letter', offerFile)
    }

    try {
      const { data } = await placementsAPI.update(formData)
      setPlacement(data)
      toast.success('Placement record updated and submitted for NBA verification')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update placement record')
    } finally {
      setSavingPlacement(false)
    }
  }

  const handleDeleteAchievement = async (id) => {
    if (!window.confirm('Delete this unverified achievement submission?')) return
    try {
      await achievementsAPI.delete(id)
      toast.success('Submission removed')
      fetchMyAchievements()
    } catch (err) {
      toast.error('Failed to remove entry')
    }
  }

  const courses = useMemo(() => student?.courses || [], [student])
  const sgpa = student?.sgpa || 0
  const totalCredits = useMemo(() => courses.reduce((s, c) => s + (c.credits || 4), 0), [courses])
  const isVerified = Boolean(placement?.is_verified ?? placement?.verified_by_admin)

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '60px auto 16px' }} />
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Assembling your student academic dossier…</p>
      </div>
    )
  }

  if (!student) {
    return (
      <div style={{ padding: 'var(--space-8)' }}>
        <EmptyState
          icon={AlertCircle}
          title="Student Record Unlinked"
          description="Your user account is not linked to a student registration ID in the academic database."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        category="Student Academic Portal"
        title={student.name}
        description={`Roll Number: ${student.student_id} · Semester ${student.semester} Section ${student.section} · ${student.email}`}
        badge={`SGPA: ${sgpa ? sgpa.toFixed(2) : 'Pending'}`}
      />

      <div className="page-body">
        {/* ── Summary Cards ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label="Current SGPA"
            value={sgpa ? sgpa.toFixed(2) : 'Pending'}
            subtext="Out of 10.0 scale"
            variant="primary"
            icon={Award}
          />
          <StatCard
            label="Attendance Compliance"
            value={`${student.attendance_pct?.toFixed(1)}%`}
            subtext={student.attendance_pct < 75 ? "Below 75% attendance threshold" : "Regulated minimum satisfied"}
            variant={student.attendance_pct < 75 ? "danger" : "success"}
            isPositive={student.attendance_pct >= 75}
          />
          <StatCard
            label="Enrolled Credits"
            value={totalCredits}
            subtext={`${courses.length} Active Courses`}
            variant="default"
            icon={BookOpen}
          />
          <StatCard
            label="Academic Outcome"
            value={student.final_result || 'In Progress'}
            subtext={student.backlogs > 0 ? `${student.backlogs} Backlog Standing` : 'Clear Academic Standing'}
            variant={student.final_result === 'Pass' ? 'success' : student.final_result === 'Fail' ? 'danger' : 'default'}
            isPositive={student.final_result === 'Pass'}
          />
        </div>

        {/* ── Course-wise Grade Breakdown Table ── */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Continuous Evaluation Breakdown</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                Live marks entered by course faculty across CIE tests, quizzes, and experiential learning.
              </p>
            </div>
            <Badge variant="neutral">Semester {student.semester}</Badge>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Title</th>
                  <th>CIE 1 (/25)</th>
                  <th>CIE 2 (/25)</th>
                  <th>Quiz 1 (/10)</th>
                  <th>Quiz 2 (/10)</th>
                  <th>EL (/30)</th>
                  <th>CIE Total (/50)</th>
                  <th>SEE (/50)</th>
                  <th>Grand Total (/100)</th>
                  <th>Grade</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {courses.map(c => {
                  const hasSee = c.see_reduced !== null && c.see_reduced !== undefined
                  const total = hasSee ? Math.round(((c.cie_reduced || 0) + (c.see_reduced || 0)) * 10) / 10 : null
                  const evalScore = hasSee ? total : (c.cie_raw ?? ((c.cie_reduced || 0) * 2))
                  const g = getGradeInfo(evalScore)
                  return (
                    <tr key={c.code || c.name}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {c.code} · {c.credits} Credits
                        </div>
                      </td>
                      <td className="tabular-nums">{c.cie1 ?? '—'}</td>
                      <td className="tabular-nums">{c.cie2 ?? '—'}</td>
                      <td className="tabular-nums">{c.quiz1 ?? '—'}</td>
                      <td className="tabular-nums">{c.quiz2 ?? '—'}</td>
                      <td className="tabular-nums">{c.el ?? '—'}</td>
                      <td className="tabular-nums" style={{ fontWeight: 700 }}>{c.cie_reduced ?? '—'}</td>
                      <td className="tabular-nums">{c.see_reduced ?? '—'}</td>
                      <td className="tabular-nums" style={{ fontWeight: 700 }}>{hasSee ? total : '—'}</td>
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
                      <td className="tabular-nums">
                        <span style={{
                          fontWeight: 600,
                          color: (c.attendance_pct || 80) < 75 ? 'var(--danger)' : 'var(--text-secondary)'
                        }}>
                          {c.attendance_pct ?? 85}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Placement Reporting Self-Service Card ── */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Placement & Career Progression (Criterion 4.5)</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                Report your industry placement offers, higher studies admissions, or startup registrations.
              </p>
            </div>
            {isVerified ? (
              <Badge variant="success" icon={ShieldCheck}>Verified by Department</Badge>
            ) : (
              <Badge variant="warning" icon={Clock}>Pending Verification</Badge>
            )}
          </div>

          <form onSubmit={handlePlacementSubmit}>
            <div className="grid-3" style={{ gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Outcome Status</label>
                <select
                  className="form-select"
                  value={placementForm.status}
                  onChange={e => setPlacementForm({ ...placementForm, status: e.target.value })}
                  disabled={isVerified}
                >
                  <option value="not_placed">In Progress / Seeking</option>
                  <option value="placed">Campus Placement Offer</option>
                  <option value="higher_studies">Higher Studies (MS/M.Tech/MBA)</option>
                  <option value="entrepreneur">Startup & Entrepreneurship</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Company or Institution</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Google India / Carnegie Mellon University"
                  value={placementForm.company_or_institution}
                  onChange={e => setPlacementForm({ ...placementForm, company_or_institution: e.target.value })}
                  disabled={isVerified || placementForm.status === 'not_placed'}
                  required={placementForm.status !== 'not_placed'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Role or Degree Program</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. SDE 1 / MS in Computer Science"
                  value={placementForm.role_or_program}
                  onChange={e => setPlacementForm({ ...placementForm, role_or_program: e.target.value })}
                  disabled={isVerified || placementForm.status === 'not_placed'}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Compensation / Package (LPA)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 14.5 LPA"
                  value={placementForm.ctc_or_stipend}
                  onChange={e => setPlacementForm({ ...placementForm, ctc_or_stipend: e.target.value })}
                  disabled={isVerified || placementForm.status === 'not_placed'}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Offer / Admit Letter (PDF or Image)</label>
                {!isVerified ? (
                  <input
                    type="file"
                    className="form-input"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => setOfferFile(e.target.files[0] || null)}
                  />
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', paddingTop: 8 }}>
                    File locked following faculty verification.
                  </div>
                )}
              </div>
            </div>

            {!isVerified && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingPlacement}
                >
                  <Upload size={14} />
                  <span>{savingPlacement ? 'Submitting…' : 'Save & Submit Placement'}</span>
                </button>
              </div>
            )}
          </form>
        </div>

        {/* ── Co-Curricular Achievements Card ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">External Co-Curricular Achievements (Criterion 4.6.3)</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                Log hackathons, coding contests, sports, and paper publications for inclusion in Section 4.6.3.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAchievementModal(true)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} />
              <span>Submit Achievement</span>
            </button>
          </div>

          {achievements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
              <Trophy size={36} color="var(--primary)" style={{ margin: '0 auto 10px', opacity: 0.8 }} />
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                No External Achievements Logged Yet
              </div>
              <p style={{ fontSize: '12px', marginTop: 4 }}>
                Won a prize in an inter-college hackathon, sports championship, or cultural fest? Submit your certificate for official accreditation credit.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Organizing Body</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Result / Award</th>
                    <th>Audit Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {achievements.map(ach => (
                    <tr key={ach.id}>
                      <td style={{ fontWeight: 600 }}>{ach.event_name}</td>
                      <td>{ach.organizing_body}</td>
                      <td>
                        <Badge variant="neutral">{ach.activity_type}</Badge>
                      </td>
                      <td>{ach.event_date}</td>
                      <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{ach.result_description}</td>
                      <td>
                        {ach.verification_status === 'verified' ? (
                          <Badge variant="success">Verified</Badge>
                        ) : ach.verification_status === 'rejected' ? (
                          <Badge variant="danger">Rejected</Badge>
                        ) : (
                          <Badge variant="warning">Under Review</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ach.verification_status !== 'verified' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAchievement(ach.id)}
                            className="btn btn-ghost btn-icon"
                            style={{ color: 'var(--danger)' }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Submit Achievement Modal ── */}
        <Modal
          isOpen={showAchievementModal}
          onClose={() => setShowAchievementModal(false)}
          title="Submit Co-Curricular Achievement (Criterion 4.6.3)"
          maxWidth={640}
        >
          <form onSubmit={handleAchievementSubmit}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. VTU Inter-Collegiate Hackathon"
                  value={achievementForm.event_name}
                  onChange={e => setAchievementForm({ ...achievementForm, event_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Organizing Institution *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. MSRIT Bangalore"
                  value={achievementForm.organizing_body}
                  onChange={e => setAchievementForm({ ...achievementForm, organizing_body: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Venue / City *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Bengaluru"
                  value={achievementForm.venue}
                  onChange={e => setAchievementForm({ ...achievementForm, venue: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Award / Result *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. 1st Place & Trophy"
                  value={achievementForm.result_description}
                  onChange={e => setAchievementForm({ ...achievementForm, result_description: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Certificate / Proof File *</label>
              <input
                type="file"
                className="form-input"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setProofDocFile(e.target.files[0] || null)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowAchievementModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={submittingAchievement} className="btn btn-primary btn-sm">
                {submittingAchievement ? 'Submitting…' : 'Submit Achievement'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}
