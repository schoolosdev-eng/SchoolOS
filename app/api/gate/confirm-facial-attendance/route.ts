import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PHOTO_BUCKET = 'attendance-proof-photos'
const SCHOOL_TIMEZONE = 'America/Fortaleza'

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variáveis do Supabase não configuradas no servidor.'
    )
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization
    .replace('Bearer ', '')
    .trim()
}

function getDateInTimeZone(
  date: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).formatToParts(date)

  const year = parts.find(
    (part) => part.type === 'year'
  )?.value

  const month = parts.find(
    (part) => part.type === 'month'
  )?.value

  const day = parts.find(
    (part) => part.type === 'day'
  )?.value

  if (!year || !month || !day) {
    throw new Error(
      'Não foi possível determinar a data da presença.'
    )
  }

  return `${year}-${month}-${day}`
}

function normalizeWhatsApp(
  value: string | null | undefined
) {
  const digits = value?.replace(/\D/g, '') || ''

  if (!digits) {
    return null
  }

  const normalized = digits.startsWith('55')
    ? digits
    : `55${digits}`

  // Brasil:
  // 55 + DDD + número de 8 ou 9 dígitos
  if (
    normalized.length < 12 ||
    normalized.length > 13
  ) {
    return null
  }

  return normalized
}

function getPhotoExtension(
  mimeType: string
) {
  if (mimeType === 'image/webp') {
    return 'webp'
  }

  return 'jpg'
}

function addFiveYears(date: Date) {
  const retentionDate = new Date(date)

  retentionDate.setUTCFullYear(
    retentionDate.getUTCFullYear() + 5
  )

  return retentionDate
}

export async function POST(request: Request) {
  let uploadedPhotoPath: string | null = null

  try {
    const accessToken = getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        {
          error: 'Token de autenticação não informado.',
        },
        {
          status: 401,
        }
      )
    }

    const supabaseAdmin = createAdminClient()

    /*
     * 1. Identifica o usuário pelo JWT enviado
     * pelo GatePage.
     */
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    )

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            'Usuário não autenticado ou sessão expirada.',
        },
        {
          status: 401,
        }
      )
    }

    /*
     * 2. Lê os dados enviados pelo tablet.
     */
    const formData = await request.formData()

    const schoolId = String(
      formData.get('schoolId') || ''
    ).trim()

    const studentId = String(
      formData.get('studentId') || ''
    ).trim()

    const classId = String(
      formData.get('classId') || ''
    ).trim()

    const capturedAtValue = String(
      formData.get('capturedAt') || ''
    ).trim()

    const photoEntry = formData.get('photo')

    if (
      !schoolId ||
      !studentId ||
      !classId ||
      !capturedAtValue
    ) {
      return NextResponse.json(
        {
          error:
            'Dados incompletos para registrar a presença.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !photoEntry ||
      !(photoEntry instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            'A foto da chegada não foi enviada.',
        },
        {
          status: 400,
        }
      )
    }

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ])

    if (!allowedMimeTypes.has(photoEntry.type)) {
      return NextResponse.json(
        {
          error:
            'Formato da foto inválido. Utilize JPEG ou WebP.',
        },
        {
          status: 400,
        }
      )
    }

    if (photoEntry.size <= 0) {
      return NextResponse.json(
        {
          error: 'A foto enviada está vazia.',
        },
        {
          status: 400,
        }
      )
    }

    if (photoEntry.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            'A foto ultrapassou o limite de 2 MB.',
        },
        {
          status: 400,
        }
      )
    }

    const capturedAt = new Date(
      capturedAtValue
    )

    if (
      Number.isNaN(capturedAt.getTime())
    ) {
      return NextResponse.json(
        {
          error:
            'Horário da captura inválido.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * 3. Confere se o usuário pode operar
     * a portaria dessa escola.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from('school_memberships')
      .select('role, status')
      .eq('school_id', schoolId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (
      membershipError ||
      !membership ||
      !['admin', 'gestor', 'professor'].includes(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Usuário sem permissão para operar a portaria.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 4. Busca o perfil do aluno.
     *
     * O número do WhatsApp será obtido
     * exclusivamente de responsible_whatsapp.
     */
    const {
      data: student,
      error: studentError,
    } = await supabaseAdmin
      .from('students')
      .select(`
        id,
        school_id,
        full_name,
        responsible_whatsapp
      `)
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (studentError || !student) {
      return NextResponse.json(
        {
          error:
            'Aluno não encontrado nesta escola.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * 5. Confere a turma.
     */
    const {
      data: schoolClass,
      error: classError,
    } = await supabaseAdmin
      .from('classes')
      .select('id, school_id, name')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (classError || !schoolClass) {
      return NextResponse.json(
        {
          error:
            'Turma não encontrada nesta escola.',
        },
        {
          status: 404,
        }
      )
    }

    /*
     * 6. Confere se o aluno realmente está
     * matriculado nessa turma.
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, class_id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .maybeSingle()

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        {
          error:
            'O aluno não está matriculado nessa turma.',
        },
        {
          status: 400,
        }
      )
    }

    const attendanceDate =
      getDateInTimeZone(
        capturedAt,
        SCHOOL_TIMEZONE
      )

    /*
     * 7. Verifica duplicidade antes de enviar
     * a foto ao Storage.
     */
    const {
      data: existingAttendance,
      error: existingAttendanceError,
    } = await supabaseAdmin
      .from('attendance_records')
      .select(`
        id,
        status,
        source,
        updated_at
      `)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('attendance_date', attendanceDate)
      .maybeSingle()

    if (existingAttendanceError) {
      console.error(
        '[CONFIRMAÇÃO FACIAL] erro ao consultar presença:',
        existingAttendanceError
      )

      return NextResponse.json(
        {
          error:
            'Erro ao consultar a presença do aluno.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      existingAttendance?.status === 'present'
    ) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        attendanceRecordId:
          existingAttendance.id,
        studentName: student.full_name,
        className: schoolClass.name,
        capturedAt:
          existingAttendance.updated_at ||
          capturedAt.toISOString(),
        whatsappQueued: false,
        whatsappStatus: 'not_queued',
      })
    }

    /*
     * 8. Monta o caminho privado da foto.
     */
    const extension = getPhotoExtension(
      photoEntry.type
    )

    const [year, month, day] =
      attendanceDate.split('-')

    uploadedPhotoPath = [
      schoolId,
      year,
      month,
      day,
      studentId,
      `${randomUUID()}.${extension}`,
    ].join('/')

    const photoBuffer = Buffer.from(
      await photoEntry.arrayBuffer()
    )

    const {
      error: photoUploadError,
    } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(
        uploadedPhotoPath,
        photoBuffer,
        {
          contentType: photoEntry.type,
          cacheControl: '3600',
          upsert: false,
        }
      )

    if (photoUploadError) {
      console.error(
        '[CONFIRMAÇÃO FACIAL] erro no upload:',
        photoUploadError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível armazenar a foto da chegada.',
        },
        {
          status: 500,
        }
      )
    }

    /*
     * 9. Atualiza a presença ausente criada
     * anteriormente ou cria uma nova presença.
     */
    let attendanceRecordId: string

    if (existingAttendance) {
      const {
        data: updatedAttendance,
        error: updateAttendanceError,
      } = await supabaseAdmin
        .from('attendance_records')
        .update({
          status: 'present',
          source: 'facial',
          recorded_by_user_id: user.id,
          updated_at: capturedAt.toISOString(),
        })
        .eq('id', existingAttendance.id)
        .select('id')
        .single()

      if (
        updateAttendanceError ||
        !updatedAttendance
      ) {
        await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .remove([uploadedPhotoPath])

        uploadedPhotoPath = null

        throw (
          updateAttendanceError ||
          new Error(
            'Presença não atualizada.'
          )
        )
      }

      attendanceRecordId =
        updatedAttendance.id
    } else {
      const {
        data: insertedAttendance,
        error: insertAttendanceError,
      } = await supabaseAdmin
        .from('attendance_records')
        .insert({
          school_id: schoolId,
          student_id: studentId,
          class_id: classId,
          attendance_date: attendanceDate,
          status: 'present',
          source: 'facial',
          recorded_by_user_id: user.id,
          created_at: capturedAt.toISOString(),
          updated_at: capturedAt.toISOString(),
        })
        .select('id')
        .single()

      if (
        insertAttendanceError ||
        !insertedAttendance
      ) {
        await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .remove([uploadedPhotoPath])

        uploadedPhotoPath = null

        throw (
          insertAttendanceError ||
          new Error(
            'Presença não criada.'
          )
        )
      }

      attendanceRecordId =
        insertedAttendance.id
    }

    /*
     * 10. Confere se a escola contratou
     * o adicional.
     */
    const now = new Date()

    const {
      data: addonSubscription,
      error: addonError,
    } = await supabaseAdmin
      .from('school_addon_subscriptions')
      .select(`
        id,
        status,
        current_period_start,
        current_period_end,
        student_limit
      `)
      .eq('school_id', schoolId)
      .eq(
        'addon_code',
        'arrival_photo_whatsapp'
      )
      .eq('status', 'active')
      .maybeSingle()

    if (addonError) {
      console.error(
        '[CONFIRMAÇÃO FACIAL] erro ao consultar adicional:',
        addonError
      )
    }

    const addonStarted =
      !addonSubscription?.current_period_start ||
      new Date(
        addonSubscription.current_period_start
      ) <= now

    const addonNotExpired =
      !addonSubscription?.current_period_end ||
      new Date(
        addonSubscription.current_period_end
      ) >= now

    const addonIsActive = Boolean(
      addonSubscription &&
      addonStarted &&
      addonNotExpired
    )

    /*
     * O número original continua no perfil.
     * Aqui criamos apenas uma versão normalizada
     * para a API do WhatsApp.
     */
    const responsibleWhatsApp =
      normalizeWhatsApp(
        student.responsible_whatsapp
      )

    let whatsappStatus:
      | 'not_contracted'
      | 'no_phone'
      | 'queued'

    if (!addonIsActive) {
      whatsappStatus = 'not_contracted'
    } else if (!responsibleWhatsApp) {
      whatsappStatus = 'no_phone'
    } else {
      whatsappStatus = 'queued'
    }

    /*
     * 11. Cria o comprovante.
     */
    const retentionUntil =
      addFiveYears(capturedAt)

    const {
      data: evidence,
      error: evidenceError,
    } = await supabaseAdmin
      .from('attendance_evidence')
      .insert({
        school_id: schoolId,
        attendance_record_id:
          attendanceRecordId,
        student_id: studentId,
        class_id: classId,
        source: 'facial',
        photo_bucket: PHOTO_BUCKET,
        photo_path: uploadedPhotoPath,
        captured_at:
          capturedAt.toISOString(),
        retention_until:
          retentionUntil.toISOString(),
        device_info: {
          userAgent:
            request.headers.get(
              'user-agent'
            ) || null,
        },
        whatsapp_status:
          whatsappStatus,
        created_by_user_id: user.id,
      })
      .select('id')
      .single()

    if (evidenceError || !evidence) {
      console.error(
        '[CONFIRMAÇÃO FACIAL] erro ao criar comprovante:',
        evidenceError
      )

      await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .remove([uploadedPhotoPath])

      uploadedPhotoPath = null

      return NextResponse.json(
        {
          error:
            'A presença foi localizada, mas não foi possível criar o comprovante da chegada.',
        },
        {
          status: 500,
        }
      )
    }

    /*
     * 12. Adiciona a mensagem à fila.
     *
     * Nenhuma chamada à API do WhatsApp
     * é feita neste endpoint.
     */
    let whatsappQueued = false

    if (
      whatsappStatus === 'queued' &&
      responsibleWhatsApp
    ) {
      const {
        error: queueError,
      } = await supabaseAdmin
        .from(
          'whatsapp_notification_queue'
        )
        .insert({
          school_id: schoolId,
          student_id: studentId,
          attendance_evidence_id:
            evidence.id,
          destination_phone:
            responsibleWhatsApp,
          notification_type:
            'student_arrival',
          payload: {
            studentName:
              student.full_name,
            className:
              schoolClass.name,
            arrivalTime:
              capturedAt.toISOString(),
            attendanceDate,
            photoBucket:
              PHOTO_BUCKET,
            photoPath:
              uploadedPhotoPath,
          },
          status: 'queued',
          next_attempt_at:
            new Date().toISOString(),
        })

      if (queueError) {
        console.error(
          '[CONFIRMAÇÃO FACIAL] erro ao enfileirar WhatsApp:',
          queueError
        )

        /*
         * Falha no enfileiramento não desfaz
         * a presença do aluno.
         */
        await supabaseAdmin
          .from('attendance_evidence')
          .update({
            whatsapp_status: 'failed',
            whatsapp_error:
              queueError.message,
          })
          .eq('id', evidence.id)
      } else {
        whatsappQueued = true
      }
    }

    return NextResponse.json({
      success: true,
      duplicate: false,
      attendanceRecordId,
      evidenceId: evidence.id,
      studentName: student.full_name,
      className: schoolClass.name,
      capturedAt:
        capturedAt.toISOString(),
      whatsappQueued,
      whatsappStatus:
        whatsappQueued
          ? 'queued'
          : whatsappStatus,
    })
  } catch (error) {
    console.error(
      '[CONFIRMAÇÃO FACIAL] erro inesperado:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao confirmar presença facial.',
      },
      {
        status: 500,
      }
    )
  }
}