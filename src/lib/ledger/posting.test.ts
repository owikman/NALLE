import { describe, it, expect } from 'vitest'
import { postJournalEntry, reverseJournalEntry, UnbalancedEntryError, UnknownAccountCodeError } from './posting'
import { sentInvoiceCreatedLines } from './rules'
import { ACCOUNTS } from './accounts'
import { FakeDb, asDb } from './test-support'

const FIXTURE_ACCOUNTS = [
  { id: 'acct-ar', code: ACCOUNTS.ACCOUNTS_RECEIVABLE },
  { id: 'acct-revenue', code: ACCOUNTS.REVENUE },
  { id: 'acct-vat-payable', code: ACCOUNTS.VAT_PAYABLE },
  { id: 'acct-bank', code: ACCOUNTS.BANK },
]

describe('postJournalEntry', () => {
  it('refuses to write an unbalanced entry', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    await expect(
      postJournalEntry(asDb(fake), {
        companyId: 'co-1',
        entryDate: '2026-09-29',
        description: 'bad entry',
        sourceType: 'manual',
        createdBy: 'user-1',
        lines: [
          { accountCode: ACCOUNTS.BANK, debit: 100 },
          { accountCode: ACCOUNTS.REVENUE, credit: 50 },
        ],
      })
    ).rejects.toBeInstanceOf(UnbalancedEntryError)
    expect(fake.entries.size).toBe(0)
  })

  it('refuses to write against an unknown account code', async () => {
    const fake = new FakeDb([{ id: 'acct-bank', code: ACCOUNTS.BANK }])
    await expect(
      postJournalEntry(asDb(fake), {
        companyId: 'co-1',
        entryDate: '2026-09-29',
        description: 'missing account',
        sourceType: 'manual',
        createdBy: 'user-1',
        lines: [
          { accountCode: ACCOUNTS.BANK, debit: 100 },
          { accountCode: ACCOUNTS.REVENUE, credit: 100 },
        ],
      })
    ).rejects.toBeInstanceOf(UnknownAccountCodeError)
  })

  it('posts a balanced entry and records the correct lines', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const entryId = await postJournalEntry(asDb(fake), {
      companyId: 'co-1',
      entryDate: '2026-09-29',
      description: 'unpaid customer invoice',
      sourceType: 'invoice',
      sourceId: 'inv-1',
      createdBy: 'user-1',
      lines: sentInvoiceCreatedLines(100, 25.5),
    })

    const stored = fake.entries.get(entryId)!
    expect(stored.lines).toHaveLength(3)
    expect(stored.lines).toContainEqual({ account_id: 'acct-ar', debit: 125.5, credit: 0 })
    expect(stored.lines).toContainEqual({ account_id: 'acct-revenue', debit: 0, credit: 100 })
    expect(stored.lines).toContainEqual({ account_id: 'acct-vat-payable', debit: 0, credit: 25.5 })
  })
})

describe('reverseJournalEntry', () => {
  it('mirrors the original lines so the pair nets to zero per account', async () => {
    const fake = new FakeDb(FIXTURE_ACCOUNTS)
    const originalId = await postJournalEntry(asDb(fake), {
      companyId: 'co-1',
      entryDate: '2026-09-29',
      description: 'unpaid customer invoice',
      sourceType: 'invoice',
      sourceId: 'inv-1',
      createdBy: 'user-1',
      lines: sentInvoiceCreatedLines(100, 25.5),
    })

    const reversalId = await reverseJournalEntry(asDb(fake), originalId, {
      companyId: 'co-1',
      createdBy: 'user-1',
      description: 'reversing bad invoice',
      entryDate: '2026-09-30',
    })

    const original = fake.entries.get(originalId)!
    const reversal = fake.entries.get(reversalId)!

    const netByAccount = new Map<string, number>()
    for (const line of [...original.lines, ...reversal.lines]) {
      const net = (netByAccount.get(line.account_id) ?? 0) + line.debit - line.credit
      netByAccount.set(line.account_id, net)
    }
    for (const net of netByAccount.values()) {
      expect(Math.round(net * 100) / 100).toBe(0)
    }
  })
})
