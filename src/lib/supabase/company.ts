import { createServiceClient } from './service'

export async function getActiveCompanyId(userId: string): Promise<string | null> {
  const db = createServiceClient()
  const { data } = await db.from('profiles').select('active_company_id').eq('id', userId).single()
  return data?.active_company_id ?? null
}

export async function getActiveCompany(userId: string) {
  const db = createServiceClient()
  const { data: profile } = await db.from('profiles').select('active_company_id').eq('id', userId).single()
  if (!profile?.active_company_id) return null
  const { data: company } = await db.from('companies').select('*').eq('id', profile.active_company_id).single()
  return company
}
