import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { postJournalEntry } from '@/lib/ledger/posting'
import { expensePaidByCompanyLines, expensePendingReimbursementLines } from '@/lib/ledger/rules'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  const db = createServiceClient()
  let query = db
    .from('expense_logs')
    .select('id,amount,vat_amount,category,description,date,receipt_url,mileage_km,mileage_from,mileage_to,paid_status')
    .order('date', { ascending: false })
    .limit(100)
  query = companyId ? query.eq('company_id', companyId) : query.eq('user_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const db = createServiceClient()
  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const amount = parseFloat(body.amount) || 0
  const vatAmount = parseFloat(body.vat_amount) || 0
  const category = body.category || 'other'
  const paidStatus: 'paid_by_company' | 'pending_reimbursement' = body.paid_status === 'pending_reimbursement' ? 'pending_reimbursement' : 'paid_by_company'

  const { data: expense, error: insertErr } = await db.from('expense_logs').insert({
    user_id: user.id,
    company_id: companyId,
    template_id: body.template_id ?? null,
    amount,
    vat_amount: vatAmount,
    category,
    description: body.description,
    date: body.date,
    receipt_url: body.receipt_url ?? null,
    mileage_km: body.mileage_km ?? null,
    mileage_from: body.mileage_from ?? null,
    mileage_to: body.mileage_to ?? null,
    paid_status: paidStatus,
  }).select('id').single()

  if (insertErr || !expense) return NextResponse.json({ error: insertErr?.message ?? 'Failed to save expense' }, { status: 500 })

  try {
    const lines = paidStatus === 'pending_reimbursement'
      ? expensePendingReimbursementLines(amount, vatAmount, category)
      : expensePaidByCompanyLines(amount, vatAmount, category)

    await postJournalEntry(db, {
      companyId,
      entryDate: body.date,
      description: body.description,
      sourceType: 'expense',
      sourceId: expense.id,
      createdBy: user.id,
      lines,
    })
  } catch (postingErr) {
    // The expense record is saved either way — a posting failure (e.g. chart
    // of accounts not yet seeded for this company) shouldn't block logging
    // the expense itself, but it does mean the ledger is now missing this
    // transaction until it's investigated.
    console.error('Failed to post journal entry for expense', expense.id, postingErr)
  }

  return NextResponse.json({ id: expense.id })
}
