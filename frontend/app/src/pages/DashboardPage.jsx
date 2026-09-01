import React, { useEffect, useState, useMemo } from 'react'
import { studentsAPI, facultyAPI, ragAPI, predictAPI } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Users, GraduationCap, FileText, AlertTriangle, TrendingUp, BookOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const COLORS = ['#34d399', '#fbbf24', '#f87171']

const SECTION_META = {
  A: { color: '#4f8ef7', bg: 'rgba(79,142,247,0.12)',  sem: 'Sem 3' },
  B: { color: '#7c5df7', bg: 'rgba(124,93,247,0.12)', sem: 'Sem 5' },
  C: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', sem: 'Sem 7' },
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-800)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}{p.name.includes('Rate') || p.name.includes('%') ? '%' : ''}</strong>
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
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      studentsAPI.stats().catch(() => null),
      facultyAPI.stats().catch(() => null),
      ragAPI.stats().catch(() => null),
      predictAPI.atRisk(0.6).catch(() => ({ data: { at_risk: [] } })),
      studentsAPI.list({}).catch(() => ({ data: [] })),
    ]).then(([s, f, r, ar, stu]) => {
      setStats(s?.data)
      setFacStats(f?.data)
      setRagStats(r?.data)
      setAtRisk(ar?.data?.at_risk || [])
      setAllStudents(stu?.data || [])
      setLoading(false)
    })
  }, [])

  // Derive engagement counts from real student data
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

  // Per-section pass/fail for bar chart
  const sectionData = useMemo(() => {
    const acc = { A: { section: 'Sec A', pass: 0, fail: 0 }, B: { section: 'Sec B', pass: 0, fail: 0 }, C: { section: 'Sec C', pass: 0, fail: 0 } }
    allStudents.forEach(s => {
      if (!acc[s.section]) return
      if (s.final_result === 'Pass') acc[s.section].pass++
      else if (s.final_result === 'Fail') acc[s.section].fail++
    })
    return Object.values(acc)
  }, [allStudents])

  if (loading) return (
    <div className="page-enter" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
      <div className="spinner spinner-lg" style={{ margin: '60px auto' }} />
    </div>
  )

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">
              {user?.role === 'admin' ? 'Admin Dashboard' :
               user?.role === 'faculty' ? 'Faculty Dashboard' : 'Student Dashboard'}
            </h1>
            <p className="page-desc">
              Welcome back, <strong>{user?.name}</strong> · {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-info">CSE Department</span>
            <span className="badge badge-neutral">Z10 Batch</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* ── Stats Row ── */}
        <div className="stats-grid">
          <StatCard
            icon={<Users size={20} color="#4f8ef7" />}
            iconBg="rgba(79,142,247,0.12)"
            value={stats?.total_students ?? '—'}
            label="Total Students"
            change={`${stats?.pass_rate_pct ?? 0}% pass rate`}
            changeDir="up"
          />
          <StatCard
            icon={<AlertTriangle size={20} color="#f87171" />}
            iconBg="rgba(248,113,113,0.12)"
            value={stats?.at_risk ?? '—'}
            label="At-Risk Students"
            change="Flagged by AI"
            changeDir="down"
          />
          <StatCard
            icon={<GraduationCap size={20} color="#34d399" />}
            iconBg="rgba(52,211,153,0.12)"
            value={facStats?.total_faculty ?? '—'}
            label="Faculty Members"
            change={`${facStats?.total_publications ?? 0} publications`}
            changeDir="up"
          />
          <StatCard
            icon={<FileText size={20} color="#7c5df7" />}
            iconBg="rgba(124,93,247,0.12)"
            value={ragStats?.vectors_count ?? 0}
            label="Document Chunks"
            change="In knowledge base"
            changeDir="up"
          />
          <StatCard
            icon={<TrendingUp size={20} color="#fbbf24" />}
            iconBg="rgba(251,191,36,0.12)"
            value={`${stats?.avg_gpa ?? 0}`}
            label="Avg GPA"
            change="Department average"
            changeDir="up"
          />
          <StatCard
            icon={<BookOpen size={20} color="#f76f4f" />}
            iconBg="rgba(247,111,79,0.12)"
            value={`${stats?.avg_attendance ?? 0}%`}
            label="Avg Attendance"
            change={stats?.avg_attendance < 75 ? "⚠ Below threshold" : "✓ Healthy"}
            changeDir={stats?.avg_attendance < 75 ? "down" : "up"}
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid-2 mb-lg">
          <div className="card">
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Pass vs Fail — By Class Section</div>
              <div className="text-muted text-sm">Live results · A=Sem 3, B=Sem 5, C=Sem 7</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sectionData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="section" tick={{ fill: '#8b9ab4', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b9ab4', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pass" name="Passed" fill="#34d399" radius={[4,4,0,0]} />
                <Bar dataKey="fail" name="Failed" fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Student Engagement</div>
              <div className="text-muted text-sm">Distribution across all students</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: 220 }}>
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={engagementData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    paddingAngle={3} dataKey="value">
                    {engagementData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {engagementData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i], flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                      <div className="text-muted text-xs">{d.value}% of students</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── At-Risk Students ── */}
        {atRisk.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-md">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>🚨 High-Risk Students</div>
                <div className="text-muted text-sm">Predicted by AI model (risk score &gt; 60%)</div>
              </div>
              <span className="badge badge-danger">{atRisk.length} flagged</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th><th>Section</th><th>Attendance</th>
                    <th>GPA</th><th>Backlogs</th><th>Risk Score</th><th>Level</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.slice(0, 8).map(s => {
                    const secMeta = SECTION_META[s.section]
                    return (
                    <tr key={s.student_id}>
                      <td><div style={{ fontWeight: 600 }}>{s.name}</div><div className="text-xs text-muted">{s.student_id}</div></td>
                      <td>
                        {secMeta ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 20,
                            fontSize: 11, fontWeight: 700,
                            background: secMeta.bg, color: secMeta.color,
                            border: `1px solid ${secMeta.color}40`,
                          }}>{s.section || '—'}</span>
                        ) : (s.section || '—')}
                      </td>
                      <td><span className={s.attendance_pct < 60 ? 'risk-high' : s.attendance_pct < 75 ? 'risk-medium' : ''}>{s.attendance_pct?.toFixed(1)}%</span></td>
                      <td>{s.previous_gpa}</td>
                      <td>{s.backlogs > 0 ? <span className="risk-high">{s.backlogs}</span> : '0'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                          <div className="risk-bar" style={{ flex: 1 }}>
                            <div className="risk-fill"
                              style={{
                                width: `${(s.risk_score * 100).toFixed(0)}%`,
                                background: s.risk_level === 'High' ? 'var(--red)' : 'var(--amber)'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{(s.risk_score * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td><span className={`badge badge-${s.risk_level === 'High' ? 'danger' : 'warning'}`}>{s.risk_level}</span></td>
                    </tr>
                  )})
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, iconBg, value, label, change, changeDir }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className={`stat-change ${changeDir}`}>{change}</div>
    </div>
  )
}
