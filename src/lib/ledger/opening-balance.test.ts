import { describe, it, expect } from 'vitest'
import { computeOpeningBalanceEntries, syncOpeningBalanceEntry, type SetupAnswers } from './opening-balance'
import type { CompanyFlags } from './wizard-questions'
import { ACCOUNTS } from './accounts'
import { FakeDb, asDb } from './test-support'

const FIXTURE_ACCOUNTS = [
  { id: 'acct-bank', code: ACCOUNTS.BANK },
  { id: 'acct-ar', code: ACCOUNTS.ACCOUNTS_RECEIVABLE },
  { id: 'acct-ap', code: ACCOUNTS.ACCOUNTS_PAYABLE },
  { id: 'acct-fixed', code: ACCOUNTS.FIXED_ASSETS },
  { id: 'acct-loans', code: ACCOUNTS.LOANS_PAYABLE },
  { id: 'acct-capital', code: ACCOUNTS.SHARE_CAPITAL },
  { id: 'acct-owner', code: ACCOUNTS.OWNER_CURRENT_ACCOUNT },
  { id: 'acct-retained', code: ACCOUNTS.RETAINED_EARNINGS },
  { id: 'acct-vat-receivable', code: ACCOUNTS.VAT_RECEIVABLE },
  { id: 'acct-vat-payable', code: ACCOUNTS.VAT_PAYABLE },
]

const NON_VAT_COMPANY: CompanyFlags = { vat_registered: false, is_salary_payer: false }
const VAT_COMPANY: CompanyFlags = { vat_registered: true, is_salary_payer: false }

function answer(value: number, status: 'answered' | 'unknown' = 'answered') {
  return { value, status }
}

function completeAnswers(overrides: Partial<SetupAnswers> = {}): SetupAnswers {
  return {
    ledger_start_date: { value: '2026-01-01', status: 'answered' },
    total_bank_balance: answer(10000),
    opening_receivables: answer(0),
    opening_payables: answer(0),
    fixed_assets_value: answer(0),
    business_loans_balance: answer(0),
    share_capital: answer(2500),
    shareholder_loan_balance: answer(7500),
    ...overrides,
  }
}

describe('computeOpeningBalanceEntries', () => {
  it('returns null when a blocking question is unanswered', () => {
    const answers = completeAnswers({ total_bank_balance: { value: undefined, status: 'unanswered' } })
    expect(computeOpeningBalanceEntries(answers, NON_VAT_COMPANY)).toBeNull()
  })

  it('returns null when a blocking question is marked "unknown"', () => {
    const answers = completeAnswers({ share_capital: answer(2500, 'unknown') })
    expect(computeOpeningBalanceEntries(answers, NON_VAT_COMPANY)).toBeNull()
  })

  it('builds entries once everything blocking is answered', () => {
    const entries = computeOpeningBalanceEntries(completeAnswers(), NON_VAT_COMPANY)
    expect(entries).not.toBeNull()
    expect(entries).toContainEqual({ accountCode: ACCOUNTS.BANK, amount: 10000, side: 'debit' })
  })

  it('does not require VAT questions for a non-VAT-registered company', () => {
    // No vat_payable_opening/vat_receivable_opening answered at all.
    const entries = computeOpeningBalanceEntries(completeAnswers(), NON_VAT_COMPANY)
    expect(entries).not.toBeNull()
    expect(entries!.find(e => e.accountCode === ACCOUNTS.VAT_PAYABLE)).toBeUndefined()
  })

  it('requires VAT questions for a VAT-registered company, and includes them once answered', () => {
    expect(computeOpeningBalanceEntries(completeAnswers(), VAT_COMPANY)).toBeNull()

    const entries = computeOpeningBalanceEntries(
      completeAnswers({ vat_payable_opening: answer(100), vat_receivable_opening: answer(0) }),
      VAT_COMPANY
    )
    expect(entries).not.toBeNull()
    expect(entries).toContainEqual({ accountCode: ACCOUNTS.VAT_PAYABLE, amount: 100, side: 'credit' })
  })
})

describe('syncOpeningBalanceEntry', () => {
  it('does nothing and returns null while the wizard is incomplete', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const result = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers({ opening_payables: { value: undefined, status: 'unanswered' } }),
      company: NON_VAT_COMPANY,
    })
    expect(result).toBeNull()
    expect(fake.entries.size).toBe(0)
  })

  it('posts a single balanced entry once complete, including fixed assets and business loans', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const entryId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers({ fixed_assets_value: answer(1200), business_loans_balance: answer(500) }),
      company: NON_VAT_COMPANY,
    })
    expect(entryId).not.toBeNull()
    const entry = fake.entries.get(entryId!)!
    const debit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const credit = entry.lines.reduce((s, l) => s + l.credit, 0)
    expect(debit).toBe(credit)
    expect(entry.lines).toContainEqual({ account_id: 'acct-bank', debit: 10000, credit: 0 })
    expect(entry.lines).toContainEqual({ account_id: 'acct-fixed', debit: 1200, credit: 0 })
    expect(entry.lines).toContainEqual({ account_id: 'acct-loans', debit: 0, credit: 500 })
  })

  it('reverses the old entry and posts a corrected one when answers actually change', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const firstId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1', createdBy: 'user-1', entryDate: '2026-01-01',
      answers: completeAnswers(), company: NON_VAT_COMPANY,
    })

    const secondId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1', createdBy: 'user-1', entryDate: '2026-01-01',
      answers: completeAnswers({ total_bank_balance: answer(12000) }), company: NON_VAT_COMPANY,
    })

    // Three entries now exist: the original, its reversal, and the correction.
    expect(fake.entries.size).toBe(3)
    expect(secondId).not.toBe(firstId)

    const netBank = [...fake.entries.values()]
      .flatMap(e => e.lines)
      .filter(l => l.account_id === 'acct-bank')
      .reduce((s, l) => s + l.debit - l.credit, 0)
    expect(netBank).toBe(12000)
  })

  it('is idempotent: resyncing with unchanged answers does not churn the journal', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const firstId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1', createdBy: 'user-1', entryDate: '2026-01-01',
      answers: completeAnswers(), company: NON_VAT_COMPANY,
    })
    expect(fake.entries.size).toBe(1)

    const secondId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1', createdBy: 'user-1', entryDate: '2026-01-01',
      answers: completeAnswers(), company: NON_VAT_COMPANY,
    })

    expect(secondId).toBe(firstId)
    expect(fake.entries.size).toBe(1)
  })
})
