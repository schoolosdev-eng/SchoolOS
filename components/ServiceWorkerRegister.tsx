'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          console.log('[PWA] Service Worker registrado.')
        })
        .catch((error) => {
          console.error('[PWA] Erro ao registrar Service Worker:', error)
        })
    })
  }, [])

  return null
}