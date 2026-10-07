import { useState, useEffect, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { cercaAggiornamento, ricordaRegistrazione } from '@/lib/aggiornamento'

// ── Cercare una versione nuova ─────────────────────────────────
// Il browser controlla se c'è un'app più recente solo quando la pagina si
// CARICA. Ma una PWA sul telefono non si ricarica: resta aperta per giorni e
// torna in primo piano. E una scheda del browser lasciata aperta sul computer
// pure. Così una versione vecchia poteva restare in uso per una settimana senza
// che il tasto "Aggiorna" comparisse mai — ed è una versione vecchia a togliere
// dal cloud le cose che non conosce (vedi `VERSIONE_DATI` nello store).
//
// Qui si chiede noi: ogni ora, e ogni volta che l'app torna in primo piano.
// Trovata una versione nuova succede quello di sempre — la pill in basso, e si
// ricarica solo toccandola.
const OGNI_MS = 60 * 60 * 1000

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
      onRegisteredSW(_url, r) { ricordaRegistrazione(r) },
      // onOfflineReady è irrilevante qui: nessun avviso all'utente.
    })
    const giro = setInterval(cercaAggiornamento, OGNI_MS)
    const alRitorno = () => { if (document.visibilityState === 'visible') cercaAggiornamento() }
    document.addEventListener('visibilitychange', alRitorno)
    return () => { clearInterval(giro); document.removeEventListener('visibilitychange', alRitorno) }
  }, [])

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      bottom: 'calc(env(safe-area-inset-bottom) + 84px)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px 10px 16px', borderRadius: 'var(--radius)',
      background: 'var(--surface-pop)', border: '1px solid var(--hairline)',
      boxShadow: '0 6px 20px -8px rgba(42,36,24,.35)',
      fontFamily: NUC.font, color: NUC.ink,
    }}>
      <span style={{ fontSize: 12.5, letterSpacing: '.01em' }}>
        {t('Nuova versione disponibile')}
      </span>
      <button
        onClick={() => updateSW.current?.(true)}
        style={{
          height: 30, padding: '0 14px', borderRadius: 'var(--radius-sm)', border: 'none',
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
