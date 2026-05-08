'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import { Html5Qrcode } from 'html5-qrcode'

type SchoolClass = {
  id: string
  name: string
  school_id: string
  year_id: string
}

type Student = {
  id: string
  name?: string | null
  full_name?: string | null
  qr_code_token?: string | null
  class_id?: string | null
  class_name?: string | null
}

type Props = {
  isAdmin: boolean
  isManager: boolean
  isTeacher: boolean
  schoolId: string
  currentUserId: string | null
  classes: SchoolClass[]
  students: Student[]
  schoolName: string
}

type AssessmentView =
  | 'menu'
  | 'builder'
  | 'library'
  | 'correction'
  | 'results'

export default function AssessmentsSection({
  isAdmin,
  isManager,
  isTeacher,
  schoolId,
  currentUserId,
  classes,
  students,
  schoolName,
}: Props) {
  const [activeView, setActiveView] = useState<AssessmentView>('menu')

  const canAccess = isAdmin || isManager || isTeacher

  if (!canAccess) return null

  return (
    <section style={cardStyle}>
      {activeView !== 'menu' && (
        <button onClick={() => setActiveView('menu')} style={backButtonStyle}>
          ← Voltar
        </button>
      )}

      {activeView === 'menu' && (
        <>
          <div style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>Avaliações</div>

              <h2 style={titleStyle}>Central de avaliações</h2>

              <p style={textStyle}>
                Crie provas, organize questões, imprima avaliações, corrija
                gabaritos e acompanhe o desempenho das turmas.
              </p>
            </div>
          </div>

          <div style={gridStyle}>
            <button
              type="button"
              onClick={() => setActiveView('builder')}
              style={optionCardStyle}
            >
              <div style={iconStyle}>📝</div>
              <h3 style={optionTitleStyle}>Criar avaliação</h3>
              <p style={optionTextStyle}>
                Monte uma nova prova por turma, disciplina, período e peso.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('library')}
              style={optionCardStyle}
            >
              <div style={iconStyle}>📚</div>
              <h3 style={optionTitleStyle}>Provas salvas</h3>
              <p style={optionTextStyle}>
                Busque avaliações já criadas, visualize e prepare impressão.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('correction')}
              style={optionCardStyle}
            >
              <div style={iconStyle}>✅</div>
              <h3 style={optionTitleStyle}>Corrigir prova</h3>
              <p style={optionTextStyle}>
                Faça correção manual ou prepare a correção por cartão-resposta.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('results')}
              style={optionCardStyle}
            >
              <div style={iconStyle}>🏆</div>
              <h3 style={optionTitleStyle}>Resultados</h3>
              <p style={optionTextStyle}>
                Consulte notas, média da turma, ranking e desempenho.
              </p>
            </button>
          </div>
        </>
      )}

{activeView === 'builder' && (
  <AssessmentBuilder
    schoolId={schoolId}
    currentUserId={currentUserId}
    classes={classes}
  />
)}

{activeView === 'library' && (
<AssessmentLibrary
  schoolId={schoolId}
  schoolName={schoolName}
  classes={classes}
  students={students}
/>
)}

{activeView === 'correction' && (
  <AssessmentCorrection
    schoolId={schoolId}
    students={students}
  />
)}

{activeView === 'results' && (
<AssessmentResults
  schoolId={schoolId}
  schoolName={schoolName}
  students={students}
/>
)}
    </section>
  )
}

type VersionLetter = 'A' | 'B' | 'C' | 'D'

const versionOffsets: Record<VersionLetter, number> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
}

function rotateArray<T>(array: T[], offset: number) {
  if (array.length === 0) return array

  const realOffset = offset % array.length

  return [
    ...array.slice(realOffset),
    ...array.slice(0, realOffset),
  ]
}

function buildQuestionVersion(question: any, version: string) {
  const offset = versionOffsets[(version as VersionLetter) || 'A'] ?? 0

  const originalOptions = [...(question.assessment_options || [])].sort(
    (a: any, b: any) => a.option_letter.localeCompare(b.option_letter)
  )

  const rotatedOptions = rotateArray(originalOptions, offset)

  const letters = ['A', 'B', 'C', 'D', 'E']

  const versionOptions = rotatedOptions.map((option: any, index: number) => ({
    ...option,
    original_letter: option.option_letter,
    option_letter: letters[index],
    is_correct: option.is_correct,
  }))

  const correctOption =
    versionOptions.find((option: any) => option.is_correct)?.option_letter || 'A'

  return {
    ...question,
    assessment_options: versionOptions,
    correct_option: correctOption,
  }
}

function AssessmentBuilder({
  schoolId,
  currentUserId,
  classes,
}: {
  schoolId: string
  currentUserId: string | null
  classes: SchoolClass[]
}) {
  const [step, setStep] = useState<'info' | 'questions'>('info')

  const [title, setTitle] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [period, setPeriod] = useState('')
  const [weight, setWeight] = useState('10')
  const [totalQuestions, setTotalQuestions] = useState('')

  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1)

  const [statement, setStatement] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [optionE, setOptionE] = useState('')
  const [correctOption, setCorrectOption] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [bankQuestions, setBankQuestions] = useState<any[]>([])
const [showQuestionBank, setShowQuestionBank] = useState(false)
const [bankLoading, setBankLoading] = useState(false)
const [questionImage, setQuestionImage] = useState<File | null>(null)
const [questionImagePreview, setQuestionImagePreview] = useState('')

const [imageCaption, setImageCaption] = useState('')

const [optionAImage, setOptionAImage] = useState<File | null>(null)
const [optionBImage, setOptionBImage] = useState<File | null>(null)
const [optionCImage, setOptionCImage] = useState<File | null>(null)
const [optionDImage, setOptionDImage] = useState<File | null>(null)
const [optionEImage, setOptionEImage] = useState<File | null>(null)

const [optionAImagePreview, setOptionAImagePreview] = useState('')
const [optionBImagePreview, setOptionBImagePreview] = useState('')
const [optionCImagePreview, setOptionCImagePreview] = useState('')
const [optionDImagePreview, setOptionDImagePreview] = useState('')
const [optionEImagePreview, setOptionEImagePreview] = useState('')

  const total = Number(totalQuestions || 0)
  const isLastQuestion = currentQuestionNumber >= total

  async function handleCreateAssessment() {
    if (!currentUserId) {
      setMessage('Usuário não identificado.')
      return
    }

    if (
      !title.trim() ||
      !subjectName.trim() ||
      !selectedClassId ||
      !period ||
      !weight ||
      !totalQuestions
    ) {
      setMessage('Preencha todos os campos da avaliação.')
      return
    }

    if (Number(totalQuestions) <= 0) {
      setMessage('Informe uma quantidade válida de questões.')
      return
    }

    const selectedClass = classes.find((item) => item.id === selectedClassId)

    setSaving(true)
    setMessage('Criando avaliação...')

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        school_id: schoolId,
        teacher_id: currentUserId,
        title: title.trim(),
        subject_name: subjectName.trim(),
        class_name: selectedClass?.name || null,
        period,
        weight: Number(weight),
        total_questions: Number(totalQuestions),
        objective_questions: Number(totalQuestions),
        discursive_questions: 0,
        status: 'draft',
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      setMessage(`Erro ao criar avaliação: ${error.message}`)
      return
    }

    const { error: classError } = await supabase
      .from('assessment_classes')
      .insert({
        assessment_id: data.id,
        class_id: selectedClassId,
      })

    setSaving(false)

    if (classError) {
      setMessage(`Avaliação criada, mas houve erro ao vincular turma: ${classError.message}`)
      return
    }

    setAssessmentId(data.id)
    setStep('questions')
    setCurrentQuestionNumber(1)
    setMessage('Avaliação criada. Agora cadastre as questões objetivas.')
  }

  async function handleSaveQuestion() {
    if (!assessmentId) {
      setMessage('Avaliação não identificada.')
      return
    }

    if (!statement.trim()) {
      setMessage('Informe o enunciado da questão.')
      return
    }

    if (
      !optionA.trim() ||
      !optionB.trim() ||
      !optionC.trim() ||
      !optionD.trim() ||
      !optionE.trim()
    ) {
      setMessage('Preencha as cinco alternativas: A, B, C, D e E.')
      return
    }

    if (!correctOption) {
      setMessage('Selecione o gabarito da questão.')
      return
    }

    setSaving(true)
    setMessage('Salvando questão...')
    const imageUrl = await uploadAssessmentImage(questionImage)

const optionAImageUrl = await uploadAssessmentImage(optionAImage)
const optionBImageUrl = await uploadAssessmentImage(optionBImage)
const optionCImageUrl = await uploadAssessmentImage(optionCImage)
const optionDImageUrl = await uploadAssessmentImage(optionDImage)
const optionEImageUrl = await uploadAssessmentImage(optionEImage)

    const { data: question, error } = await supabase
      .from('assessment_questions')
      .insert({
        assessment_id: assessmentId,
        question_number: currentQuestionNumber,
        question_type: 'objective',
        statement: statement.trim(),
        image_url: imageUrl,
image_caption: imageCaption.trim() || null,
        correct_option: correctOption,
        lines_count: null,
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      setMessage(`Erro ao salvar questão: ${error.message}`)
      return
    }

const options = [
  { letter: 'A', text: optionA, imageUrl: optionAImageUrl },
  { letter: 'B', text: optionB, imageUrl: optionBImageUrl },
  { letter: 'C', text: optionC, imageUrl: optionCImageUrl },
  { letter: 'D', text: optionD, imageUrl: optionDImageUrl },
  { letter: 'E', text: optionE, imageUrl: optionEImageUrl },
]

    const { error: optionsError } = await supabase
      .from('assessment_options')
      .insert(
        options.map((option) => ({
          question_id: question.id,
          option_letter: option.letter,
          option_text: option.text.trim(),
          image_url: option.imageUrl,
          is_correct: option.letter === correctOption,
        }))
      )
      await supabase
  .from('question_bank')
  .insert({
    school_id: schoolId,
    created_by: currentUserId,
    subject_name: subjectName.trim(),
    image_caption: imageCaption.trim() || null,
    statement: statement.trim(),

    option_a: optionA.trim(),
    option_b: optionB.trim(),
    option_c: optionC.trim(),
    option_d: optionD.trim(),
    option_e: optionE.trim(),
    option_a_image_url: optionAImageUrl,
option_b_image_url: optionBImageUrl,
option_c_image_url: optionCImageUrl,
option_d_image_url: optionDImageUrl,
option_e_image_url: optionEImageUrl,

    correct_option: correctOption,
  })

    if (optionsError) {
      setSaving(false)
      setMessage(`Erro ao salvar alternativas: ${optionsError.message}`)
      return
    }

    if (isLastQuestion) {
      const { error: finishError } = await supabase
        .from('assessments')
        .update({ status: 'ready' })
        .eq('id', assessmentId)

      setSaving(false)

      if (finishError) {
        setMessage(`Questão salva, mas houve erro ao finalizar: ${finishError.message}`)
        return
      }

      setStatement('')
      setOptionA('')
      setOptionB('')
      setOptionC('')
      setOptionD('')
      setOptionE('')
      setCorrectOption('')
      setQuestionImage(null)
setQuestionImagePreview('')
setImageCaption('')

setOptionAImage(null)
setOptionBImage(null)
setOptionCImage(null)
setOptionDImage(null)
setOptionEImage(null)

setOptionAImagePreview('')
setOptionBImagePreview('')
setOptionCImagePreview('')
setOptionDImagePreview('')
setOptionEImagePreview('')

      setMessage('Avaliação finalizada com sucesso.')
      return
    }

    setSaving(false)

    setStatement('')
    setOptionA('')
    setOptionB('')
    setOptionC('')
    setOptionD('')
    setOptionE('')
    setCorrectOption('')
    setQuestionImage(null)
setQuestionImagePreview('')

    setCurrentQuestionNumber((prev) => prev + 1)
    setMessage('Questão salva com sucesso.')
  }

  async function handleLoadQuestionBank() {
  setBankLoading(true)

  const { data, error } = await supabase
    .from('question_bank')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  setBankLoading(false)

  if (error) {
    setMessage(
      `Erro ao carregar banco de questões: ${error.message}`
    )
    return
  }

  setBankQuestions(data || [])
  setShowQuestionBank(true)
}

function handleUseBankQuestion(question: any) {
  setStatement(question.statement)

  setOptionA(question.option_a)
  setOptionB(question.option_b)
  setOptionC(question.option_c)
  setOptionD(question.option_d)
  setOptionE(question.option_e)

  setCorrectOption(question.correct_option)

  setShowQuestionBank(false)

  setMessage(
    'Questão carregada do banco.'
  )
}

async function uploadAssessmentImage(file: File | null) {
  if (!file) return null

  const fileExt = file.name.split('.').pop()
  const fileName = `${schoolId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`

  const { error } = await supabase.storage
    .from('assessment-question-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    setMessage(`Erro ao enviar imagem: ${error.message}`)
    return null
  }

  const { data } = supabase.storage
    .from('assessment-question-images')
    .getPublicUrl(fileName)

  return data.publicUrl
}

  return (
    <>
      {step === 'info' && (
        <>
          <div style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>Criar avaliação</div>
              <h2 style={titleStyle}>Dados da prova</h2>
              <p style={textStyle}>
                Modelo objetivo estilo ENEM e vestibulares, com alternativas A, B, C, D e E.
              </p>
            </div>
          </div>

          <div style={formGridStyle}>
            <input
              type="text"
              placeholder="Título da avaliação"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Disciplina"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              style={inputStyle}
            />

            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Selecione a turma</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name}
                </option>
              ))}
            </select>

            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={inputStyle}
            >
              <option value="">Período</option>
              <option value="1º bimestre">1º bimestre</option>
              <option value="2º bimestre">2º bimestre</option>
              <option value="3º bimestre">3º bimestre</option>
              <option value="4º bimestre">4º bimestre</option>
              <option value="1º trimestre">1º trimestre</option>
              <option value="2º trimestre">2º trimestre</option>
              <option value="3º trimestre">3º trimestre</option>
            </select>

            <input
              type="number"
              placeholder="Peso da avaliação"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={inputStyle}
            />

            <input
              type="number"
              placeholder="Quantidade de questões objetivas"
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              onClick={handleCreateAssessment}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving ? 'Criando...' : 'Criar avaliação'}
            </button>
          </div>
        </>
      )}

      {step === 'questions' && (
        <>
          <div style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>Questões objetivas</div>
              <h2 style={titleStyle}>
                Questão {String(currentQuestionNumber).padStart(2, '0')} de {totalQuestions}
              </h2>
              <p style={textStyle}>
                Cadastre o enunciado, as cinco alternativas e marque a resposta correta.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              placeholder="Enunciado da questão"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              style={{ ...inputStyle, minHeight: 130, resize: 'vertical' }}
            />

            <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }}
>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0]

      if (!file) return

      setQuestionImage(file)

      const reader = new FileReader()

      reader.onloadend = () => {
        setQuestionImagePreview(
          reader.result as string
        )
      }

      reader.readAsDataURL(file)
    }}
    style={inputStyle}
  />

  {questionImagePreview && (
    <img
      src={questionImagePreview}
      alt="Prévia"
      style={{
        width: '100%',
        maxHeight: 280,
        objectFit: 'contain',
        borderRadius: 18,
        border: '1px solid #cbd5e1',
        background: '#ffffff',
      }}
    />
  )}
  <textarea
  placeholder="Texto complementar abaixo da imagem"
  value={imageCaption}
  onChange={(e) => setImageCaption(e.target.value)}
  style={{
    ...inputStyle,
    minHeight: 80,
    resize: 'vertical',
  }}
/>
</div>

            <input
              placeholder="Alternativa A"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Alternativa B"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Alternativa C"
              value={optionC}
              onChange={(e) => setOptionC(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Alternativa D"
              value={optionD}
              onChange={(e) => setOptionD(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Alternativa E"
              value={optionE}
              onChange={(e) => setOptionE(e.target.value)}
              style={inputStyle}
            />

            <select
              value={correctOption}
              onChange={(e) => setCorrectOption(e.target.value)}
              style={inputStyle}
            >
              <option value="">Selecione o gabarito</option>
              <option value="A">Alternativa A</option>
              <option value="B">Alternativa B</option>
              <option value="C">Alternativa C</option>
              <option value="D">Alternativa D</option>
              <option value="E">Alternativa E</option>
            </select>
          </div>
          <div
  style={{
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 18,
  }}
>
  <button
    type="button"
    onClick={handleLoadQuestionBank}
    style={{
      ...primaryButtonStyle,
      background: '#0f172a',
    }}
  >
    {bankLoading
      ? 'Carregando...'
      : 'Banco de questões'}
  </button>
</div>

          <div style={{ marginTop: 18 }}>
            <button
              onClick={handleSaveQuestion}
              disabled={saving}
              style={{
                ...primaryButtonStyle,
                background: isLastQuestion
                  ? '#16a34a'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              }}
            >
              {saving
                ? 'Salvando...'
                : isLastQuestion
                ? 'Salvar e finalizar avaliação'
                : 'Salvar questão e próxima →'}
            </button>
          </div>
        </>
      )}

      {showQuestionBank && (
  <div
    style={{
      marginTop: 24,
      borderRadius: 24,
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      padding: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      maxHeight: 520,
      overflowY: 'auto',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div>
        <div style={eyebrowStyle}>
          Banco de questões
        </div>

        <h3
          style={{
            margin: '6px 0 0',
            fontSize: 24,
            color: '#0f172a',
            fontWeight: 900,
          }}
        >
          Questões cadastradas
        </h3>
      </div>

      <button
        type="button"
        onClick={() =>
          setShowQuestionBank(false)
        }
        style={{
          ...primaryButtonStyle,
          background: '#64748b',
        }}
      >
        Fechar
      </button>
    </div>

    {bankQuestions.length === 0 ? (
      <div style={emptyStateStyle}>
        Nenhuma questão encontrada.
      </div>
    ) : (
      bankQuestions.map((question) => (
        <div
          key={question.id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            padding: 18,
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#2563eb',
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            {question.subject_name}
          </div>

          <div
            style={{
              color: '#0f172a',
              lineHeight: 1.6,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            {question.statement}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {[
              ['A', question.option_a],
              ['B', question.option_b],
              ['C', question.option_c],
              ['D', question.option_d],
              ['E', question.option_e],
            ].map(([letter, text]) => (
              <div
                key={letter}
                style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  border:
                    question.correct_option ===
                    letter
                      ? '1px solid #86efac'
                      : '1px solid #e2e8f0',
                  background:
                    question.correct_option ===
                    letter
                      ? '#dcfce7'
                      : '#ffffff',
                  fontWeight:
                    question.correct_option ===
                    letter
                      ? 900
                      : 600,
                }}
              >
                {letter}) {text}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              handleUseBankQuestion(
                question
              )
            }
            style={primaryButtonStyle}
          >
            Usar questão
          </button>
        </div>
      ))
    )}
  </div>
)}

      {message && <div style={messageStyle}>{message}</div>}
    </>
  )
}

function AssessmentLibrary({
  schoolId,
  schoolName,
  classes,
  students,
}: {
  schoolId: string
  schoolName: string
  classes: SchoolClass[]
  students: Student[]
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [assessments, setAssessments] = useState<any[]>([])

  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selectedAssessment, setSelectedAssessment] = useState<any | null>(null)
const [selectedQuestions, setSelectedQuestions] = useState<any[]>([])
const [previewLoading, setPreviewLoading] = useState(false)
const [printLoading, setPrintLoading] = useState(false)
const [editingAssessment, setEditingAssessment] = useState<any | null>(null)
const [editingQuestions, setEditingQuestions] = useState<any[]>([])
const [editingLoading, setEditingLoading] = useState(false)
const [printingAssessment, setPrintingAssessment] = useState<any | null>(null)
const [selectedPrintVersion, setSelectedPrintVersion] = useState('A')

  async function handleLoadAssessments() {
    setLoading(true)

    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    setLoading(false)

    if (error) {
      setMessage(`Erro ao buscar avaliações: ${error.message}`)
      return
    }

    setAssessments(data || [])
  }

  async function handlePreviewAssessment(assessment: any) {
  setSelectedAssessment(assessment)
  setSelectedQuestions([])
  setPreviewLoading(true)
  setMessage('Carregando questões da avaliação...')

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      id,
      question_number,
      statement,
      correct_option,
      assessment_options (
        id,
        option_letter,
        option_text,
        is_correct
      )
    `)
    .eq('assessment_id', assessment.id)
    .order('question_number', { ascending: true })

  setPreviewLoading(false)

  if (error) {
    setMessage(`Erro ao carregar questões: ${error.message}`)
    return
  }

  setSelectedQuestions(data || [])
  setMessage('')
}

async function handlePrintAssessment(
  assessment: any,
  version: string
) {
  setPrintLoading(true)
  setMessage('Montando impressão da avaliação...')

  const { data, error } = await supabase
    .from('assessment_questions')
.select(`
  id,
  question_number,
  statement,
  image_url,
  correct_option,
  assessment_options (
    id,
    option_letter,
    option_text,
    is_correct
  )
`)
    .eq('assessment_id', assessment.id)
    .order('question_number', { ascending: true })

  setPrintLoading(false)

  if (error) {
    setMessage(`Erro ao gerar impressão: ${error.message}`)
    return
  }

  const questions = data || []

const printVersion = version

const versionedQuestions = questions.map((question: any) =>
  buildQuestionVersion(question, printVersion)
)

  const printWindow = window.open(
    '',
    '_blank',
    'width=1000,height=1400'
  )

  if (!printWindow) {
    setMessage('Não foi possível abrir a janela de impressão.')
    return
  }

  const questionsHtml = versionedQuestions
    .map((question: any, index: number) => {
      const optionsHtml = [...(question.assessment_options || [])]
        .sort((a: any, b: any) =>
          a.option_letter.localeCompare(b.option_letter)
        )
        .map(
          (option: any) => `
            <div class="option">
              <strong>${option.option_letter})</strong>
              ${option.option_text}
            </div>
          `
        )
        .join('')

      return `
        <div class="question">
          <div class="question-number">
            Questão ${String(index + 1).padStart(2, '0')}
          </div>

${
  question.image_url
    ? `
      <img
        src="${question.image_url}"
        class="question-image"
      />
    `
    : ''
}

<div class="statement">
  ${question.statement}
</div>

          <div class="options">
            ${optionsHtml}
          </div>
        </div>
      `
    })
    .join('')

    const answerKeyHtml = versionedQuestions
  .map((question: any, index: number) => {
    return `
      <tr>
        <td>${String(index + 1).padStart(2, '0')}</td>
        <td>${question.correct_option || '-'}</td>
      </tr>
    `
  })
  .join('')

  printWindow.document.write(`
    <html>
      <head>
        <title>${assessment.title}</title>

        <div>
  <strong>Versão:</strong>
  ${printVersion}
</div>

        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, sans-serif;
          }

          @page {
            size: A4;
            margin: 12mm;
          }

          .container {
            width: 100%;
          }

          .header {
            border: 2px solid #111827;
            border-radius: 14px;
            padding: 18px;
            margin-bottom: 24px;
          }

          .school {
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 10px;
          }

          .meta {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 14px;
          }

          .student-line {
            margin-top: 18px;
            border-bottom: 1px solid #111827;
            height: 28px;
          }

          .questions {
            column-count: 2;
            column-gap: 38px;
          }

          .question {
            break-inside: avoid;
            margin-bottom: 22px;
            padding-bottom: 12px;
          }

          .question-number {
            font-size: 15px;
            font-weight: 900;
            margin-bottom: 10px;
            color: #111827;
          }

          .statement {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 12px;
          }

          .options {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

.question-image {
  display: block;
  width: 100%;
  max-width: 320px;
  max-height: 220px;
  object-fit: contain;
  margin: 0 auto 12px;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
}

          .option {
            font-size: 14px;
            line-height: 1.5;
          }

          .answer-key-page {
  page-break-before: always;
  padding-top: 8px;
}

.answer-key-page h1 {
  font-size: 24px;
  margin-bottom: 16px;
}

.answer-key-meta {
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 20px;
}

.answer-key-table {
  width: 100%;
  border-collapse: collapse;
}

.answer-key-table th,
.answer-key-table td {
  border: 1px solid #111827;
  padding: 10px;
  text-align: center;
  font-size: 14px;
}

.answer-key-table th {
  background: #f1f5f9;
  font-weight: 900;
}
        </style>
      </head>

      <body>
        <div class="container">
          <div class="header">
            <div class="school">
              SchoolOS
            </div>

            <div class="meta">
              <div>
                <strong>Avaliação:</strong>
                ${assessment.title}
              </div>

              <div>
                <strong>Disciplina:</strong>
                ${assessment.subject_name}
              </div>

              <div>
                <strong>Turma:</strong>
                ${assessment.class_name || '-'}
              </div>

              <div>
                <strong>Questões:</strong>
                ${assessment.total_questions}
              </div>
            </div>

            <div class="student-line"></div>
          </div>

          <div class="questions">
            ${questionsHtml}
          </div>
          <div class="answer-key-page">
  <h1>Gabarito do Professor</h1>

  <div class="answer-key-meta">
    <strong>Avaliação:</strong> ${assessment.title}<br />
    <strong>Disciplina:</strong> ${assessment.subject_name}<br />
    <strong>Turma:</strong> ${assessment.class_name || '-'}<br />
    <strong>Questões:</strong> ${assessment.total_questions}
  </div>

  <table class="answer-key-table">
    <thead>
      <tr>
        <th>Questão</th>
        <th>Gabarito</th>
      </tr>
    </thead>

    <tbody>
      ${answerKeyHtml}
    </tbody>
  </table>
</div>
        </div>
      </body>
    </html>
  `)

printWindow.document.close()

printWindow.onload = () => {
  const images = Array.from(printWindow.document.images)

  if (images.length === 0) {
    printWindow.focus()
    printWindow.print()
    return
  }

  let loadedImages = 0

  const tryPrint = () => {
    loadedImages += 1

    if (loadedImages >= images.length) {
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
      }, 300)
    }
  }

  images.forEach((img) => {
    if (img.complete) {
      tryPrint()
      return
    }

    img.onload = tryPrint
    img.onerror = tryPrint
  })
}
}

async function handlePrintAnswerSheets(assessment: any) {
  const relatedStudents = students.filter(
    (student) =>
      !assessment.class_name ||
      student.class_name === assessment.class_name
  )

  if (relatedStudents.length === 0) {
    setMessage('Nenhum aluno encontrado para esta turma.')
    return
  }

  const totalQuestions = assessment.total_questions || 0
  const versions = ['A', 'B', 'C', 'D']

  const answerSheetsArray = await Promise.all(
    relatedStudents.map(async (student, studentIndex) => {
      const version = versions[studentIndex % versions.length]

const qrPayload = `schoolos:answer-sheet:${assessment.id}:${student.id}:${version}`

      const qrCodeUrl = await QRCode.toDataURL(qrPayload, {
        width: 120,
        margin: 1,
      })

      const questionsHtml = Array.from({ length: totalQuestions })
        .map((_, index) => {
          const questionNumber = index + 1

          return `
            <div class="question-row">
              <div class="question-number">
                ${String(questionNumber).padStart(2, '0')}
              </div>

              <div class="bubbles">
                ${['A', 'B', 'C', 'D', 'E']
                  .map(
                    (letter) => `
                      <div class="bubble">
                        <div class="circle"></div>
                        <span>${letter}</span>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
        })
        .join('')

      return `
        <div class="sheet">
          <div class="sheet-header">
            <div class="school-name">
              ${schoolName}
            </div>

            <div class="assessment-title">
              ${assessment.title}
            </div>

            <div class="version-badge">
              Versão ${version}
            </div>

            <div class="header-grid">
              <div class="student-info">
                <div>
                  <strong>Aluno:</strong>
                  ${student.full_name || student.name || 'Aluno'}
                </div>

                <div>
                  <strong>Turma:</strong>
                  ${assessment.class_name || '-'}
                </div>
              </div>

              <div class="qr-box">
                <img src="${qrCodeUrl}" />
                <div>QR do aluno</div>
              </div>
            </div>
          </div>

          <div class="questions-grid">
            ${questionsHtml}
          </div>
        </div>
      `
    })
  )

  const finalAnswerSheetsHtml = answerSheetsArray.join('')

  const printWindow = window.open('', '_blank', 'width=1200,height=900')

  if (!printWindow) {
    setMessage('Não foi possível abrir impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Cartões-resposta</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
          }

          .sheet {
            border: 2px solid #0f172a;
            border-radius: 24px;
            padding: 24px;
            margin-bottom: 28px;
            page-break-after: always;
          }

          .sheet-header {
            margin-bottom: 24px;
          }

          .school-name {
            font-size: 30px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          .assessment-title {
            font-size: 20px;
            font-weight: 800;
            margin-bottom: 10px;
          }

          .version-badge {
            display: inline-block;
            padding: 8px 14px;
            border-radius: 999px;
            border: 2px solid #0f172a;
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 16px;
          }

          .header-grid {
            display: grid;
            grid-template-columns: 1fr 120px;
            gap: 18px;
            align-items: start;
          }

          .student-info {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 16px;
          }

          .qr-box {
            text-align: center;
            font-size: 11px;
            font-weight: 700;
          }

          .qr-box img {
            width: 100px;
            height: 100px;
          }

          .questions-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px 28px;
          }

          .question-row {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .question-number {
            width: 42px;
            font-weight: 900;
            font-size: 16px;
          }

          .bubbles {
            display: flex;
            gap: 12px;
          }

          .bubble {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            font-weight: 700;
          }

          .circle {
            width: 24px;
            height: 24px;
            border-radius: 999px;
            border: 2px solid #0f172a;
          }

          @media print {
            body {
              padding: 0;
            }

            .sheet {
              border-width: 1.5px;
            }
          }
        </style>
      </head>

      <body>
        ${finalAnswerSheetsHtml}

        <script>
          window.onload = () => {
            window.print()
          }
        </script>
      </body>
    </html>
  `)

  printWindow.document.close()
}

async function handlePrintIndividualizedExams(assessment: any) {
  const relatedStudents = students.filter(
    (student) =>
      !assessment.class_name ||
      student.class_name === assessment.class_name
  )

  if (relatedStudents.length === 0) {
    setMessage('Nenhum aluno encontrado para esta turma.')
    return
  }

  setPrintLoading(true)
  setMessage('Montando provas individualizadas...')

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      id,
      question_number,
      statement,
      image_url,
      correct_option,
      assessment_options (
        id,
        option_letter,
        option_text,
        is_correct
      )
    `)
    .eq('assessment_id', assessment.id)
    .order('question_number', { ascending: true })

  setPrintLoading(false)

  if (error) {
    setMessage(`Erro ao gerar provas: ${error.message}`)
    return
  }

  const questions = data || []
  const versions = ['A', 'B', 'C', 'D']

  const examsHtmlArray = await Promise.all(
    relatedStudents.map(async (student, studentIndex) => {
      const version = versions[studentIndex % versions.length]

      const versionedQuestions = questions.map((question: any) =>
        buildQuestionVersion(question, version)
      )

      const questionsHtml = versionedQuestions
        .map((question: any, index: number) => {
          const imageHtml = question.image_url
            ? `
              <img
                src="${question.image_url}"
                class="question-image"
              />
            `
            : ''

          const optionsHtml = [...(question.assessment_options || [])]
            .sort((a: any, b: any) =>
              a.option_letter.localeCompare(b.option_letter)
            )
            .map(
              (option: any) => `
                <div class="option">
                  <strong>${option.option_letter})</strong>
                  ${option.option_text}
                </div>
              `
            )
            .join('')

          return `
            <div class="question">
              <div class="question-number">
                Questão ${String(index + 1).padStart(2, '0')}
              </div>

              ${imageHtml}

              <div class="statement">
                ${question.statement}
              </div>

              <div class="options">
                ${optionsHtml}
              </div>
            </div>
          `
        })
        .join('')

      return `
        <div class="exam-page">
<div class="header">
  <div class="school">${schoolName}</div>

  <div class="exam-title">${assessment.title}</div>

  <div class="meta-grid">
    <div><strong>Aluno:</strong> ${student.full_name || student.name || 'Aluno'}</div>
    <div><strong>Turma:</strong> ${assessment.class_name || '-'}</div>
    <div><strong>Disciplina:</strong> ${assessment.subject_name}</div>
    <div><strong>Versão:</strong> ${version}</div>
  </div>

  <div class="instruction">
    Leia atentamente as questões e marque as respostas no cartão-resposta correspondente.
  </div>
</div>

          <div class="questions">
            ${questionsHtml}
          </div>
        </div>
      `
    })
  )

  const finalExamsHtml = examsHtmlArray.join('')

  const printWindow = window.open('', '_blank', 'width=1000,height=1400')

  if (!printWindow) {
    setMessage('Não foi possível abrir a janela de impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Provas individualizadas</title>

        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: Arial, sans-serif;
          }

          @page {
            size: A4;
            margin: 10mm;
          }

          .exam-page {
            page-break-after: always;
          }

          .header {
  border: 2px solid #111827;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 22px;
  background: #ffffff;
}

.school {
  font-size: 25px;
  font-weight: 900;
  text-align: center;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.exam-title {
  font-size: 17px;
  font-weight: 800;
  text-align: center;
  margin-bottom: 16px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 18px;
  font-size: 13px;
  border-top: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
  padding: 12px 0;
}

.instruction {
  margin-top: 12px;
  font-size: 12px;
  color: #475569;
  text-align: center;
  font-style: italic;
}

.questions {
  column-count: 2;
  column-gap: 34px;
  column-rule: 1px solid #cbd5e1;
}

          .question {
            break-inside: avoid;
            margin-bottom: 20px;
            padding-bottom: 10px;
          }

          .question-number {
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          .question-image {
            display: block;
            width: 100%;
            max-width: 260px;
            max-height: 180px;
            object-fit: contain;
            margin: 0 auto 10px;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
          }

          .statement {
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 10px;
          }

          .options {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .option {
            font-size: 13px;
            line-height: 1.4;
          }
        </style>
      </head>

      <body>
        ${finalExamsHtml}
      </body>
    </html>
  `)

  printWindow.document.close()

  printWindow.onload = () => {
    const images = Array.from(printWindow.document.images)

    if (images.length === 0) {
      printWindow.focus()
      printWindow.print()
      return
    }

    let loadedImages = 0

    const tryPrint = () => {
      loadedImages += 1

      if (loadedImages >= images.length) {
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
        }, 300)
      }
    }

    images.forEach((img) => {
      if (img.complete) {
        tryPrint()
        return
      }

      img.onload = tryPrint
      img.onerror = tryPrint
    })
  }
}

async function handleDuplicateAssessment(
  assessment: any
) {
  setLoading(true)
  setMessage('Duplicando avaliação...')

  const { data: newAssessment, error } =
    await supabase
      .from('assessments')
      .insert({
        school_id: assessment.school_id,
        teacher_id: assessment.teacher_id,
        title: `${assessment.title} (Cópia)`,
        subject_name: assessment.subject_name,
        class_name: assessment.class_name,
        period: assessment.period,
        weight: assessment.weight,
        total_questions:
          assessment.total_questions,
        objective_questions:
          assessment.objective_questions,
        discursive_questions: 0,
        status: 'draft',
      })
      .select('id')
      .single()

  if (error || !newAssessment) {
    setLoading(false)

    setMessage(
      `Erro ao duplicar avaliação: ${
        error?.message || 'Erro desconhecido'
      }`
    )

    return
  }

  const newAssessmentId = newAssessment.id

  const { data: questions, error: questionsError } =
    await supabase
      .from('assessment_questions')
      .select(`
        *,
        assessment_options (
          *
        )
      `)
      .eq('assessment_id', assessment.id)
      .order('question_number', {
        ascending: true,
      })

  if (questionsError) {
    setLoading(false)

    setMessage(
      `Erro ao copiar questões: ${questionsError.message}`
    )

    return
  }

  for (const question of questions || []) {
    const { data: newQuestion, error: newQuestionError } =
      await supabase
        .from('assessment_questions')
        .insert({
          assessment_id: newAssessmentId,
          question_number:
            question.question_number,
          question_type: 'objective',
          statement: question.statement,
          correct_option:
            question.correct_option,
          lines_count: null,
        })
        .select('id')
        .single()

    if (newQuestionError || !newQuestion) {
      continue
    }

    const options =
      question.assessment_options || []

    if (options.length > 0) {
      await supabase
        .from('assessment_options')
        .insert(
          options.map((option: any) => ({
            question_id: newQuestion.id,
            option_letter:
              option.option_letter,
            option_text:
              option.option_text,
            is_correct:
              option.is_correct,
          }))
        )
    }
  }

  setLoading(false)

  setMessage(
    'Avaliação duplicada com sucesso.'
  )

  handleLoadAssessments()
}

async function handleOpenAssessment(
  assessment: any
) {
  setEditingLoading(true)
  setMessage('Carregando avaliação...')

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      *,
      assessment_options (
        *
      )
    `)
    .eq('assessment_id', assessment.id)
    .order('question_number', {
      ascending: true,
    })

  setEditingLoading(false)

  if (error) {
    setMessage(
      `Erro ao abrir avaliação: ${error.message}`
    )

    return
  }

  const normalizedQuestions = (data || []).map(
    (question: any) => {
      const options =
        question.assessment_options || []

      const getOption = (letter: string) =>
        options.find(
          (item: any) =>
            item.option_letter === letter
        )?.option_text || ''

      return {
        ...question,

        optionA: getOption('A'),
        optionB: getOption('B'),
        optionC: getOption('C'),
        optionD: getOption('D'),
        optionE: getOption('E'),
      }
    }
  )

  setEditingAssessment(assessment)
  setEditingQuestions(normalizedQuestions)

  setMessage('')
}

async function handleSaveEditedAssessment() {
  if (!editingAssessment) return

  setEditingLoading(true)
  setMessage('Salvando alterações...')

  for (const question of editingQuestions) {
    await supabase
      .from('assessment_questions')
      .update({
        statement: question.statement,
        correct_option:
          question.correct_option,
      })
      .eq('id', question.id)

    const options = [
      ['A', question.optionA],
      ['B', question.optionB],
      ['C', question.optionC],
      ['D', question.optionD],
      ['E', question.optionE],
    ]

    for (const [letter, text] of options) {
      await supabase
        .from('assessment_options')
        .update({
          option_text: text,
          is_correct:
            letter ===
            question.correct_option,
        })
        .eq('question_id', question.id)
        .eq('option_letter', letter)
    }
  }

  setEditingLoading(false)

  setMessage(
    'Avaliação atualizada com sucesso.'
  )
}

async function handleDeleteAssessment(assessment: any) {
  const confirmDelete = window.confirm(
    `Tem certeza que deseja excluir a avaliação "${assessment.title}"? Essa ação não pode ser desfeita.`
  )

  if (!confirmDelete) return

  setLoading(true)
  setMessage('Excluindo avaliação...')

  const { data: questions, error: questionsError } = await supabase
    .from('assessment_questions')
    .select('id')
    .eq('assessment_id', assessment.id)

  if (questionsError) {
    setLoading(false)
    setMessage(`Erro ao buscar questões: ${questionsError.message}`)
    return
  }

  const questionIds = (questions || []).map((question) => question.id)

  if (questionIds.length > 0) {
    const { error: optionsError } = await supabase
      .from('assessment_options')
      .delete()
      .in('question_id', questionIds)

    if (optionsError) {
      setLoading(false)
      setMessage(`Erro ao excluir alternativas: ${optionsError.message}`)
      return
    }
  }

  const { error: resultsError } = await supabase
    .from('assessment_results')
    .delete()
    .eq('assessment_id', assessment.id)

  if (resultsError) {
    setLoading(false)
    setMessage(`Erro ao excluir resultados: ${resultsError.message}`)
    return
  }

  const { error: classesError } = await supabase
    .from('assessment_classes')
    .delete()
    .eq('assessment_id', assessment.id)

  if (classesError) {
    setLoading(false)
    setMessage(`Erro ao excluir vínculo com turma: ${classesError.message}`)
    return
  }

  const { error: questionsDeleteError } = await supabase
    .from('assessment_questions')
    .delete()
    .eq('assessment_id', assessment.id)

  if (questionsDeleteError) {
    setLoading(false)
    setMessage(`Erro ao excluir questões: ${questionsDeleteError.message}`)
    return
  }

  const { error: assessmentError } = await supabase
    .from('assessments')
    .delete()
    .eq('id', assessment.id)

  setLoading(false)

  if (assessmentError) {
    setMessage(`Erro ao excluir avaliação: ${assessmentError.message}`)
    return
  }

  if (editingAssessment?.id === assessment.id) {
    setEditingAssessment(null)
    setEditingQuestions([])
  }

  if (selectedAssessment?.id === assessment.id) {
    setSelectedAssessment(null)
    setSelectedQuestions([])
  }

  setMessage('Avaliação excluída com sucesso.')
  await handleLoadAssessments()
}

 useEffect(() => {
  handleLoadAssessments()
}, [])

  const filtered = assessments.filter((assessment) => {
    const searchText = search.trim().toLowerCase()

    const matchesSearch =
      !searchText ||
      assessment.title?.toLowerCase().includes(searchText) ||
      assessment.subject_name?.toLowerCase().includes(searchText)

    const matchesSubject =
      !subjectFilter ||
      assessment.subject_name === subjectFilter

    const matchesClass =
      !classFilter ||
      assessment.class_name === classFilter

    return matchesSearch && matchesSubject && matchesClass
  })

  const subjects = Array.from(
    new Set(
      assessments
        .map((item) => item.subject_name)
        .filter(Boolean)
    )
  )

  const classNames = Array.from(
    new Set(
      assessments
        .map((item) => item.class_name)
        .filter(Boolean)
    )
  )

  return (
    <>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Biblioteca</div>

          <h2 style={titleStyle}>Provas salvas</h2>

          <p style={textStyle}>
            Consulte avaliações já criadas, filtre por turma ou disciplina
            e prepare futuras ações de impressão e correção.
          </p>
        </div>
      </div>

      <div style={formGridStyle}>
        <input
          type="text"
          placeholder="Buscar por título ou disciplina"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="">Todas as disciplinas</option>

          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="">Todas as turmas</option>

          {classNames.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setSearch('')
            setSubjectFilter('')
            setClassFilter('')
          }}
          style={{
            ...primaryButtonStyle,
            background: '#64748b',
          }}
        >
          Limpar filtros
        </button>
      </div>

      <div
        style={{
          marginTop: 22,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
        }}
      >
        {filtered.length === 0 && (
          <div style={emptyStateStyle}>
            Nenhuma avaliação encontrada.
          </div>
        )}

        {filtered.map((assessment) => (
          <div
            key={assessment.id}
            style={{
              borderRadius: 24,
              border: '1px solid #dbeafe',
              background: '#ffffff',
              padding: 22,
              boxShadow: '0 14px 34px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: '#2563eb',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  {assessment.subject_name}
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    color: '#0f172a',
                    fontWeight: 900,
                  }}
                >
                  {assessment.title}
                </h3>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background:
                    assessment.status === 'ready'
                      ? '#dcfce7'
                      : '#fef3c7',
                  color:
                    assessment.status === 'ready'
                      ? '#166534'
                      : '#92400e',
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                {assessment.status === 'ready'
                  ? 'Finalizada'
                  : 'Rascunho'}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                color: '#475569',
                fontSize: 14,
              }}
            >
              <div>
                <strong>Turma:</strong>{' '}
                {assessment.class_name || 'Não informada'}
              </div>

              <div>
                <strong>Questões:</strong>{' '}
                {assessment.total_questions}
              </div>

              <div>
                <strong>Peso:</strong>{' '}
                {assessment.weight}
              </div>

              <div>
                <strong>Período:</strong>{' '}
                {assessment.period}
              </div>

              <div>
                <strong>Criada em:</strong>{' '}
                {assessment.created_at
                  ? new Date(
                      assessment.created_at
                    ).toLocaleDateString('pt-BR')
                  : '-'}
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
<button
  onClick={() =>
    handleOpenAssessment(assessment)
  }
  style={primaryButtonStyle}
>
  Abrir
</button>

<button
  onClick={() => handlePreviewAssessment(assessment)}
  style={{
    ...primaryButtonStyle,
    background: '#0f172a',
  }}
>
  Visualizar
</button>

<button
  onClick={() => {
  setPrintingAssessment(assessment)
  setSelectedPrintVersion('A')
}}
  style={{
    ...primaryButtonStyle,
    background: '#7c3aed',
  }}
>
  {printLoading ? 'Gerando...' : 'Imprimir'}
</button>

<button
  onClick={() => handlePrintIndividualizedExams(assessment)}
  style={{
    ...primaryButtonStyle,
    background: '#0891b2',
  }}
>
  Provas individualizadas
</button>

<button
  onClick={() =>
    handlePrintAnswerSheets(
      assessment
    )
  }
  style={{
    ...primaryButtonStyle,
    background: '#0f172a',
  }}
>
  Cartões-resposta
</button>

<button
  onClick={() =>
    handleDuplicateAssessment(
      assessment
    )
  }
  style={{
    ...primaryButtonStyle,
    background: '#16a34a',
  }}
>
  Duplicar
</button>

<button
  onClick={() => handleDeleteAssessment(assessment)}
  style={{
    ...primaryButtonStyle,
    background: '#dc2626',
  }}
>
  Excluir
</button>
            </div>
          </div>
        ))}
      </div>

      {editingAssessment && (
  <div
    style={{
      marginTop: 28,
      borderRadius: 26,
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div>
        <div style={eyebrowStyle}>
          Editor
        </div>

        <h2 style={titleStyle}>
          {editingAssessment.title}
        </h2>

        <p style={textStyle}>
          Edite questões, alternativas e
          gabaritos da avaliação.
        </p>
      </div>

      <button
        onClick={() => {
          setEditingAssessment(null)
          setEditingQuestions([])
        }}
        style={{
          ...primaryButtonStyle,
          background: '#64748b',
        }}
      >
        Fechar
      </button>
    </div>

    {editingQuestions.map(
      (question, index) => (
        <div
          key={question.id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 22,
            padding: 20,
            background: '#f8fafc',
          }}
        >
          <div
            style={{
              fontWeight: 900,
              marginBottom: 12,
              color: '#0f172a',
            }}
          >
            Questão{' '}
            {String(index + 1).padStart(
              2,
              '0'
            )}
          </div>

          <textarea
            value={question.statement}
            onChange={(e) => {
              const value =
                e.target.value

              setEditingQuestions(
                (prev) =>
                  prev.map((item) =>
                    item.id ===
                    question.id
                      ? {
                          ...item,
                          statement:
                            value,
                        }
                      : item
                  )
              )
            }}
            style={{
              ...inputStyle,
              minHeight: 120,
              resize: 'vertical',
              marginBottom: 14,
            }}
          />

          {[
            ['A', 'optionA'],
            ['B', 'optionB'],
            ['C', 'optionC'],
            ['D', 'optionD'],
            ['E', 'optionE'],
          ].map(([label, key]) => (
            <input
              key={label}
              value={
                question[
                  key as keyof typeof question
                ] as string
              }
              onChange={(e) => {
                const value =
                  e.target.value

                setEditingQuestions(
                  (prev) =>
                    prev.map((item) =>
                      item.id ===
                      question.id
                        ? {
                            ...item,
                            [key]:
                              value,
                          }
                        : item
                    )
                )
              }}
              placeholder={`Alternativa ${label}`}
              style={{
                ...inputStyle,
                marginBottom: 10,
              }}
            />
          ))}

          <select
            value={
              question.correct_option
            }
            onChange={(e) => {
              const value =
                e.target.value

              setEditingQuestions(
                (prev) =>
                  prev.map((item) =>
                    item.id ===
                    question.id
                      ? {
                          ...item,
                          correct_option:
                            value,
                        }
                      : item
                  )
              )
            }}
            style={inputStyle}
          >
            <option value="A">
              Alternativa A
            </option>

            <option value="B">
              Alternativa B
            </option>

            <option value="C">
              Alternativa C
            </option>

            <option value="D">
              Alternativa D
            </option>

            <option value="E">
              Alternativa E
            </option>
          </select>
        </div>
      )
    )}

    <button
      onClick={
        handleSaveEditedAssessment
      }
      style={{
        ...primaryButtonStyle,
        background: '#16a34a',
      }}
    >
      {editingLoading
        ? 'Salvando...'
        : 'Salvar alterações'}
    </button>
  </div>
)}

{printingAssessment && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background:
        'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        borderRadius: 28,
        background: '#ffffff',
        padding: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        boxShadow:
          '0 40px 80px rgba(15, 23, 42, 0.28)',
        animation:
          'fadeInScale 0.18s ease',
      }}
    >
      <div>
        <div style={eyebrowStyle}>
          Impressão
        </div>

        <h3
          style={{
            margin: '8px 0',
            fontSize: 28,
            fontWeight: 900,
            color: '#0f172a',
          }}
        >
          Escolher versão da prova
        </h3>

        <p style={textStyle}>
          Selecione a versão que deseja
          imprimir.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {['A', 'B', 'C', 'D'].map(
          (version) => {
            const selected =
              selectedPrintVersion ===
              version

            return (
              <button
                key={version}
                type="button"
                onClick={() =>
                  setSelectedPrintVersion(
                    version
                  )
                }
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 26,
                  border: selected
                    ? '3px solid #2563eb'
                    : '1px solid #cbd5e1',
                  background: selected
                    ? '#dbeafe'
                    : '#ffffff',
                  fontSize: 30,
                  fontWeight: 900,
                  cursor: 'pointer',
                  color: '#0f172a',
                  transition:
                    'all 0.18s ease',
                  transform: selected
                    ? 'scale(1.06)'
                    : 'scale(1)',
                  boxShadow: selected
                    ? '0 12px 30px rgba(37, 99, 235, 0.22)'
                    : 'none',
                }}
              >
                {version}
              </button>
            )
          }
        )}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => {
            handlePrintAssessment(
              printingAssessment,
              selectedPrintVersion
            )

            setPrintingAssessment(null)
          }}
          style={{
            ...primaryButtonStyle,
            flex: 1,
          }}
        >
          Imprimir versão{' '}
          {selectedPrintVersion}
        </button>

        <button
          onClick={() =>
            setPrintingAssessment(null)
          }
          style={{
            ...primaryButtonStyle,
            background: '#64748b',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

      {selectedAssessment && (
  <div
    style={{
      marginTop: 26,
      borderRadius: 26,
      border: '1px solid #cbd5e1',
      background: '#ffffff',
      padding: 24,
      boxShadow: '0 18px 44px rgba(15, 23, 42, 0.08)',
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
        <div style={eyebrowStyle}>Visualização</div>

        <h2 style={titleStyle}>
          {selectedAssessment.title}
        </h2>

        <p style={textStyle}>
          {selectedAssessment.subject_name} •{' '}
          {selectedAssessment.class_name || 'Turma não informada'} •{' '}
          {selectedAssessment.total_questions} questões
        </p>
      </div>

      <button
        onClick={() => {
          setSelectedAssessment(null)
          setSelectedQuestions([])
        }}
        style={{
          ...primaryButtonStyle,
          background: '#64748b',
        }}
      >
        Fechar
      </button>
    </div>

    {previewLoading ? (
      <div style={emptyStateStyle}>
        Carregando questões...
      </div>
    ) : selectedQuestions.length === 0 ? (
      <div style={emptyStateStyle}>
        Nenhuma questão encontrada para esta avaliação.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedQuestions.map((question, index) => (
          <div
            key={question.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: 18,
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                fontWeight: 900,
                color: '#0f172a',
                marginBottom: 10,
              }}
            >
              Questão {String(index + 1).padStart(2, '0')}
            </div>

            {question.image_url && (
  <img
    src={question.image_url}
    alt="Imagem da questão"
    style={{
      width: '100%',
      borderRadius: 18,
      marginBottom: 14,
      border: '1px solid #cbd5e1',
      background: '#ffffff',
    }}
  />
)}

            <div
              style={{
                color: '#334155',
                lineHeight: 1.6,
                marginBottom: 14,
                fontWeight: 600,
              }}
            >
              {question.statement}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...(question.assessment_options || [])]
                .sort((a: any, b: any) =>
                  a.option_letter.localeCompare(b.option_letter)
                )
                .map((option: any) => (
                  <div
                    key={option.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 14,
                      border: option.is_correct
                        ? '1px solid #86efac'
                        : '1px solid #e2e8f0',
                      background: option.is_correct
                        ? '#dcfce7'
                        : '#ffffff',
                      color: '#0f172a',
                      fontWeight: option.is_correct ? 900 : 600,
                    }}
                  >
                    {option.option_letter}) {option.option_text}
                    {option.is_correct && '  ✓'}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

      {message && (
        <div style={messageStyle}>
          {message}
        </div>
      )}
    </>
  )
}

function AssessmentCorrection({
  schoolId,
  students,
}: {
  schoolId: string
  students: Student[]
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [assessments, setAssessments] = useState<any[]>([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')

  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [scannerActive, setScannerActive] = useState(false)
const [detectedVersion, setDetectedVersion] = useState('')
const [detectedStudentName, setDetectedStudentName] = useState('')
const qrCorrectionReadRef = useRef(false)

  const [result, setResult] = useState<{
    correct: number
    total: number
    score: number
  } | null>(null)

  useEffect(() => {
    handleLoadAssessments()
  }, [])

useEffect(() => {
  if (!scannerActive) return

  qrCorrectionReadRef.current = false

  const scanner = new Html5Qrcode('answer-sheet-qr-reader')

  scanner
    .start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: 250,
      },
      async (decodedText) => {
        if (qrCorrectionReadRef.current) return

        qrCorrectionReadRef.current = true

        if (!decodedText.startsWith('schoolos:answer-sheet:')) {
          setMessage('QR inválido para correção.')
          qrCorrectionReadRef.current = false
          return
        }

        const parts = decodedText.split(':')

        const assessmentId = parts[2]
        const studentId = parts[3]
        const version = parts[4]

        if (!assessmentId || !studentId || !version) {
          setMessage('QR incompleto.')
          qrCorrectionReadRef.current = false
          return
        }

        const student = students.find((item) => item.id === studentId)

        setSelectedAssessmentId(assessmentId)
        setSelectedStudentId(studentId)
        setDetectedVersion(version)
        setDetectedStudentName(
          student?.full_name || student?.name || 'Aluno identificado'
        )

        await handleLoadQuestionsByAssessment(assessmentId, version)

        setScannerActive(false)
        setMessage(`Aluno identificado. Versão ${version} carregada.`)
      },
      () => {}
    )
    .catch(() => {
      setMessage('Erro ao iniciar leitura do QR Code.')
    })

  return () => {
    scanner
      .stop()
      .then(() => scanner.clear())
      .catch(() => {})
  }
}, [scannerActive])

  async function handleLoadAssessments() {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Erro ao carregar avaliações: ${error.message}`)
      return
    }

    setAssessments(data || [])
  }

async function handleLoadQuestions() {
  if (!selectedAssessmentId) {
    setMessage('Selecione uma avaliação.')
    return
  }

  await handleLoadQuestionsByAssessment(selectedAssessmentId, detectedVersion || 'A')
}

  async function handleLoadQuestionsByAssessment(
  assessmentId: string,
  version: string = 'A'
) {
  setLoading(true)
  setMessage('Carregando questões...')

const { data, error } = await supabase
  .from('assessment_questions')
  .select(`
    id,
    question_number,
    statement,
    correct_option,
    assessment_options (
      id,
      option_letter,
      option_text,
      is_correct
    )
  `)
  .eq('assessment_id', assessmentId)
  .order('question_number', { ascending: true })

  setLoading(false)

  if (error) {
    setMessage(`Erro ao carregar questões: ${error.message}`)
    return
  }

  const versionedQuestions = (data || []).map((question: any) =>
  buildQuestionVersion(question, version)
)

setQuestions(versionedQuestions)
  setAnswers({})
  setResult(null)
}

  async function handleCorrectAssessment() {
    if (!selectedStudentId) {
      setMessage('Selecione um aluno.')
      return
    }

    if (questions.length === 0) {
      setMessage('Nenhuma questão carregada.')
      return
    }

    let correctCount = 0

    questions.forEach((question, index) => {
      const answer = answers[index + 1]

      if (
        answer &&
        answer === question.correct_option
      ) {
        correctCount += 1
      }
    })

    const total = questions.length

    const score =
      total > 0
        ? Number(((correctCount / total) * 10).toFixed(2))
        : 0

    const finalResult = {
      correct: correctCount,
      total,
      score,
    }

    setResult(finalResult)

const { data: savedResult, error } = await supabase
  .from('assessment_results')
  .insert({
    assessment_id: selectedAssessmentId,
    student_id: selectedStudentId,
    version: detectedVersion || 'A',
    correct: correctCount,
    total,
    score,
  })
  .select('id')
  .single()

    if (error) {
      setMessage(`Erro ao salvar resultado: ${error.message}`)
      return
    }
    if (savedResult?.id) {
  const answerRows = questions.map((question, index) => {
    const selected = answers[index + 1] || null

    return {
      result_id: savedResult.id,
      assessment_id: selectedAssessmentId,
      student_id: selectedStudentId,
      question_id: question.id,
      question_number: index + 1,
      selected_option: selected,
      correct_option: question.correct_option,
      is_correct: selected === question.correct_option,
    }
  })

  const { error: answersError } = await supabase
    .from('assessment_result_answers')
    .insert(answerRows)

  if (answersError) {
    setMessage(`Nota salva, mas houve erro ao salvar respostas: ${answersError.message}`)
    return
  }
}

    setMessage('Correção salva com sucesso.')
  }

  return (
    <>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Correção manual</div>

          <h2 style={titleStyle}>Corrigir avaliação</h2>

          <p style={textStyle}>
            Selecione a prova, marque as respostas do aluno
            e salve automaticamente a nota.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
  <button
    onClick={() => setScannerActive(true)}
    style={{
      ...primaryButtonStyle,
      background: '#0f172a',
    }}
  >
    Ler QR do cartão-resposta
  </button>

  {scannerActive && (
    <div
      style={{
        marginTop: 18,
        maxWidth: 420,
        borderRadius: 18,
        overflow: 'hidden',
        border: '2px solid #0f172a',
      }}
    >
      <div id="answer-sheet-qr-reader" />
    </div>
  )}

  {detectedStudentName && (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 18,
        background: '#dcfce7',
        border: '1px solid #86efac',
        color: '#166534',
        fontWeight: 800,
      }}
    >
      Aluno: {detectedStudentName} • Versão {detectedVersion}
    </div>
  )}
</div>

      <div style={formGridStyle}>
        <select
          value={selectedAssessmentId}
          onChange={(e) =>
            setSelectedAssessmentId(e.target.value)
          }
          style={inputStyle}
        >
          <option value="">
            Selecione a avaliação
          </option>

          {assessments.map((assessment) => (
            <option
              key={assessment.id}
              value={assessment.id}
            >
              {assessment.title} —{' '}
              {assessment.subject_name}
            </option>
          ))}
        </select>

        <select
          value={selectedStudentId}
          onChange={(e) =>
            setSelectedStudentId(e.target.value)
          }
          style={inputStyle}
        >
          <option value="">
            Selecione o aluno
          </option>

          {students.map((student) => (
            <option
              key={student.id}
              value={student.id}
            >
              {student.full_name ||
                student.name ||
                'Aluno'}
            </option>
          ))}
        </select>

        <button
          onClick={handleLoadQuestions}
          style={primaryButtonStyle}
        >
          {loading
            ? 'Carregando...'
            : 'Carregar prova'}
        </button>
      </div>

      {questions.length > 0 && (
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {questions.map((question, index) => (
            <div
              key={question.id}
              style={{
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                padding: 18,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 10,
                  color: '#0f172a',
                }}
              >
                Questão{' '}
                {String(index + 1).padStart(2, '0')}
              </div>

              <div
                style={{
                  color: '#475569',
                  marginBottom: 16,
                  lineHeight: 1.6,
                  fontWeight: 600,
                }}
              >
                {question.statement}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                {['A', 'B', 'C', 'D', 'E'].map(
                  (letter) => {
                    const selected =
                      answers[index + 1] === letter

                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => ({
                            ...prev,
                            [index + 1]: letter,
                          }))
                        }}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          border: selected
                            ? '2px solid #2563eb'
                            : '1px solid #cbd5e1',
                          background: selected
                            ? '#dbeafe'
                            : '#ffffff',
                          color: '#0f172a',
                          fontWeight: 900,
                          cursor: 'pointer',
                          fontSize: 16,
                        }}
                      >
                        {letter}
                      </button>
                    )
                  }
                )}
              </div>
            </div>
          ))}

          <button
            onClick={handleCorrectAssessment}
            style={{
              ...primaryButtonStyle,
              background: '#16a34a',
            }}
          >
            Corrigir avaliação
          </button>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 22,
            borderRadius: 22,
            background: '#dcfce7',
            border: '1px solid #86efac',
            padding: 22,
            color: '#166534',
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              marginBottom: 10,
            }}
          >
            Resultado da correção
          </div>

          <div style={{ fontSize: 16 }}>
            Acertos: {result.correct}/{result.total}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 900,
            }}
          >
            Nota {result.score.toFixed(2)}
          </div>
        </div>
      )}

      {message && (
        <div style={messageStyle}>
          {message}
        </div>
      )}
    </>
  )
}

function AssessmentResults({
  schoolId,
  schoolName,
  students,
}: {
  schoolId: string
  schoolName: string
  students: Student[]
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [assessments, setAssessments] = useState<any[]>([])
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('')

  const [results, setResults] = useState<any[]>([])

  const [questionStats, setQuestionStats] = useState<any[]>([])
const [questionStatsLoading, setQuestionStatsLoading] = useState(false)
const [selectedStudentId, setSelectedStudentId] = useState('')
const [studentHistory, setStudentHistory] = useState<any[]>([])
const [studentAverage, setStudentAverage] = useState<number | null>(null)

  const [stats, setStats] = useState<{
    average: number
    max: number
    min: number
    count: number
  } | null>(null)

  useEffect(() => {
    handleLoadAssessments()
  }, [])

  async function handleLoadAssessments() {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Erro ao carregar avaliações: ${error.message}`)
      return
    }

    setAssessments(data || [])
  }

  async function handleLoadResults() {
    if (!selectedAssessmentId) {
      setMessage('Selecione uma avaliação.')
      return
    }

    setLoading(true)
    setMessage('Carregando resultados...')

let query = supabase
  .from('assessment_results')
  .select('*')
  .eq('assessment_id', selectedAssessmentId)

if (selectedStudentId) {
  query = query.eq(
    'student_id',
    selectedStudentId
  )
}

const { data, error } = await query.order(
  'score',
  { ascending: false }
)

    setLoading(false)

    if (error) {
      setMessage(`Erro ao carregar resultados: ${error.message}`)
      return
    }

    const loadedResults = data || []

    setResults(loadedResults)

    if (
  selectedStudentId &&
  loadedResults.length > 0
) {
  const average =
    loadedResults.reduce(
      (acc, item) =>
        acc + Number(item.score),
      0
    ) / loadedResults.length

  setStudentAverage(average)

  setStudentHistory(loadedResults)
} else {
  setStudentAverage(null)
  setStudentHistory([])
}

    if (loadedResults.length === 0) {
      setStats(null)
      setMessage('Nenhum resultado encontrado.')
      return
    }

    const scores = loadedResults.map((r) =>
      Number(r.score)
    )

    const average =
      scores.reduce((acc, value) => acc + value, 0) /
      scores.length

    const max = Math.max(...scores)
    const min = Math.min(...scores)

    setStats({
      average,
      max,
      min,
      count: scores.length,
    })

    setMessage('')
    await handleLoadQuestionStats()
  }

  async function handleLoadQuestionStats() {
  if (!selectedAssessmentId) return

  setQuestionStatsLoading(true)

  const { data, error } = await supabase
    .from('assessment_result_answers')
    .select(`
      question_id,
      question_number,
      is_correct
    `)
    .eq('assessment_id', selectedAssessmentId)

  setQuestionStatsLoading(false)

  if (error) {
    setMessage(
      `Erro ao carregar estatísticas: ${error.message}`
    )
    return
  }

  const grouped: Record<
    string,
    {
      questionNumber: number
      total: number
      correct: number
    }
  > = {}

  ;(data || []).forEach((item: any) => {
    if (!grouped[item.question_id]) {
      grouped[item.question_id] = {
        questionNumber: item.question_number,
        total: 0,
        correct: 0,
      }
    }

    grouped[item.question_id].total += 1

    if (item.is_correct) {
      grouped[item.question_id].correct += 1
    }
  })

  const stats = Object.entries(grouped)
    .map(([questionId, values]) => {
      const percentage =
        values.total > 0
          ? Number(
              (
                (values.correct / values.total) *
                100
              ).toFixed(1)
            )
          : 0

      return {
        questionId,
        questionNumber:
          values.questionNumber,
        total: values.total,
        correct: values.correct,
        percentage,
      }
    })
    .sort(
      (a, b) =>
        a.questionNumber -
        b.questionNumber
    )

  setQuestionStats(stats)
}

function handleExportExcel() {
  if (results.length === 0) {
    setMessage('Nenhum resultado para exportar.')
    return
  }

  const rows = results.map((result, index) => {
    const student = students.find(
      (item) => item.id === result.student_id
    )

    return {
      Ranking: index + 1,
      Aluno:
        student?.full_name ||
        student?.name ||
        'Aluno',

      Acertos: `${result.correct}/${result.total}`,

      Nota: Number(result.score).toFixed(2),

      Versão: result.version || 'A',
    }
  })

  const worksheet =
    XLSX.utils.json_to_sheet(rows)

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Resultados'
  )

  XLSX.writeFile(
    workbook,
    `resultados-avaliacao.xlsx`
  )

  setMessage(
    'Planilha exportada com sucesso.'
  )
}

function handleExportResultsPDF() {
  if (results.length === 0) {
    setMessage('Nenhum resultado para exportar.')
    return
  }

  const assessment = assessments.find(
    (item) => item.id === selectedAssessmentId
  )

  const rankingRows = results
    .map((result, index) => {
      const student = students.find(
        (item) => item.id === result.student_id
      )

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            ${
              student?.full_name ||
              student?.name ||
              'Aluno'
            }
          </td>
          <td>${result.correct}/${result.total}</td>
          <td>${Number(result.score).toFixed(2)}</td>
        </tr>
      `
    })
    .join('')

  const questionRows = questionStats
    .map((item) => {
      return `
        <tr>
          <td>${String(item.questionNumber).padStart(2, '0')}</td>
          <td>${item.correct}</td>
          <td>${item.total}</td>
          <td>${item.percentage}%</td>
        </tr>
      `
    })
    .join('')

  const printWindow = window.open(
    '',
    '_blank',
    'width=1200,height=900'
  )

  if (!printWindow) {
    setMessage(
      'Não foi possível abrir a janela de impressão.'
    )

    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Resultados da avaliação</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 40px;
            font-family: Arial, sans-serif;
            color: #0f172a;
            background: #f8fafc;
          }

          .header {
            border-radius: 24px;
            border: 2px solid #0f172a;
            background: #ffffff;
            padding: 28px;
            margin-bottom: 28px;
          }

          .logo {
            font-size: 42px;
            font-weight: 900;
            margin-bottom: 20px;
          }

          .meta {
            font-size: 18px;
            line-height: 1.8;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
          }

          .stat-card {
            background: #ffffff;
            border-radius: 20px;
            padding: 22px;
            border: 1px solid #cbd5e1;
          }

          .stat-label {
            color: #64748b;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 12px;
          }

          .stat-value {
            font-size: 32px;
            font-weight: 900;
          }

          .section-title {
            font-size: 28px;
            font-weight: 900;
            margin: 30px 0 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
          }

          th {
            background: #0f172a;
            color: #ffffff;
            padding: 14px;
            font-size: 14px;
            text-align: left;
          }

          td {
            padding: 14px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 14px;
          }

          tr:nth-child(even) {
            background: #f8fafc;
          }

          .footer {
            margin-top: 40px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
          }

          @media print {
            body {
              background: #ffffff;
            }

            .header,
            .stat-card,
            table {
              box-shadow: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="header">
<div class="logo">
  ${schoolName}
</div>

          <div class="meta">
            <strong>Avaliação:</strong>
            ${assessment?.title || '-'}
            <br />

            <strong>Disciplina:</strong>
            ${assessment?.subject_name || '-'}
            <br />

            <strong>Turma:</strong>
            ${assessment?.class_name || '-'}
            <br />

            <strong>Questões:</strong>
            ${assessment?.total_questions || 0}
          </div>
        </div>

        ${
          stats
            ? `
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">
                    Média
                  </div>

                  <div class="stat-value">
                    ${stats.average.toFixed(2)}
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-label">
                    Maior nota
                  </div>

                  <div class="stat-value">
                    ${stats.max.toFixed(2)}
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-label">
                    Menor nota
                  </div>

                  <div class="stat-value">
                    ${stats.min.toFixed(2)}
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-label">
                    Corrigidas
                  </div>

                  <div class="stat-value">
                    ${stats.count}
                  </div>
                </div>
              </div>
            `
            : ''
        }

        <div class="section-title">
          🏆 Ranking da turma
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Aluno</th>
              <th>Acertos</th>
              <th>Nota</th>
            </tr>
          </thead>

          <tbody>
            ${rankingRows}
          </tbody>
        </table>

        ${
          questionStats.length > 0
            ? `
              <div class="section-title">
                📊 Estatísticas por questão
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Questão</th>
                    <th>Acertos</th>
                    <th>Respostas</th>
                    <th>Taxa</th>
                  </tr>
                </thead>

                <tbody>
                  ${questionRows}
                </tbody>
              </table>
            `
            : ''
        }

        <div class="footer">
          Relatório gerado automaticamente pelo SchoolOS
        </div>

        <script>
          window.onload = () => {
            window.print()
          }
        </script>
      </body>
    </html>
  `)

  printWindow.document.close()
}

const scoreDistribution = [
  {
    label: '0 a 4,9',
    count: results.filter((item) => Number(item.score) < 5).length,
  },
  {
    label: '5 a 6,9',
    count: results.filter(
      (item) => Number(item.score) >= 5 && Number(item.score) < 7
    ).length,
  },
  {
    label: '7 a 8,9',
    count: results.filter(
      (item) => Number(item.score) >= 7 && Number(item.score) < 9
    ).length,
  },
  {
    label: '9 a 10',
    count: results.filter((item) => Number(item.score) >= 9).length,
  },
]

const maxDistributionCount = Math.max(
  ...scoreDistribution.map((item) => item.count),
  1
)

const maxQuestionPercentage = Math.max(
  ...questionStats.map((item) => item.percentage),
  1
)

  return (
    <>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Resultados</div>

          <h2 style={titleStyle}>
            Desempenho da avaliação
          </h2>

          <p style={textStyle}>
            Consulte notas, média da turma e ranking
            geral dos alunos.
          </p>
        </div>
      </div>

      <div style={formGridStyle}>
        <select
          value={selectedAssessmentId}
          onChange={(e) =>
            setSelectedAssessmentId(e.target.value)
          }
          style={inputStyle}
        >
          <option value="">
            Selecione a avaliação
          </option>

          {assessments.map((assessment) => (
            <option
              key={assessment.id}
              value={assessment.id}
            >
              {assessment.title} —{' '}
              {assessment.subject_name}
            </option>
          ))}
        </select>
        <select
  value={selectedStudentId}
  onChange={(e) =>
    setSelectedStudentId(e.target.value)
  }
  style={inputStyle}
>
  <option value="">
    Todos os alunos
  </option>

  {students.map((student) => (
    <option
      key={student.id}
      value={student.id}
    >
      {student.full_name ||
        student.name ||
        'Aluno'}
    </option>
  ))}
</select>

        <button
          onClick={handleLoadResults}
          style={primaryButtonStyle}
        >
          {loading
            ? 'Carregando...'
            : 'Buscar resultados'}
        </button>

        <button
  onClick={handleExportExcel}
  style={{
    ...primaryButtonStyle,
    background: '#16a34a',
  }}
>
  Exportar Excel
</button>

<button
  onClick={handleExportResultsPDF}
  style={{
    ...primaryButtonStyle,
    background: '#7c3aed',
  }}
>
  Exportar PDF
</button>
      </div>

      {selectedStudentId &&
  studentAverage !== null && (
    <div
      style={{
        marginTop: 24,
        borderRadius: 24,
        padding: 24,
        background:
          'linear-gradient(135deg, #dbeafe 0%, #ffffff 100%)',
        border: '1px solid #93c5fd',
      }}
    >
      <div style={eyebrowStyle}>
        Desempenho individual
      </div>

      <h3
        style={{
          margin: '8px 0',
          fontSize: 28,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        Média geral:{' '}
        {studentAverage.toFixed(2)}
      </h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginTop: 20,
        }}
      >
        {studentHistory.map((item) => (
          <div
            key={item.id}
            style={{
              borderRadius: 18,
              border: '1px solid #dbeafe',
              background: '#ffffff',
              padding: 16,
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 900,
                  color: '#0f172a',
                }}
              >
                Avaliação
              </div>

              <div
                style={{
                  color: '#64748b',
                  marginTop: 4,
                }}
              >
                Acertos:{' '}
                {item.correct}/
                {item.total}
              </div>
            </div>

            <div
              style={{
                padding:
                  '10px 16px',
                borderRadius: 16,
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {Number(
                item.score
              ).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )}

      {stats && (
        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <div style={statsCardStyle}>
            <div style={statsLabelStyle}>
              Média da turma
            </div>

            <div style={statsValueStyle}>
              {stats.average.toFixed(2)}
            </div>
          </div>

          <div style={statsCardStyle}>
            <div style={statsLabelStyle}>
              Maior nota
            </div>

            <div style={statsValueStyle}>
              {stats.max.toFixed(2)}
            </div>
          </div>

          <div style={statsCardStyle}>
            <div style={statsLabelStyle}>
              Menor nota
            </div>

            <div style={statsValueStyle}>
              {stats.min.toFixed(2)}
            </div>
          </div>

          <div style={statsCardStyle}>
            <div style={statsLabelStyle}>
              Avaliações corrigidas
            </div>

            <div style={statsValueStyle}>
              {stats.count}
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h3 style={rankingTitleStyle}>
      📈 Distribuição das notas
    </h3>

    <div style={chartCardStyle}>
      {scoreDistribution.map((item) => {
        const width = (item.count / maxDistributionCount) * 100

        return (
          <div key={item.label} style={chartRowStyle}>
            <div style={chartLabelStyle}>{item.label}</div>

            <div style={chartTrackStyle}>
              <div
                style={{
                  ...chartBarStyle,
                  width: `${width}%`,
                }}
              />
            </div>

            <div style={chartValueStyle}>{item.count}</div>
          </div>
        )
      })}
    </div>
  </div>
)}

      {questionStats.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h3 style={rankingTitleStyle}>
      📊 Estatísticas por questão
    </h3>

    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {questionStats.map((item) => {
        const difficultyColor =
          item.percentage >= 80
            ? '#16a34a'
            : item.percentage >= 50
            ? '#ca8a04'
            : '#dc2626'

        const difficultyLabel =
          item.percentage >= 80
            ? 'Fácil'
            : item.percentage >= 50
            ? 'Média'
            : 'Difícil'

        return (
          <div
            key={item.questionId}
            style={{
              borderRadius: 22,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              padding: 20,
              boxShadow:
                '0 10px 24px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                gap: 12,
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  color: '#0f172a',
                }}
              >
                Questão{' '}
                {String(
                  item.questionNumber
                ).padStart(2, '0')}
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background:
                    difficultyColor,
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {difficultyLabel}
              </div>
            </div>

            <div
              style={{
                height: 18,
                borderRadius: 999,
                background: '#e2e8f0',
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${item.percentage}%`,
                  height: '100%',
                  background:
                    difficultyColor,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                gap: 14,
                flexWrap: 'wrap',
                color: '#475569',
                fontWeight: 700,
              }}
            >
              <div>
                Acertos: {item.correct}
              </div>

              <div>
                Respostas: {item.total}
              </div>

              <div>
                Taxa de acerto:{' '}
                {item.percentage}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

{questionStats.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h3 style={rankingTitleStyle}>
      📉 Acerto por questão
    </h3>

    <div style={questionChartGridStyle}>
      {questionStats.map((item) => {
        const height = Math.max(
          8,
          (item.percentage / maxQuestionPercentage) * 180
        )

        return (
          <div key={item.questionId} style={questionChartItemStyle}>
            <div style={questionChartValueStyle}>
              {item.percentage}%
            </div>

            <div style={questionBarWrapStyle}>
              <div
                style={{
                  ...questionBarStyle,
                  height,
                  background:
                    item.percentage >= 80
                      ? '#16a34a'
                      : item.percentage >= 50
                      ? '#ca8a04'
                      : '#dc2626',
                }}
              />
            </div>

            <div style={questionChartLabelStyle}>
              Q{String(item.questionNumber).padStart(2, '0')}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

      {results.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3 style={rankingTitleStyle}>
            🏆 Ranking da turma
          </h3>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {results.map((result, index) => {
              const student = students.find(
                (item) =>
                  item.id === result.student_id
              )

              const medal =
                index === 0
                  ? '🥇'
                  : index === 1
                  ? '🥈'
                  : index === 2
                  ? '🥉'
                  : '🎓'

              return (
                <div
                  key={result.id}
                  style={{
                    ...rankingItemStyle,
                    ...(index === 0
                      ? rankingFirstStyle
                      : index === 1
                      ? rankingSecondStyle
                      : index === 2
                      ? rankingThirdStyle
                      : {}),
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      alignItems: 'center',
                    }}
                  >
                    <div style={rankingMedalStyle}>
                      {medal}
                    </div>

                    <div>
                      <div
                        style={rankingNameStyle}
                      >
                        {index + 1}º —{' '}
                        {student?.full_name ||
                          student?.name ||
                          'Aluno'}
                      </div>

                      <div
                        style={
                          rankingSubTextStyle
                        }
                      >
                        Acertos:{' '}
                        {result.correct}/
                        {result.total}
                      </div>
                    </div>
                  </div>

                  <div style={rankingScoreStyle}>
                    {Number(result.score).toFixed(
                      2
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {message && (
        <div style={messageStyle}>
          {message}
        </div>
      )}
    </>
  )
}

function Placeholder({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <>
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>{eyebrow}</div>
          <h2 style={titleStyle}>{title}</h2>
          <p style={textStyle}>{text}</p>
        </div>
      </div>

      <div style={emptyStateStyle}>
        Estrutura preparada. Próximo passo: inserir a lógica desse módulo.
      </div>
    </>
  )
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 22,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#2563eb',
  marginBottom: 8,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: '#0f172a',
}

const textStyle: React.CSSProperties = {
  margin: '10px 0 0',
  color: '#64748b',
  lineHeight: 1.6,
  fontSize: 15,
  maxWidth: 760,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: 18,
}

const optionCardStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 22,
  borderRadius: 22,
  border: '1px solid #dbeafe',
  background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
  cursor: 'pointer',
  boxShadow: '0 14px 34px rgba(37, 99, 235, 0.08)',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
}

const iconStyle: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#dbeafe',
  fontSize: 24,
  marginBottom: 16,
}

const optionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
  fontWeight: 900,
  color: '#0f172a',
}

const optionTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#64748b',
  lineHeight: 1.5,
  fontSize: 14,
}

const backButtonStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  cursor: 'pointer',
  fontWeight: 800,
}

const emptyStateStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  border: '1px dashed #cbd5e1',
  background: '#f8fafc',
  color: '#64748b',
  fontWeight: 700,
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
}

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid #cbd5e1',
  fontSize: 15,
  outline: 'none',
  background: '#ffffff',
  color: '#0f172a',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  fontSize: 15,
}

const messageStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: '#eff6ff',
  color: '#1e3a8a',
  border: '1px solid #bfdbfe',
  fontWeight: 700,
}

const statsCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 22,
  background: '#ffffff',
  border: '1px solid #dbeafe',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
}

const statsLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 10,
}

const statsValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  color: '#0f172a',
}

const rankingTitleStyle: React.CSSProperties = {
  margin: '0 0 18px',
  fontSize: 24,
  fontWeight: 900,
  color: '#0f172a',
}

const rankingItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: 18,
  borderRadius: 22,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.05)',
}

const rankingFirstStyle: React.CSSProperties = {
  background:
    'linear-gradient(135deg, #fef9c3 0%, #ffffff 100%)',
  border: '1px solid #fde68a',
}

const rankingSecondStyle: React.CSSProperties = {
  background:
    'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)',
  border: '1px solid #bae6fd',
}

const rankingThirdStyle: React.CSSProperties = {
  background:
    'linear-gradient(135deg, #ede9fe 0%, #ffffff 100%)',
  border: '1px solid #ddd6fe',
}

const rankingMedalStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  fontSize: 28,
  flexShrink: 0,
}

const rankingNameStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: '#0f172a',
}

const rankingSubTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#64748b',
  fontWeight: 700,
  fontSize: 13,
}

const rankingScoreStyle: React.CSSProperties = {
  minWidth: 86,
  textAlign: 'center',
  padding: '12px 14px',
  borderRadius: 16,
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: 18,
}

const chartCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const chartRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '90px 1fr 40px',
  gap: 12,
  alignItems: 'center',
}

const chartLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: '#475569',
}

const chartTrackStyle: React.CSSProperties = {
  height: 18,
  borderRadius: 999,
  background: '#e2e8f0',
  overflow: 'hidden',
}

const chartBarStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
}

const chartValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: '#0f172a',
  textAlign: 'right',
}

const questionChartGridStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 22,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
  display: 'flex',
  gap: 14,
  alignItems: 'flex-end',
  overflowX: 'auto',
  minHeight: 260,
}

const questionChartItemStyle: React.CSSProperties = {
  minWidth: 54,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
}

const questionChartValueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: '#0f172a',
}

const questionBarWrapStyle: React.CSSProperties = {
  height: 180,
  width: 30,
  borderRadius: 999,
  background: '#e2e8f0',
  display: 'flex',
  alignItems: 'flex-end',
  overflow: 'hidden',
}

const questionBarStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 999,
}

const questionChartLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: '#64748b',
}