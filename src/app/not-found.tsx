import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{
            width: 32, height: 32, background: '#111110', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={15} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.4px' }}>NALLE</span>
        </div>
        <p style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-2px', color: 'var(--border)', marginBottom: 16 }}>404</p>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Page not found</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
          The page you're looking for doesn't exist.
        </p>
        <Link href="/" style={{
          padding: '10px 24px', background: '#111110', color: 'white',
          borderRadius: 10, fontSize: 14, fontWeight: 500, textDecoration: 'none',
        }}>
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
