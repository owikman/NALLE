import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company_id } = await request.json() as { company_id: string }

  const db = createServiceClient()

  // Verify the company belongs to this user
  const { data: company } = await db.from('companies').select('id').eq('id', company_id).eq('user_id', user.id).single()
  if (!company) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

  await db.from('profiles').update({ active_company_id: company_id }).eq('id', user.id)

  return NextResponse.json({ success: true })
}
