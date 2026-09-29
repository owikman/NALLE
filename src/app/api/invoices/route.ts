import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { postJournalEntry } from '@/lib/ledger/posting'
import {
  sentInvoiceCreatedLines,
  sentInvoicePaidLines,
  receivedInvoiceCreatedLines,
  receivedInvoicePaidDirectlyLines,
} from '@/lib/ledger/rules'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  const db = createServiceClient()
  let query = db.from('invoices').select('*').order('issue_date', { ascending: false })
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
  const isPaid = Boolean(body.paid)
  const category = body.category || 'other'

  const { data, error } = await db.from('invoices').insert({
    user_id: user.id,
    company_id: companyId,
    type: body.type,
    invoice_number: body.invoice_number || null,
    counterparty: body.counterparty,
    description: body.description || null,
    amount,
    vat_amount: vatAmount,
    issue_date: body.issue_date,
    due_date: body.due_date || null,
    paid_date: isPaid ? body.issue_date : null,
    status: isPaid ? 'paid' : 'unpaid',
    file_url: body.file_url ?? null,
  }).select('id').single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to save invoice' }, { status: 500 })

  try {
    const lines = body.type === 'sent'
      ? sentInvoiceCreatedLines(amount, vatAmount)
      : isPaid
        ? receivedInvoicePaidDirectlyLines(amount, vatAmount, category)
        : receivedInvoiceCreatedLines(amount, vatAmount, category)

    await postJournalEntry(db, {
      companyId,
      entryDate: body.issue_date,
      description: `${body.type === 'sent' ? 'Invoice to' : 'Invoice from'} ${body.counterparty}`,
      sourceType: 'invoice',
      sourceId: data.id,
      createdBy: user.id,
      lines,
    })

    // Sent invoices recorded as already paid still need the AR→bank leg —
    // receivedInvoicePaidDirectlyLines above already skips AP for received
    // invoices, but a sent invoice created as paid needs a second entry.
    if (body.type === 'sent' && isPaid) {
      await postJournalEntry(db, {
        companyId,
        entryDate: body.issue_date,
        description: `Payment received — ${body.counterparty}`,
        sourceType: 'invoice',
        sourceId: data.id,
        createdBy: user.id,
        lines: sentInvoicePaidLines(amount, vatAmount),
      })
    }
  } catch (postingErr) {
    console.error('Failed to post journal entry for invoice', data.id, postingErr)
  }

  return NextResponse.json({ id: data.id })
}
