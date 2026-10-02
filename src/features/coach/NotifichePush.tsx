// Il riquadro per attivare le notifiche su questo dispositivo.
//
// Sta nel Coaching perché è lì che servono: senza, un messaggio o un
// allenamento finito si scoprono solo aprendo l'app. Dice sempre in che stato
// si è e cosa fare — le notifiche hanno cinque modi diversi di "non andare"
// (permesso negato, iPhone non installato, browser senza push…), e un
// interruttore che non si accende senza spiegare perché è peggio di niente.
import { useEffect, useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { attivaPush, disattivaPush, statoPush, type StatoPush } from '@/lib/push'

export function NotifichePush({ userId }: { userId: string }) {
  const t = useT()
  const [stato, setStato] = useState<StatoPush | null>(null)
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    statoPush().then(s => { if (vivo) setStato(s) }).catch(() => { if (vivo) setStato('non-supportato') })
    return () => { vivo = false }
  }, [])

  // Finché non si sa, e quando sul progetto il push non è configurato, non si
  // mostra niente: un riquadro che promette notifiche che non possono arrivare
  // sarebbe una bugia.
  if (stato === null || stato === 'non-configurato') return null

  const cambia = async (accendi: boolean) => {
    setLavoro(true); setErrore(null)
    try {
      if (accendi) setStato(await attivaPush(userId))
      else { await disattivaPush(); setStato('spento') }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setLavoro(false)
    }
  }

  const attivo = stato === 'attivo'
  const testo =
    attivo ? t('Notifiche attive su questo dispositivo.')
    : stato === 'spento' ? t('Attiva le notifiche per sapere subito quando ti scrivono o un allievo finisce un allenamento.')
    : stato === 'negato' ? t('Le notifiche sono bloccate per questa app. Riattivale dalle impostazioni del telefono o del browser.')
    : stato === 'da-installare' ? t('Su iPhone le notifiche arrivano solo con l’app installata: da Safari tocca Condividi, poi “Aggiungi alla schermata Home”, e aprila da lì.')
    : t('Questo browser non supporta le notifiche.')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px',
      borderRadius: 'var(--radius)', background: 'var(--surface)',
      border: `1px solid ${stato === 'spento' ? 'var(--j-accent)' : 'var(--hairline)'}`,
    }}>
      <span style={{ display: 'flex', flexShrink: 0, color: attivo ? 'var(--j-accent-ink)' : 'var(--fg-mute)' }}>
        <Icons.chat size={17} stroke={1.7}/>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.45, color: attivo ? 'var(--fg-soft)' : 'var(--fg)' }}>{testo}</div>
        {errore && <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', marginTop: 3 }}>{errore}</div>}
      </div>
      {(stato === 'spento' || attivo) && (
        <button
          onClick={() => { void cambia(!attivo) }}
          disabled={lavoro}
          className={attivo ? undefined : 'j-hard j-hard-sm'}
          style={{
            flexShrink: 0, height: 34, padding: '0 12px', borderRadius: 'var(--radius-sm)', cursor: lavoro ? 'default' : 'pointer',
            background: attivo ? 'none' : 'var(--j-accent)',
            border: attivo ? '1px solid var(--hairline)' : 'none',
            color: attivo ? 'var(--fg-mute)' : 'var(--j-accent-fg)',
            fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
            opacity: lavoro ? 0.5 : 1,
          }}
        >
          {attivo ? t('Disattiva') : t('Attiva')}
        </button>
      )}
    </div>
  )
}
