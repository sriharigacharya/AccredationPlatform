import React, { useState, useEffect } from 'react'
import {
  Upload, Download, FileText, CheckCircle2, XCircle, AlertTriangle, Plus,
  Edit3, Trash2, Filter, Clock, Shield, FileSpreadsheet, Layers,
  TrendingUp, GraduationCap, Users, RefreshCw, Eye, Check, X
} from 'lucide-react'
import { historicalAPI } from '../api/client'
import toast from 'react-hot-toast'

export default function HistoricalDataPage({ user }) {
  const role = (user?.role || 'worker').toLowerCase()
  const isAdmin = role === 'admin'
  const isWorker = role === 'worker'
  const isReadOnly = role === 'teacher' || role === 'faculty'

  const [activeTab, setActiveTab] = useState('admission') // 'admission' | 'batch' | 'academic' | 'queue'
  const [loading, setLoading] = useState(false)

  // Data states
  const [admissionRecords, setAdmissionRecords] = useState([])
  const [batchSummary, setBatchSummary] = useState([])
  const [batchRecords, setBatchRecords] = useState([])
  const [academicRecords, setAcademicRecords] = useState([])

  // Queue counts
  const [pendingCount, setPendingCount] = useState(0)

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeItem, setActiveItem] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Upload modal error report
  const [uploadErrors, setUploadErrors] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  // Form states for manual entry
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

  // Load all data
  const loadData = async () => {
    setLoading(true)
    try {
      const [admRes, batSumRes, batProgRes, acadRes] = await Promise.all([
        historicalAPI.admission.list(),
        historicalAPI.batchProgress.summary({ department: 'CSE' }),
        historicalAPI.batchProgress.list(),
        historicalAPI.academicPerformance.list(),
      ])

      const admData = admRes.data || []
      const batSumData = batSumRes.data || []
      const batProgData = batProgRes.data || []
      const acadData = acadRes.data || []

      setAdmissionRecords(admData)
      setBatchSummary(batSumData)
      setBatchRecords(batProgData)
      setAcademicRecords(acadData)

      // Count pending across all 3
      const pAdm = admData.filter(r => r.verification_status === 'pending').length
      const pBat = batProgData.filter(r => r.verification_status === 'pending').length
      const pAcad = acadData.filter(r => r.verification_status === 'pending').length
      setPendingCount(pAdm + pBat + pAcad)
    } catch (err) {
      console.error('Failed to load historical data:', err)
      toast.error('Failed to fetch historical records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ── Verification Actions (Admin only) ───────────────────────────────────────
  const handleVerify = async (type, id) => {
    try {
      if (type === 'admission') await historicalAPI.admission.verify(id)
      else if (type === 'batch') await historicalAPI.batchProgress.verify(id)
      else if (type === 'academic') await historicalAPI.academicPerformance.verify(id)
      toast.success('Record verified successfully!')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify record')
    }
  }

  const handleOpenReject = (type, item) => {
    setActiveItem({ type, ...item })
    setRejectionReason('')
    setShowRejectModal(true)
  }

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a rejection reason')
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

  // ── Bulk Import Submit ──────────────────────────────────────────────────────
  const handleBulkUpload = async (e) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Please select a CSV or Excel file')
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

      toast.success(res.data?.message || 'File imported successfully!')
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

  // ── Manual Single Record Submit ─────────────────────────────────────────────
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
      toast.success(isAdmin ? 'Record created and verified!' : 'Record submitted for Admin verification')
      setShowManualModal(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create record')
    }
  }

  // Helper download trigger
  const handleDownloadTemplate = (type) => {
    let url = ''
    if (type === 'admission') url = historicalAPI.admission.downloadTemplateUrl
    else if (type === 'batch') url = historicalAPI.batchProgress.downloadTemplateUrl
    else if (type === 'academic') url = historicalAPI.academicPerformance.downloadTemplateUrl
    window.open(url, '_blank')
  }

  // Helper status badge
  const renderStatusBadge = (status) => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Verified
        </span>
      )
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <XCircle className="w-3.5 h-3.5 mr-1" /> Rejected
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        <Clock className="w-3.5 h-3.5 mr-1" /> Pending Admin Review
      </span>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Historical Data Upload & Verification
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isAdmin ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300' :
              isWorker ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300' :
              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {role} role
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Import and verify historical figures feeding Criterion 4 (Admission, Batch Progression, and Academic Performance).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!isReadOnly && activeTab !== 'queue' && (
            <>
              <button
                onClick={() => handleDownloadTemplate(activeTab)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Template
              </button>

              <button
                onClick={() => setShowManualModal(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 shadow-sm transition"
              >
                <Plus className="w-4 h-4 text-indigo-500" />
                Single Record
              </button>

              <button
                onClick={() => { setUploadErrors(null); setSelectedFile(null); setShowUploadModal(true) }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
              >
                <Upload className="w-4 h-4" />
                Bulk Import CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ──────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 bg-slate-100/60 dark:bg-slate-800/40 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('admission')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'admission'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          4.1 Admission Details
        </button>

        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'batch'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          4.2 Batch Progression & Success Rate
        </button>

        <button
          onClick={() => setActiveTab('academic')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'academic'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          4.3/4.4 Academic Performance (API)
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ml-auto ${
              activeTab === 'queue'
                ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Verification Queue
            {pendingCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Tab 1: Admission Details (4.1) ───────────────────────────────────── */}
      {activeTab === 'admission' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Table 4.1 — Admission & Enrolment Records
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Feeds Criterion 4.1 Enrolment Ratio: ER = (Admitted / Sanctioned Intake) × 100
              </p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {admissionRecords.length} records total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Academic Year</th>
                  <th className="px-4 py-3.5">Dept</th>
                  <th className="px-4 py-3.5 text-right">Intake (N)</th>
                  <th className="px-4 py-3.5 text-right">1st Year (N1)</th>
                  <th className="px-4 py-3.5 text-right">Lateral (N2)</th>
                  <th className="px-4 py-3.5 text-right">Total Admitted</th>
                  <th className="px-4 py-3.5 text-right">ER %</th>
                  <th className="px-4 py-3.5">Source</th>
                  <th className="px-4 py-3.5">Status</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {admissionRecords.map((r) => {
                  const er = r.sanctioned_intake ? ((r.total_admitted / r.sanctioned_intake) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {r.academic_year}
                      </td>
                      <td className="px-4 py-4">{r.department}</td>
                      <td className="px-4 py-4 text-right font-medium">{r.sanctioned_intake}</td>
                      <td className="px-4 py-4 text-right">{r.first_year_admitted_net_migration}</td>
                      <td className="px-4 py-4 text-right">{r.lateral_entry_admitted}</td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {r.total_admitted}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                        {er}%
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        <span className="capitalize">{r.submitted_via}</span> ({r.uploaded_by})
                      </td>
                      <td className="px-4 py-4">
                        {renderStatusBadge(r.verification_status)}
                        {r.rejection_reason && (
                          <p className="text-xs text-rose-500 mt-1">Reason: {r.rejection_reason}</p>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {r.verification_status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerify('admission', r.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg"
                                title="Approve & Verify"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenReject('admission', r)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Batch Progression & Success Rate (4.2) ────────────────────── */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          {/* Summary Cohort Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {batchSummary.map((b) => (
              <div key={b.batch_id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Cohort {b.year_of_entry}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{b.department}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-500">Total Admitted (N):</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{b.total_admitted}</span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Year IV Passed (Total):</span>
                    <span className="font-semibold text-emerald-600">{b.year_IV?.students_total_passed || 'In Progress'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Without Backlog:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{b.year_IV?.students_without_backlog || '—'}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
                    <span>Success Rate:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{b.success_rate_total_passed_pct}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Progress Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Table 4.2 — Batch Progression Records (Year I to IV)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracks yearly academic advancement and feeds Criterion 4.2 Success Rate in Stipulated Period.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Cohort Entry</th>
                    <th className="px-4 py-3.5">Dept</th>
                    <th className="px-4 py-3.5 text-right">Admitted (N)</th>
                    <th className="px-4 py-3.5">Year of Study</th>
                    <th className="px-4 py-3.5 text-right">Without Backlog</th>
                    <th className="px-4 py-3.5 text-right">Total Passed</th>
                    <th className="px-4 py-3.5">Source</th>
                    <th className="px-4 py-3.5">Status</th>
                    {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {batchRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {r.year_of_entry}
                      </td>
                      <td className="px-4 py-4">{r.department}</td>
                      <td className="px-4 py-4 text-right font-medium">{r.total_admitted}</td>
                      <td className="px-4 py-4 font-bold text-indigo-600 dark:text-indigo-400">
                        Year {r.year_of_study}
                      </td>
                      <td className="px-4 py-4 text-right">{r.students_without_backlog}</td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-600">
                        {r.students_total_passed}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        <span className="capitalize">{r.submitted_via}</span>
                      </td>
                      <td className="px-4 py-4">
                        {renderStatusBadge(r.verification_status)}
                        {r.rejection_reason && (
                          <p className="text-xs text-rose-500 mt-1">Reason: {r.rejection_reason}</p>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {r.verification_status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerify('batch', r.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg"
                                title="Approve & Verify"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenReject('batch', r)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Academic Performance (API 4.3 / 4.4) ──────────────────────── */}
      {activeTab === 'academic' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Table 4.3 / 4.4 — Academic Performance Index (API)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Feeds Academic Performance Index in 2nd and 3rd Year: API = (Mean CGPA / 10) × 10
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Academic Year</th>
                  <th className="px-4 py-3.5">Year of Study</th>
                  <th className="px-4 py-3.5">Dept</th>
                  <th className="px-4 py-3.5 text-right">Mean CGPA</th>
                  <th className="px-4 py-3.5 text-right">Successful</th>
                  <th className="px-4 py-3.5 text-right">Appeared</th>
                  <th className="px-4 py-3.5 text-right">Pass %</th>
                  <th className="px-4 py-3.5">Status</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {academicRecords.map((r) => {
                  const pct = r.appeared_students_count ? ((r.successful_students_count / r.appeared_students_count) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                        {r.academic_year}
                      </td>
                      <td className="px-4 py-4 font-medium text-indigo-600 dark:text-indigo-400">
                        Year {r.year_of_study}
                      </td>
                      <td className="px-4 py-4">{r.department}</td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900 dark:text-white">
                        {r.mean_cgpa_or_percentage.toFixed(2)} / 10
                      </td>
                      <td className="px-4 py-4 text-right">{r.successful_students_count}</td>
                      <td className="px-4 py-4 text-right">{r.appeared_students_count}</td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-600">
                        {pct}%
                      </td>
                      <td className="px-4 py-4">
                        {renderStatusBadge(r.verification_status)}
                        {r.rejection_reason && (
                          <p className="text-xs text-rose-500 mt-1">Reason: {r.rejection_reason}</p>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          {r.verification_status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleVerify('academic', r.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg"
                                title="Approve & Verify"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenReject('academic', r)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Unified Admin Verification Queue ──────────────────────────── */}
      {isAdmin && activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold text-sm">Strict NBA SAR Formula Grounding Rule</p>
              <p className="mt-0.5">
                Records submitted by Data Workers remain pending until approved here. Unverified records are strictly excluded at query-time from Criterion 4 calculations.
              </p>
            </div>
          </div>

          {pendingCount === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verification Queue is Empty</h3>
              <p className="text-sm text-slate-500 mt-1">All Worker-submitted historical records have been verified.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Admissions */}
              {admissionRecords.filter(r => r.verification_status === 'pending').map(r => (
                <div key={`adm-${r.id}`} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-800 mr-2">
                      4.1 Admission
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{r.academic_year} — {r.department}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      Intake: {r.sanctioned_intake} | Admitted: {r.total_admitted} (N1: {r.first_year_admitted_net_migration}, N2: {r.lateral_entry_admitted})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify('admission', r.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleOpenReject('admission', r)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {/* Pending Batch Progress */}
              {batchRecords.filter(r => r.verification_status === 'pending').map(r => (
                <div key={`bat-${r.id}`} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800 mr-2">
                      4.2 Batch Progress
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">Cohort {r.year_of_entry} — Year {r.year_of_study}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      Passed: {r.students_total_passed} / {r.total_admitted} | Without Backlog: {r.students_without_backlog}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify('batch', r.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleOpenReject('batch', r)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}

              {/* Pending Academic Performance */}
              {academicRecords.filter(r => r.verification_status === 'pending').map(r => (
                <div key={`acad-${r.id}`} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-purple-100 text-purple-800 mr-2">
                      4.3/4.4 Academic API
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">{r.academic_year} — Year {r.year_of_study}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      Mean CGPA: {r.mean_cgpa_or_percentage.toFixed(2)} | Passed: {r.successful_students_count} / {r.appeared_students_count}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify('academic', r.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleOpenReject('academic', r)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Bulk Upload with Row Error Breakdown ───────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Bulk Import CSV — {
                  activeTab === 'admission' ? '4.1 Admission Records' :
                  activeTab === 'batch' ? '4.2 Batch Progression' : '4.3/4.4 Academic API'
                }
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="w-10 h-10 text-indigo-500 mx-auto" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {selectedFile ? selectedFile.name : 'Click to select CSV or Excel template'}
                  </p>
                  <p className="text-xs text-slate-400">Strict all-or-nothing validation applied on all rows</p>
                </label>
              </div>

              {/* Row Errors Report */}
              {uploadErrors && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    ❌ Import Rejected ({uploadErrors.error_count} errors found):
                  </p>
                  <ul className="text-xs text-rose-600 dark:text-rose-400 space-y-1 list-disc pl-4">
                    {uploadErrors.errors?.map((err, i) => (
                      <li key={i}>
                        Row {err.row} ({err.field}): {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition"
                >
                  {uploading ? 'Validating & Importing...' : 'Validate & Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Manual Single Record Entry ─────────────────────────────────── */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Single Record — {
                  activeTab === 'admission' ? 'Admission Details' :
                  activeTab === 'batch' ? 'Batch Progression' : 'Academic Performance'
                }
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4 text-sm">
              {activeTab === 'admission' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Academic Year</label>
                      <input
                        type="text"
                        value={admissionForm.academic_year}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, academic_year: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Department</label>
                      <input
                        type="text"
                        value={admissionForm.department}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, department: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Sanctioned (N)</label>
                      <input
                        type="number"
                        value={admissionForm.sanctioned_intake}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, sanctioned_intake: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">1st Year (N1)</label>
                      <input
                        type="number"
                        value={admissionForm.first_year_admitted_net_migration}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, first_year_admitted_net_migration: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Lateral (N2)</label>
                      <input
                        type="number"
                        value={admissionForm.lateral_entry_admitted}
                        onChange={(e) => setAdmissionForm({ ...admissionForm, lateral_entry_admitted: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'batch' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cohort Entry Year</label>
                      <input
                        type="text"
                        value={batchForm.year_of_entry}
                        onChange={(e) => setBatchForm({ ...batchForm, year_of_entry: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Year of Study</label>
                      <select
                        value={batchForm.year_of_study}
                        onChange={(e) => setBatchForm({ ...batchForm, year_of_study: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="I">Year I</option>
                        <option value="II">Year II</option>
                        <option value="III">Year III</option>
                        <option value="IV">Year IV</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Admitted</label>
                      <input
                        type="number"
                        value={batchForm.total_admitted}
                        onChange={(e) => setBatchForm({ ...batchForm, total_admitted: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">No Backlog</label>
                      <input
                        type="number"
                        value={batchForm.students_without_backlog}
                        onChange={(e) => setBatchForm({ ...batchForm, students_without_backlog: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Passed</label>
                      <input
                        type="number"
                        value={batchForm.students_total_passed}
                        onChange={(e) => setBatchForm({ ...batchForm, students_total_passed: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'academic' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Academic Year</label>
                      <input
                        type="text"
                        value={academicForm.academic_year}
                        onChange={(e) => setAcademicForm({ ...academicForm, academic_year: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Year of Study</label>
                      <select
                        value={academicForm.year_of_study}
                        onChange={(e) => setAcademicForm({ ...academicForm, year_of_study: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="II">Year II (3rd & 4th Sem)</option>
                        <option value="III">Year III (5th & 6th Sem)</option>
                        <option value="I">Year I (1st & 2nd Sem)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Mean CGPA (10)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={academicForm.mean_cgpa_or_percentage}
                        onChange={(e) => setAcademicForm({ ...academicForm, mean_cgpa_or_percentage: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Successful</label>
                      <input
                        type="number"
                        value={academicForm.successful_students_count}
                        onChange={(e) => setAcademicForm({ ...academicForm, successful_students_count: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Appeared</label>
                      <input
                        type="number"
                        value={academicForm.appeared_students_count}
                        onChange={(e) => setAcademicForm({ ...academicForm, appeared_students_count: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  {isAdmin ? 'Save & Auto-Verify' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Rejection Reason ──────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Reject Historical Record
            </h3>
            <p className="text-xs text-slate-500">
              Provide feedback for the Data Worker explaining why this entry was rejected.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Sanctioned intake figures do not match AICTE approval letter for 2025-26."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
