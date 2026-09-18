// Personal Coach: collegare due account e guardare gli allenamenti dell'altro.
//
// Ha preso il posto del vecchio "Personal Coach", che calcolava fabbisogno
// calorico, proteine e obiettivo di peso. Il nome è rimasto perché è quello che
// la voce di menù è diventata: un coach è una persona, non una formula.
//
// Due ruoli nella stessa schermata, perché sono due lati della stessa cosa e la
// stessa persona può stare da entrambi (chi allena si allena anche).
//
//  • "Ti seguono"  — genero un codice, lo do a chi mi deve seguire, e vedo chi
//                    ha accesso ai miei allenamenti. Da qui glielo tolgo.
//  • "Segui"       — inserisco il codice di qualcuno e ne apro la scheda.
//
// Il codice lo genera SEMPRE chi condivide i propri dati. Nel verso opposto
// l'allenatore manderebbe una richiesta e all'allievo resterebbe da accettarla —
// un consenso che si dà per non far aspettare l'altro, che è il modo peggiore di
// darlo. Le regole vere stanno nel database: vedi supabase/coach_schema.sql.
import { useCallback, useEffect, useState } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { Icons } from '@/components/ui/Icons'
import { NucCard, NucEyebrow, NucSubTabs } from '@/components/ui/NucComponents'
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
import { CoachAthlete, UltimoAllenamento, NoteEsercizi } from './CoachAthlete'
import { CoachMessaggi } from './CoachMessaggi'
import { BadgeNonLetti } from './messaggiUI'
import { useNonLetti } from '@/lib/messaggiLive'
import { CoachSessioni } from './CoachSessioni'
import { SchedaFormPage } from '@/features/gym/GymSchede'
import type { GymScheda } from '@/store/useJarvisStore'

// Le tre sezioni del Personal Coach. "messaggi" è la terza e sta a destra: le
// prime due sono i due lati del collegamento (chi ti segue, chi segui), la terza
// è quello che succede DOPO che il collegamento c'è.
type Ruolo = 'seguito' | 'allenatore' | 'messaggi'

export function JarvisCoach({ userId, onBack }: { userId: string; onBack: () => void }) {
  const t = useT()
  const isDesktop = useIsDesktop()
  const userName = useJarvisStore(st => st.userName)
  const { confirmDelete } = useConfirmDelete()

  const [ruolo, setRuolo] = useState<Ruolo>('seguito')
  const daLeggere = useNonLetti()
  const [invito, setInvito] = useState<CoachInvite | null>(null)
  const [allenatori, setAllenatori] = useState<CoachLink[]>([])
  const [atleti, setAtleti] = useState<CoachLink[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)

  // L'allievo aperto: id + nome dal collegamento (il nome vero arriva col dato,
  // ma serve un titolo anche mentre il dato sta ancora arrivando).
  const [aperto, setAperto] = useState<CoachLink | null>(null)

  const ricarica = useCallback(async () => {
    setCaricamento(true)
    setErrore(null)
    try {
      const [inv, cs, as] = await Promise.all([
        activeInvite(userId),
        myCoaches(userId),
        myAthletes(userId),
      ])
      setInvito(inv)
      setAllenatori(cs)
      setAtleti(as)
    } catch (e) {
      setErrore(messaggio(e))
    } finally {
      setCaricamento(false)
    }
  }, [userId])

  useEffect(() => { void ricarica() }, [ricarica])

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

  return (
    <Pagina titolo={t('Personal Coach')} onBack={onBack} isDesktop={isDesktop}>
      <NucSubTabs
        options={[
          { id: 'seguito', label: t('Ti seguono') },
          { id: 'allenatore', label: t('Segui') },
          { id: 'messaggi', label: t('Messaggi'), badge: <BadgeNonLetti n={daLeggere}/> },
        ]}
        value={ruolo}
        onChange={v => setRuolo(v as Ruolo)}
        style={{ marginBottom: 16 }}
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
        {ruolo === 'messaggi' && <CoachMessaggi userId={userId} userName={userName}/>}
        <div hidden={ruolo !== 'allenatore'}>
        <LatoAllenatore
          userName={userName}
          atleti={atleti}
          onCollegato={ricarica}
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

// ── Lato "ti seguono": genero il codice ────────────────────────
function LatoSeguito({ userId, userName, invito, allenatori, onInvito, onErrore, onRimuovi }: {
  userId: string
  userName: string
  invito: CoachInvite | null
  allenatori: CoachLink[]
  onInvito: (i: CoachInvite | null) => void
  onErrore: (e: string | null) => void
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

  return (
    <>
      <NucEyebrow>{t('Il tuo codice')}</NucEyebrow>
      <NucCard pad={16} style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 13, lineHeight: 1.55, color: 'var(--fg-soft)', marginBottom: 14 }}>
          {t('Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso —')}{' '}
          <b>{t('in sola lettura')}</b>. {t('Puoi togliergli l’accesso quando vuoi.')}
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
      {allenatori.length === 0 ? (
        <div className="j-empty">{t('Nessuno. I tuoi dati sono solo tuoi.')}</div>
      ) : (
        <NucCard pad={0}>
          {allenatori.map((l, i) => (
            <RigaPersona
              key={l.coach_id}
              nome={l.coach_name || t('Allenatore')}
              sotto={t('Dal {data}', { data: fmtShortDate(l.created_at.slice(0, 10)) })}
              primo={i === 0}
              onRimuovi={() => onRimuovi(l)}
            />
          ))}
        </NucCard>
      )}
    </>
  )
}

// ── Lato "segui": inserisco il codice ──────────────────────────
function LatoAllenatore({ userName, atleti, onCollegato, onApri, onRimuovi }: {
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
      setEsito({ testo: `Collegato a ${r.athlete_name || 'questa persona'}.`, tono: 'ok' })
      setCodice('')
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
  const [sotto, setSotto] = useState<null | 'ultimo' | 'note' | 'sessioni'>(null)

  useEffect(() => {
    let vivo = true
    setStato('carico')
    athleteData(link.athlete_id)
      .then(d => { if (vivo) { setDati(d); setStato('pronto') } })
      .catch(e => { if (vivo) { setErrore(messaggio(e)); setStato('errore') } })
    return () => { vivo = false }
  }, [link.athlete_id])

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

  const salva = (sc: GymScheda) => {
    setSalvataggio(null)
    salvaSchedaAssegnata(link.coach_id, link.athlete_id, link.coach_name ?? '', sc)
      .then(() => { setForm(null); ricarica() })
      .catch(e => setSalvataggio(messaggio(e)))
  }

  const nome = dati?.userName || link.athlete_name || t('Allievo')

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
          onSaveDraft={sc => salva({ ...sc, draft: true })}
        />
      </div>
    )
  }

  // "Confronto" si apre dalle sessioni e ci torna: è una lettura delle stesse
  // giornate, e uscirne sulla scheda allievo farebbe perdere il segno.
  if (sotto === 'ultimo') {
    return (
      <Pagina titolo={t('Ultimo allenamento')} onBack={() => setSotto('sessioni')} isDesktop={isDesktop}>
        <UltimoAllenamento palestra={dati?.palestraExercises ?? []}/>
      </Pagina>
    )
  }

  if (sotto === 'sessioni' && dati) {
    return (
      <Pagina titolo={t('Sessioni')} onBack={() => setSotto(null)} isDesktop={isDesktop}>
        <CoachSessioni
          data={dati}
          schedeAssegnate={assegnate.map(r => r.scheda)}
          onConfronto={() => setSotto('ultimo')}
        />
      </Pagina>
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
              .then(ricaricaNote)
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
            onApriSessioni={() => setSotto('sessioni')}
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
                  <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warn)', background: 'rgba(var(--warn-rgb),0.12)', border: '1px solid rgba(var(--warn-rgb),0.35)', padding: '1px 5px' }}>{t('Bozza')}</span>
                )}
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: 'var(--fg-mute)', marginTop: 2 }}>
                {r.scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: r.scheda.exercises.length })}
                {r.scheda.draft && ` · ${t('non ancora visibile a lui')}`}
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
  // La barra del titolo sta FUORI dall'area che scorre. Era `sticky` dentro di
  // essa, con fondo `--surface`: nel tema premium quel fondo è quasi trasparente
  // (bianco al 4,5%), e scorrendo le righe passavano sotto la barra e si leggevano
  // attraverso il titolo e il tasto indietro. Fuori dallo scroll non c'è niente
  // che le passi sotto, qualunque sia il tema.
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 97,
      background: 'var(--bg)', backgroundImage: 'var(--paper-grain)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: NUC.font, color: NUC.ink,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px 12px', flexShrink: 0,
        borderBottom: '1px solid var(--divider)', background: 'var(--surface)',
      }}>
        <button onClick={onBack} className="j-btn-back" style={{ width: 34, height: 34 }}>
          <Icons.chevL size={15}/>
        </button>
        <div className="j-eyebrow" style={{ letterSpacing: '.18em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titolo}</div>
        <div style={{ width: 34, flexShrink: 0 }}/>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{
          padding: isDesktop ? '24px 24px 120px' : '16px 16px 120px',
          width: '100%', maxWidth: isDesktop ? 720 : '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
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
  // Da disabilitato il tasto accent non resta un blocco di accent sbiadito: in
  // Premium l'accent è bianco, e al 45% diventava una fascia chiara larga quanto
  // la card. Spento prende l'aspetto del tasto chiaro, e il colore arriva quando
  // c'è davvero qualcosa da premere.
  const accent = variante === 'accent' && !disabled
  return (
    <button onClick={onClick} disabled={disabled} className="j-hard" style={{
      flex: 1, width: '100%', minHeight: 44, borderRadius: 'var(--radius)',
      background: accent ? 'var(--j-accent)' : 'var(--surface-2)',
      border: accent ? 'none' : '1px solid var(--hairline)',
      color: accent ? 'var(--j-accent-fg)' : disabled ? 'var(--fg-mute)' : 'var(--fg)',
      fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
      letterSpacing: '.14em', textTransform: 'uppercase',
      cursor: disabled ? 'default' : 'pointer',
    }}>{children}</button>
  )
}

function Avviso({ testo, tono }: { testo: string; tono: 'ok' | 'errore' }) {
  return (
    <div style={{
      padding: '10px 12px', marginBottom: 12,
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
