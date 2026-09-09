import React, { useEffect, useState, useMemo } from 'react'
import {
  reportsAPI, departmentsAPI, eventsAPI, studentsAPI, facultyAPI
} from '../api/client'
import {
  FileText, Download, Clock, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Eye, Sparkles, ChevronRight,
  Award, Calendar, Users, Info, Cpu, CheckSquare, Square,
  Check, Save, Edit3, Loader2, ArrowRight, GraduationCap, UserCheck, User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

// ── Report Type Options ───────────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    id: 'sar',
    label: 'NBA SAR (Criterion 4)',
    badge: 'Tier-II GAPC V4.0',
    desc: 'Automated Self-Assessment Report with verified mathematical scores and 9-subsection data breakdown.',
    icon: FileText,
  },
  {
    id: 'department_summary',
    label: 'Department Executive Summary',
    badge: 'Institutional',
    desc: 'Executive-level summary covering academic outcomes, faculty research contributions, and student cohorts.',
    icon: Cpu,
  },
  {
    id: 'student_report',
    label: 'Individual Student Dossier',
    badge: 'Student Record',
    desc: 'Official student dossier: enrolled courses, semester GPA, attendance, backlogs, and academic assessment.',
    icon: GraduationCap,
  },
  {
    id: 'faculty_report',
    label: 'Faculty Appraisal & Research Dossier',
    badge: 'Faculty Profile',
    desc: 'Faculty credential dossier: teaching load, publications, sponsored projects, and performance appraisal.',
    icon: UserCheck,
  },
  {
    id: 'club_activity',
    label: 'Co-Curricular & Club Activities',
    badge: 'Activities',
    desc: 'Verified technical hackathons, workshops, symposiums, and community outreach metrics.',
    icon: Award,
  },
  {
    id: 'custom',
    label: 'Custom AI Report Builder',
    badge: 'Direct Relational AI',
    desc: 'Bespoke accreditation report with user-specified section headings, course allocations, CIE marks, or custom narrative instructions.',
    icon: Sparkles,
  },
]

export default function ReportsPage() {
  const { user }                     = useAuth()
  const isStudent                    = user?.role === 'student'
  const [reportType, setReportType]   = useState(isStudent ? 'department_summary' : 'sar')
  const [departments, setDepartments] = useState([])
  const [reports, setReports]         = useState([])
  const [histLoading, setHistLoading] = useState(true)

  const loadDepartments = async () => {
    try {
      const res = await departmentsAPI.list()
      setDepartments(res.data || [])
    } catch (_) {}
  }

  const loadHistory = async () => {
    setHistLoading(true)
    try {
      const res = await reportsAPI.list()
      setReports(res.data || [])
    } catch (_) {}
    finally {
      setHistLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
    loadHistory()
  }, [])

  const handleDownload = async (reportId, filename, format = 'pdf') => {
    const t = toast.loading(`Preparing ${format.toUpperCase()} export…`)
    try {
      const fn = format === 'docx' ? reportsAPI.downloadDocx : reportsAPI.downloadPdf
      const res = await fn(reportId)
      const blob = new Blob([res.data], {
        type: format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename || `AcademiQ_Report_${reportId}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} export complete`, { id: t })
    } catch (_) {
      toast.error(`Failed to export ${format.toUpperCase()}`, { id: t })
    }
  }

  return (
    <div>
      <PageHeader
        category="Intelligence & Accreditation"
        title="Accreditation Reports & NBA SAR Generation"
        description="Automated compilation of NBA Tier-II GAPC V4.0 Self-Assessment Reports, executive summaries, and AI synthesized documentation."
        badge="NBA Tier-II Validated"
        actions={
          <button
            type="button"
            onClick={loadHistory}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} />
            <span>Refresh History</span>
          </button>
        }
      />

      <div className="page-body">
        {/* ── Report Type Selector Cards ── */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            marginBottom: 8
          }}>
            Select Report Template
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {REPORT_TYPES.map(rt => {
              const isSelected = reportType === rt.id
              const isDisabled = rt.id === 'sar' && isStudent
              const Icon = rt.icon
              return (
                <div
                  key={rt.id}
                  onClick={() => !isDisabled && setReportType(rt.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-default)'}`,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.45 : 1,
                    transition: 'all var(--transition-fast)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                        {rt.label}
                      </span>
                    </div>
                    <Badge variant={isSelected ? 'primary' : 'neutral'}>
                      {rt.badge}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {rt.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Active Report Generator Form ── */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          {reportType === 'sar' && !isStudent ? (
            <div>
              <div className="card-header">
                <div>
                  <h3 className="card-title">NBA Self-Assessment Report Compiler</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Compiles verified academic data into official Tier-II SAR tables. Includes live Criterion 4 preview.
                  </p>
                </div>
                <Badge variant="primary">UG Tier-II GAPC V4.0</Badge>
              </div>

              <NbaSarForm
                departments={departments}
                onGenerated={loadHistory}
              />
            </div>
          ) : reportType === 'student_report' ? (
            <div>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Individual Student Academic Dossier</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Generates official student academic profile: semester load, attendance, CGPA, backlogs, and mentorship notes.
                  </p>
                </div>
                <Badge variant="primary">Student Dossier</Badge>
              </div>

              <StudentReportForm
                departments={departments}
                onGenerated={loadHistory}
              />
            </div>
          ) : reportType === 'faculty_report' && !isStudent ? (
            <div>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Faculty Performance & Research Appraisal</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Compiles teaching workload, peer-reviewed publications, sponsored research grants, and institutional appraisal.
                  </p>
                </div>
                <Badge variant="purple">Faculty Appraisal</Badge>
              </div>

              <FacultyReportForm
                departments={departments}
                onGenerated={loadHistory}
              />
            </div>
          ) : (
            <div>
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    {reportType === 'department_summary' && 'Department Executive Overview'}
                    {reportType === 'club_activity' && 'Co-Curricular & Student Club Report'}
                    {reportType === 'custom' && 'Bespoke AI Synthesis Report'}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    {reportType === 'department_summary' && 'Synthesizes student enrollment, academic trends, and faculty publications.'}
                    {reportType === 'club_activity' && 'Gathers verified club activities, attendee metrics, and student competitions.'}
                    {reportType === 'custom' && 'Directs Llama 3.1 & Qdrant to assemble grounded documentation based on custom outlines.'}
                  </p>
                </div>
              </div>

              <GeneralReportForm
                departments={departments}
                reportType={reportType}
                onGenerated={loadHistory}
              />
            </div>
          )}
        </div>

        {/* ── Report Generation History ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Generated Accreditation Reports History</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                Archive of compiled reports with direct PDF and Word exports.
              </p>
            </div>
          </div>

          <ReportHistoryTable
            reports={reports}
            loading={histLoading}
            onDownload={handleDownload}
            onRefresh={loadHistory}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sub-component: NBA SAR Form ───────────────────────────────────────────────
function NbaSarForm({ departments, onGenerated }) {
  const [form, setForm] = useState({
    department_id: departments[0]?.code || 'CSE',
    academic_year: '2025-26',
    scope: 'criterion:4',
    format: 'pdf',
    expand_narratives: false,
    sar_format: 'ug_tier_ii_gapc_v4',
  })
  const [loading, setLoading]               = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewData, setPreviewData]       = useState(null)
  const [showPreview, setShowPreview]       = useState(false)
  const [approvedEvents, setApprovedEvents] = useState([])
  const [selectedEventIds, setSelectedEventIds] = useState([])
  const [loadingEvents, setLoadingEvents]   = useState(false)

  useEffect(() => {
    if (!form.department_id && departments.length > 0) {
      setForm(prev => ({ ...prev, department_id: departments[0].code || departments[0].id }))
    }
  }, [departments])

  const isCriterion4 = form.scope === 'criterion:4' || form.scope === 'full'

  useEffect(() => {
    if (!isCriterion4) return
    setLoadingEvents(true)
    eventsAPI.list({
      status: 'approved',
      academic_year: form.academic_year,
      limit: 100,
    })
      .then(res => {
        const evs = res.data || []
        setApprovedEvents(evs)
        setSelectedEventIds(evs.map(e => e.id))
      })
      .catch(() => {})
      .finally(() => setLoadingEvents(false))
  }, [isCriterion4, form.academic_year])

  const toggleEvent = (id) => {
    setSelectedEventIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleFetchPreview = async () => {
    setLoadingPreview(true)
    try {
      const res = await reportsAPI.previewCriterion4({
        department_id: form.department_id || 'CSE',
        academic_year: form.academic_year,
        sar_format: form.sar_format,
        selected_event_ids: selectedEventIds,
      })
      setPreviewData(res.data)
      setShowPreview(true)
      toast.success('Criterion 4 live preview generated')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        selected_event_ids: isCriterion4 ? selectedEventIds : undefined,
      }
      const res = await reportsAPI.generateNba(payload)
      toast.success(res.data?.message || 'Report generation queued')
      onGenerated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit generation job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Academic Department</label>
          <select
            className="form-select"
            value={form.department_id}
            onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}
          >
            {departments.map(d => (
              <option key={d.code || d.id} value={d.code || d.id}>
                {d.name} ({d.code || d.id})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Accreditation Academic Year</label>
          <select
            className="form-select"
            value={form.academic_year}
            onChange={e => setForm(p => ({ ...p, academic_year: e.target.value }))}
          >
            {['2025-26', '2024-25', '2023-24', '2022-23'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">SAR Scope / Criterion</label>
          <select
            className="form-select"
            value={form.scope}
            onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
          >
            <option value="criterion:4">Criterion 4: Students' Performance (150 M) [Ready]</option>
            <option value="full">Full SAR Compilation (Criteria 1–10)</option>
            <option value="criterion:1" disabled>Criterion 1: Vision, Mission & PEOs (Pending)</option>
            <option value="criterion:2" disabled>Criterion 2: Program Curriculum (Pending)</option>
            <option value="criterion:3" disabled>Criterion 3: Course Outcomes (Pending)</option>
            <option value="criterion:5" disabled>Criterion 5: Faculty Information (Pending)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <label className="form-label">Output Document Format</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['pdf', 'docx', 'both'].map(f => (
              <button
                key={f}
                type="button"
                className={`btn btn-sm ${form.format === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForm(p => ({ ...p, format: f }))}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '13px' }}>
            <input
              type="checkbox"
              checked={form.expand_narratives}
              onChange={e => setForm(p => ({ ...p, expand_narratives: e.target.checked }))}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Expand contextual narratives with AI synthesis</span>
          </label>
        </div>
      </div>

      {/* ── Criterion 4 Event Selection Checklist ── */}
      {isCriterion4 && (
        <div style={{
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={16} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Include Events for Detailed Treatment (Section 4.6.1)
              </span>
              <Badge variant="primary">{selectedEventIds.length} / {approvedEvents.length} selected</Badge>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setSelectedEventIds(approvedEvents.map(e => e.id))}
                className="btn btn-ghost btn-sm"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedEventIds([])}
                className="btn btn-ghost btn-sm"
              >
                Clear
              </button>
            </div>
          </div>

          {loadingEvents ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" />
            </div>
          ) : approvedEvents.length === 0 ? (
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              No approved events found for {form.academic_year}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {approvedEvents.map(ev => {
                const isSelected = selectedEventIds.includes(ev.id)
                return (
                  <div
                    key={ev.id}
                    onClick={() => toggleEvent(ev.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: isSelected ? 'var(--primary-subtle)' : 'var(--bg-surface)',
                      border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-default)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ cursor: 'pointer' }}
                    />
                    <div className="truncate" style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ev.title}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {ev.event_type} · {(ev.event_date || '').slice(0, 10)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="spinner" style={{ width: 12, height: 12 }} />
              <span>Generating Report…</span>
            </>
          ) : (
            <>
              <FileText size={14} />
              <span>Generate NBA SAR Report</span>
            </>
          )}
        </button>

        {isCriterion4 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleFetchPreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <>
                <div className="spinner" style={{ width: 12, height: 12 }} />
                <span>Compiling Live Preview…</span>
              </>
            ) : (
              <>
                <Eye size={14} />
                <span>Live Preview Criterion 4 (150 Marks)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Live Preview Display */}
      {showPreview && isCriterion4 && (
        <div style={{ marginTop: 20 }}>
          <Criterion4PreviewSection
            previewData={previewData}
            academicYear={form.academic_year}
            deptCode={form.department_id || 'CSE'}
            onRefresh={handleFetchPreview}
          />
        </div>
      )}
    </form>
  )
}

// ── Sub-component: General AI Report Form ─────────────────────────────────────
function GeneralReportForm({ departments, reportType, onGenerated }) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.code || 'CSE')
  const [academicYear, setAcademicYear] = useState('2025-26')
  const [format, setFormat]             = useState('pdf')
  const [instructions, setInstructions] = useState('')
  const [reportTitle, setReportTitle]   = useState('')
  const [loading, setLoading]           = useState(false)

  // Auto-populate selected_data based on report type
  const getDefaultSelectedData = (type) => {
    switch (type) {
      case 'department_summary':
        return ['student_records', 'faculty_data', 'placement_data', 'club_events']
      case 'club_activity':
        return ['club_events', 'student_records']
      case 'custom':
        return ['student_records', 'faculty_data', 'placement_data', 'club_events']
      default:
        return ['student_records', 'faculty_data']
    }
  }

  const [selectedData, setSelectedData] = useState(getDefaultSelectedData(reportType))

  useEffect(() => {
    setSelectedData(getDefaultSelectedData(reportType))
  }, [reportType])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await reportsAPI.generateGeneral({
        report_type: reportType,
        department_id: departmentId,
        academic_year: academicYear,
        format,
        selected_data: selectedData,
        instructions: instructions.trim() || undefined,
        report_title: reportTitle.trim() || undefined,
      })
      toast.success('Report generation started')
      onGenerated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2" style={{ gap: 14, marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
          >
            {departments.map(d => (
              <option key={d.code || d.id} value={d.code || d.id}>
                {d.name} ({d.code || d.id})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Academic Year</label>
          <select
            className="form-select"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
          >
            {['2025-26', '2024-25', '2023-24'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Data Sources to Include</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { key: 'student_records', label: 'Student Records' },
            { key: 'faculty_data', label: 'Faculty Data' },
            { key: 'placement_data', label: 'Placement Data' },
            { key: 'club_events', label: 'Club & Events' },
          ].map(ds => (
            <label key={ds.key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={selectedData.includes(ds.key)}
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedData(prev => [...prev, ds.key])
                  } else {
                    setSelectedData(prev => prev.filter(x => x !== ds.key))
                  }
                }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>{ds.label}</span>
            </label>
          ))}
        </div>
      </div>

      {reportType === 'custom' && (
        <>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} color="var(--primary)" />
              <span>Quick Prompt Templates (Click to fill):</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '📚 Faculty Course Allocations', prompt: 'Create a report on courses assigned to each faculty', title: 'Faculty Course Allocation & Teaching Workload Report' },
                { label: '📊 Students CIE Marks & Attendance', prompt: 'Create a report of all the students cie marks and attendence..', title: 'Student Continuous Internal Evaluation (CIE) & Attendance Report' },
                { label: '💼 Placements & Career Outcomes', prompt: 'Generate a comprehensive report on placement statistics, salary packages, and career outcomes', title: 'Department Campus Placement & Career Outcomes Report' },
                { label: '🏆 Club Activities & Hackathons', prompt: 'Create a comprehensive report on all club activities, hackathons, and student participation', title: 'Student Clubs & Co-Curricular Activities Comprehensive Report' },
                { label: '👨‍🏫 Faculty Research & Dossier', prompt: 'Create a detailed report on faculty members, publications, and active research projects', title: 'Faculty Appraisal & Academic Research Portfolio Report' },
                { label: '🏅 Faculty FDP & Certifications', prompt: 'Create a report on faculty development programmes (FDP), pedagogy training, and industry certifications', title: 'Faculty Development & Pedagogy Training Report' },
                { label: '⚠️ Attendance Shortage & At-Risk', prompt: 'Generate an academic intervention report for students with attendance shortage (<75%) and low CIE marks', title: 'Attendance Shortage & Student Academic Risk Report' },
              ].map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  className="btn btn-secondary btn-xs"
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '14px', background: 'var(--bg-surface)' }}
                  onClick={() => {
                    setInstructions(tpl.prompt)
                    setReportTitle(tpl.title)
                  }}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Report Title (Optional)</label>
            <input
              type="text"
              className="form-input"
              value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              placeholder="e.g., Student Continuous Internal Evaluation (CIE) & Attendance Report"
            />
          </div>
        </>
      )}

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">
          {reportType === 'custom' ? 'Custom Report Prompt / Query *' : 'Special Directives & Narrative Guidelines'}
        </label>
        <textarea
          className="form-textarea"
          rows={3}
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder={
            reportType === 'custom'
              ? 'e.g., Create a report of all the students cie marks and attendence..'
              : 'Specify focus areas, key highlights, or specific criteria to emphasize in the synthesized document…'
          }
        />
        {reportType === 'custom' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
            💡 You can request general reports on anything: student marks/attendance matrices, club hackathons, faculty portfolios, or class reviews. The AI builder dynamically compiles data tables and analytical narratives.
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Output Format</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['pdf', 'docx', 'both'].map(f => (
            <button
              key={f}
              type="button"
              className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading}
        >
          {loading ? 'Synthesizing…' : 'Synthesize Report'}
        </button>
      </div>
    </form>
  )
}

// ── Sub-component: Individual Student Report Form ─────────────────────────────
function StudentReportForm({ departments, onGenerated }) {
  const [departmentId, setDepartmentId]       = useState(departments[0]?.code || 'CSE')
  const [students, setStudents]               = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [customStudentId, setCustomStudentId] = useState('')
  const [useCustom, setUseCustom]             = useState(false)
  const [academicYear, setAcademicYear]       = useState('2025-26')
  const [format, setFormat]                   = useState('both')
  const [loading, setLoading]                 = useState(false)
  const [fetchingStudents, setFetchingStudents] = useState(false)

  useEffect(() => {
    if (departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0]?.code || 'CSE')
    }
  }, [departments])

  useEffect(() => {
    const fetchStudents = async () => {
      setFetchingStudents(true)
      try {
        const res = await studentsAPI.list({ department: departmentId })
        const list = res.data || []
        setStudents(list)
        if (list.length > 0) {
          setSelectedStudentId(list[0].student_id || list[0].id)
        } else {
          setSelectedStudentId('')
        }
      } catch (_) {
        setStudents([])
      } finally {
        setFetchingStudents(false)
      }
    }
    if (departmentId) {
      fetchStudents()
    }
  }, [departmentId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const targetId = useCustom ? customStudentId.trim() : selectedStudentId
    if (!targetId) {
      toast.error('Please select or specify a Student ID')
      return
    }
    setLoading(true)
    try {
      await reportsAPI.generateStudent({
        student_id: targetId,
        department_id: departmentId,
        academic_year: academicYear,
        format,
      })
      toast.success(`Dossier for ${targetId} generated successfully!`)
      onGenerated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate student report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
          >
            {departments.map(d => (
              <option key={d.code || d.id} value={d.code || d.id}>
                {d.name} ({d.code || d.id})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="form-label" style={{ margin: 0 }}>Target Student</label>
            <button
              type="button"
              className="btn btn-link btn-xs"
              style={{ padding: 0, fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none' }}
              onClick={() => setUseCustom(!useCustom)}
            >
              {useCustom ? 'Pick from List' : 'Enter Custom ID'}
            </button>
          </div>
          {useCustom ? (
            <input
              type="text"
              className="form-input"
              placeholder="e.g. STU011"
              value={customStudentId}
              onChange={e => setCustomStudentId(e.target.value)}
              required
            />
          ) : (
            <select
              className="form-select"
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              disabled={fetchingStudents || students.length === 0}
            >
              {fetchingStudents ? (
                <option>Loading enrolled students…</option>
              ) : students.length === 0 ? (
                <option value="">No students found in this department</option>
              ) : (
                students.map(s => (
                  <option key={s.id || s.student_id} value={s.student_id || s.id}>
                    {s.student_id} — {s.name} (Sem {s.semester}, Sec {s.section})
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Academic Year</label>
          <select
            className="form-select"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
          >
            {['2025-26', '2024-25', '2023-24'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Output Format</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['pdf', 'docx', 'both'].map(f => (
            <button
              key={f}
              type="button"
              className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading || (!useCustom && !selectedStudentId)}
        >
          {loading ? 'Generating Dossier…' : 'Generate Student Dossier'}
        </button>
      </div>
    </form>
  )
}

// ── Sub-component: Faculty Appraisal Report Form ──────────────────────────────
function FacultyReportForm({ departments, onGenerated }) {
  const [departmentId, setDepartmentId]       = useState(departments[0]?.code || 'CSE')
  const [faculty, setFaculty]                 = useState([])
  const [selectedFacultyId, setSelectedFacultyId] = useState('')
  const [customFacultyId, setCustomFacultyId] = useState('')
  const [useCustom, setUseCustom]             = useState(false)
  const [academicYear, setAcademicYear]       = useState('2025-26')
  const [format, setFormat]                   = useState('both')
  const [loading, setLoading]                 = useState(false)
  const [fetchingFaculty, setFetchingFaculty] = useState(false)

  useEffect(() => {
    if (departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0]?.code || 'CSE')
    }
  }, [departments])

  useEffect(() => {
    const fetchFaculty = async () => {
      setFetchingFaculty(true)
      try {
        const res = await facultyAPI.list({ department: departmentId })
        const list = res.data || []
        setFaculty(list)
        if (list.length > 0) {
          setSelectedFacultyId(list[0].faculty_id || list[0].id)
        } else {
          setSelectedFacultyId('')
        }
      } catch (_) {
        setFaculty([])
      } finally {
        setFetchingFaculty(false)
      }
    }
    if (departmentId) {
      fetchFaculty()
    }
  }, [departmentId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const targetId = useCustom ? customFacultyId.trim() : selectedFacultyId
    if (!targetId) {
      toast.error('Please select or specify a Faculty ID')
      return
    }
    setLoading(true)
    try {
      await reportsAPI.generateFaculty({
        faculty_id: targetId,
        department_id: departmentId,
        academic_year: academicYear,
        format,
      })
      toast.success(`Appraisal report for ${targetId} generated successfully!`)
      onGenerated()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate faculty report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-3" style={{ gap: 14, marginBottom: 16 }}>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
          >
            {departments.map(d => (
              <option key={d.code || d.id} value={d.code || d.id}>
                {d.name} ({d.code || d.id})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label className="form-label" style={{ margin: 0 }}>Target Faculty Member</label>
            <button
              type="button"
              className="btn btn-link btn-xs"
              style={{ padding: 0, fontSize: '11px', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none' }}
              onClick={() => setUseCustom(!useCustom)}
            >
              {useCustom ? 'Pick from List' : 'Enter Custom ID'}
            </button>
          </div>
          {useCustom ? (
            <input
              type="text"
              className="form-input"
              placeholder="e.g. FAC001"
              value={customFacultyId}
              onChange={e => setCustomFacultyId(e.target.value)}
              required
            />
          ) : (
            <select
              className="form-select"
              value={selectedFacultyId}
              onChange={e => setSelectedFacultyId(e.target.value)}
              disabled={fetchingFaculty || faculty.length === 0}
            >
              {fetchingFaculty ? (
                <option>Loading faculty roster…</option>
              ) : faculty.length === 0 ? (
                <option value="">No faculty found in this department</option>
              ) : (
                faculty.map(f => (
                  <option key={f.id || f.faculty_id} value={f.faculty_id || f.id}>
                    {f.faculty_id} — {f.name} ({f.designation || 'Faculty'})
                  </option>
                ))
              )}
            </select>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Academic Year</label>
          <select
            className="form-select"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
          >
            {['2025-26', '2024-25', '2023-24'].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Output Format</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['pdf', 'docx', 'both'].map(f => (
            <button
              key={f}
              type="button"
              className={`btn btn-sm ${format === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={loading || (!useCustom && !selectedFacultyId)}
        >
          {loading ? 'Generating Appraisal…' : 'Generate Faculty Appraisal'}
        </button>
      </div>
    </form>
  )
}

// ── Sub-component: Criterion 4 Live Preview ───────────────────────────────────
function Criterion4PreviewSection({ previewData, academicYear, deptCode, onRefresh }) {
  const [narrativeText, setNarrativeText] = useState('')
  const [isEditing, setIsEditing]         = useState(false)
  const [saving, setSaving]               = useState(false)

  useEffect(() => {
    if (previewData?.subsections) {
      const sec462 = previewData.subsections.find(s => s.id === '4.6.2')
      if (sec462) setNarrativeText(sec462.narrative || '')
    }
  }, [previewData])

  const handleSaveNarrative = async () => {
    if (!narrativeText.trim()) return
    setSaving(true)
    try {
      await reportsAPI.saveNarrative('4.6.2', {
        department_id: deptCode,
        academic_year: academicYear,
        narrative_text: narrativeText,
        sar_format: 'ug_tier_ii_gapc_v4',
      })
      toast.success('Section 4.6.2 narrative updated')
      setIsEditing(false)
      onRefresh()
    } catch (_) {
      toast.error('Failed to save narrative')
    } finally {
      setSaving(false)
    }
  }

  if (!previewData) return null

  const totalMarks = previewData.max_marks || 150
  const computed = previewData.computed_marks_total || 0
  const pct = Math.round((computed / totalMarks) * 100)

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Summary Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.04)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Criterion 4 — Students' Performance (NBA SAR UG Tier-II)
            </h4>
            <Badge variant="success">Verified Academic Records</Badge>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
            Department of {deptCode} · {academicYear} · 9 Canonical Subsections
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Computed Score</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
              {computed} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {totalMarks} M ({pct}%)</span>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Subsections list */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {previewData.subsections?.map(sub => {
          const isNarrative = sub.id === '4.6.2'
          return (
            <div
              key={sub.id}
              style={{
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: 'var(--primary)',
                  }}>
                    {sub.id}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {sub.title}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant="neutral">Weight: {sub.marks_allocated} M</Badge>
                  <Badge variant="primary">{sub.marks_computed} / {sub.marks_allocated} M</Badge>
                </div>
              </div>

              <div style={{ padding: '12px 14px' }}>
                {isNarrative ? (
                  <div>
                    {isEditing ? (
                      <div>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          value={narrativeText}
                          onChange={e => setNarrativeText(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveNarrative}
                            disabled={saving}
                          >
                            <Save size={12} /> {saving ? 'Saving…' : 'Save Narrative'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsEditing(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                          {narrativeText || sub.narrative}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: 8 }}
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit3 size={12} /> Edit Narrative
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {sub.table_headers?.length > 0 && (
                      <div className="table-wrapper" style={{ margin: 0 }}>
                        <table className="data-table" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              {sub.table_headers.map((h, i) => (
                                <th key={i}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sub.table_rows?.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className={typeof cell === 'number' ? 'tabular-nums' : ''}>
                                    {cell !== null && cell !== undefined ? String(cell) : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-component: Report History Table ───────────────────────────────────────
function ReportHistoryTable({ reports, loading, onDownload, onRefresh }) {
  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No generated reports yet. Select a template above to generate your first accreditation report.
      </div>
    )
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Report Title</th>
            <th>Type</th>
            <th>Department</th>
            <th>Academic Year</th>
            <th>Generated On</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Exports</th>
          </tr>
        </thead>
        <tbody>
          {reports.map(rep => (
            <tr key={rep.report_id || rep.id}>
              <td style={{ fontWeight: 600 }}>{rep.title || `Report #${(rep.report_id || rep.id || '').toString().slice(0, 8)}`}</td>
              <td>
                <Badge variant="neutral">{rep.report_type || 'SAR'}</Badge>
              </td>
              <td>{rep.department_id || 'CSE'}</td>
              <td className="tabular-nums">{rep.academic_year || '2025-26'}</td>
              <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {rep.created_at ? new Date(rep.created_at).toLocaleDateString('en-IN') : 'Recent'}
              </td>
              <td>
                {rep.status === 'done' || rep.status === 'completed' ? (
                  <Badge variant="success">Completed</Badge>
                ) : rep.status === 'error' || rep.status === 'failed' ? (
                  <Badge variant="danger">Failed{rep.error_msg ? `: ${rep.error_msg.slice(0, 40)}` : ''}</Badge>
                ) : (
                  <Badge variant="warning">Processing</Badge>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {(rep.status === 'done' || rep.status === 'completed') ? (
                  <div style={{ display: 'inline-flex', gap: 6 }}>
                    {rep.has_pdf !== false && (
                      <button
                        type="button"
                        onClick={() => onDownload(rep.report_id, rep.title, 'pdf')}
                        className="btn btn-secondary btn-sm"
                        title="Download PDF"
                      >
                        <Download size={12} />
                        <span>PDF</span>
                      </button>
                    )}
                    {rep.has_docx !== false && (
                      <button
                        type="button"
                        onClick={() => onDownload(rep.report_id, rep.title, 'docx')}
                        className="btn btn-secondary btn-sm"
                        title="Download Word Document"
                      >
                        <Download size={12} />
                        <span>DOCX</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
