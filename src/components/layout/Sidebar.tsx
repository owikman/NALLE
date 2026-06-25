'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ClipboardList, Receipt, CheckSquare, FileBarChart, Shield, MessageSquare, Sparkles, LogOut, ChevronDown, Plus } from 'lucide-react'
import { useState } from 'react'

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

interface Company { id: string; business_name: string | null }

export default function Sidebar({ email, companies, activeCompanyId }: {
  email: string
  companies: Company[]
  activeCompanyId: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [showCompanies, setShowCompanies] = useState(false)
  const [switching, setSwitching] = useState(false)

  const activeCompany = companies.find(c => c.id === activeCompanyId)

  async function switchCompany(companyId: string) {
    setSwitching(true)
    await fetch('/api/companies/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: companyId }) })
    setShowCompanies(false)
    setSwitching(false)
    router.refresh()
  }

  return (
    <aside style={{ width: 220, background: 'var(--sidebar-bg)', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: companies.length > 0 ? 14 : 0 }}>
          <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>NALLE</span>
        </div>

        {/* Company switcher */}
        {companies.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCompanies(v => !v)}
              disabled={switching}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}
            >
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {activeCompany?.business_name ?? 'My company'}
              </span>
              <ChevronDown size={12} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0, marginLeft: 4 }} />
            </button>

            {showCompanies && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1e2130', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {companies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => switchCompany(c.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: c.id === activeCompanyId ? 'rgba(255,255,255,0.08)' : 'none', border: 'none', cursor: 'pointer', color: c.id === activeCompanyId ? 'white' : 'rgba(255,255,255,0.6)', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    {c.business_name ?? 'Unnamed company'}
                  </button>
                ))}
                <Link
                  href="/intake"
                  onClick={() => setShowCompanies(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, textDecoration: 'none' }}
                >
                  <Plus size={12} /> Add company
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 2, color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)', background: active ? 'var(--sidebar-active)' : 'transparent', textDecoration: 'none', fontSize: 13, fontWeight: active ? 500 : 400, transition: 'all 0.1s' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
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
          <p style={{ color: 'var(--sidebar-text)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-text)', fontSize: 13, borderRadius: 8 }}
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
