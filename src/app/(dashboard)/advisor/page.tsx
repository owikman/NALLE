'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type AnalysisType = 'tax' | 'spending' | 'consultation'
interface Analysis { id?: string; title: string; text: string; generated_at?: string }

const ANALYSES: { type: AnalysisType; icon: string; title: string; subtitle: string; desc: string; color: string; bg: string }[] = [
  {
    type: 'tax',
    icon: '🧠',
    title: 'Tax Savings Analysis',
    subtitle: 'Find money you\'re leaving on the table',
    desc: 'AI reviews your business profile, income, and expenses to identify specific Finnish tax saving opportunities — deductions, YEL optimization, salary vs dividend, VAT.',
    color: '#16a34a',
    bg: '#f0fdf4',
  },
  {
    type: 'spending',
    icon: '🎯',
    title: 'Spending Optimization',
    subtitle: 'Spend less on the wrong things, more on the right ones',
    desc: 'AI audits your expense categories and financial position to identify where to cut, where to invest, and which spending gives you the best return.',
    color: '#2563eb',
    bg: '#eff6ff',
  },
  {
    type: 'consultation',
    icon: '💼',
    title: 'Business Consultation',
    subtitle: 'Your personal Finnish CFO — no jargon, just results',
    desc: 'A comprehensive AI consultation covering your financial health, the most important actions for the next 30 days and 6 months, and opportunities most entrepreneurs overlook.',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
]

export default function AdvisorPage() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [loading, setLoading] = useState<AnalysisType | null>(null)
  const [results, setResults] = useState<Record<AnalysisType, Analysis | null>>({ tax: null, spending: null, consultation: null })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('is_premium').eq('id', user.id).single()
      setIsPremium(!!profile?.is_premium)
    }
    load()
  }, [])

  async function runAnalysis(type: AnalysisType) {
    setLoading(type); setError(null)
    try {
      const res = await fetch('/api/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Analysis failed')
      setResults(r => ({ ...r, [type]: json }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  if (isPremium === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}><p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p></div>

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>AI Advisor</h1>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Premium financial intelligence tailored to your business</p>
      </div>

      {!isPremium ? (
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: 20, padding: 40, color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Premium feature</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 24, fontSize: 15 }}>Upgrade to access tax savings analysis, spending optimization, and your personal AI CFO consultation.</p>
          <Link href="/plans" style={{ background: 'white', color: '#1d4ed8', borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Upgrade to Premium →
          </Link>
        </div>
      ) : (
        <>
          {error && <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#dc2626' }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {ANALYSES.map(a => {
              const result = results[a.type]
              const isLoading = loading === a.type
              return (
                <div key={a.type} style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  {/* Header */}
                  <div style={{ padding: '24px 28px', borderBottom: result ? '1px solid #f3f4f6' : 'none' }}>
                    <div className="advisor-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                        {a.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{a.title}</h2>
                        <p style={{ fontSize: 13, fontWeight: 500, color: a.color, marginBottom: 8 }}>{a.subtitle}</p>
                        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{a.desc}</p>
                      </div>
                      <button
                        onClick={() => runAnalysis(a.type)}
                        disabled={!!loading}
                        className="advisor-run-btn"
                        style={{ flexShrink: 0, background: result ? '#f9fafb' : a.color === '#16a34a' ? '#16a34a' : a.color, color: result ? '#374151' : 'white', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600, border: result ? '1px solid #e5e7eb' : 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        {isLoading ? (
                          <><span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> Analyzing...</>
                        ) : result ? 'Regenerate' : '✦ Run analysis'}
                      </button>
                    </div>
                  </div>

                  {/* Result */}
                  {isLoading && (
                    <div style={{ padding: '32px 28px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
                      <p style={{ fontSize: 14, color: '#6b7280' }}>Claude is analyzing your business data...</p>
                      <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>This takes about 15-20 seconds</p>
                    </div>
                  )}

                  {result && !isLoading && (
                    <div style={{ padding: '28px' }}>
                      <MarkdownReport text={result.text} accentColor={a.color} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function MarkdownReport({ text, accentColor }: { text: string; accentColor: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginTop: i === 0 ? 0 : 24, marginBottom: 8, paddingBottom: 6, borderBottom: `2px solid ${accentColor}20` }}>{line.replace('### ', '')}</h3>
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginTop: i === 0 ? 0 : 28, marginBottom: 10 }}>{line.replace('## ', '')}</h2>
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>{line.replace(/\*\*/g, '')}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <span style={{ color: accentColor, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
              <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          )
        }
        if (line.trim() === '') return <div key={i} style={{ height: 8 }} />
        return (
          <p key={i} style={{ marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        )
      })}
    </div>
  )
}
