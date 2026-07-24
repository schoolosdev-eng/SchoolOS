import {
  after,
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  processWhatsAppQueue,
} from '@/lib/whatsapp/processWhatsAppQueue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type RetryBody = {
  schoolId?: unknown
  queueId?: unknown
}

type NotificationType =
  | 'student_arrival'
  | 'student_departure'

type QueuePayload =
  Record<string, unknown>

type QueueRow = {
  id: string
  school_id: string
  student_id: string | null

  attendance_evidence_id:
    | string
    | null

  regular_exit_id:
    | string
    | null

  destination_phone:
    | string
    | null

  notification_type: string

  payload:
    | QueuePayload
    | null

  status: string

  provider_status:
    | string
    | null

  attempts:
    | number
    | null

  last_error:
    | string
    | null

  provider_error_code:
    | string
    | number
    | null

  provider_error_title:
    | string
    | null

  provider_error_details:
    | string
    | null
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

function normalizePhone(
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

function isActiveSubscription(
  subscription: {
    status?: string | null

    current_period_start?:
      | string
      | null

    current_period_end?:
      | string
      | null
  },
  now: Date
) {
  if (
    subscription.status !==
    'active'
  ) {
    return false
  }

  if (
    subscription.current_period_start
  ) {
    const startsAt =
      new Date(
        subscription
          .current_period_start
      )

    if (
      !Number.isNaN(
        startsAt.getTime()
      ) &&
      startsAt.getTime() >
        now.getTime()
    ) {
      return false
    }
  }

  if (
    subscription.current_period_end
  ) {
    const endsAt =
      new Date(
        subscription
          .current_period_end
      )

    if (
      !Number.isNaN(
        endsAt.getTime()
      ) &&
      endsAt.getTime() <
        now.getTime()
    ) {
      return false
    }
  }

  return true
}

function getPayloadObject(
  value: unknown
): QueuePayload {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  return {
    ...(value as QueuePayload),
  }
}

function getManualRetryCount(
  payload: QueuePayload
) {
  const manualRetry =
    payload.manualRetry

  if (
    !manualRetry ||
    typeof manualRetry !==
      'object' ||
    Array.isArray(manualRetry)
  ) {
    return 0
  }

  const count =
    Number(
      (
        manualRetry as
          Record<
            string,
            unknown
          >
      ).count || 0
    )

  return Number.isFinite(count)
    ? Math.max(
        0,
        Math.floor(count)
      )
    : 0
}

function getRequiredAddonCode(
  notificationType:
    NotificationType
) {
  return notificationType ===
    'student_departure'
    ? 'regular_exit_photo_whatsapp'
    : 'arrival_photo_whatsapp'
}

function getEffectiveStatus(
  queue: QueueRow
) {
  return (
    queue.provider_status ||
    queue.status
  )
}

export async function POST(
  request: Request
) {
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

    const body =
      await request
        .json()
        .catch(
          () => null
        ) as RetryBody | null

    const schoolId =
      typeof body?.schoolId ===
        'string'
        ? body.schoolId.trim()
        : ''

    const queueId =
      typeof body?.queueId ===
        'string'
        ? body.queueId.trim()
        : ''

    if (
      !schoolId ||
      !queueId
    ) {
      return NextResponse.json(
        {
          error:
            'Escola e mensagem são obrigatórias.',
        },
        {
          status: 400,
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
      await supabaseAdmin.auth
        .getUser(
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
     * 2. Apenas administradores podem
     * solicitar reenvio.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabaseAdmin
      .from(
        'school_memberships'
      )
      .select(
        'role, status'
      )
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
      !membership
    ) {
      return NextResponse.json(
        {
          error:
            'Usuário não pertence a esta escola.',
        },
        {
          status: 403,
        }
      )
    }

    if (
      membership.role !==
      'admin'
    ) {
      return NextResponse.json(
        {
          error:
            'Somente administradores podem reenviar mensagens.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 3. Localiza a mensagem.
     */
    const {
      data: queueData,
      error: queueError,
    } = await supabaseAdmin
      .from(
        'whatsapp_notification_queue'
      )
      .select(`
        id,
        school_id,
        student_id,
        attendance_evidence_id,
        regular_exit_id,
        destination_phone,
        notification_type,
        payload,
        status,
        provider_status,
        attempts,
        last_error,
        provider_error_code,
        provider_error_title,
        provider_error_details
      `)
      .eq(
        'id',
        queueId
      )
      .eq(
        'school_id',
        schoolId
      )
      .maybeSingle()

    if (queueError) {
      console.error(
        '[REENVIO WHATSAPP] erro ao consultar fila:',
        queueError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível consultar a mensagem.',
        },
        {
          status: 500,
        }
      )
    }

    if (!queueData) {
      return NextResponse.json(
        {
          error:
            'Mensagem não encontrada.',
        },
        {
          status: 404,
        }
      )
    }

    const queue =
      queueData as QueueRow

    /*
     * 4. Somente mensagens efetivamente
     * falhadas podem ser reenviadas.
     *
     * Quando o webhook informa failed,
     * o status principal pode continuar
     * como sent. Por isso verificamos os
     * dois campos.
     */
    const effectiveStatus =
      getEffectiveStatus(queue)

    if (
      effectiveStatus !==
      'failed'
    ) {
      return NextResponse.json(
        {
          error:
            'Somente mensagens com falha podem ser reenviadas.',
        },
        {
          status: 409,
        }
      )
    }

    let notificationType:
      NotificationType

    if (
      queue.notification_type ===
      'student_arrival' ||
      queue.notification_type ===
      'student_departure'
    ) {
      notificationType =
        queue.notification_type
    } else {
      return NextResponse.json(
        {
          error:
            'Tipo de mensagem não suportado.',
        },
        {
          status: 400,
        }
      )
    }

    /*
     * 5. Confere o vínculo obrigatório
     * com o registro de entrada ou saída.
     */
    if (
      notificationType ===
        'student_arrival' &&
      !queue
        .attendance_evidence_id
    ) {
      return NextResponse.json(
        {
          error:
            'A mensagem de entrada não possui comprovante vinculado.',
        },
        {
          status: 409,
        }
      )
    }

    if (
      notificationType ===
        'student_departure' &&
      !queue.regular_exit_id
    ) {
      return NextResponse.json(
        {
          error:
            'A mensagem de saída não possui registro vinculado.',
        },
        {
          status: 409,
        }
      )
    }

    /*
     * 6. Confere se o adicional
     * correspondente permanece ativo.
     */
    const addonCode =
      getRequiredAddonCode(
        notificationType
      )

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from(
        'school_addon_subscriptions'
      )
      .select(`
        status,
        current_period_start,
        current_period_end
      `)
      .eq(
        'school_id',
        schoolId
      )
      .eq(
        'addon_code',
        addonCode
      )
      .maybeSingle()

    if (
      subscriptionError
    ) {
      return NextResponse.json(
        {
          error:
            'Não foi possível verificar o adicional da escola.',
        },
        {
          status: 500,
        }
      )
    }

    if (
      !subscription ||
      !isActiveSubscription(
        subscription,
        new Date()
      )
    ) {
      return NextResponse.json(
        {
          error:
            notificationType ===
            'student_arrival'
              ? 'O adicional de mensagens de entrada não está ativo.'
              : 'O adicional de mensagens de saída não está ativo.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 7. Confere o telefone e a foto
     * antes de recolocar na fila.
     */
    const destinationPhone =
      normalizePhone(
        queue.destination_phone
      )

    if (!destinationPhone) {
      return NextResponse.json(
        {
          error:
            'A mensagem não possui um WhatsApp válido.',
        },
        {
          status: 409,
        }
      )
    }

    const payload =
      getPayloadObject(
        queue.payload
      )

    const photoPath =
      typeof payload.photoPath ===
        'string'
        ? payload.photoPath.trim()
        : ''

    if (!photoPath) {
      return NextResponse.json(
        {
          error:
            'A mensagem não possui uma foto válida para reenvio.',
        },
        {
          status: 409,
        }
      )
    }

    /*
     * 8. Registra no payload que houve
     * uma tentativa manual administrativa.
     */
    const now =
      new Date()
        .toISOString()

    const previousAttempts =
      Number(
        queue.attempts || 0
      )

    const manualRetryCount =
      getManualRetryCount(
        payload
      ) + 1

    const previousError =
      queue
        .provider_error_details ||
      queue
        .provider_error_title ||
      queue.last_error ||
      null

    const nextPayload = {
      ...payload,

      manualRetry: {
        count:
          manualRetryCount,

        requestedAt:
          now,

        requestedByUserId:
          user.id,

        previousAttempts,

        previousStatus:
          effectiveStatus,

        previousError,
      },
    }

    /*
     * 9. Reutiliza a mesma linha da fila.
     *
     * As tentativas voltam para zero para
     * que o worker disponibilize novamente
     * todo o ciclo de tentativas.
     */
    const {
      data: updatedQueue,
      error: updateError,
    } = await supabaseAdmin
      .from(
        'whatsapp_notification_queue'
      )
      .update({
        destination_phone:
          destinationPhone,

        payload:
          nextPayload,

        status:
          'queued',

        provider_status:
          null,

        provider_status_updated_at:
          null,

        attempts:
          0,

        next_attempt_at:
          now,

        processing_started_at:
          null,

        provider_message_id:
          null,

        sent_at:
          null,

        delivered_at:
          null,

        read_at:
          null,

        failed_at:
          null,

        provider_error_code:
          null,

        provider_error_title:
          null,

        provider_error_details:
          null,

        last_error:
          null,

        updated_at:
          now,
      })
      .eq(
        'id',
        queue.id
      )
      .eq(
        'school_id',
        schoolId
      )
      .select(
        'id, status, attempts'
      )
      .single()

    if (
      updateError ||
      !updatedQueue
    ) {
      console.error(
        '[REENVIO WHATSAPP] erro ao reiniciar fila:',
        updateError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível adicionar a mensagem novamente à fila.',
        },
        {
          status: 500,
        }
      )
    }

    /*
     * 10. Atualiza o registro vinculado.
     */
    if (
      notificationType ===
      'student_arrival'
    ) {
      const {
        error:
          evidenceUpdateError,
      } = await supabaseAdmin
        .from(
          'attendance_evidence'
        )
        .update({
          whatsapp_status:
            'queued',

          whatsapp_provider_message_id:
            null,

          whatsapp_sent_at:
            null,

          whatsapp_error:
            null,
        })
        .eq(
          'id',
          queue
            .attendance_evidence_id!
        )
        .eq(
          'school_id',
          schoolId
        )

      if (
        evidenceUpdateError
      ) {
        console.error(
          '[REENVIO WHATSAPP] comprovante não atualizado:',
          evidenceUpdateError
        )
      }
    } else {
      const {
        error:
          exitUpdateError,
      } = await supabaseAdmin
        .from(
          'student_regular_exits'
        )
        .update({
          whatsapp_status:
            'queued',

          whatsapp_provider_message_id:
            null,

          whatsapp_sent_at:
            null,

          whatsapp_error:
            null,
        })
        .eq(
          'id',
          queue
            .regular_exit_id!
        )
        .eq(
          'school_id',
          schoolId
        )

      if (exitUpdateError) {
        console.error(
          '[REENVIO WHATSAPP] saída não atualizada:',
          exitUpdateError
        )
      }
    }

    /*
     * 11. Tenta enviar imediatamente.
     *
     * Caso a execução seja interrompida,
     * a mensagem permanece em queued e
     * poderá ser processada por um novo
     * registro, pelo Postman ou pelo futuro
     * Cron de segurança.
     */
    after(async () => {
      try {
        const result =
          await processWhatsAppQueue(
            1
          )

        console.log(
          '[REENVIO WHATSAPP] worker concluído:',
          {
            queueId:
              queue.id,

            result,
          }
        )
      } catch (error) {
        console.error(
          '[REENVIO WHATSAPP] erro ao processar:',
          error
        )
      }
    })

    return NextResponse.json({
      success: true,

      queueId:
        queue.id,

      status:
        'queued',

      previousAttempts,

      manualRetryCount,

      message:
        'Mensagem adicionada novamente à fila.',
    })
  } catch (error) {
    console.error(
      '[REENVIO WHATSAPP] erro inesperado:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao reenviar a mensagem.',
      },
      {
        status: 500,
      }
    )
  }
}