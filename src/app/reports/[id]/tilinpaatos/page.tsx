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
}

const raw = (obj: Record<string, string | number> | undefined, k: string) => Number(obj?.[k] ?? 0)

function Field({ label, value, bold, indent }: { label: string; value?: string; bold?: boolean; indent?: boolean }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #ccc', minHeight: 22 }}>
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

export default function TilinpaatosPage() {
  const params = useParams()
  const id = params.id as string
  const [content, setContent] = useState<ReportContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('reports').select('content, report_type').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setError('Report not found'); return }
        if (data.report_type !== 'form_6b') { setError('Tilinpäätös-luonnos on saatavilla vain 6B-veroilmoituksista'); return }
        setContent(data.content as ReportContent)
      })
  }, [id])

  if (error) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>
  if (!content) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#6b7280' }}>Ladataan...</div>

  const inc = content.income
  const exp = content.expenses
  const bs  = content.balance_sheet
  const [periodStart, periodEnd] = (content.period ?? '').split(/\s*[–-]\s*/)
  const sh = content.shareholders ?? []
  const generatedDate = new Date().toLocaleDateString('fi-FI')
  const fmt = (n: number) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' }).format(n)

  // ── Tuloslaskelma (kululajikohtainen) ─────────────────────────────────
  const liikevaihto   = raw(inc, 'nalle_revenue_raw') + raw(inc, 'extra_revenue_raw')
  const muutTuotot     = raw(inc, 'other_income_raw')
  const henkilosto     = raw(exp, 'wages_raw')
  const poistot        = raw(exp, 'depreciation_raw')
  const muutKulut       = raw(exp, 'nalle_expenses_raw') + raw(exp, 'entertainment_full_raw')
  const liikevoitto    = liikevaihto + muutTuotot - henkilosto - poistot - muutKulut
  const rahoituskulut  = raw(exp, 'interest_expense_raw')
  const voittoEnnenVeroja = liikevoitto - rahoituskulut
  const tuloverot      = raw(content.taxable_income, 'estimated_tax_raw')
  const tilikaudenVoitto = voittoEnnenVeroja - tuloverot

  // ── Tase ────────────────────────────────────────────────────────────
  const fixAss   = raw(bs, 'fixed_assets_raw')
  const inv      = raw(bs, 'inventory_raw')
  const recv     = raw(bs, 'receivables_raw')
  const bank     = raw(bs, 'bank_balance_raw')
  const totAss   = raw(bs, 'total_assets_raw')
  const ap       = raw(bs, 'accounts_payable_raw')
  const loansAmt = raw(bs, 'loans_raw')
  const totLiab  = raw(bs, 'total_liabilities_raw')
  const shareCap = raw(bs, 'share_capital_raw')
  const ownEquity = totAss - totLiab
  const retained  = ownEquity - shareCap
  const dividendsPaidRaw = content.dividends?.paid_raw ?? 0

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

      <div className="no-print" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 10, zIndex: 999 }}>
        <button onClick={() => window.history.back()} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>← Takaisin</button>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          ↓ Tallenna PDF
        </button>
      </div>

      <div style={{ maxWidth: 794, margin: '0 auto', padding: '60px 0 20px', background: 'white' }}>

        {/* Disclaimer banner */}
        <div className="no-print" style={{ background: '#FFFBEB', border: '1px solid #D97706', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
          ⚠️ Tämä on NALLE:n koostama <strong>luonnos</strong> tilinpäätöksestä, ei tilintarkastettu tai virallisesti vahvistettu asiakirja. Tarkista kaikki luvut ja täytä puuttuvat tiedot (kotipaikka, liitetiedot, allekirjoitukset) ennen rekisteröintiä PRH:lle.
        </div>

        {/* Header */}
        <div style={{ border: '2px solid #1a1a2e', padding: 0, marginBottom: 0 }}>
          <div style={{ background: '#1a1a2e', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'white', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                TILINPÄÄTÖS (LUONNOS)
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, marginTop: 2 }}>
                Tuloslaskelma · Tase · Liitetiedot
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Laadittu {generatedDate}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 8, marginTop: 2 }}>NALLE-kirjanpito-ohjelma</div>
            </div>
          </div>

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

        {/* ── TULOSLASKELMA ─────────────────────────────────────────── */}
        <SectionTitle title="Tuloslaskelma" sub="Kululajikohtainen" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field label="Liikevaihto" value={fmt(liikevaihto)} />
          <Field label="Liiketoiminnan muut tuotot" value={fmt(muutTuotot)} />
          <Field label="Henkilöstökulut" value={`– ${fmt(henkilosto)}`} />
          <Field label="Poistot ja arvonalentumiset" value={`– ${fmt(poistot)}`} />
          <Field label="Liiketoiminnan muut kulut" value={`– ${fmt(muutKulut)}`} />
          <Field label="LIIKEVOITTO (-TAPPIO)" value={fmt(liikevoitto)} bold />
          <Field label="Rahoituskulut" value={`– ${fmt(rahoituskulut)}`} />
          <Field label="VOITTO (TAPPIO) ENNEN VEROJA" value={fmt(voittoEnnenVeroja)} bold />
          <Field label="Tuloverot (arvio)" value={`– ${fmt(tuloverot)}`} />
          <Field label="TILIKAUDEN VOITTO (TAPPIO)" value={fmt(tilikaudenVoitto)} bold />
        </div>

        {/* ── TASE ──────────────────────────────────────────────────── */}
        <SectionTitle title="Tase" sub="Tilikauden päättyessä" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none' }}>
          <Field label="VASTAAVAA" bold />
          <Field label="Pysyvät vastaavat" bold indent />
          <Field label="Aineelliset hyödykkeet" value={fmt(fixAss)} indent />
          <Field label="Vaihtuvat vastaavat" bold indent />
          <Field label="Vaihto-omaisuus" value={fmt(inv)} indent />
          <Field label="Myyntisaamiset" value={fmt(recv)} indent />
          <Field label="Rahat ja pankkisaamiset" value={fmt(bank)} indent />
          <Field label="VASTAAVAA YHTEENSÄ" value={fmt(totAss)} bold />

          <Field label="VASTATTAVAA" bold />
          <Field label="Oma pääoma" bold indent />
          <Field label="Osakepääoma" value={fmt(shareCap)} indent />
          <Field label="Kertyneet voittovarat / tappiot" value={fmt(retained)} indent />
          <Field label="Oma pääoma yhteensä" value={fmt(ownEquity)} indent bold />
          <Field label="Vieras pääoma" bold indent />
          <Field label="Ostovelat" value={fmt(ap)} indent />
          <Field label="Lainat" value={fmt(loansAmt)} indent />
          <Field label="Vieras pääoma yhteensä" value={fmt(totLiab)} indent bold />
          <Field label="VASTATTAVAA YHTEENSÄ" value={fmt(totAss)} bold />
        </div>

        {/* ── LIITETIEDOT ───────────────────────────────────────────── */}
        <SectionTitle title="Liitetiedot" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none', padding: '10px 12px', fontSize: 10, lineHeight: 1.7 }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Laatimisperiaatteet:</strong> Tilinpäätös on laadittu pienyrityksen tilinpäätöksen laatimista koskevien
            säännösten mukaisesti, jatkuvuuden periaatetta noudattaen.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong>Henkilöstö keskimäärin tilikauden aikana:</strong> _______________
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong>Kotipaikka:</strong> _______________&nbsp;&nbsp;&nbsp;<strong>Yhtiömuoto:</strong> _______________
          </p>
          <p>
            <strong>Tilintarkastus:</strong> Yhtiössä ei ole valittu tilintarkastajaa. Tätä tilinpäätöstä ei ole tilintarkastettu.
          </p>
        </div>

        {/* ── HALLITUKSEN ESITYS TULOKSEN KÄSITTELYSTÄ ─────────────────── */}
        <SectionTitle title="Hallituksen esitys tilikauden tuloksen käsittelystä" />
        <div style={{ border: '1px solid #ccc', borderTop: 'none', padding: '10px 12px', fontSize: 10, lineHeight: 1.7 }}>
          {tilikaudenVoitto < 0 ? (
            <p>
              Tilikauden tappio oli {fmt(Math.abs(tilikaudenVoitto))}. Hallitus esittää, että tappio kirjataan
              edellisten tilikausien voittovarojen tilille.
            </p>
          ) : dividendsPaidRaw > 0 ? (
            <p>
              Tilikauden voitto oli {fmt(tilikaudenVoitto)}. Hallitus esittää, että voitosta jaetaan osinkona
              {' '}{fmt(dividendsPaidRaw)} ja jäljelle jäävä {fmt(tilikaudenVoitto - dividendsPaidRaw)} siirretään
              voittovarojen tilille.
            </p>
          ) : (
            <p>
              Tilikauden voitto oli {fmt(tilikaudenVoitto)}. Hallitus esittää, että voitto siirretään
              voittovarojen tilille eikä osinkoa jaeta.
            </p>
          )}
        </div>

        {/* ── ALLEKIRJOITUKSET ──────────────────────────────────────── */}
        <div style={{ marginTop: 16, border: '1px solid #1a1a2e', padding: '14px 16px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Allekirjoitukset
          </div>
          <div style={{ fontSize: 10, marginBottom: 20 }}>
            Paikka ja aika: _______________________________&nbsp;&nbsp;&nbsp; __ . __ . 20__
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: sh.length > 0 ? `repeat(${Math.min(sh.length, 2)}, 1fr)` : '1fr', gap: 24 }}>
            {(sh.length > 0 ? sh : [{ name: '', id: '', shares: 0, total_shares: 0, pct: '' }]).map((s, i) => (
              <div key={i}>
                <div style={{ borderTop: '1px solid #111', marginTop: 32, paddingTop: 4, fontSize: 10 }}>
                  {s.name || '_______________________________'}
                </div>
                <div style={{ fontSize: 8, color: '#666' }}>Hallituksen jäsen</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 8, color: '#9ca3af' }}>
            Laadittu NALLE-kirjanpito-ohjelman avulla · Luonnos — ei tilintarkastettu · Tarkista kaikki luvut ennen allekirjoittamista ja rekisteröintiä
          </div>
          <div style={{ fontSize: 8, color: '#9ca3af' }}>{generatedDate}</div>
        </div>
      </div>
    </>
  )
}
