import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const MAX_ATTEMPTS = 5

const RETRY_DELAYS_MINUTES = [
  1,
  5,
  15,
  60,
  180,
]

type NotificationType =
  | 'student_arrival'
  | 'student_departure'

type QueuePayload = {
  studentName?: string
  className?: string
  schoolName?: string

  arrivalTime?: string
  attendanceDate?: string

  departureTime?: string
  exitDate?: string

  photoBucket?: string
  photoPath?: string
}

type WhatsAppQueueRow = {
  id: string
  school_id: string
  student_id: string

  attendance_evidence_id:
    | string
    | null

  regular_exit_id:
    | string
    | null

  destination_phone: string
  notification_type: string
  payload: QueuePayload | null
  status: string
  attempts: number | null
}

type WhatsAppConfig = {
  accessToken: string
  phoneNumberId: string

  arrivalTemplateName: string
  departureTemplateName: string

  templateLanguage: string
  graphApiVersion: string
  timeZone: string
}

type LinkedEventStatus =
  | 'queued'
  | 'sent'
  | 'failed'

export type ProcessWhatsAppQueueResult = {
  claimed: number
  sent: number
  retried: number
  failed: number
  releasedStale: number
}

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

function isWhatsAppSendingEnabled() {
  return (
    process.env
      .WHATSAPP_SENDING_ENABLED
      ?.trim()
      .toLowerCase() === 'true'
  )
}

function getWhatsAppConfig(): WhatsAppConfig {
  const accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID

  const arrivalTemplateName =
    process.env.WHATSAPP_TEMPLATE_NAME ||
    'student_arrival_photo'

  const departureTemplateName =
    process.env
      .WHATSAPP_DEPARTURE_TEMPLATE_NAME ||
    'student_departure_photo'

  const templateLanguage =
    process.env
      .WHATSAPP_TEMPLATE_LANGUAGE ||
    'pt_BR'

  const graphApiVersion =
    process.env
      .WHATSAPP_GRAPH_API_VERSION ||
    'v25.0'

  const timeZone =
    process.env.WHATSAPP_TIME_ZONE ||
    'America/Fortaleza'

  if (!accessToken) {
    throw new Error(
      'WHATSAPP_ACCESS_TOKEN não configurado.'
    )
  }

  if (!phoneNumberId) {
    throw new Error(
      'WHATSAPP_PHONE_NUMBER_ID não configurado.'
    )
  }

  return {
    accessToken,
    phoneNumberId,
    arrivalTemplateName,
    departureTemplateName,
    templateLanguage,
    graphApiVersion,
    timeZone,
  }
}

function getNotificationType(
  value: string
): NotificationType {
  if (
    value === 'student_arrival' ||
    value === 'student_departure'
  ) {
    return value
  }

  throw new Error(
    `Tipo de notificação não suportado: ${value}`
  )
}

function normalizePhone(
  value: string | null | undefined
) {
  const digits =
    value?.replace(/\D/g, '') || ''

  if (!digits) {
    throw new Error(
      'Número de WhatsApp do responsável não informado.'
    )
  }

  const normalized =
    digits.startsWith('55')
      ? digits
      : `55${digits}`

  if (
    normalized.length < 12 ||
    normalized.length > 13
  ) {
    throw new Error(
      'Número de WhatsApp do responsável inválido.'
    )
  }

  return normalized
}

function safeText(
  value: unknown,
  fallback: string
) {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return fallback
  }

  return value
    .trim()
    .slice(0, 500)
}

function formatEventTime(
  value: unknown,
  timeZone: string
) {
  if (
    typeof value !== 'string'
  ) {
    return '--:--'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '--:--'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  ).format(date)
}

function getErrorMessage(
  error: unknown
) {
  if (
    error instanceof Error
  ) {
    return error.message
  }

  return 'Erro desconhecido ao enviar mensagem.'
}

async function readMetaResponse(
  response: Response
) {
  return response
    .json()
    .catch(() => null)
}

async function uploadImageToMeta({
  photoBlob,
  queueId,
  config,
}: {
  photoBlob: Blob
  queueId: string
  config: WhatsAppConfig
}) {
  /*
   * Não confiamos apenas no MIME retornado
   * pelo Storage. Os bytes são decodificados
   * e gerados novamente como JPEG padrão.
   */
  const originalBuffer =
    Buffer.from(
      await photoBlob.arrayBuffer()
    )

  if (originalBuffer.length === 0) {
    throw new Error(
      'A foto armazenada está vazia.'
    )
  }

  let normalizedBuffer: Buffer
  let imageWidth: number | undefined
  let imageHeight: number | undefined

  try {
    const {
      data,
      info,
    } = await sharp(
      originalBuffer
    )
      .rotate()

      /*
       * Remove transparência e gera
       * somente três canais RGB.
       */
      .flatten({
        background: '#ffffff',
      })

      .resize({
        width: 1280,
        height: 1280,
        fit: 'inside',
        withoutEnlargement: true,
      })

      /*
       * Força espaço de cores compatível
       * com imagens comuns para web.
       */
      .toColorspace('srgb')

      /*
       * JPEG tradicional:
       * - não progressivo;
       * - sem mozjpeg;
       * - subsampling padrão 4:2:0.
       */
      .jpeg({
        quality: 85,
        progressive: false,
        chromaSubsampling: '4:2:0',
        mozjpeg: false,
      })

      .toBuffer({
        resolveWithObject: true,
      })

    normalizedBuffer = data
    imageWidth = info.width
    imageHeight = info.height
  } catch (error) {
  const sharpError =
    getErrorMessage(error)

  console.error(
    '[WHATSAPP WORKER] imagem inválida para normalização:',
    {
      queueId,
      originalBytes:
        originalBuffer.length,

      originalMimeType:
        photoBlob.type ||
        'não informado',

      firstBytes:
        originalBuffer
          .subarray(0, 16)
          .toString('hex'),

      error:
        sharpError,
    }
  )

  throw new Error(
    `Não foi possível converter a foto em um JPEG válido. Detalhe: ${sharpError}`
  )
}

  if (
    !imageWidth ||
    !imageHeight ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    throw new Error(
      'A imagem processada possui dimensões inválidas.'
    )
  }

  if (
    normalizedBuffer.length >
    5 * 1024 * 1024
  ) {
    throw new Error(
      'A imagem processada ultrapassa o limite de 5 MB.'
    )
  }

  console.log(
    '[WHATSAPP WORKER] imagem preparada:',
    {
      queueId,
      width: imageWidth,
      height: imageHeight,
      bytes:
        normalizedBuffer.length,
      mimeType: 'image/jpeg',
    }
  )

  const normalizedBlob =
    new Blob(
      [
        new Uint8Array(
          normalizedBuffer
        ),
      ],
      {
        type: 'image/jpeg',
      }
    )

  const formData =
    new FormData()

  formData.append(
    'messaging_product',
    'whatsapp'
  )

  formData.append(
    'file',
    normalizedBlob,
    `schoolos-${queueId}.jpg`
  )

  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/media`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${config.accessToken}`,
      },

      body: formData,
    }
  )

  const data =
    await readMetaResponse(
      response
    )

  if (
    !response.ok ||
    !data?.id
  ) {
    const metaMessage =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      'A Meta não retornou o ID da mídia.'

    const metaCode =
      data?.error?.code
        ? ` Código: ${data.error.code}.`
        : ''

    throw new Error(
      `Erro ao enviar foto para a Meta: ${metaMessage}.${metaCode}`
    )
  }

  return String(data.id)
}

async function sendPhotoTemplate({
  destinationPhone,
  mediaId,
  templateName,
  studentName,
  className,
  schoolName,
  eventTime,
  queueId,
  config,
}: {
  destinationPhone: string
  mediaId: string
  templateName: string
  studentName: string
  className: string
  schoolName: string
  eventTime: string
  queueId: string
  config: WhatsAppConfig
}) {
  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${config.accessToken}`,

        'Content-Type':
          'application/json',
      },
      body: JSON.stringify({
        messaging_product:
          'whatsapp',

        recipient_type:
          'individual',

        to: destinationPhone,

        type: 'template',

        template: {
          name: templateName,

          language: {
            code:
              config.templateLanguage,
          },

          components: [
            {
              type: 'header',

              parameters: [
                {
                  type: 'image',

                  image: {
                    id: mediaId,
                  },
                },
              ],
            },

            {
              type: 'body',

              parameters: [
                {
                  type: 'text',
                  text: studentName,
                },
                {
                  type: 'text',
                  text: className,
                },
                {
                  type: 'text',
                  text: schoolName,
                },
                {
                  type: 'text',
                  text: eventTime,
                },
              ],
            },
          ],
        },

        biz_opaque_callback_data:
          queueId,
      }),
    }
  )

  const data =
    await readMetaResponse(
      response
    )

  const providerMessageId =
    data?.messages?.[0]?.id

  if (
    !response.ok ||
    !providerMessageId
  ) {
    const metaMessage =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      'A Meta não retornou o ID da mensagem.'

    const metaCode =
      data?.error?.code
        ? ` Código: ${data.error.code}.`
        : ''

    throw new Error(
      `Erro ao enviar template: ${metaMessage}.${metaCode}`
    )
  }

  return String(
    providerMessageId
  )
}

function getRetryDate(
  attemptNumber: number
) {
  const delayIndex =
    Math.min(
      Math.max(
        attemptNumber - 1,
        0
      ),
      RETRY_DELAYS_MINUTES
        .length - 1
    )

  const delayMinutes =
    RETRY_DELAYS_MINUTES[
      delayIndex
    ]

  return new Date(
    Date.now() +
      delayMinutes *
        60 *
        1000
  )
}

async function updateLinkedEventStatus({
  supabaseAdmin,
  message,
  notificationType,
  status,
  providerMessageId,
  sentAt,
  errorMessage,
}: {
  supabaseAdmin:
    ReturnType<
      typeof createAdminClient
    >

  message:
    WhatsAppQueueRow

  notificationType:
    NotificationType

  status:
    LinkedEventStatus

  providerMessageId?:
    string | null

  sentAt?:
    string | null

  errorMessage?:
    string | null
}) {
  if (
    notificationType ===
    'student_arrival'
  ) {
    if (
      !message
        .attendance_evidence_id
    ) {
      console.error(
        '[WHATSAPP WORKER] mensagem de entrada sem attendance_evidence_id:',
        {
          queueId: message.id,
        }
      )

      return
    }

    const updatePayload =
      status === 'sent'
        ? {
            whatsapp_status:
              'sent',

            whatsapp_provider_message_id:
              providerMessageId ||
              null,

            whatsapp_sent_at:
              sentAt || null,

            whatsapp_error:
              null,
          }
        : {
            whatsapp_status:
              status,

            whatsapp_error:
              errorMessage ||
              null,
          }

    const {
      error,
    } = await supabaseAdmin
      .from(
        'attendance_evidence'
      )
      .update(updatePayload)
      .eq(
        'id',
        message
          .attendance_evidence_id
      )

    if (error) {
      console.error(
        '[WHATSAPP WORKER] comprovante de entrada não atualizado:',
        {
          queueId: message.id,
          error,
        }
      )
    }

    return
  }

  if (
    !message.regular_exit_id
  ) {
    console.error(
      '[WHATSAPP WORKER] mensagem de saída sem regular_exit_id:',
      {
        queueId: message.id,
      }
    )

    return
  }

  const updatePayload =
    status === 'sent'
      ? {
          whatsapp_status:
            'sent',

          whatsapp_provider_message_id:
            providerMessageId ||
            null,

          whatsapp_sent_at:
            sentAt || null,

          whatsapp_error:
            null,
        }
      : {
          whatsapp_status:
            status,

          whatsapp_error:
            errorMessage ||
            null,
        }

  const {
    error,
  } = await supabaseAdmin
    .from(
      'student_regular_exits'
    )
    .update(updatePayload)
    .eq(
      'id',
      message.regular_exit_id
    )

  if (error) {
    console.error(
      '[WHATSAPP WORKER] saída normal não atualizada:',
      {
        queueId: message.id,
        error,
      }
    )
  }
}

export async function processWhatsAppQueue(
  requestedBatchSize = 10
): Promise<ProcessWhatsAppQueueResult> {
  const supabaseAdmin =
    createAdminClient()

  const result:
    ProcessWhatsAppQueueResult = {
      claimed: 0,
      sent: 0,
      retried: 0,
      failed: 0,
      releasedStale: 0,
    }

  /*
   * Recupera mensagens que ficaram
   * presas em processing.
   */
  const {
    data: releasedStale,
    error: releaseError,
  } = await supabaseAdmin.rpc(
    'release_stale_whatsapp_queue'
  )

  if (releaseError) {
    console.error(
      '[WHATSAPP WORKER] erro ao liberar mensagens travadas:',
      releaseError
    )
  } else {
    result.releasedStale =
      Number(
        releasedStale || 0
      )
  }

  /*
   * Enquanto os modelos estiverem
   * em análise, o worker não reserva
   * nenhuma mensagem.
   */
  if (
    !isWhatsAppSendingEnabled()
  ) {
    console.log(
      '[WHATSAPP WORKER] envio desativado por WHATSAPP_SENDING_ENABLED.'
    )

    return result
  }

  const config =
    getWhatsAppConfig()

  const batchSize =
    Math.max(
      1,
      Math.min(
        requestedBatchSize,
        20
      )
    )

  const {
    data: claimedMessages,
    error: claimError,
  } = await supabaseAdmin.rpc(
    'claim_whatsapp_notification_queue',
    {
      batch_size:
        batchSize,
    }
  )

  if (claimError) {
    throw new Error(
      `Erro ao reservar mensagens: ${claimError.message}`
    )
  }

  const messages =
    (claimedMessages ||
      []) as WhatsAppQueueRow[]

  result.claimed =
    messages.length

  for (
    const message of messages
  ) {
    const attemptNumber =
      Number(
        message.attempts || 0
      ) + 1

    let notificationType:
      | NotificationType
      | null = null

    try {
      notificationType =
        getNotificationType(
          message.notification_type
        )

      if (
        notificationType ===
          'student_arrival' &&
        !message
          .attendance_evidence_id
      ) {
        throw new Error(
          'Mensagem de entrada sem referência ao comprovante.'
        )
      }

      if (
        notificationType ===
          'student_departure' &&
        !message.regular_exit_id
      ) {
        throw new Error(
          'Mensagem de saída sem referência ao registro de saída.'
        )
      }

      const payload =
        message.payload || {}

      const photoBucket =
        safeText(
          payload.photoBucket,
          'attendance-proof-photos'
        )

      const photoPath =
        safeText(
          payload.photoPath,
          ''
        )

      if (!photoPath) {
        throw new Error(
          'Caminho da foto não encontrado na fila.'
        )
      }

      const destinationPhone =
        normalizePhone(
          message
            .destination_phone
        )

      const {
        data: school,
        error: schoolError,
      } = await supabaseAdmin
        .from('schools')
        .select('name')
        .eq(
          'id',
          message.school_id
        )
        .maybeSingle()

      if (
        schoolError ||
        !school
      ) {
        throw new Error(
          'Escola não encontrada para o envio.'
        )
      }

      const studentName =
        safeText(
          payload.studentName,
          'Aluno'
        )

      const className =
        safeText(
          payload.className,
          'Turma não informada'
        )

      const schoolName =
        safeText(
          payload.schoolName,
          school.name ||
            'Escola'
        )

      const eventTimestamp =
        notificationType ===
        'student_departure'
          ? payload.departureTime
          : payload.arrivalTime

      const eventTime =
        formatEventTime(
          eventTimestamp,
          config.timeZone
        )

      const templateName =
        notificationType ===
        'student_departure'
          ? config
              .departureTemplateName
          : config
              .arrivalTemplateName

      const {
        data: photoBlob,
        error: photoError,
      } = await supabaseAdmin
        .storage
        .from(photoBucket)
        .download(photoPath)

      if (
        photoError ||
        !photoBlob
      ) {
        throw new Error(
          `Erro ao baixar foto: ${
            photoError?.message ||
            'arquivo não encontrado'
          }`
        )
      }

      const mediaId =
        await uploadImageToMeta({
          photoBlob,
          queueId:
            message.id,
          config,
        })

      const providerMessageId =
        await sendPhotoTemplate({
          destinationPhone,
          mediaId,
          templateName,
          studentName,
          className,
          schoolName,
          eventTime,
          queueId:
            message.id,
          config,
        })

      const sentAt =
        new Date()
          .toISOString()

      const {
        error:
          queueUpdateError,
      } = await supabaseAdmin
        .from(
          'whatsapp_notification_queue'
        )
        .update({
          status: 'sent',

          attempts:
            attemptNumber,

          provider_message_id:
            providerMessageId,

          sent_at:
            sentAt,

          provider_status:
  'accepted',

provider_status_updated_at:
  sentAt,

          processing_started_at:
            null,

          last_error:
            null,

          updated_at:
            sentAt,
        })
        .eq(
          'id',
          message.id
        )

      /*
       * A mensagem já foi aceita pela
       * Meta. Portanto não lançamos novo
       * erro aqui para evitar um reenvio
       * proposital dentro deste mesmo ciclo.
       */
      if (queueUpdateError) {
        console.error(
          '[WHATSAPP WORKER] mensagem enviada, mas fila não atualizada:',
          {
            queueId:
              message.id,

            providerMessageId,

            error:
              queueUpdateError,
          }
        )
      }

      await updateLinkedEventStatus({
        supabaseAdmin,
        message,
        notificationType,
        status: 'sent',
        providerMessageId,
        sentAt,
        errorMessage: null,
      })

      result.sent++
    } catch (error) {
      const errorMessage =
        getErrorMessage(error)

      const finalFailure =
        attemptNumber >=
        MAX_ATTEMPTS

      const nextAttemptAt =
        getRetryDate(
          attemptNumber
        )

      console.error(
        '[WHATSAPP WORKER] falha no envio:',
        {
          queueId:
            message.id,

          notificationType:
            message
              .notification_type,

          attemptNumber,

          finalFailure,

          error:
            errorMessage,
        }
      )

      const {
        error:
          failureUpdateError,
      } = await supabaseAdmin
        .from(
          'whatsapp_notification_queue'
        )
        .update({
          status:
            finalFailure
              ? 'failed'
              : 'queued',

          attempts:
            attemptNumber,

          next_attempt_at:
            nextAttemptAt
              .toISOString(),

          processing_started_at:
            null,

          last_error:
            errorMessage.slice(
              0,
              2000
            ),

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          'id',
          message.id
        )

      if (
        failureUpdateError
      ) {
        console.error(
          '[WHATSAPP WORKER] erro ao reagendar fila:',
          failureUpdateError
        )
      }

      if (notificationType) {
        await updateLinkedEventStatus({
          supabaseAdmin,
          message,
          notificationType,

          status:
            finalFailure
              ? 'failed'
              : 'queued',

          errorMessage:
            errorMessage.slice(
              0,
              2000
            ),
        })
      }

      if (finalFailure) {
        result.failed++
      } else {
        result.retried++
      }
    }
  }

  return result
}