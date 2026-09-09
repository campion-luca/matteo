// Banner "installa l'app" per iOS.
//
// Su iPhone la PWA si installa solo dal menù Condividi di Safari: non esiste
// l'evento `beforeinstallprompt` di Chrome, quindi non c'è modo di offrire un
// bottone che installi. L'unica cosa che si può fare è spiegare il gesto, e
// solo a chi ne ha bisogno: Safari su iOS, app non ancora installata.
// Il "no grazie" vale per la sessione (sessionStorage): al ritorno successivo
// il consiglio ha di nuovo senso, ma non insiste nella stessa visita.
import { useState, useEffect } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { readStorage, writeStorage } from '@/lib/safeStorage'

function isIOSSafariNotInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  if (standalone) return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  return isIOS && isSafari
}

const DISMISS_KEY = 'jarvis-install-dismissed'

export function InstallBanner() {
  const t = useT()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isIOSSafariNotInstalled() && !readStorage('session', DISMISS_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    writeStorage('session', DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div style={{
      position: 'absolute', left: 14, right: 14, bottom: 90, zIndex: 50,
      borderRadius: 0,
      background: 'var(--surface)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderTop: `1px solid ${NUC.hairline}`,
      borderBottom: `1px solid ${NUC.hairline}`,
      padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      {/* iOS share icon */}
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={NUC.faint} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.ink, lineHeight: 1.35 }}>
          {t('Aggiungi alla schermata Home')}
        </div>
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: NUC.faint, marginTop: 2 }}>
          {t('Condividi → “Aggiungi alla schermata Home” per usarla senza la barra Safari')}
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{ background: 'transparent', border: 'none', color: NUC.faint, padding: '4px 6px', cursor: 'pointer', flexShrink: 0, fontSize: 16, lineHeight: 1 }}
        aria-label={t('Chiudi')}
      >
        ×
      </button>
    </div>
  )
}
