import React, { useState, useEffect, useMemo } from 'react'
import { attendanceAPI, timetableAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import LeaveManagementModal from '../components/LeaveManagementModal'
import EventAttendanceModal from '../components/EventAttendanceModal'
import CertificateViewerModal from '../components/CertificateViewerModal'
import PageHeader from '../components/PageHeader'
import Tabs from '../components/Tabs'
import Badge from '../components/Badge'
import StatCard from '../components/StatCard'
import toast from 'react-hot-toast'
import {
  Fingerprint, Clock, Calendar, CheckCircle2, AlertTriangle,
  Users, UserCheck, Search, Filter, ExternalLink, RefreshCw,
  Plus, Shield, Activity, BarChart2, ArrowRight, Award, FileText,
  Eye, XCircle, Check, Sparkles, UploadCloud, ChevronRight, FileCheck,
  TrendingUp
} from 'lucide-react'

export default function FacultyAttendancePage() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const isAdmin = user?.role === 'admin'

  const [activeTab, setActiveTab] = useState(isTeacher ? 'my' : 'campus') // 'campus' | 'my' | 'events'
  const [loading, setLoading] = useState(false)

  // Date selection for campus roster
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [todayData, setTodayData] = useState({ summary: null, faculty_attendance: [], recent_events: [] })
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Faculty personal attendance
  const [myAttendance, setMyAttendance] = useState(null)
  const [facultyList, setFacultyList] = useState([])
  const [selectedFacultyId, setSelectedFacultyId] = useState(user?.linked_id || '')

  // Event Attendance Requests (OD & Certifications)
  const [eventRequestsData, setEventRequestsData] = useState({
    total: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    requests: [],
  })
  const [eventStatusFilter, setEventStatusFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [selectedReqForViewer, setSelectedReqForViewer] = useState(null)
  const [viewerModalOpen, setViewerModalOpen] = useState(false)

  // Modals
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    faculty_id: '',
    event_type: 'IN',
    time_str: '09:00',
    admin_note: 'Manual administrative adjustment',
  })

  // Load faculty list
  useEffect(() => {
    timetableAPI.getMeta().then(res => {
      const facs = res.data?.faculty || []
      setFacultyList(facs)
      if (!selectedFacultyId && facs.length > 0) {
        const def = facs.find(f => f.name.toLowerCase().includes('vidyaraj')) || facs[0]
        setSelectedFacultyId(user?.linked_id || def.faculty_id)
        setManualForm(prev => ({ ...prev, faculty_id: def.faculty_id }))
      }
    }).catch(console.error)
  }, [user])

  // Load Campus Roster
  const loadCampusData = async () => {
    setLoading(true)
    try {
      const res = await attendanceAPI.getToday({ date: selectedDate })
      setTodayData(res.data || { summary: null, faculty_attendance: [], recent_events: [] })
    } catch (err) {
      console.error(err)
      toast.error('Failed to load campus attendance records')
    } finally {
      setLoading(false)
    }
  }

  // Load My Attendance
  const loadFacultyHistory = async (fId) => {
    if (!fId) return
    try {
      const res = await attendanceAPI.getFacultyHistory(fId)
      setMyAttendance(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  // Load Event Attendance Requests
  const loadEventRequests = async () => {
    try {
      const params = {
        status: eventStatusFilter !== 'all' ? eventStatusFilter : undefined,
        faculty_id: (!isAdmin && (user?.linked_id || user?.user_id)) ? (user?.linked_id || user?.user_id) : undefined,
      }
      const res = await attendanceAPI.listEventRequests(params)
      setEventRequestsData(res.data || { total: 0, pending_count: 0, approved_count: 0, rejected_count: 0, requests: [] })
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (activeTab === 'campus') {
      loadCampusData()
    } else if (activeTab === 'my') {
      loadFacultyHistory(selectedFacultyId)
    } else if (activeTab === 'events') {
      loadEventRequests()
    }
  }, [activeTab, selectedDate, selectedFacultyId, eventStatusFilter])

  // Load event requests counts on initial mount for badges
  useEffect(() => {
    attendanceAPI.listEventRequests().then(res => {
      setEventRequestsData(res.data || { total: 0, pending_count: 0, approved_count: 0, rejected_count: 0, requests: [] })
    }).catch(() => {})
  }, [])

  // Filtered roster
  const filteredRoster = (todayData.faculty_attendance || []).filter(item => {
    const matchesSearch = item.faculty_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.faculty_id.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'ON_CAMPUS') return item.is_on_campus
    return item.status === statusFilter
  })

  // Handle manual attendance override submission
  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualForm.faculty_id) return
    try {
      await attendanceAPI.manualRecord({
        ...manualForm,
        date: selectedDate,
      })
      toast.success('Manual attendance entry recorded')
      setManualModalOpen(false)
      loadCampusData()
    } catch (err) {
      toast.error('Failed to record manual attendance')
    }
  }

  const attendanceTabs = useMemo(() => {
    const list = []
    if (!isTeacher) {
      list.push({
        id: 'campus',
        label: 'Live Campus Roster',
        icon: Users,
        count: todayData.summary?.on_campus !== undefined ? todayData.summary.on_campus : undefined
      })
    }
    list.push({
      id: 'my',
      label: isTeacher ? 'My Attendance' : 'Faculty History & Reports',
      icon: Clock
    })
    list.push({
      id: 'events',
      label: isTeacher ? 'Event Attendance & Proofs' : 'Event Attendance Approvals',
      icon: Award,
      count: eventRequestsData.pending_count > 0 ? eventRequestsData.pending_count : undefined
    })
    return list
  }, [isTeacher, todayData.summary?.on_campus, eventRequestsData.pending_count])

  return (
    <>
      {/* Institutional Top Header */}
      <PageHeader
        title="Faculty Biometric Attendance"
        category="Academic Operations"
        badge="Terminal Live"
        description="Biometric punch IN / OUT tracking, campus occupancy, and real-time status rules"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setEventModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Award size={14} /> Request Event Attendance
            </button>

            <button
              onClick={() => setLeaveModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Calendar size={14} /> Apply for Leave
            </button>

            <Link
              to="/mock-device"
              target="_blank"
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <Fingerprint size={14} /> Biometric Terminal <ExternalLink size={12} />
            </Link>
          </div>
        }
      />

      <div className="page-body">
        {/* View Switcher Tabs */}
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={attendanceTabs}
        />

        {/* TAB 1: LIVE CAMPUS ROSTER */}
        {activeTab === 'campus' && (
          <div>
            {/* Key Live Metric Overview */}
            {todayData.summary && (
              <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
                <StatCard
                  label="On Campus Right Now"
                  value={todayData.summary.on_campus}
                  subtext="Punched IN & Active"
                  icon={Users}
                  variant="primary"
                />
                <StatCard
                  label="Present Today"
                  value={todayData.summary.present}
                  subtext="On-Time Arrivals"
                  icon={CheckCircle2}
                  variant="success"
                />
                <StatCard
                  label="Arrived Late"
                  value={todayData.summary.late}
                  subtext="Past 1st Class / 09:15"
                  icon={Clock}
                  variant="warning"
                />
                <StatCard
                  label="Half Day / Early Exit"
                  value={todayData.summary.half_day}
                  subtext="Departed early (< 4 hrs)"
                  icon={AlertTriangle}
                  variant="danger"
                />
                <StatCard
                  label="On Approved Leave"
                  value={todayData.summary.on_leave}
                  subtext="Students Notified"
                  icon={Calendar}
                  variant="purple"
                />
                <StatCard
                  label="Not Yet Arrived"
                  value={todayData.summary.not_marked}
                  subtext="No swipe event today"
                  icon={Clock}
                  variant="default"
                />
              </div>
            )}

            {/* Filter Toolbar */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
                  <div className="search-bar" style={{ flex: 1, minWidth: 220, maxWidth: 360 }}>
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Search faculty name or ID…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Status filter chips */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: 'All', value: 'ALL' },
                      { label: 'On Campus', value: 'ON_CAMPUS' },
                      { label: 'Present', value: 'PRESENT' },
                      { label: 'Late', value: 'LATE' },
                      { label: 'Half Day', value: 'HALF_DAY' },
                      { label: 'On Leave', value: 'ON_LEAVE' },
                      { label: 'Not Marked', value: 'NOT_YET_MARKED' },
                    ].map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStatusFilter(s.value)}
                        className={`btn btn-xs ${statusFilter === s.value ? 'btn-primary' : 'btn-secondary'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Date:</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="form-input"
                      style={{ width: 'auto', height: 32, padding: '4px 8px', fontSize: '12px' }}
                    />
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setManualModalOpen(true)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={13} /> Manual Entry
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Roster Table */}
            <div className="table-wrapper" style={{ marginBottom: 'var(--space-6)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th>First IN</th>
                    <th>Last OUT</th>
                    <th>Campus Duration</th>
                    <th>Scheduled Day Hours</th>
                    <th>Status Today</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoster.map(item => (
                    <tr key={item.faculty_id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-xs)',
                            background: item.is_on_campus ? 'var(--primary)' : 'var(--bg-subtle)',
                            color: item.is_on_campus ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${item.is_on_campus ? 'var(--primary)' : 'var(--border-default)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                          }}>
                            {item.faculty_name ? item.faculty_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : 'F'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {item.faculty_name}
                              {item.is_on_campus && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {item.faculty_id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{item.first_in_time || '—'}</td>
                      <td>{item.last_out_time || '—'}</td>
                      <td>{item.work_duration_hours > 0 ? `${item.work_duration_hours} hrs` : '—'}</td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {item.scheduled_first_start ? `${item.scheduled_first_start} - ${item.scheduled_last_end}` : '09:00 - 16:30'}
                      </td>
                      <td>
                        <span className={`badge ${
                          item.is_on_campus ? 'badge-primary' :
                          item.status === 'PRESENT' ? 'badge-success' :
                          item.status === 'LATE' ? 'badge-warning' :
                          item.status === 'ON_LEAVE' ? 'badge-neutral' :
                          item.status === 'HALF_DAY' ? 'badge-danger' :
                          'badge-neutral'
                        }`}>
                          {item.is_on_campus ? 'ON CAMPUS' : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: MY ATTENDANCE / FACULTY HISTORY */}
        {activeTab === 'my' && (
          <div>
            {/* Faculty Selector (for Admin / Non-Teacher) */}
            {!isTeacher && (
              <div className="card" style={{ padding: '12px 16px', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Faculty Member:</span>
                  <select
                    value={selectedFacultyId}
                    onChange={e => setSelectedFacultyId(e.target.value)}
                    className="form-select"
                    style={{ maxWidth: 360, height: 36, padding: '6px 12px' }}
                  >
                    {facultyList.map(f => (
                      <option key={f.faculty_id} value={f.faculty_id}>
                        {f.name} ({f.faculty_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {myAttendance && (
              <>
                {/* Metric Cards */}
                <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
                  <StatCard
                    label="Faculty Profile"
                    value={myAttendance.faculty?.name || 'Faculty Member'}
                    subtext={`ID: ${myAttendance.faculty?.faculty_id || '—'} • ${myAttendance.faculty?.designation || 'Instructor'}`}
                    icon={Users}
                    variant="default"
                  />
                  <StatCard
                    label="Monthly Attendance Rate"
                    value={`${myAttendance.metrics?.attendance_percentage ?? 0}%`}
                    subtext={`${myAttendance.metrics?.present_days ?? 0} of ${myAttendance.metrics?.total_days ?? 0} logged work days`}
                    icon={TrendingUp}
                    variant={myAttendance.metrics?.attendance_percentage >= 75 ? "success" : "warning"}
                  />
                  <StatCard
                    label="Late Arrivals"
                    value={myAttendance.metrics?.late_days ?? 0}
                    subtext="Arrivals past first scheduled period"
                    icon={Clock}
                    variant={myAttendance.metrics?.late_days > 0 ? "warning" : "default"}
                  />
                  <StatCard
                    label="Approved Leaves"
                    value={myAttendance.metrics?.leave_days ?? 0}
                    subtext="Sanctioned leaves & official duties"
                    icon={Calendar}
                    variant="purple"
                  />
                </div>

                {/* Today's Campus Swipe Activity status */}
                <div className="card" style={{ padding: '16px 20px', marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Today's Campus Swipe Status
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                          First IN: <strong style={{ color: 'var(--text-primary)' }}>{myAttendance.today?.first_in_time || 'Not punched in'}</strong>
                        </div>
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                          Last OUT: <strong style={{ color: 'var(--text-primary)' }}>{myAttendance.today?.last_out_time || 'On campus / Not punched out'}</strong>
                        </div>
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                          Duration: <strong style={{ color: 'var(--text-primary)' }}>{myAttendance.today?.work_duration_hours || 0} hrs</strong>
                        </div>
                      </div>
                    </div>

                    <Link
                      to="/mock-device"
                      target="_blank"
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                    >
                      <Fingerprint size={14} /> Punch on Terminal <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>

                {/* Monthly History Table */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
                  <div className="card-header" style={{ margin: 0, padding: '14px 18px' }}>
                    <h3 className="card-title" style={{ fontSize: '14px', margin: 0 }}>
                      Daily Attendance History Log (Last 30 Days)
                    </h3>
                    <span className="badge badge-neutral">Biometric Audit Trail</span>
                  </div>
                  <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>First IN</th>
                          <th>Last OUT</th>
                          <th>Hours on Campus</th>
                          <th>Daily Evaluation Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(myAttendance.history || []).map(row => (
                          <tr key={row.date}>
                            <td style={{ fontWeight: 600 }}>{row.date}</td>
                            <td>{row.first_in_time || '—'}</td>
                            <td>{row.last_out_time || '—'}</td>
                            <td>{row.work_duration_hours > 0 ? `${row.work_duration_hours} hrs` : '—'}</td>
                            <td>
                              <span className={`badge ${
                                row.status === 'PRESENT' ? 'badge-success' :
                                row.status === 'LATE' ? 'badge-warning' :
                                row.status === 'ON_LEAVE' ? 'badge-neutral' :
                                'badge-danger'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: EVENT ATTENDANCE REQUESTS & CERTIFICATE PROOFS */}
        {activeTab === 'events' && (
          <div>
            {/* Summary Stat Cards */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
              <StatCard
                label="Total Requests"
                value={eventRequestsData.total}
                subtext="All logged OD / event submissions"
                icon={Award}
                variant="primary"
              />
              <StatCard
                label="Pending Review"
                value={eventRequestsData.pending_count}
                subtext="Awaiting administrator review"
                icon={Clock}
                variant="warning"
              />
              <StatCard
                label="Approved & Granted"
                value={eventRequestsData.approved_count}
                subtext="Attendance credits granted"
                icon={CheckCircle2}
                variant="success"
              />
              <StatCard
                label="Rejected"
                value={eventRequestsData.rejected_count}
                subtext="Disapproved submissions"
                icon={XCircle}
                variant="danger"
              />
            </div>

            {/* Filter Bar & Search */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['all', 'pending', 'approved', 'rejected'].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEventStatusFilter(st)}
                      className={`btn btn-xs ${eventStatusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="search-bar" style={{ width: 240, height: 34 }}>
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Filter by course / faculty…"
                      value={eventSearchQuery}
                      onChange={e => setEventSearchQuery(e.target.value)}
                    />
                  </div>

                  <button
                    onClick={() => setEventModalOpen(true)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> New Request
                  </button>
                </div>
              </div>
            </div>

            {/* Table of Event Attendance Requests */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
              {(() => {
                const filtered = (eventRequestsData.requests || []).filter(r => {
                  if (!eventSearchQuery) return true
                  const q = eventSearchQuery.toLowerCase()
                  return (r.course_name && r.course_name.toLowerCase().includes(q)) ||
                         (r.faculty_name && r.faculty_name.toLowerCase().includes(q)) ||
                         (r.organizer && r.organizer.toLowerCase().includes(q))
                })

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <Award size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto', opacity: 0.6 }} />
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                        No Event Attendance Requests Found
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0', maxWidth: '440px', marginInline: 'auto' }}>
                        {eventStatusFilter !== 'all'
                          ? `There are currently no requests with status "${eventStatusFilter}".`
                          : isTeacher
                          ? "You haven't requested event attendance yet. Click below to submit proof for an attended event or course."
                          : "No faculty members have submitted event attendance requests yet."}
                      </p>
                      <button
                        onClick={() => setEventModalOpen(true)}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={14} /> Request Event Attendance
                      </button>
                    </div>
                  )
                }

                return (
                  <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {isAdmin && <th>Faculty</th>}
                          <th>Course / Event Details</th>
                          <th>Date & Duration</th>
                          <th>Certificate Proof</th>
                          <th>Status</th>
                          <th>Impact & Remarks</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(req => (
                          <tr key={req.id}>
                            {isAdmin && (
                              <td>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.faculty_name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.faculty_id}</div>
                              </td>
                            )}

                            <td style={{ maxWidth: '280px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {req.course_name}
                              </div>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                                <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                                  {req.event_type}
                                </span>
                                {req.organizer && (
                                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                    • {req.organizer}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {req.event_date_display || req.event_date}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                {req.time_window || 'Full Day'}
                              </div>
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => {
                                  setSelectedReqForViewer(req)
                                  setViewerModalOpen(true)
                                }}
                                className="btn btn-ghost btn-xs"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  color: 'var(--accent-primary)',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  background: 'rgba(56, 189, 248, 0.08)',
                                  borderRadius: 'var(--radius-xs)',
                                }}
                                title="Click to preview certificate proof"
                              >
                                <FileText size={13} /> View Certificate
                              </button>
                            </td>

                            <td style={{ whiteSpace: 'nowrap' }}>
                              <span className={`badge ${
                                req.status === 'approved' ? 'badge-success' :
                                req.status === 'rejected' ? 'badge-danger' :
                                req.status === 'cancelled' ? 'badge-neutral' :
                                'badge-warning'
                              }`}>
                                {req.status === 'approved' && <CheckCircle2 size={12} />}
                                {req.status === 'rejected' && <XCircle size={12} />}
                                {req.status === 'pending' && <Clock size={12} />}
                                {req.status}
                              </span>
                            </td>

                            <td style={{ maxWidth: '240px' }}>
                              {req.status === 'approved' ? (
                                <div>
                                  <div style={{ fontSize: '11.5px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Sparkles size={12} /> Attendance: PRESENT
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Added to Faculty Certifications
                                  </div>
                                </div>
                              ) : req.status === 'rejected' ? (
                                <div style={{ fontSize: '11.5px', color: 'var(--danger)' }}>
                                  {req.admin_remarks || 'Rejected by administrator'}
                                </div>
                              ) : (
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                  Awaiting administrator review
                                </div>
                              )}
                            </td>

                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    setSelectedReqForViewer(req)
                                    setViewerModalOpen(true)
                                  }}
                                  className="btn btn-secondary btn-xs"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Eye size={12} /> {isAdmin && req.status === 'pending' ? 'Review…' : 'Details'}
                                </button>

                                {isTeacher && req.status === 'pending' && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm('Withdraw this event attendance request?')) return
                                      try {
                                        await attendanceAPI.cancelEventRequest(req.id)
                                        toast.success('Request withdrawn.')
                                        loadEventRequests()
                                      } catch (err) {
                                        toast.error('Failed to withdraw request')
                                      }
                                    }}
                                    className="btn btn-ghost btn-xs"
                                    style={{ color: 'var(--danger)' }}
                                    title="Withdraw request"
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Leave Management Modal */}
        <LeaveManagementModal
          isOpen={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          defaultFacultyId={selectedFacultyId}
          onLeaveSubmitted={() => {
            if (activeTab === 'campus') loadCampusData()
            else loadFacultyHistory(selectedFacultyId)
          }}
        />

        {/* Admin Manual Entry Modal */}
        {manualModalOpen && (
          <div className="modal-backdrop">
            <form
              onSubmit={handleManualSubmit}
              className="modal-dialog"
              style={{ maxWidth: 460 }}
            >
              <div className="modal-header">
                <h3 className="modal-title">Admin Manual Attendance Entry</h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={() => setManualModalOpen(false)}
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Faculty Member:</label>
                  <select
                    value={manualForm.faculty_id}
                    onChange={e => setManualForm({ ...manualForm, faculty_id: e.target.value })}
                    className="form-select"
                  >
                    {facultyList.map(f => (
                      <option key={f.faculty_id} value={f.faculty_id}>{f.name} ({f.faculty_id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Event Type:</label>
                    <select
                      value={manualForm.event_type}
                      onChange={e => setManualForm({ ...manualForm, event_type: e.target.value })}
                      className="form-select"
                    >
                      <option value="IN">PUNCH IN</option>
                      <option value="OUT">PUNCH OUT</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Time:</label>
                    <input
                      type="time"
                      value={manualForm.time_str}
                      onChange={e => setManualForm({ ...manualForm, time_str: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Audit Note:</label>
                  <input
                    type="text"
                    value={manualForm.admin_note}
                    onChange={e => setManualForm({ ...manualForm, admin_note: e.target.value })}
                    placeholder="Reason for manual adjustment"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setManualModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modals */}
        <EventAttendanceModal
          isOpen={eventModalOpen}
          onClose={() => setEventModalOpen(false)}
          onSubmitted={() => {
            loadEventRequests()
            loadCampusData()
            if (selectedFacultyId) loadFacultyHistory(selectedFacultyId)
          }}
          defaultFacultyId={selectedFacultyId || user?.linked_id}
        />

        <CertificateViewerModal
          isOpen={viewerModalOpen}
          onClose={() => {
            setViewerModalOpen(false)
            setSelectedReqForViewer(null)
          }}
          requestItem={selectedReqForViewer}
          isAdmin={isAdmin}
          onApproved={() => {
            loadEventRequests()
            loadCampusData()
            if (selectedFacultyId) loadFacultyHistory(selectedFacultyId)
          }}
          onRejected={() => {
            loadEventRequests()
          }}
        />
      </div>
    </>
  )
}
