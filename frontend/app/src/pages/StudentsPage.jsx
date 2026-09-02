import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, predictAPI, placementsAPI, achievementsAPI } from '../api/client'
import { Search, Plus, ChevronRight, AlertTriangle, Users, Filter,
         Briefcase, ShieldCheck, CheckCircle2, ExternalLink, Clock, Unlock, Award,
         Trophy, Medal, FileCheck, XCircle, Image, Tag, X, Check, Eye, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const RISK_COLOR = { High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-success', none: 'badge-neutral' }

const SECTION_META = {
  A: { label: 'Section A', sem: 'Sem 3', color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' },
  B: { label: 'Section B', sem: 'Sem 5', color: '#7c5df7', bg: 'rgba(124,93,247,0.12)' },
  C: { label: 'Section C', sem: 'Sem 7', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
}

export default function StudentsPage() {
  const [activeTab, setActiveTab]   = useState('students')
  const [students, setStudents]     = useState([])
  const [risks, setRisks]           = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [semFilter, setSemFilter]   = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
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
  const [achievementSubTab, setAchievementSubTab] = useState('queue') // 'queue' | 'report'
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
      await placementsAPI.verify(id)
      toast.success('Placement verified! Count updated in Criterion 4 index.')
      fetchPlacements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleUnverifyPlacement = async (id) => {
    try {
      await placementsAPI.unverify(id)
      toast.success('Placement reopened for student revisions.')
      fetchPlacements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reopen')
    }
  }

  const handleVerifyAchievement = async (id) => {
    try {
      await achievementsAPI.verify(id)
      toast.success('Achievement verified! Added to Criterion 4.6.3 report.')
      fetchAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleOpenRejectModal = (id) => {
    setSelectedRejectAchId(id)
    setRejectionReasonInput('Proof document insufficient or event criteria not met.')
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedRejectAchId) return
    try {
      await achievementsAPI.reject(selectedRejectAchId, {
        rejection_reason: rejectionReasonInput.trim(),
      })
      toast.success('Achievement rejected with reason noted.')
      setShowRejectModal(false)
      fetchAchievements()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject')
    }
  }

  const handleAdminAchievementSubmit = async (e) => {
    e.preventDefault()
    if (!adminAchievementForm.student_id.trim() || !adminAchievementForm.event_name.trim() || !adminAchievementForm.organizing_body.trim() || !adminAchievementForm.venue.trim() || !adminAchievementForm.result_description.trim()) {
      toast.error('Please complete all required fields.')
      return
    }
    if (!adminProofFile) {
      toast.error('Proof certificate document is required.')
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
            <h1 className="page-title">👥 Students & Placements</h1>
            <p className="page-desc">
              {activeTab === 'students' ? (
                <>
                  {students.length} students shown
                  {highRiskCount > 0 && <> · <span style={{ color: 'var(--red)', fontWeight: 600 }}>{highRiskCount} high risk</span></>}
                </>
              ) : (
                <>
                  Graduating Cohort {cohortFilter} Verification Roster · Criterion 4.5 Placement Index
                </>
              )}
            </p>
          </div>
          {activeTab === 'students' && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Add Student
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav" style={{ marginTop: 14, marginBottom: 0 }}>
          <button
            className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => setActiveTab('students')}
          >
            <Users size={15} /> All Students Roster
          </button>
          <button
            className={`tab-btn ${activeTab === 'placements' ? 'active' : ''}`}
            onClick={() => setActiveTab('placements')}
          >
            <Briefcase size={15} /> Placements & Criterion 4.5
          </button>
          <button
            className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            <Trophy size={15} /> Student Achievements (Criterion 4.6.3)
          </button>
        </div>


        {/* ── Section summary cards (Students Tab) ── */}
        {activeTab === 'students' && (
          <>
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
          </>
        )}
      </div>

      <div className="page-body">
        {/* ── PLACEMENTS TAB VIEW ────────────────────────────────────────── */}
        {activeTab === 'placements' && (
          <div>
            {/* ── Table B.4.8 Assessment Scorecard & 4-Year Breakdown ── */}
            {placementSummary && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                {/* Scorecard Hero Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div style={{ padding: '16px 20px', background: 'rgba(52,211,153,0.12)', border: '1.5px solid rgba(52,211,153,0.35)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#34d399' }}>
                        Criterion 4.5 Assessment
                      </span>
                      <Award size={18} color="#34d399" />
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                      {placementSummary.assessment} <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600 }}>/ {placementSummary.max_marks} Marks</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Formula: <strong>40 × Average Placement Index (P<sub>avg</sub>)</strong>
                    </div>
                  </div>

                  <div style={{ padding: '16px 20px', background: 'rgba(79,142,247,0.12)', border: '1.5px solid rgba(79,142,247,0.35)', borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent)' }}>
                        Average Placement Index (P<sub>avg</sub>)
                      </span>
                      <Briefcase size={18} color="var(--accent)" />
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
                      {placementSummary.average_placement_pct}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Averaged across {placementSummary.years_available} of {placementSummary.years_count} cohort cycles
                    </div>
                  </div>

                  <div style={{ padding: '16px 20px', background: placementSummary.is_provisional ? 'rgba(245,158,11,0.12)' : 'var(--bg-800)', border: `1.5px solid ${placementSummary.is_provisional ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: placementSummary.is_provisional ? '#f59e0b' : '#34d399' }}>
                        SAR Data Status
                      </span>
                      <ShieldCheck size={18} color={placementSummary.is_provisional ? '#f59e0b' : '#34d399'} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: placementSummary.is_provisional ? '#f59e0b' : 'var(--text-primary)', marginTop: 8 }}>
                      {placementSummary.is_provisional ? '⚠️ PROVISIONAL EVALUATION' : '✅ 4-YEAR FULL SAR AUDIT'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {placementSummary.provisional_notice || 'All 4 cohort years verified according to NBA SAR Table B.4.8 standard.'}
                    </div>
                  </div>
                </div>

                {/* Table B.4.8 Matrix */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 16 }}>
                  <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        Table B.4.8 — Placement, Higher Studies and Entrepreneurship (Criterion 4.5)
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Multi-year evaluation across CAY, LYG, LYGm1, and LYGm2 cohorts
                      </div>
                    </div>
                    {placementSummary.is_provisional && (
                      <span className="status-badge pending" style={{ fontSize: 10 }}>
                        Provisional ({placementSummary.years_available}/4 Years)
                      </span>
                    )}
                  </div>

                  <div className="table-wrapper" style={{ margin: 0 }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ minWidth: 220 }}>Item / Assessment Parameter</th>
                          {placementSummary.years?.map(y => (
                            <th key={y.cohort_year} style={{ textAlign: 'center', minWidth: 120 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{y.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cohort {y.cohort_year}</div>
                            </th>
                          ))}
                          <th style={{ textAlign: 'center', minWidth: 140, background: 'rgba(79,142,247,0.08)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent)' }}>Average / Assessment</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>4-Year Benchmark</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total Final Year Students (N)</td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', fontWeight: 600 }}>
                              {y.final_year_cohort_total}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', background: 'rgba(79,142,247,0.04)' }}>
                            {Math.round(placementSummary.years.reduce((acc, y) => acc + y.final_year_cohort_total, 0) / (placementSummary.years.length || 1))} (avg)
                          </td>
                        </tr>

                        <tr>
                          <td>No. of Students Placed in Companies/Govt (x)</td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', color: '#34d399', fontWeight: 600 }}>
                              {y.verified_placed}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', color: '#34d399', fontWeight: 700, background: 'rgba(79,142,247,0.04)' }}>
                            {placementSummary.years.reduce((acc, y) => acc + y.verified_placed, 0)} (total)
                          </td>
                        </tr>

                        <tr>
                          <td>No. of Students Admitted to Higher Studies (y)</td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', color: '#7c5df7', fontWeight: 600 }}>
                              {y.verified_higher_studies}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', color: '#7c5df7', fontWeight: 700, background: 'rgba(79,142,247,0.04)' }}>
                            {placementSummary.years.reduce((acc, y) => acc + y.verified_higher_studies, 0)} (total)
                          </td>
                        </tr>

                        <tr>
                          <td>No. of Students Turned Entrepreneur (z)</td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 600 }}>
                              {y.verified_entrepreneurs}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700, background: 'rgba(79,142,247,0.04)' }}>
                            {placementSummary.years.reduce((acc, y) => acc + y.verified_entrepreneurs, 0)} (total)
                          </td>
                        </tr>

                        <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Career Positive (x + y + z)</td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {y.verified_career_positive_total}
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-primary)', background: 'rgba(79,142,247,0.06)' }}>
                            {placementSummary.years.reduce((acc, y) => acc + y.verified_career_positive_total, 0)}
                          </td>
                        </tr>

                        <tr style={{ background: 'rgba(79,142,247,0.06)', borderTop: '2px solid rgba(79,142,247,0.2)' }}>
                          <td style={{ fontWeight: 800, color: 'var(--accent)' }}>
                            Placement Index (P = [x + y + z] / N)
                          </td>
                          {placementSummary.years?.map(y => (
                            <td key={y.cohort_year} style={{ textAlign: 'center', fontWeight: 800, color: 'var(--accent)', fontSize: 14 }}>
                              {y.placement_index_pct}%
                            </td>
                          ))}
                          <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--accent)', fontSize: 15, background: 'rgba(79,142,247,0.12)' }}>
                            {placementSummary.average_placement_pct}% (P<sub>avg</sub>)
                          </td>
                        </tr>

                        <tr style={{ background: 'rgba(52,211,153,0.08)', borderTop: '1.5px solid rgba(52,211,153,0.3)' }}>
                          <td style={{ fontWeight: 800, color: '#34d399' }}>
                            Assessment Score = 40 × P<sub>avg</sub>
                          </td>
                          <td colSpan={placementSummary.years?.length || 4} style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', paddingRight: 20 }}>
                            Evaluated across {placementSummary.years_available} cohort cycle(s) (Max 40.0 Marks)
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 900, color: '#34d399', fontSize: 16, background: 'rgba(52,211,153,0.18)' }}>
                            {placementSummary.assessment} / 40
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}


            {/* Filter Bar for Placements */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <select
                  className="input"
                  style={{ width: 180 }}
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(Number(e.target.value))}
                >
                  <option value={2026}>Cohort Batch 2026 (Sem 7/8)</option>
                  <option value={2025}>Cohort Batch 2025</option>
                  <option value={2024}>Cohort Batch 2024</option>
                </select>

                <select
                  className="input"
                  style={{ width: 160 }}
                  value={placementStatusFilter}
                  onChange={(e) => setPlacementStatusFilter(e.target.value)}
                >
                  <option value="all">All Outcomes</option>
                  <option value="placed">Placed (Campus/Off-campus)</option>
                  <option value="higher_studies">Higher Studies</option>
                  <option value="entrepreneur">Entrepreneur</option>
                  <option value="not_placed">Not Placed</option>
                </select>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {placements.filter(p => placementStatusFilter === 'all' || p.status === placementStatusFilter).length} student records found
              </div>
            </div>

            {/* Placements Table */}
            {loadingPlacements ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
              </div>
            ) : placements.length === 0 ? (
              <div className="card text-center" style={{ padding: 48 }}>
                <Briefcase size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 600, fontSize: 15 }}>No Placement Records Found</div>
                <p className="text-muted text-xs" style={{ marginTop: 4 }}>
                  Students can submit placement and offer letter details directly from their student profile.
                </p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Company / Institution</th>
                      <th>Role / Degree</th>
                      <th>CTC / Package</th>
                      <th>Offer Letter</th>
                      <th>Verification</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placements
                      .filter(p => placementStatusFilter === 'all' || p.status === placementStatusFilter)
                      .map(p => (
                        <tr key={p.id}>
                          <td onClick={() => navigate(`/students/${p.student_id}`)} style={{ cursor: 'pointer' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.student?.name || p.student_id}</div>
                            <div className="text-xs text-muted font-mono">{p.student_id} • Sec {p.student?.section || 'C'}</div>
                          </td>
                          <td>
                            <span style={{
                              textTransform: 'capitalize',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: p.status === 'placed' ? 'rgba(52,211,153,0.15)' :
                                         p.status === 'higher_studies' ? 'rgba(124,93,247,0.15)' :
                                         p.status === 'entrepreneur' ? 'rgba(232,201,110,0.15)' : 'rgba(255,255,255,0.06)',
                              color: p.status === 'placed' ? '#34d399' :
                                     p.status === 'higher_studies' ? '#7c5df7' :
                                     p.status === 'entrepreneur' ? '#e8c96e' : 'var(--text-muted)',
                            }}>
                              {p.status?.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{p.company_or_institution || '—'}</td>
                          <td className="text-muted text-sm">{p.role_or_program || '—'}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{p.ctc_or_stipend || '—'}</td>
                          <td>
                            {p.offer_letter_path ? (
                              <a
                                href={`/api/v1/offer-letters/${p.offer_letter_path}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                              >
                                <ExternalLink size={12} /> View Document
                              </a>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None</span>
                            )}
                          </td>
                          <td>
                            {p.verified_by_admin ? (
                              <span className="status-badge approved" style={{ fontSize: 10 }}>
                                <ShieldCheck size={11} /> Verified
                              </span>
                            ) : (
                              <span className="status-badge pending" style={{ fontSize: 10 }}>
                                <Clock size={11} /> Pending
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {!p.verified_by_admin ? (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleVerifyPlacement(p.id)}
                              >
                                <CheckCircle2 size={13} /> Verify
                              </button>
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleUnverifyPlacement(p.id)}
                                title="Reopen verification to allow student edits"
                              >
                                <Unlock size={13} /> Reopen
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
        )}

        {/* ── STUDENT ACHIEVEMENTS TAB VIEW (CRITERION 4.6.3) ──────── */}
        {activeTab === 'achievements' && (


          <div>
            {/* Top Toolbar & Sub-tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${achievementSubTab === 'queue' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setAchievementSubTab('queue')}
                >
                  <Clock size={14} /> Verification Queue & Submissions ({achievements.length})
                </button>
                <button
                  className={`btn ${achievementSubTab === 'report' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setAchievementSubTab('report')}
                >
                  <Trophy size={14} /> Unified NBA SAR Report Table (Criterion 4.6.3)
                </button>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdminAchievementModal(true)}
              >
                <Plus size={14} /> Record Achievement (Manual Entry)
              </button>
            </div>

            {/* ── Sub-tab 1: Verification Queue ────────────────────────────── */}
            {achievementSubTab === 'queue' && (
              <div>
                {/* Filter bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10, background: 'var(--bg-800)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter:</span>
                    <select
                      className="input"
                      style={{ width: 160, padding: '4px 8px', height: 32, fontSize: 12 }}
                      value={achievementStatusFilter}
                      onChange={(e) => setAchievementStatusFilter(e.target.value)}
                    >
                      <option value="pending">Pending Verification</option>
                      <option value="verified">Verified Only</option>
                      <option value="rejected">Rejected Only</option>
                      <option value="all">All Statuses</option>
                    </select>

                    <select
                      className="input"
                      style={{ width: 140, padding: '4px 8px', height: 32, fontSize: 12 }}
                      value={achievementTypeFilter}
                      onChange={(e) => setAchievementTypeFilter(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      <option value="technical">Technical</option>
                      <option value="sports">Sports</option>
                      <option value="cultural">Cultural</option>
                      <option value="other">Other</option>
                    </select>

                    <select
                      className="input"
                      style={{ width: 130, padding: '4px 8px', height: 32, fontSize: 12 }}
                      value={achievementYearFilter}
                      onChange={(e) => setAchievementYearFilter(e.target.value)}
                    >
                      <option value="all">All Academic Years</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2024-25">2024-25</option>
                      <option value="2023-24">2023-24</option>
                    </select>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {achievements.length} records matching filter
                  </div>
                </div>

                {/* Queue Table */}
                {loadingAchievements ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
                  </div>
                ) : achievements.length === 0 ? (
                  <div className="card text-center" style={{ padding: 48 }}>
                    <Trophy size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, fontSize: 15 }}>No Achievement Records in this Filter</div>
                    <p className="text-muted text-xs" style={{ marginTop: 4 }}>
                      Select a different status or filter, or record a new achievement.
                    </p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ minWidth: 180 }}>Student / Team</th>
                          <th>Category & Scope</th>
                          <th style={{ minWidth: 200 }}>Event & Organizer</th>
                          <th style={{ minWidth: 180 }}>Award / Result</th>
                          <th>Proof Document</th>
                          <th>Photos</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right', minWidth: 150 }}>Verification Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {achievements.map(ach => {
                          const isVerified = ach.verification_status === 'verified'
                          const isRejected = ach.verification_status === 'rejected'
                          const isPending = ach.verification_status === 'pending'

                          return (
                            <tr key={ach.id}>
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {ach.student?.name || ach.student_id}
                                </div>
                                <div className="text-xs text-muted font-mono">
                                  {ach.student_id} • Sec {ach.student?.section || 'A'}
                                </div>
                                {ach.is_team && (
                                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 10, background: 'rgba(124,93,247,0.15)', color: '#a78bfa', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                                      Team of {ach.team_size}
                                    </span>
                                    {ach.team_members?.filter(m => m.student_id !== ach.student_id).map(m => (
                                      <span key={m.student_id} style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '1px 4px', borderRadius: 3 }}>
                                        {m.student_id}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', width: 'fit-content',
                                    background: ach.activity_type === 'technical' ? 'rgba(79,142,247,0.15)' :
                                               ach.activity_type === 'sports' ? 'rgba(52,211,153,0.15)' :
                                               ach.activity_type === 'cultural' ? 'rgba(232,201,110,0.15)' : 'rgba(255,255,255,0.06)',
                                    color: ach.activity_type === 'technical' ? 'var(--accent)' :
                                           ach.activity_type === 'sports' ? '#34d399' :
                                           ach.activity_type === 'cultural' ? 'var(--gold)' : 'var(--text-muted)',
                                  }}>
                                    {ach.activity_type}
                                  </span>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                    {ach.event_scope?.replace('_', ' ')}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ach.event_name}</div>
                                <div className="text-muted text-xs">{ach.organizing_body}</div>
                                <div className="text-muted text-xs">{ach.venue} • {ach.event_date ? new Date(ach.event_date).toLocaleDateString() : ''}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 12 }}>
                                  {ach.result_description}
                                </div>
                                {ach.remarks && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                                    "{ach.remarks}"
                                  </div>
                                )}
                              </td>
                              <td>
                                {ach.proof_file_path ? (
                                  <a
                                    href={`/api/v1/achievement-proofs/${ach.proof_file_path}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                                  >
                                    <FileCheck size={13} /> View Certificate
                                  </a>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None</span>
                                )}
                              </td>
                              <td>
                                {ach.photo_paths?.length > 0 ? (
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {ach.photo_paths.map((p, idx) => (
                                      <a
                                        key={idx}
                                        href={`/api/v1/achievement-photos/${p}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ display: 'inline-block', width: 32, height: 32, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}
                                      >
                                        <img
                                          src={`/api/v1/achievement-photos/${p}`}
                                          alt="Photo"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          onError={(e) => { e.target.style.display = 'none' }}
                                        />
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                {isVerified ? (
                                  <span className="status-badge approved" style={{ fontSize: 10 }}>
                                    <ShieldCheck size={11} /> Verified
                                  </span>
                                ) : isRejected ? (
                                  <span className="status-badge rejected" style={{ fontSize: 10 }} title={ach.rejection_reason}>
                                    <AlertCircle size={11} /> Rejected
                                  </span>
                                ) : (
                                  <span className="status-badge pending" style={{ fontSize: 10 }}>
                                    <Clock size={11} /> Pending
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {isPending ? (
                                  <div style={{ display: 'inline-flex', gap: 6 }}>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleVerifyAchievement(ach.id)}
                                      title="Verify achievement for accreditation report"
                                    >
                                      <CheckCircle2 size={13} /> Verify
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ color: 'var(--red)' }}
                                      onClick={() => handleOpenRejectModal(ach.id)}
                                      title="Reject with remarks"
                                    >
                                      <XCircle size={13} /> Reject
                                    </button>
                                  </div>
                                ) : isRejected ? (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleVerifyAchievement(ach.id)}
                                    title="Re-verify this submission"
                                  >
                                    Re-verify
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    Verified by {ach.verified_by || 'Faculty'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Sub-tab 2: Unified NBA SAR Report View (Section 4.6.3) ── */}
            {achievementSubTab === 'report' && (
              <div>
                {/* Header Banner */}
                <div style={{ padding: '16px 20px', background: 'rgba(232,201,110,0.1)', border: '1.5px solid rgba(232,201,110,0.3)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Trophy size={18} color="var(--gold)" />
                    <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                      Criterion 4 — Section 4.6.3: Student Participation in Inter-Institute Events
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong>NBA Standard Format:</strong> Technical, Sports, and Cultural achievements are consolidated into <strong>one unified table grouped by Academic Year</strong>. Only records verified by faculty/admin are included in accreditation reports.
                  </div>
                </div>


                {achievementsReport?.unified_by_year?.length === 0 ? (
                  <div className="card text-center" style={{ padding: 48 }}>
                    <Trophy size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                    <div style={{ fontWeight: 600, fontSize: 15 }}>No Verified Achievements in Report</div>
                    <p className="text-muted text-xs" style={{ marginTop: 4 }}>
                      Achievements will populate here once verified in the Verification Queue.
                    </p>
                  </div>
                ) : (
                  achievementsReport?.unified_by_year?.map((yearGroup, yIdx) => (
                    <div key={yIdx} className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 20 }}>
                      <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>
                            Academic Year {yearGroup.academic_year}
                          </span>
                          <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                            {yearGroup.total_achievements} Verified Achievements
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{yearGroup.technical_count} Technical</span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ color: '#34d399', fontWeight: 600 }}>{yearGroup.sports_count} Sports</span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{yearGroup.cultural_count} Cultural</span>
                        </div>
                      </div>

                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th style={{ width: 40, textAlign: 'center' }}>#</th>
                              <th style={{ minWidth: 160 }}>Student(s) / Team</th>
                              <th style={{ minWidth: 180 }}>Event & Organizing Body</th>
                              <th>Category</th>
                              <th>Scope</th>
                              <th>Date & Venue</th>
                              <th style={{ minWidth: 180 }}>Award / Position</th>
                              <th>Proof</th>
                              <th>Photos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {yearGroup.achievements?.map((ach, idx) => (
                              <tr key={ach.id}>
                                <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {ach.student?.name || ach.student_id}
                                  </div>
                                  <div className="text-xs text-muted font-mono">{ach.student_id}</div>
                                  {ach.is_team && (
                                    <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}>
                                      Team: {ach.team_members?.map(m => m.name || m.student_id).join(', ')}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ach.event_name}</div>
                                  <div className="text-muted text-xs">{ach.organizing_body}</div>
                                </td>
                                <td>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                                    background: ach.activity_type === 'technical' ? 'rgba(79,142,247,0.15)' :
                                               ach.activity_type === 'sports' ? 'rgba(52,211,153,0.15)' :
                                               ach.activity_type === 'cultural' ? 'rgba(232,201,110,0.15)' : 'rgba(255,255,255,0.06)',
                                    color: ach.activity_type === 'technical' ? 'var(--accent)' :
                                           ach.activity_type === 'sports' ? '#34d399' :
                                           ach.activity_type === 'cultural' ? 'var(--gold)' : 'var(--text-muted)',
                                  }}>
                                    {ach.activity_type}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: 11, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                                    {ach.event_scope?.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ach.event_date ? new Date(ach.event_date).toLocaleDateString() : ''}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ach.venue}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 12 }}>
                                    {ach.result_description}
                                  </div>
                                </td>
                                <td>
                                  {ach.proof_file_path && (
                                    <a
                                      href={`/api/v1/achievement-proofs/${ach.proof_file_path}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
                                    >
                                      <FileCheck size={12} /> Certificate
                                    </a>
                                  )}
                                </td>
                                <td>
                                  {ach.photo_paths?.length > 0 ? (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      {ach.photo_paths.map((p, pIdx) => (
                                        <a
                                          key={pIdx}
                                          href={`/api/v1/achievement-photos/${p}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ display: 'inline-block', width: 28, height: 28, borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)' }}
                                        >
                                          <img
                                            src={`/api/v1/achievement-photos/${p}`}
                                            alt="Photo"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => { e.target.style.display = 'none' }}
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ALL STUDENTS ROSTER VIEW ──────────────────────────────────── */}
        {activeTab === 'students' && (

          <div>
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
                      <th>Current SGPA</th>
                      <th>Past CGPA</th>
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
                              color: s.sgpa >= 8.5 ? '#10b981' : s.sgpa >= 7.0 ? '#3b82f6' : s.sgpa >= 5.5 ? '#f59e0b' : s.sgpa ? '#ef4444' : 'var(--text-muted)'
                            }}>
                              {s.sgpa ? s.sgpa.toFixed(2) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Pending</span>}
                            </span>
                          </td>
                          <td>{s.previous_gpa ? s.previous_gpa.toFixed(2) : '—'}</td>

                          <td>
                            {s.backlogs > 0 ? (
                              <span style={{ color: 'var(--red)', fontWeight: 700 }}>{s.backlogs}</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>0</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${
                              s.engagement === 'High' ? 'badge-success' :
                              s.engagement === 'Medium' ? 'badge-warning' : 'badge-danger'
                            }`}>
                              {s.engagement}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${s.final_result === 'Pass' ? 'badge-success' : 'badge-danger'}`}>
                              {s.final_result || '—'}
                            </span>
                          </td>
                          <td>
                            {risk ? (
                              <span className={`badge ${RISK_COLOR[risk.risk_level] || 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                {risk.risk_level === 'High' && <AlertTriangle size={11} />}
                                {risk.risk_level}
                              </span>
                            ) : <span className="badge badge-neutral">—</span>}
                          </td>
                          <td>
                            <ChevronRight size={16} color="var(--text-muted)" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── REJECTION REASON MODAL ──────────────────────────────────── */}
        {showRejectModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
            <div style={{
              background: 'var(--bg-800)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 480,
              padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={20} color="var(--red)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reject Achievement Submission</h3>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRejectModal(false)}
                  style={{ padding: '4px 8px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-muted text-xs" style={{ marginBottom: 12 }}>
                Please provide a constructive reason for the student. They will see this feedback and can revise and re-upload their proof.
              </p>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Reason / Required Correction *</label>
                <textarea
                  className="input"
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. Certificate image is blurry; please upload a clear scanned PDF showing the official seal and organizer signature."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleConfirmReject}
                  disabled={!rejectionReasonInput.trim()}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── ADMIN / WORKER RECORD ACHIEVEMENT MODAL ────────────────── */}
        {showAdminAchievementModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
            <div style={{
              background: 'var(--bg-800)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 640,
              maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={20} color="var(--gold)" />
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Record Student Achievement (Admin / Worker Fallback)
                  </h3>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAdminAchievementModal(false)}
                  style={{ padding: '4px 8px' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAdminAchievementSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Primary Student ID *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. STU069"
                      value={adminAchievementForm.student_id}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, student_id: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Activity Category *</label>
                    <select
                      className="input"
                      value={adminAchievementForm.activity_type}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, activity_type: e.target.value })}
                    >
                      <option value="technical">Technical (Hackathons, Coding, Robotics)</option>
                      <option value="sports">Sports & Athletics</option>
                      <option value="cultural">Cultural & Arts</option>
                      <option value="other">Other / Literary</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Event / Competition Name *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. Smart India Hackathon 2026, VTU Athletic Meet"
                      value={adminAchievementForm.event_name}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, event_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Organizing Body / Institute *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. AICTE, IIT Bombay, VTU"
                      value={adminAchievementForm.organizing_body}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, organizing_body: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Event Scope *</label>
                    <select
                      className="input"
                      value={adminAchievementForm.event_scope}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, event_scope: e.target.value })}
                    >
                      <option value="within_state">Within State</option>
                      <option value="outside_state">Outside State</option>
                      <option value="national">National Level</option>
                      <option value="international">International Level</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Event Date *</label>
                    <input
                      type="date"
                      className="input"
                      required
                      value={adminAchievementForm.event_date}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, event_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Academic Year *</label>
                    <select
                      className="input"
                      value={adminAchievementForm.academic_year}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, academic_year: e.target.value })}
                    >
                      <option value="2025-26">2025-26 (CAY)</option>
                      <option value="2024-25">2024-25</option>
                      <option value="2023-24">2023-24</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Venue / Location *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. IIT Roorkee, Uttarakhand"
                      value={adminAchievementForm.venue}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, venue: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Award / Result Description *</label>
                    <input
                      type="text"
                      className="input"
                      required
                      placeholder="e.g. 1st Prize & ₹1,00,000 Cash Award"
                      value={adminAchievementForm.result_description}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, result_description: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>
                      Team Member Student IDs (optional, comma-separated)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. STU069, STU070, STU073"
                      value={adminAchievementForm.student_ids}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, student_ids: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Remarks / Project Abstract (optional)</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="Brief remarks or project scope..."
                      value={adminAchievementForm.remarks}
                      onChange={(e) => setAdminAchievementForm({ ...adminAchievementForm, remarks: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Certificate / Proof Document *</label>
                    <input
                      type="file"
                      className="input"
                      required
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      onChange={(e) => setAdminProofFile(e.target.files[0] || null)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Event Photos (optional, multiple)</label>
                    <input
                      type="file"
                      className="input"
                      multiple
                      accept="image/*"
                      onChange={(e) => setAdminPhotoFiles(Array.from(e.target.files || []))}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAdminAchievementModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingAdminAchievement}
                  >
                    <Trophy size={15} /> {savingAdminAchievement ? 'Saving...' : 'Record Achievement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
      toast.success(`Student ${data.name} enrolled for Semester ${data.semester} Sec ${data.section}!`)
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
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>➕ Enroll New Student (Semester Registration)</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Students are registered at the start of the semester. Curriculum courses are linked automatically, and CIE marks/attendance are updated by course teachers once tests and sessions occur.
          </span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
      </div>

      <form onSubmit={submit}>
        <div className="grid-3" style={{ gap: 14 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Student ID (USN) *</label>
            <input
              type="text"
              className="form-input"
              value={data.student_id}
              onChange={e => set('student_id', e.target.value)}
              placeholder="e.g. STU101 or 1MS23CS101"
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
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

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={data.email}
              onChange={e => set('email', e.target.value)}
              placeholder="e.g. priya@student.academiq.edu"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              value={data.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Enrolling Semester *</label>
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

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Class Section *</label>
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

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Past Cumulative CGPA</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="form-input"
              value={data.previous_gpa}
              onChange={e => set('previous_gpa', e.target.value)}
              placeholder="e.g. 7.85 (leave blank if 1st Sem)"
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Historical CGPA before current semester</span>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
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
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Standing backlogs from prior semesters</span>
          </div>
        </div>

        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>💡 <strong>Academic Workflow:</strong> CIE 1, CIE 2, Quizzes, Experiential Learning, and Daily Attendance are recorded live by course faculty as sessions and tests take place via the <strong>Classes & Marks</strong> portal.</span>
        </div>

        <div className="flex justify-end gap-sm mt-md">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enrolling…' : 'Enroll Student'}
          </button>
        </div>
      </form>
    </div>
  )
}


