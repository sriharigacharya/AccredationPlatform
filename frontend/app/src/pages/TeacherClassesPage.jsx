import React, { useEffect, useState, useMemo } from 'react'
import { classesAPI, contactAPI } from '../api/client'
import {
  BookOpen, Users, CheckCircle2, XCircle, AlertTriangle,
  Calendar, Save, Search, RefreshCw, Send, CheckSquare,
  Square, ShieldAlert, Award, ChevronRight, Phone, Clock,
  Edit3, ShieldCheck, Check, X, ArrowRight, ClipboardCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

export const EXAM_OPTIONS = [
  { key: 'cie1',  label: 'Continuous Internal Evaluation 1 (CIE 1)', max: 25 },
  { key: 'cie2',  label: 'Continuous Internal Evaluation 2 (CIE 2)', max: 25 },
  { key: 'quiz1', label: 'Quiz 1',                                  max: 10 },
  { key: 'quiz2', label: 'Quiz 2',                                  max: 10 },
  { key: 'el',    label: 'Experiential Learning (EL)',               max: 30 },
  { key: 'see',   label: 'Semester End Examination (SEE)',          max: 100 },
]

export const SESSION_TIME_SLOTS = [
  { value: '09:00 AM - 10:00 AM', label: '09:00 AM – 10:00 AM (Period 1)', duration: '1 hr' },
  { value: '10:00 AM - 11:00 AM', label: '10:00 AM – 11:00 AM (Period 2)', duration: '1 hr' },
  { value: '11:30 AM - 12:30 PM', label: '11:30 AM – 12:30 PM (Period 3)', duration: '1 hr' },
  { value: '12:30 PM - 01:30 PM', label: '12:30 PM – 01:30 PM (Period 4)', duration: '1 hr' },
  { value: '02:30 PM - 03:30 PM', label: '02:30 PM – 03:30 PM (Period 5)', duration: '1 hr' },
  { value: '03:30 PM - 04:30 PM', label: '03:30 PM – 04:30 PM (Period 6)', duration: '1 hr' },
  { value: '09:00 AM - 11:00 AM', label: '09:00 AM – 11:00 AM (Morning Lab — 2 hrs)', duration: '2 hrs' },
  { value: '11:30 AM - 01:30 PM', label: '11:30 AM – 01:30 PM (Midday Lab — 2 hrs)', duration: '2 hrs' },
  { value: '02:30 PM - 04:30 PM', label: '02:30 PM – 04:30 PM (Afternoon Lab — 2 hrs)', duration: '2 hrs' },
]

export default function TeacherClassesPage() {
  const [classes, setClasses]               = useState([])
  const [activeClass, setActiveClass]       = useState(null)
  const [students, setStudents]             = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [activeTab, setActiveTab]           = useState('attendance') // 'attendance' | 'marks' | 'at-risk'
  const [search, setSearch]                 = useState('')

  // ── Attendance State ────────────────────────────────────────────────────────
  const [attDate, setAttDate]               = useState(new Date().toISOString().slice(0, 10))
  const [sessionTime, setSessionTime]       = useState('09:00 AM - 10:00 AM')
  const [attStatuses, setAttStatuses]       = useState({}) // { STU001: 'present' | 'absent' }
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [recentSessions, setRecentSessions] = useState([])
  const [showRecentSessions, setShowRecentSessions] = useState(true)
  const [activeExistingSession, setActiveExistingSession] = useState(null)
  const [loadingSessionDetails, setLoadingSessionDetails] = useState(false)
  const [showAuditReviewModal, setShowAuditReviewModal] = useState(false)
  const [auditJustification, setAuditJustification] = useState('')
  const [updatingSession, setUpdatingSession] = useState(false)

  // ── Edit Past Session Modal State ──────────────────────────────────────────
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [sessionDetail, setSessionDetail]       = useState(null)
  const [sessionRoster, setSessionRoster]       = useState([])
  const [changeComment, setChangeComment]       = useState('')
  const [loadingSession, setLoadingSession]     = useState(false)
  const [savingSession, setSavingSession]       = useState(false)
  const [sessionSearch, setSessionSearch]       = useState('')
  const [sessionFilter, setSessionFilter]       = useState('all')

  // ── Marks State ─────────────────────────────────────────────────────────────
  const [selectedExam, setSelectedExam]     = useState('cie1')
  const [marksInputs, setMarksInputs]       = useState({})
  const [savingMarks, setSavingMarks]       = useState(false)
  const [marksStats, setMarksStats]         = useState(null)

  // ── Contact Modal State ─────────────────────────────────────────────────────
  const [contactModal, setContactModal]     = useState(null)
  const [smsText, setSmsText]               = useState('')
  const [sendingSms, setSendingSms]         = useState(false)

  const loadClasses = async () => {
    setLoadingClasses(true)
    try {
      const res = await classesAPI.myClasses()
      const data = res.data || []
      setClasses(data)
      if (data.length > 0 && !activeClass) {
        setActiveClass(data[0])
      }
    } catch (err) {
      toast.error('Failed to load assigned classes')
    } finally {
      setLoadingClasses(false)
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  const loadRoster = async (ca) => {
    if (!ca) return
    setLoadingStudents(true)
    try {
      const res = await classesAPI.getClassStudents(ca.course_code, ca.section)
      const list = res.data?.students || []
      setStudents(list)

      const initAtt = {}
      const initMarks = {}
      list.forEach(s => {
        initAtt[s.student_id] = 'present'
        initMarks[s.student_id] = s[selectedExam] !== null && s[selectedExam] !== undefined ? s[selectedExam] : ''
      })
      setAttStatuses(initAtt)
      setMarksInputs(initMarks)
    } catch (err) {
      toast.error('Failed to load student roster')
    } finally {
      setLoadingStudents(false)
    }
  }

  const loadSessions = async (ca) => {
    if (!ca) return
    try {
      const res = await classesAPI.getAttendanceSessions(ca.course_code, ca.section)
      setRecentSessions(res.data || [])
    } catch (_) {}
  }

  useEffect(() => {
    if (activeClass) {
      loadRoster(activeClass)
      loadSessions(activeClass)
    }
  }, [activeClass])

  // ── Auto-detect if attendance was already recorded for selected date and slot ──
  useEffect(() => {
    if (!activeClass || !attDate || !sessionTime) {
      setActiveExistingSession(null)
      return
    }

    const match = recentSessions.find(
      s => s.session_date === attDate && s.time_slot === sessionTime
    )

    if (match) {
      if (activeExistingSession?.id === match.id) return // already loaded this exact session
      setLoadingSessionDetails(true)
      classesAPI.getSessionDetails(match.id)
        .then(res => {
          const sessData = res.data
          setActiveExistingSession(sessData)
          const map = {}
          ;(sessData.roster || []).forEach(r => {
            map[r.student_id] = r.status
          })
          setAttStatuses(map)
        })
        .catch(err => {
          console.error('Failed to load session details for date/time slot', err)
        })
        .finally(() => {
          setLoadingSessionDetails(false)
        })
    } else {
      if (activeExistingSession) {
        setActiveExistingSession(null)
        // Reset to all present for a brand new session
        const initAtt = {}
        students.forEach(s => { initAtt[s.student_id] = 'present' })
        setAttStatuses(initAtt)
      }
    }
  }, [attDate, sessionTime, recentSessions, activeClass])

  const currentWorkstationPresent = useMemo(() => {
    return Object.values(attStatuses).filter(s => s === 'present').length
  }, [attStatuses])

  const currentWorkstationAbsent = useMemo(() => {
    return Object.values(attStatuses).filter(s => s === 'absent').length
  }, [attStatuses])

  const handleOpenAuditReviewModal = () => {
    if (!activeExistingSession) return
    setAuditJustification('')
    setShowAuditReviewModal(true)
  }

  const handleConfirmSessionUpdate = async () => {
    if (!auditJustification.trim()) {
      toast.error('Audit comment is required explaining the attendance modification')
      return
    }
    setUpdatingSession(true)
    try {
      const records = Object.entries(attStatuses).map(([student_id, status]) => ({
        student_id,
        status,
      }))
      const res = await classesAPI.updateAttendanceSession(activeExistingSession.id, {
        records,
        change_comment: auditJustification.trim(),
      })
      toast.success(res.data?.message || 'Attendance session updated and audit logged!')
      setShowAuditReviewModal(false)
      setAuditJustification('')
      // Refresh roster, sessions list, and active session
      if (activeClass) {
        await loadSessions(activeClass)
        await loadRoster(activeClass)
        loadClasses()
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update attendance session')
    } finally {
      setUpdatingSession(false)
    }
  }

  const handleLoadSessionIntoWorkstation = (sess) => {
    setAttDate(sess.session_date)
    setSessionTime(sess.time_slot || '09:00 AM - 10:00 AM')
    toast.success(`Loaded session from ${sess.session_date} into roll-call`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const updated = {}
    students.forEach(s => {
      updated[s.student_id] = s[selectedExam] !== null && s[selectedExam] !== undefined ? s[selectedExam] : ''
    })
    setMarksInputs(updated)
    setMarksStats(null)
  }, [selectedExam, students])

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    )
  }, [students, search])

  const atRiskStudents = useMemo(() => {
    return students.filter(s => s.is_at_risk)
  }, [students])

  const handleMarkAll = (status) => {
    const next = {}
    students.forEach(s => { next[s.student_id] = status })
    setAttStatuses(next)
  }

  const toggleStudentAttendance = (stuId) => {
    setAttStatuses(prev => ({
      ...prev,
      [stuId]: prev[stuId] === 'present' ? 'absent' : 'present'
    }))
  }

  const handleSaveAttendance = async () => {
    if (!activeClass) return
    setSavingAttendance(true)
    try {
      const records = Object.entries(attStatuses).map(([student_id, status]) => ({
        student_id,
        status,
      }))
      const payload = {
        course_code: activeClass.course_code,
        section: activeClass.section,
        date: attDate,
        time_slot: sessionTime,
        records,
      }
      const res = await classesAPI.submitAttendance(payload)
      toast.success(`Attendance saved: ${res.data.present_count} Present, ${res.data.absent_count} Absent`)
      await loadRoster(activeClass)
      await loadSessions(activeClass)
      loadClasses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  const maxMark = EXAM_OPTIONS.find(e => e.key === selectedExam)?.max || 25

  const handleSaveMarks = async () => {
    if (!activeClass) return
    setSavingMarks(true)
    try {
      const marks = Object.entries(marksInputs)
        .filter(([_, score]) => score !== '' && !isNaN(score))
        .map(([student_id, score]) => ({
          student_id,
          score: parseFloat(score),
        }))

      const payload = {
        course_code: activeClass.course_code,
        section: activeClass.section,
        exam_type: selectedExam,
        max_marks: maxMark,
        marks,
      }
      const res = await classesAPI.submitMarks(payload)
      toast.success(res.data.message)
      setMarksStats(res.data.statistics)
      await loadRoster(activeClass)
      loadClasses()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save marks')
    } finally {
      setSavingMarks(false)
    }
  }

  const handleSendSms = async () => {
    if (!contactModal || !smsText.trim()) return
    setSendingSms(true)
    try {
      await contactAPI.sms(contactModal.student_id, smsText)
      toast.success(`Alert sent to parent of ${contactModal.name}`)
      setContactModal(null)
      setSmsText('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send parent alert')
    } finally {
      setSendingSms(false)
    }
  }

  const openContact = (s) => {
    setContactModal(s)
    setSmsText(
      `Dear Parent, this is an official academic alert regarding ${s.name} (${s.student_id}) in ${activeClass?.course_name}. Current attendance: ${s.attendance_rate}%. Please review your ward's portal or contact the department.`
    )
  }

  const handleOpenEditSession = async (sessionId) => {
    setEditingSessionId(sessionId)
    setLoadingSession(true)
    setChangeComment('')
    setSessionSearch('')
    setSessionFilter('all')
    try {
      const res = await classesAPI.getSessionDetails(sessionId)
      setSessionDetail(res.data)
      setSessionRoster(res.data.roster || [])
    } catch (err) {
      toast.error('Failed to load session details')
      setEditingSessionId(null)
    } finally {
      setLoadingSession(false)
    }
  }

  const handleToggleModalStudent = (stuId) => {
    setSessionRoster(prev => prev.map(s => {
      if (s.student_id === stuId) {
        return { ...s, status: s.status === 'present' ? 'absent' : 'present' }
      }
      return s
    }))
  }

  const handleBatchModalToggle = (newStatus) => {
    setSessionRoster(prev => prev.map(s => ({ ...s, status: newStatus })))
  }

  const modalPresentCount = useMemo(() => {
    return sessionRoster.filter(s => s.status === 'present').length
  }, [sessionRoster])

  const modalAbsentCount = useMemo(() => {
    return sessionRoster.length - modalPresentCount
  }, [sessionRoster, modalPresentCount])

  const modalAttendanceRate = useMemo(() => {
    return sessionRoster.length > 0 ? Math.round((modalPresentCount / sessionRoster.length) * 100) : 100
  }, [sessionRoster, modalPresentCount])

  const filteredModalRoster = useMemo(() => {
    return sessionRoster.filter(s => {
      if (sessionFilter === 'present' && s.status !== 'present') return false
      if (sessionFilter === 'absent' && s.status !== 'absent') return false
      if (sessionSearch.trim()) {
        const q = sessionSearch.toLowerCase()
        return s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
      }
      return true
    })
  }, [sessionRoster, sessionFilter, sessionSearch])

  const handleSaveSessionChanges = async () => {
    if (!changeComment.trim()) {
      toast.error('Audit comment is required explaining the attendance modification')
      return
    }
    setSavingSession(true)
    try {
      const records = sessionRoster.map(s => ({
        student_id: s.student_id,
        status: s.status,
      }))
      const res = await classesAPI.updateAttendanceSession(editingSessionId, {
        records,
        change_comment: changeComment.trim(),
      })
      toast.success(res.data?.message || 'Attendance session updated successfully!')
      setEditingSessionId(null)
      if (activeClass) {
        loadSessions(activeClass)
        loadRoster(activeClass)
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update attendance session')
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Classroom Management & Continuous Evaluation"
        description="Daily attendance roll-call, internal assessment marks entry (CIE/SEE), and proactive at-risk student intervention."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowRecentSessions(!showRecentSessions)}
              className="btn btn-secondary btn-sm"
            >
              <Clock size={14} />
              <span>{showRecentSessions ? 'Hide Session History' : 'Session History'}</span>
            </button>
            <button
              onClick={() => { loadClasses(); if (activeClass) loadRoster(activeClass); }}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="page-body">
        {/* ── Assigned Course Sections Selector ── */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 8
          }}>
            Assigned Course Sections
          </div>

          {loadingClasses ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" />
            </div>
          ) : classes.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No Classes Assigned"
              description="Your faculty profile currently has no assigned course sections for this semester."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {classes.map(ca => {
                const isSelected = activeClass?.course_code === ca.course_code && activeClass?.section === ca.section
                return (
                  <div
                    key={`${ca.course_code}-${ca.section}`}
                    onClick={() => setActiveClass(ca)}
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-default)'}`,
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '13.5px',
                        color: isSelected ? 'var(--primary)' : 'var(--text-primary)'
                      }}>
                        {ca.course_code}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Badge variant="neutral">Sec {ca.section} (Sem {ca.semester})</Badge>
                        {ca.at_risk_count > 0 && (
                          <Badge variant="danger" icon={AlertTriangle}>
                            {ca.at_risk_count} At Risk
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {ca.course_name}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>{ca.student_count || students.length} Enrolled</span>
                      <span>Department of CSE</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Active Class Workstation ── */}
        {activeClass && (
          <div>
            {/* Navigation Tabs */}
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'attendance', label: 'Attendance Roll-Call', icon: ClipboardCheck },
                { id: 'marks', label: 'Continuous Marks Entry (CIE/SEE)', icon: Award },
                { id: 'at-risk', label: 'At-Risk Mentoring & Parent Contact', icon: ShieldAlert, count: atRiskStudents.length },
              ]}
            />

            {/* ── Tab 1: Attendance Roll Call ── */}
            {activeTab === 'attendance' && (
              <div>
                {/* Roll-call Control Toolbar */}
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <div>
                        <label className="form-label">Session Date</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ height: 36, padding: '4px 10px' }}
                          value={attDate}
                          onChange={e => setAttDate(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="form-label">Period / Time Slot</label>
                        <select
                          className="form-select"
                          style={{ height: 36, padding: '4px 10px' }}
                          value={sessionTime}
                          onChange={e => setSessionTime(e.target.value)}
                        >
                          {SESSION_TIME_SLOTS.map(s => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ paddingTop: 18 }}>
                        <button
                          type="button"
                          onClick={() => setShowRecentSessions(prev => !prev)}
                          className={`btn btn-sm ${showRecentSessions ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6 }}
                          title="Toggle Past Attendance Sessions and Audit History"
                        >
                          <Clock size={14} />
                          <span>Session History ({recentSessions.length})</span>
                        </button>
                      </div>

                      <div>
                        <label className="form-label">Filter Roster</label>
                        <div className="search-bar" style={{ height: 36 }}>
                          <Search size={14} />
                          <input
                            placeholder="Search name or ID…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 18 }}>
                      <button
                        type="button"
                        onClick={() => handleMarkAll('present')}
                        className="btn btn-secondary btn-sm"
                      >
                        <Check size={14} color="var(--success)" />
                        <span>All Present</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkAll('absent')}
                        className="btn btn-secondary btn-sm"
                      >
                        <X size={14} color="var(--danger)" />
                        <span>All Absent</span>
                      </button>
                      {activeExistingSession ? (
                        <button
                          type="button"
                          onClick={handleOpenAuditReviewModal}
                          disabled={loadingSessionDetails || updatingSession}
                          className="btn btn-warning btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Edit3 size={14} />
                          <span>Update Session (Audit Review Required)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSaveAttendance}
                          disabled={savingAttendance}
                          className="btn btn-primary btn-sm"
                        >
                          {savingAttendance ? (
                            <>
                              <div className="spinner" style={{ width: 12, height: 12 }} />
                              <span>Recording…</span>
                            </>
                          ) : (
                            <>
                              <Save size={14} />
                              <span>Save Session Attendance</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active Session Archive Banner */}
                {activeExistingSession && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    marginBottom: 'var(--space-4)',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        flexShrink: 0
                      }}>
                        <Clock size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                            Recorded Attendance Session #{activeExistingSession.id}
                          </span>
                          {activeExistingSession.is_edited ? (
                            <Badge variant="warning">Modified (Audited)</Badge>
                          ) : (
                            <Badge variant="neutral">Original Archive</Badge>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Taken on <strong>{activeExistingSession.session_date}</strong> for <strong>{activeExistingSession.time_slot}</strong> · Originally recorded: {activeExistingSession.present_count} Present, {activeExistingSession.absent_count} Absent
                          {activeExistingSession.is_edited && activeExistingSession.change_comment && (
                            <span style={{ marginLeft: 6, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                              (Audit reason: "{activeExistingSession.change_comment}")
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Current Roster: <strong style={{ color: 'var(--success)' }}>{currentWorkstationPresent} Present</strong>, <strong style={{ color: 'var(--danger)' }}>{currentWorkstationAbsent} Absent</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenAuditReviewModal}
                        disabled={loadingSessionDetails || updatingSession}
                        className="btn btn-warning btn-sm"
                      >
                        <Edit3 size={13} />
                        <span>Review & Save Edits</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Student Attendance Roster */}
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Historical Attendance</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center', width: 140 }}>Session Roll Call</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingStudents ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                            <div className="spinner" />
                          </td>
                        </tr>
                      ) : filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                            No students match your search query.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((s, idx) => {
                          const isPres = attStatuses[s.student_id] === 'present'
                          return (
                            <tr key={s.student_id}>
                              <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {s.student_id}
                              </td>
                              <td style={{ fontWeight: 500 }}>{s.name}</td>
                              <td className="tabular-nums">
                                <span style={{
                                  fontWeight: 600,
                                  color: (s.attendance_pct ?? s.attendance_rate ?? 85) < 75 ? 'var(--danger)' : 'var(--text-secondary)'
                                }}>
                                  {s.attendance_pct ?? s.attendance_rate ?? 85}%
                                </span>
                              </td>
                              <td>
                                {s.is_at_risk ? (
                                  <Badge variant="danger" icon={AlertTriangle}>At-Risk (&lt;75%)</Badge>
                                ) : (
                                  <Badge variant="success">Normal</Badge>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => toggleStudentAttendance(s.student_id)}
                                  className={`btn btn-sm ${isPres ? 'btn-success' : 'btn-danger'}`}
                                  style={{ width: 105 }}
                                >
                                  {isPres ? '✓ Present' : '✗ Absent'}
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Session History Drawer */}
                {showRecentSessions && (
                  <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                    <div className="card-header">
                      <div>
                        <h3 className="card-title">Past Attendance Sessions (Audit Log)</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                          Official session logs with faculty timestamps and change justifications.
                        </p>
                      </div>
                    </div>

                    {recentSessions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No past attendance sessions recorded yet for this course.
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Slot / Period</th>
                              <th>Present Count</th>
                              <th>Absent Count</th>
                              <th>Attendance %</th>
                              <th>Audit Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentSessions.map(sess => (
                              <tr key={sess.id}>
                                <td style={{ fontWeight: 600 }}>{sess.session_date}</td>
                                <td>{sess.time_slot || 'Regular Period'}</td>
                                <td className="tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>
                                  {sess.present_count}
                                </td>
                                <td className="tabular-nums" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                  {sess.absent_count}
                                </td>
                                <td className="tabular-nums" style={{ fontWeight: 600 }}>
                                  {sess.attendance_rate}%
                                </td>
                                <td>
                                  {sess.is_edited ? (
                                    <Badge variant="warning">Modified</Badge>
                                  ) : (
                                    <Badge variant="neutral">Original</Badge>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleLoadSessionIntoWorkstation(sess)}
                                      className="btn btn-primary btn-sm"
                                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                      title="Load this session into the roll-call workstation"
                                    >
                                      <ArrowRight size={13} />
                                      <span>Load into Roll-Call</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSession(sess.id)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                      title="Edit in modal"
                                    >
                                      <Edit3 size={13} />
                                      <span>Quick Edit</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 2: Marks Entry (CIE/SEE) ── */}
            {activeTab === 'marks' && (
              <div>
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div>
                        <label className="form-label">Evaluation Component</label>
                        <select
                          className="form-select"
                          value={selectedExam}
                          onChange={e => setSelectedExam(e.target.value)}
                        >
                          {EXAM_OPTIONS.map(opt => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label} (Max: {opt.max})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ paddingTop: 18 }}>
                        <Badge variant="primary">Maximum Score: {maxMark} Marks</Badge>
                      </div>
                    </div>

                    <div style={{ paddingTop: 18 }}>
                      <button
                        type="button"
                        onClick={handleSaveMarks}
                        disabled={savingMarks}
                        className="btn btn-primary btn-sm"
                      >
                        {savingMarks ? 'Saving Marks…' : 'Save Marks Matrix'}
                      </button>
                    </div>
                  </div>
                </div>

                {marksStats && (
                  <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
                    <StatCard label="Class Average" value={marksStats.average} subtext={`Out of ${maxMark}`} variant="primary" />
                    <StatCard label="Highest Score" value={marksStats.highest} subtext={`Top Mark`} variant="success" />
                    <StatCard label="Lowest Score" value={marksStats.lowest} subtext={`Minimum Mark`} variant="warning" />
                    <StatCard label="Component Pass Rate" value={`${marksStats.pass_rate}%`} subtext="Meeting threshold" variant="info" />
                  </div>
                )}

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Marks Score (Max: {maxMark})</th>
                        <th>Normalized %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, idx) => {
                        const val = marksInputs[s.student_id] ?? ''
                        const numVal = parseFloat(val)
                        const normPercent = !isNaN(numVal) ? Math.round((numVal / maxMark) * 100) : null
                        return (
                          <tr key={s.student_id}>
                            <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.student_id}</td>
                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                max={maxMark}
                                step="0.5"
                                value={val}
                                onChange={e => {
                                  const v = e.target.value
                                  setMarksInputs(prev => ({ ...prev, [s.student_id]: v }))
                                }}
                                className="form-input"
                                style={{ width: 120, height: 32 }}
                                placeholder={`0 – ${maxMark}`}
                              />
                            </td>
                            <td className="tabular-nums">
                              {normPercent !== null ? (
                                <span style={{
                                  fontWeight: 600,
                                  color: normPercent < 40 ? 'var(--danger)' : normPercent >= 75 ? 'var(--success)' : 'var(--text-secondary)'
                                }}>
                                  {normPercent}%
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Tab 3: At-Risk & Parent Contact ── */}
            {activeTab === 'at-risk' && (
              <div>
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <h3 className="card-title">At-Risk Students Requiring Direct Intervention</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Students with attendance deficits (&lt;75%) or failing continuous internal assessments in {activeClass.course_name}. Contact parents through DPDP Act 2023 compliant encrypted proxy channels.
                  </p>
                </div>

                {atRiskStudents.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No At-Risk Students in this Section"
                    description="All students currently meet attendance and evaluation criteria."
                  />
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>Attendance Rate</th>
                          <th>Evaluation Risk</th>
                          <th style={{ textAlign: 'right' }}>Guardian Communication</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRiskStudents.map(s => (
                          <tr key={s.student_id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.student_id}</td>
                            <td style={{ fontWeight: 500 }}>{s.name}</td>
                            <td className="tabular-nums">
                              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                                {s.attendance_pct ?? s.attendance_rate ?? 0}%
                              </span>
                            </td>
                            <td>
                              <Badge variant="danger" icon={AlertTriangle}>Low Attendance</Badge>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => openContact(s)}
                                className="btn btn-danger btn-sm"
                              >
                                <Phone size={13} />
                                <span>Contact Guardian</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Edit Past Session Modal ── */}
        <Modal
          isOpen={editingSessionId !== null}
          onClose={() => setEditingSessionId(null)}
          title="Modify Past Attendance Session (Audit Logged)"
          maxWidth={640}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingSessionId(null)}
                disabled={savingSession}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSessionChanges}
                disabled={savingSession || !changeComment.trim()}
                className="btn btn-primary btn-sm"
              >
                {savingSession ? 'Saving…' : 'Save Changes & Update Audit'}
              </button>
            </>
          }
        >
          {loadingSession ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <div className="spinner" />
            </div>
          ) : sessionDetail ? (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <Badge variant="neutral">Date: {sessionDetail.session_date}</Badge>
                <Badge variant="neutral">Slot: {sessionDetail.time_slot || 'Regular'}</Badge>
                <Badge variant="success">Present: {modalPresentCount}</Badge>
                <Badge variant="danger">Absent: {modalAbsentCount}</Badge>
                <Badge variant="primary">{modalAttendanceRate}%</Badge>
              </div>

              {sessionDetail.is_edited && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--warning-subtle)',
                  border: '1px solid var(--warning-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--warning)',
                  marginBottom: 16,
                }}>
                  <strong>Audit History:</strong> Modified previously by {sessionDetail.edited_by || 'Faculty'}
                  {sessionDetail.change_comment && (
                    <div style={{ color: 'var(--text-primary)', marginTop: 2, fontStyle: 'italic' }}>
                      "{sessionDetail.change_comment}"
                    </div>
                  )}
                </div>
              )}

              {/* Roster Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['all', 'present', 'absent'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSessionFilter(f)}
                      className={`btn btn-sm ${sessionFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleBatchModalToggle('present')}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--success)' }}
                  >
                    All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchModalToggle('absent')}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                  >
                    All Absent
                  </button>
                </div>
              </div>

              {/* Student List */}
              <div className="table-wrapper" style={{ maxHeight: 220, marginBottom: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>#</th>
                      <th>Student</th>
                      <th style={{ textAlign: 'center', width: 140 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModalRoster.map((s, idx) => {
                      const isP = s.status === 'present'
                      return (
                        <tr key={s.student_id}>
                          <td>{idx + 1}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{s.name}</span>{' '}
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                              ({s.student_id})
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleModalStudent(s.student_id)}
                              className={`btn btn-sm ${isP ? 'btn-success' : 'btn-danger'}`}
                              style={{ width: 100 }}
                            >
                              {isP ? '✓ Present' : '✗ Absent'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mandatory Reason */}
              <div className="form-group">
                <label className="form-label">
                  Institutional Reason for Modification * (Required for NBA Audit)
                </label>
                <textarea
                  className="form-textarea"
                  value={changeComment}
                  onChange={e => setChangeComment(e.target.value)}
                  placeholder="State official reason (e.g. Medical certificate approved for STU002, On-Duty participation in VTU hackathon verified)..."
                  required
                />
              </div>
            </div>
          ) : null}
        </Modal>

        {/* ── Parent Contact SMS Modal ── */}
        <Modal
          isOpen={contactModal !== null}
          onClose={() => setContactModal(null)}
          title={`Contact Guardian: ${contactModal?.name}`}
          maxWidth={540}
          footer={
            <>
              <button
                type="button"
                onClick={() => setContactModal(null)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSms}
                disabled={sendingSms || !smsText.trim()}
                className="btn btn-primary btn-sm"
              >
                {sendingSms ? 'Sending Alert…' : 'Send Alert via Encrypted SMS'}
              </button>
            </>
          }
        >
          {contactModal && (
            <div>
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{contactModal.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{contactModal.student_id}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Current Course Attendance: <strong style={{ color: 'var(--danger)' }}>{contactModal.attendance_pct ?? contactModal.attendance_rate ?? 0}%</strong> (Threshold: 75%)
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">SMS Alert Content</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={smsText}
                  onChange={e => setSmsText(e.target.value)}
                  placeholder="Enter message to student's guardian..."
                />
                <p className="form-hint">
                  Dispatched via DPDP Act compliant Twilio proxy bridge. Personal phone numbers remain masked.
                </p>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Audit Review Modal for Workstation Updates ── */}
        <Modal
          isOpen={showAuditReviewModal}
          onClose={() => !updatingSession && setShowAuditReviewModal(false)}
          title="Attendance Modification Audit Review"
          maxWidth={580}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAuditReviewModal(false)}
                disabled={updatingSession}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSessionUpdate}
                disabled={updatingSession || !auditJustification.trim()}
                className="btn btn-warning btn-sm"
              >
                {updatingSession ? 'Recording Audit…' : 'Confirm & Update Audit Log'}
              </button>
            </>
          }
        >
          {activeExistingSession && (
            <div>
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldAlert size={16} color="var(--warning)" />
                  <span>Institutional Accreditation Compliance Notice</span>
                </div>
                You are modifying an archived attendance session for <strong>{activeClass?.course_name} ({activeClass?.course_code} - Sec {activeClass?.section})</strong> on <strong>{activeExistingSession.session_date} ({activeExistingSession.time_slot})</strong>. An institutional justification is mandatory for NBA/NAAC audit trails.
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <Badge variant="neutral">Session #{activeExistingSession.id}</Badge>
                <Badge variant="neutral">{activeExistingSession.session_date}</Badge>
                <Badge variant="neutral">{activeExistingSession.time_slot}</Badge>
                <Badge variant="success">{currentWorkstationPresent} Present</Badge>
                <Badge variant="danger">{currentWorkstationAbsent} Absent</Badge>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Reason for Attendance Revision * (Mandatory)
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="e.g. Medical leave approved by HOD for STU002; On-duty certificate verified for STU005..."
                  value={auditJustification}
                  onChange={e => setAuditJustification(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  This reason will be stamped with your faculty ID and UTC timestamp in the institutional database.
                </span>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  )
}
