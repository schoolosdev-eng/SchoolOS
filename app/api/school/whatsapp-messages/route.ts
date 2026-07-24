import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SCHOOL_TIMEZONE =
  process.env.WHATSAPP_TIME_ZONE ||
  'America/Fortaleza'

const PHOTO_URL_EXPIRATION_SECONDS =
  10 * 60

type NotificationType =
  | 'student_arrival'
  | 'student_departure'

type TypeFilter =
  | 'all'
  | 'arrival'
  | 'departure'

type StatusFilter =
  | 'all'
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

type PeriodFilter =
  | 'today'
  | '7d'
  | '30d'
  | 'all'

type QueuePayload = {
  studentName?: string
  className?: string

  arrivalTime?: string
  attendanceDate?: string

  departureTime?: string
  exitDate?: string

  source?: string
  photoOrigin?: string
  photoBucket?: string
  photoPath?: string
}

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
  payload: unknown

  status: string
  provider_status:
    | string
    | null

  attempts:
    | number
    | null

  created_at: string
  updated_at:
    | string
    | null

  next_attempt_at:
    | string
    | null

  provider_message_id:
    | string
    | null

  sent_at:
    | string
    | null

  delivered_at:
    | string
    | null

  read_at:
    | string
    | null

  failed_at:
    | string
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

type EvidenceRow = {
  id: string
  class_id:
    | string
    | null

  source:
    | string
    | null

  photo_bucket:
    | string
    | null

  photo_path:
    | string
    | null

  photo_origin:
    | string
    | null

  captured_at:
    | string
    | null
}

type RegularExitRow = {
  id: string
  class_id:
    | string
    | null

  source:
    | string
    | null

  photo_bucket:
    | string
    | null

  photo_path:
    | string
    | null

  photo_origin:
    | string
    | null

  captured_at:
    | string
    | null

  recorded_at:
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
    subscription
      .current_period_start &&
    new Date(
      subscription
        .current_period_start
    ).getTime() >
      now.getTime()
  ) {
    return false
  }

  if (
    subscription
      .current_period_end &&
    new Date(
      subscription
        .current_period_end
    ).getTime() <
      now.getTime()
  ) {
    return false
  }

  return true
}

function getPayload(
  value: unknown
): QueuePayload {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  return value as QueuePayload
}

function getTimeZoneParts(
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

        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',

        hourCycle: 'h23',
      }
    ).formatToParts(date)

  function getPart(
    type: Intl.DateTimeFormatPartTypes
  ) {
    return Number(
      parts.find(
        (part) =>
          part.type === type
      )?.value
    )
  }

  return {
    year:
      getPart('year'),

    month:
      getPart('month'),

    day:
      getPart('day'),

    hour:
      getPart('hour'),

    minute:
      getPart('minute'),

    second:
      getPart('second'),
  }
}

function getTimeZoneOffsetMs(
  date: Date,
  timeZone: string
) {
  const parts =
    getTimeZoneParts(
      date,
      timeZone
    )

  const representedAsUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )

  const originalWithoutMilliseconds =
    Math.floor(
      date.getTime() / 1000
    ) * 1000

  return (
    representedAsUtc -
    originalWithoutMilliseconds
  )
}

function localMidnightToUtc({
  year,
  month,
  day,
  timeZone,
}: {
  year: number
  month: number
  day: number
  timeZone: string
}) {
  const localMidnightAsUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0
    )

  const firstGuess =
    new Date(
      localMidnightAsUtc
    )

  const firstOffset =
    getTimeZoneOffsetMs(
      firstGuess,
      timeZone
    )

  let result =
    new Date(
      localMidnightAsUtc -
        firstOffset
    )

  const correctedOffset =
    getTimeZoneOffsetMs(
      result,
      timeZone
    )

  if (
    correctedOffset !==
    firstOffset
  ) {
    result =
      new Date(
        localMidnightAsUtc -
          correctedOffset
      )
  }

  return result
}

function getPeriodStart(
  period: PeriodFilter
) {
  if (period === 'all') {
    return null
  }

  const now = new Date()

  const todayParts =
    getTimeZoneParts(
      now,
      SCHOOL_TIMEZONE
    )

  const localDate =
    new Date(
      Date.UTC(
        todayParts.year,
        todayParts.month - 1,
        todayParts.day
      )
    )

  const daysBack =
    period === '7d'
      ? 6
      : period === '30d'
      ? 29
      : 0

  localDate.setUTCDate(
    localDate.getUTCDate() -
      daysBack
  )

  return localMidnightToUtc({
    year:
      localDate
        .getUTCFullYear(),

    month:
      localDate
        .getUTCMonth() + 1,

    day:
      localDate
        .getUTCDate(),

    timeZone:
      SCHOOL_TIMEZONE,
  }).toISOString()
}

function getRequestedTypes({
  typeFilter,
  arrivalActive,
  departureActive,
}: {
  typeFilter: TypeFilter
  arrivalActive: boolean
  departureActive: boolean
}) {
  if (
    typeFilter === 'arrival'
  ) {
    return arrivalActive
      ? [
          'student_arrival',
        ] as NotificationType[]
      : []
  }

  if (
    typeFilter ===
    'departure'
  ) {
    return departureActive
      ? [
          'student_departure',
        ] as NotificationType[]
      : []
  }

  const types:
    NotificationType[] = []

  if (arrivalActive) {
    types.push(
      'student_arrival'
    )
  }

  if (departureActive) {
    types.push(
      'student_departure'
    )
  }

  return types
}

function applyNotificationTypes(
  query: any,
  notificationTypes:
    NotificationType[]
) {
  if (
    notificationTypes.length ===
    1
  ) {
    return query.eq(
      'notification_type',
      notificationTypes[0]
    )
  }

  return query.in(
    'notification_type',
    notificationTypes
  )
}

function applyStatusFilter(
  query: any,
  status: StatusFilter
) {
  if (status === 'all') {
    return query
  }

  if (
    status === 'queued' ||
    status === 'processing'
  ) {
    return query.eq(
      'status',
      status
    )
  }

  if (
    status === 'accepted' ||
    status === 'delivered' ||
    status === 'read'
  ) {
    return query.eq(
      'provider_status',
      status
    )
  }

  if (status === 'sent') {
    return query.or(
      [
        'provider_status.eq.sent',

        'and(' +
          'provider_status.is.null,' +
          'status.eq.sent' +
        ')',
      ].join(',')
    )
  }

  return query.or(
    [
      'provider_status.eq.failed',

      'and(' +
        'provider_status.is.null,' +
        'status.eq.failed' +
      ')',
    ].join(',')
  )
}

export async function GET(
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

    const url =
      new URL(request.url)

    const schoolId =
      url.searchParams
        .get('schoolId')
        ?.trim() || ''

    const typeValue =
      url.searchParams
        .get('type') ||
      'all'

    const statusValue =
      url.searchParams
        .get('status') ||
      'all'

    const periodValue =
      url.searchParams
        .get('period') ||
      'today'

    const search =
      url.searchParams
        .get('search')
        ?.trim() || ''

    const requestedPage =
      Number(
        url.searchParams
          .get('page') ||
          '1'
      )

    const requestedPageSize =
      Number(
        url.searchParams
          .get('pageSize') ||
          '20'
      )

    if (!schoolId) {
      return NextResponse.json(
        {
          error:
            'Escola não informada.',
        },
        {
          status: 400,
        }
      )
    }

    const validTypes:
      TypeFilter[] = [
        'all',
        'arrival',
        'departure',
      ]

    const validStatuses:
      StatusFilter[] = [
        'all',
        'queued',
        'processing',
        'accepted',
        'sent',
        'delivered',
        'read',
        'failed',
      ]

    const validPeriods:
      PeriodFilter[] = [
        'today',
        '7d',
        '30d',
        'all',
      ]

    if (
      !validTypes.includes(
        typeValue as TypeFilter
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Filtro de tipo inválido.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !validStatuses.includes(
        statusValue as StatusFilter
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Filtro de status inválido.',
        },
        {
          status: 400,
        }
      )
    }

    if (
      !validPeriods.includes(
        periodValue as PeriodFilter
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Filtro de período inválido.',
        },
        {
          status: 400,
        }
      )
    }

    const typeFilter =
      typeValue as TypeFilter

    const statusFilter =
      statusValue as StatusFilter

    const periodFilter =
      periodValue as PeriodFilter

    const page =
      Number.isFinite(
        requestedPage
      )
        ? Math.max(
            1,
            Math.floor(
              requestedPage
            )
          )
        : 1

    const pageSize =
      Number.isFinite(
        requestedPageSize
      )
        ? Math.max(
            1,
            Math.min(
              50,
              Math.floor(
                requestedPageSize
              )
            )
          )
        : 20

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
     * 2. Admin e gestor podem
     * visualizar o histórico.
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
      !membership ||
      ![
        'admin',
        'gestor',
      ].includes(
        membership.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Usuário sem permissão para acompanhar mensagens automáticas.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * Somente o administrador poderá
     * solicitar o reenvio.
     */
    const canRetry =
      membership.role ===
      'admin'

    /*
     * 3. Verifica quais adicionais
     * estão ativos.
     */
    const {
      data: subscriptions,
      error: subscriptionsError,
    } = await supabaseAdmin
      .from(
        'school_addon_subscriptions'
      )
      .select(`
        addon_code,
        status,
        current_period_start,
        current_period_end
      `)
      .eq(
        'school_id',
        schoolId
      )
      .in(
        'addon_code',
        [
          'arrival_photo_whatsapp',
          'regular_exit_photo_whatsapp',
        ]
      )

    if (subscriptionsError) {
      return NextResponse.json(
        {
          error:
            'Não foi possível verificar os adicionais da escola.',
        },
        {
          status: 500,
        }
      )
    }

    const now =
      new Date()

    const activeAddonCodes =
      new Set(
        (subscriptions || [])
          .filter(
            (subscription) =>
              isActiveSubscription(
                subscription,
                now
              )
          )
          .map(
            (subscription) =>
              subscription
                .addon_code
          )
      )

    const arrivalActive =
      activeAddonCodes.has(
        'arrival_photo_whatsapp'
      )

    const departureActive =
      activeAddonCodes.has(
        'regular_exit_photo_whatsapp'
      )

    if (
      !arrivalActive &&
      !departureActive
    ) {
      return NextResponse.json(
        {
          error:
            'A escola não possui adicionais de mensagens automáticas ativos.',
        },
        {
          status: 403,
        }
      )
    }

    const notificationTypes =
      getRequestedTypes({
        typeFilter,
        arrivalActive,
        departureActive,
      })

    if (
      notificationTypes.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            typeFilter ===
            'arrival'
              ? 'O adicional de mensagens de entrada não está ativo.'
              : 'O adicional de mensagens de saída não está ativo.',
        },
        {
          status: 403,
        }
      )
    }

    /*
     * 4. Busca por aluno.
     */
    let filteredStudentIds:
      string[] | null = null

    if (search) {
      const safeSearch =
        search
          .replace(
            /[%_]/g,
            ''
          )
          .slice(
            0,
            100
          )

      const {
        data: matchingStudents,
        error:
          matchingStudentsError,
      } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq(
          'school_id',
          schoolId
        )
        .ilike(
          'full_name',
          `%${safeSearch}%`
        )
        .limit(500)

      if (
        matchingStudentsError
      ) {
        return NextResponse.json(
          {
            error:
              'Não foi possível realizar a busca por aluno.',
          },
          {
            status: 500,
          }
        )
      }

      filteredStudentIds =
        (
          matchingStudents ||
          []
        ).map(
          (student) =>
            student.id
        )

      if (
        filteredStudentIds
          .length === 0
      ) {
        return NextResponse.json({
          messages: [],

          summary: {
            totalToday: 0,
            queued: 0,
            processing: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
          },

          pagination: {
            page: 1,
            pageSize,
            total: 0,
            totalPages: 1,
          },

          canRetry,
          arrivalEnabled:
            arrivalActive,
          departureEnabled:
            departureActive,
        })
      }
    }

    const periodStart =
      getPeriodStart(
        periodFilter
      )

    /*
     * 5. Consulta paginada da fila.
     */
    let queueQuery =
      supabaseAdmin
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
          created_at,
          updated_at,
          next_attempt_at,
          provider_message_id,
          sent_at,
          delivered_at,
          read_at,
          failed_at,
          last_error,
          provider_error_code,
          provider_error_title,
          provider_error_details
        `, {
          count: 'exact',
        })
        .eq(
          'school_id',
          schoolId
        )

    queueQuery =
      applyNotificationTypes(
        queueQuery,
        notificationTypes
      )

    queueQuery =
      applyStatusFilter(
        queueQuery,
        statusFilter
      )

    if (periodStart) {
      queueQuery =
        queueQuery.gte(
          'created_at',
          periodStart
        )
    }

    if (
      filteredStudentIds
    ) {
      queueQuery =
        queueQuery.in(
          'student_id',
          filteredStudentIds
        )
    }

    const rangeStart =
      (page - 1) *
      pageSize

    const rangeEnd =
      rangeStart +
      pageSize -
      1

    const {
      data: queueData,
      error: queueError,
      count: totalCount,
    } = await queueQuery
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .range(
        rangeStart,
        rangeEnd
      )

    if (queueError) {
      console.error(
        '[MENSAGENS ADMIN] erro ao consultar fila:',
        queueError
      )

      return NextResponse.json(
        {
          error:
            'Não foi possível carregar o histórico de mensagens.',
        },
        {
          status: 500,
        }
      )
    }

    const queueRows =
      (
        queueData ||
        []
      ) as QueueRow[]

    /*
     * 6. Carrega alunos vinculados.
     */
    const studentIds =
      Array.from(
        new Set(
          queueRows
            .map(
              (row) =>
                row.student_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        )
      )

    const studentMap =
      new Map<
        string,
        string
      >()

    if (
      studentIds.length > 0
    ) {
      const {
        data: studentData,
        error: studentDataError,
      } = await supabaseAdmin
        .from('students')
        .select(
          'id, full_name'
        )
        .eq(
          'school_id',
          schoolId
        )
        .in(
          'id',
          studentIds
        )

      if (studentDataError) {
        console.error(
          '[MENSAGENS ADMIN] erro ao carregar alunos:',
          studentDataError
        )
      } else {
        for (
          const student of
            studentData || []
        ) {
          studentMap.set(
            student.id,
            student.full_name ||
              'Aluno sem nome'
          )
        }
      }
    }

    /*
     * 7. Carrega comprovantes de entrada.
     */
    const evidenceIds =
      Array.from(
        new Set(
          queueRows
            .map(
              (row) =>
                row
                  .attendance_evidence_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        )
      )

    const evidenceMap =
      new Map<
        string,
        EvidenceRow
      >()

    if (
      evidenceIds.length > 0
    ) {
      const {
        data: evidenceData,
        error: evidenceError,
      } = await supabaseAdmin
        .from(
          'attendance_evidence'
        )
        .select(`
          id,
          class_id,
          source,
          photo_bucket,
          photo_path,
          photo_origin,
          captured_at
        `)
        .in(
          'id',
          evidenceIds
        )

      if (evidenceError) {
        console.error(
          '[MENSAGENS ADMIN] erro ao carregar comprovantes:',
          evidenceError
        )
      } else {
        for (
          const evidence of
            evidenceData || []
        ) {
          evidenceMap.set(
            evidence.id,
            evidence as
              EvidenceRow
          )
        }
      }
    }

    /*
     * 8. Carrega registros de saída.
     */
    const regularExitIds =
      Array.from(
        new Set(
          queueRows
            .map(
              (row) =>
                row
                  .regular_exit_id
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            )
        )
      )

    const regularExitMap =
      new Map<
        string,
        RegularExitRow
      >()

    if (
      regularExitIds.length > 0
    ) {
      const {
        data: regularExitData,
        error: regularExitError,
      } = await supabaseAdmin
        .from(
          'student_regular_exits'
        )
        .select(`
          id,
          class_id,
          source,
          photo_bucket,
          photo_path,
          photo_origin,
          captured_at,
          recorded_at
        `)
        .in(
          'id',
          regularExitIds
        )

      if (regularExitError) {
        console.error(
          '[MENSAGENS ADMIN] erro ao carregar saídas:',
          regularExitError
        )
      } else {
        for (
          const regularExit of
            regularExitData || []
        ) {
          regularExitMap.set(
            regularExit.id,
            regularExit as
              RegularExitRow
          )
        }
      }
    }

    /*
     * 9. Carrega nomes das turmas.
     */
    const classIds =
      Array.from(
        new Set(
          [
            ...Array.from(
              evidenceMap.values()
            ).map(
              (evidence) =>
                evidence.class_id
            ),

            ...Array.from(
              regularExitMap.values()
            ).map(
              (regularExit) =>
                regularExit.class_id
            ),
          ].filter(
            (
              id
            ): id is string =>
              Boolean(id)
          )
        )
      )

    const classMap =
      new Map<
        string,
        string
      >()

    if (
      classIds.length > 0
    ) {
      const {
        data: classData,
        error: classDataError,
      } = await supabaseAdmin
        .from('classes')
        .select('id, name')
        .eq(
          'school_id',
          schoolId
        )
        .in(
          'id',
          classIds
        )

      if (classDataError) {
        console.error(
          '[MENSAGENS ADMIN] erro ao carregar turmas:',
          classDataError
        )
      } else {
        for (
          const schoolClass of
            classData || []
        ) {
          classMap.set(
            schoolClass.id,
            schoolClass.name ||
              'Sem turma'
          )
        }
      }
    }

    /*
     * 10. Monta a resposta e cria URLs
     * assinadas apenas para a página atual.
     */
    const messages =
      await Promise.all(
        queueRows.map(
          async (row) => {
            const payload =
              getPayload(
                row.payload
              )

            const evidence =
              row
                .attendance_evidence_id
                ? evidenceMap.get(
                    row
                      .attendance_evidence_id
                  ) || null
                : null

            const regularExit =
              row.regular_exit_id
                ? regularExitMap.get(
                    row
                      .regular_exit_id
                  ) || null
                : null

            const linkedRecord =
              row.notification_type ===
              'student_departure'
                ? regularExit
                : evidence

            const classId =
              linkedRecord
                ?.class_id ||
              null

            const photoBucket =
              linkedRecord
                ?.photo_bucket ||
              payload.photoBucket ||
              null

            const photoPath =
              linkedRecord
                ?.photo_path ||
              payload.photoPath ||
              null

            let photoUrl:
              | string
              | null = null

            if (
              photoBucket &&
              photoPath
            ) {
              const {
                data: signedUrlData,
                error:
                  signedUrlError,
              } =
                await supabaseAdmin
                  .storage
                  .from(
                    photoBucket
                  )
                  .createSignedUrl(
                    photoPath,
                    PHOTO_URL_EXPIRATION_SECONDS
                  )

              if (
                !signedUrlError
              ) {
                photoUrl =
                  signedUrlData
                    ?.signedUrl ||
                  null
              }
            }

            const studentName =
              (
                row.student_id
                  ? studentMap.get(
                      row.student_id
                    )
                  : null
              ) ||
              payload.studentName ||
              'Aluno não encontrado'

            const className =
              (
                classId
                  ? classMap.get(
                      classId
                    )
                  : null
              ) ||
              payload.className ||
              null

            const eventRecordedAt =
              row.notification_type ===
              'student_departure'
                ? regularExit
                    ?.captured_at ||
                  regularExit
                    ?.recorded_at ||
                  payload
                    .departureTime ||
                  row.created_at
                : evidence
                    ?.captured_at ||
                  payload
                    .arrivalTime ||
                  row.created_at

            const source =
              linkedRecord?.source ||
              payload.source ||
              null

            const photoOrigin =
              linkedRecord
                ?.photo_origin ||
              payload.photoOrigin ||
              null

            return {
              id:
                row.id,

              studentId:
                row.student_id,

              studentName,
              className,

              notificationType:
                row.notification_type as
                  NotificationType,

              destinationPhone:
                row
                  .destination_phone,

              status:
                row.status,

              providerStatus:
                row.provider_status,

              attempts:
                Number(
                  row.attempts || 0
                ),

              maxAttempts:
                null,

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at,

              nextAttemptAt:
                row.next_attempt_at,

              sentAt:
                row.sent_at,

              deliveredAt:
                row.delivered_at,

              readAt:
                row.read_at,

              failedAt:
                row.failed_at,

              providerMessageId:
                row
                  .provider_message_id,

              lastError:
                row.last_error,

              providerErrorCode:
                row
                  .provider_error_code ===
                null
                  ? null
                  : String(
                      row
                        .provider_error_code
                    ),

              providerErrorTitle:
                row
                  .provider_error_title,

              providerErrorDetails:
                row
                  .provider_error_details,

              photoUrl,
              source,
              photoOrigin,
              eventRecordedAt,
            }
          }
        )
      )

    /*
     * 11. Indicadores.
     *
     * Eles respeitam tipo, período e
     * busca por aluno, mas ignoram o
     * filtro de status para mostrar todos
     * os cartões simultaneamente.
     */
    async function countMessages({
      startAt,
      effectiveStatus,
    }: {
      startAt:
        | string
        | null

      effectiveStatus?:
        | Exclude<
            StatusFilter,
            'all'
          >
        | null
    }) {
      let countQuery =
        supabaseAdmin
          .from(
            'whatsapp_notification_queue'
          )
          .select(
            'id',
            {
              count: 'exact',
              head: true,
            }
          )
          .eq(
            'school_id',
            schoolId
          )

      countQuery =
        applyNotificationTypes(
          countQuery,
          notificationTypes
        )

      if (startAt) {
        countQuery =
          countQuery.gte(
            'created_at',
            startAt
          )
      }

      if (
        filteredStudentIds
      ) {
        countQuery =
          countQuery.in(
            'student_id',
            filteredStudentIds
          )
      }

      if (effectiveStatus) {
        countQuery =
          applyStatusFilter(
            countQuery,
            effectiveStatus
          )
      }

      const {
        count,
        error,
      } = await countQuery

      if (error) {
        console.error(
          '[MENSAGENS ADMIN] erro ao calcular indicador:',
          {
            effectiveStatus,
            error,
          }
        )

        return 0
      }

      return Number(
        count || 0
      )
    }

    const todayStart =
      getPeriodStart('today')

    const [
      totalToday,
      queued,
      processing,
      sent,
      delivered,
      read,
      failed,
    ] = await Promise.all([
      countMessages({
        startAt:
          todayStart,
        effectiveStatus:
          null,
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'queued',
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'processing',
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'sent',
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'delivered',
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'read',
      }),

      countMessages({
        startAt:
          periodStart,
        effectiveStatus:
          'failed',
      }),
    ])

    const total =
      Number(
        totalCount || 0
      )

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / pageSize
        )
      )

    return NextResponse.json({
      messages,

      summary: {
        totalToday,
        queued,
        processing,
        sent,
        delivered,
        read,
        failed,
      },

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },

      canRetry,

      arrivalEnabled:
        arrivalActive,

      departureEnabled:
        departureActive,
    })
  } catch (error) {
    console.error(
      '[MENSAGENS ADMIN] erro inesperado:',
      error
    )

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao consultar mensagens automáticas.',
      },
      {
        status: 500,
      }
    )
  }
}