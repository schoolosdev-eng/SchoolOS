'use client'

import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'

type Props = {
  onScan: (text: string) => void
  onNoCamera?: () => void
  isActive: boolean
}

type CameraDevice = {
  id: string
  label: string
}

export default function QRScanner({ onScan, onNoCamera, isActive }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<string | null>(null)
  const isRunningRef = useRef(false)
  const isSwitchingRef = useRef(false)
  const onScanRef = useRef(onScan)

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  async function stopScanner() {
    if (scannerRef.current && isRunningRef.current) {
      try {
        await scannerRef.current.stop()
      } catch (error) {
        console.error('Erro ao parar scanner:', error)
      }
    }

    isRunningRef.current = false
  }

  async function startScanner(cameraId?: string | null) {
    if (!isActive || isSwitchingRef.current) return

    isSwitchingRef.current = true

    try {
      await stopScanner()

      const devices = await Html5Qrcode.getCameras()

      if (!devices || devices.length === 0) {
        console.warn('Nenhuma câmera encontrada.')
        onNoCamera?.()
        return
      }

      setCameras(devices)

      const preferredCamera =
        cameraId ||
        selectedCameraId ||
        devices.find((device) =>
          device.label.toLowerCase().includes('back')
        )?.id ||
        devices.find((device) =>
          device.label.toLowerCase().includes('traseira')
        )?.id ||
        devices[0].id

      setSelectedCameraId(preferredCamera)

      const scanner = new Html5Qrcode('reader')
      scannerRef.current = scanner

      await scanner.start(
        preferredCamera,
        {
          fps: 10,
          qrbox: 250,
        },
        (decodedText) => {
          if (lastScanRef.current === decodedText) return

          lastScanRef.current = decodedText
          onScanRef.current(decodedText)

          setTimeout(() => {
            lastScanRef.current = null
          }, 3000)
        },
        () => {}
      )

      isRunningRef.current = true
    } catch (error) {
      console.error('Erro ao iniciar scanner:', error)
      onNoCamera?.()
    } finally {
      isSwitchingRef.current = false
    }
  }

  async function handleSwitchCamera() {
    if (cameras.length <= 1 || isSwitchingRef.current) return

    const currentIndex = cameras.findIndex(
      (camera) => camera.id === selectedCameraId
    )

    const nextCamera = cameras[(currentIndex + 1) % cameras.length]
    setSelectedCameraId(nextCamera.id)

    await startScanner(nextCamera.id)
  }

  useEffect(() => {
    if (!isActive) {
      stopScanner()
      return
    }

    startScanner()

    return () => {
      stopScanner()
    }
  }, [isActive])

  if (!isActive) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {cameras.length > 1 && (
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
      )}

      <div
        id="reader"
        style={{
          width: '100%',
          minHeight: 260,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          background: '#0f172a',
          overflow: 'hidden',
        }}
      />

      <div
        style={{
          fontSize: 13,
          color: '#64748b',
          textAlign: 'center',
          fontWeight: 600,
        }}
      >
        Câmera ativa. Aponte para o QR Code.
      </div>
    </div>
  )
}