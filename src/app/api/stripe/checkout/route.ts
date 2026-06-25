import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: profile } = await db.from('profiles').select('stripe_customer_id, business_name').eq('id', user.id).single()

  let customerId = profile?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.business_name ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PREMIUM_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/plans?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/plans?cancelled=true`,
    metadata: { supabase_user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
