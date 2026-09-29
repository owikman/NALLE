import type { SupabaseClient } from '@supabase/supabase-js'

export type StoredEntry = {
  id: string
  company_id: string
  source_type: string
  reverses_entry_id: string | null
  lines: { account_id: string; debit: number; credit: number }[]
}

type Filter = { col: string; op: 'eq' | 'in'; val: unknown }

function matches(entry: StoredEntry, filters: Filter[]): boolean {
  const record = entry as unknown as Record<string, unknown>
  return filters.every(f => (f.op === 'eq' ? record[f.col] === f.val : (f.val as unknown[]).includes(record[f.col])))
}

class ChartOfAccountsBuilder {
  constructor(private accounts: { id: string; code: string }[]) {}
  select(): this { return this }
  eq(): this { return this }
  in(): this { return this }
  then<TResult1 = { data: { id: string; code: string }[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: { id: string; code: string }[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.accounts, error: null }).then(onfulfilled, onrejected)
  }
}

/**
 * Minimal in-memory fake standing in for the Supabase service client — just
 * enough to exercise the ledger module's exact call shapes (chart_of_accounts
 * lookup, journal_entries insert/select/single/list, journal_lines insert).
 * Not a general Supabase mock.
 */
export class JournalEntriesBuilder {
  private mode: 'insert' | 'query' = 'query'
  private insertPayload: Record<string, unknown> | null = null
  private filters: Filter[] = []
  private selectCols = '*'

  constructor(private entries: Map<string, StoredEntry>, private nextId: () => string) {}

  insert(payload: Record<string, unknown>): this { this.mode = 'insert'; this.insertPayload = payload; return this }
  select(cols: string = '*'): this { this.selectCols = cols; return this }
  eq(col: string, val: unknown): this { this.filters.push({ col, op: 'eq', val }); return this }
  in(col: string, vals: unknown[]): this { this.filters.push({ col, op: 'in', val: vals }); return this }

  async single(): Promise<{ data: { id: string; journal_lines?: StoredEntry['lines'] } | null; error: { message: string } | null }> {
    if (this.mode === 'insert' && this.insertPayload) {
      const id = this.nextId()
      const row: StoredEntry = {
        id,
        company_id: this.insertPayload.company_id as string,
        source_type: this.insertPayload.source_type as string,
        reverses_entry_id: (this.insertPayload.reverses_entry_id as string | null) ?? null,
        lines: [],
      }
      this.entries.set(id, row)
      return { data: { id }, error: null }
    }
    const found = [...this.entries.values()].find(e => matches(e, this.filters))
    if (!found) return { data: null, error: { message: 'not found' } }
    return { data: { id: found.id, journal_lines: found.lines }, error: null }
  }

  then<TResult1 = { data: Record<string, unknown>[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Record<string, unknown>[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const rows = [...this.entries.values()].filter(e => matches(e, this.filters)).map(e =>
      this.selectCols.includes('reverses_entry_id') ? { reverses_entry_id: e.reverses_entry_id } : { id: e.id }
    )
    return Promise.resolve({ data: rows, error: null }).then(onfulfilled, onrejected)
  }
}

class JournalLinesBuilder {
  private payload: { entry_id: string; account_id: string; debit: number; credit: number }[] = []

  constructor(private entries: Map<string, StoredEntry>) {}

  insert(rows: typeof this.payload): this { this.payload = rows; return this }

  then<TResult1 = { error: null }, TResult2 = never>(
    onfulfilled?: ((value: { error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    for (const row of this.payload) {
      const entry = this.entries.get(row.entry_id)
      if (entry) entry.lines.push({ account_id: row.account_id, debit: row.debit, credit: row.credit })
    }
    return Promise.resolve({ error: null }).then(onfulfilled, onrejected)
  }
}

export class FakeDb {
  entries = new Map<string, StoredEntry>()
  private counter = 1

  constructor(private accounts: { id: string; code: string }[]) {}

  from(table: string): ChartOfAccountsBuilder | JournalEntriesBuilder | JournalLinesBuilder {
    if (table === 'chart_of_accounts') return new ChartOfAccountsBuilder(this.accounts)
    if (table === 'journal_entries') return new JournalEntriesBuilder(this.entries, () => `entry-${this.counter++}`)
    if (table === 'journal_lines') return new JournalLinesBuilder(this.entries)
    throw new Error(`FakeDb: unexpected table "${table}"`)
  }
}

export function asDb(fake: FakeDb): SupabaseClient {
  return fake as unknown as SupabaseClient
}
