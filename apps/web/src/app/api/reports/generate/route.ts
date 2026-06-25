import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const formatEUR = (n: number) =>
  new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

const formatDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { report_type } = await request.json() as { report_type: string }
  const db = createServiceClient()

  const [{ data: profile }, { data: snapshot }, { data: expenses }] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).single(),
    db.from('financial_snapshots').select('*').eq('user_id', user.id)
      .order('snapshot_date', { ascending: false }).limit(1).single(),
    db.from('expense_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
  ])

  if (!snapshot) return NextResponse.json({ error: 'No financial data. Complete the intake first.' }, { status: 400 })

  const wb = XLSX.utils.book_new()
  const businessName = profile?.business_name ?? 'Business'
  const generatedAt = new Date().toLocaleDateString('fi-FI')

  if (report_type === 'pnl') {
    const revenue = snapshot.monthly_revenue as number
    const costs = snapshot.monthly_costs as number
    const net = revenue - costs
    const margin = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : '0'

    const pnlData = [
      ['PROFIT & LOSS STATEMENT', '', ''],
      [businessName, '', ''],
      [`Generated: ${generatedAt}`, '', ''],
      ['', '', ''],
      ['REVENUE', '', ''],
      ['Monthly Revenue', '', formatEUR(revenue)],
      ['Annualised Revenue (est.)', '', formatEUR(revenue * 12)],
      ['', '', ''],
      ['EXPENSES', '', ''],
      ...Object.entries(
        (expenses ?? []).reduce((acc: Record<string, number>, e) => {
          acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
          return acc
        }, {})
      ).map(([cat, amt]) => [cat.charAt(0).toUpperCase() + cat.slice(1), '', formatEUR(amt as number)]),
      ['Monthly Costs (total)', '', formatEUR(costs)],
      ['', '', ''],
      ['NET PROFIT / LOSS', '', formatEUR(net)],
      ['Net Profit Margin', '', `${margin}%`],
    ]
    const ws = XLSX.utils.aoa_to_sheet(pnlData)
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'P&L')
  }

  if (report_type === 'balance_sheet') {
    const bsData = [
      ['BALANCE SHEET', '', ''],
      [businessName, '', ''],
      [`Generated: ${generatedAt}`, '', ''],
      ['', '', ''],
      ['ASSETS', '', ''],
      ['Bank Balance', '', formatEUR(snapshot.bank_balance as number)],
      ['Accounts Receivable', '', formatEUR(snapshot.accounts_receivable as number)],
      ['Total Assets', '', formatEUR((snapshot.bank_balance as number) + (snapshot.accounts_receivable as number))],
      ['', '', ''],
      ['LIABILITIES', '', ''],
      ['Accounts Payable', '', formatEUR(snapshot.accounts_payable as number)],
      ['Total Liabilities', '', formatEUR(snapshot.accounts_payable as number)],
      ['', '', ''],
      ['NET POSITION', '', formatEUR(
        (snapshot.bank_balance as number) +
        (snapshot.accounts_receivable as number) -
        (snapshot.accounts_payable as number)
      )],
    ]
    const ws = XLSX.utils.aoa_to_sheet(bsData)
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet')
  }

  if (report_type === 'cash_flow') {
    const cfData = [
      ['CASH FLOW REPORT', '', ''],
      [businessName, '', ''],
      [`Generated: ${generatedAt}`, '', ''],
      ['', '', ''],
      ['CURRENT POSITION', '', ''],
      ['Bank Balance', '', formatEUR(snapshot.bank_balance as number)],
      ['Accounts Receivable', '', formatEUR(snapshot.accounts_receivable as number)],
      ['Accounts Payable', '', formatEUR(-(snapshot.accounts_payable as number))],
      ['Net Cash Position', '', formatEUR(
        (snapshot.bank_balance as number) +
        (snapshot.accounts_receivable as number) -
        (snapshot.accounts_payable as number)
      )],
      ['', '', ''],
      ['MONTHLY FLOW', '', ''],
      ['Monthly Revenue', '', formatEUR(snapshot.monthly_revenue as number)],
      ['Monthly Costs', '', formatEUR(-(snapshot.monthly_costs as number))],
      ['Net Monthly', '', formatEUR((snapshot.monthly_revenue as number) - (snapshot.monthly_costs as number))],
      ['', '', ''],
      ['RUNWAY', '', ''],
      ['Cash Runway', '', `${snapshot.cash_runway_months} months`],
    ]

    if (expenses && expenses.length > 0) {
      cfData.push(['', '', ''], ['RECENT EXPENSES', '', ''], ['Date', 'Description', 'Amount'])
      expenses.slice(0, 20).forEach(e => {
        cfData.push([formatDate(e.date), e.description, formatEUR(e.amount as number)])
      })
    }

    const ws = XLSX.utils.aoa_to_sheet(cfData)
    ws['!cols'] = [{ wch: 15 }, { wch: 35 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow')
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `nalle-${report_type}-${new Date().toISOString().split('T')[0]}.xlsx`

  // Save report record
  await db.from('reports').insert({
    user_id: user.id,
    report_type,
    period_start: snapshot.snapshot_date,
    period_end: new Date().toISOString().split('T')[0],
    generated_by: 'user',
  })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
