import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  equipment: 'Equipment',
  travel: 'Travel',
  software: 'Software',
  personnel: 'Personnel',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  vehicle: 'bg-blue-50 text-blue-700',
  equipment: 'bg-purple-50 text-purple-700',
  travel: 'bg-green-50 text-green-700',
  software: 'bg-orange-50 text-orange-700',
  personnel: 'bg-pink-50 text-pink-700',
  other: 'bg-gray-50 text-gray-700',
}

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: expenses } = await supabase
    .from('expense_logs')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })
    .limit(100)

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const totalVat = expenses?.reduce((sum, e) => sum + e.vat_amount, 0) ?? 0

  const byCategory = expenses?.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
    return acc
  }, {}) ?? {}

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fi-FI')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track and categorize your business costs</p>
        </div>
        <Link
          href="/expenses/new"
          className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Log expense
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total logged</p>
          <p className="text-xl font-semibold text-gray-900">{formatEUR(total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">VAT deductible</p>
          <p className="text-xl font-semibold text-gray-900">{formatEUR(totalVat)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Entries</p>
          <p className="text-xl font-semibold text-gray-900">{expenses?.length ?? 0}</p>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">By category</h2>
          <div className="space-y-2">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat] ?? 'bg-gray-50 text-gray-700'}`}>
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{ width: `${((amount as number) / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-20 text-right">
                      {formatEUR(amount as number)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Expense list */}
      {!expenses || expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 mb-4">No expenses logged yet</p>
          <Link
            href="/expenses/new"
            className="inline-block bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Log your first expense
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Category</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">VAT</th>
                <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, i) => (
                <tr
                  key={expense.id}
                  className={`${i < expenses.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-gray-50 transition-colors`}
                >
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    {expense.description}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[expense.category] ?? 'bg-gray-50 text-gray-700'}`}>
                      {CATEGORY_LABELS[expense.category] ?? expense.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">
                    {formatEUR(expense.vat_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                    {formatEUR(expense.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
