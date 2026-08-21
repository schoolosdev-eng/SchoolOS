import { randomUUID } from 'crypto'
import {
  after,
  NextResponse,
} from 'next/server'
import {
  createClient,
} from '@supabase/supabase-js'
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

type SyncQrArrivalBody = {
  schoolId?: unknown
  studentId?: unknown
  classId?: unknown
  attendanceDate?: unknown
  recordedAt?: unknown
}

type AttendanceEvidenceRow = {
  id: string
  photo_bucket: string | null
  photo_path: string | null
  whatsapp_status: string | null
}

type QueueRow = {
  id: string
  status: string
  provider_status: string | null
}

function createAdminClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

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
 * Gera o mesmo JPEG seguro que já foi
 * validado no envio para a Meta.
 */
async function normalizePhotoToJpeg(
  originalBuffer: Buffer
) {
  const {
    data,
    info,
  } = await sharp(originalBuffer)
    .rotate()
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
    .toColourspace('srgb')
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

  const metadata =
    await sharp(data).metadata()

  if (
    info.format !== 'jpeg' ||
    info.channels !== 3 ||
    metadata.format !== 'jpeg' ||
    metadata.channels !== 3 ||
    metadata.depth !== 'uchar' ||
    metadata.isProgressive === true
  ) {
    throw new Error(
      'A foto de perfil não pôde ser convertida em um JPEG RGB válido.'
    )
  }

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
     * 2. Lê o registro do IndexedDB.
     */
    const body =
      await request
        .json()
        .catch(
          () => null
        ) as SyncQrArrivalBody | null

    const schoolId =
      typeof body?.schoolId ===
        'string'
        ? body.schoolId.trim()
        : ''

    const studentId =
      typeof body?.studentId ===
        'string'
        ? body.studentId.trim()
        : ''

    const classId =
      typeof body?.classId ===
        'string'
        ? body.classId.trim()
        : ''

    const attendanceDate =
      typeof body?.attendanceDate ===
        'string'
        ? body.attendanceDate.trim()
        : ''

    const recordedAtValue =
      typeof body?.recordedAt ===
        'string'
        ? body.recordedAt.trim()
        : ''

    if (
      !schoolId ||
      !studentId ||
      !classId ||
      !attendanceDate ||
      !recordedAtValue
    ) {
      return NextResponse.json(
        {
          error:
            'Dados incompletos para sincronizar a entrada.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        attendanceDate
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Data da presença inválida.',
        },
        {
          status: 400,
        }
      )
    }

    const recordedAt =
      new Date(recordedAtValue)

    if (
      Number.isNaN(
        recordedAt.getTime()
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Horário da entrada inválido.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * 3. Confere a permissão na escola.
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
  .in(
    'role',
    [
      'admin',
      'gestor',
      'professor',
    ]
  )
  .limit(1)
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
            'Usuário sem permissão para sincronizar a portaria.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 4. Busca aluno, turma e matrícula.
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
      .eq(
        'id',
        studentId
      )
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

    const {
      data: schoolClass,
      error: classError,
    } = await supabaseAdmin
      .from('classes')
      .select(
        'id, school_id, name'
      )
      .eq(
        'id',
        classId
      )
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

    /*
     * 5. Localiza ou cria a presença.
     *
     * Mesmo que ela já exista, o endpoint
     * continua para completar foto e fila.
     */
    const {
      data: existingAttendance,
      error: existingAttendanceError,
    } = await supabaseAdmin
      .from(
        'attendance_records'
      )
      .select(`
        id,
        status,
        source,
        created_at,
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
        attendanceDate
      )
      .maybeSingle()

    if (existingAttendanceError) {
      throw new Error(
        `Erro ao consultar a presença: ${existingAttendanceError.message}`
      )
    }

    let attendanceRecordId:
      string

    let duplicate = false

    if (existingAttendance) {
      attendanceRecordId =
        existingAttendance.id

      if (
        existingAttendance.status ===
        'present'
      ) {
        duplicate = true
      } else {
        const {
          error: updateError,
        } = await supabaseAdmin
          .from(
            'attendance_records'
          )
          .update({
            status: 'present',
            source: 'qr',
            recorded_by_user_id:
              user.id,
            updated_at:
              recordedAt.toISOString(),
          })
          .eq(
            'id',
            existingAttendance.id
          )

        if (updateError) {
          throw new Error(
            `Não foi possível atualizar a presença: ${updateError.message}`
          )
        }
      }
    } else {
      const {
        data: insertedAttendance,
        error: insertError,
      } = await supabaseAdmin
        .from(
          'attendance_records'
        )
        .insert({
          school_id:
            schoolId,

          student_id:
            studentId,

          class_id:
            classId,

          attendance_date:
            attendanceDate,

          status:
            'present',

          source:
            'qr',

          recorded_by_user_id:
            user.id,

          created_at:
            recordedAt.toISOString(),

          updated_at:
            recordedAt.toISOString(),
        })
        .select('id')
        .single()

      if (
        insertError ||
        !insertedAttendance
      ) {
        /*
         * Pode ter ocorrido uma sincronização
         * concorrente do mesmo aluno.
         */
        if (
          insertError?.code ===
          '23505'
        ) {
          const {
            data:
              concurrentAttendance,
            error:
              concurrentError,
          } = await supabaseAdmin
            .from(
              'attendance_records'
            )
            .select('id')
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
              attendanceDate
            )
            .single()

          if (
            concurrentError ||
            !concurrentAttendance
          ) {
            throw new Error(
              'A presença foi criada por outra sincronização, mas não pôde ser recuperada.'
            )
          }

          attendanceRecordId =
            concurrentAttendance.id

          duplicate = true
        } else {
          throw new Error(
            `Não foi possível criar a presença: ${
              insertError?.message ||
              'erro desconhecido'
            }`
          )
        }
      } else {
        attendanceRecordId =
          insertedAttendance.id
      }
    }

    const baseResponse = {
      success: true,
      duplicate,
      attendanceSynced: true,
      attendanceRecordId,
      studentName:
        student.full_name,
      className:
        schoolClass.name,
      attendanceDate,
      recordedAt:
        recordedAt.toISOString(),
      source: 'qr',
    }

    /*
     * 6. Verifica a cobertura individual
     * do adicional de chegada.
     */
    const {
      data: addonEligibleResult,
      error: addonError,
    } = await supabaseAdmin.rpc(
      'student_has_active_school_addon',
      {
        p_school_id:
          schoolId,

        p_student_id:
          studentId,

        p_addon_code:
          'arrival_photo_whatsapp',
      }
    )

    if (addonError) {
      console.error(
        '[SINCRONIZAÇÃO QR] erro ao verificar adicional:',
        addonError
      )

      /*
       * Retorna erro para o IndexedDB não
       * marcar o registro como sincronizado.
       * A próxima tentativa retomará daqui.
       */
      return NextResponse.json(
        {
          ...baseResponse,
          error:
            'A presença foi registrada, mas não foi possível verificar o adicional de WhatsApp.',
        },
        {
          status: 500,
        }
      )
    }

    const addonEligible =
      addonEligibleResult ===
      true

    if (!addonEligible) {
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
     * 7. Verifica se o comprovante já existe.
     */
    const {
      data: existingEvidence,
      error: existingEvidenceError,
    } = await supabaseAdmin
      .from(
        'attendance_evidence'
      )
      .select(`
        id,
        photo_bucket,
        photo_path,
        whatsapp_status
      `)
      .eq(
        'attendance_record_id',
        attendanceRecordId
      )
      .maybeSingle()

    if (existingEvidenceError) {
      return NextResponse.json(
        {
          ...baseResponse,
          error:
            'A presença foi registrada, mas não foi possível consultar o comprovante.',
        },
        {
          status: 500,
        }
      )
    }

    let evidence =
      existingEvidence as
        | AttendanceEvidenceRow
        | null

    /*
     * 8. Quando ainda não há comprovante,
     * copia a foto atual do perfil.
     */
    if (!evidence) {
      if (
        !student.profile_photo_path
      ) {
        return NextResponse.json({
          ...baseResponse,
          addonEligible: true,
          evidenceSaved: false,
          whatsappQueued: false,
          whatsappStatus:
            'no_photo',
          warning:
            'A presença foi sincronizada, mas o aluno não possui foto de perfil.',
        })
      }

      const {
        data: profilePhotoBlob,
        error: profilePhotoError,
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
          '[SINCRONIZAÇÃO QR] erro ao baixar foto de perfil:',
          profilePhotoError
        )

        return NextResponse.json(
          {
            ...baseResponse,
            error:
              'A presença foi registrada, mas não foi possível acessar a foto de perfil.',
          },
          {
            status: 500,
          }
        )
      }

      let normalizedPhoto:
        Buffer

      try {
        const profileBuffer =
          Buffer.from(
            await profilePhotoBlob
              .arrayBuffer()
          )

        normalizedPhoto =
          await normalizePhotoToJpeg(
            profileBuffer
          )
      } catch (error) {
        console.error(
          '[SINCRONIZAÇÃO QR] erro ao preparar foto:',
          error
        )

        return NextResponse.json(
          {
            ...baseResponse,
            error:
              'A presença foi registrada, mas não foi possível preparar a foto do aluno.',
          },
          {
            status: 500,
          }
        )
      }

      const [
        year,
        month,
        day,
      ] =
        attendanceDate.split('-')

      uploadedPhotoPath = [
        schoolId,
        year,
        month,
        day,
        studentId,
        `qr-arrival-${randomUUID()}.jpg`,
      ].join('/')

      const {
        error: uploadError,
      } =
        await supabaseAdmin.storage
          .from(PHOTO_BUCKET)
          .upload(
            uploadedPhotoPath,
            Uint8Array.from(
              normalizedPhoto
            ),
            {
              contentType:
                'image/jpeg',

              cacheControl:
                '3600',

              upsert:
                false,
            }
          )

      if (uploadError) {
        console.error(
          '[SINCRONIZAÇÃO QR] erro ao salvar comprovante:',
          uploadError
        )

        uploadedPhotoPath =
          null

        return NextResponse.json(
          {
            ...baseResponse,
            error:
              'A presença foi registrada, mas a foto não pôde ser armazenada.',
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

      const initialWhatsappStatus =
        responsibleWhatsApp
          ? 'queued'
          : 'no_phone'

      const retentionUntil =
        addFiveYears(
          recordedAt
        )

      const {
        data: insertedEvidence,
        error: evidenceInsertError,
      } = await supabaseAdmin
        .from(
          'attendance_evidence'
        )
        .insert({
          school_id:
            schoolId,

          attendance_record_id:
            attendanceRecordId,

          student_id:
            studentId,

          class_id:
            classId,

          source:
            'qr',

          photo_origin:
            'profile_snapshot',

          photo_bucket:
            PHOTO_BUCKET,

          photo_path:
            uploadedPhotoPath,

          captured_at:
            recordedAt.toISOString(),

          retention_until:
            retentionUntil
              .toISOString(),

          device_info: {
            userAgent:
              request.headers.get(
                'user-agent'
              ) || null,

            source:
              'qr',

            synchronization:
              'offline_to_online',
          },

          whatsapp_status:
            initialWhatsappStatus,

          whatsapp_error:
            null,

          created_by_user_id:
            user.id,
        })
        .select(`
          id,
          photo_bucket,
          photo_path,
          whatsapp_status
        `)
        .single()

      if (
        evidenceInsertError ||
        !insertedEvidence
      ) {
        /*
         * Outra sincronização pode ter
         * criado o comprovante primeiro.
         */
        if (
          evidenceInsertError
            ?.code === '23505'
        ) {
          await supabaseAdmin
            .storage
            .from(PHOTO_BUCKET)
            .remove([
              uploadedPhotoPath,
            ])

          uploadedPhotoPath =
            null

          const {
            data:
              concurrentEvidence,
            error:
              concurrentEvidenceError,
          } = await supabaseAdmin
            .from(
              'attendance_evidence'
            )
            .select(`
              id,
              photo_bucket,
              photo_path,
              whatsapp_status
            `)
            .eq(
              'attendance_record_id',
              attendanceRecordId
            )
            .single()

          if (
            concurrentEvidenceError ||
            !concurrentEvidence
          ) {
            return NextResponse.json(
              {
                ...baseResponse,
                error:
                  'O comprovante foi criado por outra sincronização, mas não pôde ser recuperado.',
              },
              {
                status: 500,
              }
            )
          }

          evidence =
            concurrentEvidence
        } else {
          await supabaseAdmin
            .storage
            .from(PHOTO_BUCKET)
            .remove([
              uploadedPhotoPath,
            ])

          uploadedPhotoPath =
            null

          return NextResponse.json(
            {
              ...baseResponse,
              error:
                `A presença foi registrada, mas o comprovante não pôde ser criado: ${
                  evidenceInsertError
                    ?.message ||
                  'erro desconhecido'
                }`,
            },
            {
              status: 500,
            }
          )
        }
      } else {
        evidence =
          insertedEvidence
      }
    }

    if (!evidence) {
      return NextResponse.json(
        {
          ...baseResponse,
          error:
            'O comprovante da chegada não pôde ser identificado.',
        },
        {
          status: 500,
        }
      )
    }

    /*
     * 9. Verifica se já existe uma fila
     * para esse comprovante.
     */
    const {
      data: existingQueue,
      error: existingQueueError,
    } = await supabaseAdmin
      .from(
        'whatsapp_notification_queue'
      )
      .select(`
        id,
        status,
        provider_status
      `)
      .eq(
        'attendance_evidence_id',
        evidence.id
      )
      .maybeSingle()

    if (existingQueueError) {
      return NextResponse.json(
        {
          ...baseResponse,
          evidenceSaved: true,
          evidenceId:
            evidence.id,
          error:
            'O comprovante foi criado, mas não foi possível consultar a fila.',
        },
        {
          status: 500,
        }
      )
    }

    if (existingQueue) {
      const queue =
        existingQueue as QueueRow

      if (
        queue.status ===
        'queued'
      ) {
        after(async () => {
          try {
            await processWhatsAppQueue(
              1
            )
          } catch (error) {
            console.error(
              '[SINCRONIZAÇÃO QR] erro ao reativar worker:',
              error
            )
          }
        })
      }

      return NextResponse.json({
        ...baseResponse,
        addonEligible: true,
        evidenceSaved: true,
        evidenceId:
          evidence.id,
        whatsappQueued:
          queue.status ===
            'queued' ||
          queue.status ===
            'processing',
        whatsappStatus:
          queue.provider_status ||
          queue.status,
        queueId:
          queue.id,
      })
    }

    /*
     * 10. Sem telefone válido:
     * mantém a foto e o comprovante.
     */
    const responsibleWhatsApp =
      normalizeWhatsApp(
        student.responsible_whatsapp
      )

    if (!responsibleWhatsApp) {
      await supabaseAdmin
        .from(
          'attendance_evidence'
        )
        .update({
          whatsapp_status:
            'no_phone',

          whatsapp_error:
            null,
        })
        .eq(
          'id',
          evidence.id
        )

      return NextResponse.json({
        ...baseResponse,
        addonEligible: true,
        evidenceSaved: true,
        evidenceId:
          evidence.id,
        whatsappQueued: false,
        whatsappStatus:
          'no_phone',
        warning:
          'A foto foi armazenada, mas o aluno não possui um WhatsApp válido cadastrado.',
      })
    }

    if (
      !evidence.photo_path
    ) {
      return NextResponse.json(
        {
          ...baseResponse,
          evidenceSaved: true,
          evidenceId:
            evidence.id,
          error:
            'O comprovante não possui uma foto válida para envio.',
        },
        {
          status: 500,
        }
      )
    }

    /*
     * 11. Enfileira a mensagem.
     */
    const {
      data: insertedQueue,
      error: queueInsertError,
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
          evidence.id,

        regular_exit_id:
          null,

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
            recordedAt.toISOString(),

          attendanceDate,

          source:
            'qr',

          photoOrigin:
            'profile_snapshot',

          photoBucket:
            evidence.photo_bucket ||
            PHOTO_BUCKET,

          photoPath:
            evidence.photo_path,
        },

        status:
          'queued',

        next_attempt_at:
          new Date()
            .toISOString(),
      })
      .select('id, status')
      .single()

    if (
      queueInsertError ||
      !insertedQueue
    ) {
      /*
       * Corrida entre duas sincronizações:
       * recupera a fila já criada.
       */
      if (
        queueInsertError?.code ===
        '23505'
      ) {
        const {
          data:
            concurrentQueue,
          error:
            concurrentQueueError,
        } = await supabaseAdmin
          .from(
            'whatsapp_notification_queue'
          )
          .select(`
            id,
            status,
            provider_status
          `)
          .eq(
            'attendance_evidence_id',
            evidence.id
          )
          .single()

        if (
          concurrentQueueError ||
          !concurrentQueue
        ) {
          return NextResponse.json(
            {
              ...baseResponse,
              evidenceSaved: true,
              evidenceId:
                evidence.id,
              error:
                'A fila foi criada por outra sincronização, mas não pôde ser recuperada.',
            },
            {
              status: 500,
            }
          )
        }

        after(async () => {
          try {
            await processWhatsAppQueue(
              1
            )
          } catch (error) {
            console.error(
              '[SINCRONIZAÇÃO QR] erro no worker concorrente:',
              error
            )
          }
        })

        return NextResponse.json({
          ...baseResponse,
          addonEligible: true,
          evidenceSaved: true,
          evidenceId:
            evidence.id,
          whatsappQueued:
            true,
          whatsappStatus:
            concurrentQueue
              .provider_status ||
            concurrentQueue
              .status,
          queueId:
            concurrentQueue.id,
        })
      }

      await supabaseAdmin
        .from(
          'attendance_evidence'
        )
        .update({
          whatsapp_status:
            'failed',

          whatsapp_error:
            queueInsertError
              ?.message ||
            'Erro ao criar fila.',
        })
        .eq(
          'id',
          evidence.id
        )

      return NextResponse.json(
        {
          ...baseResponse,
          evidenceSaved: true,
          evidenceId:
            evidence.id,
          error:
            'A presença e a foto foram registradas, mas a mensagem não pôde ser adicionada à fila.',
        },
        {
          status: 500,
        }
      )
    }

    await supabaseAdmin
      .from(
        'attendance_evidence'
      )
      .update({
        whatsapp_status:
          'queued',

        whatsapp_error:
          null,
      })
      .eq(
        'id',
        evidence.id
      )

    /*
     * 12. Dispara o processamento sem
     * atrasar a resposta da sincronização.
     */
    after(async () => {
      try {
        await processWhatsAppQueue(
          1
        )
      } catch (error) {
        console.error(
          '[SINCRONIZAÇÃO QR] erro no processamento assíncrono:',
          error
        )
      }
    })

    return NextResponse.json({
      ...baseResponse,
      addonEligible: true,
      evidenceSaved: true,
      evidenceId:
        evidence.id,
      whatsappQueued: true,
      whatsappStatus:
        'queued',
      queueId:
        insertedQueue.id,
    })
  } catch (error) {
    console.error(
      '[SINCRONIZAÇÃO QR] erro inesperado:',
      error
    )

    /*
     * Remove apenas uma foto que tenha sido
     * enviada, mas ainda não esteja vinculada
     * a um comprovante.
     */
    if (uploadedPhotoPath) {
      try {
        const supabaseAdmin =
          createAdminClient()

        const {
          data: evidenceUsingPhoto,
        } = await supabaseAdmin
          .from(
            'attendance_evidence'
          )
          .select('id')
          .eq(
            'photo_path',
            uploadedPhotoPath
          )
          .maybeSingle()

        if (!evidenceUsingPhoto) {
          await supabaseAdmin
            .storage
            .from(PHOTO_BUCKET)
            .remove([
              uploadedPhotoPath,
            ])
        }
      } catch (
        cleanupError
      ) {
        console.error(
          '[SINCRONIZAÇÃO QR] erro ao limpar foto órfã:',
          cleanupError
        )
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao sincronizar a entrada por QR Code.',
      },
      {
        status: 500,
      }
    )
  }
}