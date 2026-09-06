import React, { useEffect, useState } from 'react'
import { contactAPI, parentsAPI } from '../api/client'
import {
  Phone, MessageSquare, Clock, ShieldCheck, Lock,
  CheckCircle2, XCircle, AlertTriangle, Search, RefreshCw,
  Edit3, PhoneCall, PhoneOff, UserPlus
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

export default function ContactPage() {
  const [logs, setLogs]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [studentId, setStudentId]   = useState('STU001')
  const [hasSearched, setHasSearched] = useState(true)
  const [parent, setParent]         = useState(null)
  const [message, setMessage]       = useState('')
  const [calling, setCalling]       = useState(false)
  const [sendingSms, setSendingSms] = useState(false)

  // Parent Edit / Add state
  const [showEditParent, setShowEditParent] = useState(false)
  const [parentForm, setParentForm] = useState({
    parent_name: '',
    relationship: 'Father',
    primary_mobile: '',
    alternate_mobile: '',
    consent_to_contact: true,
  })
  const [savingParent, setSavingParent] = useState(false)

  // Active call modal state
  const [activeCall, setActiveCall] = useState(null)
  const [callDuration, setCallDuration] = useState(0)

  useEffect(() => {
    let timer
    if (activeCall) {
      timer = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [activeCall])

  const fetchLogs = () => {
    contactAPI.log()
      .then(r => { setLogs(r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const lookupParent = async (idToSearch) => {
    const sId = (idToSearch || studentId).trim().toUpperCase()
    if (!sId) return
    setHasSearched(true)
    try {
      const { data } = await parentsAPI.get(sId)
      setParent(data)
    } catch {
      toast.error(`No parent record found for ${sId}`)
      setParent(null)
    }
  }

  useEffect(() => {
    fetchLogs()
    lookupParent('STU001')
  }, [])

  const handleOpenEditParent = () => {
    setParentForm({
      parent_name: parent?.parent_name || '',
      relationship: parent?.relationship || 'Father',
      primary_mobile: parent?.primary_mobile || '',
      alternate_mobile: parent?.alternate_mobile || '',
      consent_to_contact: parent?.consent_to_contact ?? true,
    })
    setShowEditParent(true)
  }

  const handleSaveParent = async (e) => {
    if (e) e.preventDefault()
    if (!parentForm.parent_name.trim() || !parentForm.primary_mobile.trim()) {
      toast.error('Parent name and primary mobile number are required')
      return
    }
    setSavingParent(true)
    try {
      const idToSave = studentId.trim().toUpperCase()
      const { data } = await parentsAPI.upsert({
        student_id: idToSave,
        ...parentForm,
      })
      setParent(data)
      toast.success('Parent contact details saved successfully!')
      setShowEditParent(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update parent contact')
    } finally {
      setSavingParent(false)
    }
  }

  const doCall = async () => {
    if (!parent) return
    if (!parent.consent_to_contact) {
      toast.error('Parent contact consent has not been provided')
      return
    }
    setCalling(true)
    try {
      const { data } = await contactAPI.call(studentId.trim().toUpperCase())
      setActiveCall({
        studentId: studentId.trim().toUpperCase(),
        parentName: parent.parent_name,
        relationship: parent.relationship,
        phone: parent.primary_mobile,
        status: data.status === 'mock' ? 'connected' : 'ringing',
        message: data.message || '',
      })
      setCallDuration(0)
      toast.success(data.status === 'mock' ? `Demo proxy call initiated to ${parent.parent_name}` : 'Call initiated!')
      fetchLogs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Call failed')
    } finally {
      setCalling(false)
    }
  }

  const doSms = async () => {
    if (!parent || !message.trim()) return
    setSendingSms(true)
    try {
      const { data } = await contactAPI.sms(studentId.trim().toUpperCase(), message)
      toast.success(data.status === 'mock' ? 'Mock SMS dispatched' : 'SMS alert sent!')
      setMessage('')
      fetchLogs()
    } catch (err) {
      toast.error(err.response?.data?.error || 'SMS failed')
    } finally {
      setSendingSms(false)
    }
  }

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title="Parent & Guardian Communication Console"
        description="Digital Personal Data Protection (DPDP) Act 2023 compliant encrypted proxy calling and academic alert messaging."
        badge="DPDP 2023 Compliant"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            <RefreshCw size={14} />
            <span>Refresh Logs</span>
          </button>
        }
      />

      <div className="page-body">
        {/* ── Summary Stats ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label="Total Contact Logs"
            value={logs.length}
            subtext="Voice calls & SMS alerts"
            icon={Clock}
            variant="primary"
          />
          <StatCard
            label="Privacy Bridge"
            value="Encrypted Proxy"
            subtext="Personal numbers masked"
            icon={Lock}
            variant="default"
          />
          <StatCard
            label="Consent Protocol"
            value="Active Verification"
            subtext="Guardian authorization checked"
            icon={ShieldCheck}
            variant="success"
          />
          <StatCard
            label="Carrier Telephony"
            value="Twilio Bridge"
            subtext="Mock / Live automated toggle"
            icon={Phone}
            variant="info"
          />
        </div>

        {/* ── Main Workstation ── */}
        <div className="grid-2">
          {/* Contact Dispatch Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Initiate Guardian Contact</h3>
              <Badge variant="primary">Proxy Communication</Badge>
            </div>

            <div className="form-group">
              <label className="form-label">Student Roll Number (USN)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                  placeholder="e.g. STU001 or 1MS23CS001"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookupParent(); } }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={lookupParent}
                >
                  <Search size={14} />
                  <span>Lookup</span>
                </button>
              </div>
            </div>

            {parent ? (
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {parent.parent_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {parent.relationship} · Masked: <span style={{ fontFamily: 'var(--font-mono)' }}>{parent.primary_mobile || '*****9876'}</span>
                    </div>
                  </div>

                  {parent.consent_to_contact ? (
                    <Badge variant="success" icon={CheckCircle2}>Consent Verified</Badge>
                  ) : (
                    <Badge variant="danger" icon={XCircle}>Consent Denied</Badge>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
                  {parent.consent_to_contact && (
                    <button
                      type="button"
                      onClick={doCall}
                      disabled={calling}
                      className="btn btn-primary btn-sm"
                    >
                      <Phone size={13} />
                      <span>{calling ? 'Connecting…' : 'Initiate Proxy Call'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenEditParent}
                    className="btn btn-secondary btn-sm"
                  >
                    <Edit3 size={13} />
                    <span>Edit Parent Details</span>
                  </button>
                </div>

                {!parent.consent_to_contact ? (
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: 'var(--danger-subtle)',
                    border: '1px solid var(--danger-border)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '12px',
                    color: 'var(--danger)',
                    marginTop: 6,
                  }}>
                    Contact prohibited: Guardian has opted out of automated communication pursuant to DPDP Act 2023. Click "Edit Parent Details" to update consent or number.
                  </div>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Send Official SMS Alert</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="State attendance deficit or academic progress concern…"
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={doSms}
                          disabled={sendingSms || !message.trim()}
                          className="btn btn-primary btn-sm"
                        >
                          <MessageSquare size={13} />
                          <span>{sendingSms ? 'Dispatching…' : 'Send SMS Alert'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : hasSearched && studentId.trim() ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12.5px',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
              }}>
                <div style={{ marginBottom: 12 }}>
                  No parent record currently registered for student <strong style={{ color: 'var(--text-primary)' }}>{studentId}</strong>.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenEditParent}
                >
                  <UserPlus size={14} />
                  <span>Add Parent Contact</span>
                </button>
              </div>
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12.5px',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
              }}>
                Enter a student roll number above to lookup verified parent guardian records (e.g. STU001).
              </div>
            )}

            <div style={{
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              padding: '10px 12px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}>
              <strong>Privacy Protocol:</strong> Personal phone numbers remain strictly masked. Voice calls and SMS dispatches are routed through an institutional proxy server.
            </div>
          </div>

          {/* Contact History Log */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Dispatched Communication History</h3>
              <Badge variant="neutral">{logs.length} Logs</Badge>
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <div className="spinner" />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No Contact Logs"
                description="No guardian calls or SMS alerts have been logged in this session."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                {logs.map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {log.student_id}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>· {log.contact_method}</span>
                      </div>
                      <Badge variant={log.status === 'success' ? 'success' : log.status === 'failed' ? 'danger' : 'warning'}>
                        {log.status}
                      </Badge>
                    </div>

                    {log.message && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '4px 0' }}>
                        "{log.message}"
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : 'Recent'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Edit / Register Parent Details Modal ── */}
        <Modal
          isOpen={showEditParent}
          onClose={() => setShowEditParent(false)}
          title={parent ? `Edit Parent Contact — ${studentId}` : `Register Parent Contact — ${studentId}`}
          maxWidth={480}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowEditParent(false)}
                disabled={savingParent}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveParent}
                disabled={savingParent}
              >
                {savingParent ? 'Saving…' : 'Save Details'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveParent}>
            <div className="form-group">
              <label className="form-label">Parent / Guardian Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={parentForm.parent_name}
                onChange={e => setParentForm(f => ({ ...f, parent_name: e.target.value }))}
                placeholder="e.g., Rajesh Sharma"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Relationship *</label>
              <select
                className="form-select"
                value={parentForm.relationship}
                onChange={e => setParentForm(f => ({ ...f, relationship: e.target.value }))}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Mobile Number (for Voice Calls/SMS) *</label>
              <input
                type="tel"
                className="form-input"
                value={parentForm.primary_mobile}
                onChange={e => setParentForm(f => ({ ...f, primary_mobile: e.target.value }))}
                placeholder="e.g., 9876543210 (10 digits)"
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Used for proxy calling and institutional SMS alerts during demos.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Alternate Mobile Number (Optional)</label>
              <input
                type="tel"
                className="form-input"
                value={parentForm.alternate_mobile || ''}
                onChange={e => setParentForm(f => ({ ...f, alternate_mobile: e.target.value }))}
                placeholder="e.g., 9123456780"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={parentForm.consent_to_contact}
                  onChange={e => setParentForm(f => ({ ...f, consent_to_contact: e.target.checked }))}
                />
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  DPDP Act 2023 Explicit Consent Granted for Official Institutional Communications
                </span>
              </label>
            </div>
          </form>
        </Modal>

        {/* ── Active Call Demo Modal ── */}
        {activeCall && (
          <Modal
            isOpen={true}
            onClose={() => setActiveCall(null)}
            title="Encrypted Voice Call — DPDP Act Compliant Proxy"
            maxWidth={460}
          >
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                border: '2px solid var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <PhoneCall size={32} color="var(--primary)" />
              </div>

              <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                {activeCall.parentName} ({activeCall.relationship})
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 14 }}>
                Student Roll: {activeCall.studentId} · Target: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{activeCall.phone}</span>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: '16px',
                backgroundColor: '#ecfdf5', color: '#065f46',
                fontSize: '13px', fontWeight: 600, marginBottom: 16
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
                Call Connected · {Math.floor(callDuration / 60).toString().padStart(2, '0')}:{(callDuration % 60).toString().padStart(2, '0')}
              </div>

              <div style={{
                backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'left',
                fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 20
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                  🛡️ DPDP Privacy-Preserving Proxy Active
                </div>
                <div>
                  Virtual telecom bridge active. Faculty personal phone number and parent phone numbers remain masked under DPDP Act 2023 regulations.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ padding: '8px 24px', borderRadius: '20px' }}
                onClick={() => {
                  setActiveCall(null)
                  toast.success('Call ended')
                }}
              >
                <PhoneOff size={14} /> End Call
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
