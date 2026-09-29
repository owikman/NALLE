import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { WIZARD_GROUPS } from '@/lib/ledger/wizard-questions'
import Link from 'next/link'

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

  const { data: company } = await supabase.from('companies').select('vat_registered, is_salary_payer, business_name').eq('id', companyId).single()
  const { data: responses } = await supabase.from('setup_responses').select('question_key, status').eq('company_id', companyId)
  const { data: openTasks } = await supabase.from('follow_up_tasks').select('*').eq('company_id', companyId).eq('status', 'open').order('created_at', { ascending: true })
  const { data: openingEntries } = await supabase.from('journal_entries').select('id').eq('company_id', companyId).eq('source_type', 'opening_balance')

  const groups = WIZARD_GROUPS.filter(g => !g.showIf || g.showIf(company ?? { vat_registered: false, is_salary_payer: false }))
  const responseByKey = new Map((responses ?? []).map(r => [r.question_key, r.status]))

  const groupStatus = groups.map(g => {
    const statuses = g.fields.map(f => responseByKey.get(f.key) ?? 'unanswered')
    const complete = statuses.every(s => s !== 'unanswered')
    const hasUnknown = statuses.some(s => s === 'unknown')
    return { group: g, complete, hasUnknown }
  })

  const allComplete = groupStatus.every(g => g.complete)
  const hasOpeningEntry = (openingEntries ?? []).length > 0
  const hasOpenTasks = (openTasks ?? []).length > 0

  let state: 'missing' | 'ready' | 'reconciled' = 'missing'
  if (allComplete && hasOpeningEntry) state = hasOpenTasks ? 'ready' : 'reconciled'

  const stateCopy: Record<typeof state, { label: string; color: string; bg: string; desc: string }> = {
    missing: { label: 'Missing information', color: '#b45309', bg: '#fffbeb', desc: 'Answer the setup questions below before a tase can be generated.' },
    ready: { label: 'Ready for review', color: '#1d4ed8', bg: '#eff6ff', desc: 'The numbers balance, but some items still need your confirmation before this is a reconciled draft.' },
    reconciled: { label: 'Reconciled draft', color: '#15803d', bg: '#f0fdf4', desc: "Everything is answered and balances — still a draft, not an accountant-approved statement." },
  }
  const copy = stateCopy[state]

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Get my tase ready</h1>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>{company?.business_name ?? 'Your company'}&apos;s path to an accurate välitase</p>
      </div>

      <div style={{ background: copy.bg, border: `1px solid ${copy.color}22`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: copy.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{copy.label}</p>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{copy.desc}</p>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Setup</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groupStatus.map(({ group, complete, hasUnknown }) => (
            <Link key={group.key} href={`/tase/wizard?group=${group.key}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, border: '1px solid #f0f0f0', textDecoration: 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{group.title}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: complete ? (hasUnknown ? '#fef3c7' : '#dcfce7') : '#f3f4f6', color: complete ? (hasUnknown ? '#92400e' : '#166534') : '#9ca3af' }}>
                {complete ? (hasUnknown ? 'Has unknowns' : 'Done') : 'Not started'}
              </span>
            </Link>
          ))}
        </div>
        <Link href="/tase/wizard" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
          Continue setup →
        </Link>
      </div>

      {hasOpenTasks && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Open items</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(openTasks ?? []).map(t => (
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
