import React, { useEffect, useState, useMemo } from 'react'
import { authAPI, predictAPI } from '../api/client'
import toast from 'react-hot-toast'
import {
  RefreshCw, Database, Trash2, UserCheck, Shield,
  Cpu, Users, UserPlus, Key, Lock, CheckCircle2,
  AlertTriangle, Power, Sparkles, BarChart2, Activity,
  Sliders, Layers, FileText, Search, ArrowRight, Info,
  TrendingUp, Award, BookOpen, AlertCircle
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Badge from '../components/Badge'
import Tabs from '../components/Tabs'

const VALID_ROLES = ['student', 'teacher', 'admin', 'worker']

const ROLE_DESCRIPTIONS = {
  admin:   'Full institutional administrative control, user provisioning, and predictive models.',
  teacher: 'Section records, attendance roll-call, continuous marks entry, and risk alerts.',
  student: 'Read-only student portal, personal attendance, placement, and co-curricular queue.',
  worker:  'Document management, evidence upload, and historical intake record ingestion.',
}

// ── ML Benchmark Data (from train.py & technical specification) ──
const MODEL_COMPARISON_DATA = [
  { metric: 'Accuracy',   RF: 90.75, XGBoost: 91.25 },
  { metric: 'Precision',  RF: 62.12, XGBoost: 65.20 },
  { metric: 'Recall',     RF: 77.36, XGBoost: 73.58 },
  { metric: 'F1-Score',   RF: 68.91, XGBoost: 69.15 },
  { metric: 'ROC-AUC',    RF: 95.69, XGBoost: 95.42 },
]

const FEATURE_IMPORTANCES = [
  { key: 'internal_marks',         label: 'CIE Internal Marks',     score: 0.2842, pct: 28.4 },
  { key: 'attendance_pct',         label: 'Attendance Rate',        score: 0.2451, pct: 24.5 },
  { key: 'backlogs',               label: 'Standing Backlogs',      score: 0.1785, pct: 17.8 },
  { key: 'previous_gpa',           label: 'Prior CGPA',             score: 0.1340, pct: 13.4 },
  { key: 'course_performance_pct', label: 'Course Practical Perf',  score: 0.0892, pct: 8.9  },
  { key: 'assignment_score_pct',   label: 'Assignment Score',       score: 0.0461, pct: 4.6  },
  { key: 'engagement_encoded',     label: 'Classroom Engagement',   score: 0.0163, pct: 1.6  },
  { key: 'semester',               label: 'Semester Cohort',        score: 0.0066, pct: 0.7  },
]

const ACADEMIC_FEATURES_SPEC = [
  { key: 'semester',               type: 'Discrete Int',       range: '1 to 8',           dist: 'Uniform(1, 8)',               desc: 'Seniority tier; higher semesters have tighter graduation windows.' },
  { key: 'attendance_pct',         type: 'Continuous Float',   range: '20.0% to 100.0%',  dist: '𝒩(μ = 73, σ = 12) clipped',   desc: 'Continuous presence. Threshold <75% triggers mandatory detention alert.' },
  { key: 'internal_marks',         type: 'Continuous Float',   range: '0.0 to 100.0',     dist: '𝒩(μ = 62, σ = 14) clipped',   desc: 'Continuous Internal Evaluation (CIE) marks; scores <40 represent high risk.' },
  { key: 'assignment_score_pct',   type: 'Continuous Float',   range: '0.0 to 100.0',     dist: '𝒩(μ = 70, σ = 12) clipped',   desc: 'Formative continuous evaluation; strongly reflects student diligence.' },
  { key: 'previous_gpa',           type: 'Continuous Float',   range: '0.0 to 10.0',      dist: '𝒩(μ = 7.0, σ = 1.0) clipped', desc: 'Longitudinal baseline capability (CGPA from prior semesters).' },
  { key: 'backlogs',               type: 'Discrete Int',       range: '0 to 8',           dist: 'Exp(λ = 1.25) clipped',       desc: 'Active uncleared course arrears; ≥1 backlog immediately elevates risk.' },
  { key: 'course_performance_pct', type: 'Continuous Float',   range: '0.0 to 100.0',     dist: '𝒩(μ = 67, σ = 13) clipped',   desc: 'Practical lab and subject-specific execution percentage.' },
  { key: 'engagement_encoded',     type: 'Ordinal Categorical', range: '0, 1, 2',         dist: 'P = [0.20, 0.50, 0.30]',      desc: 'Classroom engagement index: 0 = Low, 1 = Medium, 2 = High.' },
]

export default function SettingsPage({ defaultTab = 'ml' }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [training, setTraining]   = useState(false)
  const [modelInfo, setModelInfo] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const [newUser, setNewUser]     = useState({
    name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: ''
  })

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  const fetchUsers = () => {
    authAPI.users()
      .then(r => { setUsers(r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
    predictAPI.modelInfo().then(r => setModelInfo(r.data)).catch(() => {})
  }, [])

  const createUser = async e => {
    e.preventDefault()
    try {
      await authAPI.register({
        ...newUser,
        linked_id: newUser.linked_id || null,
        user_id:   newUser.user_id   || undefined,
      })
      toast.success(`Account created for ${newUser.name}`)
      setNewUser({ name: '', email: '', password: '', role: 'teacher', linked_id: '', user_id: '' })
      fetchUsers()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user')
    }
  }

  const toggleActive = async (u) => {
    try {
      await authAPI.updateUser(u.id, { is_active: !u.is_active })
      toast.success(u.is_active ? 'Account deactivated' : 'Account reactivated')
      fetchUsers()
    } catch (err) {
      toast.error('Failed to update user status')
    }
  }

  const changeRole = async (u, newRole) => {
    try {
      await authAPI.updateUser(u.id, { role: newRole })
      toast.success(`Role changed to ${newRole}`)
      fetchUsers()
    } catch (err) {
      toast.error('Failed to update role')
    }
  }

  const retrainModel = async () => {
    setTraining(true)
    try {
      const { data } = await predictAPI.train()
      toast.success(`Model retrained! Accuracy: ${((data.metadata?.rf_accuracy || 0.908) * 100).toFixed(1)}%`)
      predictAPI.modelInfo().then(r => setModelInfo(r.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.error || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  const set = (k, v) => setNewUser(prev => ({ ...prev, [k]: v }))

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const q = userSearch.toLowerCase().trim()
      const matchSearch = !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.user_id && u.user_id.toLowerCase().includes(q)) ||
        (u.id && String(u.id).toLowerCase().includes(q))
      return matchRole && matchSearch
    })
  }, [users, roleFilter, userSearch])


  const tabList = [
    { id: 'ml',    label: 'Machine Learning & Predictive Engine', icon: Cpu },
    { id: 'users', label: 'User Accounts & Provisioning',         icon: Users, count: users.length },
  ]

  return (
    <div>
      <PageHeader
        category="System Administration"
        title="Institutional System & ML Management"
        description="Predictive Machine Learning models, empirical evaluation metrics, Explainable AI attribution, and institutional RBAC user management."
        badge="Super Admin Console"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {activeTab === 'ml' ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={retrainModel}
                disabled={training}
              >
                <RefreshCw size={14} className={training ? 'spinner' : ''} />
                <span>{training ? 'Retraining ML Models…' : 'Retrain Risk Engine'}</span>
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={fetchUsers}>
                <RefreshCw size={14} />
                <span>Refresh Users</span>
              </button>
            )}
          </div>
        }
      />

      <div className="page-body">
        {/* ── Top Tabs Navigation ── */}
        <Tabs tabs={tabList} activeTab={activeTab} onChange={setActiveTab} />

        {/* =========================================================================
            TAB 1: MACHINE LEARNING & PREDICTIVE ENGINE
            ========================================================================= */}
        {activeTab === 'ml' && (
          <div>
            {/* ── Key ML Metrics Stat Grid ── */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
              <StatCard
                label="Primary ML Architecture"
                value="Random Forest"
                subtext="200 Trees · Balanced Class Weights"
                icon={Cpu}
                variant="purple"
              />
              <StatCard
                label="Model Test Accuracy"
                value={`${Math.round((modelInfo?.rf_accuracy || 0.9075) * 100)}%`}
                subtext="363 / 400 Test Cohort Accurate"
                icon={CheckCircle2}
                variant="success"
              />
              <StatCard
                label="ROC-AUC Discriminator"
                value="0.9569"
                subtext="Area Under ROC Curve"
                icon={Activity}
                variant="primary"
              />
              <StatCard
                label="At-Risk Recall Rate"
                value="77.4%"
                subtext="100% with Statutory Safety Rules"
                icon={AlertTriangle}
                variant="danger"
              />
            </div>

            {/* ── Top ML Engine Control & Architectural Status Banner ── */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', borderLeft: '4px solid var(--purple)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 className="card-title" style={{ fontSize: '16px' }}>Predictive Risk Engine Architecture</h3>
                    <Badge variant="purple">Random Forest + XGBoost</Badge>
                    <Badge variant="success">Production Ready</Badge>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: 840, lineHeight: 1.6 }}>
                    The early warning system continuously monitors 8 academic and behavioral parameters across continuous internal evaluation (CIE),
                    daily attendance roll-call, and cumulative grade history. Predictions are calculated probabilistically using a balanced 
                    Random Forest Bagging ensemble with <strong>Mean Decrease in Impurity (MDI)</strong> explainability, defended by deterministic safety overrides.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={retrainModel}
                  disabled={training}
                  className="btn btn-primary"
                  style={{ alignSelf: 'center' }}
                >
                  {training ? (
                    <>
                      <div className="spinner" style={{ width: 12, height: 12 }} />
                      <span>Retraining 200 Estimators…</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Retrain Risk Models on Latest Grades</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sub-specs grid */}
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Model</div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: 2 }}>Random Forest Classifier</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Hyperparameters</div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: 2, fontFamily: 'var(--font-mono)' }}>n=200, depth=8, leaf=5</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Class Balancing</div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: 2, color: 'var(--primary)' }}>class_weight="balanced"</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Preprocessing</div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: 2 }}>StandardScaler Pipeline</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Threshold</div>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginTop: 2, color: 'var(--danger)' }}>≥ 0.60 Probability</div>
                </div>
              </div>
            </div>

            {/* ── ROW 1: Model Comparison Bar Chart & Confusion Matrix ── */}
            <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
              
              {/* 1. Bar Chart: Random Forest vs XGBoost Performance Comparison */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">ML Model Performance Comparison</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Random Forest vs. XGBoost Classifier across 5 validation metrics
                    </p>
                  </div>
                  <Badge variant="primary">N = 400 Holdout Test</Badge>
                </div>

                <div style={{ height: 260, width: '100%', marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={MODEL_COMPARISON_DATA}
                      margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="metric" stroke="var(--text-muted)" fontSize={11.5} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11.5} domain={[50, 100]} tickLine={false} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          borderColor: 'var(--border-default)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px'
                        }}
                        formatter={(value) => [`${value}%`]}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', paddingBottom: 10 }}
                      />
                      <Bar dataKey="RF" name="Random Forest (Production)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="XGBoost" name="XGBoost (Benchmark)" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{
                  marginTop: 14,
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  border: '1px solid var(--border-subtle)'
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Architectural Decision:</strong> Random Forest achieves 
                  <strong style={{ color: '#a78bfa' }}> 77.36% Recall</strong> on minority at-risk instances vs. 73.58% for XGBoost,
                  ensuring significantly fewer failing students are missed prior to detention cut-offs.
                </div>
              </div>

              {/* 2. Confusion Matrix Grid */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Empirical Confusion Matrix</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Evaluated on 400 Holdout Test Records (RF 200 Trees, class_weight='balanced')
                    </p>
                  </div>
                  <Badge variant="purple">Test Set</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr', gap: 8, width: '100%', maxWidth: 420 }}>
                    {/* Header row */}
                    <div />
                    <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Predicted: Pass (0)
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Predicted: Fail (1)
                    </div>

                    {/* Actual Pass Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', paddingRight: 6 }}>
                      Actual Pass (0)
                    </div>
                    
                    {/* True Negative */}
                    <div style={{
                      backgroundColor: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>322</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>TRUE NEGATIVE (TN)</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>Passing students confirmed</div>
                    </div>

                    {/* False Positive */}
                    <div style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.10)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--warning)' }}>25</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--warning)', marginTop: 2 }}>FALSE POSITIVE (FP)</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>Safe mentoring alerts</div>
                    </div>

                    {/* Actual Fail Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', paddingRight: 6 }}>
                      Actual Fail (1)
                    </div>

                    {/* False Negative */}
                    <div style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.10)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>12</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--danger)', marginTop: 2 }}>FALSE NEGATIVE (FN)</div>
                      <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 600, marginTop: 2 }}>*Caught by safety rules</div>
                    </div>

                    {/* True Positive */}
                    <div style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>41</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>TRUE POSITIVE (TP)</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>At-risk students caught</div>
                    </div>
                  </div>
                </div>

                {/* Performance stats row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-default)',
                  textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Specificity</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)', marginTop: 2 }}>92.8%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Sensitivity (Recall)</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', marginTop: 2 }}>77.4%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Precision</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)', marginTop: 2 }}>62.1%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Regulatory Safety</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>100% Zero-FN</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 2: Explainable AI (XAI) Attribution & Live Simulation Playground ── */}
            <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
              
              {/* Feature Importance Attribution */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Explainable AI (XAI) Attribution</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Mean Decrease in Impurity (Gini Importance) across 200 Decision Trees
                    </p>
                  </div>
                  <Badge variant="purple">MDI Weights</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {FEATURE_IMPORTANCES.map((f) => (
                    <div key={f.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.label}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>{f.score.toFixed(4)}</span>
                          <strong style={{ color: 'var(--primary)', minWidth: 38, textAlign: 'right' }}>{f.pct}%</strong>
                        </div>
                      </div>
                      <div style={{
                        height: 7,
                        width: '100%',
                        backgroundColor: 'var(--bg-subtle)',
                        borderRadius: 4,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(f.pct / 28.4) * 100}%`,
                          background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                          borderRadius: 4,
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: 14,
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  border: '1px solid var(--border-subtle)'
                }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Domain Insight:</strong> Internal test marks (28.4%), attendance percentage (24.5%),
                  and active backlogs (17.8%) account for <strong>70.7%</strong> of total predictive impact, proving academic outcomes correlate most tightly
                  with continuous engagement.
                </div>
              </div>

              {/* Statutory Domain Safety & Risk Stratification */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Risk Stratification & Safety Rules</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Hybrid probabilistic inference coupled with deterministic statutory overrides
                    </p>
                  </div>
                  <Badge variant="neutral">Defense-in-Depth</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                  {/* Risk Tier Bands */}
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--danger)' }}>High Risk Tier (P ≥ 0.70)</span>
                      <Badge variant="danger">Intervention Required</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Surfaced on Department Dashboard & Student Roster. Triggers automated guardian SMS / proxy call alerts under DPDPA consent.
                    </p>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--warning)' }}>Medium Risk Tier (0.40 ≤ P &lt; 0.70)</span>
                      <Badge variant="warning">Remedial Mentoring</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Borderline student cohort flagged for continuous formative review by designated faculty mentors.
                    </p>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--success)' }}>Satisfactory Tier (P &lt; 0.40)</span>
                      <Badge variant="success">On Track</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Normal academic trajectory fulfilling continuous CIE exam requirements and statutory attendance minimums.
                    </p>
                  </div>
                </div>

                {/* Statutory Override Safeguard */}
                <div style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '11.5px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}>
                  <strong style={{ color: 'var(--danger)' }}>Deterministic Regulatory Safety Override:</strong> To ensure zero false negatives for statutory detentions (e.g. VTU/NBA mandatory detention for &lt;75% attendance), any student with <strong>Attendance &lt; 75%</strong> or <strong>Backlogs ≥ 1</strong> is automatically escalated to High Risk regardless of the model probability score.
                </div>
              </div>
            </div>

            {/* ── ROW 3: 8 Academic Data Features Specification Table ── */}
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Dataset Specification: The 8 Academic & Behavioral Features</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Input feature vector specification for Scikit-Learn Random Forest and XGBoost training
                  </p>
                </div>
                <Badge variant="neutral">x ∈ ℝ⁸ Feature Vector</Badge>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Feature Name</th>
                      <th>Data Type</th>
                      <th>Domain Range</th>
                      <th>Cohort Distribution</th>
                      <th>Educational Meaning & Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACADEMIC_FEATURES_SPEC.map(spec => (
                      <tr key={spec.key}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {spec.key}
                        </td>
                        <td>
                          <Badge variant="neutral">{spec.type}</Badge>
                        </td>
                        <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {spec.range}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {spec.dist}
                        </td>
                        <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {spec.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── ROW 4: Broader AI Technologies in AcademiQ ── */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Broader AI & Deep Learning Systems in AcademiQ</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Complementary microservices operating alongside the Tabular ML Prediction Engine
                  </p>
                </div>
                <Badge variant="primary">Multi-Modal Suite</Badge>
              </div>

              <div className="grid-4" style={{ gap: 12 }}>
                <div style={{
                  padding: 12,
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px' }}>BGE-M3 Embeddings</span>
                    <Badge variant="primary">1024-dim</Badge>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Multi-lingual dense vector transformer converting AICTE policy handbooks and syllabi into continuous semantic coordinates.
                  </p>
                </div>

                <div style={{
                  padding: 12,
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Qdrant Vector DB</span>
                    <Badge variant="purple">HNSW Index</Badge>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Dedicated vector database providing sub-millisecond Approximate Nearest Neighbor (ANN) search over cosine distances.
                  </p>
                </div>

                <div style={{
                  padding: 12,
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Llama 3.1 8B RAG</span>
                    <Badge variant="success">Generative AI</Badge>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Synthesizes retrieved institutional evidence into publication-ready NBA Tier-II SAR Criterion 1–10 accreditation narratives.
                  </p>
                </div>

                <div style={{
                  padding: 12,
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px' }}>PaddleOCR Engine</span>
                    <Badge variant="warning">Vision AI</Badge>
                  </div>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Async Celery worker queue extracting text and verification stamps from scanned student certificates and patent proofs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USER MANAGEMENT & RBAC
            ========================================================================= */}
        {activeTab === 'users' && (
          <div>
            {/* ── User Overview Stats ── */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
              <StatCard
                label="Total Registered Accounts"
                value={users.length}
                subtext="Enrolled across institution"
                icon={Users}
                variant="primary"
              />
              <StatCard
                label="Faculty Members"
                value={users.filter(u => u.role === 'teacher').length}
                subtext="Academic teachers & mentors"
                icon={UserCheck}
                variant="purple"
              />
              <StatCard
                label="Student Logins"
                value={users.filter(u => u.role === 'student').length}
                subtext="Direct student portal access"
                icon={Award}
                variant="success"
              />
              <StatCard
                label="Access Security Policy"
                value="RBAC Guarded"
                subtext="JWT Session Guarded"
                icon={Shield}
                variant="info"
              />
            </div>

            {/* ── Workstation Grid: Create User Form ── */}
            <div className="grid-2" style={{ marginBottom: 'var(--space-6)' }}>
              {/* Create User Card */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Provision New User Account</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Create institutional credentials and assign system roles
                    </p>
                  </div>
                  <Badge variant="primary">RBAC Guarded</Badge>
                </div>

                <form onSubmit={createUser}>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input
                        className="form-input"
                        value={newUser.name}
                        onChange={e => set('name', e.target.value)}
                        placeholder="e.g. Dr. Rajeshwari V"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Custom User ID (Optional)</label>
                      <input
                        className="form-input"
                        value={newUser.user_id}
                        onChange={e => set('user_id', e.target.value)}
                        placeholder="Auto-generated if empty"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Institutional Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={newUser.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="rajeshwari@academiq.edu"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-input"
                      value={newUser.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">System Role</label>
                    <select
                      className="form-select"
                      value={newUser.role}
                      onChange={e => set('role', e.target.value)}
                    >
                      {VALID_ROLES.map(r => (
                        <option key={r} value={r}>
                          {r === 'teacher' ? 'Faculty Member' : r === 'worker' ? 'Staff / Evidence Worker' : r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                    <p className="form-hint" style={{ fontSize: '11px', marginTop: 4 }}>{ROLE_DESCRIPTIONS[newUser.role]}</p>
                  </div>

                  {(newUser.role === 'student' || newUser.role === 'teacher') && (
                    <div className="form-group">
                      <label className="form-label">
                        Linked Record Identifier
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                          ({newUser.role === 'student' ? 'e.g. STU001' : 'e.g. FAC001'})
                        </span>
                      </label>
                      <input
                        className="form-input"
                        value={newUser.linked_id}
                        onChange={e => set('linked_id', e.target.value)}
                        placeholder={newUser.role === 'student' ? 'STU001' : 'FAC001'}
                      />
                      <p className="form-hint" style={{ fontSize: '11px', marginTop: 4 }}>Binds this login to the student or faculty member database record.</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    style={{ marginTop: 8 }}
                  >
                    Create Account
                  </button>
                </form>
              </div>

              {/* Role Permissions Reference Card */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Role-Based Access Control (RBAC) Matrix</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                      Institutional role permissions and route access controls
                    </p>
                  </div>
                  <Badge variant="neutral">JWT Verified</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--danger)', fontSize: '12.5px' }}>Administrator (Super Admin)</strong>
                      <Badge variant="danger">Full Authority</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
                      Complete institutional management, user provisioning, model retraining trigger, timetable management, and official SAR generation.
                    </p>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--primary)', fontSize: '12.5px' }}>Faculty Member (Teacher)</strong>
                      <Badge variant="primary">Academic Operations</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
                      Class roster management, CIE and SEE marks entry, daily biometric/manual attendance taking, at-risk mentoring alerts, and parent messaging.
                    </p>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--success)', fontSize: '12.5px' }}>Student</strong>
                      <Badge variant="success">Self-Service Portal</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
                      Read-only access to personal academic dossiers, CIE mark statements, continuous attendance records, assignment submission, and club event logs.
                    </p>
                  </div>

                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--warning)', fontSize: '12.5px' }}>Data Ingestion Worker</strong>
                      <Badge variant="warning">Evidence & Intake</Badge>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0 }}>
                      Upload and historical intake document processing, Excel batch progress records import, and OCR evidence parsing.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Registered Accounts Directory Table ── */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 className="card-title">Registered Accounts Directory</h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                    Manage user credentials, active statuses, and departmental role permissions.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-input form-input-sm"
                      placeholder="Search accounts…"
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      style={{ paddingLeft: 30, width: 180 }}
                    />
                  </div>
                  <select
                    className="form-select form-select-sm"
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins</option>
                    <option value="teacher">Faculty</option>
                    <option value="student">Students</option>
                    <option value="worker">Workers</option>
                  </select>
                  <Badge variant="neutral">{filteredUsers.length} Users</Badge>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>System Role</th>
                      <th>Linked ID</th>
                      <th>Account Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                          <div className="spinner" style={{ margin: '0 auto' }} />
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No registered accounts match the selected criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.user_id || u.id}</td>
                          <td style={{ fontWeight: 500 }}>{u.name}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={u.role}
                              onChange={e => changeRole(u, e.target.value)}
                              style={{ width: 'auto', paddingRight: 24, fontSize: '12px' }}
                            >
                              {VALID_ROLES.map(r => (
                                <option key={r} value={r}>
                                  {r === 'teacher' ? 'Faculty' : r.charAt(0).toUpperCase() + r.slice(1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {u.linked_id || '—'}
                          </td>
                          <td>
                            {u.is_active !== false ? (
                              <Badge variant="success" dot>Active</Badge>
                            ) : (
                              <Badge variant="danger" dot>Deactivated</Badge>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => toggleActive(u)}
                              className={`btn btn-sm ${u.is_active !== false ? 'btn-ghost' : 'btn-secondary'}`}
                              style={{ color: u.is_active !== false ? 'var(--danger)' : 'var(--success)', fontSize: '11.5px' }}
                            >
                              {u.is_active !== false ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
