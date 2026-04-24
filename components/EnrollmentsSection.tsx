'use client'

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
  selectedEnrollmentYearId: string
  selectedStudentId: string
  selectedClassId: string
  setSelectedEnrollmentYearId: (value: string) => void
  setSelectedStudentId: (value: string) => void
  setSelectedClassId: (value: string) => void
  handleEnrollStudent: () => void
  students: Student[]
  schoolYears: SchoolYear[]
  classes: SchoolClass[]
  enrollments: Enrollment[]
}

export default function EnrollmentsSection({
  selectedEnrollmentYearId,
  selectedStudentId,
  selectedClassId,
  setSelectedEnrollmentYearId,
  setSelectedStudentId,
  setSelectedClassId,
  handleEnrollStudent,
  students,
  schoolYears,
  classes,
  enrollments,
}: EnrollmentsSectionProps) {
  const filteredClasses = selectedEnrollmentYearId
    ? classes.filter((schoolClass) => schoolClass.year_id === selectedEnrollmentYearId)
    : []

  const sectionStyle: React.CSSProperties = {
    marginTop: 24,
  }

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 20,
    padding: 20,
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.05)',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
    marginBottom: 16,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    margin: 0,
    marginTop: 24,
    marginBottom: 14,
    color: '#0f172a',
  }

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const inputStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    fontSize: 14,
    outline: 'none',
    background: '#ffffff',
    color: '#0f172a',
  }

  const disabledInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#f8fafc',
    color: '#64748b',
    cursor: 'not-allowed',
  }

  const buttonStyle: React.CSSProperties = {
    marginTop: 8,
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(37, 99, 235, 0.22)',
  }

  const listStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  const itemStyle: React.CSSProperties = {
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  }

  const itemLabelStyle: React.CSSProperties = {
    color: '#334155',
    fontSize: 14,
    lineHeight: 1.6,
  }

  const emptyStyle: React.CSSProperties = {
    padding: 12,
    borderRadius: 12,
    background: '#f1f5f9',
    color: '#475569',
  }

  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    {/* FORM */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Matricular aluno</h3>

      <div style={formGridStyle}>
        {/* ANO */}
        <div>
          <label style={labelStyle}>Ano letivo</label>
          <select
            value={selectedEnrollmentYearId}
            onChange={(e) => setSelectedEnrollmentYearId(e.target.value)}
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

        {/* ALUNO */}
        <div>
          <label style={labelStyle}>Aluno</label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecione</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* TURMA */}
        <div>
          <label style={labelStyle}>Turma</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecione</option>
            {classes
              .filter((c) =>
                selectedEnrollmentYearId
                  ? c.year_id === selectedEnrollmentYearId
                  : true
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <button onClick={handleEnrollStudent} style={primaryButtonStyle}>
        Matricular
      </button>
    </div>

    {/* LISTA */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Matrículas realizadas</h3>

      {enrollments.length === 0 ? (
        <div style={emptyStyle}>Nenhuma matrícula encontrada.</div>
      ) : (
        <div style={listStyle}>
          {enrollments.map((enrollment) => {
            const student = students.find(
              (s) => s.id === enrollment.student_id
            )

            const schoolClass = classes.find(
              (c) => c.id === enrollment.class_id
            )

            const year = schoolYears.find(
              (y) => y.id === enrollment.year_id
            )

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