'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MODULE_LABELS: Record<string, string> = {
  balance_sheet: 'Balance Sheet',
  pnl: 'Profit & Loss',
  debt: 'Debt Management',
  bookkeeping: 'Bookkeeping',
  compliance: 'Finnish Compliance',
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 border-emerald-200',
  in_progress: 'bg-blue-50 border-blue-200',
  skipped: 'bg-gray-50 border-gray-200',
  pending: 'bg-white border-gray-100',
}

interface Definition {
  id: string
  title: string
  description: string
  sort_order: number
  applicable_business_types: string[]
  requires_salary_payer: boolean
}

interface Progress {
  checklist_id: string
  status: string
  notes: string | null
}

export default function ChecklistModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: moduleKey } = use(params)
  const router = useRouter()
  const [definitions, setDefinitions] = useState<Definition[]>([])
  const [progressMap, setProgressMap] = useState<Map<string, Progress>>(new Map())
  const [profile, setProfile] = useState<{ business_type: string | null; is_salary_payer: boolean } | null>(null)
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

      setProfile(prof)
      const filtered = (defs ?? []).filter((d: Definition) => {
        if (d.applicable_business_types?.length > 0 && prof?.business_type &&
            !d.applicable_business_types.includes(prof.business_type)) return false
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
      await supabase.from('checklist_progress')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('checklist_id', defId).eq('user_id', user.id)
    } else {
      await supabase.from('checklist_progress')
        .insert({ user_id: user.id, checklist_id: defId, status,
          completed_at: status === 'completed' ? new Date().toISOString() : null })
    }

    setProgressMap(prev => {
      const next = new Map(prev)
      next.set(defId, { checklist_id: defId, status, notes: existing?.notes ?? null })
      return next
    })
    setSaving(null)
  }

  const completed = definitions.filter(d => progressMap.get(d.id)?.status === 'completed').length
  const pct = definitions.length > 0 ? (completed / definitions.length) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{MODULE_LABELS[moduleKey] ?? moduleKey}</h1>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex-1 max-w-xs h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-400">{completed}/{definitions.length} complete</span>
          </div>
        </div>
      </div>

      {definitions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-gray-400">No items apply to your business type.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {definitions.map((def, i) => {
            const progress = progressMap.get(def.id)
            const status = progress?.status ?? 'pending'
            const isSaving = saving === def.id

            return (
              <div
                key={def.id}
                className={`border rounded-xl p-4 transition-colors ${STATUS_STYLES[status] ?? STATUS_STYLES['pending']}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-lg shrink-0">
                    {status === 'completed' ? '✅' : status === 'skipped' ? '⏭' : status === 'in_progress' ? '🔄' : '⬜'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{def.title}</p>
                    {def.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
                    )}
                    <div className="flex gap-2 mt-3">
                      {status !== 'completed' && (
                        <button
                          onClick={() => updateStatus(def.id, 'completed')}
                          disabled={isSaving}
                          className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                          Mark complete
                        </button>
                      )}
                      {status !== 'in_progress' && status !== 'completed' && (
                        <button
                          onClick={() => updateStatus(def.id, 'in_progress')}
                          disabled={isSaving}
                          className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition-colors"
                        >
                          In progress
                        </button>
                      )}
                      {status === 'completed' && (
                        <button
                          onClick={() => updateStatus(def.id, 'pending')}
                          disabled={isSaving}
                          className="text-xs text-gray-400 px-3 py-1.5 rounded-lg hover:text-gray-600 disabled:opacity-50 transition-colors"
                        >
                          Undo
                        </button>
                      )}
                      {status !== 'skipped' && status !== 'completed' && (
                        <button
                          onClick={() => updateStatus(def.id, 'skipped')}
                          disabled={isSaving}
                          className="text-xs text-gray-400 px-3 py-1.5 rounded-lg hover:text-gray-600 disabled:opacity-50 transition-colors"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {completed === definitions.length && definitions.length > 0 && (
        <div className="mt-6 bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-emerald-700 font-medium">🎉 Module complete!</p>
          <button onClick={() => router.push('/checklists')} className="mt-2 text-sm text-emerald-600 hover:underline">
            Back to all checklists
          </button>
        </div>
      )}
    </div>
  )
}
