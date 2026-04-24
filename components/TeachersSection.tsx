'use client'

type Teacher = {
  id: string
  full_name: string
  email: string | null
}

type TeachersSectionProps = {
  teacherName: string
  teacherEmail: string
  setTeacherName: (value: string) => void
  setTeacherEmail: (value: string) => void
  handleCreateTeacher: () => void
  teachers: Teacher[]
}

export default function TeachersSection({
  teacherName,
  teacherEmail,
  setTeacherName,
  setTeacherEmail,
  handleCreateTeacher,
  teachers,
}: TeachersSectionProps) {
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
    marginBottom: 16,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 24,
    marginBottom: 12,
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
    color: '#0f172a',
  }

  const buttonStyle: React.CSSProperties = {
    marginTop: 8,
    padding: '12px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
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

  const textStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#334155',
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
      <h3 style={titleStyle}>Cadastrar professor</h3>

      <div style={formGridStyle}>
        <input
          type="text"
          placeholder="Nome completo"
          value={teacherName}
          onChange={(e) => setTeacherName(e.target.value)}
          style={inputStyle}
        />

        <input
          type="email"
          placeholder="E-mail"
          value={teacherEmail}
          onChange={(e) => setTeacherEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button onClick={handleCreateTeacher} style={primaryButtonStyle}>
        Cadastrar professor
      </button>
    </div>

    {/* LISTA */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Professores cadastrados</h3>

      {teachers.length === 0 ? (
        <div style={emptyStyle}>Nenhum professor cadastrado.</div>
      ) : (
        <div style={listStyle}>
          {teachers.map((teacher) => (
            <div key={teacher.id} style={itemCardStyle}>
              <div>
                <div style={itemTitleStyle}>{teacher.full_name}</div>

                <div style={itemSubtitleStyle}>
                  {teacher.email || 'Sem e-mail'}
                </div>
              </div>
            </div>
          ))}
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