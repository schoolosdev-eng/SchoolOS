'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

type EarlyExitRecord = {
  id: string
  student_id: string
  class_id: string
  exit_date: string
  exit_time: string
  reason: string
  authorized_by_name?: string | null
}

type StudentLicense = {
  id: string
  student_id: string
  class_id: string | null
  license_type:
    | 'medical_certificate'
    | 'medical_leave'
    | 'other'
  start_date: string
  end_date: string
  notes: string | null
  cancelled_at: string | null
}

type DailyEvolutionItem = {
  attendance_date: string
  total_records: number
  presentes: number
  faltosos: number
  frequency_rate: number
}

type MonthComparisonItem = {
  month_number: number
  month_label: string
  total_records: number
  presentes: number
  faltosos: number
  frequency_rate: number
}

type ClassRankingItem = {
  class_id: string
  class_name: string
  total_records: number
  presentes: number
  faltosos: number
  frequency_rate: number
}

type WeekdaySummaryItem = {
  weekday_number: number
  weekday_label: string
  total_records: number
  presentes: number
  faltosos: number
  frequency_rate: number
}

type AttendanceReportsSectionProps = {
  schoolId: string
  schoolName: string
  students: Student[]
  classes: SchoolClass[]
  records: AttendanceRecord[]
  licenses: StudentLicense[]
  selectedClassId: string
  setSelectedClassId: (value: string) => void
  filterStatus: 'all' | 'present' | 'absent' | 'early_exit'
  setFilterStatus: (value: 'all' | 'present' | 'absent' | 'early_exit') => void
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  onGenerate: () => void
  earlyExits: EarlyExitRecord[]
  loading: boolean

  isSubscriptionActive: boolean
  showMessage: (text: string) => void
}

export default function AttendanceReportsSection({
  schoolId,
  schoolName,
  students,
  classes,
  records,
  licenses,
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
  earlyExits,
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

const [analyticsOpen, setAnalyticsOpen] = useState(false)
const [analyticsLoading, setAnalyticsLoading] = useState(false)
const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear())

const [dailyEvolution, setDailyEvolution] = useState<DailyEvolutionItem[]>([])
const [monthComparison, setMonthComparison] = useState<MonthComparisonItem[]>([])
const [classRanking, setClassRanking] = useState<ClassRankingItem[]>([])
const [weekdaySummary, setWeekdaySummary] = useState<WeekdaySummaryItem[]>([])

const [chartTooltip, setChartTooltip] = useState<{
  x: number
  y: number
  date: string
  rate: number
  presentes: number
  faltosos: number
} | null>(null)

const mostPresentClasses = useMemo(() => {
  return [...classRanking]
    .sort((a, b) => b.frequency_rate - a.frequency_rate)
    .slice(0, 5)
}, [classRanking])

const mostAbsentClasses = useMemo(() => {
  return [...classRanking]
    .sort((a, b) => a.frequency_rate - b.frequency_rate)
    .slice(0, 5)
}, [classRanking])

const bestWeekday = weekdaySummary[0]

const dailyChartPoints = useMemo(() => {
  if (dailyEvolution.length === 0) return ''

  const width = 720
  const height = 220
  const padding = 24

  return dailyEvolution
    .map((item, index) => {
      const x =
        dailyEvolution.length === 1
          ? width / 2
          : padding +
            (index * (width - padding * 2)) /
              (dailyEvolution.length - 1)

      const rate = Number(item.frequency_rate || 0)
      const y =
        height -
        padding -
        (rate / 100) * (height - padding * 2)

      return `${x},${y}`
    })
    .join(' ')
}, [dailyEvolution])

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

  const earlyExitMap = new Map(
  earlyExits.map((exit) => [
    `${exit.student_id}_${exit.exit_date}`,
    exit,
  ])
)

  const reportRecords =
  filterStatus === 'early_exit'
    ? records.filter((record) =>
        earlyExitMap.has(
          `${record.student_id}_${record.attendance_date}`
        )
      )
    : records

const groupedByClass =
  reportRecords.reduce<Record<string, AttendanceRecord[]>>(
    (acc, record) => {
      if (!acc[record.class_id]) acc[record.class_id] = []

      acc[record.class_id].push(record)

      return acc
    },
    {}
  )

const totalRecords = reportRecords.length

const totalPresent = reportRecords.filter(
  (item) => item.status === 'present'
).length

const totalAbsent = reportRecords.filter(
  (item) => item.status === 'absent'
).length
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

const licensesByStudent = useMemo(() => {
  const map = new Map<
    string,
    StudentLicense[]
  >()

  licenses.forEach((license) => {
    /*
     * Canceladas nunca justificam
     * uma falta no relatório.
     */
    if (license.cancelled_at) {
      return
    }

    const current =
      map.get(license.student_id) || []

    current.push(license)

    map.set(
      license.student_id,
      current
    )
  })

  return map
}, [licenses])

function getLicenseForRecord(
  record: AttendanceRecord
) {
  const studentLicenses =
    licensesByStudent.get(
      record.student_id
    ) || []

  return studentLicenses.find(
    (license) =>
      /*
       * A data da falta precisa estar
       * dentro do período da licença.
       */
      license.start_date <=
        record.attendance_date &&
      license.end_date >=
        record.attendance_date &&

      /*
       * Se houver turma gravada,
       * ela deve coincidir.
       *
       * Licenças antigas sem class_id
       * continuam válidas.
       */
      (
        !license.class_id ||
        license.class_id ===
          record.class_id
      )
  )
}

function getLicenseTypeLabel(
  type: StudentLicense['license_type']
) {
  if (
    type === 'medical_certificate'
  ) {
    return 'Atestado médico'
  }

  if (
    type === 'medical_leave'
  ) {
    return 'Licença médica'
  }

  return 'Licença'
}

async function loadAttendanceAnalytics() {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  setAnalyticsLoading(true)

  const [
    dailyResult,
    monthResult,
    rankingResult,
    weekdayResult,
  ] = await Promise.all([
    supabase.rpc('get_attendance_daily_evolution', {
      p_school_id: schoolId,
      p_year: analyticsYear,
    }),
    supabase.rpc('get_attendance_month_comparison', {
      p_school_id: schoolId,
      p_year: analyticsYear,
    }),
    supabase.rpc('get_class_attendance_ranking', {
      p_school_id: schoolId,
      p_year: analyticsYear,
    }),
    supabase.rpc('get_attendance_weekday_summary', {
      p_school_id: schoolId,
      p_year: analyticsYear,
    }),
  ])

  setAnalyticsLoading(false)

  const firstError =
    dailyResult.error ||
    monthResult.error ||
    rankingResult.error ||
    weekdayResult.error

  if (firstError) {
    showMessage(`Erro ao carregar análises: ${firstError.message}`)
    return
  }

  setDailyEvolution((dailyResult.data || []) as DailyEvolutionItem[])
  setMonthComparison((monthResult.data || []) as MonthComparisonItem[])
  setClassRanking((rankingResult.data || []) as ClassRankingItem[])
  setWeekdaySummary((weekdayResult.data || []) as WeekdaySummaryItem[])
}

async function handleOpenAnalytics() {
  setAnalyticsOpen(true)
  await loadAttendanceAnalytics()
}

function handleExportAnalyticsPdf() {
  const printContents = document.getElementById('attendance-analytics-print')

  if (!printContents) {
    showMessage('Área de análises não encontrada.')
    return
  }

  const printWindow = window.open('', '_blank', 'width=1200,height=900')

  if (!printWindow) {
    showMessage('Não foi possível abrir a janela de impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Análises de Frequência</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #0f172a;
          }

          .header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }

          .school-name {
            font-size: 24px;
            font-weight: 900;
          }

          .report-title {
            margin-top: 6px;
            color: #475569;
            font-weight: 700;
          }

          .footer {
            position: fixed;
            bottom: 14px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            font-weight: 700;
          }

          .analytics-print-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

@media print {
  .analytics-print-grid {
    grid-template-columns: 1fr !important;
  }

  svg {
    max-width: 100% !important;
    height: auto !important;
  }

  body {
    zoom: 0.92;
  }
}

          @page {
            margin: 8mm;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div class="school-name">${schoolName}</div>
          <div class="report-title">Análises de Frequência - ${analyticsYear}</div>
        </div>

        ${printContents.innerHTML}

        <div class="footer">SchoolOS</div>
      </body>
    </html>
  `)

  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 800)
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

      <div
  style={{
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: isMobile ? 'stretch' : 'flex-end',
  }}
>
  <button
    onClick={() => {
      if (!isSubscriptionActive) {
        showMessage('Sua assinatura expirou. Renove para gerar relatórios.')
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
      cursor: loading || !isSubscriptionActive ? 'not-allowed' : 'pointer',
      boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
      width: isMobile ? '100%' : 'auto',
    }}
  >
    {loading ? 'Gerando...' : 'Gerar relatório'}
  </button>

  <button
    onClick={() => {
  if (!isSubscriptionActive) {
    showMessage('Sua assinatura expirou. Renove para acessar as análises.')
    return
  }

  handleOpenAnalytics()
}}
disabled={analyticsLoading || !isSubscriptionActive}
    style={{
      padding: '14px 18px',
      borderRadius: 16,
      border: '1px solid #cbd5e1',
      background: !isSubscriptionActive ? '#f1f5f9' : '#ffffff',
      color: !isSubscriptionActive ? '#94a3b8' : '#0f172a',
      fontWeight: 800,
      cursor: analyticsLoading || !isSubscriptionActive ? 'not-allowed' : 'pointer',
      width: isMobile ? '100%' : 'auto',
    }}
  >
    {analyticsLoading ? 'Carregando...' : 'Ver análises'}
  </button>
</div>
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
            setFilterStatus(
  e.target.value as 'all' | 'present' | 'absent' | 'early_exit'
)
          }
          style={inputStyle}
        >
          <option value="all">Todos</option>
          <option value="present">Presentes</option>
          <option value="absent">Faltosos</option>
          <option value="early_exit">Saída antecipada</option>
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
      <div style={modernStatLabelStyle}>Registros</div>
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
  : filterStatus === 'absent'
  ? 'Faltosos'
  : 'Saída antecipada'}
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
      {reportRecords.length === 0 ? (
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
  const student =
    students.find(
      (s) =>
        s.id === r.student_id
    )

  const studentLicense =
    r.status === 'absent'
      ? getLicenseForRecord(r)
      : undefined

  return (
                      <tr key={r.id}>
                        <td style={tdNameStyle}>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      flexWrap: 'wrap',
    }}
  >
    <span>
      {student?.full_name ||
        student?.name}
    </span>

    {studentLicense && (
      <span
        style={{
          padding: '3px 7px',
          borderRadius: 999,
          background: '#fff7ed',
          border:
            '1px solid #fed7aa',
          color: '#c2410c',
          fontSize: 10,
          fontWeight: 900,
          whiteSpace: 'nowrap',
        }}
      >
        {getLicenseTypeLabel(
          studentLicense.license_type
        )}
      </span>
    )}
  </div>

  {studentLicense && (
    <div
      style={{
        marginTop: 4,
        fontSize: 10,
        color: '#9a3412',
        fontWeight: 600,
      }}
    >
      Licença: {' '}
      {formatDateBR(
        studentLicense.start_date
      )}
      {' até '}
      {formatDateBR(
        studentLicense.end_date
      )}
    </div>
  )}
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
                          {(() => {
  const earlyExit = earlyExitMap.get(
    `${r.student_id}_${r.attendance_date}`
  )

  if (r.status === 'present' && earlyExit) {
    return `Presente • Saída às ${earlyExit.exit_time}`
  }

  return r.status === 'present'
    ? 'Presente'
    : 'Faltou'
})()}

{(() => {
  const earlyExit = earlyExitMap.get(
    `${r.student_id}_${r.attendance_date}`
  )

  if (!earlyExit) return null

  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        fontWeight: 600,
        color: '#c2410c',
      }}
    >
      Motivo: {earlyExit.reason}
    </div>
  )
})()}
                        </td>

<td style={tdStyle}>
  {r.status === 'present' && (r.updated_at || r.created_at)
    ? formatTimeBR(r.updated_at || r.created_at)
    : ''}
</td>
<td className="hide-on-print" style={tdStyle}>
  {(() => {
    const earlyExit = earlyExitMap.get(
      `${r.student_id}_${r.attendance_date}`
    )

    if (!earlyExit) return null

    if (!student?.responsible_whatsapp) {
      return (
        <span style={{ color: '#94a3b8', fontWeight: 800 }}>
          Sem WhatsApp
        </span>
      )
    }

    const cleanPhone = student.responsible_whatsapp.replace(/\D/g, '')
    const phone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

    const authorizedText = earlyExit.authorized_by_name
      ? ` Autorizado/retirado por: ${earlyExit.authorized_by_name}.`
      : ''

    const message = encodeURIComponent(
      `Olá! Informamos que o(a) aluno(a) ${
        student.full_name || student.name
      }, da turma ${
        schoolClass?.name || '---'
      }, registrou saída antecipada da escola às ${
        earlyExit.exit_time
      }. Motivo: ${earlyExit.reason}.${authorizedText}`
    )

    return (
      <button
        onClick={() =>
          window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
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
        Avisar saída
      </button>
    )
  })()}

  {r.status === 'absent' ? (
    studentLicense ? (
      <span
        style={{
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid #fed7aa',
          background: '#fff7ed',
          color: '#c2410c',
          fontWeight: 800,
          fontSize: 12,
          display: 'inline-block',
        }}
      >
        Falta justificada
      </span>
    ) : student?.responsible_whatsapp ? (
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
    ) : (
      <span style={{ color: '#94a3b8', fontWeight: 700 }}>
        Sem WhatsApp
      </span>
    )
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

{analyticsOpen && (
  <div
    onClick={() => setAnalyticsOpen(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      zIndex: 9998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? 12 : 24,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 1380,
        maxHeight: '94vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: isMobile ? 20 : 28,
        padding: isMobile ? 18 : 34,
        boxShadow: '0 30px 90px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          marginBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#2563eb',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Análises avançadas
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: isMobile ? 24 : 32,
              color: '#0f172a',
              fontWeight: 900,
            }}
          >
            Frequência escolar
          </h2>

          <p style={{ margin: '8px 0 0', color: '#64748b' }}>
            Evolução diária, comparativo mensal e ranking por turma.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="number"
            value={analyticsYear}
            onChange={(e) => setAnalyticsYear(Number(e.target.value))}
            style={{
              width: 110,
              padding: '12px 14px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              fontWeight: 800,
              color: '#0f172a',
            }}
          />

          <button
            onClick={loadAttendanceAnalytics}
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Atualizar
          </button>

          <button
            onClick={handleExportAnalyticsPdf}
            style={{
              padding: '12px 16px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Exportar PDF
          </button>

          <button
            onClick={() => setAnalyticsOpen(false)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: 'none',
              background: '#f1f5f9',
              color: '#334155',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div id="attendance-analytics-print">

  {analyticsLoading && (
    <div
      style={{
        minHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          border: '6px solid #dbeafe',
          borderTop: '6px solid #2563eb',
          animation: 'spin 0.9s linear infinite',
        }}
      />

      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: '#0f172a',
          textAlign: 'center',
        }}
      >
        Carregando análises...
      </div>

      <div
        style={{
          color: '#64748b',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: 420,
          lineHeight: 1.6,
        }}
      >
        Estamos processando os dados de frequência,
        rankings e evolução anual da escola.
      </div>
    </div>
  )}

  {!analyticsLoading && (
    <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : 'repeat(3, minmax(0, 1fr))',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ color: '#1d4ed8', fontWeight: 900 }}>
              Dias analisados
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a' }}>
              {dailyEvolution.length}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
            }}
          >
            <div style={{ color: '#15803d', fontWeight: 900 }}>
              Melhor dia da semana
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
              {bestWeekday
                ? `${bestWeekday.weekday_label} (${bestWeekday.frequency_rate}%)`
                : 'Sem dados'}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ color: '#475569', fontWeight: 900 }}>
              Ano letivo
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#0f172a' }}>
              {analyticsYear}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 18,
            borderRadius: 22,
            border: '1px solid #e2e8f0',
            marginBottom: 18,
          }}
        >
          <h3 style={{ margin: '0 0 14px', color: '#0f172a' }}>
            Evolução diária da frequência
          </h3>

          {dailyEvolution.length === 0 ? (
            <div style={{ color: '#64748b', fontWeight: 700 }}>
              Nenhum dado encontrado para o ano selecionado.
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
  {chartTooltip && (
    <div
      style={{
        position: 'absolute',
        left: chartTooltip.x,
        top: chartTooltip.y,
        transform: 'translate(-50%, -115%)',
        background: '#0f172a',
        color: '#ffffff',
        padding: '10px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 800,
        pointerEvents: 'none',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
        zIndex: 5,
        whiteSpace: 'nowrap',
      }}
    >
      <div>{formatDateBR(chartTooltip.date)}</div>
      <div>Frequência: {chartTooltip.rate}%</div>
      <div>Presentes: {chartTooltip.presentes}</div>
      <div>Faltosos: {chartTooltip.faltosos}</div>
    </div>
  )}

  <svg
    viewBox="0 0 820 300"
    onMouseLeave={() => setChartTooltip(null)}
    style={{
      width: '100%',
      height: 340,
      background: '#f8fafc',
      borderRadius: 18,
      overflow: 'visible',
    }}
  >
    <line x1="54" y1="34" x2="54" y2="238" stroke="#cbd5e1" />
    <line x1="54" y1="238" x2="790" y2="238" stroke="#cbd5e1" />

    {[100, 75, 50, 25, 0].map((value) => {
      const y = 238 - (value / 100) * 204

      return (
        <g key={value}>
          <text
            x="16"
            y={y + 4}
            fontSize="12"
            fill="#475569"
            fontWeight="800"
          >
            {value}%
          </text>
          <line
            x1="54"
            y1={y}
            x2="790"
            y2={y}
            stroke="#e2e8f0"
          />
        </g>
      )
    })}

    <polyline
      points={dailyEvolution
        .map((item, index) => {
          const x =
            dailyEvolution.length === 1
              ? 410
              : 54 + (index * 736) / (dailyEvolution.length - 1)

          const y = 238 - (Number(item.frequency_rate || 0) / 100) * 204

          return `${x},${y}`
        })
        .join(' ')}
      fill="none"
      stroke="#2563eb"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: 1200,
        strokeDashoffset: 0,
        animation: 'drawLine 1.1s ease forwards',
      }}
    />

    {dailyEvolution.map((item, index) => {
      const x =
        dailyEvolution.length === 1
          ? 410
          : 54 + (index * 736) / (dailyEvolution.length - 1)

      const y = 238 - (Number(item.frequency_rate || 0) / 100) * 204

      const showDateLabel =
        dailyEvolution.length <= 12 ||
        index === 0 ||
        index === dailyEvolution.length - 1 ||
        index % Math.ceil(dailyEvolution.length / 8) === 0

      return (
        <g key={item.attendance_date}>
          {showDateLabel && (
            <text
              x={x}
              y="272"
              textAnchor="middle"
              fontSize="11"
              fill="#475569"
              fontWeight="800"
            >
              {formatDateBR(item.attendance_date).slice(0, 5)}
            </text>
          )}

          <circle
            cx={x}
            cy={y}
            r="13"
            fill="transparent"
            onMouseEnter={(e) => {
              const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect()

              if (!rect) return

              setChartTooltip({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                date: item.attendance_date,
                rate: Number(item.frequency_rate || 0),
                presentes: Number(item.presentes || 0),
                faltosos: Number(item.faltosos || 0),
              })
            }}
          />

          <circle
            cx={x}
            cy={y}
            r="5"
            fill="#1d4ed8"
            stroke="#ffffff"
            strokeWidth="2"
          />
        </g>
      )
    })}
  </svg>
</div>
          )}
        </div>

        <div
  className="analytics-print-grid"
  style={{
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 18,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 22,
              border: '1px solid #e2e8f0',
            }}
          >
            <h3 style={{ margin: '0 0 14px', color: '#0f172a' }}>
              Comparativo mês a mês
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
  {monthComparison.map((month) => (
    <div key={month.month_number}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 900,
          color: '#0f172a',
          marginBottom: 6,
        }}
      >
        <span>{month.month_label}</span>
        <span>{month.frequency_rate}%</span>
      </div>

      <div
        style={{
          height: 22,
          borderRadius: 999,
          background: '#e2e8f0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${month.frequency_rate}%`,
            height: '100%',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            transition: 'width 0.8s ease',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          color: '#64748b',
          fontWeight: 700,
        }}
      >
        {month.presentes} presentes • {month.faltosos} faltosos
      </div>
    </div>
  ))}
</div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 22,
              border: '1px solid #e2e8f0',
            }}
          >
            <h3 style={{ margin: '0 0 14px', color: '#0f172a' }}>
              Melhor dia da semana
            </h3>

            {weekdaySummary.map((day) => (
              <div key={day.weekday_number} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    color: '#334155',
                    marginBottom: 6,
                  }}
                >
                  <span>{day.weekday_label}</span>
                  <span>{day.frequency_rate}%</span>
                </div>

                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: '#e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${day.frequency_rate}%`,
                      height: '100%',
                      background: '#22c55e',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
  className="analytics-print-grid"
  style={{
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 18,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 22,
              border: '1px solid #bbf7d0',
              background: '#ecfdf5',
            }}
          >
            <h3 style={{ margin: '0 0 14px', color: '#14532d' }}>
              Turmas mais presentes
            </h3>

            {mostPresentClasses.map((item, index) => (
              <div
  key={item.class_id}
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    marginBottom: 10,
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #bbf7d0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  }}
>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: '#22c55e',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 15,
        flexShrink: 0,
      }}
    >
      {index + 1}
    </div>

    <span
      style={{
        color: '#14532d',
        fontWeight: 900,
        fontSize: 16,
      }}
    >
      {item.class_name}
    </span>
  </div>

  <span
    style={{
      color: '#166534',
      fontWeight: 900,
      fontSize: 18,
      flexShrink: 0,
    }}
  >
    {item.frequency_rate}%
  </span>
</div>
            ))}
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 22,
              border: '1px solid #fecaca',
              background: '#fef2f2',
            }}
          >
            <h3 style={{ margin: '0 0 14px', color: '#7f1d1d' }}>
              Turmas mais faltosas
            </h3>

            {mostAbsentClasses.map((item, index) => (
              <div
  key={item.class_id}
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    marginBottom: 10,
    borderRadius: 14,
    background: '#ffffff',
    border: '1px solid #fecaca',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  }}
>
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    }}
  >
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: '#ef4444',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: 15,
        flexShrink: 0,
      }}
    >
      {index + 1}
    </div>

    <span
      style={{
        color: '#7f1d1d',
        fontWeight: 900,
        fontSize: 16,
      }}
    >
      {item.class_name}
    </span>
  </div>

  <span
    style={{
      color: '#991b1b',
      fontWeight: 900,
      fontSize: 18,
      flexShrink: 0,
    }}
  >
    {item.frequency_rate}%
  </span>
</div>
            ))}
          </div>
        </div>
    </>
  )}
      </div>
    </div>
  </div>
)}

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