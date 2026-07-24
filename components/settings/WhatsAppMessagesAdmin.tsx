'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'

import { supabase } from '@/lib/supabase'

type MessageTypeFilter =
  | 'all'
  | 'arrival'
  | 'departure'

type MessageStatusFilter =
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

type WhatsAppMessage = {
  id: string

  studentId: string | null
  studentName: string
  className: string | null

  notificationType:
    | 'student_arrival'
    | 'student_departure'

  destinationPhone: string | null

  status: string
  providerStatus: string | null

  attempts: number
  maxAttempts: number | null

  createdAt: string
  updatedAt: string | null
  nextAttemptAt: string | null

  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  failedAt: string | null

  providerMessageId: string | null

  lastError: string | null
  providerErrorCode: string | null
  providerErrorTitle: string | null
  providerErrorDetails: string | null

  photoUrl: string | null

  source: string | null
  photoOrigin: string | null
  eventRecordedAt: string | null
}

type MessageSummary = {
  totalToday: number
  queued: number
  processing: number
  sent: number
  delivered: number
  read: number
  failed: number
}

type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type MessagesResponse = {
  messages?: WhatsAppMessage[]
  summary?: Partial<MessageSummary>
  pagination?: Partial<Pagination>
  canRetry?: boolean
  error?: string
}

type Props = {
  schoolId: string
  currentUserId: string | null
  arrivalEnabled: boolean
  departureEnabled: boolean
  showMessage: (text: string) => void
}

const PAGE_SIZE = 20

const EMPTY_SUMMARY: MessageSummary = {
  totalToday: 0,
  queued: 0,
  processing: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
}

const EMPTY_PAGINATION: Pagination = {
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
  totalPages: 1,
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Data inválida'
  }

  return date.toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'medium',
    }
  )
}

function formatPhone(
  value: string | null
) {
  if (!value) {
    return 'Não informado'
  }

  const digits =
    value.replace(/\D/g, '')

  if (digits.length === 13) {
    return (
      `+${digits.slice(0, 2)} ` +
      `(${digits.slice(2, 4)}) ` +
      `${digits.slice(4, 9)}-` +
      `${digits.slice(9)}`
    )
  }

  if (digits.length === 12) {
    return (
      `+${digits.slice(0, 2)} ` +
      `(${digits.slice(2, 4)}) ` +
      `${digits.slice(4, 8)}-` +
      `${digits.slice(8)}`
    )
  }

  return value
}

function getMessageTypeLabel(
  notificationType:
    WhatsAppMessage['notificationType']
) {
  return notificationType ===
    'student_departure'
    ? 'Saída'
    : 'Entrada'
}

function getSourceLabel(
  source: string | null
) {
  if (source === 'facial') {
    return 'Reconhecimento facial'
  }

  if (source === 'qr') {
    return 'QR Code'
  }

  if (source === 'manual') {
    return 'Manual'
  }

  return source || 'Não informado'
}

function getPhotoOriginLabel(
  photoOrigin: string | null
) {
  if (
    photoOrigin ===
    'facial_capture'
  ) {
    return 'Captura facial'
  }

  if (
    photoOrigin ===
    'profile_snapshot'
  ) {
    return 'Foto de perfil'
  }

  return photoOrigin || 'Não informado'
}

function getEffectiveStatus(
  message: WhatsAppMessage
) {
  return (
    message.providerStatus ||
    message.status ||
    'queued'
  )
}

function getStatusPresentation(
  status: string
) {
  switch (status) {
    case 'queued':
      return {
        label: 'Na fila',
        background: '#fef3c7',
        color: '#b45309',
      }

    case 'processing':
      return {
        label: 'Processando',
        background: '#dbeafe',
        color: '#1d4ed8',
      }

    case 'accepted':
      return {
        label: 'Aceita pela Meta',
        background: '#e0e7ff',
        color: '#4338ca',
      }

    case 'sent':
      return {
        label: 'Enviada',
        background: '#dbeafe',
        color: '#1d4ed8',
      }

    case 'delivered':
      return {
        label: 'Entregue',
        background: '#dcfce7',
        color: '#15803d',
      }

    case 'read':
      return {
        label: 'Lida',
        background: '#ccfbf1',
        color: '#0f766e',
      }

    case 'failed':
      return {
        label: 'Falhou',
        background: '#fee2e2',
        color: '#b91c1c',
      }

    default:
      return {
        label: status || 'Desconhecido',
        background: '#e2e8f0',
        color: '#475569',
      }
  }
}

export default function WhatsAppMessagesAdmin({
  schoolId,
  currentUserId,
  arrivalEnabled,
  departureEnabled,
  showMessage,
}: Props) {
  const hasAnyAddon =
    arrivalEnabled ||
    departureEnabled

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    messages,
    setMessages,
  ] = useState<
    WhatsAppMessage[]
  >([])

  const [
    summary,
    setSummary,
  ] = useState<MessageSummary>(
    EMPTY_SUMMARY
  )

  const [
    pagination,
    setPagination,
  ] = useState<Pagination>(
    EMPTY_PAGINATION
  )

  const [
    canRetry,
    setCanRetry,
  ] = useState(false)

  const [
    typeFilter,
    setTypeFilter,
  ] =
    useState<MessageTypeFilter>(
      'all'
    )

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<MessageStatusFilter>(
      'all'
    )

  const [
    periodFilter,
    setPeriodFilter,
  ] =
    useState<PeriodFilter>(
      'today'
    )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1)

  const [
    selectedMessage,
    setSelectedMessage,
  ] =
    useState<WhatsAppMessage | null>(
      null
    )

  const [
    retryingId,
    setRetryingId,
  ] = useState<string | null>(
    null
  )

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null
  )

  useEffect(() => {
    /*
     * Quando somente um adicional está
     * ativo, o filtro já começa nele.
     */
    if (
      arrivalEnabled &&
      !departureEnabled
    ) {
      setTypeFilter('arrival')
      return
    }

    if (
      departureEnabled &&
      !arrivalEnabled
    ) {
      setTypeFilter('departure')
      return
    }

    if (
      arrivalEnabled &&
      departureEnabled
    ) {
      setTypeFilter('all')
    }
  }, [
    arrivalEnabled,
    departureEnabled,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    typeFilter,
    statusFilter,
    periodFilter,
    search,
  ])

  const loadMessages =
    useCallback(async () => {
      if (
        !schoolId ||
        !currentUserId ||
        !hasAnyAddon
      ) {
        return
      }

      setLoading(true)
      setLoadError(null)

      try {
        const {
          data: { session },
          error: sessionError,
        } =
          await supabase.auth
            .getSession()

        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            'Sessão expirada. Entre novamente para consultar as mensagens.'
          )
        }

        const searchParams =
          new URLSearchParams({
            schoolId,
            type: typeFilter,
            status: statusFilter,
            period: periodFilter,
            page:
              String(currentPage),
            pageSize:
              String(PAGE_SIZE),
          })

        const normalizedSearch =
          search.trim()

        if (normalizedSearch) {
          searchParams.set(
            'search',
            normalizedSearch
          )
        }

        const response =
          await fetch(
            `/api/school/whatsapp-messages?${searchParams.toString()}`,
            {
              method: 'GET',

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache: 'no-store',
            }
          )

        const data =
          await response
            .json()
            .catch(
              () => ({})
            ) as MessagesResponse

        if (!response.ok) {
          throw new Error(
            data.error ||
              'Erro ao carregar mensagens automáticas.'
          )
        }

        setMessages(
          Array.isArray(
            data.messages
          )
            ? data.messages
            : []
        )

        setSummary({
          ...EMPTY_SUMMARY,
          ...(data.summary || {}),
        })

        setPagination({
          ...EMPTY_PAGINATION,
          ...(data.pagination || {}),
        })

        setCanRetry(
          data.canRetry === true
        )
      } catch (error) {
        console.error(
          '[MENSAGENS AUTOMÁTICAS] erro ao carregar:',
          error
        )

        const message =
          error instanceof Error
            ? error.message
            : 'Erro ao carregar mensagens automáticas.'

        setLoadError(message)
        setMessages([])
        setSummary(
          EMPTY_SUMMARY
        )

        showMessage(message)
      } finally {
        setLoading(false)
      }
    }, [
      schoolId,
      currentUserId,
      hasAnyAddon,
      typeFilter,
      statusFilter,
      periodFilter,
      currentPage,
      search,
      showMessage,
    ])

  useEffect(() => {
    if (
      !hasAnyAddon ||
      !currentUserId
    ) {
      return
    }

    /*
     * Pequeno atraso para não fazer uma
     * consulta a cada letra digitada.
     */
    const timeout =
      setTimeout(
        () => {
          loadMessages()
        },
        search.trim()
          ? 350
          : 0
      )

    return () => {
      clearTimeout(timeout)
    }
  }, [
    loadMessages,
    hasAnyAddon,
    currentUserId,
    search,
  ])

  async function retryMessage(
    message: WhatsAppMessage
  ) {
    if (
      !canRetry ||
      retryingId
    ) {
      return
    }

    const confirmed =
      window.confirm(
        `Deseja tentar enviar novamente a mensagem de ${getMessageTypeLabel(
          message.notificationType
        ).toLowerCase()} de ${message.studentName}?`
      )

    if (!confirmed) {
      return
    }

    setRetryingId(
      message.id
    )

    try {
      const {
        data: { session },
        error: sessionError,
      } =
        await supabase.auth
          .getSession()

      if (
        sessionError ||
        !session?.access_token
      ) {
        throw new Error(
          'Sessão expirada.'
        )
      }

      const response =
        await fetch(
          '/api/school/whatsapp-messages/retry',
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${session.access_token}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              schoolId,
              queueId:
                message.id,
            }),
          }
        )

      const data =
        await response
          .json()
          .catch(
            () => ({})
          ) as {
            success?: boolean
            error?: string
          }

      if (!response.ok) {
        throw new Error(
          data.error ||
            'Não foi possível reenviar a mensagem.'
        )
      }

      showMessage(
        'Mensagem adicionada novamente à fila.'
      )

      setSelectedMessage(null)

      await loadMessages()
    } catch (error) {
      console.error(
        '[MENSAGENS AUTOMÁTICAS] erro ao reenviar:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao reenviar mensagem.'
      )
    } finally {
      setRetryingId(null)
    }
  }

  const indicators =
    useMemo(
      () => [
        {
          label:
            'Mensagens hoje',
          value:
            summary.totalToday,
          background:
            '#eff6ff',
          color:
            '#1d4ed8',
        },
        {
          label:
            'Na fila',
          value:
            summary.queued,
          background:
            '#fef3c7',
          color:
            '#b45309',
        },
        {
          label:
            'Processando',
          value:
            summary.processing,
          background:
            '#e0e7ff',
          color:
            '#4338ca',
        },
        {
          label:
            'Entregues',
          value:
            summary.delivered,
          background:
            '#dcfce7',
          color:
            '#15803d',
        },
        {
          label:
            'Lidas',
          value:
            summary.read,
          background:
            '#ccfbf1',
          color:
            '#0f766e',
        },
        {
          label:
            'Falhas',
          value:
            summary.failed,
          background:
            '#fee2e2',
          color:
            '#b91c1c',
        },
      ],
      [summary]
    )

  if (!hasAnyAddon) {
    return (
      <section
        style={{
          ...containerStyle,
          borderColor:
            '#cbd5e1',
          background:
            '#f8fafc',
        }}
      >
        <div style={lockedContentStyle}>
          <div style={lockedIconStyle}>
            🔒
          </div>

          <div>
            <h2 style={sectionTitleStyle}>
              Acompanhamento das mensagens
            </h2>

            <p style={sectionTextStyle}>
              Consulte os avisos de
              chegada e saída enviados
              aos responsáveis.
            </p>

            <div style={lockedNoticeStyle}>
              Este recurso está
              disponível para escolas
              com pelo menos um
              adicional de mensagens
              automáticas ativo.
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section style={containerStyle}>
        <div style={headerRowStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              Acompanhamento das mensagens
            </h2>

            <p style={sectionTextStyle}>
              Visualize envios,
              entregas, leituras e
              possíveis falhas nas
              mensagens automáticas.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMessages}
            disabled={loading}
            style={{
              ...refreshButtonStyle,

              opacity:
                loading ? 0.65 : 1,

              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {loading
              ? 'Atualizando...'
              : 'Atualizar'}
          </button>
        </div>

        <div style={addonStatusRowStyle}>
          <span
            style={{
              ...addonStatusBadgeStyle,

              background:
                arrivalEnabled
                  ? '#dcfce7'
                  : '#f1f5f9',

              color:
                arrivalEnabled
                  ? '#15803d'
                  : '#64748b',
            }}
          >
            Entrada:{' '}
            {arrivalEnabled
              ? 'ativa'
              : 'não contratada'}
          </span>

          <span
            style={{
              ...addonStatusBadgeStyle,

              background:
                departureEnabled
                  ? '#dcfce7'
                  : '#f1f5f9',

              color:
                departureEnabled
                  ? '#15803d'
                  : '#64748b',
            }}
          >
            Saída:{' '}
            {departureEnabled
              ? 'ativa'
              : 'não contratada'}
          </span>
        </div>

        <div style={indicatorsGridStyle}>
          {indicators.map(
            (indicator) => (
              <div
                key={
                  indicator.label
                }
                style={{
                  ...indicatorCardStyle,

                  background:
                    indicator.background,

                  color:
                    indicator.color,
                }}
              >
                <div style={indicatorValueStyle}>
                  {indicator.value}
                </div>

                <div style={indicatorLabelStyle}>
                  {indicator.label}
                </div>
              </div>
            )
          )}
        </div>

        <div style={filtersGridStyle}>
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Buscar aluno..."
            style={inputStyle}
          />

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target
                  .value as
                  MessageTypeFilter
              )
            }
            style={inputStyle}
          >
            {arrivalEnabled &&
              departureEnabled && (
                <option value="all">
                  Entrada e saída
                </option>
              )}

            {arrivalEnabled && (
              <option value="arrival">
                Somente entradas
              </option>
            )}

            {departureEnabled && (
              <option value="departure">
                Somente saídas
              </option>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as
                  MessageStatusFilter
              )
            }
            style={inputStyle}
          >
            <option value="all">
              Todos os status
            </option>

            <option value="queued">
              Na fila
            </option>

            <option value="processing">
              Processando
            </option>

            <option value="accepted">
              Aceita pela Meta
            </option>

            <option value="sent">
              Enviada
            </option>

            <option value="delivered">
              Entregue
            </option>

            <option value="read">
              Lida
            </option>

            <option value="failed">
              Falhou
            </option>
          </select>

          <select
            value={periodFilter}
            onChange={(event) =>
              setPeriodFilter(
                event.target
                  .value as
                  PeriodFilter
              )
            }
            style={inputStyle}
          >
            <option value="today">
              Hoje
            </option>

            <option value="7d">
              Últimos 7 dias
            </option>

            <option value="30d">
              Últimos 30 dias
            </option>

            <option value="all">
              Todo o histórico
            </option>
          </select>
        </div>

        {loadError && (
          <div style={errorNoticeStyle}>
            {loadError}
          </div>
        )}

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>
                  Aluno
                </th>

                <th style={tableHeaderStyle}>
                  Tipo
                </th>

                <th style={tableHeaderStyle}>
                  Registro
                </th>

                <th style={tableHeaderStyle}>
                  Destinatário
                </th>

                <th style={tableHeaderStyle}>
                  Status
                </th>

                <th style={tableHeaderStyle}>
                  Tentativas
                </th>

                <th style={tableHeaderStyle}>
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {loading &&
              messages.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={emptyTableStyle}
                  >
                    Carregando mensagens...
                  </td>
                </tr>
              ) : messages.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={emptyTableStyle}
                  >
                    Nenhuma mensagem
                    encontrada para os
                    filtros selecionados.
                  </td>
                </tr>
              ) : (
                messages.map(
                  (message) => {
                    const status =
                      getEffectiveStatus(
                        message
                      )

                    const presentation =
                      getStatusPresentation(
                        status
                      )

                    return (
                      <tr
                        key={message.id}
                      >
                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <div
                            style={
                              studentCellStyle
                            }
                          >
                            <strong>
                              {
                                message.studentName
                              }
                            </strong>

                            <span>
                              {message.className ||
                                'Sem turma'}
                            </span>
                          </div>
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              ...typeBadgeStyle,

                              background:
                                message.notificationType ===
                                'student_arrival'
                                  ? '#dbeafe'
                                  : '#dcfce7',

                              color:
                                message.notificationType ===
                                'student_arrival'
                                  ? '#1d4ed8'
                                  : '#15803d',
                            }}
                          >
                            {getMessageTypeLabel(
                              message.notificationType
                            )}
                          </span>
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {formatDateTime(
                            message.eventRecordedAt ||
                              message.createdAt
                          )}
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          {formatPhone(
                            message.destinationPhone
                          )}
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <span
                            style={{
                              ...statusBadgeStyle,

                              background:
                                presentation.background,

                              color:
                                presentation.color,
                            }}
                          >
                            {
                              presentation.label
                            }
                          </span>
                        </td>

                        <td
                          style={{
                            ...tableCellStyle,
                            textAlign:
                              'center',
                          }}
                        >
                          {
                            message.attempts
                          }
                        </td>

                        <td
                          style={
                            tableCellStyle
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMessage(
                                message
                              )
                            }
                            style={detailsButtonStyle}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    )
                  }
                )
              )}
            </tbody>
          </table>
        </div>

        <div style={paginationStyle}>
          <button
            type="button"
            disabled={
              pagination.page <= 1 ||
              loading
            }
            onClick={() =>
              setCurrentPage(
                (previous) =>
                  Math.max(
                    1,
                    previous - 1
                  )
              )
            }
            style={paginationButtonStyle}
          >
            Anterior
          </button>

          <span style={paginationTextStyle}>
            Página {pagination.page}{' '}
            de{' '}
            {Math.max(
              1,
              pagination.totalPages
            )}
            {' • '}
            {pagination.total}{' '}
            mensagens
          </span>

          <button
            type="button"
            disabled={
              pagination.page >=
                pagination.totalPages ||
              loading
            }
            onClick={() =>
              setCurrentPage(
                (previous) =>
                  previous + 1
              )
            }
            style={paginationButtonStyle}
          >
            Próxima
          </button>
        </div>
      </section>

      {selectedMessage && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>
                  Detalhes da mensagem
                </h2>

                <p style={sectionTextStyle}>
                  {
                    selectedMessage.studentName
                  }
                  {selectedMessage.className
                    ? ` • ${selectedMessage.className}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedMessage(
                    null
                  )
                }
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <div style={modalContentStyle}>
              <div style={photoAreaStyle}>
                {selectedMessage.photoUrl ? (
                  <img
                    src={
                      selectedMessage.photoUrl
                    }
                    alt="Comprovante"
                    style={photoStyle}
                  />
                ) : (
                  <div style={photoPlaceholderStyle}>
                    Foto indisponível
                  </div>
                )}
              </div>

              <div style={detailsGridStyle}>
                <DetailItem
                  label="Tipo"
                  value={getMessageTypeLabel(
                    selectedMessage.notificationType
                  )}
                />

                <DetailItem
                  label="Status"
                  value={
                    getStatusPresentation(
                      getEffectiveStatus(
                        selectedMessage
                      )
                    ).label
                  }
                />

                <DetailItem
                  label="Origem do registro"
                  value={getSourceLabel(
                    selectedMessage.source
                  )}
                />

                <DetailItem
                  label="Origem da foto"
                  value={getPhotoOriginLabel(
                    selectedMessage.photoOrigin
                  )}
                />

                <DetailItem
                  label="Destinatário"
                  value={formatPhone(
                    selectedMessage.destinationPhone
                  )}
                />

                <DetailItem
                  label="Tentativas"
                  value={String(
                    selectedMessage.attempts
                  )}
                />

                <DetailItem
                  label="Horário do registro"
                  value={formatDateTime(
                    selectedMessage.eventRecordedAt
                  )}
                />

                <DetailItem
                  label="Criada na fila"
                  value={formatDateTime(
                    selectedMessage.createdAt
                  )}
                />

                <DetailItem
                  label="Enviada"
                  value={formatDateTime(
                    selectedMessage.sentAt
                  )}
                />

                <DetailItem
                  label="Entregue"
                  value={formatDateTime(
                    selectedMessage.deliveredAt
                  )}
                />

                <DetailItem
                  label="Lida"
                  value={formatDateTime(
                    selectedMessage.readAt
                  )}
                />

                <DetailItem
                  label="Falhou"
                  value={formatDateTime(
                    selectedMessage.failedAt
                  )}
                />
              </div>

              {(
                selectedMessage.lastError ||
                selectedMessage.providerErrorTitle ||
                selectedMessage.providerErrorDetails
              ) && (
                <div style={errorDetailsStyle}>
                  <strong>
                    Erro no envio
                  </strong>

                  {selectedMessage.providerErrorCode && (
                    <span>
                      Código:{' '}
                      {
                        selectedMessage.providerErrorCode
                      }
                    </span>
                  )}

                  {selectedMessage.providerErrorTitle && (
                    <span>
                      {
                        selectedMessage.providerErrorTitle
                      }
                    </span>
                  )}

                  {selectedMessage.providerErrorDetails && (
                    <span>
                      {
                        selectedMessage.providerErrorDetails
                      }
                    </span>
                  )}

                  {selectedMessage.lastError && (
                    <span>
                      {
                        selectedMessage.lastError
                      }
                    </span>
                  )}
                </div>
              )}

              <div style={modalActionsStyle}>
                {canRetry &&
                  getEffectiveStatus(
                    selectedMessage
                  ) === 'failed' && (
                    <button
                      type="button"
                      disabled={
                        retryingId ===
                        selectedMessage.id
                      }
                      onClick={() =>
                        retryMessage(
                          selectedMessage
                        )
                      }
                      style={{
                        ...retryButtonStyle,

                        opacity:
                          retryingId ===
                          selectedMessage.id
                            ? 0.65
                            : 1,
                      }}
                    >
                      {retryingId ===
                      selectedMessage.id
                        ? 'Reenviando...'
                        : 'Tentar novamente'}
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() =>
                    setSelectedMessage(
                      null
                    )
                  }
                  style={secondaryButtonStyle}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div style={detailItemStyle}>
      <span style={detailLabelStyle}>
        {label}
      </span>

      <strong style={detailValueStyle}>
        {value}
      </strong>
    </div>
  )
}

const containerStyle: CSSProperties = {
  background:
    'rgba(255,255,255,0.96)',
  border:
    '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow:
    '0 16px 40px rgba(15,23,42,0.05)',
}

const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems:
    'flex-start',
  gap: 16,
  flexWrap: 'wrap',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 26,
  fontWeight: 900,
}

const sectionTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  lineHeight: 1.6,
}

const refreshButtonStyle: CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
}

const addonStatusRowStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 18,
}

const addonStatusBadgeStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
}

const indicatorsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(130px, 1fr))',
  gap: 12,
  marginTop: 20,
}

const indicatorCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border:
    '1px solid rgba(148,163,184,0.22)',
}

const indicatorValueStyle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
}

const indicatorLabelStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 900,
  textTransform:
    'uppercase',
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 12,
  marginTop: 22,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '13px 15px',
  borderRadius: 15,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 14,
  outline: 'none',
}

const tableWrapperStyle: CSSProperties = {
  marginTop: 20,
  overflowX: 'auto',
  borderRadius: 18,
  border:
    '1px solid #e2e8f0',
}

const tableStyle: CSSProperties = {
  width: '100%',
  minWidth: 980,
  borderCollapse:
    'collapse',
  background: '#ffffff',
}

const tableHeaderStyle: CSSProperties = {
  padding: '13px 14px',
  background: '#f8fafc',
  borderBottom:
    '1px solid #e2e8f0',
  color: '#475569',
  fontSize: 12,
  fontWeight: 900,
  textAlign: 'left',
  textTransform:
    'uppercase',
  letterSpacing: 0.4,
}

const tableCellStyle: CSSProperties = {
  padding: '14px',
  borderBottom:
    '1px solid #f1f5f9',
  color: '#334155',
  fontSize: 13,
  verticalAlign: 'middle',
}

const studentCellStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  color: '#0f172a',
}

const typeBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 10px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 11,
}

const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '7px 10px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 11,
  whiteSpace: 'nowrap',
}

const detailsButtonStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 12,
  border:
    '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 900,
  cursor: 'pointer',
}

const emptyTableStyle: CSSProperties = {
  padding: 30,
  textAlign: 'center',
  color: '#64748b',
  fontWeight: 700,
}

const paginationStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  marginTop: 18,
}

const paginationButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 13,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const paginationTextStyle: CSSProperties = {
  color: '#475569',
  fontWeight: 800,
  fontSize: 13,
}

const errorNoticeStyle: CSSProperties = {
  marginTop: 18,
  padding: 14,
  borderRadius: 15,
  background: '#fee2e2',
  border:
    '1px solid #fecaca',
  color: '#b91c1c',
  fontWeight: 800,
}

const lockedContentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 16,
}

const lockedIconStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  background: '#e2e8f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 24,
  flexShrink: 0,
}

const lockedNoticeStyle: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 15,
  background: '#ffffff',
  border:
    '1px dashed #cbd5e1',
  color: '#475569',
  fontWeight: 800,
}

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  padding: 16,
  background:
    'rgba(15,23,42,0.58)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const modalStyle: CSSProperties = {
  width:
    'min(880px, 96vw)',
  maxHeight: '94vh',
  overflowY: 'auto',
  borderRadius: 26,
  background: '#ffffff',
  boxShadow:
    '0 28px 90px rgba(15,23,42,0.32)',
}

const modalHeaderStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 2,
  padding: 22,
  background:
    'rgba(255,255,255,0.97)',
  borderBottom:
    '1px solid #e2e8f0',
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems:
    'flex-start',
  gap: 14,
}

const modalTitleStyle: CSSProperties = {
  margin: 0,
  color: '#0f172a',
  fontSize: 25,
  fontWeight: 900,
}

const closeButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
  cursor: 'pointer',
}

const modalContentStyle: CSSProperties = {
  padding: 22,
}

const photoAreaStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 20,
}

const photoStyle: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  maxHeight: 420,
  objectFit: 'contain',
  borderRadius: 20,
  border:
    '1px solid #e2e8f0',
  background: '#f8fafc',
}

const photoPlaceholderStyle: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  minHeight: 220,
  borderRadius: 20,
  border:
    '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#64748b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
}

const detailsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 12,
}

const detailItemStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: '#f8fafc',
  border:
    '1px solid #e2e8f0',
  display: 'grid',
  gap: 6,
}

const detailLabelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 900,
  textTransform:
    'uppercase',
}

const detailValueStyle: CSSProperties = {
  color: '#0f172a',
  fontSize: 14,
  overflowWrap:
    'anywhere',
}

const errorDetailsStyle: CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 17,
  background: '#fff1f2',
  border:
    '1px solid #fecdd3',
  color: '#be123c',
  display: 'grid',
  gap: 7,
  fontSize: 13,
  lineHeight: 1.5,
}

const modalActionsStyle: CSSProperties = {
  marginTop: 20,
  display: 'flex',
  justifyContent:
    'flex-end',
  gap: 12,
  flexWrap: 'wrap',
}

const retryButtonStyle: CSSProperties = {
  padding: '13px 17px',
  borderRadius: 14,
  border: 'none',
  background: '#dc2626',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  padding: '13px 17px',
  borderRadius: 14,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 900,
  cursor: 'pointer',
}