'use client'

import { useState, useRef, useEffect } from 'react'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'What is my current cash runway?',
  'Am I making a profit this month?',
  'What Finnish obligations do I need to handle?',
  'How can I improve my cash flow?',
  'Explain my profit margin in simple terms',
  'What should I prioritize financially right now?',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    setError(null)
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])
    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }), signal: abortRef.current.signal })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`) }
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('0:')) { try { accumulated += JSON.parse(line.slice(2)); setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m)) } catch { /* skip */ } }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setMessages(prev => prev.filter(m => m.id !== assistantId))
    } finally { setIsLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>AI CFO</h1>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Ask anything about your business finances</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Your AI financial advisor</h2>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>Ask me anything about your numbers</p>
            </div>
            <div className="resp-grid-suggestions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{ textAlign: 'left', padding: '16px 18px', background: 'white', border: '1px solid #f0f0f0', borderRadius: 14, fontSize: 14, color: '#374151', cursor: 'pointer', lineHeight: 1.4, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, marginRight: 10, marginTop: 4, flexShrink: 0 }}>N</div>
              )}
              <div style={{ maxWidth: 560, padding: '12px 16px', borderRadius: 16, fontSize: 14, lineHeight: 1.6, background: m.role === 'user' ? '#2563eb' : 'white', color: m.role === 'user' ? 'white' : '#111827', border: m.role === 'assistant' ? '1px solid #f0f0f0' : 'none', boxShadow: m.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', borderBottomRightRadius: m.role === 'user' ? 4 : 16, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 16 }}>
                {m.content
                  ? m.content.split('\n').map((line, i) => <p key={i} style={{ margin: i > 0 ? '8px 0 0' : 0 }}>{line}</p>)
                  : <span style={{ display: 'flex', gap: 4 }}>
                      {[0, 150, 300].map(delay => <span key={delay} style={{ width: 6, height: 6, background: '#d1d5db', borderRadius: '50%', display: 'inline-block', animation: 'bounce 1s infinite', animationDelay: `${delay}ms` }} />)}
                    </span>
                }
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {error && <div style={{ marginBottom: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>{error}</div>}

      <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your finances..."
          disabled={isLoading}
          style={{ flex: 1, background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 18px', fontSize: 14, outline: 'none', color: '#111827' }}
          onFocus={e => e.target.style.borderColor = '#3b82f6'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <button type="submit" disabled={isLoading || !input.trim()} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 14, padding: '14px 24px', fontSize: 14, fontWeight: 600, cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer', opacity: isLoading || !input.trim() ? 0.5 : 1 }}>
          Send
        </button>
      </form>
    </div>
  )
}
