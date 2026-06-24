import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⬜' },
  { href: '/intake', label: 'Financial Intake', icon: '📋' },
  { href: '/expenses', label: 'Expenses', icon: '💳' },
  { href: '/checklists', label: 'Checklists', icon: '✅' },
  { href: '/reports', label: 'Reports', icon: '📊' },
  { href: '/compliance', label: 'Compliance', icon: '🏛' },
  { href: '/chat', label: 'AI CFO', icon: '💬' },
  { href: '/consultation', label: 'Book Advisor', icon: '📅' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <span className="text-xl font-bold text-blue-600">NALLE</span>
          <p className="text-xs text-gray-400 mt-0.5">AI Financial CFO</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 truncate px-3">{user.email}</p>
          <form action="/api/auth/signout" method="post">
            <button className="mt-1 w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-red-500 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
