'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type ReportType = 'pnl' | 'balance_sheet' | 'cash_flow'
type Mode = 'simple' | 'advanced'

const REPORT_TYPES = [
  { id: 'pnl' as ReportType, icon: '📊', title: 'Profit & Loss', desc: 'Revenue, expenses, and net profit for a period' },
  { id: 'balance_sheet' as ReportType, icon: '⚖️', title: 'Balance Sheet', desc: 'Assets, liabilities, and owner equity at a point in time' },
  { id: 'cash_flow' as ReportType, icon: '💧', title: 'Cash Flow', desc: 'How cash moved through the business over a period' },
]

// ── Simple mode: step-by-step ────────────────────────────────────────────────

interface Step {
  key: string
  question: string
  subtext?: string
  howToFind?: string
  type: 'date' | 'currency' | 'text'
  placeholder?: string
  for: ReportType[]
}

const today = new Date().toISOString().split('T')[0]!
const firstOfYear = `${new Date().getFullYear()}-01-01`

const ALL_STEPS: Step[] = [
  { key: 'period_start', question: 'What date does this report start from?', subtext: 'The first day you want the report to cover', howToFind: 'Use the start of your financial year, a quarter, or any date that makes sense for your business', type: 'date', for: ['pnl', 'cash_flow'] },
  { key: 'period_end', question: 'What date does it end?', subtext: 'The last day included in the report', howToFind: 'Usually today, or the last day of a month or quarter', type: 'date', for: ['pnl', 'cash_flow'] },
  { key: 'as_of_date', question: 'What date should the balance sheet be as of?', subtext: 'A snapshot of your finances on this exact date', howToFind: 'Usually today, or the last day of your financial year', type: 'date', for: ['balance_sheet'] },
  { key: 'extra_revenue', question: 'Any income not already tracked in NALLE? (€)', subtext: 'Leave at 0 if all your revenue is logged here', howToFind: 'Check your bank statements for cash payments, grants, or one-off income not invoiced through NALLE', type: 'currency', placeholder: '0', for: ['pnl'] },
  { key: 'extra_revenue_desc', question: 'What was this income from?', subtext: 'A short description so it shows correctly in the report', type: 'text', placeholder: 'e.g. Government grant, cash sale', for: ['pnl'] },
  { key: 'extra_expenses', question: 'Any expenses not logged in NALLE? (€)', subtext: 'Leave at 0 if all your costs are tracked here', howToFind: 'Check bank statements for business purchases made on a personal card, or cash payments', type: 'currency', placeholder: '0', for: ['pnl'] },
  { key: 'extra_expenses_desc', question: 'What were these expenses for?', subtext: 'A short description so it shows correctly in the report', type: 'text', placeholder: 'e.g. Office supplies paid in cash', for: ['pnl'] },
  { key: 'fixed_assets', question: "What's the current value of your equipment and assets? (€)", subtext: 'Machinery, vehicles, computers, furniture — at book value', howToFind: "Use the book value from your last tax return, or ask your accountant. If unsure, estimate what you could sell them for today", type: 'currency', placeholder: '0', for: ['balance_sheet'] },
  { key: 'other_assets', question: 'Any other assets to include? (€)', subtext: 'Inventory, deposits, prepaid expenses — leave at 0 if none', howToFind: "Check if you have paid-in-advance costs like insurance, rent deposits, or stock you haven't sold yet", type: 'currency', placeholder: '0', for: ['balance_sheet'] },
  { key: 'loans', question: 'How much do you owe in loans and credit? (€)', howToFind: 'Log in to your bank and add up all outstanding loan balances, overdraft, and hire purchase agreements', type: 'currency', placeholder: '0', for: ['balance_sheet'] },
  { key: 'other_liabilities', question: 'Any other money you owe? (€)', subtext: 'Unpaid tax, accrued costs — leave at 0 if unsure', howToFind: "Check OmaVero for any outstanding tax debt, and any supplier invoices you haven't paid yet", type: 'currency', placeholder: '0', for: ['balance_sheet'] },
  { key: 'owner_equity', question: "How much of your own money have you put into the business? (€)", howToFind: "This is the capital you invested when starting the business, plus any additional money you've put in since", type: 'currency', placeholder: '0', for: ['balance_sheet'] },
  { key: 'asset_purchases', question: 'Did you buy any equipment or assets during this period? (€)', subtext: 'Leave at 0 if none', howToFind: 'Look for large one-off purchases in your bank statements — computers, vehicles, machinery', type: 'currency', placeholder: '0', for: ['cash_flow'] },
  { key: 'asset_sales', question: 'Did you sell any business assets? (€)', subtext: 'Leave at 0 if none', howToFind: 'Any equipment, vehicles, or property you sold during this period', type: 'currency', placeholder: '0', for: ['cash_flow'] },
  { key: 'loans_received', question: 'Did you receive any loans or external funding? (€)', subtext: 'Leave at 0 if none', howToFind: 'Check your bank for large credit transfers from banks or investors', type: 'currency', placeholder: '0', for: ['cash_flow'] },
  { key: 'loans_repaid', question: 'How much did you repay on loans? (€)', subtext: 'Leave at 0 if none', howToFind: 'Add up all loan repayment transactions from your bank statements for this period', type: 'currency', placeholder: '0', for: ['cash_flow'] },
  { key: 'owner_drawings', question: 'Did you withdraw money from the business for personal use? (€)', subtext: 'Leave at 0 if none', howToFind: 'For toiminimi: transfers to your personal bank account. For OY: dividends paid to yourself', type: 'currency', placeholder: '0', for: ['cash_flow'] },
]

const DEFAULTS: Record<string, string> = {
  period_start: firstOfYear,
  period_end: today,
  as_of_date: today,
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
  const [mode, setMode] = useState<Mode | null>(null)

  // Simple mode state
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>(DEFAULTS)
  const [current, setCurrent] = useState<string>('')

  // Advanced mode state
  const [adv, setAdv] = useState<Record<string, string>>(DEFAULTS)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = type ? ALL_STEPS.filter(s => s.for.includes(type)) : []
  const currentStep = steps[step]

  function pickType(chosen: ReportType) {
    setType(chosen)
    setMode(null)
    setStep(0)
    setAnswers(DEFAULTS)
    setAdv(DEFAULTS)
    setError(null)
  }

  function pickMode(chosen: Mode) {
    setMode(chosen)
    if (chosen === 'simple') {
      const firstKey = (type ? ALL_STEPS.filter(s => s.for.includes(type)) : [])[0]?.key ?? ''
      setCurrent(answers[firstKey] ?? DEFAULTS[firstKey] ?? '')
    }
    setError(null)
  }

  // ── Simple navigation ────────────────────────────────────────────────────
  function handleNext() {
    if (!currentStep) return
    const committed = { ...answers, [currentStep.key]: current }
    setAnswers(committed)
    if (step < steps.length - 1) {
      const nextStep = steps[step + 1]!
      setCurrent(committed[nextStep.key] ?? DEFAULTS[nextStep.key] ?? '')
      setStep(s => s + 1)
    } else {
      submit(committed)
    }
  }

  function handleBack() {
    if (step === 0) { setMode(null); return }
    const prevStep = steps[step - 1]!
    setAnswers(a => ({ ...a, [currentStep!.key]: current }))
    setCurrent(answers[prevStep.key] ?? DEFAULTS[prevStep.key] ?? '')
    setStep(s => s - 1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleNext() }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
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
              style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '1px solid #f0f0f0', borderRadius: 16, padding: '22px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}
            >
              <span style={{ fontSize: 28 }}>{r.icon}</span>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{r.title}</p>
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

  // ── Mode picker ──────────────────────────────────────────────────────────
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

  // ── Simple wizard ────────────────────────────────────────────────────────
  if (mode === 'simple') {
    if (!currentStep) return null
    const progress = (step / steps.length) * 100
    const isLast = step === steps.length - 1

    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={handleBack} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 2 }}>{selectedType.icon} {selectedType.title}</p>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>Step {step + 1} of {steps.length}</p>
          </div>
        </div>

        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 99, marginBottom: 28, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#2563eb', borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s ease' }} />
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

          {currentStep.howToFind && (
            <div style={{ marginTop: 14, background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>💡 How to find this</p>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{currentStep.howToFind}</p>
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: '#dc2626', marginTop: 12 }}>{error}</p>}

          <button onClick={handleNext} disabled={loading}
            style={{ marginTop: 28, width: '100%', background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><span style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> Creating report...</> : isLast ? `Create ${selectedType.title} →` : 'Continue →'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 99, background: i === step ? '#2563eb' : i < step ? '#93c5fd' : '#e5e7eb', transition: 'all 0.25s ease' }} />
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 16 }}>
          Your revenue, expenses, and bank data from NALLE are included automatically
        </p>
      </div>
    )
  }

  // ── Advanced form ────────────────────────────────────────────────────────
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
