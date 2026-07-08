import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface Row { label: string; value: string; indent?: boolean; bold?: boolean; positive?: boolean; negative?: boolean }
interface Section {
  title: string
  rows: Row[]
  total?: { label: string; value: string; raw: number }
}
interface Shareholder { name: string; id: string; shares: number; total_shares: number; pct: string }
interface ReportContent {
  type: string; title: string; business_name: string; period: string; generated_at: string
  sections?: Section[]
  // 6B specific
  ytunnus?: string
  income?: Record<string, string | number>
  expenses?: Record<string, string | number>
  taxable_income?: Record<string, string | number>
  balance_sheet?: Record<string, string | number>
  shareholders?: Shareholder[]
  dividends?: { paid: string; paid_raw: number }
  submission?: { deadline: string; form: string; method: string }
}

const typeLabel: Record<string, string> = {
  pnl: 'Profit & Loss', balance_sheet: 'Balance Sheet', cash_flow: 'Cash Flow', form_6b: '6B Veroilmoitus',
}
const typeIcon: Record<string, string> = {
  pnl: '📊', balance_sheet: '⚖️', cash_flow: '💧', form_6b: '🏛️',
}

function TaxRow({ field, label, value, bold, sub, positive, negative }: { field?: string; label: string; value: string; bold?: boolean; sub?: boolean; positive?: boolean; negative?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: `${bold ? 14 : 10}px 28px`, borderBottom: '1px solid #f9fafb', gap: 12 }}>
      {field && <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', minWidth: 32, flexShrink: 0 }}>{field}</span>}
      {!field && <span style={{ minWidth: 32, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 14, color: bold ? '#111827' : sub ? '#9ca3af' : '#374151', fontWeight: bold ? 700 : 400, paddingLeft: sub ? 12 : 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: bold ? 700 : 500, color: positive ? '#16a34a' : negative ? '#dc2626' : bold ? '#111827' : '#374151' }}>
        {value}
      </span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ padding: '14px 28px 8px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</p>
    </div>
  )
}

function TaxFormView({ content }: { content: ReportContent }) {
  const inc  = content.income ?? {}
  const exp  = content.expenses ?? {}
  const tax  = content.taxable_income ?? {}
  const bs   = content.balance_sheet ?? {}
  const sub  = content.submission

  const s = (k: string) => String(inc[k] ?? exp[k] ?? tax[k] ?? bs[k] ?? '')
  const raw = (obj: Record<string, string | number>, k: string) => Number(obj[k] ?? 0)

  const totalRevRaw  = raw(inc, 'total_revenue_raw')
  const bizResultRaw = raw(tax, 'business_result_raw')
  const taxableRaw   = raw(tax, 'taxable_raw')
  const totAssRaw    = raw(bs, 'total_assets_raw')
  const totLiabRaw   = raw(bs, 'total_liabilities_raw')

  return (
    <div>
      {/* Header card */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ background: '#111110', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{content.business_name}</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }}>Y-tunnus: {content.ytunnus || '—'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Tilikausi: {content.period}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Laadittu {content.generated_at}</p>
          </div>
        </div>

        {/* Income */}
        <SectionHeader title="Tuotot — Revenue" />
        <TaxRow field="300" label="Liikevaihto (NALLE data)" value={String(inc.nalle_revenue ?? '€0,00')} sub />
        {raw(inc, 'extra_revenue_raw') > 0 && <TaxRow field="" label="Lisätulot" value={String(inc.extra_revenue ?? '€0,00')} sub />}
        {raw(inc, 'other_income_raw') > 0 && <TaxRow field="310" label="Muut liiketoiminnan tuotot" value={String(inc.other_income ?? '€0,00')} sub />}
        <TaxRow field="" label="TUOTOT YHTEENSÄ" value={String(inc.total_revenue ?? '€0,00')} bold positive={totalRevRaw >= 0} />

        {/* Expenses */}
        <SectionHeader title="Kulut — Expenses" />
        <TaxRow field="" label="Kulut NALLE:sta (expenses + invoices)" value={String(exp.nalle_expenses ?? '€0,00')} sub />
        {raw(exp, 'wages_raw') > 0 && <TaxRow field="320" label="Palkat ja henkilöstökulut" value={String(exp.wages ?? '€0,00')} sub />}
        {raw(exp, 'depreciation_raw') > 0 && <TaxRow field="340" label="Suunnitelman mukaiset poistot" value={String(exp.depreciation ?? '€0,00')} sub />}
        {raw(exp, 'entertainment_full_raw') > 0 && (
          <>
            <TaxRow field="352" label="Edustuskulut (koko määrä)" value={String(exp.entertainment_full ?? '€0,00')} sub />
            <TaxRow field="" label="Edustuskulut (vähennetään 50%)" value={`– ${String(exp.entertainment_deductible ?? '€0,00')}`} sub />
          </>
        )}
        {raw(exp, 'interest_expense_raw') > 0 && <TaxRow field="360" label="Korkokulut" value={String(exp.interest_expense ?? '€0,00')} sub />}
        <TaxRow field="" label="KULUT YHTEENSÄ" value={String(exp.total_expenses ?? '€0,00')} bold negative />

        {/* Result */}
        <SectionHeader title="Verotettava tulo — Taxable Income" />
        <TaxRow field="" label="Liiketoiminnan tulos" value={String(tax.business_result ?? '€0,00')} bold positive={bizResultRaw >= 0} negative={bizResultRaw < 0} />
        {raw(tax, 'prev_losses_raw') > 0 && <TaxRow field="" label="Aiempien vuosien tappiot" value={`– ${String(tax.prev_losses ?? '€0,00')}`} sub />}
        <TaxRow field="" label="VEROTETTAVA TULO" value={String(tax.taxable ?? '€0,00')} bold positive={taxableRaw >= 0} />
        <div style={{ padding: '14px 28px', background: taxableRaw > 0 ? '#eff6ff' : '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#2563eb', fontWeight: 500 }}>Veron arvio (20% yhteisövero)</span>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}>{String(tax.estimated_tax ?? '€0,00')}</span>
        </div>
      </div>

      {/* Balance sheet */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <SectionHeader title="Varallisuuslaskelma — Net Worth" />
        <TaxRow field="" label="VARAT" value="" bold />
        {raw(bs, 'fixed_assets_raw') > 0 && <TaxRow field="620" label="Käyttöomaisuus" value={String(bs.fixed_assets ?? '€0,00')} sub />}
        {raw(bs, 'inventory_raw') > 0 && <TaxRow field="660" label="Vaihto-omaisuus" value={String(bs.inventory ?? '€0,00')} sub />}
        {raw(bs, 'receivables_raw') > 0 && <TaxRow field="" label="Myyntisaamiset" value={String(bs.receivables ?? '€0,00')} sub />}
        <TaxRow field="" label="Rahat ja pankkisaamiset" value={String(bs.bank_balance ?? '€0,00')} sub />
        <TaxRow field="" label="VARAT YHTEENSÄ" value={String(bs.total_assets ?? '€0,00')} bold positive={totAssRaw >= 0} />

        <TaxRow field="" label="VELAT" value="" bold />
        {raw(bs, 'accounts_payable_raw') > 0 && <TaxRow field="" label="Ostovelat" value={String(bs.accounts_payable ?? '€0,00')} sub />}
        {raw(bs, 'loans_raw') > 0 && <TaxRow field="730" label="Korolliset velat" value={String(bs.loans ?? '€0,00')} sub />}
        <TaxRow field="" label="VELAT YHTEENSÄ" value={String(bs.total_liabilities ?? '€0,00')} bold negative={totLiabRaw > 0} />

        <TaxRow field="" label="OMA PÄÄOMA" value="" bold />
        <TaxRow field="760" label="Osakepääoma" value={String(bs.share_capital ?? '€0,00')} sub />
        <TaxRow field="" label="Kertyneet voittovarat" value={String(bs.retained_earnings ?? '€0,00')} sub positive={raw(bs, 'retained_earnings_raw') >= 0} negative={raw(bs, 'retained_earnings_raw') < 0} />
        <TaxRow field="" label="OMA PÄÄOMA YHTEENSÄ" value={String(bs.total_assets ?? '?')} bold positive />
      </div>

      {/* Shareholders */}
      {content.shareholders && content.shareholders.length > 0 && (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
          <SectionHeader title="Osakkaat — Shareholders" />
          {content.shareholders.map((sh, i) => (
            <div key={i} style={{ padding: '16px 28px', borderBottom: '1px solid #f9fafb', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>NIMI</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{sh.name}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>HETU / Y-TUNNUS</p>
                <p style={{ fontSize: 14, color: '#374151' }}>{sh.id || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>OSAKKEET</p>
                <p style={{ fontSize: 14, color: '#374151' }}>{sh.shares} / {sh.total_shares}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>OMISTUSOSUUS</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#2563eb' }}>{sh.pct}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dividends */}
      {content.dividends && content.dividends.paid_raw > 0 && (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '20px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Maksetut osingot</p>
            <p style={{ fontSize: 14, color: '#374151' }}>Tilikauden aikana jaetut osingot</p>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#111827' }}>{content.dividends.paid}</p>
        </div>
      )}

      {/* Submission instructions */}
      {sub && (
        <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 20, padding: 28 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>📋 Ilmoittaminen Verohallintoon</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, minWidth: 90 }}>Lomake:</span>
              <span style={{ fontSize: 13, color: '#1e40af' }}>{sub.form}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, minWidth: 90 }}>Jätä:</span>
              <span style={{ fontSize: 13, color: '#1e40af' }}>{sub.method}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, minWidth: 90 }}>Viimeistään:</span>
              <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 700 }}>{sub.deadline}</span>
            </div>
          </div>
          <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 16, lineHeight: 1.6 }}>
            Veroilmoitus on jätettävä sähköisesti OmaVeron kautta 4 kuukauden kuluessa tilikauden päättymisestä. Tarkista kaikki luvut kirjanpidostasi ennen lähettämistä.
          </p>
        </div>
      )}

      <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 20 }}>
        Laadittu NALLE:n avulla · Tarkista luvut kirjanpidostasi · Ei virallinen verotuspäätös
      </p>
    </div>
  )
}

export default async function ReportViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: report } = await db.from('reports').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!report) redirect('/reports')

  const content = report.content as ReportContent | null
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

  if (!content) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Link href="/reports" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>← Back to reports</Link>
        <p style={{ color: '#9ca3af' }}>This report has no viewable content (it was generated before the bookkeeping update).</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="resp-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <Link href="/reports" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>← Reports</Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {typeIcon[content.type] ?? '📄'} {typeLabel[content.type] ?? content.type}
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>{content.business_name} · {content.period}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {content.type !== 'form_6b' && (
            <Link href={`/api/reports/generate?id=${id}&type=${report.report_type}`} style={{ fontSize: 13, color: '#2563eb', border: '1px solid #dbeafe', borderRadius: 10, padding: '9px 16px', textDecoration: 'none', fontWeight: 500, background: '#eff6ff' }}>
              ↓ Download Excel
            </Link>
          )}
          <Link href="/reports/new" style={{ background: '#2563eb', color: 'white', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            + New report
          </Link>
        </div>
      </div>

      {content.type === 'form_6b' ? (
        <TaxFormView content={content} />
      ) : (
        <>
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
            <div style={{ background: '#f9fafb', padding: '16px 28px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{content.business_name}</span>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Generated {fmtDate(content.generated_at)}</span>
            </div>

            {(content.sections ?? []).map((section, si) => (
              <div key={si}>
                <div style={{ padding: '18px 28px 8px', background: si > 0 ? '#fafafa' : 'white', borderTop: si > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{section.title}</p>
                </div>

                {section.rows.map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `10px 28px 10px ${row.indent ? 44 : 28}px`, borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: 14, color: row.bold ? '#111827' : '#6b7280', fontWeight: row.bold ? 600 : 400 }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontSize: 14, fontWeight: row.bold ? 700 : 500, fontFamily: 'monospace',
                      color: row.positive === true ? '#16a34a' : row.negative === true ? '#dc2626' : row.bold ? '#111827' : '#374151',
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}

                {section.total && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', background: '#f9fafb', borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{section.total.label}</span>
                    <span style={{
                      fontSize: 15, fontWeight: 700, fontFamily: 'monospace',
                      color: section.total.raw >= 0 ? '#111827' : '#dc2626',
                    }}>
                      {section.total.value}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
            Generated by NALLE · figures based on data entered into the system · not a certified financial statement
          </p>
        </>
      )}
    </div>
  )
}
