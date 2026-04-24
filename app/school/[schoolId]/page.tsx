'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import StudentsSection from '@/components/StudentsSection'
import SchoolYearsSection from '@/components/SchoolYearsSection'
import ClassesSection from '@/components/ClassesSection'
import EnrollmentsSection from '@/components/EnrollmentsSection'
import TeachersSection from '@/components/TeachersSection'
import ManagersSection from '@/components/ManagersSection'
import QRScanner from '@/components/QRScanner'
import AttendanceSection from '@/components/AttendanceSection'
import { useRef } from 'react'
import AttendanceReportsSection from '@/components/AttendanceReportsSection'

type Student = {
  id: string
  name: string | null
  full_name: string | null
  email: string | null
  birth_date: string
  school_id?: string | null
  profile_photo_path?: string | null
  profile_photo_url?: string | null
  qr_code_token?: string | null
  class_name?: string | null
  responsible_email?: string | null
  responsible_whatsapp?: string | null
}

type AlertStudent = {
  studentId: string
  studentName: string
  classId: string
  className: string
  absentDates: string[]
  alertType: 'three_consecutive_absences' | 'three_absences_in_15_days'
}

type Teacher = {
  id: string
  full_name: string
  email: string | null
  school_id: string
}

type Manager = {
  id: string
  full_name: string
  email: string | null
  area: string | null
  school_id: string
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

type SchoolInfo = {
  id: string
  name: string
}

export default function SchoolPage() {
  const params = useParams<{ schoolId: string }>()
  const router = useRouter()
  const schoolId = params.schoolId

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userArea, setUserArea] = useState<string | null>(null)
  const [school, setSchool] = useState<SchoolInfo | null>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])

  const [studentName, setStudentName] = useState('')
  const [studentBirthDate, setStudentBirthDate] = useState('')
  const [studentPhoto, setStudentPhoto] = useState<File | null>(null)

  const [yearValue, setYearValue] = useState('')
  const [className, setClassName] = useState('')
  const [selectedYearId, setSelectedYearId] = useState('')

  const [selectedEnrollmentYearId, setSelectedEnrollmentYearId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [studentEmail, setStudentEmail] = useState('')

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherName, setTeacherName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')

  const [managers, setManagers] = useState<Manager[]>([])
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerArea, setManagerArea] = useState('')

  const [scanResult, setScanResult] = useState<{
  status: 'success' | 'duplicate' | 'error'
  message: string
  student?: {
    name: string
    className: string
    photo: string | null
  }
  time?: string
} | null>(null)
  const [isScannerActive, setIsScannerActive] = useState(false)
  const [scannerMode, setScannerMode] = useState<'camera' | 'manual' | null>(null)
  const [manualQrCode, setManualQrCode] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [recentScans, setRecentScans] = useState<
  {
    id: string
    status: 'success' | 'duplicate' | 'error'
    message: string
    studentName?: string
    className?: string
    photo?: string | null
    time: string
  }[]
>([])

const today = new Date().toISOString().split('T')[0]

const [reportStartDate, setReportStartDate] = useState(today)
const [reportEndDate, setReportEndDate] = useState(today)
const [reportClassId, setReportClassId] = useState('')
const [reportStatus, setReportStatus] = useState<'all' | 'present' | 'absent'>('all')
const [reportLoading, setReportLoading] = useState(false)
const [reportRecords, setReportRecords] = useState<
  {
    id: string
    student_id: string
    class_id: string
    attendance_date: string
    status: 'present' | 'absent'
    source: 'system_default' | 'qr' | 'facial' | 'manual'
  }[]
>([])
  const [schoolName, setSchoolName] = useState('SchoolOS')
  const [absenceAlerts, setAbsenceAlerts] = useState<AlertStudent[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianWhatsapp, setGuardianWhatsapp] = useState('')

  const [activeSection, setActiveSection] = useState<
  'overview' | 'registrations' | 'attendance' | 'reports'
>('overview')

  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'gestor'

  const canManage = useMemo(() => isAdmin || isManager, [isAdmin, isManager])
  const [windowWidth, setWindowWidth] = useState(1200)
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  function pushRecentScan(data: {
  status: 'success' | 'duplicate' | 'error'
  message: string
  studentName?: string
  className?: string
  photo?: string | null
  time: string
}) {
  setRecentScans((prev) => [
    {
      id: crypto.randomUUID(),
      ...data,
    },
    ...prev,
  ].slice(0, 8))
}

function formatDateBR(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

  async function ensureAccess() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      router.replace('/')
      return false
    }

    const { data, error } = await supabase
  .from('school_memberships')
  .select('role, area')
  .eq('user_id', user.id)
  .eq('school_id', schoolId)
  .eq('status', 'active')
  .limit(1)
  .maybeSingle()

    if (error || !data) {
      router.replace('/access')
      return false
    }

    setUserRole(data.role)
setUserArea(data.area ?? null)
return true
  }

  async function fetchSchool() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', schoolId)
    .maybeSingle()

  if (error || !data) {
    setMessage('Não foi possível carregar a escola.')
    return
  }

  setSchool(data)
  setSchoolName(data.name || 'SchoolOS')
}

  async function fetchStudents(currentSchoolIdParam?: string) {
  const currentSchoolId = currentSchoolIdParam || schoolId

  if (!currentSchoolId) return

  const { data, error } = await supabase
  .from('students')
  .select(`
    id,
    name,
    full_name,
    email,
    birth_date,
    school_id,
    profile_photo_path,
    qr_code_token,
    responsible_email,
    responsible_whatsapp
  `)
    .eq('school_id', currentSchoolId)
    .order('created_at', { ascending: false })

  if (error) {
    setMessage(`Erro ao buscar alunos: ${error.message}`)
    return
  }

  const studentsWithPhotos = await Promise.all(
    (data || []).map(async (student) => {
      let profilePhotoUrl: string | null = null

      if (student.profile_photo_path) {
        const { data: signedData } = await supabase.storage
          .from('student-profile-photos')
          .createSignedUrl(student.profile_photo_path, 3600)

        profilePhotoUrl = signedData?.signedUrl || null
      }

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select(`
          class_id,
          classes (
            name
          )
        `)
        .eq('student_id', student.id)
        .limit(1)
        .maybeSingle()

      const classData = Array.isArray(enrollment?.classes)
  ? enrollment?.classes[0]
  : enrollment?.classes

return {
  ...student,
  profile_photo_url: profilePhotoUrl,
  class_name: classData?.name || 'Sem turma',
}
    })
  )

  setStudents(studentsWithPhotos as Student[])
}

  async function fetchTeachers() {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, full_name, email, school_id')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })

    if (error) {
      setMessage(`Erro ao buscar professores: ${error.message}`)
      return
    }

    setTeachers((data || []) as Teacher[])
  }

  async function fetchManagers() {
    const { data, error } = await supabase
      .from('managers')
      .select('id, full_name, email, area, school_id')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })

    if (error) {
      setMessage(`Erro ao buscar gestores: ${error.message}`)
      return
    }

    setManagers((data || []) as Manager[])
  }

  async function fetchSchoolYears() {
    const { data, error } = await supabase
      .from('school_years')
      .select('id, year, school_id')
      .eq('school_id', schoolId)
      .order('year', { ascending: true })

    if (error) {
      setMessage(`Erro ao buscar anos letivos: ${error.message}`)
      return
    }

    setSchoolYears((data || []) as SchoolYear[])
  }

  async function fetchClasses() {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, school_id, year_id')
      .eq('school_id', schoolId)
      .order('name', { ascending: true })

    if (error) {
      setMessage(`Erro ao buscar turmas: ${error.message}`)
      return
    }

    setClasses((data || []) as SchoolClass[])
  }

  async function fetchEnrollments() {
    const { data, error } = await supabase
      .from('enrollments')
      .select('id, student_id, class_id, school_id, year_id')
      .eq('school_id', schoolId)

    if (error) {
      setMessage(`Erro ao buscar matrículas: ${error.message}`)
      return
    }

    setEnrollments((data || []) as Enrollment[])
  }

  async function loadAllData() {
    await Promise.all([
      fetchSchool(),
      fetchStudents(),
      fetchTeachers(),
      fetchManagers(),
      fetchSchoolYears(),
      fetchClasses(),
      fetchEnrollments(),
    ])
  }

  async function uploadStudentProfilePhoto(file: File, currentSchoolId: string) {
  const fileExt = file.name.split('.').pop() || 'jpg'
  const filePath = `${currentSchoolId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage
    .from('student-profile-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

async function initializeAttendanceForToday() {
  if (!schoolId) {
    setMessage('Escola não identificada.')
    return false
  }

  if (enrollments.length === 0) {
    setMessage('Não há matrículas para gerar a chamada do dia.')
    return false
  }

  const today = new Date().toISOString().split('T')[0]

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: existingRecords, error: existingError } = await supabase
    .from('attendance_records')
    .select('student_id, class_id')
    .eq('school_id', schoolId)
    .eq('attendance_date', today)

  if (existingError) {
    setMessage(`Erro ao verificar chamada do dia: ${existingError.message}`)
    return false
  }

  const existingKeys = new Set(
    (existingRecords || []).map(
      (record) => `${record.student_id}-${record.class_id}`
    )
  )

  const missingRecords = enrollments
    .filter(
      (enrollment) =>
        !existingKeys.has(`${enrollment.student_id}-${enrollment.class_id}`)
    )
    .map((enrollment) => ({
      school_id: schoolId,
      student_id: enrollment.student_id,
      class_id: enrollment.class_id,
      attendance_date: today,
      status: 'absent' as const,
      source: 'system_default' as const,
      recorded_by_user_id: user?.id || null,
    }))

  if (missingRecords.length > 0) {
    const { error: insertError } = await supabase
      .from('attendance_records')
      .insert(missingRecords)

    if (insertError) {
      setMessage(`Erro ao iniciar chamada: ${insertError.message}`)
      return false
    }
  }

  return true
}

async function handleStartReading() {
  setScanResult(null)
  setManualQrCode('')

  const initialized = await initializeAttendanceForToday()

  if (!initialized) return

  setScannerMode('camera')
  setIsScannerActive(true)
  setMessage('Leitura iniciada. Todos os alunos do dia começaram como faltosos.')
}

function handleStopReading() {
  setIsScannerActive(false)
  setScannerMode(null)
}

function handleNoCamera() {
  setIsScannerActive(false)
  setScannerMode('manual')
}

type Result = {
  status: 'success' | 'duplicate' | 'error'
  message: string
  student?: {
    name: string
    className: string
    photo: string | null
  }
  time?: string
}

function setResultWithTimeout(data: Result) {
  setScanResult(data)

  if (data.student) {
    pushRecentScan({
      status: data.status,
      message: data.message,
      studentName: data.student.name,
      className: data.student.className,
      photo: data.student.photo,
      time: data.time || new Date().toLocaleTimeString(),
    })
  } else {
    pushRecentScan({
      status: data.status,
      message: data.message,
      time: data.time || new Date().toLocaleTimeString(),
    })
  }

  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }

  timeoutRef.current = setTimeout(() => {
    setScanResult(null)
  }, 3000)
}

async function handleScan(text: string) {
  if (!text?.trim()) {
    setResultWithTimeout({
      status: 'error',
      message: 'Código QR inválido.',
    })
    return
  }

  if (!text.startsWith('schoolos:student:')) {
    setResultWithTimeout({
      status: 'error',
      message: 'QR inválido.',
    })
    return
  }

  const token = text.replace('schoolos:student:', '').trim()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        school_id,
        profile_photo_path,
        qr_code_token
      `)
      .eq('qr_code_token', token)
      .single()

    if (studentError || !student) {
      setResultWithTimeout({
        status: 'error',
        message: 'Aluno não encontrado.',
      })
      return
    }

    if (student.school_id !== schoolId) {
      setResultWithTimeout({
        status: 'error',
        message: 'Aluno não pertence a esta escola.',
      })
      return
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select(`
        class_id,
        classes ( name )
      `)
      .eq('student_id', student.id)
      .eq('school_id', schoolId)
      .limit(1)
      .maybeSingle()

    const classId = enrollment?.class_id || null

const classData = Array.isArray(enrollment?.classes)
  ? enrollment?.classes[0]
  : enrollment?.classes

const className = classData?.name || 'Sem turma'

    if (!classId) {
      setResultWithTimeout({
        status: 'error',
        message: 'Aluno sem turma vinculada.',
      })
      return
    }

    const now = new Date()
    const attendanceDate = now.toISOString().split('T')[0]

    let photoUrl: string | null = null

    if (student.profile_photo_path) {
      const { data } = await supabase.storage
        .from('student-profile-photos')
        .createSignedUrl(student.profile_photo_path, 3600)

      photoUrl = data?.signedUrl || null
    }

    const { data: existingAttendance, error: existingAttendanceError } =
      await supabase
        .from('attendance_records')
        .select('id, status, created_at, updated_at')
        .eq('student_id', student.id)
        .eq('class_id', classId)
        .eq('attendance_date', attendanceDate)
        .maybeSingle()

    if (existingAttendanceError) {
      setResultWithTimeout({
        status: 'error',
        message: existingAttendanceError.message,
      })
      return
    }

    if (existingAttendance?.status === 'present') {
      setResultWithTimeout({
        status: 'duplicate',
        message: 'Presença já registrada hoje.',
        student: {
          name: student.full_name,
          className,
          photo: photoUrl,
        },
        time: new Date(
          existingAttendance.updated_at || existingAttendance.created_at
        ).toLocaleTimeString(),
      })
      return
    }

    if (existingAttendance?.status === 'absent') {
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance_records')
        .update({
          status: 'present',
          source: 'qr',
          recorded_by_user_id: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAttendance.id)
        .select('updated_at')
        .single()

      if (updateError) {
        setResultWithTimeout({
          status: 'error',
          message: updateError.message,
        })
        return
      }

      setResultWithTimeout({
        status: 'success',
        message: 'Presença confirmada.',
        student: {
          name: student.full_name,
          className,
          photo: photoUrl,
        },
        time: updatedRecord?.updated_at
          ? new Date(updatedRecord.updated_at).toLocaleTimeString()
          : now.toLocaleTimeString(),
      })
      return
    }

    const { data: inserted, error: insertError } = await supabase
      .from('attendance_records')
      .insert([
        {
          school_id: schoolId,
          student_id: student.id,
          class_id: classId,
          attendance_date: attendanceDate,
          status: 'present',
          source: 'qr',
          recorded_by_user_id: user?.id || null,
        },
      ])
      .select('created_at')
      .single()

    if (insertError) {
      setResultWithTimeout({
        status: 'error',
        message: insertError.message,
      })
      return
    }

    setResultWithTimeout({
      status: 'success',
      message: 'Presença confirmada.',
      student: {
        name: student.full_name,
        className,
        photo: photoUrl,
      },
      time: inserted?.created_at
        ? new Date(inserted.created_at).toLocaleTimeString()
        : now.toLocaleTimeString(),
    })
  } catch (error) {
    console.error(error)
    setResultWithTimeout({
      status: 'error',
      message: 'Erro inesperado.',
    })
  }
}

async function handleGenerateAttendanceReport() {
  if (!schoolId) {
    setMessage('Escola não identificada.')
    return
  }

  if (!reportStartDate || !reportEndDate) {
    setMessage('Informe a data inicial e final do relatório.')
    return
  }

  setReportLoading(true)
  setMessage('Gerando relatório...')

  let query = supabase
    .from('attendance_records')
    .select('id, student_id, class_id, attendance_date, status, source')
    .eq('school_id', schoolId)
    .gte('attendance_date', reportStartDate)
    .lte('attendance_date', reportEndDate)
    .order('attendance_date', { ascending: true })

  if (reportClassId) {
    query = query.eq('class_id', reportClassId)
  }

  if (reportStatus !== 'all') {
    query = query.eq('status', reportStatus)
  }

  const { data, error } = await query

  setReportLoading(false)

  if (error) {
    setMessage(`Erro ao gerar relatório: ${error.message}`)
    return
  }

  setReportRecords((data || []) as typeof reportRecords)
  setMessage('Relatório gerado com sucesso.')
}

function handlePrintAttendanceReport() {
  const printContents = document.getElementById('attendance-report-print')

  if (!printContents) {
    setMessage('Área do relatório não encontrada.')
    return
  }

  const printWindow = window.open('', '_blank', 'width=1200,height=900')

  if (!printWindow) {
    setMessage('Não foi possível abrir a janela de impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Relatório de Presença</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 32px;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 10px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
            font-size: 13px;
          }
          h1, h2, h3 {
            margin: 0 0 12px;
          }
          .page-break {
            page-break-before: always;
          }
        </style>
      </head>
      <body>
        ${printContents.innerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function sendWhatsappToAllFromReport(records: any[]) {
  // filtra apenas quem tem whatsapp
  const valid = records.filter(
    (r) => r.responsible_whatsapp
  )

  if (valid.length === 0) {
    alert('Nenhum responsável com WhatsApp cadastrado.')
    return
  }

  valid.forEach((item, index) => {
    setTimeout(() => {
      const phone = item.responsible_whatsapp.replace(/\D/g, '')

      const message = encodeURIComponent(
        `Olá! Informamos que o aluno ${item.full_name} esteve ausente no dia ${formatDateBR(item.date)}.`
      )

      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
    }, index * 800) // intervalo pra não bloquear
  })
}

async function handleGenerateAbsenceAlerts() {
  if (!schoolId) {
    setMessage('Escola não identificada.')
    return
  }

  setAlertsLoading(true)
  setMessage('Analisando faltas e gerando alertas...')

  const today = new Date()
  const past15Days = new Date()
  past15Days.setDate(today.getDate() - 14)

  const startDate = past15Days.toISOString().split('T')[0]
  const endDate = today.toISOString().split('T')[0]

  const { data: records, error } = await supabase
    .from('attendance_records')
    .select('id, student_id, class_id, attendance_date, status, source')
    .eq('school_id', schoolId)
    .gte('attendance_date', startDate)
    .lte('attendance_date', endDate)
    .order('attendance_date', { ascending: true })

  setAlertsLoading(false)

  if (error) {
    setMessage(`Erro ao gerar alertas: ${error.message}`)
    return
  }

  const typedRecords = (records || []) as {
    id: string
    student_id: string
    class_id: string
    attendance_date: string
    status: 'present' | 'absent'
    source: 'system_default' | 'qr' | 'facial' | 'manual'
  }[]

  const grouped = typedRecords.reduce<
    Record<string, { student_id: string; class_id: string; records: typeof typedRecords }>
  >((acc, record) => {
    const key = `${record.student_id}-${record.class_id}`

    if (!acc[key]) {
      acc[key] = {
        student_id: record.student_id,
        class_id: record.class_id,
        records: [],
      }
    }

    acc[key].records.push(record)
    return acc
  }, {})

  const alerts: AlertStudent[] = []

  Object.values(grouped).forEach((group) => {
    const ordered = [...group.records].sort((a, b) =>
      a.attendance_date.localeCompare(b.attendance_date)
    )

    const absentDates = ordered
      .filter((item) => item.status === 'absent')
      .map((item) => item.attendance_date)

    if (absentDates.length === 0) return

    const student = students.find((s) => s.id === group.student_id)
    const schoolClass = classes.find((c) => c.id === group.class_id)

    const studentName =
      (student as { full_name?: string; name?: string } | undefined)?.full_name ||
      (student as { full_name?: string; name?: string } | undefined)?.name ||
      'Aluno não encontrado'

    const className = schoolClass?.name || 'Turma não encontrada'

    let hasThreeConsecutive = false
    let consecutiveDates: string[] = []

    let streak: string[] = []

    for (const record of ordered) {
      if (record.status === 'absent') {
        streak.push(record.attendance_date)

        if (streak.length >= 3) {
          hasThreeConsecutive = true
          consecutiveDates = streak.slice(-3)
        }
      } else {
        streak = []
      }
    }

    if (hasThreeConsecutive) {
      alerts.push({
        studentId: group.student_id,
        studentName,
        classId: group.class_id,
        className,
        absentDates: consecutiveDates,
        alertType: 'three_consecutive_absences',
      })
      return
    }

    if (absentDates.length >= 3) {
      alerts.push({
        studentId: group.student_id,
        studentName,
        classId: group.class_id,
        className,
        absentDates,
        alertType: 'three_absences_in_15_days',
      })
    }
  })

  setAbsenceAlerts(alerts)
  setMessage(
    alerts.length > 0
      ? `Alertas gerados: ${alerts.length}`
      : 'Nenhum alerta de faltas encontrado.'
  )
}

async function handleCopyAlertMessage(alert: AlertStudent) {
  const datesText = alert.absentDates.map(formatDateBR).join(', ')

  const text =
    alert.alertType === 'three_consecutive_absences'
      ? `Olá! Informamos que o(a) aluno(a) ${alert.studentName}, da turma ${alert.className}, registrou 3 faltas seguidas nas datas: ${datesText}. Pedimos que a família acompanhe a situação junto à escola.`
      : `Olá! Informamos que o(a) aluno(a) ${alert.studentName}, da turma ${alert.className}, registrou 3 faltas no intervalo recente de 15 dias, nas datas: ${datesText}. Pedimos que a família acompanhe a situação junto à escola.`

  try {
    await navigator.clipboard.writeText(text)
    setMessage('Mensagem copiada com sucesso.')
  } catch {
    setMessage('Não foi possível copiar a mensagem.')
  }
}

async function handleCreateStudent() {
  if (!studentName.trim() || !studentEmail.trim() || !studentBirthDate) {
    setMessage('Preencha todos os campos do aluno.')
    return
  }

  if (!schoolId) {
    setMessage('Escola não identificada.')
    return
  }

  const normalizedEmail = studentEmail.trim().toLowerCase()
  const qrCodeToken = crypto.randomUUID().replace(/-/g, '')

  try {
    let profilePhotoPath: string | null = null

    if (studentPhoto) {
      profilePhotoPath = await uploadStudentProfilePhoto(studentPhoto, schoolId)
    }

    const { error } = await supabase.from('students').insert({
  name: studentName,
  full_name: studentName,
  email: studentEmail || null,
  birth_date: studentBirthDate,
  school_id: schoolId,
  profile_photo_path: profilePhotoPath,
  qr_code_token: qrCodeToken,
  responsible_email: guardianEmail || null,
  responsible_whatsapp: guardianWhatsapp || null,
})

    if (error) {
      setMessage(`Erro ao cadastrar aluno: ${error.message}`)
      return
    }

    setMessage('Aluno cadastrado com sucesso.')
    setStudentName('')
    setStudentEmail('')
    setStudentBirthDate('')
    setStudentPhoto(null)
    setGuardianEmail('')
    setGuardianWhatsapp('')

    await fetchStudents()
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Erro ao enviar a foto.'
    setMessage(`Erro ao cadastrar aluno: ${errorMessage}`)
  }
}

async function fetchSchoolName(currentSchoolId?: string | null) {
  const targetSchoolId = currentSchoolId || schoolId

  if (!targetSchoolId) return

  const { data, error } = await supabase
    .from('schools')
    .select('name')
    .eq('id', targetSchoolId)
    .single()

  if (error || !data) return

  setSchoolName(data.name || 'SchoolOS')
}

  async function handleCreateSchoolYear() {
    if (!canManage) {
      setMessage('Você não tem permissão para cadastrar ano letivo.')
      return
    }

    if (!yearValue.trim()) {
      setMessage('Informe o ano letivo.')
      return
    }

    const parsedYear = Number(yearValue)

    if (Number.isNaN(parsedYear)) {
      setMessage('O ano letivo precisa ser numérico.')
      return
    }

    const { error } = await supabase.from('school_years').insert({
      year: parsedYear,
      school_id: schoolId,
    })

    if (error) {
      setMessage(`Erro ao cadastrar ano letivo: ${error.message}`)
      return
    }

    setYearValue('')
    await fetchSchoolYears()
    setMessage('Ano letivo cadastrado com sucesso.')
  }

  async function handleCreateClass() {
    if (!canManage) {
      setMessage('Você não tem permissão para cadastrar turma.')
      return
    }

    if (!className.trim()) {
      setMessage('Informe o nome da turma.')
      return
    }

    if (!selectedYearId) {
      setMessage('Selecione um ano letivo.')
      return
    }

    const { error } = await supabase.from('classes').insert({
      name: className,
      school_id: schoolId,
      year_id: selectedYearId,
    })

    if (error) {
      setMessage(`Erro ao cadastrar turma: ${error.message}`)
      return
    }

    setClassName('')
    setSelectedYearId('')
    await fetchClasses()
    setMessage('Turma cadastrada com sucesso.')
  }

  async function handleCreateTeacher() {
    if (!canManage) {
      setMessage('Você não tem permissão para cadastrar professor.')
      return
    }

    if (!teacherName.trim() || !teacherEmail.trim()) {
      setMessage('Preencha nome e e-mail do professor.')
      return
    }

    setMessage('Cadastrando professor...')

    const normalizedEmail = teacherEmail.trim().toLowerCase()

    const { error } = await supabase.from('teachers').insert({
      full_name: teacherName.trim(),
      email: normalizedEmail,
      school_id: schoolId,
    })

    if (error) {
      if (error.message.toLowerCase().includes('duplicate key')) {
        setMessage('Já existe um professor com esse e-mail nesta escola.')
      } else {
        setMessage(`Erro ao cadastrar professor: ${error.message}`)
      }
      return
    }

    const { error: invitationError } = await supabase
      .from('pending_invitations')
      .insert({
        school_id: schoolId,
        email: normalizedEmail,
        full_name: teacherName.trim(),
        role: 'professor',
        status: 'pending',
      })

    if (invitationError) {
      setMessage(`Professor cadastrado, mas houve erro ao criar convite: ${invitationError.message}`)
      await fetchTeachers()
      return
    }

    setTeacherName('')
    setTeacherEmail('')
    await fetchTeachers()
    setMessage('Professor cadastrado com sucesso.')
  }

  async function handleCreateManager() {
    if (!canManage) {
      setMessage('Você não tem permissão para cadastrar gestor.')
      return
    }

    if (!managerName.trim() || !managerEmail.trim() || !managerArea.trim()) {
      setMessage('Preencha nome, e-mail e área do gestor.')
      return
    }

    setMessage('Cadastrando gestor...')

    const normalizedEmail = managerEmail.trim().toLowerCase()

    const { error } = await supabase.from('managers').insert({
      full_name: managerName.trim(),
      email: normalizedEmail,
      area: managerArea,
      school_id: schoolId,
    })

    if (error) {
      if (error.message.toLowerCase().includes('duplicate key')) {
        setMessage('Já existe um gestor com esse e-mail nesta escola.')
      } else {
        setMessage(`Erro ao cadastrar gestor: ${error.message}`)
      }
      return
    }

    const { error: invitationError } = await supabase
      .from('pending_invitations')
      .insert({
        school_id: schoolId,
        email: normalizedEmail,
        full_name: managerName.trim(),
        role: 'gestor',
        status: 'pending',
      })

    if (invitationError) {
      setMessage(`Gestor cadastrado, mas houve erro ao criar convite: ${invitationError.message}`)
      await fetchManagers()
      return
    }

    setManagerName('')
    setManagerEmail('')
    setManagerArea('')
    await fetchManagers()
    setMessage('Gestor cadastrado com sucesso.')
  }

  async function handleEnrollStudent() {
    if (!canManage) {
      setMessage('Você não tem permissão para matricular aluno.')
      return
    }

    if (!selectedEnrollmentYearId) {
      setMessage('Selecione o ano letivo.')
      return
    }

    if (!selectedStudentId || !selectedClassId) {
      setMessage('Selecione aluno e turma.')
      return
    }

    const { error } = await supabase.from('enrollments').insert({
      student_id: selectedStudentId,
      class_id: selectedClassId,
      school_id: schoolId,
      year_id: selectedEnrollmentYearId,
    })

    if (error) {
      if (
        error.message.includes('enrollments_unique_student_class') ||
        error.message.toLowerCase().includes('duplicate key')
      ) {
        setMessage('Esse aluno já está matriculado nessa turma.')
      } else {
        setMessage(`Erro ao matricular: ${error.message}`)
      }
      return
    }

    setSelectedEnrollmentYearId('')
    setSelectedStudentId('')
    setSelectedClassId('')
    await fetchEnrollments()
    setMessage('Aluno matriculado com sucesso.')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  useEffect(() => {
    async function init() {
      const accessOk = await ensureAccess()
      if (!accessOk) return

      await loadAllData()
      setLoading(false)
    }

    init()
  }, [schoolId])

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 45%, #e0f2fe 100%)',
    padding: '24px 16px 48px',
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 1100,
    margin: '0 auto',
  }

  const heroCardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 28,
    padding: 28,
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
    marginBottom: 20,
  }

  const topRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  }

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.3,
    marginBottom: 16,
  }

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#0f172a',
  }

  const subtitleStyle: React.CSSProperties = {
    margin: '10px 0 0',
    color: '#475569',
    fontSize: 15,
    lineHeight: 1.6,
  }

  const rolePillStyle = (role: string | null): React.CSSProperties => {
    const palette: Record<string, { bg: string; color: string }> = {
      admin: { bg: '#dbeafe', color: '#1d4ed8' },
      gestor: { bg: '#dcfce7', color: '#15803d' },
      professor: { bg: '#ede9fe', color: '#6d28d9' },
      aluno: { bg: '#fef3c7', color: '#b45309' },
      responsavel: { bg: '#fee2e2', color: '#b91c1c' },
    }

    const current = palette[role || ''] || { bg: '#e2e8f0', color: '#334155' }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '8px 12px',
      borderRadius: 999,
      background: current.bg,
      color: current.color,
      fontSize: 13,
      fontWeight: 700,
      textTransform: 'capitalize',
      marginTop: 14,
    }
  }

  const dashboardPageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #f3f6fb 0%, #eef2f8 100%)',
  padding: 24,
}

const dashboardLoadingWrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const dashboardLoadingCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: '20px 24px',
  fontWeight: 700,
  color: '#0f172a',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)',
}

const dashboardShellStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 1600,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : '280px minmax(0, 1fr)',
  gap: 24,
  alignItems: 'start',
}

const dashboardSidebarStyle: React.CSSProperties = {
  position: isMobile ? 'fixed' : 'sticky',
  top: isMobile ? 0 : 24,
  left: isMobile ? (sidebarOpen ? 0 : -320) : 'auto',
  width: 280,
  height: isMobile ? '100vh' : 'auto',
  overflowY: 'auto',
  zIndex: 100,
  transition: 'left 0.3s ease',
  background: 'rgba(255,255,255,0.98)',
  border: '1px solid #e2e8f0',
  borderRadius: isMobile ? 0 : 28,
  padding: 24,
  boxShadow: isMobile
    ? '0 30px 80px rgba(15, 23, 42, 0.3)'
    : '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const dashboardBrandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 28,
}

const dashboardBrandIconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#fff',
  fontSize: 26,
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.24)',
}

const dashboardBrandTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: '#0f172a',
  lineHeight: 1.1,
}

const dashboardBrandSubtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: '#64748b',
  fontWeight: 700,
}

const dashboardSidebarSectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.9,
  marginBottom: 12,
}

const dashboardNavListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const dashboardNavItemStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: '14px 16px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#475569',
  fontWeight: 700,
}

const dashboardNavButtonStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: '14px 16px',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#475569',
  fontWeight: 700,
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  fontSize: 16,
}

const dashboardNavButtonActiveStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: '14px 16px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  textAlign: 'left',
  cursor: 'pointer',
  width: '100%',
  fontSize: 16,
  border: 'none',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
}

const dashboardNavItemActiveStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: '14px 16px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
}

const dashboardSidebarFooterStyle: React.CSSProperties = {
  marginTop: 28,
  paddingTop: 20,
  borderTop: '1px solid #e2e8f0',
}

const dashboardUserMiniCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 14,
}

const dashboardUserMiniAvatarStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#dbeafe',
  color: '#1d4ed8',
  fontWeight: 900,
}

const dashboardUserMiniNameStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: '#0f172a',
}

const dashboardUserMiniRoleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
}

const dashboardContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  minWidth: 0,
}

const dashboardHeroCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 30,
  padding: 28,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const dashboardHeroTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  flexWrap: 'wrap',
}

const dashboardBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 14px',
  borderRadius: 999,
  background: '#dbeafe',
  color: '#1d4ed8',
  fontWeight: 800,
  fontSize: 13,
  marginBottom: 16,
}

const dashboardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: isMobile ? 28 : isTablet ? 40 : 56,
  lineHeight: 1.02,
  fontWeight: 900,
  color: '#0f172a',
}

const dashboardSubtitleStyle: React.CSSProperties = {
  margin: '14px 0 0',
  fontSize: 20,
  lineHeight: 1.5,
  color: '#64748b',
  maxWidth: 820,
}

const dashboardRolePillStyle = (role: string | null): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  marginTop: 18,
  padding: '10px 14px',
  borderRadius: 999,
  background:
    role === 'admin'
      ? '#dbeafe'
      : role === 'gestor'
      ? '#ede9fe'
      : '#e2e8f0',
  color:
    role === 'admin'
      ? '#1d4ed8'
      : role === 'gestor'
      ? '#6d28d9'
      : '#334155',
  fontWeight: 800,
  fontSize: 14,
})

const dashboardHeroActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const dashboardPrimaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.22)',
}

const dashboardSecondaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
}

const dashboardDangerButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: '#dc2626',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
}

const dashboardWhatsappButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: '#25D366',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
}

const dashboardMessageStyle: React.CSSProperties = {
  marginTop: 18,
  padding: '14px 16px',
  borderRadius: 16,
  background: '#eff6ff',
  color: '#1e3a8a',
  border: '1px solid #bfdbfe',
  fontWeight: 700,
}

const dashboardStatsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 18,
}

const dashboardStatCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
}

const dashboardStatLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#64748b',
  fontWeight: 700,
  marginBottom: 6,
}

const dashboardStatValueStyle: React.CSSProperties = {
  fontSize: 34,
  color: '#0f172a',
  fontWeight: 900,
  lineHeight: 1,
}

const dashboardStatIconBaseStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 26,
  flexShrink: 0,
}

const dashboardStatIconBlueStyle: React.CSSProperties = {
  ...dashboardStatIconBaseStyle,
  background: '#dbeafe',
}

const dashboardStatIconGreenStyle: React.CSSProperties = {
  ...dashboardStatIconBaseStyle,
  background: '#dcfce7',
}

const dashboardStatIconPurpleStyle: React.CSSProperties = {
  ...dashboardStatIconBaseStyle,
  background: '#f3e8ff',
}

const dashboardStatIconOrangeStyle: React.CSSProperties = {
  ...dashboardStatIconBaseStyle,
  background: '#ffedd5',
}

const dashboardMainGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    isMobile || isTablet
      ? '1fr'
      : 'minmax(0, 1.2fr) minmax(360px, 0.8fr)',
  gap: 24,
  alignItems: 'start',
}

const dashboardMainColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  minWidth: 0,
}

const dashboardSideColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  minWidth: 0,
}

const dashboardCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.05)',
  minWidth: 0,
}

const dashboardCardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 18,
  alignItems: 'flex-start',
}

const dashboardCardEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.9,
  marginBottom: 8,
}

const dashboardCardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: '#0f172a',
}

const dashboardCardTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 15,
  lineHeight: 1.5,
  color: '#64748b',
}

const dashboardSectionSpacerStyle: React.CSSProperties = {
  height: 1,
  background: '#e2e8f0',
  margin: '24px 0',
}

const dashboardInputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  fontSize: 15,
  outline: 'none',
  color: '#0f172a',
  background: '#ffffff',
}

const dashboardEmptyStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#64748b',
  fontWeight: 600,
}

const dashboardAlertCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  padding: 16,
  borderRadius: 18,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
}

const dashboardAlertTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: '#0f172a',
  marginBottom: 6,
}

const dashboardAlertTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#64748b',
  marginBottom: 4,
}

const dashboardAlertTypeStyle: React.CSSProperties = {
  marginTop: 8,
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: 999,
  background: '#fee2e2',
  color: '#b91c1c',
  fontWeight: 800,
  fontSize: 12,
}

const dashboardAlertButtonStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  border: 'none',
  background: '#9a3412',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 14,
}

    if (loading) {
    return (
      <main style={dashboardPageStyle}>
        <div style={dashboardLoadingWrapStyle}>
          <div style={dashboardLoadingCardStyle}>Carregando painel da escola...</div>
        </div>
      </main>
    )
  }

  return (
    <main style={dashboardPageStyle}>
      <div style={dashboardShellStyle}>
        <aside style={dashboardSidebarStyle}>
          {isMobile && (
  <button
    onClick={() => setSidebarOpen(false)}
    style={{
      marginBottom: 16,
      padding: '10px 14px',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      background: '#ffffff',
      fontWeight: 800,
      cursor: 'pointer',
      width: '100%',
    }}
  >
    Fechar
  </button>
)}
          <div style={dashboardBrandStyle}>
            <div style={dashboardBrandIconStyle}>🎓</div>
            <div>
              <div style={dashboardBrandTitleStyle}>Painel Escolar</div>
              <div style={dashboardBrandSubtitleStyle}>{school?.name || 'SchoolOS'}</div>
            </div>
          </div>

          <div style={dashboardSidebarSectionTitleStyle}>Navegação</div>

          <div style={dashboardNavListStyle}>
  <button
    onClick={() => setActiveSection('overview')}
    style={
      activeSection === 'overview'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Visão geral
  </button>

  <button
    onClick={() => setActiveSection('registrations')}
    style={
      activeSection === 'registrations'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Cadastros
  </button>

  <button
    onClick={() => setActiveSection('attendance')}
    style={
      activeSection === 'attendance'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Presença
  </button>

  <button
    onClick={() => setActiveSection('reports')}
    style={
      activeSection === 'reports'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Relatórios
  </button>
</div>

          <div style={dashboardSidebarFooterStyle}>
            <div style={dashboardUserMiniCardStyle}>
              <div style={dashboardUserMiniAvatarStyle}>
                {(userRole || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={dashboardUserMiniNameStyle}>
                  {userRole || 'Usuário'}
                </div>
                <div style={dashboardUserMiniRoleStyle}>
                  {isManager && userArea ? `Área: ${userArea}` : 'Acesso escolar'}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section style={dashboardContentStyle}>
          {isMobile && (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#ffffff',
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
    }}
  >
    <strong>Painel Escolar</strong>

    <button
      onClick={() => setSidebarOpen(true)}
      style={{
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid #cbd5e1',
        background: '#ffffff',
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      Menu
    </button>
  </div>
)}
          <section style={dashboardHeroCardStyle}>
            <div style={dashboardHeroTopStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={dashboardBadgeStyle}>Painel escolar</div>
                <h1 style={dashboardTitleStyle}>{school?.name || 'Escola'}</h1>
                <p style={dashboardSubtitleStyle}>
                  Gerencie alunos, gestores, professores, turmas, anos letivos,
                  matrículas e presença em um único ambiente.
                </p>

                <div style={dashboardRolePillStyle(userRole)}>
                  Perfil atual: {userRole || 'não identificado'}
                  {isManager && userArea ? ` • Área: ${userArea}` : ''}
                </div>
              </div>

              <div style={dashboardHeroActionsStyle}>
                <button
                  onClick={() => router.push('/access')}
                  style={dashboardSecondaryButtonStyle}
                >
                  Trocar Escola
                </button>
                <button
                  onClick={() => router.push(`/school/${schoolId}/gate`)}
                      style={dashboardPrimaryButtonStyle}
                                          >
                                          Modo Portaria
                                                  </button>

                <button
                  onClick={handleLogout}
                  style={dashboardPrimaryButtonStyle}
                >
                  Sair
                </button>
              </div>
            </div>

            {message ? (
              <div style={dashboardMessageStyle}>{message}</div>
            ) : null}
          </section>

          {activeSection === 'overview' && (
  <section style={dashboardStatsGridStyle}>
    <div style={dashboardStatCardStyle}>
      <div style={dashboardStatIconBlueStyle}>👨‍🎓</div>
      <div>
        <div style={dashboardStatLabelStyle}>Alunos</div>
        <div style={dashboardStatValueStyle}>{students.length}</div>
      </div>
    </div>

    <div style={dashboardStatCardStyle}>
      <div style={dashboardStatIconGreenStyle}>👨‍🏫</div>
      <div>
        <div style={dashboardStatLabelStyle}>Professores</div>
        <div style={dashboardStatValueStyle}>{teachers.length}</div>
      </div>
    </div>

    <div style={dashboardStatCardStyle}>
      <div style={dashboardStatIconPurpleStyle}>🏫</div>
      <div>
        <div style={dashboardStatLabelStyle}>Turmas</div>
        <div style={dashboardStatValueStyle}>{classes.length}</div>
      </div>
    </div>

    <div style={dashboardStatCardStyle}>
      <div style={dashboardStatIconOrangeStyle}>🗓️</div>
      <div>
        <div style={dashboardStatLabelStyle}>Anos letivos</div>
        <div style={dashboardStatValueStyle}>{schoolYears.length}</div>
      </div>
    </div>
  </section>
)}

          {activeSection === 'overview' && (
  <section style={dashboardMainGridStyle}>
    <div style={dashboardMainColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Presença</div>
              <h2 style={dashboardCardTitleStyle}>Leitura diária</h2>
              <p style={dashboardCardTextStyle}>
                Inicie a leitura para marcar os alunos presentes. Quem não
                tiver leitura no dia permanece como faltoso.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {!isScannerActive && scannerMode !== 'manual' && (
              <button
                onClick={handleStartReading}
                style={dashboardPrimaryButtonStyle}
              >
                Realizar leitura
              </button>
            )}

            {isScannerActive && (
              <button
                onClick={handleStopReading}
                style={dashboardDangerButtonStyle}
              >
                Encerrar leitura
              </button>
            )}

            {!isScannerActive && scannerMode !== 'manual' && (
              <button
                onClick={() => setScannerMode('manual')}
                style={dashboardSecondaryButtonStyle}
              >
                Inserir código manualmente
              </button>
            )}
          </div>

          {isScannerActive && scannerMode === 'camera' && (
            <AttendanceSection result={scanResult} recentScans={recentScans}>
              <QRScanner
                onScan={handleScan}
                onNoCamera={handleNoCamera}
                isActive={isScannerActive}
              />
            </AttendanceSection>
          )}

          {!isScannerActive && scannerMode === 'manual' && (
            <AttendanceSection result={scanResult} recentScans={recentScans}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Cole aqui o código do QR"
                  value={manualQrCode}
                  onChange={(e) => setManualQrCode(e.target.value)}
                  style={dashboardInputStyle}
                />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleScan(manualQrCode)}
                    style={dashboardPrimaryButtonStyle}
                  >
                    Confirmar leitura
                  </button>

                  <button
                    onClick={() => {
                      setScannerMode(null)
                      setManualQrCode('')
                    }}
                    style={dashboardSecondaryButtonStyle}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </AttendanceSection>
          )}
        </section>
      )}
    </div>

    <div style={dashboardSideColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Alertas</div>
              <h2 style={dashboardCardTitleStyle}>Faltas recorrentes</h2>
              <p style={dashboardCardTextStyle}>
                Identifique alunos com 3 faltas seguidas ou 3 faltas em 15 dias.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAbsenceAlerts}
            style={dashboardPrimaryButtonStyle}
            disabled={alertsLoading}
          >
            {alertsLoading ? 'Analisando...' : 'Gerar alertas'}
          </button>

          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {absenceAlerts.length === 0 ? (
              <div style={dashboardEmptyStyle}>Nenhum alerta gerado até o momento.</div>
            ) : (
              absenceAlerts.map((alert) => (
                <div key={`${alert.studentId}-${alert.classId}-${alert.alertType}`} style={dashboardAlertCardStyle}>
                  <div>
                    <div style={dashboardAlertTitleStyle}>{alert.studentName}</div>
                    <div style={dashboardAlertTextStyle}>
                      Turma: {alert.className}
                    </div>
                    <div style={dashboardAlertTextStyle}>
                      Datas: {alert.absentDates.map(formatDateBR).join(', ')}
                    </div>
                    <div style={dashboardAlertTypeStyle}>
                      {alert.alertType === 'three_consecutive_absences'
                        ? '3 faltas consecutivas'
                        : '3 faltas em 15 dias'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyAlertMessage(alert)}
                    style={dashboardAlertButtonStyle}
                  >
                    Copiar mensagem
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  </section>
)}
{activeSection === 'registrations' && (
  <section style={dashboardMainGridStyle}>
    <div style={dashboardMainColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Cadastros</div>
              <h2 style={dashboardCardTitleStyle}>Alunos e matrículas</h2>
            </div>
          </div>

          <StudentsSection
            students={students}
            studentName={studentName}
            studentBirthDate={studentBirthDate}
            studentEmail={studentEmail}
            guardianEmail={guardianEmail}
            guardianWhatsapp={guardianWhatsapp}
            studentPhoto={studentPhoto}
            setStudentName={setStudentName}
            setStudentBirthDate={setStudentBirthDate}
            setStudentEmail={setStudentEmail}
            setGuardianEmail={setGuardianEmail}
            setGuardianWhatsapp={setGuardianWhatsapp}
            setStudentPhoto={setStudentPhoto}
            handleCreateStudent={handleCreateStudent}
          />

          <div style={dashboardSectionSpacerStyle} />

          <EnrollmentsSection
            selectedEnrollmentYearId={selectedEnrollmentYearId}
            selectedStudentId={selectedStudentId}
            selectedClassId={selectedClassId}
            setSelectedEnrollmentYearId={setSelectedEnrollmentYearId}
            setSelectedStudentId={setSelectedStudentId}
            setSelectedClassId={setSelectedClassId}
            handleEnrollStudent={handleEnrollStudent}
            students={students.map((student) => ({
  id: student.id,
  name: student.full_name || student.name || 'Aluno sem nome',
  birth_date: student.birth_date,
  school_id: student.school_id || null,
}))}
            schoolYears={schoolYears}
            classes={classes}
            enrollments={enrollments}
          />
        </section>
      )}

      {isAdmin && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Equipe</div>
              <h2 style={dashboardCardTitleStyle}>Professores e gestores</h2>
            </div>
          </div>

          <TeachersSection
            teacherName={teacherName}
            teacherEmail={teacherEmail}
            setTeacherName={setTeacherName}
            setTeacherEmail={setTeacherEmail}
            handleCreateTeacher={handleCreateTeacher}
            teachers={teachers}
          />

          <div style={dashboardSectionSpacerStyle} />

          <ManagersSection
            managerName={managerName}
            managerEmail={managerEmail}
            managerArea={managerArea}
            setManagerName={setManagerName}
            setManagerEmail={setManagerEmail}
            setManagerArea={setManagerArea}
            handleCreateManager={handleCreateManager}
            managers={managers}
          />
        </section>
      )}
    </div>

    <div style={dashboardSideColumnStyle}>
      {isAdmin && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Estrutura escolar</div>
              <h2 style={dashboardCardTitleStyle}>Anos letivos e turmas</h2>
            </div>
          </div>

          <SchoolYearsSection
            yearValue={yearValue}
            setYearValue={setYearValue}
            handleCreateSchoolYear={handleCreateSchoolYear}
            schoolYears={schoolYears}
          />

          <div style={dashboardSectionSpacerStyle} />

          <ClassesSection
            className={className}
            selectedYearId={selectedYearId}
            setClassName={setClassName}
            setSelectedYearId={setSelectedYearId}
            handleCreateClass={handleCreateClass}
            schoolYears={schoolYears}
            classes={classes}
          />
        </section>
      )}
    </div>
  </section>
)}
{activeSection === 'attendance' && (
  <section style={dashboardMainGridStyle}>
    <div style={dashboardMainColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Presença</div>
              <h2 style={dashboardCardTitleStyle}>Leitura diária</h2>
              <p style={dashboardCardTextStyle}>
                Controle de presença com leitura por QR Code.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {!isScannerActive && scannerMode !== 'manual' && (
              <button
                onClick={handleStartReading}
                style={dashboardPrimaryButtonStyle}
              >
                Realizar leitura
              </button>
            )}

            {isScannerActive && (
              <button
                onClick={handleStopReading}
                style={dashboardDangerButtonStyle}
              >
                Encerrar leitura
              </button>
            )}

            {!isScannerActive && scannerMode !== 'manual' && (
              <button
                onClick={() => setScannerMode('manual')}
                style={dashboardSecondaryButtonStyle}
              >
                Inserir código manualmente
              </button>
            )}
          </div>

          {isScannerActive && scannerMode === 'camera' && (
            <AttendanceSection result={scanResult} recentScans={recentScans}>
              <QRScanner
                onScan={handleScan}
                onNoCamera={handleNoCamera}
                isActive={isScannerActive}
              />
            </AttendanceSection>
          )}

          {!isScannerActive && scannerMode === 'manual' && (
            <AttendanceSection result={scanResult} recentScans={recentScans}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  placeholder="Cole aqui o código do QR"
                  value={manualQrCode}
                  onChange={(e) => setManualQrCode(e.target.value)}
                  style={dashboardInputStyle}
                />

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleScan(manualQrCode)}
                    style={dashboardPrimaryButtonStyle}
                  >
                    Confirmar leitura
                  </button>

                  <button
                    onClick={() => {
                      setScannerMode(null)
                      setManualQrCode('')
                    }}
                    style={dashboardSecondaryButtonStyle}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </AttendanceSection>
          )}
        </section>
      )}
    </div>

    <div style={dashboardSideColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Alertas</div>
              <h2 style={dashboardCardTitleStyle}>Monitoramento</h2>
              <p style={dashboardCardTextStyle}>
                Gere alertas de faltas recorrentes.
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateAbsenceAlerts}
            style={dashboardPrimaryButtonStyle}
            disabled={alertsLoading}
          >
            {alertsLoading ? 'Analisando...' : 'Gerar alertas'}
          </button>
        </section>
      )}
    </div>
  </section>
)}
{activeSection === 'reports' && (
  <section style={dashboardMainGridStyle}>
    <div style={dashboardMainColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Relatórios</div>
              <h2 style={dashboardCardTitleStyle}>Presença</h2>
              <p style={dashboardCardTextStyle}>
                Gere relatórios por período, turma e status.
              </p>
            </div>
          </div>

          <AttendanceReportsSection
            schoolName={schoolName}
            students={students.map((student) => ({
  id: student.id,
  full_name: student.full_name || student.name || 'Aluno sem nome',
  name: student.name || student.full_name || 'Aluno sem nome',
}))}
            classes={classes}
            records={reportRecords}
            selectedClassId={reportClassId}
            setSelectedClassId={setReportClassId}
            filterStatus={reportStatus}
            setFilterStatus={setReportStatus}
            startDate={reportStartDate}
            setStartDate={setReportStartDate}
            endDate={reportEndDate}
            setEndDate={setReportEndDate}
            onGenerate={handleGenerateAttendanceReport}
            loading={reportLoading}
          />

          <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handlePrintAttendanceReport}
              style={dashboardSecondaryButtonStyle}
            >
              Imprimir relatório
            </button>

            {reportStatus === 'absent' && reportRecords.length > 0 && (
              <button
                onClick={() => sendWhatsappToAllFromReport(reportRecords)}
                style={dashboardWhatsappButtonStyle}
              >
                Enviar avisos no WhatsApp
              </button>
            )}
          </div>
        </section>
      )}
    </div>

    <div style={dashboardSideColumnStyle}>
      {(isAdmin || isManager) && (
        <section style={dashboardCardStyle}>
          <div style={dashboardCardHeaderStyle}>
            <div>
              <div style={dashboardCardEyebrowStyle}>Resumo</div>
              <h2 style={dashboardCardTitleStyle}>Relatórios escolares</h2>
              <p style={dashboardCardTextStyle}>
                Use os filtros para gerar relatórios diários, semanais, mensais ou personalizados.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  </section>
)}
        </section>
      </div>
    </main>
  )
}