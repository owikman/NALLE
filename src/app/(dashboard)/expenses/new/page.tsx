'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Template { id: string; name: string; category: string; default_amount: number | null; vat_rate: number; description_template: string | null }

const CATEGORY_ICONS: Record<string, string> = { vehicle: '🚗', equipment: '🔧', travel: '✈️', software: '💻', personnel: '👤', other: '📦' }
const CATEGORY_LABELS: Record<string, string> = { vehicle: 'Vehicle', equipment: 'Equipment', travel: 'Travel', software: 'Software', personnel: 'Personnel', other: 'Other' }
const VAT_RATES = [0, 10, 14, 25.5]
const MILEAGE_RATE = 0.22 // €/km, Finnish Vero standard rate

const inputStyle = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '13px 16px', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, color: '#111827' }
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 } as const

type Mode = 'expense' | 'mileage' | 'scan'
type Phase = 'template' | 'form'

export default function NewExpensePage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<Mode>('expense')
  const [phase, setPhase] = useState<Phase>('template')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  // Expense form state
  const [amount, setAmount] = useState('')
  const [vatRate, setVatRate] = useState(25.5)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)
  const [category, setCategory] = useState('other')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)

  // Mileage state
  const [mFrom, setMFrom] = useState('')
  const [mTo, setMTo] = useState('')
  const [mKm, setMKm] = useState('')
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]!)
  const [mPurpose, setMPurpose] = useState('')

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanPreview, setScanPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('expense_templates').select('*').order('name').then(({ data }) => setTemplates(data ?? []))
  }, [])

  function switchMode(m: Mode) {
    setMode(m); setError(null)
    if (m === 'expense') setPhase('template')
  }

  function selectTemplate(t: Template) {
    setSelectedTemplate(t); setCategory(t.category); setVatRate(t.vat_rate)
    if (t.default_amount) setAmount(String(t.default_amount))
    if (t.description_template) setDescription(t.description_template)
    setPhase('form')
  }

  const vatAmount = amount ? parseFloat(amount) * (vatRate / (100 + vatRate)) : 0
  const mileageTotal = mKm ? parseFloat(mKm) * MILEAGE_RATE : 0

  async function handleExpenseSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !description) { setError('Amount and description are required.'); return }
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('expense_logs').insert({
      user_id: user.id,
      template_id: selectedTemplate?.id ?? null,
      amount: parseFloat(amount),
      vat_amount: parseFloat(vatAmount.toFixed(2)),
      category, description, date,
      receipt_url: receiptUrl ?? null,
    })
    if (err) { setError(err.message); setLoading(false) }
    else { router.push('/expenses'); router.refresh() }
  }

  async function handleMileageSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mKm || !mFrom || !mTo) { setError('From, To, and Distance are required.'); return }
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const desc = mPurpose ? `Mileage: ${mFrom} → ${mTo} (${mPurpose})` : `Mileage: ${mFrom} → ${mTo}`
    const { error: err } = await supabase.from('expense_logs').insert({
      user_id: user.id,
      amount: parseFloat(mileageTotal.toFixed(2)),
      vat_amount: 0,
      category: 'vehicle',
      description: desc,
      date: mDate,
      mileage_km: parseFloat(mKm),
      mileage_from: mFrom,
      mileage_to: mTo,
    })
    if (err) { setError(err.message); setLoading(false) }
    else { router.push('/expenses'); router.refresh() }
  }

  async function handleScanFile(file: File) {
    setScanning(true); setError(null)
    setScanPreview(URL.createObjectURL(file))
    const fd = new FormData(); fd.append('image', file)
    try {
      const res = await fetch('/api/expenses/scan-receipt', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      // Pre-fill expense form
      setAmount(String(json.amount ?? ''))
      setDate(json.date ?? new Date().toISOString().split('T')[0]!)
      setDescription(json.description ?? '')
      setCategory(json.category ?? 'other')
      setVatRate(json.vat_rate ?? 25.5)
      setReceiptUrl(json.receipt_url ?? null)
      setSelectedTemplate(null)
      setMode('expense'); setPhase('form')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not scan receipt')
    } finally {
      setScanning(false)
    }
  }

  const modeTabs = (
    <div style={{ display: 'flex', gap: 6, marginBottom: 28, background: '#f9fafb', borderRadius: 12, padding: 4 }}>
      {(['expense', 'mileage', 'scan'] as Mode[]).map(m => (
        <button key={m} onClick={() => switchMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', background: mode === m ? 'white' : 'transparent', color: mode === m ? '#111827' : '#6b7280', fontSize: 13, fontWeight: mode === m ? 600 : 400, cursor: 'pointer', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
          {m === 'expense' ? '💳 Expense' : m === 'mileage' ? '🚗 Mileage' : '📷 Scan receipt'}
        </button>
      ))}
    </div>
  )

  // ── Mileage mode ─────────────────────────────────────────────────────────
  if (mode === 'mileage') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Log mileage</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>€{MILEAGE_RATE}/km · Finnish Vero standard rate</p>
          </div>
        </div>
        {modeTabs}
        <form onSubmit={handleMileageSubmit} style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>From</label>
              <input type="text" required value={mFrom} onChange={e => setMFrom(e.target.value)} placeholder="e.g. Helsinki" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            </div>
            <div>
              <label style={labelStyle}>To</label>
              <input type="text" required value={mTo} onChange={e => setMTo(e.target.value)} placeholder="e.g. Espoo" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Distance (km)</label>
            <input autoFocus type="number" min="0" step="0.1" required value={mKm} onChange={e => setMKm(e.target.value)} placeholder="0" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
            {mKm && (
              <p style={{ fontSize: 13, color: '#2563eb', marginTop: 8, fontWeight: 500 }}>
                {mKm} km × €{MILEAGE_RATE} = <strong>€{mileageTotal.toFixed(2)}</strong>
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Purpose / notes</label>
            <input type="text" value={mPurpose} onChange={e => setMPurpose(e.target.value)} placeholder="e.g. Client meeting" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" required value={mDate} onChange={e => setMDate(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>
          {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Saving...' : `Save · €${mileageTotal.toFixed(2)}`}
          </button>
        </form>
      </div>
    )
  }

  // ── Scan mode ─────────────────────────────────────────────────────────────
  if (mode === 'scan') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Scan receipt</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>AI extracts amount, date and category automatically</p>
          </div>
        </div>
        {modeTabs}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleScanFile(f) }} />

        <div
          onClick={() => !scanning && fileRef.current?.click()}
          style={{ background: 'white', borderRadius: 20, border: `2px dashed ${scanning ? '#3b82f6' : '#e5e7eb'}`, padding: 48, textAlign: 'center', cursor: scanning ? 'default' : 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'border-color 0.15s' }}
          onMouseEnter={e => { if (!scanning) (e.currentTarget as HTMLElement).style.borderColor = '#93c5fd' }}
          onMouseLeave={e => { if (!scanning) (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb' }}
        >
          {scanPreview && (
            <img src={scanPreview} alt="Receipt preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, marginBottom: 20, objectFit: 'contain' }} />
          )}
          {scanning ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#2563eb', marginBottom: 4 }}>Reading receipt...</p>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>Claude is extracting the details</p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{scanPreview ? '📷' : '🧾'}</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                {scanPreview ? 'Tap to use a different photo' : 'Take a photo or upload'}
              </p>
              <p style={{ fontSize: 14, color: '#9ca3af' }}>JPG, PNG, HEIC — any receipt photo</p>
            </>
          )}
        </div>
        {error && <p style={{ marginTop: 16, fontSize: 13, color: '#dc2626', textAlign: 'center' }}>{error}</p>}
      </div>
    )
  }

  // ── Expense mode: template picker ─────────────────────────────────────────
  if (phase === 'template') {
    const grouped = templates.reduce((acc, t) => { if (!acc[t.category]) acc[t.category] = []; acc[t.category]!.push(t); return acc }, {} as Record<string, Template[]>)
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Log expense</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Pick a template or start from scratch</p>
          </div>
        </div>
        {modeTabs}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {items.map(t => (
                  <button key={t.id} onClick={() => selectTemplate(t)} style={{ textAlign: 'left', background: 'white', border: '1px solid #f0f0f0', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{t.name}</p>
                    {t.default_amount && <p style={{ fontSize: 13, color: '#9ca3af' }}>€{t.default_amount}</p>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setPhase('form')} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px', fontSize: 14, fontWeight: 500, color: '#6b7280', background: 'white', cursor: 'pointer' }}>
          Start from scratch
        </button>
      </div>
    )
  }

  // ── Expense mode: form ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => setPhase('template')} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{selectedTemplate ? selectedTemplate.name : 'New expense'}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>{receiptUrl ? '🧾 Receipt scanned' : 'Fill in the details'}</p>
        </div>
      </div>
      {modeTabs}
      <form onSubmit={handleExpenseSubmit} style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={labelStyle}>Amount (€)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 500 }}>€</span>
            <input autoFocus type="number" min="0" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 32 }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>
          {amount && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>VAT included: €{vatAmount.toFixed(2)} ({vatRate}%)</p>}
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <input type="text" required value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} style={{ padding: '12px 8px', borderRadius: 12, border: category === cat ? '1.5px solid #3b82f6' : '1px solid #e5e7eb', background: category === cat ? '#eff6ff' : 'white', color: category === cat ? '#1d4ed8' : '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {icon} {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>VAT rate</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {VAT_RATES.map(rate => (
              <button key={rate} type="button" onClick={() => setVatRate(rate)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: vatRate === rate ? '1.5px solid #3b82f6' : '1px solid #e5e7eb', background: vatRate === rate ? '#eff6ff' : 'white', color: vatRate === rate ? '#1d4ed8' : '#6b7280', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                {rate}%
              </button>
            ))}
          </div>
        </div>
        {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving...' : 'Save expense'}
        </button>
      </form>
    </div>
  )
}
