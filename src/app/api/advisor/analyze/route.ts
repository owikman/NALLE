import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const ANALYSIS_TYPES = ['tax', 'spending', 'consultation'] as const
type AnalysisType = typeof ANALYSIS_TYPES[number]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.is_premium) return NextResponse.json({ error: 'Premium required' }, { status: 403 })

  const { type } = await request.json() as { type: AnalysisType }
  if (!ANALYSIS_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 })

  const [{ data: snapshot }, { data: expenses }, { data: obligations }] = await Promise.all([
    db.from('financial_snapshots').select('*').eq('user_id', user.id).order('snapshot_date', { ascending: false }).limit(1).single(),
    db.from('expense_logs').select('category, amount, description, date').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
    db.from('compliance_obligations').select('obligation_type, due_date, status, notes').eq('user_id', user.id).neq('status', 'completed'),
  ])

  if (!snapshot) return NextResponse.json({ error: 'No financial data. Complete intake first.' }, { status: 400 })

  const expByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e) => {
    acc[e.category as string] = (acc[e.category as string] ?? 0) + parseFloat(String(e.amount))
    return acc
  }, {})

  const ctx = `
Business: ${profile.business_name ?? 'Unknown'} (${profile.business_type ?? 'unknown type'})
Industry: ${profile.industry ?? 'Unknown'}
Employees: ${profile.employee_count ?? 0}
VAT registered: ${profile.vat_registered ? 'Yes' : 'No'}
Salary payer: ${profile.is_salary_payer ? 'Yes' : 'No'}
YEL registered: ${profile.yel_registered ? 'Yes' : 'No'}
TyEL registered: ${profile.tyel_registered ? 'Yes' : 'No'}

Financial snapshot:
- Bank balance: €${snapshot.bank_balance}
- Monthly revenue: €${snapshot.monthly_revenue}
- Monthly costs: €${snapshot.monthly_costs}
- Net monthly: €${(parseFloat(String(snapshot.monthly_revenue)) - parseFloat(String(snapshot.monthly_costs))).toFixed(2)}
- Cash runway: ${snapshot.cash_runway_months} months
- Net profit margin: ${snapshot.net_profit_margin}%
- Accounts receivable: €${snapshot.accounts_receivable}
- Accounts payable: €${snapshot.accounts_payable}

Expenses by category (total logged):
${Object.entries(expByCategory).map(([cat, amt]) => `- ${cat}: €${amt.toFixed(2)}`).join('\n')}

Open compliance obligations:
${(obligations ?? []).map(o => `- ${o.obligation_type}: due ${o.due_date} (${o.status})`).join('\n') || 'None'}
`

  const prompts: Record<AnalysisType, string> = {
    tax: `You are a Finnish tax expert and CFO advisor. Analyze this business and identify specific, actionable tax saving opportunities.

${ctx}

Generate a detailed tax optimization report. Focus on:
1. Specific deductions they may be missing based on their expense categories and business type
2. YEL income optimization — if relevant, explain the optimal YEL income level and why
3. If business type is OY: salary vs dividend split analysis with estimated tax savings in euros
4. VAT optimization opportunities if VAT registered
5. Any Finnish tax incentives relevant to their industry
6. Timing strategies for income and expenses

For each opportunity, estimate the potential annual saving in euros where possible. Be specific and practical — reference their actual numbers.

Write in clear sections with a header for each area. Use plain language, no jargon. Format as clean readable text with section headers using ### markdown.`,

    spending: `You are a Finnish CFO advisor specializing in business efficiency. Analyze this business's spending and financial position to identify where they should spend more, spend less, and where their money works hardest.

${ctx}

Generate a detailed spending optimization report covering:
1. Which current expense categories give the best ROI for their business type — what to keep investing in
2. Where they are likely overspending and by how much
3. What investments would accelerate their revenue (hiring, equipment, marketing, tools) — specific to their industry
4. Expense categories that are likely fully tax-deductible vs. partly deductible — and how to restructure
5. Cash flow timing recommendations — when to pay suppliers, when to collect receivables
6. Given their runway (${snapshot.cash_runway_months} months), what's urgent vs. what can wait

Be specific. Reference their actual category totals. Give concrete action steps with estimated impact in euros where possible.

Format with ### section headers, use plain readable language.`,

    consultation: `You are NALLE, an elite Finnish CFO and business advisor. This entrepreneur is a premium subscriber asking for your honest, direct assessment of their business position and how to maximize what they have.

${ctx}

Deliver a comprehensive business consultation covering:
1. Honest assessment of their current financial health — what's working, what's a risk
2. The 3 most important things they should do in the next 30 days to improve their financial position
3. The 3 most important things in the next 3-6 months
4. How to maximize revenue given their current cost structure
5. Finnish-specific opportunities they may be missing (grants, tax schemes, insurance optimization)
6. One contrarian recommendation — something most business owners in their position overlook

Be direct, honest, and specific. Reference their actual numbers throughout. This is premium advice — don't hold back.

Format with ### section headers. Write like a trusted advisor who knows their business well.`,
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt: prompts[type],
    maxTokens: 2000,
  })

  const titles: Record<AnalysisType, string> = {
    tax: 'Tax Savings Analysis',
    spending: 'Spending Optimization Audit',
    consultation: 'Business Consultation',
  }

  // Save to a new advisor_analyses table (or reuse reports with type 'custom')
  const { data: saved } = await db.from('reports').insert({
    user_id: user.id,
    company_id: profile.active_company_id ?? null,
    report_type: 'custom',
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    generated_by: 'ai_bot',
    title: titles[type],
    content: { type, title: titles[type], text, generated_at: new Date().toISOString() },
  }).select('id').single()

  return NextResponse.json({ id: saved?.id, title: titles[type], text })
}
