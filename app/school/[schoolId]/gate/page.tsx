'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import QRScanner from '@/components/QRScanner'
import AttendanceSection from '@/components/AttendanceSection'
import { offlineAttendanceDb } from '@/lib/offlineAttendanceDb'

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
        qr_code_token
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
    }
  })
  .filter((student): student is {
    id: string
    school_id: string
    full_name: string
    qr_code_token: string
    profile_photo_path: string | null
    class_id: string
    class_name: string
  } => student !== null)

  await offlineAttendanceDb.students.clear()
  await offlineAttendanceDb.students.bulkPut(offlineStudents)

  setResultWithTimeout({
    status: 'success',
    message: `Dados offline atualizados. Alunos salvos: ${offlineStudents.length}`,
  })
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
        photo: null,
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
      photo: null,
    },
    time: now.toLocaleTimeString(),
  })
}

async function syncOfflineAttendance() {
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
    setResultWithTimeout({
      status: 'duplicate',
      message: 'Não há presenças pendentes para sincronizar.',
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
          source: 'qr',
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
        source: 'qr',
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
}

  function playScanSound(status: 'success' | 'duplicate' | 'error') {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext

    const audioContext = new AudioContextClass()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'sine'

    if (status === 'success') {
      oscillator.frequency.value = 880
    } else if (status === 'duplicate') {
      oscillator.frequency.value = 520
    } else {
      oscillator.frequency.value = 220
    }

    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.18
    )

    oscillator.start()
    oscillator.stop(audioContext.currentTime + 0.18)
  } catch {
    // Se o navegador bloquear áudio, apenas ignora.
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
        max-height: 68vh;
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

        .top-bar,
        .scanner-card,
        .result-card {
          border-radius: 20px !important;
          padding: 16px !important;
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

    setManualMode(false)
    setIsScannerActive(true)
  }

  function handleStopReading() {
    setIsScannerActive(false)
  }

  function handleNoCamera() {
    setIsScannerActive(false)
    setManualMode(true)
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
        .select('id, full_name, school_id, profile_photo_path, qr_code_token')
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
        .select('class_id, classes ( name )')
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

      let photoUrl: string | null = null

      if (student.profile_photo_path) {
        const { data } = await supabase.storage
          .from('student-profile-photos')
          .createSignedUrl(student.profile_photo_path, 3600)

        photoUrl = data?.signedUrl || null
      }

      const now = new Date()
      const attendanceDate = now.toISOString().split('T')[0]

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
    } catch {
      setResultWithTimeout({
        status: 'error',
        message: 'Erro inesperado.',
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
      const accessOk = await ensureAccess()
      if (!accessOk) return

      await fetchSchoolName()
      setLoading(false)
    }

    init()
  }, [schoolId])

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
          onClick={() => router.push(`/school/${schoolId}`)}
          style={secondaryButtonStyle}
        >
          Voltar ao painel
        </button>
      </section>

      <section style={gateGridStyle} className="gate-grid">
        <div style={scannerCardStyle} className="scanner-card">
          <div style={scannerHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Leitura de entrada</h2>
              <p style={sectionTextStyle}>
                Aponte o QR Code do aluno para registrar a presença.
              </p>
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
  style={secondaryButtonStyle}
>
  Atualizar dados offline
</button>
<button
  onClick={syncOfflineAttendance}
  style={secondaryButtonStyle}
>
  Sincronizar presenças
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
<QRScanner
  onScan={handleOfflineScan}
  onNoCamera={handleNoCamera}
  isActive={isScannerActive}
/>
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
                  onClick={() => handleOfflineScan(manualQrCode)}
                  style={primaryButtonStyle}
                >
                  Confirmar presença
                </button>

                <button
                  onClick={() => {
                    setManualMode(false)
                    setManualQrCode('')
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
              Clique em <strong>Iniciar leitura</strong> para começar a chamada.
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
                {scanResult.student?.name || 'Leitura inválida'}
              </h3>

              <p style={bigClassStyle}>
                {scanResult.student?.className || scanResult.message}
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
      </section>
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
  gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 520px)',
  gap: 24,
  alignItems: 'start',
  width: '100%',
}

const scannerCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
  width: '100%',
  minWidth: 0,
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
  border: '1px solid #93c5fd',
  overflow: 'hidden',
  background: '#0f172a',
  animation: 'scannerPulse 1.8s ease-in-out infinite',
  width: '100%',
}

const resultCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
  width: '100%',
  minWidth: 0,
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
  marginTop: 16,
  border: '1px solid',
  borderRadius: 28,
  padding: 24,
  textAlign: 'center',
  animation: 'scanPop 0.35s ease-out',
}

const bigPhotoStyle: React.CSSProperties = {
  width: 150,
  height: 150,
  borderRadius: 32,
  objectFit: 'cover',
  marginBottom: 12,
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
  fontSize: 34,
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
  marginTop: 14,
  fontSize: 22,
  fontWeight: 900,
  color: '#0f172a',
}

const bigTimeStyle: React.CSSProperties = {
  marginTop: 8,
  color: '#64748b',
  fontWeight: 800,
}