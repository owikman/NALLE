import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: snapshot } = await supabase
    .from('financial_snapshots')
    .select('*')
    .eq('user_id', user!.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  const { data: obligations } = await supabase
    .from('compliance_obligations')
    .select('*')
    .eq('user_id', user!.id)
    .in('status', ['due_soon', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(5)

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 mb-8">Your business financial overview</p>

      {!snapshot ? (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <h2 className="font-semibold text-blue-900 mb-1">Complete your financial intake</h2>
          <p className="text-sm text-blue-700 mb-4">
            Answer a few simple questions to get your personalized financial dashboard.
          </p>
          <a
            href="/intake"
            className="inline-block bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Start intake
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {[
            { label: 'Bank Balance', value: formatEUR(snapshot.bank_balance) },
            { label: 'Monthly Revenue', value: formatEUR(snapshot.monthly_revenue) },
            { label: 'Monthly Costs', value: formatEUR(snapshot.monthly_costs) },
            { label: 'Cash Runway', value: `${snapshot.cash_runway_months} months` },
            { label: 'Net Margin', value: `${snapshot.net_profit_margin}%` },
            { label: 'Receivables', value: formatEUR(snapshot.accounts_receivable) },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className="text-xl font-semibold text-gray-900">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {obligations && obligations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Upcoming obligations</h2>
          <ul className="space-y-2">
            {obligations.map(o => (
              <li key={o.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{o.obligation_type.replace(/_/g, ' ')}</span>
                <span className={`font-medium ${o.status === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                  {new Date(o.due_date).toLocaleDateString('fi-FI')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
