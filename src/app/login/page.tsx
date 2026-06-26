'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'var(--bg)',
    }} className="auth-split">
      {/* Left panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: 48,
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <div style={{
              width: 32, height: 32, background: '#111110', borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={15} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.4px' }}>NALLE</span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10, fontSize: 14,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text)' }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 10, fontSize: 14,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 12px',
                background: 'var(--danger-subtle)', borderRadius: 8,
                color: 'var(--danger)', fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '10px',
                background: loading ? 'var(--border)' : '#111110',
                color: 'white', border: 'none',
                borderRadius: 10, fontSize: 14, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            No account?{' '}
            <a href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Create one
            </a>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right-panel" style={{
        width: 480, background: '#111110',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: 64,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 32 }}>
          What NALLE does
        </p>
        {[
          { title: 'Understands your business', desc: 'Guided intake that builds your financial profile in minutes.' },
          { title: 'Tracks everything automatically', desc: 'Expenses, compliance deadlines, and cash flow in one place.' },
          { title: 'Speaks your language', desc: 'Ask about your numbers in plain Finnish or English — no jargon.' },
          { title: 'Builds your financial plan', desc: 'Premium AI analysis turns your data into a 90-day roadmap.' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: 28 }}>
            <p style={{ color: 'white', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>{item.title}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.5 }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
