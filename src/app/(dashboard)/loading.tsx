export default function Loading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header skeleton */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ width: 180, height: 28, borderRadius: 6, background: 'var(--border)', marginBottom: 8 }} className="skeleton" />
        <div style={{ width: 240, height: 16, borderRadius: 6, background: 'var(--border-subtle)' }} className="skeleton" />
      </div>
      {/* Card skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ width: 80, height: 12, borderRadius: 4, background: 'var(--border-subtle)', marginBottom: 10 }} className="skeleton" />
            <div style={{ width: 120, height: 24, borderRadius: 4, background: 'var(--border)' }} className="skeleton" />
          </div>
        ))}
      </div>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 20, height: 240,
      }} className="skeleton" />
      <style>{`
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .skeleton { animation: shimmer 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
