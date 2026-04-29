'use client'
import { useEffect, useState } from 'react'

type Student = {
  id: string
  full_name?: string
  name?: string
}

type SchoolClass = {
  id: string
  name: string
}

type AttendanceRecord = {
  id: string
  student_id: string
  class_id: string
  attendance_date: string
  status: 'present' | 'absent'
  source: 'system_default' | 'qr' | 'facial' | 'manual'
  created_at?: string
}

type AttendanceReportsSectionProps = {
  schoolName: string
  students: Student[]
  classes: SchoolClass[]
  records: AttendanceRecord[]
  selectedClassId: string
  setSelectedClassId: (value: string) => void
  filterStatus: 'all' | 'present' | 'absent'
  setFilterStatus: (value: 'all' | 'present' | 'absent') => void
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  onGenerate: () => void
  loading: boolean
}

export default function AttendanceReportsSection({
  schoolName,
  students,
  classes,
  records,
  selectedClassId,
  setSelectedClassId,
  filterStatus,
  setFilterStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  onGenerate,
  loading,
}: AttendanceReportsSectionProps) {
  const [windowWidth, setWindowWidth] = useState(1200)

useEffect(() => {
  function handleResize() {
    setWindowWidth(window.innerWidth)
  }

  handleResize()
  window.addEventListener('resize', handleResize)

  return () => window.removeEventListener('resize', handleResize)
}, [])

const isMobile = windowWidth < 768
const isTablet = windowWidth >= 768 && windowWidth < 1024
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: isMobile ? '10px 8px' : '14px 12px',
  borderBottom: '1px solid #cbd5e1',
  color: '#0f172a',
  fontSize: isMobile ? 12 : 14,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: isMobile ? '10px 8px' : '12px',
  borderBottom: '1px solid #e2e8f0',
  color: '#334155',
  fontSize: isMobile ? 12 : 14,
  whiteSpace: 'nowrap',
}
  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const groupedByClass = records.reduce<Record<string, AttendanceRecord[]>>(
    (acc, record) => {
      if (!acc[record.class_id]) acc[record.class_id] = []
      acc[record.class_id].push(record)
      return acc
    },
    {}
  )

  const totalRecords = records.length
  const totalPresent = records.filter((item) => item.status === 'present').length
  const totalAbsent = records.filter((item) => item.status === 'absent').length
  const attendanceRate =
    totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : '0.0'

  function formatDateBR(date: string) {
  if (!date) return ''
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

  return (
  <section
    style={{
      marginTop: 32,
      background: 'rgba(255,255,255,0.94)',
      border: '1px solid #e2e8f0',
      borderRadius: 28,
      padding: 24,
      boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
      backdropFilter: 'blur(6px)',
    }}
  >
    {/* HEADER */}
    <div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
    marginBottom: 20,
  }}
>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 900,
            color: '#0f172a',
          }}
        >
          Relatórios de Presença
        </h2>

        <p style={{ margin: '6px 0 0', color: '#64748b' }}>
          Gere relatórios por período, turma e status
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={loading}
        style={{
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: loading
    ? '#94a3b8'
    : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 800,
  cursor: loading ? 'not-allowed' : 'pointer',
  boxShadow: '0 14px 30px rgba(37,99,235,0.25)',
  width: isMobile ? '100%' : 'auto',
}}
      >
        {loading ? 'Gerando...' : 'Gerar relatório'}
      </button>
    </div>

    {/* FILTROS */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}
    >
      {[ 
        { label: 'Data inicial', value: startDate, onChange: setStartDate, type: 'date' },
        { label: 'Data final', value: endDate, onChange: setEndDate, type: 'date' },
      ].map((item, i) => (
        <div key={i}>
          <label style={labelStyle}>
            {item.label}
          </label>
          <input
            type={item.type}
            value={item.value}
            onChange={(e) => item.onChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      ))}

      <div>
        <label style={labelStyle}>Turma</label>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Todas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Tipo</label>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as 'all' | 'present' | 'absent')
          }
          style={inputStyle}
        >
          <option value="all">Todos</option>
          <option value="present">Presentes</option>
          <option value="absent">Faltosos</option>
        </select>
      </div>
    </div>

    {/* STATS */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}
    >
      <StatCard label="Registros" value={totalRecords} isMobile={isMobile} />
<StatCard label="Presentes" value={totalPresent} color="green" isMobile={isMobile} />
<StatCard label="Faltosos" value={totalAbsent} color="red" isMobile={isMobile} />
<StatCard label="Frequência" value={`${attendanceRate}%`} color="blue" isMobile={isMobile} />
    </div>
    <div
  style={{
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  }}
>
  <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 18 }}>
    {schoolName}
  </div>

  <div style={{ marginTop: 6, color: '#64748b', fontSize: 14 }}>
    Filtros utilizados:{' '}
    Período: {startDate || '---'} até {endDate || '---'} | Turma:{' '}
    {selectedClass?.name || 'Todas'} | Tipo:{' '}
    {filterStatus === 'all'
      ? 'Todos'
      : filterStatus === 'present'
      ? 'Presentes'
      : 'Faltosos'}
  </div>
</div>

    {/* TABELA */}
    <div
      id="attendance-report-print"
      style={{
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      {records.length === 0 ? (
        <div style={emptyStyle}>
          Nenhum registro encontrado
        </div>
      ) : (
        Object.entries(groupedByClass).map(([classId, classRecords]) => {
          const schoolClass = classes.find((c) => c.id === classId)

          return (
            <div key={classId}>
              <div
                style={{
                  padding: 16,
                  fontWeight: 800,
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                Turma: {schoolClass?.name || '---'}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={thStyle}>Aluno</th>
                    <th style={thStyle}>Data</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Horário</th>
                  </tr>
                </thead>

                <tbody>
                  {classRecords.map((r) => {
                    const student = students.find((s) => s.id === r.student_id)

                    return (
                      <tr key={r.id}>
                        <td style={tdStyle}>
                          {student?.full_name || student?.name}
                        </td>

                        <td style={tdStyle}>
  {formatDateBR(r.attendance_date)}
</td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 800,
                            color:
                              r.status === 'present'
                                ? '#16a34a'
                                : '#dc2626',
                          }}
                        >
                          {r.status === 'present'
                            ? 'Presente'
                            : 'Faltoso'}
                        </td>

                        <td style={tdStyle}>
  {r.status === 'present' && r.created_at
    ? new Date(r.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''}
</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
    <div
  style={{
    marginTop: 18,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 700,
  }}
>
  SchoolOS
</div>
  </section>
)
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  outline: 'none',
  fontSize: 14,
  color: '#0f172a',
  background: '#ffffff',
  fontWeight: 600,
}

const labelStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 6,
  display: 'block',
  color: '#334155',
  fontSize: 14,
}

const emptyStyle: React.CSSProperties = {
  padding: 20,
  textAlign: 'center',
  color: '#475569',
  fontWeight: 700,
}

function translateSource(source: AttendanceRecord['source']) {
  if (source === 'system_default') return 'Padrão do sistema'
  if (source === 'qr') return 'QR Code'
  if (source === 'facial') return 'Reconhecimento facial'
  return 'Manual'
}
function StatCard({
  label,
  value,
  color = 'default',
  isMobile,
}: {
  label: string
  value: string | number
  color?: 'default' | 'green' | 'red' | 'blue'
  isMobile: boolean
}) {
  const colors = {
    default: '#f8fafc',
    green: '#dcfce7',
    red: '#fee2e2',
    blue: '#eff6ff',
  }

  return (
    <div
      style={{
        background: colors[color],
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        padding: isMobile ? 12 : 16,
      }}
    >
      <div style={{ fontWeight: 700, color: '#64748b' }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: isMobile ? 20 : 26,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        {value}
      </div>
    </div>
  )
}