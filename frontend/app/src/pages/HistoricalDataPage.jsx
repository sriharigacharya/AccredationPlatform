import React, { useState, useEffect } from 'react'
import {
  Upload, Download, FileText, CheckCircle2, XCircle, AlertTriangle, Plus,
  Edit3, Trash2, Filter, Clock, Shield, FileSpreadsheet, Layers,
  TrendingUp, GraduationCap, Users, RefreshCw, Eye, Check, X
} from 'lucide-react'
import { historicalAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

export default function HistoricalDataPage() {
  const { user }         = useAuth()
  const role             = (user?.role || 'worker').toLowerCase()
  const isAdmin          = role === 'admin'
  const isWorker         = role === 'worker'
  const isReadOnly       = role === 'teacher' || role === 'faculty'

  const [activeTab, setActiveTab] = useState('admission')
  const [loading, setLoading]     = useState(false)

  // Data states
  const [admissionRecords, setAdmissionRecords] = useState([])
  const [batchSummary, setBatchSummary]         = useState([])
  const [batchRecords, setBatchRecords]         = useState([])
  const [academicRecords, setAcademicRecords]   = useState([])
  const [pendingCount, setPendingCount]         = useState(0)

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [activeItem, setActiveItem]           = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Upload modal state
  const [uploadErrors, setUploadErrors]       = useState(null)
  const [uploading, setUploading]             = useState(false)
  const [selectedFile, setSelectedFile]       = useState(null)

  // Form states
  const [admissionForm, setAdmissionForm] = useState({
    academic_year: '2025-26',
    department: 'CSE',
    sanctioned_intake: 180,
    first_year_admitted_net_migration: 175,
    lateral_entry_admitted: 18,
    separate_division_admitted: 0,
  })

  const [batchForm, setBatchForm] = useState({
    year_of_entry: '2022-23',
    department: 'CSE',
    total_admitted: 190,
    year_of_study: 'I',
    students_without_backlog: 165,
    students_total_passed: 185,
  })

  const [academicForm, setAcademicForm] = useState({
    academic_year: '2024-25',
    department: 'CSE',
    year_of_study: 'II',
    mean_cgpa_or_percentage: 7.85,
    successful_students_count: 180,
    appeared_students_count: 185,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [admRes, batSumRes, batProgRes, acadRes] = await Promise.all([
        historicalAPI.admission.list(),
        historicalAPI.batchProgress.summary({ department: 'CSE' }),
        historicalAPI.batchProgress.list(),
        historicalAPI.academicPerformance.list(),
      ])

      const admData  = admRes.data || []
      const batSumData = batSumRes.data || []
      const batProgData = batProgRes.data || []
      const acadData = acadRes.data || []

      setAdmissionRecords(admData)
      setBatchSummary(batSumData)
      setBatchRecords(batProgData)
      setAcademicRecords(acadData)

      const pAdm  = admData.filter(r => r.verification_status === 'pending').length
      const pBat  = batProgData.filter(r => r.verification_status === 'pending').length
      const pAcad = acadData.filter(r => r.verification_status === 'pending').length
      setPendingCount(pAdm + pBat + pAcad)
    } catch (err) {
      toast.error('Failed to load historical data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleVerify = async (type, id) => {
    try {
      if (type === 'admission') await historicalAPI.admission.verify(id)
      else if (type === 'batch') await historicalAPI.batchProgress.verify(id)
      else if (type === 'academic') await historicalAPI.academicPerformance.verify(id)
      toast.success('Record verified for NBA SAR compilation')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed')
    }
  }

  const handleOpenReject = (type, item) => {
    setActiveItem({ type, ...item })
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection justification is required')
      return
    }
    try {
      const { type, id } = activeItem
      if (type === 'admission') await historicalAPI.admission.reject(id, { rejection_reason: rejectionReason })
      else if (type === 'batch') await historicalAPI.batchProgress.reject(id, { rejection_reason: rejectionReason })
      else if (type === 'academic') await historicalAPI.academicPerformance.reject(id, { rejection_reason: rejectionReason })
      toast.success('Record rejected')
      setShowRejectModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject record')
    }
  }

  const handleBulkUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Select a CSV or Excel file to upload')
      return
    }
    setUploading(true)
    setUploadErrors(null)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      let res
      if (activeTab === 'admission') res = await historicalAPI.admission.bulkImport(formData)
      else if (activeTab === 'batch') res = await historicalAPI.batchProgress.bulkImport(formData)
      else if (activeTab === 'academic') res = await historicalAPI.academicPerformance.bulkImport(formData)

      toast.success(res.data?.message || 'File parsed and imported successfully!')
      setShowUploadModal(false)
      setSelectedFile(null)
      loadData()
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) {
        setUploadErrors(data)
        toast.error(`Import failed with ${data.error_count} row errors`)
      } else {
        toast.error(data?.error || 'Failed to import file')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    try {
      if (activeTab === 'admission') {
        await historicalAPI.admission.create(admissionForm)
      } else if (activeTab === 'batch') {
        await historicalAPI.batchProgress.create(batchForm)
      } else if (activeTab === 'academic') {
        await historicalAPI.academicPerformance.create(academicForm)
      }
      toast.success(isAdmin ? 'Record created and verified!' : 'Record submitted for verification')
      setShowManualModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Creation failed')
    }
  }

  const handleDownloadTemplate = (type) => {
    let url = ''
    if (type === 'admission') url = historicalAPI.admission.downloadTemplateUrl
    else if (type === 'batch') url = historicalAPI.batchProgress.downloadTemplateUrl
    else if (type === 'academic') url = historicalAPI.academicPerformance.downloadTemplateUrl
    window.open(url, '_blank')
  }

  return (
    <div>
      <PageHeader
        category="Academic Intelligence"
        title="Historical Cohort Data & Intake Ingestion"
        description="Verify multi-year student intake, cohort progression rates, and academic performance indices feeding NBA Criterion 4."
        badge={`${role.toUpperCase()} Role`}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={loadData}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              title="Refresh records"
            >
              <RefreshCw size={14} />
            </button>

            {!isReadOnly && activeTab !== 'queue' && (
              <>
                <button
                  onClick={() => handleDownloadTemplate(activeTab)}
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={14} />
                  <span>Template</span>
                </button>
                <button
                  onClick={() => setShowManualModal(true)}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus size={14} />
                  <span>Manual Entry</span>
                </button>
                <button
                  onClick={() => { setUploadErrors(null); setSelectedFile(null); setShowUploadModal(true); }}
                  className="btn btn-primary btn-sm"
                >
                  <Upload size={14} />
                  <span>Bulk Import CSV</span>
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="page-body">
        {/* Navigation Tabs */}
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'admission', label: 'Criterion 4.1: Intake & Admissions', icon: Users, count: admissionRecords.length },
            { id: 'batch', label: 'Criterion 4.2: Cohort Progression', icon: TrendingUp, count: batchRecords.length },
            { id: 'academic', label: 'Criterion 4.3: Academic Indices', icon: GraduationCap, count: academicRecords.length },
            { id: 'queue', label: 'Admin Verification Queue', icon: Shield, count: pendingCount },
          ]}
        />

        {/* ── Tab 1: Intake & Admissions ── */}
        {activeTab === 'admission' && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>Department</th>
                  <th>Sanctioned Intake</th>
                  <th>1st Year Enrolled</th>
                  <th>Lateral Entry</th>
                  <th>Enrolment Ratio</th>
                  <th>Audit Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {admissionRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No intake records recorded yet. Upload a batch CSV to populate.
                    </td>
                  </tr>
                ) : (
                  admissionRecords.map(r => {
                    const ratio = r.sanctioned_intake > 0
                      ? Math.round((r.first_year_admitted_net_migration / r.sanctioned_intake) * 100)
                      : 0
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.academic_year}</td>
                        <td>{r.department}</td>
                        <td className="tabular-nums">{r.sanctioned_intake}</td>
                        <td className="tabular-nums">{r.first_year_admitted_net_migration}</td>
                        <td className="tabular-nums">{r.lateral_entry_admitted}</td>
                        <td className="tabular-nums">
                          <span style={{ fontWeight: 600, color: ratio >= 90 ? 'var(--success)' : 'var(--warning)' }}>
                            {ratio}%
                          </span>
                        </td>
                        <td>
                          {r.verification_status === 'verified' ? (
                            <Badge variant="success" icon={CheckCircle2}>Verified</Badge>
                          ) : r.verification_status === 'rejected' ? (
                            <Badge variant="danger" icon={XCircle}>Rejected</Badge>
                          ) : (
                            <Badge variant="warning" icon={Clock}>Pending</Badge>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            {r.verification_status === 'pending' && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleVerify('admission', r.id)}
                                  className="btn btn-success btn-sm"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject('admission', r)}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab 2: Cohort Progression ── */}
        {activeTab === 'batch' && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Entry Batch</th>
                  <th>Department</th>
                  <th>Year of Study</th>
                  <th>Total Admitted</th>
                  <th>Cleared (No Backlog)</th>
                  <th>Total Passed</th>
                  <th>Success Rate</th>
                  <th>Audit Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {batchRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No cohort progression records recorded yet.
                    </td>
                  </tr>
                ) : (
                  batchRecords.map(r => {
                    const rate = r.total_admitted > 0
                      ? Math.round((r.students_without_backlog / r.total_admitted) * 100)
                      : 0
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.year_of_entry}</td>
                        <td>{r.department}</td>
                        <td>Year {r.year_of_study}</td>
                        <td className="tabular-nums">{r.total_admitted}</td>
                        <td className="tabular-nums" style={{ color: 'var(--success)', fontWeight: 600 }}>
                          {r.students_without_backlog}
                        </td>
                        <td className="tabular-nums">{r.students_total_passed}</td>
                        <td className="tabular-nums">
                          <span style={{ fontWeight: 600, color: rate >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                            {rate}%
                          </span>
                        </td>
                        <td>
                          {r.verification_status === 'verified' ? (
                            <Badge variant="success" icon={CheckCircle2}>Verified</Badge>
                          ) : r.verification_status === 'rejected' ? (
                            <Badge variant="danger" icon={XCircle}>Rejected</Badge>
                          ) : (
                            <Badge variant="warning" icon={Clock}>Pending</Badge>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            {r.verification_status === 'pending' && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleVerify('batch', r.id)}
                                  className="btn btn-success btn-sm"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject('batch', r)}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab 3: Academic Indices ── */}
        {activeTab === 'academic' && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>Department</th>
                  <th>Year of Study</th>
                  <th>Mean CGPA / %</th>
                  <th>Successful Students</th>
                  <th>Appeared Students</th>
                  <th>API Score</th>
                  <th>Audit Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {academicRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No academic index records recorded yet.
                    </td>
                  </tr>
                ) : (
                  academicRecords.map(r => {
                    const api = r.appeared_students_count > 0
                      ? ((r.mean_cgpa_or_percentage * r.successful_students_count) / r.appeared_students_count).toFixed(2)
                      : '0.00'
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.academic_year}</td>
                        <td>{r.department}</td>
                        <td>Year {r.year_of_study}</td>
                        <td className="tabular-nums" style={{ fontWeight: 600 }}>{r.mean_cgpa_or_percentage}</td>
                        <td className="tabular-nums">{r.successful_students_count}</td>
                        <td className="tabular-nums">{r.appeared_students_count}</td>
                        <td className="tabular-nums" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                          {api}
                        </td>
                        <td>
                          {r.verification_status === 'verified' ? (
                            <Badge variant="success" icon={CheckCircle2}>Verified</Badge>
                          ) : r.verification_status === 'rejected' ? (
                            <Badge variant="danger" icon={XCircle}>Rejected</Badge>
                          ) : (
                            <Badge variant="warning" icon={Clock}>Pending</Badge>
                          )}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: 'right' }}>
                            {r.verification_status === 'pending' && (
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => handleVerify('academic', r.id)}
                                  className="btn btn-success btn-sm"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject('academic', r)}
                                  className="btn btn-danger btn-sm"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Tab 4: Admin Verification Queue ── */}
        {activeTab === 'queue' && (
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 4 }}>Pending Audit Verification Queue</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16 }}>
              {pendingCount} records awaiting institutional administrator sign-off before inclusion in official NBA exports.
            </p>

            {pendingCount === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All Historical Records Verified"
                description="There are no pending admission or cohort progression records requiring administrative sign-off."
              />
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Please switch to the respective tabs above (Intake, Progression, or Indices) to review and approve pending records.
              </div>
            )}
          </div>
        )}

        {/* ── Modal 1: Bulk CSV Upload ── */}
        <Modal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          title={`Bulk Ingest: ${activeTab.toUpperCase()} Data`}
          maxWidth={520}
        >
          <form onSubmit={handleBulkUpload}>
            <div className="form-group">
              <label className="form-label">Select CSV or Excel (.xlsx) File</label>
              <input
                type="file"
                className="form-input"
                accept=".csv,.xlsx,.xls"
                onChange={e => setSelectedFile(e.target.files[0] || null)}
                required
              />
              <p className="form-hint">
                Ensure column headings match the official institutional template.
              </p>
            </div>

            {uploadErrors && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
                fontSize: '12px',
                color: 'var(--danger)'
              }}>
                <strong>Parsing Errors ({uploadErrors.error_count}):</strong>
                <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                  {uploadErrors.errors?.slice(0, 5).map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowUploadModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" disabled={uploading || !selectedFile} className="btn btn-primary btn-sm">
                {uploading ? 'Parsing & Ingesting…' : 'Ingest File'}
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal 2: Single Manual Entry ── */}
        <Modal
          isOpen={showManualModal}
          onClose={() => setShowManualModal(false)}
          title={`Manual Record Entry: ${activeTab.toUpperCase()}`}
          maxWidth={540}
        >
          <form onSubmit={handleManualSubmit}>
            {activeTab === 'admission' && (
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input
                    type="text"
                    className="form-input"
                    value={admissionForm.academic_year}
                    onChange={e => setAdmissionForm({ ...admissionForm, academic_year: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input
                    type="text"
                    className="form-input"
                    value={admissionForm.department}
                    onChange={e => setAdmissionForm({ ...admissionForm, department: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sanctioned Intake</label>
                  <input
                    type="number"
                    className="form-input"
                    value={admissionForm.sanctioned_intake}
                    onChange={e => setAdmissionForm({ ...admissionForm, sanctioned_intake: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">1st Year Admitted (Net)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={admissionForm.first_year_admitted_net_migration}
                    onChange={e => setAdmissionForm({ ...admissionForm, first_year_admitted_net_migration: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Lateral Entry Admitted</label>
                  <input
                    type="number"
                    className="form-input"
                    value={admissionForm.lateral_entry_admitted}
                    onChange={e => setAdmissionForm({ ...admissionForm, lateral_entry_admitted: parseInt(e.target.value, 10) })}
                  />
                </div>
              </div>
            )}

            {activeTab === 'batch' && (
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Year of Entry</label>
                  <input
                    type="text"
                    className="form-input"
                    value={batchForm.year_of_entry}
                    onChange={e => setBatchForm({ ...batchForm, year_of_entry: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Admitted (N1+N2+N3)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchForm.total_admitted}
                    onChange={e => setBatchForm({ ...batchForm, total_admitted: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cleared Without Backlog</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchForm.students_without_backlog}
                    onChange={e => setBatchForm({ ...batchForm, students_without_backlog: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Passed (With Backlog)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={batchForm.students_total_passed}
                    onChange={e => setBatchForm({ ...batchForm, students_total_passed: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
              </div>
            )}

            {activeTab === 'academic' && (
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input
                    type="text"
                    className="form-input"
                    value={academicForm.academic_year}
                    onChange={e => setAcademicForm({ ...academicForm, academic_year: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mean CGPA or %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={academicForm.mean_cgpa_or_percentage}
                    onChange={e => setAcademicForm({ ...academicForm, mean_cgpa_or_percentage: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Successful Students</label>
                  <input
                    type="number"
                    className="form-input"
                    value={academicForm.successful_students_count}
                    onChange={e => setAcademicForm({ ...academicForm, successful_students_count: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Appeared Students</label>
                  <input
                    type="number"
                    className="form-input"
                    value={academicForm.appeared_students_count}
                    onChange={e => setAcademicForm({ ...academicForm, appeared_students_count: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setShowManualModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Submit Record
              </button>
            </div>
          </form>
        </Modal>

        {/* ── Modal 3: Reject Justification ── */}
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Historical Record"
          maxWidth={460}
          footer={
            <>
              <button type="button" onClick={() => setShowRejectModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmReject} className="btn btn-danger btn-sm">
                Confirm Rejection
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Rejection Reason *</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="State why this record cannot be verified (e.g. Sanctioned intake discrepancy with AICTE approval letter)..."
              required
            />
          </div>
        </Modal>
      </div>
    </div>
  )
}
