import React, { useState, useEffect } from 'react'
import { attendanceAPI, timetableAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import LeaveManagementModal from '../components/LeaveManagementModal'
import EventAttendanceModal from '../components/EventAttendanceModal'
import CertificateViewerModal from '../components/CertificateViewerModal'
import toast from 'react-hot-toast'
import {
  Fingerprint, Clock, Calendar, CheckCircle2, AlertTriangle,
  Users, UserCheck, Search, Filter, ExternalLink, RefreshCw,
  Plus, Shield, Activity, BarChart2, ArrowRight, Award, FileText,
  Eye, XCircle, Check, Sparkles, UploadCloud, ChevronRight, FileCheck
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

  return (
    <div className="page-container">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Faculty Biometric Attendance</h1>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--success)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              TERMINAL LIVE
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Biometric punch IN / OUT tracking, campus occupancy, and real-time status rules
          </p>
        </div>

        {/* Top actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setEventModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              background: 'rgba(56, 189, 248, 0.08)',
            }}
          >
            <Award size={15} style={{ color: 'var(--accent-primary)' }} /> Request Event Attendance
          </button>

          <button
            onClick={() => setLeaveModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Calendar size={15} /> Apply for Leave
          </button>

          <Link
            to="/mock-device"
            target="_blank"
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
            }}
          >
            <Fingerprint size={18} /> Launch Biometric Terminal <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isTeacher && (
            <button
              onClick={() => setActiveTab('campus')}
              className={`btn btn-sm ${activeTab === 'campus' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} /> Live Campus Roster
            </button>
          )}

          <button
            onClick={() => setActiveTab('my')}
            className={`btn btn-sm ${activeTab === 'my' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} /> {isTeacher ? 'My Attendance' : 'Faculty History & Reports'}
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`btn btn-sm ${activeTab === 'events' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Award size={14} /> {isTeacher ? 'Event Attendance & Proofs' : 'Event Attendance Approvals'}
            {eventRequestsData.pending_count > 0 && (
              <span style={{
                backgroundColor: activeTab === 'events' ? 'rgba(255,255,255,0.25)' : 'rgba(245, 158, 11, 0.2)',
                color: activeTab === 'events' ? '#fff' : 'var(--warning)',
                border: activeTab === 'events' ? 'none' : '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
                marginLeft: '4px',
              }}>
                {eventRequestsData.pending_count}
              </span>
            )}
          </button>
        </div>

        {/* Date picker for campus view */}
        {activeTab === 'campus' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            />
            {isAdmin && (
              <button
                onClick={() => setManualModalOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={13} /> Manual Entry
              </button>
            )}
          </div>
        )}

        {/* Faculty picker for history view (if admin) */}
        {activeTab === 'my' && !isTeacher && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Faculty:</span>
            <select
              value={selectedFacultyId}
              onChange={e => setSelectedFacultyId(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            >
              {facultyList.map(f => (
                <option key={f.faculty_id} value={f.faculty_id}>
                  {f.name} ({f.faculty_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: LIVE CAMPUS ROSTER */}
      {activeTab === 'campus' && (
        <div>
          {/* Summary Stat Cards */}
          {todayData.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On Campus Right Now</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>{todayData.summary.on_campus}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Punched IN & Active</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present Today</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>{todayData.summary.present}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>On-Time Arrivals</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arrived Late</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>{todayData.summary.late}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Past 1st Class / 09:15</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Half Day / Early Exit</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>{todayData.summary.half_day}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Departed early (&lt; 4 hrs)</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On Approved Leave</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>{todayData.summary.on_leave}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Students Notified</div>
              </div>

              <div className="stat-card">
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Not Yet Arrived</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>{todayData.summary.not_marked}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>No swipe event today</div>
              </div>
            </div>
          )}

          {/* Filter / Search Bar */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '260px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search faculty name or ID…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>

            {/* Status filter chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
                  onClick={() => setStatusFilter(s.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    border: '1px solid',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: statusFilter === s.value ? 'var(--primary)' : 'var(--bg-canvas)',
                    color: statusFilter === s.value ? '#ffffff' : 'var(--text-secondary)',
                    borderColor: statusFilter === s.value ? 'var(--primary)' : 'var(--border-subtle)',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster Table */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            overflowX: 'auto',
          }}>
            <table className="data-table" style={{ width: '100%' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: item.is_on_campus ? 'var(--primary)' : 'var(--bg-canvas)',
                          color: item.is_on_campus ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px',
                        }}>
                          {item.faculty_name ? item.faculty_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : 'F'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {item.faculty_name}
                            {item.is_on_campus && (
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
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
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 9px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        background: item.is_on_campus
                          ? 'rgba(56, 189, 248, 0.15)'
                          : item.status === 'PRESENT'
                          ? 'var(--success-subtle)'
                          : item.status === 'LATE'
                          ? 'var(--warning-subtle)'
                          : item.status === 'ON_LEAVE'
                          ? 'rgba(168, 85, 247, 0.15)'
                          : item.status === 'HALF_DAY'
                          ? 'var(--danger-subtle)'
                          : 'var(--bg-canvas)',
                        color: item.is_on_campus
                          ? '#38bdf8'
                          : item.status === 'PRESENT'
                          ? 'var(--success)'
                          : item.status === 'LATE'
                          ? 'var(--warning)'
                          : item.status === 'ON_LEAVE'
                          ? '#a855f7'
                          : item.status === 'HALF_DAY'
                          ? 'var(--danger)'
                          : 'var(--text-muted)',
                        border: `1px solid ${item.is_on_campus
                          ? 'rgba(56, 189, 248, 0.3)'
                          : item.status === 'PRESENT'
                          ? 'var(--success-border)'
                          : item.status === 'LATE'
                          ? 'var(--warning-border)'
                          : item.status === 'ON_LEAVE'
                          ? 'rgba(168, 85, 247, 0.3)'
                          : item.status === 'HALF_DAY'
                          ? 'var(--danger-border)'
                          : 'var(--border-subtle)'}`,
                      }}>
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
      {activeTab === 'my' && myAttendance && (
        <div>
          {/* Top Profile Summary Card */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            padding: '24px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '18px',
          }}>
            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faculty Profile</div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {myAttendance.faculty?.name}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                ID: {myAttendance.faculty?.faculty_id} • {myAttendance.faculty?.designation}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Attendance %</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                {myAttendance.metrics?.attendance_percentage}%
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {myAttendance.metrics?.present_days} of {myAttendance.metrics?.total_days} logged work days
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Late Arrivals</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', marginTop: '4px' }}>
                {myAttendance.metrics?.late_days}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                After first scheduled period
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Approved Leaves</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
                {myAttendance.metrics?.leave_days}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Students notified automatically
              </div>
            </div>
          </div>

          {/* Today's Punch Activity status */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                TODAY'S CAMPUS SWIPE STATUS
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  First IN: <strong>{myAttendance.today?.first_in_time || 'Not punched in'}</strong>
                </span>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  Last OUT: <strong>{myAttendance.today?.last_out_time || 'On campus / Not punched out'}</strong>
                </span>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  Duration: <strong>{myAttendance.today?.work_duration_hours || 0} hrs</strong>
                </span>
              </div>
            </div>

            <Link
              to="/mock-device"
              target="_blank"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <Fingerprint size={15} /> Punch on Terminal <ExternalLink size={12} />
            </Link>
          </div>

          {/* Monthly History Table */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            overflowX: 'auto',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: '14px' }}>
              Daily Attendance History Log (Last 30 Days)
            </div>
            <table className="data-table" style={{ width: '100%' }}>
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
                        row.status === 'ON_LEAVE' ? 'badge-secondary' :
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
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
        }}>
          <form
            onSubmit={handleManualSubmit}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--text-primary)' }}>
              Admin Manual Attendance Entry
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Faculty Member:
              </label>
              <select
                value={manualForm.faculty_id}
                onChange={e => setManualForm({ ...manualForm, faculty_id: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
              >
                {facultyList.map(f => (
                  <option key={f.faculty_id} value={f.faculty_id}>{f.name} ({f.faculty_id})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Event Type:
                </label>
                <select
                  value={manualForm.event_type}
                  onChange={e => setManualForm({ ...manualForm, event_type: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
                >
                  <option value="IN">PUNCH IN</option>
                  <option value="OUT">PUNCH OUT</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Time:
                </label>
                <input
                  type="time"
                  value={manualForm.time_str}
                  onChange={e => setManualForm({ ...manualForm, time_str: e.target.value })}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Audit Note:
              </label>
              <input
                type="text"
                value={manualForm.admin_note}
                onChange={e => setManualForm({ ...manualForm, admin_note: e.target.value })}
                placeholder="Reason for manual adjustment"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-canvas)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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

      {/* TAB 3: EVENT ATTENDANCE REQUESTS & CERTIFICATE PROOFS */}
      {activeTab === 'events' && (
        <div>
          {/* Summary Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <Award size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Requests</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{eventRequestsData.total}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pending Review</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--warning)' }}>{eventRequestsData.pending_count}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Approved & Granted</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)' }}>{eventRequestsData.approved_count}</div>
              </div>
            </div>

            <div className="card" style={{ padding: '16px 20px', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <XCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Rejected</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger)' }}>{eventRequestsData.rejected_count}</div>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'pending', 'approved', 'rejected'].map(st => (
                <button
                  key={st}
                  onClick={() => setEventStatusFilter(st)}
                  className={`btn btn-xs ${eventStatusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', fontSize: '12px' }}
                >
                  {st}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter by course / faculty…"
                  value={eventSearchQuery}
                  onChange={e => setEventSearchQuery(e.target.value)}
                  style={{
                    padding: '6px 12px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    width: '210px',
                  }}
                />
              </div>

              <button
                onClick={() => setEventModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> New Request
              </button>
            </div>
          </div>

          {/* Table of Event Attendance Requests */}
          <div className="card" style={{ border: '1px solid var(--border-default)', overflow: 'hidden' }}>
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
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Request Event Attendance
                    </button>
                  </div>
                )
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-canvas)', borderBottom: '1px solid var(--border-default)', fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {isAdmin && <th style={{ padding: '12px 16px', textAlign: 'left' }}>Faculty</th>}
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Course / Event Details</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date & Duration</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Certificate Proof</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>Impact & Remarks</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(req => (
                        <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                          {isAdmin && (
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.faculty_name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{req.faculty_id}</div>
                            </td>
                          )}

                          <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {req.course_name}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '10.5px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(56, 189, 248, 0.1)',
                                color: 'var(--accent-primary)',
                                fontWeight: 600,
                              }}>
                                {req.event_type}
                              </span>
                              {req.organizer && (
                                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                  • {req.organizer}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {req.event_date_display || req.event_date}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {req.time_window || 'Full Day'}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <button
                              onClick={() => {
                                setSelectedReqForViewer(req)
                                setViewerModalOpen(true)
                              }}
                              className="btn btn-ghost btn-xs"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                color: 'var(--accent-primary)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                background: 'rgba(56, 189, 248, 0.08)',
                                borderRadius: '6px',
                                padding: '4px 8px',
                              }}
                              title="Click to preview certificate proof"
                            >
                              <FileText size={13} /> View Certificate
                            </button>
                          </td>

                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                                          req.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' :
                                          req.status === 'cancelled' ? 'rgba(148, 163, 184, 0.15)' :
                                          'rgba(245, 158, 11, 0.15)',
                              color: req.status === 'approved' ? 'var(--success)' :
                                     req.status === 'rejected' ? 'var(--danger)' :
                                     req.status === 'cancelled' ? 'var(--text-muted)' :
                                     'var(--warning)',
                              border: `1px solid ${req.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' :
                                                  req.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' :
                                                  'rgba(245, 158, 11, 0.3)'}`,
                            }}>
                              {req.status === 'approved' && <CheckCircle2 size={12} />}
                              {req.status === 'rejected' && <XCircle size={12} />}
                              {req.status === 'pending' && <Clock size={12} />}
                              {req.status}
                            </span>
                          </td>

                          <td style={{ padding: '12px 16px', maxWidth: '240px' }}>
                            {req.status === 'approved' ? (
                              <div>
                                <div style={{ fontSize: '11.5px', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
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

                          <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => {
                                  setSelectedReqForViewer(req)
                                  setViewerModalOpen(true)
                                }}
                                className="btn btn-secondary btn-xs"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
  )
}
