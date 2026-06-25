'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, Receipt, CheckSquare,
  FileBarChart, Shield, MessageSquare, Sparkles, LogOut
} from 'lucide-react'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/intake', label: 'Intake', icon: ClipboardList },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/checklists', label: 'Checklists', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: FileBarChart },
  { href: '/compliance', label: 'Compliance', icon: Shield },
  { href: '/chat', label: 'AI CFO', icon: MessageSquare },
  { href: '/plans', label: 'Plans', icon: Sparkles },
]

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 220,
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>NALLE</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                marginBottom: 2,
                color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                background: active ? 'var(--sidebar-active)' : 'transparent',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '6px 10px', marginBottom: 4 }}>
          <p style={{ color: 'var(--sidebar-text)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '8px 10px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--sidebar-text)', fontSize: 13, borderRadius: 8,
              transition: 'color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--sidebar-text)')}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
