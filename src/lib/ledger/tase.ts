import type { SupabaseClient } from '@supabase/supabase-js'
import { WIZARD_GROUPS } from './wizard-questions'

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface AccountBalance {
  accountId: string
  code: string
  name: string
  type: AccountType
  subtype: string | null
  /** Expressed on the account's natural side — positive for a normal balance (e.g. a debit balance on an asset). */
  balance: number
}

export interface TaseRow {
  accountId: string | null
  code: string
  name: string
  balance: number
}

export interface TaseTotals {
  vastaavaa: TaseRow[]
  vastattavaa: TaseRow[]
  totalAssets: number
  totalLiabilitiesAndEquity: number
  balanced: boolean
  /** Every account with a balance, including zero — for a formal report that lists full categories rather than hiding empty ones. */
  allBalances: AccountBalance[]
  currentPeriodResult: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Turns raw journal_lines (already filtered to a company and an as-of date)
 * into one signed balance per account, expressed on that account's natural
 * side. Pure — no DB access — so it's unit-testable against fixture data.
 */
export function summarizeAccountBalances(
  accounts: { id: string; code: string; name: string; type: AccountType; subtype: string | null }[],
  lines: { account_id: string; debit: number; credit: number }[]
): AccountBalance[] {
  const sums = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const cur = sums.get(line.account_id) ?? { debit: 0, credit: 0 }
    cur.debit += line.debit
    cur.credit += line.credit
    sums.set(line.account_id, cur)
  }

  return accounts.map(account => {
    const s = sums.get(account.id) ?? { debit: 0, credit: 0 }
    const debitNormal = account.type === 'asset' || account.type === 'expense'
    const balance = round2(debitNormal ? s.debit - s.credit : s.credit - s.debit)
    return { accountId: account.id, code: account.code, name: account.name, type: account.type, subtype: account.subtype, balance }
  })
}

/**
 * Buckets account balances into Vastaavaa (assets) and Vastattavaa
 * (liabilities + equity), adding the period's running profit/loss as a
 * computed equity line — standard for an interim tase, since a formal
 * closing entry only happens at year-end. Verifies the fundamental
 * accounting identity independently of the posting engine's own
 * per-entry balance check, as a second, whole-ledger sanity check.
 */
export function buildTase(accountBalances: AccountBalance[]): TaseTotals {
  const vastaavaa = accountBalances.filter(a => a.type === 'asset' && a.balance !== 0)
  const liabilities = accountBalances.filter(a => a.type === 'liability' && a.balance !== 0)
  const equity = accountBalances.filter(a => a.type === 'equity' && a.balance !== 0)
  const revenue = accountBalances.filter(a => a.type === 'revenue')
  const expense = accountBalances.filter(a => a.type === 'expense')

  const currentPeriodResult = round2(
    revenue.reduce((s, a) => s + a.balance, 0) - expense.reduce((s, a) => s + a.balance, 0)
  )

  const vastattavaa: TaseRow[] = [...liabilities, ...equity]
  if (currentPeriodResult !== 0) {
    vastattavaa.push({ accountId: null, code: '', name: "Tilikauden tulos (draft — not yet closed)", balance: currentPeriodResult })
  }

  const totalAssets = round2(vastaavaa.reduce((s, a) => s + a.balance, 0))
  const totalLiabilitiesAndEquity = round2(vastattavaa.reduce((s, a) => s + a.balance, 0))

  return {
    vastaavaa,
    vastattavaa,
    totalAssets,
    totalLiabilitiesAndEquity,
    balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    allBalances: accountBalances,
    currentPeriodResult,
  }
}

export type TaseState = 'missing' | 'ready' | 'reconciled'

export interface TaseReadiness {
  state: TaseState
  groups: { key: string; title: string; complete: boolean; hasUnknown: boolean }[]
  openTasks: { id: string; title: string; link_href: string | null }[]
  hasOpeningEntry: boolean
}

/**
 * The single source of truth for "is the tase ready" — consumed by the
 * status page, the workspace, and (in a later phase) the AI CFO chat, so no
 * surface can ever disagree with another about whether a tase is missing
 * information, ready for review, or a reconciled draft.
 */
export async function getTaseReadiness(db: SupabaseClient, companyId: string): Promise<TaseReadiness> {
  const [{ data: company }, { data: responses }, { data: openTaskRows }, { data: openingEntries }] = await Promise.all([
    db.from('companies').select('vat_registered, is_salary_payer').eq('id', companyId).single(),
    db.from('setup_responses').select('question_key, status').eq('company_id', companyId),
    db.from('follow_up_tasks').select('id, title, link_href').eq('company_id', companyId).eq('status', 'open').order('created_at', { ascending: true }),
    db.from('journal_entries').select('id').eq('company_id', companyId).eq('source_type', 'opening_balance'),
  ])

  const companyFlags = company ?? { vat_registered: false, is_salary_payer: false }
  const groups = WIZARD_GROUPS.filter(g => !g.showIf || g.showIf(companyFlags)).map(g => {
    const responseByKey = new Map((responses ?? []).map((r: { question_key: string; status: string }) => [r.question_key, r.status]))
    const statuses = g.fields.map(f => responseByKey.get(f.key) ?? 'unanswered')
    return { key: g.key, title: g.title, complete: statuses.every(s => s !== 'unanswered'), hasUnknown: statuses.some(s => s === 'unknown') }
  })

  const allComplete = groups.every(g => g.complete)
  const hasOpeningEntry = (openingEntries ?? []).length > 0
  const openTasks = openTaskRows ?? []

  let state: TaseState = 'missing'
  if (allComplete && hasOpeningEntry) state = openTasks.length > 0 ? 'ready' : 'reconciled'

  return { state, groups, openTasks, hasOpeningEntry }
}

/**
 * Computes the live tase as of a given date directly from the ledger — not
 * a frozen snapshot — so drill-down always reflects the current journal.
 */
export async function computeTase(db: SupabaseClient, companyId: string, asOfDate: string): Promise<TaseTotals> {
  const { data: accounts, error: acctErr } = await db
    .from('chart_of_accounts')
    .select('id, code, name, type, subtype')
    .eq('company_id', companyId)
  if (acctErr) throw new Error(acctErr.message)

  const { data: entries, error: entryErr } = await db
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .lte('entry_date', asOfDate)
  if (entryErr) throw new Error(entryErr.message)

  const entryIds = (entries ?? []).map((e: { id: string }) => e.id)
  let lines: { account_id: string; debit: number; credit: number }[] = []
  if (entryIds.length > 0) {
    const { data: lineRows, error: lineErr } = await db
      .from('journal_lines')
      .select('account_id, debit, credit')
      .in('entry_id', entryIds)
    if (lineErr) throw new Error(lineErr.message)
    lines = lineRows ?? []
  }

  const typedAccounts = (accounts ?? []) as { id: string; code: string; name: string; type: AccountType; subtype: string | null }[]
  const balances = summarizeAccountBalances(typedAccounts, lines)
  return buildTase(balances)
}
