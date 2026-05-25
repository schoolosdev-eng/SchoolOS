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
      redirectTo: 'https://schoolosapp.com/auth/callback',
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '24px 16px' : '40px 24px',
      background:
        'linear-gradient(135deg, #eef2ff 0%, #f8fafc 45%, #e0f2fe 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: 'rgba(37, 99, 235, 0.12)',
        filter: 'blur(40px)',
        top: -120,
        left: -120,
      }}
    />

    <div
      style={{
        position: 'absolute',
        width: 360,
        height: 360,
        borderRadius: '50%',
        background: 'rgba(234, 179, 8, 0.16)',
        filter: 'blur(45px)',
        bottom: -120,
        right: -100,
      }}
    />

    <section
      style={{
        width: '100%',
        maxWidth: 430,
        position: 'relative',
        zIndex: 2,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.88)',
          border: '1px solid rgba(148,163,184,0.26)',
          borderRadius: isMobile ? 26 : 32,
          padding: isMobile ? 24 : 34,
          boxShadow: '0 30px 80px rgba(15, 23, 42, 0.16)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 28,
          }}
        >
        </div>

        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <h1
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: isMobile ? 28 : 32,
              fontWeight: 900,
              letterSpacing: -0.8,
            }}
          >
            Acessar conta
          </h1>

          <p
            style={{
              margin: '10px 0 0',
              color: '#64748b',
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Entre com seu e-mail ou conta Google.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                fontWeight: 800,
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
                borderRadius: 16,
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
                fontWeight: 800,
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
                borderRadius: 16,
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
                marginTop: 9,
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: 13,
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: 0,
                float: 'right',
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              marginTop: 12,
              height: 54,
              border: 'none',
              borderRadius: 16,
              background: loading
                ? 'linear-gradient(135deg, #64748b, #475569)'
                : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 45%, #eab308 100%)',
              color: '#0f172a',
              fontSize: 16,
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 18px 35px rgba(234, 179, 8, 0.30)',
              width: '100%',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              height: 52,
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              width: '100%',
              fontSize: 15,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
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
          </button>

          <button
            onClick={() => router.push('/signup')}
            style={{
              height: 52,
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 15,
              fontWeight: 900,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Criar conta
          </button>

          <p
            style={{
              margin: '4px 0 0',
              fontSize: 12.5,
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
                background: message.startsWith('Erro:') ? '#fef2f2' : '#eff6ff',
                color: message.startsWith('Erro:') ? '#b91c1c' : '#1d4ed8',
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
  </main>
)
}