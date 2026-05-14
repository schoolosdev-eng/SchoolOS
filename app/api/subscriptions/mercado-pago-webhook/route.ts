import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
})

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
    const body = await request.json()

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource?.split('/').pop()

    const type = body?.type || body?.topic

    if (type !== 'payment' || !paymentId) {
      return NextResponse.json({ received: true })
    }

    const paymentClient = new Payment(client)
    const payment = await paymentClient.get({ id: paymentId })

    if (payment.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    const internalPaymentId =
      payment.external_reference ||
      payment.metadata?.internal_payment_id

    const schoolId = payment.metadata?.school_id
    const planId = payment.metadata?.plan_id
    const billingCycle = payment.metadata?.billing_cycle || 'monthly'

    if (!internalPaymentId || !schoolId || !planId) {
      console.error('METADATA MERCADO PAGO INVÁLIDA:', payment)

      return NextResponse.json(
        { error: 'Metadata Mercado Pago inválida.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now)

    const isAnnual =
      billingCycle === 'annual' ||
      planId.includes('yearly') ||
      planId.includes('annual')

    if (isAnnual) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    await supabase
      .from('subscription_payments')
      .update({
        mercado_pago_payment_id: String(payment.id),
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
          stripe_subscription_id: null,
          updated_at: now.toISOString(),
        },
        {
          onConflict: 'school_id',
        }
      )

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('ERRO WEBHOOK MERCADO PAGO:', error)

    return NextResponse.json(
      { error: 'Erro no webhook Mercado Pago.' },
      { status: 500 }
    )
  }
}