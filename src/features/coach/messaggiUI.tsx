// I pezzi visivi di una conversazione, usati da tutte e due le parti: l'allievo
// li vede dentro la scheda che gli è stata assegnata, l'allenatore nella sezione
// "Messaggi" del Personal Coach. Stanno in un file a parte perché sono
// letteralmente la stessa cosa vista dai due lati, e due copie che divergono
// significano due modi diversi di mostrare lo stesso messaggio alle due persone
// che lo stanno leggendo insieme.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { fmtQuando } from '@/lib/dateFormat'
import type { Messaggio, TipoMessaggio } from '@/lib/messaggi'

/** Il pallino rosso con il numero. Il rosso dei segnali (`--segnale-giu`) e non
 *  l'accento: l'accento è l'arancio dei tasti, e un badge dello stesso colore di
 *  un tasto si leggerebbe come un tasto. */
export function BadgeNonLetti({ n, style }: { n: number; style?: CSSProperties }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 17, height: 17, padding: '0 5px', boxSizing: 'border-box',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--pallino)', color: '#fff',
        fontFamily: NUC.label, fontSize: 10, fontWeight: 700, lineHeight: 1,
        ...style,
      }}
    >
      {n > 9 ? '9+' : n}
    </span>
  )
}

/** Di cosa parla il messaggio, in una parola. Solo per le richieste: su una
 *  risposta sarebbe un'etichetta che dice "risposta" sopra una risposta. */
export function EtichettaTipo({ tipo }: { tipo: TipoMessaggio }) {
  const t = useT()
  // Un messaggio scritto a mano non ha bisogno di dire cos'è.
  if (tipo === 'risposta' || tipo === 'chat') return null
  // Gli avvisi che l'app scrive da sé: l'etichetta è ciò che li distingue da una
  // frase detta — "allenamento finito" non l'ha digitato nessuno.
  if (tipo !== 'info' && tipo !== 'sostituzione') {
    const nome = tipo === 'allenamento' ? t('allenamento') : tipo === 'scheda' ? t('scheda') : tipo === 'nota' ? t('nota')
      : tipo === 'collegamento' ? t('collegamento') : t('correzione')
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '1px 6px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--j-accent)', color: 'var(--j-accent-ink)',
        fontFamily: NUC.label, fontSize: 8.5, fontWeight: 700,
        letterSpacing: '.12em', textTransform: 'uppercase',
      }}>
        {tipo === 'allenamento' ? <Icons.check size={9} stroke={2.6}/> : tipo === 'scheda' ? <Icons.book size={9} stroke={2.2}/>
          : tipo === 'collegamento' ? <Icons.user size={9} stroke={2.2}/> : <Icons.pencil size={9} stroke={2.2}/>}
        {nome}
      </span>
    )
  }
  const sostituzione = tipo === 'sostituzione'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 6px', borderRadius: 'var(--radius-sm)',
      border: `1px solid ${sostituzione ? 'var(--tertiary-ink)' : 'var(--hairline)'}`,
      color: sostituzione ? 'var(--tertiary-ink)' : 'var(--fg-mute)',
      fontFamily: NUC.label, fontSize: 8.5, fontWeight: 700,
      letterSpacing: '.12em', textTransform: 'uppercase',
    }}>
      {sostituzione ? <Icons.repeat size={9} stroke={2.2}/> : <Icons.info size={9} stroke={2.2}/>}
      {sostituzione ? t('sostituzione') : t('info')}
    </span>
  )
}

/** Un messaggio. I miei a destra sull'accent, quelli dell'altro a sinistra sulla
 *  superficie: è la convenzione che qualunque telefono ha già insegnato, e non
 *  serve una legenda per capirla.
 *
 *  Chi ha scritto non si stampa più sopra ogni bolla: in un filo fra due persone
 *  lo dice già il lato, e quella riga in più faceva di ogni messaggio un
 *  blocchetto alto il doppio del suo testo. L'ora sta sotto, piccola, a destra. */
export function Bolla({ m, io, onElimina }: {
  m: Messaggio
  io: string
  /** Solo sui propri: cancellare il messaggio di un altro non è un gesto che
   *  esiste. */
  onElimina?: () => void
}) {
  const t = useT()
  if (m.tipo === 'allenamento') return <AvvisoAllenamento m={m}/>
  const mio = m.autore === io
  const conEtichetta = m.tipo !== 'chat' && m.tipo !== 'risposta'
  return (
    <div style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '82%', minWidth: 0,
        padding: '6px 10px 4px',
        borderRadius: 'var(--radius)',
        background: mio ? 'color-mix(in srgb, var(--j-accent) 14%, var(--surface))' : 'var(--surface-2)',
        border: `1px solid ${mio ? 'var(--j-accent)' : 'var(--hairline)'}`,
      }}>
        {conEtichetta && <div style={{ marginBottom: 3 }}><EtichettaTipo tipo={m.tipo}/></div>}
        {/* L'ora galleggia a destra in fondo al testo: se l'ultima riga ha
            spazio ci sta accanto, altrimenti scende. Su una riga sua, ogni
            messaggio di una riga diventava alto due. `flow-root` tiene dentro
            la bolla l'ora quando scende. */}
        <div style={{ display: 'flow-root', fontFamily: NUC.font, fontSize: 13, lineHeight: 1.4, color: 'var(--fg)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <span>{m.testo}</span>
          <span style={{ float: 'right', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 10, marginTop: 5, whiteSpace: 'nowrap' }}>
            <span style={{ fontFamily: NUC.label, fontSize: 9, lineHeight: 1, letterSpacing: '.03em', color: 'var(--fg-mute)' }}>
              {fmtQuando(m.created_at)}
            </span>
            {onElimina && (
              <button
                onClick={onElimina}
                aria-label={t('Elimina messaggio')}
                className="j-hit"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-mute)', display: 'flex' }}
              >
                <Icons.x size={10} stroke={2}/>
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

/** "Allenamento finito": lo scrive l'app, non una delle due persone. Sta al
 *  centro e in grigio, come le date in una chat del telefono, così non si
 *  confonde con quello che ci si è detti — fra due messaggi veri si legge come
 *  un fatto successo in mezzo, non come una terza voce. */
function AvvisoAllenamento({ m }: { m: Messaggio }) {
  return (
    <div role="note" style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div style={{
        maxWidth: '88%', minWidth: 0, textAlign: 'center',
        padding: '5px 12px', borderRadius: 'var(--radius)',
        background: 'color-mix(in srgb, var(--fg) 5%, transparent)',
        color: 'var(--fg-mute)', opacity: 0.85,
      }}>
        <div style={{ fontFamily: NUC.font, fontSize: 11.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          <Icons.check size={10} stroke={2.4} style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 5 }}/>
          <span>{m.testo}</span>
          <span style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.03em', marginLeft: 8, whiteSpace: 'nowrap' }}>
            {fmtQuando(m.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** Una fila di bolle. Vuota non disegna niente: il posto dove va è già dentro una
 *  card, e un "nessun messaggio" lì sotto sarebbe una riga di niente ripetuta
 *  per ogni esercizio della scheda. */
export function Filo({ messaggi, io, onElimina }: {
  messaggi: Messaggio[]
  io: string
  onElimina?: (m: Messaggio) => void
}) {
  if (messaggi.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {messaggi.map(m => (
        <Bolla
          key={m.id}
          m={m}
          io={io}
          onElimina={onElimina && m.autore === io ? () => onElimina(m) : undefined}
        />
      ))}
    </div>
  )
}

/** Il campo per scrivere. Si svuota all'invio e resta disabilitato finché la riga
 *  non è partita: due tocchi rapidi sullo stesso testo mandavano due messaggi
 *  identici, e in una conversazione un doppione si legge come insistenza.
 *
 *  `compatto` è la forma della chat: una riga sola che cresce con quello che si
 *  scrive, e accanto il tasto con la freccia. Sta ferma in fondo allo schermo
 *  (vedi BarraScrittura), e tre righe vuote più un tasto largo quanto la pagina
 *  si mangiavano un terzo dei messaggi. */
export function Composer({ placeholder, etichetta, onInvia, autoFocus, intestazione, compatto }: {
  placeholder: string
  etichetta: string
  onInvia: (testo: string) => Promise<unknown>
  autoFocus?: boolean
  /** Una riga sopra il campo: a cosa si sta rispondendo. */
  intestazione?: ReactNode
  compatto?: boolean
}) {
  const t = useT()
  const [testo, setTesto] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const campo = useRef<HTMLTextAreaElement>(null)

  // Il campo compatto cresce con il testo, fino a cinque righe circa; oltre,
  // scorre dentro di sé.
  useLayoutEffect(() => {
    const el = campo.current
    if (!compatto || !el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [testo, compatto])

  const manda = async () => {
    const pulito = testo.trim()
    if (!pulito || lavoro) return
    setLavoro(true)
    setErrore(null)
    try {
      await onInvia(pulito)
      setTesto('')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
    } finally {
      setLavoro(false)
    }
  }

  const vuoto = testo.trim() === ''
  const textarea = (
    <textarea
      ref={campo}
      value={testo}
      onChange={e => { setTesto(e.target.value); if (errore) setErrore(null) }}
      // Invio manda, Maiusc+Invio va a capo. Su telefono la tastiera dà il
      // ritorno a capo e non l'invio, quindi il tasto resta l'unica via
      // garantita: è lì anche quando questa scorciatoia non c'è.
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          void manda()
        }
      }}
      placeholder={placeholder}
      className={compatto ? 'j-field j-chat-campo' : 'j-field'}
      rows={compatto ? 1 : 3}
      autoFocus={autoFocus}
      style={compatto
        ? { flex: 1, height: 'auto', minHeight: 40, padding: '9px 12px', resize: 'none', lineHeight: 1.35, overflowY: 'auto' }
        : { height: 'auto', padding: '10px 12px', resize: 'none', lineHeight: 1.5 }}
    />
  )
  const avviso = errore && (
    <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', lineHeight: 1.5 }}>{errore}</div>
  )

  if (compatto) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {intestazione}
        {avviso}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          {textarea}
          <button
            onClick={() => { void manda() }}
            disabled={lavoro || vuoto}
            aria-label={etichetta}
            title={etichetta}
            aria-busy={lavoro || undefined}
            className="j-btn-accent-sm"
            style={{ width: 40, height: 40, padding: 0, flexShrink: 0, opacity: lavoro || vuoto ? 0.5 : 1 }}
          >
            <Icons.invia size={18} stroke={2.2}/>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {intestazione}
      {textarea}
      {avviso}
      <button
        onClick={() => { void manda() }}
        disabled={lavoro || vuoto}
        className="j-btn-accent-sm"
        style={{ opacity: lavoro || vuoto ? 0.5 : 1 }}
      >
        {lavoro ? t('Invio…') : etichetta}
      </button>
    </div>
  )
}
