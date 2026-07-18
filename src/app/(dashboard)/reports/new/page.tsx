'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type ReportType = 'pnl' | 'balance_sheet' | 'cash_flow' | 'form_6b'
type Mode = 'simple' | 'advanced'

const REPORT_TYPES = [
  { id: 'pnl' as ReportType,           icon: '📊', title: 'Profit & Loss',    desc: 'Revenue, expenses, and net profit for a period' },
  { id: 'balance_sheet' as ReportType, icon: '⚖️', title: 'Balance Sheet',    desc: 'Assets, liabilities, and owner equity at a point in time' },
  { id: 'cash_flow' as ReportType,     icon: '💧', title: 'Cash Flow',        desc: 'How cash moved through the business over a period' },
  { id: 'form_6b' as ReportType,       icon: '🏛️', title: '6B Veroilmoitus', desc: 'Finnish corporate income tax return — for OY and cooperatives' },
]

interface Step {
  key: string
  question: string
  subtext?: string
  howToFind?: string
  type: 'date' | 'currency' | 'text' | 'number'
  placeholder?: string
  for: ReportType[]
}

const today = new Date().toISOString().split('T')[0]!
const firstOfYear = `${new Date().getFullYear()}-01-01`
const lastYearStart = `${new Date().getFullYear() - 1}-01-01`
const lastYearEnd   = `${new Date().getFullYear() - 1}-12-31`

const ALL_STEPS: Step[] = [
  // ── P&L / Cash Flow ──────────────────────────────────────────────────────
  { key: 'period_start',     type: 'date',     question: 'What date does this report start from?',                                subtext: 'The first day you want the report to cover',                         howToFind: 'Use the start of your financial year, a quarter, or any date that makes sense for your business',                                                                                                 for: ['pnl', 'cash_flow'] },
  { key: 'period_end',       type: 'date',     question: 'What date does it end?',                                                subtext: 'The last day included in the report',                                howToFind: 'Usually today, or the last day of a month or quarter',                                                                                                                                           for: ['pnl', 'cash_flow'] },
  { key: 'as_of_date',       type: 'date',     question: 'What date should the balance sheet be as of?',                          subtext: 'A snapshot of your finances on this exact date',                    howToFind: 'Usually today, or the last day of your financial year',                                                                                                                                          for: ['balance_sheet'] },
  { key: 'extra_revenue',    type: 'currency', question: 'Any income not already tracked in NALLE? (€)',                          subtext: 'Leave at 0 if all your revenue is logged here',                     howToFind: 'Check your bank statements for cash payments, grants, or one-off income not invoiced through NALLE',                                         placeholder: '0',                                   for: ['pnl'] },
  { key: 'extra_revenue_desc', type: 'text',   question: 'What was this income from?',                                            subtext: 'A short description so it shows correctly in the report',           placeholder: 'e.g. Government grant, cash sale',                                                                                                                                                     for: ['pnl'] },
  { key: 'extra_expenses',   type: 'currency', question: 'Any expenses not logged in NALLE? (€)',                                 subtext: 'Leave at 0 if all your costs are tracked here',                     howToFind: 'Check bank statements for business purchases made on a personal card, or cash payments',                                                    placeholder: '0',                                   for: ['pnl'] },
  { key: 'extra_expenses_desc', type: 'text',  question: 'What were these expenses for?',                                         subtext: 'A short description so it shows correctly in the report',           placeholder: 'e.g. Office supplies paid in cash',                                                                                                                                                    for: ['pnl'] },
  { key: 'fixed_assets',     type: 'currency', question: "What's the current value of your equipment and assets? (€)",            subtext: 'Machinery, vehicles, computers, furniture — at book value',         howToFind: "Use the book value from your last tax return, or ask your accountant. If unsure, estimate what you could sell them for today",                placeholder: '0',                                   for: ['balance_sheet'] },
  { key: 'other_assets',     type: 'currency', question: 'Any other assets to include? (€)',                                      subtext: 'Inventory, deposits, prepaid expenses — leave at 0 if none',        howToFind: "Check if you have paid-in-advance costs like insurance, rent deposits, or stock you haven't sold yet",                                       placeholder: '0',                                   for: ['balance_sheet'] },
  { key: 'loans',            type: 'currency', question: 'How much do you owe in loans and credit? (€)',                          howToFind: 'Log in to your bank and add up all outstanding loan balances, overdraft, and hire purchase agreements',                                                                                                                                                                 placeholder: '0', for: ['balance_sheet'] },
  { key: 'other_liabilities', type: 'currency', question: 'Any other money you owe? (€)',                                         subtext: 'Unpaid tax, accrued costs — leave at 0 if unsure',                  howToFind: "Check OmaVero for any outstanding tax debt, and any supplier invoices you haven't paid yet",                                                  placeholder: '0',                                   for: ['balance_sheet'] },
  { key: 'owner_equity',     type: 'currency', question: "How much of your own money have you put into the business? (€)",        howToFind: "This is the capital you invested when starting the business, plus any additional money you've put in since",                                                                                                                                                           placeholder: '0', for: ['balance_sheet'] },
  { key: 'asset_purchases',  type: 'currency', question: 'Did you buy any equipment or assets during this period? (€)',           subtext: 'Leave at 0 if none',                                                howToFind: 'Look for large one-off purchases in your bank statements — computers, vehicles, machinery',                                                  placeholder: '0',                                   for: ['cash_flow'] },
  { key: 'asset_sales',      type: 'currency', question: 'Did you sell any business assets? (€)',                                 subtext: 'Leave at 0 if none',                                                howToFind: 'Any equipment, vehicles, or property you sold during this period',                                                                         placeholder: '0',                                   for: ['cash_flow'] },
  { key: 'loans_received',   type: 'currency', question: 'Did you receive any loans or external funding? (€)',                    subtext: 'Leave at 0 if none',                                                howToFind: 'Check your bank for large credit transfers from banks or investors',                                                                        placeholder: '0',                                   for: ['cash_flow'] },
  { key: 'loans_repaid',     type: 'currency', question: 'How much did you repay on loans? (€)',                                  subtext: 'Leave at 0 if none',                                                howToFind: 'Add up all loan repayment transactions from your bank statements for this period',                                                          placeholder: '0',                                   for: ['cash_flow'] },
  { key: 'owner_drawings',   type: 'currency', question: 'Did you withdraw money from the business for personal use? (€)',        subtext: 'Leave at 0 if none',                                                howToFind: 'For toiminimi: transfers to your personal bank account. For OY: dividends paid to yourself',                                                  placeholder: '0',                                   for: ['cash_flow'] },

  // ── 6B Veroilmoitus ──────────────────────────────────────────────────────
  { key: 'ytunnus',          type: 'text',     question: 'Y-tunnus (Business ID)',                                                subtext: "Your company's Finnish Business ID",                                 howToFind: 'Find it at ytj.fi, on your trade register extract, or any official tax document',                                                                placeholder: '1234567-8',                            for: ['form_6b'] },
  { key: 'period_start',     type: 'date',     question: 'Tilikauden alkupäivä',                                                  subtext: 'First day of the accounting period',                                howToFind: 'Typically 1.1. of the fiscal year',                                                                                                                                                             for: ['form_6b'] },
  { key: 'period_end',       type: 'date',     question: 'Tilikauden loppupäivä',                                                 subtext: 'Last day of the accounting period',                                 howToFind: 'Typically 31.12. of the fiscal year',                                                                                                                                                           for: ['form_6b'] },
  { key: 'net_sales_extra',  type: 'currency', question: 'Lisätulot NALLE:n ulkopuolelta (€)',                                    subtext: 'Revenue NOT in NALLE — cash sales, direct transfers. Leave 0 if all income is tracked', howToFind: 'Check your bank statements for payments not linked to any NALLE invoice',                                                               placeholder: '0',                                   for: ['form_6b'] },
  { key: 'other_income',     type: 'currency', question: 'Muut liiketoiminnan tuotot — kenttä 310 (€)',                           subtext: 'Government grants, asset sale gains. Leave 0 if none',             howToFind: 'Business Finland grants, subsidies, gains from selling fixed assets during the period',                                                      placeholder: '0',                                   for: ['form_6b'] },
  { key: 'wages',            type: 'currency', question: 'Palkat ja henkilöstökulut yhteensä — kenttä 320 (€)',                   subtext: 'Total staff costs including employer social security. Leave 0 if none', howToFind: "All salaries paid + employer's TyEL + social security contributions. Get from your payroll records or accounting system.",                placeholder: '0',                                   for: ['form_6b'] },
  { key: 'depreciation',     type: 'currency', question: 'Suunnitelman mukaiset poistot — kenttä 340 (€)',                        subtext: 'Planned depreciation on fixed assets. Leave 0 if none',             howToFind: 'Find "poistot" in your P&L. If you have no fixed assets or have not done depreciation yet, enter 0.',                                        placeholder: '0',                                   for: ['form_6b'] },
  { key: 'entertainment',    type: 'currency', question: 'Edustuskulut (koko määrä) — kenttä 352 (€)',                            subtext: 'Client entertainment expenses — enter full amount, only 50% is deductible', howToFind: 'Client dinners, corporate gifts, event tickets for clients. Enter the total — NALLE calculates the 50% deduction automatically.',      placeholder: '0',                                   for: ['form_6b'] },
  { key: 'interest_expense', type: 'currency', question: 'Korkokulut — kenttä 360 (€)',                                           subtext: 'Interest paid on business loans. Leave 0 if no loans',              howToFind: 'Find loan interest charges in your bank statements. Do NOT include principal repayments — only the interest portion.',                        placeholder: '0',                                   for: ['form_6b'] },
  { key: 'prev_losses',      type: 'currency', question: 'Aiemmilta vuosilta vahvistetut tappiot (€)',                            subtext: 'Confirmed carry-forward losses from previous tax years. Leave 0 if none', howToFind: 'Check your previous verotuspäätös in OmaVero under "vahvistetut tappiot". These are losses the tax authority has confirmed.',           placeholder: '0',                                   for: ['form_6b'] },
  { key: 'fixed_assets',     type: 'currency', question: 'Käyttöomaisuus kirjanpitoarvo — kenttä 620 (€)',                        subtext: 'Net book value of fixed assets at the end of the period. Leave 0 if none', howToFind: 'From your balance sheet: machinery, equipment, vehicles after subtracting accumulated depreciation.',                                      placeholder: '0',                                   for: ['form_6b'] },
  { key: 'inventory',        type: 'currency', question: 'Vaihto-omaisuus — kenttä 660 (€)',                                      subtext: 'Stock, raw materials, work-in-progress. Leave 0 for service businesses', howToFind: 'Value of unsold goods or raw materials. Most service businesses enter 0 here.',                                                           placeholder: '0',                                   for: ['form_6b'] },
  { key: 'bank_balance',     type: 'currency', question: 'Rahat ja pankkisaamiset tilikauden lopussa (€)',                            subtext: 'Total cash and bank balance on the last day of the accounting period',  howToFind: 'Log in to your business bank account and check the balance on the last day of the period (e.g. 31.12.).',                                 placeholder: '0',                                   for: ['form_6b'] },
  { key: 'receivables',      type: 'currency', question: 'Myyntisaamiset tilikauden lopussa (€)',                                     subtext: 'Unpaid customer invoices at the end of the period. Leave 0 if none',   howToFind: 'Sum of all sent invoices that were still unpaid on the last day of the period.',                                                           placeholder: '0',                                   for: ['form_6b'] },
  { key: 'accounts_payable', type: 'currency', question: 'Ostovelat tilikauden lopussa (€)',                                          subtext: 'Unpaid supplier invoices at the end of the period. Leave 0 if none',   howToFind: 'Sum of all received invoices that were still unpaid on the last day of the period.',                                                        placeholder: '0',                                   for: ['form_6b'] },
  { key: 'loans',            type: 'currency', question: 'Korolliset velat yhteensä — kenttä 730 (€)',                            subtext: 'Total business loans and credit (excluding accounts payable). Leave 0 if none', howToFind: 'Bank loans + credit lines + hire purchase balances. Log in to your bank to check outstanding balances.',                            placeholder: '0',                                   for: ['form_6b'] },
  { key: 'share_capital',    type: 'currency', question: 'Osakepääoma — kenttä 760 (€)',                                          subtext: 'Registered share capital of the company',                           howToFind: 'Find in your kaupparekisteriote (trade register extract) at ytj.fi. There has been no legal minimum since the 2019 reform — enter whatever your company’s registered share capital actually is.',                                     placeholder: '0',                                for: ['form_6b'] },
  { key: 'sh1_name',         type: 'text',     question: 'Osakkaan 1 nimi',                                                       subtext: 'Full name of the primary shareholder',                              placeholder: 'Matti Meikäläinen',                                                                                                                                                                            for: ['form_6b'] },
  { key: 'sh1_id',           type: 'text',     question: 'Osakkaan 1 henkilötunnus tai Y-tunnus',                                 subtext: 'Personal ID (hetu) or Business ID of this shareholder',             howToFind: 'Personal identity code format: DDMMYY-XXXX (e.g. 010190-123A)',                                                                                   placeholder: '010190-123A',                         for: ['form_6b'] },
  { key: 'sh1_shares',       type: 'number',   question: 'Osakkaan 1 osakkeiden lukumäärä',                                       subtext: 'Number of shares owned by this shareholder',                        placeholder: '100',                                                                                                                                                                                         for: ['form_6b'] },
  { key: 'total_shares',     type: 'number',   question: 'Osakkeiden kokonaismäärä',                                              subtext: 'Total number of shares in the company (all shareholders combined)', placeholder: '100',                                                                                                                                                                                         for: ['form_6b'] },
  { key: 'dividends_paid',   type: 'currency', question: 'Maksetut osingot tilikauden aikana (€)',                                subtext: 'Total gross dividends distributed during this period. Leave 0 if none', howToFind: 'The total dividend amount decided and paid during this accounting period. Check your board meeting minutes.',                               placeholder: '0',                                   for: ['form_6b'] },
]

const DEFAULTS: Record<string, string> = {
  period_start: firstOfYear, period_end: today, as_of_date: today,
}

const SIX_B_DEFAULTS: Record<string, string> = {
  period_start: lastYearStart, period_end: lastYearEnd,
  net_sales_extra: '0', other_income: '0', wages: '0', depreciation: '0',
  entertainment: '0', interest_expense: '0', prev_losses: '0',
  fixed_assets: '0', inventory: '0', bank_balance: '0', receivables: '0', accounts_payable: '0', loans: '0', share_capital: '0',
  sh1_shares: '100', total_shares: '100', dividends_paid: '0',
}

const inputStyle = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12,
  padding: '13px 16px', fontSize: 15, outline: 'none',
  boxSizing: 'border-box' as const, color: '#111827', background: 'white',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 } as const
const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as const

function num(val: string, onChange: (v: string) => void) {
  return <input type="number" min="0" step="0.01" value={val} onChange={e => onChange(e.target.value)} placeholder="0.00" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
}
function txt(val: string, onChange: (v: string) => void, placeholder = '') {
  return <input type="text" value={val} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
}
function dateInput(val: string, onChange: (v: string) => void) {
  return <input type="date" value={val} onChange={e => onChange(e.target.value)} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
}

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preType = searchParams.get('type') as ReportType | null

  const [type, setType] = useState<ReportType | null>(preType)
  const [mode, setMode] = useState<Mode | null>(preType === 'form_6b' ? 'simple' : null)

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(preType === 'form_6b' ? SIX_B_DEFAULTS : DEFAULTS)
  const [current, setCurrent] = useState<string>('')

  const [adv, setAdv] = useState<Record<string, string>>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = type ? ALL_STEPS.filter(s => s.for.includes(type)) : []
  const currentStep = steps[step]

  function pickType(chosen: ReportType) {
    const is6b = chosen === 'form_6b'
    const defs = is6b ? SIX_B_DEFAULTS : DEFAULTS
    setType(chosen)
    setMode(is6b ? 'simple' : null)
    setStep(0)
    setAnswers(defs)
    setAdv(defs)
    setError(null)
    if (is6b) {
      const first = ALL_STEPS.filter(s => s.for.includes('form_6b'))[0]
      setCurrent(defs[first?.key ?? ''] ?? first?.placeholder ?? '')
    }
  }

  function pickMode(chosen: Mode) {
    setMode(chosen)
    if (chosen === 'simple') {
      const firstKey = (type ? ALL_STEPS.filter(s => s.for.includes(type)) : [])[0]?.key ?? ''
      setCurrent(answers[firstKey] ?? DEFAULTS[firstKey] ?? '')
    }
    setError(null)
  }

  function handleNext() {
    if (!currentStep) return
    const committed = { ...answers, [currentStep.key]: current }
    setAnswers(committed)
    if (step < steps.length - 1) {
      const nextStep = steps[step + 1]!
      const defs = type === 'form_6b' ? SIX_B_DEFAULTS : DEFAULTS
      setCurrent(committed[nextStep.key] ?? defs[nextStep.key] ?? nextStep.placeholder ?? '')
      setStep(s => s + 1)
    } else {
      submit(committed)
    }
  }

  function handleBack() {
    if (step === 0) {
      if (type === 'form_6b') { setType(null); setMode(null) }
      else { setMode(null) }
      return
    }
    const defs = type === 'form_6b' ? SIX_B_DEFAULTS : DEFAULTS
    const prevStep = steps[step - 1]!
    setAnswers(a => ({ ...a, [currentStep!.key]: current }))
    setCurrent(answers[prevStep.key] ?? defs[prevStep.key] ?? prevStep.placeholder ?? '')
    setStep(s => s - 1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleNext() }
  }

  async function submit(finalAnswers: Record<string, string>) {
    if (!type) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, answers: finalAnswers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create report')
      router.push(`/reports/${json.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // ── Type picker ──────────────────────────────────────────────────────────
  if (!type) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Create report</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Choose which report to create</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => pickType(r.id)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: r.id === 'form_6b' ? '2px solid #dbeafe' : '1px solid #f0f0f0', borderRadius: 16, padding: '22px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = r.id === 'form_6b' ? '#dbeafe' : '#f0f0f0')}
            >
              <span style={{ fontSize: 28 }}>{r.icon}</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{r.title}</p>
                  {r.id === 'form_6b' && <span style={{ fontSize: 10, fontWeight: 700, background: '#eff6ff', color: '#2563eb', borderRadius: 99, padding: '2px 8px', letterSpacing: '0.05em' }}>OY / OSUUSKUNTA</span>}
                </div>
                <p style={{ fontSize: 14, color: '#9ca3af' }}>{r.desc}</p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 18, alignSelf: 'center' }}>→</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const selectedType = REPORT_TYPES.find(r => r.id === type)!

  // ── Mode picker (skip for form_6b) ───────────────────────────────────────
  if (!mode) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => setType(null)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{selectedType.icon} {selectedType.title}</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>How would you like to create it?</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={() => pickMode('simple')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '2px solid #f0f0f0', borderRadius: 16, padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🧭</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Simple</p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>I'll ask you one question at a time in plain language. If you're not sure where to find a number, I'll tell you.</p>
            </div>
          </button>
          <button onClick={() => pickMode('advanced')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '2px solid #f0f0f0', borderRadius: 16, padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📝</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Advanced</p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>Fill in all the numbers yourself on one screen. Best if you already have your figures ready.</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Simple wizard (all types, including form_6b) ─────────────────────────
  if (mode === 'simple') {
    if (!currentStep) return null
    const progress = ((step + 1) / steps.length) * 100
    const isLast = step === steps.length - 1
    const is6b = type === 'form_6b'

    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={handleBack} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>{selectedType.icon} {selectedType.title}</p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Kysymys {step + 1} / {steps.length}</p>
          </div>
        </div>

        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: is6b ? '#2563eb' : '#2563eb', borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '36px 32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: currentStep.subtext ? 8 : 24, lineHeight: 1.4 }}>
            {currentStep.question}
          </h2>
          {currentStep.subtext && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{currentStep.subtext}</p>
          )}

          {currentStep.type === 'date' && (
            <input type="date" value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={handleKeyDown}
              style={{ ...inputStyle, fontSize: 16 }} onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} autoFocus />
          )}
          {currentStep.type === 'currency' && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 16, pointerEvents: 'none' }}>€</span>
              <input type="number" min="0" step="0.01" value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={currentStep.placeholder ?? '0'} style={{ ...inputStyle, paddingLeft: 32, fontSize: 16 }}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} autoFocus />
            </div>
          )}
          {currentStep.type === 'text' && (
            <input type="text" value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={currentStep.placeholder ?? ''} style={{ ...inputStyle, fontSize: 16 }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} autoFocus />
          )}
          {currentStep.type === 'number' && (
            <input type="number" min="0" step="1" value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={currentStep.placeholder ?? '0'} style={{ ...inputStyle, fontSize: 16 }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} autoFocus />
          )}

          {currentStep.howToFind && (
            <div style={{ marginTop: 14, background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💡 {is6b ? 'Mistä löydät tämän' : 'How to find this'}</p>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{currentStep.howToFind}</p>
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 12 }}>{error}</p>}

          <button onClick={handleNext} disabled={loading}
            style={{ marginTop: 28, width: '100%', background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading
              ? <><span style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> {is6b ? 'Luodaan...' : 'Creating report...'}</>
              : isLast
                ? is6b ? 'Luo 6B veroilmoitus →' : `Create ${selectedType.title} →`
                : 'Jatka →'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 99, background: i === step ? '#2563eb' : i < step ? '#93c5fd' : '#e5e7eb', transition: 'all 0.25s ease' }} />
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 16 }}>
          {is6b ? 'Tulo- ja kulutiedot haetaan automaattisesti NALLE:sta' : 'Your revenue, expenses, and bank data from NALLE are included automatically'}
        </p>
      </div>
    )
  }

  // ── Advanced form (P&L, Balance Sheet, Cash Flow only) ───────────────────
  function setA(key: string, val: string) { setAdv(a => ({ ...a, [key]: val })) }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => setMode(null)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{selectedType.icon} {selectedType.title}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Fill in your figures</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {type === 'balance_sheet' ? (
          <div><label style={labelStyle}>As of date</label>{dateInput(adv.as_of_date ?? today, v => setA('as_of_date', v))}</div>
        ) : (
          <div>
            <label style={labelStyle}>Reporting period</label>
            <div style={rowStyle}>
              <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>From</label>{dateInput(adv.period_start ?? firstOfYear, v => setA('period_start', v))}</div>
              <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>To</label>{dateInput(adv.period_end ?? today, v => setA('period_end', v))}</div>
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />

        {type === 'pnl' && (
          <>
            <div>
              <label style={labelStyle}>Additional revenue not logged in NALLE (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>e.g. cash sales, grants — leave 0 if none</p>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Amount</label>{num(adv.extra_revenue ?? '', v => setA('extra_revenue', v))}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Description</label>{txt(adv.extra_revenue_desc ?? '', v => setA('extra_revenue_desc', v), 'e.g. Grant income')}</div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Additional expenses not logged in NALLE (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>e.g. cash payments, personal card — leave 0 if none</p>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Amount</label>{num(adv.extra_expenses ?? '', v => setA('extra_expenses', v))}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Description</label>{txt(adv.extra_expenses_desc ?? '', v => setA('extra_expenses_desc', v), 'e.g. Office supplies')}</div>
              </div>
            </div>
          </>
        )}

        {type === 'balance_sheet' && (
          <>
            <div><label style={labelStyle}>Fixed assets — current value (€)</label><p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Equipment, machinery, vehicles, computers at book value</p>{num(adv.fixed_assets ?? '', v => setA('fixed_assets', v))}</div>
            <div><label style={labelStyle}>Other assets (€)</label><p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Inventory, prepaid expenses, deposits — leave 0 if none</p>{num(adv.other_assets ?? '', v => setA('other_assets', v))}</div>
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />
            <div><label style={labelStyle}>Loans & credit outstanding (€)</label><p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Bank loans, business credit lines, leases</p>{num(adv.loans ?? '', v => setA('loans', v))}</div>
            <div><label style={labelStyle}>Other liabilities (€)</label><p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Unpaid taxes, accrued expenses — leave 0 if none</p>{num(adv.other_liabilities ?? '', v => setA('other_liabilities', v))}</div>
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />
            <div><label style={labelStyle}>Owner's equity investment (€)</label><p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Capital you've put into the business</p>{num(adv.owner_equity ?? '', v => setA('owner_equity', v))}</div>
          </>
        )}

        {type === 'cash_flow' && (
          <>
            <div>
              <label style={labelStyle}>Investing activities</label>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Asset purchases (€)</label>{num(adv.asset_purchases ?? '', v => setA('asset_purchases', v))}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Asset sales (€)</label>{num(adv.asset_sales ?? '', v => setA('asset_sales', v))}</div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Financing activities</label>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Loans received (€)</label>{num(adv.loans_received ?? '', v => setA('loans_received', v))}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Loans repaid (€)</label>{num(adv.loans_repaid ?? '', v => setA('loans_repaid', v))}</div>
              </div>
              <div style={{ marginTop: 16 }}><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Owner drawings (€)</label>{num(adv.owner_drawings ?? '', v => setA('owner_drawings', v))}</div>
            </div>
          </>
        )}

        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          💡 Your revenue, expenses, and bank data already saved in NALLE will be included automatically.
        </div>

        <button onClick={() => submit(adv)} disabled={loading}
          style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Creating report...' : `Create ${selectedType.title} →`}
        </button>
      </div>
    </div>
  )
}

export default function NewReportPage() {
  return (
    <Suspense>
      <NewReportForm />
    </Suspense>
  )
}
