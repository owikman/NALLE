'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function IntakePage() {
  const router = useRouter()
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
      const res = await fetch('/api/intake/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalAnswers),
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
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Financial intake</span>
          <span>{step + 1} of {STEPS.length}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {currentStep.question}
        </h2>
        {currentStep.subtext && (
          <p className="text-sm text-gray-400 mb-6">{currentStep.subtext}</p>
        )}
        {!currentStep.subtext && <div className="mb-6" />}

        {/* Input types */}
        {(currentStep.type === 'text') && (
          <input
            autoFocus
            type="text"
            value={current as string}
            onChange={e => handleAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentStep.placeholder}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}

        {currentStep.type === 'currency' && (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
            <input
              autoFocus
              type="number"
              min={0}
              step="0.01"
              value={current as number}
              onChange={e => handleAnswer(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              placeholder={currentStep.placeholder}
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {currentStep.type === 'select' && (
          <div className="space-y-2">
            {currentStep.options!.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  current === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {currentStep.type === 'boolean' && (
          <div className="flex gap-3">
            {[{ value: true, label: 'Yes' }, { value: false, label: 'No' }].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => handleAnswer(opt.value)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  current === opt.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={handleBack}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : step === STEPS.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-1.5 mt-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-6 bg-blue-500' : i < step ? 'w-1.5 bg-blue-200' : 'w-1.5 bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
