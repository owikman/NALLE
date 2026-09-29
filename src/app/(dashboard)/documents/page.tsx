import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

const TYPE_LABELS: Record<string, string> = {
  opening_balance_statement: 'Opening balance statement',
  loan_statement: 'Loan statement',
  vat_return: 'VAT return',
  payroll_report: 'Payroll report',
  travel_claim: 'Travel claim',
  other: 'Other',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending_review: { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
  confirmed: { bg: '#dcfce7', color: '#166534', label: 'Confirmed' },
  duplicate_flagged: { bg: '#fef3c7', color: '#92400e', label: 'Duplicate flagged' },
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const companyId = await getActiveCompanyId(user!.id)

  const db = createServiceClient()
  const { data: documents } = companyId
    ? await db.from('documents').select('id, document_type, confirmed_data, status, created_at').eq('company_id', companyId).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Documents</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Evidence backing your ledger — statements, loan docs, VAT returns, claims</p>
        </div>
        <Link href="/documents/upload" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          + Upload document
        </Link>
      </div>

      {!documents || documents.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: '64px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ color: '#9ca3af', marginBottom: 16 }}>No documents uploaded yet</p>
          <Link href="/documents/upload" style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
            Upload your first document
          </Link>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {documents.map((d, i) => {
            const style = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending_review!
            const data = (d.confirmed_data ?? {}) as Record<string, unknown>
            const summary = Object.entries(data).slice(0, 2).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')
            return (
              <div key={d.id} style={{ padding: '16px 20px', borderBottom: i < documents.length - 1 ? '1px solid #f9fafb' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{TYPE_LABELS[d.document_type] ?? d.document_type}</p>
                  <p style={{ fontSize: 13, color: '#9ca3af' }}>{summary || 'No details recorded'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(d.created_at).toLocaleDateString('fi-FI')}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: style.bg, color: style.color }}>{style.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
