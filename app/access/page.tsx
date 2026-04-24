'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  async function handleCreateSchool() {
    const schoolName = prompt('Nome da escola:')

    if (!schoolName || !schoolName.trim()) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({
        name: schoolName.trim(),
        owner_user_id: user.id,
      })
      .select()
      .single()

    if (schoolError || !school) {
      alert('Erro ao criar escola')
      return
    }

    const { error: membershipError } = await supabase
      .from('school_memberships')
      .insert({
        user_id: user.id,
        school_id: school.id,
        role: 'admin',
        status: 'active',
      })

    if (membershipError) {
      alert('Erro ao vincular usuário à escola')
      return
    }

    window.location.href = `/school/${school.id}`
  }

  async function linkPendingInvitationsByEmail(userId: string, userEmail: string) {
    const normalizedEmail = userEmail.trim().toLowerCase()

    const { data: invitations, error } = await supabase
      .from('pending_invitations')
      .select('id, school_id, role, status')
      .eq('email', normalizedEmail)
      .eq('status', 'pending')

    if (error || !invitations || invitations.length === 0) {
      return
    }

    for (const invitation of invitations) {
      const { error: membershipError } = await supabase
        .from('school_memberships')
        .insert({
          school_id: invitation.school_id,
          user_id: userId,
          role: invitation.role,
          status: 'active',
        })

      if (membershipError) {
        const msg = membershipError.message.toLowerCase()
        if (!msg.includes('duplicate key')) {
          continue
        }
      }

      await supabase
        .from('pending_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invitation.id)
    }
  }

  async function linkStudentByEmail(userId: string, userEmail: string) {
  const normalizedEmail = userEmail.trim().toLowerCase()
  console.log('linkStudentByEmail email:', normalizedEmail)

  const { data: studentRecords, error } = await supabase
    .from('students')
    .select('id, school_id, email, full_name')
    .eq('email', normalizedEmail)

  console.log('studentRecords:', studentRecords)
  console.log('studentRecords error:', error)

  if (error || !studentRecords || studentRecords.length === 0) {
    console.log('Nenhum aluno encontrado para esse e-mail.')
    return
  }

  for (const student of studentRecords) {
    const { data: existingMembership, error: existingError } = await supabase
      .from('school_memberships')
      .select('id, role, school_id')
      .eq('user_id', userId)
      .eq('school_id', student.school_id)
      .eq('role', 'aluno')
      .limit(1)
      .maybeSingle()

    console.log('existingMembership:', existingMembership)
    console.log('existingMembership error:', existingError)

    if (existingMembership) {
      console.log('Membership de aluno já existe para essa escola.')
      continue
    }

    const { data: insertData, error: insertError } = await supabase
      .from('school_memberships')
      .insert({
        user_id: userId,
        school_id: student.school_id,
        role: 'aluno',
        status: 'active',
        area: null,
      })
      .select()

    console.log('insert membership data:', insertData)
    console.log('insert membership error:', insertError)
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
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/')
        return
      }

      await ensureUserProfile(
        user.id,
        user.email || '',
        (user.user_metadata?.full_name as string) || ''
      )

      await linkPendingInvitationsByEmail(user.id, user.email || '')
      await linkStudentByEmail(user.id, user.email || '')

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
    padding: '32px 16px',
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 820,
    margin: '0 auto',
  }

  const heroCardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
    marginBottom: 20,
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    margin: '10px 0 0',
    fontSize: 15,
    color: '#475569',
    lineHeight: 1.6,
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
    color: '#ffffff',
    fontSize: 12,
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
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: 14,
    lineHeight: 1.5,
  }

  const listStyle: React.CSSProperties = {
    marginTop: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }

  const schoolCardStyle: React.CSSProperties = {
    width: '100%',
    padding: 18,
    textAlign: 'left',
    border: '1px solid #dbeafe',
    borderRadius: 18,
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.06)',
  }

  const schoolNameStyle: React.CSSProperties = {
    fontSize: 17,
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
      padding: '6px 10px',
      borderRadius: 999,
      background: colors[role].bg,
      color: colors[role].text,
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'capitalize',
    }
  }

  const actionsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 20,
  }

  const primaryButtonStyle: React.CSSProperties = {
    padding: '12px 18px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(37, 99, 235, 0.24)',
  }

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '12px 18px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <div style={heroCardStyle}>
            <div style={badgeStyle}>Gestão educacional</div>
            <h1 style={titleStyle}>Acesso às escolas</h1>
            <p style={subtitleStyle}>
              Estamos preparando seu ambiente para exibir as escolas vinculadas à sua conta.
            </p>
            <div style={statusStyle}>{message}</div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
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
          <div style={statusStyle}>{message}</div>

          {memberships.length === 0 ? (
            <div style={actionsRowStyle}>
              <button
                onClick={() => router.push('/school/create')}
                style={primaryButtonStyle}
              >
                Criar escola
              </button>

              <button onClick={handleLogout} style={secondaryButtonStyle}>
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
                  >
                    <div style={schoolNameStyle}>
                      {item.schools?.name || 'Escola sem nome'}
                    </div>
                    <span style={rolePillStyle(item.role)}>Perfil: {item.role}</span>
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
    </main>
  )
}