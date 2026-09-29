'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface TaseRow { accountId: string | null; code: string; name: string; balance: number }
interface AccountBalance { accountId: string; code: string; name: string; type: string; subtype: string | null; balance: number }
interface TaseResponse {
  asOf: string
  companyName: string | null
  readiness: { state: 'missing' | 'ready' | 'reconciled'; groups: { title: string; complete: boolean }[] }
  tase: {
    vastaavaa: TaseRow[]
    vastattavaa: TaseRow[]
    totalAssets: number
    totalLiabilitiesAndEquity: number
    balanced: boolean
    allBalances: AccountBalance[]
    currentPeriodResult: number
  }
}

const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

function Field({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ccc', minHeight: 22 }}>
      <div style={{ flex: 1, padding: '2px 6px', paddingLeft: indent ? 20 : 6, fontSize: 10, fontWeight: bold ? 700 : 400, display: 'flex', alignItems: 'center' }}>
        {label}
      </div>
      <div style={{ width: 130, flexShrink: 0, borderLeft: '1px solid #ccc', padding: '2px 6px', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', fontWeight: bold ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {value}
      </div>
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ background: '#1a1a2e', color: 'white', padding: '4px 8px', marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</div>
      {sub && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function PrintContent() {
  const searchParams = useSearchParams()
  const asOf = searchParams.get('as_of') ?? new Date().toISOString().split('T')[0]!
  const [data, setData] = useState<TaseResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/tase?as_of=${asOf}`).then(async res => {
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load'); return }
      setData(json)
    })
  }, [asOf])

  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>
  if (!data) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#6b7280' }}>Loading...</div>

  const byType = (type: string) => data.tase.allBalances.filter(a => a.type === type)
  const fixedAssets = byType('asset').filter(a => a.subtype === 'fixed_asset')
  const currentAssets = byType('asset').filter(a => a.subtype !== 'fixed_asset')
  const liabilities = byType('liability')
  const equity = byType('equity')
  const generatedDate = new Date().toLocaleDateString('fi-FI')
  const stateLabel = { missing: 'MISSING INFORMATION', ready: 'READY FOR REVIEW', reconciled: 'RECONCILED DRAFT' }[data.readiness.state]

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { body { margin: 0; } .no-print { display: none !important; } }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
      `}</style>

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>← Back</button>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ↓ Save PDF
        </button>
      </div>

      <div style={{ maxWidth: 794, margin: '0 auto', padding: '60px 0 20px', background: 'white' }}>
        <div style={{ border: '2px solid #1a1a2e' }}>
          <div style={{ background: '#1a1a2e', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                TASE — VÄLITASE
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 }}>
                Vastaavaa &amp; Vastattavaa · {new Date(asOf).toLocaleDateString('fi-FI')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: 700 }}>{stateLabel}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 2 }}>NALLE-kirjanpito-ohjelma</div>
            </div>
          </div>
          <div style={{ padding: '5px 8px', borderTop: '1px solid #ccc' }}>
            <div style={{ fontSize: 8, color: '#666', marginBottom: 2 }}>YRITYKSEN NIMI</div>
            <div style={{ fontSize: 11, fontWeight: 700 }}>{data.companyName ?? '—'}</div>
          </div>
        </div>

        <SectionTitle title="Vastaavaa" sub="Assets" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field label="Pysyvät vastaavat" value="" bold />
          {fixedAssets.length === 0
            ? <Field label="Käyttöomaisuus" value={fmt(0)} indent />
            : fixedAssets.map(a => <Field key={a.accountId} label={a.name} value={fmt(a.balance)} indent />)}

          <Field label="Vaihtuvat vastaavat" value="" bold />
          {currentAssets.map(a => <Field key={a.accountId} label={a.name} value={fmt(a.balance)} indent />)}

          <Field label="VASTAAVAA YHTEENSÄ" value={fmt(data.tase.totalAssets)} bold />
        </div>

        <SectionTitle title="Vastattavaa" sub="Liabilities & Equity" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field label="Oma pääoma" value="" bold />
          {equity.map(a => <Field key={a.accountId} label={a.name} value={fmt(a.balance)} indent />)}
          {data.tase.currentPeriodResult !== 0 && (
            <Field label="Tilikauden tulos (draft — ei vielä päätetty)" value={fmt(data.tase.currentPeriodResult)} indent />
          )}

          <Field label="Vieras pääoma" value="" bold />
          {liabilities.length === 0
            ? <Field label="Velat" value={fmt(0)} indent />
            : liabilities.map(a => <Field key={a.accountId} label={a.name} value={fmt(a.balance)} indent />)}

          <Field label="VASTATTAVAA YHTEENSÄ" value={fmt(data.tase.totalLiabilitiesAndEquity)} bold />
        </div>

        <div style={{ marginTop: 12, padding: '10px 12px', border: `1px solid ${data.tase.balanced ? '#16a34a' : '#dc2626'}`, background: data.tase.balanced ? '#f0fdf4' : '#fef2f2' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: data.tase.balanced ? '#166534' : '#991b1b' }}>
            {data.tase.balanced ? 'Vastaavaa = Vastattavaa ✓' : 'VAROITUS: Tase ei täsmää — älä käytä'}
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 9, color: '#6b7280', lineHeight: 1.6, borderTop: '1px solid #ccc', paddingTop: 10 }}>
          Tämä on NALLE-ohjelman laatima luonnos — sitä ei ole tarkastanut, hyväksynyt tai vahvistanut tilitoimisto tai tilintarkastaja.
          This is a draft prepared by NALLE — it has not been reviewed, audited, or approved by an accountant. Export the full record set for your accountant before filing an official tilinpäätös.
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9ca3af' }}>
          <div>Laadittu NALLE-kirjanpito-ohjelman avulla · Ei virallinen tilinpäätös</div>
          <div>{generatedDate}</div>
        </div>
      </div>
    </>
  )
}

export default function TasePrintPage() {
  return (
    <Suspense>
      <PrintContent />
    </Suspense>
  )
}
