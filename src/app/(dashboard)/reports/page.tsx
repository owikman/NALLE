import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const REPORT_META: Record<string, { label: string; icon: string; desc: string }> = {
  pnl:           { label: 'Profit & Loss',  icon: '📊', desc: 'Revenue, expenses and net profit for a period' },
  balance_sheet: { label: 'Balance Sheet',  icon: '⚖️', desc: 'Assets, liabilities and equity at a point in time' },
  cash_flow:     { label: 'Cash Flow',      icon: '💧', desc: 'How cash moved through the business' },
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: reports } = await db
    .from('reports')
    .select('id, report_type, period_start, period_end, title, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' })

  // Group by type for the "create" cards
  const latestByType: Record<string, typeof reports extends (infer T)[] | null ? T : never> = {}
  for (const r of reports ?? []) {
    if (!latestByType[r.report_type]) latestByType[r.report_type] = r
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Reports</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Create and view your financial reports</p>
        </div>
        <Link href="/reports/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          + Create report
        </Link>
      </div>

      {/* Report type cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
        {Object.entries(REPORT_META).map(([type, meta]) => {
          const latest = latestByType[type]
          return (
            <div key={type} style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 30, flexShrink: 0 }}>{meta.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{meta.label}</h2>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>{meta.desc}</p>
                {latest && (
                  <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Last created {fmtDate(latest.created_at)}
                    {latest.id && latest.content && (
                      <> · <Link href={`/reports/${latest.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>View →</Link></>
                    )}
                  </p>
                )}
              </div>
              <Link href={`/reports/new?type=${type}`} style={{ flexShrink: 0, background: '#f9fafb', color: '#374151', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                + Create
              </Link>
            </div>
          )
        })}
      </div>

      {/* All saved reports */}
      {reports && reports.length > 0 && (
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saved reports</h2>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {reports.map((r, i) => {
              const meta = REPORT_META[r.report_type]
              const hasContent = !!r.content
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < reports.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                  <span style={{ fontSize: 18 }}>{meta?.icon ?? '📄'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title ?? `${meta?.label ?? r.report_type}`}
                    </p>
                    <p style={{ fontSize: 12, color: '#9ca3af' }}>{fmtDate(r.created_at)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {hasContent && (
                      <Link href={`/reports/${r.id}`} style={{ fontSize: 13, color: '#2563eb', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 8, padding: '6px 12px', textDecoration: 'none', fontWeight: 500 }}>
                        View
                      </Link>
                    )}
                    <Link href={`/reports/new?type=${r.report_type}`} style={{ fontSize: 13, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', textDecoration: 'none' }}>
                      Recreate
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(!reports || reports.length === 0) && (
        <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 16, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>No reports yet</p>
          <p style={{ fontSize: 14, color: '#3b82f6', marginBottom: 20 }}>Create your first report — we'll walk you through it step by step.</p>
          <Link href="/reports/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
            Create first report →
          </Link>
        </div>
      )}
    </div>
  )
}
