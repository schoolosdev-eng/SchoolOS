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
  responsible_whatsapp?: string | null
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
  handleCreateStudent: () => void
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
}: StudentsSectionProps) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedClassFilter, setSelectedClassFilter] = useState('')

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

  return students.filter((student) => {
    const name = (student.full_name || student.name || '').toLowerCase()

    const matchesName = name.includes(studentSearch.trim().toLowerCase())

    const matchesClass =
      selectedClassFilter === '' || selectedClassFilter === 'all'
        ? true
        : student.class_name === selectedClassFilter

    return matchesName && matchesClass
  })
}, [students, studentSearch, selectedClassFilter, hasActiveFilter])

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
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .qr-card {
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          padding: 16px;
          text-align: center;
          break-inside: avoid;
        }

        .qr-card img {
          width: 190px;
          height: 190px;
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

          <input
            type="file"
            accept="image/*"
            onChange={(e) => setStudentPhoto(e.target.files?.[0] || null)}
            style={inputStyle}
          />
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
            placeholder="WhatsApp do responsável"
            value={guardianWhatsapp}
            onChange={(e) => setGuardianWhatsapp(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button onClick={handleCreateStudent} style={primaryButtonStyle}>
          Cadastrar aluno
        </button>
      </div>

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