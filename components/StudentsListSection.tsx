'use client'

import { useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

type Student = {
  id: string
  name?: string | null
  full_name: string | null
  email: string | null
  birth_date: string
  profile_photo_url?: string | null
  qr_code_token?: string | null
  class_name?: string | null
  responsible_email?: string | null
  responsible_whatsapp?: string | null
}

type Props = {
  students: Student[]
  onUpdateStudent: (
    studentId: string,
    data: {
      full_name: string
      email: string
      responsible_email: string
      responsible_whatsapp: string
      photo?: File | null
    }
  ) => Promise<void>
}

export default function StudentsListSection({
  students,
  onUpdateStudent,
}: Props) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState('')
  const [onlyWithoutClass, setOnlyWithoutClass] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
const [editName, setEditName] = useState('')
const [editEmail, setEditEmail] = useState('')
const [editResponsibleEmail, setEditResponsibleEmail] = useState('')
const [editResponsibleWhatsapp, setEditResponsibleWhatsapp] = useState('')
const [editPhoto, setEditPhoto] = useState<File | null>(null)

  const availableClasses = useMemo(() => {
    const classNames = students
      .map((student) => student.class_name?.trim())
      .filter((value): value is string => Boolean(value))

    return Array.from(new Set(classNames)).sort((a, b) => a.localeCompare(b))
  }, [students])

const hasActiveFilter =
  studentSearch.trim().length > 0 ||
  selectedClassFilter !== '' ||
  onlyWithoutClass

const filteredStudents = students.filter((student) => {
  const matchesName =
    !studentSearch ||
    student.full_name?.toLowerCase().includes(studentSearch.toLowerCase())

  const matchesClass =
    !selectedClassFilter ||
    selectedClassFilter === 'all' ||
    student.class_name === selectedClassFilter

  const matchesWithoutClass =
    !onlyWithoutClass ||
    !student.class_name ||
    student.class_name === 'Sem turma'

  return matchesName && matchesClass && matchesWithoutClass
})

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
        const canvas = qrContainer?.querySelector(
          'canvas'
        ) as HTMLCanvasElement | null

        const qrImage = canvas?.toDataURL('image/png') || ''

        return `
          <div class="qr-card">
            <img src="${qrImage}" />
            <h3>${student.full_name || student.name || 'Aluno'}</h3>
            <p>${student.class_name || 'Sem turma'}</p>
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
  grid-template-columns: repeat(4, 180px);
  gap: 18px;
  justify-content: start;
}

.qr-card {
  width: 180px;
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  padding: 12px;
  text-align: center;
  break-inside: avoid;
  box-sizing: border-box;
}

.qr-card img {
  width: 130px;
  height: 130px;
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

  function formatDateBR(date: string) {
  if (!date) return 'Não informado'

  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

  return (
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

<label
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    color: '#334155', // 🔥 mais visível
    fontWeight: 600,
  }}
>
  <input
    type="checkbox"
    checked={onlyWithoutClass}
    onChange={(e) => {
      setOnlyWithoutClass(e.target.checked)

      if (e.target.checked) {
        setSelectedClassFilter('')
      }
    }}
  />
  Apenas alunos sem turma
</label>

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
{filteredStudents.map((student) => {
  const isEditing = editingStudentId === student.id

  return (
    <div key={student.id} style={itemCardStyle}>
      <div style={studentRowStyle}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {student.profile_photo_url ? (
            <img
              src={student.profile_photo_url}
              alt={student.full_name || 'Aluno'}
              style={photoStyle}
            />
          ) : (
            <div style={photoPlaceholderStyle}>
              {(student.full_name || student.name || '?')[0]}
            </div>
          )}

          <div style={{ minWidth: 260 }}>
            {isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome do aluno"
                  style={inputStyle}
                />

                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="E-mail do aluno"
                  style={inputStyle}
                />

                <input
                  type="email"
                  value={editResponsibleEmail}
                  onChange={(e) => setEditResponsibleEmail(e.target.value)}
                  placeholder="E-mail do responsável"
                  style={inputStyle}
                />

                <input
                  type="text"
                  value={editResponsibleWhatsapp}
                  onChange={(e) => setEditResponsibleWhatsapp(e.target.value)}
                  placeholder="WhatsApp do responsável"
                  style={inputStyle}
                />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditPhoto(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </div>
            ) : (
              <>
                <div style={itemTitleStyle}>
                  {student.full_name || student.name || 'Aluno'}
                </div>

                <div style={itemSubtitleStyle}>
                  {student.class_name || 'Sem turma'}
                </div>

                <div style={itemSubInfoStyle}>
                  E-mail: {student.email || 'Sem e-mail'}
                </div>

                <div style={itemSubInfoStyle}>
                  Nascimento: {formatDateBR(student.birth_date)}
                </div>

                <div style={itemSubInfoStyle}>
                  Responsável: {student.responsible_email || 'Sem e-mail'}
                </div>

                <div style={itemSubInfoStyle}>
                  WhatsApp: {student.responsible_whatsapp || 'Não informado'}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {student.qr_code_token && (
            <>
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

              <div style={{ fontSize: 12, color: '#64748b' }}>
                QR do aluno
              </div>
            </>
          )}

{isEditing ? (
  <>
    <button
      onClick={async () => {
        await onUpdateStudent(student.id, {
          full_name: editName,
          email: editEmail,
          responsible_email: editResponsibleEmail,
          responsible_whatsapp: editResponsibleWhatsapp,
          photo: editPhoto,
        })

        setEditingStudentId(null)
        setEditPhoto(null)
      }}
      style={saveButtonStyle}
    >
      Salvar
    </button>

    <button
      onClick={() => {
        setEditingStudentId(null)
        setEditPhoto(null)
      }}
      style={cancelButtonStyle}
    >
      Cancelar
    </button>
  </>
) : (
  <>
    {/* BOTÃO EDITAR */}
    <button
      onClick={() => {
        setEditingStudentId(student.id)
        setEditName(student.full_name || student.name || '')
        setEditEmail(student.email || '')
        setEditResponsibleEmail(student.responsible_email || '')
        setEditResponsibleWhatsapp(student.responsible_whatsapp || '')
        setEditPhoto(null)
      }}
      style={secondaryButtonStyle}
    >
      Editar
    </button>

    {/* 🔥 BOTÃO WHATSAPP (AQUI) */}
{student.responsible_whatsapp && (
  <button
    onClick={() => {
      const phone = (student.responsible_whatsapp || '').replace(/\D/g, '')

      if (!phone) {
        alert('Sem WhatsApp cadastrado')
        return
      }

const message = encodeURIComponent(
  `Olá! 👋\n\n` +
  `Informamos que estamos entrando em contato sobre o(a) aluno(a):\n` +
  `📌 ${student.full_name || student.name || 'Aluno'}\n\n` +
  `Turma: ${student.class_name || 'Sem turma'}\n\n` +
  `Pedimos, por gentileza, que o responsável entre em contato com a escola.\n\n` +
  `Atenciosamente,\nEquipe escolar 📚`
)

      window.open(
        `https://wa.me/55${phone}?text=${message}`,
        '_blank'
      )
    }}
    style={whatsappButtonStyle}
  >
    WhatsApp
  </button>
)}
  </>
)}
        </div>
      </div>
    </div>
  )
})}
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
}

const listHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  marginBottom: 18,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: '#0f172a',
}

const subtitleStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#475569',
  fontSize: 14,
  fontWeight: 600,
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
  marginBottom: 18,
}

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 15,
  outline: 'none',
  background: '#ffffff',
  color: '#0f172a', // 🔥 texto mais forte
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 14,
}

const emptyStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#334155', // 🔥 mais contraste
  fontWeight: 600,
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const itemCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 14,
  background: '#f8fafc',
}

const studentRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const photoStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 16,
  objectFit: 'cover',
}

const photoPlaceholderStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 16,
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
  fontSize: 22,
}

const itemTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: '#0f172a',
}

const itemSubtitleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 14,
  color: '#2563eb',
  fontWeight: 800,
}

const itemSubInfoStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 13,
  color: '#64748b',
  fontWeight: 600,
}

const whatsappButtonStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '8px 10px',
  borderRadius: 10,
  border: 'none',
  background: '#25D366',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 12,
}

const saveButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: 'none',
  background: '#16a34a',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 12,
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 12,
}