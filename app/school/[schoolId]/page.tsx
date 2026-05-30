'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
import ClassesAreaSection from '@/components/ClassesAreaSection'
import OccurrenceReportsSection from '@/components/OccurrenceReportsSection'
import AssessmentsSection from '@/components/AssessmentsSection'
import { offlineAttendanceDb } from '@/lib/offlineAttendanceDb'
import StudentsListSection from '@/components/StudentsListSection'
import ClassMapSection from '@/components/ClassMapSection'
import PlansSection from '@/components/PlansSection'
import AttendanceFrequencyRanking from '@/components/AttendanceFrequencyRanking'
import { generateFaceEmbeddingFromBlob } from '@/lib/faceRecognition'

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

type BatchStudentInput = {
  full_name: string
  email: string
  birth_date: string
  responsible_email: string
  responsible_whatsapp: string
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

type Occurrence = {
  id: string
  school_id: string
  class_id: string
  student_id: string
  teacher_id: string
  created_by_name?: string
  situation: string
  description: string | null
  created_at: string
}

type SchoolInfo = {
  id: string
  name: string
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

export default function SchoolPage() {
  const params = useParams<{ schoolId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const schoolId = params.schoolId

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
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
  const [studentsLoading, setStudentsLoading] = useState(true)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherName, setTeacherName] = useState('')
  const [teacherEmail, setTeacherEmail] = useState('')

  const [managers, setManagers] = useState<Manager[]>([])
  const [managerName, setManagerName] = useState('')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerArea, setManagerArea] = useState('')

  const [subscriptionStatus, setSubscriptionStatus] =
  useState<string>('active')

const [subscriptionPlanId, setSubscriptionPlanId] =
  useState<string | null>(null)

const [subscriptionExpiresAt, setSubscriptionExpiresAt] =
  useState<string | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [selectedNotification, setSelectedNotification] = useState<AlertStudent | null>(null)
  const [readNotifications, setReadNotifications] = useState<string[]>([])

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
const [reportStatus, setReportStatus] = useState<
  'all' | 'present' | 'absent' | 'early_exit'
>('all')
const [reportLoading, setReportLoading] = useState(false)
const [reportRecords, setReportRecords] = useState<
  {
    id: string
    student_id: string
    class_id: string
    attendance_date: string
    status: 'present' | 'absent'
    source: 'system_default' | 'qr' | 'facial' | 'manual'
    created_at?: string
    updated_at?: string
  }[]
>([])
type AttendanceRankingItem = {
  student_id: string
  student_name: string
  class_id: string | null
  class_name: string | null
  presences: number
  absences: number
  total: number
  frequency_rate: number
}

const [annualRankingData, setAnnualRankingData] = useState<AttendanceRankingItem[]>([])
  const [occurrenceRecords, setOccurrenceRecords] = useState<Occurrence[]>([])
  const [occurrenceLoading, setOccurrenceLoading] = useState(false)
  const [occurrenceStartDate, setOccurrenceStartDate] = useState(today)
  const [occurrenceEndDate, setOccurrenceEndDate] = useState(today)
  const [occurrenceClassId, setOccurrenceClassId] = useState('')
  const [occurrenceStudentId, setOccurrenceStudentId] = useState('')
  const [occurrenceSituation, setOccurrenceSituation] = useState('')
  const [schoolName, setSchoolName] = useState('SchoolOS')
  const [absenceAlerts, setAbsenceAlerts] = useState<AlertStudent[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [earlyExits, setEarlyExits] = useState<EarlyExitRecord[]>([])

  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianWhatsapp, setGuardianWhatsapp] = useState('')

  const [preparingFaceEmbeddings, setPreparingFaceEmbeddings] = useState(false)
const [faceEmbeddingProgress, setFaceEmbeddingProgress] = useState('')

const [activeSection, setActiveSection] = useState<
  | 'overview'
  | 'registrations'
  | 'students'
  | 'classes'
  | 'class-map'
  | 'attendance'
  | 'reports'
  | 'rankings'
  | 'assessments'
  | 'plans'
>('overview')

  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'gestor'

  const canManage = useMemo(() => isAdmin || isManager, [isAdmin, isManager])
  const [windowWidth, setWindowWidth] = useState(1200)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [logoSize, setLogoSize] = useState(40)

  const [notificationsOpen, setNotificationsOpen] = useState(false)

useEffect(() => {
  function updateSize() {
    const width = window.innerWidth

    if (width < 480) setLogoSize(28)
    else if (width < 768) setLogoSize(32)
    else if (width < 1024) setLogoSize(40)
    else setLogoSize(56)
  }

  updateSize()
  window.addEventListener('resize', updateSize)

  return () => window.removeEventListener('resize', updateSize)
}, [])

useEffect(() => {
  function handleResize() {
    setWindowWidth(window.innerWidth)
  }

  handleResize()
  window.addEventListener('resize', handleResize)

  return () => window.removeEventListener('resize', handleResize)
}, [])

  useEffect(() => {
  if (!schoolId) return
  if (!isAdmin && !isManager) return
  if (loading) return
  if (studentsLoading) return
  if (students.length === 0) return
  if (classes.length === 0) return

  generateAbsenceAlertsSilent()
}, [
  schoolId,
  isAdmin,
  isManager,
  loading,
  studentsLoading,
  students.length,
  classes.length,
  enrollments.length,
])

useEffect(() => {
  const paymentStatus = searchParams.get('payment')

  if (!paymentStatus) return

  if (paymentStatus === 'success') {
    showMessage('Pagamento aprovado com sucesso.')
  }

  if (paymentStatus === 'pending') {
    showMessage(
      'Pagamento pendente. Aguarde a confirmação.'
    )
  }

  if (paymentStatus === 'failure') {
    showMessage(
      'Pagamento não aprovado.'
    )
  }

  window.history.replaceState(
    {},
    '',
    window.location.pathname
  )
}, [searchParams])

const isMobile = windowWidth < 768
const isTablet = windowWidth >= 768 && windowWidth < 1024

const isSubscriptionActive =
  subscriptionStatus === 'active' &&
  (
    !subscriptionExpiresAt ||
    new Date(subscriptionExpiresAt) > new Date()
  )

const isFreePlan =
  subscriptionPlanId === 'free_monthly'

useEffect(() => {
  const channel = supabase
    .channel('attendance-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
      },
      () => {
        generateAbsenceAlertsSilent()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])

useEffect(() => {
  if (!schoolId) return
  if (!currentUserId) return
  if (loading) return

  loadReadNotifications()
}, [schoolId, currentUserId, loading])

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

function formatTimeBR(date?: string | Date | null) {
  if (!date) return ''

  return new Date(date).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAlertId(alert: AlertStudent) {
  return `${alert.studentId}-${alert.classId}-${alert.alertType}`
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
    setCurrentUserId(user.id)
    setCurrentUserEmail(user.email || null)
    setAvatarUrl(user.user_metadata?.avatar_url || null)

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
    showMessage('Não foi possível carregar a escola.')
    return
  }

  setSchool(data)
  setSchoolName(data.name || 'SchoolOS')
}

async function markAllNotificationsAsRead() {
  if (!schoolId || !currentUserId) return

  const unreadAlerts = absenceAlerts.filter(
    (alert) => !readNotifications.includes(getAlertId(alert))
  )

  if (unreadAlerts.length === 0) return

  const rows = unreadAlerts.map((alert) => ({
    user_id: currentUserId,
    school_id: schoolId,
    alert_id: getAlertId(alert),
    read_at: new Date().toISOString(),
  }))

  setReadNotifications((prev) => [
    ...prev,
    ...unreadAlerts.map(getAlertId).filter((id) => !prev.includes(id)),
  ])

  await supabase
    .from('notification_reads')
    .upsert(rows, {
      onConflict: 'user_id,school_id,alert_id',
    })
}

async function fetchAnnualRankingRecords() {
  if (!schoolId) return

  const currentYear = new Date().getFullYear()

  const { data, error } = await supabase.rpc(
    'get_attendance_frequency_ranking',
    {
      p_school_id: schoolId,
      p_year: currentYear,
    }
  )

  if (error) {
    showMessage(`Erro ao carregar ranking anual: ${error.message}`)
    return
  }

  setAnnualRankingData((data || []) as AttendanceRankingItem[])
}

async function loadReadNotifications() {
  if (!schoolId || !currentUserId) return

  await supabase.rpc('delete_old_notification_reads')

  const { data, error } = await supabase
    .from('notification_reads')
    .select('alert_id')
    .eq('school_id', schoolId)
    .eq('user_id', currentUserId)

  if (error) return

  setReadNotifications((data || []).map((item) => item.alert_id))
}

async function markNotificationAsRead(alert: AlertStudent) {
  if (!schoolId || !currentUserId) return

  const alertId = getAlertId(alert)

  setReadNotifications((prev) =>
    prev.includes(alertId) ? prev : [...prev, alertId]
  )

  await supabase
    .from('notification_reads')
    .upsert(
      {
        user_id: currentUserId,
        school_id: schoolId,
        alert_id: alertId,
        read_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,school_id,alert_id',
      }
    )
}

async function loadSubscriptionStatus() {
  if (!schoolId) return

  const { data, error } = await supabase
    .from('school_subscriptions')
    .select(`
  status,
  plan_id,
  expires_at
`)
    .eq('school_id', schoolId)
    .single()

  if (error || !data) {
    return
  }

  setSubscriptionStatus(data.status)
  setSubscriptionPlanId(data.plan_id)
  setSubscriptionExpiresAt(data.expires_at)
}

async function fetchStudents(currentSchoolIdParam?: string) {
  const currentSchoolId = currentSchoolIdParam || schoolId

  if (!currentSchoolId) return

  setStudentsLoading(true)

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
    setStudentsLoading(false)
    showMessage(`Erro ao buscar alunos: ${error.message}`)
    return
  }

  setStudents(
    (data || []).map((student) => ({
      ...student,
      profile_photo_url: null,
      class_name: null,
    })) as Student[]
  )

  setStudentsLoading(false)
}

  async function fetchTeachers() {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, full_name, email, school_id')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })

    if (error) {
      showMessage(`Erro ao buscar professores: ${error.message}`)
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
      showMessage(`Erro ao buscar gestores: ${error.message}`)
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
      showMessage(`Erro ao buscar anos letivos: ${error.message}`)
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
      showMessage(`Erro ao buscar turmas: ${error.message}`)
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
      showMessage(`Erro ao buscar matrículas: ${error.message}`)
      return
    }

    setEnrollments((data || []) as Enrollment[])
  }

async function loadAllData() {
  await Promise.all([
    fetchSchool(),
    fetchSchoolYears(),
    fetchClasses(),
    loadSubscriptionStatus(),
    fetchEnrollments(),
    fetchStudents(),
  ])

  fetchTeachers()
  fetchManagers()
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

async function prepareExistingProfilePhotoEmbeddings() {
  if (!schoolId) return
  if (preparingFaceEmbeddings) return

  const confirmRun = window.confirm(
    'Gerar embeddings faciais das fotos já cadastradas? Isso pode demorar alguns minutos.'
  )

  if (!confirmRun) return

  setPreparingFaceEmbeddings(true)
  setFaceEmbeddingProgress('Buscando alunos com foto...')

  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        full_name,
        profile_photo_path,
        enrollments (
          class_id
        )
      `)
      .eq('school_id', schoolId)
      .not('profile_photo_path', 'is', null)

    if (error) {
      showMessage(`Erro ao buscar alunos: ${error.message}`)
      return
    }

    const studentsWithPhoto = data || []

    const { data: existingEmbeddings, error: embeddingsError } = await supabase
      .from('student_face_embeddings')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('source', 'profile_photo')

    if (embeddingsError) {
      showMessage(`Erro ao verificar embeddings: ${embeddingsError.message}`)
      return
    }

    const alreadyDone = new Set(
      (existingEmbeddings || []).map((item) => item.student_id)
    )

    const pendingStudents = studentsWithPhoto.filter(
      (student: any) =>
        student.profile_photo_path &&
        !alreadyDone.has(student.id)
    )

    if (pendingStudents.length === 0) {
      showMessage('Todos os alunos com foto já possuem embedding facial.')
      setFaceEmbeddingProgress('')
      return
    }

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < pendingStudents.length; i++) {
      const student: any = pendingStudents[i]

      setFaceEmbeddingProgress(
        `Processando ${i + 1}/${pendingStudents.length}: ${student.full_name}`
      )

      try {
        const enrollment = Array.isArray(student.enrollments)
          ? student.enrollments[0]
          : student.enrollments

        const classId = enrollment?.class_id

        if (!classId) {
          failCount++
          continue
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from('student-profile-photos')
          .createSignedUrl(student.profile_photo_path, 300)

        if (signedError || !signedData?.signedUrl) {
          failCount++
          continue
        }

        const response = await fetch(signedData.signedUrl)
        const blob = await response.blob()

        const embedding = await generateFaceEmbeddingFromBlob(blob)

        if (!embedding) {
          failCount++
          continue
        }

        const { error: insertError } = await supabase
          .from('student_face_embeddings')
          .insert({
            id: crypto.randomUUID(),
            school_id: schoolId,
            student_id: student.id,
            class_id: classId,
            embedding,
            source: 'profile_photo',
            profile_photo_path: student.profile_photo_path,
            photo_order: 0,
            created_at: new Date().toISOString(),
          })

        if (insertError) {
          failCount++
          continue
        }

        successCount++
      } catch (error) {
        console.error('[FACIAL PROFILE BATCH] erro:', error)
        failCount++
      }
    }

    showMessage(
      `Embeddings gerados: ${successCount}. Falhas: ${failCount}.`
    )

    setFaceEmbeddingProgress(
      `Concluído. Gerados: ${successCount}. Falhas: ${failCount}.`
    )
  } finally {
    setPreparingFaceEmbeddings(false)
  }
}

async function saveProfilePhotoFaceEmbedding({
  studentId,
  photoFile,
  profilePhotoPath,
}: {
  studentId: string
  photoFile: File
  profilePhotoPath: string
}) {
  if (!schoolId) return

  const embedding = await generateFaceEmbeddingFromBlob(photoFile)

  if (!embedding) {
    console.warn('[FACIAL PROFILE] nenhum rosto encontrado na foto do aluno:', studentId)
    return
  }

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle()

  if (!enrollment?.class_id) {
    console.warn('[FACIAL PROFILE] aluno sem matrícula:', studentId)
    return
  }

  await supabase
    .from('student_face_embeddings')
    .delete()
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('source', 'profile_photo')

  const { error } = await supabase
    .from('student_face_embeddings')
    .insert({
      id: crypto.randomUUID(),
      school_id: schoolId,
      student_id: studentId,
      class_id: enrollment.class_id,
      embedding,
      source: 'profile_photo',
      profile_photo_path: profilePhotoPath,
      photo_order: 0,
      created_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[FACIAL PROFILE] erro ao salvar embedding:', error)
  }
}

async function initializeAttendanceForToday() {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return false
  }

  if (enrollments.length === 0) {
    showMessage('Não há matrículas para gerar a chamada do dia.')
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
    showMessage(`Erro ao verificar chamada do dia: ${existingError.message}`)
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
      showMessage(`Erro ao iniciar chamada: ${insertError.message}`)
      return false
    }
  }

  await fetchAnnualRankingRecords()

  return true
}

async function handleStartReading() {
  setScanResult(null)
  setManualQrCode('')

  const initialized = await initializeAttendanceForToday()

  if (!initialized) return

  setScannerMode('camera')
  setIsScannerActive(true)
  showMessage('Leitura iniciada. Todos os alunos do dia começaram como faltosos.')
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
      time: data.time || formatTimeBR(new Date()),
    })
  } else {
    pushRecentScan({
      status: data.status,
      message: data.message,
      time: data.time || formatTimeBR(new Date()),
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
        time: formatTimeBR(
  existingAttendance.updated_at || existingAttendance.created_at
),
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
  ? formatTimeBR(updatedRecord.updated_at)
  : formatTimeBR(now),
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
  ? formatTimeBR(inserted.created_at)
  : formatTimeBR(now),
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
    showMessage('Escola não identificada.')
    return
  }

  if (!reportStartDate || !reportEndDate) {
    showMessage('Informe a data inicial e final do relatório.')
    return
  }

  if (studentsLoading) {
    showMessage('Aguarde o carregamento dos alunos antes de gerar o relatório.')
    return
  }

  setReportLoading(true)
  showMessage('Gerando relatório...')

  let query = supabase
    .from('attendance_records')
    .select('id, student_id, class_id, attendance_date, status, source, created_at, updated_at')
    .eq('school_id', schoolId)
    .gte('attendance_date', reportStartDate)
    .lte('attendance_date', reportEndDate)
    .order('attendance_date', { ascending: true })

  if (reportClassId && reportClassId !== 'all') {
    query = query.eq('class_id', reportClassId)
  }

  if (reportStatus !== 'all' && reportStatus !== 'early_exit') {
    query = query.eq('status', reportStatus)
  }

  const { data, error } = await query

  if (error) {
    setReportLoading(false)
    showMessage(`Erro ao gerar relatório: ${error.message}`)
    return
  }

  let earlyExitQuery = supabase
    .from('student_early_exits')
    .select('id, student_id, class_id, exit_date, exit_time, reason, authorized_by_name')
    .eq('school_id', schoolId)
    .gte('exit_date', reportStartDate)
    .lte('exit_date', reportEndDate)

  if (reportClassId && reportClassId !== 'all') {
    earlyExitQuery = earlyExitQuery.eq('class_id', reportClassId)
  }

  const { data: earlyExitData, error: earlyExitError } = await earlyExitQuery

  if (earlyExitError) {
    setReportLoading(false)
    console.error('Erro ao buscar saídas antecipadas:', earlyExitError)
    showMessage(`Erro ao buscar saídas antecipadas: ${earlyExitError.message}`)
    return
  }

  const exits = (earlyExitData || []) as EarlyExitRecord[]

  setEarlyExits(exits)

  if (reportStatus === 'early_exit') {
    const exitKeys = new Set(
      exits.map((exit) => `${exit.student_id}_${exit.exit_date}`)
    )

    const filteredAttendance = (data || []).filter((record) =>
      exitKeys.has(`${record.student_id}_${record.attendance_date}`)
    )

    setReportRecords(filteredAttendance as typeof reportRecords)
  } else {
    setReportRecords((data || []) as typeof reportRecords)
  }

  setReportLoading(false)

  await fetchAnnualRankingRecords()

  showMessage('Relatório gerado com sucesso.')
}

async function handleUpdateStudent(
  studentId: string,
  data: {
    full_name: string
    email: string
    responsible_email: string
    responsible_whatsapp: string
    photo?: File | null
  }
) {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  let profilePhotoPath: string | undefined

  if (data.photo) {
    profilePhotoPath = await uploadStudentProfilePhoto(data.photo, schoolId)
  }

  const updateData: any = {
    name: data.full_name,
    full_name: data.full_name,
    email: data.email || null,
    responsible_email: data.responsible_email || null,
    responsible_whatsapp: data.responsible_whatsapp || null,
  }

  if (profilePhotoPath) {
    updateData.profile_photo_path = profilePhotoPath
  }

  const { error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', studentId)
    .eq('school_id', schoolId)

  if (error) {
    showMessage(`Erro ao atualizar aluno: ${error.message}`)
    return
  }

  if (data.photo && profilePhotoPath) {
  await saveProfilePhotoFaceEmbedding({
    studentId,
    photoFile: data.photo,
    profilePhotoPath,
  })
}

  await fetchStudents()
  showMessage('Aluno atualizado com sucesso.')
}

function getSituationsByRisk(risk: string) {
  const leve = [
    'Não realizou atividade',
    'Não trouxe material',
    'Atraso frequente',
    'Dormindo',
    'Apatia / desinteresse',
    'Isolamento social',
    'Falta de participação',
    'Fardamento incompleto',
    'Documentação pendente',
    'Responsável não compareceu',
    'Fora do mapa de turma',
  ]

  const medio = [
    'Conversando Muito',
    'Interrompendo a aula',
    'Desobediência',
    'Provocando colegas',
    'Linguagem inadequada',
    'Uso indevido de celular',
    'Saída sem autorização',
    'Disperso em sala',
  ]

  const grave = [
    'Desrespeitando o professor',
    'Desrespeitando colegas',
    'Brigando',
    'Agressão física',
    'Ameaça a colega',
    'Ameaça a professor',
    'Bullying',
    'Danificando patrimônio',
  ]

  if (risk === 'leve') return leve
  if (risk === 'medio') return medio
  if (risk === 'grave') return grave

  return []
}

async function handleGenerateOccurrenceReport() {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  if (!occurrenceStartDate || !occurrenceEndDate) {
    showMessage('Informe a data inicial e final.')
    return
  }

  setOccurrenceLoading(true)
  showMessage('Gerando relatório de ocorrências...')

  let query = supabase
    .from('student_occurrences')
    .select('id, school_id, class_id, student_id, teacher_id, created_by_email, situation, description, created_at')
    .eq('school_id', schoolId)
    .gte('created_at', `${occurrenceStartDate}T00:00:00`)
    .lte('created_at', `${occurrenceEndDate}T23:59:59`)
    .order('created_at', { ascending: false })

  if (occurrenceClassId) {
    query = query.eq('class_id', occurrenceClassId)
  }

  if (occurrenceStudentId) {
    query = query.eq('student_id', occurrenceStudentId)
  }

  if (occurrenceSituation) {
  query = query.in('situation', getSituationsByRisk(occurrenceSituation))
}

  const { data, error } = await query

  setOccurrenceLoading(false)

  if (error) {
    showMessage(`Erro ao gerar relatório de ocorrências: ${error.message}`)
    return
  }

  const mappedOccurrences = ((data || []) as Occurrence[]).map((occurrence) => {
  const teacher = teachers.find(
    (item) => item.id === occurrence.teacher_id
  )

  const manager = managers.find(
    (item) => item.id === occurrence.teacher_id
  )

  let createdByName = 'Administrador'

  if (teacher) {
    createdByName = teacher.full_name
  }

  if (manager) {
    createdByName = manager.full_name
  }

  return {
    ...occurrence,
    created_by_name: createdByName,
  }
})

setOccurrenceRecords(mappedOccurrences)
  showMessage('Relatório de ocorrências gerado com sucesso.')
}

async function handleDeleteOccurrence(occurrenceId: string) {
  const confirmDelete = window.confirm(
    'Tem certeza que deseja excluir esta ocorrência?'
  )

  if (!confirmDelete) return

  const { error } = await supabase
    .from('student_occurrences')
    .delete()
    .eq('id', occurrenceId)
    .eq('school_id', schoolId)

  if (error) {
    showMessage(`Erro ao excluir ocorrência: ${error.message}`)
    return
  }

  setOccurrenceRecords((prev) =>
    prev.filter((item) => item.id !== occurrenceId)
  )

  showMessage('Ocorrência excluída com sucesso.')
}

function handlePrintOccurrenceReport() {
  const printContents = document.getElementById('occurrence-report-print')

  if (!printContents) {
    showMessage('Área do relatório de ocorrências não encontrada.')
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
        <title>Relatório de Ocorrências</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 16px;
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
            margin-bottom: 6px;
          }

          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 12px;
          }

          .filters {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
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

          @page {
            margin: 8mm;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div class="school-name">${schoolName}</div>
          <div class="report-title">Relatório de Ocorrências</div>

          <div class="filters">
            <strong>Filtros utilizados:</strong><br />
            Período: ${formatDateBR(occurrenceStartDate)} até ${formatDateBR(occurrenceEndDate)}
          </div>
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

function handlePrintAttendanceReport() {
  const printContents = document.getElementById('attendance-report-print')

  if (!printContents) {
    showMessage('Área do relatório não encontrada.')
    return
  }

  const selectedReportClass = classes.find((item) => item.id === reportClassId)

  const statusLabel =
    reportStatus === 'all'
      ? 'Todos'
      : reportStatus === 'present'
      ? 'Presentes'
      : 'Faltosos'

  const classLabel = selectedReportClass?.name || 'Todas as turmas'

  const printWindow = window.open('', '_blank', 'width=1200,height=900')

  if (!printWindow) {
    showMessage('Não foi possível abrir a janela de impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Relatório de Presença</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 16px;
            color: #0f172a;
          }

          .header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }

          .print-only-chart {
  display: block !important;
}

.hide-on-print {
  display: none !important;
}

          .school-name {
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 6px;
          }

          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 12px;
          }

          .filters {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
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

          @page {
            margin: 8mm;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div class="school-name">${schoolName}</div>
          <div class="report-title">Relatório de Presença</div>

          <div class="filters">
            <strong>Filtros utilizados:</strong><br />
            Período: ${formatDateBR(reportStartDate)} até ${formatDateBR(reportEndDate)}<br />
            Turma: ${classLabel}<br />
            Tipo: ${statusLabel}
          </div>
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

function sendWhatsappToAllFromReport(records: any[]) {
  const mapped = records
    .filter((r) => r.status === 'absent')
    .map((r) => {
      const student = students.find((s) => s.id === r.student_id)

      return {
        phone: student?.responsible_whatsapp,
        name: student?.full_name || student?.name,
        date: r.attendance_date,
      }
    })

  const valid = mapped.filter(
  (item): item is { phone: string; name: string; date: string } =>
    !!item.phone
)
  const invalid = mapped.filter((item) => !item.phone)

  if (valid.length === 0) {
    alert('Nenhum responsável com WhatsApp cadastrado.')
    return
  }
  console.log('Responsáveis válidos:', valid)
console.log('Quantidade:', valid.length)

  valid.forEach((item, index) => {
    setTimeout(() => {
      const phone = item.phone.replace(/\D/g, '')

      const message = encodeURIComponent(
        `Olá! Informamos que o aluno ${item.name} esteve ausente no dia ${formatDateBR(item.date)}.`
      )

      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
    }, index * 800)
  })

  if (invalid.length > 0) {
    alert(`${invalid.length} responsáveis não possuem WhatsApp cadastrado.`)
  }
}

async function handleGenerateAbsenceAlerts() {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  setAlertsLoading(true)
  showMessage('Analisando faltas e gerando alertas...')

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
    showMessage(`Erro ao gerar alertas: ${error.message}`)
    return
  }

  const typedRecords = (records || []) as {
    id: string
    student_id: string
    class_id: string
    attendance_date: string
    status: 'present' | 'absent'
    source: 'system_default' | 'qr' | 'facial' | 'manual'
created_at?: string
updated_at?: string
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
  showMessage(
    alerts.length > 0
      ? `Alertas gerados: ${alerts.length}`
      : 'Nenhum alerta de faltas encontrado.'
  )
}

async function generateAbsenceAlertsSilent() {
  if (!schoolId) return

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

  if (error || !records) return

  const grouped = records.reduce<any>((acc, record) => {
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

  Object.values(grouped).forEach((group: any) => {
    const ordered = [...group.records].sort((a, b) =>
      a.attendance_date.localeCompare(b.attendance_date)
    )

    const absentDates = ordered
      .filter((item: any) => item.status === 'absent')
      .map((item: any) => item.attendance_date)

    if (absentDates.length === 0) return

    const lastAbsenceDate = new Date(
  absentDates[absentDates.length - 1]
)

const daysSinceLastAbsence =
  (Date.now() - lastAbsenceDate.getTime()) / (1000 * 60 * 60 * 24)

// só mostra alertas com até 7 dias da última falta
if (daysSinceLastAbsence > 7) return

    const student = students.find((s) => s.id === group.student_id)
    const schoolClass = classes.find((c) => c.id === group.class_id)

    const studentName =
      student?.full_name || student?.name || 'Aluno não encontrado'

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
}

function handleSendAlertWhatsapp(alert: AlertStudent) {
  const student = students.find((s) => s.id === alert.studentId)

  const rawPhone = student?.responsible_whatsapp?.replace(/\D/g, '')

  if (!rawPhone) {
    showMessage('Esse aluno não possui WhatsApp do responsável cadastrado.')
    return
  }

  const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`

  const datesText = alert.absentDates.map(formatDateBR).join(', ')

  const text =
    alert.alertType === 'three_consecutive_absences'
      ? `Olá! Informamos que o(a) aluno(a) ${alert.studentName}, da turma ${alert.className}, registrou 3 faltas seguidas nas datas: ${datesText}. Pedimos que a família acompanhe a situação junto à escola.`
      : `Olá! Informamos que o(a) aluno(a) ${alert.studentName}, da turma ${alert.className}, registrou 3 faltas no intervalo recente de 15 dias, nas datas: ${datesText}. Pedimos que a família acompanhe a situação junto à escola.`

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`

  window.open(url, '_blank')
}

async function handleCreateStudent(photoOverride?: File | null) {
  if (!studentName.trim() || !studentEmail.trim() || !studentBirthDate) {
    showMessage('Preencha todos os campos do aluno.')
    return
  }

  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  const { data: subscriptionData, error: subscriptionError } = await supabase
  .from('school_subscriptions')
  .select(`
    plan_id,
    subscription_plans (
      student_limit
    )
  `)
  .eq('school_id', schoolId)
  .single()

if (subscriptionError || !subscriptionData) {
  showMessage('Não foi possível verificar o plano da escola.')
  return
}

const subscriptionPlan = Array.isArray(subscriptionData.subscription_plans)
  ? subscriptionData.subscription_plans[0]
  : subscriptionData.subscription_plans as unknown as {
      student_limit: number
    } | null

const studentLimit = subscriptionPlan?.student_limit || 0

const { count: currentStudentsCount, error: countError } = await supabase
  .from('students')
  .select('id', { count: 'exact', head: true })
  .eq('school_id', schoolId)

if (countError) {
  showMessage('Não foi possível verificar a quantidade atual de alunos.')
  return
}

if ((currentStudentsCount || 0) >= studentLimit) {
  showMessage(
    `Limite do plano atingido (${studentLimit} alunos).`
  )
  return
}

  const normalizedEmail = studentEmail.trim().toLowerCase()
  const qrCodeToken = crypto.randomUUID().replace(/-/g, '')

  try {
    let profilePhotoPath: string | null = null

const photoToUpload = photoOverride || studentPhoto

if (photoToUpload) {
  profilePhotoPath = await uploadStudentProfilePhoto(photoToUpload, schoolId)
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
      showMessage(`Erro ao cadastrar aluno: ${error.message}`)
      return
    }

    showMessage('Aluno(a) cadastrado com sucesso.')
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
    showMessage(`Erro ao cadastrar aluno: ${errorMessage}`)
  }
}

async function handleCreateStudentsBatch(batchStudents: BatchStudentInput[]) {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  if (!canManage) {
    showMessage('Você não tem permissão para cadastrar alunos.')
    return
  }

  const validStudents = batchStudents
    .map((student) => ({
      full_name: student.full_name.trim(),
      email: student.email.trim().toLowerCase(),
      birth_date: student.birth_date,
      responsible_email: student.responsible_email.trim().toLowerCase(),
      responsible_whatsapp: student.responsible_whatsapp.trim(),
    }))
    .filter((student) => student.full_name && student.email && student.birth_date)

  if (validStudents.length === 0) {
    showMessage('Preencha pelo menos um aluno válido.')
    return
  }

  const { data: subscriptionData, error: subscriptionError } = await supabase
    .from('school_subscriptions')
    .select(`
      plan_id,
      subscription_plans (
        student_limit
      )
    `)
    .eq('school_id', schoolId)
    .single()

  if (subscriptionError || !subscriptionData) {
    showMessage('Não foi possível verificar o plano da escola.')
    return
  }

  const subscriptionPlan = Array.isArray(subscriptionData.subscription_plans)
    ? subscriptionData.subscription_plans[0]
    : subscriptionData.subscription_plans as unknown as {
        student_limit: number
      } | null

  const studentLimit = subscriptionPlan?.student_limit || 0

const { count: currentStudentsCount, error: countError } = await supabase
  .from('students')
  .select('id', { count: 'exact', head: true })
  .eq('school_id', schoolId)

if (countError) {
  showMessage('Não foi possível verificar a quantidade atual de alunos.')
  return
}

const availableSlots = studentLimit - (currentStudentsCount || 0)

  if (availableSlots <= 0) {
    showMessage(`Limite do plano atingido (${studentLimit} alunos).`)
    return
  }

  if (validStudents.length > availableSlots) {
    showMessage(
      `Seu plano permite cadastrar apenas mais ${availableSlots} aluno(s).`
    )
    return
  }

  const rows = validStudents.map((student) => ({
    name: student.full_name,
    full_name: student.full_name,
    email: student.email || null,
    birth_date: student.birth_date,
    school_id: schoolId,
    profile_photo_path: null,
    qr_code_token: crypto.randomUUID().replace(/-/g, ''),
    responsible_email: student.responsible_email || null,
    responsible_whatsapp: student.responsible_whatsapp || null,
  }))

  const { error } = await supabase
    .from('students')
    .insert(rows)

  if (error) {
    showMessage(`Erro ao cadastrar alunos em lote: ${error.message}`)
    return
  }

  await fetchStudents()

  showMessage(`${validStudents.length} aluno(s) cadastrado(s) com sucesso.`)
}

async function handleDeleteStudent(studentId: string) {
  if (!schoolId) {
    showMessage('Escola não identificada.')
    return
  }

  const { error: enrollmentError } = await supabase
    .from('enrollments')
    .delete()
    .eq('student_id', studentId)
    .eq('school_id', schoolId)

  if (enrollmentError) {
    showMessage(`Erro ao remover matrícula: ${enrollmentError.message}`)
    return
  }

  const { error: studentError } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId)
    .eq('school_id', schoolId)

  if (studentError) {
    showMessage(`Erro ao deletar aluno: ${studentError.message}`)
    return
  }

  await fetchEnrollments()
  await fetchStudents()

  showMessage('Aluno deletado com sucesso.')
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
      showMessage('Você não tem permissão para cadastrar ano letivo.')
      return
    }

    if (!yearValue.trim()) {
      showMessage('Informe o ano letivo.')
      return
    }

    const parsedYear = Number(yearValue)

    if (Number.isNaN(parsedYear)) {
      showMessage('O ano letivo precisa ser numérico.')
      return
    }

    const { error } = await supabase.from('school_years').insert({
      year: parsedYear,
      school_id: schoolId,
    })

    if (error) {
      showMessage(`Erro ao cadastrar ano letivo: ${error.message}`)
      return
    }

    setYearValue('')
    await fetchSchoolYears()
    showMessage('Ano letivo cadastrado com sucesso.')
  }

  async function handleCreateClass() {
    if (!canManage) {
      showMessage('Você não tem permissão para cadastrar turma.')
      return
    }

    if (!className.trim()) {
      showMessage('Informe o nome da turma.')
      return
    }

    if (!selectedYearId) {
      showMessage('Selecione um ano letivo.')
      return
    }

    const { error } = await supabase.from('classes').insert({
      name: className,
      school_id: schoolId,
      year_id: selectedYearId,
    })

    if (error) {
      showMessage(`Erro ao cadastrar turma: ${error.message}`)
      return
    }

    setClassName('')
    setSelectedYearId('')
    await fetchClasses()
    showMessage('Turma cadastrada com sucesso.')
  }

  async function handleCreateTeacher() {
    if (!canManage) {
      showMessage('Você não tem permissão para cadastrar professor.')
      return
    }

    if (!teacherName.trim() || !teacherEmail.trim()) {
      showMessage('Preencha nome e e-mail do professor.')
      return
    }

    showMessage('Cadastrando professor...')

    const normalizedEmail = teacherEmail.trim().toLowerCase()

    const { error } = await supabase.from('teachers').insert({
      full_name: teacherName.trim(),
      email: normalizedEmail,
      school_id: schoolId,
    })

    if (error) {
      if (error.message.toLowerCase().includes('duplicate key')) {
        showMessage('Já existe um professor com esse e-mail nesta escola.')
      } else {
        showMessage(`Erro ao cadastrar professor: ${error.message}`)
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
      showMessage(`Professor cadastrado, mas houve erro ao criar convite: ${invitationError.message}`)
      await fetchTeachers()
      return
    }

    setTeacherName('')
    setTeacherEmail('')
    await fetchTeachers()
    showMessage('Professor cadastrado com sucesso.')
  }

  async function handleDeleteTeacher(teacherId: string) {
  if (!isAdmin) {
    showMessage('Apenas administradores podem deletar professores.')
    return
  }

  const confirmDelete = window.confirm(
    'Tem certeza que deseja deletar este professor?'
  )

  if (!confirmDelete) return

  const { error } = await supabase
    .from('teachers')
    .delete()
    .eq('id', teacherId)
    .eq('school_id', schoolId)

  if (error) {
    showMessage(`Erro ao deletar professor: ${error.message}`)
    return
  }

  setTeachers((prev) =>
    prev.filter((teacher) => teacher.id !== teacherId)
  )

  showMessage('Professor deletado com sucesso.')
}

  async function handleCreateManager() {
    if (!canManage) {
      showMessage('Você não tem permissão para cadastrar gestor.')
      return
    }

    if (!managerName.trim() || !managerEmail.trim() || !managerArea.trim()) {
      showMessage('Preencha nome, e-mail e área do gestor.')
      return
    }

    showMessage('Cadastrando gestor...')

    const normalizedEmail = managerEmail.trim().toLowerCase()

    const { error } = await supabase.from('managers').insert({
      full_name: managerName.trim(),
      email: normalizedEmail,
      area: managerArea,
      school_id: schoolId,
    })

    if (error) {
      if (error.message.toLowerCase().includes('duplicate key')) {
        showMessage('Já existe um gestor com esse e-mail nesta escola.')
      } else {
        showMessage(`Erro ao cadastrar gestor: ${error.message}`)
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
      showMessage(`Gestor cadastrado, mas houve erro ao criar convite: ${invitationError.message}`)
      await fetchManagers()
      return
    }

    setManagerName('')
    setManagerEmail('')
    setManagerArea('')
    await fetchManagers()
    showMessage('Gestor cadastrado com sucesso.')
  }

  async function handleDeleteManager(managerId: string) {
  if (!isAdmin) {
    showMessage('Apenas administradores podem deletar gestores.')
    return
  }

  const confirmDelete = window.confirm(
    'Tem certeza que deseja deletar este gestor?'
  )

  if (!confirmDelete) return

  const { error } = await supabase
    .from('managers')
    .delete()
    .eq('id', managerId)
    .eq('school_id', schoolId)

  if (error) {
    showMessage(`Erro ao deletar gestor: ${error.message}`)
    return
  }

  setManagers((prev) =>
    prev.filter((manager) => manager.id !== managerId)
  )

  showMessage('Gestor deletado com sucesso.')
}

  async function handleEnrollStudent(
  studentId: string,
  classId: string,
  yearId: string
) {
  if (!canManage) {
    showMessage('Você não tem permissão para matricular aluno.')
    return
  }

  if (!yearId) {
    showMessage('Selecione o ano letivo.')
    return
  }

  if (!studentId || !classId) {
    showMessage('Selecione aluno e turma.')
    return
  }

  const { error } = await supabase.from('enrollments').insert({
    student_id: studentId,
    class_id: classId,
    school_id: schoolId,
    year_id: yearId,
  })

  if (error) {
    if (
      error.message.includes('enrollments_unique_student_class') ||
      error.message.toLowerCase().includes('duplicate key')
    ) {
      showMessage('Esse aluno já está matriculado nessa turma.')
    } else {
      showMessage(`Erro ao matricular: ${error.message}`)
    }
    return
  }

  await fetchEnrollments()
  await fetchStudents()
  showMessage('Aluno matriculado com sucesso.')
}
function showMessage(text: string) {
  setMessage(text)

  setTimeout(() => {
    setMessage('')
  }, 2500)
}

async function handleMoveEnrollment(
  enrollmentId: string,
  targetClassId: string
) {
  if (!canManage) {
    showMessage('Você não tem permissão para mover aluno.')
    return
  }

  if (!enrollmentId || !targetClassId) {
    showMessage('Selecione o aluno e a nova turma.')
    return
  }

  const { error } = await supabase
    .from('enrollments')
    .update({
      class_id: targetClassId,
    })
    .eq('id', enrollmentId)
    .eq('school_id', schoolId)

  if (error) {
    showMessage(`Erro ao mover aluno: ${error.message}`)
    return
  }

  await fetchEnrollments()
  await fetchStudents()
  showMessage('Aluno movido com sucesso.')
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
  gap: 4,
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
  appearance: 'none',
  WebkitAppearance: 'none',
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
  flexWrap: isMobile ? 'wrap' : 'nowrap',
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
  alignItems: 'center',
  justifyContent: isMobile ? 'flex-start' : 'flex-end',
  marginLeft: 'auto',
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

const unreadCount = absenceAlerts.filter(
  (alert) => !readNotifications.includes(getAlertId(alert))
).length

const studentClassMap = useMemo(() => {
  const map: Record<string, { class_id: string; class_name: string | null }> = {}

  enrollments.forEach((enrollment) => {
    const schoolClass = classes.find((item) => item.id === enrollment.class_id)

    map[enrollment.student_id] = {
      class_id: enrollment.class_id,
      class_name: schoolClass?.name || null,
    }
  })

  return map
}, [enrollments, classes])

    if (loading) {
    return (
      <main style={dashboardPageStyle}>
        <div style={dashboardLoadingWrapStyle}>
          <div style={dashboardLoadingCardStyle}>Carregando painel da escola...</div>
        </div>
      </main>
    )
  }

function handleChangeSection(
  section:
    | 'overview'
    | 'registrations'
    | 'students'
    | 'classes'
    | 'class-map'
    | 'attendance'
    | 'reports'
    | 'rankings'
    | 'assessments'
    | 'plans'
) {
  setActiveSection(section)

  if (section === 'rankings') {
  fetchAnnualRankingRecords()
}

  if (isMobile) {
    setSidebarOpen(false)
  }
}

  return (
    <main style={dashboardPageStyle}>
      {isMobile && sidebarOpen && (
  <div
    onClick={() => setSidebarOpen(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      zIndex: 90,
    }}
  />
)}
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
            
<div>
  <img
    src="/logoteste.png"
    alt="Logo"
style={{
  width: logoSize + 20,
  height: logoSize + 20,
  objectFit: 'contain',
  display: 'block',
  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
}}
  />
</div>

            <div>
              <div style={dashboardBrandTitleStyle}>
  <span style={schoolTextStyle}>School</span>
  <span style={osTextStyle}>OS</span>
</div>
            </div>
          </div>

          <div style={dashboardSidebarSectionTitleStyle}>Navegação</div>

          <div style={dashboardNavListStyle}>
  <button
    onClick={() => handleChangeSection('overview')}
    style={
      activeSection === 'overview'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Visão geral
  </button>

  <button
    onClick={() => handleChangeSection('registrations')}
    style={
      activeSection === 'registrations'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Cadastros
  </button>
  <button
  onClick={() => handleChangeSection('students')}
  style={
    activeSection === 'students'
      ? dashboardNavButtonActiveStyle
      : dashboardNavButtonStyle
  }
>
  Alunos
</button>
  <button
  onClick={() => handleChangeSection('classes')}
  style={
    activeSection === 'classes'
      ? dashboardNavButtonActiveStyle
      : dashboardNavButtonStyle
  }
    >
  Turmas
    </button>

    {(isAdmin || isManager) && (
  <button
    onClick={() => handleChangeSection('class-map')}
    style={
      activeSection === 'class-map'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Mapa de Turma
  </button>
)}

  <button
    onClick={() => handleChangeSection('attendance')}
    style={
      activeSection === 'attendance'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Presença
  </button>

  <button
    onClick={() => handleChangeSection('reports')}
    style={
      activeSection === 'reports'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Relatórios
  </button>

  <button
  onClick={() => handleChangeSection('rankings')}
  style={
    activeSection === 'rankings'
      ? dashboardNavButtonActiveStyle
      : dashboardNavButtonStyle
  }
>
  Rankings
</button>

  <button
  onClick={() => handleChangeSection('assessments')}
  style={
    activeSection === 'assessments'
      ? dashboardNavButtonActiveStyle
      : dashboardNavButtonStyle
  }
    >
    Avaliações
    </button>
    {isAdmin && (
  <button
    onClick={() => handleChangeSection('plans')}
    style={
      activeSection === 'plans'
        ? dashboardNavButtonActiveStyle
        : dashboardNavButtonStyle
    }
  >
    Planos
  </button>
)}
</div>

          <div style={dashboardSidebarFooterStyle}>
{(isAdmin || isManager) && (
  <button
    onClick={() => router.push(`/school/${schoolId}/perfil`)}
    style={{
      ...dashboardUserMiniCardStyle,
      width: '100%',
      cursor: 'pointer',
      textAlign: 'left',
    }}
  >
<div style={dashboardUserMiniAvatarStyle}>
  {avatarUrl ? (
    <img
      src={avatarUrl}
      alt="Foto"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 14,
        objectFit: 'cover',
      }}
    />
  ) : (
    (userRole || 'U').slice(0, 1).toUpperCase()
  )}
</div>

    <div>
      <div style={dashboardUserMiniNameStyle}>
        {userRole || 'Usuário'}
      </div>

      <div style={dashboardUserMiniRoleStyle}>
        {isManager && userArea ? `Área: ${userArea}` : 'Acesso escolar'}
      </div>
    </div>
  </button>
)}
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

              <div
  style={{
    ...dashboardHeroActionsStyle,
    alignSelf: isMobile ? 'flex-start' : 'flex-start',
  }}
>
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
                                                  {(isAdmin || isManager) && (
  <button
    onClick={prepareExistingProfilePhotoEmbeddings}
    disabled={preparingFaceEmbeddings}
    style={dashboardSecondaryButtonStyle}
  >
    {preparingFaceEmbeddings
      ? 'Preparando facial...'
      : 'Preparar fotos faciais'}
  </button>
)}

{faceEmbeddingProgress && (
  <div style={dashboardMessageStyle}>
    {faceEmbeddingProgress}
  </div>
)}

                <button
                  onClick={handleLogout}
                  style={dashboardPrimaryButtonStyle}
                >
                  Sair
                </button>
                <div style={{ position: 'relative' }}>
  <button
    onClick={() => setNotificationsOpen((prev) => !prev)}
    style={{
      position: 'relative',
      padding: '12px 14px',
      borderRadius: 14,
      border: 'none',
      background: '#ffffff',
      cursor: 'pointer',
      fontSize: 18,
      boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
    }}
  >
    🔔

    {unreadCount > 0 && (
      <span
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          padding: '4px 8px',
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {unreadCount}
      </span>
    )}
  </button>
</div>
{notificationsOpen && (
  <div
    style={{
      position: 'absolute',
      right: 0,
      top: 50,
      width: 320,
      maxHeight: 400,
      overflowY: 'auto',
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      zIndex: 999,
    }}
  >
    {/* HEADER */}
<div
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px 14px',
    borderBottom: '1px solid #e2e8f0',
  }}
>
  <div>
    <div
      style={{
        fontWeight: 800,
        color: '#0f172a',
      }}
    >
      Notificações
    </div>

    {unreadCount > 0 && (
      <button
        onClick={markAllNotificationsAsRead}
        style={{
          marginTop: 4,
          border: 'none',
          background: 'transparent',
          color: '#2563eb',
          fontWeight: 800,
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Marcar todas como lidas
      </button>
    )}
  </div>

  <button
    onClick={() => setNotificationsOpen(false)}
    style={{
      border: 'none',
      background: 'transparent',
      fontSize: 18,
      cursor: 'pointer',
      color: '#64748b',
      fontWeight: 900,
    }}
  >
    ✕
  </button>
</div>

    {/* LISTA */}
    <div style={{ padding: 10 }}>
      {absenceAlerts.length === 0 ? (
        <div style={{ color: '#64748b' }}>
          Sem notificações
        </div>
      ) : (
absenceAlerts.map((alert) => {
  const isRead = readNotifications.includes(getAlertId(alert))

  return (
    <div
      key={`${alert.studentId}-${alert.classId}-${alert.alertType}`}
onClick={() => {
  markNotificationAsRead(alert)
  setSelectedNotification(alert)
}}
      style={{
        padding: 10,
        borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer',
        opacity: isRead ? 0.5 : 1,
        background: isRead ? '#f8fafc' : '#ffffff',
      }}
    >
    <div style={{ fontWeight: 800, color: '#0f172a' }}>
      {alert.studentName}
    </div>

    <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
      {alert.className}
    </div>
    </div>
  )
})
      )}
    </div>
  </div>
)}
              </div>
            </div>

          </section>

          {activeSection === 'overview' && (
  <section style={dashboardStatsGridStyle}>
    <div style={dashboardStatCardStyle}>
      <div style={dashboardStatIconBlueStyle}>👨‍🎓</div>
      <div>
        <div style={dashboardStatLabelStyle}>Alunos</div>
<div
  style={{
    ...dashboardStatValueStyle,
    fontSize: studentsLoading ? 16 : 34,
    fontWeight: studentsLoading ? 600 : 900,
  }}
>
  {studentsLoading ? 'Carregando...' : students.length}
</div>
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
  onClick={() => handleSendAlertWhatsapp(alert)}
  style={dashboardWhatsappButtonStyle}
>
  Enviar WhatsApp
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
  students={students.map((student) => ({
    ...student,
    class_name: studentClassMap[student.id]?.class_name || 'Sem turma',
  }))}
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
            handleCreateStudentsBatch={handleCreateStudentsBatch}
          />

          <div style={dashboardSectionSpacerStyle} />

          <EnrollmentsSection
  handleEnrollStudent={handleEnrollStudent}
  handleMoveEnrollment={handleMoveEnrollment}
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
            handleDeleteTeacher={handleDeleteTeacher}
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
            handleDeleteManager={handleDeleteManager}
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

{activeSection === 'students' && (isAdmin || isManager) && (
  <section style={dashboardMainGridStyle}>
    <div style={dashboardMainColumnStyle}>
      <section style={dashboardCardStyle}>
        <div style={dashboardCardHeaderStyle}>
          <div>
            <div style={dashboardCardEyebrowStyle}>Alunos</div>
            <h2 style={dashboardCardTitleStyle}>Alunos cadastrados</h2>
            <p style={dashboardCardTextStyle}>
              Consulte, filtre, imprima QR Codes e visualize os dados completos dos alunos.
            </p>
          </div>
        </div>

<StudentsListSection
  schoolId={schoolId}
  students={students.map((student) => ({
    ...student,
    class_name: studentClassMap[student.id]?.class_name || 'Sem turma',
  }))}
  classes={classes}
  schoolYears={schoolYears}
  enrollments={enrollments}
  onEnrollStudent={handleEnrollStudent}
  onUpdateStudent={handleUpdateStudent}
  onDeleteStudent={handleDeleteStudent}
  onMoveEnrollment={handleMoveEnrollment}
/>
      </section>
    </div>
  </section>
)}

{activeSection === 'classes' && currentUserId && userRole && (
<ClassesAreaSection
  schoolId={schoolId}
  userId={currentUserId}
  userEmail={currentUserEmail}
  role={userRole}
  students={students}
  classes={classes}
  enrollments={enrollments}
  showMessage={showMessage}
/>
)}

{activeSection === 'class-map' && (isAdmin || isManager) && (
  <ClassMapSection
    schoolId={schoolId}
    schoolName={schoolName}
    classes={classes}
    students={students}
    enrollments={enrollments}
    showMessage={showMessage}
  />
)}

{activeSection === 'reports' && (
  <section style={{ display: 'block' }}>
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
            schoolId={schoolId}
            schoolName={schoolName}
            students={students.map((student) => ({
  id: student.id,
  full_name: student.full_name || student.name || 'Aluno sem nome',
  name: student.name || student.full_name || 'Aluno sem nome',
  responsible_whatsapp: student.responsible_whatsapp || null,
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
            loading={reportLoading || studentsLoading}
            isSubscriptionActive={isSubscriptionActive}
            showMessage={showMessage}
            earlyExits={earlyExits}
          />

          <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handlePrintAttendanceReport}
              style={dashboardSecondaryButtonStyle}
            >
              Imprimir relatório
            </button>
          </div>
        </section>
      )}
      {(isAdmin || isManager) && (
  <section style={dashboardCardStyle}>
    <div style={dashboardCardHeaderStyle}>
      <div>
        <div style={dashboardCardEyebrowStyle}>Relatórios</div>
        <h2 style={dashboardCardTitleStyle}>Ocorrências</h2>
        <p style={dashboardCardTextStyle}>
          Consulte as ocorrências registradas por turma, aluno, situação e período.
        </p>
      </div>
    </div>

    <OccurrenceReportsSection
      students={students.map((student) => ({
  id: student.id,
  full_name: student.full_name || student.name || 'Aluno sem nome',
  name: student.name || student.full_name || 'Aluno sem nome',
  responsible_whatsapp: student.responsible_whatsapp || null,
}))}
      classes={classes}
      occurrences={occurrenceRecords}
      loading={occurrenceLoading}
      startDate={occurrenceStartDate}
      setStartDate={setOccurrenceStartDate}
      endDate={occurrenceEndDate}
      setEndDate={setOccurrenceEndDate}
      selectedClassId={occurrenceClassId}
      setSelectedClassId={setOccurrenceClassId}
      selectedStudentId={occurrenceStudentId}
      setSelectedStudentId={setOccurrenceStudentId}
      selectedSituation={occurrenceSituation}
      setSelectedSituation={setOccurrenceSituation}
      onGenerate={handleGenerateOccurrenceReport}
      onDeleteOccurrence={handleDeleteOccurrence}
    />
    <div style={{ marginTop: 14 }}>
  <button
    onClick={handlePrintOccurrenceReport}
    style={dashboardSecondaryButtonStyle}
    disabled={occurrenceRecords.length === 0}
  >
    Imprimir relatório de ocorrências
  </button>
</div>
  </section>
)}
    </div>
  </section>
)}

{activeSection === 'rankings' && (isAdmin || isManager) && (
  <section style={dashboardCardStyle}>
    <div style={dashboardCardHeaderStyle}>
      <div>
        <div style={dashboardCardEyebrowStyle}>Frequência</div>
        <h2 style={dashboardCardTitleStyle}>Ranking escolar</h2>
        <p style={dashboardCardTextStyle}>
          Ranking anual de frequência dos alunos no ano letivo atual.
        </p>
      </div>
    </div>

    <AttendanceFrequencyRanking
  students={students}
  ranking={annualRankingData}
  schoolYears={schoolYears}
  classes={classes}
  schoolName={school?.name || 'SchoolOS'}
/>
  </section>
)}

{activeSection === 'assessments' && (
  isSubscriptionActive ? (
    <AssessmentsSection
      isAdmin={isAdmin}
      isManager={isManager}
      isTeacher={userRole === 'professor'}
      schoolId={schoolId}
      currentUserId={currentUserId}
      classes={classes}
      schoolName={schoolName}
      students={students.map((student) => ({
        id: student.id,
        name:
          student.full_name ||
          student.name ||
          'Aluno sem nome',

        full_name:
          student.full_name ||
          student.name ||
          'Aluno sem nome',

        qr_code_token:
          student.qr_code_token || null,

        class_id:
          studentClassMap[student.id]?.class_id ||
          null,

        class_name:
          studentClassMap[student.id]?.class_name ||
          null,
      }))}
    />
  ) : (
    <div
      style={{
        padding: 28,
        borderRadius: 28,
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        color: '#9a3412',
        fontWeight: 700,
        lineHeight: 1.7,
      }}
    >
      Sua assinatura está inativa.
      Regularize o pagamento para continuar utilizando
      o módulo de avaliações.
    </div>
  )
)}
{activeSection === 'plans' && isAdmin && (
  <PlansSection
    schoolId={schoolId}
    currentStudents={students.length}
    showMessage={showMessage}
  />
)}
        </section>
      </div>

      {selectedNotification && (
  <div
    onClick={() => setSelectedNotification(null)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      zIndex: 9998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 460,
        background: '#ffffff',
        borderRadius: 24,
        padding: 24,
        boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Alerta de faltas
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 24,
              color: '#0f172a',
              fontWeight: 900,
              lineHeight: 1.1,
            }}
          >
            {selectedNotification.studentName}
          </h2>
        </div>

        <button
          onClick={() => setSelectedNotification(null)}
          style={{
            border: 'none',
            background: '#f1f5f9',
            width: 36,
            height: 36,
            borderRadius: 12,
            cursor: 'pointer',
            fontWeight: 900,
            color: '#334155',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ color: '#475569', fontWeight: 700, marginBottom: 8 }}>
        Turma: {selectedNotification.className}
      </div>

      <div style={{ color: '#475569', fontWeight: 700, marginBottom: 14 }}>
        Datas: {selectedNotification.absentDates.map(formatDateBR).join(', ')}
      </div>

      <div
        style={{
          display: 'inline-flex',
          padding: '8px 12px',
          borderRadius: 999,
          background: '#fee2e2',
          color: '#b91c1c',
          fontWeight: 900,
          fontSize: 13,
          marginBottom: 20,
        }}
      >
        {selectedNotification.alertType === 'three_consecutive_absences'
          ? '3 faltas consecutivas'
          : '3 faltas em 15 dias'}
      </div>

      <button
        onClick={() => handleSendAlertWhatsapp(selectedNotification)}
        style={{
          ...dashboardWhatsappButtonStyle,
          width: '100%',
        }}
      >
        Enviar WhatsApp
      </button>
    </div>
  </div>
)}

      {message && (
  <div
    style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#0f172a',
      color: '#ffffff',
      padding: '16px 24px',
      borderRadius: 16,
      fontWeight: 800,
      fontSize: 16,
      zIndex: 9999,
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      textAlign: 'center',
      maxWidth: 360,
      width: 'calc(100% - 48px)',
      animation: 'fadeIn 0.4s ease',
    }}
  >
    {message}
  </div>
)}
<a
  href="https://wa.me/5588921826192?text=Olá!%20Tenho%20dúvidas%20sobre%20o%20SchoolOS."
  target="_blank"
  rel="noopener noreferrer"
  style={{
    position: 'fixed',
    left: isMobile ? 16 : 24,
    bottom: isMobile ? 16 : 24,
    zIndex: 9999,
    width: isMobile ? 56 : 62,
    height: isMobile ? 56 : 62,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #25D366, #16a34a)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    boxShadow: '0 18px 40px rgba(37, 211, 102, 0.35)',
    border: '1px solid rgba(255,255,255,0.18)',
    transition: 'transform 0.2s ease',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'scale(1.08)'
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'scale(1)'
  }}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={isMobile ? 28 : 32}
    height={isMobile ? 28 : 32}
    viewBox="0 0 24 24"
    fill="#ffffff"
  >
    <path d="M20.52 3.48A11.78 11.78 0 0012.04 0C5.52 0 .24 5.28.24 11.76c0 2.08.56 4.12 1.6 5.92L0 24l6.52-1.72a11.8 11.8 0 005.52 1.4h.04c6.48 0 11.76-5.28 11.76-11.76 0-3.12-1.2-6.04-3.32-8.44zm-8.48 18.2a9.8 9.8 0 01-5-1.36l-.36-.2-3.88 1.04 1.04-3.8-.24-.4a9.78 9.78 0 01-1.52-5.2c0-5.4 4.4-9.8 9.84-9.8 2.6 0 5.08 1 6.92 2.88a9.7 9.7 0 012.88 6.92c0 5.44-4.4 9.84-9.84 9.84zm5.4-7.36c-.28-.16-1.68-.84-1.92-.92-.28-.12-.44-.16-.64.16-.2.28-.72.92-.88 1.12-.16.2-.32.24-.6.08-.28-.16-1.16-.44-2.2-1.4-.8-.72-1.36-1.64-1.52-1.92-.16-.28-.04-.44.12-.6.12-.12.28-.32.4-.48.12-.16.16-.28.24-.48.08-.16.04-.36-.04-.52-.08-.16-.64-1.56-.88-2.12-.24-.6-.48-.52-.64-.52h-.56c-.2 0-.52.08-.8.36-.28.28-1.04 1-.96 2.4.08 1.4 1 2.76 1.16 2.96.16.2 2 3.08 4.88 4.2.68.28 1.24.44 1.68.56.72.24 1.36.2 1.88.12.56-.08 1.68-.68 1.92-1.36.24-.64.24-1.24.16-1.36-.08-.08-.24-.16-.52-.28z"/>
  </svg>
  <span
  style={{
    fontSize: 10,
    fontWeight: 700,
    color: '#ffffff',
    lineHeight: 1,
  }}
>
  Dúvidas?
</span>
</a>
    </main>
  )
}

const schoolTextStyle: React.CSSProperties = {
  color: '#0f2a5c', // azul escuro mais elegante
  fontWeight: 900,
  letterSpacing: 0.5,
  textShadow: '0 2px 6px rgba(0,0,0,0.08)',
}

const osTextStyle: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: 0.5,
  background: 'linear-gradient(135deg, #facc15, #eab308, #d97706)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  textShadow: '0 2px 6px rgba(0,0,0,0.08)',
}