import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      schoolId,
      planId,
      planName,
      price,
      studentLimit,
    } = body

    if (!schoolId || !planId || !planName || price === undefined) {
      return NextResponse.json(
        { error: 'Dados incompletos para gerar pagamento.' },
        { status: 400 }
      )
    }

    const { createClient } = await import('@supabase/supabase-js')

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

const { data: paymentRow, error: paymentError } =
await supabaseAdmin
  .from('subscription_payments')
    .insert({
      school_id: schoolId,
      plan_id: planId,
      amount: Number(price),
      status: 'pending',
    })
    .select()
    .single()

if (paymentError || !paymentRow) {
  console.error('ERRO AO INSERIR PAYMENT:', paymentError)

  return NextResponse.json(
    {
      error: paymentError?.message || 'Erro ao criar pagamento.',
      details: paymentError,
    },
    { status: 500 }
  )
}

    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: [
          {
            id: planId,
            title: `SchoolOS - ${planName}`,
            description: `Assinatura SchoolOS para até ${studentLimit} alunos`,
            quantity: 1,
            unit_price: Number(price),
            currency_id: 'BRL',
          },
        ],
metadata: {
  school_id: schoolId,
  plan_id: planId,
  internal_payment_id: paymentRow.id,
},
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=pending`,
        },

        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/subscriptions/webhook`,
      },
    })

    return NextResponse.json({
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    })
} catch (error) {
  console.error('ERRO DETALHADO CHECKOUT:', error)

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : 'Erro ao criar checkout.',
    },
    { status: 500 }
  )
}
}