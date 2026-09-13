import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { attendanceAPI, timetableAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  Fingerprint, Clock, Radio, Search, CheckCircle2,
  AlertTriangle, ArrowLeft, RefreshCw, LogIn, LogOut,
  Sliders, ShieldCheck, UserCheck, Activity, Cpu, Sparkles
} from 'lucide-react'

export default function MockDeviceKiosk() {
  const [facultyList, setFacultyList] = useState([])
  const [selectedFacultyId, setSelectedFacultyId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [deviceId, setDeviceId] = useState('MOCK-DEVICE-01')

  // Real-time clock & simulator
  const [currentTime, setCurrentTime] = useState(new Date())
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [customTimeStr, setCustomTimeStr] = useState('08:55')

  // Data & loading states
  const [loading, setLoading] = useState(false)
  const [todayAttendance, setTodayAttendance] = useState([])
  const [recentEvents, setRecentEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [lastAction, setLastAction] = useState(null)
  const [scanning, setScanning] = useState(false)

  // Auto-tick clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch faculty list & today's attendance records
  const loadData = async () => {
    try {
      const [metaRes, todayRes] = await Promise.all([
        timetableAPI.getMeta(),
        attendanceAPI.getToday(),
      ])

      const facs = metaRes.data?.faculty || []
      setFacultyList(facs)
      if (facs.length > 0 && !selectedFacultyId) {
        // default select Dr. C VIDYARAJ if available
        const defaultFac = facs.find(f => f.name.toLowerCase().includes('vidyaraj')) || facs[0]
        setSelectedFacultyId(defaultFac.faculty_id)
      }

      setTodayAttendance(todayRes.data?.faculty_attendance || [])
      setRecentEvents(todayRes.data?.recent_events || [])
      setSummary(todayRes.data?.summary || null)
    } catch (err) {
      console.error('Failed to load kiosk data:', err)
      toast.error('Failed to connect to attendance service')
    }
  }

  useEffect(() => {
    loadData()
    // Poll every 10 seconds for live table updates
    const poll = setInterval(loadData, 10000)
    return () => clearInterval(poll)
  }, [])

  // Filtered faculty for search dropdown
  const filteredFaculty = useMemo(() => {
    if (!searchTerm.trim()) return facultyList
    const q = searchTerm.toLowerCase()
    return facultyList.filter(
      f => f.name.toLowerCase().includes(q) || f.faculty_id.toLowerCase().includes(q)
    )
  }, [facultyList, searchTerm])

  const selectedFaculty = useMemo(() => {
    return facultyList.find(f => f.faculty_id === selectedFacultyId) || null
  }, [facultyList, selectedFacultyId])

  // Get effective timestamp for punch
  const getEffectiveTimestamp = () => {
    if (!useCustomTime) {
      return new Date().toISOString()
    }
    const today = new Date()
    const [h, m] = customTimeStr.split(':').map(Number)
    today.setHours(h, m, 0, 0)
    return today.toISOString()
  }

  // Handle punch event (IN or OUT)
  const handlePunch = async (eventType) => {
    if (!selectedFacultyId) {
      toast.error('Please select a faculty member')
      return
    }

    setScanning(true)
    setLoading(true)

    const payload = {
      faculty_id: selectedFacultyId,
      event_type: eventType,
      device_id: deviceId,
      timestamp: getEffectiveTimestamp(),
    }

    try {
      const res = await attendanceAPI.punch(payload)
      const data = res.data

      setLastAction({
        type: eventType,
        success: true,
        message: data.message,
        facultyName: selectedFaculty?.name,
        time: useCustomTime ? customTimeStr : currentTime.toLocaleTimeString(),
        status: data.computed_status_today,
      })

      toast.success(data.message)
      await loadData()
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Punch operation failed'
      setLastAction({
        type: eventType,
        success: false,
        message: errorMsg,
        facultyName: selectedFaculty?.name,
        time: useCustomTime ? customTimeStr : currentTime.toLocaleTimeString(),
      })
      toast.error(errorMsg)
    } finally {
      setTimeout(() => setScanning(false), 600)
      setLoading(false)
    }
  }

  // Reset demo punches
  const handleReset = async () => {
    if (!window.confirm('Reset all of today\'s punches to start demo fresh?')) return
    try {
      await attendanceAPI.resetDemo()
      toast.success('Attendance records reset successfully')
      setLastAction(null)
      await loadData()
    } catch (err) {
      toast.error('Reset failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 0%, #152238 0%, #070c16 70%, #03060a 100%)',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px 16px 60px',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Subtle background ambient mesh */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '400px',
        background: 'radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{ maxWidth: '1040px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Top Hardware HUD Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '10px 18px',
          backdropFilter: 'blur(16px)',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              to="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '13px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >
              <ArrowLeft size={14} /> Back to Portal
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontSize: '12px', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 600 }}>
                DEVICE: <span style={{ color: '#38bdf8' }}>{deviceId}</span>
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>• Gate 1 Campus Terminal</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontVariantNumeric: 'tabular-nums',
              color: '#f1f5f9',
              background: 'rgba(0,0,0,0.3)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <Clock size={14} color="#38bdf8" />
              <span>{currentTime.toLocaleTimeString([], { hour12: true })}</span>
            </div>
            <button
              onClick={handleReset}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.borderColor = '#ff6b6b'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <RefreshCw size={12} /> Reset Demo
            </button>
          </div>
        </div>

        {/* Kiosk Main Shell */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(20, 29, 47, 0.95) 0%, rgba(12, 18, 32, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '36px 32px',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
          position: 'relative',
        }}>

          {/* Scanning Beam Visual FX */}
          {scanning && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #38bdf8, #10b981, transparent)',
              boxShadow: '0 0 15px #38bdf8',
              animation: 'scanBeam 1.2s ease-in-out infinite',
            }} />
          )}

          {/* Terminal Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(16, 185, 129, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              marginBottom: '14px',
              boxShadow: '0 0 25px rgba(56, 189, 248, 0.15)',
            }}>
              <Fingerprint size={28} color="#38bdf8" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em', color: '#f8fafc' }}>
              Campus Biometric Attendance Terminal
            </h1>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#94a3b8' }}>
              Simulates a hardware biometric / RFID swipe sensor at the campus main entrance
            </p>
          </div>

          {/* Two-Column Controller */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', marginBottom: '28px' }}>

            {/* Left: Faculty Picker & Clock Simulator */}
            <div style={{
              background: 'rgba(9, 14, 26, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '18px',
              padding: '24px',
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.04em' }}>
                SELECT FACULTY MEMBER (42 Staff)
              </label>

              {/* Quick Search */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={15} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Filter by name e.g. Vidyaraj, Shabana, Gowtham…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: '#070c16',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Select Dropdown */}
              <select
                value={selectedFacultyId}
                onChange={e => setSelectedFacultyId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  background: '#0a101d',
                  color: '#f8fafc',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                  marginBottom: '18px',
                  boxSizing: 'border-box',
                }}
              >
                {filteredFaculty.map(f => (
                  <option key={f.faculty_id} value={f.faculty_id}>
                    {f.name} ({f.faculty_id})
                  </option>
                ))}
              </select>

              {/* Selected Profile Badge */}
              {selectedFaculty && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}>
                    {selectedFaculty.initials || 'FAC'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedFaculty.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      ID: {selectedFaculty.faculty_id} • {selectedFaculty.email}
                    </div>
                  </div>
                </div>
              )}

              {/* Time Simulator Toggle */}
              <div style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: useCustomTime ? '12px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={14} color="#38bdf8" />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1' }}>Clock Simulator</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#94a3b8' }}>
                    <input
                      type="checkbox"
                      checked={useCustomTime}
                      onChange={e => setUseCustomTime(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Override Time
                  </label>
                </div>

                {useCustomTime && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <input
                        type="time"
                        value={customTimeStr}
                        onChange={e => setCustomTimeStr(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: '#070c16',
                          border: '1px solid rgba(255,255,255,0.15)',
                          color: '#fff',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Test punch rules:</span>
                    </div>

                    {/* Quick test buttons */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setCustomTimeStr('08:55')}
                        style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        08:55 (On Time)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomTimeStr('09:25')}
                        style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        09:25 (Late)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomTimeStr('13:15')}
                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        13:15 (Half Day)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomTimeStr('16:45')}
                        style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        16:45 (Evening Out)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Big Tactile Punch Triggers */}
            <div style={{
              background: 'rgba(9, 14, 26, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '18px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '14px', letterSpacing: '0.04em' }}>
                  BIOMETRIC SWIPE ACTIONS
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  {/* PUNCH IN */}
                  <button
                    disabled={loading}
                    onClick={() => handlePunch('IN')}
                    style={{
                      background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '28px 14px',
                      color: '#ffffff',
                      fontSize: '18px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35), inset 0 1px 1px rgba(255,255,255,0.3)',
                      transition: 'transform 0.08s ease, filter 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: loading ? 0.7 : 1,
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <LogIn size={28} />
                    PUNCH IN
                  </button>

                  {/* PUNCH OUT */}
                  <button
                    disabled={loading}
                    onClick={() => handlePunch('OUT')}
                    style={{
                      background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '28px 14px',
                      color: '#ffffff',
                      fontSize: '18px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.35), inset 0 1px 1px rgba(255,255,255,0.3)',
                      transition: 'transform 0.08s ease, filter 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: loading ? 0.7 : 1,
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <LogOut size={28} />
                    PUNCH OUT
                  </button>
                </div>
              </div>

              {/* Instant Verification Status Box */}
              <div style={{
                borderRadius: '12px',
                padding: '16px',
                background: lastAction
                  ? (lastAction.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)')
                  : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${lastAction
                  ? (lastAction.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)')
                  : 'rgba(255, 255, 255, 0.06)'}`,
                minHeight: '64px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
              }}>
                {lastAction ? (
                  <>
                    {lastAction.success ? (
                      <CheckCircle2 size={24} color="#10b981" />
                    ) : (
                      <AlertTriangle size={24} color="#ef4444" />
                    )}
                    <div style={{ flex: 1, fontSize: '13px' }}>
                      <div style={{ fontWeight: 700, color: lastAction.success ? '#6ee7b7' : '#fca5a5' }}>
                        {lastAction.success
                          ? `✅ PUNCH ${lastAction.type} Recorded at ${lastAction.time}`
                          : `⚠️ Swipe Rejected`}
                      </div>
                      <div style={{ color: '#cbd5e1', marginTop: '2px', fontSize: '12px' }}>
                        {lastAction.message}
                        {lastAction.status && (
                          <span style={{ marginLeft: '6px', fontWeight: 600, color: '#38bdf8' }}>
                            • Status: {lastAction.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} /> Select faculty and click PUNCH IN / OUT to simulate biometric swipe.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Quick Stat Counter Cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '28px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On Campus Now</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{summary.on_campus}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Present</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{summary.present}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Arrived Late</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{summary.late}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Half Day</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>{summary.half_day}</div>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>On Leave</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>{summary.on_leave}</div>
              </div>
            </div>
          )}

          {/* Today's Live Attendance Table */}
          <div style={{
            background: 'rgba(9, 14, 26, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '18px',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#38bdf8" />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>
                  Live Terminal Feed & Campus Roster (Today)
                </h2>
              </div>
              <Link
                to="/faculty-attendance"
                style={{
                  fontSize: '12.5px',
                  color: '#38bdf8',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Open Full Attendance Dashboard →
              </Link>
            </div>

            {todayAttendance.filter(r => r.first_in || r.status !== 'NOT_YET_MARKED').length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#64748b', fontSize: '13.5px' }}>
                No punches recorded yet today. Use the buttons above to punch in faculty members.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: '#94a3b8', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <th style={{ padding: '10px 12px' }}>Faculty Member</th>
                      <th style={{ padding: '10px 12px' }}>First IN</th>
                      <th style={{ padding: '10px 12px' }}>Last OUT</th>
                      <th style={{ padding: '10px 12px' }}>Campus Duration</th>
                      <th style={{ padding: '10px 12px' }}>Status Today</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance
                      .filter(r => r.first_in || r.status !== 'NOT_YET_MARKED')
                      .map((row, i) => (
                        <tr
                          key={row.faculty_id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          }}
                        >
                          <td style={{ padding: '12px', fontWeight: 600, color: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {row.is_on_campus && (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 6px #38bdf8' }} />
                              )}
                              {row.faculty_name}
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: row.first_in_time ? '#e2e8f0' : '#64748b' }}>
                            {row.first_in_time || '—'}
                          </td>
                          <td style={{ padding: '12px', color: row.last_out_time ? '#e2e8f0' : '#64748b' }}>
                            {row.last_out_time || '—'}
                          </td>
                          <td style={{ padding: '12px', color: '#94a3b8' }}>
                            {row.work_duration_hours > 0 ? `${row.work_duration_hours} hrs` : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                              letterSpacing: '0.03em',
                              background: row.is_on_campus
                                ? 'rgba(56, 189, 248, 0.18)'
                                : row.status === 'PRESENT'
                                ? 'rgba(16, 185, 129, 0.18)'
                                : row.status === 'LATE'
                                ? 'rgba(245, 158, 11, 0.18)'
                                : row.status === 'ON_LEAVE'
                                ? 'rgba(168, 85, 247, 0.18)'
                                : 'rgba(239, 68, 68, 0.18)',
                              color: row.is_on_campus
                                ? '#38bdf8'
                                : row.status === 'PRESENT'
                                ? '#34d399'
                                : row.status === 'LATE'
                                ? '#fbbf24'
                                : row.status === 'ON_LEAVE'
                                ? '#c084fc'
                                : '#f87171',
                              border: `1px solid ${row.is_on_campus
                                ? 'rgba(56, 189, 248, 0.3)'
                                : row.status === 'PRESENT'
                                ? 'rgba(16, 185, 129, 0.3)'
                                : row.status === 'LATE'
                                ? 'rgba(245, 158, 11, 0.3)'
                                : row.status === 'ON_LEAVE'
                                ? 'rgba(168, 85, 247, 0.3)'
                                : 'rgba(239, 68, 68, 0.3)'}`,
                            }}>
                              {row.is_on_campus ? 'ON CAMPUS' : row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Terminal Footer Note */}
          <div style={{ marginTop: '24px', fontSize: '11.5px', color: '#64748b', textAlign: 'center', lineHeight: 1.6 }}>
            This terminal executes live calls to <code>POST /api/v1/attendance/punch</code> with hardware device identifier <code>MOCK-DEVICE-01</code>.<br />
            When physical biometric swipe readers are deployed at campus gates, they interface directly with this identical API shape.
          </div>

        </div>
      </div>
    </div>
  )
}
