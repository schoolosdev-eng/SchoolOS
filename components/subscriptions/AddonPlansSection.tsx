'use client'

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import { supabase } from '@/lib/supabase'

type AddonCode =
  | 'arrival_photo_whatsapp'
  | 'regular_exit_photo_whatsapp'

type AddonPlan = {
  id: string
  addon_code: AddonCode
  name: string
  student_limit: number
  unit_price: number
  monthly_price: number
  billing_cycle: 'monthly'
  is_active: boolean
}

type AddonSubscription = {
  id: string
  addon_plan_id: string
  addon_code: AddonCode
  status: string
  student_limit: number | null
  coverage_mode:
    | 'all'
    | 'selected'
  current_period_start:
    | string
    | null
  current_period_end:
    | string
    | null
}

type Props = {
  schoolId: string
  showMessage: (
    message: string
  ) => void
}

const ADDON_CODES: AddonCode[] = [
  'arrival_photo_whatsapp',
  'regular_exit_photo_whatsapp',
]

const ADDON_PRESENTATION: Record<
  AddonCode,
  {
    title: string
    description: string
    features: string[]
  }
> = {
  arrival_photo_whatsapp: {
    title:
      'Entrada com foto e WhatsApp',

    description:
      'Envia ao responsável uma mensagem automática com a foto e o horário de chegada do aluno.',

    features: [
      'Entrada por reconhecimento facial',
      'Entrada offline por QR Code',
      'Foto armazenada como comprovante',
      'Acompanhamento de entrega e leitura',
    ],
  },

  regular_exit_photo_whatsapp: {
    title:
      'Saída com foto e WhatsApp',

    description:
      'Envia ao responsável uma mensagem automática com a foto e o horário de saída normal do aluno.',

    features: [
      'Saída por reconhecimento facial',
      'Saída por QR Code',
      'Foto armazenada como comprovante',
      'Acompanhamento de entrega e leitura',
    ],
  },
}

function createEmptySubscriptionMap() {
  return {
    arrival_photo_whatsapp:
      null,

    regular_exit_photo_whatsapp:
      null,
  } as Record<
    AddonCode,
    AddonSubscription | null
  >
}

function isSubscriptionActive(
  subscription:
    | AddonSubscription
    | null
) {
  if (
    !subscription ||
    subscription.status !== 'active'
  ) {
    return false
  }

  const now = Date.now()

  if (
    subscription.current_period_start
  ) {
    const start =
      new Date(
        subscription
          .current_period_start
      ).getTime()

    if (
      !Number.isNaN(start) &&
      start > now
    ) {
      return false
    }
  }

  if (
    subscription.current_period_end
  ) {
    const end =
      new Date(
        subscription
          .current_period_end
      ).getTime()

    if (
      !Number.isNaN(end) &&
      end < now
    ) {
      return false
    }
  }

  return true
}

function formatMoney(
  value: number
) {
  return value.toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  )
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'Sem vencimento definido'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Data inválida'
  }

  return date.toLocaleDateString(
    'pt-BR'
  )
}

function getRemainingText(
  subscription:
    | AddonSubscription
    | null
) {
  if (
    !subscription
      ?.current_period_end
  ) {
    return 'Sem vencimento definido'
  }

  const end =
    new Date(
      subscription
        .current_period_end
    )

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    return 'Data inválida'
  }

  const diff =
    Math.ceil(
      (
        end.getTime() -
        Date.now()
      ) /
        (
          1000 *
          60 *
          60 *
          24
        )
    )

  if (diff < 0) {
    return 'Adicional vencido'
  }

  if (diff === 0) {
    return 'Vence hoje'
  }

  if (diff === 1) {
    return 'Resta 1 dia'
  }

  return `Restam ${diff} dias`
}

function getCoverageLabel(
  value:
    AddonSubscription[
      'coverage_mode'
    ]
) {
  return value === 'selected'
    ? 'Alunos selecionados'
    : 'Todos os alunos'
}

export default function AddonPlansSection({
  schoolId,
  showMessage,
}: Props) {
  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    addonPlans,
    setAddonPlans,
  ] = useState<AddonPlan[]>([])

  const [
    subscriptions,
    setSubscriptions,
  ] = useState<
    Record<
      AddonCode,
      AddonSubscription | null
    >
  >(createEmptySubscriptionMap)

  const [
    processingPlanId,
    setProcessingPlanId,
  ] = useState<string | null>(
    null
  )

  async function loadAddons() {
    setLoading(true)

    try {
      const [
        plansResult,
        subscriptionsResult,
      ] = await Promise.all([
        supabase
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
          .in(
            'addon_code',
            ADDON_CODES
          )
          .eq(
            'is_active',
            true
          )
          .order(
            'addon_code',
            {
              ascending: true,
            }
          )
          .order(
            'student_limit',
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            'school_addon_subscriptions'
          )
          .select(`
            id,
            addon_plan_id,
            addon_code,
            status,
            student_limit,
            coverage_mode,
            current_period_start,
            current_period_end
          `)
          .eq(
            'school_id',
            schoolId
          )
          .in(
            'addon_code',
            ADDON_CODES
          ),
      ])

      if (plansResult.error) {
        throw plansResult.error
      }

      if (
        subscriptionsResult.error
      ) {
        throw subscriptionsResult.error
      }

      setAddonPlans(
        (
          plansResult.data || []
        ).map((plan) => ({
          ...plan,

          addon_code:
            plan.addon_code as
              AddonCode,

          student_limit:
            Number(
              plan.student_limit
            ),

          unit_price:
            Number(
              plan.unit_price
            ),

          monthly_price:
            Number(
              plan.monthly_price
            ),

          billing_cycle:
            'monthly' as const,
        }))
      )

      const nextSubscriptions =
        createEmptySubscriptionMap()

      for (
        const subscription of
          subscriptionsResult.data ||
          []
      ) {
        const addonCode =
          subscription
            .addon_code as
            AddonCode

        if (
          ADDON_CODES.includes(
            addonCode
          )
        ) {
          nextSubscriptions[
            addonCode
          ] =
            subscription as
              AddonSubscription
        }
      }

      setSubscriptions(
        nextSubscriptions
      )
    } catch (error) {
      console.error(
        '[PLANOS ADICIONAIS] erro ao carregar:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar adicionais.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return

    loadAddons()
  }, [schoolId])

  const plansByAddon =
    useMemo(() => {
      return {
        arrival_photo_whatsapp:
          addonPlans.filter(
            (plan) =>
              plan.addon_code ===
              'arrival_photo_whatsapp'
          ),

        regular_exit_photo_whatsapp:
          addonPlans.filter(
            (plan) =>
              plan.addon_code ===
              'regular_exit_photo_whatsapp'
          ),
      }
    }, [addonPlans])

  async function handleAddonCheckout(
    plan: AddonPlan
  ) {
    if (processingPlanId) {
      return
    }

    setProcessingPlanId(
      plan.id
    )

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth
          .getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          'Usuário não autenticado.'
        )
      }

      const response =
        await fetch(
          '/api/subscriptions/create-mercado-pago-checkout',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              schoolId,

              purchaseType:
                'addon',

              addonPlanId:
                plan.id,
            }),
          }
        )

      const data =
        await response
          .json()
          .catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Erro ao iniciar o pagamento do adicional.'
        )
      }

      if (!data.checkoutUrl) {
        throw new Error(
          'O Mercado Pago não retornou o link de pagamento.'
        )
      }

      window.location.href =
        data.checkoutUrl
    } catch (error) {
      console.error(
        '[PLANOS ADICIONAIS] erro no checkout:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao contratar adicional.'
      )

      setProcessingPlanId(
        null
      )
    }
  }

  if (loading) {
    return (
      <section style={containerStyle}>
        <div style={loadingStyle}>
          Carregando adicionais...
        </div>
      </section>
    )
  }

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <span style={premiumBadgeStyle}>
            Recursos adicionais
          </span>

          <h2 style={titleStyle}>
            Mensagens automáticas
          </h2>

          <p style={descriptionStyle}>
            Contrate separadamente os
            avisos de entrada e de saída.
            Cada pacote corresponde ao
            número máximo de alunos que
            poderá utilizar o recurso.
          </p>
        </div>
      </div>

      <div style={importantNoticeStyle}>
        Entrada e saída possuem
        contratações independentes. Depois
        da ativação, escolha em
        Configurações se o recurso será
        utilizado para todos os alunos ou
        apenas para alunos selecionados.
      </div>

      <div style={addonGroupsStyle}>
        {ADDON_CODES.map(
          (addonCode) => {
            const presentation =
              ADDON_PRESENTATION[
                addonCode
              ]

            const subscription =
              subscriptions[
                addonCode
              ]

            const active =
              isSubscriptionActive(
                subscription
              )

            const plans =
              plansByAddon[
                addonCode
              ]

            return (
              <article
                key={addonCode}
                style={addonGroupStyle}
              >
                <div style={addonHeaderStyle}>
                  <div>
                    <h3 style={addonTitleStyle}>
                      {presentation.title}
                    </h3>

                    <p style={addonDescriptionStyle}>
                      {
                        presentation.description
                      }
                    </p>
                  </div>

                  <span
                    style={{
                      ...statusBadgeStyle,

                      background:
                        active
                          ? '#dcfce7'
                          : '#f1f5f9',

                      color:
                        active
                          ? '#15803d'
                          : '#64748b',
                    }}
                  >
                    {active
                      ? 'Ativo'
                      : 'Não contratado'}
                  </span>
                </div>

                {subscription && (
                  <div style={subscriptionInfoStyle}>
                    <span>
                      <strong>
                        Pacote:
                      </strong>{' '}
                      até{' '}
                      {subscription.student_limit ||
                        0}{' '}
                      alunos
                    </span>

                    <span>
                      <strong>
                        Cobertura:
                      </strong>{' '}
                      {getCoverageLabel(
                        subscription.coverage_mode
                      )}
                    </span>

                    <span>
                      <strong>
                        Vencimento:
                      </strong>{' '}
                      {formatDate(
                        subscription
                          .current_period_end
                      )}
                    </span>

                    <span>
                      <strong>
                        Situação:
                      </strong>{' '}
                      {getRemainingText(
                        subscription
                      )}
                    </span>
                  </div>
                )}

                <div style={featuresStyle}>
                  {presentation.features.map(
                    (feature) => (
                      <span
                        key={feature}
                        style={featureStyle}
                      >
                        ✅ {feature}
                      </span>
                    )
                  )}
                </div>

                <div style={packagesGridStyle}>
                  {plans.map(
                    (plan) => {
                      const currentPackage =
                        active &&
                        subscription
                          ?.addon_plan_id ===
                          plan.id

                      const processing =
                        processingPlanId ===
                        plan.id

                      return (
                        <div
                          key={plan.id}
                          style={{
                            ...packageCardStyle,

                            border:
                              currentPackage
                                ? '2px solid #16a34a'
                                : '1px solid #e2e8f0',

                            background:
                              currentPackage
                                ? '#f0fdf4'
                                : '#ffffff',
                          }}
                        >
                          <div>
                            <div style={packageTopRowStyle}>
                              <span style={limitBadgeStyle}>
                                Até{' '}
                                {plan.student_limit}{' '}
                                alunos
                              </span>

                              {currentPackage && (
                                <span style={currentBadgeStyle}>
                                  Pacote atual
                                </span>
                              )}
                            </div>

                            <div style={priceStyle}>
                              {formatMoney(
                                plan.monthly_price
                              )}
                            </div>

                            <div style={periodStyle}>
                              por mês
                            </div>

                            <div style={unitPriceStyle}>
                              {formatMoney(
                                plan.unit_price
                              )}{' '}
                              por aluno
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={
                              Boolean(
                                processingPlanId
                              )
                            }
                            onClick={() =>
                              handleAddonCheckout(
                                plan
                              )
                            }
                            style={{
                              ...checkoutButtonStyle,

                              opacity:
                                processingPlanId
                                  ? 0.65
                                  : 1,

                              cursor:
                                processingPlanId
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            {processing
                              ? 'Gerando pagamento...'
                              : currentPackage
                              ? 'Renovar por mais 1 mês'
                              : active
                              ? 'Alterar pacote via PIX'
                              : 'Contratar via PIX'}
                          </button>
                        </div>
                      )
                    }
                  )}
                </div>
              </article>
            )
          }
        )}
      </div>
    </section>
  )
}

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
  background:
    'rgba(255,255,255,0.96)',
  border:
    '1px solid #e2e8f0',
  borderRadius: 30,
  padding: 26,
  boxShadow:
    '0 18px 45px rgba(15,23,42,0.06)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent:
    'space-between',
  gap: 18,
  flexWrap: 'wrap',
}

const premiumBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '8px 13px',
  borderRadius: 999,
  background: '#f3e8ff',
  color: '#6d28d9',
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 12,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 32,
  fontWeight: 900,
}

const descriptionStyle: CSSProperties = {
  margin: '10px 0 0',
  color: '#64748b',
  lineHeight: 1.6,
  maxWidth: 760,
}

const importantNoticeStyle: CSSProperties = {
  padding: 15,
  borderRadius: 17,
  background: '#eff6ff',
  border:
    '1px solid #bfdbfe',
  color: '#1e40af',
  lineHeight: 1.55,
  fontWeight: 700,
}

const addonGroupsStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
}

const addonGroupStyle: CSSProperties = {
  padding: 22,
  borderRadius: 24,
  background: '#f8fafc',
  border:
    '1px solid #e2e8f0',
}

const addonHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems:
    'flex-start',
  gap: 16,
  flexWrap: 'wrap',
}

const addonTitleStyle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 24,
  fontWeight: 900,
}

const addonDescriptionStyle: CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  lineHeight: 1.55,
  maxWidth: 700,
}

const statusBadgeStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
}

const subscriptionInfoStyle: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 16,
  background: '#ffffff',
  border:
    '1px solid #e2e8f0',
  color: '#475569',
  fontSize: 13,
}

const featuresStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 18,
}

const featureStyle: CSSProperties = {
  color: '#334155',
  fontSize: 13,
  fontWeight: 700,
}

const packagesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(230px, 1fr))',
  gap: 16,
  marginTop: 20,
}

const packageCardStyle: CSSProperties = {
  padding: 19,
  borderRadius: 21,
  display: 'flex',
  flexDirection: 'column',
  justifyContent:
    'space-between',
  gap: 22,
  minHeight: 250,
  boxShadow:
    '0 12px 28px rgba(15,23,42,0.04)',
}

const packageTopRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const limitBadgeStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 999,
  background: '#dbeafe',
  color: '#1d4ed8',
  fontSize: 12,
  fontWeight: 900,
}

const currentBadgeStyle: CSSProperties = {
  padding: '7px 10px',
  borderRadius: 999,
  background: '#dcfce7',
  color: '#15803d',
  fontSize: 11,
  fontWeight: 900,
}

const priceStyle: CSSProperties = {
  marginTop: 20,
  color: '#0f172a',
  fontSize: 35,
  fontWeight: 900,
}

const periodStyle: CSSProperties = {
  marginTop: 4,
  color: '#64748b',
  fontWeight: 700,
}

const unitPriceStyle: CSSProperties = {
  marginTop: 12,
  color: '#475569',
  fontSize: 13,
  fontWeight: 800,
}

const checkoutButtonStyle: CSSProperties = {
  width: '100%',
  padding: '15px 17px',
  borderRadius: 16,
  border: 'none',
  background:
    'linear-gradient(135deg, #7c3aed, #6d28d9)',
  color: '#ffffff',
  fontWeight: 900,
}

const loadingStyle: CSSProperties = {
  padding: 28,
  textAlign: 'center',
  color: '#475569',
  fontWeight: 800,
}