// La chat fra un allenatore e un allievo: il filo diretto, che non parla di una
// scheda in particolare (vedi `idChat` in lib/messaggi).
//
// È la stessa da tutti e due i lati — chi segue la apre dalla scheda
// dell'allievo, chi è seguito dall'elenco di chi lo segue — e ci finiscono anche
// gli avvisi che l'app scrive da sé: "allenamento finito", "scheda assegnata".
// Così a un allenamento andato storto si risponde dove se ne è avuta notizia,
// senza un posto a parte per "commentare la sessione".
import { useEffect, useMemo, useRef } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { NucCard } from '@/components/ui/NucComponents'
import { useT } from '@/lib/i18n'
import { bozzaChat, idChat } from '@/lib/messaggi'
import { useMessaggi, segnaLettiOra, invia, RITMO_APERTO } from '@/lib/messaggiLive'
import { Bolla, Composer } from './messaggiUI'

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
    return messaggi.filter(m => m.scheda_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [messaggi, coachId, athleteId])

  // Una chat aperta è una chat letta, anche per ciò che arriva mentre la si guarda.
  useEffect(() => { segnaLettiOra(filo, io) }, [filo, io])

  // Si resta in fondo, dove arriva il messaggio nuovo: è lì che si sta leggendo.
  const fondo = useRef<HTMLDivElement>(null)
  useEffect(() => { fondo.current?.scrollIntoView?.({ block: 'end' }) }, [filo.length])

  const scrivi = (testo: string) => invia(bozzaChat({
    coachId, athleteId, autore: io, autoreNome: mioNome, tipo: 'chat', testo,
  }))

  return (
    <>
      {filo.length === 0 ? (
        <div className="j-empty" style={{ marginBottom: 14 }}>
          {!primoGiroFatto ? t('Caricamento…')
            : errore ? t('I messaggi non si possono leggere adesso. Riprova più tardi.')
            : t('Nessun messaggio. Scrivi il primo.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {filo.map(m => <Bolla key={m.id} m={m} io={io}/>)}
          <div ref={fondo}/>
        </div>
      )}
      {errore && filo.length > 0 && (
        <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', marginBottom: 8 }}>{errore}</div>
      )}
      <NucCard pad={13}>
        <Composer placeholder={t('Scrivi un messaggio…')} etichetta={t('Invia')} onInvia={scrivi}/>
      </NucCard>
    </>
  )
}
