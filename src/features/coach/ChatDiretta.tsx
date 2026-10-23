// La chat fra un allenatore e un allievo: il filo diretto, che non parla di una
// scheda in particolare (vedi `idChat` in lib/messaggi).
//
// È la stessa da tutti e due i lati — chi segue la apre dalla scheda
// dell'allievo, chi è seguito dal suo coach — e ci finiscono anche gli avvisi
// che l'app scrive da sé: "allenamento finito", "scheda assegnata". Così a un
// allenamento andato storto si risponde dove se ne è avuta notizia, senza un
// posto a parte per "commentare la sessione".
//
// Va dentro una `Pagina fisso`: scorrono i messaggi, e il campo per scrivere
// resta fermo in fondo. Prima stava sotto l'ultimo messaggio, e in una chat
// lunga per rispondere bisognava scendere fino in fondo.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'
import { bozzaChat, idChat, perData } from '@/lib/messaggi'
import { useMessaggi, segnaLettiOra, invia, RITMO_APERTO } from '@/lib/messaggiLive'
import { Bolla, Composer } from './messaggiUI'
import { BarraScrittura } from './PezziCoach'

export function ChatDiretta({ coachId, athleteId, io, mioNome }: {
  coachId: string
  athleteId: string
  /** Il mio id: sono uno dei due. */
  io: string
  mioNome: string
}) {
  const t = useT()
  // Ritmo svelto: una chat aperta davanti agli occhi (vedi messaggiLive).
  const { messaggi, primoGiroFatto, errore } = useMessaggi(RITMO_APERTO)
  const filo = useMemo(() => {
    const id = idChat(coachId, athleteId)
    return messaggi.filter(m => m.scheda_id === id).sort(perData)
  }, [messaggi, coachId, athleteId])

  // Una chat aperta è una chat letta, anche per ciò che arriva mentre la si guarda.
  useEffect(() => { segnaLettiOra(filo, io) }, [filo, io])

  const scrivi = (testo: string) => invia(bozzaChat({
    coachId, athleteId, autore: io, autoreNome: mioNome, tipo: 'chat', testo,
  }))

  return (
    <>
      <ListaMessaggi conteggio={filo.length}>
        {filo.length === 0 ? (
          <div className="j-empty">
            {!primoGiroFatto ? t('Caricamento…')
              : errore ? t('I messaggi non si possono leggere adesso. Riprova più tardi.')
              : t('Nessun messaggio. Scrivi il primo.')}
          </div>
        ) : (
          filo.map(m => <Bolla key={m.id} m={m} io={io}/>)
        )}
        {errore && filo.length > 0 && (
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', textAlign: 'center' }}>{errore}</div>
        )}
      </ListaMessaggi>
      <BarraScrittura>
        <Composer compatto placeholder={t('Scrivi un messaggio…')} etichetta={t('Invia')} onInvia={scrivi}/>
      </BarraScrittura>
    </>
  )
}

/** L'area dei messaggi, l'unica che scorre. Pochi messaggi stanno in basso,
 *  vicino al campo, come in ogni chat; quando ne arriva uno si torna in fondo,
 *  che è dove si sta leggendo. */
export function ListaMessaggi({ conteggio, children }: {
  /** Quanti messaggi ci sono: quando cambia si scende in fondo. */
  conteggio: number
  children: React.ReactNode
}) {
  const lista = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = lista.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conteggio])
  return (
    <div ref={lista} style={{
      flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain',
      display: 'flex', flexDirection: 'column',
      padding: '4px 20px 12px',
    }}>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}
