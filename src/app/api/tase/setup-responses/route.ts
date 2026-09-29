import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { syncOpeningBalanceEntry, type SetupAnswers } from '@/lib/ledger/opening-balance'
import { WIZARD_GROUPS, findField } from '@/lib/ledger/wizard-questions'
import { NextResponse } from 'next/server'

const OPENING_BALANCE_GROUPS = new Set(['ledger_start', 'bank_accounts', 'capital_and_loans', 'receivables_and_payables'])

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const db = createServiceClient()
  const [{ data: company, error: companyErr }, { data: responses, error: respErr }, { data: tasks, error: taskErr }] = await Promise.all([
    db.from('companies').select('vat_registered, is_salary_payer').eq('id', companyId).single(),
    db.from('setup_responses').select('question_key, group_key, answer_value, status, answered_at').eq('company_id', companyId),
    db.from('follow_up_tasks').select('*').eq('company_id', companyId).eq('status', 'open').order('created_at', { ascending: true }),
  ])
  if (companyErr || !company) return NextResponse.json({ error: companyErr?.message ?? 'Company not found' }, { status: 500 })
  if (respErr) return NextResponse.json({ error: respErr.message }, { status: 500 })
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 })

  const groups = WIZARD_GROUPS.filter(g => !g.showIf || g.showIf(company))
  return NextResponse.json({ responses: responses ?? [], openTasks: tasks ?? [], groups })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const body = await request.json() as {
    group_key: string
    answers: { question_key: string; value?: unknown; unknown?: boolean }[]
  }
  const group = WIZARD_GROUPS.find(g => g.key === body.group_key)
  if (!group) return NextResponse.json({ error: 'Unknown question group' }, { status: 400 })

  const db = createServiceClient()
  const now = new Date().toISOString()

  for (const answer of body.answers) {
    const field = findField(answer.question_key)
    if (!field) continue

    const status = answer.unknown ? 'unknown' : 'answered'
    const { data: saved, error: upsertErr } = await db
      .from('setup_responses')
      .upsert(
        {
          company_id: companyId,
          question_key: answer.question_key,
          group_key: body.group_key,
          answer_value: answer.unknown ? null : answer.value,
          status,
          answered_at: now,
        },
        { onConflict: 'company_id,question_key' }
      )
      .select('id')
      .single()
    if (upsertErr || !saved) return NextResponse.json({ error: upsertErr?.message ?? 'Failed to save answer' }, { status: 500 })

    if (answer.unknown) {
      const { data: existingTask } = await db
        .from('follow_up_tasks')
        .select('id')
        .eq('company_id', companyId)
        .eq('source', 'setup_response')
        .eq('source_id', saved.id)
        .eq('status', 'open')
        .maybeSingle()
      if (!existingTask) {
        await db.from('follow_up_tasks').insert({
          company_id: companyId,
          source: 'setup_response',
          source_id: saved.id,
          title: `Answer: ${field.label}`,
          link_href: `/tase/wizard?group=${body.group_key}`,
          status: 'open',
        })
      }
    } else {
      await db
        .from('follow_up_tasks')
        .update({ status: 'resolved', resolved_at: now })
        .eq('company_id', companyId)
        .eq('source', 'setup_response')
        .eq('source_id', saved.id)
        .eq('status', 'open')
    }
  }

  let openingEntryId: string | null = null
  if (OPENING_BALANCE_GROUPS.has(body.group_key)) {
    const { data: allResponses, error: allErr } = await db
      .from('setup_responses')
      .select('question_key, answer_value, status')
      .eq('company_id', companyId)
    if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 })

    const answers: SetupAnswers = {}
    for (const r of allResponses ?? []) {
      answers[r.question_key] = { value: r.answer_value, status: r.status }
    }

    const ledgerStartDate = (answers.ledger_start_date?.value as string | undefined) ?? new Date().toISOString().split('T')[0]!
    try {
      openingEntryId = await syncOpeningBalanceEntry(db, {
        companyId,
        createdBy: user.id,
        entryDate: ledgerStartDate,
        answers,
      })
    } catch (postingErr) {
      console.error('Failed to sync opening balance entry for company', companyId, postingErr)
    }
  }

  return NextResponse.json({ ok: true, openingEntryPosted: Boolean(openingEntryId) })
}
