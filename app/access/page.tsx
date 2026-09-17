'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type MembershipRow = {
  school_id: string
  role: 'admin' | 'gestor' | 'professor' | 'aluno' | 'responsavel'
  schools: {
    name: string
  } | null
}

export default function AccessPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Carregando...')
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [windowWidth, setWindowWidth] = useState(1200)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

useEffect(() => {
  function handleResize() {
    setWindowWidth(window.innerWidth)
  }

  handleResize()
  window.addEventListener('resize', handleResize)

  return () => window.removeEventListener('resize', handleResize)
}, [])

const isMobile = windowWidth < 768
const isTablet = windowWidth >= 768 && windowWidth < 1024


  async function claimPendingInvitations() {
  const { data, error } = await supabase.rpc(
    'claim_my_schoolos_pending_invitations'
  )

  if (error) {
    console.error(
      'Erro ao processar vínculos pendentes do SchoolOS:',
      error
    )
    return
  }

  if ((data ?? 0) > 0) {
    console.log(
      `Vínculos ativados automaticamente: ${data}`
    )
  }
}

  async function claimStudentMemberships() {
  const { data, error } = await supabase.rpc(
    'claim_my_schoolos_student_memberships'
  )

  if (error) {
    console.error(
      'Erro ao processar vínculos de aluno:',
      error
    )
    return
  }

  if ((data ?? 0) > 0) {
    console.log(
      `Vínculos de aluno ativados automaticamente: ${data}`
    )
  }
}

  async function ensureUserProfile(userId: string, userEmail: string, fullName?: string) {
  const normalizedEmail = userEmail.trim().toLowerCase()

  const { data: existingProfile, error: selectError } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (selectError) {
    console.log('Erro ao buscar user_profiles:', selectError)
    return
  }

  if (existingProfile) {
    return
  }

  const { error: insertError } = await supabase.from('user_profiles').insert({
    id: userId,
    email: normalizedEmail,
    full_name: fullName || '',
  })

  if (insertError) {
    console.log('Erro ao inserir user_profiles:', insertError)
  }
}

  useEffect(() => {
    async function loadAccess() {
      const {
  data: { session },
  error: sessionError,
} = await supabase.auth.getSession()

if (sessionError || !session?.user) {
  setMessage('Sessão não encontrada. Faça login novamente.')
  setLoading(false)
  return
}

const user = session.user

      await ensureUserProfile(
        user.id,
        user.email || '',
        (user.user_metadata?.full_name as string) || ''
      )

      await claimPendingInvitations()
      await claimStudentMemberships()

      const { data, error } = await supabase
        .from('school_memberships')
        .select(`
          school_id,
          role,
          schools (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) {
        setMessage(`Erro ao buscar escolas: ${error.message}`)
        setLoading(false)
        return
      }

      const rows = (data || []) as unknown as MembershipRow[]
      setMemberships(rows)

      if (rows.length === 0) {
        setMessage('Você ainda não está vinculado a nenhuma escola.')
        setLoading(false)
        return
      }

      if (rows.length === 1) {
        router.replace(`/school/${rows[0].school_id}`)
        return
      }

      setMessage('Selecione uma escola para entrar.')
      setLoading(false)
    }

    loadAccess()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #e0f2fe 100%)',
}

  const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1200px',
  margin: '0 auto',
  padding: isMobile ? '16px' : isTablet ? '24px' : '32px',
  display: 'flex',
  flexDirection: 'column',
  gap: isMobile ? 16 : 24,
}

  const heroCardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  borderRadius: isMobile ? 18 : 24,
  padding: isMobile ? 20 : isTablet ? 24 : 28,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
  marginBottom: isMobile ? 12 : 20,
}

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: isMobile ? 22 : isTablet ? 26 : 30,
    lineHeight: '1.2',
    fontWeight: 800,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    margin: '10px 0 0',
    fontSize: isMobile ? 14 : 16,
    lineHeight: '1.5',
    color: '#475569',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: isMobile ? '4px 10px' : '6px 12px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#ffffff',
    fontSize: isMobile ? 12 : 13,
    fontWeight: 700,
    letterSpacing: 0.3,
    marginBottom: 16,
  }

  const sectionCardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)',
    padding: 24,
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
  }

  const statusStyle: React.CSSProperties = {
    marginTop: 10,
    padding: isMobile ? 10 : 12,
    borderRadius: 10,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: isMobile ? 13 : 14,
    lineHeight: 1.5,
  }

  const listStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: isMobile
    ? '1fr'
    : isTablet
    ? '1fr 1fr'
    : '1fr 1fr 1fr',
}

  const schoolCardStyle: React.CSSProperties = {
  width: '100%',
  padding: isMobile ? 16 : 18,
  textAlign: 'left',
  border: '1px solid #dbeafe',
  borderRadius: isMobile ? 16 : 18,
  background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: '0 10px 24px rgba(37, 99, 235, 0.06)',
  minHeight: isMobile ? 92 : 104,
  transform: 'scale(1)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

  const schoolNameStyle: React.CSSProperties = {
    fontSize: isMobile ? 15 : 16,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
  }

  const rolePillStyle = (role: MembershipRow['role']): React.CSSProperties => {
    const colors: Record<MembershipRow['role'], { bg: string; text: string }> = {
      admin: { bg: '#dbeafe', text: '#1d4ed8' },
      gestor: { bg: '#dcfce7', text: '#15803d' },
      professor: { bg: '#ede9fe', text: '#6d28d9' },
      aluno: { bg: '#fef3c7', text: '#b45309' },
      responsavel: { bg: '#fee2e2', text: '#b91c1c' },
    }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 999,
      background: colors[role].bg,
      color: colors[role].text,
      fontSize: isMobile ? 12 : 13,
      fontWeight: 700,
      textTransform: 'capitalize',
    }
  }

  const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: isMobile ? 'column' : 'row',
  gap: 12,
  marginTop: isMobile ? 16 : 20,
}

  const primaryButtonStyle: React.CSSProperties = {
  padding: isMobile ? '14px 16px' : '12px 18px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: isMobile ? 15 : 14,
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(37, 99, 235, 0.24)',
  width: isMobile ? '100%' : 'auto',
  transition: "all 0.2s ease"
}

  const secondaryButtonStyle: React.CSSProperties = {
  padding: isMobile ? '14px 16px' : '12px 18px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: isMobile ? 15 : 14,
  cursor: 'pointer',
  width: isMobile ? '100%' : 'auto',
  transition: "all 0.2s ease"
}

const appShellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  background:
    'linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #e0f2fe 100%)',
}

const sidebarStyle: React.CSSProperties = {
  width: isMobile ? 280 : 280,
  minHeight: '100vh',
  background: '#0f172a',
  color: '#ffffff',
  padding: 20,
  position: isMobile ? 'fixed' : 'sticky',
  top: 0,
  left: isMobile ? (sidebarOpen ? 0 : -300) : 0,
  transition: 'left 0.25s ease',
  zIndex: 50,
}

const mainContentStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: isMobile ? 16 : 32,
}

const mobileTopBarStyle: React.CSSProperties = {
  display: isMobile ? 'flex' : 'none',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 16,
}

const sidebarButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: 'none',
  background: 'transparent',
  color: '#cbd5e1',
  textAlign: 'left',
  fontWeight: 700,
  cursor: 'pointer',
}

  if (loading) {
    return (
  <main style={appShellStyle}>
    <section style={mainContentStyle}>
      <div style={containerStyle}>
        <div style={heroCardStyle}>
          <div style={badgeStyle}>SchoolOS Iniciando...</div>
          <h1 style={titleStyle}>Acesso às escolas</h1>
          <p style={subtitleStyle}>
            Estamos preparando seu ambiente para exibir as escolas vinculadas à sua conta.
          </p>
          <div style={statusStyle}>{message}</div>
        </div>
      </div>
    </section>
  </main>
)
  }

  return (
  <main style={appShellStyle}>
    <aside style={sidebarStyle}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 24 }}>
        SchoolOS
      </div>

      <button
  style={{
    ...sidebarButtonStyle,
    background: pathname === '/' ? '#1e293b' : 'transparent',
    color: pathname === '/' ? '#fff' : '#cbd5e1',
  }}
>
  Painel de acesso
</button>

      <button
  onClick={() => router.push('/school/create')}
  style={{
    ...sidebarButtonStyle,
    background: pathname === '/school/create' ? '#1e293b' : 'transparent',
    color: pathname === '/school/create' ? '#ffffff' : '#cbd5e1',
  }}
>
  Criar escola
</button>

      <button onClick={handleLogout} style={sidebarButtonStyle}>
        Sair
      </button>
    </aside>

    <section style={mainContentStyle}>
      <div style={mobileTopBarStyle}>
        <strong>SchoolOS</strong>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Menu
        </button>
      </div>

      <div style={containerStyle}>
        <section style={heroCardStyle}>
          <div style={badgeStyle}>Painel de acesso</div>
          <h1 style={titleStyle}>Escolha onde deseja entrar</h1>
          <p style={subtitleStyle}>
            Acesse rapidamente a escola vinculada ao seu perfil ou crie uma nova estrutura.
          </p>
        </section>

        <section style={sectionCardStyle}>
<h2 style={sectionTitleStyle}>Seu acesso</h2>

<div style={{ ...statusStyle, marginBottom: 20 }}>
  {message}
</div>

{memberships.length === 0 ? (
            <div style={actionsRowStyle}>
              <button
                onClick={() => router.push('/school/create')}
                style={primaryButtonStyle}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'scale(1.02)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'scale(1)')
                }
              >
                Criar escola
              </button>

              <button
                onClick={handleLogout}
                style={secondaryButtonStyle}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.transform = 'scale(1.02)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = 'scale(1)')
                }
              >
                Sair
              </button>
            </div>
          ) : (
            <>
              <div style={listStyle}>
                {memberships.map((item) => (
                  <button
                    key={`${item.school_id}-${item.role}`}
                    onClick={() => router.push(`/school/${item.school_id}`)}
                    style={schoolCardStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.boxShadow =
                        '0 16px 40px rgba(37, 99, 235, 0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow =
                        '0 10px 24px rgba(37, 99, 235, 0.06)'
                    }}
                  >
                    <div style={schoolNameStyle}>
                      {item.schools?.name || 'Escola sem nome'}
                    </div>
                    <span style={rolePillStyle(item.role)}>
                      Perfil: {item.role}
                    </span>
                  </button>
                ))}
              </div>

              <div style={actionsRowStyle}>
                <button
                  onClick={() => router.push('/school/create')}
                  style={primaryButtonStyle}
                >
                  Criar nova escola
                </button>

                <button onClick={handleLogout} style={secondaryButtonStyle}>
                  Sair
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  </main>
)
}