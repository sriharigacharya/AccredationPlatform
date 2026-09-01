import React, { useEffect, useState } from 'react'
import { facultyAPI } from '../api/client'
import { Search, Plus, ChevronRight, BookOpen, Award, Beaker } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState(null)
  const navigate = useNavigate()

  const fetch = () => {
    setLoading(true)
    facultyAPI.list({ search }).then(r => { setFaculty(r.data); setLoading(false) }).catch(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [search])

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">🎓 Faculty</h1>
            <p className="page-desc">{faculty.length} faculty members</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="search-bar" style={{ flex: 1, maxWidth: 360 }}>
            <Search size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search faculty…" />
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {faculty.map(f => {
              const isOpen = expanded === f.faculty_id
              return (
                <div key={f.id} className="card" style={{ transition: 'all 0.2s ease' }}>
                  <div className="flex items-center justify-between pointer" onClick={() => setExpanded(isOpen ? null : f.faculty_id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', background: 'var(--grad-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, fontWeight: 700, color: 'white', flexShrink: 0,
                      }}>
                        {f.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{f.name}</div>
                        <div className="text-muted text-sm">{f.designation} · {f.qualification}</div>
                        <div className="text-xs text-muted">{f.experience} experience · {f.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge-info" title="Publications">
                        <BookOpen size={10} /> {f.publications?.length || 0}
                      </span>
                      <span className="badge badge-success" title="FDP">
                        🎓 {f.fdp_participation?.length || 0}
                      </span>
                      <span className="badge badge-warning" title="Research">
                        <Beaker size={10} /> {f.research_projects?.length || 0}
                      </span>
                      <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-lg)', animation: 'fadeSlideUp 0.2s ease' }}>
                      <div className="grid-3" style={{ gap: 'var(--space-md)' }}>
                        <ListSection title="📚 Publications" items={f.publications} color="var(--accent)" />
                        <ListSection title="🎓 FDP Participation" items={f.fdp_participation} color="var(--green)" />
                        <ListSection title="🔬 Research Projects" items={f.research_projects} color="var(--amber)" />
                        <ListSection title="📜 Certifications" items={f.certifications} color="var(--accent-2)" />
                        <ListSection title="🏆 Awards" items={f.awards} color="var(--gold)" />
                        <ListSection title="📖 Courses Taught" items={f.courses_taught} color="var(--accent-3)" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function ListSection({ title, items, color }) {
  if (!items?.length) return null
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 12, borderLeft: `2px solid ${color}40` }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}
