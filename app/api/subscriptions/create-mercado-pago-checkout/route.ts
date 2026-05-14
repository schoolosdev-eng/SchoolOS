import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { schoolId, planId, planName, price, billingCycle } = body

    if (!schoolId || !planId || !planName || price === undefined) {
      return NextResponse.json(
        { error: 'Dados incompletos para gerar pagamento Mercado Pago.' },
        { status: 400 }
      )
    }

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

    const { data: paymentRow, error: paymentError } = await supabaseAdmin
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
      return NextResponse.json(
        { error: paymentError?.message || 'Erro ao criar pagamento.' },
        { status: 500 }
      )
    }

    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/subscriptions/mercado-pago-webhook`,

        items: [
          {
            id: planId,
            title: `${planName} - ${billingCycle === 'annual' ? 'Anual' : 'Mensal'}`,
            quantity: 1,
            unit_price: Number(price),
            currency_id: 'BRL',
          },
        ],
        back_urls: {
          success: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=success`,
          failure: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=failure`,
          pending: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=pending`,
        },
        auto_return: 'approved',
        external_reference: paymentRow.id,
        metadata: {
          school_id: schoolId,
          plan_id: planId,
          internal_payment_id: paymentRow.id,
          billing_cycle: billingCycle || 'monthly',
          payment_type: 'mercado_pago_one_time',
        },
      },
    })

    return NextResponse.json({
      checkoutUrl: result.init_point,
    })
  } catch (error) {
    console.error('ERRO CHECKOUT MERCADO PAGO:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao criar checkout Mercado Pago.',
      },
      { status: 500 }
    )
  }
}