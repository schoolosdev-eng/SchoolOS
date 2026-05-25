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
    console.log('WEBHOOK MP INICIADO')

    let body: any = {}

    try {
      body = await request.json()
    } catch (parseError) {
      console.error('ERRO PARSE JSON:', parseError)
      body = {}
    }


    const url = new URL(request.url)

    const eventType =
  body?.type ||
  body?.topic ||
  url.searchParams.get('type') ||
  url.searchParams.get('topic')

console.log('EVENT TYPE:', eventType)

if (eventType && eventType !== 'payment') {
  console.log('EVENTO IGNORADO:', eventType)
  return NextResponse.json({ received: true })
}

   const paymentId =
  body?.data?.id ||
  url.searchParams.get('data.id') ||
  url.searchParams.get('id')

console.log('PAYMENT ID:', paymentId, typeof paymentId)

    if (!paymentId) {
      console.log('SEM PAYMENT ID')
      return NextResponse.json({ received: true })
    }

    console.log('BUSCANDO PAGAMENTO MP')

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      }
    )

    console.log('STATUS MP RESPONSE:', mpResponse.status)

    const payment = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('ERRO MP RESPONSE:', payment)
      return NextResponse.json({ received: true })
    }

    if (payment.status !== 'approved') {
      console.log('PAGAMENTO NÃO APROVADO:', payment.status)
      return NextResponse.json({ received: true })
    }

    const internalPaymentId =
      payment.external_reference ||
      payment.metadata?.internal_payment_id

    const schoolId = payment.metadata?.school_id
    const planId = payment.metadata?.plan_id
    const billingCycle = payment.metadata?.billing_cycle || 'monthly'
    const studentLimit = Number(payment.metadata?.student_limit || 0)
const facialEnabled =
  payment.metadata?.facial_enabled === true ||
  payment.metadata?.facial_enabled === 'true'

    const { data: paymentRow, error: paymentRowError } = await supabase
      .from('subscription_payments')
      .select('*')
      .eq('id', internalPaymentId)
      .single()

    console.log('PAYMENT ROW ERROR:', paymentRowError)

    if (paymentRowError || !paymentRow) {
      console.error('PAGAMENTO INTERNO NÃO ENCONTRADO')

      return NextResponse.json(
        { error: 'Pagamento interno não encontrado.' },
        { status: 400 }
      )
    }

    if (paymentRow.status === 'approved') {
  console.log('Pagamento já aprovado anteriormente.')
  return NextResponse.json({ received: true })
}

    const now = new Date()
    const expiresAt = new Date(now)

    const isAnnual =
  billingCycle === 'annual' ||
  planId.includes('yearly') ||
  planId.includes('annual') ||
  planId.includes('anual')

    if (isAnnual) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    }

    const paidAmount = Number(payment.transaction_amount)
const expectedAmount = Number(paymentRow.amount)

if (paidAmount !== expectedAmount) {
  console.error('Valor pago diferente do esperado.', {
    paidAmount,
    expectedAmount,
  })

  return NextResponse.json(
    { error: 'Valor pago inválido.' },
    { status: 400 }
  )
}

    console.log('ATUALIZANDO SUBSCRIPTION_PAYMENTS')

    await supabase
      .from('subscription_payments')
      .update({
        mercado_pago_payment_id: String(payment.id),
        status: 'approved',
        updated_at: now.toISOString(),
      })
      .eq('id', internalPaymentId)

    console.log('ATUALIZANDO SCHOOL_SUBSCRIPTIONS')

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
      student_limit: studentLimit,
      facial_enabled: facialEnabled,
      stripe_subscription_id: null,
      updated_at: now.toISOString(),
    },
    {
      onConflict: 'school_id',
    }
  )

    console.log('WEBHOOK MP FINALIZADO')

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('ERRO WEBHOOK MERCADO PAGO:', error)

    return NextResponse.json(
      { error: 'Erro no webhook Mercado Pago.' },
      { status: 500 }
    )
  }
}