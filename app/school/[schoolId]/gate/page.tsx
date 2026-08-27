'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRScanner from '@/components/QRScanner'
import AttendanceSection from '@/components/AttendanceSection'
import { offlineAttendanceDb } from '@/lib/offlineAttendanceDb'
import AppButton from '@/components/AppButton'
import FacialScanner from '@/components/FacialScanner'
import {
  generateFaceEmbeddingFromBlob,
  calculateFaceDistance,
  loadFaceModels,
} from '@/lib/faceRecognition'

type ScanResult = {
  status: 'success' | 'duplicate' | 'error'
  message: string
  student?: {
    name: string
    className: string
    photo: string | null
  }
  time?: string
}

type PendingFacialCapture = {
  blob: Blob
  capturedAt: string
}

type PendingFacialConfirmation = {
  candidate: any
  capturedAt: string
}

type GateMode =
  | 'entry'
  | 'regular_exit'
  | 'early_exit'

export default function GatePage() {
  const params = useParams<{ schoolId: string }>()
  const router = useRouter()
  const schoolId = params.schoolId

  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('Escola')
  const [isScannerActive, setIsScannerActive] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [manualQrCode, setManualQrCode] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [gateMode, setGateMode] =
  useState<GateMode>('entry')
  const [readingMethod, setReadingMethod] = useState<'qr' | 'facial'>('qr')
  const audioContextRef = useRef<AudioContext | null>(null)
  const [loadingOffline, setLoadingOffline] = useState(false)
const [loadingSync, setLoadingSync] = useState(false)
const [closingGateMode, setClosingGateMode] = useState(false)

const [manualStudentId, setManualStudentId] = useState('')
const [manualStudentSearch, setManualStudentSearch] = useState('')
const [manualStudents, setManualStudents] = useState<any[]>([])

const [facialCandidates, setFacialCandidates] = useState<any[]>([])
const [facialPhotosLoading, setFacialPhotosLoading] = useState(false)
const [facialConfirmationResult, setFacialConfirmationResult] = useState<ScanResult | null>(null)
const [pendingFacialEmbedding, setPendingFacialEmbedding] = useState<number[] | null>(null)

const [
  pendingFacialCapture,
  setPendingFacialCapture,
] = useState<PendingFacialCapture | null>(null)

const [
  pendingFacialConfirmation,
  setPendingFacialConfirmation,
] = useState<PendingFacialConfirmation | null>(null)

const [facialConfirming, setFacialConfirming] =
  useState(false)

const [
  nextReadCountdown,
  setNextReadCountdown,
] = useState<number | null>(null)  

const [
  facialStandby,
  setFacialStandby,
] = useState(false)

const [
  standbyOffset,
  setStandbyOffset,
] = useState({
  x: 0,
  y: 0,
})

const [
  currentTime,
  setCurrentTime,
] = useState(
  new Date().toLocaleTimeString(
    'pt-BR'
  )
)

const [
  currentDate,
  setCurrentDate,
] = useState(
  new Date().toLocaleDateString(
    'pt-BR',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  )
)

const facialRestartTimeoutRef =
  useRef<ReturnType<typeof setTimeout> | null>(null) 

const regularExitQrProcessingRef =
  useRef(false)

const regularExitQrRestartTimeoutRef =
  useRef<ReturnType<typeof setTimeout> | null>(null)

function changeGateMode(
  nextMode: GateMode
) {
  setFacialStandby(false)
  if (
    facialRestartTimeoutRef.current
  ) {
    clearTimeout(
      facialRestartTimeoutRef.current
    )

    facialRestartTimeoutRef.current =
      null
  }
  setNextReadCountdown(null)
  if (
  regularExitQrRestartTimeoutRef.current
) {
  clearTimeout(
    regularExitQrRestartTimeoutRef.current
  )

  regularExitQrRestartTimeoutRef.current =
    null
}

  setIsScannerActive(false)
  setManualMode(false)
  setManualStudentId('')
  setManualStudentSearch('')

  setFacialCandidates([])
  setFacialConfirmationResult(null)
  setPendingFacialConfirmation(null)
  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)

  setScanResult(null)
  setGateMode(nextMode)

  /*
 * Todos os modos começam pelo QR Code.
 * Entrada e saída normal também permitem
 * alternar para reconhecimento facial.
 */
setReadingMethod('qr')
}

const [facialEnabled, setFacialEnabled] = useState(false)

const [
  regularExitEnabled,
  setRegularExitEnabled,
] = useState(false)

const facialProcessingRef = useRef(false)

const facialEmbeddingsCacheRef = useRef<any[]>([])
const facialEmbeddingsLoadedRef = useRef(false)

const facialStudentsCacheRef = useRef<Map<string, any>>(new Map())
const facialStudentsLoadedRef = useRef(false)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [resultAnimationKey, setResultAnimationKey] = useState(0)

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

  const [pendingExitStudent, setPendingExitStudent] = useState<{
  id: string
  school_id: string
  full_name: string
  class_id: string
  class_name: string
  profile_photo_path: string | null
  photoUrl: string | null
  responsible_whatsapp: string | null
} | null>(null)

const [exitReason, setExitReason] = useState('')
const [otherExitReason, setOtherExitReason] = useState('')
const [authorizedByName, setAuthorizedByName] = useState('')
const [todayEarlyExits, setTodayEarlyExits] = useState<any[]>([])
const [facialCameraMode, setFacialCameraMode] = useState<'user' | 'environment'>('user')

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
    ].slice(0, 12))
  }

async function downloadOfflineData() {
  if (loadingOffline) {
    setResultWithTimeout({
      status: 'duplicate',
      message: 'A atualização offline já está em andamento.',
    })
    return
  }

  setLoadingOffline(true)

  setResultWithTimeout({
    status: 'success',
    message: 'Atualizando dados offline para leitura por QR Code...',
  })

  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        class_id,
        students (
          id,
          full_name,
          school_id,
          profile_photo_path,
          qr_code_token,
          responsible_whatsapp
        ),
        classes (
          id,
          name
        )
      `)
      .eq('school_id', schoolId)

    if (error) {
      setResultWithTimeout({
        status: 'error',
        message: error.message,
      })
      return
    }

    const offlineStudents = (data || [])
      .map((item: any) => {
        const student = Array.isArray(item.students)
          ? item.students[0]
          : item.students

        const schoolClass = Array.isArray(item.classes)
          ? item.classes[0]
          : item.classes

        if (!student?.qr_code_token || !schoolClass?.id) return null

        return {
          id: student.id,
          school_id: student.school_id,
          full_name: student.full_name,
          qr_code_token: student.qr_code_token,
          profile_photo_path: student.profile_photo_path || null,
          class_id: schoolClass.id,
          class_name: schoolClass.name || 'Sem turma',
          responsible_whatsapp: student.responsible_whatsapp || null,
        }
      })
      .filter(Boolean)

    await offlineAttendanceDb.students.clear()
    await offlineAttendanceDb.students.bulkPut(offlineStudents as any[])

    setResultWithTimeout({
      status: 'success',
      message: `Dados offline de QR Code atualizados. Alunos: ${offlineStudents.length}.`,
    })
  } catch (error) {
    console.error('ERRO AO ATUALIZAR DADOS OFFLINE:', error)

    setResultWithTimeout({
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Erro ao atualizar dados offline.',
    })
  } finally {
    setLoadingOffline(false)
  }
}

useEffect(() => {
  const interval =
    setInterval(() => {
      setCurrentTime(
        new Date()
          .toLocaleTimeString(
            'pt-BR',
            {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }
          )
      )

      setCurrentDate(
        new Date()
          .toLocaleDateString(
            'pt-BR',
            {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }
          )
      )
    }, 1000)

  return () =>
    clearInterval(interval)
}, [])

useEffect(() => {
  if (!facialStandby) {
    return
  }

  const interval =
    setInterval(() => {
      setStandbyOffset({
        x:
          Math.floor(
            Math.random() * 21
          ) - 10,

        y:
          Math.floor(
            Math.random() * 21
          ) - 10,
      })
    }, 60000)

  return () =>
    clearInterval(interval)
}, [facialStandby])

useEffect(() => {
  async function loadManualStudents() {
    if (!manualMode || manualStudentSearch.trim().length < 3) {
      setManualStudents([])
      return
    }

    const search = manualStudentSearch.trim().toLowerCase()

    const results = await offlineAttendanceDb.students
      .filter(
        (student) =>
          student.school_id === schoolId &&
          student.full_name.toLowerCase().includes(search)
      )
      .limit(20)
      .toArray()

    setManualStudents(results)
  }

  loadManualStudents()
}, [manualMode, manualStudentSearch, schoolId])

async function fetchSubscription() {
  const { data, error } = await supabase
    .from('school_subscriptions')
    .select(`
      plan_id,
      status,
      facial_enabled,
      student_limit,
      current_period_end,
      expires_at,
      updated_at
    `)
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .maybeSingle()

  console.log('[SUBSCRIPTION]', { data, error })

  if (error) {
    setFacialEnabled(false)
    return false
  }

  const enabled = Boolean(data?.facial_enabled)

  setFacialEnabled(enabled)

  return enabled
}

async function fetchRegularExitAddon() {
  const { data, error } =
    await supabase
      .from(
        'school_addon_subscriptions'
      )
      .select(`
        status,
        addon_code,
        student_limit,
        current_period_start,
        current_period_end
      `)
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'addon_code',
        'regular_exit_photo_whatsapp'
      )
      .eq(
        'status',
        'active'
      )
      .maybeSingle()

  if (error) {
    console.error(
      '[ADICIONAL SAÍDA] erro ao consultar assinatura:',
      error
    )

    setRegularExitEnabled(false)

    return false
  }

  const startTime =
    data?.current_period_start
      ? new Date(
          data.current_period_start
        ).getTime()
      : Number.NaN

  const endTime =
    data?.current_period_end
      ? new Date(
          data.current_period_end
        ).getTime()
      : Number.NaN

  const studentLimit =
    Number(
      data?.student_limit || 0
    )

  const now =
    Date.now()

  const enabled =
    Boolean(
      data &&
        data.status ===
          'active' &&
        studentLimit > 0 &&
        Number.isFinite(
          startTime
        ) &&
        Number.isFinite(
          endTime
        ) &&
        startTime <= now &&
        endTime > now
    )

  console.log(
    '[ADICIONAL SAÍDA]',
    {
      data,
      enabled,
    }
  )

  setRegularExitEnabled(
    enabled
  )

  return enabled
}

async function handleManualAttendance() {
  if (!manualStudentId) {
    setResultWithTimeout({
      status: 'error',
      message: 'Selecione um aluno para registrar a presença.',
    })
    return
  }

  const student = await offlineAttendanceDb.students.get(manualStudentId)

  if (!student) {
    setResultWithTimeout({
      status: 'error',
      message: 'Aluno não encontrado nos dados offline.',
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

  const now = new Date()
  const attendanceDate = now.toISOString().split('T')[0]

  const existing = await offlineAttendanceDb.attendance
    .where('student_id')
    .equals(student.id)
    .filter(
      (record) =>
        record.school_id === schoolId &&
        record.class_id === student.class_id &&
        record.attendance_date === attendanceDate
    )
    .first()

  if (existing) {
    setResultWithTimeout({
      status: 'duplicate',
      message: 'Presença já registrada hoje.',
      student: {
        name: student.full_name,
        className: student.class_name,
        photo: null,
      },
      time: new Date(existing.recorded_at).toLocaleTimeString(),
    })
    return
  }

  await offlineAttendanceDb.attendance.add({
    id: crypto.randomUUID(),
    school_id: schoolId,
    student_id: student.id,
    class_id: student.class_id,
    attendance_date: attendanceDate,
    status: 'present',
    source: 'manual',
    recorded_at: now.toISOString(),
    synced: false,
  })

  setResultWithTimeout({
    status: 'success',
    message: 'Presença manual registrada com sucesso.',
    student: {
      name: student.full_name,
      className: student.class_name,
      photo: null,
    },
    time: now.toLocaleTimeString(),
  })

  setManualStudentId('')
  setManualStudentSearch('')
  setManualMode(false)
}

async function handleOfflineScan(text: string) {
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

  const student = await offlineAttendanceDb.students
    .where('qr_code_token')
    .equals(token)
    .first()

  if (!student) {
    setResultWithTimeout({
      status: 'error',
      message: 'Aluno não encontrado no dispositivo.',
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

  const now = new Date()
  const attendanceDate = now.toISOString().split('T')[0]

  let photoUrl: string | null = null

if (navigator.onLine && student.profile_photo_path) {
  const { data } = await supabase.storage
    .from('student-profile-photos')
    .createSignedUrl(student.profile_photo_path, 3600)

  photoUrl = data?.signedUrl || null
}

  const existing = await offlineAttendanceDb.attendance
    .where('[student_id+class_id+attendance_date]' as any)
    .equals([student.id, student.class_id, attendanceDate] as any)
    .first()
    .catch(async () => {
      const all = await offlineAttendanceDb.attendance
        .where('student_id')
        .equals(student.id)
        .toArray()

      return all.find(
        (record) =>
          record.class_id === student.class_id &&
          record.attendance_date === attendanceDate
      )
    })

  if (existing) {
    setResultWithTimeout({
      status: 'duplicate',
      message: 'Presença já registrada hoje neste dispositivo.',
      student: {
        name: student.full_name,
        className: student.class_name,
        photo: photoUrl,
      },
      time: new Date(existing.recorded_at).toLocaleTimeString(),
    })
    return
  }

  const localRecord = {
    id: crypto.randomUUID(),
    school_id: schoolId,
    student_id: student.id,
    class_id: student.class_id,
    attendance_date: attendanceDate,
    status: 'present' as const,
    source: 'qr' as const,
    recorded_at: now.toISOString(),
    synced: false,
  }

  await offlineAttendanceDb.attendance.add(localRecord)

  setResultWithTimeout({
    status: 'success',
    message: navigator.onLine
      ? 'Presença salva no dispositivo. Será sincronizada.'
      : 'Presença salva offline no dispositivo.',
    student: {
      name: student.full_name,
      className: student.class_name,
      photo: photoUrl,
    },
    time: now.toLocaleTimeString(),
  })
}

async function handleRegularExitQrScan(
  text: string
) {
  if (
    regularExitQrProcessingRef.current
  ) {
    return
  }

  if (!text?.trim()) {
    setResultWithTimeout({
      status: 'error',
      message:
        'Código QR inválido.',
    })

    return
  }

  if (
    !text.startsWith(
      'schoolos:student:'
    )
  ) {
    setResultWithTimeout({
      status: 'error',
      message:
        'Este QR Code não pertence a um aluno.',
    })

    return
  }

  if (!navigator.onLine) {
    setResultWithTimeout({
      status: 'error',
      message:
        'A saída normal por QR Code precisa de internet.',
    })

    return
  }

  const token = text
    .replace(
      'schoolos:student:',
      ''
    )
    .trim()

  const student =
    await offlineAttendanceDb.students
      .where('qr_code_token')
      .equals(token)
      .first()

  if (!student) {
    setResultWithTimeout({
      status: 'error',
      message:
        'Aluno não encontrado nos dados da portaria. Atualize os dados offline.',
    })

    return
  }

  if (
    student.school_id !== schoolId
  ) {
    setResultWithTimeout({
      status: 'error',
      message:
        'Aluno não pertence a esta escola.',
    })

    return
  }

  regularExitQrProcessingRef.current =
    true

  setIsScannerActive(false)

  let photoUrl: string | null =
    null

  try {
    photoUrl =
      await getStudentPhotoUrl(
        student
      )

    const {
      data: { session },
    } =
      await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error(
        'Usuário não autenticado.'
      )
    }

    const capturedAt =
      new Date().toISOString()

    const formData =
      new FormData()

    formData.append(
      'schoolId',
      schoolId
    )

    formData.append(
      'studentId',
      student.id
    )

    formData.append(
      'classId',
      student.class_id
    )

    formData.append(
      'capturedAt',
      capturedAt
    )

    formData.append(
      'source',
      'qr'
    )

    /*
     * Nenhuma foto é enviada pelo tablet.
     *
     * O endpoint copiará a foto atual do
     * perfil do aluno para o bucket privado.
     */
    const response = await fetch(
      '/api/gate/confirm-facial-regular-exit',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },

        body: formData,
      }
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
      throw new Error(
        data.error ||
          'Erro ao registrar saída normal.'
      )
    }

    const resultTime =
      data.exitTime ||
      new Date(
        data.capturedAt ||
          capturedAt
      ).toLocaleTimeString(
        'pt-BR'
      )

    const warning =
      typeof data.warning ===
        'string' &&
      data.warning.trim()
        ? ` ${data.warning.trim()}`
        : ''

    const result: ScanResult =
      data.duplicate
        ? {
            status:
              'duplicate',

            message:
              `${student.full_name} já possui saída normal registrada hoje.`,

            student: {
              name:
                student.full_name,

              className:
                student.class_name,

              photo:
                photoUrl,
            },

            time:
              resultTime,
          }
        : {
            status:
              'success',

            message:
              `Saída normal registrada com sucesso.${warning}`,

            student: {
              name:
                student.full_name,

              className:
                student.class_name,

              photo:
                photoUrl,
            },

            time:
              resultTime,
          }

    setResultWithTimeout(
      result,
      true,
      false
    )
  } catch (error) {
    console.error(
      '[SAÍDA NORMAL QR] erro:',
      error
    )

    setResultWithTimeout(
      {
        status: 'error',

        message:
          error instanceof Error
            ? error.message
            : 'Erro ao registrar saída por QR Code.',

        student: {
          name:
            student.full_name,

          className:
            student.class_name,

          photo:
            photoUrl,
        },
      },
      true,
      false
    )
  } finally {
    regularExitQrProcessingRef.current =
      false

    restartRegularExitQrScanner()
  }
}

async function handleEarlyExitScan(text: string) {
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

  const student = await offlineAttendanceDb.students
    .where('qr_code_token')
    .equals(token)
    .first()

  if (!student) {
    setResultWithTimeout({
      status: 'error',
      message: 'Aluno não encontrado no dispositivo.',
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

  const today = new Date().toISOString().split('T')[0]

let todayAttendance = await offlineAttendanceDb.attendance
  .where('student_id')
  .equals(student.id)
  .filter(
    (record) =>
      record.school_id === schoolId &&
      record.class_id === student.class_id &&
      record.attendance_date === today &&
      record.status === 'present'
  )
  .first()

if (!todayAttendance && navigator.onLine) {
  const { data } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('school_id', schoolId)
    .eq('student_id', student.id)
    .eq('class_id', student.class_id)
    .eq('attendance_date', today)
    .eq('status', 'present')
    .maybeSingle()

  if (data) {
    todayAttendance = data as any
  }
}

if (!todayAttendance) {
  setResultWithTimeout({
    status: 'error',
    message:
      'Saída não permitida. Este aluno ainda não possui entrada/presença registrada hoje.',
    student: {
      name: student.full_name,
      className: student.class_name,
      photo: null,
    },
  })
  return
}

const alreadyExitedToday = await offlineAttendanceDb.earlyExits
  .where('student_id')
  .equals(student.id)
  .filter(
    (exit) =>
      exit.exit_date === today &&
      exit.school_id === schoolId
  )
  .first()

if (alreadyExitedToday) {
  setResultWithTimeout({
    status: 'duplicate',
    message: `Saída já registrada hoje às ${alreadyExitedToday.exit_time}.`,
    student: {
      name: student.full_name,
      className: student.class_name,
      photo: null,
    },
  })
  return
}

  let photoUrl: string | null = null

  if (navigator.onLine && student.profile_photo_path) {
    const { data } = await supabase.storage
      .from('student-profile-photos')
      .createSignedUrl(student.profile_photo_path, 3600)

    photoUrl = data?.signedUrl || null
  }

  setPendingExitStudent({
    id: student.id,
    school_id: student.school_id,
    full_name: student.full_name,
    class_id: student.class_id,
    class_name: student.class_name,
    profile_photo_path: student.profile_photo_path,
    photoUrl,
    responsible_whatsapp: student.responsible_whatsapp || null,
  })

  setExitReason('')
  setOtherExitReason('')
  setAuthorizedByName('')
}

async function confirmEarlyExit() {
  if (!pendingExitStudent) return

  const finalReason =
    exitReason === 'Outro' ? otherExitReason.trim() : exitReason

  if (!finalReason) {
    setResultWithTimeout({
      status: 'error',
      message: 'Informe o motivo da saída.',
    })
    return
  }

  const now = new Date()
  const exitDate = now.toISOString().split('T')[0]

  await offlineAttendanceDb.earlyExits.add({
    id: crypto.randomUUID(),
    school_id: schoolId,
    student_id: pendingExitStudent.id,
    class_id: pendingExitStudent.class_id,
    exit_date: exitDate,
    exit_time: now.toLocaleTimeString(),
    reason: finalReason,
    authorized_by_name: authorizedByName.trim() || null,
    responsible_contact: null,
    recorded_at: now.toISOString(),
    synced: false,
  })

  await loadTodayEarlyExits()

if (navigator.onLine) {
  await syncEarlyExits()
}

const rawPhone = pendingExitStudent.responsible_whatsapp?.replace(/\D/g, '')

if (rawPhone) {
  const phone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`

  const message = encodeURIComponent(
    `Olá! Informamos que o(a) aluno(a) ${pendingExitStudent.full_name}, da turma ${pendingExitStudent.class_name}, registrou saída antecipada da escola às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}. Motivo: ${finalReason}.`
  )

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
}

  setResultWithTimeout({
    status: 'success',
    message: `Saída registrada: ${finalReason}`,
    student: {
      name: pendingExitStudent.full_name,
      className: pendingExitStudent.class_name,
      photo: pendingExitStudent.photoUrl,
    },
    time: now.toLocaleTimeString(),
  })

  setPendingExitStudent(null)
  setExitReason('')
  setOtherExitReason('')
  setAuthorizedByName('')
}

async function handleGateScan(
  text: string
) {
  if (gateMode === 'entry') {
    await handleOfflineScan(text)
    return
  }

  if (
    gateMode === 'regular_exit'
  ) {
    await handleRegularExitQrScan(
      text
    )

    return
  }

  await handleEarlyExitScan(text)
}

async function loadTodayEarlyExits() {
  const today = new Date().toISOString().split('T')[0]

  const exits = await offlineAttendanceDb.earlyExits
    .where('exit_date')
    .equals(today)
    .reverse()
    .sortBy('recorded_at')

  const exitsWithStudents = await Promise.all(
    exits.map(async (exit) => {
      const student = await offlineAttendanceDb.students.get(exit.student_id)

      return {
        ...exit,
        student_name: student?.full_name || 'Aluno não encontrado',
        class_name: student?.class_name || 'Turma não encontrada',
      }
    })
  )

  setTodayEarlyExits(exitsWithStudents.reverse())
}

async function syncOfflineAttendance() {
  if (loadingSync) return

  setLoadingSync(true)

  try {
    if (!navigator.onLine) {
      setResultWithTimeout({
        status: 'error',
        message:
          'Sem internet. A sincronização será feita quando a conexão voltar.',
      })

      return
    }

    const pendingRecords =
      await offlineAttendanceDb.attendance
        .filter(
          (record) =>
            record.synced === false
        )
        .toArray()

    if (pendingRecords.length === 0) {
      await syncEarlyExits()

      setResultWithTimeout({
        status: 'success',
        message:
          'Sincronização verificada. Não há presenças pendentes.',
      })

      return
    }

    const {
      data: { session },
      error: sessionError,
    } =
      await supabase.auth.getSession()

    if (
      sessionError ||
      !session?.access_token ||
      !session.user
    ) {
      setResultWithTimeout({
        status: 'error',
        message:
          'Sessão expirada. Entre novamente para sincronizar as presenças.',
      })

      return
    }

    let syncedCount = 0
    let whatsappQueuedCount = 0
    let warningCount = 0

    const synchronizationErrors:
      string[] = []

    for (
      const record of pendingRecords
    ) {
      /*
       * Entradas por QR Code utilizam o
       * novo endpoint, que também cria:
       *
       * - comprovante;
       * - foto privada;
       * - fila do WhatsApp.
       */
      if (record.source === 'qr') {
        try {
          const response = await fetch(
            '/api/gate/sync-qr-arrival',
            {
              method: 'POST',

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,

                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                schoolId:
                  record.school_id,

                studentId:
                  record.student_id,

                classId:
                  record.class_id,

                attendanceDate:
                  record.attendance_date,

                recordedAt:
                  record.recorded_at,
              }),
            }
          )

          const data =
            await response
              .json()
              .catch(() => ({}))

          if (!response.ok) {
            const errorMessage =
              typeof data.error ===
                'string'
                ? data.error
                : 'Erro ao sincronizar entrada por QR Code.'

            console.error(
              '[SINCRONIZAÇÃO QR]',
              {
                recordId:
                  record.id,

                studentId:
                  record.student_id,

                status:
                  response.status,

                error:
                  errorMessage,
              }
            )

            synchronizationErrors.push(
              errorMessage
            )

            /*
             * Não marca como sincronizado.
             * Na próxima tentativa, o endpoint
             * idempotente retomará o processo.
             */
            continue
          }

          await offlineAttendanceDb
            .attendance
            .update(
              record.id,
              {
                synced: true,
              }
            )

          syncedCount++

          if (
            data.whatsappQueued ===
            true
          ) {
            whatsappQueuedCount++
          }

          if (
            typeof data.warning ===
              'string' &&
            data.warning.trim()
          ) {
            warningCount++

            console.warn(
              '[SINCRONIZAÇÃO QR] aviso:',
              data.warning
            )
          }

          console.log(
            '[SINCRONIZAÇÃO QR] concluída:',
            {
              recordId:
                record.id,

              studentId:
                record.student_id,

              duplicate:
                data.duplicate,

              addonEligible:
                data.addonEligible,

              evidenceSaved:
                data.evidenceSaved,

              whatsappQueued:
                data.whatsappQueued,

              whatsappStatus:
                data.whatsappStatus,

              queueId:
                data.queueId,
            }
          )
        } catch (error) {
          console.error(
            '[SINCRONIZAÇÃO QR] erro de rede:',
            error
          )

          synchronizationErrors.push(
            error instanceof Error
              ? error.message
              : 'Erro de comunicação durante a sincronização QR.'
          )
        }

        continue
      }

      /*
       * Presenças manuais continuam usando
       * o funcionamento atual e não geram
       * foto nem mensagem automática.
       */
      try {
        const {
          data:
            existingAttendance,

          error:
            existingError,
        } = await supabase
          .from(
            'attendance_records'
          )
          .select('id, status')
          .eq(
            'school_id',
            record.school_id
          )
          .eq(
            'student_id',
            record.student_id
          )
          .eq(
            'class_id',
            record.class_id
          )
          .eq(
            'attendance_date',
            record.attendance_date
          )
          .maybeSingle()

        if (existingError) {
          synchronizationErrors.push(
            existingError.message
          )

          continue
        }

        if (existingAttendance) {
          const {
            error:
              updateError,
          } = await supabase
            .from(
              'attendance_records'
            )
            .update({
              status:
                'present',

              source:
                record.source,

              recorded_by_user_id:
                session.user.id,

              updated_at:
                record.recorded_at,
            })
            .eq(
              'id',
              existingAttendance.id
            )

          if (updateError) {
            synchronizationErrors.push(
              updateError.message
            )

            continue
          }
        } else {
          const {
            error:
              insertError,
          } = await supabase
            .from(
              'attendance_records'
            )
            .insert({
              school_id:
                record.school_id,

              student_id:
                record.student_id,

              class_id:
                record.class_id,

              attendance_date:
                record.attendance_date,

              status:
                'present',

              source:
                record.source,

              recorded_by_user_id:
                session.user.id,

              created_at:
                record.recorded_at,

              updated_at:
                record.recorded_at,
            })

          if (insertError) {
            synchronizationErrors.push(
              insertError.message
            )

            continue
          }
        }

        await offlineAttendanceDb
          .attendance
          .update(
            record.id,
            {
              synced: true,
            }
          )

        syncedCount++
      } catch (error) {
        console.error(
          '[SINCRONIZAÇÃO MANUAL] erro:',
          error
        )

        synchronizationErrors.push(
          error instanceof Error
            ? error.message
            : 'Erro ao sincronizar presença manual.'
        )
      }
    }

    await syncEarlyExits()

    const messageParts = [
      `Registros sincronizados: ${syncedCount}.`,
    ]

    if (
      whatsappQueuedCount > 0
    ) {
      messageParts.push(
        `Mensagens de chegada enfileiradas: ${whatsappQueuedCount}.`
      )
    }

    if (warningCount > 0) {
      messageParts.push(
        `Avisos: ${warningCount}.`
      )
    }

    if (
      synchronizationErrors.length >
      0
    ) {
      messageParts.push(
        `Pendentes por erro: ${synchronizationErrors.length}. Uma nova tentativa será feita posteriormente.`
      )
    }

    setResultWithTimeout({
      status:
        synchronizationErrors.length >
        0
          ? 'error'
          : 'success',

      message:
        messageParts.join(' '),
    })
  } finally {
    setLoadingSync(false)
  }
}

async function syncEarlyExits() {
  setLoadingSync(true)

  try {
    if (!navigator.onLine) {
      setResultWithTimeout({
        status: 'error',
        message:
          'Sem internet. As saídas serão sincronizadas quando a conexão voltar.',
      })
      return
    }

    const pendingExits = await offlineAttendanceDb.earlyExits
      .filter((record) => record.synced === false)
      .toArray()

    if (pendingExits.length === 0) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let syncedCount = 0

    for (const exit of pendingExits) {
      const { error } = await supabase
        .from('student_early_exits')
        .insert({
          id: exit.id,
          school_id: exit.school_id,
          student_id: exit.student_id,
          class_id: exit.class_id,
          exit_date: exit.exit_date,
          exit_time: exit.exit_time,
          reason: exit.reason,
          authorized_by_name: exit.authorized_by_name,
          responsible_contact: exit.responsible_contact,
          recorded_at: exit.recorded_at,
          recorded_by_user_id: user?.id || null,
        })

      if (!error) {
        await offlineAttendanceDb.earlyExits.update(exit.id, {
          synced: true,
        })

        syncedCount++
      }
    }

    if (syncedCount > 0) {
      setResultWithTimeout({
        status: 'success',
        message: `Saídas sincronizadas: ${syncedCount}`,
      })
    }
  } finally {
    setLoadingSync(false)
  }
}


function playScanSound(status: 'success' | 'duplicate' | 'error') {
  try {
    const ctx = audioContextRef.current
    if (!ctx) return

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'

    if (status === 'success') {
      oscillator.frequency.value = 880
    } else if (status === 'duplicate') {
      oscillator.frequency.value = 520
    } else {
      oscillator.frequency.value = 220
    }

    gainNode.gain.setValueAtTime(0.12, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.18
    )

    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.18)
  } catch {
    // ignora
  }
}
function ResponsiveStyles() {
  return (
    <style jsx global>{`
      @keyframes scanPop {
        0% {
          transform: scale(0.92);
          opacity: 0;
        }
        60% {
          transform: scale(1.03);
          opacity: 1;
        }
        100% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes scannerPulse {
        0% {
          box-shadow: 0 0 0 rgba(37, 99, 235, 0);
        }
        50% {
          box-shadow: 0 0 34px rgba(37, 99, 235, 0.35);
        }
        100% {
          box-shadow: 0 0 0 rgba(37, 99, 235, 0);
        }
      }

      * {
        box-sizing: border-box;
      }

      #reader {
        width: 100% !important;
      }

     #reader video {
  width: 100% !important;
  max-height: 52vh;
  object-fit: cover;
}

@media (max-width: 1024px) {
  .gate-grid {
    grid-template-columns: 1fr !important;
  }

  .top-bar {
    align-items: flex-start !important;
  }
}

@media (max-width: 640px) {
  .gate-page {
    padding: 12px !important;
  }

  #reader video {
    max-height: 38vh;
  }

  .result-card {
    position: sticky;
    bottom: 8px;
    z-index: 20;
  }

  .top-bar,
  .scanner-card,
  .result-card {
    border-radius: 20px !important;
    padding: 16px !important;
  }
}

        .top-bar {
          flex-direction: column !important;
        }

        .top-bar button {
          width: 100% !important;
        }

        .scanner-actions {
          width: 100% !important;
          flex-direction: column !important;
        }

        .scanner-actions button {
          width: 100% !important;
        }

        h1 {
          font-size: 30px !important;
        }

        h2 {
          font-size: 22px !important;
        }

        input,
        button {
          width: 100%;
        }
      }
    `}</style>
  )
}

  function setResultWithTimeout(
  data: ScanResult,
  playSound = true,
  autoHide = true
) {
  setScanResult(data)
  setResultAnimationKey((prev) => prev + 1)

  if (playSound) {
    playScanSound(data.status)
  }

  pushRecentScan({
    status: data.status,
    message: data.message,
    studentName: data.student?.name,
    className: data.student?.className,
    photo: data.student?.photo,
    time: data.time || new Date().toLocaleTimeString(),
  })

  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }

  if (autoHide) {
    timeoutRef.current = setTimeout(() => {
      setScanResult(null)
    }, 5000)
  }
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
      .select('role')
      .eq('user_id', user.id)
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      router.replace('/access')
      return false
    }

    if (!['admin', 'gestor', 'professor'].includes(data.role)) {
      router.replace(`/school/${schoolId}`)
      return false
    }

    return true
  }

  async function fetchSchoolName() {
    const { data } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .maybeSingle()

    setSchoolName(data?.name || 'Escola')
  }

  async function initializeAttendanceForToday() {
    const today = new Date().toISOString().split('T')[0]

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('student_id, class_id')
      .eq('school_id', schoolId)

    if (enrollmentsError) {
      setResultWithTimeout({
        status: 'error',
        message: enrollmentsError.message,
      })
      return false
    }

    if (!enrollments || enrollments.length === 0) {
      setResultWithTimeout({
        status: 'error',
        message: 'Nenhuma matrícula encontrada.',
      })
      return false
    }

    const { data: existingRecords, error: existingError } = await supabase
      .from('attendance_records')
      .select('student_id, class_id')
      .eq('school_id', schoolId)
      .eq('attendance_date', today)

    if (existingError) {
      setResultWithTimeout({
        status: 'error',
        message: existingError.message,
      })
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
      const { error } = await supabase
        .from('attendance_records')
        .insert(missingRecords)

      if (error) {
        setResultWithTimeout({
          status: 'error',
          message: error.message,
        })
        return false
      }
    }

    return true
  }

async function handleStartReading() {
  /*
   * A inicialização das faltas/presenças
   * pertence ao fluxo de entrada.
   */
  if (gateMode === 'entry') {
    const initialized =
      await initializeAttendanceForToday()

    if (!initialized) return
  }

  if (
  gateMode === 'regular_exit'
) {
  /*
   * Tanto QR Code quanto facial da
   * saída normal dependem do backend.
   */
  if (!navigator.onLine) {
    setResultWithTimeout({
      status: 'error',
      message:
        'A saída normal precisa de internet.',
    })

    return
  }

  /*
   * Consulta novamente antes de iniciar.
   * Isso impede usar um estado antigo caso
   * o adicional tenha vencido enquanto a
   * página da portaria permaneceu aberta.
   */
  const addonAvailable =
    await fetchRegularExitAddon()

  if (!addonAvailable) {
    setResultWithTimeout({
      status: 'error',
      message:
        'A escola não possui o adicional de saída normal ativo ou o período de vigência terminou.',
    })

    return
  }

  if (
    readingMethod === 'facial'
  ) {
    await loadFacialEmbeddingsFromSupabase(
      false
    )

    await loadFacialStudentsFromSupabase(
      false
    )
  }
}

  if (gateMode === 'early_exit') {
    setReadingMethod('qr')
  }

  if (!audioContextRef.current) {
    const AudioContextClass =
      window.AudioContext ||
      (window as any).webkitAudioContext

    const ctx =
      new AudioContextClass()

    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    audioContextRef.current = ctx
  }

  setManualMode(false)

/*
 * Entrada por reconhecimento facial
 * começa pela tela de standby.
 *
 * A câmera somente será aberta quando
 * o usuário tocar em "Registrar chegada".
 */
if (
  gateMode === 'entry' &&
  readingMethod === 'facial'
) {
  setFacialCandidates([])
  setFacialConfirmationResult(null)
  setPendingFacialConfirmation(null)
  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)

  setIsScannerActive(false)
  setFacialStandby(true)

  return
}

setFacialStandby(false)
setIsScannerActive(true)
}

  async function handleStopReading() {
  setFacialStandby(false)  
  setIsScannerActive(false)

  setResultWithTimeout({
    status: 'success',
    message: 'Leitura encerrada.',
  })
}

  async function handleCloseGateMode() {
  if (closingGateMode) return

  setClosingGateMode(true)
  setFacialStandby(false)
  setIsScannerActive(false)
  setManualMode(false)

  try {
    if (navigator.onLine) {
      await syncOfflineAttendance()
    } else {
      setResultWithTimeout({
        status: 'error',
        message:
          'Sem internet. As presenças ficaram salvas no dispositivo e serão sincronizadas quando a conexão voltar.',
      })
    }

    router.push(`/school/${schoolId}`)
  } finally {
    setClosingGateMode(false)
  }
}

  function handleNoCamera() {
  setIsScannerActive(false)

  if (gateMode === 'entry') {
    setManualMode(true)
    return
  }

  setManualMode(false)

  setResultWithTimeout({
    status: 'error',
    message:
  gateMode === 'regular_exit'
    ? readingMethod === 'facial'
      ? 'Não foi possível acessar a câmera para o reconhecimento facial da saída.'
      : 'Não foi possível acessar a câmera para ler o QR Code da saída.'
    : 'Não foi possível acessar a câmera para ler o QR Code.',
  })
}

  async function getStudentPhotoUrl(student: any) {
  if ((student as any).profile_photo_data_url) {
    return (student as any).profile_photo_data_url
  }

  if (!navigator.onLine || !student.profile_photo_path) {
    return null
  }

  const { data } = await supabase.storage
    .from('student-profile-photos')
    .createSignedUrl(student.profile_photo_path, 3600)

  return data?.signedUrl || null
}

async function loadFacialEmbeddingsFromSupabase(forceReload = false) {
  if (facialEmbeddingsLoadedRef.current && !forceReload) {
    return facialEmbeddingsCacheRef.current
  }

  if (!navigator.onLine) {
    setResultWithTimeout({
      status: 'error',
      message: 'Sem internet. O reconhecimento facial funciona somente online.',
    })

    return []
  }

  const { data, error } = await supabase
    .from('student_face_embeddings')
    .select('id, school_id, student_id, class_id, embedding, source, profile_photo_path, created_at')
    .eq('school_id', schoolId)

  if (error) {
    console.error('[FACIAL ONLINE] erro ao carregar embeddings:', error)

    setResultWithTimeout({
      status: 'error',
      message: 'Erro ao carregar dados faciais do Supabase.',
    })

    return []
  }

  facialEmbeddingsCacheRef.current = data || []
  facialEmbeddingsLoadedRef.current = true

  console.log('[FACIAL ONLINE] embeddings carregados:', data?.length || 0)

  return facialEmbeddingsCacheRef.current
}

async function loadFacialStudentsFromSupabase(forceReload = false) {
  if (facialStudentsLoadedRef.current && !forceReload) {
    return facialStudentsCacheRef.current
  }

  if (!navigator.onLine) {
    return facialStudentsCacheRef.current
  }

  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      student_id,
      class_id,
      students (
        id,
        full_name,
        school_id,
        profile_photo_path,
        responsible_whatsapp
      ),
      classes (
        id,
        name
      )
    `)
    .eq('school_id', schoolId)

  if (error) {
    console.error('[FACIAL ONLINE] erro ao carregar alunos faciais:', error)
    return facialStudentsCacheRef.current
  }

  const studentsMap = new Map<string, any>()

  for (const item of data || []) {
    const student = Array.isArray((item as any).students)
      ? (item as any).students[0]
      : (item as any).students

    const schoolClass = Array.isArray((item as any).classes)
      ? (item as any).classes[0]
      : (item as any).classes

    if (!student?.id) continue

    studentsMap.set((item as any).student_id, {
      id: student.id,
      school_id: student.school_id,
      full_name: student.full_name,
      profile_photo_path: student.profile_photo_path || null,
      responsible_whatsapp: student.responsible_whatsapp || null,
      class_id: (item as any).class_id,
      class_name: schoolClass?.name || 'Sem turma',
    })
  }

  facialStudentsCacheRef.current = studentsMap
  facialStudentsLoadedRef.current = true

  console.log('[FACIAL ONLINE] alunos faciais em cache:', studentsMap.size)

  return facialStudentsCacheRef.current
}

const FACE_AUTO_SELECT_MAX_DISTANCE = 0.40
const FACE_AUTO_SELECT_MIN_GAP = 0.08

function shouldAutoSelectFaceCandidate(
  candidates: any[]
) {
  if (candidates.length === 0) {
    return false
  }

  const bestCandidate =
    candidates[0]

  if (
    typeof bestCandidate?.distance !==
      'number' ||
    bestCandidate.distance >
      FACE_AUTO_SELECT_MAX_DISTANCE
  ) {
    return false
  }

  const secondCandidate =
    candidates[1]

  /*
   * Existe apenas um candidato dentro do
   * limite geral e ele passou do limite
   * de alta confiança.
   */
  if (!secondCandidate) {
    return true
  }

  if (
    typeof secondCandidate.distance !==
      'number'
  ) {
    return false
  }

  const distanceGap =
    secondCandidate.distance -
    bestCandidate.distance

  return (
    distanceGap >=
    FACE_AUTO_SELECT_MIN_GAP
  )
}

  async function findFaceCandidates(embedding: number[]) {
  const allEmbeddings = await loadFacialEmbeddingsFromSupabase()

  const embeddingsToCompare = allEmbeddings.filter(
    (item) =>
      (
        item.source === 'profile_photo' ||
        item.source === 'capture' ||
        item.source === 'manual_average' ||
        item.source === 'imported_photo'
      ) &&
      item.embedding &&
      item.embedding.length === embedding.length
  )

  console.log(
    '[FACIAL] embeddings disponíveis:',
    embeddingsToCompare.map((item) => ({
      student_id: item.student_id,
      class_id: item.class_id,
      source: item.source,
    }))
  )

  const FACE_CANDIDATE_THRESHOLD = 0.75
  const MAX_CANDIDATES = 10

  const bestByStudent = new Map<string, any>()

  for (const stored of embeddingsToCompare) {
    const distance = calculateFaceDistance(embedding, stored.embedding)

    if (distance > FACE_CANDIDATE_THRESHOLD) continue

    const existing = bestByStudent.get(stored.student_id)

    if (!existing || distance < existing.distance) {
      bestByStudent.set(stored.student_id, {
        student_id: stored.student_id,
        class_id: stored.class_id,
        distance,
        source: stored.source,
      })
    }
  }

  const matches = Array.from(bestByStudent.values())
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_CANDIDATES)

  if (matches.length === 0) {
    return []
  }

  const studentsMap = await loadFacialStudentsFromSupabase(false)

const candidates = matches
  .map((match) => {
    const student = studentsMap.get(match.student_id)

    if (!student) return null

    return {
      ...match,
      student,
      photoUrl: null,
    }
  })
  .filter(Boolean)

  console.log(
    '[FACIAL DEBUG] candidatos completos:',
    candidates.map((candidate: any) => ({
      student_id: candidate.student_id,
      nome: candidate.student.full_name,
      turma: candidate.student.class_name,
      distance: candidate.distance,
      source: candidate.source,
    }))
  )

  return candidates
}

async function loadCandidatePhotos(candidates: any[]) {
  if (candidates.length === 0) return

  setFacialPhotosLoading(true)

  try {
    const updatedCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const photoUrl = await getStudentPhotoUrl(candidate.student)

        return {
          ...candidate,
          photoUrl,
        }
      })
    )

    setFacialCandidates(updatedCandidates)
  } finally {
    setFacialPhotosLoading(false)
  }
}

  async function handleFaceCapture(imageBlob: Blob) {
  if (facialProcessingRef.current) {
    console.log(
      '[FACIAL DEBUG] bloqueado: processamento já em andamento'
    )
    return false
  }

  facialProcessingRef.current = true

  try {
    console.log('[FACIAL DEBUG] iniciando processamento', {
      blobSize: imageBlob.size,
    })

    setResultWithTimeout({
      status: 'success',
      message: 'Procurando alunos parecidos...',
    })

    const embedding = await generateFaceEmbeddingFromBlob(imageBlob)

    console.log('[FACIAL DEBUG] embedding gerado:', embedding?.length)

    if (!embedding) {
      console.log('[FACIAL DEBUG] retorno false: embedding nulo')

      setResultWithTimeout({
        status: 'error',
        message: 'Nenhum rosto válido encontrado.',
      })

      return false
    }

    const capturedAt = new Date().toISOString()

setPendingFacialEmbedding(embedding)

setPendingFacialCapture({
  blob: imageBlob,
  capturedAt,
})

setPendingFacialConfirmation(null)

const candidates = await findFaceCandidates(embedding)

    console.log('[FACIAL DEBUG] candidatos encontrados:', candidates.length)

    if (candidates.length === 0) {
  console.log(
    '[FACIAL DEBUG] retorno false: nenhum candidato'
  )

  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)
  setPendingFacialConfirmation(null)

  setResultWithTimeout({
    status: 'error',
    message:
      'Rosto detectado, mas nenhum aluno semelhante foi encontrado. Tente novamente com melhor iluminação ou mais próximo da câmera.',
  })

  return false
}

    const shouldAutoSelect =
  shouldAutoSelectFaceCandidate(
    candidates
  )

if (shouldAutoSelect) {
  const bestCandidate =
    candidates[0]

  const secondCandidate =
    candidates.length > 1
      ? candidates[1]
      : null

  const photoUrl =
    await getStudentPhotoUrl(
      bestCandidate.student
    )

  const selectedCandidate = {
    ...bestCandidate,
    photoUrl,
  }

  console.log(
    '[FACIAL AUTO SELECT]',
    {
      student:
        bestCandidate.student
          .full_name,

      bestDistance:
        bestCandidate.distance,

      secondDistance:
        secondCandidate
          ?.distance ?? null,

      gap:
        secondCandidate
          ? secondCandidate.distance -
            bestCandidate.distance
          : null,
    }
  )

  setFacialCandidates([])

  setIsScannerActive(false)

  setPendingFacialConfirmation({
    candidate:
      selectedCandidate,

    capturedAt,
  })

  console.log(
    '[FACIAL DEBUG] retorno true: candidato selecionado automaticamente'
  )

  return true
}

setFacialCandidates(candidates)
setIsScannerActive(false)

loadCandidatePhotos(candidates)

console.log(
  '[FACIAL DEBUG] retorno true: candidatos exibidos'
)

return true
  } catch (error) {
  console.error(
    '[FACIAL DEBUG] erro no handleFaceCapture:',
    error
  )

  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)
  setPendingFacialConfirmation(null)

  setResultWithTimeout({
    status: 'error',
    message: 'Erro ao processar rosto.',
  })

  return false
  } finally {
    facialProcessingRef.current = false
  }
}

async function saveConfirmedFaceEmbedding(student: any) {
  if (!pendingFacialEmbedding) return

  if (!navigator.onLine) {
    setResultWithTimeout({
      status: 'error',
      message: 'Sem internet. Não foi possível salvar o reconhecimento facial.',
    })
    return
  }

  const now = new Date()
  const id = crypto.randomUUID()
  let photoOrder = 1

  const { data: supabaseCaptures, error: fetchError } = await supabase
    .from('student_face_embeddings')
    .select('id, photo_order, created_at')
    .eq('school_id', schoolId)
    .eq('student_id', student.id)
    .eq('source', 'capture')
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('[FACIAL APRENDIZADO] erro ao buscar capturas:', fetchError)

    setResultWithTimeout({
      status: 'error',
      message: 'Erro ao preparar salvamento facial.',
    })

    return
  }

  if (
  supabaseCaptures &&
  supabaseCaptures.length >= 10
) {
  const oldest =
    supabaseCaptures[0]

  photoOrder =
    oldest.photo_order || 1

  const {
    error: deleteError,
  } =
    await supabase
      .from(
        'student_face_embeddings'
      )
      .delete()
      .eq(
        'id',
        oldest.id
      )

  if (deleteError) {
    console.error(
      '[FACIAL APRENDIZADO] erro ao remover captura antiga:',
      deleteError
    )

    setResultWithTimeout({
      status: 'error',
      message:
        'Erro ao atualizar o histórico facial.',
    })

    return
  }

  /*
   * Remove imediatamente do cache
   * local o mesmo embedding apagado
   * do Supabase.
   */
  facialEmbeddingsCacheRef.current =
    facialEmbeddingsCacheRef.current
      .filter(
        (item) =>
          item.id !==
          oldest.id
      )
  } else {
    const usedOrders = new Set(
      (supabaseCaptures || []).map((item) => item.photo_order)
    )

    for (let i = 1; i <= 10; i++) {
      if (!usedOrders.has(i)) {
        photoOrder = i
        break
      }
    }
  }

  console.log('[FACIAL APRENDIZADO] salvando embedding', {
    student_id: student.id,
    source: 'capture',
    photoOrder,
  })

  const { error } = await supabase
    .from('student_face_embeddings')
    .insert({
      id,
      school_id: schoolId,
      student_id: student.id,
      class_id: student.class_id,
      embedding: pendingFacialEmbedding,
      source: 'capture',
      profile_photo_path: student.profile_photo_path || null,
      photo_order: photoOrder,
      created_at: now.toISOString(),
    })

  console.log('[FACIAL APRENDIZADO]', error)

  if (error) {
    setResultWithTimeout({
      status: 'error',
      message: 'Erro ao salvar embedding facial no Supabase.',
    })

    return
  }

  facialEmbeddingsCacheRef.current.push({
    id,
    school_id: schoolId,
    student_id: student.id,
    class_id: student.class_id,
    embedding: pendingFacialEmbedding,
    source: 'capture',
    profile_photo_path: student.profile_photo_path || null,
    created_at: now.toISOString(),
  })

  const cacheTrimResult =
  trimFacialCaptureCacheForStudent(
    student.id,
    10
  )

console.log(
  '[FACIAL CACHE] limpeza concluída:',
  {
    studentId:
      student.id,

    captureCount:
      cacheTrimResult
        .captureCount,

    removedCount:
      cacheTrimResult
        .removedCount,

    totalCacheCount:
      facialEmbeddingsCacheRef
        .current.length,
  }
)

  setPendingFacialEmbedding(null)
}

function trimFacialCaptureCacheForStudent(
  studentId: string,
  maxCaptures = 10
) {
  const cache =
    facialEmbeddingsCacheRef.current

  const studentCaptures =
    cache
      .filter(
        (item) =>
          item.student_id ===
            studentId &&
          item.source ===
            'capture'
      )
      .sort(
        (a, b) =>
          new Date(
            b.created_at || 0
          ).getTime() -
          new Date(
            a.created_at || 0
          ).getTime()
      )

  if (
    studentCaptures.length <=
    maxCaptures
  ) {
    return {
      removedCount: 0,
      captureCount:
        studentCaptures.length,
    }
  }

  /*
   * Mantém somente as capturas
   * mais recentes desse aluno.
   */
  const allowedIds =
    new Set(
      studentCaptures
        .slice(
          0,
          maxCaptures
        )
        .map(
          (item) =>
            item.id
        )
    )

  const beforeCount =
    cache.length

  facialEmbeddingsCacheRef.current =
    cache.filter(
      (item) => {
        /*
         * Não altera embeddings
         * de outros alunos.
         */
        if (
          item.student_id !==
          studentId
        ) {
          return true
        }

        /*
         * Não remove foto de perfil,
         * média manual, importação etc.
         */
        if (
          item.source !==
          'capture'
        ) {
          return true
        }

        return allowedIds.has(
          item.id
        )
      }
    )

  const afterCount =
    facialEmbeddingsCacheRef
      .current.length

  return {
    removedCount:
      beforeCount -
      afterCount,

    captureCount:
      Math.min(
        studentCaptures.length,
        maxCaptures
      ),
  }
}

function selectFacialCandidateForConfirmation(
  candidate: any
) {
  if (!pendingFacialCapture) {
    setResultWithTimeout({
      status: 'error',
      message:
        'A captura facial não está mais disponível. Faça uma nova leitura.',
    })

    setFacialCandidates([])
    setPendingFacialEmbedding(null)
    setPendingFacialConfirmation(null)
    setReadingMethod('facial')
    setIsScannerActive(true)

    return
  }

  setPendingFacialConfirmation({
    candidate,
    capturedAt:
      pendingFacialCapture.capturedAt,
  })
}

function restartFacialScannerAfterConfirmation() {
  if (facialRestartTimeoutRef.current) {
    clearTimeout(
      facialRestartTimeoutRef.current
    )

    facialRestartTimeoutRef.current = null
  }

  /*
   * O scanner permanece realmente desligado
   * durante toda a contagem.
   */
  setIsScannerActive(false)

  /*
   * A contagem só começa porque esta função
   * é chamada depois da confirmação ter sido
   * processada pelo backend.
   */
  setNextReadCountdown(6)
}

useEffect(() => {
  if (nextReadCountdown === null) {
    return
  }

  if (nextReadCountdown > 0) {
    const countdownTimeout =
      setTimeout(() => {
        setNextReadCountdown(
          (current) => {
            if (current === null) {
              return null
            }

            return Math.max(
              current - 1,
              0
            )
          }
        )
      }, 1000)

    return () => {
      clearTimeout(
        countdownTimeout
      )
    }
  }

  /*
   * nextReadCountdown === 0
   *
   * Mantém o zero na tela por aproximadamente
   * 200 ms antes de liberar outra leitura.
   */
  facialRestartTimeoutRef.current =
    setTimeout(() => {
      setFacialCandidates([])
      setFacialConfirmationResult(null)
      setPendingFacialConfirmation(null)
      setPendingFacialCapture(null)
      setPendingFacialEmbedding(null)

      setNextReadCountdown(null)

      setReadingMethod('facial')

if (
  gateMode === 'entry'
) {
  /*
   * Entrada volta para a tela
   * "Registrar chegada".
   */
  setIsScannerActive(false)
  setFacialStandby(true)
} else {
  /*
   * Mantém o funcionamento atual
   * da saída normal.
   */
  setIsScannerActive(true)
}

      facialRestartTimeoutRef.current =
        null
    }, 200)

  return () => {
    if (
      facialRestartTimeoutRef.current
    ) {
      clearTimeout(
        facialRestartTimeoutRef.current
      )

      facialRestartTimeoutRef.current =
        null
    }
  }
}, [
  nextReadCountdown,
  gateMode,
])

function restartRegularExitQrScanner() {
  if (
    regularExitQrRestartTimeoutRef.current
  ) {
    clearTimeout(
      regularExitQrRestartTimeoutRef.current
    )
  }

  setIsScannerActive(false)

  regularExitQrRestartTimeoutRef.current =
    setTimeout(() => {
      setReadingMethod('qr')
      setIsScannerActive(true)

      regularExitQrRestartTimeoutRef.current =
        null
    }, 2000)
}

async function confirmFacialCandidate(
  candidate: any
) {
  if (
    facialConfirming ||
    !pendingFacialCapture
  ) {
    return
  }

  const student = candidate?.student
  const isRegularExit =
  gateMode === 'regular_exit'

  if (!student) {
    setResultWithTimeout({
      status: 'error',
      message: 'Aluno não encontrado.',
    })

    return
  }

  if (gateMode === 'early_exit') {
  setResultWithTimeout({
    status: 'error',
    message:
      'A saída antecipada deve ser registrada pelo QR Code.',
  })

  return
}

  if (!navigator.onLine) {
    setResultWithTimeout({
      status: 'error',
      message:
        'Sem internet. O reconhecimento facial funciona somente online.',
    })

    return
  }

  setFacialConfirming(true)
  setIsScannerActive(false)

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error(
        'Usuário não autenticado.'
      )
    }

    const formData = new FormData()

    formData.append(
      'schoolId',
      schoolId
    )

    formData.append(
      'studentId',
      student.id
    )

    formData.append(
      'classId',
      student.class_id
    )

    formData.append(
      'capturedAt',
      pendingFacialCapture.capturedAt
    )

    if (isRegularExit) {
  formData.append(
    'source',
    'facial'
  )
}

    formData.append(
  'photo',
  pendingFacialCapture.blob,
  isRegularExit
    ? `saida-${student.id}.jpg`
    : `chegada-${student.id}.jpg`
)

    const endpoint = isRegularExit
  ? '/api/gate/confirm-facial-regular-exit'
  : '/api/gate/confirm-facial-attendance'

const response = await fetch(
  endpoint,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    )

    const data = await response
      .json()
      .catch(() => ({}))

    if (!response.ok) {
  throw new Error(
    data.error ||
      (
        isRegularExit
          ? 'Erro ao registrar saída normal.'
          : 'Erro ao registrar presença.'
      )
  )
}

    /*
     * Mantém o aprendizado facial atual.
     * O registro da presença já foi feito
     * pelo backend.
     */
    await saveConfirmedFaceEmbedding(student)

    const resultTime = new Date(
      data.capturedAt ||
        pendingFacialCapture.capturedAt
    ).toLocaleTimeString('pt-BR')

    const result: ScanResult =
  data.duplicate
    ? {
        status: 'duplicate',
        message: isRegularExit
          ? `${student.full_name} já possui saída normal registrada hoje.`
          : `${student.full_name} já possui presença registrada hoje.`,
        student: {
          name:
            student.full_name,
          className:
            student.class_name,
          photo:
            candidate.photoUrl ||
            null,
        },
        time: resultTime,
      }
    : {
        status: 'success',
        message: isRegularExit
          ? 'Saída normal registrada com sucesso.'
          : 'Presença registrada com sucesso.',
        student: {
          name:
            student.full_name,
          className:
            student.class_name,
          photo:
            candidate.photoUrl ||
            null,
        },
        time: resultTime,
      }

    setPendingFacialConfirmation(null)
    setFacialConfirmationResult(result)

    setResultWithTimeout(
      result,
      true,
      false
    )

    restartFacialScannerAfterConfirmation()
  } catch (error) {
    console.error(
  isRegularExit
    ? '[FACIAL] erro ao confirmar saída normal:'
    : '[FACIAL] erro ao confirmar presença:',
  error
)

    setResultWithTimeout({
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : isRegularExit
  ? 'Erro ao registrar saída facial.'
  : 'Erro ao registrar presença facial.',
    })
  } finally {
    setFacialConfirming(false)
  }
}

  useEffect(() => {
  function handleOnline() {
    syncOfflineAttendance()
  }

  window.addEventListener('online', handleOnline)

  return () => {
    window.removeEventListener('online', handleOnline)
  }
}, [])

  useEffect(() => {
  async function init() {
    let isFacialAvailable = false

    try {
      const accessOk = await ensureAccess()

      if (!accessOk) return

      await fetchSchoolName()

const [
  facialAvailable,
] = await Promise.all([
  fetchSubscription(),
  fetchRegularExitAddon(),
])

isFacialAvailable =
  facialAvailable

await loadTodayEarlyExits()

if (isFacialAvailable && navigator.onLine) {
  Promise.all([
    loadFacialEmbeddingsFromSupabase(true),
    loadFacialStudentsFromSupabase(true),
    loadFaceModels(),
  ]).catch((error) => {
    console.error(
      '[FACIAL ONLINE] erro no pré-carregamento:',
      error
    )
  })
}
    } catch (error) {
      console.error('Erro ao iniciar modo portaria:', error)
    } finally {
      setLoading(false)

      setTimeout(async () => {
        try {
          await downloadOfflineData()
        } catch (error) {
          console.error(
            'Erro ao atualizar dados offline:',
            error
          )
        }
      }, 800)
    }
  }

  init()
}, [schoolId])

  useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (
      facialRestartTimeoutRef.current
    ) {
      clearTimeout(
        facialRestartTimeoutRef.current
      )
    }

    if (
      regularExitQrRestartTimeoutRef.current
    ) {
      clearTimeout(
        regularExitQrRestartTimeoutRef.current
      )
    }
  }
}, [])

const facialAvailableForCurrentMode =
  gateMode === 'regular_exit'
    ? regularExitEnabled
    : facialEnabled

  if (loading) {
    return (
      <main style={pageStyle} className="gate-page">
        <ResponsiveStyles />
        <style jsx global>{`
  @keyframes scanPop {
    0% {
      transform: scale(0.92);
      opacity: 0;
    }
    60% {
      transform: scale(1.03);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes scannerPulse {
    0% {
      box-shadow: 0 0 0 rgba(37, 99, 235, 0);
    }
    50% {
      box-shadow: 0 0 34px rgba(37, 99, 235, 0.35);
    }
    100% {
      box-shadow: 0 0 0 rgba(37, 99, 235, 0);
    }
  }
`}</style>
        <div style={loadingCardStyle}>Carregando modo portaria...</div>
      </main>
    )
  }

  return (
    <main style={pageStyle} className="gate-page">
      <ResponsiveStyles />
      <section style={topBarStyle} className="top-bar">
        <div>
          <div style={badgeStyle}>Modo portaria</div>
          <h1 style={titleStyle}>{schoolName}</h1>
          <p style={subtitleStyle}>
  Controle de entrada e saída por QR Code
  ou reconhecimento facial.
</p>
        </div>

        <button
  onClick={handleCloseGateMode}
  disabled={closingGateMode}
  style={{
    ...secondaryButtonStyle,
    opacity: closingGateMode ? 0.7 : 1,
    cursor: closingGateMode ? 'not-allowed' : 'pointer',
  }}
>
  {closingGateMode ? 'Sincronizando...' : 'Encerrar e voltar ao painel'}
</button>
      </section>

      <section style={gateGridStyle} className="gate-grid">
        <div style={scannerCardStyle} className="scanner-card">
          <div style={scannerHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
  {gateMode === 'entry'
    ? 'Leitura de entrada'
    : gateMode === 'regular_exit'
    ? 'Saída normal'
    : 'Saída antecipada'}
</h2>
              <p style={sectionTextStyle}>
  {gateMode === 'entry'
    ? 'Leia o QR Code ou o rosto do aluno para registrar a entrada.'
    : gateMode === 'regular_exit'
    ? 'Leia o QR Code ou reconheça o rosto do aluno para registrar sua saída.'
    : 'Leia o QR Code do aluno para registrar uma saída antecipada.'}
</p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
  <button
  onClick={() =>
    changeGateMode('entry')
  }
  style={{
    ...secondaryButtonStyle,
    background:
      gateMode === 'entry'
        ? '#dbeafe'
        : '#ffffff',
    borderColor:
      gateMode === 'entry'
        ? '#2563eb'
        : '#cbd5e1',
    color:
      gateMode === 'entry'
        ? '#1d4ed8'
        : '#0f172a',
  }}
>
  Entrada
</button>

{regularExitEnabled && (
  <button
    onClick={() =>
      changeGateMode(
        'regular_exit'
      )
    }
    style={{
      ...secondaryButtonStyle,
      background:
        gateMode ===
        'regular_exit'
          ? '#dcfce7'
          : '#ffffff',
      borderColor:
        gateMode ===
        'regular_exit'
          ? '#16a34a'
          : '#cbd5e1',
      color:
        gateMode ===
        'regular_exit'
          ? '#15803d'
          : '#0f172a',
    }}
  >
    Saída normal
  </button>
)}

<button
  onClick={() =>
    changeGateMode('early_exit')
  }
  style={{
    ...secondaryButtonStyle,
    background:
      gateMode === 'early_exit'
        ? '#ffedd5'
        : '#ffffff',
    borderColor:
      gateMode === 'early_exit'
        ? '#f97316'
        : '#cbd5e1',
    color:
      gateMode === 'early_exit'
        ? '#c2410c'
        : '#0f172a',
  }}
>
  Saída antecipada
</button>
  <button
  onClick={() => {
    if (
      gateMode ===
        'regular_exit' &&
      !navigator.onLine
    ) {
      setResultWithTimeout({
        status: 'error',
        message:
          'A saída normal por QR Code precisa de internet.',
      })

      return
    }

    setReadingMethod('qr')

    setResultWithTimeout(
      {
        status: 'success',
        message:
          'Clique em iniciar leitura.',
      },
      false,
      false
    )
  }}
  style={{
    ...secondaryButtonStyle,

    background:
      readingMethod === 'qr'
        ? '#dbeafe'
        : '#ffffff',

    borderColor:
      readingMethod === 'qr'
        ? '#2563eb'
        : '#cbd5e1',

    color:
      readingMethod === 'qr'
        ? '#1d4ed8'
        : '#0f172a',
  }}
>
  QR Code
</button>

<button
  onClick={() => {
    if (
  !facialAvailableForCurrentMode
) {
      setResultWithTimeout({
  status: 'error',
  message:
    gateMode === 'regular_exit'
      ? 'A escola não possui o adicional de saída normal ativo.'
      : 'Reconhecimento facial disponível apenas no plano Presença Inteligente.',
})
      return
    }

    if (!navigator.onLine) {
  setResultWithTimeout({
    status: 'error',
    message: 'Reconhecimento facial precisa de internet.',
  })
  return
}

    loadFacialEmbeddingsFromSupabase(false)

    setReadingMethod('facial')

setResultWithTimeout(
  {
    status: 'success',
    message: 'Clique em iniciar leitura.',
  },
  false,
  false
)

loadFaceModels().catch((error) => {
  console.error(
    '[FACE API] erro ao carregar modelos:',
    error
  )
})
  }}
  disabled={
  gateMode === 'early_exit'
}
  style={{
    ...secondaryButtonStyle,
    background: readingMethod === 'facial' ? '#dcfce7' : '#ffffff',
    borderColor: readingMethod === 'facial' ? '#16a34a' : '#cbd5e1',
    color: readingMethod === 'facial' ? '#15803d' : '#0f172a',
    opacity: gateMode === 'early_exit' ? 0.5 : 1,
    cursor: gateMode === 'early_exit' ? 'not-allowed' : 'pointer',
  }}
>
  {facialAvailableForCurrentMode
  ? 'Facial'
  : 'Facial Bloqueado'}
</button>

{gateMode === 'entry' &&
  !facialEnabled && (
  <div
    style={{
      fontSize: 12,
      color: '#b45309',
      fontWeight: 700,
      marginTop: 6,
    }}
  >
    Disponível no plano Presença Inteligente.
  </div>
)}
</div>

            <div style={scannerActionsStyle} className="scanner-actions">
              {!isScannerActive && !manualMode && (
                <button
                  onClick={handleStartReading}
                  style={primaryButtonStyle}
                >
                  Iniciar leitura
                </button>
              )}
<button
  onClick={async () => {
  await downloadOfflineData()

  if (facialEnabled && navigator.onLine) {
    facialEmbeddingsLoadedRef.current = false
    facialStudentsLoadedRef.current = false

    await Promise.all([
      loadFacialEmbeddingsFromSupabase(true),
      loadFacialStudentsFromSupabase(true),
    ])
  }
}}
  disabled={loadingOffline}
  style={{
    ...secondaryButtonStyle,
    opacity: loadingOffline ? 0.7 : 1,
    cursor: loadingOffline ? 'not-allowed' : 'pointer',
  }}
>
  {loadingOffline ? 'Atualizando...' : 'Atualizar dados offline'}
</button>

<button
  onClick={syncOfflineAttendance}
  disabled={loadingSync}
  style={{
    ...secondaryButtonStyle,
    opacity: loadingSync ? 0.7 : 1,
    cursor: loadingSync ? 'not-allowed' : 'pointer',
  }}
>
  {loadingSync ? 'Sincronizando...' : 'Sincronizar presenças'}
</button>

              {isScannerActive && (
                <button
                  onClick={handleStopReading}
                  style={dangerButtonStyle}
                >
                  Encerrar
                </button>
              )}

              {!isScannerActive &&
  !manualMode &&
  gateMode === 'entry' && (
                <button
                  onClick={() => setManualMode(true)}
                  style={secondaryButtonStyle}
                >
                  Manual
                </button>
              )}
            </div>
          </div>

          {isScannerActive && (
            <div style={scannerBoxStyle}>
{readingMethod === 'qr' && (
  <QRScanner
    onScan={handleGateScan}
    onNoCamera={handleNoCamera}
    isActive={isScannerActive}
  />
)}

{readingMethod === 'facial' &&
  facialAvailableForCurrentMode && (
  <FacialScanner
  isActive={
  isScannerActive &&
  facialAvailableForCurrentMode
}
  cameraMode={facialCameraMode}
  onCameraModeChange={setFacialCameraMode}
  onNoCamera={handleNoCamera}
  onFaceCapture={handleFaceCapture}
  onCancel={() => {
  setIsScannerActive(false)
  setReadingMethod(
  gateMode === 'regular_exit'
    ? 'facial'
    : 'qr'
)
  setFacialCandidates([])
  setFacialConfirmationResult(null)
  setPendingFacialConfirmation(null)
  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)
}}
/>
)}
            </div>
          )}

          {manualMode && (
  <div style={manualBoxStyle}>
    <input
      type="text"
      placeholder="Buscar aluno pelo nome..."
      value={manualStudentSearch}
      onChange={(e) => setManualStudentSearch(e.target.value)}
      style={inputStyle}
    />

    <select
  value={manualStudentId}
  onChange={(e) => setManualStudentId(e.target.value)}
  style={inputStyle}
>
  <option value="">
    {manualStudentSearch.trim().length < 3
      ? 'Digite pelo menos 3 letras'
      : 'Selecione o aluno'}
  </option>

  {manualStudentSearch.trim().length >= 3 &&
  manualStudents.map((student: any) => (
    <option key={student.id} value={student.id}>
      {student.full_name} - {student.class_name}
    </option>
  ))}
</select>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <button
        onClick={handleManualAttendance}
        style={primaryButtonStyle}
      >
        Registrar presença manual
      </button>

      <button
        onClick={() => {
          setManualMode(false)
          setManualStudentId('')
          setManualStudentSearch('')
        }}
        style={secondaryButtonStyle}
      >
        Cancelar
      </button>
    </div>
  </div>
)}

          {!isScannerActive && !manualMode && (
            <div style={idleBoxStyle}>
              Clique em <strong>Iniciar leitura</strong> para começar o registro de{' '}
{gateMode === 'entry'
  ? 'entrada.'
  : gateMode === 'regular_exit'
  ? 'saída normal.'
  : 'saída antecipada.'}
            </div>
          )}
        </div>

        <div style={resultCardStyle} className="result-card">
          <h2 style={sectionTitleStyle}>Resultado</h2>

          {!scanResult ? (
            <div style={waitingStyle}>
              Aguardando leitura...
            </div>
          ) : (
            <div
            key={resultAnimationKey}
              style={{
                ...bigResultStyle,
                background:
                  scanResult.status === 'success'
                    ? '#dcfce7'
                    : scanResult.status === 'duplicate'
                    ? '#fef3c7'
                    : '#fee2e2',
                borderColor:
                  scanResult.status === 'success'
                    ? '#86efac'
                    : scanResult.status === 'duplicate'
                    ? '#fde68a'
                    : '#fecaca',
              }}
            >
              {scanResult.student?.photo ? (
                <img
                  src={scanResult.student.photo}
                  alt="Aluno"
                  style={bigPhotoStyle}
                />
              ) : (
                <div style={bigPhotoPlaceholderStyle}>
                  {scanResult.student?.name?.[0] || '!'}
                </div>
              )}

              <div style={bigStatusStyle}>
                {scanResult.status === 'success'
                  ? '✅'
                  : scanResult.status === 'duplicate'
                  ? '⚠️'
                  : '❌'}
              </div>

              <h3 style={bigNameStyle}>
                {scanResult.student?.name || 'Aviso do Sistema'}
              </h3>

              <p style={bigClassStyle}>
  {scanResult.student?.className || ''}
</p>

              <div style={bigMessageStyle}>
                {scanResult.message}
              </div>

              {scanResult.time && (
                <div style={bigTimeStyle}>{scanResult.time}</div>
              )}
            </div>
          )}

          <AttendanceSection result={null} recentScans={recentScans}>
            <></>
          </AttendanceSection>
        </div>
        <section
  style={{
    marginTop: 20,
    background: '#ffffff',
    borderRadius: 24,
    padding: 20,
    border: '1px solid #e2e8f0',
    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.08)',
  }}
>
  <h2 style={sectionTitleStyle}>Saídas antecipadas registradas hoje</h2>

  {todayEarlyExits.length === 0 ? (
    <p style={sectionTextStyle}>
      Nenhuma saída antecipada registrada hoje.
    </p>
  ) : (
    <div style={{ display: 'grid', gap: 10 }}>
      {todayEarlyExits.map((exit) => (
        <div
          key={exit.id}
          style={{
            padding: 12,
            borderRadius: 16,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
          }}
        >
          <strong>{exit.student_name}</strong>
          <br />
          <span>{exit.class_name}</span>
          <br />
          <span>Saída: {exit.exit_time}</span>
          <br />
          <span>Motivo: {exit.reason}</span>

          {exit.authorized_by_name && (
            <>
              <br />
              <span>
                Autorizado/retirado por: {exit.authorized_by_name}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )}
</section>
      </section>

      {pendingExitStudent && (
  <div style={modalOverlayStyle}>
    <div style={exitModalStyle}>
      <h2 style={sectionTitleStyle}>Registrar saída</h2>

      <p style={sectionTextStyle}>
        Confirme o motivo da saída antecipada do aluno.
      </p>

      <div style={{
        padding: 14,
        borderRadius: 18,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        marginBottom: 16,
      }}>
        <strong>{pendingExitStudent.full_name}</strong>
        <br />
        <span>{pendingExitStudent.class_name}</span>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {['Consulta médica', 'Mal-estar', 'Compromisso familiar', 'Autorização da gestão', 'Outro'].map((reason) => (
          <button
            key={reason}
            onClick={() => setExitReason(reason)}
            style={{
              ...secondaryButtonStyle,
              background: exitReason === reason ? '#ffedd5' : '#ffffff',
              borderColor: exitReason === reason ? '#f97316' : '#cbd5e1',
              color: exitReason === reason ? '#c2410c' : '#0f172a',
            }}
          >
            {reason}
          </button>
        ))}
      </div>

      {exitReason === 'Outro' && (
        <input
          type="text"
          placeholder="Informe o motivo"
          value={otherExitReason}
          onChange={(e) => setOtherExitReason(e.target.value)}
          style={{ ...inputStyle, marginTop: 12 }}
        />
      )}

      <input
        type="text"
        placeholder="Nome de quem autorizou/retirou"
        value={authorizedByName}
        onChange={(e) => setAuthorizedByName(e.target.value)}
        style={{ ...inputStyle, marginTop: 12 }}
      />

      <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        <button onClick={confirmEarlyExit} style={primaryButtonStyle}>
          Confirmar saída
        </button>

        <button
          onClick={() => setPendingExitStudent(null)}
          style={secondaryButtonStyle}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

{(
  facialCandidates.length > 0 ||
  facialConfirmationResult
) &&
  !pendingFacialConfirmation && (
  <div style={modalOverlayStyle}>
    <div
      style={{
        width: 'min(960px, 96vw)',
        maxHeight: '92vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: 28,
        padding: 24,
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)',
      }}
    >
      {!facialConfirmationResult ? (
        <>
          <h2 style={{ ...sectionTitleStyle, fontSize: 28 }}>
            Confirme seu Reconhecimento Facial.
          </h2>

          <p style={sectionTextStyle}>
            {gateMode === 'regular_exit'
  ? 'Toque na sua foto para confirmar a saída.'
  : 'Toque na sua foto para confirmar a presença.'}
          </p>

          {facialPhotosLoading && (
  <p style={{ ...sectionTextStyle, color: '#2563eb', fontWeight: 900 }}>
    Carregando fotos dos candidatos...
  </p>
)}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 18,
              marginTop: 20,
            }}
          >
            {facialCandidates.map((candidate) => (
              <button
                key={candidate.student_id}
                onClick={() =>
  selectFacialCandidateForConfirmation(
    candidate
  )
}
                style={{
                  border: '1px solid #dbeafe',
                  background: '#f8fafc',
                  borderRadius: 24,
                  padding: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {candidate.photoUrl ? (
                  <img
                    src={candidate.photoUrl}
                    alt={candidate.student.full_name}
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '4px solid #bfdbfe',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 130,
                      height: 130,
                      borderRadius: '50%',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 42,
                      fontWeight: 900,
                      border: '4px solid #bfdbfe',
                    }}
                  >
                    {candidate.student.full_name?.[0] || '?'}
                  </div>
                )}

                <strong
                  style={{
                    color: '#0f172a',
                    fontSize: 16,
                    textAlign: 'center',
                  }}
                >
                  {candidate.student.full_name}
                </strong>

                <span
                  style={{
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  {candidate.student.class_name}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
  setFacialCandidates([])
  setFacialConfirmationResult(null)
  setPendingFacialConfirmation(null)
  setPendingFacialCapture(null)
  setPendingFacialEmbedding(null)

  setIsScannerActive(true)
  setReadingMethod('facial')
}}
            style={{
              width: '100%',
              marginTop: 22,
              padding: '18px 20px',
              borderRadius: 20,
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Nenhum dos alunos acima, refazer
          </button>
        </>
      ) : (
        <div
          style={{
            minHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 14,
          }}
        >
          {facialConfirmationResult.student?.photo ? (
            <img
              src={facialConfirmationResult.student.photo}
              alt="Aluno"
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '5px solid #86efac',
              }}
            />
          ) : (
            <div style={bigPhotoPlaceholderStyle}>
              {facialConfirmationResult.student?.name?.[0] || '!'}
            </div>
          )}

          <div style={{ fontSize: 52 }}>
            {facialConfirmationResult.status === 'success' ? '✅' : '⚠️'}
          </div>

          <h2 style={{ ...sectionTitleStyle, fontSize: 28 }}>
            {facialConfirmationResult.student?.name}
          </h2>

          <p style={{ ...sectionTextStyle, fontSize: 18 }}>
            {facialConfirmationResult.message}
          </p>

          {facialConfirmationResult.time && (
            <strong style={{ color: '#0f172a' }}>
              {facialConfirmationResult.time}
            </strong>
          )}
          {nextReadCountdown !== null && (
  <div
    style={{
      marginTop: 18,
      padding: '16px 28px',
      borderRadius: 20,
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#1e3a8a',
      minWidth: 220,
    }}
  >
    <div
      style={{
        fontSize: 16,
        fontWeight: 800,
      }}
    >
      Próxima leitura em
    </div>

    <div
      style={{
        fontSize: 58,
        lineHeight: 1,
        fontWeight: 900,
        margin: '10px 0 6px',
      }}
    >
      {nextReadCountdown}
    </div>

    <div
      style={{
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      segundos
    </div>
  </div>
)}
        </div>
      )}
    </div>
  </div>
)}

{pendingFacialConfirmation && (
  <div
    style={{
      ...modalOverlayStyle,
      zIndex: 1100,
    }}
  >
    <div
      style={{
        width: 'min(460px, 96vw)',
        maxHeight: '94vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: 28,
        padding: 24,
        textAlign: 'center',
        boxShadow:
          '0 24px 80px rgba(15, 23, 42, 0.35)',
      }}
    >
      <h2
        style={{
          ...sectionTitleStyle,
          fontSize: 28,
          alignItems: 'center',
        }}
      >
        {gateMode === 'regular_exit'
  ? 'Confirmar saída'
  : 'Confirmar chegada'}
      </h2>

      <p style={sectionTextStyle}>
        {gateMode === 'regular_exit'
  ? 'Confira seus dados antes de registrar a saída.'
  : 'Confira seus dados antes de registrar a chegada.'}
      </p>

      {pendingFacialConfirmation
        .candidate.photoUrl ? (
        <img
          src={
            pendingFacialConfirmation
              .candidate.photoUrl
          }
          alt={
            pendingFacialConfirmation
              .candidate.student.full_name
          }
          style={{
            width: 160,
            height: 160,
            display: 'block',
            margin: '20px auto 0',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '5px solid #bfdbfe',
            marginTop: 20,
            boxShadow:
              '0 16px 36px rgba(15, 23, 42, 0.18)',
          }}
        />
      ) : (
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            margin: '20px auto 0',
            background: '#dbeafe',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: 54,
            border: '5px solid #bfdbfe',
          }}
        >
          {pendingFacialConfirmation
            .candidate.student
            .full_name?.[0] || '?'}
        </div>
      )}

      <h3
        style={{
          margin: '18px 0 5px',
          color: '#0f172a',
          fontSize: 25,
          fontWeight: 900,
        }}
      >
        {
          pendingFacialConfirmation
            .candidate.student.full_name
        }
      </h3>

      <div
        style={{
          color: '#475569',
          fontSize: 18,
          fontWeight: 800,
        }}
      >
        {
          pendingFacialConfirmation
            .candidate.student.class_name
        }
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 16,
          background: '#f0fdf4',
          color: '#15803d',
          fontWeight: 900,
          fontSize: 24,
        }}
      >
        {new Date(
          pendingFacialConfirmation
            .capturedAt
        ).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 22,
          flexWrap: 'wrap',
        }}
      >
        <button
          disabled={facialConfirming}
          onClick={() =>
            confirmFacialCandidate(
              pendingFacialConfirmation
                .candidate
            )
          }
          style={{
            ...primaryButtonStyle,
            flex: 1,
            opacity:
              facialConfirming ? 0.7 : 1,
            cursor:
              facialConfirming
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {facialConfirming
  ? 'Confirmando...'
  : gateMode === 'regular_exit'
  ? 'Confirmar saída'
  : 'Confirmar chegada'}
        </button>

        <button
          disabled={facialConfirming}
          onClick={() => {
  /*
   * Descarta completamente a
   * captura que foi cancelada.
   */
  setPendingFacialConfirmation(
    null
  )

  setPendingFacialCapture(
    null
  )

  setPendingFacialEmbedding(
    null
  )

  setFacialCandidates(
    []
  )

  setFacialConfirmationResult(
    null
  )

  setNextReadCountdown(
    null
  )

  /*
   * Não volta para a tela
   * "Registrar chegada".
   *
   * O usuário cancelou apenas
   * esta identificação, então
   * fazemos imediatamente
   * uma nova leitura facial.
   */
  setFacialStandby(
    false
  )

  setReadingMethod(
    'facial'
  )

  setIsScannerActive(
    true
  )
}}
          style={{
            ...secondaryButtonStyle,
            flex: 1,
            opacity:
              facialConfirming ? 0.7 : 1,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

{facialStandby &&
  gateMode === 'entry' &&
  readingMethod === 'facial' && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 20000,

      background:
        'rgba(0,0,0,0.94)',

      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',

      gap: 24,
      color: '#ffffff',
      padding: 24,
    }}
  >
    <div
      style={{
        transform:
          `translate(${standbyOffset.x}px, ${standbyOffset.y}px)`,

        transition:
          'transform 0.8s ease',

        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <div
        style={{
          fontSize:
            'clamp(52px, 8vw, 96px)',

          fontWeight: 900,
          letterSpacing: 2,
        }}
      >
        {currentTime}
      </div>

      <div
        style={{
          fontSize:
            'clamp(16px, 2vw, 24px)',

          color: '#cbd5e1',

          textTransform:
            'capitalize',
        }}
      >
        {currentDate}
      </div>

      <button
        onClick={() => {
          playScanSound(
            'success'
          )

          setFacialStandby(
            false
          )

          setFacialCandidates(
            []
          )

          setPendingFacialConfirmation(
            null
          )

          setPendingFacialCapture(
            null
          )

          setPendingFacialEmbedding(
            null
          )

          setFacialConfirmationResult(
            null
          )

          setReadingMethod(
            'facial'
          )

          /*
           * Somente aqui a câmera
           * realmente é aberta.
           */
          setIsScannerActive(
            true
          )
        }}
        style={{
          marginTop: 30,

          width:
            'min(420px, 90vw)',

          minHeight: 110,

          borderRadius: 32,
          border: 'none',

          background:
            'linear-gradient(135deg, #2563eb, #1d4ed8)',

          color: '#ffffff',

          fontSize: 30,
          fontWeight: 900,

          cursor: 'pointer',

          boxShadow:
            '0 24px 70px rgba(37,99,235,0.45)',
        }}
      >
        Registrar chegada
      </button>

      <div
        style={{
          color: '#cbd5e1',

          fontSize: 18,
          fontWeight: 700,

          textAlign:
            'center',
        }}
      >
        Toque para registrar sua chegada
      </div>
    </div>

    <button
      onClick={async () => {
        setFacialStandby(
          false
        )

        await handleCloseGateMode()
      }}
      style={{
        position: 'fixed',

        right: 24,
        bottom: 24,

        width: 'auto',

        padding:
          '12px 16px',

        borderRadius: 999,

        border:
          '1px solid rgba(255,255,255,0.18)',

        background:
          'rgba(255,255,255,0.08)',

        color: '#cbd5e1',

        fontSize: 13,
        fontWeight: 800,

        cursor: 'pointer',
      }}
    >
      Encerrar portaria
    </button>
  </div>
)}

    </main>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  padding: 24,
  background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 55%, #e0f2fe 100%)',
  overflowX: 'hidden',
}

const loadingCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 24,
  fontWeight: 800,
  color: '#0f172a',
}

const topBarStyle: React.CSSProperties = {
  maxWidth: 1500,
  margin: '0 auto 24px',
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '8px 12px',
  borderRadius: 999,
  background: '#dbeafe',
  color: '#1d4ed8',
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 10,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
  fontWeight: 900,
  color: '#0f172a',
  lineHeight: 1.05,
}

const subtitleStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: 16,
  fontWeight: 600,
}

const gateGridStyle: React.CSSProperties = {
  maxWidth: 1500,
  margin: '0 auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
  gap: 24,
  alignItems: 'start',
}

const scannerCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const scannerHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  marginBottom: 18,
}

const scannerActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
}

const scannerBoxStyle: React.CSSProperties = {
  borderRadius: 24,
  overflow: 'hidden',
  border: '2px solid #dbeafe',
  background: '#0f172a',
  minHeight: 240,
  maxHeight: '52vh',
}

const resultCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 18,
  minHeight: 'auto',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  color: '#0f172a',
}

const sectionTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  fontWeight: 600,
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
  cursor: 'pointer',
}

const dangerButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  border: 'none',
  background: '#dc2626',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
}

const idleBoxStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  borderRadius: 24,
  border: '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#64748b',
  fontSize: 18,
}

const manualBoxStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const inputStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  fontSize: 16,
  color: '#0f172a',
  background: '#ffffff',
  outline: 'none',
}

const waitingStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 40,
  borderRadius: 24,
  background: '#f8fafc',
  border: '1px dashed #cbd5e1',
  color: '#64748b',
  fontWeight: 800,
  textAlign: 'center',
}

const bigResultStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid',
  borderRadius: 24,
  padding: 16,
  textAlign: 'center',
  animation: 'scanPop 0.35s ease-out',
}

const bigPhotoStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: 22,
  objectFit: 'cover',
  border: '4px solid white',
  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.16)',
}

const bigPhotoPlaceholderStyle: React.CSSProperties = {
  width: 150,
  height: 150,
  borderRadius: 32,
  margin: '0 auto 12px',
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: 56,
}

const bigStatusStyle: React.CSSProperties = {
  fontSize: 48,
}

const bigNameStyle: React.CSSProperties = {
  margin: '8px 0 4px',
  fontSize: 24,
  fontWeight: 900,
  color: '#0f172a',
}

const bigClassStyle: React.CSSProperties = {
  margin: 0,
  color: '#475569',
  fontSize: 20,
  fontWeight: 800,
}

const bigMessageStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 18,
  fontWeight: 900,
  color: '#0f172a',
}

const bigTimeStyle: React.CSSProperties = {
  marginTop: 8,
  color: '#64748b',
  fontWeight: 800,
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 999,
}

const exitModalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 460,
  background: '#ffffff',
  borderRadius: 24,
  padding: 22,
  border: '1px solid #e2e8f0',
  boxShadow: '0 24px 80px rgba(15, 23, 42, 0.25)',
}