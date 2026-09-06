import React, { useEffect, useState, useMemo } from 'react'
import { clubsAPI, studentRolesAPI, eventsAPI, facultyAPI, studentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, Plus, CheckCircle2, XCircle, Clock, Users,
  Award, Shield, FileText, Image, Search, ChevronRight,
  Filter, AlertCircle, Edit, Trash2, ExternalLink, Info, Check, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
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

export default function EventsPage() {
  const { user } = useAuth()
  const role = user?.role || 'student'

  const [clubs, setClubs]               = useState([])
  const [events, setEvents]             = useState([])
  const [facultyList, setFacultyList]   = useState([])
  const [studentsList, setStudentsList] = useState([])
  const [studentRoles, setStudentRoles] = useState([])
  const [loading, setLoading]           = useState(true)

  const [activeTab, setActiveTab]       = useState(role === 'admin' ? 'clubs' : 'events')
  const [selectedClubId, setSelectedClubId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery]   = useState('')

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showClubModal, setShowClubModal]     = useState(false)
  const [showRoleModal, setShowRoleModal]     = useState(false)
  const [reviewingEvent, setReviewingEvent]   = useState(null)
  const [viewingEvent, setViewingEvent]       = useState(null)

  // Mentor Review Form
  const [reviewData, setReviewData] = useState({
    po_mapping: '',
    resource_person: '',
    skill_orientation: '',
    rejection_reason: '',
  })
  const [isRejecting, setIsRejecting] = useState(false)

  // Event submission form
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

  // Club form
  const [clubForm, setClubForm] = useState({
    name: '',
    category: 'technical',
    description: '',
    mentor_faculty_id: '',
  })
  const [editingClubId, setEditingClubId] = useState(null)

  // Role form
  const [roleForm, setRoleForm] = useState({
    club_id: '',
    student_id: '',
    role: 'head',
  })

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

      loadEvents()
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
    } catch (_) {}
  }

  useEffect(() => {
    loadInitialData()
  }, [user])

  const pendingReviewCount = useMemo(() => {
    return events.filter(e => e.status === 'pending').length
  }, [events])

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (selectedClubId && String(e.club_id) !== String(selectedClubId)) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          e.title?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q) ||
          e.event_type?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [events, selectedClubId, statusFilter, searchQuery])

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
      toast.success('Event approved and indexed for Section 4.6.1')
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

  const handleEventSubmit = async (e) => {
    e.preventDefault()
    if (!eventForm.title.trim() || !eventForm.club_id) {
      toast.error('Title and Organizing Club are required')
      return
    }

    const formData = new FormData()
    Object.entries(eventForm).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        formData.append(k, v)
      }
    })
    for (let i = 0; i < selectedPhotos.length; i++) {
      formData.append('photos', selectedPhotos[i])
    }

    try {
      await eventsAPI.create(formData)
      toast.success('Event proposal submitted for faculty review!')
      setShowSubmitModal(false)
      setSelectedPhotos([])
      loadEvents()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit event')
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

  const handleAssignRole = async (e) => {
    e.preventDefault()
    try {
      await studentRolesAPI.assign(roleForm)
      toast.success('Student leader role assigned')
      setShowRoleModal(false)
      loadInitialData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign role')
    }
  }

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Student Clubs & Co-Curricular Events"
        description="Event proposals, mentor faculty reviews, and attendance documentation for NBA SAR Criterion 4 (Section 4.6)."
        badge="Criterion 4.6 Compliant"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} />
              <span>Propose Event</span>
            </button>
            {role === 'admin' && (
              <button
                onClick={() => { setEditingClubId(null); setClubForm({ name: '', category: 'technical', description: '', mentor_faculty_id: '' }); setShowClubModal(true); }}
                className="btn btn-secondary btn-sm"
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
            { id: 'events', label: 'All Events & Activities', icon: Calendar, count: events.length },
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
                <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
                  <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
                    <Search size={14} />
                    <input
                      placeholder="Search events by title or venue…"
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
                    <option value="pending">Pending</option>
                    <option value="rejected">Rejected</option>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {filteredEvents.map(ev => {
                  const isApproved = ev.status === 'approved'
                  const isRejected = ev.status === 'rejected'
                  return (
                    <div
                      key={ev.id}
                      className="card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Badge variant="neutral">{ev.event_type}</Badge>
                          {isApproved ? (
                            <Badge variant="success" icon={CheckCircle2}>Approved</Badge>
                          ) : isRejected ? (
                            <Badge variant="danger" icon={XCircle}>Rejected</Badge>
                          ) : (
                            <Badge variant="warning" icon={Clock}>Pending Review</Badge>
                          )}
                        </div>

                        <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {ev.title}
                        </h4>

                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 8 }}>
                          {ev.club_name || `Club #${ev.club_id}`} · {ev.venue || 'Campus'}
                        </div>

                        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                          {ev.description || 'No description provided.'}
                        </p>
                      </div>

                      <div style={{
                        marginTop: 14,
                        paddingTop: 10,
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span>📅 {(ev.event_date || '').slice(0, 10)}</span>
                          {ev.attendee_count && <span>👥 {ev.attendee_count}</span>}
                        </div>

                        {(role === 'admin' || role === 'teacher') && ev.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(ev)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '11px' }}
                          >
                            Review →
                          </button>
                        )}
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
                      <th>Date</th>
                      <th>Attendees</th>
                      <th style={{ textAlign: 'right' }}>Faculty Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.filter(e => e.status === 'pending').map(ev => (
                      <tr key={ev.id}>
                        <td style={{ fontWeight: 600 }}>{ev.title}</td>
                        <td>{ev.club_name || `Club #${ev.club_id}`}</td>
                        <td><Badge variant="neutral">{ev.event_type}</Badge></td>
                        <td>{(ev.event_date || '').slice(0, 10)}</td>
                        <td className="tabular-nums">{ev.attendee_count || '—'}</td>
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

        {/* ── Modal 1: Propose Event ── */}
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Submit Co-Curricular Event Proposal"
          maxWidth={640}
        >
          <form onSubmit={handleEventSubmit}>
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
                placeholder="e.g. National Hackathon 2025"
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
                <label className="form-label">Venue / Room</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CSE Seminar Hall"
                  value={eventForm.venue}
                  onChange={e => setEventForm({ ...eventForm, venue: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Attendees Count</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="120"
                  value={eventForm.attendee_count}
                  onChange={e => setEventForm({ ...eventForm, attendee_count: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Event Description & Outcomes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Brief summary of event objectives, hands-on learning, and participant profile…"
                value={eventForm.description}
                onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Photos (Optional)</label>
              <input
                type="file"
                className="form-input"
                multiple
                accept="image/*"
                onChange={e => setSelectedPhotos(Array.from(e.target.files || []))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowSubmitModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Submit Proposal
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal 2: Mentor Faculty Review ── */}
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
                    <p className="form-hint">Required for Section 4.6.1 Summary Sheet</p>
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
                      placeholder="Explain why this event cannot be approved (e.g. Missing attendee sheets, unclear outcomes)..."
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

        {/* ── Modal 3: Club Creation ── */}
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
