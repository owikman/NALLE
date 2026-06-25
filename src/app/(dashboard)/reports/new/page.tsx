'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type ReportType = 'pnl' | 'balance_sheet' | 'cash_flow'

const REPORT_TYPES = [
  {
    id: 'pnl' as ReportType,
    icon: '📊',
    title: 'Profit & Loss',
    desc: 'Revenue, expenses, and net profit for a period',
  },
  {
    id: 'balance_sheet' as ReportType,
    icon: '⚖️',
    title: 'Balance Sheet',
    desc: 'Assets, liabilities, and owner equity at a point in time',
  },
  {
    id: 'cash_flow' as ReportType,
    icon: '💧',
    title: 'Cash Flow',
    desc: 'How cash moved through the business over a period',
  },
]

const inputStyle = {
  width: '100%', border: '1px solid #e5e7eb', borderRadius: 12,
  padding: '13px 16px', fontSize: 15, outline: 'none',
  boxSizing: 'border-box' as const, color: '#111827', background: 'white',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 } as const
const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } as const

interface Answers {
  // shared
  period_start: string
  period_end: string
  as_of_date: string
  // P&L
  extra_revenue: string
  extra_revenue_desc: string
  extra_expenses: string
  extra_expenses_desc: string
  // Balance sheet
  fixed_assets: string
  other_assets: string
  loans: string
  other_liabilities: string
  owner_equity: string
  // Cash flow
  asset_purchases: string
  asset_sales: string
  loans_received: string
  loans_repaid: string
  owner_drawings: string
}

const today = new Date().toISOString().split('T')[0]!
const firstOfYear = `${new Date().getFullYear()}-01-01`

const EMPTY: Answers = {
  period_start: firstOfYear, period_end: today, as_of_date: today,
  extra_revenue: '', extra_revenue_desc: '', extra_expenses: '', extra_expenses_desc: '',
  fixed_assets: '', other_assets: '', loans: '', other_liabilities: '', owner_equity: '',
  asset_purchases: '', asset_sales: '', loans_received: '', loans_repaid: '', owner_drawings: '',
}

function NewReportForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preType = searchParams.get('type') as ReportType | null
  const [type, setType] = useState<ReportType | null>(preType)
  const [answers, setAnswers] = useState<Answers>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof Answers, val: string) {
    setAnswers(a => ({ ...a, [key]: val }))
  }

  function num(key: keyof Answers) {
    return <input type="number" min="0" step="0.01" value={answers[key]} onChange={e => set(key, e.target.value)} placeholder="0.00" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
  }

  function txt(key: keyof Answers, placeholder = '') {
    return <input type="text" value={answers[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
  }

  function date(key: keyof Answers) {
    return <input type="date" value={answers[key]} onChange={e => set(key, e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
  }

  async function handleCreate() {
    if (!type) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/reports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, answers }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create report')
      router.push(`/reports/${json.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  // ── Step 1: pick type ────────────────────────────────────────────────────
  if (!type) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Create report</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Choose which report to create</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {REPORT_TYPES.map(r => (
            <button key={r.id} onClick={() => setType(r.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '1px solid #f0f0f0', borderRadius: 16, padding: '22px 24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
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

  const selected = REPORT_TYPES.find(r => r.id === type)!

  // ── Step 2: type-specific questions ─────────────────────────────────────
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => setType(null)} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{selected.icon} {selected.title}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Answer a few questions and we'll create the report</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Period / date */}
        {type === 'balance_sheet' ? (
          <div>
            <label style={labelStyle}>As of date</label>
            {date('as_of_date')}
          </div>
        ) : (
          <div>
            <label style={labelStyle}>Reporting period</label>
            <div style={rowStyle}>
              <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>From</label>{date('period_start')}</div>
              <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>To</label>{date('period_end')}</div>
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />

        {/* P&L extras */}
        {type === 'pnl' && (
          <>
            <div>
              <label style={labelStyle}>Additional revenue not logged in NALLE (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>e.g. cash sales, grants, one-off payments — leave 0 if none</p>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Amount</label>{num('extra_revenue')}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Description</label>{txt('extra_revenue_desc', 'e.g. Grant income')}</div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Additional expenses not logged in NALLE (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>e.g. cash payments, personal card purchases — leave 0 if none</p>
              <div style={rowStyle}>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Amount</label>{num('extra_expenses')}</div>
                <div><label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Description</label>{txt('extra_expenses_desc', 'e.g. Office supplies')}</div>
              </div>
            </div>
          </>
        )}

        {/* Balance sheet extras */}
        {type === 'balance_sheet' && (
          <>
            <div>
              <label style={labelStyle}>Fixed assets — current value (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Equipment, machinery, vehicles, computers at current book value</p>
              {num('fixed_assets')}
            </div>
            <div>
              <label style={labelStyle}>Other assets (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Inventory, prepaid expenses, deposits — leave 0 if none</p>
              {num('other_assets')}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />
            <div>
              <label style={labelStyle}>Loans & credit outstanding (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Bank loans, business credit lines, leases</p>
              {num('loans')}
            </div>
            <div>
              <label style={labelStyle}>Other liabilities (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Unpaid taxes, accrued expenses — leave 0 if none</p>
              {num('other_liabilities')}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6' }} />
            <div>
              <label style={labelStyle}>Owner's equity investment (€)</label>
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Capital you've put into the business</p>
              {num('owner_equity')}
            </div>
          </>
        )}

        {/* Cash flow extras */}
        {type === 'cash_flow' && (
          <>
            <div>
              <label style={labelStyle}>Investing activities</label>
              <div style={rowStyle}>
                <div>
                  <label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Equipment/asset purchases (€)</label>
                  {num('asset_purchases')}
                </div>
                <div>
                  <label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Asset sales received (€)</label>
                  {num('asset_sales')}
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Financing activities</label>
              <div style={rowStyle}>
                <div>
                  <label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Loans received (€)</label>
                  {num('loans_received')}
                </div>
                <div>
                  <label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Loans repaid (€)</label>
                  {num('loans_repaid')}
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ ...labelStyle, fontWeight: 400, color: '#6b7280' }}>Owner drawings/withdrawals (€)</label>
                {num('owner_drawings')}
              </div>
            </div>
          </>
        )}

        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          💡 Your revenue, expenses, and bank data already saved in NALLE will be included automatically.
        </div>

        <button onClick={handleCreate} disabled={loading} style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Creating report...' : `Create ${selected.title} →`}
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
