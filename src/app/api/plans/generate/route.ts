import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
  if (!profile?.is_premium) {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  const [{ data: snapshot }, { data: expenses }, { data: obligations }] = await Promise.all([
    db.from('financial_snapshots').select('*').eq('user_id', user.id)
      .order('snapshot_date', { ascending: false }).limit(1).single(),
    db.from('expense_logs').select('*').eq('user_id', user.id)
      .order('date', { ascending: false }).limit(50),
    db.from('compliance_obligations').select('*').eq('user_id', user.id).neq('status', 'completed'),
  ])

  if (!snapshot) return NextResponse.json({ error: 'Complete the financial intake first.' }, { status: 400 })

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  const expenseByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
    return acc
  }, {})

  const context = `
Business: ${profile.business_name} (${profile.business_type}, ${profile.industry})
Employees: ${profile.employee_count}
VAT registered: ${profile.vat_registered}
Salary payer: ${profile.is_salary_payer}

Financials:
- Bank balance: ${formatEUR(snapshot.bank_balance)}
- Monthly revenue: ${formatEUR(snapshot.monthly_revenue)}
- Monthly costs: ${formatEUR(snapshot.monthly_costs)}
- Net monthly: ${formatEUR(snapshot.monthly_revenue - snapshot.monthly_costs)}
- Cash runway: ${snapshot.cash_runway_months} months
- Net margin: ${snapshot.net_profit_margin}%
- Accounts receivable: ${formatEUR(snapshot.accounts_receivable)}
- Accounts payable: ${formatEUR(snapshot.accounts_payable)}

Expenses by category (logged):
${Object.entries(expenseByCategory).map(([k, v]) => `- ${k}: ${formatEUR(v as number)}`).join('\n') || '- None logged'}

Open compliance obligations:
${obligations?.map(o => `- ${o.obligation_type} due ${o.due_date}`).join('\n') || '- None'}
`

  const prompt = `You are a senior CFO analyzing a Finnish small business. Based on the data below, generate a comprehensive financial plan in JSON format.

${context}

Return ONLY valid JSON in this exact structure:
{
  "title": "Q3 2026 Financial Plan",
  "summary": "2-3 sentence executive summary of the business situation and key priorities",
  "health_score": <integer 0-100>,
  "sections": [
    {
      "title": "Section title",
      "priority": "high|medium|low",
      "icon": "emoji",
      "insight": "1-2 sentence analysis specific to their numbers",
      "actions": [
        {
          "action": "Specific action to take",
          "timeline": "e.g. This week / 30 days / Q3",
          "impact": "Expected outcome in plain language"
        }
      ]
    }
  ]
}

Include 4-5 sections covering: cash flow, revenue growth, cost optimization, Finnish tax/compliance, and one specific to their situation. Make every insight reference their actual numbers. Be direct and actionable.`

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    prompt,
    maxTokens: 2000,
  })

  let plan: {
    title: string
    summary: string
    health_score: number
    sections: Array<{
      title: string
      priority: string
      icon: string
      insight: string
      actions: Array<{ action: string; timeline: string; impact: string }>
    }>
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    plan = JSON.parse(jsonMatch?.[0] ?? text)
  } catch {
    return NextResponse.json({ error: 'Failed to parse plan. Try again.' }, { status: 500 })
  }

  const { data: saved, error } = await db.from('financial_plans').insert({
    user_id: user.id,
    title: plan.title,
    summary: plan.summary,
    health_score: plan.health_score,
    content: plan,
    status: 'ready',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: saved.id, plan })
}
