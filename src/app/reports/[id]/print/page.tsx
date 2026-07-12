'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Shareholder { name: string; id: string; shares: number; total_shares: number; pct: string }
interface ReportContent {
  type: string; title: string; business_name: string; ytunnus?: string; period: string; generated_at: string
  income?: Record<string, string | number>
  expenses?: Record<string, string | number>
  taxable_income?: Record<string, string | number>
  balance_sheet?: Record<string, string | number>
  shareholders?: Shareholder[]
  dividends?: { paid: string; paid_raw: number }
  submission?: { deadline: string; form: string; method: string }
}

const s = (obj: Record<string, string | number> | undefined, k: string) => String(obj?.[k] ?? '0,00 €')
const raw = (obj: Record<string, string | number> | undefined, k: string) => Number(obj?.[k] ?? 0)

function Field({ num, label, value, bold, indent }: { num?: string; label: string; value?: string; bold?: boolean; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ccc', minHeight: 22 }}>
      {num !== undefined && (
        <div style={{ width: 48, flexShrink: 0, borderRight: '1px solid #ccc', padding: '2px 4px', fontSize: 9, color: '#555', display: 'flex', alignItems: 'center' }}>
          {num}
        </div>
      )}
      <div style={{ flex: 1, padding: '2px 6px', paddingLeft: indent ? 20 : 6, fontSize: 10, fontWeight: bold ? 700 : 400, display: 'flex', alignItems: 'center' }}>
        {label}
      </div>
      {value !== undefined && (
        <div style={{ width: 130, flexShrink: 0, borderLeft: '1px solid #ccc', padding: '2px 6px', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', fontWeight: bold ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          {value}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ background: '#1a1a2e', color: 'white', padding: '4px 8px', marginTop: 12, marginBottom: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</div>
      {sub && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

export default function PrintPage() {
  const params = useParams()
  const id = params.id as string
  const [content, setContent] = useState<ReportContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('reports').select('content, report_type').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setError('Report not found'); return }
        if (data.report_type !== 'form_6b') { setError('Print view only available for 6B Veroilmoitus'); return }
        setContent(data.content as ReportContent)
      })
  }, [id])

  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>
  if (!content) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#6b7280' }}>Ladataan...</div>

  const inc  = content.income
  const exp  = content.expenses
  const tax  = content.taxable_income
  const bs   = content.balance_sheet
  const [periodStart, periodEnd] = (content.period ?? '').split(/\s*[–-]\s*/)
  const sh = content.shareholders ?? []
  const generatedDate = new Date().toLocaleDateString('fi-FI')

  // Derived totals
  const totalRevRaw  = raw(inc, 'total_revenue_raw')
  const totalExpRaw  = raw(exp, 'total_expenses_raw')
  const bizResultRaw = raw(tax, 'business_result_raw')
  const taxableRaw   = raw(tax, 'taxable_raw')
  const estTaxRaw    = raw(tax, 'estimated_tax_raw')
  const totalAssRaw  = raw(bs, 'total_assets_raw')
  const totalLiabRaw = raw(bs, 'total_liabilities_raw')
  const ownEquityRaw = totalAssRaw - totalLiabRaw
  const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <>
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, Helvetica, sans-serif; background: white; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>← Takaisin</button>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ↓ Tallenna PDF
        </button>
      </div>

      {/* ── FORM ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 794, margin: '0 auto', padding: '60px 0 20px', background: 'white' }}>

        {/* Header */}
        <div style={{ border: '2px solid #1a1a2e', padding: 0, marginBottom: 0 }}>
          <div style={{ background: '#1a1a2e', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                VEROILMOITUS — YHTEISÖ JA YHTEISETUUS
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 }}>
                Lomake 6B (3052) · Verohallinto · verotus.fi
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Laadittu {generatedDate}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 2 }}>NALLE-kirjanpito-ohjelma</div>
            </div>
          </div>

          {/* Basic info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #ccc' }}>
            <div style={{ padding: '5px 8px', borderRight: '1px solid #ccc' }}>
              <div style={{ fontSize: 8, color: '#666', marginBottom: 2 }}>YRITYKSEN NIMI</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{content.business_name}</div>
            </div>
            <div style={{ padding: '5px 8px', borderRight: '1px solid #ccc' }}>
              <div style={{ fontSize: 8, color: '#666', marginBottom: 2 }}>Y-TUNNUS</div>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>{content.ytunnus || '—'}</div>
            </div>
            <div style={{ padding: '5px 8px' }}>
              <div style={{ fontSize: 8, color: '#666', marginBottom: 2 }}>TILIKAUSI</div>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{periodStart} – {periodEnd}</div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: TULOT ─────────────────────────────────────────── */}
        <SectionTitle title="1. Elinkeinotoiminnan tulot" sub="Tuotot — Income" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field num="300" label="Liikevaihto — Net sales" value={s(inc, 'nalle_revenue')} />
          {raw(inc, 'extra_revenue_raw') > 0 && <Field num="" label="Lisätulot NALLE:n ulkopuolelta" value={s(inc, 'extra_revenue')} indent />}
          <Field num="310" label="Muut liiketoiminnan tuotot" value={s(inc, 'other_income')} />
          <Field num="315" label="TUOTOT YHTEENSÄ" value={fmt(totalRevRaw)} bold />
        </div>

        {/* ── SECTION 2: MENOT ─────────────────────────────────────────── */}
        <SectionTitle title="2. Elinkeinotoiminnan menot" sub="Kulut — Expenses" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field num="320" label="Palkat ja henkilöstökulut" value={s(exp, 'wages')} />
          <Field num="330" label="Vuokrat" value="0,00 €" />
          <Field num="340" label="Suunnitelman mukaiset poistot" value={s(exp, 'depreciation')} />
          <Field num="350" label="Muut kulut (NALLE-kirjaukset)" value={s(exp, 'nalle_expenses')} />
          {raw(exp, 'entertainment_full_raw') > 0 && (
            <>
              <Field num="352" label="Edustuskulut (koko määrä)" value={s(exp, 'entertainment_full')} indent />
              <Field num="" label="Edustuskulujen vähennyskelpoinen osuus (50 %)" value={`– ${s(exp, 'entertainment_deductible')}`} indent />
            </>
          )}
          <Field num="360" label="Korkokulut ja muut rahoituskulut" value={s(exp, 'interest_expense')} />
          <Field num="370" label="MENOT YHTEENSÄ" value={fmt(totalExpRaw)} bold />
        </div>

        {/* ── SECTION 3: TULOS ─────────────────────────────────────────── */}
        <SectionTitle title="3. Elinkeinotoiminnan tulos" sub="Verotettava tulo — Taxable income" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field num="380" label="Elinkeinotoiminnan tulos (315 – 370)" value={fmt(bizResultRaw)} bold />
          {raw(tax, 'prev_losses_raw') > 0 && (
            <Field num="" label="Aiemmilta vuosilta vahvistetut tappiot" value={`– ${s(tax, 'prev_losses')}`} indent />
          )}
          <Field num="390" label="VEROTETTAVA TULO" value={fmt(taxableRaw)} bold />
          <div style={{ display: 'flex', borderBottom: '1px solid #ccc', background: '#f0f4ff', minHeight: 26 }}>
            <div style={{ width: 48, flexShrink: 0, borderRight: '1px solid #ccc' }} />
            <div style={{ flex: 1, padding: '3px 6px', fontSize: 10, display: 'flex', alignItems: 'center', fontStyle: 'italic', color: '#374151' }}>
              Arvioitu yhteisövero (20 % verotettavasta tulosta)
            </div>
            <div style={{ width: 130, flexShrink: 0, borderLeft: '1px solid #ccc', padding: '3px 6px', fontSize: 11, fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {fmt(estTaxRaw)}
            </div>
          </div>
        </div>

        {/* ── SECTION 4: VARALLISUUSLASKELMA ───────────────────────────── */}
        <SectionTitle title="4. Varallisuuslaskelma" sub="Tilikauden päättyessä — At end of accounting period" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          {/* Assets */}
          <Field num="" label="VARAT" bold />
          <Field num="620" label="Käyttöomaisuus (koneet, kalusto, ajoneuvot)" value={s(bs, 'fixed_assets')} indent />
          <Field num="660" label="Vaihto-omaisuus" value={s(bs, 'inventory')} indent />
          <Field num="670" label="Myyntisaamiset" value={s(bs, 'receivables')} indent />
          <Field num="680" label="Rahat ja pankkisaamiset" value={s(bs, 'bank_balance')} indent />
          <Field num="690" label="VARAT YHTEENSÄ" value={fmt(totalAssRaw)} bold />

          {/* Liabilities */}
          <Field num="" label="VELAT" bold />
          {raw(bs, 'accounts_payable_raw') > 0 && <Field num="720" label="Ostovelat (lyhytaikaiset)" value={s(bs, 'accounts_payable')} indent />}
          <Field num="730" label="Korolliset velat (pankkilainat, luotot)" value={s(bs, 'loans')} indent />
          <Field num="740" label="VELAT YHTEENSÄ" value={fmt(totalLiabRaw)} bold />

          {/* Equity */}
          <Field num="" label="OMA PÄÄOMA" bold />
          <Field num="760" label="Osakepääoma" value={s(bs, 'share_capital')} indent />
          <Field num="" label="Kertyneet voittovarat / tappiot" value={fmt(raw(bs, 'retained_earnings_raw'))} indent />
          <Field num="790" label="OMA PÄÄOMA YHTEENSÄ" value={fmt(ownEquityRaw)} bold />
        </div>

        {/* ── SECTION 5: OSAKKAAT ──────────────────────────────────────── */}
        {sh.length > 0 && (
          <>
            <SectionTitle title="5. Osakkaat" sub="Shareholders" />
            <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', borderBottom: '1px solid #ccc', background: '#f9fafb' }}>
                {['Nimi', 'Hetu / Y-tunnus', 'Osakkeet', 'Omistus-%'].map(h => (
                  <div key={h} style={{ padding: '3px 6px', fontSize: 9, fontWeight: 700, color: '#555', borderRight: '1px solid #eee' }}>{h}</div>
                ))}
              </div>
              {sh.map((shareholder, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', borderBottom: i < sh.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ padding: '3px 6px', fontSize: 10, borderRight: '1px solid #eee' }}>{shareholder.name}</div>
                  <div style={{ padding: '3px 6px', fontSize: 10, fontFamily: 'monospace', borderRight: '1px solid #eee' }}>{shareholder.id || '—'}</div>
                  <div style={{ padding: '3px 6px', fontSize: 10, textAlign: 'right', borderRight: '1px solid #eee' }}>{shareholder.shares} / {shareholder.total_shares}</div>
                  <div style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>{shareholder.pct} %</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SECTION 6: OSINGOT ───────────────────────────────────────── */}
        <SectionTitle title="6. Osingot ja ylijäämät" sub="Dividends and surplus" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field num="" label="Maksetut osingot tilikauden aikana" value={content.dividends?.paid ?? '0,00 €'} />
        </div>

        {/* ── SUBMISSION INFO ───────────────────────────────────────────── */}
        <div style={{ marginTop: 16, border: '1px solid #1a1a2e', padding: '10px 12px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ilmoittaminen Verohallintoon
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 8, color: '#666' }}>LOMAKE</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{content.submission?.form ?? 'Lomake 6B (3052)'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#666' }}>JÄTÄ</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{content.submission?.method ?? 'OmaVero (vero.fi)'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: '#666' }}>VIIMEISTÄÄN</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>{content.submission?.deadline ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 8, color: '#9ca3af' }}>
            Laadittu NALLE-kirjanpito-ohjelman avulla · Tarkista kaikki luvut virallisesta kirjanpidostasi ennen jättämistä · Ei virallinen verotuspäätös
          </div>
          <div style={{ fontSize: 8, color: '#9ca3af' }}>{generatedDate}</div>
        </div>
      </div>
    </>
  )
}
