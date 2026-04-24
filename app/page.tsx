'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()

  const [email, setEmail] = useState('admin@teste.com')
  const [password, setPassword] = useState('123456')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [windowWidth, setWindowWidth] = useState(1200)

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

  async function handleLogin() {
    setLoading(true)
    setMessage('Entrando...')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setMessage(`Erro: ${error.message}`)
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
      redirectTo: 'http://localhost:3000/access',
    },
  })

  if (error) {
    setMessage(`Erro: ${error.message}`)
    setLoading(false)
  }
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
            Plataforma escolar inteligente
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
            Gestão educacional com mais organização, clareza e presença digital.
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
                width: 56,
                height: 56,
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                boxShadow: '0 14px 30px rgba(29,78,216,0.28)',
                marginBottom: 18,
              }}
            >
              GE
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
  <span>🔵</span>
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
    </main>
  )
}