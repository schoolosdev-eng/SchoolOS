import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getStripePixPriceId(
  planName: string,
  billingCycle?: string
) {
  const normalized = planName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const isAnnual =
    billingCycle === 'annual' ||
    normalized.includes('anual')

  if (normalized.includes('basico')) {
    return isAnnual
      ? process.env.STRIPE_PIX_PRICE_BASIC_YEARLY
      : process.env.STRIPE_PIX_PRICE_BASIC_MONTHLY
  }

  if (normalized.includes('intermediario')) {
    return isAnnual
      ? process.env.STRIPE_PIX_PRICE_INTERMEDIATE_YEARLY
      : process.env.STRIPE_PIX_PRICE_INTERMEDIATE_MONTHLY
  }

  if (normalized.includes('avancado')) {
    return isAnnual
      ? process.env.STRIPE_PIX_PRICE_ADVANCED_YEARLY
      : process.env.STRIPE_PIX_PRICE_ADVANCED_MONTHLY
  }

  if (normalized.includes('infinite')) {
    return isAnnual
      ? process.env.STRIPE_PIX_PRICE_INFINITE_YEARLY
      : process.env.STRIPE_PIX_PRICE_INFINITE_MONTHLY
  }

  return null
}

export async function POST(request: Request) {
  try {
    /*
     * O Stripe só é inicializado quando a rota
     * realmente recebe uma requisição.
     *
     * Isso impede que o build falhe caso a chave
     * não esteja disponível no ambiente local.
     */
    const stripeSecretKey =
      process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            'STRIPE_SECRET_KEY não configurada no servidor.',
        },
        {
          status: 500,
        }
      )
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            'Variáveis do Supabase não configuradas no servidor.',
        },
        {
          status: 500,
        }
      )
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL

    if (!appUrl) {
      return NextResponse.json(
        {
          error:
            'NEXT_PUBLIC_APP_URL não configurada no servidor.',
        },
        {
          status: 500,
        }
      )
    }

    const stripe = new Stripe(
      stripeSecretKey
    )

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const body = await request.json()

    const {
      schoolId,
      planId,
      planName,
      price,
      billingCycle,
    } = body

    if (
      !schoolId ||
      !planId ||
      !planName ||
      price === undefined
    ) {
      return NextResponse.json(
        {
          error:
            'Dados incompletos para gerar pagamento Pix.',
        },
        {
          status: 400,
        }
      )
    }

    const numericPrice = Number(price)

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'Valor inválido para o pagamento Pix.',
        },
        {
          status: 400,
        }
      )
    }

    const priceId = getStripePixPriceId(
      planName,
      billingCycle
    )

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            'Preço Pix Stripe não configurado para este plano.',
        },
        {
          status: 400,
        }
      )
    }

    const {
      data: paymentRow,
      error: paymentError,
    } = await supabaseAdmin
      .from('subscription_payments')
      .insert({
        school_id: schoolId,
        plan_id: planId,
        amount: numericPrice,
        status: 'pending',
      })
      .select()
      .single()

    if (paymentError || !paymentRow) {
      console.error(
        'ERRO AO CRIAR PAGAMENTO PIX:',
        paymentError
      )

      return NextResponse.json(
        {
          error:
            paymentError?.message ||
            'Erro ao criar pagamento Pix.',
          details: paymentError,
        },
        {
          status: 500,
        }
      )
    }

    const normalizedAppUrl =
      appUrl.replace(/\/$/, '')

    const session =
      await stripe.checkout.sessions.create({
        mode: 'payment',

        payment_method_types: ['pix'],

        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],

        success_url:
          `${normalizedAppUrl}/school/${schoolId}` +
          '?payment=success',

        cancel_url:
          `${normalizedAppUrl}/school/${schoolId}` +
          '?payment=failure',

        metadata: {
          school_id: schoolId,
          plan_id: planId,
          internal_payment_id:
            paymentRow.id,
          billing_cycle:
            billingCycle || 'monthly',
          payment_type: 'pix',
        },
      })

    if (!session.url) {
      return NextResponse.json(
        {
          error:
            'O Stripe não retornou a URL do checkout.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      checkoutUrl: session.url,
    })
  } catch (error) {
    console.error(
      'ERRO DETALHADO CHECKOUT PIX STRIPE:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao criar checkout Pix.',
      },
      {
        status: 500,
      }
    )
  }
}