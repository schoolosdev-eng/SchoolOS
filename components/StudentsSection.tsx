'use client'

import { useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name?: string | null
  full_name: string | null
  email: string | null
  birth_date: string
  profile_photo_url?: string | null
  qr_code_token?: string | null
  class_name?: string | null
  responsible_whatsapp?: string | null
  profile_photo_path?: string | null
}

type StudentsSectionProps = {
  students?: Student[]
  studentName: string
  studentBirthDate: string
  studentEmail: string
  guardianEmail: string
  guardianWhatsapp: string
  studentPhoto: File | null
  setStudentName: (value: string) => void
  setStudentBirthDate: (value: string) => void
  setStudentEmail: (value: string) => void
  setGuardianEmail: (value: string) => void
  setGuardianWhatsapp: (value: string) => void
  setStudentPhoto: (file: File | null) => void
  handleCreateStudent: (photoOverride?: File | null) => void
  handleCreateStudentsBatch: (students: {
  full_name: string
  email: string
  birth_date: string
  responsible_email: string
  responsible_whatsapp: string
}[]) => Promise<void>
}

export default function StudentsSection({
  students = [],
  studentName,
  studentBirthDate,
  studentEmail,
  guardianEmail,
  guardianWhatsapp,
  setStudentName,
  setStudentBirthDate,
  setStudentEmail,
  setGuardianEmail,
  setGuardianWhatsapp,
  setStudentPhoto,
  handleCreateStudent,
  handleCreateStudentsBatch,
}: StudentsSectionProps) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState('')
  const [studentPhotoPreview, setStudentPhotoPreview] = useState<string | null>(null)
  const [photoPositionX, setPhotoPositionX] = useState(50)
  const [photoPositionY, setPhotoPositionY] = useState(50)
  const [photoZoom, setPhotoZoom] = useState(1)
  const [photoInputKey, setPhotoInputKey] = useState(0)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({})
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false)

  const [quickBatchOpen, setQuickBatchOpen] = useState(false)
  const [batchPasteText, setBatchPasteText] = useState('')

const [batchStudents, setBatchStudents] = useState([
  {
    full_name: '',
    email: '',
    birth_date: '',
    responsible_email: '',
    responsible_whatsapp: '',
  },
])

useEffect(() => {
  return () => {
    if (studentPhotoPreview) {
      URL.revokeObjectURL(studentPhotoPreview)
    }
  }
}, [studentPhotoPreview])

useEffect(() => {
  students.forEach(async (student) => {
    if (photoUrls[student.id] !== undefined) return

    if (!student.profile_photo_path) {
      setPhotoUrls((prev) => ({
        ...prev,
        [student.id]: null,
      }))
      return
    }

    const { data } = await supabase.storage
      .from('student-profile-photos')
      .createSignedUrl(student.profile_photo_path, 3600)

    setPhotoUrls((prev) => ({
      ...prev,
      [student.id]: data?.signedUrl || null,
    }))
  })
}, [students])

function handleStudentPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0] || null

  setStudentPhoto(file)
  setPhotoPositionX(50)
  setPhotoPositionY(50)
  setPhotoZoom(1)

  if (studentPhotoPreview) {
    URL.revokeObjectURL(studentPhotoPreview)
  }

  if (!file) {
    setStudentPhotoPreview(null)
    setPhotoEditorOpen(false)
    return
  }

  setStudentPhotoPreview(URL.createObjectURL(file))
  setPhotoEditorOpen(true)
}

function addBatchStudentRow() {
  setBatchStudents((prev) => [
    ...prev,
    {
      full_name: '',
      email: '',
      birth_date: '',
      responsible_email: '',
      responsible_whatsapp: '',
    },
  ])
}

function removeBatchStudentRow(index: number) {
  setBatchStudents((prev) =>
    prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
  )
}

function updateBatchStudentRow(
  index: number,
  field:
    | 'full_name'
    | 'email'
    | 'birth_date'
    | 'responsible_email'
    | 'responsible_whatsapp',
  value: string
) {
  setBatchStudents((prev) =>
    prev.map((student, i) =>
      i === index ? { ...student, [field]: value } : student
    )
  )
}

async function submitBatchStudents() {
  await handleCreateStudentsBatch(batchStudents)

  setBatchStudents([
    {
      full_name: '',
      email: '',
      birth_date: '',
      responsible_email: '',
      responsible_whatsapp: '',
    },
  ])

  setQuickBatchOpen(false)
}

function convertBrazilianDateToISO(date: string) {
  const cleaned = date.trim()

  if (!cleaned.includes('/')) {
    return cleaned
  }

  const [day, month, year] = cleaned.split('/')

  if (!day || !month || !year) {
    return cleaned
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function handlePasteBatchStudents() {
  if (!batchPasteText.trim()) return

  const rows = batchPasteText
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)

  const parsedStudents = rows.map((row) => {
    const columns = row.includes('\t')
      ? row.split('\t').map((column) => column.trim())
      : row.includes(';')
      ? row.split(';').map((column) => column.trim())
      : row
          .split(/\s{2,}/)
          .map((column) => column.trim())

    return {
      full_name: columns[0] || '',
      email: columns[1] || '',
      birth_date: convertBrazilianDateToISO(columns[2] || ''),
      responsible_email: columns[3] || '',
      responsible_whatsapp: columns[4] || '',
    }
  })

  setBatchStudents(parsedStudents)

  setBatchPasteText('')
}

  const availableClasses = useMemo(() => {
    const classNames = students
      .map((student) => student.class_name?.trim())
      .filter((value): value is string => Boolean(value))

    return Array.from(new Set(classNames)).sort((a, b) => a.localeCompare(b))
  }, [students])

  const hasActiveFilter =
  studentSearch.trim().length > 0 ||
  selectedClassFilter !== ''

const filteredStudents = useMemo(() => {
  if (!hasActiveFilter) return []

  return students
    .filter((student) => {
      const name = (student.full_name || student.name || '').toLowerCase()

      const matchesName = name.includes(studentSearch.trim().toLowerCase())

      const matchesClass =
        selectedClassFilter === '' || selectedClassFilter === 'all'
          ? true
          : student.class_name === selectedClassFilter

      return matchesName && matchesClass
    })
    .sort((a, b) => {
      const nameA = a.full_name || a.name || ''
      const nameB = b.full_name || b.name || ''

      return nameA.localeCompare(nameB, 'pt-BR')
    })
}, [students, studentSearch, selectedClassFilter, hasActiveFilter])

async function createAdjustedStudentPhotoFile() {
  if (!studentPhotoPreview) return null

  const image = new Image()
  image.src = studentPhotoPreview
  image.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject()
  })

  const canvasSize = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, canvasSize, canvasSize)

  const baseScale = Math.max(
    canvasSize / image.naturalWidth,
    canvasSize / image.naturalHeight
  )

  const finalScale = baseScale * photoZoom

  const drawWidth = image.naturalWidth * finalScale
  const drawHeight = image.naturalHeight * finalScale

  const maxMoveX = canvasSize - drawWidth
  const maxMoveY = canvasSize - drawHeight

  const drawX = maxMoveX * (photoPositionX / 100)
  const drawY = maxMoveY * (photoPositionY / 100)

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.92)
  })

  if (!blob) return null

  return new File([blob], 'student-photo.jpg', {
    type: 'image/jpeg',
  })
}

async function handleCreateStudentWithAdjustedPhoto() {
  const adjustedPhoto = await createAdjustedStudentPhotoFile()

  await handleCreateStudent(adjustedPhoto)

  if (studentPhotoPreview) {
    URL.revokeObjectURL(studentPhotoPreview)
  }

  setStudentPhotoPreview(null)
  setPhotoEditorOpen(false)
  setPhotoPositionX(50)
  setPhotoPositionY(50)
  setPhotoZoom(1)
}

  function handlePrintFilteredQRCodes() {
    if (filteredStudents.length === 0) {
      alert('Nenhum aluno filtrado para imprimir.')
      return
    }

    const printWindow = window.open('', '_blank')

if (!printWindow) return

const qrCards = filteredStudents
  .filter((student) => student.qr_code_token)
  .map((student) => {
    const qrContainer = document.getElementById(`student-qr-${student.id}`)
    const canvas = qrContainer?.querySelector('canvas') as HTMLCanvasElement | null

    const qrImage = canvas?.toDataURL('image/png') || ''

    return `
  <div class="qr-card">
    <div class="student-photo-wrapper">
      ${
        photoUrls[student.id]
          ? `<img class="student-photo" src="${photoUrls[student.id]}" />`
          : `<div class="student-photo-placeholder">Sem foto</div>`
      }
    </div>

    <h3>${student.full_name || student.name || 'Aluno'}</h3>

    <p>${student.class_name || 'Sem turma'}</p>

    <img class="qr-image" src="${qrImage}" />
  </div>
`
  })
  .join('')

printWindow.document.write(`
  <html>
    <head>
      <title>QR Codes dos alunos</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 24px;
          color: #0f172a;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .qr-card {
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 16px;
          text-align: center;
          break-inside: avoid;
        }

        .student-photo-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.student-photo {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #cbd5e1;
}

.student-photo-placeholder {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}

.qr-image {
  width: 220px;
  height: 220px;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}

        .qr-card h3 {
          margin: 10px 0 4px;
          font-size: 15px;
        }

        .qr-card p {
          margin: 0;
          font-size: 13px;
          color: #64748b;
        }

            @media print {
    body {
      padding: 10px;
    }

    .grid {
      gap: 20px;
    }
      </style>
    </head>
    <body>
      <h1>QR Codes dos alunos filtrados</h1>
      <div class="grid">${qrCards}</div>
    </body>
  </html>
`)

printWindow.document.close()

setTimeout(() => {
  printWindow.focus()
  printWindow.print()
}, 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={cardStyle}>
        <h3 style={titleStyle}>Cadastrar aluno</h3>

        <div style={sectionTitleStyle}>Dados do aluno</div>

        <div style={formGridStyle}>
          <input
            type="text"
            placeholder="Nome completo"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={inputStyle}
          />

          <input
            type="email"
            placeholder="E-mail"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="date"
            value={studentBirthDate}
            onChange={(e) => setStudentBirthDate(e.target.value)}
            style={inputStyle}
          />
        </div>

<div style={{ marginTop: 12 }}>
  <label style={labelStyle}>Foto do aluno</label>

  <div style={photoPickerWrapperStyle}>
    <div style={photoPreviewCircleStyle}>
      {studentPhotoPreview ? (
        <img
          src={studentPhotoPreview}
          alt="Prévia da foto do aluno"
style={{
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: `${photoPositionX}% ${photoPositionY}%`,
  transform: `scale(${photoZoom})`,
  transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
}}
        />
      ) : (
        <span style={photoPreviewTextStyle}>Prévia</span>
      )}
    </div>

    <div>
      <label style={photoPickerButtonStyle}>
        Escolher foto
        <input
          key={photoInputKey}
          type="file"
          accept="image/*"
          onChange={handleStudentPhotoChange}
          style={{ display: 'none' }}
        />
      </label>

      <p style={photoPickerHintStyle}>
        Escolha a posição ideal da foto do aluno.
      </p>
    </div>
  </div>
</div>

        <div style={sectionTitleStyle}>Responsável</div>

        <div style={formGridStyle}>
          <input
            type="email"
            placeholder="E-mail do responsável"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="text"
            placeholder="Exemplo: 88999766571"
            value={guardianWhatsapp}
            onChange={(e) => setGuardianWhatsapp(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div
  style={{
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 12,
  }}
>
  <button onClick={handleCreateStudentWithAdjustedPhoto} style={primaryButtonStyle}>
  Cadastrar aluno
</button>

<button
  type="button"
  onClick={() => setQuickBatchOpen(true)}
  style={thirdButtonStyle}
>
  Cadastro rápido em lote
</button>
</div>

      </div>
      {photoEditorOpen && studentPhotoPreview && (
        <div
          onClick={() => setPhotoEditorOpen(false)}
          style={photoModalOverlayStyle}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={photoModalCardStyle}
          >
            <div style={photoModalHeaderStyle}>
              <div>
                <div style={photoModalEyebrowStyle}>Foto do aluno</div>
                <h2 style={photoModalTitleStyle}>Ajustar foto</h2>
                <p style={photoModalTextStyle}>
                  Posicione o rosto dentro do círculo e ajuste o zoom antes de confirmar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                style={photoModalCloseButtonStyle}
              >
                ✕
              </button>
            </div>

            <div style={photoModalPreviewWrapStyle}>
              <div style={photoModalPreviewCircleStyle}>
                <img
                  src={studentPhotoPreview}
                  alt="Prévia da foto do aluno"
                  style={{
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: `${photoPositionX}% ${photoPositionY}%`,
  transform: `scale(${photoZoom})`,
  transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
}}
                />
              </div>
            </div>

            <div style={photoModalControlsStyle}>
              <label style={photoAdjustLabelStyle}>
                Mover horizontalmente
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={photoPositionX}
                  onChange={(e) => setPhotoPositionX(Number(e.target.value))}
                  style={photoRangeStyle}
                />
              </label>

              <label style={photoAdjustLabelStyle}>
                Mover verticalmente
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={photoPositionY}
                  onChange={(e) => setPhotoPositionY(Number(e.target.value))}
                  style={photoRangeStyle}
                />
              </label>

              <label style={photoAdjustLabelStyle}>
                Zoom
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.01"
                  value={photoZoom}
                  onChange={(e) => setPhotoZoom(Number(e.target.value))}
                  style={photoRangeStyle}
                />
              </label>
            </div>

            <div style={photoModalActionsStyle}>
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                style={thirdButtonStyle}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => setPhotoEditorOpen(false)}
                style={primaryButtonStyle}
              >
                Usar esta foto
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={listHeaderStyle}>
          <div>
            <h3 style={titleStyle}>Filtre alunos cadastrados</h3>
            <p style={subtitleStyle}>
              Exibindo {filteredStudents.length} de {students.length} aluno(s)
            </p>
          </div>

          <button onClick={handlePrintFilteredQRCodes} style={secondaryButtonStyle}>
            Imprimir QR Codes filtrados
          </button>
        </div>

        <div style={filtersGridStyle}>
          <input
            type="text"
            placeholder="Buscar aluno por nome"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            style={inputStyle}
          />

          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecione uma Turma</option>
            <option value="all">Todas as Turmas</option>

            {availableClasses.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
          </div>

          {students.length === 0 ? (
          <div style={emptyStyle}>Nenhum aluno cadastrado.</div>
              ) : !hasActiveFilter ? (
              <div style={emptyStyle}>
              Use a busca por nome ou selecione uma turma para exibir os alunos.
              </div>
              ) : filteredStudents.length === 0 ? (
              <div style={emptyStyle}>Nenhum aluno encontrado com esses filtros.</div>
              ) : (
          <div style={listStyle}>
            {filteredStudents.map((student) => (
              <div key={student.id} style={itemCardStyle}>
                <div style={studentRowStyle}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
{photoUrls[student.id] ? (
  <img
    src={photoUrls[student.id] || ''}
                        alt={student.full_name || 'Aluno'}
                        style={photoStyle}
                      />
                    ) : (
                      <div style={photoPlaceholderStyle}>
                        {(student.full_name || student.name || '?')[0]}
                      </div>
                    )}

                    <div>
                      <div style={itemTitleStyle}>
                        {student.full_name || student.name || 'Aluno'}
                      </div>

                      <div style={itemSubtitleStyle}>
                        {student.class_name || 'Sem turma'}
                      </div>

                      <div style={itemSubInfoStyle}>
                        {student.email || 'Sem e-mail'}
                      </div>
                    </div>
                  </div>

                  {student.qr_code_token && (
                    <div style={{ textAlign: 'center' }}>
                      <div id={`student-qr-${student.id}`}>
                    <QRCodeCanvas
                      value={`schoolos:student:${student.qr_code_token}`}
                      size={220}
                      level="H"
                      includeMargin
                      style={{
                        width: 92,
                        height: 92,
                                }}
                          />
                          </div>

                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                          QR do aluno
                          </div>

{student.responsible_whatsapp && (
  <button
    onClick={() => {
      const phone = student.responsible_whatsapp?.replace(/\D/g, '')

      if (!phone) {
        alert('Sem WhatsApp cadastrado')
        return
      }

      const message = encodeURIComponent(
        `Olá, informamos que o aluno ${student.full_name || student.name || 'Aluno'} esteve ausente hoje.`
      )

      window.open(`https://wa.me/55${phone}?text=${message}`, '_blank')
    }}
    style={whatsappButtonStyle}
  >
    WhatsApp
  </button>
)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {quickBatchOpen && (
  <div
    onClick={() => setQuickBatchOpen(false)}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 1100,
        maxHeight: '90vh',
        overflow: 'auto',
        background: '#ffffff',
        borderRadius: 28,
        padding: 24,
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
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
            Cadastro rápido
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 28,
              color: '#0f172a',
              fontWeight: 900,
            }}
          >
            Cadastrar alunos em lote
          </h2>

          <p
            style={{
              margin: '8px 0 0',
              color: '#64748b',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            Cadastre vários alunos sem foto e sem turma. Depois você poderá
            adicionar fotos e matricular os alunos normalmente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setQuickBatchOpen(false)}
          style={{
            border: 'none',
            background: '#f1f5f9',
            width: 40,
            height: 40,
            borderRadius: 14,
            cursor: 'pointer',
            fontWeight: 900,
            color: '#334155',
          }}
        >
          ✕
        </button>
      </div>

      <div
  style={{
    padding: 16,
    borderRadius: 20,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    marginBottom: 20,
  }}
>
  <div
    style={{
      fontSize: 14,
      fontWeight: 900,
      color: '#0f172a',
      marginBottom: 8,
    }}
  >
    Colar dados do Excel ou Word
  </div>

  <p
    style={{
      margin: '0 0 12px',
      fontSize: 13,
      color: '#64748b',
      lineHeight: 1.5,
      fontWeight: 600,
    }}
  >
    Copie uma tabela com as colunas nesta ordem: nome, e-mail do aluno,
    nascimento, e-mail do responsável e WhatsApp. Se estiver utilizando um bloco de notas ou o Microsoft Word certifique-se de que tenha um
    "TAB" ou ";" entre as informações. 
    Por exemplo: Maria clara da silva;maria123@gmail.com;12/04/2015;mae10@gmail.com;88999457814 OU Maria clara da silva  maria123@gmail.com  12/04/2015  mae10@gmail.com 88999457814
  </p>

  <textarea
    value={batchPasteText}
    onChange={(e) => setBatchPasteText(e.target.value)}
    placeholder={`Maria Clara\tmaria@email.com\t12/03/2015\tmae@email.com\t88999999999
João Pedro\tjoao@email.com\t20/08/2014\tpai@email.com\t88988888888`}
    style={{
      width: '100%',
      minHeight: 110,
      resize: 'vertical',
      padding: 14,
      borderRadius: 16,
      border: '1px solid #cbd5e1',
      outline: 'none',
      fontSize: 14,
      color: '#0f172a',
      background: '#ffffff',
      fontFamily: 'inherit',
      boxSizing: 'border-box',
    }}
  />

  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 12,
    }}
  >
    <button
      type="button"
      onClick={handlePasteBatchStudents}
      style={{
        padding: '12px 16px',
        borderRadius: 14,
        border: 'none',
        background: '#0f172a',
        color: '#ffffff',
        fontWeight: 900,
        cursor: 'pointer',
      }}
    >
      Preencher tabela
    </button>
  </div>
</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.4fr 1.2fr 1.6fr 1.3fr 44px',
          gap: 10,
          minWidth: 900,
          marginBottom: 10,
          fontSize: 12,
          fontWeight: 900,
          color: '#475569',
          textTransform: 'uppercase',
        }}
      >
        <div>Nome do aluno</div>
        <div>E-mail do aluno</div>
        <div>Nascimento</div>
        <div>E-mail responsável</div>
        <div>WhatsApp</div>
        <div></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {batchStudents.map((student, index) => (
          <div
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.4fr 1.2fr 1.6fr 1.3fr 44px',
              gap: 10,
              minWidth: 900,
            }}
          >
            <input
              value={student.full_name}
              onChange={(e) =>
                updateBatchStudentRow(index, 'full_name', e.target.value)
              }
              placeholder="Nome completo"
              style={inputStyle}
            />

            <input
              value={student.email}
              onChange={(e) =>
                updateBatchStudentRow(index, 'email', e.target.value)
              }
              placeholder="email@exemplo.com"
              style={inputStyle}
            />

            <input
              type="date"
              value={student.birth_date}
              onChange={(e) =>
                updateBatchStudentRow(index, 'birth_date', e.target.value)
              }
              style={inputStyle}
            />

            <input
              value={student.responsible_email}
              onChange={(e) =>
                updateBatchStudentRow(index, 'responsible_email', e.target.value)
              }
              placeholder="responsavel@email.com"
              style={inputStyle}
            />

            <input
              value={student.responsible_whatsapp}
              onChange={(e) =>
                updateBatchStudentRow(
                  index,
                  'responsible_whatsapp',
                  e.target.value
                )
              }
              placeholder="88999999999"
              style={inputStyle}
            />

            <button
              type="button"
              onClick={() => removeBatchStudentRow(index)}
              style={{
                border: 'none',
                borderRadius: 14,
                background: '#fee2e2',
                color: '#b91c1c',
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              −
            </button>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 20,
        }}
      >
        <button
          type="button"
          onClick={addBatchStudentRow}
          style={{
            padding: '13px 16px',
            borderRadius: 14,
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          + Adicionar linha
        </button>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setQuickBatchOpen(false)}
            style={{
              padding: '13px 16px',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={submitBatchStudents}
            style={{
              padding: '13px 18px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontWeight: 900,
              cursor: 'pointer',
              boxShadow: '0 14px 30px rgba(37, 99, 235, 0.25)',
            }}
          >
            Cadastrar todos
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
    
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 8,
  fontSize: 20,
  fontWeight: 900,
  color: '#0f172a',
}

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 13,
  fontWeight: 700,
}

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 8,
  fontWeight: 800,
  color: '#1d4ed8',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 8,
  fontWeight: 700,
  color: '#334155',
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  margin: '16px 0',
}

const inputStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  color: '#0f172a',
  background: '#ffffff',
}

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '14px 16px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
  color: '#fff',
  fontWeight: 800,
  cursor: 'pointer',
}

const thirdButtonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid #1d4ed8',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
}

const listHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const itemCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
}

const studentRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
}

const photoStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  objectFit: 'cover',
}

const photoPlaceholderStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 12,
  background: '#dbeafe',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  color: '#1d4ed8',
}

const itemTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  color: '#0f172a',
}

const itemSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
}

const itemSubInfoStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#94a3b8',
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  color: '#64748b',
}

const whatsappButtonStyle: React.CSSProperties = {
  marginTop: 10,
  padding: '8px 12px',
  background: '#25D366',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
}

const photoPickerWrapperStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  flexWrap: 'wrap',
}

const photoPreviewCircleStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: '50%',
  overflow: 'hidden',
  border: '3px solid #2563eb',
  background: '#f1f5f9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 10px 25px rgba(37, 99, 235, 0.18)',
}

const photoPreviewImageStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
}

const photoPreviewTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#64748b',
  fontWeight: 800,
}

const photoPickerButtonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 18px',
  borderRadius: 14,
  background: '#eff6ff',
  color: '#1d4ed8',
  border: '1px solid #bfdbfe',
  fontWeight: 800,
  cursor: 'pointer',
}

const photoPickerHintStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: '#64748b',
  fontWeight: 600,
}

const photoAdjustBoxStyle: React.CSSProperties = {
  marginTop: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: 260,
}

const photoAdjustLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#475569',
  fontWeight: 800,
}

const photoRangeStyle: React.CSSProperties = {
  width: '100%',
  marginTop: 6,
}

const photoModalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}

const photoModalCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: '#ffffff',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 30px 80px rgba(15, 23, 42, 0.35)',
}

const photoModalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  marginBottom: 20,
}

const photoModalEyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: '#2563eb',
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  marginBottom: 6,
}

const photoModalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  color: '#0f172a',
  fontWeight: 900,
}

const photoModalTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.5,
}

const photoModalCloseButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#f1f5f9',
  width: 40,
  height: 40,
  borderRadius: 14,
  cursor: 'pointer',
  fontWeight: 900,
  color: '#334155',
}

const photoModalPreviewWrapStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 22,
}

const photoModalPreviewCircleStyle: React.CSSProperties = {
  width: 260,
  height: 260,
  borderRadius: '50%',
  overflow: 'hidden',
  border: '4px solid #2563eb',
  background: '#f1f5f9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 18px 40px rgba(37, 99, 235, 0.2)',
}

const photoModalControlsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const photoModalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 22,
}