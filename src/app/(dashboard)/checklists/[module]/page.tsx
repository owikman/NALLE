'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MODULE_LABELS: Record<string, string> = {
  balance_sheet: 'Balance Sheet', pnl: 'Profit & Loss', debt: 'Debt Management',
  bookkeeping: 'Bookkeeping', compliance: 'Finnish Compliance',
}

interface Definition { id: string; title: string; description: string; sort_order: number; applicable_business_types: string[]; requires_salary_payer: boolean }
interface Progress { checklist_id: string; status: string; notes: string | null }

export default function ChecklistModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = use(params)
  const router = useRouter()
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, Progress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: prof }, { data: defs }, { data: prog }] = await Promise.all([
        supabase.from('profiles').select('business_type, is_salary_payer').eq('id', user.id).single(),
        supabase.from('checklist_definitions').select('*').eq('module', moduleKey).order('sort_order'),
        supabase.from('checklist_progress').select('*').eq('user_id', user.id),
      ])
      const filtered = (defs ?? []).filter((d: Definition) => {
        if (d.applicable_business_types?.length > 0 && prof?.business_type && !d.applicable_business_types.includes(prof.business_type)) return false
        if (d.requires_salary_payer && !prof?.is_salary_payer) return false
        return true
      })
      setDefinitions(filtered)
      setProgressMap(new Map((prog ?? []).map((p: Progress) => [p.checklist_id, p])))
      setLoading(false)
    }
    load()
  }, [moduleKey])

  async function updateStatus(defId: string, status: string) {
    setSaving(defId)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const existing = progressMap.get(defId)
    if (existing) {
      await supabase.from('checklist_progress').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('checklist_id', defId).eq('user_id', user.id)
    } else {
      await supabase.from('checklist_progress').insert({ user_id: user.id, checklist_id: defId, status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    }
    setProgressMap(prev => { const next = new Map(prev); next.set(defId, { checklist_id: defId, status, notes: existing?.notes ?? null }); return next })
    setSaving(null)
  }

  const completed = definitions.filter(d => progressMap.get(d.id)?.status === 'completed').length
  const pct = definitions.length > 0 ? (completed / definitions.length) * 100 : 0
  const allDone = completed === definitions.length && definitions.length > 0

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}><p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p></div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{MODULE_LABELS[moduleKey] ?? moduleKey}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, maxWidth: 200, height: 4, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: allDone ? '#16a34a' : '#3b82f6', borderRadius: 99, width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{completed}/{definitions.length} complete</span>
          </div>
        </div>
      </div>

      {definitions.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>No items apply to your business type.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {definitions.map((def, i) => {
            const status = progressMap.get(def.id)?.status ?? 'pending'
            const isSaving = saving === def.id
            const statusIcon = status === 'completed' ? '✅' : status === 'skipped' ? '⏭' : status === 'in_progress' ? '🔄' : '⬜'
            const bg = status === 'completed' ? '#f0fdf4' : status === 'in_progress' ? '#eff6ff' : status === 'skipped' ? '#f9fafb' : 'white'
            const border = status === 'completed' ? '#bbf7d0' : status === 'in_progress' ? '#dbeafe' : '#f0f0f0'

            return (
              <div key={def.id} style={{ background: bg, borderRadius: 16, border: `1px solid ${border}`, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{statusIcon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{def.title}</p>
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>#{i + 1}</span>
                    </div>
                    {def.description && <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>{def.description}</p>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {status !== 'completed' && (
                        <button onClick={() => updateStatus(def.id, 'completed')} disabled={isSaving} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: isSaving ? 0.5 : 1 }}>
                          Mark complete
                        </button>
                      )}
                      {status !== 'in_progress' && status !== 'completed' && (
                        <button onClick={() => updateStatus(def.id, 'in_progress')} disabled={isSaving} style={{ background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: isSaving ? 0.5 : 1 }}>
                          In progress
                        </button>
                      )}
                      {status === 'completed' && (
                        <button onClick={() => updateStatus(def.id, 'pending')} disabled={isSaving} style={{ background: 'none', color: '#9ca3af', border: 'none', padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>
                          Undo
                        </button>
                      )}
                      {status !== 'skipped' && status !== 'completed' && (
                        <button onClick={() => updateStatus(def.id, 'skipped')} disabled={isSaving} style={{ background: 'none', color: '#9ca3af', border: 'none', padding: '8px 0', fontSize: 13, cursor: 'pointer' }}>
                          Skip
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

      {allDone && (
        <div style={{ marginTop: 24, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: '24px', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#15803d', marginBottom: 8 }}>🎉 Module complete!</p>
          <button onClick={() => router.push('/checklists')} style={{ fontSize: 14, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            Back to all checklists
          </button>
        </div>
      )}
    </div>
  )
}
