'use client'

type SchoolYear = {
  id: string
  year: number
  school_id: string
}

type SchoolYearsSectionProps = {
  yearValue: string
  setYearValue: (value: string) => void
  handleCreateSchoolYear: () => void
  schoolYears: SchoolYear[]
}

export default function SchoolYearsSection({
  yearValue,
  setYearValue,
  handleCreateSchoolYear,
  schoolYears,
}: SchoolYearsSectionProps) {
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
      <h3 style={titleStyle}>Cadastrar ano letivo</h3>

      <div style={formRowStyle}>
        <input
          type="number"
          placeholder="Ex: 2026"
          value={yearValue}
          onChange={(e) => setYearValue(e.target.value)}
          style={inputStyle}
        />

        <button onClick={handleCreateSchoolYear} style={primaryButtonStyle}>
          Criar
        </button>
      </div>
    </div>

    {/* LISTA */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Anos letivos</h3>

      {schoolYears.length === 0 ? (
        <div style={emptyStyle}>Nenhum ano letivo cadastrado.</div>
      ) : (
        <div style={listStyle}>
          {schoolYears.map((year) => (
            <div key={year.id} style={itemCardStyle}>
              <div style={yearBadgeStyle}>{year.year}</div>
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

const formRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: 14,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
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
  flexWrap: 'wrap',
  gap: 10,
}

const itemCardStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const yearBadgeStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: '#1d4ed8',
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#64748b',
}