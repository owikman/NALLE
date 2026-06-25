'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PlanAction { action: string; timeline: string; impact: string }
interface PlanSection { title: string; priority: string; icon: string; insight: string; actions: PlanAction[] }
interface Plan { title: string; summary: string; health_score: number; sections: PlanSection[] }
interface SavedPlan { id: string; title: string; summary: string; health_score: number; content: Plan; created_at: string }

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  high:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  low:    { bg: '#eff6ff', color: '#2563eb', border: '#dbeafe' },
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
        supabase.from('financial_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])
      setIsPremium(!!profile?.is_premium)
      setPlans(savedPlans ?? [])
      if (savedPlans && savedPlans.length > 0) setActivePlan(savedPlans[0]!.content as Plan)
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === 'true') { setIsPremium(true); window.history.replaceState({}, '', '/plans') }
    }
    load()
  }, [])

  async function handleUpgrade() {
    setUpgrading(true); setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else throw new Error(json.error ?? 'Failed to create checkout')
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); setUpgrading(false) }
  }

  async function handleGenerate() {
    setGenerating(true); setError(null)
    try {
      const res = await fetch('/api/plans/generate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setActivePlan(json.plan)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { const { data } = await supabase.from('financial_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5); setPlans(data ?? []) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to generate plan') }
    finally { setGenerating(false) }
  }

  if (isPremium === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}><p style={{ color: '#9ca3af', fontSize: 14 }}>Loading...</p></div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Financial Plans</h1>
          <p style={{ fontSize: 14, color: '#9ca3af' }}>AI-generated roadmap for your business</p>
        </div>
        {isPremium && (
          <button onClick={handleGenerate} disabled={generating} style={{ background: '#2563eb', color: 'white', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, border: 'none', cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {generating ? <><span style={{ width: 12, height: 12, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} /> Generating...</> : '✦ Generate new plan'}
          </button>
        )}
      </div>

      {error && <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, color: '#dc2626' }}>{error}</div>}

      {!isPremium ? (
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', borderRadius: 20, padding: 40, color: 'white', marginBottom: 24 }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '4px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 20 }}>PREMIUM</div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Everything you need to run a smarter business</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 32, maxWidth: 480, lineHeight: 1.7, fontSize: 15 }}>
            Built for Finnish entrepreneurs — tax-smart, compliance-aware, and tailored to your exact numbers.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
            {[
              { icon: '📊', title: 'AI Financial Plan', desc: 'Personalized growth roadmap and 3–6 month action plan generated from your data' },
              { icon: '🧠', title: 'Tax Strategy', desc: 'Finnish-specific optimization — YEL, VAT, and salary vs. dividend split for OY owners' },
              { icon: '💧', title: 'Cash Flow Coaching', desc: 'Identify cash flow risks and get specific actions to improve your runway' },
              { icon: '📞', title: 'Expert Consultation', desc: 'Book a 30-minute call with a Finnish financial advisor or accountant' },
              { icon: '🎯', title: 'Growth Strategies', desc: 'Concrete steps to hit your revenue targets and reduce unnecessary costs' },
              { icon: '🔔', title: 'Priority Compliance', desc: 'Never miss a deadline — personalized YEL, VAT and tax prepayment reminders' },
            ].map(f => (
              <div key={f.title} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '18px 20px' }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>{f.icon}</div>
                <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{f.title}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 24, marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                'Unlimited AI CFO conversations',
                'Advanced financial reports',
                'Expense optimization suggestions',
                'Cancel anytime',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                  <span style={{ color: '#86efac', fontWeight: 700, fontSize: 14 }}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <button onClick={handleUpgrade} disabled={upgrading} style={{ background: 'white', color: '#1d4ed8', borderRadius: 14, padding: '14px 28px', fontSize: 15, fontWeight: 700, border: 'none', cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1 }}>
              {upgrading ? 'Redirecting...' : 'Upgrade to Premium →'}
            </button>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>€14.90 / month · Cancel anytime</p>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 16 }}>Trusted by Finnish entrepreneurs</p>
        </div>
      ) : activePlan ? (
        <PlanDisplay plan={activePlan} plans={plans} onSelect={p => setActivePlan(p.content as Plan)} />
      ) : (
        <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: '64px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Generate your first plan</h2>
          <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>NALLE will analyze your financial data and create a personalized roadmap.</p>
          <button onClick={handleGenerate} disabled={generating} style={{ background: '#2563eb', color: 'white', borderRadius: 14, padding: '14px 28px', fontSize: 15, fontWeight: 600, border: 'none', cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.6 : 1 }}>
            {generating ? 'Generating your plan...' : '✦ Generate plan'}
          </button>
        </div>
      )}
    </div>
  )
}

function PlanDisplay({ plan, plans, onSelect }: { plan: Plan; plans: SavedPlan[]; onSelect: (p: SavedPlan) => void }) {
  const healthColor = plan.health_score >= 70 ? '#16a34a' : plan.health_score >= 40 ? '#d97706' : '#dc2626'
  const healthLabel = plan.health_score >= 70 ? 'Healthy' : plan.health_score >= 40 ? 'Needs attention' : 'At risk'

  return (
    <div>
      <div style={{ background: 'white', borderRadius: 20, border: '1px solid #f0f0f0', padding: 28, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{plan.title}</h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{plan.summary}</p>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 36, fontWeight: 800, color: healthColor, lineHeight: 1 }}>{plan.health_score}</p>
          <p style={{ fontSize: 12, fontWeight: 600, color: healthColor, marginTop: 4 }}>{healthLabel}</p>
          <p style={{ fontSize: 11, color: '#9ca3af' }}>/ 100</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {plan.sections.map((section, i) => {
          const p = PRIORITY_COLORS[section.priority] ?? PRIORITY_COLORS['low']!
          return (
            <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 24px', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontSize: 22 }}>{section.icon}</span>
                <h3 style={{ fontWeight: 600, color: '#111827', flex: 1, fontSize: 15 }}>{section.title}</h3>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600, background: p.bg, color: p.color, border: `1px solid ${p.border}`, textTransform: 'capitalize' }}>{section.priority}</span>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>{section.insight}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {section.actions.map((a, j) => (
                    <div key={j} style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: '#3b82f6', marginTop: 2, flexShrink: 0, fontWeight: 600 }}>→</span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>{a.action}</p>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
                          <span>⏱ {a.timeline}</span>
                          <span>✓ {a.impact}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {plans.length > 1 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f0f0f0', padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous plans</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {plans.slice(1).map(p => (
              <button key={p.id} onClick={() => onSelect(p)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{p.title}</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(p.created_at).toLocaleDateString('fi-FI')}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
