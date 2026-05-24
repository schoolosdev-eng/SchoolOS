'use client'

import { useEffect, useRef } from 'react'

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
      if (!videoRef.current) return

      await loadScript(
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js'
      )

      await loadScript(
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
      )

      const FaceDetectionClass = (window as any).FaceDetection
      const CameraClass = (window as any).Camera

      if (!FaceDetectionClass || !CameraClass) {
        throw new Error('MediaPipe não carregado.')
      }

      const faceDetection = new FaceDetectionClass({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
      })

      faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.75,
      })

      faceDetection.onResults((results: any) => {
        const detections = results.detections || []
        if (detections.length === 0) return

        const now = Date.now()
        if (now - lastCaptureRef.current < 4000) return

        lastCaptureRef.current = now
        captureFrame()
      })

      faceDetectionRef.current = faceDetection

      const camera = new CameraClass(videoRef.current, {
        onFrame: async () => {
          if (!videoRef.current) return
          await faceDetection.send({ image: videoRef.current })
        },
        width: 640,
        height: 480,
      })

      cameraRef.current = camera
      await camera.start()
    } catch (error) {
      console.error('Erro ao acessar câmera facial:', error)
      onNoCamera?.()
    }
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

    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (!blob) return
      onFaceCapture(blob)
    }, 'image/jpeg', 0.8)
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
  }, [isActive])

  if (!isActive) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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