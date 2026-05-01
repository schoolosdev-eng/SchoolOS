'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PerfilPage() {
  const params = useParams<{ schoolId: string }>()
  const router = useRouter()
  const schoolId = params.schoolId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const isAdmin = role === 'admin'
  const isManager = role === 'gestor'

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace('/')
        return
      }

      setUserId(user.id)
      setEmail(user.email || '')

      const { data: membership, error: membershipError } = await supabase
        .from('school_memberships')
        .select('role')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .maybeSingle()

      if (membershipError || !membership) {
        router.replace('/access')
        return
      }

      if (membership.role !== 'admin' && membership.role !== 'gestor') {
        setRole(membership.role)
        setLoading(false)
        return
      }

      setRole(membership.role)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, whatsapp')
        .eq('id', user.id)
        .maybeSingle()

      setFullName(profile?.full_name || user.user_metadata?.full_name || '')
      setWhatsapp(profile?.whatsapp || '')

      setLoading(false)
    }

    loadProfile()
  }, [router, schoolId])

  function showMessage(text: string) {
    setMessage(text)

    setTimeout(() => {
      setMessage('')
    }, 2500)
  }

  async function handleSave() {
    if (!userId) return

    if (!fullName.trim()) {
      showMessage('Informe seu nome completo.')
      return
    }

    setSaving(true)

    const { error } = await supabase.from('user_profiles').upsert({
      id: userId,
      email,
      full_name: fullName.trim(),
      whatsapp: whatsapp.trim() || null,
    })

    setSaving(false)

    if (error) {
      showMessage(`Erro ao salvar: ${error.message}`)
      return
    }

    showMessage('Perfil atualizado com sucesso.')
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <strong>Carregando perfil...</strong>
        </section>
      </main>
    )
  }

  if (!isAdmin && !isManager) {
    return (
      <main style={pageStyle}>
        <section style={cardStyle}>
          <h1 style={titleStyle}>Acesso não permitido</h1>
          <p style={textStyle}>
            Esta área é exclusiva para administradores e gestores.
          </p>

          <button
            onClick={() => router.push(`/school/${schoolId}`)}
            style={secondaryButtonStyle}
          >
            Voltar ao painel
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <div style={badgeStyle}>Perfil do usuário</div>
            <h1 style={titleStyle}>Meus dados pessoais</h1>
            <p style={textStyle}>
              Visualize e edite seus dados. O e-mail usado na criação da conta
              não pode ser alterado.
            </p>
          </div>

          <button
            onClick={() => router.push(`/school/${schoolId}`)}
            style={secondaryButtonStyle}
          >
            Voltar
          </button>
        </div>

        <div style={formStyle}>
          <label style={labelStyle}>
            Nome completo
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome completo"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex: 88999999999"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            E-mail da conta
            <input
              value={email}
              disabled
              style={{
                ...inputStyle,
                background: '#f1f5f9',
                color: '#64748b',
                cursor: 'not-allowed',
              }}
            />
          </label>

          <label style={labelStyle}>
            Perfil atual
            <input
              value={role}
              disabled
              style={{
                ...inputStyle,
                background: '#f1f5f9',
                color: '#64748b',
                cursor: 'not-allowed',
                textTransform: 'capitalize',
              }}
            />
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </section>

      {message && <div style={messageStyle}>{message}</div>}
    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #f3f6fb 0%, #eef2f8 100%)',
  padding: 24,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 720,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 28,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 24,
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '8px 14px',
  borderRadius: 999,
  background: '#dbeafe',
  color: '#1d4ed8',
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 14,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.1,
  fontWeight: 900,
  color: '#0f172a',
}

const textStyle: React.CSSProperties = {
  margin: '10px 0 0',
  color: '#64748b',
  fontSize: 16,
  lineHeight: 1.5,
}

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  fontSize: 14,
  fontWeight: 800,
  color: '#334155',
}

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  fontSize: 15,
  outline: 'none',
  color: '#0f172a',
  background: '#ffffff',
}

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
  cursor: 'pointer',
  fontSize: 14,
}

const messageStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: '#0f172a',
  color: '#ffffff',
  padding: '16px 24px',
  borderRadius: 16,
  fontWeight: 800,
  fontSize: 16,
  zIndex: 9999,
  boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
  textAlign: 'center',
  maxWidth: 360,
  width: 'calc(100% - 48px)',
}