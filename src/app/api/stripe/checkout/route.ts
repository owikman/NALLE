import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export async function POST() {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!stripeKey || stripeKey === 'sk_test_placeholder') return NextResponse.json({ error: `STRIPE_SECRET_KEY missing or placeholder` }, { status: 500 })
  if (!priceId || priceId === 'price_placeholder') return NextResponse.json({ error: `STRIPE_PREMIUM_PRICE_ID missing or placeholder. Got: ${priceId}` }, { status: 500 })
  if (!appUrl) return NextResponse.json({ error: `NEXT_PUBLIC_APP_URL missing` }, { status: 500 })

  let stripe: Stripe
  try {
    stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' })
  } catch (e) {
    return NextResponse.json({ error: `Stripe init failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('profiles').select('stripe_customer_id, business_name').eq('id', user.id).single()

  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    try {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.business_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    } catch (e) {
      return NextResponse.json({ error: `Create customer failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/plans?success=true`,
      cancel_url: `${appUrl}/plans?cancelled=true`,
      metadata: { supabase_user_id: user.id },
    })
    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: `Create session failed: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
