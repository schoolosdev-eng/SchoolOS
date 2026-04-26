'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'
import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

async function handleExportPDF() {
  const element = document.getElementById('print-area')

  if (!element) {
    alert('A área da prova ainda não foi montada.')
    return
  }

  if (!element.innerHTML.trim()) {
    alert('A prova está vazia.')
    return
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1200')

  if (!printWindow) {
    alert('Não foi possível abrir a janela de impressão.')
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Prova</title>
        <style>
        @media print {

  #print-area {
    width: 100%;
  }
.answer-card-opencv {
  position: relative !important;
  border: 2px solid #0f172a !important;
  border-radius: 10px !important;
  padding: 42px 22px 36px !important;
  margin-top: 0 !important;
  margin-bottom: 32px !important;
  overflow: hidden !important;
}

.marker {
  position: absolute !important;
  width: 14px !important;
  height: 14px !important;
  background: #000000 !important;
}

.marker-top-left {
  top: 12px !important;
  left: 12px !important;
}

.marker-top-right {
  top: 12px !important;
  right: 12px !important;
}

.marker-bottom-left {
  bottom: 12px !important;
  left: 12px !important;
}

.marker-bottom-right {
  bottom: 12px !important;
  right: 12px !important;
}  

.answer-grid {
  display: grid !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 2px !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow: hidden !important;
  border: 1px solid #0f172a !important;
}

.answer-col {
  padding-right: 2px !important;
}

.answer-col:last-child {
  border-right: none !important;
}

.answer-cell {
  height: 34px !important;
  display: grid !important;
  grid-template-columns: 26px repeat(5, 20px) !important;
  align-items: center !important;
  gap: 2px !important;
  padding: 2px 3px !important;
  border-bottom: 1px solid #cbd5e1 !important;
  font-size: 10px !important;
}

.answer-cell:last-child {
  border-bottom: none !important;
}

.answer-option {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
  font-size: 9px !important;
}

.answer-ball {
  width: 9px !important;
  height: 9px !important;
  border-radius: 50% !important;
  border: 1.5px solid #0f172a !important;
  display: inline-block !important;
}

}
          body {
          zoom: 0.95,  
          margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: Arial, sans-serif;
          }

          * {
            box-sizing: border-box;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4;
            margin: 8mm;
          }

          .page-break {
            page-break-after: always;
          }
        </style>
      </head>
      <body>
        ${element.innerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()

  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 800)
}

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
  const [activeTab, setActiveTab] = useState<
  'menu' | 'build' | 'questions' | 'preview' | 'correct' |'results'
>('menu')
  const [title, setTitle] = useState('')
const [subjectName, setSubjectName] = useState('')
const [selectedClassId, setSelectedClassId] = useState('')
const [selectedStudentId, setSelectedStudentId] = useState('')
const [period, setPeriod] = useState('')
const [weight, setWeight] = useState('10')
const [totalQuestions, setTotalQuestions] = useState('')
const [objectiveQuestions, setObjectiveQuestions] = useState('')
const [discursiveQuestions, setDiscursiveQuestions] = useState('')
const [saving, setSaving] = useState(false)
const [localMessage, setLocalMessage] = useState('')
const [createdAssessmentId, setCreatedAssessmentId] = useState<string | null>(null)
const [currentQuestionNumber, setCurrentQuestionNumber] = useState(1)
const [questionType, setQuestionType] = useState<'objective' | 'discursive'>('objective')
const [statement, setStatement] = useState('')
const [optionA, setOptionA] = useState('')
const [optionB, setOptionB] = useState('')
const [optionC, setOptionC] = useState('')
const [optionD, setOptionD] = useState('')
const [optionE, setOptionE] = useState('')
const [correctOption, setCorrectOption] = useState('')
const [correctionMode, setCorrectionMode] = useState<'manual' | 'camera'>('manual')
const [assessmentResults, setAssessmentResults] = useState<any[]>([])
const [resultsLoading, setResultsLoading] = useState(false)
const [assessments, setAssessments] = useState<any[]>([])
const [cameraActive, setCameraActive] = useState(false)
const [selectedAssessmentId, setSelectedAssessmentId] = useState('')
const [printMode, setPrintMode] = useState<'single' | 'class'>('single')
const [selectedPrintStudentId, setSelectedPrintStudentId] = useState('')
const [printVersions, setPrintVersions] = useState<any[]>([])
const [linesCount, setLinesCount] = useState('5')
const [previewData, setPreviewData] = useState<any[]>([])
const [generatedVersions, setGeneratedVersions] = useState<any[]>([])
const [correctionVersion, setCorrectionVersion] = useState('')
const [capturedImage, setCapturedImage] = useState<string | null>(null)
const [detectedAnswers, setDetectedAnswers] = useState<Record<number, string>>({})
const [detectedStudentToken, setDetectedStudentToken] = useState('')
const qrReadRef = useRef(false)
const [studentAnswers, setStudentAnswers] = useState<Record<number, string>>({})
const [debugPoints, setDebugPoints] = useState<{ x: number; y: number; label: string }[]>([])
const [detectedStudent, setDetectedStudent] = useState<any | null>(null)
const [correctionResult, setCorrectionResult] = useState<{
  correct: number
  total: number
  score: number
} | null>(null)

const [stats, setStats] = useState<{
  average: number
  max: number
  min: number
  count: number
} | null>(null)
const [ranking, setRanking] = useState<any[]>([])

  const canAccess = isAdmin || isManager || isTeacher

  if (!canAccess) return null

  async function handleCreateAssessment() {
  if (!currentUserId) {
    setLocalMessage('Usuário não identificado.')
    return
  }

  if (
    !title.trim() ||
    !subjectName.trim() ||
    !selectedClassId ||
    !period ||
    !totalQuestions ||
    !objectiveQuestions ||
    !discursiveQuestions
  ) {
    setLocalMessage('Preencha todos os campos da avaliação.')
    return
  }

  const total = Number(totalQuestions)
  const objective = Number(objectiveQuestions)
  const discursive = Number(discursiveQuestions)

  if (objective + discursive !== total) {
    setLocalMessage('A soma de objetivas e discursivas precisa ser igual ao total de questões.')
    return
  }

  setSaving(true)
  setLocalMessage('Salvando avaliação...')

  const selectedClass = classes.find((item) => item.id === selectedClassId)

  const { data: assessment, error } = await supabase
    .from('assessments')
    .insert({
      school_id: schoolId,
      teacher_id: currentUserId,
      title: title.trim(),
      subject_name: subjectName.trim(),
      class_name: selectedClass?.name || null,
      period,
      weight: Number(weight),
      total_questions: total,
      objective_questions: objective,
      discursive_questions: discursive,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) {
    setSaving(false)
    setLocalMessage(`Erro ao salvar avaliação: ${error.message}`)
    return
  }

  const { error: classError } = await supabase
    .from('assessment_classes')
    .insert({
      assessment_id: assessment.id,
      class_id: selectedClassId,
    })

  setSaving(false)

  if (classError) {
    setLocalMessage(`Avaliação criada, mas houve erro ao vincular turma: ${classError.message}`)
    return
  }

  setLocalMessage('Avaliação criada com sucesso. Agora vamos construir as questões.')
    setActiveTab('questions')
  setCreatedAssessmentId(assessment.id)
    setCurrentQuestionNumber(1)

  setTitle('')
  setSubjectName('')
  setSelectedClassId('')
  setPeriod('')
  setWeight('10')
  setTotalQuestions('')
  setObjectiveQuestions('')
  setDiscursiveQuestions('')
}

useEffect(() => {
  if (!cameraActive) return

  let stream: MediaStream | null = null

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
      })

      const video = document.getElementById(
        'camera-video'
      ) as HTMLVideoElement | null

      if (video) {
        video.srcObject = stream
        await video.play()
      }
    } catch (err) {
      setLocalMessage('Erro ao acessar a câmera.')
    }
  }

  startCamera()

  return () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    const video = document.getElementById(
      'camera-video'
    ) as HTMLVideoElement | null

    if (video) {
      video.srcObject = null
    }
  }
}, [cameraActive])

async function handleSaveQuestion() {
  if (!createdAssessmentId) {
    setLocalMessage('Avaliação não identificada.')
    return
  }

  if (!statement.trim()) {
    setLocalMessage('Informe o enunciado da questão.')
    return
  }

  if (questionType === 'objective') {
    if (!optionA || !optionB || !optionC || !optionD || !correctOption) {
      setLocalMessage('Preencha todas as alternativas e o gabarito.')
      return
    }
  }

  const { data: question, error } = await supabase
    .from('assessment_questions')
    .insert({
      assessment_id: createdAssessmentId,
      question_number: currentQuestionNumber,
      question_type: questionType,
      statement,
      lines_count: questionType === 'discursive' ? Number(linesCount) : null,
      correct_option: questionType === 'objective' ? correctOption : null,
    })
    .select('id')
    .single()

  if (error) {
    setLocalMessage(`Erro ao salvar questão: ${error.message}`)
    return
  }

  if (questionType === 'objective') {
    const options = [
      { letter: 'A', text: optionA },
      { letter: 'B', text: optionB },
      { letter: 'C', text: optionC },
      { letter: 'D', text: optionD },
      { letter: 'E', text: optionE },
    ]

    const { error: optionsError } = await supabase
      .from('assessment_options')
      .insert(
  options
    .filter((opt) => opt.text.trim())
    .map((opt) => ({
      question_id: question.id,
      option_letter: opt.letter,
      option_text: opt.text,
      is_correct: opt.letter === correctOption,
    }))
)

    if (optionsError) {
      setLocalMessage(`Erro ao salvar alternativas: ${optionsError.message}`)
      return
    }
  }

  // resetar formulário
  setStatement('')
  setOptionA('')
  setOptionB('')
  setOptionC('')
  setOptionD('')
  setOptionE('')
  setCorrectOption('')
  setLinesCount('5')

  setCurrentQuestionNumber((prev) => prev + 1)

  setLocalMessage('Questão salva com sucesso.')
}

useEffect(() => {
  if (!cameraActive) return

  qrReadRef.current = false

  const scanner = new Html5Qrcode('qr-reader')

  scanner
    .start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: 250,
      },
async (decodedText) => {
  if (qrReadRef.current) return

  console.log('QR detectado:', decodedText)

  if (decodedText.startsWith('schoolos:student:')) {
    qrReadRef.current = true
    await handleQrScan(decodedText)
  }
},
      () => {}
    )
    .catch(() => {
      setLocalMessage('Erro ao iniciar leitura de QR Code.')
    })

return () => {
  scanner
    .stop()
    .then(() => scanner.clear())
    .catch(() => {})
}
}, [cameraActive])

useEffect(() => {
  async function loadOpenCV() {
    if ((window as any).cv) return

    const cvModule = await import('@techstark/opencv-js')
    ;(window as any).cv = cvModule.default || cvModule
  }

  loadOpenCV().catch(() => {
    setLocalMessage('Erro ao carregar OpenCV.')
  })
}, [])

async function handleFinishAssessment() {
  if (!createdAssessmentId) {
    setLocalMessage('Avaliação não identificada.')
    return
  }

  setLocalMessage('Finalizando prova...')

  const { error } = await supabase
    .from('assessments')
    .update({ status: 'ready' })
    .eq('id', createdAssessmentId)

  if (error) {
    setLocalMessage(`Erro ao finalizar: ${error.message}`)
    return
  }

  setLocalMessage('Prova finalizada com sucesso.')

  setActiveTab('preview')
}

async function handleLoadPreview() {
  if (!createdAssessmentId) return

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      id,
      statement,
      question_type,
      assessment_options:assessment_options (
                id,
            option_letter,
        option_text
        )
    `)
    .eq('assessment_id', createdAssessmentId)
    .order('question_number', { ascending: true })

  if (error) {
    setLocalMessage(error.message)
    return
  }

  setPreviewData(data || [])
}

function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5)
}

async function handleGenerateVersions() {
  if (!createdAssessmentId) {
    setLocalMessage('Avaliação não identificada para gerar versões.')
    return
  }

  setLocalMessage('Gerando versões A, B, C e D...')

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      id,
      statement,
      question_type,
      assessment_options (
        id,
        option_letter,
        option_text,
        is_correct
      )
    `)
    .eq('assessment_id', createdAssessmentId)

  if (error) {
    setLocalMessage(error.message)
    return
  }

  const versions = ['A', 'B', 'C', 'D']

  const generated = versions.map((type) => {
    const shuffledQuestions = shuffleArray(data || []).map((q: any) => {
const shuffledOptions = shuffleArray<any>(
  (q.assessment_options || []) as any[]
)

const correctOptionItem = shuffledOptions.find(
  (opt: any) => opt.is_correct
)

const newCorrect = correctOptionItem
  ? correctOptionItem.option_letter
  : null

      return {
        ...q,
        options: shuffledOptions,
        correct: newCorrect,
      }
    })

    return {
      type,
      questions: shuffledQuestions,
    }
  })

  setGeneratedVersions(generated)

  setLocalMessage('Versões A, B, C e D geradas com sucesso.')
}

async function handleCorrectManual() {
  const version = generatedVersions.find((item) => item.type === correctionVersion)

  if (!version) {
    setLocalMessage('Selecione uma versão da prova.')
    return
  }

  const objectiveQuestions = version.questions.filter(
    (q: any) => q.question_type === 'objective'
  )

  let correctCount = 0

  objectiveQuestions.forEach((question: any, index: number) => {
    const answer = studentAnswers[index + 1]

    if (answer && answer === question.correct) {
      correctCount += 1
    }
  })

  const total = objectiveQuestions.length
  const score = total > 0 ? Number(((correctCount / total) * 10).toFixed(2)) : 0

  setCorrectionResult({
    correct: correctCount,
    total,
    score,
  })
  if (!selectedStudentId) {
  setLocalMessage('Selecione um aluno.')
  return
}
await supabase.from('assessment_results').insert({
  assessment_id: createdAssessmentId,
  student_id: selectedStudentId,
  version: correctionVersion,
  correct: correctCount,
  total,
  score,
})
  

  setLocalMessage('Correção realizada com sucesso.')
}

async function handleLoadResults() {
  if (!createdAssessmentId) {
    setLocalMessage('Avaliação não identificada.')
    return
  }

  setResultsLoading(true)

  const { data, error } = await supabase
    .from('assessment_results')
    .select('*')
    .eq('assessment_id', createdAssessmentId)
    .order('created_at', { ascending: false })

  setResultsLoading(false)

  if (error) {
    setLocalMessage(`Erro ao buscar resultados: ${error.message}`)
    return
  }

  setAssessmentResults(data || [])
calculateStats(data || [])
const sorted = [...(data || [])].sort((a, b) => {
  const scoreDiff = Number(b.score) - Number(a.score)

  if (scoreDiff !== 0) return scoreDiff

  // desempate por data (quem fez primeiro ganha posição)
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
})

setRanking(sorted)
}

function calculateStats(results: any[]) {
  if (results.length === 0) {
    setStats(null)
    return
  }

  const scores = results.map((r) => Number(r.score))

  const average =
    scores.reduce((acc, val) => acc + val, 0) / scores.length

  const max = Math.max(...scores)
  const min = Math.min(...scores)

  setStats({
    average,
    max,
    min,
    count: scores.length,
  })
}

async function handleLoadAssessments() {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) {
    setLocalMessage(`Erro ao buscar avaliações: ${error.message}`)
    return
  }

  setAssessments(data || [])
}

function handleOpenAssessment(id: string) {
  setCreatedAssessmentId(id)
  setSelectedAssessmentId(id)
  setActiveTab('preview')
  setLocalMessage('Avaliação carregada.')
}

async function handleGenerateStudentExamPDF() {
  if (generatedVersions.length === 0) {
    setLocalMessage('Gere as versões A/B/C/D antes de imprimir.')
    return
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId)

  const targetStudents =
    printMode === 'single'
      ? students.filter((student) => student.id === selectedPrintStudentId)
      : students

  if (targetStudents.length === 0) {
    setLocalMessage('Selecione um aluno ou escolha imprimir a turma.')
    return
  }

  try {
    const exams = await Promise.all(
      targetStudents.map(async (student, index) => {
        if (!student.qr_code_token) {
          throw new Error(
            `O aluno ${student.full_name || student.name || 'Aluno'} está sem QR Code.`
          )
        }

        const version = generatedVersions[index % generatedVersions.length]

        const qrPayload = `schoolos:student:${student.qr_code_token}`

        const qrCodeUrl = await QRCode.toDataURL(qrPayload, {
          width: 120,
          margin: 1,
        })

        return {
          student,
          version,
          qrCodeUrl,
          className: student.class_name || selectedClass?.name || 'Turma',
        }
      })
    )

    setPrintVersions(exams)
    setLocalMessage('Prova montada com sucesso. Agora clique em Exportar PDF.')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao gerar provas.'

    setLocalMessage(message)
  }
}

async function handleOpenAssessmentForPrint(assessment: any) {
  setCreatedAssessmentId(assessment.id)
  setSelectedAssessmentId(assessment.id)
  setSubjectName(assessment.subject_name || '')
  setTitle(assessment.title || '')

  const relatedClass = classes.find(
    (item) => item.name === assessment.class_name
  )

  if (relatedClass) {
    setSelectedClassId(relatedClass.id)
  }

  setLocalMessage('Carregando prova salva...')

  const { data, error } = await supabase
    .from('assessment_questions')
    .select(`
      id,
      statement,
      question_type,
      lines_count,
      assessment_options (
        id,
        option_letter,
        option_text,
        is_correct
      )
    `)
    .eq('assessment_id', assessment.id)
    .order('question_number', { ascending: true })

  if (error) {
    setLocalMessage(`Erro ao carregar questões: ${error.message}`)
    return
  }

  setPreviewData(data || [])

  const versions = ['A', 'B', 'C', 'D']

  const generated = versions.map((type) => {
    const shuffledQuestions = shuffleArray(data || []).map((q: any) => {
const shuffledOptions = shuffleArray<any>(
  (q.assessment_options || []) as any[]
)

const correctOptionItem = shuffledOptions.find(
  (opt: any) => opt.is_correct
)

const newCorrect = correctOptionItem
  ? correctOptionItem.option_letter
  : null

      return {
        ...q,
        options: shuffledOptions,
        correct: newCorrect,
      }
    })

    return {
      type,
      questions: shuffledQuestions,
    }
  })

  setGeneratedVersions(generated)
  setPrintVersions([])
  setActiveTab('preview')
  setLocalMessage('Prova carregada. Agora você pode imprimir novamente.')
}

function analyzeImage(imageDataUrl: string) {
  const img = new Image()
  img.src = imageDataUrl

  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height

    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)

    const data = ctx?.getImageData(0, 0, canvas.width, canvas.height)

    if (!data) return

    // EXEMPLO: analisar ponto
    const x = 200
    const y = 300

    const index = (y * canvas.width + x) * 4

    const r = data.data[index]
    const g = data.data[index + 1]
    const b = data.data[index + 2]

    const brightness = (r + g + b) / 3

    if (brightness < 100) {
      console.log('Marcado')
    } else {
      console.log('Vazio')
    }
  }
}

function getBrightness(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (Math.floor(y) * width + Math.floor(x)) * 4

  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]

  return (r + g + b) / 3
}

function orderMarkerCenters(points: { x: number; y: number }[]) {
  const sortedByY = [...points].sort((a, b) => a.y - b.y)

  const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x)
  const bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x)

  return {
    topLeft: top[0],
    topRight: top[1],
    bottomLeft: bottom[0],
    bottomRight: bottom[1],
  }
}

function analyzeAnswerCard(imageDataUrl: string) {
  const img = new Image()
  img.src = imageDataUrl

  img.onload = () => {
    const cvAny = (window as any).cv

if (!cvAny) {
  setLocalMessage('OpenCV ainda não carregou. Tente novamente em alguns segundos.')
  return
}

    const originalCanvas = document.createElement('canvas')
    originalCanvas.width = img.width
    originalCanvas.height = img.height

    const originalCtx = originalCanvas.getContext('2d')
    if (!originalCtx) return

    originalCtx.drawImage(img, 0, 0)

    const src = cvAny.imread(originalCanvas)
    const gray = new cvAny.Mat()
    const binary = new cvAny.Mat()
    const contours = new cvAny.MatVector()
    const hierarchy = new cvAny.Mat()

    try {
      cvAny.cvtColor(src, gray, cvAny.COLOR_RGBA2GRAY)

      cvAny.threshold(
        gray,
        binary,
        80,
        255,
        cvAny.THRESH_BINARY_INV
      )

      cvAny.findContours(
        binary,
        contours,
        hierarchy,
        cvAny.RETR_EXTERNAL,
        cvAny.CHAIN_APPROX_SIMPLE
      )

      const markerCenters: { x: number; y: number }[] = []

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const rect = cvAny.boundingRect(contour)

        const area = rect.width * rect.height
        const ratio = rect.width / rect.height

        const minArea = originalCanvas.width * originalCanvas.height * 0.00008
        const maxArea = originalCanvas.width * originalCanvas.height * 0.004

        const isSquare =
          ratio > 0.65 &&
          ratio < 1.45 &&
          area > minArea &&
          area < maxArea

        if (isSquare) {
          markerCenters.push({
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          })
        }

        contour.delete()
      }

      if (markerCenters.length < 4) {
        setLocalMessage(
          `Não encontrei os 4 marcadores do cartão. Detectados: ${markerCenters.length}. Aproxime e alinhe melhor.`
        )
        return
      }

      const selectedMarkers = markerCenters
        .sort((a, b) => a.y - b.y)
        .slice(0, 20)

      const corners = orderMarkerCenters(selectedMarkers.slice(0, 4))

      const CARD_WIDTH = 1000
      const CARD_HEIGHT = 330

      const srcTri = cvAny.matFromArray(4, 1, cvAny.CV_32FC2, [
        corners.topLeft.x,
        corners.topLeft.y,
        corners.topRight.x,
        corners.topRight.y,
        corners.bottomRight.x,
        corners.bottomRight.y,
        corners.bottomLeft.x,
        corners.bottomLeft.y,
      ])

      const dstTri = cvAny.matFromArray(4, 1, cvAny.CV_32FC2, [
        0,
        0,
        CARD_WIDTH,
        0,
        CARD_WIDTH,
        CARD_HEIGHT,
        0,
        CARD_HEIGHT,
      ])

      const transform = cvAny.getPerspectiveTransform(srcTri, dstTri)
      const warped = new cvAny.Mat()

      cvAny.warpPerspective(
        src,
        warped,
        transform,
        new cvAny.Size(CARD_WIDTH, CARD_HEIGHT)
      )

      const warpedCanvas = document.createElement('canvas')
      cvAny.imshow(warpedCanvas, warped)

      const warpedImageUrl = warpedCanvas.toDataURL('image/png')
      setCapturedImage(warpedImageUrl)

      const warpedGray = new cvAny.Mat()
      cvAny.cvtColor(warped, warpedGray, cvAny.COLOR_RGBA2GRAY)

      const image = new ImageData(
        new Uint8ClampedArray(warpedGray.data),
        CARD_WIDTH,
        CARD_HEIGHT
      )

      const totalQuestions =
        generatedVersions[0]?.questions?.filter(
          (q: any) => q.question_type === 'objective'
        ).length || 10

      const answers: Record<number, string> = {}
      const points: { x: number; y: number; label: string }[] = []

      const letters = ['A', 'B', 'C', 'D', 'E']

      const columns = 4
      const rows = Math.ceil(totalQuestions / columns)

      const gridStartX = 38
      const gridStartY = 126
      const colGap = 235
      const rowGap = 46
      const optionStartOffset = 54
      const optionGap = 34

      for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
          const questionNumber = col * rows + row + 1

          if (questionNumber > totalQuestions) continue

          const baseX = gridStartX + col * colGap
          const baseY = gridStartY + row * rowGap

          let darkestLetter = ''
          let darkestValue = 255

          letters.forEach((letter, optionIndex) => {
            const x = baseX + optionStartOffset + optionIndex * optionGap
            const y = baseY

            points.push({
              x: (x / CARD_WIDTH) * 1000,
              y: (y / CARD_HEIGHT) * 1000,
              label: `${questionNumber}${letter}`,
            })

            const brightness = getBrightness(
              image.data,
              CARD_WIDTH,
              x,
              y
            )

            if (brightness < darkestValue) {
              darkestValue = brightness
              darkestLetter = letter
            }
          })

          if (darkestValue < 145) {
            answers[questionNumber] = darkestLetter
          }
        }
      }

      setDetectedAnswers(answers)
      setDebugPoints(points)
      setStudentAnswers(answers)

      setLocalMessage('Cartão lido com OpenCV. Confira as respostas detectadas.')
    } catch (error) {
      console.error(error)
      setLocalMessage('Erro ao processar cartão com OpenCV.')
    } finally {
      src.delete()
      gray.delete()
      binary.delete()
      contours.delete()
      hierarchy.delete()
    }
  }
}

function handleCaptureAnswerCard() {
  if (!detectedStudent) {
    setLocalMessage('Leia primeiro o QR Code do aluno.')
    return
  }

  const video = document.querySelector('#qr-reader video') as HTMLVideoElement

  if (!video) {
    setLocalMessage('Câmera não encontrada.')
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  const image = canvas.toDataURL('image/png')

  setCapturedImage(image)
  analyzeAnswerCard(image)
}

async function handleQrScan(decodedText: string) {
  const token = decodedText.replace('schoolos:student:', '').trim()

  setDetectedStudentToken(token)
  setLocalMessage('QR Code lido. Buscando aluno...')

  const studentFromList = students.find(
    (student) => student.qr_code_token === token
  )

  if (!studentFromList) {
    setLocalMessage('QR lido, mas aluno não encontrado na lista carregada.')
    return
  }

  setDetectedStudent(studentFromList)
  setSelectedStudentId(studentFromList.id)

  setLocalMessage(
    `Aluno identificado: ${
      studentFromList.full_name || studentFromList.name || 'Aluno sem nome'
    }`
  )
}

  return (
  <section style={cardStyle}>
    {activeTab === 'menu' && (
      <>
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>Avaliações</div>
            <h2 style={titleStyle}>Área de provas e correções</h2>
            <p style={textStyle}>
              Crie provas, gere versões por aluno, corrija gabaritos e acompanhe
              os resultados das turmas.
            </p>
          </div>
        </div>

        <div style={gridStyle}>
          <button
            style={optionCardStyle}
            onClick={() => setActiveTab('build')}
          >
            <div style={iconStyle}>📝</div>
            <h3 style={optionTitleStyle}>Construir prova</h3>
            <p style={optionTextStyle}>
              Monte avaliações por disciplina e turma.
            </p>
          </button>

          <button
  onClick={() => {
    setActiveTab('preview')
    handleLoadAssessments()
  }}
  style={{
    ...primaryButtonStyle,
    marginTop: 12,
    marginLeft: 12,
    background: '#0f172a',
  }}
>
  Buscar provas salvas
</button>

          <button
            style={optionCardStyle}
            onClick={() => setActiveTab('correct')}
          >
            <div style={iconStyle}>✅</div>
            <h3 style={optionTitleStyle}>Corrigir prova</h3>
            <p style={optionTextStyle}>
              Corrija provas e gere notas.
            </p>
          </button>
          <button
  onClick={() => {
    setActiveTab('results')
    handleLoadResults()
  }}
  style={{
    ...primaryButtonStyle,
    marginTop: 12,
    marginLeft: 12,
    background: '#0ea5e9',
  }}
>
  Ver resultados
</button>

        </div>
      </>
    )}

    {activeTab === 'build' && (
  <>
    <button
      onClick={() => setActiveTab('menu')}
      style={backButtonStyle}
    >
      ← Voltar
    </button>

    <div style={headerStyle}>
      <div>
        <div style={eyebrowStyle}>Construir prova</div>
        <h2 style={titleStyle}>Dados iniciais da avaliação</h2>
        <p style={textStyle}>
          Informe a disciplina, turma, período e estrutura da prova.
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
        placeholder="Total de questões"
        value={totalQuestions}
        onChange={(e) => setTotalQuestions(e.target.value)}
        style={inputStyle}
      />

      <input
        type="number"
        placeholder="Questões objetivas"
        value={objectiveQuestions}
        onChange={(e) => setObjectiveQuestions(e.target.value)}
        style={inputStyle}
      />

      <input
        type="number"
        placeholder="Questões discursivas"
        value={discursiveQuestions}
        onChange={(e) => setDiscursiveQuestions(e.target.value)}
        style={inputStyle}
      />
    </div>

    <div style={{ marginTop: 18 }}>
      <button
        onClick={handleCreateAssessment}
        disabled={saving}
        style={primaryButtonStyle}
      >
        {saving ? 'Salvando...' : 'Criar avaliação'}
      </button>
    </div>

    {localMessage && (
      <div style={messageStyle}>
        {localMessage}
      </div>
    )}
  </>
)}
{activeTab === 'questions' && (
  <>
    <button onClick={() => setActiveTab('build')} style={backButtonStyle}>
      ← Voltar
    </button>

    <div style={headerStyle}>
      <div>
        <div style={eyebrowStyle}>Construção da prova</div>
        <h2 style={titleStyle}>
          Questão {String(currentQuestionNumber).padStart(2, '0')}
        </h2>
      </div>
    </div>

    {/* Tipo */}
    <select
      value={questionType}
      onChange={(e) => setQuestionType(e.target.value as any)}
      style={inputStyle}
    >
      <option value="objective">Objetiva</option>
      <option value="discursive">Discursiva</option>
    </select>

    {/* Enunciado */}
    <textarea
      placeholder="Enunciado da questão"
      value={statement}
      onChange={(e) => setStatement(e.target.value)}
      style={{ ...inputStyle, minHeight: 120 }}
    />

    {/* Objetiva */}
    {questionType === 'objective' && (
      <>
        <input placeholder="Alternativa A" value={optionA} onChange={(e) => setOptionA(e.target.value)} style={inputStyle} />
        <input placeholder="Alternativa B" value={optionB} onChange={(e) => setOptionB(e.target.value)} style={inputStyle} />
        <input placeholder="Alternativa C" value={optionC} onChange={(e) => setOptionC(e.target.value)} style={inputStyle} />
        <input placeholder="Alternativa D" value={optionD} onChange={(e) => setOptionD(e.target.value)} style={inputStyle} />
        <input placeholder="Alternativa E (opcional)" value={optionE} onChange={(e) => setOptionE(e.target.value)} style={inputStyle} />

        <select
          value={correctOption}
          onChange={(e) => setCorrectOption(e.target.value)}
          style={inputStyle}
        >
          <option value="">Gabarito</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
          <option value="E">E</option>
        </select>
      </>
    )}

    {/* Discursiva */}
    {questionType === 'discursive' && (
      <input
        type="number"
        placeholder="Quantidade de linhas"
        value={linesCount}
        onChange={(e) => setLinesCount(e.target.value)}
        style={inputStyle}
      />
    )}

    <div style={{ marginTop: 16 }}>
      <button onClick={handleSaveQuestion} style={primaryButtonStyle}>
        Salvar questão e próxima →
      </button>
      <button
  onClick={handleFinishAssessment}
  style={{
    ...primaryButtonStyle,
    marginTop: 12,
    background: '#16a34a',
  }}
>
  Finalizar prova
</button>
    </div>

    {localMessage && <div style={messageStyle}>{localMessage}</div>}
  </>
)}
{activeTab === 'preview' && (
  <>
    <button onClick={() => setActiveTab('questions')} style={backButtonStyle}>
      ← Voltar
    </button>

    <div style={headerStyle}>
      <div>
        <div style={eyebrowStyle}>Pré-visualização</div>
        <h2 style={titleStyle}>Estrutura da prova</h2>
        <div style={{ marginBottom: 18 }}>
  <button
    onClick={handleLoadAssessments}
    style={{
      ...primaryButtonStyle,
      background: '#0f172a',
    }}
  >
    Atualizar provas salvas
  </button>
</div>

{assessments.length > 0 && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
    {assessments.map((assessment) => (
      <div key={assessment.id} style={messageStyle}>
        <strong>{assessment.title}</strong>
        <br />
        {assessment.subject_name} — {assessment.class_name || 'Turma não informada'}

        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => handleOpenAssessmentForPrint(assessment)}
            style={primaryButtonStyle}
          >
            Abrir para imprimir
          </button>
        </div>
      </div>
    ))}
  </div>
)}
        <p style={textStyle}>
          Aqui será exibido o modelo da prova antes da geração final.
        </p>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
  <button
    onClick={handleLoadPreview}
    style={primaryButtonStyle}
  >
    Carregar prova
  </button>

  <button
    onClick={handleGenerateVersions}
    style={{
      ...primaryButtonStyle,
      background: '#7c3aed',
    }}
  >
    Gerar versões (A/B/C/D)
  </button>
  <button
  onClick={handleExportPDF}
  style={{
    ...primaryButtonStyle,
    marginTop: 12,
    background: '#0ea5e9',
  }}
>
  Exportar PDF
</button>
{generatedVersions.length > 0 && (
  <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    <select
      value={printMode}
      onChange={(e) => setPrintMode(e.target.value as 'single' | 'class')}
      style={inputStyle}
    >
      <option value="single">Imprimir prova de um aluno</option>
      <option value="class">Imprimir provas da turma</option>
    </select>

    {printMode === 'single' && (
      <select
        value={selectedPrintStudentId}
        onChange={(e) => setSelectedPrintStudentId(e.target.value)}
        style={inputStyle}
      >
        <option value="">Selecione o aluno</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.full_name || student.name || 'Aluno sem nome'}
          </option>
        ))}
      </select>
    )}

    <button
      onClick={handleGenerateStudentExamPDF}
      style={{
        ...primaryButtonStyle,
        background: '#0f172a',
      }}
    >
      Gerar prova individualizada
    </button>
  </div>
)}
</div>

{localMessage && (
  <div style={messageStyle}>
    {localMessage}
  </div>
)}

    {previewData.length > 0 && (
      <div style={{ marginTop: 20 }}>
        {previewData.map((q, index) => (
          <div
            key={q.id}
            style={{
              border: '1px solid #e2e8f0',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <strong>Questão {index + 1}</strong>

            <p style={{ marginTop: 8 }}>{q.statement}</p>

            {q.assessment_options?.map((opt: any) => (
              <div key={opt.id}>
                {opt.option_letter}) {opt.option_text}
              </div>
            ))}
          </div>
        ))}
      </div>
    )}
    {printVersions.length > 0 && (
  <div id="print-area" style={{ marginTop: 30 }}>
    {printVersions.map((exam) => (
      <div
        key={`${exam.student.id}-${exam.version.type}`}
        style={{
          pageBreakAfter: 'always',
          padding: 24,
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
        }}
      >
        <div style={{ border: '2px solid #111827', borderRadius: 10, padding: 12, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18 }}>{schoolName}</h1>
            <p><strong>Disciplina:</strong> {subjectName || 'Disciplina'}</p>
            <p><strong>Aluno:</strong> {exam.student.full_name || exam.student.name || 'Aluno'}</p>
            <p><strong>Turma:</strong> {exam.className}</p>
            <p><strong>Tipo de prova:</strong> {exam.version.type}</p>
          </div>

          <div style={{ textAlign: 'center' }}>
            <img src={exam.qrCodeUrl} alt="QR Code" style={{ width: 100 }} />
            <div style={{ fontSize: 10 }}>QR do aluno</div>
          </div>
        </div>

<div style={{ marginTop: 16, marginBottom: 26 }}>
<div className="answer-card-opencv">
  <div className="marker marker-top-left" />
  <div className="marker marker-top-right" />
  <div className="marker marker-bottom-left" />
  <div className="marker marker-bottom-right" />

<h3
  style={{
    margin: '0 0 18px',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 900,
  }}
>
  Cartão-resposta
</h3>

  <div className="answer-grid">
    {(() => {
      const total = exam.version.questions.filter(
        (q: any) => q.question_type === 'objective'
      ).length

      const columns = 4
      const rows = Math.ceil(total / columns)

      return Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="answer-col">
          {Array.from({ length: rows }).map((_, row) => {
            const questionIndex = col * rows + row

            if (questionIndex >= total) {
              return (
                <div
                  key={`empty-${col}-${row}`}
                  className="answer-cell"
                />
              )
            }

            return (
              <div key={questionIndex} className="answer-cell">
                <strong style={{ fontSize: 11 }}>
                  {String(questionIndex + 1).padStart(2, '0')}
                </strong>

                {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                  <span key={letter} className="answer-option">
                    <span className="answer-ball" />
                    {letter}
                  </span>
                ))}
              </div>
            )
          })}
        </div>
      ))
    })()}
  </div>
</div>
    </div>

  <div
  style={{
    marginTop: 34,
    columnCount: 2,
    columnGap: 34,
    columnRule: '1px solid #cbd5e1',
    fontSize: 11,
    lineHeight: 1.35,
  }}
>
          {exam.version.questions.map((q: any, index: number) => (
            <div key={q.id} style={{ breakInside: 'avoid', marginBottom: 14 }}>
              <strong>Questão {index + 1}</strong>
              <p>{q.statement}</p>

              {q.question_type === 'objective' &&
                q.options?.map((opt: any) => (
<p
  key={opt.id}
  style={{
    margin: '4px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }}
>
  <span
    style={{
      width: 10,
      height: 10,
      borderRadius: '50%',
      border: '1.5px solid #0f172a',
      display: 'inline-block',
      flexShrink: 0,
    }}
  />
  <span>
    {opt.option_letter}) {opt.option_text}
  </span>
</p>
                ))}

              {q.question_type === 'discursive' &&
                Array.from({ length: q.lines_count || 5 }).map((_, i) => (
                  <div key={i} style={{ borderBottom: '1px solid #111827', height: 18 }} />
                ))}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)}
{generatedVersions.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h2>Gabarito</h2>

    {generatedVersions.map((version) => (
      <div key={version.type} style={{ marginBottom: 12 }}>
        <strong>Versão {version.type}:</strong>{' '}
        {version.questions.map((q: any) => q.correct).join(' - ')}
      </div>
    ))}
  </div>
)}
  </>
)}

{activeTab === 'results' && (
  <>
    <button
      onClick={() => setActiveTab('correct')}
      style={backButtonStyle}
    >
      ← Voltar
    </button>

    <div style={headerStyle}>
      <div>
        <div style={eyebrowStyle}>Resultados</div>
        <h2 style={titleStyle}>Notas da avaliação</h2>
        <p style={textStyle}>
          Consulte os resultados salvos para esta prova.
        </p>
      </div>
    </div>

    <button
      onClick={handleLoadResults}
      style={primaryButtonStyle}
      disabled={resultsLoading}
    >
      {resultsLoading ? 'Carregando...' : 'Atualizar resultados'}
    </button>
    <button onClick={handleLoadAssessments} style={primaryButtonStyle}>
  Carregar avaliações salvas
</button>
{assessments.map((assessment) => (
  <div key={assessment.id} style={messageStyle}>
    <strong>{assessment.title}</strong>
    <br />
    {assessment.subject_name} — {assessment.class_name}

    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => handleOpenAssessment(assessment.id)}
        style={primaryButtonStyle}
      >
        Abrir avaliação
      </button>
    </div>
  </div>
))}

    <div style={{ marginTop: 18 }}>
      {assessmentResults.length === 0 ? (
        <div style={messageStyle}>
          Nenhum resultado encontrado para esta avaliação.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
            {stats && (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 12,
      marginTop: 20,
      marginBottom: 20,
    }}
  >
    <div style={statCardStyle}>
      Média da turma
      <strong>{stats.average.toFixed(2)}</strong>
    </div>

    <div style={statCardStyle}>
      Maior nota
      <strong>{stats.max.toFixed(2)}</strong>
    </div>

    <div style={statCardStyle}>
      Menor nota
      <strong>{stats.min.toFixed(2)}</strong>
    </div>

    <div style={statCardStyle}>
      Alunos avaliados
      <strong>{stats.count}</strong>
    </div>
  </div>
)}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: '#ffffff',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr style={{ background: '#eff6ff' }}>
                <th style={tableHeaderStyle}>Aluno</th>
                <th style={tableHeaderStyle}>Versão</th>
                <th style={tableHeaderStyle}>Acertos</th>
                <th style={tableHeaderStyle}>Total</th>
                <th style={tableHeaderStyle}>Nota</th>
                <th style={tableHeaderStyle}>Data</th>
              </tr>
            </thead>

            <tbody>
              {assessmentResults.map((result) => {
                const student = students.find(
                  (item) => item.id === result.student_id
                )

                return (
                  <tr key={result.id}>
                    <td style={tableCellStyle}>
                      {student?.full_name || student?.name || 'Aluno não encontrado'}
                    </td>
                    <td style={tableCellStyle}>{result.version}</td>
                    <td style={tableCellStyle}>{result.correct}</td>
                    <td style={tableCellStyle}>{result.total}</td>
                    <td style={tableCellStyle}>
                      {Number(result.score).toFixed(2)}
                    </td>
                    <td style={tableCellStyle}>
                      {result.created_at
                        ? new Date(result.created_at).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {ranking.length > 0 && (
  <div style={{ marginTop: 30 }}>
    <h3 style={rankingTitleStyle}>🏆 Ranking da turma</h3>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ranking.map((item, index) => {
        const student = students.find((s) => s.id === item.student_id)

        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🎓'

        return (
          <div
            key={item.id || index}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={rankingMedalStyle}>{medal}</div>

              <div>
                <strong style={rankingNameStyle}>
                  {index + 1}º —{' '}
                  {student?.full_name || student?.name || 'Aluno não encontrado'}
                </strong>

                <div style={rankingSubTextStyle}>
                  Acertos: {item.correct}/{item.total} • Versão {item.version}
                </div>
              </div>
            </div>

            <div style={rankingScoreStyle}>
              {Number(item.score).toFixed(2)}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
        </div>
      )}
    </div>
  </>
)}

        {activeTab === 'correct' && (
  <>
    <button
      onClick={() => setActiveTab('menu')}
      style={backButtonStyle}
    >
      ← Voltar
    </button>

    <div style={headerStyle}>
      <div>
        <div style={eyebrowStyle}>Correção de prova</div>
        <h2 style={titleStyle}>Correção manual por gabarito</h2>
        <p style={textStyle}>
          Selecione a versão da prova e marque as respostas do aluno.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
  <button
    onClick={() => setCorrectionMode('manual')}
    style={{
      ...primaryButtonStyle,
      background: correctionMode === 'manual' ? '#2563eb' : '#64748b',
    }}
  >
    Correção manual
  </button>

  <button
    onClick={() => setCorrectionMode('camera')}
    style={{
      ...primaryButtonStyle,
      background: correctionMode === 'camera' ? '#0f172a' : '#64748b',
    }}
  >
    Correção por câmera
  </button>
{capturedImage && (
  <img
    src={capturedImage}
    style={{ width: '100%', marginTop: 16 }}
  />
)}
</div>
      </div>
    </div>
    
{correctionMode === 'manual' && (
  <>
    {generatedVersions.length === 0 ? (
      <div style={messageStyle}>
        Primeiro gere as versões A/B/C/D na área de pré-visualização.
      </div>
    ) : (
      <>
        <select
          value={selectedStudentId}
          onChange={(e) => setSelectedStudentId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Selecione o aluno</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.full_name || student.name || 'Aluno sem nome'}
            </option>
          ))}
        </select>

        <select
          value={correctionVersion}
          onChange={(e) => {
            setCorrectionVersion(e.target.value)
            setStudentAnswers({})
            setCorrectionResult(null)
          }}
          style={inputStyle}
        >
          <option value="">Selecione a versão da prova</option>
          {generatedVersions.map((version) => (
            <option key={version.type} value={version.type}>
              Versão {version.type}
            </option>
          ))}
        </select>

        {correctionVersion && (
          <div style={{ marginTop: 18 }}>
            {generatedVersions
              .find((item) => item.type === correctionVersion)
              ?.questions.filter((q: any) => q.question_type === 'objective')
              .map((q: any, index: number) => (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                  }}
                >
                  <strong>Questão {index + 1}</strong>

                  <select
                    value={studentAnswers[index + 1] || ''}
                    onChange={(e) =>
                      setStudentAnswers((prev) => ({
                        ...prev,
                        [index + 1]: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Resposta</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                  </select>
                </div>
              ))}
          </div>
        )}

        <button
          onClick={handleCorrectManual}
          style={{
            ...primaryButtonStyle,
            marginTop: 12,
            background: '#16a34a',
          }}
        >
          Corrigir prova
        </button>

        {correctionResult && (
          <div style={messageStyle}>
            Acertos: {correctionResult.correct}/{correctionResult.total} — Nota:{' '}
            {correctionResult.score.toFixed(2)}
          </div>
        )}

        {localMessage && <div style={messageStyle}>{localMessage}</div>}
      </>
    )}
  </>
)}

{correctionMode === 'camera' && (
  <div style={{ marginTop: 24 }}>
    <div style={messageStyle}>
      Aponte a câmera para o cartão-resposta. O cartão precisa estar bem alinhado
      e visível dentro da área da câmera.
    </div>
    {localMessage && (
  <div style={messageStyle}>
    {localMessage}
  </div>
)}

    <button
      onClick={() => setCameraActive(true)}
      style={{
        ...primaryButtonStyle,
        marginTop: 16,
        background: '#16a34a',
      }}
    >
      Iniciar leitura da prova
    </button>

    {detectedStudent && (
  <div
    style={{
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      background: '#dcfce7',
      border: '1px solid #86efac',
      color: '#166534',
      fontWeight: 800,
    }}
  >
    Aluno identificado:{' '}
    {detectedStudent.full_name || detectedStudent.name || 'Aluno sem nome'}
  </div>
)}

    {cameraActive && (
      <div style={{ marginTop: 20 }}>
        <div
          id="qr-reader"
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: 18,
            overflow: 'hidden',
            border: '2px solid #0f172a',
          }}
        />

        <button
          onClick={handleCaptureAnswerCard}
          style={{
            ...primaryButtonStyle,
            marginTop: 16,
            background: '#0f172a',
          }}
        >
          Capturar e ler cartão
        </button>
      </div>
    )}

    {capturedImage && (
      <div style={{ marginTop: 20 }}>
        <h3 style={titleStyle}>Imagem capturada</h3>

<div
  style={{
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    marginTop: 12,
  }}
>
  <img
    src={capturedImage}
    alt="Cartão capturado"
    style={{
      width: '100%',
      borderRadius: 16,
      border: '1px solid #cbd5e1',
      display: 'block',
    }}
  />

  {debugPoints.map((point, index) => (
    <div
      key={index}
      title={point.label}
      style={{
        position: 'absolute',
        left: `${point.x / 10}%`,
        top: `${point.y / 10}%`,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'red',
        transform: 'translate(-50%, -50%)',
      }}
    />
  ))}
</div>
      </div>
    )}

    {Object.keys(detectedAnswers).length > 0 && (
      <div style={messageStyle}>
        <strong>Respostas detectadas:</strong>
        <br />
        {Object.entries(detectedAnswers)
          .map(([question, answer]) => `${question}: ${answer}`)
          .join(' | ')}
      </div>
    )}

    {Object.keys(detectedAnswers).length > 0 && (
      <button
        onClick={handleCorrectManual}
        style={{
          ...primaryButtonStyle,
          marginTop: 16,
          background: '#16a34a',
        }}
      >
        Corrigir automaticamente
      </button>
    )}
  </div>
)}
  </>
)}
        </section>
            )   
            }

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)',
  border: '1px solid #e2e8f0',
  borderRadius: 24,
  padding: 24,
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 20,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#2563eb',
  marginBottom: 6,
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: '#0f172a',
}

const textStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#475569',
  lineHeight: 1.6,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
}

const optionCardStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 20,
  borderRadius: 20,
  border: '1px solid #dbeafe',
  background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
  cursor: 'pointer',
  boxShadow: '0 12px 30px rgba(37, 99, 235, 0.08)',
}

const iconStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#dbeafe',
  fontSize: 22,
  marginBottom: 14,
}

const optionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: '#0f172a',
}

const optionTextStyle: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#475569',
  lineHeight: 1.5,
}

const backButtonStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  cursor: 'pointer',
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

const tableHeaderStyle: React.CSSProperties = {
  padding: 12,
  textAlign: 'left',
  fontSize: 13,
  color: '#1e3a8a',
  borderBottom: '1px solid #bfdbfe',
}

const tableCellStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
  color: '#0f172a',
  borderBottom: '1px solid #e2e8f0',
}

const statCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontWeight: 600,
  color: '#1e3a8a',
}

const rankingTitleStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontSize: 20,
  fontWeight: 900,
  color: '#0f172a',
}

const rankingItemStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: 16,
  borderRadius: 18,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
}

const rankingFirstStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #fef9c3 0%, #ffffff 100%)',
  border: '1px solid #fde68a',
}

const rankingSecondStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)',
  border: '1px solid #bae6fd',
}

const rankingThirdStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ede9fe 0%, #ffffff 100%)',
  border: '1px solid #ddd6fe',
}

const rankingMedalStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f8fafc',
  fontSize: 24,
  flexShrink: 0,
}

const rankingNameStyle: React.CSSProperties = {
  fontSize: 15,
  color: '#0f172a',
}

const rankingSubTextStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: '#64748b',
  fontWeight: 600,
}

const rankingScoreStyle: React.CSSProperties = {
  minWidth: 72,
  textAlign: 'center',
  padding: '10px 12px',
  borderRadius: 14,
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: 16,
}