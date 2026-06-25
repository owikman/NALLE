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
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Checklists</h1>
      <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32 }}>Work through each module to get your finances in order</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MODULES.map(mod => {
          const stats = getModuleStats(mod.key)
          const pct = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
          const done = stats.completed === stats.total && stats.total > 0

          return (
            <Link
              key={mod.key}
              href={`/checklists/${mod.key}`}
              style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '24px', display: 'flex', alignItems: 'center', gap: 20, textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s' }}
            >
              <div style={{ fontSize: 32, flexShrink: 0 }}>{mod.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{mod.label}</h2>
                  {done && <span style={{ fontSize: 11, background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 99, fontWeight: 500 }}>Complete</span>}
                </div>
                <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>{mod.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: done ? '#10b981' : '#3b82f6', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{stats.completed}/{stats.total}</span>
                </div>
              </div>
              <span style={{ color: '#d1d5db', fontSize: 20, flexShrink: 0 }}>›</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
