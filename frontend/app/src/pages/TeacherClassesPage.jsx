import React, { useEffect, useState, useMemo } from 'react'
import { classesAPI, contactAPI } from '../api/client'
import {
  BookOpen, Users, CheckCircle2, XCircle, AlertTriangle,
  Calendar, Save, Search, RefreshCw, Send, CheckSquare,
  Square, ShieldAlert, Award, ChevronRight, Phone, Clock
} from 'lucide-react'

import toast from 'react-hot-toast'

const EXAM_OPTIONS = [
  { key: 'cie1',  label: 'Continuous Internal Evaluation 1 (CIE 1)', max: 25 },
  { key: 'cie2',  label: 'Continuous Internal Evaluation 2 (CIE 2)', max: 25 },
  { key: 'quiz1', label: 'Quiz 1',                                  max: 10 },
  { key: 'quiz2', label: 'Quiz 2',                                  max: 10 },
  { key: 'el',    label: 'Experiential Learning (EL)',               max: 30 },
  { key: 'see',   label: 'Semester End Examination (SEE)',          max: 100 },
]

export const SESSION_TIME_SLOTS = [
  // 1-Hour Lecture Slots
  { value: '09:00 AM - 10:00 AM', label: '09:00 AM – 10:00 AM (Period 1)', duration: '1 hr', type: '1-Hour Lecture' },
  { value: '10:00 AM - 11:00 AM', label: '10:00 AM – 11:00 AM (Period 2)', duration: '1 hr', type: '1-Hour Lecture' },
  { value: '11:30 AM - 12:30 PM', label: '11:30 AM – 12:30 PM (Period 3)', duration: '1 hr', type: '1-Hour Lecture' },
  { value: '12:30 PM - 01:30 PM', label: '12:30 PM – 01:30 PM (Period 4)', duration: '1 hr', type: '1-Hour Lecture' },
  { value: '02:30 PM - 03:30 PM', label: '02:30 PM – 03:30 PM (Period 5)', duration: '1 hr', type: '1-Hour Lecture' },
  { value: '03:30 PM - 04:30 PM', label: '03:30 PM – 04:30 PM (Period 6)', duration: '1 hr', type: '1-Hour Lecture' },

  // 2-Hour Lab / Block Slots
  { value: '09:00 AM - 11:00 AM', label: '09:00 AM – 11:00 AM (Morning Lab Block — 2 hrs)', duration: '2 hrs', type: '2-Hour Lab / Block' },
  { value: '11:30 AM - 01:30 PM', label: '11:30 AM – 01:30 PM (Midday Lab Block — 2 hrs)', duration: '2 hrs', type: '2-Hour Lab / Block' },
  { value: '02:30 PM - 04:30 PM', label: '02:30 PM – 04:30 PM (Afternoon Lab Block — 2 hrs)', duration: '2 hrs', type: '2-Hour Lab / Block' },
]

export default function TeacherClassesPage() {
  const [classes, setClasses]           = useState([])
  const [activeClass, setActiveClass]   = useState(null)
  const [students, setStudents]         = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)

  const [activeTab, setActiveTab]       = useState('attendance') // 'attendance' | 'marks' | 'at-risk'
  const [search, setSearch]             = useState('')

  // ── Attendance State ────────────────────────────────────────────────────────
  const [attDate, setAttDate]           = useState(new Date().toISOString().slice(0, 10))
  const [sessionTime, setSessionTime]   = useState('09:00 AM - 10:00 AM')
  const [attStatuses, setAttStatuses]   = useState({}) // { STU001: 'present' | 'absent' }
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [recentSessions, setRecentSessions] = useState([])
  const [showRecentSessions, setShowRecentSessions] = useState(false)

  // ── Edit Past Session Modal State ──────────────────────────────────────────
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [sessionDetail, setSessionDetail]       = useState(null)
  const [sessionRoster, setSessionRoster]       = useState([])
  const [changeComment, setChangeComment]       = useState('')
  const [loadingSession, setLoadingSession]     = useState(false)
  const [savingSession, setSavingSession]       = useState(false)
  const [sessionSearch, setSessionSearch]       = useState('')
  const [sessionFilter, setSessionFilter]       = useState('all') // 'all', 'present', 'absent'


  // ── Marks State ─────────────────────────────────────────────────────────────
  const [selectedExam, setSelectedExam] = useState('cie1')
  const [marksInputs, setMarksInputs]   = useState({}) // { STU001: 22.5 }
  const [savingMarks, setSavingMarks]   = useState(false)
  const [marksStats, setMarksStats]     = useState(null)

  // ── Contact Modal State ─────────────────────────────────────────────────────
  const [contactModal, setContactModal] = useState(null) // student object
  const [smsText, setSmsText]           = useState('')
  const [sendingSms, setSendingSms]     = useState(false)


  // Fetch classes on load
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

  // Fetch student roster whenever active class changes
  const loadRoster = async (ca) => {
    if (!ca) return
    setLoadingStudents(true)
    try {
      const res = await classesAPI.getClassStudents(ca.course_code, ca.section)
      const list = res.data?.students || []
      setStudents(list)

      // Initialize default attendance (all present by default)
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

  // Sync marks inputs when exam changes
  useEffect(() => {
    const updated = {}
    students.forEach(s => {
      updated[s.student_id] = s[selectedExam] !== null && s[selectedExam] !== undefined ? s[selectedExam] : ''
    })
    setMarksInputs(updated)
    setMarksStats(null)
  }, [selectedExam, students])

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    )
  }, [students, search])

  // At-risk students in this class
  const atRiskStudents = useMemo(() => {
    return students.filter(s => s.is_at_risk)
  }, [students])

  // Attendance helpers
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
      toast.success(`Attendance recorded for ${sessionTime}: ${res.data.present_count} Present, ${res.data.absent_count} Absent`)
      await loadRoster(activeClass)
      await loadSessions(activeClass)
      loadClasses() // refresh at-risk count
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendance')
    } finally {
      setSavingAttendance(false)
    }
  }


  // Marks helpers
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
      loadClasses() // refresh at-risk count
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save exam marks')
    } finally {
      setSavingMarks(false)
    }
  }

  // Contact parent SMS
  const handleSendSms = async () => {
    if (!contactModal || !smsText.trim()) return
    setSendingSms(true)
    try {
      await contactAPI.sms(contactModal.student_id, smsText)
      toast.success(`SMS alert sent to parent of ${contactModal.name}`)
      setContactModal(null)
      setSmsText('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send SMS alert')
    } finally {
      setSendingSms(false)
    }
  }

  const openContact = (s) => {
    setContactModal(s)
    setSmsText(
      `Dear Parent, this is an academic alert from your ward's course teacher for ${s.name} (${s.student_id}) regarding academic performance/attendance in ${activeClass?.course_name}. Please check the portal or contact the department.`
    )
  }

  // Past session edit handlers
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
      toast.error('Please enter a comment explaining why you changed the attendance')
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
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Classes & Evaluation Management</h1>
            <p className="page-subtitle">
              Attendance tracking, exam-wise CIE/SEE mark entry, and student risk alerts
            </p>
          </div>
          <button onClick={() => { loadClasses(); if (activeClass) loadRoster(activeClass); }} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh Roster
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* ── Class Selector Cards ── */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>
            My Assigned Classes
          </label>
          {loadingClasses ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading classes…</div>
          ) : classes.length === 0 ? (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              No classes assigned to this account.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {classes.map(ca => {
                const isSelected = activeClass?.course_code === ca.course_code && activeClass?.section === ca.section
                return (
                  <div
                    key={`${ca.course_code}-${ca.section}`}
                    onClick={() => setActiveClass(ca)}
                    className="card"
                    style={{
                      padding: 14,
                      cursor: 'pointer',
                      border: `2px solid ${isSelected ? 'var(--primary, #3b82f6)' : 'var(--border)'}`,
                      background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface)',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                        {ca.course_code}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge badge-info" style={{ fontWeight: 600 }}>
                          Sec {ca.section} (Sem {ca.semester})
                        </span>
                        {ca.at_risk_count > 0 && (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <AlertTriangle size={10} /> {ca.at_risk_count} At Risk
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {ca.course_name}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Faculty: <strong>{ca.faculty_name}</strong></span>
                      <span><strong>{ca.student_count}</strong> Students</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Active Class Management Interface ── */}
        {activeClass && (
          <div className="card" style={{ padding: 20 }}>
            {/* Top Bar with Navigation Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                    {activeClass.course_code} — {activeClass.course_name}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Section {activeClass.section} • Semester {activeClass.semester} • {students.length} Enrolled
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, background: 'var(--bg-700, #f1f5f9)', padding: 4, borderRadius: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'attendance' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('attendance')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Calendar size={14} /> Attendance
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'marks' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('marks')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Award size={14} /> Exam Marks Entry
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${activeTab === 'at-risk' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab('at-risk')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ShieldAlert size={14} />
                  At-Risk Alerts
                  {atRiskStudents.length > 0 && (
                    <span style={{ background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                      {atRiskStudents.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ── Search Bar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ position: 'relative', width: 280 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by name or roll no…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: 13, height: 34 }}
                />
              </div>

              {/* Quick Summary based on Tab */}
              {activeTab === 'attendance' && (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Present: <strong style={{ color: '#10b981' }}>{Object.values(attStatuses).filter(s => s === 'present').length}</strong> |
                  Absent: <strong style={{ color: '#ef4444' }}>{Object.values(attStatuses).filter(s => s === 'absent').length}</strong>
                </div>
              )}
            </div>

            {/* ── TAB 1: ATTENDANCE ── */}
            {activeTab === 'attendance' && (
              <div>
                {/* Date, Session Time Slot & Bulk Action Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-800, #f8fafc)', padding: '12px 16px', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {/* Date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={14} /> Date:
                        </label>
                        <input
                          type="date"
                          value={attDate}
                          onChange={e => setAttDate(e.target.value)}
                          className="form-input"
                          style={{ width: 145, height: 34, fontSize: 13 }}
                        />
                      </div>

                      {/* Session Time Slot Dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={14} /> Session Time:
                        </label>
                        <select
                          value={sessionTime}
                          onChange={e => setSessionTime(e.target.value)}
                          className="form-select"
                          style={{ width: 330, height: 34, fontSize: 13, fontWeight: 600 }}
                        >
                          <optgroup label="1-Hour Lecture Slots (6 Periods)">
                            {SESSION_TIME_SLOTS.filter(s => s.duration === '1 hr').map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </optgroup>
                          <optgroup label="2-Hour Lab / Block Slots (3 Blocks)">
                            {SESSION_TIME_SLOTS.filter(s => s.duration === '2 hrs').map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <span className={`badge ${SESSION_TIME_SLOTS.find(s => s.value === sessionTime)?.duration === '2 hrs' ? 'badge-primary' : 'badge-info'}`} style={{ fontWeight: 600 }}>
                        {SESSION_TIME_SLOTS.find(s => s.value === sessionTime)?.duration === '2 hrs' ? '2-Hour Lab Block' : '1-Hour Lecture'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => handleMarkAll('present')} className="btn btn-xs btn-outline">
                        <CheckSquare size={12} /> Mark All Present
                      </button>
                      <button type="button" onClick={() => handleMarkAll('absent')} className="btn btn-xs btn-ghost">
                        <Square size={12} /> Mark All Absent
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveAttendance}
                        disabled={savingAttendance}
                        className="btn btn-sm btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Save size={14} /> {savingAttendance ? 'Saving…' : 'Save Attendance Session'}
                      </button>
                    </div>
                  </div>

                  {/* College Schedule Guide Strip */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 8, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>🕒 Classes: <strong>9:00 AM – 4:30 PM</strong></span>
                      <span>•</span>
                      <span>☕ Break: <strong>11:00 AM – 11:30 AM</strong></span>
                      <span>•</span>
                      <span>🍽️ Lunch: <strong>1:30 PM – 2:30 PM</strong></span>
                      <span>•</span>
                      <span>Sessions: <strong>1 Hr & 2 Hr Blocks</strong></span>
                    </div>

                    {recentSessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowRecentSessions(p => !p)}
                        className="btn btn-ghost btn-xs"
                        style={{ color: 'var(--primary)', fontWeight: 600 }}
                      >
                        {showRecentSessions ? '▲ Hide History' : `▼ Past Sessions (${recentSessions.length})`}
                      </button>
                    )}
                  </div>

                  {/* Collapsible Recent Sessions Table */}
                  {showRecentSessions && recentSessions.length > 0 && (
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      marginTop: 8,
                      animation: 'fadeSlideDown 0.2s ease',
                    }}>
                      <div className="flex items-center justify-between mb-sm" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          📋 Past Attendance Sessions ({recentSessions.length})
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Click "View & Edit" on any session to review student presence or change attendance with audit reasons.
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 10 }}>
                        {recentSessions.map(rs => {
                          const tot = rs.total_students || (rs.present_count + rs.absent_count) || 1
                          const attRate = Math.round((rs.present_count / tot) * 100)

                          return (
                            <div
                              key={rs.id}
                              style={{
                                background: 'var(--bg-800)',
                                border: rs.is_edited ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border)',
                                borderRadius: 8,
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div style={{ fontWeight: 700, fontSize: 12 }}>
                                  📅 {rs.session_date}
                                </div>
                                {rs.is_edited ? (
                                  <span
                                    className="badge badge-warning"
                                    style={{ fontSize: 10, padding: '2px 6px' }}
                                    title={rs.change_comment ? `Modified: ${rs.change_comment}` : 'Modified'}
                                  >
                                    ✏️ Modified
                                  </span>
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: 10, padding: '2px 6px' }}>
                                    Recorded
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                                🕒 {rs.time_slot || 'Regular Session'}
                              </div>

                              <div className="flex items-center justify-between" style={{ fontSize: 11, marginTop: 2 }}>
                                <div style={{ color: 'var(--text-secondary)' }}>
                                  Present: <strong style={{ color: '#10b981' }}>{rs.present_count}</strong> | Absent: <strong style={{ color: '#ef4444' }}>{rs.absent_count}</strong> ({attRate}%)
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditSession(rs.id)}
                                  className="btn btn-outline btn-xs"
                                  style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)',
                                    fontWeight: 600,
                                  }}
                                >
                                  ✏️ View & Edit
                                </button>
                              </div>

                              {rs.is_edited && rs.change_comment && (
                                <div style={{
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }} title={rs.change_comment}>
                                  💬 <em>{rs.change_comment}</em>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                </div>


                {/* Table */}
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Sl</th>
                        <th style={{ width: 120 }}>Student ID</th>
                        <th>Student Name</th>
                        <th style={{ width: 150 }}>Course Attendance</th>
                        <th style={{ width: 140 }}>Risk Status</th>
                        <th style={{ width: 160, textAlign: 'center' }}>Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, idx) => {
                        const status = attStatuses[s.student_id] || 'present'
                        const isPresent = status === 'present'
                        return (
                          <tr key={s.student_id} style={{ background: isPresent ? 'transparent' : 'rgba(239, 68, 68, 0.04)' }}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td><code>{s.student_id}</code></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                              <small style={{ color: 'var(--text-muted)' }}>{s.email}</small>
                            </td>
                            <td>
                              <span style={{
                                fontWeight: 700,
                                color: s.attendance_pct >= 75 ? '#10b981' : s.attendance_pct >= 60 ? '#f59e0b' : '#ef4444'
                              }}>
                                {s.attendance_pct}%
                              </span>
                            </td>
                            <td>
                              {s.is_at_risk ? (
                                <span className="badge badge-danger" title={s.risk_reasons.join(' | ')}>
                                  <AlertTriangle size={11} style={{ marginRight: 3 }} />
                                  {s.risk_severity.toUpperCase()}
                                </span>
                              ) : (
                                <span className="badge badge-success">Good</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-700, #e2e8f0)', padding: 3, borderRadius: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => setAttStatuses(p => ({ ...p, [s.student_id]: 'present' }))}
                                  style={{
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: isPresent ? '#10b981' : 'transparent',
                                    color: isPresent ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAttStatuses(p => ({ ...p, [s.student_id]: 'absent' }))}
                                  style={{
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: !isPresent ? '#ef4444' : 'transparent',
                                    color: !isPresent ? 'white' : 'var(--text-secondary)',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  Absent
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 2: EXAM MARKS ENTRY ── */}
            {activeTab === 'marks' && (
              <div>
                {/* Exam Selection & Callout */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-800, #f8fafc)', padding: 14, borderRadius: 8, marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 700 }}>Select Examination:</label>
                    <select
                      value={selectedExam}
                      onChange={e => setSelectedExam(e.target.value)}
                      className="form-select"
                      style={{ width: 280, fontWeight: 600 }}
                    >
                      {EXAM_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} (Max {opt.max})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveMarks}
                    disabled={savingMarks}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Save size={14} />
                    {savingMarks ? 'Saving…' : `Save ${selectedExam.toUpperCase()} Marks`}
                  </button>
                </div>

                {/* Optional Stats Banner after saving */}
                {marksStats && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    padding: '10px 16px',
                    borderRadius: 8,
                    marginBottom: 14,
                    fontSize: 13,
                  }}>
                    <div>Class Average: <strong>{marksStats.average} / {maxMark}</strong></div>
                    <div>Highest: <strong>{marksStats.highest}</strong></div>
                    <div>Lowest: <strong>{marksStats.lowest}</strong></div>
                    <div>Passing Rate: <strong style={{ color: '#10b981' }}>{marksStats.pass_percentage}%</strong></div>
                  </div>
                )}

                {/* Marks Roster Table */}
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Sl</th>
                        <th style={{ width: 120 }}>Student ID</th>
                        <th>Student Name</th>
                        <th style={{ width: 140 }}>
                          {selectedExam.toUpperCase()} Score (/ {maxMark})
                        </th>
                        <th style={{ width: 100 }}>CIE Raw (/100)</th>
                        <th style={{ width: 100 }}>Reduced (/50)</th>
                        <th style={{ width: 100 }}>Grade</th>
                        <th style={{ width: 150 }}>Risk Alert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, idx) => {
                        const val = marksInputs[s.student_id] ?? ''
                        const isLowCie = val !== '' && parseFloat(val) < (maxMark * 0.48)
                        return (
                          <tr key={s.student_id} style={{ background: isLowCie ? 'rgba(239, 68, 68, 0.04)' : 'transparent' }}>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                            <td><code>{s.student_id}</code></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                              <small style={{ color: 'var(--text-muted)' }}>Att: {s.attendance_pct}%</small>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={maxMark}
                                  value={val}
                                  onChange={e => {
                                    const num = e.target.value
                                    setMarksInputs(prev => ({ ...prev, [s.student_id]: num }))
                                  }}
                                  placeholder={`0–${maxMark}`}
                                  className="form-input"
                                  style={{
                                    width: 80,
                                    height: 32,
                                    fontWeight: 700,
                                    borderColor: isLowCie ? '#ef4444' : undefined,
                                    background: isLowCie ? 'rgba(239, 68, 68, 0.08)' : undefined,
                                  }}
                                />
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>/ {maxMark}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{s.cie_raw}</td>
                            <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{s.cie_reduced}</td>
                            <td>
                              <span className={`badge ${s.grade === 'F' ? 'badge-danger' : 'badge-success'}`}>
                                {s.grade}
                              </span>
                            </td>
                            <td>
                              {isLowCie ? (
                                <span className="badge badge-danger" title="Scored below passing threshold on this evaluation">
                                  <AlertTriangle size={11} style={{ marginRight: 3 }} /> Low Mark
                                </span>
                              ) : s.is_at_risk ? (
                                <span className="badge badge-warning" title={s.risk_reasons.join(' | ')}>
                                  {s.risk_severity}
                                </span>
                              ) : (
                                <span className="badge badge-success">Normal</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB 3: LOW-PERFORMING & HIGH-RISK ALERTS ── */}
            {activeTab === 'at-risk' && (
              <div>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <ShieldAlert size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, color: '#ef4444', fontWeight: 700 }}>
                      Class Low-Performance & Attendance Early Warning System
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Students scoring below 48% on CIE evaluations or holding attendance below the 75% NBA threshold require remedial faculty mentoring or parent notification.
                    </span>
                  </div>
                </div>

                {atRiskStudents.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={32} style={{ color: '#10b981', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600 }}>Zero At-Risk Students Detected</div>
                    <div style={{ fontSize: 12 }}>All enrolled students in this section are currently above attendance and evaluation risk thresholds.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                    {atRiskStudents.map(s => (
                      <div
                        key={s.student_id}
                        className="card"
                        style={{
                          padding: 16,
                          borderLeft: `4px solid ${s.risk_severity === 'high' ? '#ef4444' : '#f59e0b'}`,
                          background: 'var(--surface)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                            <code style={{ fontSize: 12 }}>{s.student_id}</code> • <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sec {s.section}</span>
                          </div>
                          <span className={`badge ${s.risk_severity === 'high' ? 'badge-danger' : 'badge-warning'}`}>
                            {s.risk_severity.toUpperCase()} RISK
                          </span>
                        </div>

                        {/* Metric Row */}
                        <div style={{ display: 'flex', gap: 12, background: 'var(--bg-800, #f8fafc)', padding: '8px 12px', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>
                          <div>Attendance: <strong style={{ color: s.attendance_pct < 75 ? '#ef4444' : '#10b981' }}>{s.attendance_pct}%</strong></div>
                          <div>CIE 1: <strong>{s.cie1 !== null ? `${s.cie1}/25` : '—'}</strong></div>
                          <div>Grade: <strong style={{ color: s.grade === 'F' ? '#ef4444' : 'inherit' }}>{s.grade}</strong></div>
                        </div>

                        {/* Reasons */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Risk Triggers:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#ef4444' }}>
                            {s.risk_reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          <button
                            type="button"
                            onClick={() => openContact(s)}
                            className="btn btn-xs btn-outline"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Send size={11} /> Alert Parent (SMS)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Parent Contact SMS Modal ── */}
        {contactModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
          }}>
            <div className="card" style={{ maxWidth: 480, width: '100%', padding: 20 }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>
                Send Remedial Alert to Parent
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Student: <strong>{contactModal.name}</strong> ({contactModal.student_id})
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  SMS Notification Message:
                </label>
                <textarea
                  rows={4}
                  value={smsText}
                  onChange={e => setSmsText(e.target.value)}
                  className="form-textarea"
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                  disabled={sendingSms}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Send size={13} /> {sendingSms ? 'Sending…' : 'Send SMS'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Past Attendance Session Modal */}
        {editingSessionId && (
          <div className="modal-backdrop" onClick={() => !savingSession && setEditingSessionId(null)}>
            <div
              className="modal-dialog"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              <div className="modal-header">
                <div>
                  <h3 className="modal-title" style={{ fontSize: 16 }}>
                    ✏️ Edit Past Attendance Session
                  </h3>
                  {sessionDetail && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {sessionDetail.course_code} - {sessionDetail.course_name} (Section {sessionDetail.section})
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSessionId(null)}
                  disabled={savingSession}
                  className="btn btn-ghost btn-xs"
                  style={{ fontSize: 18 }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
                {loadingSession ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                    Loading session attendance details…
                  </div>
                ) : sessionDetail ? (
                  <div>
                    {/* Session Metadata Badges */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 14px',
                      marginBottom: 14,
                    }}>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        📅 Date: <strong>{sessionDetail.session_date}</strong>
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        🕒 Slot: <strong>{sessionDetail.time_slot || 'Regular'}</strong>
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: 11 }}>
                        👥 Roster: <strong>{sessionRoster.length} students</strong>
                      </span>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>
                          ● {modalPresentCount} Present
                        </span>
                        <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>
                          ● {modalAbsentCount} Absent
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          ({modalAttendanceRate}%)
                        </span>
                      </div>
                    </div>

                    {/* Previous edit audit banner if modified */}
                    {sessionDetail.is_edited && (
                      <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 6,
                        padding: '10px 12px',
                        marginBottom: 14,
                        fontSize: 12,
                        color: 'var(--amber)',
                      }}>
                        <strong>⚠️ Audit History:</strong> This session was previously modified by{' '}
                        <strong>{sessionDetail.edited_by || 'Faculty'}</strong> on{' '}
                        {sessionDetail.edited_at ? new Date(sessionDetail.edited_at).toLocaleString() : 'earlier date'}.
                        {sessionDetail.change_comment && (
                          <div style={{ marginTop: 4, color: 'var(--text-primary)', fontStyle: 'italic' }}>
                            "{sessionDetail.change_comment}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Search & Quick Toggles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {['all', 'present', 'absent'].map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setSessionFilter(f)}
                            className={`btn btn-xs ${sessionFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ textTransform: 'capitalize', fontSize: 11 }}
                          >
                            {f} {f === 'all' ? `(${sessionRoster.length})` : f === 'present' ? `(${modalPresentCount})` : `(${modalAbsentCount})`}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Search student…"
                          value={sessionSearch}
                          onChange={e => setSessionSearch(e.target.value)}
                          className="form-input"
                          style={{ height: 28, fontSize: 11, width: 140, padding: '2px 8px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleBatchModalToggle('present')}
                          className="btn btn-ghost btn-xs"
                          style={{ color: '#10b981', fontSize: 11 }}
                        >
                          All Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchModalToggle('absent')}
                          className="btn btn-ghost btn-xs"
                          style={{ color: '#ef4444', fontSize: 11 }}
                        >
                          All Absent
                        </button>
                      </div>
                    </div>

                    {/* Student List in Modal */}
                    <div style={{
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      maxHeight: 260,
                      overflowY: 'auto',
                      marginBottom: 16,
                      background: 'var(--bg-800)',
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                            <th style={{ padding: '6px 10px', textAlign: 'left', width: 40 }}>#</th>
                            <th style={{ padding: '6px 10px', textAlign: 'left' }}>Student</th>
                            <th style={{ padding: '6px 10px', textAlign: 'center', width: 160 }}>Session Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredModalRoster.map((s, idx) => {
                            const isPres = s.status === 'present'
                            return (
                              <tr
                                key={s.student_id}
                                style={{
                                  borderBottom: '1px solid var(--border)',
                                  background: isPres ? 'transparent' : 'rgba(239, 68, 68, 0.05)',
                                }}
                              >
                                <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  <span style={{ fontWeight: 600 }}>{s.name}</span>{' '}
                                  <code style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.student_id}</code>
                                </td>
                                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleModalStudent(s.student_id)}
                                    style={{
                                      padding: '3px 12px',
                                      borderRadius: 20,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      border: isPres ? '1px solid #10b981' : '1px solid #ef4444',
                                      background: isPres ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isPres ? '#10b981' : '#ef4444',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    {isPres ? '✓ Present' : '✗ Absent'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mandatory Reason for Change (Audit Requirement) */}
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.06)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: 8,
                      padding: 12,
                    }}>
                      <label style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--primary)',
                        marginBottom: 4,
                      }}>
                        📝 Reason for Attendance Modification * (Required for Institutional Audit)
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={changeComment}
                        onChange={e => setChangeComment(e.target.value)}
                        placeholder="State reason for change (e.g., Medical certificate submitted for STU003; Approved OD for VTU Athletics; Clerical correction verified by faculty)..."
                        className="form-textarea"
                        style={{ width: '100%', fontSize: 12, resize: 'vertical' }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        🔒 <em>This justification will be permanently saved with your faculty ID to maintain accreditation data integrity.</em>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {savingSession ? 'Saving Changes…' : '💾 Save Changes & Update Records'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

