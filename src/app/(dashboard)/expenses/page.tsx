import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Vehicle', equipment: 'Equipment', travel: 'Travel',
  software: 'Software', personnel: 'Personnel', other: 'Other',
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  vehicle:   { bg: '#eff6ff', color: '#1d4ed8' },
  equipment: { bg: '#f5f3ff', color: '#7c3aed' },
  travel:    { bg: '#f0fdf4', color: '#15803d' },
  software:  { bg: '#fff7ed', color: '#c2410c' },
  personnel: { bg: '#fdf2f8', color: '#be185d' },
  other:     { bg: '#f9fafb', color: '#374151' },
}

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: expenses } = await supabase
    .from('expense_logs').select('*').eq('user_id', user!.id)
    .order('date', { ascending: false }).limit(100)

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const totalVat = expenses?.reduce((sum, e) => sum + e.vat_amount, 0) ?? 0
  const byCategory = expenses?.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
    return acc
  }, {}) ?? {}

  const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Expenses</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Track and categorize your business costs</p>
        </div>
        <Link href="/expenses/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
          + Log expense
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total logged', value: fmt(total) },
          { label: 'VAT deductible', value: fmt(totalVat) },
          { label: 'Entries', value: String(expenses?.length ?? 0) },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '24px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{kpi.label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(byCategory).length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 16 }}>By category</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(byCategory).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, amount]) => {
              const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['other']!
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ background: c.bg, color: c.color, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 99, minWidth: 80, textAlign: 'center' }}>
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <div style={{ flex: 1, height: 4, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#3b82f6', borderRadius: 99, width: `${((amount as number) / total) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', minWidth: 80, textAlign: 'right' }}>{fmt(amount as number)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!expenses || expenses.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '64px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#9ca3af', marginBottom: 16 }}>No expenses logged yet</p>
          <Link href="/expenses/new" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
            Log your first expense
          </Link>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                {['Date', 'Description', 'Category', 'VAT', 'Amount'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 3 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 20px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => {
                const c = CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS['other']!
                return (
                  <tr key={e.id} style={{ borderBottom: i < expenses.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: '#111827', maxWidth: 280 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{e.description}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: c.bg, color: c.color, fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 99 }}>
                        {CATEGORY_LABELS[e.category] ?? e.category}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(e.vat_amount)}</td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600, color: '#111827', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(e.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
