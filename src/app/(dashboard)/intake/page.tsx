'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Answer = string | number | boolean | null

interface Step {
  key: string
  question: string
  subtext?: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'currency'
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}

const STEPS: Step[] = [
  {
    key: 'business_name',
    question: "What's your business name?",
    type: 'text',
    placeholder: 'e.g. Wikman Consulting',
    required: true,
  },
  {
    key: 'business_type',
    question: 'What type of business do you run?',
    type: 'select',
    options: [
      { value: 'toiminimi', label: 'Toiminimi (sole trader)' },
      { value: 'oy', label: 'Osakeyhtiö (OY)' },
      { value: 'ky', label: 'Kommandiittiyhtiö (KY)' },
      { value: 'sole_trader', label: 'Other sole trader' },
    ],
    required: true,
  },
  {
    key: 'industry',
    question: 'What industry are you in?',
    type: 'text',
    placeholder: 'e.g. Consulting, Construction, Retail',
    required: true,
  },
  {
    key: 'employee_count',
    question: 'How many employees do you have?',
    subtext: 'Not counting yourself',
    type: 'number',
    placeholder: '0',
    required: true,
  },
  {
    key: 'bank_balance',
    question: "What's your current bank balance?",
    subtext: 'Total across all business accounts',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'monthly_revenue',
    question: 'How much do you earn on average per month?',
    subtext: 'Your typical monthly revenue before costs',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'monthly_costs',
    question: 'What are your total monthly costs?',
    subtext: 'Include rent, salaries, subscriptions, loan repayments — everything',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'accounts_receivable',
    question: 'How much do clients currently owe you?',
    subtext: 'Total of unpaid invoices sent to clients',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'accounts_payable',
    question: 'How much do you currently owe others?',
    subtext: 'Unpaid supplier invoices, bills, etc.',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'upcoming_large_expense',
    question: 'Any big expenses coming up in the next 3 months?',
    subtext: 'Equipment, tax payments, renovations — leave at 0 if none',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'expected_large_income',
    question: 'Any large payments expected in the next 3 months?',
    subtext: 'Big contracts, grants, asset sales — leave at 0 if none',
    type: 'currency',
    placeholder: '0',
    required: true,
  },
  {
    key: 'vat_registered',
    question: 'Are you registered for VAT (ALV)?',
    type: 'boolean',
    required: true,
  },
  {
    key: 'is_salary_payer',
    question: 'Do you pay salaries to employees?',
    type: 'boolean',
    required: true,
  },
  {
    key: 'yel_registered',
    question: 'Do you have YEL entrepreneur pension insurance?',
    subtext: 'Required for most self-employed people in Finland',
    type: 'boolean',
    required: true,
  },
  {
    key: 'tyel_registered',
    question: 'Do you have TyEL employee pension insurance?',
    subtext: 'Required if you pay employee salaries',
    type: 'boolean',
    required: true,
  },
]

function IntakeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editCompanyId = searchParams.get('company')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [current, setCurrent] = useState<Answer>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStep = STEPS[step]!
  const progress = ((step) / STEPS.length) * 100

  function handleAnswer(value: Answer) {
    setCurrent(value)
    setError(null)
  }

  async function handleNext() {
    if (currentStep.required && (current === '' || current === null)) {
      setError('Please answer this question to continue.')
      return
    }

    const newAnswers = { ...answers, [currentStep.key]: current }
    setAnswers(newAnswers)

    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
      setCurrent(newAnswers[STEPS[step + 1]!.key] ?? '')
    } else {
      await handleComplete(newAnswers)
    }
  }

  function handleBack() {
    if (step === 0) return
    setStep(s => s - 1)
    setCurrent(answers[STEPS[step - 1]!.key] ?? '')
    setError(null)
  }

  async function handleComplete(finalAnswers: Record<string, Answer>) {
    setLoading(true)
    setError(null)
    try {
      const payload = editCompanyId
        ? { answers: finalAnswers, company_id: editCompanyId }
        : finalAnswers
      const res = await fetch('/api/intake/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong saving your answers.')
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && currentStep.type !== 'select' && currentStep.type !== 'boolean') {
      handleNext()
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 40 }}>
      {/* Progress */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Financial intake</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{step + 1} / {STEPS.length}</span>
        </div>
        <div style={{ height: 2, background: '#f3f4f6', borderRadius: 99 }}>
          <div style={{ height: '100%', background: '#3b82f6', borderRadius: 99, width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Card */}
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '48px 48px 40px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', marginBottom: 8, lineHeight: 1.3 }}>
          {currentStep.question}
        </h2>
        {currentStep.subtext && (
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32, lineHeight: 1.5 }}>{currentStep.subtext}</p>
        )}
        {!currentStep.subtext && <div style={{ marginBottom: 32 }} />}

        {(currentStep.type === 'text') && (
          <input
            autoFocus
            type="text"
            value={current as string}
            onChange={e => handleAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentStep.placeholder}
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        )}

        {currentStep.type === 'number' && (
          <input
            autoFocus
            type="number"
            min={0}
            value={current as number}
            onChange={e => handleAnswer(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder={currentStep.placeholder}
            style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
            onFocus={e => e.target.style.borderColor = '#3b82f6'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        )}

        {currentStep.type === 'currency' && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontWeight: 500, fontSize: 15 }}>€</span>
            <input
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={current as number}
              onChange={e => handleAnswer(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              placeholder={currentStep.placeholder}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px 14px 32px', fontSize: 15, outline: 'none', boxSizing: 'border-box', color: '#111827' }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
        )}

        {currentStep.type === 'select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentStep.options!.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                style={{
                  width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: 12,
                  border: current === opt.value ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
                  background: current === opt.value ? '#eff6ff' : 'white',
                  color: current === opt.value ? '#1d4ed8' : '#374151',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {currentStep.type === 'boolean' && (
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => handleAnswer(opt.value)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 12,
                  border: current === opt.value ? '1.5px solid #3b82f6' : '1px solid #e5e7eb',
                  background: current === opt.value ? '#eff6ff' : 'white',
                  color: current === opt.value ? '#1d4ed8' : '#374151',
                  fontSize: 15, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {error && <p style={{ marginTop: 12, fontSize: 13, color: '#ef4444' }}>{error}</p>}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
          {step > 0 && (
            <button
              onClick={handleBack}
              style={{ padding: '14px 24px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 500, color: '#6b7280', background: 'white', cursor: 'pointer' }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            style={{ flex: 1, background: '#2563eb', color: 'white', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
          >
            {loading ? 'Saving...' : step === STEPS.length - 1 ? 'Complete' : 'Continue →'}
          </button>
        </div>
      </div>

      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4, borderRadius: 99, transition: 'all 0.2s',
              width: i === step ? 24 : 4,
              background: i === step ? '#3b82f6' : i < step ? '#bfdbfe' : '#e5e7eb',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function IntakePage() {
  return (
    <Suspense>
      <IntakeForm />
    </Suspense>
  )
}
