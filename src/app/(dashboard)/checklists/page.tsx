import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

const MODULES = [
  { key: 'balance_sheet', label: 'Balance Sheet', icon: '⚖️', description: 'Track your assets, liabilities and equity' },
  { key: 'pnl', label: 'Profit & Loss', icon: '📈', description: 'Monitor revenue, costs and net profit' },
  { key: 'debt', label: 'Debt Management', icon: '💳', description: 'Keep on top of loans and repayments' },
  { key: 'bookkeeping', label: 'Bookkeeping', icon: '📒', description: 'Stay organised with your records' },
  { key: 'compliance', label: 'Finnish Compliance', icon: '🏛', description: 'Meet your legal obligations' },
]

export default async function ChecklistsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = createServiceClient()

  const { data: profile } = await db.from('profiles').select('business_type, is_salary_payer').eq('id', user!.id).single()
  const { data: definitions } = await db.from('checklist_definitions').select('id, module, applicable_business_types, requires_salary_payer')
  const { data: progress } = await db.from('checklist_progress').select('checklist_id, status').eq('user_id', user!.id)

  const progressMap = new Map(progress?.map(p => [p.checklist_id, p.status]) ?? [])

  function getModuleStats(moduleKey: string) {
    const applicable = (definitions ?? []).filter(d => {
      if (d.module !== moduleKey) return false
      if (d.applicable_business_types?.length > 0 && profile?.business_type &&
          !d.applicable_business_types.includes(profile.business_type)) return false
      if (d.requires_salary_payer && !profile?.is_salary_payer) return false
      return true
    })
    const completed = applicable.filter(d => progressMap.get(d.id) === 'completed').length
    return { total: applicable.length, completed }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Checklists</h1>
      <p className="text-gray-500 text-sm mb-8">Work through each module to get your finances in order</p>

      <div className="grid grid-cols-1 gap-3">
        {MODULES.map(mod => {
          const stats = getModuleStats(mod.key)
          const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
          const done = stats.completed === stats.total && stats.total > 0

          return (
            <Link
              key={mod.key}
              href={`/checklists/${mod.key}`}
              className="bg-white border border-gray-100 rounded-xl p-5 flex items-center gap-5 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="text-3xl">{mod.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="font-semibold text-gray-900">{mod.label}</h2>
                  {done && <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">Complete</span>}
                </div>
                <p className="text-sm text-gray-400 mb-3">{mod.description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {stats.completed}/{stats.total}
                  </span>
                </div>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
