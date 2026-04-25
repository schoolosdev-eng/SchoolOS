'use client'

import { useMemo, useState } from 'react'

type Student = {
  id: string
  name: string
  birth_date: string
  school_id: string | null
}

type SchoolYear = {
  id: string
  year: number
  school_id: string
}

type SchoolClass = {
  id: string
  name: string
  school_id: string
  year_id: string
}

type Enrollment = {
  id: string
  student_id: string
  class_id: string
  school_id: string
  year_id: string
}

type EnrollmentsSectionProps = {
  handleEnrollStudent: (
    studentId: string,
    classId: string,
    yearId: string
  ) => Promise<void>
  handleMoveEnrollment: (
    enrollmentId: string,
    targetClassId: string
  ) => Promise<void>
  students: Student[]
  schoolYears: SchoolYear[]
  classes: SchoolClass[]
  enrollments: Enrollment[]
}

export default function EnrollmentsSection({
  handleEnrollStudent,
  handleMoveEnrollment,
  students,
  schoolYears,
  classes,
  enrollments,
}: EnrollmentsSectionProps) {
  const [selectedEnrollmentYearId, setSelectedEnrollmentYearId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [movingEnrollmentId, setMovingEnrollmentId] = useState('')
  const [targetClassId, setTargetClassId] = useState('')

  const filteredClasses = useMemo(() => {
    return selectedEnrollmentYearId
      ? classes.filter((schoolClass) => schoolClass.year_id === selectedEnrollmentYearId)
      : []
  }, [classes, selectedEnrollmentYearId])

  const enrollmentsFromSelectedYear = useMemo(() => {
    return enrollments.filter(
      (enrollment) => enrollment.year_id === selectedEnrollmentYearId
    )
  }, [enrollments, selectedEnrollmentYearId])

  const enrollmentsFromSelectedClass = useMemo(() => {
    return enrollments.filter(
      (enrollment) => enrollment.class_id === selectedClassId
    )
  }, [enrollments, selectedClassId])

  const studentsInSelectedClass = useMemo(() => {
    return enrollmentsFromSelectedClass
      .map((enrollment) => {
        const student = students.find((s) => s.id === enrollment.student_id)
        return student
          ? {
              enrollmentId: enrollment.id,
              student,
            }
          : null
      })
      .filter(Boolean) as { enrollmentId: string; student: Student }[]
  }, [enrollmentsFromSelectedClass, students])

  const availableStudents = useMemo(() => {
    return students.filter((student) => {
      const alreadyEnrolledInThisYear = enrollmentsFromSelectedYear.some(
        (enrollment) => enrollment.student_id === student.id
      )

      const matchesSearch = student.name
        .toLowerCase()
        .includes(studentSearch.toLowerCase())

      return !alreadyEnrolledInThisYear && matchesSearch
    })
  }, [students, enrollmentsFromSelectedYear, studentSearch])

  const targetClasses = filteredClasses.filter(
    (schoolClass) => schoolClass.id !== selectedClassId
  )

  async function handleAddSelectedStudents() {
    if (!selectedEnrollmentYearId || !selectedClassId) return

    for (const studentId of selectedStudentIds) {
      await handleEnrollStudent(studentId, selectedClassId, selectedEnrollmentYearId)
    }

    setSelectedStudentIds([])
    setStudentSearch('')
  }

  async function handleMoveStudent() {
    if (!movingEnrollmentId || !targetClassId) return

    await handleMoveEnrollment(movingEnrollmentId, targetClassId)

    setMovingEnrollmentId('')
    setTargetClassId('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={cardStyle}>
        <h3 style={titleStyle}>Matricular aluno</h3>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Ano letivo</label>
            <select
              value={selectedEnrollmentYearId}
              onChange={(e) => {
                setSelectedEnrollmentYearId(e.target.value)
                setSelectedClassId('')
                setSelectedStudentIds([])
                setMovingEnrollmentId('')
                setTargetClassId('')
              }}
              style={inputStyle}
            >
              <option value="">Selecione</option>
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Turma</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value)
                setSelectedStudentIds([])
                setMovingEnrollmentId('')
                setTargetClassId('')
              }}
              style={inputStyle}
              disabled={!selectedEnrollmentYearId}
            >
              <option value="">Selecione</option>
              {filteredClasses.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedClassId ? (
          <>
            <h4 style={subtitleStyle}>Alunos da turma</h4>

            {studentsInSelectedClass.length === 0 ? (
              <div style={emptyStyle}>Nenhum aluno matriculado nesta turma.</div>
            ) : (
              <div style={listStyle}>
                {studentsInSelectedClass.map(({ enrollmentId, student }) => (
                  <div key={enrollmentId} style={itemCardStyle}>
                    <div style={itemTitleStyle}>{student.name}</div>
                  </div>
                ))}
              </div>
            )}

            <h4 style={subtitleStyle}>Adicionar alunos disponíveis</h4>

            <input
              type="text"
              placeholder="Buscar aluno..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            {availableStudents.length === 0 ? (
              <div style={emptyStyle}>
                Nenhum aluno disponível. Alunos já matriculados em qualquer turma deste ano não aparecem aqui.
              </div>
            ) : (
              <div style={listStyle}>
                {availableStudents.map((student) => {
                  const checked = selectedStudentIds.includes(student.id)

                  return (
                    <label key={student.id} style={itemCardStyle}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentIds((prev) => [...prev, student.id])
                          } else {
                            setSelectedStudentIds((prev) =>
                              prev.filter((id) => id !== student.id)
                            )
                          }
                        }}
                        style={{ marginRight: 10 }}
                      />
                      <span style={itemTitleStyle}>{student.name}</span>
                    </label>
                  )
                })}
              </div>
            )}

            <button
              onClick={handleAddSelectedStudents}
              disabled={selectedStudentIds.length === 0}
              style={{
                ...primaryButtonStyle,
                marginTop: 12,
                opacity: selectedStudentIds.length === 0 ? 0.6 : 1,
                cursor: selectedStudentIds.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Adicionar selecionados
            </button>

            <h4 style={subtitleStyle}>Mover aluno entre turmas</h4>

            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>Aluno da turma atual</label>
                <select
                  value={movingEnrollmentId}
                  onChange={(e) => setMovingEnrollmentId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {studentsInSelectedClass.map(({ enrollmentId, student }) => (
                    <option key={enrollmentId} value={enrollmentId}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Mover para</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Selecione</option>
                  {targetClasses.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleMoveStudent}
              disabled={!movingEnrollmentId || !targetClassId}
              style={{
                ...primaryButtonStyle,
                opacity: !movingEnrollmentId || !targetClassId ? 0.6 : 1,
                cursor:
                  !movingEnrollmentId || !targetClassId
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              Mover aluno
            </button>
          </>
        ) : (
          <div style={emptyStyle}>Selecione um ano letivo e uma turma.</div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={titleStyle}>Últimas matrículas realizadas</h3>

        {enrollments.length === 0 ? (
          <div style={emptyStyle}>Nenhuma matrícula encontrada.</div>
        ) : (
          <div style={listStyle}>
            {enrollments.slice(0, 5).map((enrollment) => {
              const student = students.find((s) => s.id === enrollment.student_id)
              const schoolClass = classes.find((c) => c.id === enrollment.class_id)
              const year = schoolYears.find((y) => y.id === enrollment.year_id)

              return (
                <div key={enrollment.id} style={itemCardStyle}>
                  <div>
                    <div style={itemTitleStyle}>
                      {student?.name || 'Aluno não encontrado'}
                    </div>

                    <div style={itemSubtitleStyle}>
                      {schoolClass?.name || 'Turma não encontrada'} •{' '}
                      {year?.year || 'Ano não encontrado'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 16,
  fontSize: 20,
  fontWeight: 900,
  color: '#0f172a',
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  margin: 0,
  marginTop: 22,
  marginBottom: 12,
  color: '#0f172a',
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  marginBottom: 12,
}

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 6,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  width: '100%',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const itemCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const itemTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
  color: '#0f172a',
}

const itemSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#64748b',
}