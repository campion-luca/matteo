// Personal Coach: collegare due account e guardare gli allenamenti dell'altro.
//
// Ha preso il posto del vecchio "Personal Coach", che calcolava fabbisogno
// calorico, proteine e obiettivo di peso. Il nome è rimasto perché è quello che
// la voce di menù è diventata: un coach è una persona, non una formula.
//
// Due ruoli nella stessa schermata, perché sono due lati della stessa cosa e la
// stessa persona può stare da entrambi (chi allena si allena anche).
//
//  • "Coach"    — genero un codice, lo do a chi mi deve seguire, e vedo chi
//                 ha accesso ai miei allenamenti. Da qui glielo tolgo.
//  • "Seguiti"  — inserisco il codice di qualcuno e ne apro la scheda.
//  • "Chat"     — i messaggi con gli uni e con gli altri.
// (Fino a ottobre 2026 si chiamavano "Ti seguono", "Segui" e "Messaggi".)
//
// Il codice lo genera SEMPRE chi condivide i propri dati. Nel verso opposto
// l'allenatore manderebbe una richiesta e all'allievo resterebbe da accettarla —
// un consenso che si dà per non far aspettare l'altro, che è il modo peggiore di
// darlo. Le regole vere stanno nel database: vedi supabase/coach_schema.sql.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { localISO, giorniTra, todayISO } from '@/lib/isoDate'
import { natalDi, etaScheda } from '@/features/gym/anteprimaScheda'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { DisegnoAzione } from '@/features/gym/DisegniAzioni'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useT } from '@/lib/i18n'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { useJarvisStore } from '@/store/useJarvisStore'
import { fmtShortDate } from '@/lib/dateFormat'
import {
  activeInvite, createInvite, revokeInvite,
  myAthletes, myCoaches, redeemCode, unlink, athleteData,
  schedeAssegnate, salvaSchedaAssegnata, eliminaSchedaAssegnata, type CoachScheda,
  noteAllievo, salvaNotaCoach, type NotaCoach,
  type CoachLink, type CoachInvite, type AthleteData,
} from '@/lib/coach'
import { CoachAthlete, NoteEsercizi } from './CoachAthlete'
import { CoachConfronto } from './CoachConfronto'
import { CoachMessaggi } from './CoachMessaggi'
import { BadgeNonLetti } from './messaggiUI'
import { useNonLetti, useMessaggi, avvisa } from '@/lib/messaggiLive'
import { bozzaChat, idChat, nonLetti } from '@/lib/messaggi'
import { ChatDiretta } from './ChatDiretta'
import { fmtKg, fmtReps } from '@/features/gym/gymModel'
import { CoachSessioni } from './CoachSessioni'
import { CoachGrafici, CoachEsercizio } from './CoachEsercizi'
import { SchedaFormPage } from '@/features/gym/GymSchede'
import { EditHistoryModal } from '@/features/gym/gymModals'
import { caricoDiRiferimento } from '@/features/gym/limitiAlzata'
import { correzioniPer, salvaCorrezione, applicaCorrezioni } from '@/lib/correzioni'
import type { GymScheda, PalestraHistoryEntry } from '@/store/useJarvisStore'

// Le tre sezioni del Personal Coach. "messaggi" è la terza e sta a destra: le
// prime due sono i due lati del collegamento (chi ti segue, chi segui), la terza
// è quello che succede DOPO che il collegamento c'è.
type Ruolo = 'seguito' | 'allenatore' | 'messaggi'

export function JarvisCoach({ userId, onBack, iniziale = 'seguito' }: {
  userId: string
  onBack: () => void
  /** La sezione su cui aprirsi. Chi arriva toccando una notifica vuole i
   *  messaggi, non il proprio codice. */
  iniziale?: Ruolo
}) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const userName = useJarvisStore(st => st.userName)
  const { confirmDelete } = useConfirmDelete()

  const [ruolo, setRuolo] = useState<Ruolo>(iniziale)
  // La chat aperta con uno dei miei allenatori (io sono l'allievo).
  const [chatCon, setChatCon] = useState<CoachLink | null>(null)
  const daLeggere = useNonLetti()
  const [invito, setInvito] = useState<CoachInvite | null>(null)
  const [allenatori, setAllenatori] = useState<CoachLink[]>([])
  const [atleti, setAtleti] = useState<CoachLink[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  // L'allievo aperto: id + nome dal collegamento (il nome vero arriva col dato,
  // ma serve un titolo anche mentre il dato sta ancora arrivando).
  const [aperto, setAperto] = useState<CoachLink | null>(null)

  // `piano` = senza la scritta "Caricamento…": per gli aggiornamenti che
  // arrivano mentre si sta guardando la pagina. Con la scritta, tutta la
  // schermata si smontava e rimontava — e "Collegato a Luca", appena comparso
  // sotto il campo del codice, spariva prima di potersi leggere.
  const ricarica = useCallback(async (piano = false) => {
    if (!piano) setCaricamento(true)
    setErrore(null)
    try {
      const [inv, cs, as] = await Promise.all([
        activeInvite(userId),
        myCoaches(userId),
        myAthletes(userId),
      ])
      // Un coach c'è già: un codice ancora valido non serve più a nessuno (se
      // ne può avere uno solo), e la sua card non è nemmeno a schermo per
      // annullarlo. Si toglie da sé invece di restare in giro per sette giorni.
      if (inv && cs.length > 0) {
        void revokeInvite(userId).catch(() => { /* scade comunque da solo */ })
        setInvito(null)
      } else {
        setInvito(inv)
      }
      setAllenatori(cs)
      setAtleti(as)
    } catch (e) {
      if (!piano) setErrore(messaggio(e))
    } finally {
      if (!piano) setCaricamento(false)
    }
  }, [userId])

  useEffect(() => { void ricarica() }, [ricarica])

  // Chi ha dato il proprio codice e sta guardando questa pagina vede comparire
  // il coach appena quello lo riscatta: l'avviso "ti seguo" arriva come
  // messaggio (vedi `collega`), e quando ne arriva uno nuovo si rilegge chi mi
  // segue. Prima restava a schermo il codice già consumato e "Nessuno", finché
  // non si usciva e rientrava.
  const { messaggi: tuttiIMessaggi } = useMessaggi()
  const collegamenti = useMemo(() => tuttiIMessaggi.filter(m => m.tipo === 'collegamento').length, [tuttiIMessaggi])
  useEffect(() => { if (collegamenti > 0) void ricarica(true) }, [collegamenti, ricarica])

  // I nomi di chi seguo e di chi mi segue, per l'elenco dei messaggi.
  const nomi = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of atleti) if (l.athlete_name) m.set(l.athlete_id, l.athlete_name)
    for (const l of allenatori) if (l.coach_name) m.set(l.coach_id, l.coach_name)
    return m
  }, [atleti, allenatori])

  // Lo scollegamento fallisce solo per rete o sessione scaduta, ma se fallisce in
  // silenzio la riga sparisce dalla lista e l'altro continua a vedere i dati: è
  // l'unico errore di questa schermata che l'utente DEVE vedere.
  const scollega = async (link: CoachLink, dopo: () => void) => {
    try {
      await unlink(link.coach_id, link.athlete_id)
      dopo()
      setErrore(null)
    } catch (e) {
      setErrore(messaggio(e))
    }
  }

  if (aperto) {
    return <SchedaAllievo link={aperto} onBack={() => setAperto(null)}/>
  }

  if (chatCon) {
    return (
      <Pagina titolo={chatCon.coach_name || t('Allenatore')} onBack={() => setChatCon(null)} isDesktop={isDesktop}>
        <ChatDiretta coachId={chatCon.coach_id} athleteId={chatCon.athlete_id} io={userId} mioNome={userName}/>
      </Pagina>
    )
  }

  return (
    <Pagina titolo={t('Personal Coach')} onBack={onBack} isDesktop={isDesktop}>
      <SezioniCoach
        valore={ruolo}
        onChange={setRuolo}
        daLeggere={daLeggere}
        // Finché l'elenco non è arrivato sotto il nome non si scrive niente:
        // "Nessuno" per un secondo, a chi un coach ce l'ha, sarebbe una bugia.
        sotto={caricamento ? {} : {
          seguito: allenatori.length ? (allenatori[0].coach_name || t('Allenatore')) : t('Nessuno'),
          allenatore: atleti.length === 0 ? t('Nessuno') : atleti.length === 1 ? t('1 allievo') : t('{n} allievi', { n: atleti.length }),
          messaggi: daLeggere > 0 ? t('{n} da leggere', { n: daLeggere }) : undefined,
        }}
      />

      {errore && <Avviso testo={errore} tono="errore"/>}

      {caricamento ? (
        <div className="j-empty">{t('Caricamento…')}</div>
      ) : (
        <>
        {/* I due lati restano montati entrambi, e si nasconde quello non scelto.
            Smontarli e rimontarli a ogni tocco del selettore ricreava card e
            tasti di vetro, e Safari su iPhone mentre ricrea il `backdrop-filter`
            li fa lampeggiare chiari: era la banda luminosa che compariva
            passando a "Segui". Non hanno effetti al montaggio, tenerli vivi non
            costa niente — e il codice scritto a metà non si perde cambiando lato. */}
        <div hidden={ruolo !== 'seguito'}>
        <LatoSeguito
          userId={userId}
          userName={userName}
          invito={invito}
          allenatori={allenatori}
          onInvito={setInvito}
          onErrore={setErrore}
          onScrivi={setChatCon}
          onRimuovi={link => confirmDelete(
            () => { void scollega(link, () => setAllenatori(a => a.filter(x => x.coach_id !== link.coach_id))) },
            link.coach_name || t('questo allenatore'),
            {
              eyebrow: t('Scollega'),
              title: t('Togliere l’accesso?'),
              body: t('{chi} non vedrà più i tuoi allenamenti. I tuoi dati restano intatti.', { chi: link.coach_name || t('Questa persona') }),
              cta: t('Scollega'),
            },
          )}
        />
        </div>
        {/* I messaggi invece si smontano chiudendo la sezione, al contrario dei
            due lati qui sotto: lì si tengono vivi per non ricreare il vetro a
            ogni tocco, ma questo tiene aperta una conversazione e il ritmo
            svelto delle richieste al server (vedi messaggiLive). Lasciarlo
            montato dietro un `hidden` significherebbe interrogare il server ogni
            tre secondi stando a guardare tutt'altro. */}
        {ruolo === 'messaggi' && <CoachMessaggi userId={userId} userName={userName} nomi={nomi}/>}
        <div hidden={ruolo !== 'allenatore'}>
        <LatoAllenatore
          userId={userId}
          userName={userName}
          atleti={atleti}
          onCollegato={() => { void ricarica(true) }}
          onApri={setAperto}
          onRimuovi={link => confirmDelete(
            () => { void scollega(link, () => setAtleti(a => a.filter(x => x.athlete_id !== link.athlete_id))) },
            link.athlete_name || t('questo allievo'),
            {
              eyebrow: t('Scollega'),
              title: t('Togliere dalla lista?'),
              body: t('Non vedrai più gli allenamenti di {chi}. Per rientrare servirà un codice nuovo.', { chi: link.athlete_name || t('questa persona') }),
              cta: t('Scollega'),
            },
          )}
        />
        </div>
        </>
      )}
    </Pagina>
  )
}

// ── Le tre sezioni, in cima ────────────────────────────────────
// Tre card come quelle in home (Coaching · Schede · Statistiche), non più una
// barra di tre parole: «Coach» è chi allena te, «Seguiti» chi alleni tu, «Chat»
// i messaggi con tutti e due. Ognuna col suo disegno e la sua tinta — le stesse
// tre di casa (`--azione-…`), così nei temi a colore unico restano in riga col
// resto.
//
// A differenza di quelle in home non aprono una pagina: scelgono cosa c'è sotto,
// quindi una delle tre è sempre accesa. Accesa = tinta piena e bordo deciso; le
// altre due si ritirano, ma restano leggibili — sono tasti, non decorazione.
const SEZIONI: Array<{ id: Ruolo; disegno: 'allenatore' | 'gruppo' | 'coach'; tinta: string }> = [
  { id: 'seguito',    disegno: 'allenatore', tinta: 'var(--azione-coach)' },
  { id: 'allenatore', disegno: 'gruppo',     tinta: 'var(--azione-schede)' },
  { id: 'messaggi',   disegno: 'coach',      tinta: 'var(--azione-stats)' },
]
const ALTEZZA_SEZIONE = 'clamp(98px, 15dvh, 132px)'

function SezioniCoach({ valore, onChange, daLeggere, sotto }: {
  valore: Ruolo
  onChange: (r: Ruolo) => void
  /** I messaggi non letti: il pallino sulla card della chat. */
  daLeggere: number
  /** Una riga sotto il nome di ogni card: chi è il coach, quanti allievi. */
  sotto: Partial<Record<Ruolo, string>>
}) {
  const t = useT()
  const nomi: Record<Ruolo, string> = { seguito: t('Coach'), allenatore: t('Seguiti'), messaggi: t('Chat') }
  return (
    <div role="tablist" aria-label={t('Personal Coach')} style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'clamp(8px, 2.4vw, 12px)',
      // Il pallino della chat sporge dall'angolo: gli serve spazio sopra.
      marginTop: 6, marginBottom: 18,
    }}>
      {SEZIONI.map(s => {
        const accesa = s.id === valore
        const fondo = `color-mix(in srgb, ${s.tinta} ${accesa ? 30 : 11}%, var(--surface))`
        const colori = {
          '--d1': `color-mix(in srgb, ${s.tinta} ${accesa ? 42 : 26}%, transparent)`,
          '--d2': `color-mix(in srgb, ${s.tinta} ${accesa ? 80 : 46}%, transparent)`,
          '--d3': `color-mix(in srgb, ${s.tinta} 38%, var(--fg))`,
          '--df': fondo,
        } as React.CSSProperties
        const badge = s.id === 'messaggi' ? daLeggere : 0
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={accesa}
            aria-label={badge > 0 ? `${nomi[s.id]} — ${t('{n} da leggere', { n: badge })}` : undefined}
            onClick={() => onChange(s.id)}
            className="j-hard"
            style={{
              position: 'relative', height: ALTEZZA_SEZIONE, minWidth: 0,
              borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left',
              backgroundColor: fondo,
              // Sempre 1.5px, cambia solo il colore: passando da 1 a 2 la card
              // accesa farebbe un saltino di un pixel a ogni tocco.
              border: `1.5px solid color-mix(in srgb, ${s.tinta} ${accesa ? 88 : 24}%, transparent)`,
              color: accesa ? 'var(--fg)' : 'var(--fg-soft)',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end',
              padding: 'clamp(10px, 3vw, 14px)',
              ...colori,
            }}
          >
            <DisegnoAzione id={s.disegno} style={{
              position: 'absolute', top: 'clamp(7px, 2.2vw, 10px)', right: 'clamp(6px, 2vw, 10px)',
              width: `min(clamp(52px, 17vw, 72px), calc(${ALTEZZA_SEZIONE} - 50px))`, height: 'auto',
              pointerEvents: 'none', opacity: accesa ? 1 : 0.8,
            }}/>
            <span style={{
              position: 'relative', maxWidth: '100%',
              fontFamily: NUC.label, fontSize: 'clamp(13px, 3.7vw, 16px)', fontWeight: accesa ? 600 : 500,
              letterSpacing: '.005em', lineHeight: 1.2,
            }}>{nomi[s.id]}</span>
            {/* La riga c'è sempre, anche vuota: senza, il nome scenderebbe di
                una riga nella card che non ha niente da dire. */}
            <span style={{
              position: 'relative', maxWidth: '100%', minHeight: 14, marginTop: 2,
              fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.3, color: 'var(--fg-mute)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{sotto[s.id] ?? ''}</span>
            <BadgeNonLetti n={badge} style={{ position: 'absolute', top: -7, right: -7 }}/>
          </button>
        )
      })}
    </div>
  )
}

// ── Lato "Coach": genero il codice ─────────────────────────────
function LatoSeguito({ userId, userName, invito, allenatori, onInvito, onErrore, onScrivi, onRimuovi }: {
  userId: string
  userName: string
  invito: CoachInvite | null
  allenatori: CoachLink[]
  onInvito: (i: CoachInvite | null) => void
  onErrore: (e: string | null) => void
  /** Apre la chat con questo allenatore. */
  onScrivi: (l: CoachLink) => void
  onRimuovi: (l: CoachLink) => void
}) {
  const t = useT()
  const [lavoro, setLavoro] = useState(false)
  const [copiato, setCopiato] = useState(false)

  const genera = async () => {
    setLavoro(true); onErrore(null)
    try { onInvito(await createInvite(userId, userName.trim())) }
    catch (e) { onErrore(messaggio(e)) }
    finally { setLavoro(false) }
  }

  const annulla = async () => {
    setLavoro(true); onErrore(null)
    try { await revokeInvite(userId); onInvito(null) }
    catch (e) { onErrore(messaggio(e)) }
    finally { setLavoro(false) }
  }

  const copia = async () => {
    if (!invito) return
    try {
      await navigator.clipboard.writeText(invito.code)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 1800)
    } catch {
      // Clipboard negata (contesto non sicuro, permesso rifiutato): il codice è
      // comunque scritto grande sullo schermo e si può ricopiare a mano. Un
      // messaggio d'errore qui direbbe che è andato storto qualcosa di importante.
    }
  }

  // Un allenatore per volta. Finché ce n'è uno il codice non si genera: darne
  // un altro in giro vorrebbe dire due persone a seguire lo stesso allievo, con
  // due schede e due voci sugli stessi esercizi. La regola vera sta nel database
  // (vedi redeem_coach_code); qui la si dice prima che qualcuno ci provi.
  const seguito = allenatori.length > 0

  return (
    <>
      {seguito && (
        <>
          <NucEyebrow>{allenatori.length === 1 ? t('Il tuo coach') : t('I tuoi coach')}</NucEyebrow>
          {allenatori.map(l => (
            <NucCard key={l.coach_id} pad={18} style={{ marginBottom: 12, borderLeft: '3px solid var(--j-accent)' }}>
              {/* Il nome in grande: è la risposta a "chi mi sta seguendo", e
                  stava in una riga da 15px uguale a quelle di un elenco. */}
              <div style={{ fontFamily: NUC.font, fontSize: 30, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.4, color: 'var(--fg)', overflowWrap: 'anywhere' }}>
                {l.coach_name || t('Allenatore')}
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 6 }}>
                {t('Ti segue dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) })}
              </div>
              <div style={{ fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg-soft)', marginTop: 10 }}>
                {t('Vede i tuoi allenamenti, il volume e l’andamento del peso, e può correggere un’alzata scritta male.')}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <Bottone onClick={() => onScrivi(l)}>{t('Scrivigli')}</Bottone>
                <Bottone onClick={() => onRimuovi(l)} variante="chiaro">{t('Scollega')}</Bottone>
              </div>
            </NucCard>
          ))}
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, color: 'var(--fg-mute)', margin: '2px 2px 18px' }}>
            {t('Si può avere un solo coach per volta: per cambiarlo, scollegati prima da quello che hai.')}
          </div>
        </>
      )}

      {!seguito && (
      <>
      <NucEyebrow>{t('Il tuo codice')}</NucEyebrow>
      <NucCard pad={16} style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
          {/* Non più "in sola lettura": chi ti segue può correggere un'alzata
              scritta male (vedi lib/correzioni), e va detto a chi sta per
              dargli il codice. */}
          {t('Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso, e potrà correggere un’alzata scritta male.')}{' '}
          {t('Puoi togliergli l’accesso quando vuoi.')}
        </div>

        {invito ? (
          <>
            {/* Il codice è il contenuto della card, non un campo di un modulo:
                si legge da lontano perché spesso si detta o si fotografa. */}
            <button onClick={copia} className="j-focus" style={{
              width: '100%', padding: '14px 12px', cursor: 'pointer',
              background: 'var(--surface-2)', border: '1px solid var(--fg)', borderRadius: 'var(--radius)',
              fontFamily: NUC.font, fontSize: 32, fontWeight: 500,
              letterSpacing: '.22em', textIndent: '.22em',
              color: 'var(--fg)',
            }}>
              {invito.code}
            </button>
            <div style={{
              marginTop: 8, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em',
              textTransform: 'uppercase', color: copiato ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
            }}>
              {copiato ? t('Copiato') : t('Tocca per copiare · scade il {data}', { data: fmtShortDate(invito.expires_at.slice(0, 10)) })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Bottone onClick={genera} disabled={lavoro} variante="chiaro">{t('Nuovo codice')}</Bottone>
              <Bottone onClick={annulla} disabled={lavoro} variante="chiaro">{t('Annulla')}</Bottone>
            </div>
          </>
        ) : (
          <Bottone onClick={genera} disabled={lavoro}>
            {lavoro ? t('Attendi…') : t('Genera un codice')}
          </Bottone>
        )}
      </NucCard>

      <NucEyebrow>{t('Chi vede i tuoi allenamenti')}</NucEyebrow>
      <div className="j-empty">{t('Nessuno. I tuoi dati sono solo tuoi.')}</div>
      </>
      )}
    </>
  )
}

// ── Lato "segui": inserisco il codice ──────────────────────────
function LatoAllenatore({ userId, userName, atleti, onCollegato, onApri, onRimuovi }: {
  userId: string
  userName: string
  atleti: CoachLink[]
  onCollegato: () => void
  onApri: (l: CoachLink) => void
  onRimuovi: (l: CoachLink) => void
}) {
  const t = useT()
  const [codice, setCodice] = useState('')
  const [lavoro, setLavoro] = useState(false)
  const [esito, setEsito] = useState<{ testo: string; tono: 'ok' | 'errore' } | null>(null)

  const collega = async () => {
    if (codice.trim().length < 4) return
    setLavoro(true); setEsito(null)
    try {
      const r = await redeemCode(codice, userName.trim())
      setEsito({ testo: t('Collegato a {chi}.', { chi: r.athlete_name || t('questa persona') }), tono: 'ok' })
      setCodice('')
      // L'allievo lo viene a sapere subito, e sa da chi: è il primo messaggio
      // della chat fra i due, e gli arriva come notifica. Prima il collegamento
      // nasceva in silenzio — il codice l'aveva dato lui, ma chi lo avesse usato
      // lo scopriva solo andando a guardare.
      avvisa(bozzaChat({
        coachId: userId, athleteId: r.athlete_id, autore: userId, autoreNome: userName, tipo: 'collegamento',
        testo: t('Da adesso ti seguo io: vedo i tuoi allenamenti e possiamo scriverci da qui.'),
      }))
      onCollegato()
    } catch (e) {
      setEsito({ testo: messaggio(e), tono: 'errore' })
    } finally {
      setLavoro(false)
    }
  }

  return (
    <>
      <NucEyebrow>{t('Collega un allievo')}</NucEyebrow>
      <NucCard pad={16} style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
          {t('Chiedi il codice a chi vuoi seguire: lo genera dalla sua app, in questa stessa schermata.')}
        </div>
        <input
          value={codice}
          onChange={e => setCodice(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') void collega() }}
          placeholder={t('CODICE')}
          // Il segnaposto ha uno stile suo (vedi `.j-codice` in globals.css):
          // con il corpo e il peso del codice vero sembrava un codice già scritto.
          className="j-codice"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          style={{
            width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '0 14px',
            background: 'var(--surface-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
            outline: 'none', textAlign: 'center',
            fontFamily: NUC.font, fontSize: 24, fontWeight: 500,
            letterSpacing: '.2em', textIndent: '.2em', color: 'var(--fg)',
          }}
        />
        <div style={{ marginTop: 10 }}>
          <Bottone onClick={collega} disabled={lavoro || codice.trim().length < 4}>
            {lavoro ? t('Attendi…') : t('Collega')}
          </Bottone>
        </div>
        {esito && <div style={{ marginTop: 10 }}><Avviso testo={esito.testo} tono={esito.tono}/></div>}
      </NucCard>

      <NucEyebrow>{t('I tuoi allievi')}</NucEyebrow>
      {atleti.length === 0 ? (
        <div className="j-empty">{t('Nessun allievo collegato.')}</div>
      ) : (
        <NucCard pad={0}>
          {atleti.map((l, i) => (
            <RigaPersona
              key={l.athlete_id}
              nome={l.athlete_name || t('Allievo')}
              sotto={t('Dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) })}
              primo={i === 0}
              onApri={() => onApri(l)}
              onRimuovi={() => onRimuovi(l)}
            />
          ))}
        </NucCard>
      )}
    </>
  )
}

// ── La scheda di un allievo ────────────────────────────────────
function SchedaAllievo({ link, onBack }: { link: CoachLink; onBack: () => void }) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const { confirmDelete } = useConfirmDelete()
  const [dati, setDati] = useState<AthleteData | null>(null)
  const [stato, setStato] = useState<'carico' | 'pronto' | 'errore'>('carico')
  const [errore, setErrore] = useState('')

  // Le schede già assegnate a questa persona, e quella eventualmente in scrittura.
  // `form` a null significa "nessun form aperto"; a `null` DENTRO l'oggetto
  // significa scheda nuova — è la stessa convenzione che usa GymSchede.
  const [assegnate, setAssegnate] = useState<CoachScheda[]>([])
  const [form, setForm] = useState<{ scheda: GymScheda | null } | null>(null)
  const [salvataggio, setSalvataggio] = useState<string | null>(null)

  // Le note che HO scritto io su questa persona. Il filtro sul mio id serve
  // perché la query ne riporta anche di altri suoi allenatori: la RLS le lascia
  // passare (sono visibili all'atleta) ma la colonna che riempio è la mia.
  const [note, setNote] = useState<NotaCoach[]>([])

  // Le due sotto-pagine della scheda allievo. Stanno qui e non dentro
  // CoachAthlete perché l'intestazione con la freccia è di questo livello: da
  // là sotto, cambiare contenuto senza cambiare header avrebbe lasciato un back
  // che esce dall'allievo invece di tornare al suo riepilogo.
  const [sotto, setSotto] = useState<null | 'confronto' | 'note' | 'sessioni' | 'grafici' | 'esercizio' | 'chat'>(null)
  // Quanti messaggi di questa persona devo ancora leggere: sta sul tasto.
  const { messaggi } = useMessaggi()
  const daLeggereChat = useMemo(() => {
    const id = idChat(link.coach_id, link.athlete_id)
    return nonLetti(messaggi.filter(m => m.scheda_id === id), link.coach_id).length
  }, [messaggi, link.coach_id, link.athlete_id])
  // Un avviso nel filo con questa persona, a mio nome: quello che ho appena
  // fatto per lei (una scheda, una nota, una correzione) le arriva come
  // messaggio e come notifica.
  const avvisaAllievo = (tipo: 'scheda' | 'nota' | 'correzione', testo: string) => avvisa(bozzaChat({
    coachId: link.coach_id, athleteId: link.athlete_id,
    autore: link.coach_id, autoreNome: link.coach_name ?? '', tipo, testo,
  }))
  // L'esercizio aperto nei grafici: per id, così dopo una correzione la pagina
  // rilegge l'esercizio aggiornato invece di restare sulla copia di prima.
  const [esercizioId, setEsercizioId] = useState<string | null>(null)
  // L'alzata che sto correggendo (vedi lib/correzioni).
  const [correggo, setCorreggo] = useState<{ exId: string; vecchia: PalestraHistoryEntry } | null>(null)

  // I dati dell'allievo, con sopra le mie correzioni che la sua app non ha
  // ancora applicato: così vedo subito il numero giusto, senza aspettare che
  // lui riapra l'app. Se la tabella delle correzioni non c'è ancora si leggono
  // i dati e basta.
  const leggiDati = useCallback(async (): Promise<AthleteData | null> => {
    const [d, correzioni] = await Promise.all([
      athleteData(link.athlete_id),
      correzioniPer(link.athlete_id).catch(() => []),
    ])
    if (!d?.palestraExercises) return d
    return { ...d, palestraExercises: applicaCorrezioni(d.palestraExercises, correzioni).esercizi }
  }, [link.athlete_id])

  useEffect(() => {
    let vivo = true
    setStato('carico')
    leggiDati()
      .then(d => { if (vivo) { setDati(d); setStato('pronto') } })
      .catch(e => { if (vivo) { setErrore(messaggio(e)); setStato('errore') } })
    return () => { vivo = false }
  }, [leggiDati])

  const ricarica = useCallback(() => {
    schedeAssegnate(link.athlete_id)
      .then(setAssegnate)
      .catch(() => { /* tabella non ancora creata: la sezione resta vuota */ })
  }, [link.athlete_id])
  useEffect(() => { ricarica() }, [ricarica])

  const ricaricaNote = useCallback(() => {
    noteAllievo(link.athlete_id)
      .then(righe => setNote(righe.filter(n => n.coach_id === link.coach_id)))
      .catch(() => { /* idem: nessuna nota è il caso normale */ })
  }, [link.athlete_id, link.coach_id])
  useEffect(() => { ricaricaNote() }, [ricaricaNote])

  // `chiudi: false` per la bozza: il form resta aperto sull'elenco di cosa
  // manca. Chiudendolo, quell'elenco non si leggeva mai e la bozza sembrava un
  // salvataggio riuscito — con una scheda che l'allievo non vede.
  //
  // Restituisce la promessa, e la lascia fallire: il form deve sapere se il
  // salvataggio è riuscito, o direbbe "niente da salvare" a chi sta per uscire
  // con le modifiche ancora solo sullo schermo.
  const salva = (sc: GymScheda, chiudi = true): Promise<void> => {
    setSalvataggio(null)
    // Nuova o già assegnata: lo si guarda PRIMA di salvare, dopo ci sarebbe comunque.
    // Una bozza che diventa scheda è nuova anche lei: l'allievo le bozze non le
    // vede, e "ho aggiornato la scheda" di una che non ha mai visto non dice niente.
    const prima = assegnate.find(r => r.id === sc.id)
    const nuova = !prima || !!prima.scheda.draft
    return salvaSchedaAssegnata(link.coach_id, link.athlete_id, link.coach_name ?? '', sc)
      .then(() => {
        if (chiudi) setForm(null)
        ricarica()
        // Una bozza l'allievo non la vede: non c'è niente di cui avvisarlo.
        if (!sc.draft) {
          avvisaAllievo('scheda', nuova
            ? t('Ti ho assegnato una scheda nuova: «{scheda}».', { scheda: sc.title })
            : t('Ho aggiornato la scheda «{scheda}».', { scheda: sc.title }))
        }
      })
      .catch(e => { setSalvataggio(messaggio(e)); throw e })
  }

  const nome = dati?.userName || link.athlete_name || t('Allievo')

  // Salva la correzione e rilegge: l'alzata porta il mio nome, perché chi la
  // ritrova cambiata deve sapere da chi.
  const correggi = (nuova: PalestraHistoryEntry) => {
    if (!correggo) return
    const { exId, vecchia } = correggo
    setCorreggo(null)
    setSalvataggio(null)
    const esercizio = dati?.palestraExercises?.find(e => e.id === exId)?.n ?? ''
    salvaCorrezione(link.coach_id, link.athlete_id, exId, link.coach_name ?? '', vecchia, {
      ...nuova, correttaDa: link.coach_name?.trim() || t('il tuo allenatore'),
    })
      .then(() => {
        avvisaAllievo('correzione', t('Ho corretto «{esercizio}» del {giorno}: ora è {alzata}.', {
          esercizio,
          giorno: nuova.date ? fmtShortDate(nuova.date) : nuova.d,
          alzata: `${nuova.sets_n} × ${fmtReps(nuova)} – ${fmtKg(nuova)}`,
        }))
        return leggiDati()
      })
      .then(setDati)
      .catch(e => setSalvataggio(messaggio(e)))
  }

  // Il modale della correzione sta SOPRA la pagina, in uno strato suo. Le pagine
  // dell'allenatore sono a z 97, e un modale si monta da sé nella card dell'app
  // a z 90 (vedi useModalHost): ci finiva sotto, aperto e invisibile.
  // `data-jmodal-root` dice al modale di montarsi QUI dentro invece che lassù.
  const conCorrezione = (pagina: React.ReactNode) => (
    <>
      {pagina}
      {correggo && (
        <div data-jmodal-root style={{ position: 'absolute', inset: 0, zIndex: 99 }}>
          <EditHistoryModal
            entry={correggo.vecchia}
            riferimentoKg={caricoDiRiferimento(dati?.palestraExercises?.find(e => e.id === correggo.exId)?.history ?? [], correggo.vecchia)}
            onClose={() => setCorreggo(null)} onSave={correggi}
          />
        </div>
      )}
    </>
  )
  const apriCorrezione = (exId: string, vecchia: PalestraHistoryEntry) => { setSalvataggio(null); setCorreggo({ exId, vecchia }) }

  // Il giorno in cui ho assegnato la prima scheda a questa persona: è da lì che
  // si contano le sue settimane (vedi `perSettimana`). `created_at` è della riga
  // e non cambia modificando la scheda; `createdAt` dentro la scheda è il
  // ripiego per le righe lette prima che la colonna fosse chiesta.
  const primaScheda = useMemo(() => {
    const giorni = assegnate
      .filter(r => !r.scheda.draft)
      .map(r => r.created_at ?? r.scheda.createdAt)
      .filter(Boolean)
      .map(v => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : localISO(new Date(v))))
      .filter(v => /^\d{4}-\d{2}-\d{2}$/.test(v))
    return giorni.length ? giorni.reduce((m, v) => (v < m ? v : m)) : null
  }, [assegnate])

  // Il form è una pagina intera e non un blocco dentro questa: è lo stesso
  // componente che l'atleta usa per le sue schede, ed è fatto per riempire lo
  // schermo. Incastrarlo in una colonna che scorre lo lascerebbe senza altezza.
  if (form) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 98, background: 'var(--bg)', backgroundImage: 'var(--paper-grain)' }}>
        <SchedaFormPage
          scheda={form.scheda}
          // I suggerimenti pescano dagli esercizi DELL'ALLIEVO, non dai propri:
          // una scheda scritta sui nomi dell'allenatore non si collegherebbe a
          // nulla nello storico di chi la esegue.
          palestraExercises={dati?.palestraExercises ?? []}
          onCancel={() => setForm(null)}
          onSave={salva}
          // Anche la bozza si salva: il lavoro non si perde. Resta però invisibile
          // all'allievo, che vede solo le schede complete (vedi GymSchede).
          // Proprio per questo NON su una scheda che l'allievo sta già usando:
          // salvata come bozza per un campo rimasto vuoto gli spariva dall'app,
          // senza che nessuno dei due lo sapesse. Lì il form dice cosa manca e
          // lascia la scheda com'era.
          onSaveDraft={form.scheda && assegnate.some(r => r.id === form.scheda!.id && !r.scheda.draft)
            ? undefined
            : sc => salva({ ...sc, draft: true }, false)}
        />
      </div>
    )
  }

  // "Confronto" si apre dalle sessioni e ci torna: è una lettura delle stesse
  // giornate, e uscirne sulla scheda allievo farebbe perdere il segno. Lì si
  // scelgono due allenamenti e si mettono uno accanto all'altro.
  if (sotto === 'confronto' && dati) {
    return (
      <Pagina titolo={t('Confronto')} onBack={() => setSotto('sessioni')} isDesktop={isDesktop}>
        <CoachConfronto data={dati} schedeAssegnate={assegnate.map(r => r.scheda)}/>
      </Pagina>
    )
  }

  if (sotto === 'sessioni' && dati) {
    return conCorrezione(
      <Pagina titolo={t('Sessioni')} onBack={() => setSotto(null)} isDesktop={isDesktop}>
        {salvataggio && <Avviso testo={salvataggio} tono="errore"/>}
        <CoachSessioni
          data={dati}
          schedeAssegnate={assegnate.map(r => r.scheda)}
          inizio={primaScheda}
          onConfronto={() => setSotto('confronto')}
          onCorreggi={apriCorrezione}
        />
      </Pagina>,
    )
  }

  if (sotto === 'grafici' && dati) {
    return (
      <Pagina titolo={t('Grafici')} onBack={() => setSotto(null)} isDesktop={isDesktop}>
        <CoachGrafici
          esercizi={dati.palestraExercises ?? []}
          onApri={ex => { setSalvataggio(null); setEsercizioId(ex.id); setSotto('esercizio') }}
        />
      </Pagina>
    )
  }

  if (sotto === 'chat') {
    return (
      <Pagina titolo={nome} onBack={() => setSotto(null)} isDesktop={isDesktop}>
        <ChatDiretta coachId={link.coach_id} athleteId={link.athlete_id} io={link.coach_id} mioNome={link.coach_name ?? ''}/>
      </Pagina>
    )
  }

  // La scheda di un esercizio si apre dai grafici e ci torna.
  const esercizio = sotto === 'esercizio' ? dati?.palestraExercises?.find(e => e.id === esercizioId) : undefined
  if (sotto === 'esercizio' && dati && esercizio) {
    return conCorrezione(
      <Pagina titolo={esercizio.n} onBack={() => setSotto('grafici')} isDesktop={isDesktop}>
        {salvataggio && <Avviso testo={salvataggio} tono="errore"/>}
        <CoachEsercizio ex={esercizio} peso={dati.userWeight ?? 0} onCorreggi={apriCorrezione}/>
      </Pagina>,
    )
  }

  if (sotto === 'note') {
    return (
      <Pagina titolo={t('Note sugli esercizi')} onBack={() => setSotto(null)} isDesktop={isDesktop}>
        {salvataggio && <Avviso testo={salvataggio} tono="errore"/>}
        <NoteEsercizi
          esercizi={dati?.palestraExercises ?? []}
          note={note}
          onSalva={(exId, testo) => {
            setSalvataggio(null)
            salvaNotaCoach(link.coach_id, link.athlete_id, exId, link.coach_name ?? '', testo)
              .then(() => {
                ricaricaNote()
                // Una nota tolta non è una notizia; una scritta sì.
                if (testo.trim()) {
                  const esercizio = dati?.palestraExercises?.find(e => e.id === exId)?.n ?? ''
                  avvisaAllievo('nota', t('Nota su «{esercizio}»: {testo}', { esercizio, testo: testo.trim() }))
                }
              })
              .catch(e => setSalvataggio(messaggio(e)))
          }}
        />
      </Pagina>
    )
  }

  return (
    <Pagina titolo={nome} onBack={onBack} isDesktop={isDesktop}>
      {stato === 'carico' && <div className="j-empty">{t('Caricamento…')}</div>}
      {stato === 'errore' && <Avviso testo={errore} tono="errore"/>}
      {stato === 'pronto' && (
        dati ? (
          <CoachAthlete
            data={dati}
            note={note.length}
            onApriSessioni={() => { setSalvataggio(null); setSotto('sessioni') }}
            onApriGrafici={() => setSotto('grafici')}
            onApriNote={() => { setSalvataggio(null); setSotto('note') }}
            slotChat={
              <button onClick={() => setSotto('chat')} className="j-hard" style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left',
                background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', cursor: 'pointer',
              }}>
                <span style={{ color: 'var(--j-accent-ink)', display: 'flex', flexShrink: 0 }}><Icons.chat size={19} stroke={1.6}/></span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--fg)' }}>
                  {t('Scrivi a {chi}', { chi: nome })}
                </span>
                <BadgeNonLetti n={daLeggereChat}/>
                <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', flexShrink: 0 }}/>
              </button>
            }
            slotSchede={
              <SchedeAssegnate
                righe={assegnate}
                errore={salvataggio}
                onNuova={() => { setSalvataggio(null); setForm({ scheda: null }) }}
                onApri={sc => { setSalvataggio(null); setForm({ scheda: sc }) }}
                onElimina={r => confirmDelete(() => {
                  eliminaSchedaAssegnata(r.id)
                    .then(() => setAssegnate(a => a.filter(x => x.id !== r.id)))
                    .catch(e => setSalvataggio(messaggio(e)))
                }, r.scheda.title)}
              />
            }
          />
        ) : (
          <div className="j-empty">{t('Questa persona non ha ancora salvato nulla.')}</div>
        )
      )}
    </Pagina>
  )
}

// Le schede che l'allenatore ha scritto per questo allievo. Sta in cima alla
// pagina, sopra le statistiche: è la sola cosa che un allenatore FA da qui —
// tutto il resto sotto è roba da guardare.
function SchedeAssegnate({ righe, errore, onNuova, onApri, onElimina }: {
  righe: CoachScheda[]
  errore: string | null
  onNuova: () => void
  onApri: (sc: GymScheda) => void
  onElimina: (r: CoachScheda) => void
}) {
  const t = useT()
  // Una tendina, chiusa all'apertura: le schede si scrivono una volta e si
  // ritoccano di rado, mentre la pagina dell'allievo si apre per guardare come
  // sta andando. Aperte, spingevano sotto la piega tutto il resto.
  const [aperte, setAperte] = useState(false)
  return (
    <div>
      <NucEyebrow right={
        // Riquadrato, come il "Confronto" di fianco a Sessioni: senza bordo era
        // testo colorato appoggiato all'occhiello di sezione, e non si distingueva
        // da un titolo finché non ci si passava sopra. Un comando che crea qualcosa
        // deve avere un contorno che dice dove finisce il bersaglio.
        <button onClick={onNuova} className="j-hard-sm" style={{
          fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--j-accent-ink)', background: 'var(--surface)',
          border: '1px solid var(--hairline)', borderRadius: 'var(--radius)',
          cursor: 'pointer', padding: '4px 9px',
        }}>+ {t('Nuova')}</button>
      }>
        <button onClick={() => setAperte(a => !a)} aria-expanded={aperte} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
        }}>
          {t('Schede assegnate')} · {righe.length}
          <span style={{ display: 'flex', transform: aperte ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
            <Icons.chev size={12} stroke={2}/>
          </span>
        </button>
      </NucEyebrow>

      {errore && <Avviso testo={errore} tono="errore"/>}

      {aperte && (
      <NucCard pad={0}>
        {righe.length === 0 ? (
          <div style={{ padding: '16px 14px', fontFamily: NUC.label, fontSize: 11, letterSpacing: '.04em', color: 'var(--fg-mute)', lineHeight: 1.6 }}>
            {t('Nessuna scheda assegnata. Quelle che scrivi qui compaiono nelle sue «Schede d’allenamento», pronte da avviare.')}
          </div>
        ) : righe.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
            borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
          }}>
            <button
              onClick={() => onApri(r.scheda)}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <span style={{ fontSize: 14, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.scheda.title}</span>
                {r.scheda.draft && (
                  <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warn)', background: 'rgba(var(--warn-rgb),0.12)', border: '1px solid rgba(var(--warn-rgb),0.35)', borderRadius: 'var(--radius-pill)', padding: '1px 6px' }}>{t('Bozza')}</span>
                )}
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: 'var(--fg-mute)', marginTop: 2 }}>
                {r.scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: r.scheda.exercises.length })}
                {r.scheda.draft && ` · ${t('non ancora visibile a lui')}`}
                {/* Da quanto ce l'ha: è quello che dice a chi allena quando
                    è ora di cambiargliela. Una bozza non l'ha ancora nessuno. */}
                {!r.scheda.draft && natalDi(r.created_at ?? r.scheda.createdAt) && (
                  <span style={{ color: 'var(--fg-soft)', fontWeight: 600 }}>
                    {' · '}{etaScheda(giorniTra(natalDi(r.created_at ?? r.scheda.createdAt)!, todayISO()), t)}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => onElimina(r)}
              aria-label={t('Elimina {cosa}', { cosa: r.scheda.title })}
              style={{
                width: 30, height: 30, flexShrink: 0, borderRadius: 'var(--radius-sm)',
                background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
                color: 'var(--danger)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icons.trash size={13} stroke={1.6}/>
            </button>
          </div>
        ))}
      </NucCard>
      )}
    </div>
  )
}

// ── Pezzi comuni ───────────────────────────────────────────────
function Pagina({ titolo, onBack, isDesktop, children }: {
  titolo: string; onBack: () => void; isDesktop: boolean; children: React.ReactNode
}) {
  const t = useT()
  // La stessa testata delle schede e delle statistiche: freccia a sinistra,
  // titolo grande accanto. Prima il Coaching aveva una barra sua — freccia
  // piccola, titolo in maiuscoletto al centro, fondo diverso — e passando dalle
  // schede al coach sembrava di cambiare app.
  // Sta FUORI dall'area che scorre, come sempre: sotto non le passa niente.
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 97,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      overflow: 'hidden', fontFamily: NUC.font, color: NUC.ink,
    }}>
      <div className="flex flex-col h-full overflow-hidden" style={{ width: '100%', maxWidth: isDesktop ? 720 : '100%', margin: '0 auto' }}>
        <div className="j-page-header">
          <div className="flex items-center gap-3">
            <button onClick={onBack} aria-label={t('Indietro')} className="j-btn-back"><Icons.back size={20} stroke={1.8}/></button>
            <div className="j-page-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</div>
          </div>
        </div>
        {/* In fondo resta spazio: l'ultima cosa della pagina è spesso un campo
            (la chat, una nota) e non deve finire sotto la tastiera. */}
        <div className="j-scroll-area" style={{ paddingTop: 4, paddingBottom: 'calc(var(--nav-clear, env(safe-area-inset-bottom)) + 96px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function RigaPersona({ nome, sotto, primo, onApri, onRimuovi }: {
  nome: string; sotto: string; primo: boolean; onApri?: () => void; onRimuovi: () => void
}) {
  const t = useT()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
      borderTop: primo ? 'none' : '1px solid var(--hairline-soft)',
    }}>
      <div
        onClick={onApri}
        role={onApri ? 'button' : undefined}
        tabIndex={onApri ? 0 : undefined}
        onKeyDown={onApri ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onApri() } } : undefined}
        style={{ flex: 1, minWidth: 0, cursor: onApri ? 'pointer' : 'default' }}
      >
        <div style={{ fontSize: 15, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 2 }}>{sotto}</div>
      </div>
      {onApri && <Icons.chev size={14} stroke={2} style={{ color: 'var(--fg-mute)', flexShrink: 0 }}/>}
      <button onClick={onRimuovi} aria-label={t('Scollega {chi}', { chi: nome })} style={{
        width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-sm)',
        background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
        color: 'var(--danger)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icons.x size={12} stroke={1.8}/>
      </button>
    </div>
  )
}

function Bottone({ children, onClick, disabled, variante = 'accent' }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; variante?: 'accent' | 'chiaro'
}) {
  // Il tasto accent resta del suo colore anche da spento, solo attenuato.
  // Prima, spento, prendeva l'aspetto del tasto chiaro — serviva quando in
  // Premium l'accent era bianco e al 45% faceva una fascia chiara larga quanto la
  // card. Ma così "Collega", sotto il campo del codice, era un secondo
  // rettangolo grigio identico al campo: due caselle uguali, e nessuna che
  // sembrasse il tasto. Con l'accent di adesso il colore attenuato si legge per
  // quello che è: un tasto che aspetta il codice.
  const accent = variante === 'accent'
  return (
    <button onClick={onClick} disabled={disabled} className="j-hard" style={{
      flex: 1, width: '100%', minHeight: 44, borderRadius: 'var(--radius)',
      background: accent ? 'var(--j-accent)' : 'var(--surface-2)',
      border: accent ? 'none' : '1px solid var(--hairline)',
      color: accent ? 'var(--j-accent-fg)' : disabled ? 'var(--fg-mute)' : 'var(--fg)',
      opacity: accent && disabled ? 0.5 : 1,
      fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
      letterSpacing: '.14em', textTransform: 'uppercase',
      cursor: disabled ? 'default' : 'pointer',
    }}>{children}</button>
  )
}

function Avviso({ testo, tono }: { testo: string; tono: 'ok' | 'errore' }) {
  return (
    <div style={{
      padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius)',
      background: tono === 'errore' ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface-2)',
      border: `1px solid ${tono === 'errore' ? 'rgba(var(--danger-rgb),0.24)' : 'var(--hairline)'}`,
      fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5,
      color: tono === 'errore' ? 'var(--danger)' : 'var(--fg-soft)',
    }}>{testo}</div>
  )
}

function messaggio(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
