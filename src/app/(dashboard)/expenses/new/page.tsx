'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Template { id: string; name: string; category: string; default_amount: number | null; vat_rate: number; description_template: string | null }

const CATEGORY_ICONS: Record<string, string> = { vehicle: '🚗', equipment: '🔧', travel: '✈️', software: '💻', personnel: '👤', other: '📦' }
const CATEGORY_LABELS: Record<string, string> = { vehicle: 'Vehicle', equipment: 'Equipment', travel: 'Travel', software: 'Software', personnel: 'Personnel', other: 'Other' }
const VAT_RATES = [0, 10, 14, 25.5]

const inputStyle = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '13px 16px', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, color: '#111827' }

export default function NewExpensePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [amount, setAmount] = useState('')
  const [vatRate, setVatRate] = useState(25.5)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!)
  const [category, setCategory] = useState('other')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'template' | 'form'>('template')

  useEffect(() => {
    createClient().from('expense_templates').select('*').order('name').then(({ data }) => setTemplates(data ?? []))
  }, [])

  function selectTemplate(t: Template) {
    setSelectedTemplate(t); setCategory(t.category); setVatRate(t.vat_rate)
    if (t.default_amount) setAmount(String(t.default_amount))
    if (t.description_template) setDescription(t.description_template)
    setPhase('form')
  }

  const vatAmount = amount ? parseFloat(amount) * (vatRate / (100 + vatRate)) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !description) { setError('Amount and description are required.'); return }
    setLoading(true); setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('expense_logs').insert({ user_id: user.id, template_id: selectedTemplate?.id ?? null, amount: parseFloat(amount), vat_amount: parseFloat(vatAmount.toFixed(2)), category, description, date })
    if (err) { setError(err.message); setLoading(false) }
    else { router.push('/expenses'); router.refresh() }
  }

  if (phase === 'template') {
    const grouped = templates.reduce((acc, t) => { if (!acc[t.category]) acc[t.category] = []; acc[t.category]!.push(t); return acc }, {} as Record<string, Template[]>)

    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Log expense</h1>
            <p style={{ fontSize: 14, color: '#9ca3af' }}>Pick a template or start from scratch</p>
          </div>
        </div>

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

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => setPhase('template')} style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>←</button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{selectedTemplate ? selectedTemplate.name : 'New expense'}</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>Fill in the details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Amount (€)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 500 }}>€</span>
            <input autoFocus type="number" min="0" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 32 }} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
          </div>
          {amount && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>VAT included: €{vatAmount.toFixed(2)} ({vatRate}%)</p>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Description</label>
          <input type="text" required value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Date</label>
          <input type="date" required value={date} onChange={e => setDate(e.target.value)} style={inputStyle} onFocus={e => e.target.style.borderColor = '#3b82f6'} onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Category</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} style={{ padding: '12px 8px', borderRadius: 12, border: category === cat ? '1.5px solid #3b82f6' : '1px solid #e5e7eb', background: category === cat ? '#eff6ff' : 'white', color: category === cat ? '#1d4ed8' : '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {icon} {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>VAT rate</label>
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
