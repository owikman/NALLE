'use client'

import { useEffect } from 'react'

export default function ReportsError({
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
      justifyContent: 'center', minHeight: '100vh', textAlign: 'center', gap: 16,
      fontFamily: 'sans-serif', padding: 40,
    }}>
      <h2 style={{ fontWeight: 600, fontSize: 16 }}>Something went wrong</h2>
      <p style={{ color: '#6b7280', fontSize: 13, maxWidth: 360 }}>
        {error.message || 'An unexpected error occurred while rendering this report.'}
      </p>
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
