'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  isActive: boolean
  onNoCamera?: () => void
  onFaceCapture: (imageBlob: Blob) => void
}

export default function FacialScanner({
  isActive,
  onNoCamera,
  onFaceCapture,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const faceDetectionRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const lastCaptureRef = useRef<number>(0)

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  const captureInProgressRef = useRef(false)

  function loadScript(src: string) {
    return new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Erro ao carregar ${src}`))

      document.body.appendChild(script)
    })
  }

  async function startCamera() {
  try {
    console.log('[FACIAL] iniciando câmera...')

    if (!videoRef.current) {
      console.log('[FACIAL] videoRef não encontrado')
      return
    }

    console.log('[FACIAL] carregando scripts MediaPipe...')

    await loadScript(
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js'
    )

    await loadScript(
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
    )

    console.log('[FACIAL] scripts carregados')

    const FaceDetectionClass = (window as any).FaceDetection
    const CameraClass = (window as any).Camera

    console.log(
      '[FACIAL] classes:',
      !!FaceDetectionClass,
      !!CameraClass
    )

    if (!FaceDetectionClass || !CameraClass) {
      throw new Error('MediaPipe não carregado.')
    }

    const faceDetection = new FaceDetectionClass({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    })

    console.log('[FACIAL] FaceDetection criado')

    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.75,
    })

    console.log('[FACIAL] opções configuradas')

    faceDetection.onResults((results: any) => {
      console.log('[FACIAL] onResults chamado')

      if (captureInProgressRef.current) {
        console.log('[FACIAL] bloqueado: captureInProgress')
        return
      }

      const detections = results.detections || []

      console.log(
        '[FACIAL] rostos detectados:',
        detections.length
      )

      if (detections.length === 0) {
        console.log('[FACIAL] nenhum rosto detectado')
        return
      }

      const detection = detections[0]

const score =
  detection.score?.[0] ??
  detection.score ??
  detection.detectionConfidence ??
  null

console.log('[FACIAL] detection completo:', detection)
console.log('[FACIAL] score:', score)

if (typeof score === 'number' && score > 0 && score < 0.60) {
  console.log('[FACIAL] bloqueado por score baixo:', score)
  return
}

      const now = Date.now()

      const elapsed = now - lastCaptureRef.current

      console.log('[FACIAL] tempo desde última captura:', elapsed)

      if (elapsed < 1000) {
        console.log('[FACIAL] bloqueado por cooldown')
        return
      }

      console.log('[FACIAL] capturando frame...')

      lastCaptureRef.current = now

      captureFrame()
    })

    faceDetectionRef.current = faceDetection

    console.log('[FACIAL] criando câmera...')

    const camera = new CameraClass(videoRef.current, {
      onFrame: async () => {
        try {
          if (!videoRef.current) {
            console.log('[FACIAL] onFrame sem videoRef')
            return
          }

          console.log('[FACIAL] enviando frame para MediaPipe')

          await faceDetection.send({
            image: videoRef.current,
          })

          console.log('[FACIAL] frame processado')
        } catch (error) {
          console.error(
            '[FACIAL] erro no onFrame:',
            error
          )
        }
      },
      width: 1280,
        height: 720,
      facingMode,
    })

    cameraRef.current = camera

    console.log('[FACIAL] iniciando câmera física...')

    await camera.start()

    console.log('[FACIAL] câmera iniciada com sucesso')
  } catch (error) {
    console.error(
      '[FACIAL] erro ao acessar câmera facial:',
      error
    )

    onNoCamera?.()
  }
}

  function handleSwitchCamera() {
  setFacingMode((prev) =>
    prev === 'user' ? 'environment' : 'user'
  )
}

  function stopCamera() {
  if (cameraRef.current) {
    cameraRef.current.stop()
    cameraRef.current = null
  }

  faceDetectionRef.current = null
}

  function captureFrame() {
  if (!videoRef.current) return
  if (captureInProgressRef.current) return

  const video = videoRef.current
  if (!video.videoWidth || !video.videoHeight) return

  captureInProgressRef.current = true

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    captureInProgressRef.current = false
    return
  }

  ctx.drawImage(video, 0, 0)

  canvas.toBlob((blob) => {
    if (!blob) {
      captureInProgressRef.current = false
      return
    }

    onFaceCapture(blob)

    setTimeout(() => {
      captureInProgressRef.current = false
    }, 2000)
  }, 'image/jpeg', 0.92)
}

  useEffect(() => {
  if (!isActive) {
    stopCamera()
    return
  }

  startCamera()

  return () => {
    stopCamera()
  }
}, [isActive, facingMode])

  if (!isActive) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
  type="button"
  onClick={handleSwitchCamera}
  style={{
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    fontWeight: 800,
    cursor: 'pointer',
  }}
>
  Alternar câmera
</button>
      <div
        style={{
          width: '100%',
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          background: '#0f172a',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            display: 'block',
          }}
        />
      </div>

      <div
        style={{
          fontSize: 13,
          color: '#64748b',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        Câmera facial ativa. Capturas serão armazenadas apenas quando houver rosto detectado.
      </div>
    </div>
  )
}