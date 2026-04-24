'use client'

type Manager = {
  id: string
  full_name: string
  email: string | null
  area: string | null
}

type ManagersSectionProps = {
  managerName: string
  managerEmail: string
  managerArea: string
  setManagerName: (value: string) => void
  setManagerEmail: (value: string) => void
  setManagerArea: (value: string) => void
  handleCreateManager: () => void
  managers: Manager[]
}

export default function ManagersSection({
  managerName,
  managerEmail,
  managerArea,
  setManagerName,
  setManagerEmail,
  setManagerArea,
  handleCreateManager,
  managers,
}: ManagersSectionProps) {
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
      <h3 style={titleStyle}>Cadastrar gestor</h3>

      <div style={formGridStyle}>
        <input
          type="text"
          placeholder="Nome completo"
          value={managerName}
          onChange={(e) => setManagerName(e.target.value)}
          style={inputStyle}
        />

        <input
          type="email"
          placeholder="E-mail"
          value={managerEmail}
          onChange={(e) => setManagerEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          type="text"
          placeholder="Área (ex: Matemática)"
          value={managerArea}
          onChange={(e) => setManagerArea(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button onClick={handleCreateManager} style={primaryButtonStyle}>
        Cadastrar gestor
      </button>
    </div>

    {/* LISTA */}
    <div style={cardStyle}>
      <h3 style={titleStyle}>Gestores cadastrados</h3>

      {managers.length === 0 ? (
        <div style={emptyStyle}>Nenhum gestor cadastrado.</div>
      ) : (
        <div style={listStyle}>
          {managers.map((manager) => (
            <div key={manager.id} style={itemCardStyle}>
              <div>
                <div style={itemTitleStyle}>{manager.full_name}</div>

                <div style={itemSubtitleStyle}>
                  {manager.email || 'Sem e-mail'}
                </div>

                <div style={areaBadgeStyle}>
                  {manager.area || 'Sem área definida'}
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
  marginBottom: 6,
}

const areaBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#ede9fe',
  color: '#6d28d9',
  fontWeight: 800,
  fontSize: 12,
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#64748b',
}