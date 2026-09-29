// Declarative question groups for the "Get my tase ready" wizard.
// One group = one screen; a group's answers are saved together, immediately,
// so nothing already answered is ever re-asked. Fields marked
// `blocksOpeningBalance` must be answered with a real value (not "I don't
// know") before the opening-balance journal entry can be posted — see
// src/lib/ledger/opening-balance.ts.

export type FieldType = 'text' | 'number' | 'currency' | 'boolean' | 'select' | 'date'

export interface WizardField {
  key: string
  label: string
  help?: string
  type: FieldType
  options?: { value: string; label: string }[]
  required: boolean
  unknownAllowed: boolean
  blocksOpeningBalance: boolean
}

export interface CompanyFlags {
  vat_registered: boolean
  is_salary_payer: boolean
}

export interface WizardGroup {
  key: string
  title: string
  intro?: string
  fields: WizardField[]
  /** Only show this group if the predicate returns true for the company's current profile. */
  showIf?: (company: CompanyFlags) => boolean
}

export const WIZARD_GROUPS: WizardGroup[] = [
  {
    key: 'ledger_start',
    title: 'When does your ledger start?',
    intro: "We'll use this as the starting point for every balance below — everything from this date forward is tracked transaction by transaction; everything before it is just a starting total.",
    fields: [
      {
        key: 'ledger_start_date',
        label: 'Ledger start date',
        help: "Want a balance sheet of today with the least effort? Use today's date, then answer the next few questions with today's actual figures — no history needed. Use an earlier date (company founding, or your fiscal year start) only if you want full transaction history tracked from that point.",
        type: 'date',
        required: true,
        unknownAllowed: false,
        blocksOpeningBalance: true,
      },
      {
        key: 'fiscal_year_start_month',
        label: 'Which month does your fiscal year start?',
        help: 'Most Finnish Oy companies use January.',
        type: 'select',
        options: [
          { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
          { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
          { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
          { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
        ],
        required: true,
        unknownAllowed: false,
        blocksOpeningBalance: false,
      },
    ],
  },
  {
    key: 'bank_accounts',
    title: 'Your bank balance',
    fields: [
      {
        key: 'all_transactions_via_holvi',
        label: 'Does every company payment go through Holvi?',
        help: "Doesn't affect your tase yet — this just helps us plan bank statement import later.",
        type: 'boolean',
        required: true,
        unknownAllowed: false,
        blocksOpeningBalance: false,
      },
      {
        key: 'total_bank_balance',
        label: 'Total balance across all business bank accounts, on your ledger start date',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
    ],
  },
  {
    key: 'capital_and_loans',
    title: 'Capital and owner loans',
    intro: 'Money you put into the company, or that the company owes you (or you owe it).',
    fields: [
      {
        key: 'share_capital',
        label: 'Share capital paid in when the company was founded (or later)',
        help: 'Enter 0 if none — Finnish Oy companies have had no legal minimum since 2019.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
      {
        key: 'shareholder_loan_balance',
        label: 'Does the company currently owe you money (a shareholder loan), as of your ledger start date?',
        help: 'Enter 0 if there is none. If it works the other way — you owe the company — talk to your accountant before entering a negative figure here.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
      {
        key: 'business_loans_balance',
        label: 'Any business loans or credit (from a bank, not from you) outstanding on your ledger start date?',
        help: 'Enter 0 if none.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
      {
        key: 'fixed_assets_value',
        label: 'Value of equipment, vehicles, or other fixed assets the company owns, as of your ledger start date',
        help: 'Enter 0 if none — most new companies do.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
    ],
  },
  {
    key: 'receivables_and_payables',
    title: 'Money owed to you or by you, from before NALLE',
    intro: "Invoices from before you started using NALLE that were still unpaid on your ledger start date. If you'll upload those invoices individually later, just enter the totals here for now — we'll avoid double-counting when you do.",
    fields: [
      {
        key: 'opening_receivables',
        label: 'Total unpaid customer invoices on your ledger start date',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
      {
        key: 'opening_payables',
        label: 'Total unpaid supplier bills on your ledger start date',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
    ],
  },
  {
    key: 'vat_setup',
    title: 'VAT',
    showIf: company => company.vat_registered,
    fields: [
      {
        key: 'vat_period',
        label: 'How often do you file VAT returns?',
        type: 'select',
        options: [
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'annually', label: 'Annually' },
        ],
        required: true,
        unknownAllowed: false,
        blocksOpeningBalance: false,
      },
      {
        key: 'vat_payable_opening',
        label: 'VAT you owe Vero, not yet paid, as of your ledger start date',
        help: 'Enter 0 if none, or if you\'re starting fresh right after a VAT period closed.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
      {
        key: 'vat_receivable_opening',
        label: 'VAT Vero owes you (a refund not yet received), as of your ledger start date',
        help: 'Enter 0 if none.',
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: true,
      },
    ],
  },
  {
    key: 'salary_setup',
    title: 'Salary',
    showIf: company => company.is_salary_payer,
    fields: [
      {
        key: 'typical_monthly_salary',
        label: 'Typical total monthly salary payment (all employees, net of tax)',
        help: "Used for your AI CFO's context — record actual salary payments as manual ledger entries when you make them.",
        type: 'currency',
        required: true,
        unknownAllowed: true,
        blocksOpeningBalance: false,
      },
    ],
  },
]

/**
 * Blocking keys for a company's actual visible groups only — a VAT or
 * salary question that a company never sees (because showIf excludes them)
 * must never block their tase forever. Pass the company's real flags.
 */
export function allBlockingKeys(company: CompanyFlags): string[] {
  return WIZARD_GROUPS
    .filter(g => !g.showIf || g.showIf(company))
    .flatMap(g => g.fields)
    .filter(f => f.blocksOpeningBalance)
    .map(f => f.key)
}

export function findField(questionKey: string): WizardField | undefined {
  for (const group of WIZARD_GROUPS) {
    const field = group.fields.find(f => f.key === questionKey)
    if (field) return field
  }
  return undefined
}
