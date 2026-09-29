import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { NextResponse } from 'next/server'

const SOURCE_LINKS: Record<string, string> = {
  invoice: '/invoices',
  expense: '/expenses',
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const url = new URL(request.url)
  const accountId = url.searchParams.get('account_id')
  const asOf = url.searchParams.get('as_of') ?? new Date().toISOString().split('T')[0]!
  if (!accountId) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })

  const db = createServiceClient()

  const { data: account, error: acctErr } = await db
    .from('chart_of_accounts')
    .select('id, code, name, company_id')
    .eq('id', accountId)
    .single()
  if (acctErr || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  if (account.company_id !== companyId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: lines, error: linesErr } = await db
    .from('journal_lines')
    .select('id, debit, credit, journal_entries!inner(id, entry_date, description, source_type, source_id, company_id)')
    .eq('account_id', accountId)
    .eq('journal_entries.company_id', companyId)
    .lte('journal_entries.entry_date', asOf)
    .order('entry_date', { referencedTable: 'journal_entries', ascending: true })
  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 })

  type LineRow = {
    id: string
    debit: number
    credit: number
    journal_entries: { id: string; entry_date: string; description: string; source_type: string; source_id: string | null } | null
  }

  const rows = ((lines ?? []) as unknown as LineRow[]).map(l => ({
    lineId: l.id,
    entryId: l.journal_entries?.id ?? null,
    entryDate: l.journal_entries?.entry_date ?? null,
    description: l.journal_entries?.description ?? '',
    sourceType: l.journal_entries?.source_type ?? 'manual',
    debit: l.debit,
    credit: l.credit,
    sourceHref: l.journal_entries ? (SOURCE_LINKS[l.journal_entries.source_type] ?? null) : null,
  }))

  return NextResponse.json({ account: { code: account.code, name: account.name }, lines: rows })
}
