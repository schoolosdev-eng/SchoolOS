import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

console.log('WEBHOOK MERCADO PAGO BODY:', body)

const url = new URL(request.url)

const paymentId =
  body?.data?.id ||
  body?.id ||
  url.searchParams.get('data.id') ||
  url.searchParams.get('id')

if (!paymentId) {
  return NextResponse.json({ received: true })
}

const mpResponse = await fetch(
  `https://api.mercadopago.com/v1/payments/${paymentId}`,
  {
    headers: {
      Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
    },
  }
)

const payment = await mpResponse.json()

console.log('PAGAMENTO MERCADO PAGO:', payment)

if (!mpResponse.ok) {
  console.error('ERRO AO BUSCAR PAGAMENTO MP:', payment)
  return NextResponse.json({ received: true })
}

if (payment.status !== 'approved') {
  return NextResponse.json({ received: true })
}

const internalPaymentId =
  payment.external_reference || payment.metadata?.internal_payment_id

    const { data: paymentRow, error: paymentRowError } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('id', internalPaymentId)
      .single()

    if (paymentRowError || !paymentRow) {
      console.error('PAGAMENTO INTERNO NÃO ENCONTRADO:', paymentRowError)

      return NextResponse.json(
        { error: 'Pagamento interno não encontrado.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now)

    const planId = paymentRow.plan_id as string

    const isAnnual =
      planId.includes('yearly') ||
      planId.includes('annual') ||
      planId.includes('anual')

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
          school_id: paymentRow.school_id,
          plan_id: paymentRow.plan_id,
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