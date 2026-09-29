import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('documents')
    .select('id, document_type, confirmed_data, extracted_data, status, duplicate_of_id, created_at, confirmed_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const body = await request.json() as {
    document_type: string
    storage_path: string
    file_hash: string
    extracted_data: Record<string, unknown>
    confirmed_data: Record<string, unknown>
    duplicate_of_id?: string | null
    /** true if the user reviewed a flagged duplicate and confirmed this is a genuinely separate document */
    confirmed_not_duplicate?: boolean
  }

  const db = createServiceClient()
  const isDuplicate = Boolean(body.duplicate_of_id) && !body.confirmed_not_duplicate

  const { data, error } = await db.from('documents').insert({
    company_id: companyId,
    document_type: body.document_type,
    storage_path: body.storage_path,
    file_hash: body.file_hash,
    extracted_data: body.extracted_data,
    confirmed_data: body.confirmed_data,
    confirmed_by: user.id,
    confirmed_at: new Date().toISOString(),
    status: isDuplicate ? 'duplicate_flagged' : 'confirmed',
    duplicate_of_id: body.duplicate_of_id ?? null,
  }).select('id, status').single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to save document' }, { status: 500 })
  return NextResponse.json(data)
}
