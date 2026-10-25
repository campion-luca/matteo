// Personal Coach: collegare due account e guardare gli allenamenti dell'altro.
//
// Ha preso il posto del vecchio "Personal Coach", che calcolava fabbisogno
// calorico, proteine e obiettivo di peso. Il nome è rimasto perché è quello che
// la voce di menù è diventata: un coach è una persona, non una formula.
//
// Due ruoli nella stessa schermata, perché sono due lati della stessa cosa e la
// stessa persona può stare da entrambi (chi allena si allena anche).
//
//  • "Coaching" — chi mi segue: la sua faccia, il suo profilo, la chat con lui.
//  • "Seguiti"  — chi seguo io: le loro facce, e da lì la scheda di ciascuno.
// In alto a destra, due quadratini: la chat con tutti, e la chiave dei codici
// con cui ci si collega. (Fino a ottobre 2026 la chat era una terza card e i
// codici stavano dentro le due sezioni; prima ancora le sezioni si chiamavano
// "Ti seguono", "Segui" e "Messaggi", poi "Coach", "Seguiti" e "Chat".)
import { useCallback, useEffect, useMemo, useState } from 'react'
import { localISO, giorniTra, todayISO } from '@/lib/isoDate'
import { natalDi, etaScheda } from '@/features/gym/anteprimaScheda'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { Avatar } from '@/components/ui/Avatar'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { useIsDesktop } from '@/hooks/useIsDesktop'
import { useT } from '@/lib/i18n'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { useJarvisStore } from '@/store/useJarvisStore'
import { fmtShortDate } from '@/lib/dateFormat'
import {
  activeInvite, revokeInvite,
  myAthletes, myCoaches, unlink, athleteData,
  schedeAssegnate, salvaSchedaAssegnata, eliminaSchedaAssegnata, type CoachScheda,
  noteAllievo, salvaNotaCoach, type NotaCoach,
  type CoachLink, type CoachInvite, type AthleteData,
} from '@/lib/coach'
import { leggiProfili, tieniSoloProfili, useProfiliStore, useProfilo, nomeCompleto, type Profilo } from '@/lib/profili'
import { CoachAthlete, NoteEsercizi } from './CoachAthlete'
import { CoachConfronto } from './CoachConfronto'
import { CoachMessaggi } from './CoachMessaggi'
import { CoachCodici, type Verso } from './CoachCodici'
import { ProfiloUtente } from './ProfiloUtente'
import { BadgeNonLetti } from './messaggiUI'
import { useNonLetti, useMessaggi, avvisa } from '@/lib/messaggiLive'
import { bozzaChat, idChat, nonLetti } from '@/lib/messaggi'
import { ChatDiretta } from './ChatDiretta'
import { Pagina, TastoIcona, TastoRiga, RigaPersona, CardScelta, Bottone, Avviso } from './PezziCoach'
import { fmtKg, fmtReps } from '@/features/gym/gymModel'
import { CoachSessioni } from './CoachSessioni'
import { CoachGrafici, CoachEsercizio } from './CoachEsercizi'
import { SchedaFormPage } from '@/features/gym/GymSchede'
import { EditHistoryModal } from '@/features/gym/gymModals'
import { caricoDiRiferimento } from '@/features/gym/limitiAlzata'
import { correzioniPer, salvaCorrezione, applicaCorrezioni } from '@/lib/correzioni'
import type { GymScheda, PalestraHistoryEntry } from '@/store/useJarvisStore'

// Le due sezioni del Personal Coach: i due lati del collegamento.
type Ruolo = 'seguito' | 'allenatore'

// Quello che si apre sopra la pagina: la chat, i codici, il profilo di qualcuno.
type Vista =
  | null
  | 'chat'
  | 'codici'
  | { profilo: string; nome: string; sotto: string }

export function JarvisCoach({ userId, onBack, iniziale = 'seguito', apriMessaggi = 0 }: {
  userId: string
  onBack: () => void
  /** Dove aprirsi. Chi arriva toccando una notifica vuole i messaggi, non il
   *  proprio codice: con 'messaggi' si apre direttamente la chat. */
  iniziale?: Ruolo | 'messaggi'
  /** Cresce di uno a ogni notifica toccata (vedi App). `iniziale` vale solo
   *  all'apertura: con il Coaching già aperto — su un allievo, su un codice —
   *  la notifica riportava l'app davanti ma la lasciava dov'era. */
  apriMessaggi?: number
}) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const userName = useJarvisStore(st => st.userName)
  const { confirmDelete } = useConfirmDelete()

  const [ruolo, setRuolo] = useState<Ruolo>(iniziale === 'allenatore' ? 'allenatore' : 'seguito')
  const [vista, setVista] = useState<Vista>(iniziale === 'messaggi' ? 'chat' : null)
  // Il verso scelto nella pagina dei codici. Resta scelto tornando indietro:
  // chi la riapre di solito ci torna per finire quello che aveva cominciato.
  const [verso, setVerso] = useState<Verso | null>(null)
  // La chat aperta con uno dei miei allenatori (io sono l'allievo).
  const [chatCon, setChatCon] = useState<CoachLink | null>(null)
  const daLeggere = useNonLetti()
  const [invito, setInvito] = useState<CoachInvite | null>(null)
  const [allenatori, setAllenatori] = useState<CoachLink[]>([])
  const [atleti, setAtleti] = useState<CoachLink[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const profili = useProfiliStore(s => s.profili)

  // L'allievo aperto: id + nome dal collegamento (il nome vero arriva col dato,
  // ma serve un titolo anche mentre il dato sta ancora arrivando).
  const [aperto, setAperto] = useState<CoachLink | null>(null)
  // Una notifica toccata col Coaching già aperto: si va ai messaggi, da
  // qualunque pagina ci si trovi (vedi `apriMessaggi`).
  useEffect(() => {
    if (!apriMessaggi) return
    setAperto(null)
    setChatCon(null)
    setVista('chat')
  }, [apriMessaggi])

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
      // Prima si tolgono quelle di chi non è più collegato (vedi `tieniSoloProfili`).
      const collegati = [...cs.map(l => l.coach_id), ...as.map(l => l.athlete_id)]
      tieniSoloProfili(collegati, userId)
      // Le facce: dopo gli elenchi e senza aspettarle. Quelle già viste sono
      // sul telefono e compaiono subito; se la tabella dei profili non c'è
      // ancora, restano i nomi copiati nel collegamento.
      void leggiProfili(collegati)
        .catch(() => { /* niente profili: si va avanti coi nomi */ })
    } catch (e) {
      if (!piano) setErrore(messaggio(e))
    } finally {
      if (!piano) setCaricamento(false)
    }
  }, [userId])

  useEffect(() => { void ricarica() }, [ricarica])

  // Chi ha dato il proprio codice e sta guardando questa pagina vede comparire
  // il coach appena quello lo riscatta: l'avviso "ti seguo" arriva come
  // messaggio (vedi CoachCodici), e quando ne arriva uno nuovo si rilegge chi mi
  // segue. Prima restava a schermo il codice già consumato e "Nessuno", finché
  // non si usciva e rientrava.
  const { messaggi: tuttiIMessaggi } = useMessaggi()
  const collegamenti = useMemo(() => tuttiIMessaggi.filter(m => m.tipo === 'collegamento').length, [tuttiIMessaggi])
  useEffect(() => { if (collegamenti > 0) void ricarica(true) }, [collegamenti, ricarica])

  // Nome e cognome dal profilo; senza, il nome copiato nel collegamento.
  const nomeCoach = (l: CoachLink) => nomeCompleto(profili[l.coach_id], l.coach_name || t('Allenatore'))
  const nomeAllievo = (l: CoachLink) => nomeCompleto(profili[l.athlete_id], l.athlete_name || t('Allievo'))

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

  const togliCoach = (l: CoachLink) => confirmDelete(
    () => { void scollega(l, () => setAllenatori(a => a.filter(x => x.coach_id !== l.coach_id))) },
    nomeCoach(l),
    {
      eyebrow: t('Scollega'),
      title: t('Togliere l’accesso?'),
      body: t('{chi} non vedrà più i tuoi allenamenti. I tuoi dati restano intatti.', { chi: nomeCoach(l) }),
      cta: t('Scollega'),
    },
  )
  const togliAllievo = (l: CoachLink) => confirmDelete(
    () => { void scollega(l, () => setAtleti(a => a.filter(x => x.athlete_id !== l.athlete_id))) },
    nomeAllievo(l),
    {
      eyebrow: t('Scollega'),
      title: t('Togliere dalla lista?'),
      body: t('Non vedrai più gli allenamenti di {chi}. Per rientrare servirà un codice nuovo.', { chi: nomeAllievo(l) }),
      cta: t('Scollega'),
    },
  )

  const apriCodici = (v: Verso) => { setVerso(v); setVista('codici') }

  if (aperto) {
    return <SchedaAllievo link={aperto} onBack={() => setAperto(null)}/>
  }

  if (chatCon) {
    return (
      <Pagina titolo={nomeCoach(chatCon)} onBack={() => setChatCon(null)} isDesktop={isDesktop} fisso>
        <ChatDiretta coachId={chatCon.coach_id} athleteId={chatCon.athlete_id} io={userId} mioNome={userName}/>
      </Pagina>
    )
  }

  if (vista === 'chat') {
    return <CoachMessaggi userId={userId} userName={userName} nomi={nomi} onBack={() => setVista(null)} isDesktop={isDesktop}/>
  }

  if (vista === 'codici') {
    return (
      <Pagina titolo={t('Codici')} onBack={() => setVista(null)} isDesktop={isDesktop}>
        <CoachCodici
          userId={userId}
          userName={userName}
          invito={invito}
          onInvito={setInvito}
          coach={allenatori.length ? nomeCoach(allenatori[0]) : null}
          verso={verso}
          onVerso={setVerso}
          onCollegato={() => { void ricarica(true) }}
          onVaiAiSeguiti={() => { setRuolo('allenatore'); setVista(null) }}
        />
      </Pagina>
    )
  }

  if (vista) {
    return <ProfiloUtente id={vista.profilo} nomeRiserva={vista.nome} sotto={vista.sotto} onBack={() => setVista(null)} isDesktop={isDesktop}/>
  }

  return (
    <Pagina
      titolo={t('Personal Coach')}
      onBack={onBack}
      isDesktop={isDesktop}
      destra={<>
        <TastoIcona etichetta={t('Chat')} badge={daLeggere} onClick={() => setVista('chat')}>
          <Icons.chat size={19} stroke={1.7}/>
        </TastoIcona>
        <TastoIcona etichetta={t('Codici')} onClick={() => setVista('codici')}>
          <Icons.chiave size={19} stroke={1.7}/>
        </TastoIcona>
      </>}
    >
      <SezioniCoach
        valore={ruolo}
        onChange={setRuolo}
        // Finché l'elenco non è arrivato sotto il nome non si scrive niente:
        // "Nessuno" per un secondo, a chi un coach ce l'ha, sarebbe una bugia.
        sotto={caricamento ? {} : {
          seguito: allenatori.length ? nomeCoach(allenatori[0]) : t('Nessuno'),
          allenatore: atleti.length === 0 ? t('Nessuno') : atleti.length === 1 ? t('1 allievo') : t('{n} allievi', { n: atleti.length }),
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
            passando all'altro lato. Non hanno effetti al montaggio, tenerli vivi
            non costa niente. */}
        <div hidden={ruolo !== 'seguito'}>
          <LatoCoaching
            allenatori={allenatori}
            profili={profili}
            nomeDi={nomeCoach}
            onScrivi={setChatCon}
            onProfilo={l => setVista({
              profilo: l.coach_id, nome: l.coach_name || t('Allenatore'),
              sotto: t('Ti segue dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) }),
            })}
            onRimuovi={togliCoach}
            onCodice={() => apriCodici('farsi')}
          />
        </div>
        <div hidden={ruolo !== 'allenatore'}>
          <LatoSeguiti
            atleti={atleti}
            profili={profili}
            nomeDi={nomeAllievo}
            onApri={setAperto}
            onProfilo={l => setVista({
              profilo: l.athlete_id, nome: l.athlete_name || t('Allievo'),
              sotto: t('Lo segui dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) }),
            })}
            onRimuovi={togliAllievo}
            onCodice={() => apriCodici('seguire')}
          />
        </div>
        </>
      )}
    </Pagina>
  )
}

// ── Le due sezioni, in cima ────────────────────────────────────
// Due card come quelle in home, non una barra di parole: «Coaching» è chi
// allena te, «Seguiti» chi alleni tu. Ognuna col suo disegno, nello stesso
// stile delle card in home (vedi CardScelta). Erano tre, con la chat; da quando
// la chat sta in alto a destra le due rimaste hanno preso il suo posto, e sono
// più grandi.
//
// A differenza di quelle in home non aprono una pagina: scelgono cosa c'è sotto,
// quindi una delle due è sempre accesa — piena d'inchiostro.
const SEZIONI: Array<{ id: Ruolo; disegno: 'allenatore' | 'gruppo' }> = [
  { id: 'seguito',    disegno: 'allenatore' },
  { id: 'allenatore', disegno: 'gruppo' },
]
const ALTEZZA_SEZIONE = 'clamp(128px, 20dvh, 172px)'

function SezioniCoach({ valore, onChange, sotto }: {
  valore: Ruolo
  onChange: (r: Ruolo) => void
  /** Una riga sotto il nome di ogni card: chi è il coach, quanti allievi. */
  sotto: Partial<Record<Ruolo, string>>
}) {
  const t = useT()
  const nomi: Record<Ruolo, string> = { seguito: t('Coaching'), allenatore: t('Seguiti') }
  return (
    <div role="tablist" aria-label={t('Personal Coach')} style={{
      display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'clamp(8px, 2.4vw, 12px)',
      marginTop: 6, marginBottom: 18,
    }}>
      {SEZIONI.map(s => (
        <CardScelta
          key={s.id}
          titolo={nomi[s.id]}
          sotto={sotto[s.id]}
          disegno={s.disegno}
          altezza={ALTEZZA_SEZIONE}
          accesa={s.id === valore}
          onClick={() => onChange(s.id)}
        />
      ))}
    </div>
  )
}

// ── "Coaching": chi mi segue ───────────────────────────────────
function LatoCoaching({ allenatori, profili, nomeDi, onScrivi, onProfilo, onRimuovi, onCodice }: {
  allenatori: CoachLink[]
  profili: Record<string, Profilo>
  nomeDi: (l: CoachLink) => string
  /** Apre la chat con questo allenatore. */
  onScrivi: (l: CoachLink) => void
  onProfilo: (l: CoachLink) => void
  onRimuovi: (l: CoachLink) => void
  /** Porta ai codici, sul "farmi seguire". */
  onCodice: () => void
}) {
  const t = useT()

  if (allenatori.length === 0) {
    return (
      <>
        <NucEyebrow>{t('Il tuo coach')}</NucEyebrow>
        <NucCard pad={16}>
          <div style={{ fontFamily: NUC.font, fontSize: 15, color: 'var(--fg)', marginBottom: 6 }}>
            {t('Nessuno ti segue.')}
          </div>
          <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
            {t('I tuoi dati sono solo tuoi. Per farti seguire genera un codice e dallo a chi ti allena: lo trovi anche nella chiave in alto a destra.')}
          </div>
          <Bottone onClick={onCodice}>{t('Genera un codice')}</Bottone>
        </NucCard>
      </>
    )
  }

  return (
    <>
      <NucEyebrow>{allenatori.length === 1 ? t('Il tuo coach') : t('I tuoi coach')}</NucEyebrow>
      {allenatori.map(l => {
        const nome = nomeDi(l)
        return (
          <NucCard key={l.coach_id} pad={18} style={{ marginBottom: 12, borderLeft: '3px solid var(--j-accent)' }}>
            {/* La faccia e il nome in grande: sono la risposta a "chi mi sta
                seguendo". Accanto, il suo profilo. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar foto={profili[l.coach_id]?.foto} nome={nome} size={64}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: NUC.font, fontSize: 24, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.3, color: 'var(--fg)', overflowWrap: 'anywhere' }}>
                  {nome}
                </div>
                <div style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.08em', color: 'var(--fg-mute)', marginTop: 5 }}>
                  {t('Ti segue dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) })}
                </div>
              </div>
              <TastoRiga etichetta={t('Profilo di {chi}', { chi: nome })} onClick={() => onProfilo(l)}>
                <Icons.user size={15} stroke={1.8}/>
              </TastoRiga>
            </div>
            <div style={{ fontFamily: NUC.font, fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg-soft)', marginTop: 12 }}>
              {t('Vede i tuoi allenamenti, il volume e l’andamento del peso, e può correggere un’alzata scritta male.')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <Bottone onClick={() => onScrivi(l)}>{t('Scrivigli')}</Bottone>
              <Bottone onClick={() => onRimuovi(l)} variante="chiaro">{t('Scollega')}</Bottone>
            </div>
          </NucCard>
        )
      })}
      <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, color: 'var(--fg-mute)', margin: '2px 2px 18px' }}>
        {t('Si può avere un solo coach per volta: per cambiarlo, scollegati prima da quello che hai.')}
      </div>
    </>
  )
}

// ── "Seguiti": chi seguo io ────────────────────────────────────
function LatoSeguiti({ atleti, profili, nomeDi, onApri, onProfilo, onRimuovi, onCodice }: {
  atleti: CoachLink[]
  profili: Record<string, Profilo>
  nomeDi: (l: CoachLink) => string
  onApri: (l: CoachLink) => void
  onProfilo: (l: CoachLink) => void
  onRimuovi: (l: CoachLink) => void
  /** Porta ai codici, sul "seguire qualcuno". */
  onCodice: () => void
}) {
  const t = useT()
  return (
    <>
      <NucEyebrow>{t('I tuoi allievi')}</NucEyebrow>
      {atleti.length === 0 ? (
        <NucCard pad={16}>
          <div style={{ fontFamily: NUC.font, fontSize: 15, color: 'var(--fg)', marginBottom: 6 }}>
            {t('Nessun allievo collegato.')}
          </div>
          <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
            {t('Chiedi il codice a chi vuoi seguire e inseriscilo qui: lo genera dalla sua app.')}
          </div>
          <Bottone onClick={onCodice}>{t('Inserisci un codice')}</Bottone>
        </NucCard>
      ) : (
        <NucCard pad={0} style={{ overflow: 'hidden' }}>
          {atleti.map((l, i) => (
            <RigaPersona
              key={l.athlete_id}
              nome={nomeDi(l)}
              foto={profili[l.athlete_id]?.foto}
              sotto={t('Dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) })}
              primo={i === 0}
              onApri={() => onApri(l)}
              onProfilo={() => onProfilo(l)}
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
  const [sotto, setSotto] = useState<null | 'confronto' | 'note' | 'sessioni' | 'grafici' | 'esercizio' | 'chat' | 'profilo'>(null)
  const profilo = useProfilo(link.athlete_id)
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

  // Nome e cognome dal suo profilo; senza, il nome che usa nell'app.
  const nome = nomeCompleto(profilo, dati?.userName || link.athlete_name || t('Allievo'))

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
      <Pagina titolo={nome} onBack={() => setSotto(null)} isDesktop={isDesktop} fisso>
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

  if (sotto === 'profilo') {
    return (
      <ProfiloUtente
        id={link.athlete_id}
        nomeRiserva={dati?.userName || link.athlete_name || t('Allievo')}
        sotto={t('Lo segui dal {data}', { data: fmtShortDate(link.created_at.slice(0, 10)) })}
        onBack={() => setSotto(null)}
        isDesktop={isDesktop}
      />
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

  // Sul tasto in fondo basta il nome: "Scrivi a Cris", non nome e cognome.
  const primoNome = nome.trim().split(/\s+/)[0] || nome

  return (
    <Pagina
      titolo={nome}
      sopra={t('Allievo')}
      onBack={onBack}
      isDesktop={isDesktop}
      // In alto a destra la sua faccia, che apre il suo profilo.
      destra={
        <button
          onClick={() => setSotto('profilo')}
          aria-label={t('Profilo di {chi}', { chi: nome })} title={t('Profilo di {chi}', { chi: nome })}
          className="j-hard j-focus"
          style={{ display: 'flex', padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Avatar foto={profilo?.foto} nome={nome} size={44}/>
        </button>
      }
      // Scrivergli è la cosa che si fa da qui più spesso: il tasto sta fermo in
      // fondo, come "Nuova alzata" nella pagina di un esercizio.
      piede={
        <button onClick={() => setSotto('chat')} className="j-btn-accent j-focus" style={{ marginTop: 0 }}>
          <Icons.chat size={20} stroke={2}/> {t('Scrivi a {chi}', { chi: primoNome })}
          <BadgeNonLetti n={daLeggereChat} style={{ marginLeft: 4 }}/>
        </button>
      }
    >
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
        // Riquadrato: un comando che crea qualcosa deve avere un contorno che
        // dice dove finisce il bersaglio.
        <button onClick={onNuova} className="j-hard j-focus" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '0 12px',
          fontFamily: NUC.display, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
          color: NUC.ink, background: 'var(--surface)', border: 'var(--bordo)', cursor: 'pointer',
        }}><Icons.plus size={14} stroke={2.6}/>{t('Nuova')}</button>
      }>
        <button onClick={() => setAperte(a => !a)} aria-expanded={aperte} className="j-focus" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: 0, minHeight: 40,
          background: 'none', border: 'none', cursor: 'pointer',
          font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit',
        }}>
          <span>{t('Schede assegnate')} <span style={{ color: 'var(--fg-mute)' }}>· {righe.length}</span></span>
          <span style={{ display: 'flex', transform: aperte ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
            <Icons.arrow size={18} stroke={2.4}/>
          </span>
        </button>
      </NucEyebrow>

      {errore && <Avviso testo={errore} tono="errore"/>}

      {aperte && (
      <div style={{ background: 'var(--surface)', border: 'var(--bordo)', marginBottom: 12 }}>
        {righe.length === 0 ? (
          <div style={{ padding: '14px', fontFamily: NUC.font, fontSize: 13, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
            {t('Nessuna scheda assegnata. Quelle che scrivi qui compaiono nelle sue «Schede d’allenamento», pronte da avviare.')}
          </div>
        ) : righe.map((r, i) => (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 14px',
            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
          }}>
            <button
              onClick={() => onApri(r.scheda)}
              className="j-focus"
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <span style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.scheda.title}</span>
                {r.scheda.draft && (
                  <span style={{ flexShrink: 0, fontFamily: NUC.display, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: NUC.ink, border: '1px solid var(--ink)', padding: '1px 6px' }}>{t('Bozza')}</span>
                )}
              </div>
              <div style={{ fontFamily: NUC.display, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 3 }}>
                {r.scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: r.scheda.exercises.length })}
                {r.scheda.draft && ` · ${t('non ancora visibile a lui')}`}
                {/* Da quanto ce l'ha: è quello che dice a chi allena quando
                    è ora di cambiargliela. Una bozza non l'ha ancora nessuno. */}
                {!r.scheda.draft && natalDi(r.created_at ?? r.scheda.createdAt) && (
                  <span style={{ color: 'var(--fg)' }}>
                    {' · '}{etaScheda(giorniTra(natalDi(r.created_at ?? r.scheda.createdAt)!, todayISO()), t)}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => onElimina(r)}
              aria-label={t('Elimina {cosa}', { cosa: r.scheda.title })}
              className="j-hard j-focus"
              style={{
                width: 44, height: 44, flexShrink: 0,
                background: 'var(--surface)', border: 'var(--bordo)',
                color: 'var(--danger)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icons.trash size={16} stroke={1.7}/>
            </button>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

function messaggio(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
