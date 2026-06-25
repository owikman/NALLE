import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const base64 = buffer.toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  // Upload to Supabase Storage
  const db = createServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${user.id}/${Date.now()}.${ext}`
  await db.storage.from('receipts').upload(storagePath, buffer, { contentType: file.type })

  // Extract receipt data with Claude vision
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `Extract data from this receipt. Respond ONLY with valid JSON, no markdown or explanation:
{
  "amount": <total amount as number including VAT>,
  "date": "<YYYY-MM-DD>",
  "description": "<what was purchased, max 60 chars>",
  "category": "<one of: vehicle, equipment, travel, software, personnel, other>",
  "vat_rate": <VAT rate as number: 0, 10, 14, or 25.5 — pick closest>
}
Default to today's date if unclear, 25.5 for VAT if unclear, "other" for category if unclear.`,
        },
      ],
    }],
  })

  const raw = (msg.content[0] as { type: string; text: string }).text.trim()
  let extracted: { amount: number; date: string; description: string; category: string; vat_rate: number }
  try {
    extracted = JSON.parse(raw)
  } catch {
    extracted = {
      amount: 0,
      date: new Date().toISOString().split('T')[0]!,
      description: '',
      category: 'other',
      vat_rate: 25.5,
    }
  }

  return NextResponse.json({ ...extracted, receipt_url: storagePath })
}
