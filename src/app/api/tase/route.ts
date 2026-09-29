import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { getTaseReadiness, computeTase } from '@/lib/ledger/tase'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const url = new URL(request.url)
  const asOf = url.searchParams.get('as_of') ?? new Date().toISOString().split('T')[0]!

  const db = createServiceClient()
  try {
    const [readiness, tase] = await Promise.all([
      getTaseReadiness(db, companyId),
      computeTase(db, companyId, asOf),
    ])
    return NextResponse.json({ asOf, readiness, tase })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to compute tase' }, { status: 500 })
  }
}
