'use client'

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

type ClassesSectionProps = {
  className: string
  selectedYearId: string
  setClassName: (value: string) => void
  setSelectedYearId: (value: string) => void
  handleCreateClass: () => void
  schoolYears: SchoolYear[]
  classes: SchoolClass[]
}

export default function ClassesSection({
  className,
  selectedYearId,
  setClassName,
  setSelectedYearId,
  handleCreateClass,
  schoolYears,
  classes,
}: ClassesSectionProps) {
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
  }

  const listContainerStyle: React.CSSProperties = {
    marginTop: 20,
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
      <h3 style={titleStyle}>Cadastrar turma</h3>

      <div style={formGridStyle}>
        <input
          type="text"
          placeholder="Ex: 1º Ano A"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          style={inputStyle}
        />

        <select
          value={selectedYearId}
          onChange={(e) => setSelectedYearId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Selecione o ano letivo</option>
          {schoolYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleCreateClass} style={primaryButtonStyle}>
        Criar turma
      </button>
    </div>

    {/* LISTA */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Turmas cadastradas</h3>

      {classes.length === 0 ? (
        <div style={emptyStyle}>Nenhuma turma cadastrada.</div>
      ) : (
        <div style={listStyle}>
          {classes.map((c) => {
            const year = schoolYears.find((y) => y.id === c.year_id)

            return (
              <div key={c.id} style={itemCardStyle}>
                <div>
                  <div style={itemTitleStyle}>{c.name}</div>
                  <div style={itemSubtitleStyle}>
                    Ano letivo: {year?.year || '---'}
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
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  outline: 'none',
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