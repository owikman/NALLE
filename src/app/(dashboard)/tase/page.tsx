import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { getTaseReadiness, type TaseState } from '@/lib/ledger/tase'
import Link from 'next/link'

const STATE_COPY: Record<TaseState, { label: string; color: string; bg: string; desc: string }> = {
  missing: { label: 'Missing information', color: '#b45309', bg: '#fffbeb', desc: 'Answer the setup questions below before a tase can be generated.' },
  ready: { label: 'Ready for review', color: '#1d4ed8', bg: '#eff6ff', desc: 'The numbers balance, but some items still need your confirmation before this is a reconciled draft.' },
  reconciled: { label: 'Reconciled draft', color: '#15803d', bg: '#f0fdf4', desc: "Everything is answered and balances — still a draft, not an accountant-approved statement." },
}

export default async function TasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const companyId = await getActiveCompanyId(user!.id)

  if (!companyId) {
    return (
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '64px 24px', textAlign: 'center' }}>
        <p style={{ color: '#9ca3af' }}>Complete your intake first to set up a company.</p>
      </div>
    )
  }

  const db = createServiceClient()
  const [{ data: company }, readiness] = await Promise.all([
    db.from('companies').select('business_name').eq('id', companyId).single(),
    getTaseReadiness(db, companyId),
  ])
  const copy = STATE_COPY[readiness.state]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Get my tase ready</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>{company?.business_name ?? 'Your company'}&apos;s path to an accurate välitase</p>
        </div>
        <Link href="/tase/workspace" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          View tase →
        </Link>
      </div>

      <div style={{ background: copy.bg, border: `1px solid ${copy.color}22`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: copy.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{copy.label}</p>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{copy.desc}</p>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Setup</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {readiness.groups.map(g => (
            <Link key={g.key} href={`/tase/wizard?group=${g.key}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, border: '1px solid #f0f0f0', textDecoration: 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{g.title}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: g.complete ? (g.hasUnknown ? '#fef3c7' : '#dcfce7') : '#f3f4f6', color: g.complete ? (g.hasUnknown ? '#92400e' : '#166534') : '#9ca3af' }}>
                {g.complete ? (g.hasUnknown ? 'Has unknowns' : 'Done') : 'Not started'}
              </span>
            </Link>
          ))}
        </div>
        <Link href="/tase/wizard" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
          Continue setup →
        </Link>
      </div>

      {readiness.openTasks.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Open items</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {readiness.openTasks.map(t => (
              <Link key={t.id} href={t.link_href ?? '/tase/wizard'} style={{ display: 'block', padding: '12px 16px', borderRadius: 12, border: '1px solid #fde68a', background: '#fffbeb', textDecoration: 'none', fontSize: 14, color: '#92400e' }}>
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
