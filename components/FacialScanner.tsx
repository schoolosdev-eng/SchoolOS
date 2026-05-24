'use client'

import { useEffect, useRef } from 'react'
import { FaceDetection } from '@mediapipe/face_detection'
import { Camera } from '@mediapipe/camera_utils'

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
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const faceDetectionRef = useRef<FaceDetection | null>(null)
    const cameraRef = useRef<Camera | null>(null)
    const lastCaptureRef = useRef<number>(0)

  async function startCamera() {
  try {
    if (!videoRef.current) return

    const faceDetection = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    })

    faceDetection.setOptions({
      model: 'short',
      minDetectionConfidence: 0.7,
    })

    faceDetection.onResults(async (results) => {
      const detections = results.detections || []

      if (detections.length === 0) return

      const now = Date.now()

      // evita capturas excessivas
      if (now - lastCaptureRef.current < 4000) return

      lastCaptureRef.current = now

      captureFrame()
    })

    faceDetectionRef.current = faceDetection

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (!videoRef.current) return

        await faceDetection.send({
          image: videoRef.current,
        })
      },
      width: 640,
      height: 480,
    })

    cameraRef.current = camera

    await camera.start()
  } catch (error) {
    console.error('Erro ao acessar câmera:', error)
    onNoCamera?.()
  }
}

  function stopCamera() {
  if (cameraRef.current) {
    cameraRef.current.stop()
  }

  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop())
  }
}

  async function captureFrame() {
    if (!videoRef.current) return

    const video = videoRef.current

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
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
        Câmera facial ativa.
      </div>
    </div>
  )
}