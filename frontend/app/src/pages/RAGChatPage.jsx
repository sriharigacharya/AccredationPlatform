import React, { useEffect, useState, useRef } from 'react'
import { ragAPI } from '../api/client'
import { Send, Sparkles, FileText, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

const SUGGESTED = [
  "What are the PEOs of the CSE department?",
  "Summarize the NBA accreditation status",
  "What is the placement statistics for 2024?",
  "List all faculty who have published research papers",
  "What are the POs and COs for this department?",
  "What FDP programmes were conducted recently?",
]

export default function RAGChatPage() {
  const [messages, setMessages]   = useState([
    {
      role: 'assistant',
      content: "Hello! I'm the AcademiQ AI Assistant. I can answer questions about your department's accreditation documents, faculty reports, student outcomes, and more. Ask me anything about your uploaded documents!",
      sources: [],
    }
  ])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [ragStats, setRagStats]   = useState(null)
  const [filter, setFilter]       = useState('')
  const bottomRef                 = useRef(null)

  useEffect(() => {
    ragAPI.stats().then(r => setRagStats(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const q = (text || input).trim()
    if (!q) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const { data } = await ragAPI.query({
        query: q,
        doc_type_filter: filter || undefined,
        top_k: 5,
        include_sources: true,
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources || [],
      }])
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to get answer. Please try again.'
      toast.error(msg)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${msg}`,
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Chat cleared. Ask me anything about your department documents!",
      sources: [],
    }])
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">🤖 AI Document Q&A</h1>
            <p className="page-desc">
              Natural language queries over your accreditation documents using RAG + Llama 3.1
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {ragStats && (
              <span className="badge badge-info">
                📚 {ragStats.vectors_count?.toLocaleString() || 0} chunks indexed
              </span>
            )}
            <button className="btn btn-secondary btn-sm" onClick={clearChat}>
              <RefreshCw size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>Filter by doc type:</span>
          {['', 'SAR', 'FDP', 'placement', 'research', 'course_file', 'meeting_minutes', 'certificate'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 12px' }}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', gap: 'var(--space-lg)', height: 'calc(100vh - 200px)' }}>
        {/* ── Chat pane ── */}
        <div className="chat-container" style={{ flex: 1 }}>
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--grad-primary)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 12
                    }}>✨</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>AcademiQ AI</span>
                  </div>
                )}
                <div className="chat-bubble">
                  {msg.content.split('\n').map((line, j) => (
                    <React.Fragment key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</React.Fragment>
                  ))}
                </div>
                {msg.sources?.length > 0 && (
                  <div className="chat-sources">
                    <strong>Sources:</strong>{' '}
                    {msg.sources.map((s, si) => (
                      <span key={si}>
                        [{s.doc_type || 'doc'} · {(s.score * 100).toFixed(0)}% match]
                        {si < msg.sources.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about accreditation documents, student outcomes, faculty records…"
              rows={1}
              style={{ lineHeight: 1.5 }}
            />
            <button
              className="btn btn-primary btn-icon"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>

        {/* ── Suggestions panel ── */}
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color="var(--gold)" /> Suggested Questions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGESTED.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', padding: '8px 12px',
                    color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                    textAlign: 'left', lineHeight: 1.5, transition: 'all var(--transition)',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
                  onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} color="var(--accent)" /> Knowledge Base
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {ragStats ? (
                <>
                  <div>Collection: <span style={{ color: 'var(--text-primary)' }}>{ragStats.collection}</span></div>
                  <div>Vectors: <span style={{ color: 'var(--green)' }}>{ragStats.vectors_count?.toLocaleString()}</span></div>
                  <div>Status: <span style={{ color: 'var(--green)' }}>{ragStats.status || 'active'}</span></div>
                </>
              ) : (
                <div>Loading stats…</div>
              )}
            </div>
            <div className="alert alert-info mt-sm" style={{ fontSize: 11, padding: '8px 12px' }}>
              Upload documents in the Documents page to add to the knowledge base.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
