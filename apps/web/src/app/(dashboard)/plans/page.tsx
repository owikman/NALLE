'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PlanAction {
  action: string
  timeline: string
  impact: string
}

interface PlanSection {
  title: string
  priority: string
  icon: string
  insight: string
  actions: PlanAction[]
}

interface Plan {
  title: string
  summary: string
  health_score: number
  sections: PlanSection[]
}

interface SavedPlan {
  id: string
  title: string
  summary: string
  health_score: number
  content: Plan
  created_at: string
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-600 border-red-100',
  medium: 'bg-amber-50 text-amber-600 border-amber-100',
  low: 'bg-blue-50 text-blue-600 border-blue-100',
}

export default function PlansPage() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [plans, setPlans] = useState<SavedPlan[]>([])
  const [activePlan, setActivePlan] = useState<Plan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: profile }, { data: savedPlans }] = await Promise.all([
        supabase.from('profiles').select('is_premium').eq('id', user.id).single(),
        supabase.from('financial_plans').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(5),
      ])

      setIsPremium(!!profile?.is_premium)
      setPlans(savedPlans ?? [])
      if (savedPlans && savedPlans.length > 0) {
        setActivePlan(savedPlans[0]!.content as Plan)
      }

      // Handle Stripe redirect
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === 'true') {
        setIsPremium(true)
        window.history.replaceState({}, '', '/plans')
      }
    }
    load()
  }, [])

  async function handleUpgrade() {
    setUpgrading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else throw new Error(json.error ?? 'Failed to create checkout')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setUpgrading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/plans/generate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setActivePlan(json.plan)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('financial_plans').select('*')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
        setPlans(data ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
    } finally {
      setGenerating(false)
    }
  }

  if (isPremium === null) {
    return <div className="flex items-center justify-center h-40"><p className="text-gray-400 text-sm">Loading...</p></div>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated roadmap for your business</p>
        </div>
        {isPremium && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {generating ? (
              <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            ) : '✦ Generate new plan'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {!isPremium ? (
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white mb-6">
          <div className="text-4xl mb-4">✦</div>
          <h2 className="text-2xl font-bold mb-2">NALLE Premium</h2>
          <p className="text-blue-100 mb-6 max-w-md">
            Get a personalized AI-generated financial plan — growth roadmap, tax strategy, and cash flow actions tailored to your exact numbers.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: '📈', title: 'Growth Roadmap', desc: '3-6 month action plan' },
              { icon: '💶', title: 'Tax Strategy', desc: 'Finnish-specific optimization' },
              { icon: '💧', title: 'Cash Flow', desc: 'Specific improvement actions' },
            ].map(f => (
              <div key={f.title} className="bg-white/10 rounded-xl p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-xs text-blue-200 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="bg-white text-blue-700 rounded-xl px-6 py-3 font-semibold hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            {upgrading ? 'Redirecting...' : 'Upgrade to Premium →'}
          </button>
        </div>
      ) : activePlan ? (
        <PlanDisplay plan={activePlan} plans={plans} onSelect={p => setActivePlan(p.content as Plan)} />
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">✦</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Generate your first plan</h2>
          <p className="text-sm text-gray-400 mb-6">NALLE will analyze your financial data and create a personalized roadmap.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-blue-600 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating your plan...' : '✦ Generate plan'}
          </button>
        </div>
      )}
    </div>
  )
}

function PlanDisplay({ plan, plans, onSelect }: {
  plan: Plan
  plans: SavedPlan[]
  onSelect: (p: SavedPlan) => void
}) {
  const healthColor = plan.health_score >= 70 ? '#10b981' : plan.health_score >= 40 ? '#f59e0b' : '#f87171'
  const healthLabel = plan.health_score >= 70 ? 'Healthy' : plan.health_score >= 40 ? 'Needs attention' : 'At risk'

  return (
    <div>
      {/* Header card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{plan.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{plan.summary}</p>
          </div>
          <div className="text-center shrink-0">
            <div className="text-3xl font-bold" style={{ color: healthColor }}>{plan.health_score}</div>
            <div className="text-xs font-medium mt-0.5" style={{ color: healthColor }}>{healthLabel}</div>
            <div className="text-xs text-gray-400">/ 100</div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3 mb-6">
        {plan.sections.map((section, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
              <span className="text-xl">{section.icon}</span>
              <h3 className="font-semibold text-gray-900 flex-1">{section.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PRIORITY_STYLES[section.priority] ?? PRIORITY_STYLES['low']}`}>
                {section.priority}
              </span>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-4">{section.insight}</p>
              <div className="space-y-3">
                {section.actions.map((a, j) => (
                  <div key={j} className="flex gap-3 text-sm">
                    <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                    <div>
                      <p className="font-medium text-gray-800">{a.action}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>⏱ {a.timeline}</span>
                        <span>✓ {a.impact}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Past plans */}
      {plans.length > 1 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Previous plans</p>
          <div className="space-y-2">
            {plans.slice(1).map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-700">{p.title}</span>
                <span className="text-xs text-gray-400">
                  {new Date(p.created_at).toLocaleDateString('fi-FI')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
