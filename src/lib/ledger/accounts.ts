// Chart-of-accounts codes seeded by seed_default_chart_of_accounts() in
// supabase/migrations/007_ledger_core.sql. Keep these in sync with that
// migration — the posting engine resolves lines by code, per company.

export const ACCOUNTS = {
  BANK: '1910',
  ACCOUNTS_RECEIVABLE: '1700',
  VAT_RECEIVABLE: '1763',
  FIXED_ASSETS: '1100',
  ACCOUNTS_PAYABLE: '2870',
  VAT_PAYABLE: '2939',
  LOANS_PAYABLE: '2620',
  OWNER_CURRENT_ACCOUNT: '2650',
  SHARE_CAPITAL: '2001',
  RETAINED_EARNINGS: '2061',
  REVENUE: '3000',
  SALARY_EXPENSE: '4000',
} as const

// Mirrors the expense_category enum in supabase/migrations/001_initial_schema.sql
export const EXPENSE_CATEGORY_ACCOUNT_CODE: Record<string, string> = {
  vehicle: '4100',
  equipment: '4200',
  travel: '4300',
  software: '4400',
  personnel: '4500',
  other: '4900',
}

export function expenseAccountCode(category: string): string {
  return EXPENSE_CATEGORY_ACCOUNT_CODE[category] ?? EXPENSE_CATEGORY_ACCOUNT_CODE.other!
}
