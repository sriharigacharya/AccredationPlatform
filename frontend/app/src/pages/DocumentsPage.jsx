import React, { useEffect, useState, useCallback } from 'react'
import { documentsAPI } from '../api/client'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, RefreshCw, CheckCircle, Clock, XCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

const DOC_TYPES = [
  { value: 'SAR', label: 'Self Assessment Report (SAR)' },
  { value: 'guideline', label: 'NBA Guideline' },
  { value: 'course_file', label: 'Course File' },
  { value: 'FDP', label: 'FDP / Workshop Report' },
  { value: 'research', label: 'Research Report' },
  { value: 'placement', label: 'Placement Report' },
  { value: 'committee', label: 'Committee Report' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'meeting_minutes', label: 'Meeting Minutes' },
  { value: 'other', label: 'Other (auto-detect)' },
]

function StatusBadge({ status }) {
  const map = {
    queued:     { label: 'Queued',     cls: 'badge-neutral', icon: <Clock size={10} /> },
    processing: { label: 'Processing', cls: 'badge-warning', icon: <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> },
    done:       { label: 'Processed',  cls: 'badge-success', icon: <CheckCircle size={10} /> },
    failed:     { label: 'Failed',     cls: 'badge-danger',  icon: <XCircle size={10} /> },
  }
  const { label, cls, icon } = map[status] || map.queued
  return <span className={`badge ${cls}`}>{icon} {label}</span>
}

export default function DocumentsPage() {
  const [docs, setDocs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType]   = useState('other')
  const [desc, setDesc]         = useState('')
  const [pendingJobs, setPendingJobs] = useState({})

  const fetchDocs = () => {
    documentsAPI.list().then(r => { setDocs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [])

  // Poll pending jobs
  useEffect(() => {
    if (Object.keys(pendingJobs).length === 0) return
    const timer = setInterval(async () => {
      for (const [jobId, docId] of Object.entries(pendingJobs)) {
        try {
          const { data } = await documentsAPI.jobStatus(jobId)
          if (data.status === 'done' || data.status === 'failed') {
            setPendingJobs(prev => { const n = { ...prev }; delete n[jobId]; return n })
            if (data.status === 'done') {
              toast.success('Document processed and indexed!')
              fetchDocs()
            } else {
              toast.error('Document processing failed.')
            }
          }
        } catch (_) {}
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [pendingJobs])

  const onDrop = useCallback(async acceptedFiles => {
    if (!acceptedFiles.length) return
    setUploading(true)
    for (const file of acceptedFiles) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_type', docType)
      formData.append('description', desc)
      try {
        const { data } = await documentsAPI.upload(formData)
        toast.success(`"${file.name}" uploaded. Processing started.`)
        setPendingJobs(prev => ({ ...prev, [data.job_id]: data.doc_id }))
        fetchDocs()
      } catch (err) {
        toast.error(`Upload failed: ${err.response?.data?.error || err.message}`)
      }
    }
    setUploading(false)
    setDesc('')
  }, [docType, desc])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'image/*': ['.jpg', '.jpeg', '.png'], 'text/plain': ['.txt'] },
    multiple: true,
  })

  const deleteDoc = async id => {
    if (!confirm('Delete this document from the knowledge base?')) return
    try {
      await documentsAPI.delete(id)
      toast.success('Document deleted')
      fetchDocs()
    } catch (err) {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">📄 Document Intelligence</h1>
            <p className="page-desc">Upload NBA/NAAC documents for AI-powered OCR, classification, and indexing</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchDocs}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="grid-2 mb-lg" style={{ gap: 'var(--space-lg)' }}>
          {/* Upload Card */}
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 'var(--space-md)' }}>Upload Documents</div>

            <div className="form-group">
              <label className="form-label">Document Type</label>
              <select className="form-select" value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="e.g., CSE Dept SAR 2024-25" />
            </div>

            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-icon">
                {uploading ? '⏳' : isDragActive ? '📥' : '📁'}
              </div>
              <div className="dropzone-title">
                {uploading ? 'Uploading…' : isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
              </div>
              <div className="dropzone-sub">PDF, DOCX, JPG, PNG, TXT — up to 50 MB each</div>
              {uploading && <div className="spinner" style={{ margin: '12px auto 0' }} />}
            </div>

            <div className="alert alert-info mt-md" style={{ fontSize: 12 }}>
              ℹ️ Scanned PDFs/images are processed via PaddleOCR. Digital PDFs use PyMuPDF (faster).
              After processing, documents are chunked and embedded into the AI knowledge base automatically.
            </div>
          </div>

          {/* Processing info */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Processing Pipeline</div>
            {[
              { step: '1', title: 'Upload', desc: 'File saved to secure storage', icon: '📤' },
              { step: '2', title: 'OCR / Extract', desc: 'PyMuPDF (digital) or PaddleOCR (scanned)', icon: '🔍' },
              { step: '3', title: 'Classify', desc: 'Auto-detect document type', icon: '🏷️' },
              { step: '4', title: 'Chunk', desc: 'Split into 512-token segments', icon: '✂️' },
              { step: '5', title: 'Embed & Index', desc: 'BGE-M3 embeddings → Qdrant vector DB', icon: '🧠' },
              { step: '6', title: 'Ready for Q&A', desc: 'Available in AI Chat instantly', icon: '✅' },
            ].map(item => (
              <div key={item.step} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</div>
                  <div className="text-muted text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Documents table */}
        <div className="card">
          <div className="flex items-center justify-between mb-md">
            <div style={{ fontWeight: 600, fontSize: 15 }}>Ingested Documents ({docs.length})</div>
            {Object.keys(pendingJobs).length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--amber)' }}>
                <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: 'var(--amber)' }} />
                {Object.keys(pendingJobs).length} job(s) processing…
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>No documents yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Upload your first NBA/NAAC document above</div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Document</th><th>Type</th><th>Status</th><th>Pages</th><th>Chunks</th><th>Uploaded</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d._id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.original_name}</div>
                        {d.description && <div className="text-xs text-muted">{d.description}</div>}
                      </td>
                      <td><span className="badge badge-info">{d.doc_type}</span></td>
                      <td><StatusBadge status={d.status} /></td>
                      <td>{d.pages ?? '—'}</td>
                      <td>{d.chunks ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteDoc(d._id)}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
