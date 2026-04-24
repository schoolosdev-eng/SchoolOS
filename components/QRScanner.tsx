'use client'

import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef } from 'react'

type Props = {
  onScan: (text: string) => void
  onNoCamera?: () => void
  isActive: boolean
}

export default function QRScanner({ onScan, onNoCamera, isActive }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastScanRef = useRef<string | null>(null)
  const isRunningRef = useRef(false)

  useEffect(() => {
    if (!isActive) return

    let cancelled = false
    const scanner = new Html5Qrcode('reader')
    scannerRef.current = scanner

    async function startScanner() {
      try {
        const devices = await Html5Qrcode.getCameras()

        if (!devices || devices.length === 0) {
          console.warn('Nenhuma câmera encontrada.')
          onNoCamera?.()
          return
        }

        const cameraId = devices[0].id

        await scanner.start(
          cameraId,
          {
            fps: 10,
            qrbox: 250,
          },
          (decodedText) => {
            if (lastScanRef.current === decodedText) return

            lastScanRef.current = decodedText
            onScan(decodedText)

            setTimeout(() => {
              lastScanRef.current = null
            }, 3000)
          },
          () => {}
        )

        if (!cancelled) {
          isRunningRef.current = true
        }
      } catch (error) {
        console.error('Erro ao iniciar scanner:', error)
        onNoCamera?.()
      }
    }

    startScanner()

    return () => {
      cancelled = true

      if (scannerRef.current && isRunningRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            isRunningRef.current = false
          })
          .catch((error) => {
            console.error('Erro ao parar scanner:', error)
          })
      }
    }
  }, [isActive, onNoCamera, onScan])

  if (!isActive) return null

  return (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    {/* AREA DO SCANNER */}
    <div
      id="reader"
      style={{
        width: '100%',
        minHeight: 260,
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        background: '#0f172a',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    />

    {/* STATUS */}
    <div
      style={{
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        fontWeight: 600,
      }}
    >
      {isActive
        ? 'Câmera ativa. Aponte para o QR Code.'
        : 'Scanner inativo.'}
    </div>
  </div>
)
}