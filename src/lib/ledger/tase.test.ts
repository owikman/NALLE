import { describe, it, expect } from 'vitest'
import { summarizeAccountBalances, buildTase, type AccountBalance } from './tase'

const ACCOUNTS = [
  { id: 'bank', code: '1910', name: 'Bank', type: 'asset' as const, subtype: 'current_asset' },
  { id: 'ar', code: '1700', name: 'Accounts receivable', type: 'asset' as const, subtype: 'current_asset' },
  { id: 'ap', code: '2870', name: 'Accounts payable', type: 'liability' as const, subtype: 'current_liability' },
  { id: 'capital', code: '2001', name: 'Share capital', type: 'equity' as const, subtype: 'equity' },
  { id: 'revenue', code: '3000', name: 'Revenue', type: 'revenue' as const, subtype: 'operating_revenue' },
  { id: 'expense', code: '4900', name: 'Other expense', type: 'expense' as const, subtype: 'operating_expense' },
]

describe('summarizeAccountBalances', () => {
  it('computes a debit-normal balance for assets', () => {
    const balances = summarizeAccountBalances(ACCOUNTS, [
      { account_id: 'bank', debit: 1000, credit: 0 },
      { account_id: 'bank', debit: 0, credit: 200 },
    ])
    expect(balances.find(b => b.accountId === 'bank')?.balance).toBe(800)
  })

  it('computes a credit-normal balance for liabilities and equity', () => {
    const balances = summarizeAccountBalances(ACCOUNTS, [
      { account_id: 'ap', debit: 0, credit: 500 },
      { account_id: 'capital', debit: 0, credit: 2500 },
    ])
    expect(balances.find(b => b.accountId === 'ap')?.balance).toBe(500)
    expect(balances.find(b => b.accountId === 'capital')?.balance).toBe(2500)
  })

  it('returns a zero balance for untouched accounts, not an absent one', () => {
    const balances = summarizeAccountBalances(ACCOUNTS, [])
    expect(balances).toHaveLength(ACCOUNTS.length)
    expect(balances.every(b => b.balance === 0)).toBe(true)
  })
})

describe('buildTase', () => {
  function balance(accountId: string, balance: number): AccountBalance {
    const acct = ACCOUNTS.find(a => a.id === accountId)!
    return { accountId, code: acct.code, name: acct.name, type: acct.type, subtype: acct.subtype, balance }
  }

  it('balances when assets equal liabilities + equity with no activity', () => {
    const tase = buildTase([balance('bank', 2500), balance('capital', 2500)])
    expect(tase.balanced).toBe(true)
    expect(tase.totalAssets).toBe(2500)
    expect(tase.totalLiabilitiesAndEquity).toBe(2500)
  })

  it('folds the period result into equity as a computed line, and still balances', () => {
    // 1000 cash inflow from revenue, 400 expense paid from bank -> bank ends at 600.
    const tase = buildTase([
      balance('bank', 600),
      balance('revenue', 1000),
      balance('expense', 400),
    ])
    expect(tase.balanced).toBe(true)
    const resultLine = tase.vastattavaa.find(r => r.name.includes('Tilikauden tulos'))
    expect(resultLine?.balance).toBe(600)
    expect(tase.totalLiabilitiesAndEquity).toBe(600)
  })

  it('omits the period-result line entirely when net income is exactly zero', () => {
    const tase = buildTase([balance('bank', 2500), balance('capital', 2500), balance('revenue', 0), balance('expense', 0)])
    expect(tase.vastattavaa.some(r => r.name.includes('Tilikauden tulos'))).toBe(false)
  })

  it('excludes zero-balance asset/liability/equity accounts from the rows shown', () => {
    const tase = buildTase([balance('bank', 1000), balance('ar', 0), balance('capital', 1000)])
    expect(tase.vastaavaa.find(r => r.accountId === 'ar')).toBeUndefined()
  })

  it('flags an unbalanced ledger rather than hiding the mismatch', () => {
    const tase = buildTase([balance('bank', 1000), balance('capital', 500)])
    expect(tase.balanced).toBe(false)
  })
})
