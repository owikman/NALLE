import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const isPdf = file.type === 'application/pdf' || ext === 'pdf'
  const mediaType = isPdf ? 'application/pdf' : (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg'

  // Upload to storage for record-keeping
  const db = createServiceClient()
  const storagePath = `invoices/${user.id}/${Date.now()}.${ext}`
  let file_url: string | null = null
  const { error: uploadErr } = await db.storage.from('receipts').upload(storagePath, buffer, { contentType: mediaType })
  if (!uploadErr) {
    const { data: { publicUrl } } = db.storage.from('receipts').getPublicUrl(storagePath)
    file_url = publicUrl
  }

  // Build the content block for Claude
  const contentBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        {
          type: 'text',
          text: `Extract the following fields from this invoice and return ONLY a valid JSON object with no explanation:
{
  "counterparty": "the other company or person name on the invoice",
  "invoice_number": "invoice/reference number, or null",
  "description": "brief description of goods or services, or null",
  "amount": net amount as a number without VAT (e.g. 100.00),
  "vat_amount": VAT amount as a number (0 if not applicable),
  "vat_rate": VAT rate as a percentage number (e.g. 24, or 0),
  "issue_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null"
}`,
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

  return NextResponse.json({ ...extracted, file_url })
}
