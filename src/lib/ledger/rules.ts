import { ACCOUNTS, expenseAccountCode } from './accounts'
import type { JournalLineInput } from './posting'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Sales invoices ("sent") ──────────────────────────────────────────────

export function sentInvoiceCreatedLines(amount: number, vatAmount: number): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  const lines: JournalLineInput[] = [
    { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: total },
    { accountCode: ACCOUNTS.REVENUE, credit: round2(amount) },
  ]
  if (vatAmount > 0) lines.push({ accountCode: ACCOUNTS.VAT_PAYABLE, credit: round2(vatAmount) })
  return lines
}

export function sentInvoicePaidLines(amount: number, vatAmount: number): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  return [
    { accountCode: ACCOUNTS.BANK, debit: total },
    { accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: total },
  ]
}

// ── Purchase invoices ("received") ───────────────────────────────────────

export function receivedInvoiceCreatedLines(amount: number, vatAmount: number, category: string): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  const lines: JournalLineInput[] = [{ accountCode: expenseAccountCode(category), debit: round2(amount) }]
  if (vatAmount > 0) lines.push({ accountCode: ACCOUNTS.VAT_RECEIVABLE, debit: round2(vatAmount) })
  lines.push({ accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, credit: total })
  return lines
}

export function receivedInvoicePaidLines(amount: number, vatAmount: number): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  return [
    { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, debit: total },
    { accountCode: ACCOUNTS.BANK, credit: total },
  ]
}

/** Received invoice that was already paid at the moment it was recorded — skips accounts payable entirely. */
export function receivedInvoicePaidDirectlyLines(amount: number, vatAmount: number, category: string): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  const lines: JournalLineInput[] = [{ accountCode: expenseAccountCode(category), debit: round2(amount) }]
  if (vatAmount > 0) lines.push({ accountCode: ACCOUNTS.VAT_RECEIVABLE, debit: round2(vatAmount) })
  lines.push({ accountCode: ACCOUNTS.BANK, credit: total })
  return lines
}

// ── Expenses / mileage ───────────────────────────────────────────────────

export function expensePaidByCompanyLines(amount: number, vatAmount: number, category: string): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  const lines: JournalLineInput[] = [{ accountCode: expenseAccountCode(category), debit: round2(amount) }]
  if (vatAmount > 0) lines.push({ accountCode: ACCOUNTS.VAT_RECEIVABLE, debit: round2(vatAmount) })
  lines.push({ accountCode: ACCOUNTS.BANK, credit: total })
  return lines
}

/** Owner paid personally for the Oy (a personal purchase, or mileage) — the company owes the owner until reimbursed. */
export function expensePendingReimbursementLines(amount: number, vatAmount: number, category: string): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  const lines: JournalLineInput[] = [{ accountCode: expenseAccountCode(category), debit: round2(amount) }]
  if (vatAmount > 0) lines.push({ accountCode: ACCOUNTS.VAT_RECEIVABLE, debit: round2(vatAmount) })
  lines.push({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, credit: total })
  return lines
}

export function expenseReimbursedLines(amount: number, vatAmount: number): JournalLineInput[] {
  const total = round2(amount + vatAmount)
  return [
    { accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, debit: total },
    { accountCode: ACCOUNTS.BANK, credit: total },
  ]
}

// ── Owner transfers, salary, VAT (manual entries) ────────────────────────

export function ownerTransferInLines(amount: number, kind: 'loan' | 'capital'): JournalLineInput[] {
  const creditCode = kind === 'capital' ? ACCOUNTS.SHARE_CAPITAL : ACCOUNTS.OWNER_CURRENT_ACCOUNT
  const a = round2(amount)
  return [
    { accountCode: ACCOUNTS.BANK, debit: a },
    { accountCode: creditCode, credit: a },
  ]
}

export function ownerTransferOutLines(amount: number, kind: 'loan_repayment' | 'drawing'): JournalLineInput[] {
  const debitCode = kind === 'loan_repayment' ? ACCOUNTS.OWNER_CURRENT_ACCOUNT : ACCOUNTS.OWNER_CURRENT_ACCOUNT
  const a = round2(amount)
  return [
    { accountCode: debitCode, debit: a },
    { accountCode: ACCOUNTS.BANK, credit: a },
  ]
}

/** Phase 1 simplification: a single expense/bank line, no separate withholding-tax or TyEL liability split. */
export function salaryPaidLines(amount: number): JournalLineInput[] {
  const a = round2(amount)
  return [
    { accountCode: ACCOUNTS.SALARY_EXPENSE, debit: a },
    { accountCode: ACCOUNTS.BANK, credit: a },
  ]
}

export function vatPaymentLines(amount: number): JournalLineInput[] {
  const a = round2(amount)
  return [
    { accountCode: ACCOUNTS.VAT_PAYABLE, debit: a },
    { accountCode: ACCOUNTS.BANK, credit: a },
  ]
}

export function vatRefundLines(amount: number): JournalLineInput[] {
  const a = round2(amount)
  return [
    { accountCode: ACCOUNTS.BANK, debit: a },
    { accountCode: ACCOUNTS.VAT_RECEIVABLE, credit: a },
  ]
}

// ── Opening balances ──────────────────────────────────────────────────────

export interface OpeningBalanceEntry {
  accountCode: string
  amount: number
  side: 'debit' | 'credit'
}

/**
 * Builds opening-balance lines from whatever the user actually knows
 * (bank balances, receivables, payables, loans, prior capital) and adds a
 * single balancing line against retainedEarningsAccountCode so the entry
 * always balances — the wizard computes and shows this line rather than
 * asking a non-accountant to balance a trial balance by hand.
 */
export function openingBalanceLines(
  entries: OpeningBalanceEntry[],
  balancingAccountCode: string = ACCOUNTS.RETAINED_EARNINGS
): JournalLineInput[] {
  const lines: JournalLineInput[] = entries
    .filter(e => e.amount !== 0)
    .map(e => ({ accountCode: e.accountCode, [e.side]: round2(Math.abs(e.amount)) }))

  const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  const diff = round2(totalDebit - totalCredit)

  if (diff > 0) lines.push({ accountCode: balancingAccountCode, credit: diff })
  else if (diff < 0) lines.push({ accountCode: balancingAccountCode, debit: -diff })

  return lines
}
