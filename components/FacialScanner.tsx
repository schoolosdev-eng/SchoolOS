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
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      intervalRef.current = setInterval(async () => {
        captureFrame()
      }, 4000)
    } catch (error) {
      console.error('Erro ao acessar câmera:', error)
      onNoCamera?.()
    }
  }

  function stopCamera() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
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