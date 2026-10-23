// "Messaggi": la sezione del Personal Coach dove arrivano le richieste.
//
// Sta dalla parte di chi ha condiviso la scheda. L'allievo scrive dalla scheda
// stessa — col punto interrogativo in testata, dove la domanda resta attaccata
// all'esercizio di cui parla (vedi GymSchede) — e qui le richieste si leggono
// raccolte per scheda e si risponde.
//
// Non è una chat generica ed è una scelta: un filo per SCHEDA, non per persona.
// Chi allena tre persone con cinque schede a testa ha quindici conversazioni, e
// ognuna parla di un allenamento preciso; impilate per persona sarebbero un
// unico muro in cui la domanda sulla panca del lunedì sta sotto quella sugli
// stacchi del giovedì.
import { useState, useMemo, useEffect } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { Avatar } from '@/components/ui/Avatar'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { useT } from '@/lib/i18n'
import { fmtQuando } from '@/lib/dateFormat'
import { conversazioni, type Conversazione } from '@/lib/messaggi'
import { useMessaggi, segnaLettiOra, invia, RITMO_APERTO, RITMO_FONDO } from '@/lib/messaggiLive'
import { useProfiliStore, nomeCompleto } from '@/lib/profili'
import { Bolla, BadgeNonLetti, Composer } from './messaggiUI'
import { ChatDiretta, ListaMessaggi } from './ChatDiretta'
import { Pagina, BarraScrittura } from './PezziCoach'

/** La pagina della chat: l'elenco delle conversazioni, e dentro ciascuna. Si
 *  apre dall'icona in alto a destra del Coaching — era la terza card, accanto a
 *  "Coach" e "Seguiti", e si leggeva come un terzo modo di stare collegati. */
export function CoachMessaggi({ userId, userName, nomi, onBack, isDesktop }: {
  userId: string
  userName: string
  /** id → nome delle persone con cui sono collegato. Serve quando in un filo
   *  l'altro non ha ancora scritto: il suo nome di solito si legge dai suoi
   *  messaggi, e senza questo una chat appena aperta si chiamerebbe "Allenatore". */
  nomi?: Map<string, string>
  onBack: () => void
  isDesktop: boolean
}) {
  const t = useT()
  const profili = useProfiliStore(s => s.profili)
  const altroDi = (c: Conversazione) => (c.sonoCoach ? c.athleteId : c.coachId)
  // Il nome del profilo prima di tutto: nome e cognome, scelti dalla persona.
  const nomeDi = (c: Conversazione) => nomeCompleto(
    profili[altroDi(c)],
    nomi?.get(altroDi(c)) || c.controparte || (c.sonoCoach ? t('Allievo') : t('Allenatore')),
  )
  // Quale filo è aperto. Null = l'elenco.
  const [apertaId, setApertaId] = useState<string | null>(null)
  // Ritmo svelto solo con un filo aperto: l'elenco si accontenta del giro di
  // fondo, che è lo stesso che tiene acceso il badge in home.
  const { messaggi, primoGiroFatto, errore } = useMessaggi(apertaId ? RITMO_APERTO : RITMO_FONDO)

  const fili = useMemo(() => conversazioni(messaggi, userId), [messaggi, userId])
  const aperta = apertaId ? fili.find(c => c.schedaId === apertaId) ?? null : null

  // Il filo aperto è un filo letto. Anche per i messaggi che arrivano MENTRE lo
  // si guarda: sono già sotto gli occhi, e lasciarli non letti accenderebbe un
  // badge per qualcosa che si sta leggendo.
  useEffect(() => {
    if (aperta && aperta.daLeggere > 0) segnaLettiOra(aperta.messaggi, userId)
  }, [aperta, userId])

  // La chat diretta ha il suo componente: niente "rispondi su", è una
  // conversazione e non un elenco di richieste da evadere.
  if (aperta?.diretta) {
    return (
      <Pagina titolo={nomeDi(aperta)} onBack={() => setApertaId(null)} isDesktop={isDesktop} fisso>
        <ChatDiretta coachId={aperta.coachId} athleteId={aperta.athleteId} io={userId} mioNome={userName}/>
      </Pagina>
    )
  }
  if (aperta) {
    return (
      <Pagina titolo={nomeDi(aperta)} onBack={() => setApertaId(null)} isDesktop={isDesktop} fisso>
        <FiloAperto conv={aperta} userId={userId} userName={userName}/>
      </Pagina>
    )
  }

  return (
    <Pagina titolo={t('Chat')} onBack={onBack} isDesktop={isDesktop}>
      {elenco()}
    </Pagina>
  )

  // Una funzione e non un componente: dichiarato qui dentro, React lo vedrebbe
  // nuovo a ogni giro dei messaggi e ricostruirebbe l'elenco da capo.
  function elenco() {
    // Tre stati, non due, ed è la differenza fra "aspetta" e "aspetta per sempre".
    // "Caricamento…" dura finché il primo giro non è FINITO — riuscito o fallito
    // (vedi `primoGiroFatto` in messaggiLive): se la tabella sul server non c'è
    // ancora, il giro fallisce sempre, e una scritta che aspetta il successo resta
    // lì a vita. Finito il giro si dice una cosa o l'altra: cosa è andato storto,
    // oppure che di richieste non ce n'è.
    if (!primoGiroFatto && fili.length === 0) {
      return <div className="j-empty">{t('Caricamento…')}</div>
    }

    if (fili.length === 0) {
      return (
        <>
          <NucEyebrow>{t('Conversazioni')}</NucEyebrow>
          {errore ? (
            <>
              <div style={{
                padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius)',
                background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.24)',
                fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5, color: 'var(--danger)',
              }}>{errore}</div>
              <div className="j-empty">{t('Le richieste non si possono leggere adesso. Riprova più tardi.')}</div>
            </>
          ) : (
            <div className="j-empty">
              {t('Nessuna conversazione. Per scrivere a qualcuno aprilo da “Coaching” o da “Seguiti”; chi riceve una tua scheda può anche chiederti info o una sostituzione dal punto interrogativo in cima alla scheda.')}
            </div>
          )}
        </>
      )
    }

    return (
      <>
        <NucEyebrow>{t('Conversazioni')}</NucEyebrow>
        {/* `overflow: hidden` perché le righe si accendono al passaggio (j-riga-gruppo):
            senza, il fondo della prima e dell'ultima esce dagli angoli smussati della
            card e disegna due spigoli vivi dove non ce ne sono. */}
        <NucCard pad={0} style={{ overflow: 'hidden' }}>
          {fili.map((c, i) => {
            const nome = nomeDi(c)
            return (
              <button
                key={c.schedaId}
                onClick={() => setApertaId(c.schedaId)}
                className="j-riga-gruppo"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
                }}
              >
                <Avatar foto={profili[altroDi(c)]?.foto} nome={nome} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: NUC.font, fontSize: 14.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nome}
                    </span>
                    <BadgeNonLetti n={c.daLeggere}/>
                  </div>
                  {/* Di cosa si parla: solo per i fili su una scheda. La chat è
                      la chat, e dirlo su ogni riga era una parola ripetuta. */}
                  {!c.diretta && (
                    <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.06em', color: 'var(--tertiary-ink)', marginTop: 1, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.schedaTitolo || t('Scheda')}
                    </div>
                  )}
                  {/* L'ultima riga scritta, su una riga sola: è quello che dice se
                      vale la pena entrare adesso o dopo. */}
                  <div style={{ fontFamily: NUC.font, fontSize: 12, color: 'var(--fg-mute)', marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ultimo.autore === userId ? `${t('tu')}: ` : ''}{c.ultimo.testo}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.04em', color: 'var(--fg-mute)' }}>
                    {fmtQuando(c.ultimo.created_at)}
                  </div>
                  <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', marginTop: 4, display: 'inline-block' }}/>
                </div>
              </button>
            )
          })}
        </NucCard>
      </>
    )
  }
}

// ── Un filo aperto ─────────────────────────────────────────────
function FiloAperto({ conv, userId, userName }: {
  conv: Conversazione
  userId: string
  userName: string
}) {
  const t = useT()

  // Gli esercizi di cui si è parlato in questo filo, nell'ordine in cui sono
  // usciti. Sono i bersagli fra cui scegliere rispondendo: una risposta che non
  // dice a cosa si riferisce, in un filo con tre domande aperte, va indovinata.
  const bersagli = useMemo(() => {
    const visti = new Map<string, string>()
    for (const m of conv.messaggi) {
      if (m.esercizio_id && !visti.has(m.esercizio_id)) {
        visti.set(m.esercizio_id, m.esercizio_nome ?? t('Esercizio'))
      }
    }
    return [...visti].map(([id, nome]) => ({ id, nome }))
  }, [conv.messaggi, t])

  // Si parte dall'esercizio dell'ultimo messaggio: è quello a cui si sta
  // rispondendo nove volte su dieci, ed è quello che si ha appena letto.
  const [bersaglio, setBersaglio] = useState<string | null>(conv.ultimo.esercizio_id)
  const nomeBersaglio = bersagli.find(b => b.id === bersaglio)?.nome

  const rispondi = async (testo: string) => {
    await invia({
      scheda_id: conv.schedaId,
      scheda_titolo: conv.schedaTitolo || null,
      coach_id: conv.coachId,
      athlete_id: conv.athleteId,
      autore: userId,
      autore_nome: userName.trim() || null,
      esercizio_id: bersaglio,
      esercizio_nome: nomeBersaglio ?? null,
      // Chi risponde risponde: il tipo serve all'altro lato a distinguere una
      // richiesta aperta da una già evasa, e marcare la propria risposta come
      // "info" la farebbe sembrare una domanda di ritorno.
      tipo: 'risposta',
      testo,
    })
  }

  // Il nome dell'esercizio si stampa quando CAMBIA, non su ogni bolla: in una
  // sequenza di quattro messaggi sullo stesso esercizio, ripeterlo quattro volte
  // è rumore che copre i messaggi.
  let ultimoTitolo: string | null = null

  return (
    <>
      <ListaMessaggi conteggio={conv.messaggi.length}>
        {/* La scheda di cui si parla: in testata c'è il nome della persona. */}
        <div className="j-eyebrow" style={{ textAlign: 'center', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {conv.schedaTitolo || t('Scheda')}
        </div>
        {conv.messaggi.map(m => {
          const titolo = m.esercizio_nome ?? null
          const mostraTitolo = titolo !== ultimoTitolo
          ultimoTitolo = titolo
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mostraTitolo && <SeparatoreEsercizio nome={titolo}/>}
              <Bolla m={m} io={userId}/>
            </div>
          )
        })}
      </ListaMessaggi>

      <BarraScrittura>
        <Composer
          compatto
          placeholder={t('Scrivi la risposta…')}
          etichetta={t('Rispondi')}
          onInvia={rispondi}
          intestazione={bersagli.length > 0 && (
            // Su una riga che scorre di lato: tre esercizi a capo erano tre righe
            // tolte ai messaggi, in una fascia che non si sposta mai.
            <div className="flex items-center gap-1.5" style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
              <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginRight: 2 }}>
                {t('Rispondi su')}
              </span>
              <ChipBersaglio nome={t('la scheda')} scelto={bersaglio === null} onClick={() => setBersaglio(null)}/>
              {bersagli.map(b => (
                <ChipBersaglio key={b.id} nome={b.nome} scelto={bersaglio === b.id} onClick={() => setBersaglio(b.id)}/>
              ))}
            </div>
          )}
        />
      </BarraScrittura>
    </>
  )
}

function SeparatoreEsercizio({ nome }: { nome: string | null }) {
  const t = useT()
  const filo = <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--hairline-soft)' }}/>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      {filo}
      <span style={{ fontFamily: NUC.label, fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
        {nome ?? t('sulla scheda')}
      </span>
      {filo}
    </div>
  )
}

function ChipBersaglio({ nome, scelto, onClick }: { nome: string; scelto: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={scelto}
      style={{
        flexShrink: 0, padding: '4px 9px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        background: scelto ? 'var(--j-accent)' : 'var(--surface-2)',
        border: `1px solid ${scelto ? 'var(--j-accent)' : 'var(--hairline)'}`,
        color: scelto ? 'var(--j-accent-fg)' : 'var(--fg-mute)',
        fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
        maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'background 160ms, color 160ms, border-color 160ms',
      }}
    >
      {nome}
    </button>
  )
}
