import React, { useState } from 'react'
import { attendanceAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  X, ExternalLink, Download, CheckCircle2, XCircle, AlertTriangle,
  FileText, Calendar, Clock, Award, Building, User, Sparkles, ShieldCheck
} from 'lucide-react'

export default function CertificateViewerModal({
  isOpen,
  onClose,
  requestItem,
  isAdmin = false,
  onApproved,
  onRejected,
}) {
  const [adminRemarks, setAdminRemarks] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  if (!isOpen || !requestItem) return null

  const proofUrl = attendanceAPI.getProofUrl(requestItem.certificate_filename)
  const isPdf = requestItem.certificate_filename?.toLowerCase().endsWith('.pdf') ||
                requestItem.certificate_file_type === 'application/pdf'

  const handleApprove = async () => {
    setActionLoading(true)
    const toastId = toast.loading('Approving request, granting attendance, and updating faculty certifications…')
    try {
      const res = await attendanceAPI.approveEventRequest(requestItem.id, {
        admin_remarks: adminRemarks.trim() || 'Approved by administrator',
      })
      toast.success(res.data?.message || 'Event attendance approved successfully!', { id: toastId })
      if (onApproved) onApproved(res.data)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to approve request', { id: toastId })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (e) => {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      toast.error('Please specify a reason for rejection')
      return
    }
    setActionLoading(true)
    const toastId = toast.loading('Rejecting event attendance request…')
    try {
      const res = await attendanceAPI.rejectEventRequest(requestItem.id, {
        rejection_reason: rejectionReason.trim(),
      })
      toast.success('Request rejected.', { id: toastId })
      if (onRejected) onRejected(res.data)
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.error || 'Failed to reject request', { id: toastId })
    } finally {
      setActionLoading(false)
      setRejecting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 15, 29, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '960px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: requestItem.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                               requestItem.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' :
                               'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: requestItem.status === 'approved' ? 'var(--success)' :
                     requestItem.status === 'rejected' ? 'var(--danger)' :
                     'var(--warning)',
            }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {requestItem.course_name}
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  background: requestItem.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                              requestItem.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' :
                              'rgba(245, 158, 11, 0.15)',
                  color: requestItem.status === 'approved' ? 'var(--success)' :
                         requestItem.status === 'rejected' ? 'var(--danger)' :
                         'var(--warning)',
                  border: `1px solid ${requestItem.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' :
                                      requestItem.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' :
                                      'rgba(245, 158, 11, 0.3)'}`,
                }}>
                  {requestItem.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Submitted by {requestItem.faculty_name} ({requestItem.faculty_id}) • {requestItem.event_date_display || requestItem.event_date}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <ExternalLink size={14} /> Open in New Tab
            </a>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-icon"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area: Split View (Metadata Sidebar + Certificate Preview) */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left / Top Info Panel */}
          <div style={{
            width: '320px',
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-canvas)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
          }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '8px' }}>
                Event Details
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <User size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span><strong>Faculty:</strong> {requestItem.faculty_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <Calendar size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span><strong>Date:</strong> {requestItem.event_date_display || requestItem.event_date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <Clock size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span><strong>Duration:</strong> {requestItem.time_window || 'Full Day'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  <Award size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span><strong>Category:</strong> {requestItem.event_type}</span>
                </div>
                {requestItem.organizer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    <Building size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span><strong>Organizer:</strong> {requestItem.organizer}</span>
                  </div>
                )}
              </div>
            </div>

            {requestItem.description && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Teacher Remarks
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {requestItem.description}
                </p>
              </div>
            )}

            {/* Status Information */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '6px' }}>
                Review Status
              </div>
              {requestItem.status === 'approved' ? (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: '12px',
                  color: 'var(--success)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                    <CheckCircle2 size={15} /> Approved & Granted
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                    Daily Attendance: <strong>PRESENT</strong>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                    Certifications: <strong>Added to Profile</strong>
                  </div>
                  {requestItem.admin_remarks && (
                    <div style={{ marginTop: '6px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                      "{requestItem.admin_remarks}"
                    </div>
                  )}
                </div>
              ) : requestItem.status === 'rejected' ? (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '12px',
                  color: 'var(--danger)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                    <XCircle size={15} /> Rejected
                  </div>
                  {requestItem.admin_remarks && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                      Reason: "{requestItem.admin_remarks}"
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '12px',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <Clock size={15} /> Pending Administrator Review
                </div>
              )}
            </div>

            {/* Admin Action Box (Only visible to admin when pending) */}
            {isAdmin && requestItem.status === 'pending' && (
              <div style={{
                marginTop: 'auto',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                }}>
                  <Sparkles size={13} style={{ color: 'var(--accent-primary)', marginRight: '4px', verticalAlign: 'middle' }} />
                  Approving will automatically mark attendance as <strong>PRESENT</strong> and add this credential to {requestItem.faculty_name}'s official profile.
                </div>

                {!rejecting ? (
                  <>
                    <input
                      type="text"
                      placeholder="Admin remarks / verification note..."
                      value={adminRemarks}
                      onChange={e => setAdminRemarks(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                    />

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setRejecting(true)}
                        disabled={actionLoading}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)', flex: 1 }}
                      >
                        Reject…
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={actionLoading}
                        className="btn btn-primary btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          borderColor: '#059669',
                          flex: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle2 size={14} /> Approve & Grant
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleReject} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      rows={2}
                      required
                      placeholder="Specify rejection reason (e.g. invalid date/hours)..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setRejecting(false)}
                        className="btn btn-ghost btn-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading || !rejectionReason.trim()}
                        className="btn btn-danger btn-xs"
                        style={{ flex: 1 }}
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Right / Main Preview Viewport */}
          <div style={{
            flex: 1,
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {isPdf ? (
              <iframe
                src={proofUrl}
                title="Certificate PDF Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                overflow: 'auto',
              }}>
                <img
                  src={proofUrl}
                  alt="Certificate Proof"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
