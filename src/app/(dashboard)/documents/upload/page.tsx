'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Stage = 'pick' | 'uploading' | 'review'

const DOCUMENT_TYPES = [
  { value: 'opening_balance_statement', label: 'Opening balance bank statement' },
  { value: 'loan_statement', label: 'Loan statement' },
  { value: 'vat_return', label: 'VAT return' },
  { value: 'payroll_report', label: 'Payroll report' },
  { value: 'travel_claim', label: 'Travel expense claim' },
  { value: 'other', label: 'Other' },
]

const inputStyle = { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, color: '#111827', background: 'white' }
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'capitalize' as const }

function humanize(key: string): string {
  return key.replace(/_/g, ' ')
}

export default function UploadDocumentPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [documentType, setDocumentType] = useState('opening_balance_statement')
  const [stage, setStage] = useState<Stage>('pick')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [fields, setFields] = useState<Record<string, string>>({})
  const [storagePath, setStoragePath] = useState('')
  const [fileHash, setFileHash] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duplicateOf, setDuplicateOf] = useState<{ id: string; created_at: string } | null>(null)
  const [confirmedNotDuplicate, setConfirmedNotDuplicate] = useState(false)

  async function handleFile(file: File) {
    setStage('uploading'); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', documentType)
      const res = await fetch('/api/documents/extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to read document')

      const stringFields: Record<string, string> = {}
      for (const [k, v] of Object.entries(json.extracted ?? {})) {
        stringFields[k] = v === null || v === undefined ? '' : String(v)
      }
      setFields(stringFields)
      setStoragePath(json.storage_path)
      setFileHash(json.file_hash)
      setPreviewUrl(json.preview_url)
      setDuplicateOf(json.duplicate_of)
      setConfirmedNotDuplicate(false)
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('pick')
    }
  }

  async function handleConfirm() {
    setSaving(true); setError(null)
    try {
      const confirmedData: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        const num = Number(v)
        confirmedData[k] = v !== '' && !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(v.trim()) ? num : (v || null)
      }
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_type: documentType,
          storage_path: storagePath,
          file_hash: fileHash,
          extracted_data: fields,
          confirmed_data: confirmedData,
          duplicate_of_id: duplicateOf?.id ?? null,
          confirmed_not_duplicate: confirmedNotDuplicate,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  if (stage === 'review') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => setStage('pick')} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Review extracted details</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Check and correct anything before confirming</p>
          </div>
        </div>

        {duplicateOf && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>This looks like a document you already uploaded ({new Date(duplicateOf.created_at).toLocaleDateString('fi-FI')}).</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmedNotDuplicate} onChange={e => setConfirmedNotDuplicate(e.target.checked)} />
              This is a different, legitimate document — save it anyway
            </label>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(fields).map(([key, value]) => (
            <div key={key}>
              <label style={labelStyle}>{humanize(key)}</label>
              <input type="text" value={value} onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
            </div>
          ))}

          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
              📄 View uploaded file
            </a>
          )}

          {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

          <button onClick={handleConfirm} disabled={saving || (Boolean(duplicateOf) && !confirmedNotDuplicate)}
            style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || (Boolean(duplicateOf) && !confirmedNotDuplicate) ? 0.5 : 1 }}>
            {saving ? 'Saving...' : 'Confirm and save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Upload a document</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Claude reads it — you confirm before anything is saved</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ ...labelStyle, textTransform: 'none' }}>Document type</label>
        <select value={documentType} onChange={e => setDocumentType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      <div
        onClick={() => stage !== 'uploading' && fileRef.current?.click()}
        style={{ background: 'white', borderRadius: 20, border: `2px dashed ${stage === 'uploading' ? '#3b82f6' : '#e5e7eb'}`, padding: 48, textAlign: 'center', cursor: stage === 'uploading' ? 'default' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {stage === 'uploading' ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#2563eb' }}>Reading document...</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Drop a file or click to upload</p>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>PDF, JPG, PNG</p>
          </>
        )}
      </div>
      {error && <p style={{ marginTop: 16, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
