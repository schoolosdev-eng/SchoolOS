'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  full_name?: string | null
  name?: string | null
}

type SchoolClass = {
  id: string
  name: string
}

type Enrollment = {
  id: string
  student_id: string
  class_id: string
}

type StudentLicense = {
  id: string
  school_id: string
  student_id: string
  class_id: string | null
  license_type:
    | 'medical_certificate'
    | 'medical_leave'
    | 'other'
  start_date: string
  end_date: string
  notes: string | null
  document_path: string | null
  document_name: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  cancelled_at: string | null
  cancelled_by_user_id: string | null
  cancellation_reason: string | null
}

type Props = {
  schoolId: string
  students: Student[]
  classes: SchoolClass[]
  enrollments: Enrollment[]
  showMessage: (text: string) => void
}

type LicenseStatus =
  | 'active'
  | 'future'
  | 'finished'
  | 'cancelled'

export default function StudentLicensesSection({
  schoolId,
  students,
  classes,
  enrollments,
  showMessage,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  const [licenses, setLicenses] =
    useState<StudentLicense[]>([])

  const [loading, setLoading] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [openingDocumentId, setOpeningDocumentId] =
    useState<string | null>(null)

  const [cancellingId, setCancellingId] =
    useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] =
    useState('')

  const [selectedClassId, setSelectedClassId] =
    useState('')

  const [licenseType, setLicenseType] =
    useState<StudentLicense['license_type']>(
      'medical_certificate'
    )

  const [startDate, setStartDate] =
    useState('')

  const [endDate, setEndDate] =
    useState('')

  const [notes, setNotes] =
    useState('')

  const [documentFile, setDocumentFile] =
    useState<File | null>(null)

  const [studentSearch, setStudentSearch] =
    useState('')

  const [statusFilter, setStatusFilter] =
    useState<'all' | LicenseStatus>('all')

  function getTodayLocal() {
    const now = new Date()

    const year = now.getFullYear()
    const month = String(
      now.getMonth() + 1
    ).padStart(2, '0')
    const day = String(
      now.getDate()
    ).padStart(2, '0')

    return `${year}-${month}-${day}`
  }

  const today = getTodayLocal()

  function formatDateBR(date: string) {
    if (!date) return ''

    const [year, month, day] =
      date.split('-')

    return `${day}/${month}/${year}`
  }

  function getStudentName(
    studentId: string
  ) {
    const student =
      students.find(
        (item) =>
          item.id === studentId
      )

    return (
      student?.full_name ||
      student?.name ||
      'Aluno não encontrado'
    )
  }

  function getClassName(
    classId: string | null
  ) {
    if (!classId) {
      return 'Sem turma informada'
    }

    return (
      classes.find(
        (item) =>
          item.id === classId
      )?.name ||
      'Turma não encontrada'
    )
  }

  function getLicenseTypeLabel(
    type: StudentLicense['license_type']
  ) {
    if (
      type ===
      'medical_certificate'
    ) {
      return 'Atestado médico'
    }

    if (
      type ===
      'medical_leave'
    ) {
      return 'Licença médica'
    }

    return 'Outro'
  }

  function getLicenseStatus(
    license: StudentLicense
  ): LicenseStatus {
    if (license.cancelled_at) {
      return 'cancelled'
    }

    if (
      license.start_date > today
    ) {
      return 'future'
    }

    if (
      license.end_date < today
    ) {
      return 'finished'
    }

    return 'active'
  }

  function getStatusInfo(
    status: LicenseStatus
  ) {
    if (status === 'active') {
      return {
        label: 'Ativa',
        background: '#dcfce7',
        color: '#166534',
        border: '#bbf7d0',
      }
    }

    if (status === 'future') {
      return {
        label: 'Futura',
        background: '#dbeafe',
        color: '#1d4ed8',
        border: '#bfdbfe',
      }
    }

    if (status === 'finished') {
      return {
        label: 'Encerrada',
        background: '#f1f5f9',
        color: '#475569',
        border: '#cbd5e1',
      }
    }

    return {
      label: 'Cancelada',
      background: '#fee2e2',
      color: '#991b1b',
      border: '#fecaca',
    }
  }

  async function fetchLicenses() {
    if (!schoolId) return

    setLoading(true)

    const { data, error } =
      await supabase
        .from('student_licenses')
        .select(`
          id,
          school_id,
          student_id,
          class_id,
          license_type,
          start_date,
          end_date,
          notes,
          document_path,
          document_name,
          created_by_user_id,
          created_at,
          updated_at,
          cancelled_at,
          cancelled_by_user_id,
          cancellation_reason
        `)
        .eq('school_id', schoolId)
        .order(
          'start_date',
          { ascending: false }
        )
        .order(
          'created_at',
          { ascending: false }
        )

    setLoading(false)

    if (error) {
      showMessage(
        `Erro ao carregar licenças: ${error.message}`
      )
      return
    }

    setLicenses(
      (data || []) as StudentLicense[]
    )
  }

  useEffect(() => {
    fetchLicenses()
  }, [schoolId])

  const sortedStudents =
    useMemo(() => {
      const search =
        studentSearch
          .trim()
          .toLowerCase()

      return [...students]
        .filter((student) => {
          if (!search) {
            return true
          }

          const name =
            (
              student.full_name ||
              student.name ||
              ''
            ).toLowerCase()

          return name.includes(search)
        })
        .sort((a, b) => {
          const nameA =
            a.full_name ||
            a.name ||
            ''

          const nameB =
            b.full_name ||
            b.name ||
            ''

          return nameA.localeCompare(
            nameB,
            'pt-BR'
          )
        })
    }, [students, studentSearch])

  const availableClasses =
    useMemo(() => {
      if (!selectedStudentId) {
        return []
      }

      const classIds =
        new Set(
          enrollments
            .filter(
              (enrollment) =>
                enrollment.student_id ===
                selectedStudentId
            )
            .map(
              (enrollment) =>
                enrollment.class_id
            )
        )

      return classes.filter(
        (schoolClass) =>
          classIds.has(
            schoolClass.id
          )
      )
    }, [
      selectedStudentId,
      enrollments,
      classes,
    ])

  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedClassId('')
      return
    }

    if (
      availableClasses.length === 1
    ) {
      setSelectedClassId(
        availableClasses[0].id
      )
      return
    }

    setSelectedClassId('')
  }, [
    selectedStudentId,
    availableClasses,
  ])

  const filteredLicenses =
    useMemo(() => {
      return licenses.filter(
        (license) => {
          if (
            statusFilter === 'all'
          ) {
            return true
          }

          return (
            getLicenseStatus(
              license
            ) === statusFilter
          )
        }
      )
    }, [
      licenses,
      statusFilter,
      today,
    ])

  const statistics =
    useMemo(() => {
      let active = 0
      let future = 0
      let finished = 0
      let cancelled = 0

      licenses.forEach(
        (license) => {
          const status =
            getLicenseStatus(
              license
            )

          if (
            status === 'active'
          ) {
            active++
          }

          if (
            status === 'future'
          ) {
            future++
          }

          if (
            status === 'finished'
          ) {
            finished++
          }

          if (
            status === 'cancelled'
          ) {
            cancelled++
          }
        }
      )

      return {
        active,
        future,
        finished,
        cancelled,
      }
    }, [licenses, today])

  function validateDocument(
    file: File
  ) {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      showMessage(
        'Documento inválido. Utilize PDF, JPG, PNG ou WEBP.'
      )

      return false
    }

    const maxSize =
      10 * 1024 * 1024

    if (file.size > maxSize) {
      showMessage(
        'O documento deve possuir no máximo 10 MB.'
      )

      return false
    }

    return true
  }

  function resetForm() {
    setSelectedStudentId('')
    setSelectedClassId('')
    setLicenseType(
      'medical_certificate'
    )
    setStartDate('')
    setEndDate('')
    setNotes('')
    setDocumentFile(null)
    setStudentSearch('')

    if (fileInputRef.current) {
      fileInputRef.current.value =
        ''
    }
  }

  async function handleCreateLicense() {
    if (!schoolId) {
      showMessage(
        'Escola não identificada.'
      )
      return
    }

    if (!selectedStudentId) {
      showMessage(
        'Selecione o aluno.'
      )
      return
    }

    if (!startDate || !endDate) {
      showMessage(
        'Informe a data inicial e final da licença.'
      )
      return
    }

    if (endDate < startDate) {
      showMessage(
        'A data final não pode ser anterior à data inicial.'
      )
      return
    }

    if (
      documentFile &&
      !validateDocument(
        documentFile
      )
    ) {
      return
    }

    setSaving(true)

    try {
      /*
       * Evita cadastrar acidentalmente
       * duas licenças ativas sobrepostas
       * para o mesmo aluno.
       */
      const {
        data:
          overlappingLicenses,
        error:
          overlappingError,
      } = await supabase
        .from(
          'student_licenses'
        )
        .select(
          'id, start_date, end_date'
        )
        .eq(
          'school_id',
          schoolId
        )
        .eq(
          'student_id',
          selectedStudentId
        )
        .is(
          'cancelled_at',
          null
        )
        .lte(
          'start_date',
          endDate
        )
        .gte(
          'end_date',
          startDate
        )
        .limit(1)

      if (overlappingError) {
        showMessage(
          `Erro ao verificar licenças existentes: ${overlappingError.message}`
        )
        return
      }

      if (
        overlappingLicenses &&
        overlappingLicenses.length > 0
      ) {
        const existing =
          overlappingLicenses[0]

        showMessage(
          `Este aluno já possui uma licença entre ${formatDateBR(
            existing.start_date
          )} e ${formatDateBR(
            existing.end_date
          )}.`
        )

        return
      }

      const licenseId =
        crypto.randomUUID()

      /*
       * Primeiro cria o registro.
       * Depois envia o arquivo.
       *
       * Se o upload falhar,
       * removemos o registro criado
       * para não deixar licença incompleta.
       */
      const {
        error: insertError,
      } = await supabase
        .from(
          'student_licenses'
        )
        .insert({
          id: licenseId,
          school_id: schoolId,
          student_id:
            selectedStudentId,
          class_id:
            selectedClassId ||
            null,
          license_type:
            licenseType,
          start_date:
            startDate,
          end_date:
            endDate,
          notes:
            notes.trim() ||
            null,
        })

      if (insertError) {
        showMessage(
          `Erro ao cadastrar licença: ${insertError.message}`
        )
        return
      }

      if (documentFile) {
        const originalName =
          documentFile.name

        const extension =
          originalName
            .split('.')
            .pop()
            ?.toLowerCase() ||
          (
            documentFile.type ===
            'application/pdf'
              ? 'pdf'
              : 'jpg'
          )

        const documentPath =
          `${schoolId}/` +
          `${selectedStudentId}/` +
          `${licenseId}/` +
          `document.${extension}`

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              'student-license-documents'
            )
            .upload(
              documentPath,
              documentFile,
              {
                cacheControl:
                  '3600',
                upsert: false,
                contentType:
                  documentFile.type,
              }
            )

        if (uploadError) {
          await supabase
            .from(
              'student_licenses'
            )
            .delete()
            .eq(
              'id',
              licenseId
            )
            .eq(
              'school_id',
              schoolId
            )

          showMessage(
            `Erro ao enviar documento: ${uploadError.message}`
          )

          return
        }

        const {
          error: updateError,
        } = await supabase
          .from(
            'student_licenses'
          )
          .update({
            document_path:
              documentPath,
            document_name:
              originalName,
          })
          .eq(
            'id',
            licenseId
          )
          .eq(
            'school_id',
            schoolId
          )

        if (updateError) {
          await supabase.storage
            .from(
              'student-license-documents'
            )
            .remove([
              documentPath,
            ])

          await supabase
            .from(
              'student_licenses'
            )
            .delete()
            .eq(
              'id',
              licenseId
            )
            .eq(
              'school_id',
              schoolId
            )

          showMessage(
            `Erro ao vincular documento à licença: ${updateError.message}`
          )

          return
        }
      }

      resetForm()

      await fetchLicenses()

      showMessage(
        'Licença cadastrada com sucesso.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenDocument(
    license: StudentLicense
  ) {
    if (
      !license.document_path
    ) {
      showMessage(
        'Esta licença não possui documento anexado.'
      )
      return
    }

    setOpeningDocumentId(
      license.id
    )

    try {
      const {
        data,
        error,
      } =
        await supabase.storage
          .from(
            'student-license-documents'
          )
          .createSignedUrl(
            license.document_path,
            300
          )

      if (
        error ||
        !data?.signedUrl
      ) {
        showMessage(
          `Não foi possível abrir o documento: ${
            error?.message ||
            'URL não gerada.'
          }`
        )
        return
      }

      window.open(
        data.signedUrl,
        '_blank',
        'noopener,noreferrer'
      )
    } finally {
      setOpeningDocumentId(
        null
      )
    }
  }

  async function handleCancelLicense(
    license: StudentLicense
  ) {
    if (license.cancelled_at) {
      return
    }

    const confirmed =
      window.confirm(
        `Cancelar a licença de ${getStudentName(
          license.student_id
        )}?`
      )

    if (!confirmed) return

    const reason =
      window.prompt(
        'Informe o motivo do cancelamento. Você pode deixar em branco.'
      )

    /*
     * Se o usuário clicar em
     * "Cancelar" no prompt,
     * não altera nada.
     */
    if (reason === null) {
      return
    }

    setCancellingId(
      license.id
    )

    try {
      const {
        data: { user },
      } =
        await supabase.auth
          .getUser()

      const { error } =
        await supabase
          .from(
            'student_licenses'
          )
          .update({
            cancelled_at:
              new Date()
                .toISOString(),
            cancelled_by_user_id:
              user?.id || null,
            cancellation_reason:
              reason.trim() ||
              null,
          })
          .eq(
            'id',
            license.id
          )
          .eq(
            'school_id',
            schoolId
          )

      if (error) {
        showMessage(
          `Erro ao cancelar licença: ${error.message}`
        )
        return
      }

      await fetchLicenses()

      showMessage(
        'Licença cancelada com sucesso.'
      )
    } finally {
      setCancellingId(
        null
      )
    }
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* CABEÇALHO */}
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: '#2563eb',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: 6,
          }}
        >
          Controle escolar
        </div>

        <h2
          style={{
            margin: 0,
            color: '#0f172a',
            fontSize: 30,
            fontWeight: 900,
          }}
        >
          Licenças de alunos
        </h2>

        <p
          style={{
            margin: '8px 0 0',
            color: '#64748b',
            lineHeight: 1.6,
          }}
        >
          Cadastre e acompanhe
          atestados e licenças sem
          alterar o registro de
          frequência do aluno.
        </p>
      </div>

      {/* INDICADORES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard
          label="Ativas hoje"
          value={statistics.active}
          background="#ecfdf5"
          border="#bbf7d0"
          color="#166534"
        />

        <StatCard
          label="Futuras"
          value={statistics.future}
          background="#eff6ff"
          border="#bfdbfe"
          color="#1d4ed8"
        />

        <StatCard
          label="Encerradas"
          value={statistics.finished}
          background="#f8fafc"
          border="#e2e8f0"
          color="#475569"
        />

        <StatCard
          label="Canceladas"
          value={statistics.cancelled}
          background="#fef2f2"
          border="#fecaca"
          color="#991b1b"
        />
      </div>

      {/* FORMULÁRIO */}
      <div
        style={{
          padding: 24,
          borderRadius: 24,
          border:
            '1px solid #e2e8f0',
          background:
            'rgba(255,255,255,0.96)',
          boxShadow:
            '0 14px 40px rgba(15,23,42,0.05)',
        }}
      >
        <h3
          style={{
            margin: '0 0 18px',
            color: '#0f172a',
            fontSize: 21,
          }}
        >
          Cadastrar licença
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
          }}
        >
          <div>
            <label
              style={labelStyle}
            >
              Buscar aluno
            </label>

            <input
              type="text"
              value={
                studentSearch
              }
              onChange={(e) =>
                setStudentSearch(
                  e.target.value
                )
              }
              placeholder="Digite o nome..."
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={labelStyle}
            >
              Aluno
            </label>

            <select
              value={
                selectedStudentId
              }
              onChange={(e) =>
                setSelectedStudentId(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Selecione
              </option>

              {sortedStudents.map(
                (student) => (
                  <option
                    key={
                      student.id
                    }
                    value={
                      student.id
                    }
                  >
                    {student.full_name ||
                      student.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={labelStyle}
            >
              Turma
            </label>

            <select
              value={
                selectedClassId
              }
              onChange={(e) =>
                setSelectedClassId(
                  e.target.value
                )
              }
              disabled={
                !selectedStudentId ||
                availableClasses.length ===
                  0
              }
              style={{
                ...inputStyle,
                opacity:
                  !selectedStudentId ||
                  availableClasses.length ===
                    0
                    ? 0.65
                    : 1,
              }}
            >
              <option value="">
                {availableClasses.length ===
                0
                  ? 'Sem turma vinculada'
                  : 'Selecione'}
              </option>

              {availableClasses.map(
                (schoolClass) => (
                  <option
                    key={
                      schoolClass.id
                    }
                    value={
                      schoolClass.id
                    }
                  >
                    {
                      schoolClass.name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              style={labelStyle}
            >
              Tipo
            </label>

            <select
              value={licenseType}
              onChange={(e) =>
                setLicenseType(
                  e.target
                    .value as StudentLicense['license_type']
                )
              }
              style={inputStyle}
            >
              <option
                value="medical_certificate"
              >
                Atestado médico
              </option>

              <option
                value="medical_leave"
              >
                Licença médica
              </option>

              <option
                value="other"
              >
                Outro
              </option>
            </select>
          </div>

          <div>
            <label
              style={labelStyle}
            >
              Data inicial
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={labelStyle}
            >
              Data final
            </label>

            <input
              type="date"
              value={endDate}
              min={
                startDate ||
                undefined
              }
              onChange={(e) =>
                setEndDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
          }}
        >
          <label
            style={labelStyle}
          >
            Observações
          </label>

          <textarea
            value={notes}
            onChange={(e) =>
              setNotes(
                e.target.value
              )
            }
            placeholder="Observações administrativas opcionais..."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily:
                'inherit',
            }}
          />
        </div>

        <div
          style={{
            marginTop: 14,
          }}
        >
          <label
            style={labelStyle}
          >
            Documento
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file =
                e.target
                  .files?.[0]

              if (!file) {
                setDocumentFile(
                  null
                )
                return
              }

              if (
                validateDocument(
                  file
                )
              ) {
                setDocumentFile(
                  file
                )
              } else {
                e.target.value =
                  ''
                setDocumentFile(
                  null
                )
              }
            }}
            style={inputStyle}
          />

          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            PDF, JPG, PNG ou
            WEBP. Máximo 10 MB.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 20,
          }}
        >
          <button
            onClick={
              handleCreateLicense
            }
            disabled={saving}
            style={{
              ...primaryButtonStyle,
              opacity:
                saving
                  ? 0.7
                  : 1,
              cursor:
                saving
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {saving
              ? 'Cadastrando...'
              : 'Cadastrar licença'}
          </button>

          <button
            onClick={resetForm}
            disabled={saving}
            style={
              secondaryButtonStyle
            }
          >
            Limpar
          </button>
        </div>
      </div>

      {/* LISTAGEM */}
      <div
        style={{
          padding: 24,
          borderRadius: 24,
          border:
            '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow:
            '0 14px 40px rgba(15,23,42,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: 21,
              }}
            >
              Licenças cadastradas
            </h3>

            <div
              style={{
                marginTop: 4,
                color: '#64748b',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {
                filteredLicenses.length
              }{' '}
              registro(s)
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target
                  .value as
                  | 'all'
                  | LicenseStatus
              )
            }
            style={{
              ...inputStyle,
              width: 'auto',
              minWidth: 180,
            }}
          >
            <option value="all">
              Todas
            </option>
            <option value="active">
              Ativas
            </option>
            <option value="future">
              Futuras
            </option>
            <option value="finished">
              Encerradas
            </option>
            <option value="cancelled">
              Canceladas
            </option>
          </select>
        </div>

        {loading ? (
          <div style={emptyStyle}>
            Carregando licenças...
          </div>
        ) : filteredLicenses.length ===
          0 ? (
          <div style={emptyStyle}>
            Nenhuma licença
            encontrada.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {filteredLicenses.map(
              (license) => {
                const status =
                  getLicenseStatus(
                    license
                  )

                const statusInfo =
                  getStatusInfo(
                    status
                  )

                return (
                  <div
                    key={
                      license.id
                    }
                    style={{
                      padding: 18,
                      borderRadius: 18,
                      border:
                        '1px solid #e2e8f0',
                      background:
                        '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'flex-start',
                        gap: 14,
                        flexWrap:
                          'wrap',
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display:
                              'flex',
                            alignItems:
                              'center',
                            gap: 8,
                            flexWrap:
                              'wrap',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 900,
                              color:
                                '#0f172a',
                            }}
                          >
                            {getStudentName(
                              license.student_id
                            )}
                          </div>

                          <span
                            style={{
                              padding:
                                '5px 9px',
                              borderRadius:
                                999,
                              fontSize:
                                11,
                              fontWeight:
                                900,
                              background:
                                statusInfo.background,
                              color:
                                statusInfo.color,
                              border: `1px solid ${statusInfo.border}`,
                            }}
                          >
                            {
                              statusInfo.label
                            }
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            color:
                              '#64748b',
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {getClassName(
                            license.class_id
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            color:
                              '#334155',
                            fontWeight: 700,
                            lineHeight: 1.6,
                          }}
                        >
                          {getLicenseTypeLabel(
                            license.license_type
                          )}
                          {' • '}
                          {formatDateBR(
                            license.start_date
                          )}
                          {' até '}
                          {formatDateBR(
                            license.end_date
                          )}
                        </div>

                        {license.notes && (
                          <div
                            style={{
                              marginTop: 8,
                              color:
                                '#475569',
                              lineHeight: 1.6,
                              whiteSpace:
                                'pre-wrap',
                            }}
                          >
                            {
                              license.notes
                            }
                          </div>
                        )}

                        {license.cancelled_at && (
                          <div
                            style={{
                              marginTop: 8,
                              fontSize: 12,
                              color:
                                '#991b1b',
                              fontWeight: 700,
                            }}
                          >
                            Licença
                            cancelada
                            {license.cancellation_reason
                              ? ` • Motivo: ${license.cancellation_reason}`
                              : ''}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display:
                            'flex',
                          gap: 8,
                          flexWrap:
                            'wrap',
                        }}
                      >
                        {license.document_path && (
                          <button
                            onClick={() =>
                              handleOpenDocument(
                                license
                              )
                            }
                            disabled={
                              openingDocumentId ===
                              license.id
                            }
                            style={
                              secondaryButtonStyle
                            }
                          >
                            {openingDocumentId ===
                            license.id
                              ? 'Abrindo...'
                              : 'Ver documento'}
                          </button>
                        )}

                        {!license.cancelled_at && (
                          <button
                            onClick={() =>
                              handleCancelLicense(
                                license
                              )
                            }
                            disabled={
                              cancellingId ===
                              license.id
                            }
                            style={{
                              ...secondaryButtonStyle,
                              color:
                                '#b91c1c',
                              borderColor:
                                '#fecaca',
                              background:
                                '#fff',
                            }}
                          >
                            {cancellingId ===
                            license.id
                              ? 'Cancelando...'
                              : 'Cancelar licença'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  background,
  border,
  color,
}: {
  label: string
  value: number
  background: string
  border: string
  color: string
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        background,
        border: `1px solid ${border}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 32,
          lineHeight: 1,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        {value}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: '#334155',
  fontWeight: 800,
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  border: 'none',
  background:
    'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#ffffff',
  fontWeight: 900,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontWeight: 800,
  cursor: 'pointer',
}

const emptyStyle: React.CSSProperties = {
  padding: 28,
  textAlign: 'center',
  color: '#64748b',
  fontWeight: 700,
  borderRadius: 16,
  background: '#f8fafc',
}