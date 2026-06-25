import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service role client — bypasses RLS, all queries manually scoped by user.id
  const authedSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const answers = await request.json() as Record<string, unknown>

  const bankBalance = Number(answers['bank_balance'] ?? 0)
  const monthlyRevenue = Number(answers['monthly_revenue'] ?? 0)
  const monthlyCosts = Number(answers['monthly_costs'] ?? 0)
  const accountsReceivable = Number(answers['accounts_receivable'] ?? 0)
  const accountsPayable = Number(answers['accounts_payable'] ?? 0)

  const netMonthly = monthlyRevenue - monthlyCosts
  const cashRunwayMonths = monthlyCosts > 0
    ? parseFloat(((bankBalance + accountsReceivable) / monthlyCosts).toFixed(2))
    : 99
  const netProfitMargin = monthlyRevenue > 0
    ? parseFloat(((netMonthly / monthlyRevenue) * 100).toFixed(2))
    : 0

  // Update profile with business info and compliance flags
  const { error: profileError } = await authedSupabase
    .from('profiles')
    .update({
      business_name: String(answers['business_name'] ?? ''),
      business_type: answers['business_type'] as string,
      industry: String(answers['industry'] ?? ''),
      employee_count: Number(answers['employee_count'] ?? 0),
      vat_registered: Boolean(answers['vat_registered']),
      is_salary_payer: Boolean(answers['is_salary_payer']),
      yel_registered: Boolean(answers['yel_registered']),
      tyel_registered: Boolean(answers['tyel_registered']),
      onboarding_completed: true,
    })
    .eq('id', user.id)

  if (profileError) {
    console.error('Profile update error:', profileError)
    return NextResponse.json({ error: profileError.message, detail: 'profile' }, { status: 500 })
  }

  // Store intake session and responses
  const { data: intakeSession, error: sessionError } = await authedSupabase
    .from('intake_sessions')
    .insert({ user_id: user.id, status: 'completed', completed_at: new Date().toISOString() })
    .select('id')
    .single()

  if (sessionError || !intakeSession) {
    console.error('Session error:', sessionError)
    return NextResponse.json({ error: sessionError?.message ?? 'Failed to create session', detail: 'session' }, { status: 500 })
  }

  const responseRows = Object.entries(answers).map(([key, value]) => ({
    session_id: intakeSession.id,
    user_id: user.id,
    question_key: key,
    response_value: value,
  }))

  await authedSupabase.from('intake_responses').insert(responseRows)

  // Compute and store financial snapshot
  const { error: snapshotError } = await authedSupabase
    .from('financial_snapshots')
    .insert({
      user_id: user.id,
      snapshot_date: new Date().toISOString().split('T')[0],
      bank_balance: bankBalance,
      monthly_revenue: monthlyRevenue,
      monthly_costs: monthlyCosts,
      accounts_receivable: accountsReceivable,
      accounts_payable: accountsPayable,
      cash_runway_months: cashRunwayMonths,
      net_profit_margin: netProfitMargin,
      raw_data: answers,
    })

  if (snapshotError) {
    console.error('Snapshot error:', snapshotError)
    return NextResponse.json({ error: snapshotError.message, detail: 'snapshot' }, { status: 500 })
  }

  // Generate compliance obligations based on profile
  await generateComplianceObligations(authedSupabase, user.id, answers)

  return NextResponse.json({ success: true })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateComplianceObligations(
  supabase: any,
  userId: string,
  answers: Record<string, unknown>
) {
  const now = new Date()
  const obligations: Array<{
    user_id: string
    obligation_type: string
    due_date: string
    status: string
    notes: string
  }> = []

  if (!answers['yel_registered']) {
    obligations.push({
      user_id: userId,
      obligation_type: 'yel',
      due_date: formatDate(addDays(now, 30)),
      status: 'due_soon',
      notes: 'YEL insurance is required for entrepreneurs. Register at yel.fi',
    })
  }

  if (answers['is_salary_payer'] && !answers['tyel_registered']) {
    obligations.push({
      user_id: userId,
      obligation_type: 'tyel',
      due_date: formatDate(addDays(now, 14)),
      status: 'due_soon',
      notes: 'TyEL insurance required for salary payers. Contact a pension provider.',
    })
  }

  if (answers['vat_registered']) {
    const nextVatDue = nextQuarterEnd(now)
    obligations.push({
      user_id: userId,
      obligation_type: 'vat_filing',
      due_date: formatDate(nextVatDue),
      status: 'upcoming',
      notes: 'Quarterly VAT return due. File via OmaVero.',
    })
  }

  // Tax prepayment — quarterly
  const taxDue = nextQuarterEnd(now)
  obligations.push({
    user_id: userId,
    obligation_type: 'tax_prepayment',
    due_date: formatDate(taxDue),
    status: 'upcoming',
    notes: 'Quarterly tax prepayment. Check amount in OmaVero.',
  })

  if (obligations.length > 0) {
    await supabase.from('compliance_obligations').insert(obligations)
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function nextQuarterEnd(date: Date): Date {
  const month = date.getMonth()
  const quarterEndMonth = Math.ceil((month + 1) / 3) * 3 - 1
  const year = quarterEndMonth < month ? date.getFullYear() + 1 : date.getFullYear()
  return new Date(year, quarterEndMonth % 12, 20)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}
