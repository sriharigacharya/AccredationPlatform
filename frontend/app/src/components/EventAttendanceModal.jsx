import React, { useState } from 'react'
import { attendanceAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  X, Calendar, Clock, Award, UploadCloud, FileText, CheckCircle2,
  AlertCircle, Sparkles, Building, Info, FileCheck
} from 'lucide-react'

const EVENT_TYPES = [
  'FDP (Faculty Development Program)',
  'Workshop',
  'Conference',
  'Seminar',
  'Certification Course',
  'Industrial Training',
  'Webinar',
]

export default function EventAttendanceModal({ isOpen, onClose, onSubmitted, defaultFacultyId }) {
  const { user } = useAuth()
  const facultyId = defaultFacultyId || user?.linked_id || user?.user_id

  const [courseName, setCourseName] = useState('')
  const [eventType, setEventType] = useState('Workshop')
  const [organizer, setOrganizer] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0])
  const [isFullDay, setIsFullDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [description, setDescription] = useState('')

  // Certificate file state
  const [certificateFile, setCertificateFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  // Date shortcuts
  const handleSetToday = () => {
    setEventDate(new Date().toISOString().split('T')[0])
  }
  const handleSetYesterday = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    setEventDate(d.toISOString().split('T')[0])
  }

  // Handle file selection
  const handleFileChange = (file) => {
    if (!file) return
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error('Invalid file format. Please upload a PDF, PNG, JPG, or WEBP file.')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds 15MB limit.')
      return
    }
    setCertificateFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target.result)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!courseName.trim()) {
      toast.error('Please enter the course or event name')
      return
    }
    if (!eventDate) {
      toast.error('Please specify the date of the event')
      return
    }
    if (!certificateFile) {
      toast.error('Certificate proof is required. Please upload your completion certificate.')
      return
    }

    setSubmitting(true)
    const toastId = toast.loading('Submitting event attendance request & uploading certificate…')

    try {
      const formData = new FormData()
      formData.append('faculty_id', facultyId)
      formData.append('course_name', courseName.trim())
      formData.append('event_type', eventType)
      formData.append('organizer', organizer.trim())
      formData.append('event_date', eventDate)
      formData.append('is_full_day', isFullDay ? 'true' : 'false')
      if (!isFullDay) {
        formData.append('start_time', startTime)
        formData.append('end_time', endTime)
      } else {
        formData.append('start_time', '09:00')
        formData.append('end_time', '17:00')
      }
      formData.append('description', description.trim())
      formData.append('certificate', certificateFile)

      const res = await attendanceAPI.submitEventRequest(formData)
      toast.success(res.data?.message || 'Event attendance request submitted successfully!', { id: toastId })

      // Reset form
      setCourseName('')
      setOrganizer('')
      setDescription('')
      setCertificateFile(null)
      setFilePreview(null)

      if (onSubmitted) onSubmitted()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to submit event attendance request', { id: toastId })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 15, 29, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                <Award size={18} />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Request Event Attendance & OD
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Submit proof for external FDPs, workshops, and courses. On approval, attendance is granted and the certificate is added to your profile.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Banner notification */}
          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
          }}>
            <Sparkles size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span>
              <strong>Automated Workflow:</strong> Once administrator approves your certificate proof, your daily attendance for this date will be automatically marked <strong>PRESENT</strong> and this course will be directly appended to your <strong>Official Certifications</strong>.
            </span>
          </div>

          {/* Course / Event Name */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Course / Event Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AICTE Sponsored FDP on Deep Learning & Generative AI"
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
              }}
            />
          </div>

          {/* Row: Event Type & Sponsoring Body */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Event Category
              </label>
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              >
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Organizing Body / Institution
              </label>
              <div style={{ position: 'relative' }}>
                <Building size={15} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="e.g. IIT Bombay / NPTEL / IEEE"
                  value={organizer}
                  onChange={e => setOrganizer(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row: Event Date & Time Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Event Date <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={handleSetToday}
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={handleSetYesterday}
                    className="btn btn-ghost btn-xs"
                    style={{ fontSize: '11px', padding: '2px 6px' }}
                  >
                    Yesterday
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                Duration
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '40px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: isFullDay ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isFullDay ? 600 : 400,
                }}>
                  <input
                    type="radio"
                    name="duration"
                    checked={isFullDay}
                    onChange={() => setIsFullDay(true)}
                  />
                  Full Day (09:00 - 17:00)
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: !isFullDay ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: !isFullDay ? 600 : 400,
                }}>
                  <input
                    type="radio"
                    name="duration"
                    checked={!isFullDay}
                    onChange={() => setIsFullDay(false)}
                  />
                  Specific Hours
                </label>
              </div>
            </div>
          </div>

          {/* Time Slot Inputs (if not full day) */}
          {!isFullDay && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '12px',
              background: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-canvas)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-canvas)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          )}

          {/* Certificate Proof Upload Zone */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Certificate Upload (Proof of Date, Time & Course) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>

            {!certificateFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  background: isDragging ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => document.getElementById('cert-file-input').click()}
              >
                <input
                  id="cert-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={e => handleFileChange(e.target.files[0])}
                />
                <UploadCloud size={32} style={{ color: 'var(--accent-primary)', margin: '0 auto 8px auto' }} />
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Click to upload or drag & drop certificate
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Supports PDF, PNG, JPG, or WEBP (Max 15 MB)
                </div>
              </div>
            ) : (
              <div style={{
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px',
                padding: '14px 16px',
                background: 'rgba(16, 185, 129, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Certificate Preview"
                      style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}
                    />
                  ) : (
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--success)',
                      flexShrink: 0,
                    }}>
                      <FileCheck size={22} />
                    </div>
                  )}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {certificateFile.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {(certificateFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for submission
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setCertificateFile(null); setFilePreview(null) }}
                  className="btn btn-ghost btn-xs"
                  style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} /> Remove
                </button>
              </div>
            )}
          </div>

          {/* Description / Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Summary & Outcomes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of event contents, key takeaways, or special OD notes..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !certificateFile || !courseName.trim()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {submitting ? (
                <>
                  <div className="spinner spinner-sm" /> Submitting Request…
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Submit for Admin Review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
