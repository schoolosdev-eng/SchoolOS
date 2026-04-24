'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignUpPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage('Preencha todos os campos.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('As senhas não coincidem.')
      return
    }

    if (password.length < 6) {
      setMessage('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    setMessage('Criando conta...')

    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    })

    if (error) {
      setMessage(`Erro ao criar conta: ${error.message}`)
      setLoading(false)
      return
    }

    setMessage('Conta criada com sucesso. Agora faça login.')
    setLoading(false)

    setTimeout(() => {
      router.replace('/')
    }, 1500)
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background:
      'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 50%, #eef2ff 100%)',
  }

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 480,
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.10)',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 18,
    letterSpacing: 0.3,
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.1,
  }

  const subtitleStyle: React.CSSProperties = {
    margin: '10px 0 0',
    color: '#475569',
    fontSize: 15,
    lineHeight: 1.6,
  }

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    marginTop: 28,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    outline: 'none',
    fontSize: 15,
    color: '#0f172a',
    background: '#fff',
    boxSizing: 'border-box',
  }

  const buttonsRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  }

  const primaryButtonStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '14px 18px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(37, 99, 235, 0.24)',
  }

  const secondaryButtonStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '14px 18px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  }

  const messageStyle: React.CSSProperties = {
    marginTop: 6,
    padding: '12px 14px',
    borderRadius: 14,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontSize: 14,
    lineHeight: 1.5,
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={badgeStyle}>SchoolOS</div>

        <h1 style={titleStyle}>Criar conta</h1>
        <p style={subtitleStyle}>
          Crie sua conta para acessar o sistema e administrar ou participar de escolas.
        </p>

        <div style={formStyle}>
          <input
            type="text"
            placeholder="Nome completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />

          <div style={buttonsRowStyle}>
            <button
              onClick={handleSignUp}
              disabled={loading}
              style={{
                ...primaryButtonStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Criando...' : 'Criar conta'}
            </button>

            <button onClick={() => router.push('/')} style={secondaryButtonStyle}>
              Voltar
            </button>
          </div>

          {message ? <p style={messageStyle}>{message}</p> : null}
        </div>
      </section>
    </main>
  )
}