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
  const [gateMode, setGateMode] = useState<'entry' | 'exit'>('entry')
  const [readingMethod, setReadingMethod] = useState<'qr' | 'facial'>('qr')
  const audioContextRef = useRef<AudioContext | null>(null)
  const [loadingOffline, setLoadingOffline] = useState(false)
const [loadingSync, setLoadingSync] = useState(false)
const [closingGateMode, setClosingGateMode] = useState(false)

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
  if (loadingOffline) return

  setLoadingOffline(true)

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
    await offlineAttendanceDb.faceEmbeddings
  .where('source')
  .equals('profile_photo')
  .delete()

for (const student of offlineStudents as any[]) {
  if (!student.profile_photo_path) continue

  const { data: signedData } = await supabase.storage
    .from('student-profile-photos')
    .createSignedUrl(student.profile_photo_path, 3600)

  if (!signedData?.signedUrl) continue

  const response = await fetch(signedData.signedUrl)
  const imageBlob = await response.blob()

  const embedding = await generateFaceEmbeddingFromBlob(imageBlob)

  if (!embedding) continue

  await offlineAttendanceDb.faceEmbeddings.put({
    id: `profile-${student.id}`,
    school_id: student.school_id,
    student_id: student.id,
    class_id: student.class_id,
    embedding,
    source: 'profile_photo',
    quality_score: null,
    captured_at: new Date().toISOString(),
    expires_at: new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString(),
    synced: false,
  })
}

    const totalEmbeddings = await offlineAttendanceDb.faceEmbeddings.count()

setResultWithTimeout({
  status: 'success',
  message: `Dados offline atualizados. Alunos salvos: ${offlineStudents.length}. Vetores faciais: ${totalEmbeddings}`,
})
  } finally {
    setLoadingOffline(false)
  }
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

const todayAttendance = await offlineAttendanceDb.attendance
  .where('student_id')
  .equals(student.id)
  .filter((record) => record.attendance_date === today && record.status === 'present')
  .first()

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

async function handleGateScan(text: string) {
  if (gateMode === 'entry') {
    await handleOfflineScan(text)
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
      message: 'Sem internet. A sincronização será feita quando a conexão voltar.',
    })
    return
  }

const pendingRecords = await offlineAttendanceDb.attendance
  .filter((record) => record.synced === false)
  .toArray()

 if (pendingRecords.length === 0) {
  await syncEarlyExits()

  setResultWithTimeout({
    status: 'success',
    message: 'Sincronização verificada.',
  })

  return
}

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let syncedCount = 0

  for (const record of pendingRecords) {
    const { data: existingAttendance, error: existingError } = await supabase
      .from('attendance_records')
      .select('id, status')
      .eq('school_id', record.school_id)
      .eq('student_id', record.student_id)
      .eq('class_id', record.class_id)
      .eq('attendance_date', record.attendance_date)
      .maybeSingle()

    if (existingError) {
      continue
    }

    if (existingAttendance) {
      const { error: updateError } = await supabase
        .from('attendance_records')
        .update({
          status: 'present',
          source: record.source,
          recorded_by_user_id: user?.id || null,
          updated_at: record.recorded_at,
        })
        .eq('id', existingAttendance.id)

      if (!updateError) {
        await offlineAttendanceDb.attendance.update(record.id, {
          synced: true,
        })

        syncedCount++
      }

      continue
    }

    const { error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        school_id: record.school_id,
        student_id: record.student_id,
        class_id: record.class_id,
        attendance_date: record.attendance_date,
        status: 'present',
        source: record.source,
        recorded_by_user_id: user?.id || null,
        created_at: record.recorded_at,
        updated_at: record.recorded_at,
      })

    if (!insertError) {
      await offlineAttendanceDb.attendance.update(record.id, {
        synced: true,
      })

      syncedCount++
    }
  }

  setResultWithTimeout({
    status: 'success',
    message: `Sincronização concluída. Registros enviados: ${syncedCount}`,
  })
  await syncEarlyExits()
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

  function setResultWithTimeout(data: ScanResult) {
  setScanResult(data)
  setResultAnimationKey((prev) => prev + 1)
  playScanSound(data.status)

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

    timeoutRef.current = setTimeout(() => {
      setScanResult(null)
    }, 5000)
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
  const initialized = await initializeAttendanceForToday()
  if (!initialized) return

  // 👇 LIBERA O ÁUDIO AQUI
  if (!audioContextRef.current) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    const ctx = new AudioContextClass()

    // ESSENCIAL no mobile
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    audioContextRef.current = ctx
  }

  setManualMode(false)
  setIsScannerActive(true)
}

  function handleStopReading() {
    setIsScannerActive(false)
  }

  async function handleCloseGateMode() {
  if (closingGateMode) return

  setClosingGateMode(true)
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
    setManualMode(true)
  }

  async function findBestFaceMatch(
  embedding: number[]
) {
  const allEmbeddings =
    await offlineAttendanceDb.faceEmbeddings.toArray()

  let bestMatch: any = null
  let bestDistance = Infinity

  for (const stored of allEmbeddings) {
    const distance = calculateFaceDistance(
      embedding,
      stored.embedding
    )

    if (distance < bestDistance) {
      bestDistance = distance
      bestMatch = stored
    }
  }

  // limite facial
  if (bestDistance > 0.58) {
    return null
  }

  return {
    student_id: bestMatch.student_id,
    class_id: bestMatch.class_id,
    distance: bestDistance,
  }
}

  async function handleFaceCapture(imageBlob: Blob) {
  try {
    setResultWithTimeout({
      status: 'success',
      message: 'Processando rosto...',
    })

    const embedding =
      await generateFaceEmbeddingFromBlob(imageBlob)

    if (!embedding) {
      setResultWithTimeout({
        status: 'error',
        message: 'Nenhum rosto válido encontrado.',
      })

      return
    }    

const match = await findBestFaceMatch(embedding)

if (!match) {
  setResultWithTimeout({
    status: 'error',
    message: 'Rosto não reconhecido.',
  })

  return
}

const student =
  await offlineAttendanceDb.students.get(match.student_id)

  if (!student) {
  setResultWithTimeout({
    status: 'error',
    message: 'Aluno não encontrado.',
  })

  return
}

    const today = new Date().toISOString().split('T')[0]

const existingAttendance =
  await offlineAttendanceDb.attendance
    .where('[student_id+attendance_date]')
    .equals([student.id, today])
    .first()

if (!existingAttendance) {
  await offlineAttendanceDb.attendance.add({
    id: crypto.randomUUID(),
    school_id: student.school_id,
    student_id: student.id,
    class_id: student.class_id,
    attendance_date: today,
    status: 'present',
    source: 'facial',
    recorded_at: new Date().toISOString(),
    synced: false,
  })
}

await offlineAttendanceDb.faceCapturesTemp.add({
  id: crypto.randomUUID(),
  school_id: schoolId,
  student_id: student.id,
  class_id: student.class_id,
  image_blob: imageBlob,
  captured_at: new Date().toISOString(),
  processed: false,
})

setRecentScans((prev) => [
  {
    id: crypto.randomUUID(),
    status: existingAttendance ? 'duplicate' : 'success',
    message: existingAttendance
      ? 'Aluno já possuía presença registrada anteriormente.'
      : 'Presença facial registrada com sucesso.',
    studentName: student.full_name,
    className: student.class_name,
    photo: student.profile_photo_path || null,
    time: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  },
  ...prev.slice(0, 9),
])

setResultWithTimeout({
  status: existingAttendance ? 'duplicate' : 'success',
  message: existingAttendance
    ? 'Aluno já possuía presença registrada anteriormente.'
    : 'Presença facial registrada com sucesso.',
  student: {
    name: student.full_name,
    className: student.class_name,
    photo: student.profile_photo_path || null,
  },
  time: new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }),
})
  } catch (error) {
    console.error(error)

    setResultWithTimeout({
      status: 'error',
      message: 'Erro ao processar rosto.',
    })
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
    try {
      const accessOk = await ensureAccess()
      if (!accessOk) return

      await fetchSchoolName()
      await loadTodayEarlyExits()
    } catch (error) {
      console.error('Erro ao iniciar modo portaria:', error)
    } finally {
      setLoading(false)
    }
  }

  init()
}, [schoolId])

  useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }
}, [])

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
            Leitura rápida de presença por QR Code.
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
  {gateMode === 'entry' ? 'Leitura de entrada' : 'Registrar saída'}
</h2>
              <p style={sectionTextStyle}>
                {gateMode === 'entry'
  ? 'Aponte o QR Code do aluno para registrar a presença.'
  : 'Aponte o QR Code do aluno para registrar a saída antecipada.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
  <button
    onClick={() => setGateMode('entry')}
    style={{
      ...secondaryButtonStyle,
      background: gateMode === 'entry' ? '#dbeafe' : '#ffffff',
      borderColor: gateMode === 'entry' ? '#2563eb' : '#cbd5e1',
      color: gateMode === 'entry' ? '#1d4ed8' : '#0f172a',
    }}
  >
    Entrada
  </button>

  <button
    onClick={() => setGateMode('exit')}
    style={{
      ...secondaryButtonStyle,
      background: gateMode === 'exit' ? '#ffedd5' : '#ffffff',
      borderColor: gateMode === 'exit' ? '#f97316' : '#cbd5e1',
      color: gateMode === 'exit' ? '#c2410c' : '#0f172a',
    }}
  >
    Registrar saída
  </button>
  <button
  onClick={() => setReadingMethod('qr')}
  style={{
    ...secondaryButtonStyle,
    background: readingMethod === 'qr' ? '#dbeafe' : '#ffffff',
    borderColor: readingMethod === 'qr' ? '#2563eb' : '#cbd5e1',
    color: readingMethod === 'qr' ? '#1d4ed8' : '#0f172a',
  }}
>
  QR Code
</button>

<button
  onClick={() => setReadingMethod('facial')}
  disabled={gateMode === 'exit'}
  style={{
    ...secondaryButtonStyle,
    background: readingMethod === 'facial' ? '#dcfce7' : '#ffffff',
    borderColor: readingMethod === 'facial' ? '#16a34a' : '#cbd5e1',
    color: readingMethod === 'facial' ? '#15803d' : '#0f172a',
    opacity: gateMode === 'exit' ? 0.5 : 1,
    cursor: gateMode === 'exit' ? 'not-allowed' : 'pointer',
  }}
>
  Facial Premium
</button>
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
  onClick={downloadOfflineData}
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

              {!isScannerActive && !manualMode && (
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
    onScan={handleOfflineScan}
    onNoCamera={handleNoCamera}
    isActive={isScannerActive}
  />
)}

{readingMethod === 'facial' && (
  <FacialScanner
    isActive={isScannerActive}
    onNoCamera={handleNoCamera}
    onFaceCapture={handleFaceCapture}
  />
)}
            </div>
          )}

          {manualMode && (
            <div style={manualBoxStyle}>
              <input
                type="text"
                placeholder="Cole o código do QR"
                value={manualQrCode}
                onChange={(e) => setManualQrCode(e.target.value)}
                style={inputStyle}
              />

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleGateScan(manualQrCode)}
                  style={primaryButtonStyle}
                >
                  {gateMode === 'entry' ? 'Confirmar presença' : 'Confirmar saída'}
                </button>

                <AppButton
                  onClick={() => {
                    setManualMode(false)
                    setManualQrCode('')
                  }}
                  style={secondaryButtonStyle}
                >
                  Cancelar
                </AppButton>
              </div>
            </div>
          )}

          {!isScannerActive && !manualMode && (
            <div style={idleBoxStyle}>
              Clique em <strong>Iniciar leitura</strong> para começar o registro de{' '}
{gateMode === 'entry' ? 'entrada.' : 'saída.'}
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
  <h2 style={sectionTitleStyle}>Saídas registradas hoje</h2>

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