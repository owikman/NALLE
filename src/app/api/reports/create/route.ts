import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

function n(v: unknown) { return v ? parseFloat(String(v)) : 0 }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, answers } = await request.json() as { type: string; answers: Record<string, string> }

  const db = createServiceClient()
  const [{ data: profile }, { data: snapshot }, { data: expenses }, { data: invoices }] = await Promise.all([
    db.from('profiles').select('business_name, active_company_id').eq('id', user.id).single(),
    db.from('financial_snapshots').select('*').eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(1).single(),
    db.from('expense_logs').select('category, amount, description, date').eq('user_id', user.id).order('date', { ascending: false }),
    db.from('invoices').select('*').eq('user_id', user.id),
  ])

  if (!snapshot) return NextResponse.json({ error: 'No financial data found. Complete the intake first.' }, { status: 400 })

  const businessName = profile?.business_name ?? 'My Business'
  let periodStart = answers.period_start ?? answers.as_of_date ?? snapshot.snapshot_date
  let periodEnd   = answers.period_end   ?? answers.as_of_date ?? new Date().toISOString().split('T')[0]!

  // Filter expenses to the period for P&L and Cash Flow
  const periodExpenses = (expenses ?? []).filter(e => {
    const d = e.date as string
    return d >= periodStart && d <= periodEnd
  })

  // Filter invoices to the period (paid invoices only — actual cash movement)
  const allInvoices = invoices ?? []
  const paidSentInPeriod = allInvoices.filter(i => i.type === 'sent' && i.status === 'paid' && i.paid_date && i.paid_date >= periodStart && i.paid_date <= periodEnd)
  const paidReceivedInPeriod = allInvoices.filter(i => i.type === 'received' && i.status === 'paid' && i.paid_date && i.paid_date >= periodStart && i.paid_date <= periodEnd)
  const invoiceRevenue = paidSentInPeriod.reduce((s: number, i) => s + n(i.amount) + n(i.vat_amount), 0)
  const invoiceExpenses = paidReceivedInPeriod.reduce((s: number, i) => s + n(i.amount) + n(i.vat_amount), 0)
  const hasInvoices = allInvoices.length > 0

  let content: object = {}
  let title = ''
  let periodLabel = ''

  // ── P&L ────────────────────────────────────────────────────────────────
  if (type === 'pnl') {
    const months = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    // If user has invoices, snapshot revenue is supplementary; invoice revenue is primary
    const snapshotRevenue = hasInvoices ? 0 : n(snapshot.monthly_revenue) * months
    const extraRevenue = n(answers.extra_revenue)
    const totalRevenue = snapshotRevenue + invoiceRevenue + extraRevenue

    const expByCategory = periodExpenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category as string] = (acc[e.category as string] ?? 0) + n(e.amount)
      return acc
    }, {})
    const loggedExpenses = Object.values(expByCategory).reduce((s, v) => s + v, 0)
    const extraExpenses = n(answers.extra_expenses)
    const totalExpenses = loggedExpenses + invoiceExpenses + extraExpenses

    const netProfit = totalRevenue - totalExpenses
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0'

    periodLabel = `${periodStart} – ${periodEnd}`
    title = `P&L · ${periodLabel}`

    const expenseRows = Object.entries(expByCategory).map(([cat, amt]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: fmt(amt),
      raw: amt,
      indent: true,
    }))
    if (invoiceExpenses > 0) expenseRows.push({ label: 'Supplier invoices paid', value: fmt(invoiceExpenses), raw: invoiceExpenses, indent: true })
    if (extraExpenses > 0) expenseRows.push({ label: answers.extra_expenses_desc || 'Other expenses', value: fmt(extraExpenses), raw: extraExpenses, indent: true })

    const revenueRows = []
    if (snapshotRevenue > 0) revenueRows.push({ label: 'Operating revenue', value: fmt(snapshotRevenue), indent: true })
    if (invoiceRevenue > 0) revenueRows.push({ label: 'Invoice revenue (paid)', value: fmt(invoiceRevenue), indent: true })
    if (extraRevenue > 0) revenueRows.push({ label: answers.extra_revenue_desc || 'Other revenue', value: fmt(extraRevenue), indent: true })

    content = {
      type: 'pnl', title, business_name: businessName, period: periodLabel,
      generated_at: new Date().toISOString().split('T')[0],
      sections: [
        {
          title: 'Revenue',
          rows: revenueRows.length > 0 ? revenueRows : [{ label: 'No revenue recorded', value: fmt(0), indent: true }],
          total: { label: 'Total Revenue', value: fmt(totalRevenue), raw: totalRevenue },
        },
        {
          title: 'Expenses',
          rows: expenseRows.length > 0 ? expenseRows : [{ label: 'No expenses recorded', value: fmt(0), indent: true }],
          total: { label: 'Total Expenses', value: fmt(totalExpenses), raw: totalExpenses },
        },
        {
          title: 'Result',
          rows: [
            { label: 'Net Profit / Loss', value: fmt(netProfit), bold: true, positive: netProfit >= 0 },
            { label: 'Profit margin', value: `${margin}%`, indent: true },
          ],
        },
      ],
    }
  }

  // ── Balance Sheet ───────────────────────────────────────────────────────
  else if (type === 'balance_sheet') {
    const bankBalance   = n(snapshot.bank_balance)
    const receivables   = n(snapshot.accounts_receivable)
    const fixedAssets   = n(answers.fixed_assets)
    const otherAssets   = n(answers.other_assets)
    const totalAssets   = bankBalance + receivables + fixedAssets + otherAssets

    const payables      = n(snapshot.accounts_payable)
    const loans         = n(answers.loans)
    const otherLiab     = n(answers.other_liabilities)
    const totalLiab     = payables + loans + otherLiab

    const ownerEquity   = n(answers.owner_equity)
    const retained      = totalAssets - totalLiab - ownerEquity
    const totalEquity   = ownerEquity + retained

    periodLabel = answers.as_of_date ?? new Date().toISOString().split('T')[0]!
    title = `Balance Sheet · ${periodLabel}`

    content = {
      type: 'balance_sheet', title, business_name: businessName, period: periodLabel,
      generated_at: new Date().toISOString().split('T')[0],
      sections: [
        {
          title: 'Assets',
          rows: [
            { label: 'Cash & bank balance', value: fmt(bankBalance), indent: true },
            { label: 'Accounts receivable', value: fmt(receivables), indent: true },
            ...(fixedAssets > 0 ? [{ label: 'Fixed assets', value: fmt(fixedAssets), indent: true }] : []),
            ...(otherAssets > 0 ? [{ label: 'Other assets', value: fmt(otherAssets), indent: true }] : []),
          ],
          total: { label: 'Total Assets', value: fmt(totalAssets), raw: totalAssets },
        },
        {
          title: 'Liabilities',
          rows: [
            { label: 'Accounts payable', value: fmt(payables), indent: true },
            ...(loans > 0 ? [{ label: 'Loans & credit', value: fmt(loans), indent: true }] : []),
            ...(otherLiab > 0 ? [{ label: 'Other liabilities', value: fmt(otherLiab), indent: true }] : []),
          ],
          total: { label: 'Total Liabilities', value: fmt(totalLiab), raw: totalLiab },
        },
        {
          title: 'Equity',
          rows: [
            { label: "Owner's equity", value: fmt(ownerEquity), indent: true },
            { label: 'Retained earnings', value: fmt(retained), indent: true },
          ],
          total: { label: 'Total Equity', value: fmt(totalEquity), raw: totalEquity },
        },
        {
          title: 'Check',
          rows: [
            { label: 'Assets – Liabilities – Equity', value: fmt(totalAssets - totalLiab - totalEquity), bold: true, positive: Math.abs(totalAssets - totalLiab - totalEquity) < 1 },
          ],
        },
      ],
    }
  }

  // ── Cash Flow ───────────────────────────────────────────────────────────
  else if (type === 'cash_flow') {
    const months = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    const snapshotRev  = hasInvoices ? 0 : n(snapshot.monthly_revenue) * months
    const revenue      = snapshotRev + invoiceRevenue
    const loggedOp     = periodExpenses.reduce((s, e) => s + n(e.amount), 0)
    const opExpenses   = (loggedOp || (!hasInvoices ? n(snapshot.monthly_costs) * months : 0)) + invoiceExpenses
    const operatingNet = revenue - opExpenses

    const assetPurch   = n(answers.asset_purchases)
    const assetSales   = n(answers.asset_sales)
    const investingNet = assetSales - assetPurch

    const loansIn      = n(answers.loans_received)
    const loansOut     = n(answers.loans_repaid)
    const drawings     = n(answers.owner_drawings)
    const financingNet = loansIn - loansOut - drawings

    const netCashFlow  = operatingNet + investingNet + financingNet
    const closingCash  = n(snapshot.bank_balance) + netCashFlow

    periodLabel = `${periodStart} – ${periodEnd}`
    title = `Cash Flow · ${periodLabel}`

    content = {
      type: 'cash_flow', title, business_name: businessName, period: periodLabel,
      generated_at: new Date().toISOString().split('T')[0],
      sections: [
        {
          title: 'Operating Activities',
          rows: [
            ...(snapshotRev > 0 ? [{ label: 'Revenue received', value: fmt(snapshotRev), indent: true }] : []),
            ...(invoiceRevenue > 0 ? [{ label: 'Invoice payments received', value: fmt(invoiceRevenue), indent: true }] : []),
            ...((loggedOp > 0 || (!hasInvoices && n(snapshot.monthly_costs) * months > 0)) ? [{ label: 'Operating expenses paid', value: fmt(-(opExpenses - invoiceExpenses)), indent: true, negative: true }] : []),
            ...(invoiceExpenses > 0 ? [{ label: 'Supplier invoices paid', value: fmt(-invoiceExpenses), indent: true, negative: true }] : []),
          ],
          total: { label: 'Net from operations', value: fmt(operatingNet), raw: operatingNet },
        },
        {
          title: 'Investing Activities',
          rows: [
            ...(assetPurch > 0 ? [{ label: 'Asset purchases', value: fmt(-assetPurch), indent: true, negative: true }] : []),
            ...(assetSales > 0 ? [{ label: 'Asset sales', value: fmt(assetSales), indent: true }] : []),
          ],
          total: { label: 'Net from investing', value: fmt(investingNet), raw: investingNet },
        },
        {
          title: 'Financing Activities',
          rows: [
            ...(loansIn > 0 ? [{ label: 'Loans received', value: fmt(loansIn), indent: true }] : []),
            ...(loansOut > 0 ? [{ label: 'Loans repaid', value: fmt(-loansOut), indent: true, negative: true }] : []),
            ...(drawings > 0 ? [{ label: 'Owner drawings', value: fmt(-drawings), indent: true, negative: true }] : []),
          ],
          total: { label: 'Net from financing', value: fmt(financingNet), raw: financingNet },
        },
        {
          title: 'Summary',
          rows: [
            { label: 'Opening cash balance', value: fmt(n(snapshot.bank_balance)), indent: true },
            { label: 'Net cash movement', value: fmt(netCashFlow), indent: true, bold: true, positive: netCashFlow >= 0 },
            { label: 'Closing cash balance', value: fmt(closingCash), bold: true, positive: closingCash >= 0 },
          ],
        },
      ],
    }
  // ── 6B Veroilmoitus ─────────────────────────────────────────────────────
  } else if (type === 'form_6b') {
    const ps = answers.period_start ?? `${new Date().getFullYear() - 1}-01-01`
    const pe = answers.period_end   ?? `${new Date().getFullYear() - 1}-12-31`

    // Revenue: NALLE invoices + snapshot fallback + user additions
    const months6b = Math.max(1, Math.round((new Date(pe).getTime() - new Date(ps).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    const sentPaid = allInvoices.filter(i => i.type === 'sent' && i.status === 'paid' && (i.paid_date as string) >= ps && (i.paid_date as string) <= pe)
    const recvPaid = allInvoices.filter(i => i.type === 'received' && i.status === 'paid' && (i.paid_date as string) >= ps && (i.paid_date as string) <= pe)
    const invoiceRev  = sentPaid.reduce((s, i) => s + n(i.amount), 0)  // net of VAT
    const invoiceExp  = recvPaid.reduce((s, i) => s + n(i.amount), 0)
    const snapRev6b   = hasInvoices ? 0 : n(snapshot.monthly_revenue) * months6b
    const nalleRev    = invoiceRev + snapRev6b
    const extraRev    = n(answers.net_sales_extra)
    const otherIncome = n(answers.other_income)
    const totalRev    = nalleRev + extraRev + otherIncome

    // Expenses: NALLE logged + invoice payables + extra fields
    const periodExp6b = (expenses ?? []).filter(e => (e.date as string) >= ps && (e.date as string) <= pe)
    const nalleExp    = periodExp6b.reduce((s, e) => s + n(e.amount), 0)
    const wages       = n(answers.wages)
    const deprec      = n(answers.depreciation)
    const entertain   = n(answers.entertainment)
    const entertainDed = entertain * 0.5
    const intExp      = n(answers.interest_expense)
    const totalExp    = nalleExp + invoiceExp + wages + deprec + entertainDed + intExp

    // Taxable income
    const bizResult   = totalRev - totalExp
    const prevLoss    = n(answers.prev_losses)
    const taxable     = Math.max(0, bizResult - prevLoss)
    const estTax      = taxable * 0.20   // Finnish corporate tax rate 20%

    // Balance sheet — use user-entered year-end figures, fall back to current snapshot
    const bankBal     = answers.bank_balance     !== undefined ? n(answers.bank_balance)     : n(snapshot.bank_balance)
    const recv        = answers.receivables       !== undefined ? n(answers.receivables)       : n(snapshot.accounts_receivable)
    const fixAss      = n(answers.fixed_assets)
    const inv         = n(answers.inventory)
    const totAss      = bankBal + recv + fixAss + inv
    const ap          = answers.accounts_payable  !== undefined ? n(answers.accounts_payable)  : n(snapshot.accounts_payable)
    const loansAmt    = n(answers.loans)
    const totLiab     = ap + loansAmt
    const shareCap    = n(answers.share_capital)
    const retained    = totAss - totLiab - shareCap

    // Shareholders
    const sh1Shares   = n(answers.sh1_shares)
    const totShares   = n(answers.total_shares) || sh1Shares
    const sh1Pct      = totShares > 0 ? ((sh1Shares / totShares) * 100).toFixed(1) : '100.0'

    // Deadline: 4 months after last calendar month of accounting period
    const peDate      = new Date(pe)
    const deadlineDate = new Date(peDate.getFullYear(), peDate.getMonth() + 5, 0)
    const deadline    = deadlineDate.toLocaleDateString('fi-FI')

    periodStart = ps
    periodEnd   = pe
    periodLabel = `${ps} – ${pe}`
    title = `6B Veroilmoitus · ${new Date(pe).getFullYear()}`

    content = {
      type: 'form_6b',
      title,
      business_name: businessName,
      ytunnus: answers.ytunnus ?? '',
      period: periodLabel,
      generated_at: new Date().toISOString().split('T')[0],
      income: {
        nalle_revenue: fmt(nalleRev), nalle_revenue_raw: nalleRev,
        extra_revenue: fmt(extraRev), extra_revenue_raw: extraRev,
        other_income: fmt(otherIncome), other_income_raw: otherIncome,
        total_revenue: fmt(totalRev), total_revenue_raw: totalRev,
      },
      expenses: {
        nalle_expenses: fmt(nalleExp + invoiceExp), nalle_expenses_raw: nalleExp + invoiceExp,
        wages: fmt(wages), wages_raw: wages,
        depreciation: fmt(deprec), depreciation_raw: deprec,
        entertainment_full: fmt(entertain), entertainment_full_raw: entertain,
        entertainment_deductible: fmt(entertainDed), entertainment_deductible_raw: entertainDed,
        interest_expense: fmt(intExp), interest_expense_raw: intExp,
        total_expenses: fmt(totalExp), total_expenses_raw: totalExp,
      },
      taxable_income: {
        business_result: fmt(bizResult), business_result_raw: bizResult,
        prev_losses: fmt(prevLoss), prev_losses_raw: prevLoss,
        taxable: fmt(taxable), taxable_raw: taxable,
        estimated_tax: fmt(estTax), estimated_tax_raw: estTax,
      },
      balance_sheet: {
        bank_balance: fmt(bankBal), bank_balance_raw: bankBal,
        receivables: fmt(recv), receivables_raw: recv,
        fixed_assets: fmt(fixAss), fixed_assets_raw: fixAss,
        inventory: fmt(inv), inventory_raw: inv,
        total_assets: fmt(totAss), total_assets_raw: totAss,
        accounts_payable: fmt(ap), accounts_payable_raw: ap,
        loans: fmt(loansAmt), loans_raw: loansAmt,
        total_liabilities: fmt(totLiab), total_liabilities_raw: totLiab,
        share_capital: fmt(shareCap), share_capital_raw: shareCap,
        retained_earnings: fmt(retained), retained_earnings_raw: retained,
      },
      shareholders: answers.sh1_name ? [{
        name: answers.sh1_name,
        id: answers.sh1_id ?? '',
        shares: sh1Shares,
        total_shares: totShares,
        pct: sh1Pct,
      }] : [],
      dividends: {
        paid: fmt(n(answers.dividends_paid)),
        paid_raw: n(answers.dividends_paid),
      },
      submission: { deadline, form: 'Lomake 6B (3052)', method: 'OmaVero (vero.fi)' },
    }
  } else {
    return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
  }

  // Save to DB
  const { data: saved, error: dbErr } = await db.from('reports').insert({
    user_id: user.id,
    company_id: profile?.active_company_id ?? null,
    report_type: type,
    period_start: periodStart,
    period_end: periodEnd,
    generated_by: 'user',
    title,
    content,
  }).select('id').single()

  if (dbErr || !saved) return NextResponse.json({ error: dbErr?.message ?? 'Failed to save report' }, { status: 500 })

  return NextResponse.json({ id: saved.id })
}
