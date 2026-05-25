'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  isActive: boolean
  disabled?: boolean
  captureLabel?: string
  onCapture: (imageBlob: Blob) => void
  onAutoCapture?: (imageBlobs: Blob[]) => void
  onNoCamera?: () => void
}

export default function ManualFacialEnrollmentScanner({
  isActive,
  disabled = false,
  captureLabel = 'Capturar foto',
  onCapture,
  onAutoCapture,
  onNoCamera,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [autoCapturing, setAutoCapturing] = useState(false)
  const [progress, setProgress] = useState(0)

  async function startCamera() {
    try {
      if (!videoRef.current) return

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 },
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
    if (autoCapturing) return
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }

  function captureCurrentFrame(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!videoRef.current || disabled) {
        resolve(null)
        return
      }

      const video = videoRef.current

      if (!video.videoWidth || !video.videoHeight) {
        resolve(null)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }

      ctx.drawImage(video, 0, 0)

      canvas.toBlob(
        (blob) => {
          resolve(blob || null)
        },
        'image/jpeg',
        0.9
      )
    })
  }

  async function handleCapture() {
    const blob = await captureCurrentFrame()
    if (!blob) return
    onCapture(blob)
  }

  async function handleAutoCapture() {
    if (disabled || autoCapturing) return

    setAutoCapturing(true)
    setProgress(0)

    const blobs: Blob[] = []
    const totalFrames = 30
    const intervalMs = 120

    try {
      for (let i = 0; i < totalFrames; i++) {
        const blob = await captureCurrentFrame()

        if (blob) {
          blobs.push(blob)
        }

        setProgress(Math.round(((i + 1) / totalFrames) * 100))

        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }

      onAutoCapture?.(blobs)
    } finally {
      setAutoCapturing(false)
      setProgress(0)
    }
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
        disabled={autoCapturing}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#0f172a',
          fontWeight: 800,
          cursor: autoCapturing ? 'not-allowed' : 'pointer',
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
            display: 'block',
          }}
        />

        {autoCapturing && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              padding: 12,
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.82)',
              color: '#ffffff',
              fontWeight: 800,
              textAlign: 'center',
            }}
          >
            Movimente levemente o rosto... {progress}%
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleAutoCapture}
        disabled={disabled || autoCapturing}
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          border: 'none',
          background: disabled || autoCapturing ? '#94a3b8' : '#2563eb',
          color: '#ffffff',
          fontWeight: 900,
          cursor: disabled || autoCapturing ? 'not-allowed' : 'pointer',
        }}
      >
        {autoCapturing
          ? 'Capturando sequência...'
          : 'Capturar várias fotos automaticamente'}
      </button>

      <button
        type="button"
        onClick={handleCapture}
        disabled={disabled || autoCapturing}
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          border: 'none',
          background: disabled || autoCapturing ? '#94a3b8' : '#7c3aed',
          color: '#ffffff',
          fontWeight: 900,
          cursor: disabled || autoCapturing ? 'not-allowed' : 'pointer',
        }}
      >
        {captureLabel}
      </button>
    </div>
  )
}