'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  name: string
  category: string
  default_amount: number | null
  vat_rate: number
  description_template: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  vehicle: '🚗',
  equipment: '🔧',
  travel: '✈️',
  software: '💻',
  personnel: '👤',
  other: '📦',
}

const VAT_RATES = [0, 10, 14, 25.5]

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
    const supabase = createClient()
    supabase
      .from('expense_templates')
      .select('*')
      .order('name')
      .then(({ data }) => setTemplates(data ?? []))
  }, [])

  function selectTemplate(t: Template) {
    setSelectedTemplate(t)
    setCategory(t.category)
    setVatRate(t.vat_rate)
    if (t.default_amount) setAmount(String(t.default_amount))
    if (t.description_template) setDescription(t.description_template)
    setPhase('form')
  }

  function skipTemplate() {
    setSelectedTemplate(null)
    setPhase('form')
  }

  const vatAmount = amount ? parseFloat(amount) * (vatRate / (100 + vatRate)) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !description) {
      setError('Amount and description are required.')
      return
    }
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('expense_logs').insert({
      user_id: user.id,
      template_id: selectedTemplate?.id ?? null,
      amount: parseFloat(amount),
      vat_amount: parseFloat(vatAmount.toFixed(2)),
      category,
      description,
      date,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/expenses')
      router.refresh()
    }
  }

  if (phase === 'template') {
    const grouped = templates.reduce((acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category]!.push(t)
      return acc
    }, {} as Record<string, Template[]>)

    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Log expense</h1>
            <p className="text-sm text-gray-500">Pick a template or start from scratch</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                {CATEGORY_ICONS[cat]} {cat}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {items.map(t => (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className="text-left bg-white border border-gray-100 rounded-xl p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                    {t.default_amount && (
                      <p className="text-xs text-gray-400 mt-0.5">€{t.default_amount}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={skipTemplate}
          className="w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Start from scratch
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPhase('template')} className="text-gray-400 hover:text-gray-600">
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {selectedTemplate ? selectedTemplate.name : 'New expense'}
          </h1>
          <p className="text-sm text-gray-500">Fill in the details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (€)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-xl pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {amount && (
            <p className="text-xs text-gray-400 mt-1">
              VAT included: €{vatAmount.toFixed(2)} ({vatRate}%)
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <input
            type="text"
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
                  category === cat
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {icon} {cat}
              </button>
            ))}
          </div>
        </div>

        {/* VAT rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">VAT rate</label>
          <div className="flex gap-2">
            {VAT_RATES.map(rate => (
              <button
                key={rate}
                type="button"
                onClick={() => setVatRate(rate)}
                className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                  vatRate === rate
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : 'Save expense'}
        </button>
      </form>
    </div>
  )
}
