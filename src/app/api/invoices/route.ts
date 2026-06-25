import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .order('issue_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const db = createServiceClient()

  const { data: profile } = await db.from('profiles').select('active_company_id').eq('id', user.id).single()

  const { data, error } = await db.from('invoices').insert({
    user_id: user.id,
    company_id: profile?.active_company_id ?? null,
    type: body.type,
    invoice_number: body.invoice_number || null,
    counterparty: body.counterparty,
    description: body.description || null,
    amount: parseFloat(body.amount) || 0,
    vat_amount: parseFloat(body.vat_amount) || 0,
    issue_date: body.issue_date,
    due_date: body.due_date || null,
    paid_date: body.paid ? body.issue_date : null,
    status: body.paid ? 'paid' : 'unpaid',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id })
}
