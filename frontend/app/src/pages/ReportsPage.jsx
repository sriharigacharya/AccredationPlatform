/**
 * ReportsPage.jsx
 * NBA SAR & Ad-hoc AI Report generation interface.
 * Features: tab between NBA/AI modes, history table, real-time status polling,
 * download PDF/DOCX with blob streaming.
 */

import React, { useState, useEffect, useRef } from 'react'
import { reportsAPI, departmentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  FileText, Cpu, Clock, Download, RefreshCw,
  ChevronRight, AlertTriangle, CheckCircle, Loader,
  ClipboardList, Sparkles
} from 'lucide-react'

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    done:    { color: 'var(--success)',   icon: CheckCircle, label: 'Done' },
    pending: { color: 'var(--warning)',   icon: Loader,      label: 'Processing' },
    error:   { color: 'var(--danger)',    icon: AlertTriangle, label: 'Error' },
  }
  const cfg = map[status] || map.pending
  const Icon = cfg.icon
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                   color: cfg.color, fontSize: 12, fontWeight: 600 }}>
      <Icon size={12} style={status === 'pending' ? { animation: 'spin 1s linear infinite' } : {}} />
      {cfg.label}
    </span>
  )
}

// ── NBA generate form ─────────────────────────────────────────────────────────

function NbaForm({ departments, onSubmitted }) {
  const [form, setForm] = useState({
    sar_format: 'ug_tier_ii_gapc_v4',
    department_id: '',
    academic_year: '2025-26',
    scope: 'full',
    format: 'pdf',
    expand_narratives: false,
  })
  const [loading, setLoading] = useState(false)

  const scopeOptions = [
    { value: 'full',            label: 'Full SAR (all 9 criteria)' },
    { value: 'criterion:4',     label: 'Criterion 4 — Students Performance' },
    { value: 'criterion:5',     label: 'Criterion 5 — Faculty Information' },
    { value: 'criterion:6',     label: 'Criterion 6 — Faculty Contributions' },
    { value: 'criterion:7',     label: 'Criterion 7 — Facilities' },
    { value: 'criterion:9',     label: 'Criterion 9 — Student Support' },
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.department_id) { toast.error('Select a department'); return }
    setLoading(true)
    try {
      const res = await reportsAPI.generateNba(form)
      toast.success(`Report generated! ID: ${res.data.report_id?.slice(0, 8)}…`)
      onSubmitted(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="report-form">
      <div className="form-grid-2">
        <div className="form-group">
          <label className="form-label">SAR Format</label>
          <select className="form-select" value={form.sar_format}
                  onChange={e => setForm(p => ({ ...p, sar_format: e.target.value }))}>
            <option value="ug_tier_ii_gapc_v4">UG Tier-II GAPC V4.0 (Jan 2025)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Department</label>
          <select className="form-select" value={form.department_id}
                  onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}
                  required>
            <option value="">— Select department —</option>
            {departments.map(d => (
              <option key={d.id || d.code} value={d.code || d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Academic Year</label>
          <select className="form-select" value={form.academic_year}
                  onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))}>
            {['2025-26', '2024-25', '2023-24', '2022-23'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Scope</label>
          <select className="form-select" value={form.scope}
                  onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}>
            {scopeOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Output Format</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['pdf', 'docx', 'both'].map(f => (
              <label key={f} className="radio-label">
                <input type="radio" name="format" value={f}
                       checked={form.format === f}
                       onChange={() => setForm(p => ({ ...p, format: f }))} />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.expand_narratives}
                   onChange={e => setForm(p => ({ ...p, expand_narratives: e.target.checked }))} />
            <span>Expand narratives with AI <small style={{ color: 'var(--text-secondary)' }}>(slower)</small></span>
          </label>
        </div>
      </div>

      <button type="submit" className="btn btn-primary" id="btn-generate-nba" disabled={loading}
              style={{ marginTop: 8 }}>
        {loading
          ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
          : <><FileText size={14} /> Generate SAR Report</>}
      </button>
    </form>
  )
}

// ── Ad-hoc AI form ────────────────────────────────────────────────────────────

function AdhocForm({ onSubmitted }) {
  const [query, setQuery]   = useState('')
  const [format, setFormat] = useState('pdf')
  const [loading, setLoading] = useState(false)

  const examples = [
    'Generate a detailed performance report for student STU001',
    'Summarise faculty qualification and research output for the department',
    'Create an at-risk students report with retention recommendations',
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) { toast.error('Enter a report request'); return }
    setLoading(true)
    try {
      const res = await reportsAPI.adhoc(query, format)
      toast.success('AI report ready!')
      onSubmitted(res.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI report failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="report-form">
      <div className="adhoc-examples">
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Examples:</span>
        {examples.map((ex, i) => (
          <button key={i} type="button" className="example-chip"
                  onClick={() => setQuery(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <div className="form-group" style={{ marginTop: 12 }}>
        <label className="form-label">Your report request</label>
        <textarea
          id="adhoc-query-input"
          className="form-textarea"
          rows={4}
          placeholder="Describe the report you need…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Output Format</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pdf', 'docx', 'both'].map(f => (
            <label key={f} className="radio-label">
              <input type="radio" name="adhoc-format" value={f}
                     checked={format === f}
                     onChange={() => setFormat(f)} />
              {f.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      <div className="adhoc-note">
        <Sparkles size={12} />
        AI-generated reports use only real data fetched from the system — no hallucinations.
      </div>

      <button type="submit" className="btn btn-primary" id="btn-generate-adhoc"
              disabled={loading} style={{ marginTop: 8 }}>
        {loading
          ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
          : <><Sparkles size={14} /> Generate AI Report</>}
      </button>
    </form>
  )
}

// ── History table ─────────────────────────────────────────────────────────────

function ReportHistoryTable({ reports, onDownload, onRefresh, loading }) {
  if (loading) return (
    <div className="spinner-area">
      <div className="spinner" />
    </div>
  )

  if (!reports.length) return (
    <div className="empty-state">
      <ClipboardList size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
      <p>No reports generated yet. Use the forms above to create your first report.</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Dept</th>
              <th>Year</th>
              <th>Status</th>
              <th>Created</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.report_id}>
                <td>
                  <code style={{ fontSize: 11 }}>{r.report_id?.slice(0, 8)}…</code>
                </td>
                <td>
                  <span className={`badge ${r.report_type === 'nba' ? 'badge-blue' : 'badge-purple'}`}>
                    {r.report_type?.toUpperCase()}
                  </span>
                </td>
                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.scope}
                </td>
                <td>{r.department_id || '—'}</td>
                <td>{r.academic_year || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  {r.status === 'done' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.has_pdf && (
                        <button className="btn btn-xs" id={`btn-dl-pdf-${r.report_id?.slice(0,8)}`}
                                onClick={() => onDownload(r.report_id, 'pdf')}>
                          <Download size={11} /> PDF
                        </button>
                      )}
                      {r.has_docx && (
                        <button className="btn btn-xs btn-outline" id={`btn-dl-docx-${r.report_id?.slice(0,8)}`}
                                onClick={() => onDownload(r.report_id, 'docx')}>
                          <Download size={11} /> DOCX
                        </button>
                      )}
                    </div>
                  )}
                  {r.status === 'error' && (
                    <span style={{ fontSize: 11, color: 'var(--danger)' }}
                          title={r.error_msg}>Error</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth()
  const [tab, setTab]         = useState('nba')   // 'nba' | 'adhoc'
  const [reports, setReports] = useState([])
  const [departments, setDepts] = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const pollingRef = useRef(null)

  const isStudent = user?.role === 'student'

  // Students only see adhoc
  useEffect(() => {
    if (isStudent) setTab('adhoc')
  }, [isStudent])

  useEffect(() => {
    loadDepartments()
    loadHistory()
    // Poll every 8s while any report is pending
    pollingRef.current = setInterval(() => {
      setReports(prev => {
        if (prev.some(r => r.status === 'pending')) {
          loadHistory()
        }
        return prev
      })
    }, 8000)
    return () => clearInterval(pollingRef.current)
  }, [])

  async function loadDepartments() {
    try {
      const res = await departmentsAPI.list()
      setDepts(res.data || [])
    } catch {}
  }

  async function loadHistory() {
    setHistLoading(true)
    try {
      const res = await reportsAPI.history()
      setReports(res.data || [])
    } catch (err) {
      console.warn('Could not load report history', err)
    } finally {
      setHistLoading(false)
    }
  }

  function handleGenerated(job) {
    setReports(prev => [{ ...job, created_at: new Date().toISOString() }, ...prev])
  }

  async function handleDownload(reportId, fmt) {
    try {
      const res = await reportsAPI.download(reportId, fmt)
      const url  = URL.createObjectURL(new Blob([res.data],
        { type: fmt === 'pdf' ? 'application/pdf' :
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `report_${reportId.slice(0,8)}.${fmt}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed. The file may not be ready yet.')
    }
  }

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ClipboardList size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Reports
          </h1>
          <p className="page-subtitle">Generate NBA SAR documents and AI-powered academic reports</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="reports-tabs">
        {!isStudent && (
          <button
            className={`report-tab ${tab === 'nba' ? 'active' : ''}`}
            id="tab-nba"
            onClick={() => setTab('nba')}
          >
            <FileText size={15} />
            NBA SAR Generator
          </button>
        )}
        <button
          className={`report-tab ${tab === 'adhoc' ? 'active' : ''}`}
          id="tab-adhoc"
          onClick={() => setTab('adhoc')}
        >
          <Cpu size={15} />
          AI Report Builder
        </button>
      </div>

      {/* ── Active form ── */}
      <div className="card reports-card">
        {tab === 'nba' && !isStudent && (
          <>
            <div className="card-header">
              <h3>Generate NBA Self-Assessment Report</h3>
              <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                Pulls live data from academic records and computes NBA GAPC V4.0 formula scores.
                Placeholder sections are clearly marked in the output.
              </p>
            </div>
            <NbaForm departments={departments} onSubmitted={handleGenerated} />
          </>
        )}

        {tab === 'adhoc' && (
          <>
            <div className="card-header">
              <h3>AI Report Builder</h3>
              <p className="text-secondary" style={{ fontSize: 13, marginTop: 4 }}>
                Describe the report you need in plain English. The system fetches real data
                and uses AI to write the narrative — no invented facts.
              </p>
            </div>
            <AdhocForm onSubmitted={handleGenerated} />
          </>
        )}
      </div>

      {/* ── History ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} />
          <h3>Report History</h3>
        </div>
        <ReportHistoryTable
          reports={reports}
          onDownload={handleDownload}
          onRefresh={loadHistory}
          loading={histLoading}
        />
      </div>

      {/* ── Page-local styles ── */}
      <style>{`
        .reports-tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          background: var(--bg-800);
          border-radius: var(--radius-md);
          padding: 4px;
        }
        .report-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          border: none;
          cursor: pointer;
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          transition: all 0.15s;
        }
        .report-tab:hover { color: var(--text-primary); background: var(--bg-700); }
        .report-tab.active { color: var(--text-primary); background: var(--bg-600);
                             box-shadow: 0 1px 3px rgba(0,0,0,0.3); }

        .reports-card { padding: 20px; }
        .card-header { margin-bottom: 16px; }
        .card-header h3 { font-size: 15px; font-weight: 600; }

        .report-form { display: flex; flex-direction: column; gap: 8px; }
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .radio-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 13px; cursor: pointer;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          transition: all 0.15s;
        }
        .radio-label:has(input:checked) {
          border-color: var(--primary);
          background: rgba(99,102,241,0.08);
          color: var(--primary);
        }
        .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }

        .adhoc-examples {
          display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
        }
        .example-chip {
          font-size: 11.5px; padding: 4px 10px;
          border: 1px solid var(--border); border-radius: 20px;
          background: var(--bg-700); color: var(--text-secondary);
          cursor: pointer; transition: all 0.15s;
        }
        .example-chip:hover { border-color: var(--primary); color: var(--primary); }

        .form-textarea {
          width: 100%; padding: 10px 12px;
          background: var(--bg-700); border: 1px solid var(--border);
          border-radius: var(--radius-sm); color: var(--text-primary);
          font-size: 13.5px; line-height: 1.6; resize: vertical;
          font-family: inherit;
        }
        .form-textarea:focus { outline: none; border-color: var(--primary); }

        .adhoc-note {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--text-secondary);
          padding: 8px 12px; border-radius: var(--radius-sm);
          background: var(--bg-700); margin-top: 4px;
        }

        .table-scroll { overflow-x: auto; }

        .badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
        .badge-blue   { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .badge-purple { background: rgba(139,92,246,0.15); color: #a78bfa; }

        .btn-xs {
          font-size: 11px; padding: 3px 8px;
          display: inline-flex; align-items: center; gap: 4px;
        }
        .btn-outline {
          background: transparent; border: 1px solid var(--border);
          color: var(--text-secondary);
        }
        .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

        .spinner-area { display: flex; justify-content: center; padding: 40px; }
        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          padding: 40px; color: var(--text-secondary); text-align: center;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .form-grid-2 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
