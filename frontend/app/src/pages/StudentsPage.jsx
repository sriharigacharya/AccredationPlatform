import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, predictAPI, placementsAPI, achievementsAPI } from '../api/client'
import {
  Search, Plus, ChevronRight, AlertTriangle, Users, Filter,
  Briefcase, ShieldCheck, CheckCircle2, ExternalLink, Clock,
  Unlock, Award, Trophy, Medal, FileCheck, XCircle, Image,
  Tag, X, Check, Eye, AlertCircle, Info, RefreshCw, Layers, FileText
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const SECTION_META = {
  A: { label: 'Section A', sem: 'Sem 3' },
  B: { label: 'Section B', sem: 'Sem 5' },
  C: { label: 'Section C', sem: 'Sem 7' },
}

export default function StudentsPage() {
  const [activeTab, setActiveTab]   = useState('students')
  const [students, setStudents]     = useState([])
  const [risks, setRisks]           = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [semFilter, setSemFilter]   = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [riskFilter, setRiskFilter]       = useState('all')
  const [showForm, setShowForm]     = useState(false)

  // Placements state
  const [placements, setPlacements] = useState([])
  const [placementSummary, setPlacementSummary] = useState(null)
  const [placementStatusFilter, setPlacementStatusFilter] = useState('all')
  const [cohortFilter, setCohortFilter] = useState(2026)
  const [loadingPlacements, setLoadingPlacements] = useState(false)

  // Achievements state
  const [achievements, setAchievements] = useState([])
  const [achievementsReport, setAchievementsReport] = useState(null)
  const [achievementSubTab, setAchievementSubTab] = useState('queue')
  const [achievementStatusFilter, setAchievementStatusFilter] = useState('pending')
  const [achievementTypeFilter, setAchievementTypeFilter] = useState('all')
  const [achievementYearFilter, setAchievementYearFilter] = useState('all')
  const [loadingAchievements, setLoadingAchievements] = useState(false)
  const [showAdminAchievementModal, setShowAdminAchievementModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedRejectAchId, setSelectedRejectAchId] = useState(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [savingAdminAchievement, setSavingAdminAchievement] = useState(false)

  const [adminAchievementForm, setAdminAchievementForm] = useState({
    student_id: 'STU069',
    student_ids: '',
    event_name: '',
    organizing_body: '',
    activity_type: 'technical',
    event_scope: 'national',
    event_date: new Date().toISOString().split('T')[0],
    academic_year: '2025-26',
    venue: '',
    result_description: '',
    remarks: '',
  })
  const [adminProofFile, setAdminProofFile] = useState(null)
  const [adminPhotoFiles, setAdminPhotoFiles] = useState([])

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

  const fetchPlacements = () => {
    setLoadingPlacements(true)
    Promise.all([
      placementsAPI.list({ cohort_year: cohortFilter }),
      placementsAPI.summary(),
    ]).then(([listRes, sumRes]) => {
      setPlacements(listRes.data || [])
      setPlacementSummary(sumRes.data || null)
    }).catch(err => {
      console.error(err)
    }).finally(() => setLoadingPlacements(false))
  }

  const fetchAchievements = () => {
    setLoadingAchievements(true)
    Promise.all([
      achievementsAPI.list({
        status: achievementStatusFilter !== 'all' ? achievementStatusFilter : undefined,
        activity_type: achievementTypeFilter !== 'all' ? achievementTypeFilter : undefined,
        academic_year: achievementYearFilter !== 'all' ? achievementYearFilter : undefined,
      }),
      achievementsAPI.report(),
    ]).then(([listRes, repRes]) => {
      setAchievements(listRes.data || [])
      setAchievementsReport(repRes.data || null)
    }).catch(err => {
      console.error(err)
    }).finally(() => setLoadingAchievements(false))
  }

  useEffect(() => { fetchStudents() }, [search, semFilter, sectionFilter])

  useEffect(() => {
    if (activeTab === 'placements') {
      fetchPlacements()
    } else if (activeTab === 'achievements') {
      fetchAchievements()
    }
  }, [activeTab, cohortFilter, achievementStatusFilter, achievementTypeFilter, achievementYearFilter])

  const handleVerifyPlacement = async (id) => {
    try {
      const { data } = await placementsAPI.verify(id)
      toast.success('Placement verified for Criterion 4.5')
      setPlacements(prev => prev.map(p => p.id === id ? { ...p, ...data, is_verified: true, verified_by_admin: true } : p))
      fetchPlacements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleUnverifyPlacement = async (id) => {
    try {
      const { data } = await placementsAPI.unverify(id)
      toast.success('Placement unlocked for student revisions')
      setPlacements(prev => prev.map(p => p.id === id ? { ...p, ...data, is_verified: false, verified_by_admin: false } : p))
      fetchPlacements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen record')
    }
  }

  const handleViewProof = async (filename) => {
    if (!filename) {
      toast.error('No proof document attached')
      return
    }
    const t = toast.loading('Retrieving proof document…')
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

  const handleVerifyAchievement = async (id) => {
    try {
      await achievementsAPI.verify(id)
      toast.success('Achievement verified! Indexed for Criterion 4.6.3')
      fetchAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleOpenRejectModal = (id) => {
    setSelectedRejectAchId(id)
    setRejectionReasonInput('Proof document insufficient or criteria not met.')
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedRejectAchId) return
    try {
      await achievementsAPI.reject(selectedRejectAchId, {
        rejection_reason: rejectionReasonInput.trim(),
      })
      toast.success('Achievement status updated to rejected')
      setShowRejectModal(false)
      fetchAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject')
    }
  }

  const handleAdminAchievementSubmit = async (e) => {
    e.preventDefault()
    if (!adminAchievementForm.student_id.trim() || !adminAchievementForm.event_name.trim() || !adminAchievementForm.organizing_body.trim() || !adminAchievementForm.venue.trim() || !adminAchievementForm.result_description.trim()) {
      toast.error('Please complete all required fields')
      return
    }
    if (!adminProofFile) {
      toast.error('Certificate or verification document is required')
      return
    }

    setSavingAdminAchievement(true)
    const formData = new FormData()
    formData.append('student_id', adminAchievementForm.student_id.trim().toUpperCase())
    formData.append('event_name', adminAchievementForm.event_name.trim())
    formData.append('organizing_body', adminAchievementForm.organizing_body.trim())
    formData.append('activity_type', adminAchievementForm.activity_type)
    formData.append('event_scope', adminAchievementForm.event_scope)
    formData.append('event_date', adminAchievementForm.event_date)
    formData.append('academic_year', adminAchievementForm.academic_year)
    formData.append('venue', adminAchievementForm.venue.trim())
    formData.append('result_description', adminAchievementForm.result_description.trim())
    if (adminAchievementForm.student_ids.trim()) {
      formData.append('student_ids', adminAchievementForm.student_ids.trim())
    }
    if (adminAchievementForm.remarks.trim()) {
      formData.append('remarks', adminAchievementForm.remarks.trim())
    }
    formData.append('proof_file', adminProofFile)
    for (let i = 0; i < adminPhotoFiles.length; i++) {
      formData.append('photos', adminPhotoFiles[i])
    }

    try {
      await achievementsAPI.create(formData)
      toast.success('Achievement recorded on behalf of student!')
      setShowAdminAchievementModal(false)
      setAdminAchievementForm({
        student_id: 'STU069',
        student_ids: '',
        event_name: '',
        organizing_body: '',
        activity_type: 'technical',
        event_scope: 'national',
        event_date: new Date().toISOString().split('T')[0],
        academic_year: '2025-26',
        venue: '',
        result_description: '',
        remarks: '',
      })
      setAdminProofFile(null)
      setAdminPhotoFiles([])
      fetchAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed')
    } finally {
      setSavingAdminAchievement(false)
    }
  }

  useEffect(() => {
    if (!students.length) return
    predictAPI.batch(students).then(r => {
      const m = {}
      ;(r.data?.predictions || []).forEach(p => {
        m[p.student_id] = p
        if (p.id) m[p.id] = p
      })
      students.forEach(s => {
        if (s.student_id && m[s.student_id]) {
          m[s.id] = m[s.student_id]
        }
      })
      setRisks(m)
    }).catch(() => {})
  }, [students])

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

  const highRiskCount = useMemo(() => {
    return students.filter(s => {
      const r = risks[s.student_id] || risks[s.id]
      return r?.risk_level === 'High'
    }).length
  }, [students, risks])

  const displayedStudents = useMemo(() => {
    return students.filter(s => {
      if (riskFilter !== 'all') {
        const r = risks[s.student_id] || risks[s.id]
        const level = (r?.risk_level || 'Low').toLowerCase()
        if (riskFilter === 'high' && level !== 'high') return false
        if (riskFilter === 'medium' && level !== 'medium') return false
        if (riskFilter === 'low' && level !== 'low') return false
      }
      return true
    })
  }, [students, risks, riskFilter])

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Student Body, Placements & Co-Curriculars"
        description="Comprehensive student records, ML risk predictions, Criterion 4.5 placement verification, and Criterion 4.6.3 achievements audit."
        actions={
          activeTab === 'students' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              <span>Register Student</span>
            </button>
          ) : activeTab === 'achievements' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdminAchievementModal(true)}>
              <Trophy size={14} />
              <span>Log Achievement</span>
            </button>
          ) : null
        }
      />

      <div className="page-body">
        {/* Navigation Tabs */}
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'students', label: 'All Students Roster', icon: Users, count: students.length },
            { id: 'placements', label: 'Placements & Higher Studies (Crit. 4.5)', icon: Briefcase },
            { id: 'achievements', label: 'Student Achievements (Crit. 4.6.3)', icon: Trophy },
          ]}
        />

        {/* ── TAB 1: ALL STUDENTS ── */}
        {activeTab === 'students' && (
          <div>
            {/* Section Cohort Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 'var(--space-4)' }}>
              {Object.entries(SECTION_META).map(([sec, meta]) => {
                const s = sectionSummary[sec]
                const isActive = sectionFilter === sec
                return (
                  <div
                    key={sec}
                    onClick={() => setSectionFilter(isActive ? '' : sec)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {meta.label} · {meta.sem}
                      </span>
                      <Badge variant="neutral">{s.total} Enrolled</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: '12px' }}>
                      <span style={{ color: 'var(--success)' }}>● {s.pass} Passing</span>
                      <span style={{ color: s.fail > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>● {s.fail} Backlogs</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Filter Toolbar */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                  <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
                    <Search size={14} />
                    <input
                      placeholder="Search by student name or roll number…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    style={{ width: 140, height: 34, padding: '4px 8px' }}
                    value={semFilter}
                    onChange={e => setSemFilter(e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: 130, height: 34, padding: '4px 8px' }}
                    value={sectionFilter}
                    onChange={e => setSectionFilter(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                  </select>

                  <select
                    className="form-select"
                    style={{ width: 140, height: 34, padding: '4px 8px' }}
                    value={riskFilter}
                    onChange={e => setRiskFilter(e.target.value)}
                  >
                    <option value="all">All Risk Tiers</option>
                    <option value="high">🚨 High Risk</option>
                    <option value="medium">⚠️ Medium Risk</option>
                    <option value="low">✓ Satisfactory</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {highRiskCount > 0 && (
                    <Badge variant="danger" icon={AlertTriangle}>
                      {highRiskCount} High Risk Flagged
                    </Badge>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Showing <strong>{displayedStudents.length}</strong> of {students.length} students
                  </span>
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Cohort / Sec</th>
                    <th>Attendance %</th>
                    <th>CGPA</th>
                    <th>Backlogs</th>
                    <th>Risk Tier (ML)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                        <div className="spinner" />
                      </td>
                    </tr>
                  ) : displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No student records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map(s => {
                      const risk = risks[s.student_id] || risks[s.id]
                      const riskLevel = risk?.risk_level || 'Low'
                      return (
                        <tr key={s.id || s.student_id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.student_id || s.id}</td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.email}</div>
                          </td>
                          <td>
                            <Badge variant="neutral">Sem {s.semester} · Sec {s.section}</Badge>
                          </td>
                          <td className="tabular-nums">
                            <span style={{
                              fontWeight: 600,
                              color: (s.attendance_pct ?? s.attendance_rate ?? 75) < 75 ? 'var(--danger)' : 'var(--text-primary)'
                            }}>
                              {s.attendance_pct ?? s.attendance_rate ?? 75}%
                            </span>
                          </td>
                          <td className="tabular-nums" style={{ fontWeight: 600 }}>
                            {s.previous_gpa ? Number(s.previous_gpa).toFixed(2) : '—'}
                          </td>
                          <td className="tabular-nums">
                            {s.backlogs > 0 ? (
                              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{s.backlogs}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td>
                            {riskLevel === 'High' ? (
                              <Badge variant="danger" dot>High Risk</Badge>
                            ) : riskLevel === 'Medium' ? (
                              <Badge variant="warning" dot>Medium</Badge>
                            ) : (
                              <Badge variant="success" dot>Satisfactory</Badge>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => navigate(`/students/${s.student_id || s.id}`)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--primary)' }}
                            >
                              <span>Dossier</span>
                              <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: PLACEMENTS (CRITERION 4.5) ── */}
        {activeTab === 'placements' && (
          <div>
            {placementSummary && (
              <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
                <StatCard label="Campus Placed" value={placementSummary.placed_count || 0} subtext="Direct Industry Offers" variant="success" icon={Briefcase} />
                <StatCard label="Higher Education" value={placementSummary.higher_studies_count || 0} subtext="GATE / GRE Admitted" variant="primary" icon={Award} />
                <StatCard label="Verified Ratio" value={`${placementSummary.verified_ratio || 0}%`} subtext="Criterion 4.5 Compliance" variant="info" icon={ShieldCheck} />
                <StatCard label="Median Package" value={placementSummary.median_ctc ? `${placementSummary.median_ctc} LPA` : '—'} subtext="Annual CTC Index" variant="default" icon={Trophy} />
              </div>
            )}

            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div>
                    <label className="form-label">Graduating Cohort</label>
                    <select
                      className="form-select"
                      style={{ height: 34, padding: '4px 8px' }}
                      value={cohortFilter}
                      onChange={e => setCohortFilter(parseInt(e.target.value, 10))}
                    >
                      {[2026, 2025, 2024, 2023].map(y => (
                        <option key={y} value={y}>Class of {y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total Records: <strong>{placements.length}</strong>
                </span>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Outcome Status</th>
                    <th>Company / University</th>
                    <th>Designation / Program</th>
                    <th>CTC / Stipend</th>
                    <th>Proof Document</th>
                    <th>NBA Audit Verification</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPlacements ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>
                        <div className="spinner" />
                      </td>
                    </tr>
                  ) : placements.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No placement records reported for the Class of {cohortFilter}.
                      </td>
                    </tr>
                  ) : (
                    placements.map(p => {
                      const isVerified = Boolean(p.is_verified ?? p.verified_by_admin)
                      return (
                        <tr key={p.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.student_id}</td>
                          <td style={{ fontWeight: 600 }}>{p.student_name || p.student?.name || 'Student'}</td>
                          <td>
                            {p.status === 'placed' ? (
                              <Badge variant="success">Placed</Badge>
                            ) : p.status === 'higher_studies' ? (
                              <Badge variant="primary">Higher Studies</Badge>
                            ) : p.status === 'entrepreneurship' || p.status === 'entrepreneur' ? (
                              <Badge variant="warning">Startup</Badge>
                            ) : (
                              <Badge variant="neutral">In Progress</Badge>
                            )}
                          </td>
                          <td>{p.company_or_institution || '—'}</td>
                          <td>{p.role_or_program || '—'}</td>
                          <td className="tabular-nums" style={{ fontWeight: 600 }}>
                            {p.ctc_or_stipend || '—'}
                          </td>
                          <td>
                            {p.has_offer_letter || p.offer_letter_path ? (
                              <button
                                type="button"
                                onClick={() => handleViewProof(p.offer_letter_path)}
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--primary)', padding: '2px 8px', height: 26, fontSize: '12px', gap: 4 }}
                                title="View Uploaded Proof Document"
                              >
                                <FileText size={13} />
                                <span>View Proof</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No Doc</span>
                            )}
                          </td>
                          <td>
                            {isVerified ? (
                              <Badge variant="success" icon={ShieldCheck}>Verified</Badge>
                            ) : (
                              <Badge variant="warning" icon={Clock}>Pending Proof</Badge>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isVerified ? (
                              <button
                                type="button"
                                onClick={() => handleUnverifyPlacement(p.id)}
                                className="btn btn-secondary btn-sm"
                              >
                                <Unlock size={13} />
                                <span>Unlock</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleVerifyPlacement(p.id)}
                                className="btn btn-primary btn-sm"
                              >
                                <ShieldCheck size={13} />
                                <span>Verify Proof</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: ACHIEVEMENTS (CRITERION 4.6.3) ── */}
        {activeTab === 'achievements' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)' }}>
              <button
                type="button"
                className={`btn btn-sm ${achievementSubTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAchievementSubTab('queue')}
              >
                Verification Queue ({achievements.filter(a => a.status === 'pending').length} Pending)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${achievementSubTab === 'report' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAchievementSubTab('report')}
              >
                Criterion 4.6.3 Summary Index
              </button>
            </div>

            {achievementSubTab === 'queue' ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Event Title</th>
                      <th>Organizing Body</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Prize / Result</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Audit Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAchievements ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                          <div className="spinner" />
                        </td>
                      </tr>
                    ) : achievements.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No achievements pending mentor review.
                        </td>
                      </tr>
                    ) : (
                      achievements.map(a => (
                        <tr key={a.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{a.student_name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{a.student_id}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{a.event_name}</td>
                          <td>{a.organizing_body}</td>
                          <td>
                            <Badge variant="neutral">{a.activity_type}</Badge>
                          </td>
                          <td>{a.event_date}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{a.result_description}</td>
                          <td>
                            {a.status === 'approved' ? (
                              <Badge variant="success">Approved</Badge>
                            ) : a.status === 'rejected' ? (
                              <Badge variant="danger">Rejected</Badge>
                            ) : (
                              <Badge variant="warning">Needs Audit</Badge>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {a.status !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyAchievement(a.id)}
                                  className="btn btn-success btn-sm"
                                >
                                  Approve
                                </button>
                              )}
                              {a.status !== 'rejected' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRejectModal(a.id)}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 12 }}>Criterion 4.6.3 Indexed Achievements</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Total achievements approved for official inclusion in the NBA Self-Assessment Report.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <StatCard label="Total Achievements" value={achievements.filter(a => a.status === 'approved').length} variant="primary" icon={Award} />
                  <StatCard label="Technical Events" value={achievements.filter(a => a.status === 'approved' && a.activity_type === 'technical').length} variant="info" icon={Trophy} />
                  <StatCard label="National Recognitions" value={achievements.filter(a => a.status === 'approved' && a.event_scope === 'national').length} variant="success" icon={Medal} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Modal 1: Register New Student ── */}
        <Modal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title="Enroll Student in Academic Master Roster"
          maxWidth={640}
        >
          <AddStudentForm onClose={() => { setShowForm(false); fetchStudents(); }} />
        </Modal>

        {/* ── Modal 2: Reject Achievement with Reason ── */}
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Achievement Submission"
          maxWidth={480}
          footer={
            <>
              <button type="button" onClick={() => setShowRejectModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmReject} className="btn btn-danger btn-sm">
                Confirm Rejection
              </button>
            </>
          }
        >
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12 }}>
              Please state why this achievement proof is rejected. The reason will be returned to the student for correction.
            </p>
            <div className="form-group">
              <label className="form-label">Rejection Justification *</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={rejectionReasonInput}
                onChange={e => setRejectionReasonInput(e.target.value)}
                required
              />
            </div>
          </div>
        </Modal>

        {/* ── Modal 3: Log Achievement on Behalf of Student ── */}
        <Modal
          isOpen={showAdminAchievementModal}
          onClose={() => setShowAdminAchievementModal(false)}
          title="Record Co-Curricular Achievement (Faculty Entry)"
          maxWidth={640}
        >
          <form onSubmit={handleAdminAchievementSubmit}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Student Roll Number (USN) *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={adminAchievementForm.student_id}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, student_id: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Smart India Hackathon 2025"
                  value={adminAchievementForm.event_name}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, event_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Organizing Institution *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. AICTE / MoE Govt of India"
                  value={adminAchievementForm.organizing_body}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, organizing_body: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Venue / City *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. IIT Kharagpur"
                  value={adminAchievementForm.venue}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, venue: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Activity Type</label>
                <select
                  className="form-select"
                  value={adminAchievementForm.activity_type}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, activity_type: e.target.value })}
                >
                  <option value="technical">Technical / Hackathon</option>
                  <option value="sports">Sports & Athletics</option>
                  <option value="cultural">Cultural & Arts</option>
                  <option value="outreach">Community Outreach</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Event Scope</label>
                <select
                  className="form-select"
                  value={adminAchievementForm.event_scope}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, event_scope: e.target.value })}
                >
                  <option value="state">State Level</option>
                  <option value="national">National Level</option>
                  <option value="international">International Level</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Event Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={adminAchievementForm.event_date}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, event_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prize / Result Summary *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. 1st Place & ₹1,00,000 Cash Prize"
                  value={adminAchievementForm.result_description}
                  onChange={e => setAdminAchievementForm({ ...adminAchievementForm, result_description: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">Proof Document (PDF or Photo Certificate) *</label>
              <input
                type="file"
                className="form-input"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={e => setAdminProofFile(e.target.files[0] || null)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowAdminAchievementModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={savingAdminAchievement} className="btn btn-primary btn-sm">
                {savingAdminAchievement ? 'Saving…' : 'Record Achievement'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}

function AddStudentForm({ onClose }) {
  const [data, setData] = useState({
    student_id: '',
    name: '',
    email: '',
    phone: '',
    semester: 3,
    section: 'A',
    previous_gpa: '',
    backlogs: 0,
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setData(prev => ({ ...prev, [k]: v }))

  const submit = async e => {
    e.preventDefault()
    if (!data.student_id.trim() || !data.name.trim()) {
      toast.error('Student ID and Full Name are required')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...data,
        previous_gpa: data.previous_gpa ? parseFloat(data.previous_gpa) : 0.0,
        backlogs: parseInt(data.backlogs || 0, 10),
      }
      await studentsAPI.create(payload)
      toast.success(`Student ${data.name} enrolled in Semester ${data.semester} Section ${data.section}`)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrollment failed')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Roll Number (USN) *</label>
          <input
            type="text"
            className="form-input"
            value={data.student_id}
            onChange={e => set('student_id', e.target.value)}
            placeholder="e.g. STU101"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            type="text"
            className="form-input"
            value={data.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Priya Sharma"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Institutional Email</label>
          <input
            type="email"
            className="form-input"
            value={data.email}
            onChange={e => set('email', e.target.value)}
            placeholder="priya@student.academiq.edu"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone (Masked in UI)</label>
          <input
            type="tel"
            className="form-input"
            value={data.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="9876543210"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Enrolling Semester</label>
          <select
            className="form-select"
            value={data.semester}
            onChange={e => set('semester', parseInt(e.target.value, 10))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Class Section</label>
          <select
            className="form-select"
            value={data.section}
            onChange={e => set('section', e.target.value)}
          >
            <option value="A">Section A</option>
            <option value="B">Section B</option>
            <option value="C">Section C</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Cumulative CGPA</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="10"
            className="form-input"
            value={data.previous_gpa}
            onChange={e => set('previous_gpa', e.target.value)}
            placeholder="e.g. 8.25"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Standing Backlogs</label>
          <input
            type="number"
            min="0"
            max="15"
            className="form-input"
            value={data.backlogs}
            onChange={e => set('backlogs', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? 'Enrolling…' : 'Enroll Student'}
        </button>
      </div>
    </form>
  )
}
