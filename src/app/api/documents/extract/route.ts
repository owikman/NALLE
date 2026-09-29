import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getActiveCompanyId } from '@/lib/supabase/company'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

export const maxDuration = 60

const FIELD_PROMPTS: Record<string, string> = {
  opening_balance_statement: `{
  "account_name": "the bank account name/number, or null",
  "as_of_date": "YYYY-MM-DD — the statement date",
  "balance": closing balance as a number
}`,
  loan_statement: `{
  "lender": "who the loan is from",
  "principal": original loan amount as a number, or null,
  "interest_rate": annual interest rate as a percentage number, or null,
  "balance_as_of": remaining balance as a number,
  "as_of_date": "YYYY-MM-DD"
}`,
  vat_return: `{
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "vat_payable": VAT owed to Vero as a number, or 0,
  "vat_receivable": VAT to be refunded as a number, or 0,
  "net_due": net amount due (payable minus receivable) as a number
}`,
  payroll_report: `{
  "period": "the pay period, e.g. 2026-08",
  "gross_pay": total gross salary as a number,
  "net_pay": total net salary paid as a number,
  "withholding_tax": total withholding tax as a number, or null
}`,
  travel_claim: `{
  "employee_name": "who is claiming",
  "trip_purpose": "brief purpose",
  "amount": claimed amount as a number,
  "date": "YYYY-MM-DD"
}`,
  other: `{
  "description": "what this document is",
  "amount": a relevant amount as a number, or null,
  "date": "YYYY-MM-DD, or null"
}`,
}

const VALID_TYPES = Object.keys(FIELD_PROMPTS)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = await getActiveCompanyId(user.id)
  if (!companyId) return NextResponse.json({ error: 'No active company selected' }, { status: 400 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const documentType = String(formData.get('document_type') ?? 'other')
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!VALID_TYPES.includes(documentType)) return NextResponse.json({ error: 'Unknown document type' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileHash = createHash('sha256').update(buffer).digest('hex')
  const base64 = buffer.toString('base64')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const isPdf = file.type === 'application/pdf' || ext === 'pdf'
  const mediaType = isPdf ? 'application/pdf' : (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg'

  const db = createServiceClient()

  // Duplicate check: exact re-upload, or same type + similar amount/date.
  const { data: existingByHash } = await db
    .from('documents')
    .select('id, document_type, confirmed_data, created_at')
    .eq('company_id', companyId)
    .eq('file_hash', fileHash)
    .maybeSingle()

  const storagePath = `${companyId}/${documentType}/${Date.now()}.${ext}`
  const { error: uploadErr } = await db.storage.from('documents').upload(storagePath, buffer, { contentType: mediaType })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        {
          type: 'text',
          text: `Extract the following fields from this document and return ONLY a valid JSON object with no explanation:\n${FIELD_PROMPTS[documentType]}\nUse null for anything you can't find — never guess a figure.`,
        },
      ],
    }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  let extracted: Record<string, unknown> = {}
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    extracted = JSON.parse(match ? match[0] : raw)
  } catch { /* fall through with empty */ }

  const { data: signed } = await db.storage.from('documents').createSignedUrl(storagePath, 60 * 60)

  return NextResponse.json({
    extracted,
    storage_path: storagePath,
    preview_url: signed?.signedUrl ?? null,
    file_hash: fileHash,
    duplicate_of: existingByHash ?? null,
  })
}
