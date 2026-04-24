'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

  return (
    <main style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>Criar escola</h1>
      <p>Preencha os dados básicos da nova escola.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        <input
          type="text"
          placeholder="Nome da escola"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="email"
          placeholder="E-mail da escola"
          value={schoolEmail}
          onChange={(e) => setSchoolEmail(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="text"
          placeholder="Telefone da escola"
          value={schoolPhone}
          onChange={(e) => setSchoolPhone(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="text"
          placeholder="Endereço da escola"
          value={schoolAddress}
          onChange={(e) => setSchoolAddress(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          type="text"
          placeholder="CEP da escola"
          value={schoolCep}
          onChange={(e) => setSchoolCep(e.target.value)}
          style={{ padding: 10 }}
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleCreateSchool} disabled={loading} style={{ padding: 10 }}>
            {loading ? 'Criando...' : 'Criar escola'}
          </button>

          <button onClick={() => router.push('/access')} style={{ padding: 10 }}>
            Voltar
          </button>
        </div>

        {message ? <p>{message}</p> : null}
      </div>
    </main>
  )
}