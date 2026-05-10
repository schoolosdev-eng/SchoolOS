import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mercadoPago = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
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

    console.log('WEBHOOK RECEBIDO:', JSON.stringify(body))

    const paymentId =
      body?.data?.id ||
      body?.id ||
      body?.resource

    const type =
      body?.type ||
      body?.topic

    if (type !== 'payment' || !paymentId) {
      return NextResponse.json({ received: true })
    }

    const paymentApi = new Payment(mercadoPago)

    const payment = await paymentApi.get({
      id: String(paymentId),
    })

    const paymentData = payment as any

    console.log('PAGAMENTO MP:', JSON.stringify({
      id: paymentData.id,
      status: paymentData.status,
      metadata: paymentData.metadata,
    }))

    const status = paymentData.status
    const metadata = paymentData.metadata || {}

    const schoolId = metadata.school_id
    const planId = metadata.plan_id
    const internalPaymentId = metadata.internal_payment_id

    if (!schoolId || !planId || !internalPaymentId) {
      console.error('METADATA INVÁLIDA:', metadata)

      return NextResponse.json(
        { error: 'Metadata inválida.' },
        { status: 400 }
      )
    }

    const { error: paymentUpdateError } = await supabase
      .from('subscription_payments')
      .update({
        mercado_pago_payment_id: String(paymentId),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', internalPaymentId)

    if (paymentUpdateError) {
      console.error('ERRO AO ATUALIZAR PAGAMENTO:', paymentUpdateError)

      return NextResponse.json(
        { error: 'Erro ao atualizar pagamento.' },
        { status: 500 }
      )
    }

if (status === 'approved') {
  const now = new Date()

  const expiresAt = new Date(now)

  const isAnnual =
    planId.includes('yearly') ||
    planId.includes('annual')

  if (isAnnual) {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  }

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
        updated_at: now.toISOString(),
      },
      {
        onConflict: 'school_id',
      }
    )
}

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('ERRO NO WEBHOOK:', error)

    return NextResponse.json(
      { error: 'Erro no webhook.' },
      { status: 500 }
    )
  }
}