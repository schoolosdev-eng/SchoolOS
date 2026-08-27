'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  isActive: boolean
  cameraMode: 'user' | 'environment'
  onCameraModeChange: (mode: 'user' | 'environment') => void
  onNoCamera?: () => void
  onFaceCapture: (imageBlob: Blob) => Promise<boolean>
  onCancel?: () => void
}

export default function FacialScanner({
  isActive,
  cameraMode,
  onCameraModeChange,
  onNoCamera,
  onFaceCapture,
  onCancel,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [faceCaptured, setFaceCaptured] = useState(false)
  const faceDetectionRef = useRef<any>(null)
  const cameraRef = useRef<any>(null)
  const lastCaptureRef = useRef<number>(0)
  const startedRef = useRef(false)

  const [faceMessage, setFaceMessage] = useState<string | null>(null)

  const isSlowDevice =
  typeof navigator !== 'undefined' &&
  navigator.hardwareConcurrency &&
  navigator.hardwareConcurrency <= 4

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
      minDetectionConfidence: 0.55,
    })

    console.log('[FACIAL] opções configuradas')

    faceDetection.onResults((results: any) => {

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

if (typeof score === 'number' && score > 0 && score < 0.45) {
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

const videoElement = videoRef.current

if (!videoElement) {
  throw new Error('Elemento de vídeo não encontrado ao criar câmera.')
}

const camera = new CameraClass(videoElement, {
  onFrame: async () => {
    try {
      if (
        !isActive ||
        !videoRef.current ||
        !faceDetectionRef.current
      ) {
        return
      }

      await faceDetection.send({
        image: videoElement,
      })
    } catch (error) {
      console.error(
        '[FACIAL] erro no onFrame:',
        error
      )
    }
  },

  width: 640,
  height: 480,

  facingMode: {
    ideal: cameraMode,
  },
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

  async function handleSwitchCamera() {
  stopCamera()

  await new Promise((resolve) => setTimeout(resolve, 800))

  onCameraModeChange(cameraMode === 'user' ? 'environment' : 'user')
}

  function stopCamera() {
  try {
    if (cameraRef.current) {
      cameraRef.current.stop()
      cameraRef.current = null
    }

    const stream =
      videoRef.current?.srcObject as MediaStream | null

    if (stream) {
      stream
        .getTracks()
        .forEach((track) => track.stop())
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.pause()
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }

    const faceDetection =
      faceDetectionRef.current

    faceDetectionRef.current = null

    if (
      faceDetection &&
      typeof faceDetection.close === 'function'
    ) {
      Promise.resolve(
        faceDetection.close()
      ).catch((error) => {
        console.warn(
          '[FACIAL] erro ao fechar MediaPipe:',
          error
        )
      })
    }

    captureInProgressRef.current = false
    startedRef.current = false

    console.log(
      '[FACIAL] câmera e MediaPipe encerrados'
    )
  } catch (error) {
    console.error(
      '[FACIAL] erro ao parar câmera:',
      error
    )
  }
}

  async function captureFrame() {
  if (!videoRef.current) return
  if (captureInProgressRef.current) return

  const video = videoRef.current

  if (!video.videoWidth || !video.videoHeight) {
    return
  }

  captureInProgressRef.current = true

  try {
    console.log('[FACIAL] capturando frame...')

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')

    if (!ctx) {
      captureInProgressRef.current = false
      return
    }

    ctx.drawImage(video, 0, 0)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)

    const blob = await fetch(dataUrl).then((res) => res.blob())

    console.log('[FACIAL] blob gerado:', blob.size)

setFaceCaptured(true)

console.log('[FACIAL] chamando onFaceCapture...')

await new Promise((resolve) => setTimeout(resolve, 500))

const accepted = await onFaceCapture(blob)

console.log('[FACIAL] onFaceCapture finalizado', accepted)

if (!accepted) {
  setFaceCaptured(false)
  setFaceMessage('Nenhum rosto válido encontrado. Tente novamente.')
  return
}

setFaceMessage(null)

    console.log('[FACIAL] captura enviada')
  } catch (error) {
    console.error('[FACIAL] erro no captureFrame:', error)
  } finally {
    setTimeout(() => {
      captureInProgressRef.current = false
    }, 1200)
  }
}

  useEffect(() => {
  setFaceCaptured(false)
  setFaceMessage(null)

  if (!isActive) {
    stopCamera()
    return
  }

  if (startedRef.current) return

  startedRef.current = true

  startCamera()

  return () => {
    stopCamera()
  }
}, [isActive, cameraMode])

  if (!isActive) return null

  return (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#020617',
      display: 'flex',
      flexDirection: 'column',
    }}
  >

  <style jsx>{`
  @keyframes facialProcessingSlide {
    0% {
      transform: translateX(-100%);
    }

    50% {
      transform: translateX(45%);
    }

    100% {
      transform: translateX(200%);
    }
  }

  @keyframes facialProcessingGlow {
    0%,
    100% {
      opacity: 0.82;
      filter: brightness(0.96);
    }

    50% {
      opacity: 1;
      filter: brightness(1.08);
    }
  }

  @keyframes facialProcessingDot {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }

    40% {
      opacity: 1;
    }
  }
`}</style>

    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: '#000',
        position: 'relative',
      }}
    >
      <video
  ref={videoRef}
  autoPlay
  playsInline
  muted
  style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  }}
/>

{faceCaptured && (
  <>
    <div
      style={{
        position: 'absolute',
        inset: 0,

        border:
          '6px solid #22c55e',

        borderRadius: 24,
        margin: 24,

        boxShadow:
          '0 0 40px rgba(34,197,94,0.65)',

        pointerEvents:
          'none',
      }}
    />

    <div
      style={{
        position: 'absolute',

        bottom: 105,
        left: '50%',

        transform:
          'translateX(-50%)',

        width:
          'min(520px, 88vw)',

        background:
          'linear-gradient(145deg, rgba(15,23,42,0.96), rgba(22,101,52,0.96))',

        color: '#ffffff',

        padding:
          '20px 22px',

        borderRadius: 24,

        border:
          '1px solid rgba(134,239,172,0.45)',

        boxShadow:
          '0 20px 55px rgba(0,0,0,0.45), 0 0 35px rgba(34,197,94,0.28)',

        backdropFilter:
          'blur(10px)',

        textAlign:
          'center',

        overflow:
          'hidden',

        animation:
          'facialProcessingGlow 2s ease-in-out infinite',
      }}
    >
      <div
        style={{
          display: 'flex',

          alignItems:
            'center',

          justifyContent:
            'center',

          gap: 10,

          fontSize: 22,
          fontWeight: 950,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,

            borderRadius:
              '50%',

            display: 'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            background:
              '#22c55e',

            boxShadow:
              '0 0 20px rgba(34,197,94,0.7)',

            fontSize: 18,
          }}
        >
          ✓
        </span>

        Rosto capturado
      </div>

      <div
        style={{
          marginTop: 7,

          color:
            '#dcfce7',

          fontSize: 16,

          fontWeight:
            800,
        }}
      >
        Aguarde
        <span
          style={{
            animation:
              'facialProcessingDot 1.4s infinite',
          }}
        >
          .
        </span>

        <span
          style={{
            animation:
              'facialProcessingDot 1.4s 0.2s infinite',
          }}
        >
          .
        </span>

        <span
          style={{
            animation:
              'facialProcessingDot 1.4s 0.4s infinite',
          }}
        >
          .
        </span>
      </div>

      <div
        style={{
          position:
            'relative',

          height: 10,

          marginTop: 18,

          borderRadius:
            999,

          overflow:
            'hidden',

          background:
            'rgba(255,255,255,0.16)',

          border:
            '1px solid rgba(255,255,255,0.12)',

          boxShadow:
            'inset 0 2px 5px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            position:
              'absolute',

            top: 0,
            bottom: 0,

            width:
              '48%',

            borderRadius:
              999,

            background:
              'linear-gradient(90deg, transparent, #86efac, #ffffff, #4ade80, transparent)',

            boxShadow:
              '0 0 18px rgba(134,239,172,0.9)',

            animation:
              'facialProcessingSlide 1.7s ease-in-out infinite',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 11,

          color:
            '#bbf7d0',

          fontSize: 13,

          fontWeight:
            750,

          letterSpacing:
            0.3,
        }}
      >
        Processando reconhecimento facial
      </div>
    </div>
  </>
)}

{faceMessage && !faceCaptured && (
  <div
    style={{
      position: 'absolute',
      bottom: 120,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(220,38,38,0.92)',
      color: '#fff',
      padding: '16px 24px',
      borderRadius: 18,
      fontWeight: 900,
      fontSize: 20,
      textAlign: 'center',
      boxShadow: '0 12px 30px rgba(220,38,38,0.45)',
      maxWidth: '90%',
    }}
  >
    {faceMessage}
  </div>
)}

      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          padding: 12,
          borderRadius: 16,
          background: 'rgba(15, 23, 42, 0.72)',
          color: '#ffffff',
          fontWeight: 900,
          textAlign: 'center',
        }}
      >
        Posicione o rosto na câmera
      </div>
    </div>

    <div
      style={{
        padding: 16,
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        background: '#ffffff',
        display: 'flex',
        gap: 12,
      }}
    >
      <button
        type="button"
        onClick={handleSwitchCamera}
        style={{
          flex: 1,
          padding: '16px 14px',
          borderRadius: 16,
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#0f172a',
          fontWeight: 900,
        }}
      >
        Alternar câmera
      </button>

      <button
        type="button"
        onClick={onCancel}
        style={{
          flex: 1,
          padding: '16px 14px',
          borderRadius: 16,
          border: 'none',
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 900,
        }}
      >
        Cancelar
      </button>
    </div>
  </div>
)}