import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Assinatura Stripe ausente.' },
        { status: 400 }
      )
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const schoolId = session.metadata?.school_id
      const planId = session.metadata?.plan_id
      const internalPaymentId = session.metadata?.internal_payment_id

      if (!schoolId || !planId || !internalPaymentId) {
        console.error('METADATA STRIPE INVÁLIDA:', session.metadata)

        return NextResponse.json(
          { error: 'Metadata inválida.' },
          { status: 400 }
        )
      }

      const { data: paymentRow, error: paymentRowError } = await supabase
  .from('subscription_payments')
  .select('*')
  .eq('id', internalPaymentId)
  .single()

if (paymentRowError || !paymentRow) {
  return NextResponse.json(
    { error: 'Pagamento interno não encontrado.' },
    { status: 400 }
  )
}

if (paymentRow.status === 'approved') {
  return NextResponse.json({ received: true })
}

const paidAmount = Number(session.amount_total || 0) / 100
const expectedAmount = Number(paymentRow.amount)

if (paidAmount.toFixed(2) !== expectedAmount.toFixed(2)) {
  console.error('Valor Stripe diferente do esperado.', {
    paidAmount,
    expectedAmount,
  })

  return NextResponse.json(
    { error: 'Valor pago inválido.' },
    { status: 400 }
  )
}

      const now = new Date()
      const expiresAt = new Date(now)

      const isAnnual =
  session.metadata?.billing_cycle === 'annual' ||
  planId.includes('yearly') ||
  planId.includes('annual')

      if (isAnnual) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      }

      if (
  paymentRow.school_id !== schoolId ||
  paymentRow.plan_id !== planId
) {
  return NextResponse.json(
    { error: 'Metadata não corresponde ao pagamento interno.' },
    { status: 400 }
  )
}

      await supabase
        .from('subscription_payments')
        .update({
          stripe_session_id: session.id,
          stripe_subscription_id:
  session.metadata?.payment_type === 'pix'
    ? null
    : typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id,
          status: 'approved',
          updated_at: now.toISOString(),
        })
        .eq('id', internalPaymentId)

      await supabase
        .from('school_subscriptions')
        .upsert(
          {
            school_id: schoolId,
            plan_id: planId,
            status: 'active',
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
            billing_cycle: isAnnual ? 'annual' : 'monthly',
            stripe_subscription_id:
  session.metadata?.payment_type === 'pix'
    ? null
    : typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id,
            updated_at: now.toISOString(),
          },
          {
            onConflict: 'school_id',
          }
        )
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice

const invoiceWithSubscription = invoice as Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
}

const subscriptionId =
  typeof invoiceWithSubscription.subscription === 'string'
    ? invoiceWithSubscription.subscription
    : invoiceWithSubscription.subscription?.id

      if (subscriptionId) {
        await supabase
          .from('school_subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscriptionId)
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription

      await supabase
        .from('school_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('ERRO NO WEBHOOK STRIPE:', error)

    return NextResponse.json(
      { error: 'Erro no webhook Stripe.' },
      { status: 500 }
    )
  }
}