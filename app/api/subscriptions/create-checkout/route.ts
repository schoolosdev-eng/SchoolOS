import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

function getStripePriceId(planName: string, billingCycle?: string) {
  const normalized = planName.toLowerCase()

  const isAnnual =
    billingCycle === 'annual' ||
    normalized.includes('anual')

  if (normalized.includes('básico')) {
    return isAnnual
      ? process.env.STRIPE_PRICE_BASIC_YEARLY
      : process.env.STRIPE_PRICE_BASIC_MONTHLY
  }

  if (normalized.includes('intermediário')) {
    return isAnnual
      ? process.env.STRIPE_PRICE_INTERMEDIATE_YEARLY
      : process.env.STRIPE_PRICE_INTERMEDIATE_MONTHLY
  }

  if (normalized.includes('avançado')) {
    return isAnnual
      ? process.env.STRIPE_PRICE_ADVANCED_YEARLY
      : process.env.STRIPE_PRICE_ADVANCED_MONTHLY
  }

  if (normalized.includes('infinite')) {
    return isAnnual
      ? process.env.STRIPE_PRICE_INFINITE_YEARLY
      : process.env.STRIPE_PRICE_INFINITE_MONTHLY
  }

  return null
}

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

    const priceId = getStripePriceId(body.planName, body.billingCycle)

    if (!priceId) {
      return NextResponse.json(
        { error: 'Preço Stripe não configurado para este plano.' },
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

const authHeader = request.headers.get('authorization')

if (!authHeader) {
  return NextResponse.json(
    { error: 'Usuário não autenticado.' },
    { status: 401 }
  )
}

const token = authHeader.replace('Bearer ', '')

const userSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const {
  data: { user },
  error: userError,
} = await userSupabase.auth.getUser(token)

if (userError || !user) {
  return NextResponse.json(
    { error: 'Sessão inválida.' },
    { status: 401 }
  )
}

const { data: membership, error: membershipError } = await supabaseAdmin
  .from('school_memberships')
  .select('id')
  .eq('school_id', schoolId)
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .eq('status', 'active')
  .maybeSingle()

if (membershipError || !membership) {
  return NextResponse.json(
    { error: 'Apenas administradores podem alterar plano.' },
    { status: 403 }
  )
}

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',

      payment_method_types: ['card'],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/school/${schoolId}?payment=failure`,

      metadata: {
        school_id: schoolId,
        plan_id: planId,
        internal_payment_id: paymentRow.id,
      },

      subscription_data: {
        metadata: {
          school_id: schoolId,
          plan_id: planId,
          internal_payment_id: paymentRow.id,
        },
      },
    })

    return NextResponse.json({
      checkoutUrl: session.url,
    })
  } catch (error) {
    console.error('ERRO DETALHADO CHECKOUT STRIPE:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao criar checkout Stripe.',
      },
      { status: 500 }
    )
  }
}