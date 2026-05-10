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

    if (body.type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = body.data?.id

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Pagamento inválido.' },
        { status: 400 }
      )
    }

    const paymentApi = new Payment(mercadoPago)

    const payment = await paymentApi.get({
      id: paymentId,
    })

    const paymentData = payment as any

    const status = paymentData.status

    const metadata = paymentData.metadata || {}

    const schoolId = metadata.school_id
    const planId = metadata.plan_id
    const internalPaymentId =
      metadata.internal_payment_id

    if (!schoolId || !planId || !internalPaymentId) {
      return NextResponse.json(
        { error: 'Metadata inválida.' },
        { status: 400 }
      )
    }

    await supabase
      .from('subscription_payments')
      .update({
        mercado_pago_payment_id: String(paymentId),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', internalPaymentId)

    if (status === 'approved') {
      await supabase
        .from('school_subscriptions')
        .upsert(
          {
            school_id: schoolId,
            plan_id: planId,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'school_id',
          }
        )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Erro no webhook.' },
      { status: 500 }
    )
  }
}