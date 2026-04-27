'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
  email?: string | null
  profile_photo_path?: string | null
  school_id?: string | null
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

type ClassActivity = {
  id: string
  class_id: string
  school_id: string
  teacher_id: string
  discipline: string
  due_date: string
  file_url: string
  file_name: string | null
  file_type: string | null
  description: string | null
  created_at: string
}

type ActivitySubmission = {
  id: string
  school_id: string
  class_id: string
  activity_id: string
  student_id: string
  file_url: string
  file_name: string | null
  file_type: string | null
  comment: string | null
  created_at: string
}

type Props = {
  schoolId: string
  userId: string
  userEmail: string | null
  role: string
  students: Student[]
  classes: SchoolClass[]
  enrollments: Enrollment[]
  showMessage?: (text: string) => void
}

const situationOptions = [
  // Pedagógico
  'Não realizou atividade',
  'Não trouxe material',
  'Disperso em sala',
  'Atraso frequente',
  'Uso indevido de celular',
  'Saída sem autorização',

  // Disciplina leve/média
  'Conversando Muito',
  'Interrompendo a aula',
  'Desobediência',
  'Provocando colegas',
  'Linguagem inadequada',

  // Disciplina grave
  'Desrespeitando o professor',
  'Desrespeitando colegas',
  'Brigando',
  'Agressão física',
  'Ameaça a colega',
  'Ameaça a professor',
  'Bullying',
  'Danificando patrimônio',

  // Comportamento
  'Dormindo',
  'Apatia / desinteresse',
  'Isolamento social',
  'Falta de participação',

  // Administrativo
  'Fardamento incompleto',
  'Documentação pendente',

  // Família
  'Responsável não compareceu',

  // Outros
  'Fora do mapa de turma',
  'Outro',
]

export default function ClassesAreaSection({
  schoolId,
  userId,
  userEmail,
  role,
  students,
  classes,
  enrollments,
  showMessage,
}: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [studentVisibleClasses, setStudentVisibleClasses] = useState<SchoolClass[]>([])
const [studentLoggedRecord, setStudentLoggedRecord] = useState<Student | null>(null)
  const [activities, setActivities] = useState<ClassActivity[]>([])
  const [message, setMessage] = useState('')

  const [discipline, setDiscipline] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [activityFile, setActivityFile] = useState<File | null>(null)

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedSituation, setSelectedSituation] = useState('')
  const [occurrenceDescription, setOccurrenceDescription] = useState('')
  const [studentPhotoUrls, setStudentPhotoUrls] = useState<Record<string, string | null>>({})

  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([])
const [submissionFile, setSubmissionFile] = useState<File | null>(null)
const [submissionComment, setSubmissionComment] = useState('')
const [selectedActivityForSubmission, setSelectedActivityForSubmission] =
  useState<ClassActivity | null>(null)

  const canManage = role === 'admin' || role === 'gestor' || role === 'professor'
  const isStudent = role === 'aluno'
const normalizedUserEmail = userEmail?.trim().toLowerCase() || ''
useEffect(() => {
  async function fetchStudentClasses() {
    if (role !== 'aluno') return
    if (!normalizedUserEmail) return

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, full_name, email, profile_photo_path, school_id')
      .eq('school_id', schoolId)
      .ilike('email', normalizedUserEmail)
      .maybeSingle()

    if (studentError || !student) {
      console.log('Aluno não encontrado pelo e-mail:', studentError)
      setStudentLoggedRecord(null)
      setStudentVisibleClasses([])
      return
    }

    setStudentLoggedRecord(student as Student)

    const { data: studentEnrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, student_id, class_id')
      .eq('school_id', schoolId)
      .eq('student_id', student.id)

    if (enrollmentError) {
      console.log('Erro ao buscar matrículas do aluno:', enrollmentError)
      setStudentVisibleClasses([])
      return
    }

    const classIds = (studentEnrollments || []).map((item) => item.class_id)

    if (classIds.length === 0) {
      setStudentVisibleClasses([])
      return
    }

    const { data: classRecords, error: classError } = await supabase
      .from('classes')
      .select('id, name, school_id, year_id')
      .eq('school_id', schoolId)
      .in('id', classIds)

    if (classError) {
      console.log('Erro ao buscar turmas do aluno:', classError)
      setStudentVisibleClasses([])
      return
    }

    setStudentVisibleClasses((classRecords || []) as SchoolClass[])
  }

  fetchStudentClasses()
}, [role, normalizedUserEmail, schoolId])

const loggedStudent = studentLoggedRecord

const visibleClasses = useMemo(() => {
  if (isStudent) return studentVisibleClasses

  return classes
}, [classes, isStudent, studentVisibleClasses])

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  const studentsFromSelectedClass = useMemo(() => {
    if (!selectedClassId) return []

    const studentIds = enrollments
      .filter((e) => e.class_id === selectedClassId)
      .map((e) => e.student_id)

    return students.filter((student) => studentIds.includes(student.id))
  }, [selectedClassId, enrollments, students])

  function notify(text: string) {
  if (showMessage) {
    showMessage(text)
  } else {
    setMessage(text)
  }
}

useEffect(() => {
  studentsFromSelectedClass.forEach((student) => {
    if (studentPhotoUrls[student.id] !== undefined) return

    loadStudentPhoto(student.id, student.profile_photo_path)
  })
}, [studentsFromSelectedClass])

  async function openClass(classId: string) {
    setSelectedClassId(classId)
    setMessage('')
    await fetchActivities(classId)
    await fetchSubmissions(classId)
  }

  async function fetchActivities(classId: string) {
    const { data, error } = await supabase
      .from('class_activities')
      .select('*')
      .eq('school_id', schoolId)
      .eq('class_id', classId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Erro ao buscar atividades: ${error.message}`)
      return
    }

    setActivities((data || []) as ClassActivity[])
  }

  async function fetchSubmissions(classId: string) {
  const { data, error } = await supabase
    .from('activity_submissions')
    .select('*')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .order('created_at', { ascending: false })

  if (error) {
    notify(`Erro ao buscar respostas: ${error.message}`)
    return
  }

  setSubmissions((data || []) as ActivitySubmission[])
}

async function handleUploadActivity() {
  if (!selectedClassId) return

  if (!discipline.trim()) {
    notify('Informe a disciplina.')
    return
  }

  if (!dueDate) {
    notify('Informe o prazo da atividade.')
    return
  }

  if (!activityFile) {
    notify('Selecione um arquivo em PDF ou imagem.')
    return
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']

  if (!allowedTypes.includes(activityFile.type)) {
    notify('Arquivo inválido. Envie PDF ou imagem.')
    return
  }

  try {
    notify('Enviando atividade...')

    const fileExt = activityFile.name.split('.').pop() || 'file'
    const safeFileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`
    const filePath = `${schoolId}/${selectedClassId}/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('class-activities')
      .upload(filePath, activityFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Erro no upload:', uploadError)
      notify(`Erro ao enviar arquivo: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('class-activities')
      .getPublicUrl(filePath)

    const { error: insertError } = await supabase.from('class_activities').insert({
      school_id: schoolId,
      class_id: selectedClassId,
      teacher_id: userId,
      discipline: discipline.trim(),
      due_date: dueDate,
      file_url: publicUrlData.publicUrl,
      file_name: activityFile.name,
      file_type: activityFile.type,
      description: description.trim() || null,
    })

    if (insertError) {
      console.error('Erro ao salvar atividade:', insertError)
      notify(`Erro ao salvar atividade: ${insertError.message}`)
      return
    }

    setDiscipline('')
    setDueDate('')
    setDescription('')
    setActivityFile(null)

    notify('Atividade anexada com sucesso.')
    await fetchActivities(selectedClassId)
  } catch (error) {
    console.error('Erro inesperado no upload:', error)
    notify('Erro inesperado ao anexar atividade.')
  }
}

async function handleSubmitActivityAnswer() {
  if (!selectedActivityForSubmission || !selectedClassId) return

  if (!loggedStudent) {
    notify('Aluno não identificado.')
    return
  }

  if (!submissionFile) {
    notify('Selecione um arquivo em PDF ou imagem.')
    return
  }

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']

  if (!allowedTypes.includes(submissionFile.type)) {
    notify('Arquivo inválido. Envie PDF ou imagem.')
    return
  }

  try {
    notify('Enviando resposta...')

    const fileExt = submissionFile.name.split('.').pop() || 'file'
    const safeFileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`

    const filePath = `${schoolId}/${selectedClassId}/${selectedActivityForSubmission.id}/${loggedStudent.id}/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from('activity-submissions')
      .upload(filePath, submissionFile, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      notify(`Erro ao enviar resposta: ${uploadError.message}`)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('activity-submissions')
      .getPublicUrl(filePath)

    const { error: insertError } = await supabase
      .from('activity_submissions')
      .insert({
        school_id: schoolId,
        class_id: selectedClassId,
        activity_id: selectedActivityForSubmission.id,
        student_id: loggedStudent.id,
        file_url: publicUrlData.publicUrl,
        file_name: submissionFile.name,
        file_type: submissionFile.type,
        comment: submissionComment.trim() || null,
      })

    if (insertError) {
  if (insertError.message.toLowerCase().includes('duplicate key')) {
    notify('Você já enviou uma resposta para esta atividade.')
  } else {
    notify(`Erro ao salvar resposta: ${insertError.message}`)
  }
  return
}

    setSubmissionFile(null)
    setSubmissionComment('')
    setSelectedActivityForSubmission(null)

    notify('Resposta enviada com sucesso.')
    await fetchSubmissions(selectedClassId)
  } catch (error) {
    console.error(error)
    notify('Erro inesperado ao enviar resposta.')
  }
}

  async function handleConfirmOccurrence() {
    if (!selectedClassId || !selectedStudent) return

    if (!selectedSituation) {
      notify('Selecione uma situação.')
      return
    }

    if (selectedSituation === 'Outro' && !occurrenceDescription.trim()) {
      notify('Descreva a ocorrência.')
      return
    }

    const { error } = await supabase.from('student_occurrences').insert({
      school_id: schoolId,
      class_id: selectedClassId,
      student_id: selectedStudent.id,
      teacher_id: userId,
      situation: selectedSituation,
      description: occurrenceDescription.trim() || null,
    })

    if (error) {
      notify(`Erro ao registrar ocorrência: ${error.message}`)
      return
    }

    setSelectedStudent(null)
    setSelectedSituation('')
    setOccurrenceDescription('')
    notify('Ocorrência registrada com sucesso.')
  }

  function getStudentName(student: Student) {
    return student.full_name || student.name || 'Aluno sem nome'
  }

async function loadStudentPhoto(studentId: string, path?: string | null) {
  if (!path) {
    setStudentPhotoUrls((prev) => ({
      ...prev,
      [studentId]: null,
    }))
    return
  }

  if (path.startsWith('http')) {
    setStudentPhotoUrls((prev) => ({
      ...prev,
      [studentId]: path,
    }))
    return
  }

  const { data, error } = await supabase.storage
    .from('student-profile-photos')
    .createSignedUrl(path, 3600)

  if (error) {
    console.log('Erro ao carregar foto:', error.message, path)

    setStudentPhotoUrls((prev) => ({
      ...prev,
      [studentId]: null,
    }))
    return
  }

  setStudentPhotoUrls((prev) => ({
    ...prev,
    [studentId]: data.signedUrl,
  }))
}

  function getStudentSubmission(activityId: string) {
  if (!loggedStudent) return null

  return (
    submissions.find(
      (submission) =>
        submission.activity_id === activityId &&
        submission.student_id === loggedStudent.id
    ) || null
  )
}

function getSubmissionsByActivity(activityId: string) {
  return submissions.filter(
    (submission) => submission.activity_id === activityId
  )
}

function getStudentById(studentId: string) {
  return students.find((student) => student.id === studentId)
}

function isActivityExpired(dueDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const limitDate = new Date(`${dueDate}T23:59:59`)

  return today > limitDate
}

function getSituationRiskStyle(situation: string) {
  const grave = [
    'Desrespeitando o professor',
    'Desrespeitando colegas',
    'Brigando',
    'Agressão física',
    'Ameaça a colega',
    'Ameaça a professor',
    'Bullying',
    'Danificando patrimônio',
  ]

  const medio = [
    'Conversando Muito',
    'Interrompendo a aula',
    'Desobediência',
    'Provocando colegas',
    'Linguagem inadequada',
    'Uso indevido de celular',
    'Saída sem autorização',
  ]

  // 👇 NOVO: sem classificação
  if (situation === 'Outro') {
    return {
      background: '#f1f5f9',
      borderColor: '#cbd5e1',
      color: '#475569',
      label: '⚪ Sem classificação',
      level: 4,
    }
  }

  if (grave.includes(situation)) {
    return {
      background: '#fee2e2',
      borderColor: '#fca5a5',
      color: '#991b1b',
      label: '🔴 Grave',
      level: 3,
    }
  }

  if (medio.includes(situation)) {
    return {
      background: '#fef3c7',
      borderColor: '#fcd34d',
      color: '#92400e',
      label: '🟡 Médio',
      level: 2,
    }
  }

  return {
    background: '#dbeafe',
    borderColor: '#93c5fd',
    color: '#1e40af',
    label: '🔵 Leve',
    level: 1,
  }
}

function ResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      .classes-section {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }

      .classes-content-grid {
        width: 100%;
      }

      .student-row-responsive {
        min-width: 0;
      }

      .student-info-responsive strong {
        word-break: break-word;
      }

      @media (max-width: 1024px) {
        .classes-content-grid {
          grid-template-columns: 1fr !important;
        }

        .classes-grid-responsive {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 640px) {
        .classes-section {
          gap: 14px !important;
        }

        .classes-header-responsive,
        .class-header-responsive,
        .classes-card-responsive {
          border-radius: 20px !important;
          padding: 16px !important;
        }

        .classes-grid-responsive {
          grid-template-columns: 1fr !important;
        }

        .class-card-responsive {
          min-height: 130px !important;
          border-radius: 20px !important;
          padding: 18px !important;
        }

        .class-title-responsive {
          font-size: 24px !important;
        }

        .student-row-responsive {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        .student-info-responsive {
          width: 100% !important;
        }

        .student-row-responsive button {
          width: 100% !important;
        }

        .modal-actions-responsive {
          flex-direction: column !important;
        }

        .modal-actions-responsive button {
          width: 100% !important;
        }

        .download-button-responsive,
        .primary-button-responsive {
          width: 100% !important;
          text-align: center !important;
        }

        input,
        textarea,
        select,
        button {
          max-width: 100%;
        }
      }
    `}</style>
  )
}

const sortedSituationOptions = useMemo(() => {
  return [...situationOptions].sort((a, b) => {
    const riskA = getSituationRiskStyle(a).level
    const riskB = getSituationRiskStyle(b).level

    return riskA - riskB
  })
}, [])

  return (
    <section style={sectionStyle} className="classes-section">
  <ResponsiveStyles />
      <div style={headerStyle} className="classes-header-responsive">
        <div>
          <div style={eyebrowStyle}>Área pedagógica</div>
          <h2 style={titleStyle}>Turmas</h2>
          <p style={textStyle}>
            Acesse as turmas, visualize alunos, anexe atividades e registre ocorrências.
          </p>
        </div>
      </div>


      {!selectedClassId && (
        <div style={classesGridStyle} className="classes-grid-responsive">
          {visibleClasses.length === 0 ? (
            <p style={textStyle}>Nenhuma turma encontrada.</p>
          ) : (
            visibleClasses.map((schoolClass) => (
              <button
                key={schoolClass.id}
                onClick={() => openClass(schoolClass.id)}
                style={classCardStyle}
className="class-card-responsive"
              >
                <span style={classIconStyle}>🏫</span>
                <strong style={classNameStyle}>{schoolClass.name}</strong>
                <span style={classSubtitleStyle}>Abrir turma</span>
              </button>
            ))
          )}
        </div>
      )}

      {selectedClassId && selectedClass && (
        <div style={classPageStyle}>
          <button onClick={() => setSelectedClassId(null)} style={backButtonStyle}>
            ← Voltar para turmas
          </button>

          <div style={classHeaderStyle} className="class-header-responsive">
            <div>
              <div style={eyebrowStyle}>Turma selecionada</div>
              <h2 style={titleStyle}>{selectedClass.name}</h2>
              <p style={textStyle}>
                {studentsFromSelectedClass.length} aluno(s) matriculado(s)
              </p>
            </div>
          </div>

          <div style={contentGridStyle} className="classes-content-grid">
            <div style={leftColumnStyle}>
              {canManage && (
                <div style={cardStyle} className="classes-card-responsive">
                  <h3 style={cardTitleStyle}>Anexar atividade</h3>

                  <div style={formGridStyle}>
                    <input
                      value={discipline}
                      onChange={(e) => setDiscipline(e.target.value)}
                      placeholder="Disciplina"
                      style={inputStyle}
                    />

                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      style={inputStyle}
                    />

                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Outras informações (opcional)"
                      style={textareaStyle}
                    />

                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg,image/jpg"
                      onChange={(e) => setActivityFile(e.target.files?.[0] || null)}
                      style={inputStyle}
                    />

                    <button
  onClick={handleUploadActivity}
  style={primaryButtonStyle}
  className="primary-button-responsive"
>
                      Anexar atividade
                    </button>
                  </div>
                </div>
              )}

              <div style={cardStyle} className="classes-card-responsive">
                <h3 style={cardTitleStyle}>Atividades da turma</h3>

                {activities.length === 0 ? (
                  <p style={textStyle}>Nenhuma atividade anexada.</p>
                ) : (
                  <div style={activityListStyle}>
                    {activities.map((activity) => {
  const studentSubmission = getStudentSubmission(activity.id)
  const activitySubmissions = getSubmissionsByActivity(activity.id)
  const expired = isActivityExpired(activity.due_date)

  return (
    <div key={activity.id} style={activityCardStyle}>
      <strong>{activity.discipline}</strong>

      <span>
        Prazo: {new Date(activity.due_date).toLocaleDateString('pt-BR')}
      </span>

      <span
        style={{
          alignSelf: 'flex-start',
          padding: '6px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 900,
          background: expired ? '#fee2e2' : '#dcfce7',
          color: expired ? '#b91c1c' : '#166534',
        }}
      >
        {expired ? 'Prazo encerrado' : 'Dentro do prazo'}
      </span>

      {activity.description && <p>{activity.description}</p>}

      <a
        href={activity.file_url}
        target="_blank"
        rel="noreferrer"
        style={downloadButtonStyle}
className="download-button-responsive"
      >
        Baixar atividade
      </a>

      {isStudent && loggedStudent && (
        <>
          {studentSubmission ? (
            <div
              style={{
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                borderRadius: 14,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <strong style={{ color: '#166534' }}>
                Resposta enviada
              </strong>

              {studentSubmission.comment && (
                <span style={{ color: '#475569' }}>
                  Comentário: {studentSubmission.comment}
                </span>
              )}

              <a
                href={studentSubmission.file_url}
                target="_blank"
                rel="noreferrer"
                style={downloadButtonStyle}
className="download-button-responsive"
              >
                Ver minha resposta
              </a>
            </div>
          ) : expired ? (
            <div
              style={{
                border: '1px solid #fecaca',
                background: '#fef2f2',
                borderRadius: 14,
                padding: 12,
                color: '#b91c1c',
                fontWeight: 800,
              }}
            >
              Prazo encerrado. Não é mais possível enviar resposta.
            </div>
          ) : (
            <button
              onClick={() => {
                setSelectedActivityForSubmission(activity)
                setSubmissionFile(null)
                setSubmissionComment('')
              }}
              style={primaryButtonStyle}
            >
              Enviar resposta
            </button>
          )}
        </>
      )}

      {canManage && (
        <div
          style={{
            marginTop: 12,
            borderTop: '1px solid #e2e8f0',
            paddingTop: 12,
          }}
        >
          <strong>Respostas dos alunos</strong>

          {activitySubmissions.length === 0 ? (
            <p style={textStyle}>Nenhuma resposta enviada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {activitySubmissions.map((submission) => {
                const student = getStudentById(submission.student_id)

                return (
                  <div
                    key={submission.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: 12,
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong>
                        {student?.full_name || student?.name || 'Aluno não encontrado'}
                      </strong>

                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                        Enviado em:{' '}
                        {new Date(submission.created_at).toLocaleString('pt-BR')}
                      </div>

                      {submission.comment && (
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                          Comentário: {submission.comment}
                        </div>
                      )}
                    </div>

                    <a
                      href={submission.file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={downloadButtonStyle}
className="download-button-responsive"
                    >
                      Baixar resposta
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
})}
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle} className="classes-card-responsive">
              <h3 style={cardTitleStyle}>Alunos da turma</h3>

              {studentsFromSelectedClass.length === 0 ? (
                <p style={textStyle}>Nenhum aluno matriculado nesta turma.</p>
              ) : (
                <div style={studentListStyle}>
                  {studentsFromSelectedClass.map((student) => {
                    const photoUrl = studentPhotoUrls[student.id]

                    return (
                      <div
  key={student.id}
  style={studentRowStyle}
  className="student-row-responsive"
>
                        <div style={studentInfoStyle} className="student-info-responsive">
                          {photoUrl ? (
                            <img src={photoUrl} alt="Aluno" style={studentPhotoStyle} />
                          ) : (
                            <div style={studentAvatarStyle}>
                              {getStudentName(student).charAt(0)}
                            </div>
                          )}

                          <strong>{getStudentName(student)}</strong>
                        </div>

                        {canManage && (
                          <button
                            onClick={() => {
                              setSelectedStudent(student)
                              setSelectedSituation('')
                              setOccurrenceDescription('')
                            }}
                            style={dangerButtonStyle}
                          >
                            Registrar Ocorrência
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div style={modalOverlayStyle}> 
          <div style={modalStyle}>
            <h3 style={cardTitleStyle}>Registrar ocorrência</h3>
            <p style={textStyle}>{getStudentName(selectedStudent)}</p>

            <div style={optionListStyle}>
              {sortedSituationOptions.map((option) => {
  const risk = getSituationRiskStyle(option)
  const isSelected = selectedSituation === option

  return (
    <button
      key={option}
      onClick={() => setSelectedSituation(option)}
      style={{
        ...optionButtonStyle,
        background: isSelected ? risk.background : '#ffffff',
        borderColor: isSelected ? risk.borderColor : '#e2e8f0',
        color: isSelected ? risk.color : '#0f172a',
      }}
    >
      <span>{option}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: risk.color,
        }}
      >
        {risk.label}
      </span>
    </button>
  )
})}
            </div>

            {selectedSituation === 'Outro' && (
              <textarea
                value={occurrenceDescription}
                onChange={(e) => setOccurrenceDescription(e.target.value)}
                placeholder="Descreva o ocorrido"
                style={textareaStyle}
              />
            )}

            <div style={modalActionsStyle} className="modal-actions-responsive">
              <button
                onClick={() => {
                  setSelectedStudent(null)
                  setSelectedSituation('')
                  setOccurrenceDescription('')
                }}
                style={cancelButtonStyle}
              >
                Cancelar
              </button>

              <button onClick={handleConfirmOccurrence} style={confirmButtonStyle}>
                Confirmar ocorrência
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedActivityForSubmission && (
  <div style={modalOverlayStyle}>
    <div style={modalStyle}>
      <h3 style={cardTitleStyle}>Enviar resposta</h3>

      <p style={textStyle}>
        Atividade: {selectedActivityForSubmission.discipline}
      </p>

      <textarea
        value={submissionComment}
        onChange={(e) => setSubmissionComment(e.target.value)}
        placeholder="Comentário opcional"
        style={textareaStyle}
      />

      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg"
        onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
        style={inputStyle}
      />

      <div style={modalActionsStyle} className="modal-actions-responsive">
        <button
          onClick={() => {
            setSelectedActivityForSubmission(null)
            setSubmissionFile(null)
            setSubmissionComment('')
          }}
          style={cancelButtonStyle}
        >
          Cancelar
        </button>

        <button
          onClick={handleSubmitActivityAnswer}
          style={confirmButtonStyle}
        >
          Enviar resposta
        </button>
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

const messageStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e3a8a',
  fontWeight: 700,
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

const contentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 520px)',
  gap: 18,
  alignItems: 'start',
}

const leftColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 20,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  color: '#0f172a',
  fontSize: 20,
}

const formGridStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 90,
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  resize: 'vertical',
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

const activityListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const activityCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  color: '#334155',
}

const downloadButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  textDecoration: 'none',
  padding: '9px 12px',
  borderRadius: 12,
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
}

const studentListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const studentRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: 18,
  padding: 12,
}

const studentInfoStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
}

const studentPhotoStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  objectFit: 'cover',
}

const studentAvatarStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: '#dbeafe',
  color: '#1d4ed8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 900,
}

const dangerButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 12,
  padding: '10px 12px',
  background: '#dc2626',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  zIndex: 9999,
}

const modalStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  maxHeight: '85vh',
  overflowY: 'auto',
  background: '#ffffff',
  borderRadius: 24,
  padding: 22,
  boxShadow: '0 30px 90px rgba(0,0,0,0.35)',
}

const optionListStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 8,
  margin: '16px 0',
}

const optionButtonStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '10px 12px',
  cursor: 'pointer',
  fontWeight: 800,
  textAlign: 'left',
  color: '#0f172a',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
}

const modalActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 18,
}

const cancelButtonStyle: React.CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  borderRadius: 14,
  padding: '11px 14px',
  fontWeight: 800,
  cursor: 'pointer',
}

const confirmButtonStyle: React.CSSProperties = {
  border: 'none',
  background: '#dc2626',
  color: '#ffffff',
  borderRadius: 14,
  padding: '11px 14px',
  fontWeight: 800,
  cursor: 'pointer',
}