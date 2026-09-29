import { describe, it, expect } from 'vitest'
import { ACCOUNTS } from './accounts'
import {
  sentInvoiceCreatedLines,
  sentInvoicePaidLines,
  receivedInvoiceCreatedLines,
  receivedInvoicePaidLines,
  receivedInvoicePaidDirectlyLines,
  expensePaidByCompanyLines,
  expensePendingReimbursementLines,
  expenseReimbursedLines,
  ownerTransferInLines,
  ownerTransferOutLines,
  salaryPaidLines,
  vatPaymentLines,
  vatRefundLines,
  openingBalanceLines,
} from './rules'
import type { JournalLineInput } from './posting'

function totals(lines: JournalLineInput[]) {
  const debit = lines.reduce((s, l) => s + (l.debit ?? 0), 0)
  const credit = lines.reduce((s, l) => s + (l.credit ?? 0), 0)
  return { debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100 }
}

function expectBalanced(lines: JournalLineInput[]) {
  const { debit, credit } = totals(lines)
  expect(debit).toBeCloseTo(credit, 2)
  for (const line of lines) {
    const d = line.debit ?? 0
    const c = line.credit ?? 0
    expect(d === 0 || c === 0).toBe(true) // never both on one line
    expect(d > 0 || c > 0).toBe(true) // never a no-op zero line
  }
}

describe('unpaid customer invoice', () => {
  it('debits AR, credits revenue + VAT payable, and balances', () => {
    const lines = sentInvoiceCreatedLines(100, 25.5)
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, debit: 125.5 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.REVENUE, credit: 100 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.VAT_PAYABLE, credit: 25.5 })
  })

  it('omits the VAT line when VAT is zero', () => {
    const lines = sentInvoiceCreatedLines(50, 0)
    expectBalanced(lines)
    expect(lines.find(l => l.accountCode === ACCOUNTS.VAT_PAYABLE)).toBeUndefined()
  })
})

describe('sent invoice marked paid', () => {
  it('moves the receivable into bank', () => {
    const lines = sentInvoicePaidLines(100, 25.5)
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, debit: 125.5 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.ACCOUNTS_RECEIVABLE, credit: 125.5 })
  })
})

describe('paid supplier invoice', () => {
  it('unpaid-then-paid: books to AP first, then clears AP against bank', () => {
    const created = receivedInvoiceCreatedLines(200, 51, 'software')
    expectBalanced(created)
    expect(created).toContainEqual({ accountCode: '4400', debit: 200 })
    expect(created).toContainEqual({ accountCode: ACCOUNTS.VAT_RECEIVABLE, debit: 51 })
    expect(created).toContainEqual({ accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, credit: 251 })

    const paid = receivedInvoicePaidLines(200, 51)
    expectBalanced(paid)
    expect(paid).toContainEqual({ accountCode: ACCOUNTS.ACCOUNTS_PAYABLE, debit: 251 })
    expect(paid).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 251 })
  })

  it('paid directly at creation skips accounts payable entirely', () => {
    const lines = receivedInvoicePaidDirectlyLines(200, 51, 'software')
    expectBalanced(lines)
    expect(lines.find(l => l.accountCode === ACCOUNTS.ACCOUNTS_PAYABLE)).toBeUndefined()
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 251 })
  })
})

describe('personal purchase for the Oy', () => {
  it('books the expense against the owner current account, not the bank', () => {
    const lines = expensePendingReimbursementLines(40, 0, 'travel')
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: '4300', debit: 40 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, credit: 40 })
    expect(lines.find(l => l.accountCode === ACCOUNTS.BANK)).toBeUndefined()
  })

  it('company-paid expenses hit the bank directly', () => {
    const lines = expensePaidByCompanyLines(40, 0, 'travel')
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 40 })
  })
})

describe('owner loan / capital transfer', () => {
  it('a loan in credits the owner current account', () => {
    const lines = ownerTransferInLines(5000, 'loan')
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, debit: 5000 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, credit: 5000 })
  })

  it('a capital contribution credits share capital instead', () => {
    const lines = ownerTransferInLines(2500, 'capital')
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.SHARE_CAPITAL, credit: 2500 })
  })

  it('a drawing/repayment moves money out via the owner current account', () => {
    const lines = ownerTransferOutLines(300, 'drawing')
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, debit: 300 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 300 })
  })
})

describe('salary and travel reimbursement', () => {
  it('salary is a single expense/bank line in phase 1', () => {
    const lines = salaryPaidLines(2800)
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.SALARY_EXPENSE, debit: 2800 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 2800 })
  })

  it('a mileage claim is booked pending, then cleared on reimbursement', () => {
    const claimed = expensePendingReimbursementLines(64.5, 0, 'vehicle')
    expectBalanced(claimed)
    expect(claimed).toContainEqual({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, credit: 64.5 })

    const reimbursed = expenseReimbursedLines(64.5, 0)
    expectBalanced(reimbursed)
    expect(reimbursed).toContainEqual({ accountCode: ACCOUNTS.OWNER_CURRENT_ACCOUNT, debit: 64.5 })
    expect(reimbursed).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 64.5 })
  })
})

describe('VAT payment', () => {
  it('a VAT payment clears VAT payable against the bank', () => {
    const lines = vatPaymentLines(1200)
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.VAT_PAYABLE, debit: 1200 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, credit: 1200 })
  })

  it('a VAT refund moves the other direction', () => {
    const lines = vatRefundLines(300)
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.BANK, debit: 300 })
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.VAT_RECEIVABLE, credit: 300 })
  })
})

describe('opening balances', () => {
  it('auto-balances against retained earnings when assets exceed known liabilities+equity', () => {
    const lines = openingBalanceLines([
      { accountCode: ACCOUNTS.BANK, amount: 10000, side: 'debit' },
      { accountCode: ACCOUNTS.SHARE_CAPITAL, amount: 2500, side: 'credit' },
    ])
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.RETAINED_EARNINGS, credit: 7500 })
  })

  it('adds no balancing line when the entries already balance', () => {
    const lines = openingBalanceLines([
      { accountCode: ACCOUNTS.BANK, amount: 1000, side: 'debit' },
      { accountCode: ACCOUNTS.SHARE_CAPITAL, amount: 1000, side: 'credit' },
    ])
    expectBalanced(lines)
    expect(lines.find(l => l.accountCode === ACCOUNTS.RETAINED_EARNINGS)).toBeUndefined()
  })

  it('balances the other direction when liabilities exceed known assets', () => {
    const lines = openingBalanceLines([
      { accountCode: ACCOUNTS.LOANS_PAYABLE, amount: 5000, side: 'credit' },
    ])
    expectBalanced(lines)
    expect(lines).toContainEqual({ accountCode: ACCOUNTS.RETAINED_EARNINGS, debit: 5000 })
  })

  it('ignores zero-amount entries', () => {
    const lines = openingBalanceLines([
      { accountCode: ACCOUNTS.BANK, amount: 0, side: 'debit' },
      { accountCode: ACCOUNTS.SHARE_CAPITAL, amount: 1000, side: 'credit' },
    ])
    expect(lines.find(l => l.accountCode === ACCOUNTS.BANK)).toBeUndefined()
    expectBalanced(lines)
  })
})
