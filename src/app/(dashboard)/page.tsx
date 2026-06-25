import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RevenueChart from '@/components/dashboard/RevenueChart'
import ExpensePieChart from '@/components/dashboard/ExpensePieChart'
import HealthScore from '@/components/dashboard/HealthScore'

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle', equipment: 'Equipment', travel: 'Travel',
  software: 'Software', personnel: 'Personnel', other: 'Other',
}

function computeHealthScore(s: { cash_runway_months: number; net_profit_margin: number; accounts_receivable: number; monthly_revenue: number }) {
  let score = 0
  score += Math.min(40, (s.cash_runway_months / 6) * 40)
  score += Math.min(40, Math.max(0, (s.net_profit_margin / 20) * 40))
  const recRatio = s.monthly_revenue > 0 ? s.accounts_receivable / s.monthly_revenue : 0
  score += Math.max(0, 20 - recRatio * 10)
  return Math.round(score)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase.from('profiles').select('business_name,onboarding_completed,active_company_id').eq('id', user!.id).single()
  const companyId = profile?.active_company_id

  const [{ data: snapshot }, { data: snapshots }, { data: expenses }, { data: obligations }] = await Promise.all([
    supabase.from('financial_snapshots').select('*').eq('user_id', user!.id).order('snapshot_date', { ascending: false }).limit(1).single(),
    supabase.from('financial_snapshots').select('snapshot_date,monthly_revenue,monthly_costs').eq('user_id', user!.id).order('snapshot_date', { ascending: true }).limit(12),
    supabase.from('expense_logs').select('category,amount').eq('user_id', user!.id),
    companyId
      ? supabase.from('compliance_obligations').select('*').eq('company_id', companyId).in('status', ['due_soon', 'overdue']).order('due_date', { ascending: true }).limit(5)
      : supabase.from('compliance_obligations').select('*').eq('user_id', user!.id).in('status', ['due_soon', 'overdue']).order('due_date', { ascending: true }).limit(5),
  ])

  const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

  if (!profile?.onboarding_completed || !snapshot) {
    return (
      <div style={{ maxWidth: 480, margin: '48px auto', textAlign: 'center' }}>
        <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 20, padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>Set up your financial dashboard</h2>
          <p style={{ fontSize: 14, color: '#3b82f6', marginBottom: 24, lineHeight: 1.6 }}>
            Answer 15 quick questions about your business and we'll generate your personalized dashboard instantly.
          </p>
          <Link href="/intake" style={{ display: 'inline-block', background: '#2563eb', color: 'white', borderRadius: 14, padding: '14px 28px', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
            Start financial intake →
          </Link>
        </div>
      </div>
    )
  }

  const healthScore = computeHealthScore(snapshot)

  let chartData = (snapshots ?? []).map(s => ({ month: new Date(s.snapshot_date).toLocaleDateString('fi-FI', { month: 'short' }), revenue: s.monthly_revenue as number, costs: s.monthly_costs as number }))
  if (chartData.length < 2) {
    chartData = ['Jan','Feb','Mar','Apr','May','Jun'].map(month => ({ month, revenue: snapshot.monthly_revenue as number, costs: snapshot.monthly_costs as number }))
  }

  const expenseByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e) => { acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number); return acc }, {})
  const pieData = Object.entries(expenseByCategory).map(([cat, value]) => ({ name: CATEGORY_LABELS[cat] ?? cat, value: value as number }))
  const netMonthly = (snapshot.monthly_revenue as number) - (snapshot.monthly_costs as number)

  const kpis = [
    { label: 'Bank Balance',    value: fmt(snapshot.bank_balance),   sub: 'Current',          color: '#111827' },
    { label: 'Monthly Revenue', value: fmt(snapshot.monthly_revenue), sub: 'Average',          color: '#2563eb' },
    { label: 'Monthly Costs',   value: fmt(snapshot.monthly_costs),   sub: 'Average',          color: '#dc2626' },
    { label: 'Net Monthly',     value: fmt(netMonthly),               sub: netMonthly >= 0 ? 'Profit' : 'Loss', color: netMonthly >= 0 ? '#16a34a' : '#dc2626' },
    { label: 'Cash Runway',     value: `${snapshot.cash_runway_months}mo`, sub: 'At current burn', color: (snapshot.cash_runway_months as number) >= 3 ? '#16a34a' : '#d97706' },
    { label: 'Net Margin',      value: `${snapshot.net_profit_margin}%`,   sub: 'Profit margin',   color: (snapshot.net_profit_margin as number) >= 0 ? '#2563eb' : '#dc2626' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{profile.business_name ?? 'Dashboard'}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Financial overview</p>
        </div>
        <Link href={companyId ? `/intake?company=${companyId}` : '/intake'} style={{ fontSize: 13, color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', textDecoration: 'none', fontWeight: 500 }}>
          Update intake
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{kpi.label}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: kpi.color, marginBottom: 4 }}>{kpi.value}</p>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Revenue vs Costs</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> Revenue</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', display: 'inline-block' }} /> Costs</span>
            </div>
          </div>
          <RevenueChart data={chartData} />
        </div>

        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Financial Health</h2>
          <HealthScore score={healthScore} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Cash runway', ok: (snapshot.cash_runway_months as number) >= 3 },
              { label: 'Profit margin', ok: (snapshot.net_profit_margin as number) >= 0 },
              { label: 'Receivables', ok: (snapshot.accounts_receivable as number) < (snapshot.monthly_revenue as number) * 2 },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: item.ok ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{item.ok ? '✓' : '✗'}</span>
                <span style={{ color: '#6b7280' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Expenses by category</h2>
            <Link href="/expenses" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</Link>
          </div>
          {pieData.length > 0 ? <ExpensePieChart data={pieData} /> : (
            <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>No expenses logged yet</p>
              <Link href="/expenses/new" style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>Log your first expense</Link>
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Compliance alerts</h2>
            <Link href="/compliance" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</Link>
          </div>
          {!obligations || obligations.length === 0 ? (
            <div style={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <p style={{ fontSize: 24 }}>✅</p>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>All obligations up to date</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {obligations.map(o => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, background: o.status === 'overdue' ? '#fef2f2' : '#fffbeb' }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>{o.status === 'overdue' ? '🔴' : '🟡'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', textTransform: 'capitalize' }}>{(o.obligation_type as string).replace(/_/g, ' ')}</p>
                    <p style={{ fontSize: 12, color: o.status === 'overdue' ? '#dc2626' : '#d97706', marginTop: 2 }}>Due {fmtDate(o.due_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
