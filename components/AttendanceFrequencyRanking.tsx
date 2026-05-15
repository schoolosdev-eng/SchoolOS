'use client'

import { useMemo } from 'react'

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
}

type AttendanceRecord = {
  id: string
  student_id: string
  class_id?: string
  status: 'present' | 'absent'
}

type SchoolClass = {
  id: string
  name: string
}

type Props = {
  students: Student[]
  records: AttendanceRecord[]
  classes: SchoolClass[]
}

export default function AttendanceFrequencyRanking({
  students,
  records,
  classes,
}: Props) {
  const ranking = useMemo(() => {
    const studentMap = new Map(students.map((s) => [s.id, s]))

    const result: Record<
      string,
      {
  studentId: string
  studentName: string
  className: string
  total: number
  present: number
  absent: number
  rate: number
}
    > = {}

    records.forEach((record) => {
      const student = studentMap.get(record.student_id)
      const schoolClass = classes.find((item) => item.id === record.class_id)

      if (!result[record.student_id]) {
        result[record.student_id] = {
  studentId: record.student_id,
  studentName:
    student?.full_name || student?.name || 'Aluno não encontrado',
  className: schoolClass?.name || 'Sem turma',
  total: 0,
  present: 0,
  absent: 0,
  rate: 0,
}
      }

      result[record.student_id].total += 1

      if (record.status === 'present') {
        result[record.student_id].present += 1
      }
      if (record.status === 'absent') {
  result[record.student_id].absent += 1
}

      result[record.student_id].rate =
        result[record.student_id].total > 0
          ? (result[record.student_id].present / result[record.student_id].total) *
            100
          : 0
    })

    return Object.values(result)
  }, [students, records, classes])

  const bestStudents = [...ranking]
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 10)

  const criticalStudents = [...ranking]
    .filter((item) => item.rate < 75)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 10)

  if (records.length === 0) {
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
        Gere um relatório para visualizar o ranking de frequência.
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
      key={item.studentId}
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
          {item.studentName}
        </span>

        <span>{item.rate.toFixed(1)}%</span>
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 700,
        }}
      >
        {item.className} • {item.absent} falta(s)
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
    key={item.studentId}
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
        {item.studentName}
      </span>

      <span>{item.rate.toFixed(1)}%</span>
    </div>

    <div
      style={{
        marginTop: 4,
        fontSize: 12,
        color: '#7c2d12',
        fontWeight: 700,
      }}
    >
      {item.className} • {item.absent} falta(s)
    </div>
  </div>
))
        )}
      </section>
    </div>
  )
}