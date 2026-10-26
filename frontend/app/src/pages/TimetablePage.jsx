import React, { useState, useEffect, useMemo } from 'react'
import { timetableAPI, subjectsAPI, sectionsAPI, departmentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import LeaveManagementModal from '../components/LeaveManagementModal'
import PageHeader from '../components/PageHeader'
import Tabs from '../components/Tabs'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, Users, Building2, AlertTriangle,
  Fingerprint, Sparkles, Plus, BookOpen, Layers, CheckCircle2,
  ChevronRight, ArrowRight, ExternalLink, Trash2, Edit3, Search
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

  // Feature 1: Add Slot Modal State
  const [showAddSlotModal, setShowAddSlotModal] = useState(false)
  const [slotForm, setSlotForm] = useState({
    faculty_id: '',
    subject_id: '',
    section_id: '',
    day_of_week: 'Mon',
    period_index: 1,
    room: '',
    is_lab: false,
    co_faculty_id: '',
    academic_term: '2024-25-EVEN',
  })
  const [savingSlot, setSavingSlot] = useState(false)

  // Feature 2: Subjects State
  const [subjects, setSubjects] = useState([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false)
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectForm, setSubjectForm] = useState({
    code: '',
    name: '',
    department_id: '',
  })
  const [savingSubject, setSavingSubject] = useState(false)

  // Feature 3: Sections State
  const [allSections, setAllSections] = useState([])
  const [loadingSections, setLoadingSections] = useState(false)
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [sectionForm, setSectionForm] = useState({
    semester: '',
    section_label: '',
    default_room: '',
    department_id: '',
  })
  const [savingSection, setSavingSection] = useState(false)

  // Departments List (for dropdowns)
  const [departmentsList, setDepartmentsList] = useState([])

  // Load metadata on mount
  const loadMeta = () => {
    timetableAPI.getMeta().then(res => {
      const data = res.data || {}
      setMeta(data)
      if (data.faculty?.length > 0 && !selectedFacultyId) {
        const def = data.faculty.find(f => f.name.toLowerCase().includes('vidyaraj')) || data.faculty[0]
        setSelectedFacultyId(def.faculty_id)
      }
      if (data.sections?.length > 0 && !selectedSectionId) {
        const defSec = data.sections.find(s => s.semester === '6' && s.section_label === 'A') || data.sections[0]
        setSelectedSectionId(defSec.id)
      }
    }).catch(console.error)
  }

  const loadSubjects = async () => {
    setLoadingSubjects(true)
    try {
      const res = await subjectsAPI.list()
      setSubjects(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSubjects(false)
    }
  }

  const loadSections = async () => {
    setLoadingSections(true)
    try {
      const res = await sectionsAPI.list()
      setAllSections(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingSections(false)
    }
  }

  useEffect(() => {
    loadMeta()
    loadSubjects()
    loadSections()
    departmentsAPI.list().then(r => setDepartmentsList(r.data || [])).catch(() => {})
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
    } else if (activeView === 'subjects') {
      loadSubjects()
    } else if (activeView === 'sections') {
      loadSections()
    }
  }, [activeView, selectedFacultyId, selectedSectionId, masterDayFilter, masterRoomFilter])

  // Current period detection
  const now = new Date()
  const todayCode = now.toLocaleDateString('en-US', { weekday: 'short' }) // e.g. "Tue"
  const currentTimeStr = now.toTimeString().slice(0, 5) // "10:30"

  const renderSlotCard = (slot, day, section) => {
    // 7th Semester Project Day Detection (Thu, Fri, Sat are Major Project days)
    const isSem7 = section?.semester === '7' || section?.semester === 7
    const isProjectDay = isSem7 && ['Thu', 'Fri', 'Sat'].includes(day)

    if (isProjectDay && !slot) {
      return (
        <div style={{
          height: '100%',
          minHeight: '88px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(245, 158, 11, 0.07)',
          border: '1px solid rgba(245, 158, 11, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          textAlign: 'center',
          gap: '4px',
        }}>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#f59e0b',
            background: 'rgba(245, 158, 11, 0.15)',
            padding: '2px 7px',
            borderRadius: 'var(--radius-xs)',
          }}>
            Major Project
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Phase I Project Work
          </span>
        </div>
      )
    }

    if (!slot) {
      return (
        <div style={{
          height: '100%',
          minHeight: '88px',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border-default)',
          background: 'var(--bg-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '11px',
          padding: '8px',
          textAlign: 'center',
          gap: '2px',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Free Period</span>
          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Self Study</span>
        </div>
      )
    }

    const isCurrent = slot.day_of_week === todayCode && slot.start_time <= currentTimeStr && currentTimeStr <= slot.end_time

    return (
      <div style={{
        height: '100%',
        minHeight: '88px',
        borderRadius: 'var(--radius-sm)',
        background: isCurrent ? 'var(--primary-subtle)' : 'var(--bg-surface)',
        border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border-default)'}`,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: isCurrent ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
        transition: 'all var(--transition-fast)',
      }}>
        {isCurrent && (
          <span style={{
            position: 'absolute',
            top: '-7px',
            right: '8px',
            background: 'var(--primary)',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: 'var(--radius-full)',
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
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 'var(--radius-xs)',
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
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '90px'
          }}>
            {slot.section_display || slot.faculty_name}
          </span>
          <span style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-default)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--primary)',
            fontWeight: 600,
            fontSize: '10.5px'
          }}>
            {slot.room ? `R-${slot.room}` : '—'}
          </span>
        </div>
      </div>
    )
  }

  const timetableTabs = useMemo(() => {
    const list = []
    if (!isStudent) {
      list.push({ id: 'faculty', label: 'Faculty Schedule', icon: Users })
    }
    list.push({ id: 'section', label: 'Section Schedule', icon: Layers })
    if (!isStudent) {
      list.push({
        id: 'master',
        label: 'Master Grid & Rooms',
        icon: Building2,
        count: clashes.length > 0 ? `${clashes.length} clashes` : undefined
      })
      list.push({ id: 'subjects', label: 'Subjects & Courses', icon: BookOpen, count: subjects.length })
      list.push({ id: 'sections', label: 'Class Sections', icon: Layers, count: allSections.length })
    }
    return list
  }, [isStudent, clashes.length, subjects.length, allSections.length])

  return (
    <>
      <PageHeader
        title="Faculty & Class Timetable"
        category="Academic Operations"
        badge="2024–25 Even Semester"
        description="Unified schedule manager with 6 fixed college periods, room allocations, and absence alerts"
        actions={
          !isStudent ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isAdmin && activeView === 'master' && (
                <button
                  onClick={() => {
                    setSlotForm({
                      faculty_id: meta.faculty[0]?.faculty_id || '',
                      subject_id: subjects[0]?.id ? String(subjects[0].id) : '',
                      section_id: meta.sections[0]?.id ? String(meta.sections[0].id) : '',
                      day_of_week: 'Mon',
                      period_index: 1,
                      room: meta.rooms[0] || 'CSE-101',
                      is_lab: false,
                      co_faculty_id: '',
                      academic_term: '2024-25-EVEN',
                    })
                    setShowAddSlotModal(true)
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Add Slot
                </button>
              )}

              {isAdmin && activeView === 'subjects' && (
                <button
                  onClick={() => {
                    setSubjectForm({ code: '', name: '', department_id: departmentsList[0]?.id || '' })
                    setShowAddSubjectModal(true)
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Add Subject
                </button>
              )}

              {isAdmin && activeView === 'sections' && (
                <button
                  onClick={() => {
                    setSectionForm({ semester: '5', section_label: 'A', default_room: 'CSE-101', department_id: departmentsList[0]?.id || '' })
                    setShowAddSectionModal(true)
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Plus size={14} /> Add Section
                </button>
              )}

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
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
              >
                <Fingerprint size={14} /> Biometric Kiosk <ExternalLink size={12} />
              </Link>
            </div>
          ) : null
        }
      />

      <div className="page-body">
        {/* Navigation Tabs */}
        <Tabs
          activeTab={activeView}
          onChange={setActiveView}
          tabs={timetableTabs}
        />

        {/* Dynamic Context Selector Toolbar */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {activeView === 'faculty' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Faculty Instructor:
                </span>
                <select
                  value={selectedFacultyId}
                  onChange={e => setSelectedFacultyId(e.target.value)}
                  className="form-select"
                  style={{ maxWidth: 360, height: 36, padding: '6px 12px' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Academic Section:
                </span>
                <select
                  value={selectedSectionId}
                  onChange={e => setSelectedSectionId(e.target.value)}
                  className="form-select"
                  style={{ maxWidth: 360, height: 36, padding: '6px 12px' }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Day:</span>
                  <select
                    value={masterDayFilter}
                    onChange={e => setMasterDayFilter(e.target.value)}
                    className="form-select"
                    style={{ width: 120, height: 34, padding: '4px 8px' }}
                  >
                    <option value="All">All Days</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Room:</span>
                  <select
                    value={masterRoomFilter}
                    onChange={e => setMasterRoomFilter(e.target.value)}
                    className="form-select"
                    style={{ width: 130, height: 34, padding: '4px 8px' }}
                  >
                    <option value="All">All Rooms</option>
                    {meta.rooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {activeView === 'faculty' && facultySchedule && (
                <span>Department: <strong style={{ color: 'var(--text-primary)' }}>CSE</strong> • Academic Term: <strong style={{ color: 'var(--text-primary)' }}>Even Semester</strong></span>
              )}
              {activeView === 'section' && sectionSchedule && (
                <span>Cohort: <strong style={{ color: 'var(--text-primary)' }}>{sectionSchedule.enrolled_students || 0} Students</strong></span>
              )}
              {activeView === 'master' && (
                <span>Allocated: <strong style={{ color: 'var(--text-primary)' }}>{masterSlots.length} Slots</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* VIEW 1: FACULTY TIMETABLE GRID */}
        {activeView === 'faculty' && facultySchedule && (
          <div>
            {/* Faculty Header Profile Card */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '16px 20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-subtle)',
                    border: '1px solid var(--primary-border)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '15px',
                  }}>
                    {facultySchedule.faculty?.initials || 'FAC'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                      {facultySchedule.faculty?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      ID: <strong style={{ color: 'var(--text-secondary)' }}>{facultySchedule.faculty?.faculty_id}</strong> • {facultySchedule.faculty?.designation} • Dept: CSE
                    </div>
                  </div>
                </div>

                {/* Workload Metric Chips */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Theory</div>
                    <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{facultySchedule.workload?.theory_periods ?? 0}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Lab / Prac</div>
                    <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: '#a855f7' }}>{facultySchedule.workload?.lab_periods ?? 0}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-subtle)', border: '1px solid var(--primary-border)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Total Load</div>
                    <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>{facultySchedule.workload?.total_periods ?? 0} hrs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timetable Grid Matrix Card */}
            <div className="card" style={{ padding: 'var(--space-4)', overflowX: 'auto', marginBottom: 'var(--space-6)' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px', minWidth: '940px' }}>
                <thead>
                  <tr>
                    <th style={{
                      width: '76px',
                      padding: '8px 6px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-default)'
                    }}>
                      Day / Time
                    </th>
                    {PERIODS.map(p => (
                      <th key={p.index} style={{
                        padding: '8px 10px',
                        textAlign: 'center',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-default)'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-secondary)' }}>{p.label}</div>
                        <div className="tabular-nums" style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day}>
                      <td style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: day === todayCode ? 'var(--primary)' : 'var(--text-primary)',
                        textAlign: 'center',
                        background: day === todayCode ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 6px',
                        border: `1px solid ${day === todayCode ? 'var(--primary-border)' : 'var(--border-default)'}`,
                        verticalAlign: 'middle',
                        width: '76px',
                      }}>
                        <div style={{ letterSpacing: '0.02em' }}>{day}</div>
                        {day === todayCode && (
                          <div style={{
                            fontSize: '9px',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            marginTop: 3,
                            letterSpacing: '0.06em'
                          }}>
                            TODAY
                          </div>
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
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '16px 20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>
                      {sectionSchedule.section?.display_name} Class Timetable
                    </h3>
                    <span className="badge badge-primary">
                      Semester {sectionSchedule.section?.semester} • Sec {sectionSchedule.section?.section_label}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
                    Default Lecture Hall: <strong style={{ color: 'var(--text-secondary)' }}>{sectionSchedule.section?.default_room || 'Assigned per class'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', padding: '6px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Enrolled Cohort</div>
                    <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {sectionSchedule.enrolled_students || 0} Students
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 'var(--space-4)', overflowX: 'auto', marginBottom: 'var(--space-6)' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px', minWidth: '940px' }}>
                <thead>
                  <tr>
                    <th style={{
                      width: '76px',
                      padding: '8px 6px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: 'var(--bg-subtle)',
                      borderRadius: 'var(--radius-xs)',
                      border: '1px solid var(--border-default)'
                    }}>
                      Day
                    </th>
                    {PERIODS.map(p => (
                      <th key={p.index} style={{
                        padding: '8px 10px',
                        textAlign: 'center',
                        background: 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-default)'
                      }}>
                        <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--text-secondary)' }}>{p.label}</div>
                        <div className="tabular-nums" style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400, marginTop: 1 }}>{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => (
                    <tr key={day}>
                      <td style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: day === todayCode ? 'var(--primary)' : 'var(--text-primary)',
                        textAlign: 'center',
                        background: day === todayCode ? 'var(--primary-subtle)' : 'var(--bg-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 6px',
                        border: `1px solid ${day === todayCode ? 'var(--primary-border)' : 'var(--border-default)'}`,
                        verticalAlign: 'middle',
                        width: '76px',
                      }}>
                        <div style={{ letterSpacing: '0.02em' }}>{day}</div>
                        {day === todayCode && (
                          <div style={{
                            fontSize: '9px',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            marginTop: 3,
                            letterSpacing: '0.06em'
                          }}>
                            TODAY
                          </div>
                        )}
                      </td>

                      {PERIODS.map(p => {
                        const daySlots = sectionSchedule.grid[day] || []
                        const slot = daySlots.find(s => s.period_index === p.index)
                        return (
                          <td key={p.index} style={{ verticalAlign: 'top', padding: 0 }}>
                            {renderSlotCard(slot, day, sectionSchedule.section)}
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
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                marginBottom: 'var(--space-4)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', fontWeight: 700, fontSize: '13.5px', marginBottom: '6px' }}>
                  <AlertTriangle size={17} /> Room Scheduling Conflict Detected ({clashes.length} Conflicts)
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {clashes.map((c, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>
                      • Room <strong>{c.room}</strong> on <strong>{c.day}</strong> (Period {c.period_index}): {c.slots.map(s => `${s.subject_code} (${s.section_display}, ${s.faculty_name})`).join(' vs ')}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--success-subtle)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--success)',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                <CheckCircle2 size={16} /> Zero room scheduling clashes detected across department sections.
              </div>
            )}

            {/* Master Table */}
            <div className="table-wrapper" style={{ marginBottom: 'var(--space-6)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Period & Time</th>
                    <th>Subject</th>
                    <th>Section</th>
                    <th>Faculty</th>
                    <th>Room</th>
                    <th>Type</th>
                    {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
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
                      <td>
                        <span className="badge badge-neutral">{slot.section_display}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{slot.faculty_name}</div>
                        {slot.co_faculty_initials && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{slot.co_faculty_initials}</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-primary">R-{slot.room}</span>
                      </td>
                      <td>
                        {slot.is_lab ? (
                          <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>LAB</span>
                        ) : (
                          <span className="badge badge-neutral">Theory</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)', padding: '2px 6px' }}
                            title="Delete slot"
                            onClick={async () => {
                              if (window.confirm(`Delete slot for ${slot.subject_code} (${slot.section_display}, ${slot.day_of_week} ${slot.time_label})?`)) {
                                try {
                                  await timetableAPI.deleteSlot(slot.id)
                                  toast.success('Timetable slot removed')
                                  loadMasterSlots()
                                } catch (err) {
                                  toast.error(err.response?.data?.error || 'Failed to delete slot')
                                }
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 4: SUBJECTS & CURRICULUM COURSES (FEATURE 2) */}
        {activeView === 'subjects' && (
          <div>
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="search-bar" style={{ maxWidth: 360, flex: 1 }}>
                <Search size={14} />
                <input
                  placeholder="Search subjects by code or name…"
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Total Courses: <strong style={{ color: 'var(--text-primary)' }}>{subjects.length}</strong>
              </span>
            </div>

            {loadingSubjects ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : subjects.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <EmptyState
                  icon={BookOpen}
                  title="No Subjects Registered"
                  description="Add course codes and names to make them available for timetable scheduling."
                />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Course Code</th>
                      <th>Course Name</th>
                      <th>Department</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects
                      .filter(s =>
                        !subjectSearch.trim() ||
                        (s.code || '').toLowerCase().includes(subjectSearch.toLowerCase()) ||
                        (s.name || '').toLowerCase().includes(subjectSearch.toLowerCase())
                      )
                      .map((sub, idx) => (
                        <tr key={sub.id || idx}>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)' }}>{sub.code}</strong>
                          </td>
                          <td>{sub.name}</td>
                          <td>
                            <Badge variant="neutral">
                              {departmentsList.find(d => d.id === sub.department_id)?.code || (sub.department_id ? `Dept #${sub.department_id}` : 'All')}
                            </Badge>
                          </td>
                          {isAdmin && (
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)', padding: '2px 6px' }}
                                title="Delete course"
                                onClick={async () => {
                                  if (window.confirm(`Delete subject ${sub.code} - ${sub.name}?`)) {
                                    try {
                                      await subjectsAPI.delete(sub.id)
                                      toast.success(`Subject ${sub.code} deleted`)
                                      loadSubjects()
                                      loadMeta()
                                    } catch (err) {
                                      toast.error(err.response?.data?.error || 'Failed to delete subject')
                                    }
                                  }
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 5: CLASS SECTIONS (FEATURE 3) */}
        {activeView === 'sections' && (
          <div>
            <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Class Sections Directory</h4>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Sections and batches configured for lecture halls and timetable matrices.</p>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Total Sections: <strong style={{ color: 'var(--text-primary)' }}>{allSections.length}</strong>
              </span>
            </div>

            {loadingSections ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : allSections.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <EmptyState
                  icon={Layers}
                  title="No Class Sections Configured"
                  description="Create academic sections (e.g. Sem 5 – Section A) to build timetable matrices."
                />
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Semester</th>
                      <th>Section Label</th>
                      <th>Default Lecture Hall</th>
                      <th>Timetable Slots</th>
                      <th>Enrolled Students</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {allSections.map((sec, idx) => (
                      <tr key={sec.id || idx}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{idx + 1}</td>
                        <td>
                          <strong>Sem {sec.semester}</strong>
                        </td>
                        <td>
                          <Badge variant="primary">Section {sec.section_label}</Badge>
                        </td>
                        <td>
                          {sec.default_room ? <span className="badge badge-neutral">R-{sec.default_room}</span> : '—'}
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ color: sec.slot_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {sec.slot_count || 0} slots
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ color: sec.enrolled_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {sec.enrolled_count || 0} students
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', padding: '2px 6px' }}
                              title="Delete section"
                              onClick={async () => {
                                if (window.confirm(`Delete Section Sem ${sec.semester}-${sec.section_label}?`)) {
                                  try {
                                    await sectionsAPI.delete(sec.id)
                                    toast.success(`Section Sem ${sec.semester}-${sec.section_label} deleted`)
                                    loadSections()
                                    loadMeta()
                                  } catch (err) {
                                    toast.error(err.response?.data?.error || 'Failed to delete section')
                                  }
                                }
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MODAL 1: ADD TIMETABLE SLOT (FEATURE 1) ── */}
        <Modal
          isOpen={showAddSlotModal}
          onClose={() => setShowAddSlotModal(false)}
          title="Allocate Timetable Class Slot"
          maxWidth={540}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddSlotModal(false)}
                disabled={savingSlot}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingSlot}
                onClick={async () => {
                  if (!slotForm.faculty_id || !slotForm.section_id) {
                    toast.error('Faculty and Section are required')
                    return
                  }
                  setSavingSlot(true)
                  try {
                    const payload = {
                      faculty_id: slotForm.faculty_id,
                      subject_id: slotForm.subject_id ? parseInt(slotForm.subject_id, 10) : undefined,
                      section_id: parseInt(slotForm.section_id, 10),
                      day_of_week: slotForm.day_of_week,
                      period_index: parseInt(slotForm.period_index, 10),
                      room: slotForm.room.trim(),
                      is_lab: Boolean(slotForm.is_lab),
                      co_faculty_id: slotForm.co_faculty_id || undefined,
                      academic_term: slotForm.academic_term || '2024-25-EVEN',
                    }
                    const res = await timetableAPI.createSlot(payload)
                    if (res.data?.warning) {
                      toast(res.data.warning, { icon: '⚠️' })
                    } else {
                      toast.success('Timetable slot allocated successfully')
                    }
                    setShowAddSlotModal(false)
                    loadMasterSlots()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to allocate slot')
                  } finally {
                    setSavingSlot(false)
                  }
                }}
              >
                {savingSlot ? 'Allocating…' : 'Allocate Slot'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Faculty Instructor *</label>
                <select
                  className="form-select"
                  value={slotForm.faculty_id}
                  onChange={e => setSlotForm(prev => ({ ...prev, faculty_id: e.target.value }))}
                >
                  {meta.faculty.map(f => (
                    <option key={f.faculty_id} value={f.faculty_id}>
                      {f.name} ({f.faculty_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Academic Section *</label>
                <select
                  className="form-select"
                  value={slotForm.section_id}
                  onChange={e => setSlotForm(prev => ({ ...prev, section_id: e.target.value }))}
                >
                  {meta.sections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Subject / Course</label>
                <select
                  className="form-select"
                  value={slotForm.subject_id}
                  onChange={e => setSlotForm(prev => ({ ...prev, subject_id: e.target.value }))}
                >
                  <option value="">Select Course…</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Lecture Hall / Lab Room</label>
                <input
                  className="form-input"
                  placeholder="e.g. CSE-101"
                  list="room-suggestions"
                  value={slotForm.room}
                  onChange={e => setSlotForm(prev => ({ ...prev, room: e.target.value }))}
                />
                <datalist id="room-suggestions">
                  {meta.rooms.map(r => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Day of Week *</label>
                <select
                  className="form-select"
                  value={slotForm.day_of_week}
                  onChange={e => setSlotForm(prev => ({ ...prev, day_of_week: e.target.value }))}
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Period Index *</label>
                <select
                  className="form-select"
                  value={slotForm.period_index}
                  onChange={e => setSlotForm(prev => ({ ...prev, period_index: e.target.value }))}
                >
                  {PERIODS.map(p => (
                    <option key={p.index} value={p.index}>
                      {p.label} ({p.time})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Co-Faculty (Optional for Labs)</label>
                <select
                  className="form-select"
                  value={slotForm.co_faculty_id}
                  onChange={e => setSlotForm(prev => ({ ...prev, co_faculty_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {meta.faculty.map(f => (
                    <option key={f.faculty_id} value={f.faculty_id}>
                      {f.name} ({f.faculty_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Academic Term</label>
                <input
                  className="form-input"
                  value={slotForm.academic_term}
                  onChange={e => setSlotForm(prev => ({ ...prev, academic_term: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="is-lab-check"
                checked={slotForm.is_lab}
                onChange={e => setSlotForm(prev => ({ ...prev, is_lab: e.target.checked }))}
              />
              <label htmlFor="is-lab-check" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                This is a Practical Laboratory / Hands-on Session
              </label>
            </div>
          </div>
        </Modal>

        {/* ── MODAL 2: ADD SUBJECT (FEATURE 2) ── */}
        <Modal
          isOpen={showAddSubjectModal}
          onClose={() => setShowAddSubjectModal(false)}
          title="Add Curriculum Subject / Course"
          maxWidth={480}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddSubjectModal(false)}
                disabled={savingSubject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingSubject}
                onClick={async () => {
                  if (!subjectForm.code?.trim() || !subjectForm.name?.trim()) {
                    toast.error('Course Code and Name are required')
                    return
                  }
                  setSavingSubject(true)
                  try {
                    await subjectsAPI.create({
                      code: subjectForm.code.trim().toUpperCase(),
                      name: subjectForm.name.trim(),
                      department_id: subjectForm.department_id ? parseInt(subjectForm.department_id, 10) : undefined,
                    })
                    toast.success(`Course ${subjectForm.code.trim().toUpperCase()} added`)
                    setShowAddSubjectModal(false)
                    loadSubjects()
                    loadMeta()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to add course')
                  } finally {
                    setSavingSubject(false)
                  }
                }}
              >
                {savingSubject ? 'Adding…' : 'Add Course'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Course Code *</label>
              <input
                className="form-input"
                placeholder="e.g. CS601"
                value={subjectForm.code}
                onChange={e => setSubjectForm(prev => ({ ...prev, code: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Course Name *</label>
              <input
                className="form-input"
                placeholder="e.g. Distributed Operating Systems"
                value={subjectForm.name}
                onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={subjectForm.department_id}
                onChange={e => setSubjectForm(prev => ({ ...prev, department_id: e.target.value }))}
              >
                <option value="">Select Department</option>
                {departmentsList.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>

        {/* ── MODAL 3: ADD SECTION (FEATURE 3) ── */}
        <Modal
          isOpen={showAddSectionModal}
          onClose={() => setShowAddSectionModal(false)}
          title="Add Class Section"
          maxWidth={480}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddSectionModal(false)}
                disabled={savingSection}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingSection}
                onClick={async () => {
                  if (!sectionForm.semester?.trim() || !sectionForm.section_label?.trim()) {
                    toast.error('Semester and Section Label are required')
                    return
                  }
                  setSavingSection(true)
                  try {
                    await sectionsAPI.create({
                      semester: sectionForm.semester.trim(),
                      section_label: sectionForm.section_label.trim().toUpperCase(),
                      default_room: sectionForm.default_room.trim(),
                      department_id: sectionForm.department_id ? parseInt(sectionForm.department_id, 10) : undefined,
                    })
                    toast.success(`Section Sem ${sectionForm.semester}-${sectionForm.section_label.toUpperCase()} created`)
                    setShowAddSectionModal(false)
                    loadSections()
                    loadMeta()
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to create section')
                  } finally {
                    setSavingSection(false)
                  }
                }}
              >
                {savingSection ? 'Creating…' : 'Create Section'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Semester * (e.g. 5, 7, PG)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 5"
                  value={sectionForm.semester}
                  onChange={e => setSectionForm(prev => ({ ...prev, semester: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Section Label * (e.g. A, B, D)</label>
                <input
                  className="form-input"
                  placeholder="e.g. D"
                  value={sectionForm.section_label}
                  onChange={e => setSectionForm(prev => ({ ...prev, section_label: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Default Lecture Hall</label>
                <input
                  className="form-input"
                  placeholder="e.g. CSE-105"
                  value={sectionForm.default_room}
                  onChange={e => setSectionForm(prev => ({ ...prev, default_room: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={sectionForm.department_id}
                  onChange={e => setSectionForm(prev => ({ ...prev, department_id: e.target.value }))}
                >
                  <option value="">Select Department</option>
                  {departmentsList.map(d => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Modal>

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
    </>
  )
}
