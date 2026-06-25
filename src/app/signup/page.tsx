'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

export default function SignupPage() {
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
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/intake')
      router.refresh()
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 10, fontSize: 14,
    background: 'var(--surface)',
    color: 'var(--text)', outline: 'none',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
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
            Create your account
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
            Set up in under 5 minutes
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email</label>
              <input
                type="email" required autoFocus value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
              <input
                type="password" required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                style={inputStyle}
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
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '10px',
                background: loading ? 'var(--border)' : '#111110',
                color: 'white', border: 'none',
                borderRadius: 10, fontSize: 14, fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating account...' : 'Get started'}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Sign in</a>
          </p>
        </div>
      </div>

      <div style={{
        width: 480, background: '#111110',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: 64,
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 32 }}>
          Built for Finnish entrepreneurs
        </p>
        {[
          { stat: '5 min', label: 'to complete your financial intake' },
          { stat: 'Real-time', label: 'compliance alerts for TyEL, YEL, VAT' },
          { stat: 'One place', label: 'for all your financial data' },
          { stat: 'AI CFO', label: 'that knows your exact numbers' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: 28 }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px', marginBottom: 2 }}>{item.stat}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
