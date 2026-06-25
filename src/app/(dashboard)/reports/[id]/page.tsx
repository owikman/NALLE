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
interface ReportContent {
  type: string; title: string; business_name: string; period: string; generated_at: string; sections: Section[]
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

  const typeLabel: Record<string, string> = { pnl: 'Profit & Loss', balance_sheet: 'Balance Sheet', cash_flow: 'Cash Flow' }
  const typeIcon:  Record<string, string> = { pnl: '📊', balance_sheet: '⚖️', cash_flow: '💧' }

  if (!content) {
    return (
      <div style={{ maxWidth: 720 }}>
        <Link href="/reports" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>← Back to reports</Link>
        <p style={{ color: '#9ca3af' }}>This report has no viewable content (it was generated before the bookkeeping update).</p>
      </div>
    )
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fi-FI')

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <Link href="/reports" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>← Reports</Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {typeIcon[content.type] ?? '📄'} {typeLabel[content.type] ?? content.type}
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>{content.business_name} · {content.period}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <Link href={`/api/reports/generate?id=${id}&type=${report.report_type}`} style={{ fontSize: 13, color: '#2563eb', border: '1px solid #dbeafe', borderRadius: 10, padding: '9px 16px', textDecoration: 'none', fontWeight: 500, background: '#eff6ff' }}>
            ↓ Download Excel
          </Link>
          <Link href="/reports/new" style={{ background: '#2563eb', color: 'white', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            + New report
          </Link>
        </div>
      </div>

      {/* Report header card */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
        <div style={{ background: '#f9fafb', padding: '16px 28px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{content.business_name}</span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Generated {fmtDate(content.generated_at)}</span>
        </div>

        {content.sections.map((section, si) => (
          <div key={si}>
            {/* Section heading */}
            <div style={{ padding: '18px 28px 8px', background: si > 0 ? '#fafafa' : 'white', borderTop: si > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{section.title}</p>
            </div>

            {/* Rows */}
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

            {/* Section total */}
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
    </div>
  )
}
