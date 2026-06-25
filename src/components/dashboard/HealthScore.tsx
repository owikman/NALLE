'use client'

interface Props {
  score: number
}

export default function HealthScore({ score }: Props) {
  const clamped = Math.max(0, Math.min(100, score))
  const color = clamped >= 70 ? '#10b981' : clamped >= 40 ? '#f59e0b' : '#f87171'
  const label = clamped >= 70 ? 'Healthy' : clamped >= 40 ? 'Needs attention' : 'At risk'

  const circumference = 2 * Math.PI * 40
  const dash = (clamped / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{clamped}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium" style={{ color }}>{label}</span>
    </div>
  )
}
