import React, { useEffect, useState, useMemo } from 'react'
import { clubsAPI, studentRolesAPI, eventsAPI, facultyAPI, studentsAPI, classesAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, Plus, CheckCircle2, XCircle, Clock, Users,
  Award, Shield, FileText, Image, Search, ChevronRight,
  Filter, AlertCircle, Edit, Trash2, ExternalLink, Info, Check, Eye,
  UploadCloud, UserCheck, UserX, Sparkles, Camera, MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

const EVENT_TYPES = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'competition', label: 'Competition' },
  { value: 'conference', label: 'Conference' },
  { value: 'guest_lecture', label: 'Guest Lecture' },
  { value: 'cultural_fest', label: 'Cultural Fest' },
  { value: 'sports_meet', label: 'Sports Meet' },
  { value: 'social_outreach', label: 'Social Outreach' },
  { value: 'other', label: 'Other' },
]

const CLUB_CATEGORIES = [
  { value: 'technical', label: 'Technical' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'sports', label: 'Sports' },
  { value: 'literary', label: 'Literary' },
  { value: 'social', label: 'Social Outreach' },
  { value: 'other', label: 'Other' },
]

const TIMETABLE_PERIODS = [
  { value: '09:00 AM - 10:00 AM', label: 'Period 1 (09:00 AM - 10:00 AM)' },
  { value: '10:00 AM - 11:00 AM', label: 'Period 2 (10:00 AM - 11:00 AM)' },
  { value: '11:30 AM - 12:30 PM', label: 'Period 3 (11:30 AM - 12:30 PM)' },
  { value: '12:30 PM - 01:30 PM', label: 'Period 4 (12:30 PM - 01:30 PM)' },
  { value: '02:15 PM - 03:15 PM', label: 'Period 5 (02:15 PM - 03:15 PM)' },
  { value: '03:15 PM - 04:15 PM', label: 'Period 6 (03:15 PM - 04:15 PM)' },
]

function formatTime12h(time24) {
  if (!time24) return ''
  const [hStr, mStr] = time24.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`
}

function computeTimeSlot(start24, end24) {
  if (!start24 || !end24) return ''
  return `${formatTime12h(start24)} - ${formatTime12h(end24)}`
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate()
}

function isPast(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  d.setHours(23, 59, 59, 999)
  return d < now
}

export default function EventsPage() {
  const { user } = useAuth()
  const role = (user?.role || 'student').toLowerCase()

  const [clubs, setClubs] = useState([])
  const [events, setEvents] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [studentsList, setStudentsList] = useState([])
  const [studentRoles, setStudentRoles] = useState([])
  const [myClasses, setMyClasses] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'clubs' : 'events')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [lifecycleFilter, setLifecycleFilter] = useState('all') // 'all' | 'upcoming' | 'completed'
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showClubModal, setShowClubModal] = useState(false)
  const [reviewingEvent, setReviewingEvent] = useState(null)
  const [viewingEvent, setViewingEvent] = useState(null)
  const [viewingRegistrations, setViewingRegistrations] = useState([])
  const [viewingAwards, setViewingAwards] = useState([])
  const [attendeeSearch, setAttendeeSearch] = useState('')

  const filteredViewingRegistrations = useMemo(() => {
    if (!attendeeSearch.trim()) return viewingRegistrations
    const q = attendeeSearch.toLowerCase()
    return viewingRegistrations.filter(r =>
      (r.student_name || '').toLowerCase().includes(q) ||
      (r.student_id || '').toLowerCase().includes(q) ||
      (r.usn || '').toLowerCase().includes(q) ||
      (r.section || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    )
  }, [viewingRegistrations, attendeeSearch])

  // Day-of Attendance Modal State
  const [attendanceEvent, setAttendanceEvent] = useState(null)
  const [attendanceRoster, setAttendanceRoster] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceSaving, setAttendanceSaving] = useState(false)
  const [walkInStudentId, setWalkInStudentId] = useState('')

  // Post-Event Documentation Modal State
  const [postEventModalEvent, setPostEventModalEvent] = useState(null)
  const [postEventReportText, setPostEventReportText] = useState('')
  const [postEventPhotos, setPostEventPhotos] = useState([])
  const [postEventPhotoPreviews, setPostEventPhotoPreviews] = useState([])
  const [postEventSaving, setPostEventSaving] = useState(false)

  // Faculty Duty Leave Award Modal State
  const [awardModalEvent, setAwardModalEvent] = useState(null)
  const [awardAttendees, setAwardAttendees] = useState([])
  const [awardSelectedIds, setAwardSelectedIds] = useState(new Set())
  const [pastAwards, setPastAwards] = useState([])
  const [awardForm, setAwardForm] = useState({
    course_code: '',
    section: '',
    time_slot: '11:30 AM - 12:30 PM',
    class_date: '',
  })
  const [awardLoading, setAwardLoading] = useState(false)
  const [awardSaving, setAwardSaving] = useState(false)

  // Mentor Review Form
  const [reviewData, setReviewData] = useState({
    po_mapping: '',
    resource_person: '',
    skill_orientation: '',
    rejection_reason: '',
  })
  const [isRejecting, setIsRejecting] = useState(false)

  // Event proposal scheduler form (Strictly NO photos or report inputs at proposal time)
  const [eventForm, setEventForm] = useState({
    club_id: '',
    title: '',
    event_type: 'workshop',
    event_date: '',
    start_time: '11:00',
    end_time: '13:00',
    time_slot: '11:00 AM - 01:00 PM',
    venue: '',
    description: '',
  })

  // Club form
  const [clubForm, setClubForm] = useState({
    name: '',
    category: 'technical',
    description: '',
    mentor_faculty_id: '',
  })
  const [editingClubId, setEditingClubId] = useState(null)

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [clubsRes, facultyRes, rolesRes] = await Promise.all([
        clubsAPI.list(),
        facultyAPI.list().catch(() => ({ data: [] })),
        studentRolesAPI.list().catch(() => ({ data: [] })),
      ])
      setClubs(clubsRes.data || [])
      setFacultyList(facultyRes.data || [])
      setStudentRoles(rolesRes.data || [])

      if (role === 'admin' || role === 'teacher') {
        const [stuRes, clsRes] = await Promise.all([
          studentsAPI.list({ limit: 300 }).catch(() => ({ data: [] })),
          classesAPI.myClasses().catch(() => ({ data: [] })),
        ])
        setStudentsList(stuRes.data || [])
        setMyClasses(clsRes.data || [])
      }

      await loadEvents()
    } catch (err) {
      toast.error('Failed to load events and clubs data')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const res = await eventsAPI.listAll()
      setEvents(res.data || [])
    } catch (_) { }
  }

  useEffect(() => {
    loadInitialData()
  }, [user])

  // User's role in each club
  const userClubRoles = useMemo(() => {
    if (!user || role !== 'student') return {}
    const map = {}
    studentRoles.forEach(r => {
      if (r.student_id === user.linked_id) {
        map[r.club_id] = r.role
      }
    })
    return map
  }, [studentRoles, user, role])

  const isClubLeader = (clubId) => {
    if (role === 'admin') return true
    const r = userClubRoles[clubId]
    return r === 'head' || r === 'council'
  }

  const pendingReviewCount = useMemo(() => {
    return events.filter(e => e.status === 'pending').length
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedClubId && String(e.club_id) !== String(selectedClubId)) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (lifecycleFilter === 'upcoming') {
        if (e.is_completed || e.status !== 'approved') return false
      } else if (lifecycleFilter === 'completed') {
        if (!e.is_completed) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          e.title?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.event_type?.toLowerCase().includes(q) ||
          e.club_name?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [events, selectedClubId, statusFilter, lifecycleFilter, searchQuery])

  // ── Handlers ──

  // Scheduler Form Submit (Propose Event)
  const handleEventSubmit = async (e) => {
    e.preventDefault()
    if (!eventForm.title.trim() || !eventForm.club_id || !eventForm.event_date) {
      toast.error('Title, Organizing Club, and Scheduled Date are required')
      return
    }

    const payload = {
      ...eventForm,
      time_slot: eventForm.time_slot || computeTimeSlot(eventForm.start_time, eventForm.end_time),
      organized_by_student_id: user?.linked_id || user?.id || 'student',
    }

    try {
      await eventsAPI.create(eventForm.club_id, payload)
      toast.success('Event scheduled & submitted for mentor review!')
      setShowSubmitModal(false)
      setEventForm({
        club_id: '',
        title: '',
        event_type: 'workshop',
        event_date: '',
        start_time: '11:00',
        end_time: '13:00',
        time_slot: '11:00 AM - 01:00 PM',
        venue: '',
        description: '',
      })
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit event proposal')
    }
  }

  // Student RSVP Register
  const handleRegister = async (eventId) => {
    try {
      await eventsAPI.register(eventId)
      toast.success('You have signed up for this event!')
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register for event')
    }
  }

  // Student RSVP Cancel
  const handleCancelRegistration = async (eventId) => {
    try {
      await eventsAPI.cancelRegistration(eventId)
      toast.success('Registration cancelled')
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel registration')
    }
  }

  // Open Day-of Attendance Modal
  const handleOpenAttendance = async (ev) => {
    setAttendanceEvent(ev)
    setAttendanceLoading(true)
    setWalkInStudentId('')
    try {
      const res = await eventsAPI.getRegistrations(ev.id)
      const list = res.data || []
      // Pre-populate roster
      const roster = list.map(r => ({
        student_id: r.student_id,
        student_name: r.student_name || r.student_id,
        status: r.status === 'absent' ? 'absent' : 'present',
        is_walk_in: r.status === 'walk_in',
      }))
      setAttendanceRoster(roster)
    } catch (err) {
      toast.error('Failed to load registered attendees')
      setAttendanceRoster([])
    } finally {
      setAttendanceLoading(false)
    }
  }

  // Add Walk-in to Attendance Roster
  const handleAddWalkIn = () => {
    const sid = walkInStudentId.trim().toUpperCase()
    if (!sid) return
    if (attendanceRoster.some(r => r.student_id === sid)) {
      toast.error('Student already in roster')
      return
    }
    const stuMatch = studentsList.find(s => s.student_id === sid)
    setAttendanceRoster([
      ...attendanceRoster,
      {
        student_id: sid,
        student_name: stuMatch ? stuMatch.name : sid,
        status: 'present',
        is_walk_in: true,
      },
    ])
    setWalkInStudentId('')
    toast.success(`Walk-in added: ${sid}`)
  }

  // Finalize Day-of Attendance
  const handleSubmitAttendance = async () => {
    if (!attendanceEvent) return
    setAttendanceSaving(true)
    try {
      const attendees = attendanceRoster
        .filter(r => !r.is_walk_in)
        .map(r => ({ student_id: r.student_id, status: r.status }))
      const walk_ins = attendanceRoster
        .filter(r => r.is_walk_in && r.status === 'present')
        .map(r => ({ student_id: r.student_id }))

      await eventsAPI.submitAttendance(attendanceEvent.id, { attendees, walk_ins })
      toast.success('Attendance finalized! Event marked as completed.')
      setAttendanceEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit attendance')
    } finally {
      setAttendanceSaving(false)
    }
  }

  // Open Post-Event Documentation Modal
  const handleOpenPostEvent = (ev) => {
    setPostEventModalEvent(ev)
    setPostEventReportText(ev.report_text || '')
    setPostEventPhotos([])
    setPostEventPhotoPreviews([])
  }

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length + postEventPhotos.length > 10) {
      toast.error('Maximum 10 photos allowed')
      return
    }
    const newPhotos = [...postEventPhotos, ...files]
    setPostEventPhotos(newPhotos)
    const previews = newPhotos.map(f => URL.createObjectURL(f))
    setPostEventPhotoPreviews(previews)
  }

  const handleRemovePhoto = (index) => {
    const nextPhotos = [...postEventPhotos]
    nextPhotos.splice(index, 1)
    setPostEventPhotos(nextPhotos)
    const nextPreviews = nextPhotos.map(f => URL.createObjectURL(f))
    setPostEventPhotoPreviews(nextPreviews)
  }

  // Submit Post-Event Documentation
  const handleSubmitPostEvent = async (e) => {
    e.preventDefault()
    if (!postEventModalEvent) return
    setPostEventSaving(true)
    try {
      const formData = new FormData()
      formData.append('report_text', postEventReportText)
      for (let i = 0; i < postEventPhotos.length; i++) {
        formData.append('photos', postEventPhotos[i])
      }
      await eventsAPI.submitPostEventReport(postEventModalEvent.id, formData)
      toast.success('Post-event documentation uploaded successfully!')
      setPostEventModalEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit post-event report')
    } finally {
      setPostEventSaving(false)
    }
  }

  // Open Faculty Award Attendance Modal
  const handleOpenAwardModal = async (ev) => {
    setAwardModalEvent(ev)
    setAwardLoading(true)
    try {
      const [regsRes, awardsRes] = await Promise.all([
        eventsAPI.getRegistrations(ev.id),
        eventsAPI.getAwards(ev.id).catch(() => ({ data: [] })),
      ])
      const attendees = (regsRes.data || []).filter(
        r => r.status === 'attended' || r.status === 'walk_in' || r.attendance_status === 'attended'
      )
      setAwardAttendees(attendees)
      setPastAwards(awardsRes.data || [])

      // Initial class selection from faculty classes
      const firstClass = myClasses[0] || {}
      const initialCourse = firstClass.course_code || 'CS3C01'
      const initialSection = firstClass.section || 'A'

      setAwardForm({
        course_code: initialCourse,
        section: initialSection,
        time_slot: ev.time_slot || '11:30 AM - 12:30 PM',
        class_date: (ev.event_date || '').slice(0, 10),
      })

      // Select all attendees initially
      const idSet = new Set(attendees.map(a => a.student_id))
      setAwardSelectedIds(idSet)
    } catch (err) {
      toast.error('Failed to load attendees for attendance award')
    } finally {
      setAwardLoading(false)
    }
  }

  // Submit Faculty Duty Leave Award
  const handleSubmitAward = async (e) => {
    e.preventDefault()
    if (!awardModalEvent) return
    if (awardSelectedIds.size === 0) {
      toast.error('Select at least one attendee to award attendance')
      return
    }
    setAwardSaving(true)
    try {
      const payload = {
        course_code: awardForm.course_code,
        section: awardForm.section,
        time_slot: awardForm.time_slot,
        class_date: awardForm.class_date,
        student_ids: Array.from(awardSelectedIds),
      }
      const res = await eventsAPI.awardClassAttendance(awardModalEvent.id, payload)
      const data = res.data || {}
      toast.success(`Awarded class attendance to ${data.credited_count || awardSelectedIds.size} students!`)
      setAwardModalEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to award class attendance')
    } finally {
      setAwardSaving(false)
    }
  }

  // Open Event Details Modal
  const handleOpenDetailModal = async (ev) => {
    setViewingEvent(ev)
    setAttendeeSearch('')
    try {
      const [regsRes, awardsRes] = await Promise.all([
        eventsAPI.getRegistrations(ev.id).catch(() => ({ data: [] })),
        eventsAPI.getAwards(ev.id).catch(() => ({ data: [] })),
      ])
      setViewingRegistrations(regsRes.data || [])
      setViewingAwards(awardsRes.data || [])
    } catch (_) { }
  }

  // Mentor Review Modal
  const handleOpenReview = (ev) => {
    setReviewingEvent(ev)
    setIsRejecting(false)
    setReviewData({
      po_mapping: ev.po_mapping || '',
      resource_person: ev.resource_person || '',
      skill_orientation: ev.skill_orientation || '',
      rejection_reason: '',
    })
  }

  const handleApproveEvent = async () => {
    if (!reviewingEvent) return
    try {
      await eventsAPI.approve(reviewingEvent.id, {
        po_mapping: reviewData.po_mapping.trim(),
        resource_person: reviewData.resource_person.trim(),
        skill_orientation: reviewData.skill_orientation.trim(),
      })
      toast.success('Event approved! Now visible to students for sign-up.')
      setReviewingEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve event')
    }
  }

  const handleRejectEvent = async () => {
    if (!reviewingEvent || !reviewData.rejection_reason.trim()) {
      toast.error('Please specify a rejection reason')
      return
    }
    try {
      await eventsAPI.reject(reviewingEvent.id, {
        rejection_reason: reviewData.rejection_reason.trim(),
      })
      toast.success('Event rejected with feedback')
      setReviewingEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject event')
    }
  }

  const handleClubSubmit = async (e) => {
    e.preventDefault()
    if (!clubForm.name.trim()) return
    try {
      if (editingClubId) {
        await clubsAPI.update(editingClubId, clubForm)
        toast.success('Club updated')
      } else {
        await clubsAPI.create(clubForm)
        toast.success('Club registered')
      }
      setShowClubModal(false)
      setEditingClubId(null)
      loadInitialData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save club')
    }
  }

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Events, Clubs & Academic Scheduler"
        description="Event scheduler, student sign-up, day-of attendance verification, and faculty duty leave awarding for Criterion 4.6."
        badge="Criterion 4.6 Compliant"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Calendar size={14} />
              <span>Propose / Schedule Event</span>
            </button>
            {role === 'admin' && (
              <button
                onClick={() => {
                  setEditingClubId(null)
                  setClubForm({ name: '', category: 'technical', description: '', mentor_faculty_id: '' })
                  setShowClubModal(true)
                }}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} />
                <span>New Club</span>
              </button>
            )}
          </div>
        }
      />

      <div className="page-body">
        {/* Navigation Tabs */}
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'events', label: 'All Scheduled Events', icon: Calendar, count: events.length },
            { id: 'clubs', label: 'Student Clubs & Societies', icon: Award, count: clubs.length },
            ...(role === 'admin' || role === 'teacher' ? [
              { id: 'review', label: 'Faculty Approval Queue', icon: Shield, count: pendingReviewCount },
            ] : []),
          ]}
        />

        {/* ── Tab 1: All Events ── */}
        {activeTab === 'events' && (
          <div>
            {/* Filter Toolbar */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
                  <div className="search-bar" style={{ flex: 1, minWidth: 220, maxWidth: 340 }}>
                    <Search size={14} />
                    <input
                      placeholder="Search events, venue, club…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    style={{ width: 160, height: 34, padding: '4px 8px' }}
                    value={selectedClubId}
                    onChange={e => setSelectedClubId(e.target.value)}
                  >
                    <option value="">All Clubs</option>
                    {clubs.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: 140, height: 34, padding: '4px 8px' }}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending Review</option>
                    <option value="rejected">Rejected</option>
                  </select>

                  <select
                    className="form-select"
                    style={{ width: 150, height: 34, padding: '4px 8px' }}
                    value={lifecycleFilter}
                    onChange={e => setLifecycleFilter(e.target.value)}
                  >
                    <option value="all">All Lifecycle</option>
                    <option value="upcoming">Upcoming & Live</option>
                    <option value="completed">Completed Events</option>
                  </select>
                </div>

                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Showing <strong>{filteredEvents.length}</strong> events
                </span>
              </div>
            </div>

            {/* Events Grid */}
            {filteredEvents.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No Events Found"
                description="No event records match the selected filters or search terms."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {filteredEvents.map(ev => {
                  const isApproved = ev.status === 'approved'
                  const isRejected = ev.status === 'rejected'
                  const isPending = ev.status === 'pending'
                  const evToday = isToday(ev.event_date)
                  const evPast = isPast(ev.event_date)
                  const isLeader = isClubLeader(ev.club_id)
                  const isCompleted = Boolean(ev.is_completed)

                  return (
                    <div
                      key={ev.id}
                      className="card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        borderLeft: isCompleted
                          ? '3px solid var(--text-muted)'
                          : evToday
                          ? '3px solid var(--success)'
                          : isApproved
                          ? '3px solid var(--primary)'
                          : isPending
                          ? '3px solid var(--warning)'
                          : '3px solid var(--danger)',
                      }}
                    >
                      <div>
                        {/* Status Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <Badge variant="neutral">{ev.event_type}</Badge>
                          {isPending ? (
                            <Badge variant="warning" icon={Clock}>Pending Review</Badge>
                          ) : isRejected ? (
                            <Badge variant="danger" icon={XCircle}>Rejected</Badge>
                          ) : isCompleted ? (
                            <Badge variant="success" icon={CheckCircle2}>Completed</Badge>
                          ) : evToday ? (
                            <Badge variant="success" icon={Sparkles}>Happening Today</Badge>
                          ) : (
                            <Badge variant="primary" icon={Calendar}>Upcoming</Badge>
                          )}
                        </div>

                        {/* Title & Club */}
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {ev.title}
                        </h4>

                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{ev.club_name || `Club #${ev.club_id}`}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={11} /> {ev.venue || 'Campus'}
                          </span>
                        </div>

                        {/* Time & Slot Banner */}
                        <div style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-default)',
                          marginBottom: 10,
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              📅 {(ev.event_date || '').slice(0, 10)}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              🕒 {ev.time_slot || (ev.start_time && ev.end_time ? `${ev.start_time} - ${ev.end_time}` : 'Scheduled')}
                            </span>
                          </div>
                          {ev.resource_person && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Speaker: <strong style={{ color: 'var(--text-secondary)' }}>{ev.resource_person}</strong>
                            </div>
                          )}
                        </div>

                        <p style={{
                          fontSize: '12.5px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          margin: 0,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {ev.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Card Footer: Metrics & Actions */}
                      <div style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                      }}>
                        {/* Stats indicator */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '11.5px',
                          color: 'var(--text-muted)',
                          marginBottom: 10,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {isCompleted ? (
                              <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                                ✓ {ev.attendee_count || ev.attended_count || 0} Attended
                              </span>
                            ) : (
                              <span>
                                👥 {ev.registration_count || 0} Signed Up
                              </span>
                            )}
                            {ev.photos && ev.photos.length > 0 && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Camera size={11} /> {ev.photos.length}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(ev)}
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                          >
                            Details →
                          </button>
                        </div>

                        {/* Lifecycle Action Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                          {/* 1. Student RSVP Button */}
                          {role === 'student' && isApproved && !isCompleted && !evPast && (
                            ev.is_user_registered ? (
                              <button
                                type="button"
                                onClick={() => handleCancelRegistration(ev.id)}
                                className="btn btn-secondary btn-xs"
                                style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                                title="Click to cancel sign-up"
                              >
                                <Check size={12} />
                                <span>Registered (Cancel)</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRegister(ev.id)}
                                className="btn btn-primary btn-xs"
                              >
                                <span>Sign Up / RSVP</span>
                              </button>
                            )
                          )}

                          {/* 2. Club Head Day-of Attendance Marking */}
                          {(isLeader || role === 'admin') && isApproved && !isCompleted && (evToday || evPast) && (
                            <button
                              type="button"
                              onClick={() => handleOpenAttendance(ev)}
                              className="btn btn-success btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <UserCheck size={12} />
                              <span>Mark Attendance</span>
                            </button>
                          )}

                          {/* View Attendees Roster button for completed events */}
                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleOpenDetailModal(ev)}
                              className="btn btn-secondary btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', borderColor: 'var(--primary)', fontWeight: 600 }}
                            >
                              <Users size={12} />
                              <span>View Attendees ({ev.attendee_count || ev.attended_count || 0})</span>
                            </button>
                          )}

                          {/* 3. Club Head Post-Event Documentation Upload */}
                          {(isLeader || role === 'admin' || role === 'teacher') && isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleOpenPostEvent(ev)}
                              className="btn btn-secondary btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <UploadCloud size={12} />
                              <span>{ev.report_text || (ev.photos && ev.photos.length > 0) ? 'Update Report/Photos' : 'Upload Report & Photos'}</span>
                            </button>
                          )}

                          {/* 4. Faculty Class Attendance Award (Duty Leave) */}
                          {(role === 'teacher' || role === 'admin') && isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleOpenAwardModal(ev)}
                              className="btn btn-primary btn-xs"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: '#4f46e5', borderColor: '#4f46e5' }}
                            >
                              <Award size={12} />
                              <span>Award Class Attendance</span>
                            </button>
                          )}

                          {/* 5. Mentor Review Button */}
                          {(role === 'admin' || role === 'teacher') && isPending && (
                            <button
                              type="button"
                              onClick={() => handleOpenReview(ev)}
                              className="btn btn-primary btn-xs"
                            >
                              Audit Proposal →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Clubs Directory ── */}
        {activeTab === 'clubs' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {clubs.map(c => (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      {c.name}
                    </h4>
                    <Badge variant="primary">{c.category}</Badge>
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '8px 0 12px' }}>
                    {c.description || 'Official student association chartered under the Department of Computer Science & Engineering.'}
                  </p>

                  <div style={{
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-default)',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>Mentor: <strong style={{ color: 'var(--text-primary)' }}>{c.mentor_faculty_name || 'Assigned Faculty'}</strong></span>
                    <span>{c.event_count || 0} Events</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 3: Faculty Review Queue ── */}
        {activeTab === 'review' && (
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Pending Co-Curricular Proposals ({pendingReviewCount})</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Student events awaiting mentor validation and PO mapping for Criterion 4.6.
                </p>
              </div>
            </div>

            {pendingReviewCount === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Review Queue Clear"
                description="All submitted student events and activities have been audited."
              />
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event Title</th>
                      <th>Club</th>
                      <th>Type</th>
                      <th>Scheduled Date</th>
                      <th>Time Slot</th>
                      <th style={{ textAlign: 'right' }}>Mentor Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.filter(e => e.status === 'pending').map(ev => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 600 }}>{ev.title}</td>
                        <td>{ev.club_name || `Club #${ev.club_id}`}</td>
                        <td><Badge variant="neutral">{ev.event_type}</Badge></td>
                        <td>{(ev.event_date || '').slice(0, 10)}</td>
                        <td>{ev.time_slot || `${ev.start_time || ''} - ${ev.end_time || ''}`}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenReview(ev)}
                            className="btn btn-primary btn-sm"
                          >
                            Audit & Map POs
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

        {/* ══════════════════════════════════════════════════════════════════════════ */}
        {/* MODALS */}
        {/* ══════════════════════════════════════════════════════════════════════════ */}

        {/* ── Modal 1: Propose Event (Scheduler — NO photos/report allowed here) ── */}
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Schedule Upcoming Co-Curricular Event"
          maxWidth={620}
        >
          <form onSubmit={handleEventSubmit}>
            <div style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              marginBottom: 16,
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
            }}>
              📅 <strong>Upcoming Event Scheduler</strong>: Propose the date, time slot, and venue. Once approved by your faculty mentor, students can sign up and attendance will be marked on the day of the event.
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Organizing Club *</label>
                <select
                  className="form-select"
                  required
                  value={eventForm.club_id}
                  onChange={e => setEventForm({ ...eventForm, club_id: e.target.value })}
                >
                  <option value="">Select Club</option>
                  {clubs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Event Category</label>
                <select
                  className="form-select"
                  value={eventForm.event_type}
                  onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })}
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Event Title *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Hands-on Docker & Kubernetes Workshop"
                value={eventForm.title}
                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
              />
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Event Date *</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={eventForm.event_date}
                  onChange={e => setEventForm({ ...eventForm, event_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Time (24h) *</label>
                <input
                  type="time"
                  className="form-input"
                  required
                  value={eventForm.start_time}
                  onChange={e => {
                    const st = e.target.value
                    setEventForm({
                      ...eventForm,
                      start_time: st,
                      time_slot: computeTimeSlot(st, eventForm.end_time),
                    })
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Time (24h) *</label>
                <input
                  type="time"
                  className="form-input"
                  required
                  value={eventForm.end_time}
                  onChange={e => {
                    const et = e.target.value
                    setEventForm({
                      ...eventForm,
                      end_time: et,
                      time_slot: computeTimeSlot(eventForm.start_time, et),
                    })
                  }}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Time Slot Label</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 11:00 AM - 01:00 PM"
                  value={eventForm.time_slot}
                  onChange={e => setEventForm({ ...eventForm, time_slot: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Venue / Room *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. CSE Seminar Hall 2"
                  value={eventForm.venue}
                  onChange={e => setEventForm({ ...eventForm, venue: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Event Objectives & Description</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Brief summary of event objectives, schedule, and expected learning outcomes…"
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowSubmitModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Submit Event Schedule
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal 2: Day-of Attendance Marking ── */}
        <Modal
          isOpen={attendanceEvent !== null}
          onClose={() => setAttendanceEvent(null)}
          title={`Day-of Attendance: ${attendanceEvent?.title}`}
          maxWidth={650}
        >
          {attendanceEvent && (
            <div>
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 16,
                fontSize: '12.5px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    📅 {(attendanceEvent.event_date || '').slice(0, 10)} · {attendanceEvent.time_slot || 'Event Window'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    {attendanceEvent.venue} · {attendanceEvent.club_name}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '14px' }}>
                    {attendanceRoster.filter(r => r.status === 'present').length} Present
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> / {attendanceRoster.length} Total</span>
                </div>
              </div>

              {/* Add Walk-in student bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter Student ID for walk-in (e.g. STU003)…"
                  value={walkInStudentId}
                  onChange={e => setWalkInStudentId(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWalkIn(); } }}
                />
                <button
                  type="button"
                  onClick={handleAddWalkIn}
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  + Add Walk-In
                </button>
              </div>

              {/* Attendance Roster Table */}
              {attendanceLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading registration roster…
                </div>
              ) : attendanceRoster.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Pre-Registrations"
                  description="No students pre-registered for this event. Use the walk-in box above to record attendees."
                />
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xs)' }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Student ID</th>
                        <th>Name / Type</th>
                        <th style={{ textAlign: 'center' }}>Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceRoster.map((item, idx) => (
                        <tr key={item.student_id}>
                          <td style={{ fontWeight: 600 }}>{item.student_id}</td>
                          <td>
                            {item.student_name}
                            {item.is_walk_in && (
                              <span style={{ marginLeft: 6, fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
                                (Walk-In)
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...attendanceRoster]
                                  next[idx].status = 'present'
                                  setAttendanceRoster(next)
                                }}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: '11px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: item.status === 'present' ? 'var(--success)' : 'transparent',
                                  color: item.status === 'present' ? '#fff' : 'var(--text-muted)',
                                  fontWeight: item.status === 'present' ? 700 : 400,
                                }}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...attendanceRoster]
                                  next[idx].status = 'absent'
                                  setAttendanceRoster(next)
                                }}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: '11px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  backgroundColor: item.status === 'absent' ? 'var(--danger)' : 'transparent',
                                  color: item.status === 'absent' ? '#fff' : 'var(--text-muted)',
                                  fontWeight: item.status === 'absent' ? 700 : 400,
                                }}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceRoster(attendanceRoster.map(r => ({ ...r, status: 'present' })))
                    }}
                    className="btn btn-ghost btn-xs"
                  >
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceRoster(attendanceRoster.map(r => ({ ...r, status: 'absent' })))
                    }}
                    className="btn btn-ghost btn-xs"
                  >
                    Mark All Absent
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setAttendanceEvent(null)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAttendance}
                    disabled={attendanceSaving}
                    className="btn btn-success btn-sm"
                  >
                    {attendanceSaving ? 'Saving…' : 'Finalize & Mark Completed'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Modal 3: Post-Event Report & Photos Upload ── */}
        <Modal
          isOpen={postEventModalEvent !== null}
          onClose={() => setPostEventModalEvent(null)}
          title={`Post-Event Documentation: ${postEventModalEvent?.title}`}
          maxWidth={620}
        >
          {postEventModalEvent && (
            <form onSubmit={handleSubmitPostEvent}>
              <div style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 14,
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
              }}>
                📸 <strong>Post-Event Verification</strong>: The event has been conducted and attendance is finalized. Upload the comprehensive event report and up to 10 event photos for institutional records and NBA accreditation.
              </div>

              <div className="form-group">
                <label className="form-label">Event Report & Key Outcomes *</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  required
                  placeholder="Detail the activities conducted, keynote presentations, student participation metrics, and primary learnings…"
                  value={postEventReportText}
                  onChange={e => setPostEventReportText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Event Photographs (Up to 10 photos)</label>
                <input
                  type="file"
                  className="form-input"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelect}
                />
                <p className="form-hint">Accepted formats: JPG, PNG, WEBP. Max 5MB per photo.</p>
              </div>

              {/* Photo Previews */}
              {postEventPhotoPreviews.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: 8,
                  marginBottom: 16,
                  padding: 8,
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                }}>
                  {postEventPhotoPreviews.map((src, idx) => (
                    <div key={idx} style={{ position: 'relative', height: 70, borderRadius: 4, overflow: 'hidden' }}>
                      <img src={src} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: 18,
                          height: 18,
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setPostEventModalEvent(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={postEventSaving} className="btn btn-primary btn-sm">
                  {postEventSaving ? 'Uploading…' : 'Save Event Documentation'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── Modal 4: Faculty Duty Leave Class Attendance Award ── */}
        <Modal
          isOpen={awardModalEvent !== null}
          onClose={() => setAwardModalEvent(null)}
          title={`Award Class Attendance (Duty Leave)`}
          maxWidth={660}
        >
          {awardModalEvent && (
            <form onSubmit={handleSubmitAward}>
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 14,
                fontSize: '12.5px',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{awardModalEvent.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', marginTop: 2 }}>
                  Event Date: <strong>{(awardModalEvent.event_date || '').slice(0, 10)}</strong> · Event Time: <strong>{awardModalEvent.time_slot || 'Event Window'}</strong>
                </div>
              </div>

              {/* Class & Period Selection */}
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Course & Section *</label>
                  {myClasses.length > 0 ? (
                    <select
                      className="form-select"
                      required
                      value={`${awardForm.course_code}|${awardForm.section}`}
                      onChange={e => {
                        const [c, s] = e.target.value.split('|')
                        setAwardForm({ ...awardForm, course_code: c, section: s })
                      }}
                    >
                      {myClasses.map((cls, i) => (
                        <option key={i} value={`${cls.course_code}|${cls.section}`}>
                          {cls.course_code} - Sec {cls.section} ({cls.course_name})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Course (e.g. CS3C01)"
                        required
                        value={awardForm.course_code}
                        onChange={e => setAwardForm({ ...awardForm, course_code: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: 80 }}
                        placeholder="Sec (A)"
                        required
                        value={awardForm.section}
                        onChange={e => setAwardForm({ ...awardForm, section: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Class Timetable Period *</label>
                  <select
                    className="form-select"
                    required
                    value={awardForm.time_slot}
                    onChange={e => setAwardForm({ ...awardForm, time_slot: e.target.value })}
                  >
                    {TIMETABLE_PERIODS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Class Session Date</label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={awardForm.class_date}
                  onChange={e => setAwardForm({ ...awardForm, class_date: e.target.value })}
                />
              </div>

              {/* Attendee Checklist */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Select Attendees to Credit ({awardSelectedIds.size} / {awardAttendees.length} selected)
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setAwardSelectedIds(new Set(awardAttendees.map(a => a.student_id)))}
                      className="btn btn-ghost btn-xs"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAwardSelectedIds(new Set())}
                      className="btn btn-ghost btn-xs"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {awardLoading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>Loading attendees…</div>
                ) : awardAttendees.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: 4 }}>
                    No students have marked attendance for this event yet.
                  </div>
                ) : (
                  <div style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '6px 10px',
                  }}>
                    {awardAttendees.map(att => {
                      const isChecked = awardSelectedIds.has(att.student_id)
                      return (
                        <label
                          key={att.student_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 0',
                            borderBottom: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const next = new Set(awardSelectedIds)
                              if (e.target.checked) next.add(att.student_id)
                              else next.delete(att.student_id)
                              setAwardSelectedIds(next)
                            }}
                          />
                          <span style={{ fontWeight: 600, minWidth: 70 }}>{att.student_id}</span>
                          <span style={{ flex: 1 }}>{att.student_name || att.student_id}</span>
                          {att.status === 'walk_in' && (
                            <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>Walk-In</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Previously Awarded Classes */}
              {pastAwards.length > 0 && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 4,
                  fontSize: '11.5px',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Previously Awarded Sessions for this Event:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {pastAwards.map((pa, idx) => (
                      <span key={idx} style={{ padding: '2px 6px', backgroundColor: 'var(--bg-card)', borderRadius: 3, border: '1px solid var(--border-default)' }}>
                        {pa.course_code} (Sec {pa.section}) • {pa.student_name || pa.student_id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" onClick={() => setAwardModalEvent(null)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={awardSaving || awardSelectedIds.size === 0}
                  className="btn btn-primary btn-sm"
                  style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5' }}
                >
                  {awardSaving ? 'Awarding…' : `Award Attendance to ${awardSelectedIds.size} Students`}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── Modal 5: Event Detail / Overview ── */}
        <Modal
          isOpen={viewingEvent !== null}
          onClose={() => setViewingEvent(null)}
          title={viewingEvent?.title || 'Event Details'}
          maxWidth={680}
        >
          {viewingEvent && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Badge variant="primary">{viewingEvent.club_name || `Club #${viewingEvent.club_id}`}</Badge>
                <Badge variant={viewingEvent.is_completed ? 'success' : viewingEvent.status === 'approved' ? 'primary' : 'warning'}>
                  {viewingEvent.is_completed ? 'Event Completed' : viewingEvent.status}
                </Badge>
              </div>

              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 16,
                fontSize: '12.5px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
              }}>
                <div>📅 Date: <strong>{(viewingEvent.event_date || '').slice(0, 10)}</strong></div>
                <div>🕒 Slot: <strong>{viewingEvent.time_slot || `${viewingEvent.start_time || ''} - ${viewingEvent.end_time || ''}`}</strong></div>
                <div>📍 Venue: <strong>{viewingEvent.venue}</strong></div>
                <div>👥 Attendees: <strong>{viewingEvent.attendee_count || viewingEvent.attended_count || viewingEvent.registration_count || 0}</strong></div>
                {viewingEvent.resource_person && (
                  <div style={{ gridColumn: 'span 2' }}>
                    🎤 Keynote / Speaker: <strong>{viewingEvent.resource_person}</strong>
                  </div>
                )}
                {viewingEvent.po_mapping && (
                  <div style={{ gridColumn: 'span 2' }}>
                    🎯 PO / PSO Mapping: <strong>{viewingEvent.po_mapping}</strong>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>Description & Objectives</h5>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {viewingEvent.description || 'No description provided.'}
                </p>
              </div>

              {viewingEvent.report_text && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: 4 }}>Post-Event Report & Outcomes</h5>
                  <div style={{
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12.5px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {viewingEvent.report_text}
                  </div>
                </div>
              )}

              {/* Event Photos */}
              {viewingEvent.photos && viewingEvent.photos.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: 6 }}>
                    Verified Photos ({viewingEvent.photos.length})
                  </h5>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: 8,
                  }}>
                    {viewingEvent.photos.map((p, idx) => {
                      const photoUrl = p.photo_url || p.file_path ? `/api/v1/event-photos/${p.file_path || p.photo_path}` : ''
                      return (
                        <div key={idx} style={{ height: 90, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                          <img
                            src={photoUrl}
                            alt="Event photograph"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Attended Students & Participants Section */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h5 style={{ fontSize: '13px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} style={{ color: 'var(--primary)' }} />
                      <span>{viewingEvent.is_completed ? 'Attended Students & Participants' : 'Registered Students'} ({viewingRegistrations.length})</span>
                    </h5>
                    {viewingRegistrations.length > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--success)' }}>
                          {viewingRegistrations.filter(r => r.status === 'present').length} Present
                        </strong>
                        {' • '}
                        <strong style={{ color: '#6366f1' }}>
                          {viewingRegistrations.filter(r => r.status === 'walk_in').length} Walk-Ins
                        </strong>
                        {viewingRegistrations.some(r => r.status === 'absent') && (
                          <>
                            {' • '}
                            <span style={{ color: 'var(--danger)' }}>
                              {viewingRegistrations.filter(r => r.status === 'absent').length} Absent
                            </span>
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  {viewingRegistrations.length > 4 && (
                    <input
                      type="text"
                      placeholder="Filter attendees..."
                      value={attendeeSearch}
                      onChange={e => setAttendeeSearch(e.target.value)}
                      style={{
                        fontSize: '11.5px',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-default)',
                        width: 170,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  )}
                </div>

                {viewingRegistrations.length === 0 ? (
                  <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: 4, fontSize: '12px' }}>
                    No students registered or attended for this event yet.
                  </div>
                ) : filteredViewingRegistrations.length === 0 ? (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No attendees match "{attendeeSearch}".
                  </div>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 4 }}>
                    <table className="data-table" style={{ margin: 0, fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>USN / ID</th>
                          <th>Branch & Class</th>
                          <th>Attendance Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredViewingRegistrations.map((r, idx) => (
                          <tr key={r.id || idx}>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {r.student_name || r.student_id}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {r.usn || r.student_id}
                            </td>
                            <td style={{ fontSize: '11.5px' }}>
                              {r.department || 'CSE'} {r.semester ? `Sem ${r.semester}` : ''} {r.section ? `Sec ${r.section}` : ''}
                            </td>
                            <td>
                              {r.status === 'present' ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                                  color: '#16a34a',
                                  fontWeight: 600,
                                  fontSize: '11px'
                                }}>
                                  <Check size={11} /> Present
                                </span>
                              ) : r.status === 'walk_in' ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                  color: '#6366f1',
                                  fontWeight: 600,
                                  fontSize: '11px'
                                }}>
                                  ★ Walk-In
                                </span>
                              ) : r.status === 'absent' ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  fontWeight: 600,
                                  fontSize: '11px'
                                }}>
                                  Absent
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(100, 116, 139, 0.12)',
                                  color: '#64748b',
                                  fontWeight: 600,
                                  fontSize: '11px'
                                }}>
                                  Registered
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Duty Attendance Awards */}
              {viewingAwards.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: 6 }}>
                    Duty Leave Awards Granted ({viewingAwards.length})
                  </h5>
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 4 }}>
                    <table className="data-table" style={{ margin: 0, fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Course</th>
                          <th>Section</th>
                          <th>Awarded By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingAwards.map(a => (
                          <tr key={a.id}>
                            <td style={{ fontWeight: 600 }}>{a.student_name || a.student_id}</td>
                            <td>{a.course_code}</td>
                            <td>Sec {a.section}</td>
                            <td>{a.faculty_name || a.faculty_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" onClick={() => setViewingEvent(null)} className="btn btn-secondary btn-sm">
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* ── Modal 6: Mentor Faculty Review ── */}
        <Modal
          isOpen={reviewingEvent !== null}
          onClose={() => setReviewingEvent(null)}
          title={`Faculty Audit: ${reviewingEvent?.title}`}
          maxWidth={580}
        >
          {reviewingEvent && (
            <div>
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                marginBottom: 16,
                fontSize: '12.5px',
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{reviewingEvent.title}</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  {reviewingEvent.club_name} · {reviewingEvent.event_type} · {(reviewingEvent.event_date || '').slice(0, 10)}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  Scheduled Slot: <strong>{reviewingEvent.time_slot || `${reviewingEvent.start_time} - ${reviewingEvent.end_time}`}</strong> · Venue: <strong>{reviewingEvent.venue}</strong>
                </div>
              </div>

              {!isRejecting ? (
                <div>
                  <div className="form-group">
                    <label className="form-label">Program Outcomes (POs / PSOs) Mapping *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. PO1, PO2, PO5, PSO1"
                      value={reviewData.po_mapping}
                      onChange={e => setReviewData({ ...reviewData, po_mapping: e.target.value })}
                    />
                    <p className="form-hint">Required for Criterion 4.6 compliance</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Resource Person / Keynote Speaker</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Dr. K. Ramanathan, Senior Architect at Intel"
                      value={reviewData.resource_person}
                      onChange={e => setReviewData({ ...reviewData, resource_person: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Skill / Competency Focus</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Cloud Native Deployment, Docker & Kubernetes"
                      value={reviewData.skill_orientation}
                      onChange={e => setReviewData({ ...reviewData, skill_orientation: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
                    <button
                      type="button"
                      onClick={() => setIsRejecting(true)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                    >
                      Reject with Feedback…
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => setReviewingEvent(null)} className="btn btn-secondary btn-sm">
                        Cancel
                      </button>
                      <button type="button" onClick={handleApproveEvent} className="btn btn-success btn-sm">
                        Approve & Index Event
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="form-group">
                    <label className="form-label">Reason for Rejection *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      required
                      placeholder="Explain why this event cannot be approved (e.g. Venue conflict, missing prerequisites)…"
                      value={reviewData.rejection_reason}
                      onChange={e => setReviewData({ ...reviewData, rejection_reason: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                    <button type="button" onClick={() => setIsRejecting(false)} className="btn btn-secondary btn-sm">
                      Back
                    </button>
                    <button type="button" onClick={handleRejectEvent} className="btn btn-danger btn-sm">
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ── Modal 7: Club Creation ── */}
        <Modal
          isOpen={showClubModal}
          onClose={() => setShowClubModal(false)}
          title="Register Student Club / Chapter"
          maxWidth={500}
        >
          <form onSubmit={handleClubSubmit}>
            <div className="form-group">
              <label className="form-label">Club Name *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. ACM Student Chapter"
                value={clubForm.name}
                onChange={e => setClubForm({ ...clubForm, name: e.target.value })}
              />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={clubForm.category}
                  onChange={e => setClubForm({ ...clubForm, category: e.target.value })}
                >
                  {CLUB_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Faculty Mentor</label>
                <select
                  className="form-select"
                  value={clubForm.mentor_faculty_id}
                  onChange={e => setClubForm({ ...clubForm, mentor_faculty_id: e.target.value })}
                >
                  <option value="">Select Faculty</option>
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Club Purpose & Mission</label>
              <textarea
                className="form-textarea"
                rows={3}
                value={clubForm.description}
                onChange={e => setClubForm({ ...clubForm, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowClubModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Register Club
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}
