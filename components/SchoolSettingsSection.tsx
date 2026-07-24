'use client'

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { supabase } from '@/lib/supabase'
import WhatsAppMessagesAdmin from '@/components/settings/WhatsAppMessagesAdmin'

type AddonCode =
  | 'arrival_photo_whatsapp'
  | 'regular_exit_photo_whatsapp'

type CoverageMode =
  | 'all'
  | 'selected'

type SettingsStudent = {
  id: string
  name: string | null
  full_name: string | null
  profile_photo_path?: string | null
  responsible_whatsapp?: string | null
  class_name?: string | null
}

type AddonSubscription = {
  id: string
  addon_plan_id: string
  addon_code: AddonCode
  status: string
  student_limit: number | null
  coverage_mode: CoverageMode
  current_period_start: string | null
  current_period_end: string | null
}

type Props = {
  schoolId: string
  currentUserId: string | null
  students: SettingsStudent[]
  showMessage: (text: string) => void
}

const ADDON_CODES: AddonCode[] = [
  'arrival_photo_whatsapp',
  'regular_exit_photo_whatsapp',
]

const PAGE_SIZE = 30

function createEmptySubscriptionMap() {
  return {
    arrival_photo_whatsapp: null,
    regular_exit_photo_whatsapp: null,
  } as Record<
    AddonCode,
    AddonSubscription | null
  >
}

function createEmptySelectionMap() {
  return {
    arrival_photo_whatsapp:
      new Set<string>(),

    regular_exit_photo_whatsapp:
      new Set<string>(),
  } as Record<
    AddonCode,
    Set<string>
  >
}

function getStudentName(
  student: SettingsStudent
) {
  return (
    student.full_name ||
    student.name ||
    'Aluno sem nome'
  )
}

function isSubscriptionActive(
  subscription:
    | AddonSubscription
    | null
) {
  if (
    !subscription ||
    subscription.status !== 'active'
  ) {
    return false
  }

  const now = Date.now()

  if (
    subscription.current_period_start &&
    new Date(
      subscription.current_period_start
    ).getTime() > now
  ) {
    return false
  }

  if (
    subscription.current_period_end &&
    new Date(
      subscription.current_period_end
    ).getTime() < now
  ) {
    return false
  }

  return true
}

function formatDate(
  value: string | null
) {
  if (!value) {
    return 'Sem vencimento definido'
  }

  const date = new Date(value)

  if (
    Number.isNaN(date.getTime())
  ) {
    return 'Data inválida'
  }

  return date.toLocaleDateString(
    'pt-BR'
  )
}

export default function SchoolSettingsSection({
  schoolId,
  currentUserId,
  students,
  showMessage,
}: Props) {
  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    subscriptions,
    setSubscriptions,
  ] = useState<
    Record<
      AddonCode,
      AddonSubscription | null
    >
  >(createEmptySubscriptionMap)

  const [
    selectedStudents,
    setSelectedStudents,
  ] = useState<
    Record<
      AddonCode,
      Set<string>
    >
  >(createEmptySelectionMap)

  const [
    savingCoverage,
    setSavingCoverage,
  ] = useState<AddonCode | null>(
    null
  )

  const [
    savingAssignment,
    setSavingAssignment,
  ] = useState<string | null>(
    null
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    classFilter,
    setClassFilter,
  ] = useState('all')

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1)

  const [
    photoUrls,
    setPhotoUrls,
  ] = useState<
    Record<string, string | null>
  >({})

  async function loadSettings() {
    setLoading(true)

    try {
      const {
        data: subscriptionData,
        error: subscriptionError,
      } = await supabase
        .from(
          'school_addon_subscriptions'
        )
        .select(`
          id,
          addon_plan_id,
          addon_code,
          status,
          student_limit,
          coverage_mode,
          current_period_start,
          current_period_end
        `)
        .eq(
          'school_id',
          schoolId
        )
        .in(
          'addon_code',
          ADDON_CODES
        )

      if (subscriptionError) {
        throw subscriptionError
      }

      const nextSubscriptions =
        createEmptySubscriptionMap()

      for (
        const subscription of
          subscriptionData || []
      ) {
        const addonCode =
          subscription.addon_code as
            AddonCode

        if (
          ADDON_CODES.includes(
            addonCode
          )
        ) {
          nextSubscriptions[
            addonCode
          ] =
            subscription as
              AddonSubscription
        }
      }

      setSubscriptions(
        nextSubscriptions
      )

      const {
        data: assignmentData,
        error: assignmentError,
      } = await supabase
        .from(
          'school_addon_student_assignments'
        )
        .select(`
          student_id,
          addon_code,
          is_active
        `)
        .eq(
          'school_id',
          schoolId
        )
        .in(
          'addon_code',
          ADDON_CODES
        )
        .eq(
          'is_active',
          true
        )

      if (assignmentError) {
        throw assignmentError
      }

      const nextSelections =
        createEmptySelectionMap()

      for (
        const assignment of
          assignmentData || []
      ) {
        const addonCode =
          assignment.addon_code as
            AddonCode

        if (
          ADDON_CODES.includes(
            addonCode
          )
        ) {
          nextSelections[
            addonCode
          ].add(
            assignment.student_id
          )
        }
      }

      setSelectedStudents(
        nextSelections
      )
    } catch (error) {
      console.error(
        '[CONFIGURAÇÕES] erro ao carregar:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao carregar configurações.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!schoolId) return

    loadSettings()
  }, [schoolId])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    search,
    classFilter,
  ])

  const classNames =
    useMemo(() => {
      return Array.from(
        new Set(
          students
            .map(
              (student) =>
                student.class_name
            )
            .filter(
              (
                className
              ): className is string =>
                Boolean(
                  className &&
                  className !==
                    'Sem turma'
                )
            )
        )
      ).sort((a, b) =>
        a.localeCompare(
          b,
          'pt-BR'
        )
      )
    }, [students])

  const filteredStudents =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLocaleLowerCase(
            'pt-BR'
          )

      return [...students]
        .filter((student) => {
          const name =
            getStudentName(
              student
            )
              .toLocaleLowerCase(
                'pt-BR'
              )

          const className =
            student.class_name ||
            'Sem turma'

          const matchesSearch =
            !normalizedSearch ||
            name.includes(
              normalizedSearch
            )

          const matchesClass =
            classFilter === 'all' ||
            className ===
              classFilter

          return (
            matchesSearch &&
            matchesClass
          )
        })
        .sort((a, b) =>
          getStudentName(a)
            .localeCompare(
              getStudentName(b),
              'pt-BR'
            )
        )
    }, [
      students,
      search,
      classFilter,
    ])

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredStudents.length /
          PAGE_SIZE
      )
    )

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    )

  const visibleStudents =
    useMemo(() => {
      const start =
        (safeCurrentPage - 1) *
        PAGE_SIZE

      return filteredStudents.slice(
        start,
        start + PAGE_SIZE
      )
    }, [
      filteredStudents,
      safeCurrentPage,
    ])

  useEffect(() => {
    let cancelled = false

    async function loadPhotos() {
      const pending =
        visibleStudents.filter(
          (student) =>
            student.profile_photo_path &&
            !Object.prototype
              .hasOwnProperty.call(
                photoUrls,
                student.id
              )
        )

      if (
        pending.length === 0
      ) {
        return
      }

      const results =
        await Promise.all(
          pending.map(
            async (student) => {
              const {
                data,
                error,
              } =
                await supabase.storage
                  .from(
                    'student-profile-photos'
                  )
                  .createSignedUrl(
                    student
                      .profile_photo_path!,
                    3600
                  )

              return {
                studentId:
                  student.id,

                url:
                  error
                    ? null
                    : data
                        ?.signedUrl ||
                      null,
              }
            }
          )
        )

      if (cancelled) return

      setPhotoUrls(
        (previous) => {
          const next = {
            ...previous,
          }

          for (
            const result of
              results
          ) {
            next[
              result.studentId
            ] = result.url
          }

          return next
        }
      )
    }

    loadPhotos()

    return () => {
      cancelled = true
    }
  }, [
    visibleStudents,
    photoUrls,
  ])

  async function changeCoverageMode(
    addonCode: AddonCode,
    coverageMode: CoverageMode
  ) {
    const subscription =
      subscriptions[addonCode]

    if (
      !isSubscriptionActive(
        subscription
      )
    ) {
      showMessage(
        'Este adicional não está ativo.'
      )

      return
    }

    if (
      subscription
        ?.coverage_mode ===
      coverageMode
    ) {
      return
    }

    setSavingCoverage(
      addonCode
    )

    try {
      const {
        error,
      } = await supabase.rpc(
        'set_school_addon_coverage_mode',
        {
          p_school_id:
            schoolId,

          p_addon_code:
            addonCode,

          p_coverage_mode:
            coverageMode,
        }
      )

      if (error) {
        throw error
      }

      setSubscriptions(
        (previous) => ({
          ...previous,

          [addonCode]:
            previous[addonCode]
              ? {
                  ...previous[
                    addonCode
                  ]!,

                  coverage_mode:
                    coverageMode,
                }
              : null,
        })
      )

      showMessage(
        coverageMode === 'all'
          ? 'O adicional foi liberado para todos os alunos.'
          : 'Agora o adicional será utilizado apenas para alunos selecionados.'
      )
    } catch (error) {
      console.error(
        '[CONFIGURAÇÕES] erro ao alterar cobertura:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao alterar cobertura.'
      )
    } finally {
      setSavingCoverage(null)
    }
  }

  async function toggleStudentAddon(
    studentId: string,
    addonCode: AddonCode
  ) {
    const subscription =
      subscriptions[addonCode]

    if (
      !isSubscriptionActive(
        subscription
      )
    ) {
      showMessage(
        'Este adicional não está ativo.'
      )

      return
    }

    if (
      subscription
        ?.coverage_mode !==
      'selected'
    ) {
      showMessage(
        'Altere a cobertura para “Alunos selecionados”.'
      )

      return
    }

    const assignmentKey =
      `${studentId}:${addonCode}`

    if (
      savingAssignment ===
      assignmentKey
    ) {
      return
    }

    const currentlySelected =
      selectedStudents[
        addonCode
      ].has(studentId)

    setSavingAssignment(
      assignmentKey
    )

    try {
      if (currentlySelected) {
        const {
          error,
        } = await supabase
          .from(
            'school_addon_student_assignments'
          )
          .update({
            is_active: false,

            deactivated_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            'school_id',
            schoolId
          )
          .eq(
            'student_id',
            studentId
          )
          .eq(
            'addon_code',
            addonCode
          )

        if (error) {
          throw error
        }
      } else {
        const now =
          new Date()
            .toISOString()

        const {
          error,
        } = await supabase
          .from(
            'school_addon_student_assignments'
          )
          .upsert(
            {
              school_id:
                schoolId,

              student_id:
                studentId,

              addon_code:
                addonCode,

              is_active:
                true,

              activated_at:
                now,

              deactivated_at:
                null,

              created_by_user_id:
                currentUserId,

              updated_at:
                now,
            },
            {
              onConflict:
                'school_id,student_id,addon_code',
            }
          )

        if (error) {
          throw error
        }
      }

      setSelectedStudents(
        (previous) => {
          const nextSet =
            new Set(
              previous[
                addonCode
              ]
            )

          if (
            currentlySelected
          ) {
            nextSet.delete(
              studentId
            )
          } else {
            nextSet.add(
              studentId
            )
          }

          return {
            ...previous,
            [addonCode]:
              nextSet,
          }
        }
      )
    } catch (error) {
      console.error(
        '[CONFIGURAÇÕES] erro ao alterar aluno:',
        error
      )

      showMessage(
        error instanceof Error
          ? error.message
          : 'Erro ao alterar aluno.'
      )
    } finally {
      setSavingAssignment(
        null
      )
    }
  }

  function renderAddonCard({
    addonCode,
    title,
    description,
  }: {
    addonCode: AddonCode
    title: string
    description: string
  }) {
    const subscription =
      subscriptions[addonCode]

    const active =
      isSubscriptionActive(
        subscription
      )

    const selectedCount =
      selectedStudents[
        addonCode
      ].size

    return (
      <div style={addonCardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {title}
            </h3>

            <p
              style={{
                margin:
                  '7px 0 0',
                color: '#64748b',
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          </div>

          <span
            style={{
              ...statusBadgeStyle,

              background:
                active
                  ? '#dcfce7'
                  : '#fee2e2',

              color:
                active
                  ? '#15803d'
                  : '#b91c1c',
            }}
          >
            {active
              ? 'Ativo'
              : 'Não contratado'}
          </span>
        </div>

        {subscription && (
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              color: '#475569',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span>
              Limite:{' '}
              {subscription
                .student_limit ||
                'Ilimitado'}
            </span>

            <span>
              Vencimento:{' '}
              {formatDate(
                subscription
                  .current_period_end
              )}
            </span>

            {subscription
              .coverage_mode ===
              'selected' && (
              <span>
                Selecionados:{' '}
                {selectedCount}
                {subscription
                  .student_limit
                  ? `/${subscription.student_limit}`
                  : ''}
              </span>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12,
          }}
        >
          <button
            disabled={
              !active ||
              savingCoverage ===
                addonCode
            }
            onClick={() =>
              changeCoverageMode(
                addonCode,
                'all'
              )
            }
            style={{
              ...coverageButtonStyle,

              borderColor:
                subscription
                  ?.coverage_mode ===
                'all'
                  ? '#2563eb'
                  : '#cbd5e1',

              background:
                subscription
                  ?.coverage_mode ===
                'all'
                  ? '#dbeafe'
                  : '#ffffff',

              color:
                subscription
                  ?.coverage_mode ===
                'all'
                  ? '#1d4ed8'
                  : '#334155',

              opacity:
                active ? 1 : 0.55,
            }}
          >
            <strong>
              Todos os alunos
            </strong>

            <span>
              O recurso vale para toda
              a escola.
            </span>
          </button>

          <button
            disabled={
              !active ||
              savingCoverage ===
                addonCode
            }
            onClick={() =>
              changeCoverageMode(
                addonCode,
                'selected'
              )
            }
            style={{
              ...coverageButtonStyle,

              borderColor:
                subscription
                  ?.coverage_mode ===
                'selected'
                  ? '#7c3aed'
                  : '#cbd5e1',

              background:
                subscription
                  ?.coverage_mode ===
                'selected'
                  ? '#f3e8ff'
                  : '#ffffff',

              color:
                subscription
                  ?.coverage_mode ===
                'selected'
                  ? '#6d28d9'
                  : '#334155',

              opacity:
                active ? 1 : 0.55,
            }}
          >
            <strong>
              Alunos selecionados
            </strong>

            <span>
              Ative somente para quem
              utilizará o serviço.
            </span>
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <section style={containerStyle}>
        <div style={loadingStyle}>
          Carregando configurações...
        </div>
      </section>
    )
  }

  const arrivalSubscription =
    subscriptions
      .arrival_photo_whatsapp

  const departureSubscription =
    subscriptions
      .regular_exit_photo_whatsapp

  const arrivalActive =
  isSubscriptionActive(
    arrivalSubscription
  )

const departureActive =
  isSubscriptionActive(
    departureSubscription
  )    

  const showStudentSelection =
    (
      isSubscriptionActive(
        arrivalSubscription
      ) &&
      arrivalSubscription
        ?.coverage_mode ===
        'selected'
    ) ||
    (
      isSubscriptionActive(
        departureSubscription
      ) &&
      departureSubscription
        ?.coverage_mode ===
        'selected'
    )

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div
          style={{
            fontSize: 12,
            color: '#2563eb',
            fontWeight: 900,
            textTransform:
              'uppercase',
            letterSpacing: 1,
          }}
        >
          Administração
        </div>

        <h2
          style={{
            margin:
              '8px 0 0',
            color: '#0f172a',
            fontSize: 32,
            fontWeight: 900,
          }}
        >
          Configurações
        </h2>

        <p
          style={{
            margin:
              '10px 0 0',
            color: '#64748b',
            lineHeight: 1.6,
          }}
        >
          Gerencie os recursos e
          preferências da escola.
        </p>
      </div>

      <div style={settingsCardStyle}>
        <h2 style={sectionTitleStyle}>
          Avisos de entrada e saída
        </h2>

        <p style={sectionTextStyle}>
          Escolha se os adicionais
          contratados serão utilizados
          para todos ou apenas para
          alunos específicos.
        </p>

        <div
          style={{
            display: 'grid',
            gap: 18,
            marginTop: 22,
          }}
        >
          {renderAddonCard({
            addonCode:
              'arrival_photo_whatsapp',

            title:
              'Entrada com foto e WhatsApp',

            description:
              'Armazena a foto da chegada e envia o aviso ao responsável.',
          })}

          {renderAddonCard({
            addonCode:
              'regular_exit_photo_whatsapp',

            title:
              'Saída com foto e WhatsApp',

            description:
              'Registra a saída normal e envia a foto correspondente ao responsável.',
          })}
        </div>
      </div>

      <WhatsAppMessagesAdmin
  schoolId={schoolId}
  currentUserId={currentUserId}
  arrivalEnabled={arrivalActive}
  departureEnabled={departureActive}
  showMessage={showMessage}
/>

      {showStudentSelection && (
        <div style={settingsCardStyle}>
          <h2 style={sectionTitleStyle}>
            Alunos selecionados
          </h2>

          <p style={sectionTextStyle}>
            Entrada e saída são
            configuradas separadamente
            para cada aluno.
          </p>

          <div style={filtersStyle}>
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
              value={classFilter}
              onChange={(event) =>
                setClassFilter(
                  event.target.value
                )
              }
              style={inputStyle}
            >
              <option value="all">
                Todas as turmas
              </option>

              {classNames.map(
                (className) => (
                  <option
                    key={className}
                    value={className}
                  >
                    {className}
                  </option>
                )
              )}
            </select>
          </div>

          <div
            style={{
              marginTop: 18,
              display: 'grid',
              gap: 10,
            }}
          >
            {visibleStudents.length ===
            0 ? (
              <div style={emptyStyle}>
                Nenhum aluno encontrado.
              </div>
            ) : (
              visibleStudents.map(
                (student) => {
                  const studentName =
                    getStudentName(
                      student
                    )

                  const arrivalSelected =
                    selectedStudents
                      .arrival_photo_whatsapp
                      .has(
                        student.id
                      )

                  const departureSelected =
                    selectedStudents
                      .regular_exit_photo_whatsapp
                      .has(
                        student.id
                      )

                  return (
                    <div
                      key={student.id}
                      style={studentRowStyle}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems:
                            'center',
                          gap: 12,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        {photoUrls[
                          student.id
                        ] ? (
                          <img
                            src={
                              photoUrls[
                                student.id
                              ]!
                            }
                            alt={
                              studentName
                            }
                            style={avatarStyle}
                          />
                        ) : (
                          <div
                            style={avatarPlaceholderStyle}
                          >
                            {studentName
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                        )}

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              color:
                                '#0f172a',
                              fontWeight: 900,
                              overflow:
                                'hidden',
                              textOverflow:
                                'ellipsis',
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {studentName}
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              color:
                                '#64748b',
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            {student.class_name ||
                              'Sem turma'}
                          </div>

                          {!student
                            .responsible_whatsapp && (
                            <div
                              style={{
                                marginTop: 4,
                                color:
                                  '#b45309',
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              Sem WhatsApp cadastrado
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={togglesStyle}>
                        <div style={toggleColumnStyle}>
                          <span style={toggleLabelStyle}>
                            Entrada
                          </span>

                          <StudentAddonButton
                            enabled={
                              isSubscriptionActive(
                                arrivalSubscription
                              ) &&
                              arrivalSubscription
                                ?.coverage_mode ===
                                'selected'
                            }
                            selected={
                              arrivalSelected
                            }
                            saving={
                              savingAssignment ===
                              `${student.id}:arrival_photo_whatsapp`
                            }
                            allIncluded={
                              arrivalSubscription
                                ?.coverage_mode ===
                                'all'
                            }
                            onClick={() =>
                              toggleStudentAddon(
                                student.id,
                                'arrival_photo_whatsapp'
                              )
                            }
                          />
                        </div>

                        <div style={toggleColumnStyle}>
                          <span style={toggleLabelStyle}>
                            Saída
                          </span>

                          <StudentAddonButton
                            enabled={
                              isSubscriptionActive(
                                departureSubscription
                              ) &&
                              departureSubscription
                                ?.coverage_mode ===
                                'selected'
                            }
                            selected={
                              departureSelected
                            }
                            saving={
                              savingAssignment ===
                              `${student.id}:regular_exit_photo_whatsapp`
                            }
                            allIncluded={
                              departureSubscription
                                ?.coverage_mode ===
                                'all'
                            }
                            onClick={() =>
                              toggleStudentAddon(
                                student.id,
                                'regular_exit_photo_whatsapp'
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )
                }
              )
            )}
          </div>

          <div style={paginationStyle}>
            <button
              disabled={
                safeCurrentPage <= 1
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

            <span
              style={{
                color: '#475569',
                fontWeight: 800,
              }}
            >
              Página {safeCurrentPage}{' '}
              de {totalPages}
            </span>

            <button
              disabled={
                safeCurrentPage >=
                totalPages
              }
              onClick={() =>
                setCurrentPage(
                  (previous) =>
                    Math.min(
                      totalPages,
                      previous + 1
                    )
                )
              }
              style={paginationButtonStyle}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function StudentAddonButton({
  enabled,
  selected,
  saving,
  allIncluded,
  onClick,
}: {
  enabled: boolean
  selected: boolean
  saving: boolean
  allIncluded: boolean
  onClick: () => void
}) {
  if (allIncluded) {
    return (
      <span style={includedBadgeStyle}>
        Todos
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={
        !enabled ||
        saving
      }
      onClick={onClick}
      style={{
        ...toggleButtonStyle,

        background:
          selected
            ? '#16a34a'
            : '#e2e8f0',

        color:
          selected
            ? '#ffffff'
            : '#475569',

        opacity:
          enabled ? 1 : 0.5,

        cursor:
          enabled
            ? 'pointer'
            : 'not-allowed',
      }}
    >
      {saving
        ? '...'
        : selected
        ? 'Ativo'
        : 'Inativo'}
    </button>
  )
}

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: 22,
}

const headerStyle: CSSProperties = {
  background:
    'rgba(255,255,255,0.94)',
  border:
    '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 26,
  boxShadow:
    '0 16px 40px rgba(15,23,42,0.05)',
}

const settingsCardStyle: CSSProperties = {
  background:
    'rgba(255,255,255,0.96)',
  border:
    '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow:
    '0 16px 40px rgba(15,23,42,0.05)',
}

const addonCardStyle: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  border:
    '1px solid #e2e8f0',
  background: '#f8fafc',
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

const statusBadgeStyle: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '7px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
}

const coverageButtonStyle: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 14,
}

const filtersStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns:
    'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  marginTop: 20,
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 15,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 15,
  outline: 'none',
}

const studentRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent:
    'space-between',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 18,
  border:
    '1px solid #e2e8f0',
  background: '#ffffff',
}

const avatarStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  objectFit: 'cover',
  flexShrink: 0,
}

const avatarPlaceholderStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 20,
  fontWeight: 900,
  flexShrink: 0,
}

const togglesStyle: CSSProperties = {
  display: 'flex',
  gap: 18,
  alignItems: 'center',
}

const toggleColumnStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  justifyItems: 'center',
}

const toggleLabelStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const toggleButtonStyle: CSSProperties = {
  minWidth: 78,
  padding: '10px 12px',
  borderRadius: 13,
  border: 'none',
  fontWeight: 900,
}

const includedBadgeStyle: CSSProperties = {
  minWidth: 78,
  padding: '10px 12px',
  borderRadius: 13,
  background: '#dbeafe',
  color: '#1d4ed8',
  textAlign: 'center',
  fontWeight: 900,
}

const paginationStyle: CSSProperties = {
  marginTop: 18,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
}

const paginationButtonStyle: CSSProperties = {
  padding: '11px 15px',
  borderRadius: 13,
  border:
    '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const emptyStyle: CSSProperties = {
  padding: 24,
  borderRadius: 18,
  border:
    '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#64748b',
  textAlign: 'center',
  fontWeight: 700,
}

const loadingStyle: CSSProperties = {
  padding: 28,
  borderRadius: 24,
  background: '#ffffff',
  border:
    '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 800,
}