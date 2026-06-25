import { createServiceClient } from '@/lib/supabase/service'
import Stripe from 'stripe'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' })
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    if (userId) {
      await db.from('profiles').update({ is_premium: true }).eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customer = await stripe.customers.retrieve(subscription.customer as string)
    if (!customer.deleted) {
      const userId = (customer as Stripe.Customer).metadata?.supabase_user_id
      if (userId) {
        await db.from('profiles').update({ is_premium: false }).eq('id', userId)
      }
    }
  }

  return NextResponse.json({ received: true })
}
