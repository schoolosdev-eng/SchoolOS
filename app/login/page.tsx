'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [windowWidth, setWindowWidth] = useState(1200)
  const [logoSize, setLogoSize] = useState(40)

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

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.replace('/access')
      }
    }

    checkSession()
  }, [router])

  function getErrorMessage(errorMessage: string) {
  if (errorMessage.includes('missing email or phone')) {
    return 'Informe seu e-mail e senha para continuar.'
  }

  if (errorMessage.includes('Invalid login credentials')) {
    return 'E-mail ou senha inválidos.'
  }

  if (errorMessage.includes('Email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.'
  }

  return 'Erro ao fazer login. Tente novamente.'
}

  async function handleLogin() {
    setLoading(true)
    setMessage('Entrando...')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setMessage(`Erro: ${getErrorMessage(error.message)}`)
      setLoading(false)
      return
    }

    setMessage('Login realizado com sucesso.')
    router.replace('/access')
  }

  async function handleGoogleLogin() {
  setLoading(true)
  setMessage('Redirecionando para o Google...')

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })

  if (error) {
    setMessage(`Erro: ${getErrorMessage(error.message)}`)
    setLoading(false)
  }
}

async function handleForgotPassword() {
  if (!email.trim()) {
    setMessage('Informe seu e-mail para recuperar a senha.')
    return
  }

  setLoading(true)
  setMessage('Enviando link de recuperação...')

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/reset-password`,
    }
  )

  if (error) {
    setMessage('Erro ao enviar o link de recuperação. Tente novamente.')
    setLoading(false)
    return
  }

  setMessage('Enviamos um link de recuperação para seu e-mail.')
  setLoading(false)
}

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
        background:
          'linear-gradient(135deg, #07111f 0%, #0b172a 45%, #0f223d 100%)',
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: isMobile ? '32px 20px' : isTablet ? '48px 32px' : '64px 56px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#ffffff',
          background:
            'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 32%), radial-gradient(circle at bottom right, rgba(16,185,129,0.16), transparent 28%)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              marginBottom: 28,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 12px rgba(34,197,94,0.7)',
              }}
            />
            Ferramenta Escolar Integrada
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 4vw, 4rem)',
              lineHeight: 1.05,
              margin: 0,
              maxWidth: 620,
              fontWeight: 800,
            }}
          >
            Utilize nossas ferramentas e tenha mais organização, clareza e presença digital.
          </h1>

          <p
            style={{
              marginTop: 22,
              maxWidth: 560,
              fontSize: 18,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            Centralize turmas, alunos, professores, gestores e processos da sua
            escola em uma experiência mais moderna, profissional e fácil de usar.
          </p>
        </div>

        <div
          style={{
            display: isMobile ? 'none' : 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 16,
            maxWidth: 720,
          }}
        >
          {[
            { title: 'Acadêmico', text: 'Notas, frequência, turmas e histórico.' },
            { title: 'Comunicação', text: 'Avisos, ocorrências e responsáveis.' },
            { title: 'Gestão', text: 'Relatórios, auditoria e organização.' },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                padding: 18,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '24px 16px 40px' : '32px 24px',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            borderRadius: isMobile ? 22 : 28,
            padding: isMobile ? 22 : 32,
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.65)',
          }}
        >
          <div style={{ marginBottom: 28 }}>
<div
  style={{
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 6,
  }}
>
<img
  src="/logoteste.png"
  alt="Logo"
  style={{
    width: logoSize + 20,
    height: logoSize + 20,
    objectFit: 'contain',
    display: 'block',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
  }}
/>

<div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
  <span style={schoolTextStyle}>School</span>
  <span style={osTextStyle}>OS</span>
</div>
</div>

            <h2
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: isMobile ? 25 : 30,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              Entrar na plataforma
            </h2>

            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                color: '#475569',
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              Acesse sua conta para visualizar suas escolas e continuar sua gestão.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                E-mail
              </label>
              <input
                type="email"
                placeholder="Digite seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: 52,
                  padding: '0 16px',
                  borderRadius: 14,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: 16,
                  color: '#0f172a',
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Senha
              </label>
              <input
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  height: 52,
                  padding: '0 16px',
                  borderRadius: 14,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: 16,
                  color: '#0f172a',
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              />
              <button
  type="button"
  onClick={handleForgotPassword}
  disabled={loading}
  style={{
    marginTop: 8,
    background: 'transparent',
    border: 'none',
    color: '#2563eb',
    fontSize: 13,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    padding: 0,
    float: 'right',
  }}
>
  Esqueci minha senha
</button>
            </div>
            <button
  onClick={handleGoogleLogin}
  disabled={loading}
  style={{
  padding: isMobile ? 14 : 12,
  background: '#ffffff',
  color: '#111827',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  cursor: 'pointer',
  width: '100%',
  fontSize: 15,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
}}
>
<>
  <img
    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
    alt="Google"
    style={{
      width: 18,
      height: 18,
      objectFit: 'contain',
    }}
  />
  Entrar com Google
</>
</button>

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
  marginTop: 8,
  height: isMobile ? 52 : 54,
  border: 'none',
  borderRadius: 14,
  background:
    loading
      ? 'linear-gradient(135deg, #64748b, #475569)'
      : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: loading ? 'not-allowed' : 'pointer',
  boxShadow: '0 12px 25px rgba(37,99,235,0.25)',
  width: '100%',
}}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              onClick={() => router.push('/signup')}
              style={{
  height: isMobile ? 50 : 52,
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
}}
            >
              Criar conta
            </button>

   <p
  style={{
    margin: '2px 0 0',
    fontSize: 13,
    lineHeight: 1.7,
    color: '#64748b',
    textAlign: 'center',
  }}
>
  Ao continuar, você concorda com nossos{' '}
  <a
    href="/termos-de-uso"
    target="_blank"
    rel="noopener noreferrer"
    style={{
      color: '#1d4ed8',
      fontWeight: 800,
      textDecoration: 'none',
    }}
  >
    Termos de Uso
  </a>{' '}
  e{' '}
  <a
    href="/politica-de-privacidade"
    target="_blank"
    rel="noopener noreferrer"
    style={{
      color: '#1d4ed8',
      fontWeight: 800,
      textDecoration: 'none',
    }}
  >
    Política de Privacidade
  </a>
  .
</p>

            {message ? (
              <div
                style={{
                  marginTop: 4,
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: message.startsWith('Erro:')
                    ? '#fef2f2'
                    : '#eff6ff',
                  color: message.startsWith('Erro:')
                    ? '#b91c1c'
                    : '#1d4ed8',
                  border: message.startsWith('Erro:')
                    ? '1px solid #fecaca'
                    : '1px solid #bfdbfe',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            ) : null}
          </div>
        </div>
            </section>

      <a
        href="https://wa.me/5588921826192?text=Olá!%20Tenho%20dúvidas%20sobre%20o%20SchoolOS."
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          left: isMobile ? 16 : 24,
          bottom: isMobile ? 16 : 24,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: isMobile ? 280 : 360,
          padding: isMobile ? '12px 14px' : '14px 18px',
          borderRadius: 999,
          background: 'linear-gradient(135deg, #25D366, #16a34a)',
          color: '#ffffff',
          textDecoration: 'none',
          boxShadow: '0 18px 40px rgba(37, 211, 102, 0.35)',
          border: '1px solid rgba(255,255,255,0.25)',
          fontWeight: 800,
        }}
      >
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          <svg
  xmlns="http://www.w3.org/2000/svg"
  width="22"
  height="22"
  viewBox="0 0 24 24"
  fill="currentColor"
>
  <path d="M20.52 3.48A11.78 11.78 0 0012.04 0C5.52 0 .24 5.28.24 11.76c0 2.08.56 4.12 1.6 5.92L0 24l6.52-1.72a11.8 11.8 0 005.52 1.4h.04c6.48 0 11.76-5.28 11.76-11.76 0-3.12-1.2-6.04-3.32-8.44zm-8.48 18.2a9.8 9.8 0 01-5-1.36l-.36-.2-3.88 1.04 1.04-3.8-.24-.4a9.78 9.78 0 01-1.52-5.2c0-5.4 4.4-9.8 9.84-9.8 2.6 0 5.08 1 6.92 2.88a9.7 9.7 0 012.88 6.92c0 5.44-4.4 9.84-9.84 9.84zm5.4-7.36c-.28-.16-1.68-.84-1.92-.92-.28-.12-.44-.16-.64.16-.2.28-.72.92-.88 1.12-.16.2-.32.24-.6.08-.28-.16-1.16-.44-2.2-1.4-.8-.72-1.36-1.64-1.52-1.92-.16-.28-.04-.44.12-.6.12-.12.28-.32.4-.48.12-.16.16-.28.24-.48.08-.16.04-.36-.04-.52-.08-.16-.64-1.56-.88-2.12-.24-.6-.48-.52-.64-.52h-.56c-.2 0-.52.08-.8.36-.28.28-1.04 1-.96 2.4.08 1.4 1 2.76 1.16 2.96.16.2 2 3.08 4.88 4.2.68.28 1.24.44 1.68.56.72.24 1.36.2 1.88.12.56-.08 1.68-.68 1.92-1.36.24-.64.24-1.24.16-1.36-.08-.08-.24-.16-.52-.28z"/>
</svg>
        </span>

        <span style={{ fontSize: isMobile ? 12 : 14, lineHeight: 1.35 }}>
          Alguma dúvida? Clique aqui. Nossa meta é te ajudar!
        </span>
      </a>
    </main>
  )
}

const schoolTextStyle: React.CSSProperties = {
  color: '#0f2a5c', // azul escuro mais elegante
  fontWeight: 900,
  letterSpacing: 0.5,
  fontSize: 'clamp(22px, 3vw, 32px)',
  textShadow: '0 2px 6px rgba(0,0,0,0.08)',
}

const osTextStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: 0.5,
  fontSize: 'clamp(22px, 3vw, 32px)',
  background: 'linear-gradient(135deg, #facc15, #eab308, #d97706)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: '0 2px 6px rgba(0,0,0,0.08)',
}