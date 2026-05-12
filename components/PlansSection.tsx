'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  schoolId: string
  currentStudents: number
  showMessage: (message: string) => void
}

type Plan = {
  id: string
  name: string
  billing_cycle: 'monthly' | 'annual'
  price: number
  student_limit: number
}

type CurrentSubscription = {
  plan_id: string
  status: string
}

export default function PlansSection({
  schoolId,
  currentStudents,
  showMessage,
}: Props) {
  const [loading, setLoading] = useState(true)

  const [plans, setPlans] = useState<Plan[]>([])

  const [currentSubscription, setCurrentSubscription] =
    useState<CurrentSubscription | null>(null)

  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>(
    'monthly'
  )

  async function fetchPlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (error) {
      showMessage(`Erro ao carregar planos: ${error.message}`)
      return
    }

    setPlans((data || []) as Plan[])
  }

  async function fetchCurrentSubscription() {
    const { data, error } = await supabase
      .from('school_subscriptions')
      .select('plan_id, status')
      .eq('school_id', schoolId)
      .maybeSingle()

    if (error) {
      showMessage(`Erro ao carregar assinatura: ${error.message}`)
      return
    }

    setCurrentSubscription(data as CurrentSubscription)
  }

  async function handleSelectPlan(planId: string) {
    const selectedPlan = plans.find((plan) => plan.id === planId)

if (!selectedPlan) {
  showMessage('Plano não encontrado.')
  return
}

if (currentStudents > selectedPlan.student_limit) {
  showMessage(
    `Não é possível selecionar este plano. Sua escola possui ${currentStudents} alunos e este plano permite apenas ${selectedPlan.student_limit}.`
  )
  return
}
    setLoading(true)

    const { error } = await supabase
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

    setLoading(false)

    if (error) {
      showMessage(`Erro ao alterar plano: ${error.message}`)
      return
    }

    await fetchCurrentSubscription()

    showMessage('Plano atualizado com sucesso.')
  }

  async function handleCheckout(plan: Plan) {
  if (currentStudents > plan.student_limit) {
    showMessage(
      `Não é possível selecionar este plano. Sua escola possui ${currentStudents} alunos e este plano permite apenas ${plan.student_limit}.`
    )
    return
  }

  if (plan.price <= 0) {
  const { error } = await supabase
    .from('school_subscriptions')
    .upsert(
      {
        school_id: schoolId,
        plan_id: plan.id,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'school_id',
      }
    )

  if (error) {
    showMessage('Erro ao ativar plano gratuito.')
    return
  }

  await fetchCurrentSubscription()
  showMessage('Plano gratuito ativado com sucesso.')
  return
}

  setLoading(true)

  const response = await fetch('/api/subscriptions/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schoolId,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      studentLimit: plan.student_limit,
      billingCycle: plan.billing_cycle,
    }),
  })

  const data = await response.json()

  setLoading(false)

if (!response.ok) {
  console.error('Erro checkout:', data)
  showMessage(data.error || 'Erro ao iniciar pagamento.')
  return
}

  const checkoutUrl = data.checkoutUrl

  if (!checkoutUrl) {
    showMessage('Link de pagamento não encontrado.')
    return
  }

  window.location.href = checkoutUrl
}

async function handlePixCheckout(plan: Plan) {
  try {
    setLoading(true)

    const response = await fetch(
      '/api/subscriptions/create-pix-checkout',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolId,
          planId: plan.id,
          planName: plan.name,
          price: plan.price,
          studentLimit: plan.student_limit,
          billingCycle: plan.billing_cycle,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      showMessage(
        data.error || 'Erro ao iniciar pagamento Pix.'
      )
      return
    }

    if (!data.checkoutUrl) {
      showMessage(
        'Checkout Pix não retornou URL.'
      )
      return
    }

    window.location.href = data.checkoutUrl
  } catch (error) {
    console.error(error)

    showMessage(
      'Erro inesperado ao gerar pagamento Pix.'
    )
  } finally {
    setLoading(false)
  }
}

  useEffect(() => {
    async function init() {
      setLoading(true)

      await Promise.all([
        fetchPlans(),
        fetchCurrentSubscription(),
      ])

      setLoading(false)
    }

    init()
  }, [])

  const filteredPlans = useMemo(() => {
    return plans.filter(
      (plan) => plan.billing_cycle === selectedCycle
    )
  }, [plans, selectedCycle])

  const currentPlan = useMemo(() => {
    return plans.find(
      (plan) => plan.id === currentSubscription?.plan_id
    )
  }, [plans, currentSubscription])

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  }

  const heroCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #e2e8f0',
    borderRadius: 30,
    padding: 28,
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 14px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#1d4ed8',
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 16,
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 42,
    lineHeight: 1.05,
    fontWeight: 900,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    marginTop: 14,
    color: '#64748b',
    lineHeight: 1.6,
    fontSize: 17,
    maxWidth: 720,
  }

  const currentPlanCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    borderRadius: 28,
    padding: 28,
    color: '#ffffff',
    boxShadow: '0 20px 50px rgba(37, 99, 235, 0.22)',
  }

  const currentPlanTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 800,
    opacity: 0.9,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  }

  const currentPlanNameStyle: React.CSSProperties = {
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: 16,
  }

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  }

  const statCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #e2e8f0',
    borderRadius: 22,
    padding: 20,
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
  }

  const statLabelStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 700,
    marginBottom: 8,
  }

  const statValueStyle: React.CSSProperties = {
    fontSize: 34,
    color: '#0f172a',
    fontWeight: 900,
  }

  const switcherWrapStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  }

  const switchButtonStyle = (
    active: boolean
  ): React.CSSProperties => ({
    padding: '14px 20px',
    borderRadius: 16,
    border: active ? 'none' : '1px solid #cbd5e1',
    background: active
      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
      : '#ffffff',
    color: active ? '#ffffff' : '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: 15,
    boxShadow: active
      ? '0 14px 30px rgba(37, 99, 235, 0.22)'
      : 'none',
  })

  const plansGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
  }

  const planCardStyle = (
    active: boolean
  ): React.CSSProperties => ({
    background: active
      ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
      : 'rgba(255,255,255,0.94)',
    border: active
      ? '2px solid #2563eb'
      : '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 24,
    boxShadow: active
      ? '0 20px 50px rgba(37, 99, 235, 0.15)'
      : '0 16px 40px rgba(15, 23, 42, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 340,
  })

  const planBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    padding: '6px 12px',
    borderRadius: 999,
    background: '#dbeafe',
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 16,
  }

  const planNameStyle: React.CSSProperties = {
    fontSize: 30,
    fontWeight: 900,
    color: '#0f172a',
    marginBottom: 10,
  }

  const planPriceStyle: React.CSSProperties = {
    fontSize: 42,
    fontWeight: 900,
    color: '#1d4ed8',
    lineHeight: 1,
    marginBottom: 14,
  }

  const planDescriptionStyle: React.CSSProperties = {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 1.6,
    marginBottom: 22,
  }

  const featureListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 28,
  }

  const featureItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#0f172a',
    fontWeight: 700,
    fontSize: 15,
  }

  const actionButtonStyle = (
    active: boolean
  ): React.CSSProperties => ({
    padding: '16px 18px',
    borderRadius: 18,
    border: active ? 'none' : '1px solid #2563eb',
    background: active
      ? '#0f172a'
      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontWeight: 800,
    cursor: active ? 'default' : 'pointer',
    fontSize: 15,
    width: '100%',
    opacity: loading ? 0.7 : 1,
  })

  return (
    <section style={sectionStyle}>
      <section style={heroCardStyle}>
        <div style={badgeStyle}>Assinaturas</div>

        <h1 style={titleStyle}>Planos SchoolOS</h1>

        <p style={subtitleStyle}>
          Escolha o plano ideal para sua escola com base na quantidade
          de alunos cadastrados.
        </p>
      </section>

      <section style={currentPlanCardStyle}>
        <div style={currentPlanTitleStyle}>
          Plano atual
        </div>

        <div style={currentPlanNameStyle}>
          {currentPlan?.name || 'Plano não identificado'}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong>Modalidade:</strong>{' '}
            {currentPlan?.billing_cycle === 'annual'
              ? 'Anual'
              : 'Mensal'}
          </div>

          <div>
            <strong>Status:</strong>{' '}
            {currentSubscription?.status || 'Ativo'}
          </div>
        </div>
      </section>

      <section style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>
            Alunos cadastrados
          </div>

          <div style={statValueStyle}>
            {currentStudents}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>
            Limite do plano
          </div>

          <div style={statValueStyle}>
            {currentPlan?.student_limit || 0}
          </div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>
            Valor atual
          </div>

          <div style={statValueStyle}>
            R$ {(currentPlan?.price || 0).toFixed(2)}
          </div>
        </div>
      </section>

      <section
  style={{
    background: 'rgba(255,255,255,0.94)',
    border: '1px solid #e2e8f0',
    borderRadius: 28,
    padding: 24,
    boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
  }}
>
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      flexWrap: 'wrap',
      gap: 12,
    }}
  >
    <div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: '#0f172a',
          marginBottom: 6,
        }}
      >
        Uso do plano
      </div>

      <div
        style={{
          fontSize: 14,
          color: '#64748b',
          fontWeight: 600,
        }}
      >
        {currentStudents} de {currentPlan?.student_limit || 0} alunos utilizados
      </div>
    </div>

    <div
      style={{
        fontSize: 15,
        fontWeight: 900,
        color:
          currentStudents /
            (currentPlan?.student_limit || 1) >=
          0.95
            ? '#dc2626'
            : currentStudents /
                  (currentPlan?.student_limit || 1) >=
                0.8
              ? '#d97706'
              : '#2563eb',
      }}
    >
      {Math.min(
        100,
        Math.round(
          (currentStudents /
            (currentPlan?.student_limit || 1)) *
            100
        )
      )}
      %
    </div>
  </div>

  <div
    style={{
      width: '100%',
      height: 18,
      borderRadius: 999,
      background: '#e2e8f0',
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <div
      style={{
        width: `${Math.min(
          100,
          (currentStudents /
            (currentPlan?.student_limit || 1)) *
            100
        )}%`,
        height: '100%',
        borderRadius: 999,
        transition: '0.4s ease',
        background:
          currentStudents /
            (currentPlan?.student_limit || 1) >=
          0.95
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : currentStudents /
                  (currentPlan?.student_limit || 1) >=
                0.8
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        boxShadow:
          currentStudents /
            (currentPlan?.student_limit || 1) >=
          0.95
            ? '0 10px 25px rgba(220, 38, 38, 0.25)'
            : currentStudents /
                  (currentPlan?.student_limit || 1) >=
                0.8
              ? '0 10px 25px rgba(217, 119, 6, 0.25)'
              : '0 10px 25px rgba(37, 99, 235, 0.25)',
      }}
    />
  </div>
</section>

      <div style={switcherWrapStyle}>
        <button
          onClick={() => setSelectedCycle('monthly')}
          style={switchButtonStyle(
            selectedCycle === 'monthly'
          )}
        >
          Planos Mensais
        </button>

        <button
          onClick={() => setSelectedCycle('annual')}
          style={switchButtonStyle(
            selectedCycle === 'annual'
          )}
        >
          Planos Anuais
        </button>
      </div>

      <section style={plansGridStyle}>
        {filteredPlans.map((plan) => {
          const isCurrent =
            currentSubscription?.plan_id === plan.id

          return (
            <div
              key={plan.id}
              style={planCardStyle(isCurrent)}
            >
              <div>
                <div style={planBadgeStyle}>
                  {plan.billing_cycle === 'annual'
                    ? 'Anual'
                    : 'Mensal'}
                </div>

                <div style={planNameStyle}>
                  {plan.name}
                </div>

                <div style={planPriceStyle}>
                  R$ {plan.price.toFixed(2)}
                </div>

                <div style={planDescriptionStyle}>
                  Ideal para escolas com até{' '}
                  <strong>
                    {plan.student_limit} alunos
                  </strong>
                  .
                </div>

                <div style={featureListStyle}>
                  <div style={featureItemStyle}>
                    ✅ Até {plan.student_limit} alunos
                  </div>

                  <div style={featureItemStyle}>
                    ✅ Gestão completa escolar
                  </div>

                  <div style={featureItemStyle}>
                    ✅ Relatórios e avaliações
                  </div>

                  <div style={featureItemStyle}>
                    ✅ Controle de presença
                  </div>
                </div>
              </div>

              {isCurrent ? (
  <button
    disabled
    style={actionButtonStyle(true)}
  >
    Plano Atual
  </button>
) : plan.price <= 0 ? (
  <button
    disabled={loading}
    onClick={() => handleCheckout(plan)}
    style={actionButtonStyle(false)}
  >
    Ativar Plano Gratuito
  </button>
) : (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <button
      disabled={loading}
      onClick={() => handleCheckout(plan)}
      style={actionButtonStyle(false)}
    >
      Assinar com cartão
    </button>

    <button
      disabled={loading}
      onClick={() => handlePixCheckout(plan)}
      style={{
        ...actionButtonStyle(false),
        background: '#16a34a',
        boxShadow: '0 14px 30px rgba(22, 163, 74, 0.22)',
      }}
    >
      Pagar com Pix
    </button>
  </div>
)}
            </div>
          )
        })}
      </section>
    </section>
  )
}