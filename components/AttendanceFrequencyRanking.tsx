'use client'

import { useMemo } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
  profile_photo_url?: string | null
  profile_photo_path?: string | null
}

type RankingItem = {
  student_id: string
  student_name: string
  class_id: string | null
  class_name: string | null
  presences: number
  absences: number
  total: number
  frequency_rate: number
}

type Props = {
  ranking: RankingItem[]
  students: Student[]
}

export default function AttendanceFrequencyRanking({
  ranking,
  students,
}: Props) {

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const orderedRanking = [...ranking]
  .filter((item) => Number(item.total) > 0)

const bestStudents = [...orderedRanking]
  .sort((a, b) => {
    if (b.frequency_rate !== a.frequency_rate) return b.frequency_rate - a.frequency_rate
    if (b.presences !== a.presences) return b.presences - a.presences
    if (a.absences !== b.absences) return a.absences - b.absences

    return a.student_name.localeCompare(b.student_name, 'pt-BR')
  })
  .slice(0, 10)

const criticalStudents = [...orderedRanking]
  .sort((a, b) => {
    if (a.frequency_rate !== b.frequency_rate) return a.frequency_rate - b.frequency_rate
    if (b.absences !== a.absences) return b.absences - a.absences
    if (a.presences !== b.presences) return a.presences - b.presences

    return a.student_name.localeCompare(b.student_name, 'pt-BR')
  })
  .slice(0, 10)

    useEffect(() => {
  async function loadPhotos() {
    const studentsWithPhoto = students.filter(
      (student) => student.profile_photo_path
    )

    const entries = await Promise.all(
      studentsWithPhoto.map(async (student) => {
        const { data } = await supabase.storage
          .from('student-profile-photos')
          .createSignedUrl(student.profile_photo_path!, 3600)

        return [student.id, data?.signedUrl || ''] as const
      })
    )

    setPhotoUrls(Object.fromEntries(entries))
  }

  loadPhotos()
}, [students])

  if (ranking.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          color: '#64748b',
          fontWeight: 700,
          lineHeight: 1.5,
        }}
      >
        Nenhum dado carregado ainda.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section
        style={{
          padding: 16,
          borderRadius: 18,
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: 12,
            color: '#14532d',
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          🏆 Melhores frequências
        </h3>

        {bestStudents.map((item, index) => {
  const badge =
    index === 0
      ? { label: 'TOP 1', bg: '#fef3c7', color: '#92400e' }
      : index === 1
      ? { label: 'TOP 2', bg: '#e5e7eb', color: '#374151' }
      : index === 2
      ? { label: 'TOP 3', bg: '#fed7aa', color: '#9a3412' }
      : { label: `TOP ${index + 1}`, bg: '#dcfce7', color: '#166534' }

  return (
    <div
      key={item.student_id}
      style={{
        padding: '10px 0',
        borderBottom:
          index === bestStudents.length - 1 ? 'none' : '1px solid #bbf7d0',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'flex-start',
          fontWeight: 800,
          color: '#166534',
          fontSize: 14,
        }}
      >
        <span>
          <span
            style={{
              display: 'inline-flex',
              padding: '3px 7px',
              borderRadius: 999,
              background: badge.bg,
              color: badge.color,
              fontSize: 11,
              fontWeight: 900,
              marginRight: 6,
            }}
          >
            {badge.label}
          </span>
          <img
  src={photoUrls[item.student_id] || '/default-avatar.png'}
  alt={item.student_name}
  style={{
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(255,255,255,0.9)',
    background: '#e5e7eb',
    verticalAlign: 'middle',
    marginRight: 8,
  }}
/>
{item.student_name}
        </span>

        <span>{item.frequency_rate.toFixed(1)}%</span>
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 700,
        }}
      >
        {item.class_name} • {item.presences} presença(s) • {item.absences} falta(s)
      </div>
    </div>
  )
})}
      </section>

      <section
        style={{
          padding: 16,
          borderRadius: 18,
          background: '#fff7ed',
          border: '1px solid #fed7aa',
        }}
      >
        <h3
          style={{
            margin: 0,
            marginBottom: 12,
            color: '#9a3412',
            fontSize: 17,
            fontWeight: 900,
          }}
        >
          ⚠️ Frequência crítica
        </h3>

        {criticalStudents.length === 0 ? (
          <div style={{ color: '#64748b', fontWeight: 700, fontSize: 14 }}>
            Nenhum aluno abaixo de 75%.
          </div>
        ) : (
          criticalStudents.map((item, index) => (
  <div
    key={item.student_id}
    style={{
      padding: '10px 0',
      borderBottom:
        index === criticalStudents.length - 1 ? 'none' : '1px solid #fed7aa',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        fontWeight: 800,
        color: '#9a3412',
        fontSize: 14,
      }}
    >
      <span>
        <span
          style={{
            display: 'inline-flex',
            padding: '3px 7px',
            borderRadius: 999,
            background: '#ffedd5',
            color: '#9a3412',
            fontSize: 11,
            fontWeight: 900,
            marginRight: 6,
          }}
        >
          {index + 1}º
        </span>
        <img
  src={photoUrls[item.student_id] || '/default-avatar.png'}
  alt={item.student_name}
  style={{
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid rgba(255,255,255,0.9)',
    background: '#e5e7eb',
    verticalAlign: 'middle',
    marginRight: 8,
  }}
/>
{item.student_name}
      </span>

      <span>{item.frequency_rate.toFixed(1)}%</span>
    </div>

    <div
      style={{
        marginTop: 4,
        fontSize: 12,
        color: '#7c2d12',
        fontWeight: 700,
      }}
    >
      {item.class_name} • {item.presences} presença(s) • {item.absences} falta(s)
    </div>
  </div>
))
        )}
      </section>
    </div>
  )
}