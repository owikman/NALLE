'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'

type TaseRow = { accountId: string | null; code: string; name: string; balance: number }
type Readiness = {
  state: 'missing' | 'ready' | 'reconciled'
  groups: { key: string; title: string; complete: boolean; hasUnknown: boolean }[]
  openTasks: { id: string; title: string; link_href: string | null }[]
}
type TaseData = {
  asOf: string
  readiness: Readiness
  tase: { vastaavaa: TaseRow[]; vastattavaa: TaseRow[]; totalAssets: number; totalLiabilitiesAndEquity: number; balanced: boolean }
}
type DrilldownLine = { lineId: string; entryDate: string | null; description: string; sourceType: string; debit: number; credit: number; sourceHref: string | null }

const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

const STATE_COPY: Record<Readiness['state'], { label: string; color: string; bg: string }> = {
  missing: { label: 'Missing information', color: '#b45309', bg: '#fffbeb' },
  ready: { label: 'Ready for review', color: '#1d4ed8', bg: '#eff6ff' },
  reconciled: { label: 'Reconciled draft', color: '#15803d', bg: '#f0fdf4' },
}

function Row({ row, asOf }: { row: TaseRow; asOf: string }) {
  const [expanded, setExpanded] = useState(false)
  const [lines, setLines] = useState<DrilldownLine[] | null>(null)
  const [loadingLines, setLoadingLines] = useState(false)

  async function toggle() {
    if (!row.accountId) { setExpanded(e => !e); return }
    if (!expanded && lines === null) {
      setLoadingLines(true)
      const res = await fetch(`/api/tase/drilldown?account_id=${row.accountId}&as_of=${asOf}`)
      const json = await res.json()
      setLines(res.ok ? json.lines : [])
      setLoadingLines(false)
    }
    setExpanded(e => !e)
  }

  return (
    <div style={{ borderBottom: '1px solid #f9fafb' }}>
      <button onClick={toggle} disabled={!row.accountId}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', background: 'none', border: 'none', cursor: row.accountId ? 'pointer' : 'default', textAlign: 'left' }}>
        <span style={{ fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
          {row.accountId && <span style={{ fontSize: 11, color: '#9ca3af', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>}
          {row.code && <span style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{row.code}</span>} {row.name}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(row.balance)}</span>
      </button>
      {expanded && row.accountId && (
        <div style={{ padding: '4px 4px 14px 28px' }}>
          {loadingLines && <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading...</p>}
          {!loadingLines && lines && lines.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>No journal lines yet.</p>}
          {!loadingLines && lines && lines.map(l => (
            <div key={l.lineId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #f9fafb', fontSize: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#374151' }}>{l.description}</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>
                  {l.entryDate && fmtDate(l.entryDate)} · {l.sourceType}
                  {l.sourceHref && <> · <Link href={l.sourceHref} style={{ color: '#2563eb' }}>view source</Link></>}
                </span>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: '#374151' }}>{fmt(l.debit > 0 ? l.debit : -l.credit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Workspace() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]!)
  const [data, setData] = useState<TaseData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tase?as_of=${asOf}`).then(async res => {
      const json = await res.json()
      if (cancelled) return
      if (!res.ok) { setError(json.error ?? 'Failed to load'); return }
      setData(json); setError(null)
    })
    return () => { cancelled = true }
  }, [asOf])

  const loading = !error && (!data || data.asOf !== asOf)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Tase</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Vastaavaa &amp; Vastattavaa as of the date below</p>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>As of date</label>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14 }} />
        </div>
      </div>

      {loading && <p style={{ color: '#9ca3af' }}>Loading...</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {data && data.asOf === asOf && (() => {
        const copy = STATE_COPY[data.readiness.state]
        return (
          <>
            <div style={{ background: copy.bg, border: `1px solid ${copy.color}22`, borderRadius: 16, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: copy.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{copy.label}</span>
              {data.readiness.state !== 'missing' && (
                <span style={{ fontSize: 12, color: data.tase.balanced ? '#15803d' : '#dc2626', fontWeight: 600 }}>
                  {data.tase.balanced ? 'Debits = Credits ✓' : 'OUT OF BALANCE — do not use'}
                </span>
              )}
            </div>

            {data.readiness.state === 'missing' ? (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 32 }}>
                <p style={{ fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.6 }}>
                  This tase can&apos;t be generated yet — some setup questions are still unanswered. Numbers are hidden rather than shown incomplete.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {data.readiness.groups.filter(g => !g.complete).map(g => (
                    <Link key={g.key} href={`/tase/wizard?group=${g.key}`} style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>
                      → {g.title}
                    </Link>
                  ))}
                </div>
                <Link href="/tase/wizard" style={{ display: 'inline-block', background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                  Continue setup
                </Link>
              </div>
            ) : (
              <>
                {data.readiness.openTasks.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>Still needs review before this can be a reconciled draft:</p>
                    {data.readiness.openTasks.map(t => (
                      <Link key={t.id} href={t.link_href ?? '/tase/wizard'} style={{ display: 'block', fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                        • {t.title}
                      </Link>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '20px 24px' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Vastaavaa (Assets)</h2>
                    {data.tase.vastaavaa.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>No assets recorded.</p>}
                    {data.tase.vastaavaa.map(row => <Row key={row.accountId ?? row.name} row={row} asOf={asOf} />)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, fontWeight: 700, fontSize: 14, color: '#111827' }}>
                      <span>Total Vastaavaa</span><span>{fmt(data.tase.totalAssets)}</span>
                    </div>
                  </div>
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '20px 24px' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Vastattavaa (Liabilities &amp; Equity)</h2>
                    {data.tase.vastattavaa.length === 0 && <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>No liabilities or equity recorded.</p>}
                    {data.tase.vastattavaa.map(row => <Row key={row.accountId ?? row.name} row={row} asOf={asOf} />)}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, fontWeight: 700, fontSize: 14, color: '#111827' }}>
                      <span>Total Vastattavaa</span><span>{fmt(data.tase.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 20, lineHeight: 1.6 }}>
                  This is a draft prepared by NALLE — it has not been reviewed, audited, or approved by an accountant.
                  Export it for your accountant to review and prepare the official tilinpäätös.
                </p>
              </>
            )}
          </>
        )
      })()}
    </div>
  )
}

export default function TaseWorkspacePage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  )
}
