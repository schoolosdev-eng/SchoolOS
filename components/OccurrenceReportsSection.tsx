'use client'

import { useMemo, useState } from 'react'

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
}

type SchoolClass = {
  id: string
  name: string
}

type Occurrence = {
  id: string
  school_id: string
  class_id: string
  student_id: string
  teacher_id: string
  situation: string
  description: string | null
  created_at: string
}

type Props = {
  students: Student[]
  classes: SchoolClass[]
  occurrences: Occurrence[]
  loading: boolean
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  selectedClassId: string
  setSelectedClassId: (value: string) => void
  selectedStudentId: string
  setSelectedStudentId: (value: string) => void
  selectedSituation: string
  setSelectedSituation: (value: string) => void
  onGenerate: () => void
}

const situationOptions = [
  // Pedagógico
  'Não realizou atividade',
  'Não trouxe material',
  'Disperso em sala',
  'Atraso frequente',
  'Uso indevido de celular',
  'Saída sem autorização',

  // Disciplina leve/média
  'Conversando Muito',
  'Interrompendo a aula',
  'Desobediência',
  'Provocando colegas',
  'Linguagem inadequada',

  // Disciplina grave
  'Desrespeitando o professor',
  'Desrespeitando colegas',
  'Brigando',
  'Agressão física',
  'Ameaça a colega',
  'Ameaça a professor',
  'Bullying',
  'Danificando patrimônio',

  // Comportamento
  'Dormindo',
  'Apatia / desinteresse',
  'Isolamento social',
  'Falta de participação',

  // Administrativo
  'Fardamento incompleto',
  'Documentação pendente',

  // Família
  'Responsável não compareceu',

  // Outros
  'Fora do mapa de turma',
  'Outro',
]

export default function OccurrenceReportsSection({
  students,
  classes,
  occurrences,
  loading,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedClassId,
  setSelectedClassId,
  selectedStudentId,
  setSelectedStudentId,
  selectedSituation,
  setSelectedSituation,
  onGenerate,
}: Props) {
  const filteredStudents = useMemo(() => {
  if (!selectedClassId) return students

  const studentIdsFromClass = occurrences
    .filter((occurrence) => occurrence.class_id === selectedClassId)
    .map((occurrence) => occurrence.student_id)

  return students.filter((student) =>
    studentIdsFromClass.includes(student.id)
  )
}, [students, occurrences, selectedClassId])

const totalOccurrences = occurrences.length

const occurrencesBySituation = useMemo(() => {
  const result: Record<string, number> = {}

  occurrences.forEach((occurrence) => {
    result[occurrence.situation] = (result[occurrence.situation] || 0) + 1
  })

  return Object.entries(result).sort((a, b) => b[1] - a[1])
}, [occurrences])

const studentsRiskRanking = useMemo(() => {
  const result: Record<
    string,
    {
      studentId: string
      studentName: string
      totalOccurrences: number
      score: number
    }
  > = {}

  occurrences.forEach((occurrence) => {
    const studentName = getStudentName(occurrence.student_id)

    if (!result[occurrence.student_id]) {
      result[occurrence.student_id] = {
        studentId: occurrence.student_id,
        studentName,
        totalOccurrences: 0,
        score: 0,
      }
    }

    result[occurrence.student_id].totalOccurrences += 1
    result[occurrence.student_id].score += getSituationScore(occurrence.situation)
  })

  return Object.values(result)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}, [occurrences, students])

const occurrencesByClass = useMemo(() => {
  const result: Record<string, number> = {}

  occurrences.forEach((occurrence) => {
    const className = getClassName(occurrence.class_id)
    result[className] = (result[className] || 0) + 1
  })

  return Object.entries(result).sort((a, b) => b[1] - a[1])
}, [occurrences, classes])

const occurrencesByStudent = useMemo(() => {
  const result: Record<string, number> = {}

  occurrences.forEach((occurrence) => {
    const studentName = getStudentName(occurrence.student_id)
    result[studentName] = (result[studentName] || 0) + 1
  })

  return Object.entries(result).sort((a, b) => b[1] - a[1]).slice(0, 5)
}, [occurrences, students])

  function getStudentName(studentId: string) {
    const student = students.find((item) => item.id === studentId)
    return student?.full_name || student?.name || 'Aluno não encontrado'
  }

  function getClassName(classId: string) {
    const schoolClass = classes.find((item) => item.id === classId)
    return schoolClass?.name || 'Turma não encontrada'
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString('pt-BR')
  }

  async function copyOccurrenceMessage(occurrence: Occurrence) {
  const studentName = getStudentName(occurrence.student_id)
  const className = getClassName(occurrence.class_id)
  const date = formatDateTime(occurrence.created_at)

  const text = `Olá! Informamos que foi registrada uma ocorrência envolvendo o(a) aluno(a) ${studentName}, da turma ${className}, em ${date}. Situação: ${occurrence.situation}.${occurrence.description ? ` Observação: ${occurrence.description}` : ''}`

  await navigator.clipboard.writeText(text)
}

function getOccurrenceColor(situation: string) {
  const grave = [
    'Brigando',
    'Agressão física',
    'Ameaça a colega',
    'Ameaça a professor',
    'Bullying',
    'Danificando patrimônio',
    'Desrespeitando o professor',
  ]

  const media = [
    'Conversando Muito',
    'Interrompendo a aula',
    'Desobediência',
    'Provocando colegas',
    'Linguagem inadequada',
    'Uso indevido de celular',
    'Disperso em sala',
  ]

  if (grave.includes(situation)) {
    return {
      background: '#fee2e2',
      border: '#fecaca',
    }
  }

  if (media.includes(situation)) {
    return {
      background: '#fef3c7',
      border: '#fde68a',
    }
  }

  return {
    background: '#e0f2fe',
    border: '#bae6fd',
  }
}

function getSituationScore(situation: string) {
  const grave = [
    'Desrespeitando o professor',
    'Desrespeitando colegas',
    'Brigando',
    'Agressão física',
    'Ameaça a colega',
    'Ameaça a professor',
    'Bullying',
    'Danificando patrimônio',
  ]

  const medio = [
    'Conversando Muito',
    'Interrompendo a aula',
    'Desobediência',
    'Provocando colegas',
    'Linguagem inadequada',
    'Uso indevido de celular',
    'Saída sem autorização',
    'Disperso em sala',
  ]

  if (grave.includes(situation)) return 5
  if (medio.includes(situation)) return 3
  if (situation === 'Outro') return 0

  return 1
}

function getRiskByScore(score: number) {
  if (score >= 15) {
    return {
      label: '🔴 Alto risco',
      background: '#fee2e2',
      color: '#991b1b',
    }
  }

  if (score >= 7) {
    return {
      label: '🟡 Atenção',
      background: '#fef3c7',
      color: '#92400e',
    }
  }

  return {
    label: '🔵 Baixo risco',
    background: '#dbeafe',
    color: '#1e40af',
  }
}

  return (
    <div style={wrapperStyle}>
      <div style={filtersCardStyle}>
        <h3 style={titleStyle}>Relatório de ocorrências</h3>

        <div style={filtersGridStyle}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  <button onClick={() => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }}>
    Hoje
  </button>

  <button onClick={() => {
    const today = new Date()
    const past7 = new Date()
    past7.setDate(today.getDate() - 6)

    setStartDate(past7.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }}>
    7 dias
  </button>

  <button onClick={() => {
    const today = new Date()
    const past30 = new Date()
    past30.setDate(today.getDate() - 29)

    setStartDate(past30.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }}>
    30 dias
  </button>
</div>
          <div>
            <label style={labelStyle}>Data inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Data final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Turma</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value)
                setSelectedStudentId('')
                    }}
              style={inputStyle}
            >
              <option value="">Todas as turmas</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Aluno</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Todos os alunos</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.name || 'Aluno sem nome'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Risco</label>
            <select
  value={selectedSituation}
  onChange={(e) => setSelectedSituation(e.target.value)}
  style={inputStyle}
>
  <option value="">Todos os riscos</option>
  <option value="leve">Leve</option>
  <option value="medio">Médio</option>
  <option value="grave">Grave</option>
</select>
          </div>
          <button
  onClick={() => {
    setSelectedClassId('')
    setSelectedStudentId('')
    setSelectedSituation('')
    setStartDate('')
    setEndDate('')
  }}
  style={{
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  Limpar filtros
</button>
        </div>

        <button onClick={onGenerate} style={primaryButtonStyle} disabled={loading}>
          {loading ? 'Gerando...' : 'Gerar relatório'}
        </button>
      </div>
        <div style={dashboardCardStyle}>
  <h3 style={titleStyle}>Dashboard de comportamento</h3>

  <div style={summaryGridStyle}>
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>Total de ocorrências</div>
      <div style={summaryValueStyle}>{totalOccurrences}</div>
    </div>

    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>Situação mais recorrente</div>
      <div style={summaryValueSmallStyle}>
        {occurrencesBySituation[0]?.[0] || 'Sem dados'}
      </div>
    </div>

    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>Turma com mais ocorrências</div>
      <div style={summaryValueSmallStyle}>
        {occurrencesByClass[0]?.[0] || 'Sem dados'}
      </div>
    </div>
  </div>

  <div style={dashboardGridStyle}>
    <div style={rankingCardStyle}>
      <h4 style={rankingTitleStyle}>Ocorrências por situação</h4>

      {occurrencesBySituation.length === 0 ? (
        <div style={emptyStyle}>Sem dados.</div>
      ) : (
        occurrencesBySituation.map(([situation, total]) => (
          <div key={situation} style={barRowStyle}>
            <div style={barInfoStyle}>
              <strong>{situation}</strong>
              <span>{total}</span>
            </div>

            <div style={barTrackStyle}>
              <div
                style={{
                  ...barFillStyle,
                  width: `${Math.max(
                    8,
                    (total / Math.max(...occurrencesBySituation.map(([, value]) => value))) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        ))
      )}
    </div>

    <div style={rankingCardStyle}>
      <h4 style={rankingTitleStyle}>Turmas com mais ocorrências</h4>

      {occurrencesByClass.length === 0 ? (
        <div style={emptyStyle}>Sem dados.</div>
      ) : (
        occurrencesByClass.map(([className, total]) => (
          <div key={className} style={simpleRankRowStyle}>
            <strong>{className}</strong>
            <span>{total} ocorrência(s)</span>
          </div>
        ))
      )}
    </div>

    <div style={rankingCardStyle}>
      <h4 style={rankingTitleStyle}>Ranking de alunos por risco</h4>

{studentsRiskRanking.length === 0 ? (
  <div style={emptyStyle}>Sem dados.</div>
) : (
  studentsRiskRanking.map((item) => {
    const risk = getRiskByScore(item.score)

    return (
      <div
        key={item.studentId}
        style={{
          ...riskRankRowStyle,
          background: risk.background,
          color: risk.color,
        }}
      >
        <div>
          <strong>{item.studentName}</strong>

          <div style={{ fontSize: 13, marginTop: 4 }}>
            {item.totalOccurrences} ocorrência(s)
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <strong>{item.score} pts</strong>

          <div style={{ fontSize: 12, fontWeight: 900, marginTop: 4 }}>
            {risk.label}
          </div>
        </div>
      </div>
    )
  })
)}
    </div>
  </div>
</div>
      <div id="occurrence-report-print" style={resultCardStyle}>
        <div style={resultHeaderStyle}>
          <div>
            <h3 style={titleStyle}>Ocorrências encontradas</h3>
            <p style={textStyle}>
              Total: {occurrences.length} ocorrência(s)
            </p>
          </div>
        </div>

        {occurrences.length === 0 ? (
          <div style={emptyStyle}>Nenhuma ocorrência encontrada.</div>
        ) : (
          <div style={listStyle}>
            {occurrences.map((occurrence, index) => (
  <div
    key={occurrence.id || `${occurrence.student_id}-${occurrence.created_at}-${index}`}
    style={{
      ...occurrenceCardStyle,
      background: getOccurrenceColor(occurrence.situation).background,
      borderColor: getOccurrenceColor(occurrence.situation).border,
    }}
  >
                <div>
                  <div style={studentNameStyle}>
                    {getStudentName(occurrence.student_id)}
                  </div>

                  <div style={metaStyle}>
                    Turma: {getClassName(occurrence.class_id)}
                  </div>

                  <div style={situationBadgeStyle}>
                    {occurrence.situation}
                  </div>

                  {occurrence.description && (
                    <p style={descriptionStyle}>{occurrence.description}</p>
                  )}
                </div>

                <div style={dateBoxStyle}>
                  {formatDateTime(occurrence.created_at)}
                </div>
                <button
                onClick={() => copyOccurrenceMessage(occurrence)}
                    style={copyButtonStyle}
                                >
                    Copiar mensagem
                    </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const filtersCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const resultCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 14,
  color: '#0f172a',
  fontSize: 22,
  fontWeight: 900,
}

const textStyle: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontWeight: 700,
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 16,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#334155',
  fontWeight: 800,
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  background: '#ffffff',
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
}

const resultHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  marginBottom: 16,
}

const emptyStyle: React.CSSProperties = {
  border: '1px dashed #cbd5e1',
  background: '#f8fafc',
  borderRadius: 16,
  padding: 18,
  color: '#64748b',
  fontWeight: 700,
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const occurrenceCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  borderRadius: 18,
  padding: 16,
  flexWrap: 'wrap',
}

const studentNameStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 4,
}

const metaStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 8,
}

const situationBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 10px',
  borderRadius: 999,
  background: '#fee2e2',
  color: '#b91c1c',
  fontWeight: 900,
  fontSize: 12,
}

const descriptionStyle: React.CSSProperties = {
  margin: '10px 0 0',
  color: '#475569',
  lineHeight: 1.5,
}

const dateBoxStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 12,
  background: '#f1f5f9',
  color: '#334155',
  fontWeight: 800,
  fontSize: 13,
}

const copyButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '9px 12px',
  background: '#9a3412',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
  fontSize: 13,
}

const dashboardCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 18,
}

const summaryCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 16,
  background: '#f8fafc',
}

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  fontWeight: 800,
  marginBottom: 8,
}

const summaryValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  color: '#0f172a',
}

const summaryValueSmallStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: '#0f172a',
}

const dashboardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 14,
}

const rankingCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 16,
  background: '#ffffff',
}

const rankingTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 16,
  fontWeight: 900,
  color: '#0f172a',
}

const barRowStyle: React.CSSProperties = {
  marginBottom: 14,
}

const barInfoStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  fontSize: 13,
  color: '#334155',
  marginBottom: 6,
}

const barTrackStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: '#e2e8f0',
  overflow: 'hidden',
}

const barFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
}

const simpleRankRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  padding: '10px 0',
  borderBottom: '1px solid #e2e8f0',
  fontSize: 14,
  color: '#334155',
}

const riskRankRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: 12,
  borderRadius: 14,
  marginBottom: 10,
  fontSize: 14,
  fontWeight: 800,
}