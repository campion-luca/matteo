// Schede d'allenamento: le cinque pagine della sezione, in un file solo.
//
// `GymSchede` è solo il contenitore: tiene lo stato di navigazione (elenco →
// dettaglio → modifica / allenamento / report) e passa i dati alle cinque
// pagine sotto, che sono componenti privati senza store.
// Il pezzo forte è `SchedaTrainingPage`: mentre ti alleni spunta le serie e a
// fine sessione trasforma le spunte in vere alzate nello storico degli esercizi
// collegati (`linkedExerciseId`), così la scheda alimenta le statistiche invece
// di restare una lista a parte.
import { useState, useMemo, useEffect, useRef, useCallback, memo, type ReactNode, type CSSProperties } from 'react'
import { NUC, accentFgFor, accentInkFor } from '@/lib/jarvis-tokens'
import { NucCard } from '@/components/ui/NucComponents'
import { Cronologia } from '@/components/ui/Cronologia'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { GymScheda, GymSchedaExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { MUSCLE_COLORS, displayMuscle, weekLabel, sortedHistory, ultimaVoce, recordFor, normalizzaDecimale, parseNum, fmtNum, fmtKg, fmtKgVerso, fmtReps, fmtDurata, setLoads, ultimaVoltaPerScheda, quantoFa, variazioneCarico, type VariazioneCarico, colpiPrevisti } from './gymModel'
import { fmtDayMonthFull, fmtDayMon } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import { RecordModal, EditHistoryModal, type RecordItem } from './gymModals'
import { useBodyWeight, useGruppiMuscolari, useMuscleIcons } from './gymHooks'
import { leggiSessione, salvaSessione, scartaSessione, sessioneAperta, inizioSessione, orologioSessione, segnaAvvio, copreAltra, timerChiuso, ricordaTimerChiuso } from './sessioneInCorso'
import { corpoLibero, quotaCorpo, aColpi } from './catalogo'
import { useMuscleColors } from './useMuscleColors'
import { FacciaEsercizio, DataPunto, SegnaleCarico, MenuAzioni, FotoGrande } from './gymShared'
import { TimerRecupero, TimerIcona } from './TimerRecupero'
import { caricoConsigliato, contaPerMuscolo, GIORNI_DI_STOP, type Consiglio } from './caricoConsigliato'
import { todayISO, giorniTra, localISO } from '@/lib/isoDate'
import { useIsDark } from '@/hooks/useIsDark'
import { uid } from '@/lib/uid'
import { idUtenteSuDisco } from '@/lib/supabase'
import { schedeRicevute, schedeRicevuteInCache, ricordaSchedeRicevute, eliminaSchedaAssegnata, myAthletes, myCoaches, condividiScheda, type CoachScheda, type CoachLink } from '@/lib/coach'
import { bozzaChat } from '@/lib/messaggi'
import { avvisa } from '@/lib/messaggiLive'
import { riassuntoAllenamento, serieValide, chiliScritti } from './riassuntoAllenamento'
import { numeroImpossibile, testoImpossibile, saltoDaConfermare, caricoDiRiferimento, SERIE_MAX } from './limitiAlzata'
import { muscoliDellaScheda, durataPrevista, durataArrotondata, type MuscoloToccato } from './anteprimaScheda'
import { OminoMuscoli } from './MuscleIcons'
import { nonLetti, type Messaggio, type TipoMessaggio } from '@/lib/messaggi'
import { useMessaggi, segnaLettiOra, invia, elimina, RITMO_APERTO, RITMO_FONDO } from '@/lib/messaggiLive'
import { Filo, Composer, BadgeNonLetti } from '@/features/coach/messaggiUI'

// Colore del gruppo muscolare. `muscleColors` arriva risolto da `useMuscleColors()`
// (default + override utente, desaturato in layout "Notte"): 'Altro' fa da fallback,
// così anche i gruppi mancanti o legacy seguono il tema.
function muscleColor(muscle: string | undefined, muscleColors: Record<string, string>): string {
  const m = muscle ? displayMuscle(muscle) : ''
  return muscleColors[m] ?? muscleColors.Altro ?? MUSCLE_COLORS.Altro
}

// I colori muscolo sono tinte calde mid-tone (palette categorica Journal): usati
// come TESTO su carta chiara o come FONDO sotto testo chiaro possono avvicinarsi
// alla soglia AA. Questi due li rendono leggibili.
function muscleTextColor(hex: string, dark: boolean): string {
  return accentInkFor(hex, dark)
}
const onMuscleColor = accentFgFor

// ── A corpo libero, anche se nessuno l'ha mai detto ────────────
// Un esercizio è a corpo libero se lo dice lui (`corpoLibero`: il segno
// sull'esercizio o sulla riga, o il nome per i cinque del catalogo) — oppure se
// così è stata fatta la sua ULTIMA alzata: segnata a corpo libero, o senza
// chili su nessuna serie. I "Dip", "Plank", "Crunch" creati a mano prima che il
// segno esistesse, o lasciati su "con attrezzo" per distrazione, si fanno da
// sempre a 0 kg. Serve da quando le serie senza chili su un attrezzo non
// contano: senza questo quegli esercizi non si sarebbero più potuti salvare.
function aCorpoLibero(ex: PalestraExercise | undefined, riga: { name: string; bodyweight?: boolean }): boolean {
  if (corpoLibero(ex ?? { n: riga.name, bodyweight: riga.bodyweight })) return true
  const ultima = ex ? ultimaVoce(ex.history) : undefined
  return !!ultima && (ultima.bodyweight === true || setLoads(ultima).every(k => k === 0))
}

// Guscio comune alle cinque sotto-pagine delle schede (elenco, editor, dettaglio,
// sessione, report): stessa struttura, stesso back, stesso blocco titolo+eyebrow.
// Era ricopiata cinque volte, e le differenze fra le copie (il titolo troncato in
// due, non negli altri tre) erano più casuali che volute.
//   `azioni` = bottoni a destra del titolo · `extra` = riga sotto il titolo
//   (la barra di avanzamento della sessione)
function SchedaPage({ onBack, title, sub, tronca, azioni, extra, children }: {
  onBack: () => void
  title: ReactNode
  sub: ReactNode
  tronca?: boolean
  azioni?: ReactNode
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="j-page-header">
        {/* `flex-wrap` + un minimo garantito al titolo.
            Senza, con tre comandi a destra il titolo si stringeva a 156px mentre
            "Schede d'allenamento" a 26px ne chiede 172: il testo sforava dalla
            propria casella e finiva a passare SOTTO il primo bottone. Non era il
            titolo a essere lungo — su un telefono da 412px quella riga non ci sta
            e basta. Con un minimo di 190px la riga non può comprimersi oltre, e
            quando non ci sta è il gruppo dei comandi ad andare a capo, che è la
            cosa giusta da spostare: si legge prima dove si è e poi cosa si può
            fare. Sulle pagine con uno o due comandi resta tutto su una riga. */}
        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <button onClick={onBack} className="j-btn-back"><Icons.back size={20} stroke={1.8}/></button>
          <div style={{ flex: '1 1 auto', minWidth: 190 }}>
            <div className="j-page-title" style={tronca ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{title}</div>
            <div className="j-eyebrow mt-0.5">{sub}</div>
          </div>
          {azioni && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}>
              {azioni}
            </div>
          )}
        </div>
        {extra}
      </div>
      {children}
    </div>
  )
}

// Bottone icona quadrato nell'intestazione (matita, grafico, cestino): stessa
// forma per tutti, il colore lo passa chi lo usa. Va sempre insieme alla classe
// `j-hard`: è l'ombra che lo fa leggere come un tasto, la stessa del "+" e del
// tasto indietro — senza, tre quadrati col bordo sottile sembravano etichette.
// `size`: 44 come il "+" e il tasto indietro; 40 accanto al "+" dell'elenco.
const iconBtn = (danger = false, size = 44): CSSProperties => ({
  width: size, height: size, borderRadius: 'var(--radius)', cursor: 'pointer',
  background: danger ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface)',
  border: danger ? '1px solid rgba(var(--danger-rgb),0.18)' : `1px solid ${NUC.hairline}`,
  color: danger ? 'var(--danger)' : NUC.dim,
})


// ── Container: gestisce la navigazione interna della sezione Schede ──
export function GymSchede({ onBack, apri }: {
  onBack: () => void
  /** L'id di una propria scheda da aprire subito sul dettaglio (dalla ricerca). */
  apri?: string
}) {
  const t = useT()
  const { gymSchede, palestraExercises, userName } = useJarvisStore(useShallow(st => ({
    gymSchede: st.gymSchede,
    palestraExercises: st.palestraExercises,
    userName: st.userName,
  })))
  const muscleColors = useMuscleColors()
  const set = useJarvisStore.setState
  const bodyWeight = useBodyWeight()
  const { confirmDelete } = useConfirmDelete()

  // Le schede che un allenatore ha assegnato. Non stanno nello store perché non
  // sono roba di questo utente: vivono in `coach_schede`, le scrive l'allenatore,
  // e qui si leggono e basta. Se la tabella non c'è ancora (schema non eseguito)
  // o la rete non risponde, la lista resta quella locale e l'app non se ne accorge.
  const [assegnate, setAssegnate] = useState<CoachScheda[]>([])
  const [allievi, setAllievi] = useState<CoachLink[]>([])
  const [allenatori, setAllenatori] = useState<CoachLink[]>([])
  const [ioId, setIoId] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    // L'id si legge dalla sessione salvata sul telefono, senza passare da
    // `getSession`: con l'accesso scaduto e niente rete quella prova a
    // rinnovarlo e non torna per mezzo minuto — e senza id qui non comparivano
    // nemmeno le schede dell'allenatore già salvate sul telefono, cioè proprio
    // quelle che servono nel seminterrato. Qui l'id serve solo come filtro: a
    // decidere cosa si può leggere è la RLS, non il client.
    {
      const io = idUtenteSuDisco()
      if (!io) return
      setIoId(io)
      // Le bozze dell'allenatore restano sue: sono schede che ha salvato
      // incomplete per non perdere il lavoro, non cose da allenarci.
      // Subito quelle dell'ultima volta, poi la rete le aggiorna: senza segnale
      // la scheda dell'allenatore c'è lo stesso (vedi `ricordaSchedeRicevute`).
      const visibili = (righe: CoachScheda[]) => righe.filter(r => !r.scheda.draft)
      setAssegnate(visibili(schedeRicevuteInCache(io)))
      schedeRicevute(io)
        .then(righe => {
          ricordaSchedeRicevute(io, righe)
          if (vivo) setAssegnate(visibili(righe))
        })
        .catch(() => { /* senza rete o senza tabella: restano quelle in memoria */ })
      // Chi alleno. Serve solo a decidere se il tasto "condividi" ha senso:
      // senza nessuno da seguire non c'è niente da condividere, e un tasto che
      // apre un elenco vuoto è una promessa non mantenuta.
      myAthletes(io)
        .then(righe => { if (vivo) setAllievi(righe) })
        .catch(() => { /* non allena nessuno, o la tabella non c'è: nessun tasto */ })
      // Chi mi segue: a fine allenamento va avvisato (vedi `finishTraining`).
      myCoaches(io)
        .then(righe => { if (vivo) setAllenatori(righe) })
        .catch(() => { /* nessuno mi segue: nessuno da avvisare */ })
    }
    return () => { vivo = false }
  }, [])

  const [records, setRecords] = useState<RecordItem[]>([])
  // Le alzate che l'ULTIMO allenamento ha appena scritto nello storico.
  //
  // Serve a una cosa sola: poterle correggere da dove si è quando si finisce.
  // Modificarle si poteva già — il modale c'è, sta nella pagina dell'esercizio —
  // ma per arrivarci da qui bisognava uscire dalla scheda, tornare in home,
  // aprire il gruppo muscolare, l'esercizio, lo storico: sei passaggi per
  // aggiustare un 80 scritto al posto di un 85, subito dopo averlo scritto. Chi
  // finisce un allenamento e vuole correggere un carico non li fa, e quel
  // numero sbagliato resta nello storico per sempre.
  //
  // L'aggancio all'alzata è il RIFERIMENTO all'oggetto, non un indice: lo
  // storico viene riordinato per data a ogni scrittura (`sortedHistory`) e un
  // indice preso adesso punterebbe a un'altra riga dopo la prima correzione.
  // Vive quanto la pagina: uscendo dalla scheda sparisce, ed è giusto — non è
  // un archivio, è "quello che hai appena fatto".
  const [appenaSalvate, setAppenaSalvate] = useState<AlzataSalvata[]>([])
  const [correggo, setCorreggo] = useState<AlzataSalvata | null>(null)
  // Con `apri` si parte già dentro la scheda: letta una volta sola, all'ingresso.
  const [active, setActive] = useState<GymScheda | null>(() => (apri ? gymSchede?.find(x => x.id === apri) : undefined) ?? null) // scheda aperta in dettaglio/allenamento
  const [view, setView] = useState<'list' | 'form' | 'detail' | 'training' | 'report'>(active ? 'detail' : 'list')
  const [editing, setEditing] = useState<GymScheda | null>(null) // scheda in modifica nel form (null = nuova)

  // L'allenamento lasciato a metà (vedi sessioneInCorso). Si rilegge a ogni
  // giro: sono poche centinaia di byte, e cambia solo entrando e uscendo
  // dall'allenamento, che è proprio quando la pagina si ridisegna. `ridisegna`
  // serve allo "Scarta", che lo toglie senza cambiare vista.
  const [, ridisegna] = useState(0)
  const aperta = view === 'training' ? null : sessioneAperta()

  const mie = useMemo(() => gymSchede ?? [], [gymSchede])
  // Chi ha assegnato cosa. Una mappa a parte e non un campo dentro GymScheda:
  // il tipo è quello che l'app salva nel blob, e aggiungerci una provenienza
  // significherebbe scriverla anche nelle schede che una provenienza non ce l'hanno.
  const daCoach = useMemo(
    () => new Map(assegnate.map(r => [r.scheda.id, r.coach_name?.trim() || 'Allenatore'])),
    [assegnate],
  )
  // In cima: sono quelle che qualcun altro si aspetta che tu faccia.
  const schede = useMemo(() => [...assegnate.map(r => r.scheda), ...mie], [assegnate, mie])
  // "In corso" finché la sua scheda esiste. Una scheda modificata dopo aver
  // cominciato non blocca più la ripresa: le spunte sugli esercizi rimasti ci
  // sono ancora (vedi `leggiSessione`). Una cancellata sì — non c'è più dove
  // riprendere.
  const schedaAperta = aperta ? schede.find(x => x.id === aperta.schedaId) : undefined
  // E finché di quello che era stato spuntato resta qualcosa: se gli esercizi
  // sono stati tutti sostituiti non c'è niente da riprendere, e "tocca per
  // riprendere" porterebbe a una scheda a zero. I conti sono quelli di adesso.
  const rimaste = aperta && schedaAperta ? Object.values(leggiSessione(schedaAperta) ?? {}) : []
  const inCorso = aperta && schedaAperta && rimaste.some(p => p.checks.some(Boolean) || !!p.note?.trim())
    ? {
      scheda: schedaAperta,
      fatte: rimaste.reduce((n, p) => n + p.checks.filter(Boolean).length, 0),
      totali: schedaAperta.exercises.reduce((n, e) => n + Math.max(1, e.sets), 0),
      vecchia: aperta.vecchia, iniziataA: aperta.iniziataA,
    }
    : undefined

  // Cominciare un allenamento quando ce n'è già uno aperto su un'ALTRA scheda.
  // La sessione in corso è una sola: prima, alla prima serie spuntata qui,
  // quella di là veniva sovrascritta senza una parola. Adesso si chiede, e si
  // dice cosa si perde. Se la scheda di là non esiste più non c'è niente da
  // chiedere: non la si potrebbe comunque riprendere.
  const avvia = (sc: GymScheda) => {
    const parti = () => { setActive(sc); setView('training') }
    const altra = sessioneAperta()
    if (!altra || altra.schedaId === sc.id) { parti(); return }
    const diLa = schede.find(x => x.id === altra.schedaId)
    if (!diLa) { scartaSessione(); parti(); return }
    confirmDelete(
      () => { scartaSessione(); parti() },
      diLa.title,
      {
        eyebrow: t('Allenamento in corso'),
        title: t('Hai già avviato un allenamento'),
        body: t('«{scheda}» è a metà: {fatte} serie su {totali}. Chiuderlo per passare a questo? Le serie spuntate di là non vengono salvate.', { scheda: diLa.title, fatte: altra.fatte, totali: altra.totali }),
        cta: t('Chiudi e inizia questo'),
      },
    )
  }

  const persistScheda = (sc: GymScheda) => {
    set(st => {
      const list = st.gymSchede ?? []
      const idx = list.findIndex(x => x.id === sc.id)
      return { gymSchede: idx >= 0 ? list.map((x, i) => i === idx ? sc : x) : [...list, sc] }
    })
  }

  // Salvataggio "pieno" (scheda valida): per ogni esercizio con un nome, collega
  // un PalestraExercise esistente (match per nome, case-insensitive) o ne crea uno
  // nuovo subito — così l'esercizio è riutilizzabile nei suggerimenti e il peso
  // dell'ultima volta si precompila in allenamento. Dedup per nome ⇒ niente cloni (#5).
  const reconcileAndPersist = (sc: GymScheda) => {
    set(st => {
      const exs = [...(st.palestraExercises ?? [])]
      const reconciled = sc.exercises.map(se => {
        const name = se.name.trim()
        if (!name) return se
        if (se.linkedExerciseId && exs.some(e => e.id === se.linkedExerciseId)) return se
        const match = exs.find(e => e.n.trim().toLowerCase() === name.toLowerCase())
        if (match) return { ...se, linkedExerciseId: match.id }
        const newId = uid('px')
        exs.push({
          id: newId, n: name, muscle: displayMuscle(se.muscle || 'Altro'),
          ...(se.bodyweight ? { bodyweight: true } : {}),
          current: { kg: 0, reps: parseInt(se.reps) || 0, sets_n: se.sets || 0 },
          history: [],
        })
        return { ...se, linkedExerciseId: newId }
      })
      const finalScheda: GymScheda = { ...sc, exercises: reconciled }
      const list = st.gymSchede ?? []
      const idx = list.findIndex(x => x.id === finalScheda.id)
      return {
        palestraExercises: exs,
        gymSchede: idx >= 0 ? list.map((x, i) => i === idx ? finalScheda : x) : [...list, finalScheda],
      }
    })
  }

  // Sposta una delle MIE schede di un posto. L'ordine è quello dell'array nello
  // store, che è anche l'ordine dell'elenco: nessun campo `ordine` da tenere
  // allineato. Le schede assegnate da un allenatore non ci sono (non stanno nel
  // blob) e restano sempre in cima.
  const moveScheda = (id: string, dir: -1 | 1) => {
    set(st => {
      const list = [...(st.gymSchede ?? [])]
      const i = list.findIndex(x => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return {}
      ;[list[i], list[j]] = [list[j], list[i]]
      return { gymSchede: list }
    })
  }

  // Da quanti giorni non si fa ciascuna scheda: nell'elenco, accanto al nome.
  // Cosa si legge di ogni scheda nell'elenco, prima di aprirla: i muscoli che
  // tocca e quanto dura. Qui e non nella card: dipende dagli esercizi salvati
  // (il gruppo di una riga che non lo porta scritto si legge da lì), e si
  // ricalcola solo quando cambiano le schede o gli esercizi.
  const anteprime = useMemo(() => {
    const out = new Map<string, AnteprimaScheda>()
    for (const sc of schede) {
      out.set(sc.id, { muscoli: muscoliDellaScheda(sc, palestraExercises), durataSec: durataArrotondata(durataPrevista(sc)) })
    }
    return out
  }, [schede, palestraExercises])

  const ultimaVolta = useMemo(() => {
    const oggi = todayISO()
    const out = new Map<string, number>()
    for (const [id, giorno] of ultimaVoltaPerScheda(palestraExercises)) out.set(id, Math.max(0, giorniTra(giorno, oggi)))
    return out
  }, [palestraExercises])

  const scartaAperta = () => confirmDelete(
    () => { scartaSessione(); ridisegna(n => n + 1) },
    t('Allenamento in corso'),
    {
      eyebrow: t('Allenamento in corso'),
      title: t('Scartare l’allenamento?'),
      body: t('Le serie spuntate finora non vengono salvate. La prossima volta la scheda riparte da zero.'),
      cta: t('Scarta'),
    },
  )

  // `dopo` parte solo a eliminazione confermata: chi chiama ci mette il cambio
  // di pagina. Farlo subito, mentre il dialogo chiede ancora "sei sicuro?",
  // chiudeva il form anche a chi rispondeva no — con le modifiche non salvate.
  const removeScheda = (id: string, dopo?: () => void) => {
    const target = schede.find(s => s.id === id)
    // Una scheda assegnata non è nello store: toglierla dal blob non farebbe
    // nulla, e alla ricarica successiva sarebbe di nuovo lì. Va cancellata la riga.
    if (daCoach.has(id)) {
      const riga = assegnate.find(r => r.scheda.id === id)
      const chi = daCoach.get(id) ?? ''
      // Non è una copia: la riga è una sola, e toglierla qui la toglie anche a
      // chi l'ha scritta. Va detto prima, e a lui va detto dopo — prima spariva
      // e basta, e l'allenatore si ritrovava senza la scheda senza sapere perché.
      confirmDelete(() => {
        eliminaSchedaAssegnata(id)
          .then(() => {
            setAssegnate(a => a.filter(r => r.scheda.id !== id))
            // Anche dalla copia sul telefono, o al prossimo ingresso senza rete
            // la scheda tolta sarebbe di nuovo lì.
            if (ioId) ricordaSchedeRicevute(ioId, schedeRicevuteInCache(ioId).filter(r => r.scheda.id !== id))
            if (ioId && riga) {
              avvisa(bozzaChat({
                coachId: riga.coach_id, athleteId: ioId, autore: ioId, autoreNome: userName ?? '', tipo: 'scheda',
                testo: t('Ho tolto la scheda «{scheda}».', { scheda: riga.scheda.title }),
              }))
            }
          })
          .catch(() => { /* resta in lista: meglio di una sparizione che non ha avuto luogo */ })
        dopo?.()
      }, target?.title ?? t('Scheda'), {
        eyebrow: t('Elimina'),
        title: t('Togliere la scheda?'),
        body: t('«{scheda}» te l’ha mandata {chi}, e ne esiste una copia sola: togliendola qui sparisce anche dalla sua app. Glielo facciamo sapere.', { scheda: target?.title ?? '', chi }),
        cta: t('Elimina'),
      })
      return
    }
    confirmDelete(() => {
      set(st => ({ gymSchede: (st.gymSchede ?? []).filter(s => s.id !== id) }))
      dopo?.()
    }, target?.title ?? t('Scheda'))
  }

  // Alla fine dell'allenamento: registra un'"alzata" per ogni esercizio eseguito,
  // collegandolo (o creandolo) tra gli esercizi dei gruppi muscolari.
  const finishTraining = (
    scheda: GymScheda,
    results: { id: string; checks: boolean[]; weights: string[]; reps: string[]; note?: string; corpo?: boolean }[],
    // Il giorno in cui l'allenamento è stato FATTO (quello della prima serie),
    // e quanto è durato. Non il giorno in cui lo si chiude: chi finisce dopo
    // mezzanotte, o ritrova aperto l'allenamento di ieri, lo salva dov'è stato.
    fine: { giorno: string; durataSec?: number } = { giorno: todayISO() },
  ) => {
    const today = fine.giorno
    const wl = weekLabel(today)
    let exs = [...palestraExercises]
    const linkMap: Record<string, string> = {}
    // Una scheda salva più alzate in un colpo: i record si raccolgono e si
    // mostrano tutti insieme a fine sessione, non uno alla volta.
    const recs: RecordItem[] = []
    // Quello che finisce nello storico, esercizio per esercizio: serve alla
    // striscia "appena salvato" del dettaglio (vedi `appenaSalvate`).
    const salvate: AlzataSalvata[] = []
    // Solo gli esercizi fatti davvero, nell'ordine della scheda: uno saltato
    // non ha stancato niente.
    const giaFatti = contaPerMuscolo()
    // Per ogni riga, se l'esercizio è a corpo libero: serve a chi conta le serie
    // valide qui sotto e a chi le riassume all'allenatore, e dev'essere lo stesso.
    const corpoPerRiga: Record<string, boolean> = {}
    // E il peso dell'attrezzo a vuoto, per chi scrive solo i dischi (0 = non c'è).
    const attrezzoPerRiga: Record<string, number> = {}

    scheda.exercises.forEach(se => {
      const r = results.find(x => x.id === se.id)
      if (!r) return
      let target = se.linkedExerciseId ? exs.find(e => e.id === se.linkedExerciseId) : undefined
      if (!target) target = exs.find(e => e.n.trim().toLowerCase() === se.name.trim().toLowerCase())
      // `r.corpo` è quello che la pagina ha mostrato — compreso l'esercizio che
      // chi si allena ha detto a corpo libero lì per lì (vedi `diventaCorpoLibero`).
      const corpo = r.corpo ?? aCorpoLibero(target, se)
      corpoPerRiga[se.id] = corpo
      const attrezzo = corpo ? 0 : (target?.attrezzoKg ?? 0)
      attrezzoPerRiga[se.id] = attrezzo
      // Solo le serie che contano: spuntate e, con un attrezzo, con i chili
      // scritti (vedi `serieValide`). Ognuna col suo peso e i suoi colpi.
      // Gli indici si tengono una volta sola: filtrare due array separatamente
      // basterebbe finché i due filtri restano identici, e sarebbe il tipo di
      // accoppiamento che si rompe in silenzio disallineando peso e colpi.
      const doneIdx = serieValide(r.checks, r.weights, corpo, attrezzo)
      if (doneIdx.length === 0) return
      const doneWeights = doneIdx.map(idx => parseNum(r.weights[idx]))
      // I colpi previsti dalla scheda restano il ripiego per le serie lasciate in
      // bianco: un allenamento non può valere zero colpi solo perché il campo
      // non è stato toccato.
      // Serie per serie: in un "10-8-6" la terza lasciata in bianco vale 6, non 10.
      const attesi = colpiPrevisti(se.reps, se.sets)
      const doneReps = doneIdx.map(idx => parseInt(r.reps[idx]) || attesi[idx] || 0)
      // Il valore rappresentativo è la serie più PESANTE, colpi compresi: così
      // `kg × reps` resta una serie che è successa davvero, e non l'incrocio fra
      // il carico di una e le ripetizioni di un'altra.
      const top = doneWeights.indexOf(Math.max(...doneWeights))
      const kg = doneWeights[top]
      const variesKg = new Set(doneWeights).size > 1
      const variesReps = new Set(doneReps).size > 1

      const entry: PalestraHistoryEntry = {
        d: wl, date: today, kg, reps: doneReps[top] || 0, sets_n: doneIdx.length,
        scheda: { id: scheda.id, nome: scheda.title },
        // Cosa chiedeva la scheda oggi: serve a non giudicare questa alzata
        // con il programma di domani, se la scheda cambia.
        piano: { sets: Math.max(1, se.sets), reps: se.reps, riga: se.id },
        // E con che muscolo ci si è arrivati: fresco, o già al lavoro da prima.
        giaFatti: giaFatti(target?.muscle ?? se.muscle),
        ...(variesKg ? { setWeights: doneWeights } : {}),
        ...(variesReps ? { setReps: doneReps } : {}),
        // A corpo libero i chili scritti sono la zavorra: senza il segno, dieci
        // trazioni senza zavorra finirebbero nello storico come "0 kg".
        ...(corpo ? { bodyweight: true as const } : {}),
        // I chili scritti sono i soli dischi: l'attrezzo di oggi viaggia con l'alzata.
        ...(attrezzo > 0 ? { attrezzo } : {}),
        ...(r.note?.trim() ? { note: r.note.trim() } : {}),
        ...(fine.durataSec ? { durataSec: fine.durataSec } : {}),
      }

      if (target) {
        const tid = target.id
        // Confronto con lo storico PRIMA di accodare: dopo, l'alzata batterebbe sé stessa.
        const rec = recordFor(target.history, entry, bodyWeight * quotaCorpo(target))
        if (rec) recs.push({ name: target.n, ...rec })
        // `current` (il precompilato della prossima volta) è l'alzata più
        // RECENTE, non quella appena aggiunta: un allenamento di tre giorni fa
        // chiuso oggi non deve riportare indietro i carichi.
        // E se qui si è detto che l'esercizio è a corpo libero, da adesso lo sa
        // anche lui: la prossima volta non lo si richiede.
        exs = exs.map(e => {
          if (e.id !== tid) return e
          const history = sortedHistory([...e.history, entry])
          const last = history[history.length - 1]
          return {
            ...e, history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n },
            ...(corpo && !corpoLibero(e) ? { bodyweight: true } : {}),
          }
        })
        linkMap[se.id] = tid
        salvate.push({ exerciseId: tid, nome: target.n, entry })
      } else {
        const newId = uid('px')
        exs.push({
          id: newId, n: se.name.trim(), muscle: se.muscle || 'Altro',
          ...(se.bodyweight || corpo ? { bodyweight: true } : {}),
          current: { kg: entry.kg, reps: entry.reps, sets_n: entry.sets_n },
          history: [entry],
        })
        linkMap[se.id] = newId
        salvate.push({ exerciseId: newId, nome: se.name.trim(), entry })
      }
    })

    // I collegamenti si scrivono sulla scheda com'è ADESSO nello store, non
    // sulla copia aperta a inizio allenamento: riscrivendo quella, una modifica
    // alla scheda arrivata nel frattempo da un altro dispositivo tornava indietro.
    // Anche quando un collegamento c'era già ma puntava a un esercizio che non
    // esiste più (cancellato dalla sua pagina): prima restava lì, morto, e la
    // riga continuava a dirsi "collegata" a niente.
    const conCollegamenti = (sc: GymScheda): GymScheda => ({
      ...sc,
      exercises: sc.exercises.map(se => linkMap[se.id] && se.linkedExerciseId !== linkMap[se.id] ? { ...se, linkedExerciseId: linkMap[se.id] } : se),
      updatedAt: todayISO(),
    })
    set(st => ({ palestraExercises: exs, gymSchede: (st.gymSchede ?? []).map(s => s.id === scheda.id ? conCollegamenti(s) : s) }))
    setActive(conCollegamenti(useJarvisStore.getState().gymSchede?.find(s => s.id === scheda.id) ?? scheda))
    setView('detail')
    setRecords(recs)
    setAppenaSalvate(salvate)

    // Chi mi segue lo viene a sapere: una riga nella chat con ciascuno, con
    // dentro se c'è qualcosa da guardare. Parte solo se qualcosa è stato fatto
    // davvero, e a salvataggio avvenuto — se l'avviso non arriva, l'allenamento
    // c'è lo stesso.
    if (ioId && salvate.length > 0) {
      const testo = riassuntoAllenamento(scheda, results.map(r => ({ ...r, corpo: !!corpoPerRiga[r.id], attrezzo: attrezzoPerRiga[r.id] ?? 0 })), t, fine.durataSec)
      for (const l of allenatori) {
        avvisa(bozzaChat({ coachId: l.coach_id, athleteId: ioId, autore: ioId, autoreNome: userName ?? '', tipo: 'allenamento', testo }))
      }
    }
  }

  /** Riscrive un'alzata già salvata, trovandola per riferimento dentro lo storico
   *  del suo esercizio. Tiene allineato anche `current`, che è il precompilato del
   *  prossimo log: senza, correggere l'ultima alzata lascerebbe il campo sul
   *  valore sbagliato. */
  const correggiAlzata = (vecchia: AlzataSalvata, nuova: PalestraHistoryEntry) => {
    set(st => ({
      palestraExercises: (st.palestraExercises ?? []).map(e => {
        if (e.id !== vecchia.exerciseId) return e
        const history = sortedHistory(e.history.map(h => (h === vecchia.entry ? nuova : h)))
        const last = history[history.length - 1]
        return last
          ? { ...e, history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
          : { ...e, history }
      }),
    }))
    // La striscia deve puntare alla riga NUOVA, o la correzione dopo cercherebbe
    // un oggetto che nello storico non c'è più.
    // Per ALZATA e non per riga: la stessa alzata si può correggere anche dallo
    // storico della scheda, che la porta in un'altra riga. Confrontando le
    // righe la striscia restava sul valore vecchio, e correggendo poi da lì la
    // modifica si vedeva ma non arrivava da nessuna parte.
    setAppenaSalvate(list => list.map(a => (a.entry === vecchia.entry ? { ...a, entry: nuova } : a)))
  }

  /** Toglie dallo storico un'alzata registrata da una scheda (l'allenamento
   *  salvato due volte, l'esercizio spuntato per sbaglio). Per riferimento, come
   *  la correzione. */
  const eliminaAlzata = (a: AlzataSalvata) => {
    confirmDelete(() => {
      set(st => ({
        palestraExercises: (st.palestraExercises ?? []).map(e => {
          if (e.id !== a.exerciseId) return e
          const history = e.history.filter(h => h !== a.entry)
          const last = sortedHistory(history)[history.length - 1]
          return { ...e, history, current: last ? { kg: last.kg, reps: last.reps, sets_n: last.sets_n } : e.current }
        }),
      }))
      setAppenaSalvate(list => list.filter(x => x.entry !== a.entry))
    }, t('Alzata'))
  }

  const renderView = () => {
  if (view === 'form') {
    return (
      <SchedaFormPage
        scheda={editing}
        palestraExercises={palestraExercises}
        onCancel={() => setView(editing ? 'detail' : 'list')}
        // Solo su una scheda che esiste già: su una nuova non c'è niente da
        // eliminare, e il tasto sarebbe un "annulla" travestito da cestino.
        onDelete={editing ? () => removeScheda(editing.id, () => { setEditing(null); setActive(null); setView('list') }) : undefined}
        onSave={sc => {
          reconcileAndPersist({ ...sc, draft: false })
          const saved = useJarvisStore.getState().gymSchede?.find(s => s.id === sc.id) ?? sc
          setActive(saved)
          setView('detail')
        }}
        onSaveDraft={sc => persistScheda({ ...sc, draft: true })}
      />
    )
  }

  if (view === 'report') {
    return (
      <SchedaReportPage
        schede={schede}
        muscleColors={muscleColors}
        onBack={() => setView('list')}
      />
    )
  }

  if (view === 'training' && active) {
    return (
      <SchedaTrainingPage
        scheda={active}
        palestraExercises={palestraExercises}
        muscleColors={muscleColors}
        onExit={() => setView('detail')}
        onFinish={(results, fine) => finishTraining(active, results, fine)}
        seguito={allenatori.length > 0}
      />
    )
  }

  if (view === 'detail' && active) {
    // Rileggi la versione aggiornata dallo store (dopo un allenamento/modifica).
    const current = schede.find(s => s.id === active.id) ?? active
    return (
      <SchedaDetailPage
        scheda={current}
        muscleColors={muscleColors}
        // La riga intera e non il solo nome dell'allenatore: per scrivergli
        // servono i due id, e sono lì dentro.
        assegnata={assegnate.find(r => r.scheda.id === current.id)}
        ioId={ioId}
        mioNome={userName}
        allievi={allievi}
        onCondividi={ioId
          // Il corpo libero viaggia sulla riga: l'allievo non ha i miei
          // esercizi, e il suo "Dip" nascerebbe con attrezzo.
          ? (athleteId: string) => condividiScheda(ioId, athleteId, userName ?? '', {
            ...current,
            exercises: current.exercises.map(e => {
              const mio = e.linkedExerciseId ? palestraExercises.find(p => p.id === e.linkedExerciseId) : undefined
              return mio && corpoLibero(mio) ? { ...e, bodyweight: true } : e
            }),
          }).then(() => {
            // L'allievo lo viene a sapere: nella chat con lui, e con una notifica.
            avvisa(bozzaChat({
              coachId: ioId, athleteId, autore: ioId, autoreNome: userName ?? '', tipo: 'scheda',
              testo: t('Ti ho condiviso la scheda «{scheda}».', { scheda: current.title }),
            }))
          })
          : undefined}
        appenaSalvate={appenaSalvate}
        palestraExercises={palestraExercises}
        onCorreggi={setCorreggo}
        onElimina={eliminaAlzata}
        onBack={() => { setActive(null); setAppenaSalvate([]); setView('list') }}
        onEdit={() => { setEditing(current); setView('form') }}
        onDelete={() => removeScheda(current.id, () => { setActive(null); setView('list') })}
        inCorso={inCorso?.scheda.id === current.id ? inCorso : undefined}
        onStart={() => avvia(current)}
        onRicomincia={() => confirmDelete(
          () => { scartaSessione(); setActive(current); setView('training') },
          t('Allenamento in corso'),
          {
            eyebrow: t('Allenamento in corso'),
            title: t('Scartare l’allenamento?'),
            body: t('Le serie spuntate finora non vengono salvate. La prossima volta la scheda riparte da zero.'),
            cta: t('Scarta e inizia oggi'),
          },
        )}
      />
    )
  }

  return (
    <SchedeListPage
      schede={schede}
      anteprime={anteprime}
      muscleColors={muscleColors}
      daCoach={daCoach}
      onBack={onBack}
      onNew={() => { setEditing(null); setView('form') }}
      onOpen={sc => { setActive(sc); setView('detail') }}
      onDelete={removeScheda}
      onMove={moveScheda}
      mie={mie.map(x => x.id)}
      ultimaVolta={ultimaVolta}
      onReport={() => setView('report')}
      inCorso={inCorso}
      onRiprendi={sc => { setActive(sc); setView('training') }}
      onScarta={scartaAperta}
    />
  )
  }

  return (
    <>
      {renderView()}
      <RecordModal records={records} onClose={() => setRecords([])}/>
      {correggo && (
        <EditHistoryModal
          entry={correggo.entry}
          riferimentoKg={caricoDiRiferimento(palestraExercises.find(e => e.id === correggo.exerciseId)?.history ?? [], correggo.entry)}
          onClose={() => setCorreggo(null)}
          onSave={nuova => { correggiAlzata(correggo, nuova); setCorreggo(null) }}
        />
      )}
    </>
  )
}

/** Un'alzata appena scritta nello storico da un allenamento. `entry` è lo STESSO
 *  oggetto che sta dentro `palestraExercises`, e la correzione lo ritrova da lì:
 *  vedi `appenaSalvate`. */
interface AlzataSalvata {
  exerciseId: string
  nome: string
  entry: PalestraHistoryEntry
}

// ── Lista schede ───────────────────────────────────────────────
/** Quello che l'elenco dice di una scheda oltre al nome. */
interface AnteprimaScheda {
  muscoli: MuscoloToccato[]
  /** La durata stimata, già ai cinque minuti. 0 = scheda vuota. */
  durataSec: number
}

// I chip sotto il nome di una scheda: la durata e i gruppi muscolari, TUTTI.
// Per un momento oltre i sei si contavano ("+3"), ma lo spazio c'è, e un
// numero al posto di un nome è proprio l'informazione che si era venuti a
// leggere. Piccoli e sottili: sono un'etichetta, non un tasto.
const CHIP: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 3, height: 18, padding: '0 7px',
  borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
  fontFamily: NUC.label, fontSize: 9.5, fontWeight: 500, letterSpacing: '.03em',
}
const CHIP_NEUTRO: CSSProperties = {
  ...CHIP, background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
}

function SchedeListPage({ schede, anteprime, muscleColors, daCoach, onBack, onNew, onOpen, onDelete, onReport, onMove, mie, ultimaVolta, inCorso, onRiprendi, onScarta }: {
  schede: GymScheda[]
  /** id scheda → muscoli toccati e durata stimata. */
  anteprime: Map<string, AnteprimaScheda>
  muscleColors: Record<string, string>
  /** id scheda → nome dell'allenatore che l'ha assegnata. */
  daCoach: Map<string, string>
  onBack: () => void
  onNew: () => void
  onOpen: (s: GymScheda) => void
  onDelete: (id: string) => void
  onReport: () => void
  /** Sposta una propria scheda di un posto. */
  onMove: (id: string, dir: -1 | 1) => void
  /** Gli id delle proprie schede, nell'ordine dello store: solo queste si spostano. */
  mie: string[]
  /** id scheda → da quanti giorni non la si fa. Assente = mai fatta. */
  ultimaVolta: Map<string, number>
  /** L'allenamento lasciato a metà, se c'è. `vecchia` = fermo da più di dodici
   *  ore: non è "in corso", è rimasto aperto. */
  inCorso?: { scheda: GymScheda; fatte: number; totali: number; vecchia: boolean; iniziataA: number }
  onRiprendi: (s: GymScheda) => void
  onScarta: () => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  // Quale sagoma accendere per i gruppi che l'utente si è creato.
  const icone = useMuscleIcons()
  const hasExercises = schede.some(s => s.exercises.length > 0)
  // Riordinare e cancellare sono gesti rari; aprire una scheda è il gesto di
  // ogni giorno. Tenendo le frecce e il cestino sempre accesi, ogni riga
  // dell'elenco portava tre bersagli da non colpire per arrivare all'unico da
  // colpire. Adesso stanno dietro la matita in testata, come l'"Edit" degli
  // elenchi di iOS: acceso quando si sistema l'elenco, spento quando ci si
  // allena.
  const [modifica, setModifica] = useState(false)
  // Le frecce: stessa forma di quelle del form della scheda. Il tocco non deve
  // arrivare alla card, che aprirebbe la scheda.
  const freccia = (id: string, dir: -1 | 1, attiva: boolean) => (
    <button
      onClick={e => { e.stopPropagation(); if (attiva) onMove(id, dir) }}
      disabled={!attiva}
      aria-label={dir < 0 ? t('Sposta su') : t('Sposta giù')}
      title={dir < 0 ? t('Sposta su') : t('Sposta giù')}
      className="flex items-center justify-center"
      style={{
        width: 30, height: 30, borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
        cursor: attiva ? 'pointer' : 'default', opacity: attiva ? 1 : 0.3,
      }}
    >
      <span style={{ display: 'flex', transform: `rotate(${dir < 0 ? -90 : 90}deg)` }}><Icons.chev size={13} stroke={2}/></span>
    </button>
  )
  return (
    <SchedaPage
      onBack={onBack}
      title={t('Schede d’allenamento')}
      sub={schede.length === 1 ? t('1 scheda') : t('{n} schede', { n: schede.length })}
      azioni={<>
        {hasExercises && (
          <button onClick={onReport} title={t('Report gruppi muscolari')} className="j-hard flex items-center justify-center" style={iconBtn(false, 40)}>
            <Icons.chart size={17} stroke={1.8}/>
          </button>
        )}
        {/* Niente matita su un elenco vuoto: non c'è niente da sistemare. */}
        {schede.length > 0 && (
          <button
            onClick={() => setModifica(m => !m)}
            aria-pressed={modifica}
            aria-label={modifica ? t('Fine') : t('Modifica elenco')}
            title={modifica ? t('Fine') : t('Modifica elenco')}
            className="j-hard flex items-center justify-center"
            style={{
              ...iconBtn(false, 40),
              ...(modifica ? {
                background: 'var(--j-accent)',
                border: '1px solid var(--j-accent)',
                color: 'var(--j-accent-fg)',
              } : {}),
            }}
          >
            {modifica ? <Icons.check size={17} stroke={2.4}/> : <Icons.pencil size={16} stroke={1.8}/>}
          </button>
        )}
        <button onClick={onNew} className="j-btn-add"><Icons.plus size={18} stroke={2}/></button>
      </>}
    >

      <div className="j-scroll-area">
        {/* In cima a tutto: chi esce a metà allenamento e torna qui sta
            cercando questo, non l'elenco. Un tocco e si è dove si era. */}
        {inCorso && (
          <div className="mb-2.5 flex items-center gap-2" style={{
            padding: '10px 10px 10px 14px', borderRadius: 'var(--radius)',
            background: 'color-mix(in srgb, var(--j-accent) 10%, var(--surface))', border: '1px solid var(--j-accent)',
          }}>
            <button onClick={() => onRiprendi(inCorso.scheda)} className="flex items-center gap-3" style={{
              flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex', flexShrink: 0, color: 'var(--j-accent-ink)' }}><Icons.play size={18}/></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--j-accent-ink)' }}>
                  {/* Di ieri o di prima: lo si dice, col giorno. Riprendendolo e
                      chiudendolo finisce in QUEL giorno, non in quello di oggi. */}
                  {inCorso.vecchia
                    ? t('Allenamento non chiuso · {giorno}', { giorno: fmtDayMon(localISO(new Date(inCorso.iniziataA))) })
                    : t('Allenamento in corso')}
                </span>
                <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {inCorso.scheda.title}
                </span>
                <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>
                  {t('{fatte}/{totali} serie fatte · tocca per riprendere', { fatte: inCorso.fatte, totali: inCorso.totali })}
                </span>
              </span>
            </button>
            <button onClick={onScarta} aria-label={t('Scarta allenamento in corso')} title={t('Scarta allenamento in corso')} className="flex items-center justify-center" style={{
              width: 32, height: 32, flexShrink: 0, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
            }}>
              <Icons.trash size={13} stroke={1.6}/>
            </button>
          </div>
        )}
        {schede.length === 0 && (
          <div className="j-empty">{t('Nessuna scheda — creane una con +')}</div>
        )}
        {schede.map(s => (
          <div key={s.id} onClick={() => onOpen(s)} className="mb-2 cursor-pointer">
            {/* Più bassa e più fine di una card qualunque: qui le card sono un
                elenco da scorrere con l'occhio, e ognuna porta già tre righe. */}
            <NucCard pad={11} style={{ paddingLeft: 13, paddingRight: 12 }}>
              <div className="flex items-center justify-between gap-3">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: NUC.font, fontSize: 15.5, fontWeight: 500, lineHeight: 1.2, letterSpacing: -0.1, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    {s.draft && (
                      <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warn)', background: 'rgba(var(--warn-rgb),0.12)', border: '1px solid rgba(var(--warn-rgb),0.35)', padding: '1px 5px' }}>{t('Bozza')}</span>
                    )}
                    {daCoach.has(s.id) && (
                      <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--j-accent-ink)', background: 'color-mix(in srgb, var(--j-accent) 12%, transparent)', border: '1px solid var(--j-accent)', padding: '1px 5px' }}>{t('Allenatore')}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: 0.3, color: NUC.faint, marginTop: 2 }}>
                    {s.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: s.exercises.length })}
                    {daCoach.has(s.id) && ` · ${t('da {chi}', { chi: daCoach.get(s.id) ?? '' })}`}
                    {/* Da quanto non la si fa. Oltre i dieci giorni cambia
                        colore: è la soglia da cui i carichi pesano di più. */}
                    {ultimaVolta.has(s.id) && (
                      <span style={(ultimaVolta.get(s.id) ?? 0) > GIORNI_DI_STOP ? { color: 'var(--warn)', fontWeight: 600 } : undefined}>
                        {' · '}{quantoFa(ultimaVolta.get(s.id) ?? 0, t)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  {modifica && <>
                    {/* Su e giù solo per le proprie schede, e solo se ce n'è più di una. */}
                    {mie.length > 1 && mie.includes(s.id) && (
                      <>
                        {freccia(s.id, -1, mie.indexOf(s.id) > 0)}
                        {freccia(s.id, 1, mie.indexOf(s.id) < mie.length - 1)}
                      </>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                      aria-label={t('Elimina {cosa}', { cosa: s.title })}
                      className="flex items-center justify-center"
                      style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      <Icons.trash size={13} stroke={1.6}/>
                    </button>
                  </>}
                  {/* L'omino coi muscoli della scheda accesi: la si riconosce
                      prima di leggerla. Via mentre si riordina l'elenco, dove
                      quello spazio serve a frecce e cestino. */}
                  {!modifica && (anteprime.get(s.id)?.muscoli.length ?? 0) > 0 && (
                    <OminoMuscoli
                      size={44} color={NUC.faint}
                      muscoli={(anteprime.get(s.id)?.muscoli ?? []).map(m => ({ muscolo: m.muscolo, colore: muscleColor(m.muscolo, muscleColors), icona: icone[m.muscolo] }))}
                    />
                  )}
                  <div style={{ color: NUC.faint, display: 'flex' }}><Icons.chev size={13} stroke={1.5}/></div>
                </div>
              </div>
                {/* Cosa c'è dentro, senza aprirla: quanto dura e che muscoli
                  tocca, col colore di ciascun gruppo. "Giovedì · 11 esercizi"
                  da solo non dice se è il giorno delle gambe, né se sta
                  nell'ora che si ha. Sotto la riga del nome e a tutta
                  larghezza: accanto alla freccia i chip andavano a capo uno
                  prima del necessario. */}
                {(() => {
                  const a = anteprime.get(s.id)
                  if (!a || a.muscoli.length === 0) return null
                  return (
                    <div className="flex flex-wrap" style={{ gap: 4, marginTop: 7 }}>
                      {a.durataSec > 0 && (
                        <span style={CHIP_NEUTRO} title={t('Durata stimata, con un minuto e mezzo di recupero fra le serie')}>
                          <Icons.clock size={10} stroke={1.7}/>
                          <span aria-label={t('Durata stimata: circa {durata}', { durata: fmtDurata(a.durataSec) })}>≈ {fmtDurata(a.durataSec)}</span>
                        </span>
                      )}
                      {a.muscoli.map(m => {
                        const c = muscleColor(m.muscolo, muscleColors)
                        return (
                          <span key={m.muscolo} style={{
                            ...CHIP,
                            background: `color-mix(in srgb, ${c} 14%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${c} 38%, transparent)`,
                            color: muscleTextColor(c, dark),
                          }}>
                            {tData(m.muscolo)}
                          </span>
                        )
                      })}
                    </div>
                  )
                })()}
            </NucCard>
          </div>
        ))}
      </div>
    </SchedaPage>
  )
}

// ── Form creazione / modifica scheda (pagina a parte) ──────────
// L'etichetta sopra ogni campo del form. Erano a 9px nel grigio più tenue, cioè
// dello stesso peso del segnaposto dentro il campo: nome, serie, colpi e nota
// si leggevano come un blocco solo di rettangoli uguali. Adesso hanno il colore
// dei titoli di sezione dell'app e un corpo che si legge: prima si vede COSA si
// sta compilando, poi il campo.
const ETICHETTA_CAMPO: CSSProperties = {
  fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em',
  textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginBottom: 5,
}

interface FormRow {
  id: string; name: string; sets: string; reps: string; linkedExerciseId?: string; muscle: string; bodyweight: boolean; note: string; supersetWithNext: boolean
  /** L'esercizio a cui la riga era collegata aprendo il form. Serve a dire cosa
   *  succede quando se ne cambia il nome, e a ricollegarla se il nome torna. */
  origine?: { id: string; nome: string }
}

export function SchedaFormPage({ scheda, palestraExercises, onCancel, onSave, onSaveDraft, onDelete }: {
  scheda: GymScheda | null
  palestraExercises: PalestraExercise[]
  onCancel: () => void
  /** Può essere asincrono (la scheda di un allievo si salva in rete): se la
   *  promessa fallisce il form resta aperto, lo dice, e le modifiche restano
   *  da salvare. */
  onSave: (s: GymScheda) => void | Promise<void>
  /** Salva com'è, anche incompleta, per non perdere il lavoro. Manca dove una
   *  bozza farebbe un danno: sulla scheda già assegnata a un allievo, che
   *  tornando bozza gli sparirebbe dall'app (vedi JarvisCoach). Lì, se manca
   *  qualcosa, si dice cosa e non si salva niente. */
  onSaveDraft?: (s: GymScheda) => void | Promise<void>
  /** Eliminare la scheda. È QUI e non nella testata del dettaglio: il cestino
   *  accanto alla matita era un bersaglio da 36px a fianco di quello che si
   *  voleva premere davvero, e sopra una scheda scritta in mezz'ora. Dentro la
   *  modifica sta insieme alle altre cose che cambiano la scheda, in fondo,
   *  dopo il salvataggio — cioè dopo tutto quello che si viene a fare qui.
   *  Manca su una scheda nuova (non c'è ancora niente da eliminare) e sulle
   *  schede scritte per un allievo, che si tolgono dalla lista dell'allievo. */
  onDelete?: () => void
}) {
  const t = useT()
  const tData = useTData()
  const { confirmDelete } = useConfirmDelete()
  // Il form leggeva i colori da una mappa vuota, ignorando le personalizzazioni utente.
  const muscleColors = useMuscleColors()
  // Anche i gruppi creati dall'utente: una riga di scheda deve poter puntare a
  // "Avambracci" come a "Petto".
  const gruppi = useGruppiMuscolari()
  // Id e data di creazione stabili per tutta la sessione del form: così un salvataggio
  // "bozza" e il successivo salvataggio "pieno" aggiornano la STESSA scheda (niente doppioni).
  const [schedaId] = useState(() => scheda?.id ?? uid('sc'))
  const [createdAt] = useState(scheda?.createdAt ?? todayISO())
  const [title, setTitle] = useState(scheda?.title ?? '')
  const [rows, setRows] = useState<FormRow[]>(
    scheda?.exercises.length
      ? scheda.exercises.map(e => ({
        id: e.id, name: e.name, sets: String(e.sets), reps: e.reps, linkedExerciseId: e.linkedExerciseId, muscle: e.muscle ?? '', bodyweight: !!e.bodyweight, note: e.note ?? '', supersetWithNext: !!e.supersetWithNext,
        ...(e.linkedExerciseId && palestraExercises.some(x => x.id === e.linkedExerciseId) ? { origine: { id: e.linkedExerciseId, nome: e.name } } : {}),
      }))
      : [{ id: uid('r'), name: '', sets: '3', reps: '8', muscle: '', bodyweight: false, note: '', supersetWithNext: false }]
  )
  const [focused, setFocused] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [draftSaved, setDraftSaved] = useState(false)
  // La scheda esiste già da quando è stata salvata la prima volta, anche come
  // bozza: da lì in poi il tasto salva delle MODIFICHE, non crea una scheda.
  const [giaSalvata, setGiaSalvata] = useState(!!scheda)
  const erroriRef = useRef<HTMLDivElement>(null)
  const etichettaSalva = giaSalvata ? t('Salva modifiche') : t('Salva scheda')

  // C'è qualcosa di scritto qui dentro che non è ancora stato salvato. Serve
  // alla freccia indietro: prima usciva e basta, e una scheda di otto esercizi
  // scritta in dieci minuti spariva per un tocco nel posto sbagliato.
  const [modificato, setModificato] = useState(false)

  // Ogni modifica azzera il feedback di validazione precedente.
  const clearFeedback = () => {
    setModificato(true)
    if (errors.length || draftSaved) { setErrors([]); setDraftSaved(false) }
  }

  const esci = () => {
    if (!modificato) { onCancel(); return }
    confirmDelete(onCancel, t('le modifiche'), {
      eyebrow: scheda ? t('Modifica scheda') : t('Nuova scheda'),
      title: t('Uscire senza salvare?'),
      body: t('Quello che hai scritto in questa scheda dall’ultimo salvataggio va perso.'),
      cta: t('Esci senza salvare'),
    })
  }

  // Cambiare il nome di una riga collegata vuol dire cambiare esercizio: il
  // collegamento cade e al salvataggio ne nasce (o se ne aggancia) un altro,
  // col suo storico. È voluto — i nomi degli esercizi sono già giusti, e chi ne
  // scrive un altro sta scegliendo un altro esercizio. Ma non in silenzio: sotto
  // il campo si dice cosa succede (vedi più giù). Se il nome torna quello di
  // prima, torna anche il collegamento.
  // Un nome che è già quello di un esercizio si aggancia subito a lui (al
  // salvataggio succederebbe comunque): così l'avviso non compare a chi ha solo
  // riscritto il nome nuovo di un esercizio rinominato dalla sua pagina.
  const cambiaNome = (r: FormRow, nome: string) => {
    const n = nome.trim().toLowerCase()
    const tornato = r.origine && n === r.origine.nome.trim().toLowerCase()
    const esistente = n ? palestraExercises.find(e => e.n.trim().toLowerCase() === n) : undefined
    patch(r.id, { name: nome, linkedExerciseId: tornato ? r.origine!.id : esistente?.id })
  }

  const patch = (id: string, changes: Partial<FormRow>) => {
    clearFeedback()
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...changes } : r))
  }

  const addRow = () => { clearFeedback(); setRows(rs => [...rs, { id: uid('r'), name: '', sets: '3', reps: '8', muscle: '', bodyweight: false, note: '', supersetWithNext: false }]) }
  const removeRow = (id: string) => { clearFeedback(); setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs) }

  // Sposta un esercizio su/giù nell'ordine (#3): vale sia in creazione che in modifica.
  const move = (id: string, dir: -1 | 1) => {
    clearFeedback()
    setRows(rs => {
      const i = rs.findIndex(r => r.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const copy = [...rs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  // Suggerimenti: esercizi già salvati che matchano il nome digitato.
  const suggestionsFor = (row: FormRow): PalestraExercise[] => {
    const q = row.name.trim().toLowerCase()
    if (!q || row.linkedExerciseId) return []
    return palestraExercises
      .filter(e => e.n.toLowerCase().includes(q) && e.n.toLowerCase() !== q)
      .slice(0, 6)
  }

  const pickSuggestion = (rowId: string, ex: PalestraExercise) => {
    patch(rowId, { name: ex.n, linkedExerciseId: ex.id, muscle: displayMuscle(ex.muscle) })
    setFocused(null)
  }

  const buildExercises = (): GymSchedaExercise[] => {
    const filled = rows.filter(r => r.name.trim() !== '')
    return filled
      .map((r, i) => ({
        id: r.id,
        name: r.name.trim(),
        sets: parseInt(r.sets) || 1,
        reps: r.reps.trim(),
        ...(r.linkedExerciseId ? { linkedExerciseId: r.linkedExerciseId } : {}),
        ...(r.muscle ? { muscle: displayMuscle(r.muscle) } : {}),
        // Solo per un esercizio nuovo: di uno che esiste già lo sa l'esercizio.
        ...(!r.linkedExerciseId && r.bodyweight ? { bodyweight: true } : {}),
        ...(r.note.trim() ? { note: r.note.trim() } : {}),
        // Il superset lega l'esercizio al SUCCESSIVO: sull'ultimo non ha senso.
        ...(r.supersetWithNext && i < filled.length - 1 ? { supersetWithNext: true as const } : {}),
      }))
  }

  // Elenco leggibile di cosa manca (#2): mostrato all'utente invece del silenzio.
  const validate = (): string[] => {
    const errs: string[] = []
    if (title.trim() === '') errs.push(t('Manca il nome della scheda'))
    if (rows.every(r => r.name.trim() === '')) errs.push(t('Aggiungi almeno un esercizio con un nome'))
    rows.forEach((r, i) => {
      if (r.name.trim() === '') return
      const n = i + 1
      if ((parseInt(r.sets) || 0) <= 0) errs.push(t('Esercizio {n}: numero di serie non valido', { n }))
      if ((parseInt(r.sets) || 0) > SERIE_MAX) errs.push(t('Esercizio {n}: al massimo {max} serie', { n, max: SERIE_MAX }))
      if (r.reps.trim() === '') errs.push(t('Esercizio {n}: mancano i colpi (ripetizioni)', { n }))
      if (!r.linkedExerciseId && r.muscle === '') errs.push(t('Esercizio {n}: scegli il gruppo muscolare', { n }))
    })
    return errs
  }

  const buildScheda = (): GymScheda => ({
    id: schedaId,
    title: title.trim() || 'Scheda senza nome',
    exercises: buildExercises(),
    createdAt,
    updatedAt: todayISO(),
  })

  // Un solo bottone, sempre attivo: se tutto è valido salva la scheda; altrimenti
  // salva comunque la BOZZA (niente lavoro perso) ed elenca cosa manca (#2).
  const handleSave = () => {
    const errs = validate()
    // "Non c'è più niente da salvare" si dice solo a salvataggio RIUSCITO. Chi
    // salva in rete (la scheda di un allievo) può fallire: dirlo prima voleva
    // dire che, a salvataggio fallito, la freccia indietro usciva senza
    // chiedere e le modifiche sparivano.
    const nonRiuscito = () => setErrors([t('Salvataggio non riuscito: controlla la rete e riprova.')])
    if (errs.length === 0) {
      setErrors([]); setDraftSaved(false)
      void Promise.resolve(onSave(buildScheda())).then(() => { setGiaSalvata(true); setModificato(false) }, nonRiuscito)
    } else {
      setErrors(errs)
      // Senza bozza (vedi `onSaveDraft`) non si salva niente: restano scritte
      // le cose che mancano, e le modifiche restano da salvare.
      if (onSaveDraft) {
        void Promise.resolve(onSaveDraft(buildScheda())).then(() => { setGiaSalvata(true); setModificato(false); setDraftSaved(true) }, nonRiuscito)
      }
      // L'elenco di cosa manca sta in fondo: salvando dal tasto in alto non si
      // vedrebbe, e la bozza sembrerebbe un salvataggio riuscito.
      requestAnimationFrame(() => erroriRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
  }

  return (
    <SchedaPage
      onBack={esci}
      title={scheda ? t('Modifica scheda') : t('Nuova scheda')}
      sub={t('{n} esercizi', { n: rows.filter(r => r.name.trim()).length })}
      // Il salvataggio anche in alto, fuori dalla parte che scorre: una scheda
      // di otto esercizi è lunga, e scendere fino in fondo per salvare una
      // correzione al primo era il gesto più ripetuto del form.
      extra={
        <button onClick={handleSave} className="j-btn-accent-sm" style={{ marginTop: 12 }}>
          <Icons.check size={16} stroke={2.2}/> {etichettaSalva}
        </button>
      }
    >

      <div className="j-scroll-area">
        {/* Il nome della scheda ha la sua etichetta e un filo d'accent a
            sinistra: è il campo che dà il nome a tutto il resto, e stava in
            cima alla pagina identico ai campi degli esercizi sotto. */}
        <label style={{ display: 'block', marginBottom: 18 }}>
          <div style={ETICHETTA_CAMPO}>{t('Nome della scheda')}</div>
          <input
            value={title}
            onChange={e => { clearFeedback(); setTitle(e.target.value) }}
            placeholder={t('Nome scheda (es. Upper A)')}
            className="j-field"
            style={{ height: 50, fontFamily: NUC.font, fontSize: 17, fontWeight: 500, borderLeft: '3px solid var(--j-accent)' }}
          />
        </label>

        {rows.map((r, idx) => {
          const suggestions = focused === r.id ? suggestionsFor(r) : []
          const color = muscleColor(r.muscle, muscleColors)
          const isLast = idx === rows.length - 1
          const linkedToPrev = idx > 0 && rows[idx - 1].supersetWithNext
          return (
            <div key={r.id}>
            {/* Il filo a sinistra c'è sempre: del gruppo muscolare appena lo si
                sa, dell'accent prima. Senza, una riga ancora vuota era una card
                grigia fra card grigie. Il numero sta in un bollino dello stesso
                colore, così le card si contano a colpo d'occhio scorrendo. */}
            <NucCard pad={14} style={{ marginBottom: r.supersetWithNext ? 4 : 12, borderLeft: `3px solid ${r.muscle ? color : 'var(--j-accent)'}` }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span aria-hidden="true" className="flex items-center justify-center" style={{
                    width: 24, height: 24, flexShrink: 0, borderRadius: 'var(--radius-pill)',
                    background: r.muscle ? color : 'var(--j-accent)',
                    color: r.muscle ? onMuscleColor(color) : 'var(--j-accent-fg)',
                    fontFamily: NUC.label, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  }}>{idx + 1}</span>
                  <span style={{ fontFamily: NUC.label, fontSize: 11, fontWeight: 600, letterSpacing: '.12em', color: NUC.ink, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span className="sr-only">{t('Esercizio {n}', { n: idx + 1 })}</span>
                    <span aria-hidden="true">{t('Esercizio')}</span>
                    {linkedToPrev && (
                      <span style={{ marginLeft: 8, color: 'var(--tertiary-ink)' }}>· {t('superset')}</span>
                    )}
                    {r.linkedExerciseId && (
                      <span style={{ marginLeft: 8, color: 'var(--j-accent-ink)' }}>· {t('collegato')}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => move(r.id, -1)} disabled={idx === 0} title={t('Sposta su')} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>
                    <span style={{ display: 'flex', transform: 'rotate(-90deg)' }}><Icons.chev size={13} stroke={2}/></span>
                  </button>
                  <button onClick={() => move(r.id, 1)} disabled={idx === rows.length - 1} title={t('Sposta giù')} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim, cursor: idx === rows.length - 1 ? 'default' : 'pointer', opacity: idx === rows.length - 1 ? 0.3 : 1 }}>
                    <span style={{ display: 'flex', transform: 'rotate(90deg)' }}><Icons.chev size={13} stroke={2}/></span>
                  </button>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(r.id)} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer' }}>
                      <Icons.trash size={12} stroke={1.6}/>
                    </button>
                  )}
                </div>
              </div>

              {/* Nome con ricerca simultanea */}
              <div style={ETICHETTA_CAMPO}>{t('Nome')}</div>
              <div style={{ position: 'relative' }}>
                <input
                  value={r.name}
                  onChange={e => cambiaNome(r, e.target.value)}
                  onFocus={() => setFocused(r.id)}
                  onBlur={() => setTimeout(() => setFocused(f => f === r.id ? null : f), 150)}
                  placeholder={t('Nome esercizio')}
                  aria-label={t('Nome esercizio')}
                  className="j-field"
                  style={{ fontWeight: 500 }}
                />
                {suggestions.length > 0 && (
                  // Il menù galleggia SOPRA i campi sotto: con `--surface`, che nei
                  // temi a vetro è bianco quasi trasparente, i campi si leggevano
                  // attraverso e i nomi degli esercizi ci si confondevano sopra.
                  // Fondo pieno (`--surface-menu`): anche la sfocatura del vetro qui
                  // non funziona, perché la card intorno è già di vetro.
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                    background: 'var(--surface-menu)', border: `1px solid ${NUC.hairline}`, borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-pop)', overflow: 'hidden',
                  }}>
                    {suggestions.map((ex, i) => (
                      <button
                        key={ex.id}
                        onMouseDown={e => { e.preventDefault(); pickSuggestion(r.id, ex) }}
                        className="flex items-center gap-2 w-full"
                        style={{ padding: '11px 12px', background: 'transparent', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--divider)', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: muscleColor(ex.muscle, muscleColors), flexShrink: 0 }}/>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: NUC.font, fontSize: 13, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</span>
                        <span style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.08em', color: NUC.faint, textTransform: 'uppercase' }}>{tData(displayMuscle(ex.muscle))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {r.origine && r.linkedExerciseId !== r.origine.id && r.name.trim() !== '' && (
                <div role="note" style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
                  fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: 'var(--warn)',
                }}>
                  {t('Nome cambiato: questa riga diventa un altro esercizio, con uno storico suo. Quello di «{nome}» resta dov’è. Per correggere solo il nome, fallo dalla pagina dell’esercizio.', { nome: tData(r.origine.nome) })}
                </div>
              )}

              {/* Serie · Colpi: sono i due numeri che fanno la riga, e stanno in
                  un riquadro loro, più chiaro della card, con le cifre grandi e
                  al centro — si distinguono dal nome sopra e dalla nota sotto
                  anche senza leggere le etichette. */}
              <div className="flex gap-2.5" style={{
                marginTop: 12, padding: '10px 10px 12px', borderRadius: 'var(--radius)',
                background: 'var(--surface-2)', border: '1px solid var(--hairline-soft)',
              }}>
                <label style={{ flex: 1, minWidth: 0 }}>
                  <div style={ETICHETTA_CAMPO}>{t('Serie')}</div>
                  <input value={r.sets} onChange={e => patch(r.id, { sets: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="3" className="j-field" style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}/>
                </label>
                <label style={{ flex: 1.4, minWidth: 0 }}>
                  <div style={ETICHETTA_CAMPO}>{t('Colpi')}</div>
                  <div className="flex gap-1.5">
                    <input
                      value={r.reps}
                      onChange={e => patch(r.id, { reps: e.target.value })}
                      placeholder="8"
                      className="j-field"
                      style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                    />
                    {/* "max" è un obiettivo che un numero non sa dire: le serie a
                        cedimento non hanno un bersaglio da centrare, si va finché
                        si va. Il campo è testo libero e la parola si potrebbe
                        scrivere a mano, ma andava scritta uguale ogni volta —
                        `colpiPrevisti` legge dei numeri e su "max" cade su 0, cioè
                        "nessun obiettivo", che è esattamente il comportamento
                        giusto: in allenamento non compare nessun avviso di serie
                        sotto il bersaglio. Con un tasto la parola è sempre quella.

                        Si ripreme per tornare a un numero: un interruttore che si
                        accende e non si spegne obbligherebbe a cancellare a mano
                        quello che un tocco ha scritto. */}
                    <button
                      type="button"
                      onClick={() => patch(r.id, { reps: r.reps.trim().toLowerCase() === 'max' ? '' : 'max' })}
                      aria-pressed={r.reps.trim().toLowerCase() === 'max'}
                      style={{
                        flexShrink: 0, padding: '0 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                        background: r.reps.trim().toLowerCase() === 'max' ? 'var(--j-accent)' : 'var(--surface)',
                        border: `1px solid ${r.reps.trim().toLowerCase() === 'max' ? 'var(--j-accent)' : NUC.hairline}`,
                        color: r.reps.trim().toLowerCase() === 'max' ? 'var(--j-accent-fg)' : NUC.dim,
                        fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
                        transition: 'background 160ms, color 160ms, border-color 160ms',
                      }}
                    >
                      max
                    </button>
                  </div>
                </label>
              </div>

              {/* Gruppo muscolare: richiesto solo se l'esercizio è nuovo (non collegato) */}
              {!r.linkedExerciseId && r.name.trim() !== '' && (
                <div style={{ marginTop: 12 }}>
                  <div style={ETICHETTA_CAMPO}>
                    {t('Gruppo muscolare')}
                  </div>
                  <select value={r.muscle} onChange={e => patch(r.id, { muscle: e.target.value })} className="j-field">
                    <option value="">{t('Scegli il gruppo…')}</option>
                    {gruppi.map(m => <option key={m} value={m}>{tData(m)}</option>)}
                  </select>
                  {/* Come nel "Nuovo esercizio": l'esercizio nasce qui, ed è qui
                      che si dice se ha un peso da caricare o è il proprio corpo.
                      Senza, un "Dip" creato da una scheda si salvava a 0 kg. */}
                  <div className="flex gap-2" style={{ marginTop: 8 }}>
                    {([false, true] as const).map(bw => (
                      <button key={String(bw)} type="button" onClick={() => patch(r.id, { bodyweight: bw })} aria-pressed={r.bodyweight === bw} style={{
                        flex: 1, height: 34, borderRadius: 'var(--radius)', cursor: 'pointer',
                        background: r.bodyweight === bw ? 'var(--surface-2)' : 'var(--surface)',
                        border: `1px solid ${r.bodyweight === bw ? 'var(--j-accent)' : NUC.hairline}`,
                        color: r.bodyweight === bw ? 'var(--j-accent-ink)' : NUC.dim,
                        fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.08em',
                      }}>
                        {bw ? t('Corpo libero') : t('Con attrezzo')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Nota (opzionale): mostrata anche durante l'allenamento */}
              <div style={{ marginTop: 12 }}>
                {/* Grigia e non del colore delle altre: è l'unica cosa della
                    riga che si può lasciare vuota, e si deve capire da lontano. */}
                <div style={{ ...ETICHETTA_CAMPO, color: NUC.faint }}>
                  {t('Nota')} <span style={{ opacity: 0.7, fontWeight: 500 }}>{t('(opzionale)')}</span>
                </div>
                <textarea
                  value={r.note}
                  onChange={e => patch(r.id, { note: e.target.value })}
                  // Una parola sola. L'esempio lungo ("Es. presa larga, tempo
                  // 3-1-1, RIR 2…") andava a capo dentro un campo alto due righe e
                  // se ne mangiava metà prima ancora di scriverci dentro.
                  placeholder={t('Testo')}
                  className="j-field"
                  rows={2}
                  style={{ resize: 'none', lineHeight: 1.5, borderStyle: 'dashed' }}
                />
              </div>
            </NucCard>

            {/* Toggle superset con l'esercizio successivo (nessun rest tra i due) */}
            {!isLast && (
              <button
                onClick={() => patch(r.id, { supersetWithNext: !r.supersetWithNext })}
                className="flex items-center justify-center gap-1.5 w-full"
                style={{
                  height: 30, borderRadius: 'var(--radius-sm)', marginBottom: 10, cursor: 'pointer',
                  background: r.supersetWithNext ? 'var(--surface-2)' : 'transparent',
                  border: `1px ${r.supersetWithNext ? 'solid var(--j-accent)' : `dashed ${NUC.hairline}`}`,
                  color: r.supersetWithNext ? 'var(--j-accent-ink)' : NUC.faint,
                  fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em',
                  transition: 'all 160ms',
                }}
              >
                <Icons.repeat size={12} stroke={1.8}/>
                {r.supersetWithNext ? t('In superset con il prossimo') : t('Superset con il prossimo')}
              </button>
            )}
            </div>
          )
        })}

        <button onClick={addRow} className="flex items-center justify-center gap-2 w-full" style={{
          height: 48, borderRadius: 'var(--radius)', cursor: 'pointer', marginBottom: 16,
          background: 'color-mix(in srgb, var(--j-accent) 8%, var(--surface))', border: '1px dashed var(--j-accent)',
          color: 'var(--j-accent-ink)', fontFamily: NUC.label, fontSize: 12.5, fontWeight: 600, letterSpacing: '.04em',
        }}>
          <Icons.plus size={15} stroke={2}/> {t('Aggiungi esercizio')}
        </button>

        {errors.length > 0 && (
          <div ref={erroriRef} style={{
            marginBottom: 12, padding: '12px 14px',
            background: 'rgba(var(--warn-rgb),0.08)', border: '1px solid rgba(var(--warn-rgb),0.3)',
          }}>
            <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: 6 }}>
              {draftSaved ? t('Bozza salvata · da completare') : t('Da completare')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {errors.map((e, i) => (
                <li key={i} style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.dim, lineHeight: 1.35 }}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={handleSave} className="j-btn-accent">
          {etichettaSalva}
        </button>
        <div style={{ fontFamily: NUC.label, fontSize: 9.5, color: NUC.faint, letterSpacing: '.03em', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          {onSaveDraft
            ? t('Se manca qualcosa la scheda viene comunque salvata come bozza, senza perdere il lavoro.')
            : t('Questa scheda è già assegnata: se manca qualcosa non viene salvata, così a chi la usa resta quella di prima.')}
        </div>

        {/* Staccato dal salvataggio da un divisore e da tutto lo spazio che ci
            sta: sono le due uniche cose in fondo alla pagina, e se si toccassero
            un pollice che punta la prima prenderebbe la seconda. */}
        {onDelete && (
          <>
            <div style={{ height: 1, background: 'var(--divider)', margin: '22px 0 14px' }}/>
            <button
              onClick={onDelete}
              className="j-hard flex items-center justify-center gap-2 w-full"
              style={{
                height: 44, borderRadius: 'var(--radius)', cursor: 'pointer',
                background: 'rgba(var(--danger-rgb),0.06)',
                border: '1px solid rgba(var(--danger-rgb),0.25)',
                color: 'var(--danger)',
                fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
                letterSpacing: '.14em', textTransform: 'uppercase',
              }}
            >
              <Icons.trash size={14} stroke={1.7}/> {t('Elimina scheda')}
            </button>
          </>
        )}
      </div>
    </SchedaPage>
  )
}

// ── Dettaglio scheda ───────────────────────────────────────────
// ── La faccia di un esercizio dentro una scheda ────────────────
// ── Superset ───────────────────────────────────────────────────
// Due esercizi in superset si fanno uno dopo l'altro senza recupero, e in
// allenamento è l'informazione che cambia cosa fai dopo aver chiuso una serie.
// Era una riga piccola nel colore accent, che nel tema premium è bianco come
// tutto il resto: si perdeva. Adesso è arancione e sta AL CENTRO fra le due
// card, e i due bordi che si guardano — il fondo di quella sopra, la cima di
// quella sotto — sono arancioni anche loro: le due card si leggono come un
// blocco solo.
const ARANCIO_SUPERSET = 'var(--tertiary-ink)'

function bordiSuperset(legatoAlPrecedente: boolean | undefined, legatoAlSuccessivo: boolean): CSSProperties {
  return {
    ...(legatoAlPrecedente ? { borderTop: `2px solid ${ARANCIO_SUPERSET}` } : {}),
    ...(legatoAlSuccessivo ? { borderBottom: `2px solid ${ARANCIO_SUPERSET}` } : {}),
  }
}

function PonteSuperset() {
  const t = useT()
  const filo = <span aria-hidden="true" style={{ flex: 1, height: 1, background: ARANCIO_SUPERSET, opacity: 0.45 }}/>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', color: ARANCIO_SUPERSET }}>
      {filo}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
        border: `1px solid ${ARANCIO_SUPERSET}`,
        fontFamily: NUC.label, fontSize: 10, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
      }}>
        <Icons.repeat size={12} stroke={2}/>
        {t('Superset · nessun recupero')}
      </span>
      {filo}
    </div>
  )
}

// ── Gli allenamenti fatti con una scheda ───────────────────────
// Non c'è un archivio delle sessioni: ogni allenamento finisce come alzate
// separate nello storico dei singoli esercizi, ognuna con la scheda da cui
// viene (`entry.scheda`). Una sessione si ricompone raccogliendo le alzate di
// questa scheda e raggruppandole per giorno. Le alzate sono gli OGGETTI dello
// store, non copie: correggerle e toglierle passa dal riferimento (vedi
// `correggiAlzata`).
interface Sessione { giorno: string; alzate: AlzataSalvata[] }

function sessioniDellaScheda(scheda: GymScheda, esercizi: PalestraExercise[]): Sessione[] {
  // L'ordine dentro la giornata è quello della scheda, non quello dello store.
  const posto = (exId: string, nome: string) => {
    const i = scheda.exercises.findIndex(e => e.linkedExerciseId === exId || e.name.trim().toLowerCase() === nome.trim().toLowerCase())
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const perGiorno = new Map<string, AlzataSalvata[]>()
  for (const ex of esercizi) {
    for (const h of ex.history) {
      if (h.scheda?.id !== scheda.id) continue
      const giorno = h.date ?? h.d
      const lista = perGiorno.get(giorno) ?? []
      lista.push({ exerciseId: ex.id, nome: ex.n, entry: h })
      perGiorno.set(giorno, lista)
    }
  }
  return [...perGiorno.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([giorno, alzate]) => ({
      giorno,
      alzate: alzate.sort((a, b) => posto(a.exerciseId, a.nome) - posto(b.exerciseId, b.nome)),
    }))
}

/** "23 settembre", con l'anno solo se non è quello in corso. */
function giornoSessione(giorno: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return giorno
  const anno = giorno.slice(0, 4)
  return anno === String(new Date().getFullYear()) ? fmtDayMonthFull(giorno) : `${fmtDayMonthFull(giorno)} ${anno}`
}

/** Cosa si sa di un'alzata dello storico di una scheda: di quanto è cambiato il
 *  carico dall'ultima volta che si è fatto QUELL'esercizio con QUESTA scheda. */
interface Andamento { variazione: VariazioneCarico | null; primo: boolean }

// Una riga di alzata registrata: nome, colpi × chili, la nota se c'è. Toccata
// si corregge; dietro i tre puntini, dove ci sono, la si toglie. I chili sono
// il testo più forte della riga, come nello storico dell'esercizio.
function RigaAlzata({ a, primo, andamento, onCorreggi, onElimina }: {
  a: AlzataSalvata
  primo: boolean
  andamento?: Andamento
  onCorreggi?: (a: AlzataSalvata) => void
  onElimina?: (a: AlzataSalvata) => void
}) {
  const t = useT()
  const tData = useTData()
  const h = a.entry
  return (
    <div className="flex items-center gap-1" style={{ borderTop: primo ? 'none' : '1px solid var(--hairline-soft)' }}>
      <button
        onClick={() => onCorreggi?.(a)}
        className="flex items-center justify-between gap-3 j-riga-gruppo"
        style={{
          flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          background: 'transparent', border: 'none', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13.5, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tData(a.nome)}
          </span>
          {andamento && (
            <SegnaleCarico variazione={andamento.variazione} primo={andamento.primo} massimale={!!h.maxLift}/>
          )}
          {h.note && (
            <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10.5, color: NUC.faint, marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.note}
            </span>
          )}
        </span>
        <span className="flex items-baseline" style={{ flexShrink: 0, gap: 6 }}>
          <span style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.dim, fontVariantNumeric: 'tabular-nums' }}>{h.sets_n} × {fmtReps(h)}</span>
          <span style={{ fontFamily: NUC.font, fontSize: 16, fontWeight: 600, letterSpacing: -0.2, color: NUC.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtKgVerso(h)}</span>
        </span>
        {!onElimina && <span style={{ flexShrink: 0, color: NUC.faint, display: 'flex' }}><Icons.pencil size={12} stroke={1.8}/></span>}
      </button>
      {onElimina && (
        <MenuAzioni
          etichetta={t('Azioni sull’alzata')}
          azioni={[
            { nome: t('Modifica'), icona: <Icons.pencil size={14} stroke={1.8}/>, onClick: () => onCorreggi?.(a) },
            { nome: t('Elimina'), icona: <Icons.trash size={14} stroke={1.6}/>, pericolo: true, onClick: () => onElimina(a) },
          ]}
        />
      )}
    </div>
  )
}

// Un giorno dello storico, fatto come un'alzata nello storico di un esercizio:
// la data è il punto dell'elenco, accanto quanti esercizi, e sotto in quanti si
// è saliti o scesi di carico rispetto alla volta prima. Toccato si apre sulle
// alzate di quel giorno.
//
// Aperto in partenza c'è solo l'ultimo allenamento: è quello che si viene a
// guardare. Aperti tutti insieme erano un muro di righe, e il giorno che si
// cercava stava sotto tutti quelli venuti dopo.
function GiornoStorico({ s, apertoAllInizio, andamento, onCorreggi, onElimina }: {
  s: Sessione
  apertoAllInizio: boolean
  andamento: Map<PalestraHistoryEntry, Andamento>
  onCorreggi?: (a: AlzataSalvata) => void
  onElimina?: (a: AlzataSalvata) => void
}) {
  const t = useT()
  const [aperto, setAperto] = useState(apertoAllInizio)
  const variazioni = s.alzate.map(a => andamento.get(a.entry)?.variazione?.delta ?? 0)
  const saliti = variazioni.filter(d => d > 0).length
  const scesi = variazioni.filter(d => d < 0).length
  // Il primo allenamento con la scheda non ha una volta prima con cui misurarsi.
  const primoDiTutti = s.alzate.every(a => andamento.get(a.entry)?.primo)
  const durata = s.alzate.find(a => a.entry.durataSec)?.entry.durataSec
  const segno = (n: number, su: boolean) => (
    <span className="flex items-center" style={{ gap: 4, fontFamily: NUC.label, fontSize: 11.5, fontWeight: 600, color: su ? 'var(--segnale-su)' : 'var(--segnale-giu)', fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true" style={{ display: 'flex', transform: `rotate(${su ? -90 : 90}deg)` }}><Icons.arrow size={12} stroke={2.4}/></span>
      {su ? t('{n} in salita', { n }) : t('{n} in calo', { n })}
    </span>
  )
  return (
    <div style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
      <button
        onClick={() => setAperto(a => !a)} aria-expanded={aperto}
        className="j-focus flex items-start gap-3 w-full"
        style={{ padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <DataPunto iso={s.giorno} ripiego={s.giorno}/>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 17, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.2, color: NUC.ink }}>
            {s.alzate.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: s.alzate.length })}
            {/* Quanto è durato, se lo si sa: sta su ogni alzata della sessione,
                uguale per tutte, e ne basta una. */}
            {durata !== undefined && (
              <span style={{ fontFamily: NUC.label, fontSize: 12.5, fontWeight: 500, color: NUC.dim, letterSpacing: 0 }}>{' · '}{fmtDurata(durata)}</span>
            )}
          </span>
          <span className="flex items-center" style={{ gap: 10, marginTop: 5, minHeight: 16, flexWrap: 'wrap' }}>
            {saliti > 0 && segno(saliti, true)}
            {scesi > 0 && segno(scesi, false)}
            {saliti === 0 && scesi === 0 && (
              <span style={{ fontFamily: NUC.label, fontSize: 11.5, color: NUC.faint }}>
                {primoDiTutti ? t('primo allenamento') : t('carichi invariati')}
              </span>
            )}
          </span>
        </span>
        <span style={{ display: 'flex', alignSelf: 'center', flexShrink: 0, color: NUC.faint, transform: aperto ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <Icons.chev size={13} stroke={2}/>
        </span>
      </button>
      {aperto && (
        // Rientrate quanto la data: le alzate stanno SOTTO il giorno a cui
        // appartengono, non accanto al giorno dopo.
        <div style={{ padding: '0 0 8px 38px' }}>
          {s.alzate.map((a, i) => (
            <RigaAlzata key={`${a.exerciseId}-${i}`} a={a} primo={i === 0} andamento={andamento.get(a.entry)} onCorreggi={onCorreggi} onElimina={onElimina}/>
          ))}
        </div>
      )}
    </div>
  )
}

function SchedaDetailPage({ scheda, muscleColors, assegnata, ioId, mioNome, allievi, appenaSalvate = [], palestraExercises = [], inCorso, onCorreggi, onElimina, onCondividi, onBack, onEdit, onDelete, onStart, onRicomincia }: {
  scheda: GymScheda
  muscleColors: Record<string, string>
  /** La riga di `coach_schede` da cui arriva questa scheda, se è stata assegnata.
   *  Non è solo il nome dell'allenatore: porta le due identità (chi l'ha scritta,
   *  a chi) senza le quali non si può scrivergli. */
  assegnata?: CoachScheda
  /** Chi sono io. Manca finché la sessione non ha risposto, e senza non si
   *  scrive niente a nessuno. */
  ioId?: string | null
  /** Il mio nome, copiato dentro il messaggio: l'altro non ha modo di leggere la
   *  mia anagrafica (vedi coach_schema.sql), quindi il nome viaggia col testo. */
  mioNome?: string
  /** Chi alleno. Vuoto = non seguo nessuno, e il tasto condividi non compare. */
  allievi?: CoachLink[]
  /** Le alzate che l'allenamento appena finito ha scritto nello storico. Vuoto
   *  in ogni altro caso: la striscia compare solo al ritorno da una sessione. */
  appenaSalvate?: AlzataSalvata[]
  /** Gli esercizi con il loro storico: da lì si ricostruiscono gli allenamenti
   *  fatti con questa scheda. */
  palestraExercises?: PalestraExercise[]
  onCorreggi?: (a: AlzataSalvata) => void
  onElimina?: (a: AlzataSalvata) => void
  /** Manca finché non si sa chi sono: senza sessione non si condivide niente. */
  onCondividi?: (athleteId: string) => Promise<void>
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
  /** Butta l'allenamento rimasto aperto su questa scheda e ne comincia uno oggi. */
  onRicomincia?: () => void
  /** C'è un allenamento lasciato a metà su questa scheda: il tasto lo riprende.
   *  `vecchia` = cominciato più di dodici ore fa: non lo si "riprende", lo si
   *  chiude — le sue serie finiscono nel giorno in cui sono state fatte. */
  inCorso?: { vecchia: boolean; iniziataA: number }
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  const { confirmDelete } = useConfirmDelete()
  const [condividiAperto, setCondividiAperto] = useState(false)
  // La seconda faccia della scheda. Gli esercizi sono gli stessi, ma invece di
  // dire cosa fare oggi diventano il posto dove chiedere: la domanda resta
  // attaccata alla riga di cui parla, e la risposta torna lì. È tutta la
  // differenza con lo stesso scambio fatto in chat, dove dopo tre giorni nessuno
  // sa più di quale esercizio si stesse parlando.
  const [richieste, setRichieste] = useState(false)
  // La terza faccia: gli allenamenti già fatti con questa scheda, uno per giorno.
  const [storico, setStorico] = useState(false)
  const sessioni = useMemo(() => sessioniDellaScheda(scheda, palestraExercises), [scheda, palestraExercises])
  // Per ogni alzata dello storico, di quanto è cambiato il carico dall'ultima
  // volta con QUESTA scheda: si scorre dall'allenamento più vecchio tenendo, per
  // esercizio, l'ultima alzata di lavoro incontrata.
  const andamento = useMemo(() => {
    const out = new Map<PalestraHistoryEntry, Andamento>()
    const ultima = new Map<string, PalestraHistoryEntry>()
    const perId = new Map(palestraExercises.map(e => [e.id, e]))
    for (const ses of [...sessioni].reverse()) {
      for (const a of ses.alzate) {
        const ex = perId.get(a.exerciseId)
        // A colpi e non a chili: vedi ExerciseDetail in JarvisGym.
        const soloColpi = !!ex && aColpi(ex) && ex.history.every(h => h.kg === 0)
        const prima = ultima.get(a.exerciseId)
        out.set(a.entry, { variazione: variazioneCarico(prima, a.entry, soloColpi), primo: !prima })
        if (!a.entry.maxLift) ultima.set(a.exerciseId, a.entry)
      }
    }
    return out
  }, [sessioni, palestraExercises])
  // Da quanti giorni non si fa questa scheda. `null` se mai, o se l'ultima
  // sessione è così vecchia da non avere una data.
  const ultimoGiorno = sessioni[0]?.giorno
  const giorniStop = ultimoGiorno && /^\d{4}-\d{2}-\d{2}$/.test(ultimoGiorno) ? giorniTra(ultimoGiorno, todayISO()) : null
  const [chiedi, setChiedi] = useState<null | { esercizio?: GymSchedaExercise; tipo: TipoMessaggio }>(null)

  const daCoach = assegnata ? (assegnata.coach_name?.trim() || t('Allenatore')) : undefined
  // Si chiede solo su una scheda che qualcuno ti ha mandato, e solo sapendo chi
  // sei: una richiesta senza mittente non ha un posto dove ricevere la risposta.
  const puoiChiedere = !!assegnata && !!ioId

  // Ritmo svelto solo con la conversazione davanti agli occhi (vedi messaggiLive):
  // chiusa, questa pagina si accontenta del giro di fondo che tiene il badge.
  const { messaggi } = useMessaggi(richieste ? RITMO_APERTO : RITMO_FONDO)
  const filo = useMemo(
    () => assegnata ? messaggi.filter(m => m.scheda_id === assegnata.id) : [],
    [messaggi, assegnata],
  )
  const daLeggere = ioId ? nonLetti(filo, ioId).length : 0

  // Aperta la vista, quello che c'è dentro è stato letto: il badge si spegne
  // adesso, non al prossimo giro. Vale anche per un messaggio che arriva mentre
  // la si sta guardando — è già sotto gli occhi.
  useEffect(() => {
    if (richieste && ioId && daLeggere > 0) segnaLettiOra(filo, ioId)
  }, [richieste, ioId, daLeggere, filo])

  const mandaRichiesta = async (testo: string) => {
    if (!assegnata || !ioId || !chiedi) return
    await invia({
      scheda_id: assegnata.id,
      scheda_titolo: scheda.title,
      coach_id: assegnata.coach_id,
      athlete_id: assegnata.athlete_id,
      autore: ioId,
      autore_nome: mioNome?.trim() || null,
      esercizio_id: chiedi.esercizio?.id ?? null,
      esercizio_nome: chiedi.esercizio?.name ?? null,
      tipo: chiedi.tipo,
      testo,
    })
    setChiedi(null)
  }

  const togliMessaggio = (m: Messaggio) => confirmDelete(
    () => { void elimina(m.id).catch(() => { /* torna da sé al giro dopo */ }) },
    t('questo messaggio'),
    { eyebrow: t('Elimina'), title: t('Togliere il messaggio?'), cta: t('Elimina') },
  )

  // Il tasto c'è solo se c'è davvero qualcosa da fare: la scheda è mia (una
  // assegnata è il lavoro di un altro), è finita (una bozza chi la riceve non la
  // vedrebbe nemmeno, l'elenco delle assegnate le filtra), e qualcuno da seguire
  // c'è.
  const puoiCondividere = !daCoach && !scheda.draft && !!onCondividi && (allievi?.length ?? 0) > 0

  // I due tasti sotto ogni esercizio, e quello sulla scheda intera: stessa forma,
  // cambia solo cosa chiedono.
  const tastoChiedi = (
    tipo: TipoMessaggio,
    esercizio: GymSchedaExercise | undefined,
    etichetta: string,
    icona: ReactNode,
    // Sotto un esercizio i due tasti si dividono la riga; accanto all'occhiello
    // "Sulla scheda" il tasto è uno solo, e stirato occuperebbe mezza card per
    // una parola.
    largo = true,
  ) => (
    <button
      onClick={() => setChiedi({ esercizio, tipo })}
      className="j-hard-sm flex items-center justify-center gap-1.5"
      style={{
        ...(largo ? { flex: 1, minWidth: 0 } : { flexShrink: 0, padding: '0 12px' }),
        height: 32, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
        background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
        fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
      }}
    >
      {icona}{etichetta}
    </button>
  )

  return (
    <SchedaPage
      onBack={richieste ? () => setRichieste(false) : storico ? () => setStorico(false) : onBack} tronca
      title={scheda.title}
      sub={richieste
        ? t('Richieste a {chi}', { chi: daCoach ?? '' })
        : storico
          ? t('Storico allenamenti')
          : scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: scheda.exercises.length })}
      // I comandi stanno in una riga loro sotto il titolo, non accanto: con tre
      // tasti il titolo non ci stava e i tasti andavano a capo da soli, a destra,
      // lasciando mezza riga vuota. In quel vuoto adesso c'è da dove viene la
      // scheda — scritta da te, o mandata da un allenatore e da quale.
      extra={
        <div className="flex items-center justify-between gap-3" style={{ marginTop: 14 }}>
          <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
            <span style={{ display: 'flex', flexShrink: 0, color: daCoach ? 'var(--j-accent-ink)' : NUC.faint }}>
              {daCoach ? <Icons.chat size={18} stroke={1.7}/> : <Icons.user size={18} stroke={1.7}/>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: NUC.faint }}>
                {daCoach ? t('Dal coach') : t('Scheda')}
              </span>
              <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 14.5, fontWeight: 500, color: NUC.ink, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {daCoach ?? t('Creata da te')}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            {/* L'orologio: gli allenamenti già fatti. Solo se ce n'è almeno uno —
                un tasto che apre una pagina vuota è una promessa non mantenuta. */}
            {sessioni.length > 0 && !richieste && (
              <button
                onClick={() => setStorico(v => !v)}
                aria-pressed={storico}
                aria-label={storico ? t('Torna alla scheda') : t('Storico allenamenti')}
                title={storico ? t('Torna alla scheda') : t('Storico allenamenti')}
                className="j-hard flex items-center justify-center"
                style={{
                  ...iconBtn(),
                  ...(storico ? {
                    background: 'var(--j-accent)',
                    border: '1px solid var(--j-accent)',
                    color: 'var(--j-accent-fg)',
                  } : {}),
                }}
              >
                <Icons.clock size={18} stroke={1.9}/>
              </button>
            )}
            {/* Il punto interrogativo: la porta fra le due facce della scheda. */}
            {puoiChiedere && !storico && (
              <button
                onClick={() => setRichieste(r => !r)}
                aria-pressed={richieste}
                aria-label={richieste ? t('Torna alla scheda') : t('Chiedi all’allenatore')}
                title={richieste ? t('Torna alla scheda') : t('Chiedi all’allenatore')}
                className="j-hard flex items-center justify-center"
                style={{
                  ...iconBtn(),
                  position: 'relative',
                  ...(richieste ? {
                    background: 'var(--j-accent)',
                    border: '1px solid var(--j-accent)',
                    color: 'var(--j-accent-fg)',
                  } : {}),
                }}
              >
                <Icons.help size={19} stroke={1.9}/>
                {/* Aperta la vista il badge sparisce perché i messaggi sono appena
                    stati letti: lasciarlo lì sarebbe un contatore di cose già viste. */}
                {!richieste && <BadgeNonLetti n={daLeggere} style={{ position: 'absolute', top: -6, right: -6 }}/>}
              </button>
            )}
            {puoiCondividere && (
              <button
                onClick={() => setCondividiAperto(true)}
                aria-label={t('Condividi la scheda')}
                className="j-hard flex items-center justify-center" style={iconBtn()}
              >
                <Icons.share size={17} stroke={1.8}/>
              </button>
            )}
            {/* Matita O cestino, mai tutti e due.
                Sulle schede MIE c'è la matita, e l'eliminazione sta là dentro (vedi
                `onDelete` di SchedaFormPage): un cestino a fianco della matita era il
                vicino di casa del tasto che si preme più spesso.
                Sulle schede ASSEGNATE la matita non c'è — sono il lavoro
                dell'allenatore, e riscriverle qui vorrebbe dire che i due si allenano
                su due versioni diverse senza saperlo — quindi il cestino resta in
                testata: rifiutarla si può, e senza matita non ha un altro posto dove
                stare. */}
            {daCoach ? (
              <button onClick={onDelete} aria-label={t('Elimina scheda')} className="j-hard flex items-center justify-center" style={iconBtn(true)}>
                <Icons.trash size={17} stroke={1.6}/>
              </button>
            ) : (
              <button onClick={onEdit} aria-label={t('Modifica')} className="j-hard flex items-center justify-center" style={iconBtn()}>
                <Icons.pencil size={17} stroke={1.8}/>
              </button>
            )}
          </div>
        </div>
      }
    >

      {storico ? (
        <div className="j-scroll-area">
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: NUC.faint, marginBottom: 8 }}>
            {t('Apri un giorno per vederne le alzate, poi toccane una per correggere chili, colpi o nota.')}
          </div>
          {/* Per mese e senza anno, come lo storico di un esercizio. */}
          <Cronologia
            anni={false}
            voci={sessioni}
            dataDi={s => s.giorno}
            chiaveDi={s => s.giorno}
            conta={n => n === 1 ? t('1 allenamento') : t('{n} allenamenti', { n })}
            voce={s => (
              <GiornoStorico
                s={s} apertoAllInizio={s.giorno === sessioni[0]?.giorno}
                andamento={andamento} onCorreggi={onCorreggi} onElimina={onElimina}
              />
            )}
          />
        </div>
      ) : richieste && ioId ? (
        <div className="j-scroll-area">
          <div style={{
            marginBottom: 12, padding: '10px 12px',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`,
            fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.6, letterSpacing: '.02em', color: NUC.dim,
          }}>
            {t('Chiedi quello che ti serve sotto l’esercizio che riguarda: {chi} lo legge e risponde da qui. La scheda resta com’è finché non la cambia chi te l’ha mandata.', { chi: daCoach ?? '' })}
          </div>

          {/* Le domande che non sono di un esercizio in particolare. Sta in cima
              e non in fondo: "quante volte la faccio a settimana" è la prima cosa
              che si chiede su una scheda nuova, non l'ultima. */}
          <NucCard pad={13} style={{ marginBottom: 10 }}>
            <div className="flex items-center justify-between gap-2">
              <div style={{ fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tertiary-ink)' }}>
                {t('Sulla scheda')}
              </div>
              {tastoChiedi('info', undefined, t('Chiedi'), <Icons.help size={11} stroke={2}/>, false)}
            </div>
            {filo.some(m => !m.esercizio_id) && (
              <div style={{ marginTop: 10 }}>
                <Filo messaggi={filo.filter(m => !m.esercizio_id)} io={ioId} onElimina={togliMessaggio}/>
              </div>
            )}
          </NucCard>

          {scheda.exercises.map(e => {
            const color = muscleColor(e.muscle, muscleColors)
            const suoi = filo.filter(m => m.esercizio_id === e.id)
            return (
              <div key={e.id} style={{ marginBottom: 8 }}>
                <NucCard pad={13} style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <FacciaEsercizio nome={e.name} muscolo={e.muscle} lato={40}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, lineHeight: 1.2, color: NUC.ink }}>{tData(e.name)}</div>
                      <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: muscleTextColor(color, dark), marginTop: 3, textTransform: 'uppercase' }}>
                        {e.sets} × {e.reps}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2" style={{ marginTop: 10 }}>
                    {tastoChiedi('info', e, t('Chiedi info'), <Icons.help size={11} stroke={2}/>)}
                    {tastoChiedi('sostituzione', e, t('Sostituisci'), <Icons.repeat size={11} stroke={2}/>)}
                  </div>

                  {suoi.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <Filo messaggi={suoi} io={ioId} onElimina={togliMessaggio}/>
                    </div>
                  )}
                </NucCard>
              </div>
            )
          })}
        </div>
      ) : (
      <div className="j-scroll-area">
        {/* Quello che l'allenamento ha appena scritto, e la strada per correggerlo.
            È in cima perché arrivando qui da "Salva e chiudi" è l'unica cosa nuova
            della pagina: il resto è la scheda, che si sa già com'è. */}
        {appenaSalvate.length > 0 && onCorreggi && (
          <NucCard pad={13} style={{ marginBottom: 12, borderLeft: '3px solid var(--j-accent)' }}>
            <div style={{
              fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginBottom: 2,
            }}>{t('Allenamento salvato')}</div>
            <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: NUC.faint, marginBottom: 10 }}>
              {t('Tocca un’alzata per correggere i chili o i colpi.')}
            </div>
            {appenaSalvate.map((a, i) => (
              <RigaAlzata key={a.exerciseId} a={a} primo={i === 0} onCorreggi={onCorreggi}/>
            ))}
          </NucCard>
        )}

        {scheda.exercises.length === 0 ? (
          <div className="j-empty">{t('Scheda vuota — modificala per aggiungere esercizi')}</div>
        ) : (
          scheda.exercises.map((e, i) => {
            const color = muscleColor(e.muscle, muscleColors)
            const linkedToPrev = i > 0 && scheda.exercises[i - 1].supersetWithNext
            return (
              <div key={e.id} style={{ marginBottom: e.supersetWithNext ? 0 : 8 }}>
                {linkedToPrev && <PonteSuperset/>}
                <NucCard pad={13} style={{ borderLeft: `3px solid ${color}`, ...bordiSuperset(linkedToPrev, !!e.supersetWithNext) }}>
                  <div className="flex items-center justify-between gap-3">
                    <FacciaEsercizio nome={e.name} muscolo={e.muscle} lato={44}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: NUC.font, fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: NUC.ink }}>{tData(e.name)}</div>
                      <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: muscleTextColor(color, dark), marginTop: 3, textTransform: 'uppercase' }}>
                        {e.muscle ? tData(displayMuscle(e.muscle)) : t('Senza gruppo')}{e.linkedExerciseId ? ` · ${t('collegato')}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentSoft, letterSpacing: -0.3, flexShrink: 0 }}>
                      {e.sets} × {e.reps}
                    </div>
                  </div>
                  {e.note && (
                    <div style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.faint, marginTop: 8, lineHeight: 1.5, letterSpacing: 0.1, whiteSpace: 'pre-wrap' }}>
                      {e.note}
                    </div>
                  )}
                </NucCard>
              </div>
            )
          })
        )}

        {/* La porta per lo storico anche in fondo alla scheda, oltre all'orologio
            in testata: è qui che si guarda dopo aver letto gli esercizi. */}
        {sessioni.length > 0 && (
          <button
            onClick={() => setStorico(true)}
            className="j-riga-gruppo flex items-center justify-between gap-3 w-full"
            style={{
              marginTop: 6, padding: '12px 14px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'var(--surface)', border: `1px solid ${NUC.hairline}`, textAlign: 'left',
            }}
          >
            <span className="flex items-center gap-2.5" style={{ minWidth: 0, color: NUC.ink }}>
              <Icons.clock size={16} stroke={1.8}/>
              <span style={{ fontFamily: NUC.font, fontSize: 14 }}>{t('Storico allenamenti')}</span>
            </span>
            <span className="flex items-center gap-1.5" style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 10.5, color: NUC.faint }}>
              {giorniStop !== null
                ? quantoFa(giorniStop, t)
                : t('ultimo {giorno}', { giorno: giornoSessione(sessioni[0].giorno) })}
              <Icons.chev size={12} stroke={2}/>
            </span>
          </button>
        )}
      </div>
      )}

      {/* Il tasto per allenarsi non c'è nella vista delle richieste: lì si sta
          scrivendo, non ci si sta preparando a partire. */}
      {!richieste && !storico && scheda.exercises.length > 0 && (
        <div className="j-page-cta">
          {/* Detto PRIMA di cominciare, non a metà della prima serie: chi torna
              dopo uno stop deve saperlo quando sceglie con che peso partire. */}
          {giorniStop !== null && giorniStop > GIORNI_DI_STOP && !inCorso && (
            <div role="note" style={{
              marginBottom: 10, padding: '9px 11px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
              fontFamily: NUC.label, fontSize: 11, lineHeight: 1.5, color: 'var(--warn)',
            }}>
              {t('Non fai questa scheda da {n} giorni: probabilmente farai più fatica con i carichi dell’ultima volta.', { n: giorniStop })}
            </div>
          )}
          <button onClick={onStart} className="j-hard j-accent-key j-focus flex items-center justify-center gap-2 w-full" style={{
            height: 52, borderRadius: 'var(--radius)', backgroundColor: 'var(--j-accent)', border: '1px solid var(--accent-edge)',
            color: 'var(--j-accent-fg)', cursor: 'pointer', fontFamily: NUC.font, fontSize: 15, fontWeight: 500,
          }}>
            <Icons.play size={18}/> {inCorso?.vecchia
              ? t('Chiudi l’allenamento del {giorno}', { giorno: fmtDayMon(localISO(new Date(inCorso.iniziataA))) })
              : inCorso ? t('Riprendi allenamento') : t('Inizia allenamento')}
          </button>
          {/* L'allenamento di un altro giorno rimasto aperto: riprenderlo vuol
              dire salvarne le serie in QUEL giorno. Chi invece è qui per
              allenarsi oggi deve poterlo dire, o si ritroverebbe l'allenamento
              di oggi scritto sotto la data di venerdì. */}
          {inCorso?.vecchia && onRicomincia && (
            <button onClick={onRicomincia} className="j-btn-log" style={{ marginTop: 8 }}>
              {t('Scartalo e inizia oggi')}
            </button>
          )}
        </div>
      )}

      {onCondividi && (
        <ModaleCondividi
          open={condividiAperto}
          onClose={() => setCondividiAperto(false)}
          titolo={scheda.title}
          allievi={allievi ?? []}
          onCondividi={onCondividi}
        />
      )}

      <JModal
        open={!!chiedi}
        onClose={() => setChiedi(null)}
        title={chiedi?.tipo === 'sostituzione' ? t('Chiedi una sostituzione') : t('Chiedi info')}
        width={360}
      >
        <Composer
          autoFocus
          placeholder={chiedi?.tipo === 'sostituzione'
            ? t('Es. la pressa è sempre occupata, cosa metto al posto?')
            : t('Es. quanto recupero fra le serie?')}
          etichetta={t('Manda a {chi}', { chi: daCoach ?? '' })}
          onInvia={mandaRichiesta}
          intestazione={
            <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: 'var(--fg-mute)' }}>
              {chiedi?.esercizio
                ? t('Su «{esercizio}», nella scheda «{scheda}».', { esercizio: tData(chiedi.esercizio.name), scheda: scheda.title })
                : t('Sulla scheda «{scheda}».', { scheda: scheda.title })}
            </div>
          }
        />
      </JModal>
    </SchedaPage>
  )
}

// ── Con chi condividere una scheda ─────────────────────────────
// Un elenco di nomi, si tocca quello giusto.
//
// Anche con un allievo solo si passa di qui invece di condividere al primo
// tocco: mandare una scheda a un'altra persona è un gesto verso fuori, e un
// tocco per sbaglio su un'icona da 15px non deve bastare a compierlo. Il nome
// da toccare È la conferma, e in più dice a chi sta andando.
//
// Ricondividere non duplica: la copia ha un id derivato dalla coppia
// scheda-allievo (vedi `idSchedaCondivisa`), quindi la seconda volta aggiorna
// quella che ha già. Per questo dopo il primo invio il tasto dice "Aggiorna".
function ModaleCondividi({ open, onClose, titolo, allievi, onCondividi }: {
  open: boolean
  onClose: () => void
  titolo: string
  allievi: CoachLink[]
  onCondividi: (athleteId: string) => Promise<void>
}) {
  const t = useT()
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [fatti, setFatti] = useState<string[]>([])
  const [errore, setErrore] = useState<string | null>(null)

  const manda = (a: CoachLink) => {
    setInCorso(a.athlete_id)
    setErrore(null)
    onCondividi(a.athlete_id)
      .then(() => setFatti(f => f.includes(a.athlete_id) ? f : [...f, a.athlete_id]))
      .catch(e => setErrore(e instanceof Error ? e.message : String(e)))
      .finally(() => setInCorso(null))
  }

  return (
    <JModal open={open} onClose={onClose} title={t('Condividi la scheda')} width={320}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontFamily: NUC.label, fontSize: 11, color: 'var(--fg-mute)', lineHeight: 1.5 }}>
          {t('«{scheda}» finisce nelle sue schede, pronta da avviare.', { scheda: titolo })}
        </div>

        {errore && (
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: 'var(--danger)', lineHeight: 1.5 }}>{errore}</div>
        )}

        {allievi.map(a => {
          const fatto = fatti.includes(a.athlete_id)
          const attesa = inCorso === a.athlete_id
          return (
            <button
              key={a.athlete_id}
              onClick={() => manda(a)}
              disabled={attesa}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                width: '100%', padding: '11px 13px', borderRadius: 'var(--radius)',
                background: 'var(--surface)', border: '1px solid var(--hairline)',
                cursor: attesa ? 'default' : 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: NUC.font, fontSize: 14, color: 'var(--fg)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.athlete_name?.trim() || t('Senza nome')}
              </span>
              <span style={{
                flexShrink: 0, fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: fatto ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
              }}>
                {attesa ? t('Invio…') : fatto ? t('Inviata ✓') : t('Condividi')}
              </span>
            </button>
          )
        })}
      </div>
    </JModal>
  )
}

// La casella di una serie — i colpi, o i chili — con l'unità stampata dentro a
// destra. Non ha un bordo suo: è un pezzo della riga (`.j-serie` in
// globals.css), e fra una casella e l'altra c'è solo un filo. In allarme (colpi
// sotto obiettivo, chili mancanti) vira al rosso: fondo, numero e unità insieme,
// perché il solo numero rosso su una riga scura si perde.
function CampoSerie({ value, onChange, unita, segnaposto, mode, etichetta, allarme }: {
  value: string
  onChange: (v: string) => void
  unita: string
  /** Cosa si legge nel campo vuoto, se non è l'unità. */
  segnaposto?: string
  mode: 'decimal' | 'numeric'
  etichetta: string
  allarme?: boolean
}) {
  return (
    <div className="j-serie-cella" style={allarme ? { background: 'rgba(var(--danger-rgb),0.12)' } : undefined}>
      <input
        value={value}
        onChange={ev => onChange(ev.target.value)}
        inputMode={mode}
        aria-label={etichetta}
        aria-invalid={allarme || undefined}
        placeholder={segnaposto ?? unita}
        className="j-serie-campo"
        style={allarme ? { color: 'var(--danger)' } : undefined}
      />
      <span aria-hidden style={{
        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
        fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.04em',
        color: allarme ? 'var(--danger)' : NUC.faint, pointerEvents: 'none',
      }}>{unita}</span>
    </div>
  )
}

// ── La nota di un esercizio, mentre la si scrive ───────────────
// Un riquadro squadrato col testo piccolo, e sotto il tasto che la chiude.
//
// Il testo piccolo non si può chiedere con `font-size`: sotto i 16px iOS
// ingrandisce la pagina appena si tocca il campo (ed è per questo che su touch
// globals.css forza 16px su ogni campo, vincendo anche sugli stili scritti
// qui). Allora il campo resta a 16 e lo si RIMPICCIOLISCE intero con una
// scala: il browser vede un campo da 16px, l'occhio un testo da 13. La
// larghezza va allargata dell'inverso, o il campo scalato non riempirebbe il
// riquadro.
const SCALA_NOTA = 13 / 16
const ALTEZZA_NOTA = 104   // tre righe abbondanti, prima della scala

function CampoNota({ value, onChange, etichetta }: { value: string; onChange: (v: string) => void; etichetta: string }) {
  const t = useT()
  return (
    <div className="j-nota-box" style={{ height: Math.round(ALTEZZA_NOTA * SCALA_NOTA) }}>
      <textarea
        value={value}
        onChange={ev => onChange(ev.target.value)}
        // Aperta a mano, il campo è quello che si voleva: si scrive subito.
        autoFocus
        aria-label={etichetta}
        placeholder={t('Nota su questa sessione…')}
        style={{
          display: 'block', boxSizing: 'border-box',
          width: `${100 / SCALA_NOTA}%`, height: ALTEZZA_NOTA,
          transform: `scale(${SCALA_NOTA})`, transformOrigin: '0 0',
          border: 'none', outline: 'none', background: 'transparent', resize: 'none',
          padding: '10px 12px', fontFamily: NUC.font, fontSize: 16, lineHeight: 1.4, color: NUC.ink,
        }}
      />
    </div>
  )
}

// I tastini nell'angolo della card di un esercizio ("uguale", "nota").
const TASTINO: CSSProperties = {
  height: 26, padding: '0 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
  fontFamily: NUC.label, fontSize: 9, letterSpacing: '.04em', textTransform: 'uppercase',
}

// Chi parla, davanti a ogni nota della card ("SCHEDA", "ULTIMA VOLTA").
const ETICHETTA_NOTA: CSSProperties = {
  marginRight: 6, fontSize: 8.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', fontStyle: 'normal',
  color: NUC.faint,
}

// ── Il carico consigliato, dentro la card di un esercizio ──────
// Una riga sola: verso, peso, perché. Il colore dice il verso (verde si sale,
// rosso si scende) e il perché sta scritto, perché un consiglio senza motivo
// si ignora — o peggio si segue senza sapere che la volta prima si era saltata
// una serie. "Usa" scrive il peso sulle serie ancora da fare.
function ConsiglioCarico({ consiglio, serie, applicabile, onUsa }: {
  consiglio: Consiglio
  serie: number
  applicabile: boolean
  onUsa: () => void
}) {
  const t = useT()
  const { verso, kg, pesi, da, motivo, fatte, cima, alte } = consiglio
  // Lo stop e il muscolo già stanco hanno un colore loro: non sono un verso,
  // sono un avviso.
  const avviso = motivo === 'stop' || motivo === 'affaticato'
  const colore = avviso ? 'var(--warn)' : verso === 'su' ? 'var(--segnale-su)' : verso === 'giu' ? 'var(--segnale-giu)' : NUC.dim
  const freccia = verso === 'su' ? '↑' : verso === 'giu' ? '↓' : '='
  // "Valuta" e "devi" non sono la stessa cosa, e il titolo lo dice prima del
  // perché: una settimana piena è un permesso, due sono un ordine.
  const titolo =
    motivo === 'valuta' || motivo === 'primoAumento' || (motivo === 'fresco' && verso === 'su') ? t('Puoi salire')
    : motivo === 'devi' ? t('Devi salire')
    : motivo === 'stop' ? t('Dopo lo stop')
    : motivo === 'nuovo' ? t('Esercizio nuovo')
    : motivo === 'affaticato' ? t('Muscolo già stanco')
    : t('Carico consigliato')
  const perche =
    motivo === 'valuta' ? t('L’ultima volta tutte le serie e i colpi a {kg} kg: valuta un aumento leggero.', { kg: fmtNum(da) })
    : motivo === 'devi' ? t('Due settimane di fila tutto fatto a {kg} kg: è ora di salire.', { kg: fmtNum(da) })
    : motivo === 'nuovo' ? t('Lo fai da poco: per le prime due settimane resta su questi carichi e cura l’esecuzione. Del peso si riparla dopo.')
    : motivo === 'primoAumento' ? t('È ancora un esercizio nuovo: l’ultima volta tutto fatto a {kg} kg, puoi provare a salire, ma di poco. Prima viene l’esecuzione.', { kg: fmtNum(da) })
    : motivo === 'fresco' ? (verso === 'su'
      ? t('L’ultima volta lo facevi con il muscolo già stanco da un altro esercizio. Oggi ci arrivi più fresco: prova a salire, di poco.')
      : t('L’ultima volta non hai chiuso tutto, ma il muscolo era già stanco da un altro esercizio. Oggi ci arrivi più fresco: riprova con gli stessi carichi.'))
    : motivo === 'affaticato' ? t('Oggi lo fai dopo un altro esercizio per lo stesso muscolo, e l’ultima volta ci arrivavi più fresco: potrebbe essere più faticoso. Tieni questi carichi, senza salire.')
    : motivo === 'estendi' ? (alte === serie
      ? t('L’ultima volta le ultime serie sono salite e hanno retto: oggi tutte a {kg} kg.', { kg: fmtNum(kg) })
      : t('L’ultima volta l’ultima serie è salita e ha retto: oggi {alte} serie su {serie} a {kg} kg.', { alte: alte ?? 0, serie, kg: fmtNum(kg) }))
    : motivo === 'serieMancanti' ? t('L’ultima volta {fatte} serie su {serie}: meglio scendere.', { fatte: fatte ?? 0, serie })
    : motivo === 'colpiCorti' ? t('L’ultima volta una serie sotto i {n} colpi: meglio scendere.', { n: cima ?? '' })
    : motivo === 'pesoCalato' ? t('L’ultima volta hai dovuto alleggerire: riparti più basso.')
    : motivo === 'stop' ? t('Non lo fai da {n} giorni: probabilmente farai più fatica a sollevare questi carichi, visto lo stop. Riparti da qui senza salire.', { n: consiglio.giorni ?? 0 })
    : motivo === 'schedaCambiata' ? t('La scheda è cambiata dall’ultima volta: riparti dai carichi che avevi.')
    : t('Ripeti i carichi dell’ultima volta.')
  // Con pesi diversi da serie a serie si scrivono tutti: "62,5 kg" da solo
  // farebbe caricare il peso alto anche sulla prima serie.
  const uguali = pesi.every(k => k === pesi[0])
  return (
    <div className="flex items-center gap-2.5" style={{
      marginBottom: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: NUC.faint }}>
          {titolo}
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: colore, marginTop: 1 }}>
          <span aria-hidden>{freccia} </span>{uguali ? fmtNum(kg) : pesi.map(fmtNum).join(' · ')} kg
        </div>
        <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.4, color: NUC.dim, marginTop: 2 }}>{perche}</div>
      </div>
      {applicabile && (
        <button onClick={onUsa} className="j-hard-sm" style={{
          ...TASTINO, flexShrink: 0, height: 32, padding: '0 12px', fontSize: 10, fontWeight: 600,
          color: 'var(--j-accent-ink)',
        }}>
          {t('Usa')}
        </button>
      )}
    </div>
  )
}

// ── Allenamento (esecuzione scheda) ────────────────────────────
// Un peso E un numero di colpi per ogni serie: la scheda è il programma, non il
// verbale. Le ultime serie calano quasi sempre, e prima l'allenamento veniva
// salvato con i colpi PREVISTI su tutte — tre serie da 10 anche quando erano
// state 10, 8, 6, con il volume gonfiato di conseguenza.
interface TrainProgress { checks: boolean[]; weights: string[]; reps: string[]; note?: string }

// Una card dell'allenamento in corso. A parte e memorizzata: prima stava dentro
// la `map` della pagina, e ogni cifra battuta in un campo ridisegnava TUTTE le
// card — con, per ciascuna, la ricerca dell'esercizio collegato fra quelli
// salvati e lo storico intero copiato e riordinato per leggerne l'ultima nota.
// Adesso cambia identità solo l'avanzamento dell'esercizio toccato (`p`), i
// comandi sono stabili, e si ridisegna solo la sua card.
const CardAllenamento = memo(function CardAllenamento({ e, legatoPrima, color, p, last, notaPrima, corpo, attrezzo, consiglio, notaAperta, onToggle, onPeso, onColpi, onNota, onUsa, onUguale, onApriNota, onChiudiNota, onCorpoLibero }: {
  e: GymSchedaExercise
  legatoPrima: boolean
  color: string
  p: TrainProgress
  last?: PalestraExercise
  notaPrima?: string
  /** A corpo libero: i chili sono la sola zavorra. */
  corpo: boolean
  /** Il peso dell'attrezzo a vuoto dell'esercizio (0 = non dichiarato): i
   *  chili scritti sono allora i soli dischi, e "0" è una serie fatta. */
  attrezzo: number
  consiglio: Consiglio | null
  notaAperta: boolean
  onToggle: (exId: string, setIdx: number) => void
  onPeso: (exId: string, setIdx: number, v: string) => void
  onColpi: (exId: string, setIdx: number, v: string) => void
  onNota: (exId: string, v: string) => void
  onUsa: (exId: string, pesi: number[]) => void
  /** `soloChili`: la scheda chiede colpi diversi a ogni serie, e si copia il
   *  peso senza toccarli. */
  onUguale: (exId: string, soloChili: boolean) => void
  onApriNota: (exId: string) => void
  /** «Salva» sotto la nota: quello che è scritto è già al sicuro (si salva a
   *  ogni tasto), questo richiude il campo. */
  onChiudiNota: (exId: string) => void
  /** "Questo si fa senza chili": da qui in poi l'esercizio è a corpo libero. */
  onCorpoLibero: (exId: string) => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  const [fotoGrande, setFotoGrande] = useState(false)
  const nSets = Math.max(1, e.sets)
  // Il bersaglio di OGNI serie: "8-10" è 8 per tutte, "10-8-6" scala.
  const bersagli = colpiPrevisti(e.reps, nSets)
  const aScalare = new Set(bersagli).size > 1
  // Le serie che contano (spuntate e, con un attrezzo, coi chili scritti):
  // sono quelle che colorano la riga e i segmenti in testa alla card.
  const valide = new Set(serieValide(p.checks, p.weights, corpo, attrezzo))
  // Le note che si leggono mentre ci si allena, tutte nello stesso posto: cosa
  // dice la scheda, cosa c'è scritto sull'esercizio, cosa ci si era appuntati
  // l'ultima volta, e quella di oggi una volta chiusa.
  const note: Array<{ chi: string; testo: string; corsivo?: boolean }> = []
  if (e.note?.trim()) note.push({ chi: t('Scheda'), testo: e.note.trim() })
  if (last?.note?.trim()) note.push({ chi: t('Esercizio'), testo: last.note.trim() })
  if (notaPrima?.trim()) note.push({ chi: t('Ultima volta'), testo: notaPrima.trim(), corsivo: true })
  const notaDiOggi = p.note?.trim() ?? ''
  // Fatto = tutte le serie spuntate E valide. Con delle serie spuntate senza
  // chili la card si spegneva col suo segno di spunta, la barra in cima si
  // riempiva — e il riepilogo diceva poi che l'esercizio non contava.
  const senzaChili = !corpo && p.checks.some((c, i) => c && !chiliScritti(p.weights[i], attrezzo > 0))
  const exDone = p.checks.length > 0 && p.checks.every(Boolean) && !senzaChili
  return (
    <div style={{ marginBottom: e.supersetWithNext ? 0 : 10 }}>
      {legatoPrima && <PonteSuperset/>}
      <NucCard pad={14} style={{ borderLeft: `3px solid ${color}`, ...bordiSuperset(legatoPrima, !!e.supersetWithNext), opacity: exDone ? 0.72 : 1, transition: 'opacity 160ms' }}>
        <div className="flex items-start justify-between gap-3" style={{ marginBottom: 10 }}>
          <FacciaEsercizio nome={e.name} muscolo={e.muscle} lato={54} onIngrandisci={() => setFotoGrande(true)}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2">
              {exDone && <Icons.check size={15} stroke={2.6} color={color}/>}
              <div style={{ fontFamily: NUC.font, fontSize: 16.5, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.1, color: NUC.ink }}>{tData(e.name)}</div>
            </div>
            <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: muscleTextColor(color, dark), marginTop: 3, textTransform: 'uppercase' }}>
              {t('obiettivo')} {e.sets} × {e.reps}
            </div>
            {last && last.history.length > 0 && (
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.accentSoft, marginTop: 3 }}>
                {t('ultima volta')} {last.current.reps} × {fmtKg({ kg: last.current.kg, ...(corpo ? { bodyweight: true as const } : {}) })}
              </div>
            )}
            {/* Chi ha dichiarato l'attrezzo scrive i soli dischi: lo si ricorda
                qui, accanto ai campi, perché lo storico mostra invece il totale. */}
            {attrezzo > 0 && (
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, marginTop: 3 }}>
                {t('scrivi solo i dischi: + {kg} kg di attrezzo', { kg: fmtNum(attrezzo) })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5" style={{ flexShrink: 0, alignItems: 'flex-end' }}>
            {nSets > 1 && (
              <button onClick={() => onUguale(e.id, aScalare)} className="flex items-center gap-1" style={TASTINO}>
                <Icons.repeat size={11} stroke={1.8}/> {t('uguale')}
              </button>
            )}
            {!notaAperta && (
              <button
                onClick={() => onApriNota(e.id)}
                aria-label={`${tData(e.name)} · ${notaDiOggi ? t('Modifica nota') : t('Aggiungi nota')}`}
                className="flex items-center gap-1" style={TASTINO}
              >
                <Icons.pencil size={10} stroke={1.8}/> {t('nota')}
              </button>
            )}
          </div>
        </div>

        {/* A che punto si è, serie per serie: un segmento ciascuna, che si
            accende quando la serie conta. Si legge prima dei numeri — tre
            tacche su quattro, e si sa quanta strada manca senza contare le
            spunte. Gialla quella spuntata senza chili: c'è, ma non vale. */}
        <div aria-hidden className="flex" style={{ gap: 3, marginBottom: 10 }}>
          {Array.from({ length: nSets }).map((_, i) => (
            <span key={i} style={{
              flex: 1, height: 3, borderRadius: 'var(--radius-pill)',
              background: valide.has(i) ? color : p.checks[i] ? 'var(--warn)' : 'var(--hairline)',
              transition: 'background-color 160ms',
            }}/>
          ))}
        </div>

        {consiglio && (
          <ConsiglioCarico
            consiglio={consiglio}
            serie={nSets}
            // Il tasto serve solo se c'è qualcosa da cambiare: con il
            // consiglio già scritto su ogni serie da fare sarebbe un no-op.
            applicabile={p.weights.some((w, i) => !p.checks[i] && consiglio.pesi[i] !== undefined && parseNum(w) !== consiglio.pesi[i])}
            onUsa={() => onUsa(e.id, consiglio.pesi)}
          />
        )}

        {/* Le note, sempre in vista e in piccolo, PRIMA delle serie: è prima di
            caricare il bilanciere che serve sapere "sedile al 4" o "presa
            larga", non dopo. Stavano sparse — quella della scheda e quella
            dell'ultima volta sotto il nome, quella di oggi in un campo in fondo
            alla card. */}
        {(note.length > 0 || (notaDiOggi && !notaAperta)) && (
          <div style={{ marginBottom: 10, paddingLeft: 9, borderLeft: `2px solid ${NUC.hairline}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {note.map(n => (
              <div key={n.chi} style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.45, color: NUC.dim, whiteSpace: 'pre-wrap', fontStyle: n.corsivo ? 'italic' : undefined }}>
                <span style={ETICHETTA_NOTA}>{n.chi}</span>{n.testo}
              </div>
            ))}
            {notaDiOggi && !notaAperta && (
              // Senza un'etichetta sua: si chiama come quello che c'è scritto
              // dentro. Il tasto «nota» in testata fa la stessa cosa, e due
              // tasti con lo stesso nome non si distinguerebbero.
              <button
                onClick={() => onApriNota(e.id)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                  fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.45, color: NUC.ink, whiteSpace: 'pre-wrap',
                }}
              >
                <span style={ETICHETTA_NOTA}>{t('Oggi')}</span>{notaDiOggi}
              </button>
            )}
          </div>
        )}

        {/* La nota di oggi, mentre la si scrive: qui, dove poi resterà. */}
        {notaAperta && (
          <div style={{ marginBottom: 10 }}>
            <CampoNota
              value={p.note ?? ''}
              onChange={v => onNota(e.id, v)}
              etichetta={`${tData(e.name)} · ${t('nota')}`}
            />
            <div className="flex items-center justify-between gap-2" style={{ marginTop: 6 }}>
              <span style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>
                {t('Finisce nell’alzata di oggi.')}
              </span>
              <button
                onClick={() => onChiudiNota(e.id)}
                aria-label={`${tData(e.name)} · ${t('Salva la nota')}`}
                className="j-hard-sm"
                style={{ ...TASTINO, height: 30, padding: '0 14px', fontSize: 10, fontWeight: 600, color: 'var(--j-accent-ink)' }}
              >
                {t('Salva')}
              </button>
            </div>
          </div>
        )}

        {/* Una riga per serie, e una riga è UN pezzo solo: la spunta, i colpi,
            i chili, con un filo fra l'uno e l'altro. I colpi stanno accanto al
            peso e non in cima all'esercizio perché è la SINGOLA serie a calare:
            l'ultima chiude a 6 mentre la prima ha fatto i suoi 10. */}
        <div className="flex flex-col" style={{ gap: 6 }}>
          {Array.from({ length: nSets }).map((_, i) => {
            const on = p.checks[i]
            const colpi = parseInt(p.reps[i] ?? '') || 0
            const corta = colpi > 0 && colpi < (bersagli[i] ?? 0)
            return (
              <div
                key={i} className="j-serie"
                // Fatta: la riga prende il colore del gruppo muscolare, in
                // trasparenza — si vede a colpo d'occhio dove si è arrivati.
                style={on ? { borderColor: color, background: `color-mix(in srgb, ${color} 13%, var(--input-bg))` } : undefined}
              >
                <button
                  onClick={() => onToggle(e.id, i)}
                  aria-pressed={on}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: '0 10px', cursor: 'pointer', flexShrink: 0, minWidth: 80, border: 'none',
                    background: on ? color : 'transparent',
                    color: on ? onMuscleColor(color) : NUC.dim,
                    fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.02em',
                    transition: 'background-color 120ms',
                  }}
                >
                  {on ? <Icons.check size={13} stroke={2.4} color={onMuscleColor(color)}/> : <span style={{ width: 13, height: 13, borderRadius: 4, border: `1.5px solid ${NUC.faint}`, display: 'inline-block' }}/>}
                  {t('Serie {n}', { n: i + 1 })}
                </button>
                {/* Prima i colpi, poi i chili: è l'ordine in cui la serie si
                    racconta ("10 per 60") e quello in cui si scrive a fine
                    serie — il peso di solito è già lì dalla volta prima. */}
                <CampoSerie
                  value={p.reps[i] ?? ''}
                  onChange={v => onColpi(e.id, i, v)}
                  unita={t('colpi')} mode="numeric"
                  etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · ${t('colpi')}`}
                  allarme={corta}
                />
                <CampoSerie
                  value={p.weights[i] ?? ''}
                  onChange={v => onPeso(e.id, i, v)}
                  // A corpo libero i chili sono la sola zavorra: vuoto = niente.
                  unita="kg" segnaposto={corpo ? t('Zavorra') : undefined} mode="decimal"
                  etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · kg`}
                  // Spuntata senza chili, con un attrezzo: quella serie non verrà
                  // salvata (vedi `serieValide`). Si dice subito, sul campo che
                  // manca, non a fine allenamento.
                  allarme={!corpo && on && !chiliScritti(p.weights[i], attrezzo > 0)}
                />
              </div>
            )
          })}
        </div>

        {/* La via d'uscita, lì dove serve: un esercizio che si fa senza chili
            e che l'app non sa essere a corpo libero (creato a mano, o mandato da
            un allenatore) non ha chili da scrivere. Un tocco e lo diventa — per
            questa alzata e da qui in avanti. */}
        {senzaChili && (
          <div role="note" className="flex items-center justify-between gap-2" style={{
            marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
          }}>
            <span style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.45, color: 'var(--warn)' }}>
              {attrezzo > 0 ? t('Scrivi i dischi: 0 se usi solo l’attrezzo.') : t('Senza chili una serie non conta.')}
            </span>
            <button onClick={() => onCorpoLibero(e.id)} style={{ ...TASTINO, flexShrink: 0 }}>
              {t('È a corpo libero')}
            </button>
          </div>
        )}
        <FotoGrande nome={e.name} open={fotoGrande} onClose={() => setFotoGrande(false)}/>
      </NucCard>
    </div>
  )
})

/** Oltre questo l'orologio non misura più un allenamento: vedi `finish`. */
const DURATA_MAX_SEC = 3 * 60 * 60

// Da quanto ci si sta allenando, accanto al conto degli esercizi. Si ridisegna
// da solo ogni mezzo minuto — segna i minuti, non i secondi: è un'informazione
// da un'occhiata, e un contatore che corre in testata ruberebbe lo sguardo al
// timer del recupero, che è quello che si guarda fra una serie e l'altra.
function TempoAllenamento({ da }: { da: number }) {
  const t = useT()
  const [ora, setOra] = useState(() => Date.now())
  useEffect(() => {
    const giro = setInterval(() => setOra(Date.now()), 30_000)
    return () => clearInterval(giro)
  }, [])
  const sec = Math.max(0, Math.round((ora - da) / 1000))
  // Un allenamento ritrovato aperto dal giorno prima: il tempo trascorso non è
  // la sua durata, e non si mostra.
  if (sec > DURATA_MAX_SEC) return null
  return <span aria-label={t('Durata dell’allenamento')}>{' · '}{fmtDurata(sec)}</span>
}

function SchedaTrainingPage({ scheda, palestraExercises, muscleColors, onExit, onFinish, seguito = false }: {
  scheda: GymScheda
  palestraExercises: PalestraExercise[]
  muscleColors: Record<string, string>
  onExit: () => void
  onFinish: (
    results: { id: string; checks: boolean[]; weights: string[]; reps: string[]; note?: string; corpo?: boolean }[],
    fine: { giorno: string; durataSec?: number },
  ) => void
  /** Qualcuno segue chi si allena: il resoconto di fine allenamento arriva a lui. */
  seguito?: boolean
}) {
  const t = useT()
  const tData = useTData()
  // Gli esercizi con il campo della nota aperto. Quelli che una nota ce l'hanno
  // già la mostrano comunque: si apre a mano solo per cominciarne una.
  const [noteAperte, setNoteAperte] = useState<Set<string>>(() => new Set())
  // Il timer: il quadrante in fondo, oppure — chiuso con la × — un'icona in
  // testata accanto al nome della scheda. Chi lo chiude lo ritrova chiuso.
  const [timerAperto, setTimerAperto] = useState(() => !timerChiuso())
  const apriTimer = (aperto: boolean) => { setTimerAperto(aperto); ricordaTimerChiuso(!aperto) }
  // Il riepilogo prima di salvare. Aperto, non subito confermato: è lÌ che le
  // serie mancanti diventano leggibili come mancanti — durante la sessione ogni
  // esercizio parte a zero, e un rosso che compare a metà del primo esercizio
  // direbbe "sbagliato" a chi ha semplicemente appena iniziato.
  const [riepilogo, setRiepilogo] = useState(false)

  // Risolve l'esercizio "Pesi" collegato: prima per id, poi (fallback) per nome —
  // così il peso dell'ultima volta si precompila anche per schede vecchie o esercizi
  // digitati senza scegliere il suggerimento (#1).
  const resolveLinked = (e: GymSchedaExercise): PalestraExercise | undefined => {
    const byId = e.linkedExerciseId ? palestraExercises.find(p => p.id === e.linkedExerciseId) : undefined
    if (byId) return byId
    const name = e.name.trim().toLowerCase()
    return name ? palestraExercises.find(p => p.n.trim().toLowerCase() === name) : undefined
  }

  const [progress, setProgress] = useState<Record<string, TrainProgress>>(() => {
    // Prima di ricominciare da zero: c'è una sessione lasciata a metà su questa
    // scheda? Se sì si riprende da lì. È l'unica cosa che separa un tasto
    // indietro premuto per sbaglio da un'ora di allenamento buttata.
    // Esercizio per esercizio: se nel frattempo la scheda è cambiata, quelli
    // che c'erano riprendono le loro spunte e solo i nuovi partono da zero.
    const ripresa = leggiSessione(scheda) ?? {}

    const init: Record<string, TrainProgress> = {}
    for (const e of scheda.exercises) {
      if (ripresa[e.id]) { init[e.id] = ripresa[e.id]; continue }
      // resolveLinked: fallback per nome, così l'ultimo peso si precompila anche
      // per schede vecchie / esercizi digitati senza scegliere il suggerimento.
      const linked = resolveLinked(e)
      const lastKg = linked?.current.kg
      // Serie per serie, se l'ultima volta i pesi erano diversi: `current.kg` è
      // il più pesante, e scriverlo su tutte farebbe salvare 62,5 anche sulle
      // serie che erano state fatte a 60 a chi spunta senza toccare i campi.
      const perSerie = linked?.history.length ? sortedHistory(linked.history)[linked.history.length - 1].setWeights : undefined
      const n = Math.max(1, e.sets)
      // I colpi si precompilano sull'obiettivo, non sull'ultima volta: la scheda
      // dice cosa fare oggi, e partire dal numero previsto significa che chi
      // rispetta il programma non tocca nulla — tocca solo chi è rimasto sotto.
      const bersagli = colpiPrevisti(e.reps, n)
      init[e.id] = {
        checks: Array(n).fill(false),
        // Anche il precompilato passa dal formattatore: un 62.5 riletto dallo
        // storico comparirebbe col punto in un campo che accetta la virgola.
        weights: Array.from({ length: n }, (_, i) => {
          const kg = perSerie?.[i] ?? lastKg
          // Con l'attrezzo dichiarato lo zero è un valore: chi l'ultima volta
          // ha lavorato col solo bilanciere ritrova "0", non un campo vuoto
          // che al momento di spuntare direbbe "senza chili non conta".
          if (kg === 0 && linked?.attrezzoKg && linked.history.length > 0) return '0'
          return kg ? fmtNum(kg) : ''
        }),
        reps: bersagli.map(c => (c ? String(c) : '')),
      }
    }
    return init
  })

  // I comandi delle card sono `useCallback` senza dipendenze: lavorano solo con
  // l'aggiornamento funzionale di `setProgress`, quindi restano gli stessi per
  // tutta la sessione e non fanno ridisegnare le card memorizzate (vedi
  // CardAllenamento).
  const toggle = useCallback((exId: string, setIdx: number) =>
    setProgress(p => {
      const cur = p[exId]
      const checks = cur.checks.map((c, i) => i === setIdx ? !c : c)
      return { ...p, [exId]: { ...cur, checks } }
    }), [])

  const setSetWeight = useCallback((exId: string, setIdx: number, weight: string) =>
    setProgress(p => {
      const cur = p[exId]
      const weights = cur.weights.map((w, i) => i === setIdx ? normalizzaDecimale(weight) : w)
      return { ...p, [exId]: { ...cur, weights } }
    }), [])

  const setNote = useCallback((exId: string, note: string) =>
    setProgress(p => ({ ...p, [exId]: { ...p[exId], note } })), [])

  const apriNota = useCallback((exId: string) => setNoteAperte(s => new Set(s).add(exId)), [])
  // «Salva» sotto la nota la richiude. Il testo è già nell'avanzamento (si
  // scrive lì a ogni tasto, così non si perde se l'app si chiude a metà
  // frase): qui gli si tolgono solo gli spazi in testa e in coda.
  const chiudiNota = useCallback((exId: string) => {
    setNoteAperte(s => { const n = new Set(s); n.delete(exId); return n })
    setProgress(p => {
      const nota = p[exId]?.note
      return nota !== undefined && nota !== nota.trim() ? { ...p, [exId]: { ...p[exId], note: nota.trim() } } : p
    })
  }, [])

  // Il carico consigliato, serie per serie, scritto su quelle non ancora
  // spuntate: quelle già fatte sono andate con il peso che avevano, e
  // riscriverle falserebbe lo storico.
  const usaConsiglio = useCallback((exId: string, pesi: number[]) =>
    setProgress(p => {
      const cur = p[exId]
      return { ...p, [exId]: { ...cur, weights: cur.weights.map((w, i) => cur.checks[i] || pesi[i] === undefined ? w : fmtNum(pesi[i])) } }
    }), [])

  const setSetReps = useCallback((exId: string, setIdx: number, reps: string) =>
    setProgress(p => {
      const cur = p[exId]
      const next = cur.reps.map((r, i) => i === setIdx ? reps.replace(/[^0-9]/g, '') : r)
      return { ...p, [exId]: { ...cur, reps: next } }
    }), [])

  // Applica peso E colpi della prima serie a tutte. Da quando le righe hanno due
  // campi, ricopiare solo il peso lasciava metà del lavoro a mano proprio nel
  // caso che il tasto esiste per risolvere: le serie tutte uguali.
  // Tranne quando è la scheda a volerle diverse ("10-8-6"): lì il tasto serve
  // a non riscrivere tre volte i chili, e copiando anche i colpi della prima
  // l'allenamento fatto alla lettera si salvava come 10-10-10.
  const applyFirstToAll = useCallback((exId: string, soloChili: boolean) =>
    setProgress(p => {
      const cur = p[exId]
      const kg = cur.weights[0] ?? ''
      const rp = cur.reps[0] ?? ''
      return { ...p, [exId]: { ...cur, weights: cur.weights.map(() => kg), reps: soloChili ? cur.reps : cur.reps.map(() => rp) } }
    }), [])

  // L'esercizio collegato, la nota dell'ultima volta e se è a corpo libero, una
  // volta per sessione e non a ogni tasto: dipendono dallo storico, che durante
  // l'allenamento non cambia. La nota è quella dell'alzata più recente — si
  // rilegge prima di cominciare, che è quando serve ("sedile al 4", "la spalla
  // tirava"). Senza esercizio collegato (una scheda dell'allenatore mai fatta)
  // il corpo libero lo dice la riga della scheda, o il nome.
  // Gli esercizi che chi si allena ha detto a corpo libero durante QUESTA
  // sessione (vedi il tasto sulla card): valgono subito, e a fine allenamento
  // il segno resta sull'esercizio.
  const [dettiCorpoLibero, setDettiCorpoLibero] = useState<Set<string>>(() => new Set())
  const diventaCorpoLibero = useCallback((exId: string) => setDettiCorpoLibero(s => new Set(s).add(exId)), [])

  const collegati = useMemo(() => {
    const out: Record<string, { last?: PalestraExercise; notaPrima?: string; corpo: boolean; attrezzo: number }> = {}
    for (const e of scheda.exercises) {
      const last = resolveLinked(e)
      const notaPrima = last ? ultimaVoce(last.history)?.note : undefined
      const corpo = dettiCorpoLibero.has(e.id) || aCorpoLibero(last, e)
      out[e.id] = { last, notaPrima, corpo, attrezzo: corpo ? 0 : (last?.attrezzoKg ?? 0) }
    }
    return out
    // `resolveLinked` legge solo `palestraExercises`, che è già fra le dipendenze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheda, palestraExercises, dettiCorpoLibero])

  // Il consiglio di ogni esercizio si calcola una volta sola per sessione, per lo
  // stesso motivo.
  // A corpo libero non c'è un perno da spostare: il consiglio sui chili non
  // avrebbe niente da dire. Ma il muscolo lo stanca lo stesso, e nel conto di
  // chi viene prima ci sta anche lui.
  const consigli = useMemo(() => {
    const out: Record<string, Consiglio | null> = {}
    const giaFatti = contaPerMuscolo()
    for (const e of scheda.exercises) {
      const { last, corpo } = collegati[e.id]
      const riga = { sets: e.sets, reps: e.reps, giaFatti: giaFatti(last?.muscle ?? e.muscle) }
      out[e.id] = corpo ? null : caricoConsigliato(last?.history ?? [], riga, scheda.id)
    }
    return out
  }, [scheda, collegati])

  // L'avanzamento conta gli ESERCIZI completati (tutte le serie flaggate), non le
  // singole serie: una volta spuntate tutte le serie l'esercizio è "fatto".
  const totalEx = scheda.exercises.length
  const doneEx = useMemo(() => scheda.exercises.filter(e => {
    const p = progress[e.id]
    // Tutte spuntate e tutte valide: vedi `exDone` in CardAllenamento.
    return p && p.checks.length > 0 && p.checks.every(Boolean)
      && serieValide(p.checks, p.weights, collegati[e.id].corpo, collegati[e.id].attrezzo).length === p.checks.length
  }).length, [scheda, progress, collegati])
  const anyDone = useMemo(() => Object.values(progress).some(p => p.checks.some(Boolean)), [progress])

  // Ogni spunta, ogni chilo scritto finisce su disco. È un oggetto da poche
  // centinaia di byte e la scrittura è sincrona ma trascurabile: il costo è
  // incomparabile con quello di perdere la sessione.
  // Tranne quando questa scheda è stata solo aperta e un'altra ha un
  // allenamento cominciato: guardare non deve cancellare quello vero.
  // Prima di tutto si segna l'ingresso: è da lì che parte l'orologio della
  // durata (vedi `segnaAvvio`). Dichiarato PRIMA del salvataggio qui sotto,
  // che gira nello stesso giro e deve trovarlo già scritto.
  useEffect(() => { segnaAvvio(scheda.id) }, [scheda.id])
  useEffect(() => {
    if (!copreAltra(scheda.id, progress)) salvaSessione(scheda.id, progress)
  }, [scheda.id, progress])

  // Da quando si misura la durata: dall'ingresso nell'allenamento (vedi
  // `segnaAvvio`). Si legge dal disco dopo che gli effetti qui sopra l'hanno
  // scritto; `null` se non si sa (una sessione di prima di questa regola).
  const [partenza, setPartenza] = useState<number | null>(null)
  useEffect(() => { setPartenza(orologioSessione(scheda.id)) }, [scheda.id])

  // L'allenamento di un ALTRO giorno, rimasto aperto: quello che si salva da
  // qui finisce in quel giorno. Va detto in cima, per tutto il tempo.
  const [giornoAperto] = useState(() => {
    const inizio = inizioSessione(scheda.id)
    const giorno = inizio === null ? null : localISO(new Date(inizio))
    return giorno && giorno !== todayISO() ? giorno : null
  })

  const finish = () => {
    const ora = Date.now()
    // Il giorno è quello della prima serie spuntata; la durata corre da quando
    // si è entrati per cominciare.
    const inizio = inizioSessione(scheda.id) ?? ora
    const da = orologioSessione(scheda.id)
    // La durata vale solo se è credibile: un allenamento chiuso il giorno dopo,
    // o lasciato aperto tutto il pomeriggio, ha un orologio che non misura più
    // l'allenamento. Sopra le tre ore non la si scrive affatto — un numero
    // sbagliato nel report all'allenatore è peggio di nessun numero.
    const sec = da === null ? 0 : Math.round((ora - da) / 1000)
    const durataSec = sec >= 60 && sec <= DURATA_MAX_SEC ? sec : undefined
    // Da qui in poi i dati stanno nello storico: tenerne una copia qui vorrebbe
    // dire ritrovarsi l'allenamento di ieri già spuntato al prossimo ingresso.
    scartaSessione()
    onFinish(scheda.exercises.map(e => ({
      id: e.id,
      checks: progress[e.id].checks,
      weights: progress[e.id].weights,
      reps: progress[e.id].reps,
      note: progress[e.id].note,
      corpo: collegati[e.id].corpo,
    })), { giorno: localISO(new Date(inizio)), durataSec })
  }

  // Cosa sta per finire nello storico, esercizio per esercizio. Si calcola solo
  // qui e si legge solo nel riepilogo: è la fotografia del "com'è andata", con
  // gli scarti dal programma già misurati. A riepilogo chiuso non serve, e non
  // si rifà a ogni cifra battuta.
  const righe = useMemo(() => !riepilogo ? [] : scheda.exercises.map(e => {
    const p = progress[e.id]
    const spuntate = p.checks.filter(Boolean).length
    // Le serie che finiranno davvero nello storico: spuntate e, con un
    // attrezzo, con i chili scritti. Le altre si contano a parte, per dirlo.
    const idx = serieValide(p.checks, p.weights, collegati[e.id].corpo, collegati[e.id].attrezzo)
    const bersagli = colpiPrevisti(e.reps, e.sets)
    const colpi = idx.map(i => parseInt(p.reps[i]) || 0)
    // I numeri che non si salvano, e quelli da guardare due volte perché
    // lontani dall'ultima alzata dell'esercizio (vedi limitiAlzata).
    const { corpo, attrezzo, last } = collegati[e.id]
    const scritti = idx.map(i => parseNum(p.weights[i]))
    const impossibile = numeroImpossibile({ kg: scritti, colpi })
    const nuovoKg = scritti.length ? Math.max(...scritti) + attrezzo : 0
    const ultimoKg = corpo ? null : caricoDiRiferimento(last?.history ?? [])
    return {
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      impossibile: impossibile ? testoImpossibile(t, impossibile) : null,
      salto: !corpo && saltoDaConfermare(nuovoKg, ultimoKg) ? { nuovo: nuovoKg, ultimo: ultimoKg ?? 0 } : null,
      nota: p.note?.trim() ?? '',
      senzaChili: spuntate - idx.length,
      fatte: idx.length,
      previste: Math.max(1, e.sets),
      colpi,
      // Com'è scritto in scheda: "8", "8-10", "10-8-6".
      obiettivo: e.reps.trim(),
      // Sotto obiettivo se anche una sola serie è rimasta corta: è quella a dire
      // che qualcosa non ha funzionato, non la media, che la nasconderebbe.
      // Ogni serie col SUO bersaglio (`idx` sono le serie fatte, `colpi` i loro).
      colpiCorti: idx.some((i, k) => colpi[k] > 0 && colpi[k] < (bersagli[i] ?? 0)),
      kg: idx.map(i => parseNum(p.weights[i])),
    }
    // `t` cambia solo con la lingua, che a riepilogo aperto non si tocca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [scheda, progress, riepilogo, collegati])
  const daSalvare = righe.some(r => r.fatte > 0)
  const impossibili = righe.filter(r => r.impossibile)
  const salti = righe.filter(r => r.salto)

  return (
    <SchedaPage
      onBack={onExit} tronca
      title={scheda.title}
      sub={<>
        {t('{fatti}/{tot} esercizi completati', { fatti: doneEx, tot: totalEx })}
        {partenza !== null && !giornoAperto && <TempoAllenamento da={partenza}/>}
      </>}
      azioni={timerAperto ? undefined : <TimerIcona schedaId={scheda.id} onApri={() => apriTimer(true)}/>}
      extra={
        <div style={{ height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${totalEx ? (doneEx / totalEx) * 100 : 0}%`, background: 'var(--j-accent)', transition: 'width 200ms' }}/>
        </div>
      }
    >

      <div className="j-scroll-area">
        {giornoAperto && (
          <div role="note" style={{
            marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
            fontFamily: NUC.label, fontSize: 11, lineHeight: 1.5, color: 'var(--warn)',
          }}>
            {t('È l’allenamento del {giorno}, rimasto aperto: quello che salvi da qui finisce in quel giorno. Per allenarti oggi chiudilo, poi ricomincia.', { giorno: fmtDayMonthFull(giornoAperto) })}
          </div>
        )}
        {scheda.exercises.map((e, idx) => (
          <CardAllenamento
            key={e.id}
            e={e}
            legatoPrima={idx > 0 && !!scheda.exercises[idx - 1].supersetWithNext}
            color={muscleColor(e.muscle, muscleColors)}
            p={progress[e.id]}
            last={collegati[e.id].last}
            notaPrima={collegati[e.id].notaPrima}
            corpo={collegati[e.id].corpo}
            attrezzo={collegati[e.id].attrezzo}
            consiglio={consigli[e.id]}
            notaAperta={noteAperte.has(e.id)}
            onToggle={toggle} onPeso={setSetWeight} onColpi={setSetReps} onNota={setNote}
            onUsa={usaConsiglio} onUguale={applyFirstToAll} onApriNota={apriNota} onChiudiNota={chiudiNota}
            onCorpoLibero={diventaCorpoLibero}
          />
        ))}
      </div>

      <div className="j-page-cta">
        {/* Esecuzione e recupero: la barra che accompagna tutta la sessione.
            Sta qui sotto, fuori dalla parte che scorre, perché serve qualunque
            esercizio si stia guardando. */}
        {timerAperto && <TimerRecupero schedaId={scheda.id} onChiudi={() => apriTimer(false)}/>}
        {/* "Allenamento" e non "alzate": quello che finisce qui è la sessione, e
            le alzate sono solo ciò che se ne salva. */}
        <button onClick={() => setRiepilogo(true)} disabled={!anyDone} className="j-btn-accent" style={{ opacity: anyDone ? 1 : 0.5 }}>
          {t('Termina Allenamento')}
        </button>
        <div style={{ fontFamily: NUC.label, fontSize: 9.5, color: NUC.faint, letterSpacing: '.04em', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          {t('Le serie completate verranno salvate come nuova alzata nei rispettivi esercizi.')}
        </div>
      </div>

      <JModal
        open={riepilogo} onClose={() => setRiepilogo(false)} width={360}
        title={giornoAperto ? `${t('Com’è andata')} · ${fmtDayMon(giornoAperto)}` : t('Com’è andata')}
      >
        <div className="flex flex-col gap-2">
          {righe.map(r => {
            const serieCorte = r.fatte > 0 && r.fatte < r.previste
            const nonSvolto = r.fatte === 0
            return (
              <div key={r.id} className="flex items-baseline justify-between gap-3" style={{
                padding: '9px 0', borderBottom: '1px solid var(--divider)', opacity: nonSvolto ? 0.55 : 1,
              }}>
                <div style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tData(r.name)}
                </div>
                {nonSvolto ? (
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em', color: r.senzaChili > 0 ? 'var(--warn)' : NUC.faint, textTransform: 'uppercase', flexShrink: 0 }}>
                    {r.senzaChili > 0 ? t('senza chili: non conta') : t('non svolto')}
                  </div>
                ) : (
                  <div style={{ fontFamily: NUC.label, fontSize: 12, letterSpacing: '.02em', flexShrink: 0, color: NUC.dim }}>
                    {/* Rosse solo le due metà che sono rimaste sotto: se le serie
                        sono tutte e i colpi pure, non c'è niente da segnalare. */}
                    <span style={{ color: serieCorte ? 'var(--danger)' : NUC.ink, fontWeight: serieCorte ? 600 : 400 }}>
                      {r.fatte}
                    </span>
                    {serieCorte && <span style={{ color: 'var(--danger)' }}>/{r.previste}</span>}
                    <span> × </span>
                    <span style={{ color: r.colpiCorti ? 'var(--danger)' : NUC.ink, fontWeight: r.colpiCorti ? 600 : 400 }}>
                      {r.colpi.join(', ')}
                    </span>
                    {r.colpiCorti && <span style={{ color: 'var(--danger)' }}> ({t('obiettivo')} {r.obiettivo})</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {righe.some(r => (r.fatte > 0 && r.fatte < r.previste) || r.colpiCorti) && (
          <div style={{
            marginTop: 12, padding: '9px 11px',
            background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.25)',
            fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, letterSpacing: '.02em', color: 'var(--danger)',
          }}>
            {t('In rosso quello che è rimasto sotto il programma. Si salva com’è andata davvero: è quello che rende confrontabili gli allenamenti.')}
          </div>
        )}

        {/* Le serie spuntate senza chili, dette PRIMA di salvare: chiudendo
            spariscono, e qui c'è ancora il tempo di tornare a scriverli. */}
        {righe.some(r => r.senzaChili > 0) && (
          <div role="note" style={{
            marginTop: 12, padding: '9px 11px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
            fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, letterSpacing: '.02em', color: 'var(--warn)',
          }}>
            {t('Le serie spuntate senza chili non vengono salvate: valgono come non fatte. Chiudi questa finestra per scriverli, o per dire che l’esercizio è a corpo libero.')}
            {' '}
            {righe.filter(r => r.senzaChili > 0).map(r => `${tData(r.name)} (${r.senzaChili})`).join(' · ')}
          </div>
        )}

        {/* L'appunto scritto su un esercizio saltato non ha un'alzata a cui
            attaccarsi: va nel resoconto a chi ti segue, e qui si dice che non
            resta nello storico. */}
        {righe.some(r => r.fatte === 0 && r.nota) && (
          <div style={{ marginTop: 10, fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, color: NUC.faint }}>
            {/* Il resoconto parte solo se qualcosa viene salvato e se c'è
                qualcuno a riceverlo: altrimenti la nota non va da nessuna
                parte, e non lo si promette. */}
            {seguito && daSalvare
              ? t('Le note sugli esercizi non svolti non restano nello storico: arrivano a chi ti segue, nel resoconto.')
              : t('Le note sugli esercizi non svolti non vengono salvate.')}
          </div>
        )}

        {/* Un numero impossibile non si salva: lo si dice qui, col nome
            dell'esercizio, e il tasto resta fermo finché non è corretto. */}
        {impossibili.length > 0 && (
          <div role="alert" style={{
            marginTop: 12, padding: '9px 11px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.25)',
            fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, letterSpacing: '.02em', color: 'var(--danger)',
          }}>
            {t('Da correggere prima di salvare: chiudi questa finestra e sistema i numeri.')}
            {' '}
            {impossibili.map(r => `${tData(r.name)} — ${r.impossibile}`).join(' · ')}
          </div>
        )}
        {/* Un numero improbabile sì, ma guardandolo: lo si mette davanti agli
            occhi prima del tasto, che lo dice anche lui. */}
        {salti.length > 0 && (
          <div role="alert" style={{
            marginTop: 12, padding: '9px 11px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(var(--warn-rgb),0.10)', border: '1px solid rgba(var(--warn-rgb),0.35)',
            fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.55, letterSpacing: '.02em', color: 'var(--warn)',
          }}>
            {t('Molto lontani dall’ultima volta: controlla prima di salvare.')}
            {' '}
            {salti.map(r => t('{nome}: {nuovo} kg (l’ultima volta {ultimo})', { nome: tData(r.name), nuovo: fmtNum(r.salto!.nuovo), ultimo: fmtNum(r.salto!.ultimo) })).join(' · ')}
          </div>
        )}

        <button
          onClick={() => { setRiepilogo(false); finish() }}
          disabled={impossibili.length > 0}
          className="j-btn-accent" style={{ marginTop: 14, opacity: impossibili.length > 0 ? 0.5 : 1 }}
        >
          {!daSalvare ? t('Chiudi senza salvare') : salti.length > 0 ? t('Sono giusti: salva e chiudi') : t('Salva e chiudi')}
        </button>
      </JModal>
    </SchedaPage>
  )
}

// ── Report gruppi muscolari (aggregato su tutte le schede) ──────
function SchedaReportPage({ schede, muscleColors, onBack }: {
  schede: GymScheda[]
  muscleColors: Record<string, string>
  onBack: () => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  const { rows, total, schedeConEsercizi } = useMemo(() => {
    const counts: Record<string, number> = {}
    let total = 0
    let schedeConEsercizi = 0
    for (const sc of schede) {
      if (sc.exercises.length > 0) schedeConEsercizi++
      for (const ex of sc.exercises) {
        const m = displayMuscle(ex.muscle || 'Altro')
        counts[m] = (counts[m] || 0) + 1
        total++
      }
    }
    const rows = Object.entries(counts)
      .map(([muscle, count]) => ({ muscle, count, pct: total ? (count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
    return { rows, total, schedeConEsercizi }
  }, [schede])

  const maxCount = rows[0]?.count ?? 1

  return (
    <SchedaPage
      onBack={onBack}
      title={t('Report muscolare')}
      sub={<>{t('{n} esercizi', { n: total })} · {schedeConEsercizi === 1 ? t('1 scheda') : t('{n} schede', { n: schedeConEsercizi })}</>}
    >

      <div className="j-scroll-area">
        {rows.length === 0 ? (
          <div className="j-empty">{t('Nessun esercizio nelle schede — creane per vedere il report')}</div>
        ) : (
          <>
            <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.1em', color: NUC.faint, textTransform: 'uppercase', marginBottom: 12, lineHeight: 1.5 }}>
              {t('Distribuzione dei gruppi muscolari su tutte le schede: quante volte ogni gruppo viene colpito e la sua quota sul totale.')}
            </div>
            {rows.map(r => {
              const color = muscleColor(r.muscle, muscleColors)
              return (
                <div key={r.muscle} className="mb-2.5">
                  <NucCard pad={13} style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center justify-between gap-3" style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: NUC.font, fontSize: 16, fontWeight: 500, color: muscleTextColor(color, dark) }}>{tData(r.muscle)}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: '.04em' }}>
                          {r.count === 1 ? t('1 volta') : t('{n} volte', { n: r.count })}
                        </span>
                        <span style={{ fontFamily: NUC.label, fontSize: 18, color: NUC.accentSoft, letterSpacing: -0.5 }}>
                          {Math.round(r.pct)}<span style={{ fontSize: 11, opacity: 0.6 }}>%</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: color, transition: 'width 400ms cubic-bezier(.2,.9,.2,1)' }}/>
                    </div>
                  </NucCard>
                </div>
              )
            })}
          </>
        )}
      </div>
    </SchedaPage>
  )
}
