'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpdatePassword() {
    if (password.length < 6) {
      setMessage('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('As senhas não conferem.')
      return
    }

    setLoading(true)
    setMessage('Atualizando senha...')

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setMessage('Erro ao atualizar senha. Tente novamente.')
      setLoading(false)
      return
    }

    setMessage('Senha atualizada com sucesso. Redirecionando...')

    setTimeout(() => {
      router.push('/login')
    }, 1500)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #0f172a 0%, #111827 45%, #0f3f46 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#f8fafc',
          borderRadius: 22,
          padding: 26,
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)',
          border: '1px solid rgba(255,255,255,0.7)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              color: '#020617',
              letterSpacing: -0.5,
            }}
          >
            Redefinir senha
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#334155',
              fontSize: 14,
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            Crie uma nova senha para acessar sua conta na plataforma.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 800,
                color: '#020617',
              }}
            >
              Nova senha
            </label>

            <input
              type="password"
              placeholder="Digite sua nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                height: 52,
                padding: '0 16px',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: 15,
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
                fontSize: 13,
                fontWeight: 800,
                color: '#020617',
              }}
            >
              Confirmar senha
            </label>

            <input
              type="password"
              placeholder="Repita sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                height: 52,
                padding: '0 16px',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: 15,
                color: '#0f172a',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleUpdatePassword}
            disabled={loading}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              border: 'none',
              background: loading
                ? 'linear-gradient(135deg, #93c5fd, #60a5fa)'
                : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 900,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 6,
              boxShadow: '0 12px 24px rgba(37, 99, 235, 0.25)',
            }}
          >
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/login')}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#020617',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Voltar para login
          </button>

          {message && (
            <div
              style={{
                marginTop: 4,
                padding: '12px 14px',
                borderRadius: 14,
                background: message.toLowerCase().includes('sucesso')
                  ? '#dcfce7'
                  : '#eff6ff',
                color: message.toLowerCase().includes('sucesso')
                  ? '#166534'
                  : '#1e3a8a',
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.4,
                textAlign: 'center',
              }}
            >
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}