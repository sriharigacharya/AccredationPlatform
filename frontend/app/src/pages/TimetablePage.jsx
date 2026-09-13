import React, { useState, useEffect, useMemo } from 'react'
import { timetableAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import LeaveManagementModal from '../components/LeaveManagementModal'
import { Link } from 'react-router-dom'
import {
  Calendar, Clock, Users, Building2, AlertTriangle,
  Fingerprint, Sparkles, Plus, BookOpen, Layers, CheckCircle2,
  ChevronRight, ArrowRight, ExternalLink
} from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PERIODS = [
  { index: 1, time: '09:00 - 10:00', label: 'Period 1' },
  { index: 2, time: '10:00 - 11:00', label: 'Period 2' },
  { index: 3, time: '11:30 - 12:30', label: 'Period 3' },
  { index: 4, time: '12:30 - 13:30', label: 'Period 4' },
  { index: 5, time: '14:30 - 15:30', label: 'Period 5' },
  { index: 6, time: '15:30 - 16:30', label: 'Period 6' },
]

export default function TimetablePage() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'
  const isStudent = user?.role === 'student'
  const isAdmin = user?.role === 'admin'

  const [activeView, setActiveView] = useState(isStudent ? 'section' : 'faculty') // 'faculty' | 'section' | 'master'
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState({ faculty: [], sections: [], rooms: [] })

  // Selected filters
  const [selectedFacultyId, setSelectedFacultyId] = useState(user?.linked_id || '')
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [masterDayFilter, setMasterDayFilter] = useState('All')
  const [masterRoomFilter, setMasterRoomFilter] = useState('All')

  // Timetable data
  const [facultySchedule, setFacultySchedule] = useState(null)
  const [sectionSchedule, setSectionSchedule] = useState(null)
  const [masterSlots, setMasterSlots] = useState([])
  const [clashes, setClashes] = useState([])

  // Leave modal state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)

  // Load metadata on mount
  useEffect(() => {
    timetableAPI.getMeta().then(res => {
      const data = res.data || {}
      setMeta(data)
      if (data.faculty?.length > 0 && !selectedFacultyId) {
        // Prefer Dr. C VIDYARAJ or first
        const def = data.faculty.find(f => f.name.toLowerCase().includes('vidyaraj')) || data.faculty[0]
        setSelectedFacultyId(def.faculty_id)
      }
      if (data.sections?.length > 0 && !selectedSectionId) {
        // Prefer Sem 6 Sec A or first
        const defSec = data.sections.find(s => s.semester === '6' && s.section_label === 'A') || data.sections[0]
        setSelectedSectionId(defSec.id)
      }
    }).catch(console.error)
  }, [])

  // Fetch Faculty schedule
  const loadFacultySchedule = async (fId) => {
    if (!fId) return
    setLoading(true)
    try {
      const res = await timetableAPI.getFaculty(fId)
      setFacultySchedule(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Section schedule
  const loadSectionSchedule = async (sId) => {
    if (!sId) return
    setLoading(true)
    try {
      const res = await timetableAPI.getSection(sId)
      setSectionSchedule(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Master slots
  const loadMasterSlots = async () => {
    setLoading(true)
    try {
      const params = {}
      if (masterDayFilter !== 'All') params.day = masterDayFilter
      if (masterRoomFilter !== 'All') params.room = masterRoomFilter
      const res = await timetableAPI.getSlots(params)
      setMasterSlots(res.data?.slots || [])
      setClashes(res.data?.clashes || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeView === 'faculty' && selectedFacultyId) {
      loadFacultySchedule(selectedFacultyId)
    } else if (activeView === 'section' && selectedSectionId) {
      loadSectionSchedule(selectedSectionId)
    } else if (activeView === 'master') {
      loadMasterSlots()
    }
  }, [activeView, selectedFacultyId, selectedSectionId, masterDayFilter, masterRoomFilter])

  // Current period detection
  const now = new Date()
  const todayCode = now.toLocaleDateString('en-US', { weekday: 'short' }) // e.g. "Tue"
  const currentTimeStr = now.toTimeString().slice(0, 5) // "10:30"

  const renderSlotCard = (slot) => {
    if (!slot) {
      return (
        <div style={{
          height: '100%',
          minHeight: '84px',
          borderRadius: '8px',
          border: '1px dashed var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '11.5px',
        }}>
          Free
        </div>
      )
    }

    const isCurrent = slot.day_of_week === todayCode && slot.start_time <= currentTimeStr && currentTimeStr <= slot.end_time

    return (
      <div style={{
        height: '100%',
        minHeight: '84px',
        borderRadius: '10px',
        background: isCurrent ? 'var(--primary-subtle)' : 'var(--bg-elevated)',
        border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border-default)'}`,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: isCurrent ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
      }}>
        {isCurrent && (
          <span style={{
            position: 'absolute',
            top: '-8px',
            right: '8px',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: '9.5px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '10px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Now Active
          </span>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '4px' }}>
            <span style={{
              fontWeight: 700,
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              lineHeight: 1.3,
            }}>
              {slot.subject_code || slot.raw_text}
            </span>

            {slot.is_lab && (
              <span style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#a855f7',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '4px',
              }}>
                LAB
              </span>
            )}
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {slot.subject_name}
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
        }}>
          <span style={{
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}>
            {slot.section_display || slot.faculty_name}
          </span>
          <span style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
            padding: '1px 6px',
            borderRadius: '4px',
            color: 'var(--primary)',
            fontWeight: 600,
          }}>
            {slot.room ? `R-${slot.room}` : '—'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Faculty & Class Timetable</h1>
            <span style={{
              background: 'var(--primary-subtle)',
              border: '1px solid var(--primary-border)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
            }}>
              2024–25 EVEN SEMESTER
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Unified schedule manager with 6 fixed college periods, room allocations, and absence alerts
          </p>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <Fingerprint size={16} /> Biometric Kiosk <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Main View Selector Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        paddingBottom: '2px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isStudent && (
            <button
              onClick={() => setActiveView('faculty')}
              className={`btn btn-sm ${activeView === 'faculty' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} /> Faculty Schedule
            </button>
          )}

          <button
            onClick={() => setActiveView('section')}
            className={`btn btn-sm ${activeView === 'section' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={14} /> Section Schedule
          </button>

          {!isStudent && (
            <button
              onClick={() => setActiveView('master')}
              className={`btn btn-sm ${activeView === 'master' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Building2 size={14} /> Master Grid & Rooms
            </button>
          )}
        </div>

        {/* Dynamic Context Selector */}
        {activeView === 'faculty' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Faculty:</span>
            <select
              value={selectedFacultyId}
              onChange={e => setSelectedFacultyId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {meta.faculty.map(f => (
                <option key={f.faculty_id} value={f.faculty_id}>
                  {f.name} ({f.faculty_id})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeView === 'section' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Select Section:</span>
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {meta.sections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeView === 'master' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Day:</span>
              <select
                value={masterDayFilter}
                onChange={e => setMasterDayFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                }}
              >
                <option value="All">All Days</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Room:</span>
              <select
                value={masterRoomFilter}
                onChange={e => setMasterRoomFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                }}
              >
                <option value="All">All Rooms</option>
                {meta.rooms.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* VIEW 1: FACULTY TIMETABLE GRID */}
      {activeView === 'faculty' && facultySchedule && (
        <div>
          {/* Faculty Header Card */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
              }}>
                {facultySchedule.faculty?.initials || 'FAC'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  {facultySchedule.faculty?.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ID: {facultySchedule.faculty?.faculty_id} • {facultySchedule.faculty?.designation} • Dept: CSE
                </div>
              </div>
            </div>

            {/* Workload badges */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Theory</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{facultySchedule.workload?.theory_periods}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lab</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#a855f7' }}>{facultySchedule.workload?.lab_periods}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: '8px', background: 'var(--bg-canvas)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Load</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>{facultySchedule.workload?.total_periods} hrs</div>
              </div>
            </div>
          </div>

          {/* Timetable Grid Matrix */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            overflowX: 'auto',
            padding: '16px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px', minWidth: '940px' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px', padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                    Day / Time
                  </th>
                  {PERIODS.map(p => (
                    <th key={p.index} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{p.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      color: day === todayCode ? 'var(--primary)' : 'var(--text-primary)',
                      textAlign: 'center',
                      background: day === todayCode ? 'var(--primary-subtle)' : 'var(--bg-canvas)',
                      borderRadius: '8px',
                      padding: '12px 6px',
                      border: `1px solid ${day === todayCode ? 'var(--primary-border)' : 'var(--border-subtle)'}`,
                    }}>
                      {day}
                      {day === todayCode && (
                        <div style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: 700 }}>TODAY</div>
                      )}
                    </td>

                    {PERIODS.map(p => {
                      const daySlots = facultySchedule.grid[day] || []
                      const slot = daySlots.find(s => s.period_index === p.index)
                      return (
                        <td key={p.index} style={{ verticalAlign: 'top', padding: 0 }}>
                          {renderSlotCard(slot)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SECTION TIMETABLE */}
      {activeView === 'section' && sectionSchedule && (
        <div>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                {sectionSchedule.section?.display_name} Timetable
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Default Lecture Hall: {sectionSchedule.section?.default_room || 'Assigned per class'} • Enrolled: {sectionSchedule.enrolled_students} Students
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            overflowX: 'auto',
            padding: '16px',
          }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px', minWidth: '940px' }}>
              <thead>
                <tr>
                  <th style={{ width: '80px', padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                    Day
                  </th>
                  {PERIODS.map(p => (
                    <th key={p.index} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{p.label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <td style={{
                      fontWeight: 800,
                      fontSize: '13px',
                      color: day === todayCode ? 'var(--primary)' : 'var(--text-primary)',
                      textAlign: 'center',
                      background: day === todayCode ? 'var(--primary-subtle)' : 'var(--bg-canvas)',
                      borderRadius: '8px',
                      padding: '12px 6px',
                      border: `1px solid ${day === todayCode ? 'var(--primary-border)' : 'var(--border-subtle)'}`,
                    }}>
                      {day}
                    </td>

                    {PERIODS.map(p => {
                      const daySlots = sectionSchedule.grid[day] || []
                      const slot = daySlots.find(s => s.period_index === p.index)
                      return (
                        <td key={p.index} style={{ verticalAlign: 'top', padding: 0 }}>
                          {renderSlotCard(slot)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: MASTER SLOTS & CLASH DETECTION */}
      {activeView === 'master' && (
        <div>
          {/* Clash Alert Banner */}
          {clashes.length > 0 ? (
            <div style={{
              background: 'var(--danger-subtle)',
              border: '1px solid var(--danger-border)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                <AlertTriangle size={18} /> Room Clash Detected ({clashes.length} Conflicts)
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {clashes.map((c, i) => (
                  <div key={i} style={{ marginBottom: '4px' }}>
                    • <strong>{c.room}</strong> on <strong>{c.day}</strong> during <strong>Period {c.period_index}</strong>: {c.slots.map(s => `${s.subject_code} (${s.section_display}, ${s.faculty_name})`).join(' vs ')}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--success-subtle)',
              border: '1px solid var(--success-border)',
              borderRadius: '12px',
              padding: '12px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--success)',
              fontSize: '13px',
              fontWeight: 600,
            }}>
              <CheckCircle2 size={16} /> Zero room scheduling clashes detected in this timetable term.
            </div>
          )}

          {/* Master Table */}
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '14px',
            overflowX: 'auto',
          }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Period & Time</th>
                  <th>Subject</th>
                  <th>Section</th>
                  <th>Faculty</th>
                  <th>Room</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {masterSlots.slice(0, 100).map(slot => (
                  <tr key={slot.id}>
                    <td style={{ fontWeight: 600 }}>{slot.day_of_week}</td>
                    <td>{slot.time_label}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{slot.subject_code}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{slot.subject_name}</div>
                    </td>
                    <td>{slot.section_display}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{slot.faculty_name}</div>
                      {slot.co_faculty_initials && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{slot.co_faculty_initials}</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-secondary">R-{slot.room}</span>
                    </td>
                    <td>
                      {slot.is_lab ? (
                        <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>LAB</span>
                      ) : (
                        <span className="badge badge-ghost">Theory</span>
                      )}
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
          if (activeView === 'faculty') loadFacultySchedule(selectedFacultyId)
        }}
      />

    </div>
  )
}
