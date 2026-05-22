'use client'

import { useEffect, useMemo, useState } from 'react'
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

type SchoolYear = {
  id: string
  year: number
}

type Props = {
  ranking: RankingItem[]
  students: Student[]
  schoolYears: SchoolYear[]

  classes: {
    id: string
    year_id: string
  }[]

  schoolName: string
}

export default function AttendanceFrequencyRanking({
  ranking,
  students,
  schoolYears,
  classes,
  schoolName,
}: Props) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [selectedClassId, setSelectedClassId] = useState('')
  const currentYear = new Date().getFullYear()

const defaultYear =
  schoolYears.find((item) => item.year === currentYear)?.id || ''

const [selectedYearId, setSelectedYearId] =
  useState(defaultYear)
  const [limit, setLimit] = useState(10)

  const rankingClasses = useMemo(() => {
    const map = new Map<string, string>()

    ranking.forEach((item) => {
      if (item.class_id && item.class_name) {
        map.set(item.class_id, item.class_name)
      }
    })

    return Array.from(map.entries())
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    })
  )
  }, [ranking])

  const filteredRanking = useMemo(() => {
  const allowedClassIds =
    !selectedYearId
      ? null
      : ranking
          .filter((item) => {
            const schoolClass = classes.find(
              (c) => c.id === item.class_id
            )

            return schoolClass?.year_id === selectedYearId
          })
          .map((item) => item.class_id)

  return ranking
    .filter((item) => Number(item.total) > 0)
    .filter(
      (item) =>
        !selectedClassId ||
        item.class_id === selectedClassId
    )
    .filter(
      (item) =>
        !selectedYearId ||
        allowedClassIds?.includes(item.class_id)
    )
}, [
  ranking,
  selectedClassId,
  selectedYearId,
  classes,
])

  const bestStudents = useMemo(() => {
    return [...filteredRanking]
      .sort((a, b) => {
        if (b.frequency_rate !== a.frequency_rate) {
          return b.frequency_rate - a.frequency_rate
        }

        if (b.presences !== a.presences) {
          return b.presences - a.presences
        }

        if (a.absences !== b.absences) {
          return a.absences - b.absences
        }

        return a.student_name.localeCompare(b.student_name, 'pt-BR')
      })
      .slice(0, limit)
  }, [filteredRanking, limit])

  const criticalStudents = useMemo(() => {
    return [...filteredRanking]
      .filter((item) => item.frequency_rate < 75)
      .sort((a, b) => {
        if (a.frequency_rate !== b.frequency_rate) {
          return a.frequency_rate - b.frequency_rate
        }

        if (b.absences !== a.absences) {
          return b.absences - a.absences
        }

        if (a.presences !== b.presences) {
          return a.presences - b.presences
        }

        return a.student_name.localeCompare(b.student_name, 'pt-BR')
      })
      .slice(0, limit)
  }, [filteredRanking, limit])

  const visibleStudentIds = useMemo(() => {
    return new Set([
      ...bestStudents.map((item) => item.student_id),
      ...criticalStudents.map((item) => item.student_id),
    ])
  }, [bestStudents, criticalStudents])

  useEffect(() => {
    async function loadPhotos() {
      const studentsWithPhoto = students.filter(
        (student) =>
          visibleStudentIds.has(student.id) &&
          student.profile_photo_path &&
          !photoUrls[student.id]
      )

      if (studentsWithPhoto.length === 0) return

      const entries = await Promise.all(
        studentsWithPhoto.map(async (student) => {
          const { data } = await supabase.storage
            .from('student-profile-photos')
            .createSignedUrl(student.profile_photo_path!, 3600)

          return [student.id, data?.signedUrl || ''] as const
        })
      )

      setPhotoUrls((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }))
    }

    loadPhotos()
  }, [students, visibleStudentIds])

  function getStudentPhoto(studentId: string) {
    const student = students.find((item) => item.id === studentId)

    return (
      photoUrls[studentId] ||
      student?.profile_photo_url ||
      '/default-avatar.png'
    )
  }

  function getBadge(index: number) {
    if (index === 0) {
      return { label: 'TOP 1', bg: '#fef3c7', color: '#92400e' }
    }

    if (index === 1) {
      return { label: 'TOP 2', bg: '#e5e7eb', color: '#374151' }
    }

    if (index === 2) {
      return { label: 'TOP 3', bg: '#fed7aa', color: '#9a3412' }
    }

    return {
      label: `TOP ${index + 1}`,
      bg: '#dcfce7',
      color: '#166534',
    }
  }

  function renderStudentCard(
    item: RankingItem,
    index: number,
    type: 'best' | 'critical'
  ) {
    const badge =
      type === 'best'
        ? getBadge(index)
        : {
            label: `${index + 1}º`,
            bg: '#ffedd5',
            color: '#9a3412',
          }

    const mainColor = type === 'best' ? '#166534' : '#9a3412'
    const progressColor = type === 'best' ? '#22c55e' : '#f97316'

    return (
      <div
        key={`${type}-${item.student_id}`}
        style={{
          padding: 14,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <img
            src={getStudentPhoto(item.student_id)}
            alt={item.student_name}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '3px solid rgba(255,255,255,0.9)',
              background: '#e5e7eb',
              flexShrink: 0,
            }}
          />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: badge.bg,
                    color: badge.color,
                    fontSize: 11,
                    fontWeight: 900,
                    marginBottom: 6,
                  }}
                >
                  {badge.label}
                </span>

                <div
                  style={{
                    color: mainColor,
                    fontWeight: 900,
                    fontSize: 15,
                    lineHeight: 1.25,
                    wordBreak: 'break-word',
                  }}
                >
                  {item.student_name}
                </div>
              </div>

              <div
                style={{
                  color: mainColor,
                  fontWeight: 900,
                  fontSize: 20,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.frequency_rate.toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              {item.class_name || 'Sem turma'} • {item.presences} presença(s) •{' '}
              {item.absences} falta(s)
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            height: 9,
            borderRadius: 999,
            background: '#e2e8f0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(Math.max(item.frequency_rate, 0), 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: progressColor,
            }}
          />
        </div>
      </div>
    )
  }

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

  const selectedYearName =
  schoolYears.find((item) => item.id === selectedYearId)
    ?.year || 'Todos'

const selectedClassName =
  rankingClasses.find(
    (item) => item.id === selectedClassId
  )?.name || 'Todas as turmas'

  function handlePrintRanking() {
  const printArea = document.getElementById('ranking-print-area')

  if (!printArea) return

  const printWindow = window.open('', '_blank', 'width=1200,height=900')

  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>Ranking Escolar</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #0f172a;
          }

          .print-header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }

          .school-title {
            font-size: 26px;
            font-weight: 900;
            margin-bottom: 6px;
          }

          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #475569;
          }

          .no-print {
            display: none !important;
          }

          img {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          @page {
            margin: 8mm;
          }
        </style>
      </head>

      <body>
        <div class="print-header">
  <div class="school-title">
    ${schoolName}
  </div>

  <div class="report-title">
    Ranking anual de frequência escolar
  </div>

  <div
    style="
      margin-top: 10px;
      font-size: 13px;
      color: #475569;
      line-height: 1.7;
    "
  >
    <strong>Ano letivo:</strong> ${selectedYearName}
    <br />

    <strong>Turma:</strong> ${selectedClassName}
    <br />

    <strong>Top exibido:</strong> ${limit}
    <br />

    <strong>Data de emissão:</strong>
    ${new Date().toLocaleDateString('pt-BR')}
  </div>
</div>

        ${printArea.innerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 700)
}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section
        style={{
          padding: 16,
          borderRadius: 20,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
              marginBottom: 4,
            }}
            >
            Filtros
          </div>
            
</div>

            <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <select
  value={selectedYearId}
  onChange={(e) => setSelectedYearId(e.target.value)}
  style={{
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontWeight: 700,
  }}
>
  <option value="">Todos os anos</option>

  {schoolYears.map((year) => (
    <option key={year.id} value={year.id}>
      {year.year}
    </option>
  ))}
</select>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 700,
            }}
          >
            <option value="">Todas as turmas</option>
            {rankingClasses.map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 700,
            }}
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>

          <button
  onClick={handlePrintRanking}
  className="no-print"
  style={{
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  Imprimir ranking
</button>
        </div>
      </section>

      <section
        id="ranking-print-area"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <section
          style={{
            padding: 16,
            borderRadius: 22,
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 14,
              color: '#14532d',
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            🏆 Melhores frequências
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bestStudents.length === 0 ? (
              <div style={{ color: '#64748b', fontWeight: 700, fontSize: 14 }}>
                Nenhum aluno encontrado para os filtros selecionados.
              </div>
            ) : (
              bestStudents.map((item, index) =>
                renderStudentCard(item, index, 'best')
              )
            )}
          </div>
        </section>

        <section
          style={{
            padding: 16,
            borderRadius: 22,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: 14,
              color: '#9a3412',
              fontSize: 20,
              fontWeight: 900,
            }}
          >
            ⚠️ Frequências críticas
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {criticalStudents.length === 0 ? (
              <div style={{ color: '#64748b', fontWeight: 700, fontSize: 14 }}>
                Nenhum aluno abaixo de 75%.
              </div>
            ) : (
              criticalStudents.map((item, index) =>
                renderStudentCard(item, index, 'critical')
              )
            )}
          </div>
        </section>
      </section>
    </div>
  )
}