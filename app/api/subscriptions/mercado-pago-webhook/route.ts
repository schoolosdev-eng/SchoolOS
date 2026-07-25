import { NextResponse } from 'next/server'
import {
  MercadoPagoConfig,
  Preference,
} from 'mercadopago'
import {
  createClient,
} from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type PurchaseType =
  | 'main_plan'
  | 'addon'

type CheckoutBody = {
  schoolId?: unknown
  purchaseType?: unknown
  planId?: unknown
  addonPlanId?: unknown
}

type MainPlan = {
  id: string
  name: string
  billing_cycle: string
  price: number | string
  student_limit: number
  facial_enabled: boolean
  is_active: boolean
}

type AddonPlan = {
  id: string
  addon_code:
    | 'arrival_photo_whatsapp'
    | 'regular_exit_photo_whatsapp'
  name: string
  student_limit: number
  unit_price: number | string
  monthly_price: number | string
  billing_cycle: string
  is_active: boolean
}

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      'Variáveis administrativas do Supabase não configuradas.'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      'authorization'
    )

  if (
    !authorization?.startsWith(
      'Bearer '
    )
  ) {
    return null
  }

  return authorization
    .replace('Bearer ', '')
    .trim()
}

function getApplicationUrl() {
  const appUrl =
    process.env
      .NEXT_PUBLIC_APP_URL
      ?.trim()
      .replace(/\/+$/, '')

  if (!appUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL não configurada.'
    )
  }

  return appUrl
}

function getMercadoPagoClient() {
  const accessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error(
      'MERCADO_PAGO_ACCESS_TOKEN não configurado.'
    )
  }

  return new MercadoPagoConfig({
    accessToken,
  })
}

export async function POST(
  request: Request
) {
  try {
    const accessToken =
      getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            'Usuário não autenticado.',
        },
        {
          status: 401,
        }
      )
    }

    const body =
      await request
        .json()
        .catch(
          () => null
        ) as CheckoutBody | null

    const schoolId =
      typeof body?.schoolId ===
        'string'
        ? body.schoolId.trim()
        : ''

    const planId =
      typeof body?.planId ===
        'string'
        ? body.planId.trim()
        : ''

    const addonPlanId =
      typeof body?.addonPlanId ===
        'string'
        ? body.addonPlanId.trim()
        : ''

    /*
     * Mantém compatibilidade temporária
     * com o PlansSection atual, que ainda
     * envia apenas planId.
     */
    let purchaseType:
      PurchaseType

    if (
      body?.purchaseType ===
        'addon' ||
      addonPlanId
    ) {
      purchaseType =
        'addon'
    } else {
      purchaseType =
        'main_plan'
    }

    if (
      body?.purchaseType !==
        undefined &&
      body.purchaseType !==
        'main_plan' &&
      body.purchaseType !==
        'addon'
    ) {
      return NextResponse.json(
        {
          error:
            'Tipo de contratação inválido.',
        },
        {
          status: 400,
        }
      )
    }

    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'Escola não informada.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      purchaseType ===
        'main_plan' &&
      !planId
    ) {
      return NextResponse.json(
        {
          error:
            'Plano principal não informado.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      purchaseType ===
        'addon' &&
      !addonPlanId
    ) {
      return NextResponse.json(
        {
          error:
            'Plano do adicional não informado.',
        },
        {
          status: 400,
        }
      )
    }

    const supabaseAdmin =
      createAdminClient()

    /*
     * 1. Valida a sessão.
     */
    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth
        .getUser(
          accessToken
        )

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error:
            'Sessão inválida ou expirada.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * 2. Apenas administradores podem
     * contratar planos e adicionais.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from(
        'school_memberships'
      )
      .select(
        'id, role, status'
      )
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'role',
        'admin'
      )
      .eq(
        'status',
        'active'
      )
      .maybeSingle()

    if (
      membershipError ||
      !membership
    ) {
      return NextResponse.json(
        {
          error:
            'Apenas administradores podem realizar contratações.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * Dados definitivos da compra.
     *
     * Nenhum preço enviado pelo frontend
     * será utilizado.
     */
    let itemId = ''
    let itemName = ''
    let amount = 0
    let billingCycle:
      'monthly' | 'annual' =
        'monthly'
    let studentLimit = 0
    let facialEnabled = false

    let selectedPlanId:
      string | null = null

    let selectedAddonPlanId:
      string | null = null

    let selectedAddonCode:
      | AddonPlan['addon_code']
      | null = null

    if (
      purchaseType ===
      'main_plan'
    ) {
      const {
        data: planData,
        error: planError,
      } = await supabaseAdmin
        .from(
          'subscription_plans'
        )
        .select(`
          id,
          name,
          billing_cycle,
          price,
          student_limit,
          facial_enabled,
          is_active
        `)
        .eq(
          'id',
          planId
        )
        .eq(
          'is_active',
          true
        )
        .maybeSingle()

      if (
        planError ||
        !planData
      ) {
        return NextResponse.json(
          {
            error:
              'Plano principal não encontrado ou indisponível.',
          },
          {
            status: 404,
          }
        )
      }

      const plan =
        planData as MainPlan

      amount =
        Number(plan.price)

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              'Planos gratuitos devem ser ativados diretamente, sem checkout.',
          },
          {
            status: 400,
          }
        )
      }

      studentLimit =
        Number(
          plan.student_limit
        )

      /*
       * Proteção também no backend:
       * impede contratar plano principal
       * menor que a escola atual.
       */
      const {
        count: currentStudents,
        error: studentsError,
      } = await supabaseAdmin
        .from('students')
        .select(
          'id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'school_id',
          schoolId
        )

      if (studentsError) {
        return NextResponse.json(
          {
            error:
              'Não foi possível verificar a quantidade de alunos da escola.',
          },
          {
            status: 500,
          }
        )
      }

      if (
        Number(
          currentStudents || 0
        ) >
        studentLimit
      ) {
        return NextResponse.json(
          {
            error:
              `A escola possui ${Number(
                currentStudents || 0
              )} alunos, mas este plano permite apenas ${studentLimit}.`,
          },
          {
            status: 409,
          }
        )
      }

      itemId =
        plan.id

      itemName =
        plan.name

      billingCycle =
        plan.billing_cycle ===
        'annual'
          ? 'annual'
          : 'monthly'

      facialEnabled =
        Boolean(
          plan.facial_enabled
        )

      selectedPlanId =
        plan.id
    } else {
      const {
        data: addonPlanData,
        error: addonPlanError,
      } = await supabaseAdmin
        .from(
          'school_addon_plans'
        )
        .select(`
          id,
          addon_code,
          name,
          student_limit,
          unit_price,
          monthly_price,
          billing_cycle,
          is_active
        `)
        .eq(
          'id',
          addonPlanId
        )
        .eq(
          'is_active',
          true
        )
        .maybeSingle()

      if (
        addonPlanError ||
        !addonPlanData
      ) {
        return NextResponse.json(
          {
            error:
              'Plano do adicional não encontrado ou indisponível.',
          },
          {
            status: 404,
          }
        )
      }

      const addonPlan =
        addonPlanData as AddonPlan

      if (
        addonPlan.addon_code !==
          'arrival_photo_whatsapp' &&
        addonPlan.addon_code !==
          'regular_exit_photo_whatsapp'
      ) {
        return NextResponse.json(
          {
            error:
              'Este adicional não é compatível com mensagens automáticas.',
          },
          {
            status: 400,
          }
        )
      }

      amount =
        Number(
          addonPlan.monthly_price
        )

      studentLimit =
        Number(
          addonPlan.student_limit
        )

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              'Preço do adicional inválido.',
          },
          {
            status: 500,
          }
        )
      }

      if (
        !Number.isFinite(
          studentLimit
        ) ||
        studentLimit <= 0
      ) {
        return NextResponse.json(
          {
            error:
              'Limite do adicional inválido.',
          },
          {
            status: 500,
          }
        )
      }

      itemId =
        addonPlan.id

      itemName =
        addonPlan.name

      billingCycle =
        'monthly'

      facialEnabled =
        false

      selectedAddonPlanId =
        addonPlan.id

      selectedAddonCode =
        addonPlan.addon_code
    }

    /*
     * 3. Cria o pagamento interno antes
     * da preferência do Mercado Pago.
     */
    const {
      data: paymentRow,
      error: paymentError,
    } = await supabaseAdmin
      .from(
        'subscription_payments'
      )
      .insert({
        school_id:
          schoolId,

        purchase_type:
          purchaseType,

        plan_id:
          selectedPlanId,

        addon_plan_id:
          selectedAddonPlanId,

        addon_code:
          selectedAddonCode,

        amount,

        status:
          'pending',

        billing_cycle:
          billingCycle,

        student_limit:
          studentLimit,

        facial_enabled:
          facialEnabled,

        approved_at:
          null,
      })
      .select('id')
      .single()

    if (
      paymentError ||
      !paymentRow
    ) {
      console.error(
        '[CHECKOUT MP] erro ao criar pagamento interno:',
        paymentError
      )

      return NextResponse.json(
        {
          error:
            paymentError?.message ||
            'Erro ao criar pagamento interno.',
        },
        {
          status: 500,
        }
      )
    }

    const appUrl =
      getApplicationUrl()

    const preference =
      new Preference(
        getMercadoPagoClient()
      )

    const metadata:
      Record<
        string,
        string | number | boolean
      > = {
      school_id:
        schoolId,

      internal_payment_id:
        paymentRow.id,

      purchase_type:
        purchaseType,

      billing_cycle:
        billingCycle,

      student_limit:
        studentLimit,

      facial_enabled:
        facialEnabled,
    }

    if (selectedPlanId) {
      metadata.plan_id =
        selectedPlanId
    }

    if (
      selectedAddonPlanId &&
      selectedAddonCode
    ) {
      metadata.addon_plan_id =
        selectedAddonPlanId

      metadata.addon_code =
        selectedAddonCode
    }

    /*
     * 4. Cria a preferência.
     */
    const result =
      await preference.create({
        body: {
          notification_url:
            `${appUrl}/api/subscriptions/mercado-pago-webhook`,

          items: [
            {
              id:
                itemId,

              title:
                `${itemName} - ${
                  billingCycle ===
                  'annual'
                    ? 'Anual'
                    : 'Mensal'
                }`,

              quantity:
                1,

              unit_price:
                amount,

              currency_id:
                'BRL',
            },
          ],

          back_urls: {
            success:
              `${appUrl}/school/${schoolId}?payment=success`,

            failure:
              `${appUrl}/school/${schoolId}?payment=failure`,

            pending:
              `${appUrl}/school/${schoolId}?payment=pending`,
          },

          auto_return:
            'approved',

          external_reference:
            paymentRow.id,

          metadata,
        },
      })

    const checkoutUrl =
      result.init_point

    if (!checkoutUrl) {
      await supabaseAdmin
        .from(
          'subscription_payments'
        )
        .update({
          status:
            'failed',

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          paymentRow.id
        )

      return NextResponse.json(
        {
          error:
            'O Mercado Pago não retornou o link de pagamento.',
        },
        {
          status: 500,
        }
      )
    }

    return NextResponse.json({
      checkoutUrl,

      internalPaymentId:
        paymentRow.id,

      purchaseType,

      amount,

      billingCycle,
    })
  } catch (error) {
    console.error(
      'ERRO CHECKOUT MERCADO PAGO:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao criar checkout Mercado Pago.',
      },
      {
        status: 500,
      }
    )
  }
}