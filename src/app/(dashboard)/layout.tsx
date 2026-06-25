import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const [{ data: profile }, { data: companies }] = await Promise.all([
    db.from('profiles').select('active_company_id').eq('id', user.id).single(),
    db.from('companies').select('id, business_name').eq('user_id', user.id).order('created_at'),
  ])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        email={user.email ?? ''}
        companies={companies ?? []}
        activeCompanyId={profile?.active_company_id ?? null}
      />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
