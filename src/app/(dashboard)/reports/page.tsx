'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const REPORTS = [
  { type: 'pnl', label: 'Profit & Loss', icon: '📈', description: 'Monthly revenue, costs, net profit and margin. Ready to share with your accountant.' },
  { type: 'balance_sheet', label: 'Balance Sheet', icon: '⚖️', description: 'Assets, liabilities and net position based on your latest financial data.' },
  { type: 'cash_flow', label: 'Cash Flow', icon: '💧', description: 'Current cash position, monthly flow, runway estimate and recent expenses.' },
]

const REPORT_LABELS: Record<string, string> = { pnl: 'Profit & Loss', balance_sheet: 'Balance Sheet', cash_flow: 'Cash Flow' }

interface ReportRecord { id: string; report_type: string; period_end: string; generated_by: string; created_at: string }

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
      setHistory(data ?? [])
    }
    load()
  }, [])

  async function generate(type: string) {
    setGenerating(type)
    setError(null)
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report_type: type }) })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `HTTP ${res.status}`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `nalle-${type}-${new Date().toISOString().split('T')[0]}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { const { data } = await supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20); setHistory(data ?? []) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate report') }
    finally { setGenerating(null) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Reports</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32 }}>Download Excel reports based on your financial data</p>

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#dc2626' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {REPORTS.map(r => (
          <div key={r.type} style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '24px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 32, flexShrink: 0 }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{r.label}</h2>
              <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>{r.description}</p>
            </div>
            <button
              onClick={() => generate(r.type)}
              disabled={!!generating}
              style={{ flexShrink: 0, background: generating === r.type ? '#93c5fd' : '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, border: 'none', cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            >
              {generating === r.type ? <><span style={{ width: 12, height: 12, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generating...</> : '↓ Download'}
            </button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Previously generated</h2>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {history.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < history.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{REPORT_LABELS[r.report_type] ?? r.report_type}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 10 }}>{new Date(r.created_at).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <button onClick={() => generate(r.report_type)} disabled={!!generating} style={{ fontSize: 13, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Regenerate</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 16, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>Need a custom report?</p>
        <p style={{ fontSize: 13, color: '#3b82f6', marginBottom: 12 }}>Ask the AI CFO to generate a specific breakdown or analysis.</p>
        <a href="/chat" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Open AI CFO →</a>
      </div>
    </div>
  )
}
