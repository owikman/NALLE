'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type InvoiceType = 'sent' | 'received'
type Stage = 'pick' | 'upload' | 'scanning' | 'form'

const VAT_RATES = [0, 10, 14, 24, 25.5]
const today = new Date().toISOString().split('T')[0]!
const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!

const inputStyle = {
  width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12,
  padding: '13px 16px', fontSize: 15, outline: 'none',
  boxSizing: 'border-box' as const, color: '#111827', background: 'white',
}
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 } as const

export default function NewInvoicePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>('pick')
  const [type, setType] = useState<InvoiceType>('sent')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  // Form fields
  const [counterparty, setCounterparty] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [vatRate, setVatRate] = useState(24)
  const [vatAmount, setVatAmount] = useState('')
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(in30)
  const [alreadyPaid, setAlreadyPaid] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const net = parseFloat(amount) || 0
  const computedVat = vatAmount !== '' ? parseFloat(vatAmount) || 0 : parseFloat(((net * vatRate) / 100).toFixed(2))
  const total = net + computedVat

  function handleFile(f: File) {
    setFile(f)
    setError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  async function handleScan() {
    if (!file) return
    setStage('scanning')
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/invoices/scan', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')

      if (json.counterparty) setCounterparty(json.counterparty)
      if (json.invoice_number) setInvoiceNumber(json.invoice_number)
      if (json.description) setDescription(json.description)
      if (json.amount) setAmount(String(json.amount))
      if (json.vat_amount) setVatAmount(String(json.vat_amount))
      if (json.vat_rate) setVatRate(json.vat_rate)
      if (json.issue_date) setIssueDate(json.issue_date)
      if (json.due_date) setDueDate(json.due_date)
      if (json.file_url) setFileUrl(json.file_url)
      setScanned(true)
      setStage('form')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan invoice')
      setStage('upload')
    }
  }

  async function handleSave() {
    if (!counterparty.trim()) { setError('Please enter a name'); return }
    if (!amount || net <= 0) { setError('Please enter an amount'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          counterparty: counterparty.trim(),
          invoice_number: invoiceNumber.trim() || null,
          description: description.trim() || null,
          amount: net,
          vat_amount: computedVat,
          issue_date: issueDate,
          due_date: type === 'sent' ? dueDate : null,
          paid: alreadyPaid,
          file_url: fileUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/invoices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  function goBack() {
    if (stage === 'form' && scanned) { setStage('upload'); return }
    if (stage === 'form') { setStage('pick'); return }
    if (stage === 'upload') { setStage('pick'); return }
    router.back()
  }

  // ── Type toggle ─────────────────────────────────────────────────────────
  const TypeToggle = () => (
    <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
      {(['sent', 'received'] as InvoiceType[]).map(t => (
        <button key={t} onClick={() => setType(t)}
          style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: type === t ? 'white' : 'transparent', color: type === t ? '#111827' : '#6b7280', boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
          {t === 'sent' ? '↑ Sent (money in)' : '↓ Received (money out)'}
        </button>
      ))}
    </div>
  )

  // ── Pick method ──────────────────────────────────────────────────────────
  if (stage === 'pick') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>New invoice</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>How do you want to add it?</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button onClick={() => setStage('upload')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '2px solid #f0f0f0', borderRadius: 16, padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>📎</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Upload invoice</p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>Upload a PDF or photo — Claude reads it and fills in the details for you automatically.</p>
            </div>
          </button>
          <button onClick={() => setStage('form')}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 18, textAlign: 'left', background: 'white', border: '2px solid #f0f0f0', borderRadius: 16, padding: '24px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#93c5fd')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#f0f0f0')}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>✏️</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Fill in manually</p>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>Enter the invoice details yourself.</p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  if (stage === 'upload') {
    return (
      <div style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={goBack} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Upload invoice</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>PDF or image — Claude will read it</p>
          </div>
        </div>

        <TypeToggle />

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{ border: `2px dashed ${dragging ? '#3b82f6' : file ? '#86efac' : '#e5e7eb'}`, borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: dragging ? '#eff6ff' : file ? '#f0fdf4' : '#fafafa', transition: 'all 0.2s', marginBottom: 20 }}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          {file ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#16a34a', marginBottom: 4 }}>{file.name}</p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>Click to change file</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Drop your invoice here</p>
              <p style={{ fontSize: 13, color: '#9ca3af' }}>or click to pick a file · PDF, JPG, PNG</p>
            </>
          )}
        </div>

        {error && <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{error}</p>}

        <button onClick={handleScan} disabled={!file}
          style={{ width: '100%', background: file ? '#2563eb' : '#e5e7eb', color: file ? 'white' : '#9ca3af', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: file ? 'pointer' : 'not-allowed' }}>
          Scan invoice →
        </button>
      </div>
    )
  }

  // ── Scanning ─────────────────────────────────────────────────────────────
  if (stage === 'scanning') {
    return (
      <div style={{ maxWidth: 520, textAlign: 'center', paddingTop: 80 }}>
        <div style={{ width: 64, height: 64, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Reading your invoice...</h2>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Claude is extracting the details</p>
      </div>
    )
  }

  // ── Form (manual or post-scan review) ────────────────────────────────────
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={goBack} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>
            {scanned ? 'Review invoice' : 'New invoice'}
          </h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>
            {scanned ? 'Check the details and confirm' : 'Fill in the invoice details'}
          </p>
        </div>
      </div>

      {scanned && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <p style={{ fontSize: 14, color: '#16a34a', fontWeight: 500 }}>Invoice scanned — review the details below and correct anything if needed</p>
        </div>
      )}

      <TypeToggle />

      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label style={labelStyle}>{type === 'sent' ? 'Client name' : 'Supplier name'}</label>
          <input type="text" value={counterparty} onChange={e => setCounterparty(e.target.value)}
            placeholder={type === 'sent' ? 'e.g. Acme Oy' : 'e.g. Office Depot'} style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Invoice number <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
            <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="e.g. 2024-001" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          </div>
          <div>
            <label style={labelStyle}>Description <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Web design services" style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Net amount (€)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>€</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setVatAmount('') }}
                placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>VAT rate</label>
            <select value={vatRate} onChange={e => { setVatRate(parseFloat(e.target.value)); setVatAmount('') }}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>VAT amount (€)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>€</span>
              <input type="number" min="0" step="0.01" value={vatAmount !== '' ? vatAmount : net > 0 ? computedVat.toFixed(2) : ''}
                onChange={e => setVatAmount(e.target.value)} placeholder="auto"
                style={{ ...inputStyle, paddingLeft: 28 }}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          </div>
        </div>

        {net > 0 && (
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: '#6b7280' }}>Net €{net.toFixed(2)} + VAT €{computedVat.toFixed(2)}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Total €{total.toFixed(2)}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Issue date</label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
          </div>
          {type === 'sent' && (
            <div>
              <label style={labelStyle}>Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          )}
        </div>

        <button onClick={() => setAlreadyPaid(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: `1.5px solid ${alreadyPaid ? '#86efac' : '#e5e7eb'}`, borderRadius: 12, padding: '13px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: alreadyPaid ? '#16a34a' : 'white', border: alreadyPaid ? 'none' : '2px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {alreadyPaid && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Already paid</p>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>{type === 'sent' ? 'Client has already paid this' : 'You have already paid this bill'}</p>
          </div>
        </button>

        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
            📄 View uploaded invoice
          </a>
        )}

        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <button onClick={handleSave} disabled={saving}
          style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save invoice →'}
        </button>
      </div>
    </div>
  )
}
