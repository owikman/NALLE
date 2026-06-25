'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Obligation {
  id: string
  obligation_type: string
  due_date: string
  status: string
  notes: string | null
}

const TYPE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  tyel: { label: 'TyEL Pension', icon: '👴', description: 'Employee pension insurance payment' },
  yel: { label: 'YEL Insurance', icon: '🛡', description: 'Entrepreneur pension insurance' },
  vat_filing: { label: 'VAT Return', icon: '🧾', description: 'Quarterly VAT filing via OmaVero' },
  tax_prepayment: { label: 'Tax Prepayment', icon: '💶', description: 'Quarterly income tax prepayment' },
  salary_payer_reg: { label: 'Salary Payer Registration', icon: '📋', description: 'Register as salary payer with Vero' },
  annual_accounts: { label: 'Annual Accounts', icon: '📊', description: 'File annual accounts (OY)' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  upcoming: { label: 'Upcoming', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  due_soon: { label: 'Due soon', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  overdue: { label: 'Overdue', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  completed: { label: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
}

const STATUS_ORDER = ['overdue', 'due_soon', 'upcoming', 'completed']

export default function CompliancePage() {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('active')

  useEffect(() => {
    loadObligations()
  }, [])

  async function loadObligations() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('compliance_obligations')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true })
    setObligations(data ?? [])
    setLoading(false)
  }

  async function markComplete(id: string) {
    setSaving(id)
    const supabase = createClient()
    await supabase.from('compliance_obligations')
      .update({ status: 'completed' })
      .eq('id', id)
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o))
    setSaving(null)
  }

  async function reopen(id: string) {
    setSaving(id)
    const supabase = createClient()
    const obligation = obligations.find(o => o.id === id)
    const newStatus = new Date(obligation!.due_date) < new Date() ? 'overdue' : 'upcoming'
    await supabase.from('compliance_obligations')
      .update({ status: newStatus })
      .eq('id', id)
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    setSaving(null)
  }

  const filtered = obligations.filter(o =>
    filter === 'active' ? o.status !== 'completed' : o.status === 'completed'
  )

  const sorted = [...filtered].sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )

  const activeCount = obligations.filter(o => o.status !== 'completed').length
  const overdueCount = obligations.filter(o => o.status === 'overdue').length

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fi-FI', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const daysUntil = (d: string) => {
    const diff = new Date(d).getTime() - new Date().getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `${days} days left`
  }

  if (loading) return <div className="flex items-center justify-center h-40"><p className="text-gray-400 text-sm">Loading...</p></div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Finnish business obligations tracker</p>
        </div>
        {overdueCount > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm font-medium text-red-600">
            {overdueCount} overdue
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = obligations.filter(o => o.status === status).length
          return (
            <div key={status} className={`${cfg.bg} border ${cfg.border} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{cfg.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'completed', label: `Completed (${obligations.filter(o => o.status === 'completed').length})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-gray-500 text-sm">
            {filter === 'active' ? 'No active obligations — you\'re all caught up!' : 'No completed obligations yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(o => {
            const type = TYPE_LABELS[o.obligation_type]
            const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG['upcoming']!
            const isSaving = saving === o.id

            return (
              <div key={o.id} className={`bg-white border rounded-xl p-4 ${o.status === 'overdue' ? 'border-red-200' : o.status === 'due_soon' ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{type?.icon ?? '📌'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{type?.label ?? o.obligation_type}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {type?.description && (
                      <p className="text-xs text-gray-400 mb-2">{type.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500">{formatDate(o.due_date)}</span>
                      <span className={`font-medium ${o.status === 'overdue' ? 'text-red-500' : o.status === 'due_soon' ? 'text-amber-500' : 'text-gray-400'}`}>
                        {daysUntil(o.due_date)}
                      </span>
                    </div>
                    {o.notes && (
                      <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-2">{o.notes}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      {o.status !== 'completed' ? (
                        <button
                          onClick={() => markComplete(o.id)}
                          disabled={isSaving}
                          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          Mark complete
                        </button>
                      ) : (
                        <button
                          onClick={() => reopen(o.id)}
                          disabled={isSaving}
                          className="text-xs text-gray-400 px-3 py-1.5 rounded-lg hover:text-gray-600 disabled:opacity-50 transition-colors"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-900 mb-1">Need help with an obligation?</p>
        <p className="text-xs text-blue-700">Ask the AI CFO for guidance on any of these items.</p>
        <a href="/chat" className="inline-block mt-2 text-xs text-blue-600 hover:underline font-medium">Open AI CFO →</a>
      </div>
    </div>
  )
}
