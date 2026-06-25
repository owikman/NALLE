'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const REPORTS = [
  {
    type: 'pnl',
    label: 'Profit & Loss',
    icon: '📈',
    description: 'Monthly revenue, costs, net profit and margin. Ready to share with your accountant.',
  },
  {
    type: 'balance_sheet',
    label: 'Balance Sheet',
    icon: '⚖️',
    description: 'Assets, liabilities and net position based on your latest financial data.',
  },
  {
    type: 'cash_flow',
    label: 'Cash Flow',
    icon: '💧',
    description: 'Current cash position, monthly flow, runway estimate and recent expenses.',
  },
]

interface ReportRecord {
  id: string
  report_type: string
  period_end: string
  generated_by: string
  created_at: string
}

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ReportRecord[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setHistory(data ?? [])
    }
    load()
  }, [])

  async function generate(type: string) {
    setGenerating(type)
    setError(null)
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: type }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }

      // Trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nalle-${type}-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      // Refresh history
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('reports').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
        setHistory(data ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  const REPORT_LABELS: Record<string, string> = {
    pnl: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Cash Flow',
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-8">Download Excel reports based on your financial data</p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-10">
        {REPORTS.map(report => (
          <div key={report.type} className="bg-white border border-gray-100 rounded-xl p-5 flex items-center gap-5">
            <div className="text-3xl">{report.icon}</div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 mb-0.5">{report.label}</h2>
              <p className="text-sm text-gray-400">{report.description}</p>
            </div>
            <button
              onClick={() => generate(report.type)}
              disabled={!!generating}
              className="shrink-0 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {generating === report.type ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                '↓ Download'
              )}
            </button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Previously generated</h2>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            {history.map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center justify-between px-4 py-3 text-sm ${i < history.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div>
                  <span className="font-medium text-gray-800">{REPORT_LABELS[r.report_type] ?? r.report_type}</span>
                  <span className="text-gray-400 ml-2 text-xs">
                    {new Date(r.created_at).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={() => generate(r.report_type)}
                  disabled={!!generating}
                  className="text-xs text-blue-500 hover:underline disabled:opacity-50"
                >
                  Regenerate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Need a custom report?</p>
        <p className="text-xs text-blue-700 mb-2">Ask the AI CFO to generate a specific breakdown or analysis.</p>
        <a href="/chat" className="text-xs text-blue-600 hover:underline font-medium">Open AI CFO →</a>
      </div>
    </div>
  )
}
