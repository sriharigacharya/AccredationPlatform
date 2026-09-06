import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { studentsAPI, facultyAPI, ragAPI, predictAPI, classesAPI } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  Users, GraduationCap, FileText, AlertTriangle, TrendingUp,
  BookOpen, ShieldAlert, ArrowRight, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      fontSize: '12px',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{p.name}:</span>
          <strong className="tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {p.value}{p.name.includes('Rate') || p.name.includes('%') ? '%' : ''}
          </strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user }               = useAuth()
  const [stats, setStats]      = useState(null)
  const [facStats, setFacStats]= useState(null)
  const [ragStats, setRagStats]= useState(null)
  const [atRisk, setAtRisk]    = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [teacherClasses, setTeacherClasses] = useState([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      studentsAPI.stats().catch(() => null),
      facultyAPI.stats().catch(() => null),
      ragAPI.stats().catch(() => null),
      predictAPI.atRisk(0.6).catch(() => ({ data: { at_risk: [] } })),
      studentsAPI.list({}).catch(() => ({ data: [] })),
      classesAPI.myClasses().catch(() => ({ data: [] })),
    ]).then(([s, f, r, ar, stu, cls]) => {
      setStats(s?.data)
      setFacStats(f?.data)
      setRagStats(r?.data)
      setAtRisk(ar?.data?.at_risk || [])
      setAllStudents(stu?.data || [])
      setTeacherClasses(cls?.data || [])
      setLoading(false)
    })
  }, [])

  const teacherAtRiskCount = useMemo(() => {
    return teacherClasses.reduce((sum, c) => sum + (c.at_risk_count || 0), 0)
  }, [teacherClasses])

  const engagementData = useMemo(() => {
    if (!allStudents.length) return [
      { name: 'High', value: 0 },
      { name: 'Medium', value: 0 },
      { name: 'Low', value: 0 },
    ]
    const counts = { High: 0, Medium: 0, Low: 0 }
    allStudents.forEach(s => { if (counts[s.engagement] !== undefined) counts[s.engagement]++ })
    const total = allStudents.length
    return [
      { name: 'High',   value: Math.round(counts.High   / total * 100) },
      { name: 'Medium', value: Math.round(counts.Medium / total * 100) },
      { name: 'Low',    value: Math.round(counts.Low    / total * 100) },
    ]
  }, [allStudents])

  const sectionData = useMemo(() => {
    const acc = {
      A: { section: 'Sec A (Sem 3)', pass: 0, fail: 0 },
      B: { section: 'Sec B (Sem 5)', pass: 0, fail: 0 },
      C: { section: 'Sec C (Sem 7)', pass: 0, fail: 0 }
    }
    allStudents.forEach(s => {
      if (!acc[s.section]) return
      if (s.final_result === 'Pass') acc[s.section].pass++
      else if (s.final_result === 'Fail') acc[s.section].fail++
    })
    return Object.values(acc)
  }, [allStudents])

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '60px auto 16px' }} />
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading departmental intelligence…</p>
      </div>
    )
  }

  const roleTitle = user?.role === 'admin'
    ? 'Department Executive Dashboard'
    : 'Faculty Academic Console'

  return (
    <div>
      <PageHeader
        category="Academic Intelligence"
        title={roleTitle}
        description={`Active Session: CSE Department · Welcome, ${user?.name} · ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}`}
        badge="NBA Tier-II Compliant"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {user?.role === 'student' ? (
              <Link to="/assignments" className="btn btn-primary btn-sm">
                <BookOpen size={14} />
                <span>My Assignments</span>
              </Link>
            ) : (
              <>
                <Link to="/classes" className="btn btn-secondary btn-sm">
                  <ClipboardCheck size={14} />
                  <span>Classes & Attendance</span>
                </Link>
                <Link to="/reports" className="btn btn-primary btn-sm">
                  <FileText size={14} />
                  <span>SAR Reports</span>
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="page-body">
        {/* ── Urgent At-Risk Warning Alert ── */}
        {user?.role === 'teacher' && teacherAtRiskCount > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-6)',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldAlert size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  {teacherAtRiskCount} Student{teacherAtRiskCount > 1 ? 's' : ''} Flagged For Early Intervention
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Low attendance (&lt;75%) or backlogs detected across your assigned course sections.
                </div>
              </div>
            </div>
            <Link to="/classes" className="btn btn-danger btn-sm">
              Review Roster & Contact Guardians →
            </Link>
          </div>
        )}

        {/* ── Key Metrics Overview ── */}
        <div className="stats-grid">
          <StatCard
            label="Enrolled Students"
            value={stats?.total_students ?? allStudents.length}
            subtext="3 Active Sections (A, B, C)"
            icon={Users}
            variant="primary"
          />
          <StatCard
            label="Department Faculty"
            value={facStats?.total_faculty ?? 2}
            subtext="Ph.D. & PG Research Mentors"
            icon={GraduationCap}
            variant="default"
          />
          <StatCard
            label="Document Intelligence"
            value={ragStats?.total_documents ?? 8}
            subtext={`${ragStats?.total_chunks ?? 142} Vector Chunks in Qdrant`}
            icon={FileText}
            variant="info"
          />
          <StatCard
            label="At-Risk Alerts (ML)"
            value={atRisk.length}
            subtext="Predicted by Random Forest & XGBoost"
            icon={AlertTriangle}
            variant={atRisk.length > 0 ? "danger" : "success"}
            change={atRisk.length > 0 ? `${atRisk.length} flagged` : "None"}
            isPositive={atRisk.length === 0}
          />
        </div>

        {/* ── Analytics Visualizations ── */}
        <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
          {/* Section Outcomes Chart */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Academic Outcomes by Section</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Pass vs. Fail distribution across current cohorts
                </p>
              </div>
              <Badge variant="neutral">CIE + SEE Basis</Badge>
            </div>

            <div style={{ height: 240, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="section" stroke="var(--text-muted)" fontSize={11.5} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11.5} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pass" name="Passed" fill="var(--success)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="fail" name="Backlog/Fail" fill="var(--danger)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Student Engagement Pie */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Classroom Engagement Index</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                  Continuous attendance & assignment compliance
                </p>
              </div>
              <Badge variant="primary">Real-Time</Badge>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', height: 240, gap: 16 }}>
              <div style={{ flex: 1, height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={engagementData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {engagementData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="var(--bg-surface)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {engagementData.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: PIE_COLORS[i] }} />
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <strong className="tabular-nums" style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      {item.value}%
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── At-Risk Early Warning Spotlight Table ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Students Requiring Academic Mentoring</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                High-risk predictions surfaced by predictive microservice threshold (&gt; 0.60)
              </p>
            </div>
            <Link to="/students" className="btn btn-secondary btn-sm">
              View All Students →
            </Link>
          </div>

          {atRisk.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                No Critical Academic Risks Detected
              </div>
              <p style={{ fontSize: '12px', marginTop: 4 }}>
                All current student metrics satisfy the minimum threshold criteria.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Section</th>
                    <th>Attendance</th>
                    <th>Backlogs</th>
                    <th>Risk Probability</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.slice(0, 5).map(s => {
                    const probPercent = Math.round((s.risk_score || s.probability || 0.65) * 100)
                    return (
                      <tr key={s.id || s.student_id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {s.id || s.student_id}
                        </td>
                        <td>{s.name || s.student_name || 'Student'}</td>
                        <td>
                          <Badge variant="neutral">Sec {s.section || 'A'}</Badge>
                        </td>
                        <td className="tabular-nums">
                          <span style={{
                            color: (s.attendance_rate || 70) < 75 ? 'var(--danger)' : 'var(--text-secondary)',
                            fontWeight: 600
                          }}>
                            {s.attendance_rate || 70}%
                          </span>
                        </td>
                        <td className="tabular-nums">
                          {s.backlogs ?? 1}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              flex: 1,
                              maxWidth: 100,
                              height: 6,
                              borderRadius: 3,
                              background: 'var(--bg-subtle)',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${probPercent}%`,
                                height: '100%',
                                background: 'var(--danger)',
                                borderRadius: 3
                              }} />
                            </div>
                            <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 600 }}>
                              {probPercent}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            to={`/students/${s.id || s.student_id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--primary)' }}
                          >
                            <span>Dossier</span>
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
