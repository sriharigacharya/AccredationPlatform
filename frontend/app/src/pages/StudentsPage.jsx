import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, placementsAPI, achievementsAPI, sectionsAPI, enrollmentsAPI } from '../api/client'
import {
  Search, Plus, ChevronRight, ChevronLeft, AlertTriangle, Users, Filter,
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

const COHORT_META = [
  { sem: 1, label: 'Year I · Semester 1', desc: 'Class of 2028 · 150 Students (CSE & AIML)' },
  { sem: 3, label: 'Year II · Semester 3', desc: 'Class of 2027 · 150 Students (CSE & AIML)' },
  { sem: 5, label: 'Year III · Semester 5', desc: 'Class of 2026 · 150 Students (CSE & AIML)' },
  { sem: 7, label: 'Year IV · Semester 7', desc: 'Class of 2025 · 150 Students (CSE & AIML)' },
]

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
  const [achievementStatusFilter, setAchievementStatusFilter] = useState('all')
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

  // Bulk Student CSV Import state (Feature 7)
  const [showBulkImportModal, setShowBulkImportModal] = useState(false)
  const [bulkCsvFile, setBulkCsvFile] = useState(null)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkImportResult, setBulkImportResult] = useState(null)

  // Admin Log Placement state (Feature 6)
  const [showAdminPlacementModal, setShowAdminPlacementModal] = useState(false)
  const [adminPlacementForm, setAdminPlacementForm] = useState({
    student_id: '',
    status: 'placed',
    company_or_institution: '',
    role_or_program: '',
    ctc_or_stipend: '',
    academic_year: '2025-26',
    final_year_cohort_year: 2026,
  })
  const [adminOfferFile, setAdminOfferFile] = useState(null)
  const [savingAdminPlacement, setSavingAdminPlacement] = useState(false)

  // Section Enrollments state (Feature 4)
  const [sections, setSections] = useState([])
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('2024-25-EVEN')
  const [enrollments, setEnrollments] = useState([])
  const [loadingEnrollments, setLoadingEnrollments] = useState(false)

  const [showSingleEnrollModal, setShowSingleEnrollModal] = useState(false)
  const [singleEnrollStudentId, setSingleEnrollStudentId] = useState('')
  const [singleEnrollSectionId, setSingleEnrollSectionId] = useState('')
  const [savingEnroll, setSavingEnroll] = useState(false)

  const [showBulkEnrollModal, setShowBulkEnrollModal] = useState(false)
  const [bulkEnrollSectionId, setBulkEnrollSectionId] = useState('')
  const [bulkEnrollUsnsText, setBulkEnrollUsnsText] = useState('')
  const [bulkEnrollResult, setBulkEnrollResult] = useState(null)
  const [savingBulkEnroll, setSavingBulkEnroll] = useState(false)

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
      placementsAPI.summary({ cohort_year: cohortFilter }),
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
    } else if (activeTab === 'enrollments') {
      fetchSections()
    }
  }, [activeTab, cohortFilter, achievementStatusFilter, achievementTypeFilter, achievementYearFilter])

  const fetchSections = () => {
    sectionsAPI.list().then(r => {
      setSections(r.data || [])
      if (r.data?.length > 0 && !selectedSectionId) {
        setSelectedSectionId(String(r.data[0].id))
      }
    }).catch(() => {})
  }

  const fetchEnrollments = () => {
    if (!selectedSectionId) return
    setLoadingEnrollments(true)
    enrollmentsAPI.list({ section_id: selectedSectionId, term: selectedTerm })
      .then(r => {
        setEnrollments(r.data || [])
        setLoadingEnrollments(false)
      })
      .catch(() => setLoadingEnrollments(false))
  }

  useEffect(() => {
    if (activeTab === 'enrollments' && selectedSectionId) {
      fetchEnrollments()
    }
  }, [activeTab, selectedSectionId, selectedTerm])

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

  // Build the risks map directly from the DB-persisted ml_risk_* fields
  // that are already present on every student record — no extra API call needed.
  useEffect(() => {
    if (!students.length) return
    const m = {}
    students.forEach(s => {
      const entry = {
        student_id:   s.student_id,
        risk_level:   s.ml_risk_level  || (s.backlogs > 0 || s.attendance_pct < 75 ? 'Medium' : 'Low'),
        risk_score:   s.ml_risk_score  ?? null,
        flags:        s.ml_risk_flags  ? (typeof s.ml_risk_flags === 'string' ? JSON.parse(s.ml_risk_flags) : s.ml_risk_flags) : [],
        low_confidence: s.ml_low_confidence ?? false,
      }
      m[s.student_id] = entry
      m[s.id]         = entry
    })
    setRisks(m)
  }, [students])

  // allStudents is the same list — just alias it so cohort cards work
  const allStudents = students

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  useEffect(() => {
    setCurrentPage(1)
  }, [search, semFilter, sectionFilter, riskFilter])

  const cohortSummary = useMemo(() => {
    const counts = {
      1: { total: 0, pass: 0, fail: 0, meanGpa: '0.00' },
      3: { total: 0, pass: 0, fail: 0, meanGpa: '0.00' },
      5: { total: 0, pass: 0, fail: 0, meanGpa: '0.00' },
      7: { total: 0, pass: 0, fail: 0, meanGpa: '0.00' },
    }
    const gpas = { 1: [], 3: [], 5: [], 7: [] }
    allStudents.forEach(s => {
      const sem = s.semester
      if (!counts[sem]) counts[sem] = { total: 0, pass: 0, fail: 0, meanGpa: '0.00' }
      if (!gpas[sem]) gpas[sem] = []
      counts[sem].total++
      if (s.final_result === 'Pass') {
        counts[sem].pass++
        const g = Number(s.previous_gpa || s.cgpa || 0)
        if (g > 0) gpas[sem].push(g)
      } else if (s.final_result === 'Fail') {
        counts[sem].fail++
      }
    })
    Object.keys(gpas).forEach(sem => {
      if (gpas[sem].length > 0) {
        counts[sem].meanGpa = (gpas[sem].reduce((a, b) => a + b, 0) / gpas[sem].length).toFixed(2)
      }
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

  const totalPages = Math.ceil(displayedStudents.length / pageSize) || 1
  const pagedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return displayedStudents.slice(start, start + pageSize)
  }, [displayedStudents, currentPage, pageSize])
  const placedCount = placementSummary?.placed_count ?? placements.filter(p => p.status === 'placed').length
  const higherCount = placementSummary?.higher_studies_count ?? placements.filter(p => p.status === 'higher_studies').length
  const verifiedCount = placements.filter(p => p.is_verified || p.verified_by_admin).length
  const verifiedRatio = placementSummary?.verified_ratio ?? (placements.length > 0 ? Math.round((verifiedCount / placements.length) * 100) : 0)

  let medCtcText = placementSummary?.median_ctc ? `${placementSummary.median_ctc} LPA` : null
  if (!medCtcText) {
    const ctcs = placements
      .filter(p => p.status === 'placed' && p.ctc_or_stipend)
      .map(p => {
        const m = p.ctc_or_stipend.match(/(\d+(?:\.\d+)?)/)
        return m ? parseFloat(m[1]) : null
      })
      .filter(v => v !== null)
      .sort((a, b) => a - b)
    if (ctcs.length > 0) {
      const mid = Math.floor(ctcs.length / 2)
      const val = ctcs.length % 2 !== 0 ? ctcs[mid] : ((ctcs[mid - 1] + ctcs[mid]) / 2).toFixed(1)
      medCtcText = `${val} LPA`
    } else {
      medCtcText = '—'
    }
  }

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Student Body, Placements & Co-Curriculars"
        description="Comprehensive student records, ML risk predictions, Criterion 4.5 placement verification, and Criterion 4.6.3 achievements audit."
        actions={
          activeTab === 'students' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setBulkCsvFile(null)
                  setBulkImportResult(null)
                  setShowBulkImportModal(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <FileText size={14} />
                <span>Bulk Import CSV</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} />
                <span>Register Student</span>
              </button>
            </div>
          ) : activeTab === 'placements' ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAdminPlacementForm({
                  student_id: '',
                  status: 'placed',
                  company_or_institution: '',
                  role_or_program: '',
                  ctc_or_stipend: '',
                  academic_year: '2025-26',
                  final_year_cohort_year: 2026,
                })
                setAdminOfferFile(null)
                setShowAdminPlacementModal(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Briefcase size={14} />
              <span>Log Placement</span>
            </button>
          ) : activeTab === 'achievements' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdminAchievementModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={14} />
              <span>Log Achievement</span>
            </button>
          ) : activeTab === 'enrollments' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setBulkEnrollSectionId(selectedSectionId || (sections[0]?.id ? String(sections[0].id) : ''))
                  setBulkEnrollUsnsText('')
                  setBulkEnrollResult(null)
                  setShowBulkEnrollModal(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Layers size={14} />
                <span>Bulk Enroll</span>
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSingleEnrollSectionId(selectedSectionId || (sections[0]?.id ? String(sections[0].id) : ''))
                  setSingleEnrollStudentId('')
                  setShowSingleEnrollModal(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} />
                <span>Enroll Student</span>
              </button>
            </div>
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
            { id: 'enrollments', label: 'Section Enrollments', icon: Layers, count: enrollments.length },
          ]}
        />

        {/* ── TAB 1: ALL STUDENTS ── */}
        {activeTab === 'students' && (
          <div>
            {/* Year / Semester Cohort Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 'var(--space-4)' }}>
              {COHORT_META.map(meta => {
                const c = cohortSummary[meta.sem] || { total: 0, pass: 0, fail: 0, meanGpa: '0.00' }
                const isActive = semFilter === String(meta.sem)
                return (
                  <div
                    key={meta.sem}
                    onClick={() => setSemFilter(isActive ? '' : String(meta.sem))}
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
                        {meta.label}
                      </span>
                      <Badge variant="neutral">{c.total} Enrolled</Badge>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--success)' }}>● {c.pass} Pass</span>
                        <span style={{ color: c.fail > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>● {c.fail} Fail</span>
                      </div>
                      {Number(c.meanGpa) > 0 && (
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Mean CGPA: {c.meanGpa}</span>
                      )}
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
                    style={{ width: 145, height: 34, padding: '4px 8px' }}
                    value={sectionFilter}
                    onChange={e => setSectionFilter(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    <option value="A">Section A (CSE)</option>
                    <option value="B">Section B (CSE)</option>
                    <option value="C">Section C (CSE)</option>
                    <option value="D">Section D (CSE)</option>
                    <option value="E">Section E (AIML)</option>
                    <option value="F">Section F (AIML)</option>
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
                    pagedStudents.map(s => {
                      const risk = risks[s.student_id] || risks[s.id]
                      const riskLevel = risk?.risk_level || 'Low'
                      return (
                        <tr key={s.id || s.student_id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.student_id || s.id}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                              {s.is_club_head && (
                                <Badge variant="primary" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                  👑 Club Head{s.lead_clubs?.[0]?.name ? `: ${s.lead_clubs[0].name}` : ''}
                                </Badge>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.email} · 📞 {s.phone || '8660042249'}</div>
                          </td>
                          <td>
                            <Badge variant="neutral">Sem {s.semester} · Sec {s.section}</Badge>
                          </td>
                          <td className="tabular-nums">
                            {(() => {
                              const attVal = Number(s.attendance_pct ?? s.attendance_rate ?? 75)
                              const attColor = attVal < 75 ? 'var(--danger)' : attVal < 85 ? 'var(--warning)' : 'var(--success)'
                              return (
                                <span style={{ fontWeight: 700, color: attColor }}>
                                  {attVal.toFixed(1)}%
                                </span>
                              )
                            })()}
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

            {/* Pagination Controls */}
            {displayedStudents.length > pageSize && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  marginTop: 12,
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {Math.min(currentPage * pageSize, displayedStudents.length)}
                  </strong>{' '}
                  of <strong style={{ color: 'var(--text-primary)' }}>{displayedStudents.length}</strong> students
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 600, padding: '0 8px', color: 'var(--text-secondary)' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: PLACEMENTS (CRITERION 4.5) ── */}
        {activeTab === 'placements' && (
          <div>
            <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
                <StatCard label="Campus Placed" value={placedCount} subtext="Direct Industry Offers" variant="success" icon={Briefcase} />
                <StatCard label="Higher Education" value={higherCount} subtext="GATE / GRE Admitted" variant="primary" icon={Award} />
                <StatCard label="Verified Ratio" value={`${verifiedRatio}%`} subtext="Criterion 4.5 Compliance" variant="info" icon={ShieldCheck} />
                <StatCard label="Median Package" value={medCtcText} subtext="Annual CTC Index" variant="default" icon={Trophy} />
              </div>

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${achievementSubTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAchievementSubTab('queue')}
                >
                  Verification Queue ({achievements.filter(a => a.status === 'pending' || a.verification_status === 'pending').length} Pending)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${achievementSubTab === 'report' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAchievementSubTab('report')}
                >
                  Criterion 4.6.3 Summary Index
                </button>
              </div>

              {achievementSubTab === 'queue' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { id: 'all', label: `All (${achievements.length})` },
                    { id: 'pending', label: `Pending (${achievements.filter(a => a.status === 'pending' || a.verification_status === 'pending').length})` },
                    { id: 'verified', label: `Verified (${achievements.filter(a => a.status === 'verified' || a.status === 'approved' || a.verification_status === 'verified').length})` },
                    { id: 'rejected', label: `Rejected (${achievements.filter(a => a.status === 'rejected').length})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className={`btn btn-sm ${achievementStatusFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setAchievementStatusFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
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
                          No achievements match the current filter.
                        </td>
                      </tr>
                    ) : (
                      achievements.map(a => {
                        const isVerified = a.status === 'approved' || a.status === 'verified' || a.verification_status === 'verified'
                        const isRejected = a.status === 'rejected' || a.verification_status === 'rejected'
                        const stuDisplayName = a.student_name || a.student?.name || a.student_id

                        return (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{stuDisplayName}</div>
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
                              {isVerified ? (
                                <Badge variant="success">Verified (NBA Ready)</Badge>
                              ) : isRejected ? (
                                <Badge variant="danger">Rejected</Badge>
                              ) : (
                                <Badge variant="warning">Pending Review</Badge>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                {!isVerified && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyAchievement(a.id)}
                                    className="btn btn-success btn-sm"
                                  >
                                    Approve
                                  </button>
                                )}
                                {!isRejected && (
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
                        )
                      })
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
                  <StatCard
                    label="Total Verified Achievements"
                    value={achievements.filter(a => a.status === 'approved' || a.status === 'verified' || a.verification_status === 'verified').length}
                    variant="primary"
                    icon={Award}
                  />
                  <StatCard
                    label="Technical Events"
                    value={achievements.filter(a => (a.status === 'approved' || a.status === 'verified' || a.verification_status === 'verified') && a.activity_type === 'technical').length}
                    variant="info"
                    icon={Trophy}
                  />
                  <StatCard
                    label="National Recognitions"
                    value={achievements.filter(a => (a.status === 'approved' || a.status === 'verified' || a.verification_status === 'verified') && (a.event_scope === 'national' || a.event_scope === 'international')).length}
                    variant="success"
                    icon={Medal}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: SECTION ENROLLMENTS (FEATURE 4) ── */}
        {activeTab === 'enrollments' && (
          <div>
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Class Section:</label>
                    <select
                      className="form-select"
                      style={{ minWidth: 180 }}
                      value={selectedSectionId}
                      onChange={e => setSelectedSectionId(e.target.value)}
                    >
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>
                          Sem {s.semester} – Section {s.section_label} {s.default_room ? `(${s.default_room})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Academic Term:</label>
                    <select
                      className="form-select"
                      value={selectedTerm}
                      onChange={e => setSelectedTerm(e.target.value)}
                    >
                      <option value="2024-25-EVEN">2024-25-EVEN</option>
                      <option value="2024-25-ODD">2024-25-ODD</option>
                      <option value="2025-26-ODD">2025-26-ODD</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total Enrolled: <strong style={{ color: 'var(--text-primary)' }}>{enrollments.length}</strong>
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={fetchEnrollments}
                    title="Refresh Enrollments"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            </div>

            {loadingEnrollments ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : enrollments.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Students Enrolled in this Section"
                description="Use the 'Enroll Student' or 'Bulk Enroll' buttons above to allocate students to this class section."
              />
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student Roll No (USN)</th>
                        <th>Student Name</th>
                        <th>Section</th>
                        <th>Academic Term</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments.map((enr, idx) => (
                        <tr key={enr.id || idx}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)' }}>{enr.student_id}</strong>
                          </td>
                          <td>{enr.student_name || '—'}</td>
                          <td>
                            <Badge variant="neutral">{enr.section_display || `Section #${enr.section_id}`}</Badge>
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{enr.academic_term}</td>
                          <td>
                            <Badge variant="success">Active</Badge>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={async () => {
                                if (window.confirm(`Unenroll student ${enr.student_id} from this section?`)) {
                                  try {
                                    await enrollmentsAPI.remove(enr.id)
                                    toast.success(`Student ${enr.student_id} unenrolled`)
                                    fetchEnrollments()
                                  } catch (err) {
                                    toast.error(err.response?.data?.error || 'Failed to unenroll')
                                  }
                                }
                              }}
                            >
                              Unenroll
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

        {/* ── Modal 4: Bulk Student CSV Import (Feature 7) ── */}
        <Modal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          title="Bulk Import Students from CSV"
          maxWidth={560}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBulkImportModal(false)}
                disabled={bulkImporting}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!bulkCsvFile || bulkImporting}
                onClick={async () => {
                  if (!bulkCsvFile) {
                    toast.error('Please select a CSV file to upload')
                    return
                  }
                  setBulkImporting(true)
                  try {
                    const fd = new FormData()
                    fd.append('file', bulkCsvFile)
                    const res = await studentsAPI.bulkImport(fd)
                    setBulkImportResult(res.data)
                    toast.success(`Import completed: ${res.data.created} student(s) added`)
                    fetchStudents()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Bulk import failed')
                  } finally {
                    setBulkImporting(false)
                  }
                }}
              >
                {bulkImporting ? 'Importing…' : 'Upload & Import CSV'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '12px 14px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              fontSize: '12.5px',
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>CSV Columns Specification:</div>
              <div>• <strong>Required:</strong> <code>student_id</code>, <code>name</code></div>
              <div>• <strong>Optional:</strong> <code>email</code>, <code>phone</code>, <code>semester</code>, <code>section</code>, <code>department</code>, <code>previous_gpa</code>, <code>backlogs</code>, <code>engagement</code></div>
              <div style={{ marginTop: 4, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                UTF-8 encoded CSV. Duplicate student IDs will be safely skipped. Max file size: 5 MB.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                className="form-input"
                onChange={e => {
                  setBulkCsvFile(e.target.files[0] || null)
                  setBulkImportResult(null)
                }}
              />
            </div>

            {bulkImportResult && (
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12.5px',
              }}>
                <div style={{ fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>
                  Import Summary:
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span>✅ Created: <strong>{bulkImportResult.created}</strong></span>
                  <span>⏭ Skipped (existing): <strong>{bulkImportResult.skipped?.length || 0}</strong></span>
                  <span>⚠️ Errors: <strong>{bulkImportResult.errors?.length || 0}</strong></span>
                </div>
                {bulkImportResult.errors?.length > 0 && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: '11.5px', color: 'var(--danger)', maxHeight: 100, overflowY: 'auto' }}>
                    {bulkImportResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Modal>

        {/* ── Modal 5: Admin Log Placement (Feature 6 with L-2 Pre-submit Guard) ── */}
        <Modal
          isOpen={showAdminPlacementModal}
          onClose={() => setShowAdminPlacementModal(false)}
          title="Log Placement / Higher Studies (Admin Entry)"
          maxWidth={540}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdminPlacementModal(false)}
                disabled={savingAdminPlacement}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingAdminPlacement}
                onClick={async () => {
                  if (!adminPlacementForm.student_id.trim()) {
                    toast.error('Student ID is required')
                    return
                  }
                  if (adminPlacementForm.status === 'placed' && !adminOfferFile) {
                    toast.error('Offer letter is required for "Placed" status')
                    return
                  }
                  setSavingAdminPlacement(true)
                  try {
                    const fd = new FormData()
                    Object.entries(adminPlacementForm).forEach(([k, v]) => fd.append(k, v))
                    if (adminOfferFile) {
                      fd.append('offer_letter', adminOfferFile)
                    }
                    await placementsAPI.submit(fd)
                    toast.success('Placement logged successfully')
                    setShowAdminPlacementModal(false)
                    fetchPlacements()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to log placement')
                  } finally {
                    setSavingAdminPlacement(false)
                  }
                }}
              >
                {savingAdminPlacement ? 'Submitting…' : 'Record Placement'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Student ID (USN) *</label>
                <input
                  className="form-input"
                  placeholder="e.g. STU001"
                  value={adminPlacementForm.student_id}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, student_id: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pathway Status *</label>
                <select
                  className="form-select"
                  value={adminPlacementForm.status}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="placed">Campus Placement / Corporate Offer</option>
                  <option value="higher_studies">Higher Studies (GATE / GRE / MS)</option>
                  <option value="entrepreneurship">Entrepreneurship / Startup</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {adminPlacementForm.status === 'higher_studies' ? 'University / Institution *' : 'Hiring Company / Organization *'}
                </label>
                <input
                  className="form-input"
                  placeholder={adminPlacementForm.status === 'higher_studies' ? 'e.g. IISc Bangalore / Stanford' : 'e.g. Microsoft India'}
                  value={adminPlacementForm.company_or_institution}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, company_or_institution: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {adminPlacementForm.status === 'higher_studies' ? 'Program / Degree' : 'Job Title / Role'}
                </label>
                <input
                  className="form-input"
                  placeholder={adminPlacementForm.status === 'higher_studies' ? 'e.g. M.Tech AI' : 'e.g. Software Engineer'}
                  value={adminPlacementForm.role_or_program}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, role_or_program: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Compensation / Package (CTC)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 14.5 LPA"
                  value={adminPlacementForm.ctc_or_stipend}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, ctc_or_stipend: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Academic Year</label>
                <input
                  className="form-input"
                  placeholder="e.g. 2025-26"
                  value={adminPlacementForm.academic_year}
                  onChange={e => setAdminPlacementForm(prev => ({ ...prev, academic_year: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                Offer Letter / Proof Document {adminPlacementForm.status === 'placed' ? '*' : '(Optional)'}
              </label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="form-input"
                onChange={e => setAdminOfferFile(e.target.files[0] || null)}
              />
            </div>
          </div>
        </Modal>

        {/* ── Modal 6: Single Student Section Enroll (Feature 4) ── */}
        <Modal
          isOpen={showSingleEnrollModal}
          onClose={() => setShowSingleEnrollModal(false)}
          title="Enroll Student in Section"
          maxWidth={460}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSingleEnrollModal(false)}
                disabled={savingEnroll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingEnroll}
                onClick={async () => {
                  if (!singleEnrollStudentId.trim() || !singleEnrollSectionId) {
                    toast.error('Student ID and Section are required')
                    return
                  }
                  setSavingEnroll(true)
                  try {
                    await enrollmentsAPI.enroll({
                      student_id: singleEnrollStudentId.trim().toUpperCase(),
                      section_id: parseInt(singleEnrollSectionId, 10),
                      academic_term: selectedTerm,
                    })
                    toast.success(`Student ${singleEnrollStudentId.trim().toUpperCase()} enrolled successfully`)
                    setShowSingleEnrollModal(false)
                    fetchEnrollments()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Enrollment failed')
                  } finally {
                    setSavingEnroll(false)
                  }
                }}
              >
                {savingEnroll ? 'Enrolling…' : 'Enroll Student'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Student Roll Number (USN) *</label>
              <input
                className="form-input"
                placeholder="e.g. STU001"
                value={singleEnrollStudentId}
                onChange={e => setSingleEnrollStudentId(e.target.value.toUpperCase())}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Section *</label>
              <select
                className="form-select"
                value={singleEnrollSectionId}
                onChange={e => setSingleEnrollSectionId(e.target.value)}
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Sem {s.semester} – Section {s.section_label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Academic Term</label>
              <input
                className="form-input"
                disabled
                value={selectedTerm}
              />
            </div>
          </div>
        </Modal>

        {/* ── Modal 7: Bulk Enroll in Section (Feature 4) ── */}
        <Modal
          isOpen={showBulkEnrollModal}
          onClose={() => setShowBulkEnrollModal(false)}
          title="Bulk Allocate Students to Section"
          maxWidth={500}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowBulkEnrollModal(false)}
                disabled={savingBulkEnroll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingBulkEnroll}
                onClick={async () => {
                  const usns = bulkEnrollUsnsText
                    .split(/[\n,]/)
                    .map(u => u.trim().toUpperCase())
                    .filter(Boolean)
                  if (usns.length === 0) {
                    toast.error('Please enter at least one Student Roll Number (USN)')
                    return
                  }
                  setSavingBulkEnroll(true)
                  try {
                    const res = await enrollmentsAPI.bulk({
                      section_id: parseInt(bulkEnrollSectionId, 10),
                      student_ids: usns,
                      academic_term: selectedTerm,
                    })
                    setBulkEnrollResult(res.data)
                    toast.success(`Allocated ${res.data.created} student(s) to section`)
                    fetchEnrollments()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Bulk enrollment failed')
                  } finally {
                    setSavingBulkEnroll(false)
                  }
                }}
              >
                {savingBulkEnroll ? 'Allocating…' : 'Allocate Students'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Section *</label>
              <select
                className="form-select"
                value={bulkEnrollSectionId}
                onChange={e => setBulkEnrollSectionId(e.target.value)}
              >
                {sections.map(s => (
                  <option key={s.id} value={s.id}>
                    Sem {s.semester} – Section {s.section_label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Student Roll Numbers (USNs) — One per line or comma-separated</label>
              <textarea
                className="form-textarea"
                rows={6}
                placeholder="STU001&#10;STU002&#10;STU003"
                value={bulkEnrollUsnsText}
                onChange={e => setBulkEnrollUsnsText(e.target.value)}
              />
            </div>

            {bulkEnrollResult && (
              <div style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
              }}>
                <div>✅ Enrolled: <strong>{bulkEnrollResult.created}</strong></div>
                <div>⏭ Skipped (already enrolled): <strong>{bulkEnrollResult.skipped?.length || 0}</strong></div>
                {bulkEnrollResult.errors?.length > 0 && (
                  <div style={{ color: 'var(--danger)', marginTop: 4 }}>
                    ⚠️ Errors: {bulkEnrollResult.errors.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
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
          <label className="form-label">Phone Number</label>
          <input
            type="tel"
            className="form-input"
            value={data.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="8660042249"
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


