import React, { useEffect, useState, useMemo } from 'react'
import { facultyAPI, reportsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Search, BookOpen, Award, GraduationCap, ChevronRight,
  Mail, Briefcase, FileText, Beaker, CheckCircle2, RefreshCw, Download,
  Edit3, Plus, Trash2, Check, X, Clock, AlertCircle, Lock, ShieldCheck,
  UserCheck, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Tabs from '../components/Tabs'

export default function FacultyPage() {
  const { user } = useAuth()
  const isAdmin   = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const linkedId  = user?.linked_id

  const [faculty, setFaculty]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [expanded, setExpanded]             = useState(null)
  const [downloadingId, setDownloadingId]   = useState(null)

  // Admin tabs & update requests
  const [activeTab, setActiveTab]           = useState('directory')
  const [updateRequests, setUpdateRequests] = useState([])
  const [requestsLoading, setRequestsLoading]= useState(false)

  // Teacher Profile Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editModalTab, setEditModalTab]       = useState('pubs')
  const [editForm, setEditForm] = useState({
    faculty_id: '',
    name: '',
    phone: '',
    qualification: '',
    experience: '',
    designation: '',
    publications: [],
    fdp_participation: [],
    research_projects: [],
    certifications: [],
    awards: [],
    courses_taught: [],
    change_summary: '',
  })
  const [newInputs, setNewInputs] = useState({
    pub: '',
    fdp: '',
    grant: '',
    cert: '',
    award: '',
  })
  const [submittingUpdate, setSubmittingUpdate] = useState(false)

  // Admin Course Allocation Modal
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false)
  const [courseFaculty, setCourseFaculty]         = useState(null)
  const [allocatedCourses, setAllocatedCourses]   = useState([])
  const [newCourseInput, setNewCourseInput]       = useState('')
  const [savingCourses, setSavingCourses]         = useState(false)

  // Admin Rejection Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [selectedReqForReject, setSelectedReqForReject] = useState(null)
  const [rejectionReason, setRejectionReason]     = useState('')
  const [rejecting, setRejecting]                 = useState(false)

  // Fetch Faculty Directory
  const fetchFaculty = () => {
    setLoading(true)
    facultyAPI.list({ search })
      .then(r => { setFaculty(r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  // Fetch Update Requests
  const fetchUpdateRequests = () => {
    setRequestsLoading(true)
    facultyAPI.listUpdateRequests()
      .then(r => {
        setUpdateRequests(r.data || [])
        setRequestsLoading(false)
      })
      .catch(() => setRequestsLoading(false))
  }

  useEffect(() => {
    fetchFaculty()
  }, [search])

  useEffect(() => {
    if (isAdmin || isTeacher) {
      fetchUpdateRequests()
    }
  }, [isAdmin, isTeacher])

  const pendingRequests = useMemo(() => {
    return updateRequests.filter(r => r.status === 'pending')
  }, [updateRequests])

  const historyRequests = useMemo(() => {
    return updateRequests.filter(r => r.status !== 'pending')
  }, [updateRequests])

  // Find own faculty profile and active pending request (for teacher)
  const ownProfile = useMemo(() => {
    if (!linkedId) return null
    return faculty.find(f => f.faculty_id === linkedId)
  }, [faculty, linkedId])

  const ownPendingRequest = useMemo(() => {
    if (!linkedId) return null
    return updateRequests.find(r => r.faculty_id === linkedId && r.status === 'pending')
  }, [updateRequests, linkedId])

  const totalPubs = useMemo(() => {
    return faculty.reduce((acc, f) => acc + (f.publications?.length || 0), 0)
  }, [faculty])

  const totalResearch = useMemo(() => {
    return faculty.reduce((acc, f) => acc + (f.research_projects?.length || 0), 0)
  }, [faculty])

  // Export Appraisal Dossier PDF
  const handleDownloadFacultyReport = async (f) => {
    const fid = f.faculty_id || f.id
    setDownloadingId(fid)
    const t = toast.loading(`Generating official appraisal for ${f.name}…`)
    try {
      const res = await reportsAPI.generateFaculty({
        faculty_id: fid,
        format: 'pdf',
      })
      const reportId = res.data?.report_id
      if (reportId) {
        const dlRes = await reportsAPI.downloadPdf(reportId)
        const blob = new Blob([dlRes.data], { type: 'application/pdf' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `Faculty_Appraisal_${fid}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success('Faculty appraisal downloaded successfully', { id: t })
      } else {
        toast.error('Could not retrieve generated report ID', { id: t })
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate faculty report', { id: t })
    } finally {
      setDownloadingId(null)
    }
  }

  // ── Open Teacher Edit Modal ──
  const handleOpenEditModal = (targetFaculty = ownProfile) => {
    if (!targetFaculty) return
    setEditForm({
      faculty_id:        targetFaculty.faculty_id,
      name:              targetFaculty.name,
      phone:             targetFaculty.phone || '',
      qualification:     targetFaculty.qualification || '',
      experience:        targetFaculty.experience || '',
      designation:       targetFaculty.designation || '',
      publications:      [...(targetFaculty.publications || [])],
      fdp_participation: [...(targetFaculty.fdp_participation || [])],
      research_projects: [...(targetFaculty.research_projects || [])],
      certifications:    [...(targetFaculty.certifications || [])],
      awards:            [...(targetFaculty.awards || [])],
      courses_taught:    [...(targetFaculty.courses_taught || [])],
      change_summary:    ownPendingRequest?.change_summary || '',
    })
    setNewInputs({ pub: '', fdp: '', grant: '', cert: '', award: '' })
    setEditModalTab('pubs')
    setIsEditModalOpen(true)
  }

  // Teacher adds item to a dynamic category
  const handleAddItem = (field, inputKey) => {
    const text = newInputs[inputKey]?.trim()
    if (!text) return
    setEditForm(prev => ({
      ...prev,
      [field]: [...prev[field], text],
    }))
    setNewInputs(prev => ({ ...prev, [inputKey]: '' }))
  }

  // Teacher removes item from a category
  const handleRemoveItem = (field, idx) => {
    setEditForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== idx),
    }))
  }

  // Teacher submits update request
  const handleSubmitUpdateRequest = async (e) => {
    e.preventDefault()
    setSubmittingUpdate(true)
    const t = toast.loading('Submitting profile updates for admin approval…')
    try {
      await facultyAPI.submitUpdateRequest(editForm.faculty_id, {
        publications:      editForm.publications,
        fdp_participation: editForm.fdp_participation,
        research_projects: editForm.research_projects,
        certifications:    editForm.certifications,
        awards:            editForm.awards,
        phone:             editForm.phone,
        qualification:     editForm.qualification,
        experience:        editForm.experience,
        designation:       editForm.designation,
        change_summary:    editForm.change_summary,
      })
      toast.success('Update request submitted! Pending administrator approval.', { id: t })
      setIsEditModalOpen(false)
      fetchUpdateRequests()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit update request', { id: t })
    } finally {
      setSubmittingUpdate(false)
    }
  }

  // Teacher cancels own pending request
  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Withdraw this pending update request?')) return
    const t = toast.loading('Cancelling request…')
    try {
      await facultyAPI.cancelUpdateRequest(requestId)
      toast.success('Update request withdrawn.', { id: t })
      fetchUpdateRequests()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to withdraw request', { id: t })
    }
  }

  // ── Admin: Course Allocation Modal ──
  const handleOpenCourseModal = (fac) => {
    setCourseFaculty(fac)
    setAllocatedCourses([...(fac.courses_taught || [])])
    setNewCourseInput('')
    setIsCourseModalOpen(true)
  }

  const handleAddCourse = (courseName) => {
    const name = (courseName || newCourseInput).trim()
    if (!name) return
    if (allocatedCourses.includes(name)) {
      toast.error('Course is already allocated to this faculty member')
      return
    }
    setAllocatedCourses(prev => [...prev, name])
    setNewCourseInput('')
  }

  const handleRemoveCourse = (idx) => {
    setAllocatedCourses(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSaveCourses = async () => {
    if (!courseFaculty) return
    setSavingCourses(true)
    const t = toast.loading(`Updating allocated courses for ${courseFaculty.name}…`)
    try {
      await facultyAPI.allocateCourses(courseFaculty.faculty_id, allocatedCourses)
      toast.success(`Courses updated successfully for ${courseFaculty.name}!`, { id: t })
      setIsCourseModalOpen(false)
      fetchFaculty()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate courses', { id: t })
    } finally {
      setSavingCourses(false)
    }
  }

  // ── Admin: Approve Request ──
  const handleApproveRequest = async (reqId) => {
    const t = toast.loading('Approving and applying profile changes to directory…')
    try {
      await facultyAPI.approveUpdateRequest(reqId)
      toast.success('Profile changes approved and applied successfully!', { id: t })
      fetchUpdateRequests()
      fetchFaculty()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve update request', { id: t })
    }
  }

  // ── Admin: Reject Request ──
  const handleOpenRejectModal = (reqItem) => {
    setSelectedReqForReject(reqItem)
    setRejectionReason('')
    setIsRejectModalOpen(true)
  }

  const handleConfirmReject = async () => {
    if (!selectedReqForReject) return
    setRejecting(true)
    const t = toast.loading('Rejecting update request…')
    try {
      await facultyAPI.rejectUpdateRequest(selectedReqForReject.id, {
        reason: rejectionReason || 'Profile updates did not meet institutional verification criteria.'
      })
      toast.success('Update request rejected.', { id: t })
      setIsRejectModalOpen(false)
      fetchUpdateRequests()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request', { id: t })
    } finally {
      setRejecting(false)
    }
  }

  // Quick course suggestions for admin
  const SUGGESTED_COURSES = [
    'Data Structures & Algorithms',
    'Machine Learning',
    'Computer Networks',
    'Operating Systems',
    'Database Management Systems',
    'Design & Analysis of Algorithms',
    'Theory of Computation',
    'Cloud Computing',
    'Artificial Intelligence',
    'Software Engineering',
  ]

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Department Faculty & Research Directory"
        description="Faculty cadre profiles, research publications, FDP certifications, and course allocations for NBA Criterion 5."
        badge={`${faculty.length} Mentors`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isTeacher && ownProfile && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleOpenEditModal(ownProfile)}
              >
                <Edit3 size={14} />
                <span>Propose Profile Updates</span>
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { fetchFaculty(); if (isAdmin || isTeacher) fetchUpdateRequests(); }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="page-body">
        {/* ── Teacher Notice Banner ── */}
        {isTeacher && ownPendingRequest && (
          <div
            className="card"
            style={{
              marginBottom: 'var(--space-4)',
              padding: '14px 18px',
              backgroundColor: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#eab308',
              }}>
                <Clock size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  Profile Updates Pending Administrative Review
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Submitted on {new Date(ownPendingRequest.created_at).toLocaleDateString()}
                  {ownPendingRequest.change_summary ? ` — Note: "${ownPendingRequest.change_summary}"` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenEditModal(ownProfile)}
              >
                <Edit3 size={13} />
                <span>Revise Submission</span>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)' }}
                onClick={() => handleCancelRequest(ownPendingRequest.id)}
              >
                <X size={13} />
                <span>Withdraw</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Summary Stats ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label="Faculty Members"
            value={faculty.length}
            subtext="Professors, Associate & Assistant"
            icon={GraduationCap}
            variant="primary"
          />
          <StatCard
            label="Total Publications"
            value={totalPubs}
            subtext="Indexed in Scopus / SCI / IEEE"
            icon={BookOpen}
            variant="info"
          />
          <StatCard
            label="Sponsored Projects"
            value={totalResearch}
            subtext="Funded research & consulting"
            icon={Beaker}
            variant="purple"
          />
          <StatCard
            label={isAdmin ? "Pending Approvals" : "Faculty Cadre Ratio"}
            value={isAdmin ? pendingRequests.length : "1 : 15"}
            subtext={isAdmin ? "Awaiting admin review" : "Complies with AICTE norms"}
            icon={isAdmin ? AlertCircle : CheckCircle2}
            variant={isAdmin && pendingRequests.length > 0 ? "warning" : "success"}
          />
        </div>

        {/* ── Admin Tabs ── */}
        {isAdmin && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'directory', label: 'Faculty Directory', icon: GraduationCap, count: faculty.length },
                { id: 'pending',   label: 'Pending Approvals',  icon: Clock,         count: pendingRequests.length },
                { id: 'history',   label: 'Review History',     icon: ShieldCheck,   count: historyRequests.length },
              ]}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 1: FACULTY DIRECTORY
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'directory' && (
          <>
            {/* Search Bar */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
                  <Search size={14} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search faculty by name, designation, or research area…"
                  />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing <strong>{faculty.length}</strong> department educators
                </span>
              </div>
            </div>

            {/* Faculty Cards List */}
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : faculty.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No Faculty Records Found"
                description="No faculty profiles match your search criteria."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {faculty.map(f => {
                  const isOpen = expanded === f.faculty_id
                  const isMe = linkedId && f.faculty_id === linkedId
                  const initials = f.name
                    ? f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'FC'

                  return (
                    <div
                      key={f.id || f.faculty_id}
                      className="card"
                      style={{
                        padding: '16px 20px',
                        border: isMe ? '1px solid var(--primary)' : '1px solid var(--border-default)',
                        backgroundColor: isMe ? 'rgba(59, 130, 246, 0.02)' : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                        onClick={() => setExpanded(isOpen ? null : f.faculty_id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isMe ? 'var(--primary-subtle)' : 'var(--bg-elevated)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: isMe ? 'var(--primary)' : 'var(--text-primary)',
                            flexShrink: 0,
                          }}>
                            {initials}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                                {f.name}
                              </span>
                              <Badge variant="neutral">{f.designation || 'Faculty'}</Badge>
                              {isMe && <Badge variant="primary">Your Profile</Badge>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                              {f.qualification} · {f.experience ? `${f.experience} Experience` : ''} · {f.email}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className="badge badge-primary" title="Publications">
                              <BookOpen size={11} /> {f.publications?.length || 0} Pubs
                            </span>
                            <span className="badge badge-success" title="FDP Participations">
                              <GraduationCap size={11} /> {f.fdp_participation?.length || 0} FDPs
                            </span>
                            <span className="badge badge-purple" title="Research Projects">
                              <Beaker size={11} /> {f.research_projects?.length || 0} Grants
                            </span>
                            <span className="badge badge-warning" title="Allocated Courses">
                              <FileText size={11} /> {f.courses_taught?.length || 0} Courses
                            </span>
                          </div>

                          <ChevronRight
                            size={16}
                            color="var(--text-muted)"
                            style={{
                              transform: isOpen ? 'rotate(90deg)' : 'none',
                              transition: 'transform var(--transition-fast)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Expandable Dossier Sections */}
                      {isOpen && (
                        <div style={{
                          marginTop: 16,
                          paddingTop: 16,
                          borderTop: '1px solid var(--border-default)',
                        }}>
                          <div className="grid-3" style={{ gap: 14 }}>
                            <FacultySubSection
                              title="Publications (Journals & Conferences)"
                              items={f.publications}
                              icon={BookOpen}
                              color="var(--primary)"
                            />
                            <FacultySubSection
                              title="FDP & Pedagogy Training"
                              items={f.fdp_participation}
                              icon={GraduationCap}
                              color="var(--success)"
                            />
                            <FacultySubSection
                              title="Research & Sponsored Grants"
                              items={f.research_projects}
                              icon={Beaker}
                              color="var(--purple)"
                            />
                            <FacultySubSection
                              title="Industry Certifications"
                              items={f.certifications}
                              icon={Award}
                              color="var(--warning)"
                            />
                            <FacultySubSection
                              title="Institutional Awards & Honors"
                              items={f.awards}
                              icon={Award}
                              color="var(--primary)"
                            />
                            <FacultySubSection
                              title="Allocated Courses (Admin Assigned)"
                              items={f.courses_taught}
                              icon={Lock}
                              color="var(--text-secondary)"
                            />
                          </div>

                          <div style={{
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 10,
                          }}>
                            <div>
                              {f.phone && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  Contact: {f.phone}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              {/* Admin Direct Course Allocation */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenCourseModal(f)
                                  }}
                                  title="Assign or modify courses taught"
                                >
                                  <Lock size={13} />
                                  <span>Assign Courses</span>
                                </button>
                              )}

                              {/* Teacher Self-Service Update Request */}
                              {isMe && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenEditModal(f)
                                  }}
                                  title="Propose updates to publications, FDPs, grants, and awards"
                                >
                                  <Edit3 size={13} />
                                  <span>Propose Updates</span>
                                </button>
                              )}

                              {/* Appraisal Dossier Export */}
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadFacultyReport(f)
                                }}
                                disabled={downloadingId === (f.faculty_id || f.id)}
                                title="Export Official Appraisal PDF"
                              >
                                <Download size={13} />
                                <span>{downloadingId === (f.faculty_id || f.id) ? 'Generating…' : 'Export Dossier (PDF)'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 2: ADMIN PENDING APPROVALS
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pending' && isAdmin && (
          <div>
            {requestsLoading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All Caught Up"
                description="There are currently no faculty profile update requests waiting for approval."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {pendingRequests.map(req => (
                  <UpdateRequestCard
                    key={req.id}
                    request={req}
                    onApprove={() => handleApproveRequest(req.id)}
                    onReject={() => handleOpenRejectModal(req)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            TAB 3: REVIEW HISTORY
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && isAdmin && (
          <div>
            {historyRequests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Prior Reviews"
                description="Past approved and rejected profile update requests will be cataloged here."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {historyRequests.map(req => (
                  <div key={req.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                            {req.faculty_name}
                          </span>
                          <Badge variant={req.status === 'approved' ? 'success' : 'danger'}>
                            {req.status === 'approved' ? 'Approved' : 'Rejected'}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                          Reviewed by {req.reviewed_by || 'Admin'} on {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : 'N/A'}
                        </div>
                        {req.rejection_reason && (
                          <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: 4 }}>
                            <strong>Reason:</strong> {req.rejection_reason}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Submitted on {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            MODAL 1: TEACHER EDIT PROFILE MODAL (TABBED ENTERPRISE DESIGN)
           ══════════════════════════════════════════════════════════════════════ */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Update Faculty Profile · ${editForm.name}`}
          maxWidth={760}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>All staged updates require Department Administrator verification.</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={submittingUpdate}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmitUpdateRequest}
                  disabled={submittingUpdate}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <UserCheck size={14} />
                  <span>{submittingUpdate ? 'Submitting…' : 'Submit for Admin Approval'}</span>
                </button>
              </div>
            </div>
          }
        >
          <div>
            {/* Institutional Verification Notice */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '11px 14px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 16,
            }}>
              <ShieldCheck size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Governance & Verification Workflow:</strong>
                {' '}Proposed additions to publications, FDPs, research grants, and honors are staged for Department Administrator audit. The live department directory will update once approved.
              </div>
            </div>

            {/* Modal Segmented Tab Pills */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: 20,
              overflowX: 'auto',
            }}>
              {[
                { id: 'pubs',    label: 'Publications',           icon: BookOpen,      count: editForm.publications.length },
                { id: 'fdp',     label: 'FDP & Training',         icon: GraduationCap, count: editForm.fdp_participation.length },
                { id: 'grants',  label: 'Research Grants',        icon: Beaker,        count: editForm.research_projects.length },
                { id: 'honors',  label: 'Certifications & Honors',icon: Award,         count: editForm.certifications.length + editForm.awards.length },
                { id: 'courses', label: 'Allocated Courses',      icon: Lock,          count: editForm.courses_taught.length, locked: true },
                { id: 'bio',     label: 'Profile & Note',         icon: FileText },
              ].map(tab => {
                const isActive = editModalTab === tab.id
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditModalTab(tab.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 11px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                      border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                      boxShadow: isActive ? '0 1px 3px rgba(0, 0, 0, 0.25)' : 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <Icon size={13} style={{ color: isActive ? (tab.locked ? 'var(--warning)' : 'var(--primary)') : 'var(--text-muted)' }} />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: isActive ? 'var(--primary-subtle)' : 'rgba(255, 255, 255, 0.06)',
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Modal Tab Content Panes */}
            <div style={{ minHeight: '340px' }}>
              {/* TAB 1: Publications */}
              {editModalTab === 'pubs' && (
                <CategoryListEditor
                  title="Publications (Journals & Conferences)"
                  subtitle="Add peer-reviewed publications, SCI/Scopus indexed journal papers, and IEEE/ACM conferences."
                  icon={BookOpen}
                  color="var(--primary)"
                  items={editForm.publications}
                  inputValue={newInputs.pub}
                  onInputChange={val => setNewInputs(prev => ({ ...prev, pub: val }))}
                  onAdd={() => handleAddItem('publications', 'pub')}
                  onRemove={idx => handleRemoveItem('publications', idx)}
                  placeholder="e.g. Federated Learning for Privacy-Preserving Medical Imaging — IJCAI 2024"
                  addButtonText="Add Paper"
                  emptyText="No Publications Staged"
                />
              )}

              {/* TAB 2: FDP & Pedagogy Training */}
              {editModalTab === 'fdp' && (
                <CategoryListEditor
                  title="Faculty Development & Pedagogy Training"
                  subtitle="AICTE ATAL FDPs, NPTEL/SWAYAM certifications, and university workshops (min 5 days)."
                  icon={GraduationCap}
                  color="var(--success)"
                  items={editForm.fdp_participation}
                  inputValue={newInputs.fdp}
                  onInputChange={val => setNewInputs(prev => ({ ...prev, fdp: val }))}
                  onAdd={() => handleAddItem('fdp_participation', 'fdp')}
                  onRemove={idx => handleRemoveItem('fdp_participation', idx)}
                  placeholder="e.g. AICTE FDP on Generative AI & Foundation Models — IIT Madras 2024 (7 days)"
                  addButtonText="Add FDP"
                  emptyText="No FDP Training Staged"
                />
              )}

              {/* TAB 3: Research & Sponsored Grants */}
              {editModalTab === 'grants' && (
                <CategoryListEditor
                  title="Research & Sponsored Grants"
                  subtitle="Funded research projects from SERB, DST, AICTE, DRDO, or industry sponsored R&D."
                  icon={Beaker}
                  color="var(--purple)"
                  items={editForm.research_projects}
                  inputValue={newInputs.grant}
                  onInputChange={val => setNewInputs(prev => ({ ...prev, grant: val }))}
                  onAdd={() => handleAddItem('research_projects', 'grant')}
                  onRemove={idx => handleRemoveItem('research_projects', idx)}
                  placeholder="e.g. SERB-funded: Edge AI for Health Diagnostics (₹18 L, 2024-26)"
                  addButtonText="Add Grant"
                  emptyText="No Sponsored Grants Staged"
                />
              )}

              {/* TAB 4: Certifications & Awards */}
              {editModalTab === 'honors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <CategoryListEditor
                    title="Industry Certifications"
                    subtitle="Professional credentials from Google, AWS, Microsoft, Cisco, Coursera, NPTEL."
                    icon={Award}
                    color="var(--warning)"
                    items={editForm.certifications}
                    inputValue={newInputs.cert}
                    onInputChange={val => setNewInputs(prev => ({ ...prev, cert: val }))}
                    onAdd={() => handleAddItem('certifications', 'cert')}
                    onRemove={idx => handleRemoveItem('certifications', idx)}
                    placeholder="e.g. Google Cloud Certified Professional ML Engineer (2024)"
                    addButtonText="Add Certification"
                    emptyText="No Industry Certifications Staged"
                  />

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                    <CategoryListEditor
                      title="Institutional Awards & Honors"
                      subtitle="Distinguished academic awards, best researcher citations, and university honors."
                      icon={Award}
                      color="var(--primary)"
                      items={editForm.awards}
                      inputValue={newInputs.award}
                      onInputChange={val => setNewInputs(prev => ({ ...prev, award: val }))}
                      onAdd={() => handleAddItem('awards', 'award')}
                      onRemove={idx => handleRemoveItem('awards', idx)}
                      placeholder="e.g. Best Faculty Researcher Award — Anna University 2024"
                      addButtonText="Add Award"
                      emptyText="No Institutional Awards Staged"
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: Allocated Courses (ADMIN ONLY / LOCKED) */}
              {editModalTab === 'courses' && (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    backgroundColor: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 16,
                  }}>
                    <Lock size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Department Administrator Controlled</span>
                        <Badge variant="warning">Read Only</Badge>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                        In accordance with NBA Criterion 5 governance norms, course allocations and teaching workloads are assigned exclusively by the Department Administrator. Faculty members cannot directly allocate or modify assigned subjects.
                      </p>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    padding: '16px',
                    marginBottom: 16,
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Currently Assigned Courses ({editForm.courses_taught.length})</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Official Academic Roster</span>
                    </div>

                    {editForm.courses_taught.length === 0 ? (
                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                        No courses currently allocated by department administration.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                        {editForm.courses_taught.map((c, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              backgroundColor: 'var(--bg-elevated)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12.5px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <BookOpen size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <AlertCircle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span>Need a subject allocation change or lab assignment? Submit a syllabus workload request to your Academic Coordinator or Head of Department.</span>
                  </div>
                </div>
              )}

              {/* TAB 6: Profile & Verification Note */}
              {editModalTab === 'bio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      Professional Credentials & Contact Info
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Update your institutional cadre info, experience duration, and contact phone number.
                    </div>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Phone Number</label>
                        <input
                          className="form-input"
                          value={editForm.phone}
                          onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="e.g. +91 98765 43210"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Highest Qualification</label>
                        <input
                          className="form-input"
                          value={editForm.qualification}
                          onChange={e => setEditForm(prev => ({ ...prev, qualification: e.target.value }))}
                          placeholder="e.g. Ph.D (Computer Science & Engineering)"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Total Experience</label>
                        <input
                          className="form-input"
                          value={editForm.experience}
                          onChange={e => setEditForm(prev => ({ ...prev, experience: e.target.value }))}
                          placeholder="e.g. 14 Years"
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Designation / Cadre</label>
                        <input
                          className="form-input"
                          value={editForm.designation}
                          onChange={e => setEditForm(prev => ({ ...prev, designation: e.target.value }))}
                          placeholder="e.g. Associate Professor"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Change Summary / Verification Note for Reviewer
                      </label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={editForm.change_summary}
                        onChange={e => setEditForm(prev => ({ ...prev, change_summary: e.target.value }))}
                        placeholder="e.g. Staged 1 new IEEE paper, 2024 IIT Madras FDP completion certificate, and updated phone number…"
                      />
                      <div className="form-hint">
                        Provide context or publication verification details for the department administrator reviewing your updates.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>

        {/* ══════════════════════════════════════════════════════════════════════
            MODAL 2: ADMIN ALLOCATE COURSES MODAL
           ══════════════════════════════════════════════════════════════════════ */}
        <Modal
          isOpen={isCourseModalOpen}
          onClose={() => setIsCourseModalOpen(false)}
          title={`Allocate Courses — ${courseFaculty?.name || ''}`}
          maxWidth={560}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsCourseModalOpen(false)}
                disabled={savingCourses}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveCourses}
                disabled={savingCourses}
              >
                {savingCourses ? 'Saving…' : 'Save Course Allocations'}
              </button>
            </div>
          }
        >
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: 14 }}>
              As Department Administrator, assign or remove allocated courses for <strong>{courseFaculty?.name}</strong> for NBA Criterion 5 course distribution.
            </p>

            {/* Input to add course */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Enter course name (e.g. Distributed Systems)…"
                value={newCourseInput}
                onChange={e => setNewCourseInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCourse(); } }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleAddCourse()}
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            {/* Quick Suggestion Pills */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Quick Add Presets:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SUGGESTED_COURSES.map(sc => (
                  <button
                    key={sc}
                    type="button"
                    className="badge badge-neutral"
                    style={{
                      cursor: 'pointer',
                      border: '1px solid var(--border-default)',
                      backgroundColor: allocatedCourses.includes(sc) ? 'var(--primary-subtle)' : 'var(--bg-elevated)',
                      color: allocatedCourses.includes(sc) ? 'var(--primary)' : 'var(--text-secondary)',
                    }}
                    onClick={() => handleAddCourse(sc)}
                  >
                    + {sc}
                  </button>
                ))}
              </div>
            </div>

            {/* Currently Allocated Courses List */}
            <div style={{
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              border: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Currently Allocated ({allocatedCourses.length})
              </div>
              {allocatedCourses.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No courses allocated yet. Add one above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allocatedCourses.map((course, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        backgroundColor: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span>{course}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: 'var(--danger)', padding: 4 }}
                        onClick={() => handleRemoveCourse(idx)}
                        title="Remove course"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>

        {/* ══════════════════════════════════════════════════════════════════════
            MODAL 3: ADMIN REJECT REASON MODAL
           ══════════════════════════════════════════════════════════════════════ */}
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title="Reject Profile Update Request"
          maxWidth={480}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={rejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmReject}
                disabled={rejecting}
              >
                {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          }
        >
          <div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Specify the reason for rejecting the profile changes submitted by <strong>{selectedReqForReject?.faculty_name}</strong>. The faculty member will be informed of this feedback.
            </p>
            <textarea
              className="form-textarea"
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Publication DOI verification missing, please attach official proof or conference link…"
            />
          </div>
        </Modal>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Category List Editor (used inside Teacher Profile Update Modal)
// ─────────────────────────────────────────────────────────────────────────────
function CategoryListEditor({
  title,
  subtitle,
  icon: Icon,
  color = 'var(--primary)',
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
  addButtonText = 'Add Entry',
  emptyText = 'No entries recorded yet.',
}) {
  return (
    <div>
      {title && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {subtitle}
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder={placeholder}
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onAdd}
          disabled={!inputValue?.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, padding: '8px 14px' }}
        >
          <Plus size={14} />
          <span>{addButtonText}</span>
        </button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border-default)',
        }}>
          {Icon && <Icon size={26} style={{ color: 'var(--text-muted)', marginBottom: 8, opacity: 0.6 }} />}
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {emptyText}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Enter details above and click {addButtonText}.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '320px', overflowY: 'auto', paddingRight: 2 }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `3px solid ${color}`,
                transition: 'border-color var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color,
                  padding: '1px 6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-xs)',
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  #{idx + 1}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {item}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                style={{ color: 'var(--danger)', flexShrink: 0, padding: 4 }}
                onClick={() => onRemove(idx)}
                title="Remove item"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SubSection renderer in Faculty Profile Cards
// ─────────────────────────────────────────────────────────────────────────────
function FacultySubSection({ title, items, icon: Icon, color }) {
  if (!items?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--bg-subtle)',
      padding: '12px 14px',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color,
        marginBottom: 8,
      }}>
        {Icon && <Icon size={12} />}
        <span>{title} ({items.length})</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, idx) => {
          const isCert = title.toLowerCase().includes('certification')
          return (
            <div
              key={idx}
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.45,
                paddingLeft: 8,
                borderLeft: `2px solid ${color}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{item}</span>
              {isCert && (
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: 'var(--success)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  whiteSpace: 'nowrap',
                }}>
                  Verified
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Update Request Card (with Visual Diff)
// ─────────────────────────────────────────────────────────────────────────────
function UpdateRequestCard({ request, onApprove, onReject }) {
  const [expandedDiff, setExpandedDiff] = useState(true)

  const diff = request.diff || {}
  const diffCategories = [
    { key: 'publications',     title: 'Publications',     color: 'var(--primary)', icon: BookOpen },
    { key: 'fdp_participation', title: 'FDP & Training',   color: 'var(--success)', icon: GraduationCap },
    { key: 'research_projects', title: 'Research Grants',  color: 'var(--purple)',  icon: Beaker },
    { key: 'certifications',    title: 'Certifications',   color: 'var(--warning)', icon: Award },
    { key: 'awards',            title: 'Awards & Honors',  color: 'var(--primary)', icon: Award },
  ]

  const totalAdded = Object.values(diff).reduce((acc, d) => acc + (d?.added?.length || 0), 0)
  const totalRemoved = Object.values(diff).reduce((acc, d) => acc + (d?.removed?.length || 0), 0)

  return (
    <div className="card" style={{ padding: '18px 20px', border: '1px solid var(--border-default)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              {request.faculty_name}
            </span>
            <Badge variant="neutral">{request.faculty_id}</Badge>
            <Badge variant="warning">Pending Review</Badge>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
            Submitted on {new Date(request.created_at).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setExpandedDiff(!expandedDiff)}
          >
            <span>{expandedDiff ? 'Hide Changes' : 'Inspect Changes'}</span>
            <ChevronRight
              size={14}
              style={{
                transform: expandedDiff ? 'rotate(90deg)' : 'none',
                transition: 'transform var(--transition-fast)',
              }}
            />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)' }}
            onClick={onReject}
          >
            <X size={14} />
            <span>Reject</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}
            onClick={onApprove}
          >
            <Check size={14} />
            <span>Approve & Apply</span>
          </button>
        </div>
      </div>

      {/* Teacher note */}
      {request.change_summary && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12.5px',
          color: 'var(--text-secondary)',
          borderLeft: '3px solid var(--primary)',
        }}>
          <strong>Note from Faculty:</strong> {request.change_summary}
        </div>
      )}

      {/* Visual Diff View */}
      {expandedDiff && (
        <div style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 12, fontSize: '12px' }}>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{totalAdded} Additions</span>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{totalRemoved} Removals</span>
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            {diffCategories.map(cat => {
              const catDiff = diff[cat.key]
              if (!catDiff) return null
              const hasChanges = (catDiff.added?.length > 0) || (catDiff.removed?.length > 0)
              const Icon = cat.icon

              return (
                <div
                  key={cat.key}
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: hasChanges ? '1px solid var(--border-default)' : '1px dashed var(--border-subtle)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: cat.color,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={13} />
                      {cat.title}
                    </span>
                    {hasChanges ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        +{catDiff.added?.length || 0} / -{catDiff.removed?.length || 0}
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No changes</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Added items */}
                    {catDiff.added?.map((item, i) => (
                      <div
                        key={`add-${i}`}
                        style={{
                          fontSize: '12px',
                          color: '#22c55e',
                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Plus size={12} style={{ flexShrink: 0 }} />
                        <span>{item}</span>
                      </div>
                    ))}

                    {/* Removed items */}
                    {catDiff.removed?.map((item, i) => (
                      <div
                        key={`rem-${i}`}
                        style={{
                          fontSize: '12px',
                          color: '#ef4444',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          textDecoration: 'line-through',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Trash2 size={12} style={{ flexShrink: 0 }} />
                        <span>{item}</span>
                      </div>
                    ))}

                    {/* Retained count */}
                    {!hasChanges && catDiff.retained?.length > 0 && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {catDiff.retained.length} existing items unchanged
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
