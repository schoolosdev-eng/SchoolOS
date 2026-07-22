import { randomUUID } from 'crypto'
import {
  after,
  NextResponse,
} from 'next/server'
import {
  processWhatsAppQueue,
} from '@/lib/whatsapp/processWhatsAppQueue'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PHOTO_BUCKET = 'attendance-proof-photos'
const SCHOOL_TIMEZONE = 'America/Fortaleza'

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Variáveis administrativas do Supabase não configuradas.'
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
      'Não foi possível determinar a data da saída.'
    )
  }

  return `${year}-${month}-${day}`
}

function getTimeInTimeZone(
  date: Date,
  timeZone: string
) {
  const parts = new Intl.DateTimeFormat(
    'en-GB',
    {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }
  ).formatToParts(date)

  const hour = parts.find(
    (part) => part.type === 'hour'
  )?.value

  const minute = parts.find(
    (part) => part.type === 'minute'
  )?.value

  const second = parts.find(
    (part) => part.type === 'second'
  )?.value

  if (!hour || !minute || !second) {
    throw new Error(
      'Não foi possível determinar o horário da saída.'
    )
  }

  return `${hour}:${minute}:${second}`
}

function normalizeWhatsApp(
  value: string | null | undefined
) {
  const digits =
    value?.replace(/\D/g, '') || ''

  if (!digits) {
    return null
  }

  const normalized = digits.startsWith('55')
    ? digits
    : `55${digits}`

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
  try {
    const accessToken =
      getBearerToken(request)

    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            'Token de autenticação não informado.',
        },
        {
          status: 401,
        }
      )
    }

    const supabaseAdmin =
      createAdminClient()

    /*
     * 1. Identifica o usuário da portaria.
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
    const formData =
      await request.formData()

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

    const photoEntry =
      formData.get('photo')

    if (
      !schoolId ||
      !studentId ||
      !classId ||
      !capturedAtValue
    ) {
      return NextResponse.json(
        {
          error:
            'Dados incompletos para registrar a saída.',
        },
        {
          status: 400,
        }
      )
    }

    const capturedAt =
      new Date(capturedAtValue)

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
     * 3. Confere a permissão do usuário.
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
      ![
        'admin',
        'gestor',
        'professor',
      ].includes(membership.role)
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
     * 4. Verifica obrigatoriamente o adicional
     * de saída normal.
     */
    const now = new Date()

    const {
      data: addonSubscription,
      error: addonError,
    } = await supabaseAdmin
      .from('school_addon_subscriptions')
      .select(`
        id,
        addon_code,
        status,
        student_limit,
        current_period_start,
        current_period_end
      `)
      .eq('school_id', schoolId)
      .eq(
        'addon_code',
        'regular_exit_photo_whatsapp'
      )
      .eq('status', 'active')
      .maybeSingle()

    if (addonError) {
      console.error(
        '[SAÍDA NORMAL] erro ao consultar adicional:',
        addonError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível verificar o adicional de saída.',
        },
        {
          status: 500,
        }
      )
    }

    const addonStarted =
      !addonSubscription
        ?.current_period_start ||
      new Date(
        addonSubscription.current_period_start
      ).getTime() <= now.getTime()

    const addonNotExpired =
      !addonSubscription
        ?.current_period_end ||
      new Date(
        addonSubscription.current_period_end
      ).getTime() >= now.getTime()

    const exitAddonIsActive = Boolean(
      addonSubscription &&
      addonStarted &&
      addonNotExpired
    )

    if (!exitAddonIsActive) {
      return NextResponse.json(
        {
          error:
            'A escola não possui o adicional de saída normal ativo.',
          code: 'REGULAR_EXIT_ADDON_REQUIRED',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 5. Como o recurso contratado inclui
     * comprovação fotográfica, a foto é
     * obrigatória.
     */
    if (
      !photoEntry ||
      !(photoEntry instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            'A foto da saída não foi enviada.',
        },
        {
          status: 400,
        }
      )
    }

    const allowedMimeTypes =
      new Set([
        'image/jpeg',
        'image/jpg',
        'image/webp',
      ])

    if (
      !allowedMimeTypes.has(
        photoEntry.type
      )
    ) {
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
          error:
            'A foto da saída está vazia.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      photoEntry.size >
      2 * 1024 * 1024
    ) {
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

    /*
     * 6. Busca o aluno e o WhatsApp atual
     * cadastrado no perfil.
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
     * 7. Confere a turma.
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
     * 8. Confere a matrícula.
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

    if (
      enrollmentError ||
      !enrollment
    ) {
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

    const exitDate =
      getDateInTimeZone(
        capturedAt,
        SCHOOL_TIMEZONE
      )

    const exitTime =
      getTimeInTimeZone(
        capturedAt,
        SCHOOL_TIMEZONE
      )

    /*
     * 9. A saída comum exige presença
     * registrada no mesmo dia.
     */
    const {
      data: attendanceRecord,
      error: attendanceError,
    } = await supabaseAdmin
      .from('attendance_records')
      .select(`
        id,
        status,
        updated_at
      `)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('attendance_date', exitDate)
      .maybeSingle()

    if (attendanceError) {
      console.error(
        '[SAÍDA NORMAL] erro ao consultar entrada:',
        attendanceError
      )

      return NextResponse.json(
        {
          error:
            'Erro ao verificar a entrada do aluno.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !attendanceRecord ||
      attendanceRecord.status !==
        'present'
    ) {
      return NextResponse.json(
        {
          error:
            'Saída não permitida. O aluno ainda não possui entrada registrada hoje.',
          code:
            'ENTRY_NOT_REGISTERED',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * 10. Impede uma segunda saída normal.
     */
    const {
      data: existingRegularExit,
      error: regularExitError,
    } = await supabaseAdmin
      .from('student_regular_exits')
      .select(`
        id,
        exit_time,
        recorded_at
      `)
      .eq(
        'attendance_record_id',
        attendanceRecord.id
      )
      .maybeSingle()

    if (regularExitError) {
      console.error(
        '[SAÍDA NORMAL] erro ao consultar saída existente:',
        regularExitError
      )

      return NextResponse.json(
        {
          error:
            'Erro ao verificar saídas anteriores.',
        },
        {
          status: 500,
        }
      )
    }

    if (existingRegularExit) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        regularExitId:
          existingRegularExit.id,
        studentName:
          student.full_name,
        className:
          schoolClass.name,
        exitTime:
          existingRegularExit.exit_time,
        capturedAt:
          existingRegularExit.recorded_at,
        whatsappQueued: false,
        whatsappStatus:
          'not_queued',
      })
    }

    /*
     * 11. Uma saída antecipada já registrada
     * impede a saída normal.
     */
    const {
      data: earlyExits,
      error: earlyExitError,
    } = await supabaseAdmin
      .from('student_early_exits')
      .select(`
        id,
        exit_time
      `)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('exit_date', exitDate)
      .limit(1)

    if (earlyExitError) {
      console.error(
        '[SAÍDA NORMAL] erro ao consultar saída antecipada:',
        earlyExitError
      )

      return NextResponse.json(
        {
          error:
            'Erro ao verificar a saída antecipada.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      earlyExits &&
      earlyExits.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            `O aluno já possui saída antecipada registrada às ${earlyExits[0].exit_time}.`,
          code:
            'EARLY_EXIT_ALREADY_REGISTERED',
        },
        {
          status: 409,
        }
      )
    }

    /*
     * 12. Armazena a foto da saída.
     */
    const extension =
      getPhotoExtension(
        photoEntry.type
      )

    const [year, month, day] =
      exitDate.split('-')

    const photoPath = [
      schoolId,
      year,
      month,
      day,
      studentId,
      `regular-exit-${randomUUID()}.${extension}`,
    ].join('/')

    const photoBuffer =
      Buffer.from(
        await photoEntry.arrayBuffer()
      )

    const {
      error: photoUploadError,
    } = await supabaseAdmin.storage
      .from(PHOTO_BUCKET)
      .upload(
        photoPath,
        photoBuffer,
        {
          contentType:
            photoEntry.type,
          cacheControl: '3600',
          upsert: false,
        }
      )

    if (photoUploadError) {
      console.error(
        '[SAÍDA NORMAL] erro ao salvar foto:',
        photoUploadError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível armazenar a foto da saída.',
        },
        {
          status: 500,
        }
      )
    }

    const responsibleWhatsApp =
      normalizeWhatsApp(
        student.responsible_whatsapp
      )

    const whatsappStatus:
      | 'queued'
      | 'no_phone' =
      responsibleWhatsApp
        ? 'queued'
        : 'no_phone'

    const retentionUntil =
      addFiveYears(capturedAt)

    /*
     * 13. Registra a saída normal.
     *
     * attendance_records não é alterada.
     */
    const {
      data: regularExit,
      error: insertExitError,
    } = await supabaseAdmin
      .from('student_regular_exits')
      .insert({
        school_id: schoolId,

        attendance_record_id:
          attendanceRecord.id,

        student_id: studentId,

        class_id: classId,

        exit_date: exitDate,

        exit_time: exitTime,

        recorded_at:
          capturedAt.toISOString(),

        source: 'facial',

        photo_bucket:
          PHOTO_BUCKET,

        photo_path: photoPath,

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

        recorded_by_user_id:
          user.id,
      })
      .select('id')
      .single()

    if (
      insertExitError ||
      !regularExit
    ) {
      console.error(
        '[SAÍDA NORMAL] erro ao registrar saída:',
        insertExitError
      )

      await supabaseAdmin.storage
        .from(PHOTO_BUCKET)
        .remove([photoPath])

      if (
        insertExitError?.code ===
        '23505'
      ) {
        return NextResponse.json(
          {
            error:
              'A saída normal deste aluno já foi registrada.',
            code:
              'REGULAR_EXIT_ALREADY_REGISTERED',
          },
          {
            status: 409,
          }
        )
      }

      return NextResponse.json(
        {
          error:
            'Não foi possível registrar a saída normal.',
        },
        {
          status: 500,
        }
      )
    }

    const baseResponse = {
      success: true,
      duplicate: false,
      regularExitId:
        regularExit.id,
      studentName:
        student.full_name,
      className:
        schoolClass.name,
      exitDate,
      exitTime,
      capturedAt:
        capturedAt.toISOString(),
      photoSaved: true,
    }

    /*
     * 14. Sem telefone, mantém a saída
     * e a foto registradas.
     */
    if (!responsibleWhatsApp) {
      return NextResponse.json({
        ...baseResponse,
        whatsappQueued: false,
        whatsappStatus:
          'no_phone',
        warning:
          'A saída foi registrada, mas o aluno não possui WhatsApp válido cadastrado.',
      })
    }

    /*
     * 15. Adiciona a mensagem à fila.
     *
     * Nenhuma chamada à Meta acontece aqui.
     */
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
          null,

        regular_exit_id:
          regularExit.id,

        destination_phone:
          responsibleWhatsApp,

        notification_type:
          'student_departure',

        payload: {
          studentName:
            student.full_name,

          className:
            schoolClass.name,

          departureTime:
            capturedAt.toISOString(),

          exitDate,

          photoBucket:
            PHOTO_BUCKET,

          photoPath,
        },

        status: 'queued',

        next_attempt_at:
          new Date().toISOString(),
      })

    if (queueError) {
      console.error(
        '[SAÍDA NORMAL] erro ao enfileirar WhatsApp:',
        queueError
      )

      await supabaseAdmin
        .from(
          'student_regular_exits'
        )
        .update({
          whatsapp_status:
            'failed',

          whatsapp_error:
            queueError.message,
        })
        .eq('id', regularExit.id)

      return NextResponse.json({
        ...baseResponse,
        whatsappQueued: false,
        whatsappStatus:
          'failed',
        warning:
          'A saída e a foto foram registradas, mas a mensagem não pôde ser adicionada à fila.',
      })
    }

    after(async () => {
  try {
    await processWhatsAppQueue(3)
  } catch (error) {
    console.error(
      '[SAÍDA NORMAL] erro no processamento assíncrono do WhatsApp:',
      error
    )
  }
})

    return NextResponse.json({
      ...baseResponse,
      whatsappQueued: true,
      whatsappStatus: 'queued',
    })
  } catch (error) {
    console.error(
      '[SAÍDA NORMAL] erro inesperado:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao registrar a saída normal.',
      },
      {
        status: 500,
      }
    )
  }
}