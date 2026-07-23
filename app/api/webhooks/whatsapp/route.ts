import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'crypto'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type MetaWebhookStatus = {
  id?: string
  status?: string
  timestamp?: string
  recipient_id?: string

  /*
   * O SchoolOS envia o ID da fila neste
   * campo ao criar a mensagem.
   */
  biz_opaque_callback_data?: string

  conversation?: {
    id?: string
  }

  errors?: Array<{
    code?: string | number
    title?: string
    message?: string

    error_data?: {
      details?: string
    }
  }>
}

type QueueRow = {
  id: string
  notification_type: string

  attendance_evidence_id:
    | string
    | null

  regular_exit_id:
    | string
    | null

  provider_message_id:
    | string
    | null

  provider_status:
    | string
    | null

  provider_status_updated_at:
    | string
    | null

  delivered_at:
    | string
    | null

  read_at:
    | string
    | null
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

function isUuid(
  value: string | null | undefined
) {
  if (!value) return false

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader:
    | string
    | null
) {
  const appSecret =
    process.env.WHATSAPP_APP_SECRET

  if (
    !appSecret ||
    !signatureHeader?.startsWith(
      'sha256='
    )
  ) {
    return false
  }

  const receivedSignature =
    signatureHeader.slice(
      'sha256='.length
    )

  if (
    !/^[0-9a-f]{64}$/i.test(
      receivedSignature
    )
  ) {
    return false
  }

  const expectedSignature =
    createHmac(
      'sha256',
      appSecret
    )
      .update(rawBody)
      .digest('hex')

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      'hex'
    )

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      'hex'
    )

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false
  }

  return timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  )
}

function getEventTimestamp(
  value:
    | string
    | undefined
) {
  const timestampSeconds =
    Number(value)

  if (
    Number.isFinite(
      timestampSeconds
    ) &&
    timestampSeconds > 0
  ) {
    return new Date(
      timestampSeconds * 1000
    ).toISOString()
  }

  return new Date().toISOString()
}

function getProviderError(
  status: MetaWebhookStatus
) {
  const firstError =
    status.errors?.[0]

  if (!firstError) {
    return {
      code: null,
      title: null,
      details: null,
    }
  }

  return {
    code:
      firstError.code !==
        undefined &&
      firstError.code !== null
        ? String(
            firstError.code
          )
        : null,

    title:
      firstError.title ||
      firstError.message ||
      null,

    details:
      firstError.error_data
        ?.details ||
      firstError.message ||
      firstError.title ||
      null,
  }
}

function createEventKey(
  status: MetaWebhookStatus
) {
  const providerError =
    getProviderError(status)

  const stableValue = [
    status.id || '',
    status.status || '',
    status.timestamp || '',
    status.recipient_id || '',
    status
      .biz_opaque_callback_data ||
      '',
    providerError.code || '',
  ].join('|')

  return createHash('sha256')
    .update(stableValue)
    .digest('hex')
}

function extractStatuses(
  body: any
): MetaWebhookStatus[] {
  const statuses:
    MetaWebhookStatus[] = []

  for (
    const entry of body?.entry ||
    []
  ) {
    for (
      const change of
        entry?.changes || []
    ) {
      const changeStatuses =
        change?.value?.statuses

      if (
        Array.isArray(
          changeStatuses
        )
      ) {
        statuses.push(
          ...changeStatuses
        )
      }
    }
  }

  return statuses
}

function delay(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      )
    }
  )
}

async function findQueueRow({
  supabaseAdmin,
  status,
}: {
  supabaseAdmin:
    ReturnType<
      typeof createAdminClient
    >

  status: MetaWebhookStatus
}) {
  const queueId =
    status
      .biz_opaque_callback_data
      ?.trim()

  const providerMessageId =
    status.id?.trim()

  /*
   * O webhook pode chegar quase ao mesmo
   * tempo em que o worker atualiza o wamid.
   * Tentamos algumas vezes antes de desistir.
   */
  for (
    let attempt = 0;
    attempt < 4;
    attempt++
  ) {
    if (
      queueId &&
      isUuid(queueId)
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          'whatsapp_notification_queue'
        )
        .select(`
          id,
          notification_type,
          attendance_evidence_id,
          regular_exit_id,
          provider_message_id,
          provider_status,
          provider_status_updated_at,
          delivered_at,
          read_at
        `)
        .eq('id', queueId)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (data) {
        return data as QueueRow
      }
    }

    if (providerMessageId) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          'whatsapp_notification_queue'
        )
        .select(`
          id,
          notification_type,
          attendance_evidence_id,
          regular_exit_id,
          provider_message_id,
          provider_status,
          provider_status_updated_at,
          delivered_at,
          read_at
        `)
        .eq(
          'provider_message_id',
          providerMessageId
        )
        .maybeSingle()

      if (error) {
        throw error
      }

      if (data) {
        return data as QueueRow
      }
    }

    await delay(
      250 * (attempt + 1)
    )
  }

  return null
}

function getStatusRank(
  status:
    | string
    | null
    | undefined
) {
  const ranks:
    Record<string, number> = {
      accepted: 0,
      sent: 1,
      delivered: 2,
      read: 3,
    }

  return ranks[
    status || ''
  ] ?? 0
}

function chooseProviderStatus(
  currentStatus:
    | string
    | null,
  incomingStatus: string
) {
  if (!currentStatus) {
    return incomingStatus
  }

  /*
   * Falha é tratada como estado final.
   */
  if (
    currentStatus === 'failed'
  ) {
    return currentStatus
  }

  if (
    incomingStatus === 'failed'
  ) {
    return incomingStatus
  }

  return getStatusRank(
    incomingStatus
  ) >=
    getStatusRank(
      currentStatus
    )
    ? incomingStatus
    : currentStatus
}

async function ensureWebhookEvent({
  supabaseAdmin,
  eventKey,
  status,
}: {
  supabaseAdmin:
    ReturnType<
      typeof createAdminClient
    >

  eventKey: string
  status: MetaWebhookStatus
}) {
  const {
    data: existingEvent,
    error: existingError,
  } = await supabaseAdmin
    .from(
      'whatsapp_webhook_events'
    )
    .select(
      'id, processed'
    )
    .eq(
      'event_key',
      eventKey
    )
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existingEvent) {
    return existingEvent
  }

  const providerError =
    getProviderError(status)

  const {
    data: insertedEvent,
    error: insertError,
  } = await supabaseAdmin
    .from(
      'whatsapp_webhook_events'
    )
    .insert({
      event_key:
        eventKey,

      provider_message_id:
        status.id || 'unknown',

      event_status:
        status.status ||
        'unknown',

      recipient_id:
        status.recipient_id ||
        null,

      event_timestamp:
        getEventTimestamp(
          status.timestamp
        ),

      conversation_id:
        status.conversation
          ?.id || null,

      error_code:
        providerError.code,

      error_title:
        providerError.title,

      error_details:
        providerError.details,

      raw_event:
        status,

      processed:
        false,
    })
    .select(
      'id, processed'
    )
    .single()

  if (
    insertError?.code ===
    '23505'
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        'whatsapp_webhook_events'
      )
      .select(
        'id, processed'
      )
      .eq(
        'event_key',
        eventKey
      )
      .single()

    if (error) {
      throw error
    }

    return data
  }

  if (
    insertError ||
    !insertedEvent
  ) {
    throw (
      insertError ||
      new Error(
        'Não foi possível registrar o evento do webhook.'
      )
    )
  }

  return insertedEvent
}

async function updateLinkedRecord({
  supabaseAdmin,
  queue,
  incomingStatus,
  finalProviderStatus,
  eventTimestamp,
  providerError,
}: {
  supabaseAdmin:
    ReturnType<
      typeof createAdminClient
    >

  queue: QueueRow
  incomingStatus: string
  finalProviderStatus: string
  eventTimestamp: string

  providerError: {
    code: string | null
    title: string | null
    details: string | null
  }
}) {
  const updatePayload:
    Record<string, unknown> = {
      whatsapp_delivery_status:
        finalProviderStatus,
  }

  if (
    incomingStatus ===
    'delivered'
  ) {
    updatePayload
      .whatsapp_delivered_at =
      eventTimestamp
  }

  if (
    incomingStatus === 'read'
  ) {
    updatePayload
      .whatsapp_read_at =
      eventTimestamp

    /*
     * A Meta pode enviar read sem que
     * delivered tenha chegado antes.
     */
    updatePayload
      .whatsapp_delivered_at =
      eventTimestamp
  }

  if (
    incomingStatus ===
    'failed'
  ) {
    updatePayload
      .whatsapp_status =
      'failed'

    updatePayload
      .whatsapp_failed_at =
      eventTimestamp

    updatePayload
      .whatsapp_error =
      providerError.details ||
      providerError.title ||
      providerError.code ||
      'Falha de entrega informada pela Meta.'
  }

  if (
    queue
      .attendance_evidence_id
  ) {
    const {
      error,
    } = await supabaseAdmin
      .from(
        'attendance_evidence'
      )
      .update(updatePayload)
      .eq(
        'id',
        queue
          .attendance_evidence_id
      )

    if (error) {
      throw error
    }

    return
  }

  if (
    queue.regular_exit_id
  ) {
    const {
      error,
    } = await supabaseAdmin
      .from(
        'student_regular_exits'
      )
      .update(updatePayload)
      .eq(
        'id',
        queue.regular_exit_id
      )

    if (error) {
      throw error
    }

    return
  }

  throw new Error(
    'Mensagem sem vínculo com entrada ou saída.'
  )
}

async function processStatusEvent({
  supabaseAdmin,
  status,
}: {
  supabaseAdmin:
    ReturnType<
      typeof createAdminClient
    >

  status: MetaWebhookStatus
}) {
  const providerMessageId =
    status.id?.trim()

  const incomingStatus =
    status.status
      ?.trim()
      .toLowerCase()

  if (
    !providerMessageId ||
    !incomingStatus
  ) {
    return true
  }

  const eventKey =
    createEventKey(status)

  const event =
    await ensureWebhookEvent({
      supabaseAdmin,
      eventKey,
      status,
    })

  /*
   * Evento duplicado já processado.
   */
  if (event.processed) {
    return true
  }

  const queue =
    await findQueueRow({
      supabaseAdmin,
      status,
    })

  if (!queue) {
    await supabaseAdmin
      .from(
        'whatsapp_webhook_events'
      )
      .update({
        processing_error:
          'Mensagem da fila ainda não encontrada.',
      })
      .eq(
        'id',
        event.id
      )

    return false
  }

  const eventTimestamp =
    getEventTimestamp(
      status.timestamp
    )

  const providerError =
    getProviderError(status)

  const finalProviderStatus =
    chooseProviderStatus(
      queue.provider_status,
      incomingStatus
    )

  const queueUpdate:
    Record<string, unknown> = {
      updated_at:
        new Date().toISOString(),
  }

  if (
    finalProviderStatus !==
      queue.provider_status ||
    !queue
      .provider_status_updated_at
  ) {
    queueUpdate.provider_status =
      finalProviderStatus

    queueUpdate
      .provider_status_updated_at =
      eventTimestamp
  }

  if (
    !queue.provider_message_id
  ) {
    queueUpdate
      .provider_message_id =
      providerMessageId
  }

  if (
    incomingStatus ===
    'delivered'
  ) {
    queueUpdate.delivered_at =
      eventTimestamp
  }

  if (
    incomingStatus === 'read'
  ) {
    queueUpdate.read_at =
      eventTimestamp

    if (!queue.delivered_at) {
      queueUpdate.delivered_at =
        eventTimestamp
    }
  }

  if (
    incomingStatus ===
    'failed'
  ) {
    queueUpdate.status =
      'failed'

    queueUpdate.failed_at =
      eventTimestamp

    queueUpdate
      .processing_started_at =
      null

    queueUpdate.last_error =
      (
        providerError.details ||
        providerError.title ||
        providerError.code ||
        'Falha de entrega informada pela Meta.'
      ).slice(0, 2000)

    queueUpdate
      .provider_error_code =
      providerError.code

    queueUpdate
      .provider_error_title =
      providerError.title

    queueUpdate
      .provider_error_details =
      providerError.details
  }

  const {
    error: queueUpdateError,
  } = await supabaseAdmin
    .from(
      'whatsapp_notification_queue'
    )
    .update(queueUpdate)
    .eq(
      'id',
      queue.id
    )

  if (queueUpdateError) {
    throw queueUpdateError
  }

  await updateLinkedRecord({
    supabaseAdmin,
    queue,
    incomingStatus,
    finalProviderStatus,
    eventTimestamp,
    providerError,
  })

  const {
    error: eventUpdateError,
  } = await supabaseAdmin
    .from(
      'whatsapp_webhook_events'
    )
    .update({
      queue_id:
        queue.id,

      processed:
        true,

      processing_error:
        null,

      processed_at:
        new Date().toISOString(),
    })
    .eq(
      'id',
      event.id
    )

  if (eventUpdateError) {
    throw eventUpdateError
  }

  return true
}

/*
 * Verificação inicial da URL pela Meta.
 */
export async function GET(
  request: Request
) {
  const url =
    new URL(request.url)

  const mode =
    url.searchParams.get(
      'hub.mode'
    )

  const verifyToken =
    url.searchParams.get(
      'hub.verify_token'
    )

  const challenge =
    url.searchParams.get(
      'hub.challenge'
    )

  const configuredToken =
    process.env
      .WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (!configuredToken) {
    return NextResponse.json(
      {
        error:
          'WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado.',
      },
      {
        status: 500,
      }
    )
  }

  if (
    mode === 'subscribe' &&
    verifyToken ===
      configuredToken &&
    challenge
  ) {
    return new Response(
      challenge,
      {
        status: 200,

        headers: {
          'Content-Type':
            'text/plain',
        },
      }
    )
  }

  return NextResponse.json(
    {
      error:
        'Falha na verificação do webhook.',
    },
    {
      status: 403,
    }
  )
}

/*
 * Recebimento dos eventos reais.
 */
export async function POST(
  request: Request
) {
  const rawBody =
    Buffer.from(
      await request.arrayBuffer()
    )

  const signature =
    request.headers.get(
      'x-hub-signature-256'
    )

  if (
    !verifyMetaSignature(
      rawBody,
      signature
    )
  ) {
    console.error(
      '[WHATSAPP WEBHOOK] assinatura inválida.'
    )

    return NextResponse.json(
      {
        error:
          'Assinatura inválida.',
      },
      {
        status: 401,
      }
    )
  }

  let body: any

  try {
    body = JSON.parse(
      rawBody.toString(
        'utf8'
      )
    )
  } catch {
    return NextResponse.json(
      {
        error:
          'Payload JSON inválido.',
      },
      {
        status: 400,
      }
    )
  }

  /*
   * Ignora outros objetos sem gerar
   * repetição desnecessária da Meta.
   */
  if (
    body?.object !==
    'whatsapp_business_account'
  ) {
    return NextResponse.json({
      received: true,
      ignored: true,
    })
  }

  const statuses =
    extractStatuses(body)

  if (
    statuses.length === 0
  ) {
    return NextResponse.json({
      received: true,
      statuses: 0,
    })
  }

  const supabaseAdmin =
    createAdminClient()

  let processed = 0
  let pending = 0

  for (
    const status of statuses
  ) {
    try {
      const success =
        await processStatusEvent({
          supabaseAdmin,
          status,
        })

      if (success) {
        processed++
      } else {
        pending++
      }
    } catch (error) {
      pending++

      console.error(
        '[WHATSAPP WEBHOOK] erro ao processar status:',
        {
          providerMessageId:
            status.id,

          status:
            status.status,

          error,
        }
      )
    }
  }

  /*
   * O 500 pede que a Meta repita o evento.
   * Os eventos já processados são idempotentes.
   */
  if (pending > 0) {
    return NextResponse.json(
      {
        received: true,
        processed,
        pending,
      },
      {
        status: 500,
      }
    )
  }

  return NextResponse.json({
    received: true,
    processed,
    pending: 0,
  })
}