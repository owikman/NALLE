import type { SupabaseClient } from '@supabase/supabase-js'
import { ACCOUNTS } from './accounts'
import { openingBalanceLines, type OpeningBalanceEntry } from './rules'
import { postJournalEntry, reverseJournalEntry } from './posting'
import { allBlockingKeys, type CompanyFlags } from './wizard-questions'

export type SetupAnswers = Record<string, { value: unknown; status: 'answered' | 'unknown' | 'unanswered' }>

/**
 * Builds the opening-balance journal lines from whatever the wizard has
 * collected so far, or returns null if any blocking question the company
 * actually sees (per its VAT/salary flags) is still unanswered/unknown — an
 * incomplete opening balance must never be posted as if it were a real (if
 * small) one.
 */
export function computeOpeningBalanceEntries(answers: SetupAnswers, company: CompanyFlags): OpeningBalanceEntry[] | null {
  for (const key of allBlockingKeys(company)) {
    if (answers[key]?.status !== 'answered') return null
  }

  const num = (key: string) => Number(answers[key]?.value ?? 0) || 0

  const entries: OpeningBalanceEntry[] = [
    { accountCode: ACCOUNTS.BANK, amount: num('total_bank_balance'), side: 'debit' },
    { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, amount: num('opening_receivables'), side: 'debit' },
    { accountCode: ACCOUNTS.FIXED_ASSETS, amount: num('fixed_assets_value'), side: 'debit' },
    { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, amount: num('opening_payables'), side: 'credit' },
    { accountCode: ACCOUNTS.LOANS_PAYABLE, amount: num('business_loans_balance'), side: 'credit' },
    { accountCode: ACCOUNTS.SHARE_CAPITAL, amount: num('share_capital'), side: 'credit' },
    { accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, amount: num('shareholder_loan_balance'), side: 'credit' },
  ]

  if (company.vat_registered) {
    entries.push(
      { accountCode: ACCOUNTS.VAT_RECEIVABLE, amount: num('vat_receivable_opening'), side: 'debit' },
      { accountCode: ACCOUNTS.VAT_PAYABLE, amount: num('vat_payable_opening'), side: 'credit' }
    )
  }

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
  opts: { companyId: string; createdBy: string; entryDate: string; answers: SetupAnswers; company: CompanyFlags }
): Promise<string | null> {
  const openingEntries = computeOpeningBalanceEntries(opts.answers, opts.company)
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

  // Idempotency: if the currently active entry already matches what we're
  // about to post, do nothing — resubmitting an unchanged wizard group
  // (e.g. clicking back and forth) must not churn the journal with no-op
  // reversal/repost pairs.
  if (activeIds.length === 1) {
    const { data: accountsForDiff, error: acctDiffErr } = await db
      .from('chart_of_accounts')
      .select('id, code')
      .eq('company_id', opts.companyId)
    if (acctDiffErr) throw new Error(acctDiffErr.message)
    const idToCode = new Map<string, string>((accountsForDiff ?? []).map((a: { id: string; code: string }) => [a.id, a.code]))

    const { data: activeLines, error: activeLinesErr } = await db
      .from('journal_lines')
      .select('account_id, debit, credit')
      .eq('entry_id', activeIds[0])
    if (activeLinesErr) throw new Error(activeLinesErr.message)

    const signature = (rows: { code: string; debit: number; credit: number }[]) =>
      rows.map(r => `${r.code}:${r.debit.toFixed(2)}:${r.credit.toFixed(2)}`).sort().join('|')

    const activeSignature = signature(
      (activeLines ?? []).map((l: { account_id: string; debit: number; credit: number }) => ({
        code: idToCode.get(l.account_id) ?? '',
        debit: l.debit,
        credit: l.credit,
      }))
    )
    const newSignature = signature(lines.map(l => ({ code: l.accountCode, debit: l.debit ?? 0, credit: l.credit ?? 0 })))

    if (activeSignature === newSignature) return activeIds[0]!
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
