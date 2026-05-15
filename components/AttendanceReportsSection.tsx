'use client'
import { useEffect, useState } from 'react'

type Student = {
  id: string
  full_name?: string
  name?: string
  responsible_whatsapp?: string | null
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
  updated_at?: string
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

  isSubscriptionActive: boolean
  showMessage: (text: string) => void
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
  isSubscriptionActive,
  showMessage,
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

const tdNameStyle: React.CSSProperties = {
  ...tdStyle,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  maxWidth: isMobile ? 140 : 220,
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

function sendSingleWhatsapp(studentName: string, phone: string, date: string) {
  const cleanPhone = phone.replace(/\D/g, '')

  const message = encodeURIComponent(
    `Olá! Informamos que o(a) aluno(a) ${studentName} esteve ausente no dia ${formatDateBR(date)}.`
  )

  window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank')
}

function formatTimeBR(dateString?: string) {
  if (!dateString) return ''

  const safeDateString =
    dateString.endsWith('Z') || dateString.includes('+')
      ? dateString
      : `${dateString}Z`

  return new Date(safeDateString).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const studentMap = new Map(
  students.map((s) => [s.id, s])
)

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
  onClick={() => {
    if (!isSubscriptionActive) {
      showMessage(
        'Sua assinatura expirou. Renove para gerar relatórios.'
      )
      return
    }

    onGenerate()
  }}
  disabled={loading || !isSubscriptionActive}
        style={{
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: !isSubscriptionActive
  ? '#cbd5e1'
  : loading
    ? '#94a3b8'
    : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 800,
  cursor:
  loading || !isSubscriptionActive
    ? 'not-allowed'
    : 'pointer',
  boxShadow: '0 14px 30px rgba(37,99,235,0.25)',
  width: isMobile ? '100%' : 'auto',
}}
      >
        {!isSubscriptionActive
  ? 'Assinatura expirada'
  : loading
  ? 'Gerando...'
  : 'Gerar relatório'}
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
  <div style={modernStatsGridStyle}>
  <div style={modernStatCardStyle}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={modernStatLabelStyle}>Alunos Filtrados</div>
      <div style={modernStatIconStyle}>📋</div>
    </div>

    <div style={modernStatValueStyle}>
      {totalRecords}
    </div>

    <div style={modernProgressBarStyle}>
      <div
        style={modernProgressFillStyle(
          totalRecords > 0 ? '100%' : '0%',
          '#3b82f6'
        )}
      />
    </div>
  </div>

  <div
    style={{
      ...modernStatCardStyle,
      background:
        'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
      border: '1px solid #bbf7d0',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={modernStatLabelStyle}>Presentes</div>
      <div style={modernStatIconStyle}>✅</div>
    </div>

    <div style={modernStatValueStyle}>
      {totalPresent}
    </div>

    <div style={modernProgressBarStyle}>
      <div
        style={modernProgressFillStyle(
          `${attendanceRate}%`,
          '#22c55e'
        )}
      />
    </div>
  </div>

  <div
    style={{
      ...modernStatCardStyle,
      background:
        'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      border: '1px solid #fecaca',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={modernStatLabelStyle}>Faltosos</div>
      <div style={modernStatIconStyle}>❌</div>
    </div>

    <div style={modernStatValueStyle}>
      {totalAbsent}
    </div>

    <div style={modernProgressBarStyle}>
      <div
        style={modernProgressFillStyle(
          totalRecords > 0
            ? `${(totalAbsent / totalRecords) * 100}%`
            : '0%',
          '#ef4444'
        )}
      />
    </div>
  </div>

  <div
    style={{
      ...modernStatCardStyle,
      background:
        'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      border: '1px solid #bfdbfe',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={modernStatLabelStyle}>Frequência</div>
      <div style={modernStatIconStyle}>📈</div>
    </div>

    <div style={modernStatValueStyle}>
      {attendanceRate}%
    </div>

    <div style={modernProgressBarStyle}>
      <div
        style={modernProgressFillStyle(
          `${attendanceRate}%`,
          '#2563eb'
        )}
      />
    </div>
  </div>
</div>
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
<div
  className="print-only-chart"
  style={{
    display: 'none',
    padding: 20,
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff',
  }}
>
  <div
    style={{
      fontSize: 18,
      fontWeight: 900,
      color: '#0f172a',
      marginBottom: 16,
    }}
  >
    Gráfico de presença
  </div>

  <div style={{ marginBottom: 18 }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8,
        fontWeight: 800,
        color: '#166534',
      }}
    >
      <span>Presentes</span>
      <span>{totalPresent}</span>
    </div>

    <div
      style={{
        width: '100%',
        borderTop: '16px solid #dcfce7',
        borderRadius: 999,
      }}
    >
      <div
        style={{
          width:
            totalRecords > 0
              ? `${(totalPresent / totalRecords) * 100}%`
              : '0%',
          borderTop: '16px solid #22c55e',
          borderRadius: 999,
          marginTop: -16,
        }}
      />
    </div>
  </div>

  <div style={{ marginBottom: 18 }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8,
        fontWeight: 800,
        color: '#991b1b',
      }}
    >
      <span>Faltosos</span>
      <span>{totalAbsent}</span>
    </div>

    <div
      style={{
        width: '100%',
        borderTop: '16px solid #fee2e2',
        borderRadius: 999,
      }}
    >
      <div
        style={{
          width:
            totalRecords > 0
              ? `${(totalAbsent / totalRecords) * 100}%`
              : '0%',
          borderTop: '16px solid #ef4444',
          borderRadius: 999,
          marginTop: -16,
        }}
      />
    </div>
  </div>

  <div
    style={{
      marginTop: 18,
      fontSize: 15,
      fontWeight: 900,
      color: '#0f172a',
    }}
  >
    Frequência geral: {attendanceRate}%
  </div>
</div>
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
    fontWeight: 900,
    fontSize: 16,
    color: '#0f172a',
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
                    <th className="hide-on-print" style={thStyle}>
  Aviso
</th>
                  </tr>
                </thead>

                <tbody>
                  {classRecords
  .sort((a, b) => {
    const studentA = studentMap.get(a.student_id)
    const studentB = studentMap.get(b.student_id)

    const nameA = (studentA?.full_name || studentA?.name || '').toLowerCase()
    const nameB = (studentB?.full_name || studentB?.name || '').toLowerCase()

    return nameA.localeCompare(nameB, 'pt-BR')
  })
  .map((r) => {
                    const student = students.find((s) => s.id === r.student_id)

                    return (
                      <tr key={r.id}>
                        <td style={tdNameStyle}>
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
  {r.status === 'present' && (r.updated_at || r.created_at)
    ? formatTimeBR(r.updated_at || r.created_at)
    : ''}
</td>
<td className="hide-on-print" style={tdStyle}>
  {r.status === 'absent' && student?.responsible_whatsapp ? (
    <button
      onClick={() =>
        sendSingleWhatsapp(
          student.full_name || student.name || 'Aluno',
          student.responsible_whatsapp || '',
          r.attendance_date
        )
      }
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        border: 'none',
        background: '#25D366',
        color: '#ffffff',
        fontWeight: 800,
        cursor: 'pointer',
        fontSize: 12,
      }}
    >
      WhatsApp
    </button>
  ) : r.status === 'absent' ? (
    <span style={{ color: '#94a3b8', fontWeight: 700 }}>
      Sem WhatsApp
    </span>
  ) : (
    ''
  )}
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

const isMobile = typeof window !== 'undefined'
  ? window.innerWidth < 768
  : false

const isTablet = typeof window !== 'undefined'
  ? window.innerWidth >= 768 && window.innerWidth < 1024
  : false

const modernStatsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: isMobile
    ? '1fr'
    : isTablet
    ? 'repeat(2, 1fr)'
    : 'repeat(4, 1fr)',
  gap: 16,
  marginTop: 20,
}

const modernStatCardStyle: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 24,
  padding: isMobile ? 18 : 22,
  border: '1px solid #dbeafe',
  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
  minHeight: 150,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

const modernStatValueStyle: React.CSSProperties = {
  fontSize: isMobile ? 30 : 36,
  fontWeight: 900,
  color: '#0f172a',
  lineHeight: 1,
  letterSpacing: '-1px',
}

const modernStatLabelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#1e293b',
}

const modernStatIconStyle: React.CSSProperties = {
  fontSize: 34,
}

const modernProgressBarStyle: React.CSSProperties = {
  width: '100%',
  height: 10,
  background: '#e2e8f0',
  borderRadius: 999,
  overflow: 'hidden',
  marginTop: 12,
}

const modernProgressFillStyle = (width: string, color: string): React.CSSProperties => ({
  width,
  height: '100%',
  background: color,
  borderRadius: 999,
  transition: '0.4s ease',
})

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