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

  // Un riquadro bianco col bordo d'inchiostro, come le card: niente ombra sua,
  // l'ombra è del tasto. Centrato con i margini automatici e non con
  // `left: 50%` + `translateX`: così la larghezza disponibile è tutto lo
  // schermo, e non la metà a destra del centro — sul telefono la scritta andava
  // a capo già a metà frase.
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, margin: '0 auto',
      width: 'fit-content', maxWidth: 'calc(100% - 32px)', boxSizing: 'border-box',
      bottom: 'calc(env(safe-area-inset-bottom) + 84px)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '10px 14px 10px 16px',
      background: 'var(--surface-pop)', border: 'var(--bordo)',
      fontFamily: NUC.font, color: NUC.ink,
    }}>
      <span style={{
        fontFamily: NUC.display, fontSize: 16, fontWeight: 700, lineHeight: 1.15,
        letterSpacing: '.04em', textTransform: 'uppercase',
      }}>
        {t('Nuova versione disponibile')}
      </span>
      {/* Il gesto dell'avviso: il tasto pieno piccolo (`.j-btn-accent-sm`),
          largo quanto la sua parola. */}
      <button
        onClick={() => updateSW.current?.(true)}
        className="j-btn-accent-sm"
        style={{ width: 'auto', padding: '0 16px', flexShrink: 0 }}
      >
        {t('Aggiorna')}
      </button>
    </div>
  )
}
