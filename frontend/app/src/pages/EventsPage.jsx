import React, { useEffect, useState, useMemo } from 'react'
import { clubsAPI, studentRolesAPI, eventsAPI, facultyAPI, studentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, Plus, CheckCircle, XCircle, Clock, Users,
  Award, Shield, FileText, Image, Search, ChevronRight,
  Filter, AlertCircle, Edit, Trash2, ExternalLink, Info, Check, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'

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
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
]

export default function EventsPage() {
  const { user } = useAuth()
  const role = user?.role || 'student'

  // Data states
  const [clubs, setClubs] = useState([])
  const [events, setEvents] = useState([])
  const [facultyList, setFacultyList] = useState([])
  const [studentsList, setStudentsList] = useState([])
  const [studentRoles, setStudentRoles] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter & tab states
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'clubs' : 'events')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals & form states
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showClubModal, setShowClubModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [reviewingEvent, setReviewingEvent] = useState(null)
  const [viewingEvent, setViewingEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)

  // Mentor Review Form state
  const [reviewData, setReviewData] = useState({
    po_mapping: '',
    resource_person: '',
    skill_orientation: '',
    rejection_reason: '',
  })
  const [isRejecting, setIsRejecting] = useState(false)

  // Event submission form state
  const [eventForm, setEventForm] = useState({
    club_id: '',
    title: '',
    event_type: 'workshop',
    event_date: '',
    venue: '',
    attendee_count: '',
    guest_names: '',
    description: '',
    report_text: '',
    po_mapping: '',
    resource_person: '',
    skill_orientation: '',
    organized_by_student_id: user?.linked_id || '',
  })
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [photoPreviews, setPhotoPreviews] = useState([])

  // Club form state
  const [clubForm, setClubForm] = useState({
    name: '',
    category: 'technical',
    description: '',
    mentor_faculty_id: '',
  })
  const [editingClubId, setEditingClubId] = useState(null)

  // Role assignment form state
  const [roleForm, setRoleForm] = useState({
    club_id: '',
    student_id: '',
    role: 'head',
  })

  // Initial Load
  useEffect(() => {
    loadInitialData()
  }, [user])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [clubsRes, facultyRes] = await Promise.all([
        clubsAPI.list(),
        facultyAPI.list().catch(() => ({ data: [] })),
      ])
      setClubs(clubsRes.data || [])
      setFacultyList(facultyRes.data || [])

      if (role === 'admin') {
        const [rolesRes, stuRes] = await Promise.all([
          studentRolesAPI.list().catch(() => ({ data: [] })),
          studentsAPI.list({ limit: 200 }).catch(() => ({ data: [] })),
        ])
        setStudentRoles(rolesRes.data || [])
        setStudentsList(stuRes.data || [])
      }

      // Load events
      loadEvents()
    } catch (err) {
      console.error(err)
      toast.error('Failed to load events data')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    try {
      const res = await eventsAPI.listAll()
      setEvents(res.data || [])
    } catch (err) {
      console.error('Failed to fetch events', err)
    }
  }

  // Handle Photo selection
  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length + selectedPhotos.length > 10) {
      toast.error('Maximum 10 photos allowed')
      return
    }
    setSelectedPhotos([...selectedPhotos, ...files])
    const newPreviews = files.map((file) => URL.createObjectURL(file))
    setPhotoPreviews([...photoPreviews, ...newPreviews])
  }

  const removePhoto = (index) => {
    const updatedPhotos = [...selectedPhotos]
    const updatedPreviews = [...photoPreviews]
    updatedPhotos.splice(index, 1)
    updatedPreviews.splice(index, 1)
    setSelectedPhotos(updatedPhotos)
    setPhotoPreviews(updatedPreviews)
  }

  // Submit Event
  const handleSubmitEvent = async (e) => {
    e.preventDefault()
    const targetClubId = eventForm.club_id || selectedClubId || (userClubRoles[0]?.id)
    if (!targetClubId) {
      toast.error('Please select a club')
      return
    }
    if (!eventForm.title.trim()) {
      toast.error('Please provide an event title')
      return
    }

    const formData = new FormData()
    formData.append('title', eventForm.title)
    formData.append('event_type', eventForm.event_type)
    formData.append('event_date', eventForm.event_date)
    formData.append('venue', eventForm.venue)
    formData.append('attendee_count', eventForm.attendee_count)
    formData.append('guest_names', eventForm.guest_names)
    formData.append('description', eventForm.description)
    formData.append('report_text', eventForm.report_text)
    if (eventForm.po_mapping) formData.append('po_mapping', eventForm.po_mapping)
    if (eventForm.resource_person) formData.append('resource_person', eventForm.resource_person)
    if (eventForm.skill_orientation) formData.append('skill_orientation', eventForm.skill_orientation)

    if (role === 'worker' || role === 'admin') {
      formData.append('organized_by_student_id', eventForm.organized_by_student_id)
    }

    selectedPhotos.forEach((photo) => {
      formData.append('photos', photo)
    })

    try {
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, {
          title: eventForm.title,
          event_type: eventForm.event_type,
          event_date: eventForm.event_date,
          venue: eventForm.venue,
          attendee_count: eventForm.attendee_count,
          guest_names: eventForm.guest_names,
          description: eventForm.description,
          report_text: eventForm.report_text,
          po_mapping: eventForm.po_mapping,
          resource_person: eventForm.resource_person,
          skill_orientation: eventForm.skill_orientation,
        })
        toast.success('Event updated successfully')
      } else {
        await eventsAPI.create(targetClubId, formData)
        toast.success('Event report submitted! Pending Mentor approval.')
      }

      setShowSubmitModal(false)
      setEditingEvent(null)
      resetEventForm()
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed')
    }
  }

  const resetEventForm = () => {
    setEventForm({
      club_id: '',
      title: '',
      event_type: 'workshop',
      event_date: '',
      venue: '',
      attendee_count: '',
      guest_names: '',
      description: '',
      report_text: '',
      po_mapping: '',
      resource_person: '',
      skill_orientation: '',
      organized_by_student_id: user?.linked_id || '',
    })
    setSelectedPhotos([])
    setPhotoPreviews([])
  }

  // Mentor Review Action
  const handleApprove = async () => {
    if (!reviewingEvent) return
    try {
      await eventsAPI.approve(reviewingEvent.id, {
        po_mapping: reviewData.po_mapping,
        resource_person: reviewData.resource_person,
        skill_orientation: reviewData.skill_orientation,
      })
      toast.success('Event approved! Ready for NBA Criteria Reports.')
      setReviewingEvent(null)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed')
    }
  }

  const handleReject = async () => {
    if (!reviewingEvent) return
    if (!reviewData.rejection_reason.trim()) {
      toast.error('Please specify a rejection reason')
      return
    }
    try {
      await eventsAPI.reject(reviewingEvent.id, {
        rejection_reason: reviewData.rejection_reason,
      })
      toast.success('Event rejected with feedback')
      setReviewingEvent(null)
      setIsRejecting(false)
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed')
    }
  }

  // Admin Club Operations
  const handleSaveClub = async (e) => {
    e.preventDefault()
    try {
      if (editingClubId) {
        await clubsAPI.update(editingClubId, clubForm)
        toast.success('Club updated')
      } else {
        await clubsAPI.create(clubForm)
        toast.success('Club created')
      }
      setShowClubModal(false)
      setEditingClubId(null)
      setClubForm({ name: '', category: 'technical', description: '', mentor_faculty_id: '' })
      const res = await clubsAPI.list()
      setClubs(res.data || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed')
    }
  }

  const handleSaveRole = async (e) => {
    e.preventDefault()
    try {
      await studentRolesAPI.create(roleForm)
      toast.success('Role assigned')
      setShowRoleModal(false)
      setRoleForm({ club_id: '', student_id: '', role: 'head' })
      const res = await studentRolesAPI.list()
      setStudentRoles(res.data || [])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Assignment failed')
    }
  }

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Remove this role assignment?')) return
    try {
      await studentRolesAPI.delete(roleId)
      toast.success('Role removed')
      setStudentRoles(studentRoles.filter((r) => r.id !== roleId))
    } catch (err) {
      toast.error('Failed to remove role')
    }
  }

  // Filtered lists
  const userClubRoles = useMemo(() => {
    return clubs.filter((c) => c.my_role === 'head' || c.my_role === 'council')
  }, [clubs])

  const mentoredClubs = useMemo(() => {
    return clubs.filter((c) => c.is_mentor || c.mentor_faculty_id === user?.linked_id)
  }, [clubs, user])

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      if (statusFilter !== 'all' && evt.status !== statusFilter) return false
      if (selectedClubId && String(evt.club_id) !== String(selectedClubId)) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          evt.title?.toLowerCase().includes(q) ||
          evt.club_name?.toLowerCase().includes(q) ||
          evt.event_type?.toLowerCase().includes(q) ||
          evt.organizer_name?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [events, statusFilter, selectedClubId, searchQuery])

  // Pending Count for Mentors
  const pendingMentorCount = useMemo(() => {
    return events.filter((e) => e.status === 'pending').length
  }, [events])

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">🎪 College & Club Events</h1>
            <p className="page-desc">
              Post-event report submissions, photo archives, and Faculty Mentor approvals
            </p>
          </div>

          <div className="flex gap-sm">
            {/* Student Club Head / Worker Action */}
            {(role === 'student' || role === 'worker' || role === 'admin') && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  resetEventForm()
                  if (userClubRoles.length > 0) {
                    setEventForm((prev) => ({ ...prev, club_id: userClubRoles[0].id }))
                  }
                  setShowSubmitModal(true)
                }}
              >
                <Plus size={16} /> Submit Event Report
              </button>
            )}

            {/* Admin Add Club */}
            {role === 'admin' && activeTab === 'clubs' && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setEditingClubId(null)
                  setClubForm({ name: '', category: 'technical', description: '', mentor_faculty_id: '' })
                  setShowClubModal(true)
                }}
              >
                <Plus size={16} /> New Club
              </button>
            )}
          </div>
        </div>

        {/* Status / Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          <div style={{ padding: '12px 16px', background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{events.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Total Events Logged</div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fbbf24' }}>
              {events.filter((e) => e.status === 'pending').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
              {role === 'teacher' ? 'Pending Mentor Review' : 'Pending Approval'}
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#34d399' }}>
              {events.filter((e) => e.status === 'approved').length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Approved for SAR 4.6.1</div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(124,93,247,0.12)', border: '1px solid rgba(124,93,247,0.3)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#7c5df7' }}>{clubs.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Registered Clubs</div>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Navigation Tabs for Admin */}
        {role === 'admin' && (
          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              <FileText size={16} /> Events Audit
            </button>
            <button
              className={`tab-btn ${activeTab === 'clubs' ? 'active' : ''}`}
              onClick={() => setActiveTab('clubs')}
            >
              <Shield size={16} /> Club & Role Management
            </button>
          </div>
        )}

        {/* ── TEACHER / MENTOR HERO NOTICE ──────────────────────────────── */}
        {role === 'teacher' && mentoredClubs.length > 0 && (
          <div
            className="mb-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(79,142,247,0.1) 0%, rgba(124,93,247,0.08) 100%)',
              border: '1px solid rgba(79,142,247,0.25)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="var(--accent)" /> Faculty Mentor Queue
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                You are the assigned Faculty Mentor for:{' '}
                <strong>{mentoredClubs.map((c) => c.name).join(', ')}</strong>. Your approval is final and populates
                the NBA SAR Student Criteria Report (4.6.1 Summary Sheet).
              </p>
            </div>
            {pendingMentorCount > 0 && (
              <span className="status-badge pending" style={{ fontSize: 12, padding: '6px 12px' }}>
                <Clock size={14} /> {pendingMentorCount} Action Required
              </span>
            )}
          </div>
        )}

        {/* ── STUDENT NOTIFICATION ────────────────────────────────────────── */}
        {role === 'student' && userClubRoles.length === 0 && (
          <div className="alert alert-info mb-lg">
            <Info size={18} />
            <div>
              <strong>Student View:</strong> You are viewing college events. To submit event reports, you must be
              assigned as a Club Head or Student Council member by an Administrator.
            </div>
          </div>
        )}

        {/* ── EVENTS LIST TAB ────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <>
            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-md mb-lg" style={{ flexWrap: 'wrap' }}>
              <div className="flex items-center gap-sm" style={{ flex: 1, minWidth: 260 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search by event title, club, speaker, type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 36, width: '100%' }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-sm">
                <select
                  className="input"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  style={{ width: 180 }}
                >
                  <option value="">All Clubs</option>
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  className="input"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: 140 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Events Grid / List */}
            {filteredEvents.length === 0 ? (
              <div className="card text-center" style={{ padding: 48 }}>
                <Calendar size={40} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>No Events Found</h3>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                  {statusFilter !== 'all' || selectedClubId || searchQuery
                    ? 'Try adjusting your filters'
                    : 'Submit a new post-event report to get started.'}
                </p>
              </div>
            ) : (
              <div className="grid-2">
                {filteredEvents.map((evt) => (
                  <div key={evt.id} className="event-card">
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                        {evt.club_name}
                      </span>
                      <span className={`status-badge ${evt.status}`}>
                        <span className="status-dot" /> {evt.status}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                      {evt.title}
                    </h3>

                    <p className="text-muted text-sm" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {evt.description || evt.report_text || 'No description provided.'}
                    </p>

                    {/* Metadata chips */}
                    <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                      <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                        📅 {evt.event_date ? new Date(evt.event_date).toLocaleDateString() : 'Date N/A'}
                      </span>
                      {evt.venue && (
                        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          📍 {evt.venue}
                        </span>
                      )}
                      {evt.attendee_count && (
                        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          👥 {evt.attendee_count} Attendees
                        </span>
                      )}
                      <span style={{ fontSize: 11, background: 'rgba(124,93,247,0.1)', color: '#7c5df7', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                        {evt.event_type}
                      </span>
                    </div>

                    {/* Rejection Alert if rejected */}
                    {evt.status === 'rejected' && evt.rejection_reason && (
                      <div className="alert alert-error" style={{ marginTop: 8, padding: '8px 12px', fontSize: 12 }}>
                        <div>
                          <strong>Mentor Feedback:</strong> {evt.rejection_reason}
                        </div>
                      </div>
                    )}

                    {/* PO Mapping Banner if Approved */}
                    {evt.status === 'approved' && evt.po_mapping && (
                      <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(52,211,153,0.08)', borderRadius: 6, border: '1px solid rgba(52,211,153,0.2)', fontSize: 11, color: '#34d399' }}>
                        <strong>NBA PO Mapping:</strong> {evt.po_mapping} | <strong>Resource:</strong> {evt.resource_person || 'N/A'}
                      </div>
                    )}

                    {/* Card Actions */}
                    <div className="flex items-center justify-between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Organized by {evt.organizer_name || evt.organized_by_student_id}
                      </span>

                      <div className="flex gap-sm">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setViewingEvent(evt)}
                        >
                          <Eye size={14} /> View Details
                        </button>

                        {/* Mentor Review button */}
                        {role === 'teacher' && evt.status === 'pending' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setReviewingEvent(evt)
                              setReviewData({
                                po_mapping: evt.po_mapping || '',
                                resource_person: evt.resource_person || '',
                                skill_orientation: evt.skill_orientation || '',
                                rejection_reason: '',
                              })
                              setIsRejecting(false)
                            }}
                          >
                            <CheckCircle size={14} /> Review & Approve
                          </button>
                        )}

                        {/* Student Edit (Only when pending) */}
                        {role === 'student' && evt.status === 'pending' && evt.organized_by_student_id === user?.linked_id && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingEvent(evt)
                              setEventForm({
                                club_id: evt.club_id,
                                title: evt.title,
                                event_type: evt.event_type,
                                event_date: evt.event_date ? evt.event_date.substring(0, 10) : '',
                                venue: evt.venue || '',
                                attendee_count: evt.attendee_count || '',
                                guest_names: Array.isArray(evt.guest_names) ? evt.guest_names.join(', ') : '',
                                description: evt.description || '',
                                report_text: evt.report_text || '',
                                po_mapping: evt.po_mapping || '',
                                resource_person: evt.resource_person || '',
                                skill_orientation: evt.skill_orientation || '',
                                organized_by_student_id: evt.organized_by_student_id,
                              })
                              setShowSubmitModal(true)
                            }}
                          >
                            <Edit size={14} /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ADMIN CLUB & ROLE MANAGEMENT TAB ──────────────────────────── */}
        {activeTab === 'clubs' && role === 'admin' && (
          <div className="flex flex-col gap-lg">
            {/* Clubs Table */}
            <div className="card">
              <div className="flex items-center justify-between mb-md">
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>Clubs & Assigned Mentors</h2>
                  <p className="text-muted text-sm">Each club is assigned one Faculty Mentor whose approval is final.</p>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditingClubId(null)
                    setClubForm({ name: '', category: 'technical', description: '', mentor_faculty_id: '' })
                    setShowClubModal(true)
                  }}
                >
                  <Plus size={14} /> Add Club
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Club Name</th>
                      <th>Category</th>
                      <th>Assigned Mentor</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubs.map((c) => (
                      <tr key={c.id}>
                        <td className="font-bold">{c.name}</td>
                        <td>
                          <span style={{ textTransform: 'capitalize', fontSize: 12, padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                            {c.category}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            {c.mentor?.name || c.mentor_faculty_id}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.mentor_faculty_id}</div>
                        </td>
                        <td className="text-muted text-sm" style={{ maxWidth: 300 }}>{c.description}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingClubId(c.id)
                              setClubForm({
                                name: c.name,
                                category: c.category,
                                description: c.description || '',
                                mentor_faculty_id: c.mentor_faculty_id,
                              })
                              setShowClubModal(true)
                            }}
                          >
                            <Edit size={13} /> Reassign Mentor / Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Roles Table */}
            <div className="card">
              <div className="flex items-center justify-between mb-md">
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700 }}>Student Club Role Assignments</h2>
                  <p className="text-muted text-sm">Club Heads and Student Council members who can submit post-event reports.</p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRoleModal(true)}
                >
                  <Plus size={14} /> Assign Student Role
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Club</th>
                      <th>Role</th>
                      <th>Assigned At</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentRoles.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="font-bold">{r.student_name || r.student_id}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.student_id}</div>
                        </td>
                        <td>{r.club_name || `Club #${r.club_id}`}</td>
                        <td>
                          <span
                            style={{
                              textTransform: 'uppercase',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: r.role === 'head' ? 'rgba(124,93,247,0.15)' : 'rgba(79,142,247,0.15)',
                              color: r.role === 'head' ? '#7c5df7' : '#4f8ef7',
                            }}
                          >
                            {r.role}
                          </span>
                        </td>
                        <td className="text-muted text-sm">
                          {r.assigned_at ? new Date(r.assigned_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-icon btn-secondary btn-sm"
                            title="Remove Role"
                            onClick={() => handleDeleteRole(r.id)}
                          >
                            <Trash2 size={13} color="#f87171" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: SUBMIT / EDIT EVENT ──────────────────────────────────── */}
      {showSubmitModal && (
        <div className="modal-backdrop" onClick={() => setShowSubmitModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingEvent ? 'Edit Event Report' : 'Submit Post-Event Report'}</h2>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowSubmitModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitEvent}>
              <div className="modal-body flex flex-col gap-md">
                {/* Club selection */}
                <div className="grid-2">
                  <div>
                    <label className="label">Club *</label>
                    <select
                      className="input"
                      value={eventForm.club_id}
                      onChange={(e) => setEventForm({ ...eventForm, club_id: e.target.value })}
                      required
                      disabled={!!editingEvent}
                    >
                      <option value="">Select Club</option>
                      {(role === 'student' ? userClubRoles : clubs).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Event Type *</label>
                    <select
                      className="input"
                      value={eventForm.event_type}
                      onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                      required
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Event Title *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. CodeStorm 2026 — 24hr Hackathon"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="grid-3">
                  <div>
                    <label className="label">Event Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={eventForm.event_date}
                      onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Venue</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Main Auditorium"
                      value={eventForm.venue}
                      onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Attendee Count</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 150"
                      value={eventForm.attendee_count}
                      onChange={(e) => setEventForm({ ...eventForm, attendee_count: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Guest / Resource Person Names</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Comma separated e.g. Dr. Ramesh Kumar (TCS), Prof. Sunita"
                    value={eventForm.guest_names}
                    onChange={(e) => setEventForm({ ...eventForm, guest_names: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Summary / Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Brief summary of event objectives..."
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Comprehensive Post-Event Report Text</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Detailed report: agenda, outcomes, prize winners, participant feedback..."
                    value={eventForm.report_text}
                    onChange={(e) => setEventForm({ ...eventForm, report_text: e.target.value })}
                  />
                </div>

                {/* Photo Upload Section */}
                {!editingEvent && (
                  <div>
                    <label className="label">Upload Event Photos (Max 10)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="input"
                      onChange={handlePhotoChange}
                    />
                    {photoPreviews.length > 0 && (
                      <div className="photo-grid">
                        {photoPreviews.map((preview, i) => (
                          <div key={i} style={{ position: 'relative' }}>
                            <img src={preview} alt="preview" className="photo-thumb" />
                            <button
                              type="button"
                              onClick={() => removePhoto(i)}
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                background: 'rgba(0,0,0,0.7)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '50%',
                                width: 20,
                                height: 20,
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* NBA Mapping Note */}
                <div className="alert alert-info" style={{ fontSize: 12 }}>
                  <Info size={16} />
                  <div>
                    <strong>Note on NBA Accreditation:</strong> PO Mapping, Resource Person, and Skill Orientation
                    fields are optional at submission time. Your Faculty Mentor will review and complete these fields
                    for NBA Criterion 4.6.1 compliance.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update Report' : 'Submit for Mentor Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: MENTOR REVIEW & APPROVE ──────────────────────────────── */}
      {reviewingEvent && (
        <div className="modal-backdrop" onClick={() => setReviewingEvent(null)}>
          <div className="modal-dialog" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Mentor Review: {reviewingEvent.title}</h2>
                <span className="text-muted text-xs">Club: {reviewingEvent.club_name} | Organizer: {reviewingEvent.organizer_name}</span>
              </div>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setReviewingEvent(null)}>✕</button>
            </div>

            <div className="modal-body flex flex-col gap-md">
              {/* Event Brief */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>Date:</strong> {reviewingEvent.event_date ? new Date(reviewingEvent.event_date).toLocaleDateString() : 'N/A'} |{' '}
                  <strong>Venue:</strong> {reviewingEvent.venue || 'N/A'} |{' '}
                  <strong>Attendees:</strong> {reviewingEvent.attendee_count || 'N/A'}
                </div>
                <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-primary)' }}>
                  {reviewingEvent.report_text || reviewingEvent.description}
                </p>
              </div>

              {!isRejecting ? (
                <>
                  <div className="alert alert-info" style={{ fontSize: 12 }}>
                    <Info size={16} />
                    <div>
                      <strong>NBA SAR 4.6.1 Compliance:</strong> Fill or verify the following fields before approving.
                      These will feed directly into the accreditation criteria generator.
                    </div>
                  </div>

                  <div>
                    <label className="label">NBA PO Mapping *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. PO1, PO3, PO5, PO9, PO12"
                      value={reviewData.po_mapping}
                      onChange={(e) => setReviewData({ ...reviewData, po_mapping: e.target.value })}
                    />
                    <span className="text-muted text-xs">Select applicable Program Outcomes (PO1 to PO12)</span>
                  </div>

                  <div>
                    <label className="label">Resource Person & Designation</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Mr. Ramesh Kumar, Senior Architect, TCS"
                      value={reviewData.resource_person}
                      onChange={(e) => setReviewData({ ...reviewData, resource_person: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Skill / Career Orientation</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Cloud-native architecture, Teamwork, Industry-readiness"
                      value={reviewData.skill_orientation}
                      onChange={(e) => setReviewData({ ...reviewData, skill_orientation: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <div className="alert alert-error mb-md" style={{ fontSize: 12 }}>
                    <AlertCircle size={16} />
                    <div>
                      <strong>Rejection Feedback:</strong> Explain clearly what corrections or missing documents
                      (e.g., attendee signatures, photo proofs) the student needs to provide.
                    </div>
                  </div>

                  <label className="label">Rejection Reason *</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="e.g. Please attach participant attendance sheet and detailed winners list..."
                    value={reviewData.rejection_reason}
                    onChange={(e) => setReviewData({ ...reviewData, rejection_reason: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>

            <div className="modal-footer flex items-center justify-between">
              {!isRejecting ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsRejecting(true)}
                    style={{ color: '#f87171' }}
                  >
                    <XCircle size={15} /> Reject with Reason
                  </button>
                  <div className="flex gap-sm">
                    <button type="button" className="btn btn-secondary" onClick={() => setReviewingEvent(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleApprove}>
                      <CheckCircle size={15} /> Final Approve
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsRejecting(false)}>
                    Back to Approval
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleReject}>
                    Submit Rejection
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW EVENT DETAILS ───────────────────────────────────── */}
      {viewingEvent && (
        <div className="modal-backdrop" onClick={() => setViewingEvent(null)}>
          <div className="modal-dialog" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className={`status-badge ${viewingEvent.status}`} style={{ marginBottom: 6 }}>
                  {viewingEvent.status}
                </span>
                <h2 className="modal-title">{viewingEvent.title}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {viewingEvent.club_name} | {viewingEvent.event_type?.toUpperCase()}
                </div>
              </div>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setViewingEvent(null)}>✕</button>
            </div>

            <div className="modal-body flex flex-col gap-md">
              <div className="grid-3" style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                <div>
                  <div className="text-muted text-xs">DATE</div>
                  <div style={{ fontWeight: 600 }}>{viewingEvent.event_date ? new Date(viewingEvent.event_date).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">VENUE</div>
                  <div style={{ fontWeight: 600 }}>{viewingEvent.venue || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">ATTENDEES</div>
                  <div style={{ fontWeight: 600 }}>{viewingEvent.attendee_count || 'N/A'}</div>
                </div>
              </div>

              {viewingEvent.guest_names && (
                <div>
                  <div className="text-muted text-xs font-bold mb-xs">GUESTS / RESOURCE PERSONS</div>
                  <div style={{ fontSize: 13 }}>
                    {Array.isArray(viewingEvent.guest_names) ? viewingEvent.guest_names.join(', ') : viewingEvent.guest_names}
                  </div>
                </div>
              )}

              {viewingEvent.description && (
                <div>
                  <div className="text-muted text-xs font-bold mb-xs">DESCRIPTION</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{viewingEvent.description}</div>
                </div>
              )}

              {viewingEvent.report_text && (
                <div>
                  <div className="text-muted text-xs font-bold mb-xs">POST-EVENT REPORT</div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-line', background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                    {viewingEvent.report_text}
                  </div>
                </div>
              )}

              {/* NBA Compliance Metadata */}
              {viewingEvent.status === 'approved' && (
                <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 6 }}>
                    ✓ NBA ACCREDITATION ATTRIBUTES
                  </div>
                  <div className="text-xs" style={{ display: 'grid', gap: 4 }}>
                    <div><strong>PO Mapping:</strong> {viewingEvent.po_mapping || 'N/A'}</div>
                    <div><strong>Resource Person:</strong> {viewingEvent.resource_person || 'N/A'}</div>
                    <div><strong>Skill Orientation:</strong> {viewingEvent.skill_orientation || 'N/A'}</div>
                    <div><strong>Reviewed By:</strong> {viewingEvent.reviewer_name || viewingEvent.reviewed_by}</div>
                  </div>
                </div>
              )}

              {/* Rejection Details */}
              {viewingEvent.status === 'rejected' && viewingEvent.rejection_reason && (
                <div className="alert alert-error" style={{ fontSize: 12 }}>
                  <AlertCircle size={16} />
                  <div>
                    <strong>Rejection Reason:</strong> {viewingEvent.rejection_reason}
                  </div>
                </div>
              )}

              {/* Photos Gallery */}
              {viewingEvent.photos && viewingEvent.photos.length > 0 && (
                <div>
                  <div className="text-muted text-xs font-bold mb-xs">EVENT PHOTOS</div>
                  <div className="photo-grid">
                    {viewingEvent.photos.map((p) => (
                      <img
                        key={p.id}
                        src={`/api/v1/event-photos/${p.file_path}`}
                        alt="Event"
                        className="photo-thumb"
                        onClick={() => window.open(`/api/v1/event-photos/${p.file_path}`, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewingEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT CLUB (ADMIN) ──────────────────────────── */}
      {showClubModal && (
        <div className="modal-backdrop" onClick={() => setShowClubModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingClubId ? 'Edit Club & Mentor' : 'Create New Club'}</h2>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowClubModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveClub}>
              <div className="modal-body flex flex-col gap-md">
                <div>
                  <label className="label">Club Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. ACM Student Chapter"
                    value={clubForm.name}
                    onChange={(e) => setClubForm({ ...clubForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="label">Category *</label>
                  <select
                    className="input"
                    value={clubForm.category}
                    onChange={(e) => setClubForm({ ...clubForm, category: e.target.value })}
                    required
                  >
                    {CLUB_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Assigned Faculty Mentor *</label>
                  <select
                    className="input"
                    value={clubForm.mentor_faculty_id}
                    onChange={(e) => setClubForm({ ...clubForm, mentor_faculty_id: e.target.value })}
                    required
                  >
                    <option value="">Select Faculty Mentor</option>
                    {facultyList.map((f) => (
                      <option key={f.faculty_id} value={f.faculty_id}>
                        {f.name} ({f.faculty_id}) — {f.designation || 'Faculty'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Mission, regular activities..."
                    value={clubForm.description}
                    onChange={(e) => setClubForm({ ...clubForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClubModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClubId ? 'Save Changes' : 'Create Club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ASSIGN STUDENT ROLE (ADMIN) ──────────────────────────── */}
      {showRoleModal && (
        <div className="modal-backdrop" onClick={() => setShowRoleModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Student Club Role</h2>
              <button className="btn btn-icon btn-secondary btn-sm" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveRole}>
              <div className="modal-body flex flex-col gap-md">
                <div>
                  <label className="label">Target Club *</label>
                  <select
                    className="input"
                    value={roleForm.club_id}
                    onChange={(e) => setRoleForm({ ...roleForm, club_id: e.target.value })}
                    required
                  >
                    <option value="">Select Club</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Student *</label>
                  <select
                    className="input"
                    value={roleForm.student_id}
                    onChange={(e) => setRoleForm({ ...roleForm, student_id: e.target.value })}
                    required
                  >
                    <option value="">Select Student</option>
                    {studentsList.map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.name} ({s.student_id}) — Section {s.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Assigned Role *</label>
                  <select
                    className="input"
                    value={roleForm.role}
                    onChange={(e) => setRoleForm({ ...roleForm, role: e.target.value })}
                    required
                  >
                    <option value="head">Club Head (Submitter & Lead)</option>
                    <option value="council">Student Council Member (Submitter)</option>
                    <option value="member">General Member</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Assign Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
