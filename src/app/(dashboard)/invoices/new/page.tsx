'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type InvoiceType = 'sent' | 'received'

const VAT_RATES = [
  { label: '0%', value: 0 },
  { label: '10%', value: 10 },
  { label: '14%', value: 14 },
  { label: '24%', value: 24 },
  { label: '25.5%', value: 25.5 },
]

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
  const [type, setType] = useState<InvoiceType>('sent')
  const [counterparty, setCounterparty] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [vatRate, setVatRate] = useState(24)
  const [issueDate, setIssueDate] = useState(today)
  const [dueDate, setDueDate] = useState(in30)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const net = parseFloat(amount) || 0
  const vat = parseFloat(((net * vatRate) / 100).toFixed(2))
  const total = net + vat

  async function handleSubmit() {
    if (!counterparty.trim()) { setError('Please enter a name'); return }
    if (!amount || net <= 0) { setError('Please enter an amount'); return }
    setLoading(true); setError(null)
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
          vat_amount: vat,
          issue_date: issueDate,
          due_date: type === 'sent' ? dueDate : null,
          paid: alreadyPaid,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/invoices')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>New invoice</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Add an invoice to your records</p>
        </div>
      </div>

      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {([['sent', '↑ Sent (money in)'], ['received', '↓ Received (money out)']] as [InvoiceType, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setType(t)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, background: type === t ? 'white' : 'transparent', color: type === t ? '#111827' : '#6b7280', boxShadow: type === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Net amount (€)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>€</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }}
                onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#e5e7eb')} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>VAT rate</label>
            <select value={vatRate} onChange={e => setVatRate(parseFloat(e.target.value))}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {VAT_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {/* Total preview */}
        {net > 0 && (
          <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              <span>Net €{net.toFixed(2)}</span>
              {vat > 0 && <span style={{ marginLeft: 12 }}>+ VAT €{vat.toFixed(2)}</span>}
            </div>
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

        {/* Already paid toggle */}
        <button onClick={() => setAlreadyPaid(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '13px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: alreadyPaid ? '#16a34a' : 'white', border: alreadyPaid ? 'none' : '2px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {alreadyPaid && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Already paid</p>
            <p style={{ fontSize: 12, color: '#9ca3af' }}>{type === 'sent' ? 'Client has already paid this invoice' : 'You have already paid this bill'}</p>
          </div>
        </button>

        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving...' : 'Save invoice →'}
        </button>
      </div>
    </div>
  )
}
