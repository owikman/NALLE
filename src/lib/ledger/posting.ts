import type { SupabaseClient } from '@supabase/supabase-js'

export type JournalSourceType = 'invoice' | 'expense' | 'manual' | 'opening_balance' | 'reversal'

export interface JournalLineInput {
  accountCode: string
  debit?: number
  credit?: number
}

export interface PostJournalEntryInput {
  companyId: string
  entryDate: string
  description: string
  sourceType: JournalSourceType
  sourceId?: string | null
  createdBy: string
  lines: JournalLineInput[]
  reversesEntryId?: string | null
}

export class UnbalancedEntryError extends Error {
  constructor(totalDebitCents: number, totalCreditCents: number) {
    super(`Journal entry does not balance: debit ${totalDebitCents / 100} !== credit ${totalCreditCents / 100}`)
    this.name = 'UnbalancedEntryError'
  }
}

export class UnknownAccountCodeError extends Error {
  constructor(code: string, companyId: string) {
    super(`No chart_of_accounts entry with code "${code}" for company ${companyId}`)
    this.name = 'UnknownAccountCodeError'
  }
}

function toCents(n: number): number {
  return Math.round(n * 100)
}

/**
 * Posts a balanced double-entry journal entry. Refuses to write anything if
 * the lines don't balance to the cent, or reference an unknown account code
 * for the company — a partially-written, unbalanced entry would be worse
 * than no entry at all.
 */
export async function postJournalEntry(db: SupabaseClient, input: PostJournalEntryInput): Promise<string> {
  const lines = input.lines.filter(l => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0)
  if (lines.length === 0) throw new Error('Journal entry must have at least one non-zero line')

  const totalDebitCents = lines.reduce((s, l) => s + toCents(l.debit ?? 0), 0)
  const totalCreditCents = lines.reduce((s, l) => s + toCents(l.credit ?? 0), 0)
  if (totalDebitCents !== totalCreditCents) {
    throw new UnbalancedEntryError(totalDebitCents, totalCreditCents)
  }

  const codes = [...new Set(lines.map(l => l.accountCode))]
  const { data: accounts, error: accountsErr } = await db
    .from('chart_of_accounts')
    .select('id, code')
    .eq('company_id', input.companyId)
    .in('code', codes)
  if (accountsErr) throw new Error(accountsErr.message)

  const codeToId = new Map<string, string>((accounts ?? []).map((a: { code: string; id: string }) => [a.code, a.id]))
  for (const code of codes) {
    if (!codeToId.has(code)) throw new UnknownAccountCodeError(code, input.companyId)
  }

  const { data: entry, error: entryErr } = await db
    .from('journal_entries')
    .insert({
      company_id: input.companyId,
      entry_date: input.entryDate,
      description: input.description,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      reverses_entry_id: input.reversesEntryId ?? null,
      created_by: input.createdBy,
    })
    .select('id')
    .single()
  if (entryErr || !entry) throw new Error(entryErr?.message ?? 'Failed to create journal entry')

  const lineRows = lines.map(l => ({
    entry_id: entry.id,
    account_id: codeToId.get(l.accountCode),
    debit: l.debit ?? 0,
    credit: l.credit ?? 0,
  }))
  const { error: linesErr } = await db.from('journal_lines').insert(lineRows)
  if (linesErr) throw new Error(linesErr.message)

  return entry.id as string
}

/**
 * Records a correction by inserting a new entry that exactly mirrors the
 * original entry's debit/credit lines (swapped), rather than mutating the
 * original — the DB also rejects UPDATE/DELETE on these tables outright.
 * Summing all lines nets the reversed entry to zero automatically.
 */
export async function reverseJournalEntry(
  db: SupabaseClient,
  entryId: string,
  opts: { companyId: string; createdBy: string; description: string; entryDate: string }
): Promise<string> {
  const { data: original, error } = await db
    .from('journal_entries')
    .select('id, journal_lines(account_id, debit, credit)')
    .eq('id', entryId)
    .single()
  if (error || !original) throw new Error(error?.message ?? 'Original journal entry not found')

  const { data: accounts, error: acctErr } = await db
    .from('chart_of_accounts')
    .select('id, code')
    .eq('company_id', opts.companyId)
  if (acctErr) throw new Error(acctErr.message)
  const idToCode = new Map<string, string>((accounts ?? []).map((a: { code: string; id: string }) => [a.id, a.code]))

  type OriginalLine = { account_id: string; debit: number; credit: number }
  const mirroredLines: JournalLineInput[] = ((original.journal_lines ?? []) as OriginalLine[]).map(l => ({
    accountCode: idToCode.get(l.account_id) ?? (() => { throw new Error(`Account ${l.account_id} not found for reversal`) })(),
    debit: l.credit,
    credit: l.debit,
  }))

  return postJournalEntry(db, {
    companyId: opts.companyId,
    entryDate: opts.entryDate,
    description: opts.description,
    sourceType: 'reversal',
    reversesEntryId: entryId,
    createdBy: opts.createdBy,
    lines: mirroredLines,
  })
}
