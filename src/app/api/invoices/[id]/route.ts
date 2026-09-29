import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { postJournalEntry } from '@/lib/ledger/posting'
import { sentInvoicePaidLines, receivedInvoicePaidLines } from '@/lib/ledger/rules'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const db = createServiceClient()

  const { data: invoice, error: fetchErr } = await db
    .from('invoices')
    .select('id, type, amount, vat_amount, status, company_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (fetchErr || !invoice) return NextResponse.json({ error: fetchErr?.message ?? 'Invoice not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if ('status' in body) updates.status = body.status
  if ('paid_date' in body) updates.paid_date = body.paid_date

  const { error } = await db.from('invoices').update(updates).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const transitioningToPaid = invoice.status === 'unpaid' && body.status === 'paid'
  if (transitioningToPaid) {
    const companyId = invoice.company_id ?? (await getActiveCompanyId(user.id))
    if (companyId) {
      try {
        const lines = invoice.type === 'sent'
          ? sentInvoicePaidLines(invoice.amount, invoice.vat_amount)
          : receivedInvoicePaidLines(invoice.amount, invoice.vat_amount)

        await postJournalEntry(db, {
          companyId,
          entryDate: body.paid_date ?? new Date().toISOString().split('T')[0]!,
          description: `Invoice marked paid (${invoice.type})`,
          sourceType: 'invoice',
          sourceId: invoice.id,
          createdBy: user.id,
          lines,
        })
      } catch (postingErr) {
        console.error('Failed to post journal entry for invoice payment', invoice.id, postingErr)
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = createServiceClient()
  const { error } = await db.from('invoices').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
