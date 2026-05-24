'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  isActive: boolean
  disabled?: boolean
  captureLabel?: string
  onCapture: (imageBlob: Blob) => void
  onNoCamera?: () => void
}

export default function ManualFacialEnrollmentScanner({
  isActive,
  disabled = false,
  captureLabel = 'Capturar foto',
  onCapture,
  onNoCamera,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  async function startCamera() {
    try {
      if (!videoRef.current) return

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      videoRef.current.srcObject = stream

      await videoRef.current.play()
    } catch (error) {
      console.error('Erro ao abrir câmera manual:', error)
      onNoCamera?.()
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  function handleSwitchCamera() {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  function handleCapture() {
    if (!videoRef.current || disabled) return

    const video = videoRef.current

    if (!video.videoWidth || !video.videoHeight) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(blob)
      },
      'image/jpeg',
      0.92
    )
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

      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled}
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          border: 'none',
          background: disabled ? '#94a3b8' : '#7c3aed',
          color: '#ffffff',
          fontWeight: 900,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {captureLabel}
      </button>
    </div>
  )
}