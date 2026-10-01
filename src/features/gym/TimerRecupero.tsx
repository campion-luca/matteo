// ── Il timer di recupero, in fondo all'allenamento ─────────────
// Un quadrante rotondo, al centro, sempre lì sotto: è fatto come un orologio da
// timer perché è quello che è, e perché una cosa tonda in una pagina di
// rettangoli si trova senza cercarla. Tre stati, uno dopo l'altro:
//
//   ESECUZIONE → si sta facendo la serie. Il quadrante è un tasto pieno: TIMER.
//   RECUPERO   → un minuto e mezzo che scende, con l'anello che si consuma, e
//                il promemoria di cosa farne: recuperare e registrare la serie.
//   OLTRE      → arrivato a zero non si ferma: diventa rosso e conta in su,
//                "+0:07", quanto si sta aspettando oltre il recupero. Finché
//                non lo si tocca per ripartire.
//
// Si può CHIUDERE, con la × in alto a sinistra: il quadrante è grande, e chi
// vuole tutta la pagina per gli esercizi lo riduce a un'icona in testata,
// accanto al nome della scheda (`TimerIcona`). Chiuso non è fermo: il tempo
// continua a scorrere e l'icona lo mostra. Un tocco sull'icona lo riapre.
//
// Il tasto NON spunta la serie da solo: il recupero è proprio il momento in cui
// la si registra — colpi e chili veri, non quelli previsti — e spuntarla al
// posto di chi si allena vorrebbe dire salvare numeri che nessuno ha guardato.
//
// È un componente a sé, e non stato della pagina dell'allenamento, per una
// ragione di velocità: il conto cambia ogni secondo, e tenuto lassù farebbe
// ridisegnare ogni secondo tutte le card degli esercizi con i loro campi —
// sotto le dita di chi sta scrivendo i chili.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { leggiRecupero, salvaRecupero, scartaRecupero, RECUPERO_SEC, OLTRE_MAX_SEC } from './sessioneInCorso'

/** Il diametro del quadrante. Più del doppio della barra che c'era prima (84px),
 *  ma legato all'altezza dello schermo: su un telefono basso deve restare posto
 *  per gli esercizi sopra. */
const DIAMETRO = 'clamp(150px, 22dvh, 184px)'

/** Per quanto, oltre lo zero, lo schermo resta acceso. Il conto in su continua
 *  anche dopo; ma un telefono dimenticato sulla panca non deve restare acceso
 *  mezz'ora. */
const ACCESO_OLTRE_SEC = 180

/** "1:30", "0:07". */
function mmss(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// Lo schermo acceso mentre il tempo scorre: un timer che si guarda dopo aver
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

// L'anello: una circonferenza di raggio 46 in un riquadro da 100. La lunghezza
// serve a consumarlo — il tratto è lungo quanto il cerchio, e lo si fa scorrere
// via di quanto è già passato.
// Il rosso di "oltre il recupero". È quello dei segnali (lo stesso del "scendi"
// nel carico consigliato) e non `--danger`: in Premium i colori d'avviso sono
// spenti di proposito — `--danger` lì è bianco — mentre un timer scaduto deve
// diventare rosso in qualunque tema.
const ROSSO = 'var(--segnale-giu)'

const RAGGIO = 46
const GIRO = 2 * Math.PI * RAGGIO

const QUADRANTE: CSSProperties = {
  position: 'relative', width: DIAMETRO, height: DIAMETRO, borderRadius: '50%', flexShrink: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: 0, textAlign: 'center',
}
const SOPRA: CSSProperties = {
  fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase',
}
const NUMERO: CSSProperties = {
  fontFamily: NUC.font, fontSize: 42, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em',
  fontVariantNumeric: 'tabular-nums', margin: '5px 0 7px',
}
const SOTTO: CSSProperties = {
  fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
}

// ── Il motore ──────────────────────────────────────────────────
// Lo stesso per il quadrante e per l'icona: a schermo ce n'è sempre uno solo
// dei due, e quello che entra riparte dall'istante di fine che l'altro ha
// lasciato scritto (vedi `leggiRecupero`). Per questo chiudere e riaprire non
// perde un secondo, e non fa vibrare due volte.
function useRecupero(schedaId: string) {
  // L'istante in cui il recupero finisce, non i secondi rimasti: il conto si
  // rifà ogni volta da qui, quindi un intervallo rallentato dal browser (pagina
  // in secondo piano, telefono bloccato) non lo fa restare indietro. Passato
  // quell'istante resta lo stesso numero: da lì si conta in su.
  const [fine, setFine] = useState<number | null>(() => leggiRecupero(schedaId))
  const [adesso, setAdesso] = useState(() => Date.now())
  const blocco = useRef<Blocco | null>(null)

  const restano = fine === null ? 0 : Math.max(0, Math.ceil((fine - adesso) / 1000))
  const oltre = fine === null ? 0 : Math.max(0, Math.floor((adesso - fine) / 1000))
  const stato: 'esecuzione' | 'recupero' | 'oltre' = fine === null ? 'esecuzione' : restano > 0 ? 'recupero' : 'oltre'

  const rilascia = useCallback(() => { void blocco.current?.release().catch(() => {}); blocco.current = null }, [])

  // Il battito: quattro volte al secondo bastano a non far saltare un numero, e
  // al ritorno in primo piano si riallinea subito invece di aspettare il giro.
  useEffect(() => {
    if (fine === null) return
    const batti = () => setAdesso(Date.now())
    const id = setInterval(batti, 250)
    const alRitorno = () => { if (document.visibilityState === 'visible') batti() }
    document.addEventListener('visibilitychange', alRitorno)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', alRitorno) }
  }, [fine])

  // Il passaggio per lo zero: due colpi brevi, una volta sola. Chi rientra a
  // tempo già scaduto non li sente — lo zero è passato mentre non c'era. Su
  // iPhone la vibrazione dal browser non esiste: lì il segnale è il rosso.
  const eraOltre = useRef(stato === 'oltre')
  useEffect(() => {
    if (stato === 'oltre' && !eraOltre.current) {
      try { navigator.vibrate?.([180, 90, 180]) } catch { /* non supportata */ }
    }
    eraOltre.current = stato === 'oltre'
  }, [stato])

  // Lo schermo: acceso per il recupero e per i primi minuti oltre, poi lo si
  // lascia andare. E dimenticato lì per mezz'ora, il timer si azzera da sé.
  const accesoFinQui = stato !== 'esecuzione' && oltre < ACCESO_OLTRE_SEC
  useEffect(() => {
    if (!accesoFinQui) { rilascia(); return }
    const prendi = () => { if (!blocco.current && document.visibilityState === 'visible') void tieniAcceso().then(b => { blocco.current = b }) }
    prendi()
    // Il sistema toglie il blocco quando la pagina va sotto: al ritorno si riprende.
    document.addEventListener('visibilitychange', prendi)
    return () => document.removeEventListener('visibilitychange', prendi)
  }, [accesoFinQui, rilascia])
  useEffect(() => rilascia, [rilascia])

  const ferma = useCallback(() => {
    setFine(null)
    scartaRecupero()
  }, [])
  useEffect(() => { if (oltre >= OLTRE_MAX_SEC) ferma() }, [oltre, ferma])

  const avvia = () => {
    const f = Date.now() + RECUPERO_SEC * 1000
    setAdesso(Date.now())
    setFine(f)
    salvaRecupero(schedaId, f)
  }

  return { stato, restano, oltre, avvia, ferma }
}

export function TimerRecupero({ schedaId, onChiudi }: {
  schedaId: string
  /** Riduce il timer all'icona in testata. Senza, la × non c'è. */
  onChiudi?: () => void
}) {
  const t = useT()
  const { stato, restano, oltre, avvia, ferma } = useRecupero(schedaId)

  return (
    // L'altezza è la stessa nei tre stati: il quadrante non cambia misura e la
    // riga sotto tiene sempre il posto di due righe. Il blocco sta sotto
    // l'elenco degli esercizi, e se crescesse al tocco l'elenco salterebbe
    // proprio mentre si va a scrivere i colpi.
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 10 }}>
      {onChiudi && (
        <button
          onClick={onChiudi}
          aria-label={t('Chiudi il timer')} title={t('Chiudi il timer')}
          className="j-hard j-hard-sm flex items-center justify-center"
          style={{
            position: 'absolute', top: 0, left: 0, width: 34, height: 34, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            background: 'var(--surface)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
          }}
        >
          <Icons.x size={15} stroke={2}/>
        </button>
      )}
      {stato === 'esecuzione' && (
        <button
          onClick={avvia}
          aria-label={t('Timer')}
          className="j-hard j-accent-key j-focus"
          style={{
            ...QUADRANTE, cursor: 'pointer',
            backgroundColor: 'var(--j-accent)', border: '1px solid var(--accent-edge)', color: 'var(--j-accent-fg)',
          }}
        >
          <span style={{ ...SOPRA, opacity: 0.8 }}>{t('Esecuzione')}</span>
          <span style={{ fontFamily: NUC.font, fontSize: 34, fontWeight: 700, lineHeight: 1, letterSpacing: '.06em', textTransform: 'uppercase', margin: '7px 0 8px' }}>
            {t('Timer')}
          </span>
          <span style={{ ...SOTTO, opacity: 0.8 }}>{t('Serie finita')}</span>
        </button>
      )}

      {stato === 'recupero' && (
        <div style={{ ...QUADRANTE, background: 'var(--surface-pop)', color: NUC.ink }}>
          <Anello parte={restano / RECUPERO_SEC} colore="var(--j-accent)"/>
          <span className="j-eyebrow" style={{ ...SOPRA, position: 'relative' }}>{t('Recupero')}</span>
          <span role="timer" aria-label={t('Recupero')} style={{ ...NUMERO, position: 'relative' }}>{mmss(restano)}</span>
          <button onClick={ferma} className="j-hard j-hard-sm" style={{
            position: 'relative', height: 28, padding: '0 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
            background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim, ...SOTTO,
          }}>{t('Salta')}</button>
        </div>
      )}

      {stato === 'oltre' && (
        // Tutto il quadrante è il tasto: a tempo scaduto c'è una cosa sola da
        // fare, ripartire, e deve bastare un tocco senza mirare.
        <button
          onClick={ferma}
          aria-label={t('Riprendi')}
          className="j-focus"
          style={{
            ...QUADRANTE, cursor: 'pointer',
            background: `rgba(var(--segnale-giu-rgb),0.2)`, border: 'none', color: ROSSO,
          }}
        >
          <Anello parte={1} colore={ROSSO}/>
          <span style={{ ...SOPRA, position: 'relative' }}>{t('Oltre il recupero')}</span>
          <span role="timer" aria-label={t('Oltre il recupero')} style={{ ...NUMERO, position: 'relative' }}>+{mmss(oltre)}</span>
          <span style={{ ...SOTTO, position: 'relative' }}>{t('tocca per riprendere')}</span>
        </button>
      )}

      <div style={{
        marginTop: 9, minHeight: 31, maxWidth: 300, textAlign: 'center',
        fontFamily: NUC.label, fontSize: 11, lineHeight: 1.4,
        color: stato === 'oltre' ? ROSSO : NUC.dim, fontWeight: stato === 'oltre' ? 600 : 400,
      }}>
        {stato === 'esecuzione' ? t('Finita la serie, tocca il timer per il recupero.')
          : stato === 'recupero' ? t('Tempo di recuperare e registrare la serie.')
          : t('Recupero finito: è ora della prossima serie.')}
      </div>
    </div>
  )
}

// ── Il timer chiuso: un'icona in testata ───────────────────────
// A riposo è un orologio e basta. Con il tempo che scorre porta anche il
// numero, nel colore dello stato — quello dell'app in recupero, rosso oltre lo
// zero — perché chi ha chiuso il quadrante non ha smesso di voler sapere quanto
// manca.
export function TimerIcona({ schedaId, onApri }: { schedaId: string; onApri: () => void }) {
  const t = useT()
  const { stato, restano, oltre } = useRecupero(schedaId)
  const colore = stato === 'oltre' ? ROSSO : stato === 'recupero' ? 'var(--j-accent-ink)' : NUC.dim
  return (
    <button
      onClick={onApri}
      aria-label={t('Apri il timer')} title={t('Apri il timer')}
      className="j-hard j-hard-sm flex items-center justify-center gap-1.5"
      style={{
        height: 36, minWidth: 36, padding: stato === 'esecuzione' ? 0 : '0 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
        background: stato === 'oltre' ? `rgba(var(--segnale-giu-rgb),0.16)` : 'var(--surface)',
        border: `1px solid ${stato === 'esecuzione' ? NUC.hairline : colore}`, color: colore,
      }}
    >
      <Icons.clock size={16} stroke={1.8}/>
      {stato !== 'esecuzione' && (
        <span role="timer" style={{ fontFamily: NUC.font, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {stato === 'oltre' ? `+${mmss(oltre)}` : mmss(restano)}
        </span>
      )}
    </button>
  )
}

/** L'anello del quadrante. `parte` è quanto ne resta, da 1 (pieno) a 0. Parte
 *  dall'alto e si consuma in senso orario, come una lancetta. */
function Anello({ parte, colore }: { parte: number; colore: string }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      <circle cx="50" cy="50" r={RAGGIO} fill="none" stroke="var(--surface-2)" strokeWidth="5"/>
      <circle
        cx="50" cy="50" r={RAGGIO} fill="none" stroke={colore} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={GIRO} strokeDashoffset={GIRO * (1 - Math.min(1, Math.max(0, parte)))}
        style={{ transition: 'stroke-dashoffset 250ms linear' }}
      />
    </svg>
  )
}
