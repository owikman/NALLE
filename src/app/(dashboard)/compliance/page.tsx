'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Obligation { id: string; obligation_type: string; due_date: string; status: string; notes: string | null }

const TYPE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  tyel:             { label: 'TyEL Pension',               icon: '👴', description: 'Employee pension insurance payment' },
  yel:              { label: 'YEL Insurance',              icon: '🛡', description: 'Entrepreneur pension insurance' },
  vat_filing:       { label: 'VAT Return',                 icon: '🧾', description: 'Quarterly VAT filing via OmaVero' },
  tax_prepayment:   { label: 'Tax Prepayment',             icon: '💶', description: 'Quarterly income tax prepayment' },
  salary_payer_reg: { label: 'Salary Payer Registration',  icon: '📋', description: 'Register as salary payer with Vero' },
  annual_accounts:  { label: 'Annual Accounts',            icon: '📊', description: 'File annual accounts (OY)' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  upcoming:  { label: 'Upcoming',  color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' },
  due_soon:  { label: 'Due soon',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  overdue:   { label: 'Overdue',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
}

const STATUS_ORDER = ['overdue', 'due_soon', 'upcoming', 'completed']

export default function CompliancePage() {
  const [obligations, setObligations] = useState<Obligation[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('active')

  useEffect(() => { loadObligations() }, [])

  async function loadObligations() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('compliance_obligations').select('*').eq('user_id', user.id).order('due_date', { ascending: true })
    setObligations(data ?? [])
    setLoading(false)
  }

  async function markComplete(id: string) {
    setSaving(id)
    const supabase = createClient()
    await supabase.from('compliance_obligations').update({ status: 'completed' }).eq('id', id)
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o))
    setSaving(null)
  }

  async function reopen(id: string) {
    setSaving(id)
    const supabase = createClient()
    const obligation = obligations.find(o => o.id === id)
    const newStatus = new Date(obligation!.due_date) < new Date() ? 'overdue' : 'upcoming'
    await supabase.from('compliance_obligations').update({ status: newStatus }).eq('id', id)
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o))
    setSaving(null)
  }

  const filtered = obligations.filter(o => filter === 'active' ? o.status !== 'completed' : o.status === 'completed')
  const sorted = [...filtered].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  const activeCount = obligations.filter(o => o.status !== 'completed').length
  const overdueCount = obligations.filter(o => o.status === 'overdue').length

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' })
  const daysUntil = (d: string) => {
    const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
    if (days < 0) return `${Math.abs(days)} days overdue`
    if (days === 0) return 'Due today'
    if (days === 1) return 'Due tomorrow'
    return `${days} days left`
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}><p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p></div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Compliance</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Finnish business obligations tracker</p>
        </div>
        {overdueCount > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '8px 16px', fontSize: 14, fontWeight: 600, color: '#dc2626' }}>
            {overdueCount} overdue
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = obligations.filter(o => o.status === status).length
          return (
            <div key={status} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: cfg.color, marginBottom: 4 }}>{count}</p>
              <p style={{ fontSize: 12, color: '#6b7280' }}>{cfg.label}</p>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ key: 'active', label: `Active (${activeCount})` }, { key: 'completed', label: `Completed (${obligations.filter(o => o.status === 'completed').length})` }].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{ padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, border: filter === tab.key ? 'none' : '1px solid #e5e7eb', background: filter === tab.key ? '#2563eb' : 'white', color: filter === tab.key ? 'white' : '#6b7280', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '64px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>✅</p>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>{filter === 'active' ? "No active obligations — you're all caught up!" : 'No completed obligations yet.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map(o => {
            const type = TYPE_LABELS[o.obligation_type]
            const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG['upcoming']!
            return (
              <div key={o.id} style={{ background: 'white', borderRadius: 16, border: `1px solid ${o.status === 'overdue' ? '#fecaca' : o.status === 'due_soon' ? '#fde68a' : '#f0f0f0'}`, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{type?.icon ?? '📌'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{type?.label ?? o.obligation_type}</h3>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 500, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                    </div>
                    {type?.description && <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>{type.description}</p>}
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: o.notes ? 10 : 16 }}>
                      <span style={{ color: '#6b7280' }}>{fmtDate(o.due_date)}</span>
                      <span style={{ fontWeight: 500, color: o.status === 'overdue' ? '#dc2626' : o.status === 'due_soon' ? '#d97706' : '#9ca3af' }}>{daysUntil(o.due_date)}</span>
                    </div>
                    {o.notes && <p style={{ fontSize: 13, color: '#6b7280', background: '#f9fafb', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>{o.notes}</p>}
                    {o.status !== 'completed' ? (
                      <button onClick={() => markComplete(o.id)} disabled={saving === o.id} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: saving === o.id ? 0.5 : 1 }}>
                        Mark complete
                      </button>
                    ) : (
                      <button onClick={() => reopen(o.id)} disabled={saving === o.id} style={{ background: 'none', color: '#9ca3af', border: 'none', padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 24, background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 16, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>Need help with an obligation?</p>
        <p style={{ fontSize: 13, color: '#3b82f6', marginBottom: 12 }}>Ask the AI CFO for guidance on any of these items.</p>
        <a href="/chat" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Open AI CFO →</a>
      </div>
    </div>
  )
}
