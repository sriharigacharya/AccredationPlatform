import React, { useEffect, useState } from 'react'
import { contactAPI, parentsAPI } from '../api/client'
import { Phone, MessageSquare, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContactPage() {
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState('')
  const [parent, setParent] = useState(null)
  const [message, setMessage] = useState('')

  const fetchLogs = () => {
    contactAPI.log().then(r => { setLogs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }

  const lookupParent = async () => {
    if (!studentId.trim()) return
    try {
      const { data } = await parentsAPI.get(studentId.trim())
      setParent(data)
    } catch {
      toast.error('No parent record found for this student ID')
      setParent(null)
    }
  }

  const doCall = async () => {
    if (!parent) return
    try {
      const { data } = await contactAPI.call(studentId)
      toast.success(data.status === 'mock' ? `📞 Mock: ${data.message}` : 'Call initiated!')
      fetchLogs()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  const doSms = async () => {
    if (!parent || !message.trim()) return
    try {
      const { data } = await contactAPI.sms(studentId, message)
      toast.success(data.status === 'mock' ? `📱 Mock SMS sent` : 'SMS sent!')
      setMessage('')
      fetchLogs()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
  }

  useEffect(() => { fetchLogs() }, [])

  const statusColor = { success: 'badge-success', failed: 'badge-danger', mock: 'badge-warning', consent_denied: 'badge-danger' }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h1 className="page-title">📞 Parent Contact</h1>
        <p className="page-desc">Initiate calls or SMS to student parents. Consent is checked automatically.</p>
      </div>

      <div className="page-body">
        <div className="grid-2 mb-lg">
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 'var(--space-md)' }}>Contact a Parent</div>

            <div className="form-group">
              <label className="form-label">Student ID</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" value={studentId} onChange={e => setStudentId(e.target.value)}
                  placeholder="e.g. STU001" />
                <button className="btn btn-secondary" onClick={lookupParent}>Lookup</button>
              </div>
            </div>

            {parent && (
              <div style={{ background: 'var(--bg-800)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{parent.parent_name}</div>
                <div className="text-muted text-sm">{parent.relationship} · {parent.primary_mobile}</div>
                <div className="mt-sm">
                  <span className={`badge ${parent.consent_to_contact ? 'badge-success' : 'badge-danger'}`}>
                    {parent.consent_to_contact ? '✓ Consent given' : '✗ No consent'}
                  </span>
                </div>

                {!parent.consent_to_contact && (
                  <div className="alert alert-warning mt-sm" style={{ fontSize: 12 }}>
                    Contact blocked by consent flag.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-success btn-sm" onClick={doCall} disabled={!parent.consent_to_contact}>
                    <Phone size={14} /> Call
                  </button>
                </div>

                <div className="form-group mt-md">
                  <label className="form-label">Send SMS</label>
                  <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Type message…" style={{ minHeight: 80 }} disabled={!parent.consent_to_contact} />
                  <button className="btn btn-primary btn-sm mt-sm" onClick={doSms} disabled={!parent.consent_to_contact || !message.trim()}>
                    <MessageSquare size={14} /> Send SMS
                  </button>
                </div>
              </div>
            )}

            <div className="alert alert-info" style={{ fontSize: 12 }}>
              🔒 Privacy: Phone numbers are masked. Twilio proxy hides caller identity.
              Set TWILIO_ENABLED=true in .env for real calls.
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 'var(--space-md)' }}>
              <Clock size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Contact History
            </div>
            {loading ? <div className="spinner" style={{ margin: '0 auto' }} /> :
              logs.length === 0 ? <div className="text-muted text-sm" style={{ textAlign: 'center', padding: 20 }}>No contact logs yet</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {logs.map(log => (
                    <div key={log.id} style={{ background: 'var(--bg-800)', borderRadius: 'var(--radius-md)', padding: 'var(--space-sm) var(--space-md)', fontSize: 13 }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span style={{ fontWeight: 600 }}>{log.student_id}</span>
                          <span className="text-muted"> · {log.contact_method}</span>
                        </div>
                        <span className={`badge ${statusColor[log.status] || 'badge-neutral'}`}>{log.status}</span>
                      </div>
                      {log.message && <div className="text-muted text-xs mt-sm" style={{ fontStyle: 'italic' }}>"{log.message}"</div>}
                      <div className="text-xs text-muted mt-sm">{new Date(log.created_at).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}
