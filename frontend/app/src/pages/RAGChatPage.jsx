import React, { useEffect, useState, useRef } from 'react'
import { ragAPI } from '../api/client'
import {
  Send, Sparkles, FileText, RefreshCw, Layers,
  Database, HelpCircle, Check, ArrowRight, CornerDownLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const SUGGESTED_QUERIES = [
  "What are the Program Educational Objectives (PEOs) of the CSE department?",
  "Summarize our current NBA Criterion 4 student performance and placement stats.",
  "Which faculty members have published Scopus/SCI research papers this year?",
  "What is the average continuous internal evaluation (CIE) pass rate across sections?",
  "List co-curricular hackathons and symposiums conducted by CSE student clubs.",
]

const DOC_FILTER_OPTIONS = [
  { value: '', label: 'All Document Collections' },
  { value: 'SAR', label: 'NBA SAR Drafts' },
  { value: 'guideline', label: 'NBA Guidelines' },
  { value: 'course_file', label: 'Course Files' },
  { value: 'FDP', label: 'Faculty FDP Reports' },
  { value: 'placement', label: 'Placement Archives' },
  { value: 'research', label: 'Research Papers' },
]

export default function RAGChatPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am AcademiQ Document Intelligence. I provide factual, ground-truth answers derived strictly from your department's indexed accreditation records, SAR files, course portfolios, and student outcome indices. How can I assist your accreditation review today?",
      sources: [],
    }
  ])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [ragStats, setRagStats] = useState(null)
  const [filter, setFilter]     = useState('')
  const bottomRef               = useRef(null)

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
      const msg = err.response?.data?.error || 'Failed to retrieve grounded answer. Verify backend service connection.'
      toast.error(msg)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: msg,
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
      content: "Conversation history cleared. Enter any question regarding departmental records or accreditation criteria.",
      sources: [],
    }])
  }

  return (
    <div>
      <PageHeader
        category="Intelligence & Accreditation"
        title="AI Document Intelligence & Q&A"
        description="Conversational question answering with strict source attribution, powered by BGE-M3 dense retrieval and Llama 3.1."
        badge={`${ragStats?.vectors_count?.toLocaleString() || 142} Vector Chunks`}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={clearChat}>
            <RefreshCw size={14} />
            <span>Reset Chat</span>
          </button>
        }
      />

      <div className="page-body">
        {/* ── Collection Filter Bar ── */}
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={15} color="var(--primary)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Vector Collection:</span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DOC_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`btn btn-sm ${filter === opt.value ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11.5px', padding: '3px 10px' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main Chat Interface ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: 'var(--space-6)',
          height: 'calc(100vh - 270px)',
          minHeight: 520,
        }} className="rag-chat-layout">
          {/* Chat conversation area */}
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Messages Scroll Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--space-6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
            }}>
              {messages.map((msg, i) => {
                const isAI = msg.role === 'assistant'
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAI ? 'flex-start' : 'flex-end',
                      maxWidth: '85%',
                      alignSelf: isAI ? 'flex-start' : 'flex-end',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {isAI ? (
                        <>
                          <Sparkles size={12} color="var(--primary)" />
                          <span>AcademiQ Intelligence</span>
                        </>
                      ) : (
                        <span>You</span>
                      )}
                    </div>

                    <div style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isAI ? 'var(--bg-subtle)' : 'var(--primary-subtle)',
                      border: `1px solid ${isAI ? 'var(--border-default)' : 'var(--primary-border)'}`,
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>

                    {/* Source Citations Pill List */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{
                        marginTop: 6,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Ground Truth Sources:</span>
                        {msg.sources.map((src, si) => (
                          <span
                            key={si}
                            style={{
                              fontSize: '10.5px',
                              fontFamily: 'var(--font-mono)',
                              padding: '2px 8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-default)',
                              borderRadius: 'var(--radius-xs)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {src.doc_type || 'Doc'} · {Math.round((src.score || 0.85) * 100)}% match
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {loading && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  width: 'fit-content',
                }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Searching vector embeddings & formulating answer…
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Bar */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-subtle)',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}>
              <textarea
                className="form-input"
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about PEOs, criterion scores, student outcomes, or faculty publications…"
                style={{
                  flex: 1,
                  resize: 'none',
                  height: 42,
                  padding: '10px 14px',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="btn btn-primary"
                style={{ height: 42, padding: '0 16px' }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* Suggested Queries Sidebar */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              paddingBottom: 10,
              borderBottom: '1px solid var(--border-subtle)'
            }}>
              <HelpCircle size={15} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Suggested Queries
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
              flex: 1,
            }}>
              {SUGGESTED_QUERIES.map((query, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(query)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border-default)',
                    textAlign: 'left',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border-default)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                >
                  {query}
                </button>
              ))}
            </div>

            <div style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.45,
            }}>
              <strong>Architecture:</strong> Queries match dense Qdrant vector spaces and generate answers with explicit document citations.
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .rag-chat-layout {
              grid-template-columns: 1fr !important;
              height: auto !important;
            }
          }
        `}</style>
      </div>
    </div>
  )
}
