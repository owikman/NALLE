import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RevenueChart from '@/components/dashboard/RevenueChart'
import ExpensePieChart from '@/components/dashboard/ExpensePieChart'
import HealthScore from '@/components/dashboard/HealthScore'

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle', equipment: 'Equipment', travel: 'Travel',
  software: 'Software', personnel: 'Personnel', other: 'Other',
}

function computeHealthScore(snapshot: {
  cash_runway_months: number
  net_profit_margin: number
  accounts_receivable: number
  monthly_revenue: number
}): number {
  let score = 0
  // Cash runway (0-40pts): 3+ months = full, scales down
  score += Math.min(40, (snapshot.cash_runway_months / 6) * 40)
  // Profit margin (0-40pts): 20%+ = full
  score += Math.min(40, Math.max(0, (snapshot.net_profit_margin / 20) * 40))
  // Receivables ratio (0-20pts): low receivables relative to revenue = good
  const recRatio = snapshot.monthly_revenue > 0
    ? snapshot.accounts_receivable / snapshot.monthly_revenue
    : 0
  score += Math.max(0, 20 - recRatio * 10)
  return Math.round(score)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: snapshot }, { data: snapshots }, { data: expenses }, { data: obligations }, { data: profile }] =
    await Promise.all([
      supabase.from('financial_snapshots').select('*').eq('user_id', user!.id)
        .order('snapshot_date', { ascending: false }).limit(1).single(),
      supabase.from('financial_snapshots').select('snapshot_date,monthly_revenue,monthly_costs')
        .eq('user_id', user!.id).order('snapshot_date', { ascending: true }).limit(12),
      supabase.from('expense_logs').select('category,amount').eq('user_id', user!.id),
      supabase.from('compliance_obligations').select('*').eq('user_id', user!.id)
        .in('status', ['due_soon', 'overdue']).order('due_date', { ascending: true }).limit(5),
      supabase.from('profiles').select('business_name,onboarding_completed').eq('id', user!.id).single(),
    ])

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

  if (!profile?.onboarding_completed || !snapshot) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-blue-900 mb-2">Set up your financial dashboard</h2>
          <p className="text-sm text-blue-700 mb-6">
            Answer 15 quick questions about your business and we'll generate your personalized dashboard instantly.
          </p>
          <Link
            href="/intake"
            className="inline-block bg-blue-600 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Start financial intake →
          </Link>
        </div>
      </div>
    )
  }

  const healthScore = computeHealthScore(snapshot)

  const chartData = (snapshots ?? []).map(s => ({
    month: new Date(s.snapshot_date).toLocaleDateString('fi-FI', { month: 'short' }),
    revenue: s.monthly_revenue as number,
    costs: s.monthly_costs as number,
  }))

  // Pad with current snapshot if only one entry
  if (chartData.length < 2) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const padded = months.map(month => ({
      month,
      revenue: snapshot.monthly_revenue as number,
      costs: snapshot.monthly_costs as number,
    }))
    chartData.splice(0, chartData.length, ...padded)
  }

  const expenseByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
    return acc
  }, {})

  const pieData = Object.entries(expenseByCategory).map(([cat, value]) => ({
    name: CATEGORY_LABELS[cat] ?? cat,
    value: value as number,
  }))

  const netMonthly = (snapshot.monthly_revenue as number) - (snapshot.monthly_costs as number)

  const kpis = [
    { label: 'Bank Balance', value: formatEUR(snapshot.bank_balance), sub: 'Current', color: 'text-gray-900' },
    { label: 'Monthly Revenue', value: formatEUR(snapshot.monthly_revenue), sub: 'Average', color: 'text-blue-600' },
    { label: 'Monthly Costs', value: formatEUR(snapshot.monthly_costs), sub: 'Average', color: 'text-red-500' },
    { label: 'Net Monthly', value: formatEUR(netMonthly), sub: netMonthly >= 0 ? 'Profit' : 'Loss', color: netMonthly >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: 'Cash Runway', value: `${snapshot.cash_runway_months}mo`, sub: 'At current burn', color: (snapshot.cash_runway_months as number) >= 3 ? 'text-emerald-600' : 'text-amber-500' },
    { label: 'Net Margin', value: `${snapshot.net_profit_margin}%`, sub: 'Profit margin', color: (snapshot.net_profit_margin as number) >= 0 ? 'text-blue-600' : 'text-red-500' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {profile.business_name ?? 'Dashboard'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Financial overview</p>
        </div>
        <Link
          href="/intake"
          className="text-xs text-gray-400 hover:text-blue-500 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          Update intake
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Revenue vs Costs chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Revenue vs Costs</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Costs</span>
            </div>
          </div>
          <RevenueChart data={chartData} />
        </div>

        {/* Health score */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Financial Health</h2>
          <HealthScore score={healthScore} />
          <div className="mt-3 space-y-1.5">
            {[
              { label: 'Cash runway', ok: (snapshot.cash_runway_months as number) >= 3 },
              { label: 'Profit margin', ok: (snapshot.net_profit_margin as number) >= 0 },
              { label: 'Receivables', ok: (snapshot.accounts_receivable as number) < (snapshot.monthly_revenue as number) * 2 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className={item.ok ? 'text-emerald-500' : 'text-red-400'}>{item.ok ? '✓' : '✗'}</span>
                <span className="text-gray-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Expense breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-800">Expenses by category</h2>
            <Link href="/expenses" className="text-xs text-blue-500 hover:underline">View all</Link>
          </div>
          {pieData.length > 0 ? (
            <ExpensePieChart data={pieData} />
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-400 mb-3">No expenses logged yet</p>
              <Link href="/expenses/new" className="text-xs text-blue-500 hover:underline">Log your first expense</Link>
            </div>
          )}
        </div>

        {/* Compliance obligations */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Compliance alerts</h2>
            <Link href="/compliance" className="text-xs text-blue-500 hover:underline">View all</Link>
          </div>
          {!obligations || obligations.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm text-gray-400">All obligations up to date</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {obligations.map(o => (
                <div
                  key={o.id}
                  className={`flex items-start gap-3 p-3 rounded-xl ${o.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}
                >
                  <span className="text-base mt-0.5">{o.status === 'overdue' ? '🔴' : '🟡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 capitalize">
                      {(o.obligation_type as string).replace(/_/g, ' ')}
                    </p>
                    <p className={`text-xs mt-0.5 ${o.status === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>
                      Due {formatDate(o.due_date)}
                    </p>
                    {o.notes && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{o.notes}</p>
                    )}
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
