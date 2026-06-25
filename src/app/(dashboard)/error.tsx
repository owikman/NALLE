'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'var(--danger-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={22} color="var(--danger)" />
      </div>
      <div>
        <h2 style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 320 }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', background: '#111110', color: 'white',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
