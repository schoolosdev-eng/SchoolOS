'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
  profile_photo_path?: string | null
  profile_photo_url?: string | null
}

type SchoolClass = {
  id: string
  name: string
  school_id: string
  year_id?: string | null
}

type Enrollment = {
  id: string
  student_id: string
  class_id: string
}

type Seat = {
  id: string
  row: number
  column: number
  studentId: string | null
}

type Props = {
  schoolId: string
  schoolName: string
  classes: SchoolClass[]
  students: Student[]
  enrollments: Enrollment[]
  showMessage?: (text: string) => void
}

export default function ClassMapSection({
  schoolId,
  schoolName,
  classes,
  students,
  enrollments,
  showMessage,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [columnsCount, setColumnsCount] = useState(4)
  const [rowsCount, setRowsCount] = useState(6)
  const [layoutType, setLayoutType] = useState<'single' | 'double'>('single')
  const [seats, setSeats] = useState<Seat[]>([])
  const [studentPhotoUrls, setStudentPhotoUrls] = useState<Record<string, string | null>>({})
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null)

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const studentsFromSelectedClass = useMemo(() => {
    if (!selectedClassId) return []

    const studentIds = enrollments
      .filter((item) => item.class_id === selectedClassId)
      .map((item) => item.student_id)

    return students
      .filter((student) => studentIds.includes(student.id))
      .sort((a, b) =>
        getStudentName(a).localeCompare(getStudentName(b), 'pt-BR')
      )
  }, [selectedClassId, enrollments, students])

  const placedStudentIds = seats
    .filter((seat) => seat.studentId)
    .map((seat) => seat.studentId)

  const unplacedStudents = studentsFromSelectedClass.filter(
    (student) => !placedStudentIds.includes(student.id)
  )

  useEffect(() => {
    studentsFromSelectedClass.forEach((student) => {
      if (studentPhotoUrls[student.id] !== undefined) return
      loadStudentPhoto(student)
    })
  }, [studentsFromSelectedClass])

  useEffect(() => {
  if (!selectedClassId) return

  generateSeats(rowsCount, columnsCount, layoutType)
}, [rowsCount, columnsCount, layoutType, selectedClassId])

  function notify(text: string) {
    if (showMessage) showMessage(text)
  }

  function getStudentName(student: Student) {
    return student.full_name || student.name || 'Aluno sem nome'
  }

  function getStudentFirstName(student: Student) {
  const fullName = getStudentName(student)
  return fullName.split(' ')[0] || fullName
}

  async function loadStudentPhoto(student: Student) {
    if (student.profile_photo_url) {
      setStudentPhotoUrls((prev) => ({
        ...prev,
        [student.id]: student.profile_photo_url || null,
      }))
      return
    }

    if (!student.profile_photo_path) {
      setStudentPhotoUrls((prev) => ({
        ...prev,
        [student.id]: null,
      }))
      return
    }

    const { data, error } = await supabase.storage
      .from('student-profile-photos')
      .createSignedUrl(student.profile_photo_path, 3600)

    setStudentPhotoUrls((prev) => ({
      ...prev,
      [student.id]: error ? null : data?.signedUrl || null,
    }))
  }

function generateSeats(rows: number, columns: number, type = layoutType) {
  setSeats((prev) => {
    const newSeats: Seat[] = []

    for (let row = 1; row <= rows; row++) {
      for (let column = 1; column <= columns; column++) {
        if (type === 'double') {
          const leftId = `seat-${row}-${column}-left`
          const rightId = `seat-${row}-${column}-right`

          newSeats.push({
            id: leftId,
            row,
            column,
            studentId: prev.find((s) => s.id === leftId)?.studentId || null,
          })

          newSeats.push({
            id: rightId,
            row,
            column,
            studentId: prev.find((s) => s.id === rightId)?.studentId || null,
          })
        } else {
          const id = `seat-${row}-${column}`

          newSeats.push({
            id,
            row,
            column,
            studentId: prev.find((s) => s.id === id)?.studentId || null,
          })
        }
      }
    }

    return newSeats
  })
}

  async function openClass(classId: string) {
    setSelectedClassId(classId)

    const { data, error } = await supabase
      .from('class_maps')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .maybeSingle()

    if (error) {
      notify(`Erro ao buscar mapa: ${error.message}`)
      generateSeats(rowsCount, columnsCount)
      return
    }

    if (data) {
      setLayoutType(data.layout_type || 'single')
      setColumnsCount(data.columns_count || 4)
      setRowsCount(data.rows_count || 6)
      setSeats((data.seats || []) as Seat[])
      return
    }

    generateSeats(rowsCount, columnsCount)
  }

  function handleDropOnSeat(seatId: string) {
    if (!draggedStudentId) return

    setSeats((prev) =>
      prev.map((seat) => {
        if (seat.studentId === draggedStudentId) {
          return { ...seat, studentId: null }
        }

        if (seat.id === seatId) {
          return { ...seat, studentId: draggedStudentId }
        }

        return seat
      })
    )

    setDraggedStudentId(null)
  }

  function removeStudentFromSeat(studentId: string) {
    setSeats((prev) =>
      prev.map((seat) =>
        seat.studentId === studentId ? { ...seat, studentId: null } : seat
      )
    )
  }

  async function handleSaveMap() {
    if (!selectedClassId) return

    const payload = {
      school_id: schoolId,
      class_id: selectedClassId,
      layout_type: layoutType,
      columns_count: columnsCount,
      rows_count: rowsCount,
      seats,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('class_maps')
      .upsert(payload, { onConflict: 'class_id' })

    if (error) {
      notify(`Erro ao salvar mapa: ${error.message}`)
      return
    }

    notify('Mapa de turma salvo com sucesso.')
  }

  function handleCancel() {
    if (selectedClassId) {
      openClass(selectedClassId)
    }
  }

  function handlePrint() {
    const printArea = document.getElementById('class-map-print-area')

    if (!printArea) {
      notify('Área de impressão não encontrada.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=1000,height=800')

    if (!printWindow) {
      notify('Não foi possível abrir a janela de impressão.')
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Mapa de Turma</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 12mm;
              color: #0f172a;
            }

html, body {
  width: 100%;
  height: 100%;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
}

body {
  font-family: Arial, sans-serif;
  color: #0f172a;
}

.print-header {
  padding: 4mm 6mm 2mm;
  margin: 0 0 4mm;
}

#class-map-print-area {
  width: 100% !important;
  max-width: 100% !important;
  transform: none !important;
  overflow: hidden !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

#class-map-print-area > div:nth-child(2) {
  column-gap: 6px !important;
  row-gap: 10px !important;
  width: 100% !important;
  max-width: 100% !important;
}

#class-map-print-area div {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}

#class-map-print-area > div:nth-child(2) {
  column-gap: 6px !important;
  row-gap: 4px !important;
  width: 100% !important;
  max-width: 100% !important;
}

#class-map-print-area > div:nth-child(2) > div {
  min-height: 62px !important;
  height: 62px !important;
}

img {
  width: 44px !important;
  height: 44px !important;
  object-fit: cover !important;
  border-radius: 8px !important;
}

strong,
button,
.no-print {
  display: none !important;
}

@page {
  size: A4;
  margin: 2mm;
}
          </style>
        </head>
        <body>
          <div class="print-header">
            <div class="school-name">${schoolName}</div>
            <div class="class-name">Mapa de Turma - ${selectedClass?.name || ''}</div>
          </div>

          ${printArea.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()

    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  function getStudentById(studentId: string | null) {
    if (!studentId) return null
    return students.find((student) => student.id === studentId) || null
  }

  function ResponsiveStyles() {
    return (
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .class-map-section {
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
        }

        @media print {
          .no-print {
            display: none !important;
          }
        }

        @media (max-width: 1024px) {
          .class-map-content-grid {
            grid-template-columns: 1fr !important;
          }

          .classes-grid-responsive {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .classes-grid-responsive {
            grid-template-columns: 1fr !important;
          }

          .class-map-header-responsive,
          .class-map-card-responsive {
            border-radius: 20px !important;
            padding: 16px !important;
          }

          .class-map-actions-responsive {
            flex-direction: column !important;
          }

          .class-map-actions-responsive button {
            width: 100% !important;
          }
        }
      `}</style>
    )
  }

  const safeColumnsCount = Math.min(Math.max(columnsCount, 1), 8)
const safeRowsCount = Math.min(Math.max(rowsCount, 1), 8)

const mapDensity = safeColumnsCount + safeRowsCount

const dynamicSeatMinHeight =
  mapDensity >= 15 ? 72 :
  mapDensity >= 13 ? 82 :
  mapDensity >= 11 ? 94 :
  112

const dynamicPhotoSize =
  mapDensity >= 15 ? 28 :
  mapDensity >= 13 ? 32 :
  mapDensity >= 11 ? 38 :
  44

const dynamicFontSize =
  mapDensity >= 15 ? 9 :
  mapDensity >= 13 ? 10 :
  mapDensity >= 11 ? 11 :
  12

  return (
    <section style={sectionStyle} className="class-map-section">
      <ResponsiveStyles />

      <div style={headerStyle} className="class-map-header-responsive">
        <div>
          <div style={eyebrowStyle}>Organização da sala</div>
          <h2 style={titleStyle}>Mapa de Turma</h2>
          <p style={textStyle}>
            Organize os alunos nas cadeiras da sala, salve o mapa e imprima em folha A4.
          </p>
        </div>
      </div>

      {!selectedClassId && (
        <div style={classesGridStyle} className="classes-grid-responsive">
          {classes.length === 0 ? (
            <p style={textStyle}>Nenhuma turma encontrada.</p>
          ) : (
            classes.map((schoolClass) => (
              <button
                key={schoolClass.id}
                onClick={() => openClass(schoolClass.id)}
                style={classCardStyle}
              >
                <span style={classIconStyle}>🪑</span>
                <strong style={classNameStyle}>{schoolClass.name}</strong>
                <span style={classSubtitleStyle}>Abrir mapa</span>
              </button>
            ))
          )}
        </div>
      )}

      {selectedClassId && selectedClass && (
        <div style={classPageStyle}>
          <button
            onClick={() => setSelectedClassId(null)}
            style={backButtonStyle}
            className="no-print"
          >
            ← Voltar para turmas
          </button>

          <div style={classHeaderStyle} className="class-map-header-responsive">
            <div>
              <div style={eyebrowLightStyle}>Turma selecionada</div>
              <h2 style={selectedClassTitleStyle}>{selectedClass.name}</h2>
              <p style={textLightStyle}>
                {studentsFromSelectedClass.length} aluno(s) matriculado(s)
              </p>
            </div>
          </div>

          <div style={configCardStyle} className="class-map-card-responsive no-print">
            <h3 style={cardTitleStyle}>Configuração do mapa</h3>

            <div style={configGridStyle}>
              <label style={labelStyle}>
                Tipo de coluna
                <select
                  value={layoutType}
                  onChange={(e) => setLayoutType(e.target.value as 'single' | 'double')}
                  style={inputStyle}
                >
                  <option value="single">Colunas isoladas</option>
                  <option value="double">Colunas duplas</option>
                </select>
              </label>

              <label style={labelStyle}>
                Quantidade de colunas
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={columnsCount}
                  onChange={(e) => {
  const value = Number(e.target.value)
  setColumnsCount(Math.min(Math.max(value, 1), 8))
}}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Quantidade de fileiras
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={rowsCount}
                  onChange={(e) => {
  const value = Number(e.target.value)
  setRowsCount(Math.min(Math.max(value, 1), 8))
}}
                  style={inputStyle}
                />
              </label>

            </div>
          </div>

          <div style={contentGridStyle} className="class-map-content-grid">
            <div style={cardStyle} className="class-map-card-responsive">
              <div style={mapTopStyle} className="no-print">
                <h3 style={cardTitleStyle}>Sala de aula</h3>

                <div style={actionsStyle} className="class-map-actions-responsive">
                  <button onClick={handleSaveMap} style={primaryButtonStyle}>
                    Salvar mapa
                  </button>

                  <button onClick={handleCancel} style={secondaryButtonStyle}>
                    Cancelar
                  </button>

                  <button onClick={handlePrint} style={darkButtonStyle}>
                    Imprimir PDF A4
                  </button>
                </div>
              </div>

              <div id="class-map-print-area">
                <div style={teacherDeskStyle}>Mesa do professor</div>

<div
  style={{
    ...seatsGridStyle,
gridTemplateColumns: `repeat(${safeColumnsCount}, minmax(0, 1fr))`,
    columnGap: layoutType === 'double' ? 8 : 24,
  }}
>
{layoutType === 'double'
  ? Array.from({ length: safeRowsCount }).map((_, rowIndex) => (
      <div key={`row-${rowIndex + 1}`} style={{ display: 'contents' }}>
        {Array.from({ length: safeColumnsCount }).map((_, columnIndex) => {
          const row = rowIndex + 1
          const column = columnIndex + 1

          const pairSeats = seats.filter(
            (seat) => seat.row === row && seat.column === column
          )

          return (
            <div
              key={`pair-${row}-${column}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
              }}
            >
              {pairSeats.map((seat) => {
                const student = getStudentById(seat.studentId)
                const photoUrl = student ? studentPhotoUrls[student.id] : null

                return (
                  <div
                    key={seat.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnSeat(seat.id)}
                    style={{
  ...seatStyle,
  minHeight: dynamicSeatMinHeight,
}}
                  >
                    {student ? (
                      <div style={placedStudentStyle}>
                        {photoUrl ? (
<img
  src={photoUrl}
  alt="Aluno"
  style={{
    width: dynamicPhotoSize,
    height: dynamicPhotoSize * 1.2, // 👈 formato mais vertical (3x4)
    borderRadius: 8,

    objectFit: 'cover',

    // 👇 foca no rosto (um pouco abaixo do topo)
    objectPosition: 'center 25%',

    // 👇 zoom para cortar peito e fundo
    transform: 'scale(1.9)',

    // 👇 remove artefatos
    display: 'block',
  }}
/>
                        ) : (
                          <div
  style={{
    ...seatAvatarStyle,
    width: dynamicPhotoSize,
    height: dynamicPhotoSize,
    borderRadius: Math.max(8, dynamicPhotoSize / 3),
    fontSize: dynamicFontSize,
  }}
>
                            {getStudentName(student).charAt(0)}
                          </div>
                        )}

                        <strong
  style={{
    ...seatStudentNameStyle,
    fontSize: dynamicFontSize,
  }}
>
                          {getStudentFirstName(student)}
                        </strong>

                        <button
                          onClick={() => removeStudentFromSeat(student.id)}
                          style={removeSeatButtonStyle}
                          className="no-print"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <span style={emptySeatTextStyle}>Vazia</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    ))
  : seats.map((seat) => {
      const student = getStudentById(seat.studentId)
      const photoUrl = student ? studentPhotoUrls[student.id] : null

      return (
        <div
          key={seat.id}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnSeat(seat.id)}
          style={{
  ...seatStyle,
  minHeight: dynamicSeatMinHeight,
}}
        >
          {student ? (
            <div style={placedStudentStyle}>
              {photoUrl ? (
                <img
  src={photoUrl}
  alt="Aluno"
  style={{
    ...seatPhotoStyle,
    width: dynamicPhotoSize,
    height: dynamicPhotoSize,
    borderRadius: Math.max(8, dynamicPhotoSize / 3),
  }}
/>
              ) : (
                <div
  style={{
    ...seatAvatarStyle,
    width: dynamicPhotoSize,
    height: dynamicPhotoSize,
    borderRadius: Math.max(8, dynamicPhotoSize / 3),
    fontSize: dynamicFontSize,
  }}
>
                  {getStudentName(student).charAt(0)}
                </div>
              )}

<strong
  style={{
    ...seatStudentNameStyle,
    fontSize: dynamicFontSize,
  }}
>
  {getStudentFirstName(student)}
</strong>

              <button
                onClick={() => removeStudentFromSeat(student.id)}
                style={removeSeatButtonStyle}
                className="no-print"
              >
                Remover
              </button>
            </div>
          ) : (
            <span style={emptySeatTextStyle}>Cadeira vazia</span>
          )}
        </div>
      )
    })}
                </div>
              </div>
            </div>

            <div style={cardStyle} className="class-map-card-responsive no-print">
              <h3 style={cardTitleStyle}>Figurinhas dos alunos</h3>

              {unplacedStudents.length === 0 ? (
                <p style={textStyle}>Todos os alunos já foram posicionados.</p>
              ) : (
                <div style={stickersListStyle}>
                  {unplacedStudents.map((student) => {
                    const photoUrl = studentPhotoUrls[student.id]

                    return (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={() => setDraggedStudentId(student.id)}
                        style={studentStickerStyle}
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt="Aluno" style={studentStickerPhotoStyle} />
                        ) : (
                          <div style={studentStickerAvatarStyle}>
                            {getStudentName(student).charAt(0)}
                          </div>
                        )}

                        <strong style={studentStickerNameStyle}>
                          {getStudentName(student)}
                        </strong>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}

const headerStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.95)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.06)',
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: '#2563eb',
  marginBottom: 8,
}

const eyebrowLightStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  color: '#bfdbfe',
  marginBottom: 8,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: '#0f172a',
}

const textStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  lineHeight: 1.5,
}

const textLightStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#dbeafe',
  lineHeight: 1.5,
}

const classesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const classCardStyle: React.CSSProperties = {
  minHeight: 150,
  borderRadius: 26,
  border: '1px solid #e2e8f0',
  background: 'rgba(255,255,255,0.96)',
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.07)',
  padding: 22,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  textAlign: 'left',
}

const classIconStyle: React.CSSProperties = {
  fontSize: 28,
}

const classNameStyle: React.CSSProperties = {
  fontSize: 22,
  color: '#0f172a',
}

const classSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#2563eb',
  fontWeight: 800,
}

const classPageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const backButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  borderRadius: 14,
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 800,
  color: '#334155',
}

const classHeaderStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
  color: '#ffffff',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
}

const selectedClassTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  color: '#ffffff',
  fontWeight: 900,
}

const configCardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
}

const configGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  alignItems: 'end',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
  color: '#334155',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  color: '#0f172a',
  background: '#ffffff',
}

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
  gap: 18,
  alignItems: 'start',
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
  minWidth: 0,
}

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  color: '#0f172a',
  fontSize: 20,
}

const mapTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 16,
}

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#ffffff',
  color: '#334155',
  fontWeight: 800,
  cursor: 'pointer',
}

const darkButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
}

const teacherDeskStyle: React.CSSProperties = {
  width: '100%',
  padding: 14,
  borderRadius: 18,
  background: '#e0f2fe',
  border: '1px solid #bae6fd',
  color: '#075985',
  fontWeight: 900,
  textAlign: 'center',
  marginBottom: 18,
}

const seatsGridStyle: React.CSSProperties = {
  display: 'grid',
  rowGap: 18,
  width: '100%',
  maxWidth: '100%',
  overflow: 'hidden',
}

const seatStyle: React.CSSProperties = {
  minHeight: 112,
  minWidth: 0,
  borderRadius: 14,
  border: '2px dashed #cbd5e1',
  background: '#f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  textAlign: 'center',
  overflow: 'hidden',
}

const emptySeatTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontWeight: 800,
  fontSize: 13,
}

const placedStudentStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '100%',
  overflow: 'hidden',
  borderRadius: 16,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  padding: 5,
}

const seatPhotoStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  objectFit: 'cover',
}

const seatAvatarStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
}

const seatStudentNameStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#0f172a',
  lineHeight: 1.2,
  maxWidth: '100%',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'block',
}

const removeSeatButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#fee2e2',
  color: '#b91c1c',
  borderRadius: 999,
  padding: '5px 8px',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 11,
}

const stickersListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const studentStickerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 12,
  background: '#ffffff',
  cursor: 'grab',
}

const studentStickerPhotoStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  objectFit: 'cover',
}

const studentStickerAvatarStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
}

const studentStickerNameStyle: React.CSSProperties = {
  color: '#0f172a',
  fontWeight: 800,
  fontSize: 14,
}