import { randomUUID } from 'crypto'
import {
  after,
  NextResponse,
} from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import {
  processWhatsAppQueue,
} from '@/lib/whatsapp/processWhatsAppQueue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PHOTO_BUCKET =
  'attendance-proof-photos'

const PROFILE_PHOTO_BUCKET =
  'student-profile-photos'

const SCHOOL_TIMEZONE =
  'America/Fortaleza'

type RegularExitSource =
  | 'facial'
  | 'qr'

type PhotoOrigin =
  | 'facial_capture'
  | 'profile_snapshot'

function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
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

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      'authorization'
    )

  if (
    !authorization?.startsWith(
      'Bearer '
    )
  ) {
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
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(date)

  const year = parts.find(
    (part) =>
      part.type === 'year'
  )?.value

  const month = parts.find(
    (part) =>
      part.type === 'month'
  )?.value

  const day = parts.find(
    (part) =>
      part.type === 'day'
  )?.value

  if (
    !year ||
    !month ||
    !day
  ) {
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
  const parts =
    new Intl.DateTimeFormat(
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
    (part) =>
      part.type === 'hour'
  )?.value

  const minute = parts.find(
    (part) =>
      part.type === 'minute'
  )?.value

  const second = parts.find(
    (part) =>
      part.type === 'second'
  )?.value

  if (
    !hour ||
    !minute ||
    !second
  ) {
    throw new Error(
      'Não foi possível determinar o horário da saída.'
    )
  }

  return `${hour}:${minute}:${second}`
}

function normalizeWhatsApp(
  value:
    | string
    | null
    | undefined
) {
  const digits =
    value?.replace(/\D/g, '') ||
    ''

  if (!digits) {
    return null
  }

  const normalized =
    digits.startsWith('55')
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

function addFiveYears(
  date: Date
) {
  const retentionDate =
    new Date(date)

  retentionDate.setUTCFullYear(
    retentionDate.getUTCFullYear() +
      5
  )

  return retentionDate
}

/*
 * Converte qualquer imagem aceita pelo
 * Sharp em JPEG, redimensionando imagens
 * excessivamente grandes.
 */
async function normalizePhotoToJpeg(
  buffer: Buffer
) {
  const {
    data,
    info,
  } = await sharp(buffer)
    .rotate()

    /*
     * Remove transparência e garante
     * uma imagem RGB com fundo branco.
     */
    .flatten({
      background: {
        r: 255,
        g: 255,
        b: 255,
      },
    })

    .resize({
      width: 1280,
      height: 1280,
      fit: 'inside',
      withoutEnlargement: true,
    })

    /*
     * Força espaço de cores padrão.
     */
    .toColourspace('srgb')

    /*
     * JPEG básico, não progressivo
     * e sem otimização MozJPEG.
     */
    .jpeg({
      quality: 85,
      progressive: false,
      chromaSubsampling: '4:2:0',
      mozjpeg: false,
      optimiseCoding: true,
    })

    .toBuffer({
      resolveWithObject: true,
    })

  /*
   * Confere o arquivo final já codificado.
   */
  const metadata =
    await sharp(data).metadata()

  if (
    info.format !== 'jpeg' ||
    metadata.format !== 'jpeg' ||
    metadata.channels !== 3 ||
    metadata.depth !== 'uchar' ||
    metadata.isProgressive === true
  ) {
    console.error(
      '[FOTO DE CHEGADA] JPEG incompatível:',
      {
        info,
        metadata: {
          format:
            metadata.format,
          space:
            metadata.space,
          channels:
            metadata.channels,
          depth:
            metadata.depth,
          isProgressive:
            metadata.isProgressive,
          width:
            metadata.width,
          height:
            metadata.height,
        },
      }
    )

    throw new Error(
      'A foto não pôde ser convertida para JPEG RGB de 8 bits.'
    )
  }

  console.log(
    '[FOTO DE CHEGADA] JPEG validado:',
    {
      width:
        metadata.width,
      height:
        metadata.height,
      channels:
        metadata.channels,
      depth:
        metadata.depth,
      progressive:
        metadata.isProgressive,
      bytes:
        data.length,
    }
  )

  return Buffer.from(data)
}

export async function POST(
  request: Request
) {
  let uploadedPhotoPath:
    | string
    | null = null

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
     * 1. Identifica o usuário.
     */
    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      )

    if (
      userError ||
      !user
    ) {
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
     * 2. Lê os dados enviados.
     *
     * source é opcional temporariamente
     * para preservar o fluxo facial atual.
     */
    const formData =
      await request.formData()

    const schoolId = String(
      formData.get('schoolId') ||
        ''
    ).trim()

    const studentId = String(
      formData.get('studentId') ||
        ''
    ).trim()

    const classId = String(
      formData.get('classId') ||
        ''
    ).trim()

    const capturedAtValue =
      String(
        formData.get(
          'capturedAt'
        ) || ''
      ).trim()

    const sourceValue =
      String(
        formData.get('source') ||
          'facial'
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

    if (
      sourceValue !== 'facial' &&
      sourceValue !== 'qr'
    ) {
      return NextResponse.json(
        {
          error:
            'Fonte da saída inválida.',
        },
        {
          status: 400,
        }
      )
    }

    const source =
      sourceValue as RegularExitSource

    const capturedAt =
      new Date(
        capturedAtValue
      )

    if (
      Number.isNaN(
        capturedAt.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Horário da saída inválido.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * 3. Verifica a permissão.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from(
        'school_memberships'
      )
      .select('role, status')
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'user_id',
        user.id
      )
      .eq(
        'status',
        'active'
      )
      .maybeSingle()

    if (
      membershipError ||
      !membership ||
      ![
        'admin',
        'gestor',
        'professor',
      ].includes(
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
     * 4. A escola precisa possuir o
     * adicional de saída ativo.
     *
     * A cobertura individual será
     * verificada posteriormente.
     */
    const now = new Date()

    const {
      data: addonSubscription,
      error: addonError,
    } = await supabaseAdmin
      .from(
        'school_addon_subscriptions'
      )
      .select(`
        id,
        status,
        coverage_mode,
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

    const addonStartTime =
  addonSubscription
    ?.current_period_start
    ? new Date(
        addonSubscription.current_period_start
      ).getTime()
    : Number.NaN

const addonEndTime =
  addonSubscription
    ?.current_period_end
    ? new Date(
        addonSubscription.current_period_end
      ).getTime()
    : Number.NaN

const addonStudentLimit =
  Number(
    addonSubscription
      ?.student_limit ||
      0
  )

const schoolExitAddonActive =
  Boolean(
    addonSubscription &&
      addonSubscription.status ===
        'active' &&
      addonStudentLimit > 0 &&
      Number.isFinite(
        addonStartTime
      ) &&
      Number.isFinite(
        addonEndTime
      ) &&
      addonStartTime <=
        now.getTime() &&
      addonEndTime >
        now.getTime()
  )

    if (
      !schoolExitAddonActive
    ) {
      return NextResponse.json(
        {
          error:
            'A escola não possui o adicional de saída normal ativo.',
          code:
            'REGULAR_EXIT_ADDON_REQUIRED',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 5. Busca o aluno.
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
        profile_photo_path,
        responsible_whatsapp
      `)
      .eq('id', studentId)
      .eq(
        'school_id',
        schoolId
      )
      .maybeSingle()

    if (
      studentError ||
      !student
    ) {
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
     * 6. Confere turma e matrícula.
     */
    const {
      data: schoolClass,
      error: classError,
    } = await supabaseAdmin
      .from('classes')
      .select(
        'id, school_id, name'
      )
      .eq('id', classId)
      .eq(
        'school_id',
        schoolId
      )
      .maybeSingle()

    if (
      classError ||
      !schoolClass
    ) {
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

    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabaseAdmin
      .from('enrollments')
      .select(
        'student_id, class_id'
      )
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'student_id',
        studentId
      )
      .eq(
        'class_id',
        classId
      )
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
     * 7. Exige presença registrada.
     */
    const {
      data: attendanceRecord,
      error: attendanceError,
    } = await supabaseAdmin
      .from(
        'attendance_records'
      )
      .select(`
        id,
        status,
        updated_at
      `)
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'student_id',
        studentId
      )
      .eq(
        'class_id',
        classId
      )
      .eq(
        'attendance_date',
        exitDate
      )
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
     * 8. Impede saída duplicada.
     */
    const {
      data: existingRegularExit,
      error: existingExitError,
    } = await supabaseAdmin
      .from(
        'student_regular_exits'
      )
      .select(`
        id,
        exit_time,
        recorded_at,
        source,
        whatsapp_status
      `)
      .eq(
        'attendance_record_id',
        attendanceRecord.id
      )
      .maybeSingle()

    if (existingExitError) {
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
        source:
          existingRegularExit.source,
        whatsappQueued: false,
        whatsappStatus:
          existingRegularExit.whatsapp_status,
      })
    }

    /*
     * 9. Impede saída normal quando já
     * existe saída antecipada.
     */
    const {
      data: earlyExits,
      error: earlyExitError,
    } = await supabaseAdmin
      .from(
        'student_early_exits'
      )
      .select(
        'id, exit_time'
      )
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'student_id',
        studentId
      )
      .eq(
        'class_id',
        classId
      )
      .eq(
        'exit_date',
        exitDate
      )
      .limit(1)

    if (earlyExitError) {
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
     * 10. Verifica se este aluno possui
     * foto/WhatsApp do adicional.
     */
    const {
      data: studentAddonEligible,
      error: eligibilityError,
    } = await supabaseAdmin.rpc(
      'student_has_active_school_addon',
      {
        p_school_id:
          schoolId,

        p_student_id:
          studentId,

        p_addon_code:
          'regular_exit_photo_whatsapp',
      }
    )

    let addonEligible =
      studentAddonEligible ===
      true

    let eligibilityFailed =
      false

    if (eligibilityError) {
      console.error(
        '[SAÍDA NORMAL] erro ao consultar elegibilidade individual:',
        eligibilityError
      )

      /*
       * A falha premium não impede
       * o registro da saída.
       */
      addonEligible = false
      eligibilityFailed = true
    }

    /*
     * 11. Obtém a foto premium.
     *
     * Facial:
     * usa a captura atual.
     *
     * QR:
     * baixa e copia a foto de perfil.
     */
    let normalizedPhoto:
      | Buffer
      | null = null

    let photoOrigin:
      | PhotoOrigin
      | null = null

    let photoWarning:
      | string
      | null = null

    if (addonEligible) {
      if (source === 'facial') {
        if (
          !photoEntry ||
          !(
            photoEntry instanceof
            File
          )
        ) {
          photoWarning =
            'A captura facial da saída não foi recebida.'
        } else if (
          photoEntry.size <= 0
        ) {
          photoWarning =
            'A captura facial da saída está vazia.'
        } else if (
          photoEntry.size >
          2 * 1024 * 1024
        ) {
          photoWarning =
            'A captura facial ultrapassou o limite de 2 MB.'
        } else {
          try {
            const originalBuffer =
              Buffer.from(
                await photoEntry.arrayBuffer()
              )

            normalizedPhoto =
              await normalizePhotoToJpeg(
                originalBuffer
              )

            photoOrigin =
              'facial_capture'
          } catch (error) {
            console.error(
              '[SAÍDA NORMAL] erro ao normalizar captura facial:',
              error
            )

            photoWarning =
              'Não foi possível preparar a foto capturada na saída.'
          }
        }
      }

      if (source === 'qr') {
        if (
          !student.profile_photo_path
        ) {
          photoWarning =
            'O aluno não possui foto de perfil cadastrada.'
        } else {
          const {
            data: profilePhotoBlob,
            error:
              profilePhotoError,
          } =
            await supabaseAdmin.storage
              .from(
                PROFILE_PHOTO_BUCKET
              )
              .download(
                student.profile_photo_path
              )

          if (
            profilePhotoError ||
            !profilePhotoBlob
          ) {
            console.error(
              '[SAÍDA NORMAL] erro ao baixar foto de perfil:',
              profilePhotoError
            )

            photoWarning =
              'Não foi possível acessar a foto de perfil do aluno.'
          } else {
            try {
              const profileBuffer =
                Buffer.from(
                  await profilePhotoBlob.arrayBuffer()
                )

              normalizedPhoto =
                await normalizePhotoToJpeg(
                  profileBuffer
                )

              photoOrigin =
                'profile_snapshot'
            } catch (error) {
              console.error(
                '[SAÍDA NORMAL] erro ao normalizar foto de perfil:',
                error
              )

              photoWarning =
                'Não foi possível preparar a foto de perfil do aluno.'
            }
          }
        }
      }
    }

    /*
     * 12. Salva a cópia privada.
     */
    if (
      addonEligible &&
      normalizedPhoto &&
      photoOrigin
    ) {
      const [
        year,
        month,
        day,
      ] = exitDate.split('-')

      uploadedPhotoPath = [
        schoolId,
        year,
        month,
        day,
        studentId,
        `regular-exit-${source}-${randomUUID()}.jpg`,
      ].join('/')

      const photoUploadBytes =
  Uint8Array.from(
    normalizedPhoto
  )

const {
  error: uploadError,
} =
  await supabaseAdmin.storage
    .from(PHOTO_BUCKET)
    .upload(
      uploadedPhotoPath,
      photoUploadBytes,
      {
        contentType:
          'image/jpeg',

        cacheControl:
          '3600',

        upsert: false,
      }
    )

      if (uploadError) {
        console.error(
          '[SAÍDA NORMAL] erro ao armazenar foto:',
          uploadError
        )

        uploadedPhotoPath =
          null

        photoOrigin = null

        photoWarning =
          'A saída foi registrada, mas não foi possível armazenar a foto.'
      }
    }

    const responsibleWhatsApp =
      normalizeWhatsApp(
        student.responsible_whatsapp
      )

    let whatsappStatus:
      | 'not_selected'
      | 'no_phone'
      | 'no_photo'
      | 'queued'
      | 'failed'

    if (eligibilityFailed) {
      whatsappStatus = 'failed'
    } else if (!addonEligible) {
      whatsappStatus =
        'not_selected'
    } else if (
      !uploadedPhotoPath
    ) {
      whatsappStatus =
        'no_photo'
    } else if (
      !responsibleWhatsApp
    ) {
      whatsappStatus =
        'no_phone'
    } else {
      whatsappStatus =
        'queued'
    }

    const retentionUntil =
      uploadedPhotoPath
        ? addFiveYears(
            capturedAt
          )
        : null

    /*
     * 13. Registra a saída mesmo que
     * foto ou WhatsApp falhem.
     */
    const {
      data: regularExit,
      error: insertExitError,
    } = await supabaseAdmin
      .from(
        'student_regular_exits'
      )
      .insert({
        school_id:
          schoolId,

        attendance_record_id:
          attendanceRecord.id,

        student_id:
          studentId,

        class_id:
          classId,

        exit_date:
          exitDate,

        exit_time:
          exitTime,

        recorded_at:
          capturedAt.toISOString(),

        source,

        addon_eligible:
          addonEligible,

        photo_bucket:
          uploadedPhotoPath
            ? PHOTO_BUCKET
            : null,

        photo_path:
          uploadedPhotoPath,

        photo_origin:
          photoOrigin,

        captured_at:
          uploadedPhotoPath
            ? capturedAt.toISOString()
            : null,

        retention_until:
          retentionUntil
            ?.toISOString() ||
          null,

        device_info: {
          userAgent:
            request.headers.get(
              'user-agent'
            ) || null,

          source,
        },

        whatsapp_status:
          whatsappStatus,

        whatsapp_error:
          eligibilityFailed
            ? 'Falha ao verificar a elegibilidade individual.'
            : photoWarning,

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

      if (
        uploadedPhotoPath
      ) {
        await supabaseAdmin
          .storage
          .from(
            PHOTO_BUCKET
          )
          .remove([
            uploadedPhotoPath,
          ])
      }

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
      source,
      addonEligible,
      photoSaved:
        Boolean(
          uploadedPhotoPath
        ),
      photoOrigin,
    }

    /*
     * 14. Não cria fila quando o
     * aluno não pode receber mensagem.
     */
    if (
      whatsappStatus !== 'queued' ||
      !responsibleWhatsApp ||
      !uploadedPhotoPath
    ) {
      const warnings: string[] =
        []

      if (eligibilityFailed) {
        warnings.push(
          'A saída foi registrada, mas não foi possível verificar a cobertura do aluno.'
        )
      } else if (
        !addonEligible
      ) {
        warnings.push(
          'A saída foi registrada. Este aluno não está selecionado para receber foto e WhatsApp.'
        )
      }

      if (photoWarning) {
        warnings.push(
          photoWarning
        )
      }

      if (
        addonEligible &&
        !responsibleWhatsApp
      ) {
        warnings.push(
          'O aluno não possui WhatsApp válido cadastrado.'
        )
      }

      return NextResponse.json({
        ...baseResponse,
        whatsappQueued:
          false,
        whatsappStatus,
        warning:
          warnings.join(' ') ||
          undefined,
      })
    }

    /*
     * 15. Enfileira a mensagem.
     */
    const {
      error: queueError,
    } = await supabaseAdmin
      .from(
        'whatsapp_notification_queue'
      )
      .insert({
        school_id:
          schoolId,

        student_id:
          studentId,

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

          source,

          photoOrigin,

          photoBucket:
            PHOTO_BUCKET,

          photoPath:
            uploadedPhotoPath,
        },

        status:
          'queued',

        next_attempt_at:
          new Date()
            .toISOString(),
      })

    if (queueError) {
      console.error(
        '[SAÍDA NORMAL] erro ao enfileirar mensagem:',
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
        .eq(
          'id',
          regularExit.id
        )

      return NextResponse.json({
        ...baseResponse,
        whatsappQueued:
          false,
        whatsappStatus:
          'failed',
        warning:
          'A saída e a foto foram registradas, mas a mensagem não pôde ser adicionada à fila.',
      })
    }

    after(async () => {
  try {
    await processWhatsAppQueue(1)
  } catch (error) {
    console.error(
      '[SAÍDA NORMAL] erro no processamento assíncrono do WhatsApp:',
      error
    )
  }
})

    return NextResponse.json({
      ...baseResponse,
      whatsappQueued:
        true,
      whatsappStatus:
        'queued',
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