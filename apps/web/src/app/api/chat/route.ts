import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function buildFinancialContext(userId: string) {
  const db = createServiceClient()

  const [{ data: profile }, { data: snapshot }, { data: expenses }, { data: obligations }] =
    await Promise.all([
      db.from('profiles').select('*').eq('id', userId).single(),
      db.from('financial_snapshots').select('*').eq('user_id', userId)
        .order('snapshot_date', { ascending: false }).limit(1).single(),
      db.from('expense_logs').select('category, amount, description, date')
        .eq('user_id', userId)
        .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!)
        .order('date', { ascending: false }),
      db.from('compliance_obligations').select('*')
        .eq('user_id', userId).neq('status', 'completed')
        .order('due_date', { ascending: true }),
    ])

  const formatEUR = (n: number) =>
    new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  const expenseByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + (e.amount as number)
    return acc
  }, {})

  return `
## Business Profile
- Name: ${profile?.business_name ?? 'Unknown'}
- Type: ${profile?.business_type ?? 'Unknown'}
- Industry: ${profile?.industry ?? 'Unknown'}
- Employees: ${profile?.employee_count ?? 0}
- VAT registered: ${profile?.vat_registered ? 'Yes' : 'No'}
- Salary payer: ${profile?.is_salary_payer ? 'Yes' : 'No'}
- YEL insurance: ${profile?.yel_registered ? 'Yes' : 'No'}
- TyEL insurance: ${profile?.tyel_registered ? 'Yes' : 'No'}

## Current Financial Snapshot ${snapshot ? `(${snapshot.snapshot_date})` : '(no data yet)'}
${snapshot ? `
- Bank balance: ${formatEUR(snapshot.bank_balance)}
- Monthly revenue: ${formatEUR(snapshot.monthly_revenue)}
- Monthly costs: ${formatEUR(snapshot.monthly_costs)}
- Net monthly: ${formatEUR(snapshot.monthly_revenue - snapshot.monthly_costs)}
- Cash runway: ${snapshot.cash_runway_months} months
- Net profit margin: ${snapshot.net_profit_margin}%
- Accounts receivable: ${formatEUR(snapshot.accounts_receivable)}
- Accounts payable: ${formatEUR(snapshot.accounts_payable)}
` : 'No financial snapshot available yet. Ask the user to complete the financial intake.'}

## Expense Breakdown (last 90 days)
${Object.entries(expenseByCategory).length > 0
    ? Object.entries(expenseByCategory).map(([cat, amt]) => `- ${cat}: ${formatEUR(amt as number)}`).join('\n')
    : '- No expenses logged yet'}

## Open Compliance Obligations
${obligations && obligations.length > 0
    ? obligations.map(o => `- ${o.obligation_type} — due ${o.due_date} (${o.status}): ${o.notes ?? ''}`).join('\n')
    : '- No open obligations'}
`.trim()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages, conversationId } = await request.json()

  const financialContext = await buildFinancialContext(user.id)

  const db = createServiceClient()

  // Create conversation if new
  let convId = conversationId
  if (!convId) {
    const firstMessage = messages[0]?.content ?? 'New conversation'
    const title = typeof firstMessage === 'string'
      ? firstMessage.slice(0, 60)
      : 'New conversation'
    const { data: conv } = await db.from('ai_conversations').insert({
      user_id: user.id,
      title,
    }).select('id').single()
    convId = conv?.id
  } else {
    await db.from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', convId)
  }

  // Save user message
  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user' && convId) {
    await db.from('ai_messages').insert({
      conversation_id: convId,
      user_id: user.id,
      role: 'user',
      content: typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content),
    })
  }

  const systemPrompt = `You are NALLE, an AI-powered CFO assistant for Finnish entrepreneurs and small business owners. You speak in clear, plain language — no jargon. You are direct, practical, and encouraging.

Your role is to:
- Help the user understand their financial situation
- Answer questions about their specific numbers
- Explain Finnish business obligations (VAT, YEL, TyEL, tax prepayments) in simple terms
- Give actionable advice on cash flow, pricing, and cost management
- Help them prepare for meetings with accountants or banks

Always base your answers on the user's actual financial data below. If data is missing, say so and suggest they complete the intake.

When discussing money, always use euros (€) and Finnish formatting.

Here is the user's current financial data:

${financialContext}`

  try {
    const result = await streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: systemPrompt,
      messages,
      onFinish: async ({ text }) => {
        if (convId) {
          await db.from('ai_messages').insert({
            conversation_id: convId,
            user_id: user.id,
            role: 'assistant',
            content: text,
          })
        }
      },
    })

    const response = result.toDataStreamResponse()
    response.headers.set('x-conversation-id', convId ?? '')
    return response
  } catch (err) {
    console.error('streamText error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
