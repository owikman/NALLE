import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const body = await request.json() as Record<string, unknown>
  const answers = body.answers as Record<string, unknown> ?? body
  const existingCompanyId = body.company_id as string | undefined

  const bankBalance        = Number(answers['bank_balance'] ?? 0)
  const monthlyRevenue     = Number(answers['monthly_revenue'] ?? 0)
  const monthlyCosts       = Number(answers['monthly_costs'] ?? 0)
  const accountsReceivable = Number(answers['accounts_receivable'] ?? 0)
  const accountsPayable    = Number(answers['accounts_payable'] ?? 0)

  const netMonthly       = monthlyRevenue - monthlyCosts
  const cashRunwayMonths = monthlyCosts > 0 ? parseFloat(((bankBalance + accountsReceivable) / monthlyCosts).toFixed(2)) : 99
  const netProfitMargin  = monthlyRevenue > 0 ? parseFloat(((netMonthly / monthlyRevenue) * 100).toFixed(2)) : 0

  const companyFields = {
    business_name:       String(answers['business_name'] ?? ''),
    business_type:       answers['business_type'] as string,
    industry:            String(answers['industry'] ?? ''),
    employee_count:      Number(answers['employee_count'] ?? 0),
    vat_registered:      Boolean(answers['vat_registered']),
    is_salary_payer:     Boolean(answers['is_salary_payer']),
    yel_registered:      Boolean(answers['yel_registered']),
    tyel_registered:     Boolean(answers['tyel_registered']),
    onboarding_completed: true,
  }

  let companyId: string

  if (existingCompanyId) {
    // Update existing company
    const { error } = await db.from('companies').update(companyFields).eq('id', existingCompanyId).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    companyId = existingCompanyId
  } else {
    // Create new company
    const { data: newCompany, error } = await db.from('companies').insert({ user_id: user.id, ...companyFields }).select('id').single()
    if (error || !newCompany) return NextResponse.json({ error: error?.message ?? 'Failed to create company' }, { status: 500 })
    companyId = newCompany.id

    // Set as active company
    await db.from('profiles').update({ active_company_id: companyId, onboarding_completed: true }).eq('id', user.id)
  }

  // Keep profiles in sync for backward compat (chat/reports still read profiles)
  await db.from('profiles').update({ ...companyFields }).eq('id', user.id)

  // Store intake session
  const { data: intakeSession } = await db.from('intake_sessions')
    .insert({ user_id: user.id, company_id: companyId, status: 'completed', completed_at: new Date().toISOString() })
    .select('id').single()

  if (intakeSession) {
    await db.from('intake_responses').insert(
      Object.entries(answers).map(([key, value]) => ({
        session_id: intakeSession.id, user_id: user.id, question_key: key, response_value: value,
      }))
    )
  }

  // Snapshot
  await db.from('financial_snapshots').insert({
    user_id: user.id, company_id: companyId,
    snapshot_date: new Date().toISOString().split('T')[0],
    bank_balance: bankBalance, monthly_revenue: monthlyRevenue, monthly_costs: monthlyCosts,
    accounts_receivable: accountsReceivable, accounts_payable: accountsPayable,
    cash_runway_months: cashRunwayMonths, net_profit_margin: netProfitMargin, raw_data: answers,
  })

  // Delete non-completed obligations for this company before regenerating
  await db.from('compliance_obligations').delete().eq('company_id', companyId).neq('status', 'completed')

  await generateComplianceObligations(db, user.id, companyId, answers)

  return NextResponse.json({ success: true, company_id: companyId })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateComplianceObligations(db: any, userId: string, companyId: string, answers: Record<string, unknown>) {
  const now = new Date()
  const obligations = []

  if (!answers['yel_registered']) {
    obligations.push({ user_id: userId, company_id: companyId, obligation_type: 'yel', due_date: fmt(addDays(now, 30)), status: 'due_soon', notes: 'YEL insurance is required for entrepreneurs. Register at yel.fi' })
  }
  if (answers['is_salary_payer'] && !answers['tyel_registered']) {
    obligations.push({ user_id: userId, company_id: companyId, obligation_type: 'tyel', due_date: fmt(addDays(now, 14)), status: 'due_soon', notes: 'TyEL insurance required for salary payers. Contact a pension provider.' })
  }
  if (answers['vat_registered']) {
    obligations.push({ user_id: userId, company_id: companyId, obligation_type: 'vat_filing', due_date: fmt(nextQuarterEnd(now)), status: 'upcoming', notes: 'Quarterly VAT return due. File via OmaVero.' })
  }
  obligations.push({ user_id: userId, company_id: companyId, obligation_type: 'tax_prepayment', due_date: fmt(nextQuarterEnd(now)), status: 'upcoming', notes: 'Quarterly tax prepayment. Check amount in OmaVero.' })

  if (obligations.length > 0) await db.from('compliance_obligations').insert(obligations)
}

function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d }
function nextQuarterEnd(date: Date) { const m = date.getMonth(); const qm = Math.ceil((m + 1) / 3) * 3 - 1; const y = qm < m ? date.getFullYear() + 1 : date.getFullYear(); return new Date(y, qm % 12, 20) }
function fmt(d: Date) { return d.toISOString().split('T')[0]! }
