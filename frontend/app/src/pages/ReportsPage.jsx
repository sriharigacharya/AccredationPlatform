import React, { useState, useEffect, useRef } from 'react'
import { reportsAPI, departmentsAPI, eventsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  FileText, Cpu, Clock, Download, RefreshCw,
  ChevronRight, AlertTriangle, CheckCircle, Loader,
  ClipboardList, Sparkles, CheckSquare, Square, Calendar,
  MapPin, Users, Info, Award, Image, Eye, Edit3, Save, Check
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
  const [approvedEvents, setApprovedEvents] = useState([])
  const [selectedEventIds, setSelectedEventIds] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [criteriaList, setCriteriaList] = useState([])
  const [loadingCriteria, setLoadingCriteria] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)


  // Default fallback criteria list (9 root criteria) if API is loading
  const defaultCriteria = [
    { id: '1', criterion_number: 1, title: 'Outcome-Based Curriculum', marks: 120, is_implemented: false, scope: 'criterion:1', tooltip: 'Not yet available — Coming Soon' },
    { id: '2', criterion_number: 2, title: 'Outcome-Based Teaching Learning Processes', marks: 120, is_implemented: false, scope: 'criterion:2', tooltip: 'Not yet available — Coming Soon' },
    { id: '3', criterion_number: 3, title: 'Outcome-Based Assessment', marks: 120, is_implemented: false, scope: 'criterion:3', tooltip: 'Not yet available — Coming Soon' },
    { id: '4', criterion_number: 4, title: "Students' Performance", marks: 150, is_implemented: true, scope: 'criterion:4', tooltip: 'Available for report generation' },
    { id: '5', criterion_number: 5, title: 'Faculty Information and Contributions', marks: 100, is_implemented: false, scope: 'criterion:5', tooltip: 'Not yet available — Coming Soon' },
    { id: '6', criterion_number: 6, title: 'Faculty Contributions', marks: 120, is_implemented: false, scope: 'criterion:6', tooltip: 'Not yet available — Coming Soon' },
    { id: '7', criterion_number: 7, title: 'Facilities and Technical Support', marks: 80, is_implemented: false, scope: 'criterion:7', tooltip: 'Not yet available — Coming Soon' },
    { id: '8', criterion_number: 8, title: 'Continuous Improvement', marks: 70, is_implemented: false, scope: 'criterion:8', tooltip: 'Not yet available — Coming Soon' },
    { id: '9', criterion_number: 9, title: 'Student Support System and Governance', marks: 120, is_implemented: false, scope: 'criterion:9', tooltip: 'Not yet available — Coming Soon' },
  ]

  // Fetch dynamic criteria list directly from tree definitions
  useEffect(() => {
    let active = true
    setLoadingCriteria(true)
    reportsAPI.getCriteria(form.sar_format)
      .then(res => {
        if (!active) return
        const list = res.data?.criteria
        if (Array.isArray(list) && list.length > 0) {
          setCriteriaList(list)
        }
      })
      .catch(err => {
        console.error('Failed to fetch criteria list:', err)
      })
      .finally(() => {
        if (active) setLoadingCriteria(false)
      })
    return () => { active = false }
  }, [form.sar_format])

  const activeCriteria = criteriaList.length > 0 ? criteriaList : defaultCriteria
  const isCriterion4 = form.scope === 'full' || form.scope === 'criterion:4'


  // Fetch approved events for the selected academic year & department
  useEffect(() => {
    if (!isCriterion4) return
    let active = true
    setLoadingEvents(true)
    eventsAPI.list({ status: 'approved', academic_year: form.academic_year })
      .then(async res => {
        if (!active) return
        let evs = res.data || []
        if (evs.length === 0) {
          try {
            const fb = await eventsAPI.list({ status: 'approved' })
            evs = fb.data || []
          } catch (_) {}
        }
        setApprovedEvents(evs)
        // Default to all approved selected for detailed treatment
        setSelectedEventIds(prev => prev.length > 0 ? prev.filter(id => evs.some(e => e.id === id)) : evs.map(e => e.id))
      })
      .catch(err => {
        console.error('Failed to load approved events:', err)
      })
      .finally(() => {
        if (active) setLoadingEvents(false)
      })

    return () => { active = false }
  }, [isCriterion4, form.academic_year, form.department_id])

  function toggleEvent(id) {
    setSelectedEventIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function selectAllEvents() {
    setSelectedEventIds(approvedEvents.map(e => e.id))
  }

  function clearAllEvents() {
    setSelectedEventIds([])
  }

  async function handleFetchPreview() {
    if (!form.department_id) {
      toast.error('Select a department first')
      return
    }
    setLoadingPreview(true)
    setShowPreview(true)
    try {
      const res = await reportsAPI.previewCriterion4({
        department_id: form.department_id,
        academic_year: form.academic_year,
        include_event_ids: selectedEventIds.join(','),
      })
      setPreviewData(res.data)
      toast.success('Criterion 4 preview generated!')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.department_id) { toast.error('Select a department'); return }
    setLoading(true)
    try {
      const payload = {
        ...form,
        include_event_ids: isCriterion4 ? selectedEventIds : [],
      }
      const res = await reportsAPI.generateNba(payload)
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
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Scope</span>
            {loadingCriteria && <small style={{ color: 'var(--text-muted)' }}>Syncing criteria…</small>}
          </label>
          <select
            className="form-select"
            value={form.scope}
            onChange={e => setForm(p => ({ ...p, scope: e.target.value }))}
          >
            <option value="full">Full SAR (all 9 criteria)</option>
            <optgroup label="Individual Criteria (1–9)">
              {activeCriteria.map(c => {
                const isAvail = c.is_implemented
                const num = c.criterion_number || c.id
                const label = `Criterion ${num} — ${c.title} (${c.marks} marks)${isAvail ? '' : ' [Coming Soon]'}`
                const tip = c.tooltip || (isAvail ? 'Available for report generation' : 'Not yet available — Coming Soon')
                return (
                  <option
                    key={c.id || num}
                    value={c.scope || `criterion:${num}`}
                    disabled={!isAvail}
                    title={tip}
                    style={!isAvail ? { color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic' } : { fontWeight: 600 }}
                  >
                    {label}
                  </option>
                )
              })}
            </optgroup>
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

      {/* ── Event Selection for Detailed Summary Sheets (Criterion 4) ── */}
      {isCriterion4 && (
        <div style={{
          marginTop: 18,
          marginBottom: 16,
          padding: 16,
          background: 'var(--surface-sunken, #f8fafc)',
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={18} style={{ color: 'var(--primary, #3b82f6)' }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Include Events for Detailed Treatment (Section 4.6.1)
              </h4>
              <span className="badge badge-blue" style={{ fontSize: 11 }}>
                {selectedEventIds.length} / {approvedEvents.length} selected
              </span>
            </div>
            {approvedEvents.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-xs btn-outline" onClick={selectAllEvents}>
                  <CheckSquare size={11} /> Select All
                </button>
                <button type="button" className="btn btn-xs btn-ghost" onClick={clearAllEvents}>
                  <Square size={11} /> Clear
                </button>
              </div>
            )}
          </div>

          <div style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'var(--surface, #ffffff)',
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #e2e8f0)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}>
            <Info size={14} style={{ color: 'var(--primary, #3b82f6)', flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>NBA SAR Rule:</strong> All mentor-approved club & college events appear in the compact Layer 1 summary table.
              Checked events below will additionally receive a full detailed <strong>Summary Sheet</strong> (with PO mapping, resource person, outcomes, and event photos) in Section 4.6.1.
            </span>
          </div>

          {loadingEvents ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading approved events…
            </div>
          ) : approvedEvents.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
              No approved events found for academic year {form.academic_year}. The compact table will still render normally.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {approvedEvents.map(ev => {
                const isSelected = selectedEventIds.includes(ev.id)
                return (
                  <div
                    key={ev.id}
                    onClick={() => toggleEvent(ev.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 10,
                      borderRadius: 6,
                      background: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'var(--surface, #ffffff)',
                      border: `1.5px solid ${isSelected ? 'var(--primary, #3b82f6)' : 'var(--border-color, #e2e8f0)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by card click
                      style={{ marginTop: 3, cursor: 'pointer' }}
                    />
                    {ev.thumbnail_url ? (
                      <img
                        src={ev.thumbnail_url}
                        alt="Event"
                        style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 4,
                        background: 'var(--surface-sunken, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        flexShrink: 0,
                      }}>
                        <Award size={20} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ev.title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span className="badge badge-purple" style={{ fontSize: 10, padding: '1px 5px' }}>
                          {ev.event_type}
                        </span>
                        <span className="badge" style={{ fontSize: 10, padding: '1px 5px' }}>
                          {ev.club_name || `Club #${ev.club_id}`}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <Calendar size={11} /> {(ev.event_date || '').slice(0, 10)}
                        </span>
                        {ev.attendee_count && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                            <Users size={11} /> {ev.attendee_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>

        <button type="submit" className="btn btn-primary" id="btn-generate-nba" disabled={loading}>
          {loading
            ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            : <><FileText size={14} /> Generate SAR Report</>}
        </button>

        {isCriterion4 && (
          <button
            type="button"
            className="btn btn-secondary"
            id="btn-preview-c4"
            disabled={loadingPreview}
            onClick={handleFetchPreview}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {loadingPreview
              ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading Preview…</>
              : <><Eye size={14} /> Live Preview Criterion 4 (150 Marks)</>}
          </button>
        )}
      </div>

      {/* ── Criterion 4 Interactive Preview Section ── */}
      {showPreview && isCriterion4 && (
        <Criterion4PreviewSection
          previewData={previewData}
          loading={loadingPreview}
          academicYear={form.academic_year}
          deptCode={form.department_id || 'CSE'}
          onRefresh={handleFetchPreview}
        />
      )}
    </form>
  )
}


// ── Criterion 4 Live Preview Component ────────────────────────────────────────

function Criterion4PreviewSection({ previewData, loading, academicYear, deptCode, onRefresh }) {
  const [narrativeText, setNarrativeText] = useState('')
  const [savingNarrative, setSavingNarrative] = useState(false)
  const [isEditingNarrative, setIsEditingNarrative] = useState(false)

  // Sync 4.6.2 narrative from preview
  useEffect(() => {
    if (previewData?.subsections) {
      const sec462 = previewData.subsections.find(s => s.id === '4.6.2')
      if (sec462) {
        setNarrativeText(sec462.narrative || '')
      }
    }
  }, [previewData])

  async function handleSaveNarrative() {
    if (!narrativeText.trim()) {
      toast.error('Narrative text cannot be empty')
      return
    }
    setSavingNarrative(true)
    try {
      await reportsAPI.saveNarrative('4.6.2', {
        department_id: deptCode,
        academic_year: academicYear,
        narrative_text: narrativeText,
        sar_format: 'ug_tier_ii_gapc_v4',
      })
      toast.success('Section 4.6.2 narrative saved successfully!')
      setIsEditingNarrative(false)
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save narrative')
    } finally {
      setSavingNarrative(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        marginTop: 24,
        padding: 32,
        background: 'var(--surface, #ffffff)',
        borderRadius: 8,
        border: '1px solid var(--border-color, #e2e8f0)',
        textAlign: 'center',
      }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary, #3b82f6)', marginBottom: 8 }} />
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Compiling Criterion 4 SAR Tree Preview…</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Calculating verified admission ratios, success indices, APIs, and placement scores</div>
      </div>
    )
  }

  if (!previewData) return null

  const totalMarks = previewData.max_marks || 150
  const computedMarks = previewData.computed_marks_total || 0
  const pct = Math.round((computedMarks / totalMarks) * 100)

  return (
    <div style={{
      marginTop: 24,
      background: 'var(--surface, #ffffff)',
      borderRadius: 8,
      border: '1px solid var(--border-color, #e2e8f0)',
      overflow: 'hidden',
    }}>
      {/* ── Header Summary ── */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(99, 102, 241, 0.05))',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Criterion 4 — Students' Performance (NBA SAR UG Tier-II)
            </h3>
            <span className="badge badge-blue">Verified Data</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Department: <strong>{deptCode}</strong> | Academic Year: <strong>{academicYear}</strong> | 9 Canonical Subsections
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Total Score
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary, #3b82f6)' }}>
              {computedMarks} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>/ {totalMarks} Marks ({pct}%)</span>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRefresh} title="Refresh Preview">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Subsections List in Canonical Order ── */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {previewData.subsections?.map((sub, idx) => {
          const isNarrative = sub.id === '4.6.2'
          const isEvents = sub.id === '4.6.1'

          return (
            <div
              key={sub.id}
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 6,
                background: 'var(--surface-sunken, #f8fafc)',
                overflow: 'hidden',
              }}
            >
              {/* Section Header */}
              <div style={{
                padding: '10px 14px',
                background: 'var(--surface, #ffffff)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--primary, #3b82f6)',
                    fontWeight: 700,
                    fontSize: 12,
                  }}>
                    {sub.id}
                  </span>
                  <div>
                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{sub.title}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Weight: {sub.marks_allocated} Marks | Format: {sub.content_type}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {sub.has_placeholders ? (
                    <span className="badge badge-yellow" style={{ fontSize: 11 }}>Data not available</span>
                  ) : (
                    <span className="badge badge-green" style={{ fontSize: 11 }}>
                      <Check size={10} /> Verified
                    </span>
                  )}
                  <span className="badge badge-purple" style={{ fontSize: 12, fontWeight: 700 }}>
                    {sub.marks_computed} / {sub.marks_allocated} M
                  </span>
                </div>
              </div>

              {/* Section Body */}
              <div style={{ padding: 12 }}>
                {/* 4.6.2 Narrative Editor */}
                {isNarrative ? (
                  <div>
                    {isEditingNarrative ? (
                      <div>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          value={narrativeText}
                          onChange={e => setNarrativeText(e.target.value)}
                          placeholder="Author publication details, magazine issues, newsletters, editorial board members, and student contributions…"
                          style={{ width: '100%', fontSize: 13 }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={handleSaveNarrative}
                            disabled={savingNarrative}
                          >
                            {savingNarrative ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />} Save Narrative
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-ghost"
                            onClick={() => setIsEditingNarrative(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {narrativeText || sub.narrative}
                        </p>
                        <button
                          type="button"
                          className="btn btn-xs btn-outline"
                          onClick={() => setIsEditingNarrative(true)}
                          style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Edit3 size={11} /> Edit Publication Narrative
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Tables for other 8 sections */
                  <div>
                    {sub.table_headers?.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 12, margin: 0 }}>
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
                                  <td key={cIdx}>
                                    {typeof cell === 'number' ? cell : String(cell ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 4.6.1 Summary Sheets Preview */}
                    {isEvents && sub.summary_sheets?.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                          Layer 2 Detailed Summary Sheets ({sub.summary_sheets.length} Selected Events):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                          {sub.summary_sheets.map((sheet, sIdx) => (
                            <div key={sIdx} style={{
                              padding: 8,
                              borderRadius: 4,
                              background: 'var(--surface, #ffffff)',
                              border: '1px solid var(--border-color, #e2e8f0)',
                              fontSize: 11,
                            }}>
                              <div style={{ fontWeight: 600, color: 'var(--primary, #3b82f6)' }}>{sheet.title}</div>
                              <div style={{ color: 'var(--text-secondary)' }}>Resource: {sheet.resource_person || '—'}</div>
                              <div style={{ color: 'var(--text-secondary)' }}>Photos: {sheet.photos?.length || 0} attached</div>
                            </div>
                          ))}
                        </div>
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
