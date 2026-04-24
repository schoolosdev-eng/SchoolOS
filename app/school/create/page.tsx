'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CreateSchoolPage() {
  const router = useRouter()

  const [schoolName, setSchoolName] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [schoolCep, setSchoolCep] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const [windowWidth, setWindowWidth] = useState(1200)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  async function handleCreateSchool() {
    setLoading(true)
    setMessage('Criando escola...')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Usuário não autenticado.')
      setLoading(false)
      router.replace('/')
      return
    }

    if (!schoolName.trim()) {
      setMessage('Informe o nome da escola.')
      setLoading(false)
      return
    }

    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .insert({
        name: schoolName.trim(),
        email: schoolEmail.trim().toLowerCase() || null,
        phone: schoolPhone.trim() || null,
        address: schoolAddress.trim() || null,
        cep: schoolCep.trim() || null,
        plan: 'basic',
        student_limit: 100,
        status: 'active',
      })
      .select('id, name')
      .single()

    if (schoolError || !schoolData) {
      setMessage(`Erro ao criar escola: ${schoolError?.message}`)
      setLoading(false)
      return
    }

    const { error: membershipError } = await supabase
      .from('school_memberships')
      .insert({
        school_id: schoolData.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      })

    if (membershipError) {
      setMessage(`Escola criada, mas houve erro ao vincular o admin: ${membershipError.message}`)
      setLoading(false)
      return
    }

    setMessage('Escola criada com sucesso.')
    router.replace(`/school/${schoolData.id}`)
  }
  const appShellStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  background:
    'linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #e0f2fe 100%)',
}

const sidebarStyle: React.CSSProperties = {
  width: 280,
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

const containerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '760px',
  margin: '0 auto',
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: isMobile ? 20 : 28,
  padding: isMobile ? 22 : 32,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
}

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  padding: '0 14px',
  fontSize: 16,
  outline: 'none',
  width: '100%',
}

const primaryButtonStyle: React.CSSProperties = {
  height: 52,
  border: 'none',
  borderRadius: 16,
  background: loading
    ? 'linear-gradient(135deg, #64748b, #475569)'
    : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: loading ? 'not-allowed' : 'pointer',
  width: isMobile ? '100%' : 'auto',
  padding: '0 18px',
}

const secondaryButtonStyle: React.CSSProperties = {
  height: 52,
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
  width: isMobile ? '100%' : 'auto',
  padding: '0 18px',
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

  return (
  <main style={appShellStyle}>
    <aside style={sidebarStyle}>
      <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 24 }}>
        SchoolOS
      </div>

      <button
        onClick={() => router.push('/access')}
        style={{
          ...sidebarButtonStyle,
          background: pathname === '/access' ? '#1e293b' : 'transparent',
          color: pathname === '/access' ? '#ffffff' : '#cbd5e1',
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
        <div style={cardStyle}>
          <div
            style={{
              display: 'inline-flex',
              padding: '6px 12px',
              borderRadius: 999,
              background: '#dbeafe',
              color: '#1d4ed8',
              fontWeight: 800,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            Nova escola
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 26 : 34,
              color: '#0f172a',
              letterSpacing: -0.8,
            }}
          >
            Criar escola
          </h1>

          <p
            style={{
              color: '#475569',
              fontSize: isMobile ? 14 : 16,
              lineHeight: 1.6,
              marginTop: 10,
              marginBottom: 24,
            }}
          >
            Preencha os dados básicos da nova escola.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <input
              type="text"
              placeholder="Nome da escola"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              style={inputStyle}
            />

            <input
              type="email"
              placeholder="E-mail da escola"
              value={schoolEmail}
              onChange={(e) => setSchoolEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Telefone da escola"
              value={schoolPhone}
              onChange={(e) => setSchoolPhone(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Endereço da escola"
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="CEP da escola"
              value={schoolCep}
              onChange={(e) => setSchoolCep(e.target.value)}
              style={inputStyle}
            />

            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: 12,
                marginTop: 8,
              }}
            >
              <button
                onClick={handleCreateSchool}
                disabled={loading}
                style={primaryButtonStyle}
              >
                {loading ? 'Criando...' : 'Criar escola'}
              </button>

              <button
                onClick={() => router.push('/access')}
                style={secondaryButtonStyle}
              >
                Voltar
              </button>
            </div>

            {message ? (
              <p
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontSize: 14,
                }}
              >
                {message}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  </main>
)
}