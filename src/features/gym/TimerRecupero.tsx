// ── Esecuzione e recupero, in fondo all'allenamento ────────────
// Una barra sola, sempre lì sotto, con due stati che si alternano:
//
//   ESECUZIONE → si sta facendo la serie. Un tasto: "Serie finita".
//   RECUPERO   → un minuto e mezzo che scende, e il promemoria di cosa farne:
//                recuperare, e scrivere com'è andata la serie.
//
// Il tasto NON spunta la serie da solo: il recupero è proprio il momento in cui
// la si registra — colpi e chili veri, non quelli previsti — e spuntarla al
// posto di chi si allena vorrebbe dire salvare numeri che nessuno ha guardato.
//
// È un componente a sé, e non stato della pagina dell'allenamento, per una
// ragione di velocità: il conto alla rovescia cambia ogni secondo, e tenuto
// lassù farebbe ridisegnare ogni secondo tutte le card degli esercizi con i
// loro campi — sotto le dita di chi sta scrivendo i chili.
import { useCallback, useEffect, useRef, useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { leggiRecupero, salvaRecupero, scartaRecupero, RECUPERO_SEC } from './sessioneInCorso'

/** L'altezza della barra, uguale in esecuzione e in recupero. */
const ALTEZZA = 84

/** "1:30", "0:07". */
function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// Lo schermo acceso mentre il tempo scende: un timer che si guarda dopo aver
// sbloccato il telefono è arrivato tardi. Dove l'API non c'è non succede niente.
type Blocco = { release: () => Promise<void> }
async function tieniAcceso(): Promise<Blocco | null> {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Blocco> } }).wakeLock
    return wl ? await wl.request('screen') : null
  } catch {
    return null   // negato, o batteria in risparmio: il timer va lo stesso
  }
}

export function TimerRecupero({ schedaId }: { schedaId: string }) {
  const t = useT()
  // L'istante in cui il recupero finisce, non i secondi rimasti: il conto si
  // rifà ogni volta da qui, quindi un intervallo rallentato dal browser (pagina
  // in secondo piano, telefono bloccato) non lo fa restare indietro.
  const [fine, setFine] = useState<number | null>(() => leggiRecupero(schedaId))
  const [adesso, setAdesso] = useState(() => Date.now())
  // L'ultimo recupero è arrivato in fondo: lo si dice finché non parte la
  // serie dopo, perché è il segnale che si stava aspettando.
  const [finito, setFinito] = useState(false)
  const blocco = useRef<Blocco | null>(null)

  const restano = fine === null ? 0 : Math.max(0, Math.ceil((fine - adesso) / 1000))
  const inRecupero = fine !== null && restano > 0

  const rilascia = useCallback(() => { void blocco.current?.release().catch(() => {}); blocco.current = null }, [])

  // Il battito: quattro volte al secondo bastano a non far saltare un numero, e
  // al ritorno in primo piano si riallinea subito invece di aspettare il giro.
  useEffect(() => {
    if (fine === null) return
    const batti = () => setAdesso(Date.now())
    const id = setInterval(batti, 250)
    const alRitorno = () => {
      if (document.visibilityState !== 'visible') return
      batti()
      // Il sistema toglie il blocco dello schermo quando la pagina va sotto.
      if (!blocco.current) void tieniAcceso().then(b => { blocco.current = b })
    }
    document.addEventListener('visibilitychange', alRitorno)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alRitorno) }
  }, [fine])

  // Arrivato a zero.
  useEffect(() => {
    if (fine === null || restano > 0) return
    setFine(null)
    setFinito(true)
    scartaRecupero()
    rilascia()
    // Due colpi brevi. Su iPhone la vibrazione dal browser non esiste: lì il
    // segnale è la barra che cambia.
    try { navigator.vibrate?.([180, 90, 180]) } catch { /* non supportata */ }
  }, [fine, restano, rilascia])

  useEffect(() => rilascia, [rilascia])

  const avvia = () => {
    const f = Date.now() + RECUPERO_SEC * 1000
    setAdesso(Date.now())
    setFine(f)
    setFinito(false)
    salvaRecupero(schedaId, f)
    void tieniAcceso().then(b => { blocco.current = b })
  }

  const salta = () => {
    setFine(null)
    setFinito(false)
    scartaRecupero()
    rilascia()
  }

  return (
    <div
      // Il contorno d'accent è il segnale di "tocca a te": durante il recupero
      // la barra è a riposo, appena finisce si accende.
      //
      // L'altezza è la stessa nei due stati, fissata: la barra sta sotto
      // l'elenco degli esercizi, e se crescesse al tocco l'elenco salterebbe di
      // qualche riga proprio mentre si va a scrivere i colpi.
      style={{
        marginBottom: 10, padding: '0 12px 0 14px', height: ALTEZZA, borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-pop)',
        border: `1px solid ${finito ? 'var(--j-accent)' : NUC.hairline}`,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}
    >
      {inRecupero ? (
        <>
          <div className="flex items-center gap-3">
            <div style={{ flexShrink: 0 }}>
              <div className="j-eyebrow">{t('Recupero')}</div>
              <div role="timer" aria-label={t('Recupero')} style={{
                fontFamily: NUC.font, fontSize: 32, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums', color: NUC.ink, marginTop: 1,
              }}>{mmss(restano)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontFamily: NUC.label, fontSize: 11, lineHeight: 1.4, color: NUC.dim }}>
              {t('Tempo di recuperare e registrare la serie.')}
            </div>
            <button onClick={salta} className="j-hard j-hard-sm" style={{
              flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
              fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
            }}>{t('Salta')}</button>
          </div>
          {/* Quanto manca, in lunghezza: si legge con la coda dell'occhio, dal
              telefono appoggiato per terra. */}
          <div aria-hidden style={{ height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', marginTop: 9, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(restano / RECUPERO_SEC) * 100}%`, background: 'var(--j-accent)', transition: 'width 250ms linear' }}/>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <div className="j-eyebrow flex items-center gap-1.5">
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--j-accent)', flexShrink: 0 }}/>
              {t('Esecuzione')}
            </div>
            <div style={{ fontFamily: NUC.label, fontSize: 11, lineHeight: 1.4, color: finito ? NUC.ink : NUC.dim, fontWeight: finito ? 600 : 400, marginTop: 3 }}>
              {finito ? t('Recupero finito: vai con la prossima serie.') : t('Finita la serie, fai partire il recupero.')}
            </div>
          </div>
          <button onClick={avvia} className="j-hard j-accent-key j-focus flex items-center gap-2" style={{
            flexShrink: 0, height: 46, padding: '0 16px', borderRadius: 'var(--radius)', cursor: 'pointer',
            backgroundColor: 'var(--j-accent)', border: '1px solid var(--accent-edge)', color: 'var(--j-accent-fg)',
            fontFamily: NUC.label, fontSize: 11.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
          }}>
            <Icons.check size={15} stroke={2.4}/> {t('Serie finita')}
          </button>
        </div>
      )}
    </div>
  )
}
