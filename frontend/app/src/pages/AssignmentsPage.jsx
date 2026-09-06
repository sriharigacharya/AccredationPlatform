import React, { useEffect, useState, useMemo } from 'react'
import { assignmentsAPI } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Plus, FileText, Briefcase, Users, Trash2,
  ChevronDown, ChevronUp, Clock, CheckCircle2,
  BookOpen, Upload, Download, ExternalLink, AlertCircle,
  FileCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import EmptyState from '../components/EmptyState'

export default function AssignmentsPage() {
  const { user }                      = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [expandedId, setExpandedId]   = useState(null)
  const [expandedStudents, setExpandedStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  // Student Submission Modal State
  const [submitModalAssignment, setSubmitModalAssignment] = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [submissionText, setSubmissionText] = useState('')
  const [submissionFile, setSubmissionFile] = useState(null)

  // Filtering State
  const [selectedCourse, setSelectedCourse] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

  const isFaculty = user?.role === 'admin' || user?.role === 'teacher'
  const isStudent = user?.role === 'student'

  const fetchAssignments = () => {
    setLoading(true)
    const params = isFaculty ? { faculty_id: user?.linked_id || '' } : { student_id: 'me' }
    assignmentsAPI.list(params)
      .then(r => {
        setAssignments(r.data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load assignments:', err)
        toast.error('Could not load course assignments')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchAssignments()
  }, [user])

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (isFaculty) {
      setLoadingStudents(true)
      try {
        const { data } = await assignmentsAPI.students(id)
        setExpandedStudents(data.students || [])
      } catch (err) {
        console.error('Failed to fetch students:', err)
        setExpandedStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this course assignment?')) return
    try {
      await assignmentsAPI.delete(id)
      toast.success('Assignment removed')
      fetchAssignments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  const handleOpenSubmitModal = (assignment) => {
    setSubmitModalAssignment(assignment)
    setSubmissionText(assignment.submission?.submission_text || '')
    setSubmissionFile(null)
  }

  const handleDownloadAttachment = async (filename, originalName) => {
    if (!filename) return
    const t = toast.loading('Downloading solution file…')
    try {
      const res = await assignmentsAPI.downloadSubmission(filename)
      const blob = new Blob([res.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = originalName || filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.dismiss(t)
    } catch (err) {
      toast.error('Failed to download solution attachment', { id: t })
    }
  }

  const handleSubmitWork = async (e) => {
    e.preventDefault()
    if (!submitModalAssignment) return
    if (!submissionText.trim() && !submissionFile) {
      toast.error('Please provide writeup/repository link or attach a solution file')
      return
    }

    setSubmitting(true)
    const t = toast.loading('Turning in assignment…')
    try {
      let payload
      let isMultipart = false
      if (submissionFile) {
        const formData = new FormData()
        formData.append('submission_text', submissionText.trim())
        formData.append('file', submissionFile)
        payload = formData
        isMultipart = true
      } else {
        payload = { submission_text: submissionText.trim() }
      }

      await assignmentsAPI.submit(submitModalAssignment.id, payload, isMultipart)
      toast.success('Assignment solution turned in successfully!', { id: t })
      setSubmitModalAssignment(null)
      fetchAssignments()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit assignment', { id: t })
    } finally {
      setSubmitting(false)
    }
  }

  // Extract unique courses for filtering
  const courseList = useMemo(() => {
    const set = new Set()
    assignments.forEach(a => {
      const code = a.course_code || 'GEN'
      set.add(code)
    })
    return Array.from(set)
  }, [assignments])

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const matchesCourse = selectedCourse === 'ALL' || (a.course_code || 'GEN') === selectedCourse
      if (!matchesCourse) return false

      if (isStudent && selectedStatus !== 'ALL') {
        if (selectedStatus === 'SUBMITTED') return a.is_submitted
        if (selectedStatus === 'PENDING') return !a.is_submitted
      }
      return true
    })
  }, [assignments, selectedCourse, selectedStatus, isStudent])

  // Aggregate Stats
  const stats = useMemo(() => {
    const hw = assignments.filter(a => a.type === 'homework').length
    const pj = assignments.filter(a => a.type === 'project').length
    const submittedCount = assignments.filter(a => a.is_submitted).length
    const pendingCount = assignments.length - submittedCount
    const upcoming = assignments.filter(a => a.due_date && new Date(a.due_date) > new Date()).length
    const overdue = assignments.filter(a => a.due_date && new Date(a.due_date) <= new Date()).length
    return {
      total: assignments.length,
      hw,
      pj,
      submittedCount,
      pendingCount,
      upcoming,
      overdue,
    }
  }, [assignments])

  return (
    <div>
      <PageHeader
        category="Academic Operations"
        title={isStudent ? "My Coursework & Assignment Submissions" : "Coursework, Projects & Continuous Tasks"}
        description={
          isStudent
            ? "Submit solutions to coursework and experiential projects assigned by your subject faculty, attach proof documents, and track evaluation feedback."
            : "Issue structured homework, experiential learning mini-projects, and track student submission compliance across cohorts."
        }
        actions={
          isFaculty && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <Plus size={14} />
              <span>Create Assignment</span>
            </button>
          )
        }
      />

      <div className="page-body">
        {/* ── Summary Stats ── */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard
            label={isStudent ? "Total Assigned Tasks" : "Total Active Tasks"}
            value={stats.total}
            subtext="Across all semester subjects"
            icon={FileText}
            variant="primary"
          />
          {isStudent ? (
            <>
              <StatCard
                label="Pending Submissions"
                value={stats.pendingCount}
                subtext="Action required before due date"
                icon={Clock}
                variant={stats.pendingCount > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Completed Submissions"
                value={stats.submittedCount}
                subtext="Successfully turned in to faculty"
                icon={CheckCircle2}
                variant="success"
              />
              <StatCard
                label="Capstone Projects"
                value={stats.pj}
                subtext="Experiential learning modules"
                icon={Briefcase}
                variant="purple"
              />
            </>
          ) : (
            <>
              <StatCard
                label="Homework Tasks"
                value={stats.hw}
                subtext="Theory & problem sets"
                icon={BookOpen}
                variant="default"
              />
              <StatCard
                label="Capstone Projects"
                value={stats.pj}
                subtext="Experiential learning modules"
                icon={Briefcase}
                variant="purple"
              />
              <StatCard
                label="Active Submissions"
                value={stats.upcoming}
                subtext={`${stats.overdue} Past Deadline`}
                icon={Clock}
                variant={stats.overdue > 0 ? "warning" : "success"}
              />
            </>
          )}
        </div>

        {/* ── Filter Controls ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 'var(--space-4)',
          backgroundColor: 'var(--bg-surface)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
              Subject Filter:
            </span>
            <button
              type="button"
              className={`btn btn-xs ${selectedCourse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCourse('ALL')}
            >
              All Subjects
            </button>
            {courseList.map(cCode => (
              <button
                key={cCode}
                type="button"
                className={`btn btn-xs ${selectedCourse === cCode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedCourse(cCode)}
              >
                {cCode}
              </button>
            ))}
          </div>

          {isStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                Status:
              </span>
              <button
                type="button"
                className={`btn btn-xs ${selectedStatus === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedStatus === 'PENDING' ? 'btn-warning' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('PENDING')}
              >
                Pending ({stats.pendingCount})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${selectedStatus === 'SUBMITTED' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => setSelectedStatus('SUBMITTED')}
              >
                Submitted ({stats.submittedCount})
              </button>
            </div>
          )}
        </div>

        {/* ── Assignment List ── */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading coursework and task rosters…</p>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={isStudent ? "No Tasks Pending" : "No Assignments Posted"}
            description={
              isStudent
                ? "You have no active coursework matching the selected filter criteria."
                : "Create homework problem sets or experiential learning project briefs for your students."
            }
            action={
              isFaculty && (
                <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                  <Plus size={14} /> Create Assignment
                </button>
              )
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredAssignments.map(a => {
              const isOverdue = a.due_date && new Date(a.due_date) <= new Date()
              const isExpanded = expandedId === a.id
              const isProject = a.type === 'project'
              const submission = a.submission

              return (
                <div key={a.id} className="card" style={{ padding: 0, overflow: 'hidden', transition: 'box-shadow 0.15s ease' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                    onClick={() => toggleExpand(a.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 280 }}>
                      <div style={{
                        width: 42,
                        height: 42,
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isProject ? 'var(--purple-subtle)' : 'var(--primary-subtle)',
                        color: isProject ? 'var(--purple)' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isProject ? <Briefcase size={20} /> : <FileText size={20} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                            {a.title}
                          </span>
                          <Badge variant={isProject ? 'purple' : 'primary'}>
                            {isProject ? 'Capstone Project' : 'Homework'}
                          </Badge>
                          {a.course_code && (
                            <Badge variant="neutral">
                              {a.course_code} {a.course_name ? `· ${a.course_name}` : ''}
                            </Badge>
                          )}
                          {isFaculty && (
                            <Badge variant="neutral">
                              {a.target_type === 'batch' ? `Semester ${a.target_id}` : a.target_type === 'section' ? `Section ${a.target_id}` : a.target_id}
                            </Badge>
                          )}
                          {isStudent && (
                            a.is_submitted ? (
                              <Badge variant="success" icon={CheckCircle2}>Turned In</Badge>
                            ) : isOverdue ? (
                              <Badge variant="danger" icon={AlertCircle}>Past Due</Badge>
                            ) : (
                              <Badge variant="warning" icon={Clock}>Pending Submission</Badge>
                            )
                          )}
                        </div>

                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                          Faculty Instructor: <strong style={{ color: 'var(--text-primary)' }}>{a.faculty_name || a.faculty_id}</strong>
                          {a.description && ` — ${a.description.slice(0, 90)}${a.description.length > 90 ? '…' : ''}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Due Date</div>
                        <div style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: isOverdue ? 'var(--danger)' : 'var(--text-primary)'
                        }}>
                          {a.due_date ? new Date(a.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}
                        </div>
                      </div>

                      {/* Student Action: Turn in button right on the card */}
                      {isStudent && (
                        <div onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`btn btn-sm ${a.is_submitted ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={() => handleOpenSubmitModal(a)}
                          >
                            <Upload size={14} />
                            <span>{a.is_submitted ? 'Resubmit / Edit' : 'Submit Assignment'}</span>
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isFaculty && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                            className="btn btn-ghost btn-icon"
                            style={{ color: 'var(--danger)' }}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--text-muted)' }}
                          title="Toggle details"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section: Student view of their submission OR Faculty view of entire cohort roster */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-subtle)',
                      padding: '16px 20px',
                    }}>
                      {isStudent ? (
                        <div>
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                              Task Instructions & Rubric
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                              {a.description || 'No extended task instructions provided. Refer to classroom curriculum discussion.'}
                            </p>
                          </div>

                          <div style={{
                            backgroundColor: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '14px 16px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FileCheck size={16} color="var(--primary)" />
                                <span>My Submission Status</span>
                              </div>
                              {submission ? (
                                <Badge variant="success" icon={CheckCircle2}>
                                  Submitted on {new Date(submission.submitted_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </Badge>
                              ) : (
                                <Badge variant="warning" icon={Clock}>Pending Submission</Badge>
                              )}
                            </div>

                            {submission ? (
                              <div style={{ fontSize: '13px' }}>
                                {submission.submission_text && (
                                  <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: 2 }}>Submitted Solution / Notes:</div>
                                    <div style={{
                                      padding: '8px 12px',
                                      backgroundColor: 'var(--bg-subtle)',
                                      borderRadius: 'var(--radius-xs)',
                                      fontFamily: submission.submission_text.startsWith('http') ? 'var(--font-mono)' : 'inherit',
                                      fontSize: '12.5px',
                                      wordBreak: 'break-word',
                                    }}>
                                      {submission.submission_text.startsWith('http') ? (
                                        <a href={submission.submission_text} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          <span>{submission.submission_text}</span>
                                          <ExternalLink size={12} />
                                        </a>
                                      ) : (
                                        submission.submission_text
                                      )}
                                    </div>
                                  </div>
                                )}

                                {submission.attachment_path && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Attached Solution Document:</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAttachment(submission.attachment_path, submission.original_filename)}
                                      className="btn btn-secondary btn-xs"
                                    >
                                      <Download size={13} />
                                      <span>{submission.original_filename || 'Download Proof'}</span>
                                    </button>
                                  </div>
                                )}

                                {submission.grade && (
                                  <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: 'var(--success-subtle)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--success-border)' }}>
                                    <strong>Evaluated Grade:</strong> {submission.grade}
                                    {submission.feedback && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>— Feedback: {submission.feedback}</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                                You have not submitted work for this task yet. Click "Submit Assignment" to turn in your solution.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Faculty Expanded View: Student Roster */
                        <div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                            fontSize: '12.5px',
                            fontWeight: 600,
                          }}>
                            <span>Student Submissions ({expandedStudents.filter(s => s.submitted).length} / {expandedStudents.length} Turned In)</span>
                            <span style={{ color: 'var(--text-muted)' }}>Continuous Evaluation Matrix</span>
                          </div>

                          {loadingStudents ? (
                            <div style={{ padding: '16px', textAlign: 'center' }}>
                              <div className="spinner spinner-sm" />
                            </div>
                          ) : expandedStudents.length === 0 ? (
                            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', padding: '8px 0' }}>
                              No students currently enrolled in this target group.
                            </div>
                          ) : (
                            <div className="table-wrapper" style={{ margin: 0, maxHeight: 250, overflowY: 'auto' }}>
                              <table className="data-table" style={{ fontSize: '12px' }}>
                                <thead>
                                  <tr>
                                    <th>Roll Number</th>
                                    <th>Student Name</th>
                                    <th>Status</th>
                                    <th>Submitted Date</th>
                                    <th>Submission Content / Solution</th>
                                    <th>Attachment</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedStudents.map(s => (
                                    <tr key={s.student_id}>
                                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.student_id}</td>
                                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                                      <td>
                                        {s.submitted ? (
                                          <Badge variant="success" icon={CheckCircle2}>Submitted</Badge>
                                        ) : (
                                          <Badge variant="warning" icon={Clock}>Pending</Badge>
                                        )}
                                      </td>
                                      <td style={{ color: 'var(--text-muted)' }}>
                                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                      </td>
                                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.submission_text ? (
                                          s.submission_text.startsWith('http') ? (
                                            <a href={s.submission_text} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                                              {s.submission_text}
                                            </a>
                                          ) : (
                                            s.submission_text
                                          )
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                                        )}
                                      </td>
                                      <td>
                                        {s.attachment_path ? (
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadAttachment(s.attachment_path, s.original_filename)}
                                            className="btn btn-secondary btn-xs"
                                            title="Download submission file"
                                          >
                                            <Download size={12} />
                                            <span>{s.original_filename || 'Download'}</span>
                                          </button>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Student Submit Assignment Modal ── */}
        <Modal
          isOpen={Boolean(submitModalAssignment)}
          onClose={() => setSubmitModalAssignment(null)}
          title={`Turn In Work: ${submitModalAssignment?.title || ''}`}
          maxWidth={560}
        >
          {submitModalAssignment && (
            <form onSubmit={handleSubmitWork}>
              <div style={{
                backgroundColor: 'var(--bg-subtle)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
                fontSize: '12.5px',
                border: '1px solid var(--border-default)',
              }}>
                <div><strong>Subject:</strong> {submitModalAssignment.course_code} {submitModalAssignment.course_name ? `· ${submitModalAssignment.course_name}` : ''}</div>
                <div><strong>Faculty:</strong> {submitModalAssignment.faculty_name || submitModalAssignment.faculty_id}</div>
                <div><strong>Due Date:</strong> {submitModalAssignment.due_date ? new Date(submitModalAssignment.due_date).toLocaleDateString('en-IN') : 'None'}</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Solution Notes, Answers or Project URL (GitHub, Drive, Colab)
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Paste GitHub repository link, cloud drive document URL, or write your solution notes here…"
                  value={submissionText}
                  onChange={e => setSubmissionText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Upload Solution Attachment (PDF, ZIP, DOCX, Code Archive)
                </label>
                <input
                  type="file"
                  className="form-input"
                  onChange={e => setSubmissionFile(e.target.files?.[0] || null)}
                  accept=".pdf,.docx,.doc,.zip,.tar,.gz,.py,.java,.cpp,.c,.txt,.ipynb"
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  Maximum file size: 25MB. Accepted formats: PDF, Code, Archive, Word document.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setSubmitModalAssignment(null)}
                  className="btn btn-secondary btn-sm"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-sm"
                >
                  <Upload size={14} />
                  <span>{submitting ? 'Turning In…' : 'Submit Assignment'}</span>
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* ── Faculty Create Assignment Modal ── */}
        <Modal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title="Create New Course Assignment"
          maxWidth={560}
        >
          <CreateAssignmentForm onClose={() => { setShowForm(false); fetchAssignments(); }} />
        </Modal>
      </div>
    </div>
  )
}

function CreateAssignmentForm({ onClose }) {
  const [title, setTitle]           = useState('')
  const [type, setType]             = useState('homework')
  const [courseCode, setCourseCode] = useState('CS3C01')
  const [courseName, setCourseName] = useState('Data Structures & Algorithms')
  const [targetType, setTargetType] = useState('section')
  const [targetId, setTargetId]     = useState('A')
  const [dueDate, setDueDate]       = useState('')
  const [desc, setDesc]             = useState('')
  const [loading, setLoading]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setLoading(true)
    try {
      await assignmentsAPI.create({
        title: title.trim(),
        type,
        course_code: courseCode.trim(),
        course_name: courseName.trim(),
        target_type: targetType,
        target_id: targetId,
        due_date: dueDate || undefined,
        description: desc.trim() || undefined,
      })
      toast.success('Assignment published to students')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create assignment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Task Type</label>
          <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="homework">Homework / Problem Set</option>
            <option value="project">Capstone Project (EL)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Course Code</label>
          <input
            type="text"
            className="form-input"
            required
            value={courseCode}
            placeholder="e.g. CS3C01"
            onChange={e => setCourseCode(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Course Name</label>
        <input
          type="text"
          className="form-input"
          value={courseName}
          placeholder="e.g. Data Structures & Algorithms"
          onChange={e => setCourseName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Assignment Title *</label>
        <input
          type="text"
          className="form-input"
          required
          placeholder="e.g. Implementation of Graph Shortest Path Algorithms"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div className="grid-3" style={{ gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Target Audience</label>
          <select className="form-select" value={targetType} onChange={e => setTargetType(e.target.value)}>
            <option value="section">Specific Section</option>
            <option value="batch">Entire Semester</option>
            <option value="student">Single Student</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Target ID (Sec/Sem/ID)</label>
          <input
            type="text"
            className="form-input"
            required
            placeholder="e.g. A or 3 or STU001"
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Due Date</label>
          <input
            type="date"
            className="form-input"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Task Instructions & Rubric</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Provide evaluation criteria, problem statement, formatting guidelines, or GitHub repository guidelines…"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
          {loading ? 'Publishing…' : 'Publish Assignment'}
        </button>
      </div>
    </form>
  )
}
