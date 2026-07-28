import { randomUUID } from 'crypto'
import {
  after,
  NextResponse,
} from 'next/server'
import {
  processWhatsAppQueue,
} from '@/lib/whatsapp/processWhatsAppQueue'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
 * 8. Registra a presença primeiro.
 *
 * A presença facial pertence ao funcionamento
 * normal do modo portaria e não depende do
 * adicional de foto e WhatsApp.
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
    throw (
      updateAttendanceError ||
      new Error(
        'Não foi possível atualizar a presença.'
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
    throw (
      insertAttendanceError ||
      new Error(
        'Não foi possível criar a presença.'
      )
    )
  }

  attendanceRecordId =
    insertedAttendance.id
}

const baseResponse = {
  success: true,
  duplicate: false,
  attendanceRecordId,
  studentName: student.full_name,
  className: schoolClass.name,
  capturedAt: capturedAt.toISOString(),
}

/*
 * 9. Verifica se este aluno possui
 * acesso ao adicional de entrada.
 *
 * A função considera:
 * - assinatura ativa;
 * - datas de vigência;
 * - cobertura para todos;
 * - ou seleção individual do aluno.
 */
const {
  data: arrivalAddonEligible,
  error: addonEligibilityError,
} = await supabaseAdmin.rpc(
  'student_has_active_school_addon',
  {
    p_school_id: schoolId,
    p_student_id: studentId,
    p_addon_code:
      'arrival_photo_whatsapp',
  }
)

if (addonEligibilityError) {
  console.error(
    '[CONFIRMAÇÃO FACIAL] erro ao verificar elegibilidade do aluno:',
    addonEligibilityError
  )

  /*
   * A presença já foi registrada.
   * Um erro na verificação premium não pode
   * impedir a entrada nem travar a portaria.
   */
  return NextResponse.json({
    ...baseResponse,
    addonEligible: false,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus:
      'eligibility_check_failed',
    warning:
      'A presença foi registrada, mas não foi possível verificar o adicional de mensagens.',
  })
}

/*
 * Aluno não coberto pelo adicional:
 * registra apenas a presença.
 */
if (arrivalAddonEligible !== true) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: false,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus:
      'not_eligible',
  })
}

/*
 * 10. A foto só é obrigatória quando o
 * adicional de entrada estiver ativo.
 */
if (
  !photoEntry ||
  !(photoEntry instanceof File)
) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas a foto da chegada não foi recebida.',
  })
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

if (!allowedMimeTypes.has(photoEntry.type)) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas o formato da foto é inválido.',
  })
}

if (photoEntry.size <= 0) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas a foto recebida está vazia.',
  })
}

if (photoEntry.size > 2 * 1024 * 1024) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas a foto ultrapassou o limite de 2 MB.',
  })
}

/*
 * 11. Normaliza e armazena a foto
 * como JPEG.
 *
 * Assim, JPEG, PNG e WebP gerados pelo
 * dispositivo terão um formato compatível
 * com o envio para a Meta.
 */
let normalizedPhotoBuffer: Buffer

try {
  const originalPhotoBuffer =
    Buffer.from(
      await photoEntry.arrayBuffer()
    )

  normalizedPhotoBuffer =
    await normalizePhotoToJpeg(
      originalPhotoBuffer
    )
} catch (error) {
  console.error(
    '[CONFIRMAÇÃO FACIAL] erro ao normalizar foto:',
    error
  )

  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas não foi possível preparar a foto da chegada.',
  })
}

if (
  normalizedPhotoBuffer.length >
  2 * 1024 * 1024
) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas a foto processada ultrapassou o limite de 2 MB.',
  })
}

const [year, month, day] =
  attendanceDate.split('-')

uploadedPhotoPath = [
  schoolId,
  year,
  month,
  day,
  studentId,
  `${randomUUID()}.jpg`,
].join('/')

const photoUploadBytes =
  Uint8Array.from(
    normalizedPhotoBuffer
  )

const {
  error: photoUploadError,
} = await supabaseAdmin.storage
  .from(PHOTO_BUCKET)
  .upload(
    uploadedPhotoPath,
    photoUploadBytes,
    {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    }
  )

if (photoUploadError) {
  console.error(
    '[CONFIRMAÇÃO FACIAL] erro ao salvar foto:',
    photoUploadError
  )

  uploadedPhotoPath = null

  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas não foi possível armazenar a foto da chegada.',
  })
}

/*
 * 12. Obtém o número atual cadastrado
 * no perfil do aluno.
 */
const responsibleWhatsApp =
  normalizeWhatsApp(
    student.responsible_whatsapp
  )

const whatsappStatus:
  | 'no_phone'
  | 'queued' =
  responsibleWhatsApp
    ? 'queued'
    : 'no_phone'

/*
 * 13. Cria o comprovante da entrada.
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

  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: false,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença foi registrada, mas não foi possível criar o comprovante da chegada.',
  })
}

/*
 * 14. Sem telefone válido, mantém apenas
 * a foto e o comprovante.
 */
if (!responsibleWhatsApp) {
  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: true,
    evidenceId: evidence.id,
    whatsappQueued: false,
    whatsappStatus: 'no_phone',
    warning:
      'A foto foi armazenada, mas o aluno não possui um WhatsApp válido cadastrado.',
  })
}

/*
 * 15. Coloca o envio na fila.
 *
 * A Meta não é chamada aqui.
 */
const {
  error: queueError,
} = await supabaseAdmin
  .from('whatsapp_notification_queue')
  .insert({
    school_id: schoolId,
    student_id: studentId,

    attendance_evidence_id:
      evidence.id,

    regular_exit_id: null,

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

  await supabaseAdmin
    .from('attendance_evidence')
    .update({
      whatsapp_status: 'failed',
      whatsapp_error:
        queueError.message,
    })
    .eq('id', evidence.id)

  return NextResponse.json({
    ...baseResponse,
    addonEligible: true,
    evidenceSaved: true,
    evidenceId: evidence.id,
    whatsappQueued: false,
    whatsappStatus: 'failed',
    warning:
      'A presença e a foto foram registradas, mas a mensagem não pôde ser adicionada à fila.',
  })
}

after(async () => {
  try {
    await processWhatsAppQueue(3)
  } catch (error) {
    console.error(
      '[CONFIRMAÇÃO FACIAL] erro no processamento assíncrono do WhatsApp:',
      error
    )
  }
})

return NextResponse.json({
  ...baseResponse,
  addonEligible: true,
  evidenceSaved: true,
  evidenceId: evidence.id,
  whatsappQueued: true,
  whatsappStatus: 'queued',
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