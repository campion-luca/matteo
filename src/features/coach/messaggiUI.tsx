// I pezzi visivi di una conversazione, usati da tutte e due le parti: l'allievo
// li vede dentro la scheda che gli è stata assegnata, l'allenatore nella sezione
// "Messaggi" del Personal Coach. Stanno in un file a parte perché sono
// letteralmente la stessa cosa vista dai due lati, e due copie che divergono
// significano due modi diversi di mostrare lo stesso messaggio alle due persone
// che lo stanno leggendo insieme.
import { useState, type CSSProperties, type ReactNode } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { useT } from '@/lib/i18n'
import { fmtQuando } from '@/lib/dateFormat'
import type { Messaggio, TipoMessaggio } from '@/lib/messaggi'

/** Il pallino rosso con il numero. Rosso e non accent: l'accent in tema premium è
 *  bianco, e un badge bianco su fondo nero non è una notifica, è una decorazione.
 *  `--segnale-giu` è l'unico rosso che resta rosso in ogni tema (in premium
 *  `--danger` diventa bianco). */
export function BadgeNonLetti({ n, style }: { n: number; style?: CSSProperties }) {
  if (n <= 0) return null
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 17, height: 17, padding: '0 5px', boxSizing: 'border-box',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--segnale-giu)', color: '#fff',
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
  if (tipo === 'risposta') return null
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
 *  serve una legenda per capirla. */
export function Bolla({ m, io, onElimina }: {
  m: Messaggio
  io: string
  /** Solo sui propri: cancellare il messaggio di un altro non è un gesto che
   *  esiste. */
  onElimina?: () => void
}) {
  const t = useT()
  const mio = m.autore === io
  return (
    <div style={{ display: 'flex', justifyContent: mio ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '86%', minWidth: 0,
        padding: '9px 11px',
        borderRadius: 'var(--radius)',
        background: mio ? 'color-mix(in srgb, var(--j-accent) 14%, var(--surface))' : 'var(--surface-2)',
        border: `1px solid ${mio ? 'var(--j-accent)' : 'var(--hairline)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontFamily: NUC.label, fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
            {mio ? t('tu') : (m.autore_nome?.trim() || t('Allenatore'))}
          </span>
          <EtichettaTipo tipo={m.tipo}/>
          <span style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.04em', color: 'var(--fg-mute)', marginLeft: 'auto' }}>
            {fmtQuando(m.created_at)}
          </span>
          {onElimina && (
            <button
              onClick={onElimina}
              aria-label={t('Elimina messaggio')}
              className="j-hit"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--fg-mute)', display: 'flex' }}
            >
              <Icons.x size={11} stroke={2}/>
            </button>
          )}
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 13.5, lineHeight: 1.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {m.testo}
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
 *  identici, e in una conversazione un doppione si legge come insistenza. */
export function Composer({ placeholder, etichetta, onInvia, autoFocus, intestazione }: {
  placeholder: string
  etichetta: string
  onInvia: (testo: string) => Promise<unknown>
  autoFocus?: boolean
  /** Una riga sopra il campo: a cosa si sta rispondendo. */
  intestazione?: ReactNode
}) {
  const t = useT()
  const [testo, setTesto] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {intestazione}
      <textarea
        value={testo}
        onChange={e => { setTesto(e.target.value); if (errore) setErrore(null) }}
        // Invio manda, Maiusc+Invio va a capo. Su telefono la tastiera dà il
        // ritorno a capo e non l'invio, quindi il tasto sotto resta l'unica via
        // garantita: è lì anche quando questa scorciatoia non c'è.
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void manda()
          }
        }}
        placeholder={placeholder}
        className="j-field"
        rows={3}
        autoFocus={autoFocus}
        style={{ height: 'auto', padding: '10px 12px', resize: 'none', lineHeight: 1.5 }}
      />
      {errore && (
        <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', lineHeight: 1.5 }}>{errore}</div>
      )}
      <button
        onClick={() => { void manda() }}
        disabled={lavoro || testo.trim() === ''}
        className="j-btn-accent-sm"
        style={{ opacity: lavoro || testo.trim() === '' ? 0.5 : 1 }}
      >
        {lavoro ? t('Invio…') : etichetta}
      </button>
    </div>
  )
}
