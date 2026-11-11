import type { DuckAvatar } from './types'

let scriptLoaderPromise: Promise<any> | null = null

export function loadNBPRoom(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if ((window as any).NBPRoom) return Promise.resolve((window as any).NBPRoom)
  if (scriptLoaderPromise) return scriptLoaderPromise

  scriptLoaderPromise = new Promise((resolve) => {
    function loadSingle(src: string): Promise<void> {
      return new Promise((res) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          res()
          return
        }
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => res()
        s.onerror = () => res()
        document.head.appendChild(s)
      })
    }

    loadSingle('/vendor/peerjs.min.js')
      .then(() => loadSingle('/vendor/nbp-p2p.js'))
      .then(() => {
        resolve((window as any).NBPRoom || null)
      })
      .catch(() => resolve(null))
  })

  return scriptLoaderPromise
}

export function generateRoomCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000)
  return `PATO-${num}`
}

export function normalizeRoomCode(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
  if (!cleaned) return ''
  if (/^\d{4}$/.test(cleaned)) {
    return `PATO-${cleaned}`
  }
  return cleaned
}
