import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNTS } from './accounts'
import { openingBalanceLines, type OpeningBalanceEntry } from './rules'
import { postJournalEntry, reverseJournalEntry } from './posting'
import { allBlockingKeys } from './wizard-questions'

export type SetupAnswers = Record<string, { value: unknown; status: 'answered' | 'unknown' | 'unanswered' }>

/**
 * Builds the opening-balance journal lines from whatever the wizard has
 * collected so far, or returns null if any blocking question is still
 * unanswered/unknown — an incomplete opening balance must never be posted
 * as if it were a real (if small) one.
 */
export function computeOpeningBalanceEntries(answers: SetupAnswers): OpeningBalanceEntry[] | null {
  for (const key of allBlockingKeys()) {
    if (answers[key]?.status !== 'answered') return null
  }

  const num = (key: string) => Number(answers[key]?.value ?? 0) || 0

  const entries: OpeningBalanceEntry[] = [
    { accountCode: ACCOUNTS.BANK, amount: num('total_bank_balance'), side: 'debit' },
    { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, amount: num('opening_receivables'), side: 'debit' },
    { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, amount: num('opening_payables'), side: 'credit' },
    { accountCode: ACCOUNTS.SHARE_CAPITAL, amount: num('share_capital'), side: 'credit' },
    { accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, amount: num('shareholder_loan_balance'), side: 'credit' },
  ]

  return entries
}

/**
 * Reconciles the ledger's opening-balance entry with the wizard's current
 * answers: if nothing is postable yet, does nothing; if a prior opening
 * entry exists and the answers have moved on, reverses it and posts a fresh
 * one (never edits the old entry — see the immutability convention in
 * supabase/migrations/007_ledger_core.sql). Returns the new entry id, or
 * null if the opening balance still can't be posted.
 */
export async function syncOpeningBalanceEntry(
  db: SupabaseClient,
  opts: { companyId: string; createdBy: string; entryDate: string; answers: SetupAnswers }
): Promise<string | null> {
  const openingEntries = computeOpeningBalanceEntries(opts.answers)
  if (!openingEntries) return null

  const lines = openingBalanceLines(openingEntries)

  const { data: existing, error } = await db
    .from('journal_entries')
    .select('id')
    .eq('company_id', opts.companyId)
    .eq('source_type', 'opening_balance')
  if (error) throw new Error(error.message)

  const existingIds = (existing ?? []).map((e: { id: string }) => e.id)
  let activeIds = existingIds
  if (existingIds.length > 0) {
    const { data: reversals, error: revErr } = await db
      .from('journal_entries')
      .select('reverses_entry_id')
      .in('reverses_entry_id', existingIds)
    if (revErr) throw new Error(revErr.message)
    const reversedIds = new Set((reversals ?? []).map((r: { reverses_entry_id: string }) => r.reverses_entry_id))
    activeIds = existingIds.filter(id => !reversedIds.has(id))
  }

  for (const entryId of activeIds) {
    await reverseJournalEntry(db, entryId, {
      companyId: opts.companyId,
      createdBy: opts.createdBy,
      description: 'Opening balance updated',
      entryDate: opts.entryDate,
    })
  }

  return postJournalEntry(db, {
    companyId: opts.companyId,
    entryDate: opts.entryDate,
    description: 'Opening balance',
    sourceType: 'opening_balance',
    createdBy: opts.createdBy,
    lines,
  })
}
