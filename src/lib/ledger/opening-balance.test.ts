import { describe, it, expect } from 'vitest'
import { computeOpeningBalanceEntries, syncOpeningBalanceEntry, type SetupAnswers } from './opening-balance'
import { ACCOUNTS } from './accounts'
import { FakeDb, asDb } from './test-support'

const FIXTURE_ACCOUNTS = [
  { id: 'acct-bank', code: ACCOUNTS.BANK },
  { id: 'acct-ar', code: ACCOUNTS.ACCOUNTS_RECEIVABLE },
  { id: 'acct-ap', code: ACCOUNTS.ACCOUNTS_PAYABLE },
  { id: 'acct-capital', code: ACCOUNTS.SHARE_CAPITAL },
  { id: 'acct-owner', code: ACCOUNTS.OWNER_CURRENT_ACCOUNT },
  { id: 'acct-retained', code: ACCOUNTS.RETAINED_EARNINGS },
]

function answer(value: number, status: 'answered' | 'unknown' = 'answered') {
  return { value, status }
}

function completeAnswers(overrides: Partial<SetupAnswers> = {}): SetupAnswers {
  return {
    ledger_start_date: { value: '2026-01-01', status: 'answered' },
    total_bank_balance: answer(10000),
    opening_receivables: answer(0),
    opening_payables: answer(0),
    share_capital: answer(2500),
    shareholder_loan_balance: answer(7500),
    ...overrides,
  }
}

describe('computeOpeningBalanceEntries', () => {
  it('returns null when a blocking question is unanswered', () => {
    const answers = completeAnswers({ total_bank_balance: { value: undefined, status: 'unanswered' } })
    expect(computeOpeningBalanceEntries(answers)).toBeNull()
  })

  it('returns null when a blocking question is marked "unknown"', () => {
    const answers = completeAnswers({ share_capital: answer(2500, 'unknown') })
    expect(computeOpeningBalanceEntries(answers)).toBeNull()
  })

  it('builds entries once everything blocking is answered', () => {
    const entries = computeOpeningBalanceEntries(completeAnswers())
    expect(entries).not.toBeNull()
    expect(entries).toContainEqual({ accountCode: ACCOUNTS.BANK, amount: 10000, side: 'debit' })
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
    })
    expect(result).toBeNull()
    expect(fake.entries.size).toBe(0)
  })

  it('posts a single balanced entry once complete', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const entryId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers(),
    })
    expect(entryId).not.toBeNull()
    const entry = fake.entries.get(entryId!)!
    const debit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const credit = entry.lines.reduce((s, l) => s + l.credit, 0)
    expect(debit).toBe(credit)
    expect(entry.lines).toContainEqual({ account_id: 'acct-bank', debit: 10000, credit: 0 })
    expect(entry.lines).toContainEqual({ account_id: 'acct-capital', debit: 0, credit: 2500 })
    expect(entry.lines).toContainEqual({ account_id: 'acct-owner', debit: 0, credit: 7500 })
  })

  it('reverses the old entry and posts a corrected one when answers change', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const firstId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers(),
    })

    const secondId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers({ total_bank_balance: answer(12000) }),
    })

    // Three entries now exist: the original, its reversal, and the correction.
    expect(fake.entries.size).toBe(3)
    expect(secondId).not.toBe(firstId)

    const netBank = [...fake.entries.values()]
      .flatMap(e => e.lines)
      .filter(l => l.account_id === 'acct-bank')
      .reduce((s, l) => s + l.debit - l.credit, 0)
    // original (10000) reversed to 0, corrected entry leaves exactly 12000.
    expect(netBank).toBe(12000)

    // Re-syncing with unchanged answers is still safe (stays balanced, and the
    // net position is unaffected) even though it isn't smart enough yet to
    // skip the no-op reversal+repost — that's a phase-1 known simplification.
    const thirdId = await syncOpeningBalanceEntry(asDb(fake), {
      companyId: 'co-1',
      createdBy: 'user-1',
      entryDate: '2026-01-01',
      answers: completeAnswers({ total_bank_balance: answer(12000) }),
    })
    expect(fake.entries.size).toBe(5)
    expect(thirdId).not.toBe(secondId)
    const netBankAfterNoOpResync = [...fake.entries.values()]
      .flatMap(e => e.lines)
      .filter(l => l.account_id === 'acct-bank')
      .reduce((s, l) => s + l.debit - l.credit, 0)
    expect(netBankAfterNoOpResync).toBe(12000)
  })
})
