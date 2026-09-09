import { useState, useEffect, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'

// Registra il service worker col pattern 'prompt': quando è pronta una nuova
// versione mostra una pill in basso; il tap chiama updateSW(true) che attiva il
// nuovo SW e ricarica. Nessun reload forzato a metà utilizzo.
export function UpdateToast() {
  const t = useT()
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateSW = useRef<(reloadPage?: boolean) => Promise<void>>()

  useEffect(() => {
    updateSW.current = registerSW({
      onNeedRefresh() { setNeedRefresh(true) },
      // onOfflineReady è irrilevante qui: nessun avviso all'utente.
    })
  }, [])

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(env(safe-area-inset-bottom) + 84px)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px 10px 16px', borderRadius: 999,
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      boxShadow: '0 6px 20px -8px rgba(42,36,24,.35)',
      fontFamily: NUC.font, color: NUC.ink,
    }}>
      <span style={{ fontSize: 12.5, letterSpacing: '.01em' }}>
        {t('Nuova versione disponibile')}
      </span>
      <button
        onClick={() => updateSW.current?.(true)}
        style={{
          height: 30, padding: '0 14px', borderRadius: 999, border: 'none',
          background: 'var(--j-accent)', color: 'var(--j-accent-fg)',
          fontFamily: NUC.font, fontSize: 11, fontWeight: 500,
          letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        {t('Aggiorna')}
      </button>
    </div>
  )
}
