import React, { useState, useEffect } from 'react'
import { leaveAPI, timetableAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  X, Calendar, Clock, AlertTriangle, CheckCircle2,
  Users, UserMinus, ShieldAlert, Sparkles, Send, Ban, UserCheck
} from 'lucide-react'

export default function LeaveManagementModal({ isOpen, onClose, onLeaveSubmitted, defaultFacultyId }) {
  const { user } = useAuth()
  const [facultyList, setFacultyList] = useState([])
  const [targetFacultyId, setTargetFacultyId] = useState(defaultFacultyId || user?.linked_id || '')

  const [dateStr, setDateStr] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('13:30')
  const [reason, setReason] = useState('Personal / Medical Leave')

  // Live affected preview
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState(null)

  // Past leaves tab / list
  const [activeTab, setActiveTab] = useState('apply') // 'apply' | 'history'
  const [leavesList, setLeavesList] = useState([])
  const [substituteModalLeave, setSubstituteModalLeave] = useState(null)
  const [selectedSubstituteId, setSelectedSubstituteId] = useState('')

  // Load faculty list for dropdowns
  useEffect(() => {
    timetableAPI.getMeta().then(res => {
      const facs = res.data?.faculty || []
      setFacultyList(facs)
      if (!targetFacultyId && facs.length > 0) {
        setTargetFacultyId(facs[0].faculty_id)
      }
    }).catch(console.error)
  }, [])

  // Sync defaultFacultyId if passed
  useEffect(() => {
    if (defaultFacultyId) setTargetFacultyId(defaultFacultyId)
  }, [defaultFacultyId])

  // Fetch live preview whenever faculty, date, or time window changes
  useEffect(() => {
    if (!isOpen || !targetFacultyId || !dateStr) return

    let cancelled = false
    const fetchPreview = async () => {
      setPreviewLoading(true)
      try {
        const payload = {
          faculty_id: targetFacultyId,
          date: dateStr,
          start_time: isFullDay ? null : startTime,
          end_time: isFullDay ? null : endTime,
        }
        const res = await leaveAPI.preview(payload)
        if (!cancelled) {
          setPreviewData(res.data)
        }
      } catch (err) {
        if (!cancelled) setPreviewData(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    const timer = setTimeout(fetchPreview, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, targetFacultyId, dateStr, isFullDay, startTime, endTime])

  // Load existing leaves
  const loadLeaves = async () => {
    try {
      const res = await leaveAPI.list({ faculty_id: user?.role === 'admin' ? undefined : (user?.linked_id || targetFacultyId) })
      setLeavesList(res.data?.leaves || [])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (isOpen) loadLeaves()
  }, [isOpen, targetFacultyId])

  if (!isOpen) return null

  // Submit leave notice
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!targetFacultyId || !dateStr) {
      toast.error('Faculty and Date are required')
      return
    }

    try {
      const payload = {
        faculty_id: targetFacultyId,
        date: dateStr,
        start_time: isFullDay ? null : startTime,
        end_time: isFullDay ? null : endTime,
        reason: reason.trim(),
        created_by: user?.name || 'Faculty',
      }
      const res = await leaveAPI.submit(payload)
      toast.success(res.data?.message || 'Leave notice submitted successfully!')
      if (onLeaveSubmitted) onLeaveSubmitted()
      loadLeaves()
      setActiveTab('history')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit leave notice')
    }
  }

  // Cancel leave notice
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Cancel this leave notice and send class restoration notifications to affected students?')) return
    try {
      const res = await leaveAPI.cancel(leaveId)
      toast.success(res.data?.message || 'Leave cancelled and students alerted')
      loadLeaves()
      if (onLeaveSubmitted) onLeaveSubmitted()
    } catch (err) {
      toast.error('Failed to cancel leave notice')
    }
  }

  // Assign substitute
  const handleAssignSubstitute = async (e) => {
    e.preventDefault()
    if (!substituteModalLeave || !selectedSubstituteId) return
    try {
      const res = await leaveAPI.assignSubstitute(substituteModalLeave.id, {
        substitute_faculty_id: selectedSubstituteId,
      })
      toast.success(res.data?.message || 'Substitute assigned and students notified!')
      setSubstituteModalLeave(null)
      loadLeaves()
    } catch (err) {
      toast.error('Failed to assign substitute')
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg, 16px)',
        width: '100%',
        maxWidth: '760px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--primary-subtle)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}>
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Faculty Leave & Student Notification Portal
              </h2>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Notify enrolled students of absence and manage schedule cancellations
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '0 24px',
          background: 'var(--bg-canvas)',
        }}>
          <button
            onClick={() => setActiveTab('apply')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'apply' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'apply' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Submit Leave Notice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Active & Past Leaves
            <span style={{
              background: 'var(--bg-elevated)',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
            }}>
              {leavesList.length}
            </span>
          </button>
        </div>

        {/* Tab 1: Apply Form */}
        {activeTab === 'apply' && (
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>

              {/* Faculty Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  FACULTY MEMBER
                </label>
                <select
                  disabled={user?.role === 'teacher'}
                  value={targetFacultyId}
                  onChange={e => setTargetFacultyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-canvas)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                >
                  {facultyList.map(f => (
                    <option key={f.faculty_id} value={f.faculty_id}>
                      {f.name} ({f.faculty_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Date */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  LEAVE DATE
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={e => setDateStr(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-canvas)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

            </div>

            {/* Time Coverage Radio */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                TIME COVERAGE
              </label>
              <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="duration"
                    checked={isFullDay}
                    onChange={() => setIsFullDay(true)}
                  />
                  Full Day (All scheduled periods)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="radio"
                    name="duration"
                    checked={!isFullDay}
                    onChange={() => setIsFullDay(false)}
                  />
                  Specific Time Window (Partial Day)
                </label>
              </div>

              {!isFullDay && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Start Time:</span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-canvas)',
                        color: 'var(--text-primary)',
                        marginLeft: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>End Time:</span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-canvas)',
                        color: 'var(--text-primary)',
                        marginLeft: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason Text */}
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                REASON / NOTES (SURFACED IN INTERNAL LOGS)
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for leave or instructions for students..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Dynamic Affected Slots & Student Preview Card */}
            <div style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '24px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Affected Classes & Student Impact Preview
                  </span>
                </div>
                {previewLoading && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Calculating…</span>}
              </div>

              {previewData?.affected_slots?.length > 0 ? (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--warning-subtle)',
                    border: '1px solid var(--warning-border)',
                    color: 'var(--warning)',
                    fontSize: '12.5px',
                    marginBottom: '14px',
                  }}>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>{previewData.affected_slots_count} scheduled class session(s)</strong> will be cancelled.
                      Approximately <strong>{previewData.affected_students_count} enrolled students</strong> will receive instant cancellation notifications.
                    </span>
                  </div>

                  {/* List of affected slots */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    {previewData.affected_slots.map(s => (
                      <div
                        key={s.id}
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <span>Period {s.period_index} ({s.time_label})</span>
                          <span style={{ color: 'var(--primary)' }}>Room {s.room}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {s.subject_name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                          <span>Section: {s.section_display}</span>
                          <span>{s.affected_student_count} students</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {previewLoading ? 'Analyzing timetable…' : 'No scheduled classes found for this faculty in the selected time window. Daily attendance will be marked ON LEAVE.'}
                </div>
              )}
            </div>

            {/* Submit Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Send size={15} /> Confirm Leave & Dispatch Notifications
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Leaves History & Actions */}
        {activeTab === 'history' && (
          <div style={{ padding: '24px' }}>
            {leavesList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No active or past leave notices found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {leavesList.map(l => (
                  <div
                    key={l.id}
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {l.faculty_name}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: l.status === 'CANCELLED' ? 'var(--danger-subtle)' : 'var(--success-subtle)',
                          color: l.status === 'CANCELLED' ? 'var(--danger)' : 'var(--success)',
                          border: `1px solid ${l.status === 'CANCELLED' ? 'var(--danger-border)' : 'var(--success-border)'}`,
                        }}>
                          {l.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        📅 {l.date_display} • {l.time_window} • Reason: {l.reason || 'Personal'}
                      </div>

                      {l.substitute_faculty_name && (
                        <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px' }}>
                          ✓ Substitute Assigned: <strong>{l.substitute_faculty_name}</strong>
                        </div>
                      )}
                    </div>

                    {l.status !== 'CANCELLED' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSubstituteModalLeave(l)
                            const others = facultyList.filter(f => f.faculty_id !== l.faculty_id)
                            if (others.length > 0) setSelectedSubstituteId(others[0].faculty_id)
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '12px' }}
                        >
                          <UserCheck size={14} /> Assign Substitute
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelLeave(l.id)}
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '12px', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                        >
                          <Ban size={14} /> Cancel Leave
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Inline Substitute Assignment Modal */}
      {substituteModalLeave && (
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
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--text-primary)' }}>
              Assign Substitute Faculty
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Select a faculty member to cover classes for {substituteModalLeave.faculty_name} on {substituteModalLeave.date_display}. An updated notification will be sent to students.
            </p>

            <select
              value={selectedSubstituteId}
              onChange={e => setSelectedSubstituteId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                marginBottom: '18px',
                boxSizing: 'border-box',
              }}
            >
              {facultyList.filter(f => f.faculty_id !== substituteModalLeave.faculty_id).map(f => (
                <option key={f.faculty_id} value={f.faculty_id}>
                  {f.name} ({f.faculty_id})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSubstituteModalLeave(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAssignSubstitute}
              >
                Assign & Notify Students
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
