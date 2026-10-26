import React, { useState } from 'react'
import { ExternalLink, Copy, Check, Terminal, Layers, ShieldCheck, Zap, Database, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'

const MICROSERVICES = [
  {
    name: 'Auth Service',
    port: 8001,
    tag: 'Port 8001 · PostgreSQL',
    color: '#ef4444',
    desc: 'JWT issuance, bcrypt hashing, profile validation, and RBAC.',
    endpoints: ['POST /auth/login', 'POST /auth/register', 'GET /auth/me', 'GET /auth/users'],
  },
  {
    name: 'Academic Data Service',
    port: 8002,
    tag: 'Port 8002 · PostgreSQL',
    color: '#6366f1',
    desc: 'Core operational system: students, faculty, classes, marks, timetable, attendance, events.',
    endpoints: ['GET /students', 'GET /classes', 'POST /attendance/punch', 'GET /events'],
  },
  {
    name: 'Parent Contact Service',
    port: 8003,
    tag: 'Port 8003 · PostgreSQL + Twilio',
    color: '#06b6d4',
    desc: 'DPDP Act 2023 compliant masked parent records, Twilio proxy calls, and audit trail.',
    endpoints: ['GET /parents/:id', 'POST /contact/call', 'POST /contact/sms', 'GET /contact/log'],
  },
  {
    name: 'Document Service',
    port: 8004,
    tag: 'Port 8004 · MongoDB + Celery',
    color: '#f59e0b',
    desc: 'File ingestion, PyMuPDF + PaddleOCR extraction, sliding-window chunking.',
    endpoints: ['POST /documents/upload', 'GET /documents/job/:id', 'GET /documents'],
  },
  {
    name: 'NLP / RAG Service',
    port: 8005,
    tag: 'Port 8005 · Qdrant + Groq/Llama',
    color: '#8b5cf6',
    desc: 'BGE-M3 dense embeddings, Qdrant vector retrieval, Llama 3.1 8B generation.',
    endpoints: ['POST /rag/query', 'POST /rag/summarize', 'GET /rag/stats'],
  },
  {
    name: 'Prediction Service',
    port: 8006,
    tag: 'Port 8006 · scikit-learn + XGBoost',
    color: '#ec4899',
    desc: 'Pass/fail risk classifier, TreeExplainer SHAP contributions, cohort screening.',
    endpoints: ['POST /predict/student', 'GET /predict/atrisk', 'POST /predict/run-batch'],
  },
  {
    name: 'Report Generation Service',
    port: 8007,
    tag: 'Port 8007 · python-docx + ReportLab',
    color: '#10b981',
    desc: 'Criterion 4 & 5 SAR compilation, deterministic PDF and DOCX document generation.',
    endpoints: ['GET /criteria', 'POST /reports/nba/generate', 'GET /reports/:id/download'],
  },
  {
    name: 'API Gateway',
    port: 8000,
    tag: 'Port 8000 · Reverse Proxy',
    color: '#3b82f6',
    desc: 'Central entrypoint: JWT verification, role enforcement, reverse proxying, and Swagger UI.',
    endpoints: ['GET /docs', 'GET /openapi.json', 'GET /health', 'ALL /api/v1/*'],
  },
]

export default function ApiDocsPage() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState('embedded') // 'embedded' | 'cards'

  // Gateway URL (in production this resolves to the gateway port)
  const gatewayUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}:8000`

  const swaggerUrl = `${gatewayUrl}/docs`
  const openApiJsonUrl = `${gatewayUrl}/openapi.json`

  const handleCopyToken = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token')
    if (!token) {
      toast.error('No active session token found in storage')
      return
    }
    navigator.clipboard.writeText(token)
    setCopied(true)
    toast.success('Active JWT token copied! Paste into Swagger Authorize modal.')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      <PageHeader
        title="API Reference & Swagger Documentation"
        subtitle="Interactive OpenAPI 3.0 testbed and specifications across all 8 AcademiQ microservices"
        badge="OpenAPI 3.0"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyToken}
              title="Copy your active JWT Bearer token to paste in Swagger UI"
            >
              {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
              <span>{copied ? 'Copied Token!' : 'Copy Active JWT Token'}</span>
            </button>

            <a
              href={openApiJsonUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              <FileText size={16} />
              <span>OpenAPI JSON</span>
            </a>

            <a
              href={swaggerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <ExternalLink size={16} />
              <span>Open Fullscreen Swagger</span>
            </a>
          </div>
        }
      />

      {/* Quick Info Banner */}
      <div className="card" style={{
        padding: '16px 20px',
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(124, 58, 237, 0.04) 100%)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff', flexShrink: 0
            }}>
              <Terminal size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                API Gateway Reverse Proxy Route: <code style={{ color: 'var(--primary)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>/api/v1/*</code>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Swagger UI allows direct interactive calls to live microservices. Active role: <strong>{user?.role?.toUpperCase() || 'ANONYMOUS'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'embedded' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('embedded')}
            >
              Live Swagger UI
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('cards')}
            >
              Services Architecture Map
            </button>
          </div>
        </div>
      </div>

      {/* View Mode 1: Live Embedded Swagger UI */}
      {viewMode === 'embedded' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              <span>Connected to API Gateway: <strong>{swaggerUrl}</strong></span>
            </div>
            <a href={swaggerUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Open in new tab <ExternalLink size={12} />
            </a>
          </div>

          <iframe
            src={swaggerUrl}
            title="AcademiQ Swagger UI"
            style={{
              width: '100%',
              height: '820px',
              border: 'none',
              display: 'block',
              background: '#090d16',
            }}
          />
        </div>
      )}

      {/* View Mode 2: Microservices Architecture Cards */}
      {viewMode === 'cards' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}>
            {MICROSERVICES.map(svc => (
              <div key={svc.name} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    {svc.name}
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 12,
                    background: `${svc.color}15`,
                    color: svc.color,
                    border: `1px solid ${svc.color}35`,
                    letterSpacing: '0.04em'
                  }}>
                    {svc.tag}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 14, flex: 1 }}>
                  {svc.desc}
                </p>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Key Endpoints:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {svc.endpoints.map(ep => (
                      <code key={ep} style={{
                        fontSize: '11px',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        padding: '3px 6px',
                        borderRadius: 4,
                        fontFamily: 'monospace'
                      }}>
                        {ep}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Role Access Matrix */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
              Gateway Network Boundary Role Matrix
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Service Domain</th>
                    <th>Path Prefix</th>
                    <th>Admin</th>
                    <th>Teacher</th>
                    <th>Student</th>
                    <th>Worker</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Authentication</strong></td>
                    <td><code>/auth/*</code></td>
                    <td><span className="badge badge-success">Full</span></td>
                    <td><span className="badge badge-success">Profile</span></td>
                    <td><span className="badge badge-success">Profile</span></td>
                    <td><span className="badge badge-success">Profile</span></td>
                  </tr>
                  <tr>
                    <td><strong>Academic Data</strong></td>
                    <td><code>/students, /classes, /timetable</code></td>
                    <td><span className="badge badge-success">Full CRUD</span></td>
                    <td><span className="badge badge-success">Full Teaching</span></td>
                    <td><span className="badge badge-info">Own Record (RO)</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                  </tr>
                  <tr>
                    <td><strong>Documents & OCR</strong></td>
                    <td><code>/documents/*</code></td>
                    <td><span className="badge badge-success">Full</span></td>
                    <td><span className="badge badge-success">Full</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                    <td><span className="badge badge-success">Upload & Poll</span></td>
                  </tr>
                  <tr>
                    <td><strong>NLP / RAG Chat</strong></td>
                    <td><code>/rag/*, /embed</code></td>
                    <td><span className="badge badge-success">Full</span></td>
                    <td><span className="badge badge-success">Query</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                  </tr>
                  <tr>
                    <td><strong>ML Predictions</strong></td>
                    <td><code>/predict/*</code></td>
                    <td><span className="badge badge-success">Train & Batch</span></td>
                    <td><span className="badge badge-success">Cohort Screen</span></td>
                    <td><span className="badge badge-info">Own Score</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                  </tr>
                  <tr>
                    <td><strong>NBA SAR Reports</strong></td>
                    <td><code>/criteria, /reports/*</code></td>
                    <td><span className="badge badge-success">Generate & Download</span></td>
                    <td><span className="badge badge-success">Generate & Download</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                    <td><span className="badge badge-info">Criteria Tree</span></td>
                  </tr>
                  <tr>
                    <td><strong>Parent Contact</strong></td>
                    <td><code>/parents/*, /contact/*</code></td>
                    <td><span className="badge badge-success">Unmasked + Logs</span></td>
                    <td><span className="badge badge-warning">Masked Proxy Call</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                    <td><span className="badge badge-danger">403 Blocked</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
