// Schede d'allenamento: le cinque pagine della sezione, in un file solo.
//
// `GymSchede` è solo il contenitore: tiene lo stato di navigazione (elenco →
// dettaglio → modifica / allenamento / report) e passa i dati alle cinque
// pagine sotto, che sono componenti privati senza store.
// Il pezzo forte è `SchedaTrainingPage`: mentre ti alleni spunta le serie e a
// fine sessione trasforma le spunte in vere alzate nello storico degli esercizi
// collegati (`linkedExerciseId`), così la scheda alimenta le statistiche invece
// di restare una lista a parte.
import { useState, useMemo, useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { NUC, accentFgFor, accentInkFor } from '@/lib/jarvis-tokens'
import { NucCard } from '@/components/ui/NucComponents'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { GymScheda, GymSchedaExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { MUSCLE_COLORS, displayMuscle, weekLabel, sortedHistory, recordFor, normalizzaDecimale, parseNum, fmtNum, fmtKg, fmtReps } from './gymModel'
import { fmtDayMonthFull } from '@/lib/dateFormat'
import { useT, useTData } from '@/lib/i18n'
import { RecordModal, EditHistoryModal, type RecordItem } from './gymModals'
import { useBodyWeight, useGruppiMuscolari } from './gymHooks'
import { leggiSessione, salvaSessione, scartaSessione } from './sessioneInCorso'
import { useMuscleColors } from './useMuscleColors'
import { FacciaEsercizio } from './gymShared'
import { caricoConsigliato, type Consiglio } from './caricoConsigliato'
import { todayISO } from '@/lib/isoDate'
import { useIsDark } from '@/hooks/useIsDark'
import { uid } from '@/lib/uid'
import { supabase } from '@/lib/supabase'
import { schedeRicevute, eliminaSchedaAssegnata, myAthletes, condividiScheda, type CoachScheda, type CoachLink } from '@/lib/coach'
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
// forma per tutti, il colore lo passa chi lo usa.
// `size`: 40 accanto al bottone "+" dell'elenco (stessa altezza), 36 altrove.
const iconBtn = (danger = false, size = 36): CSSProperties => ({
  width: size, height: size, borderRadius: 'var(--radius)', cursor: 'pointer',
  background: danger ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface)',
  border: danger ? '1px solid rgba(var(--danger-rgb),0.18)' : `1px solid ${NUC.hairline}`,
  color: danger ? 'var(--danger)' : NUC.dim,
})


// ── Container: gestisce la navigazione interna della sezione Schede ──
export function GymSchede({ onBack }: { onBack: () => void }) {
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
  const [ioId, setIoId] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    // `getSession` e non `getUser`: la sessione è già in locale, mentre `getUser`
    // interroga il server di autenticazione ad ogni apertura delle schede. Qui
    // l'id serve solo come filtro — a decidere cosa si può leggere è la RLS, non
    // il client — e per un filtro la copia locale basta.
    supabase.auth.getSession().then(({ data }) => {
      const io = data.session?.user.id
      if (!io || !vivo) return
      setIoId(io)
      // Le bozze dell'allenatore restano sue: sono schede che ha salvato
      // incomplete per non perdere il lavoro, non cose da allenarci.
      schedeRicevute(io)
        .then(righe => { if (vivo) setAssegnate(righe.filter(r => !r.scheda.draft)) })
        .catch(() => { /* nessuna scheda assegnata: è il caso normale, non un errore */ })
      // Chi alleno. Serve solo a decidere se il tasto "condividi" ha senso:
      // senza nessuno da seguire non c'è niente da condividere, e un tasto che
      // apre un elenco vuoto è una promessa non mantenuta.
      myAthletes(io)
        .then(righe => { if (vivo) setAllievi(righe) })
        .catch(() => { /* non allena nessuno, o la tabella non c'è: nessun tasto */ })
    })
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
  const [view, setView] = useState<'list' | 'form' | 'detail' | 'training' | 'report'>('list')
  const [editing, setEditing] = useState<GymScheda | null>(null) // scheda in modifica nel form (null = nuova)
  const [active, setActive] = useState<GymScheda | null>(null)    // scheda aperta in dettaglio/allenamento

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

  const removeScheda = (id: string) => {
    const target = schede.find(s => s.id === id)
    // Una scheda assegnata non è nello store: toglierla dal blob non farebbe
    // nulla, e alla ricarica successiva sarebbe di nuovo lì. Va cancellata la riga.
    if (daCoach.has(id)) {
      confirmDelete(() => {
        eliminaSchedaAssegnata(id)
          .then(() => setAssegnate(a => a.filter(r => r.scheda.id !== id)))
          .catch(() => { /* resta in lista: meglio di una sparizione che non ha avuto luogo */ })
      }, target?.title ?? t('Scheda'))
      return
    }
    confirmDelete(() => set(st => ({ gymSchede: (st.gymSchede ?? []).filter(s => s.id !== id) })), target?.title ?? t('Scheda'))
  }

  // Alla fine dell'allenamento: registra un'"alzata" per ogni esercizio eseguito,
  // collegandolo (o creandolo) tra gli esercizi dei gruppi muscolari.
  const finishTraining = (scheda: GymScheda, results: { id: string; checks: boolean[]; weights: string[]; reps: string[]; note?: string }[]) => {
    const today = todayISO()
    const wl = weekLabel(today)
    let exs = [...palestraExercises]
    const linkMap: Record<string, string> = {}
    // Una scheda salva più alzate in un colpo: i record si raccolgono e si
    // mostrano tutti insieme a fine sessione, non uno alla volta.
    const recs: RecordItem[] = []
    // Quello che finisce nello storico, esercizio per esercizio: serve alla
    // striscia "appena salvato" del dettaglio (vedi `appenaSalvate`).
    const salvate: AlzataSalvata[] = []

    scheda.exercises.forEach(se => {
      const r = results.find(x => x.id === se.id)
      if (!r) return
      // Solo le serie effettivamente spuntate; ognuna col suo peso e i suoi colpi.
      // Gli indici si tengono una volta sola: filtrare due array separatamente
      // basterebbe finché i due filtri restano identici, e sarebbe il tipo di
      // accoppiamento che si rompe in silenzio disallineando peso e colpi.
      const doneIdx = r.checks.map((c, idx) => c ? idx : -1).filter(idx => idx >= 0)
      if (doneIdx.length === 0) return
      const doneWeights = doneIdx.map(idx => parseNum(r.weights[idx]))
      // I colpi previsti dalla scheda restano il ripiego per le serie lasciate in
      // bianco: un allenamento non può valere zero colpi solo perché il campo
      // non è stato toccato.
      const attesi = parseInt(se.reps) || 0
      const doneReps = doneIdx.map(idx => parseInt(r.reps[idx]) || attesi)
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
        ...(variesKg ? { setWeights: doneWeights } : {}),
        ...(variesReps ? { setReps: doneReps } : {}),
        ...(r.note?.trim() ? { note: r.note.trim() } : {}),
      }

      let target = se.linkedExerciseId ? exs.find(e => e.id === se.linkedExerciseId) : undefined
      if (!target) target = exs.find(e => e.n.trim().toLowerCase() === se.name.trim().toLowerCase())

      if (target) {
        const tid = target.id
        // Confronto con lo storico PRIMA di accodare: dopo, l'alzata batterebbe sé stessa.
        const rec = recordFor(target.history, entry, bodyWeight)
        if (rec) recs.push({ name: target.n, ...rec })
        exs = exs.map(e => e.id === tid
          ? { ...e, history: sortedHistory([...e.history, entry]), current: { kg: entry.kg, reps: entry.reps, sets_n: entry.sets_n } }
          : e)
        linkMap[se.id] = tid
        salvate.push({ exerciseId: tid, nome: target.n, entry })
      } else {
        const newId = uid('px')
        exs.push({
          id: newId, n: se.name.trim(), muscle: se.muscle || 'Altro',
          current: { kg: entry.kg, reps: entry.reps, sets_n: entry.sets_n },
          history: [entry],
        })
        linkMap[se.id] = newId
        salvate.push({ exerciseId: newId, nome: se.name.trim(), entry })
      }
    })

    const updatedScheda: GymScheda = {
      ...scheda,
      exercises: scheda.exercises.map(se => linkMap[se.id] && !se.linkedExerciseId ? { ...se, linkedExerciseId: linkMap[se.id] } : se),
      updatedAt: today,
    }
    set(st => ({ palestraExercises: exs, gymSchede: (st.gymSchede ?? []).map(s => s.id === scheda.id ? updatedScheda : s) }))
    setActive(updatedScheda)
    setView('detail')
    setRecords(recs)
    setAppenaSalvate(salvate)
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
    setAppenaSalvate(list => list.map(a => (a === vecchia ? { ...a, entry: nuova } : a)))
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
      setAppenaSalvate(list => list.filter(x => x !== a))
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
        onDelete={editing ? () => { removeScheda(editing.id); setEditing(null); setActive(null); setView('list') } : undefined}
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
        onFinish={results => finishTraining(active, results)}
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
          ? (athleteId: string) => condividiScheda(ioId, athleteId, userName ?? '', current)
          : undefined}
        appenaSalvate={appenaSalvate}
        palestraExercises={palestraExercises}
        onCorreggi={setCorreggo}
        onElimina={eliminaAlzata}
        onBack={() => { setActive(null); setAppenaSalvate([]); setView('list') }}
        onEdit={() => { setEditing(current); setView('form') }}
        onDelete={() => { removeScheda(current.id); setActive(null); setView('list') }}
        onStart={() => { setActive(current); setView('training') }}
      />
    )
  }

  return (
    <SchedeListPage
      schede={schede}
      daCoach={daCoach}
      onBack={onBack}
      onNew={() => { setEditing(null); setView('form') }}
      onOpen={sc => { setActive(sc); setView('detail') }}
      onDelete={removeScheda}
      onMove={moveScheda}
      mie={mie.map(x => x.id)}
      onReport={() => setView('report')}
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
function SchedeListPage({ schede, daCoach, onBack, onNew, onOpen, onDelete, onReport, onMove, mie }: {
  schede: GymScheda[]
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
}) {
  const t = useT()
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
          <button onClick={onReport} title={t('Report gruppi muscolari')} className="flex items-center justify-center" style={iconBtn(false, 40)}>
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
        {schede.length === 0 && (
          <div className="j-empty">{t('Nessuna scheda — creane una con +')}</div>
        )}
        {schede.map(s => (
          <div key={s.id} onClick={() => onOpen(s)} className="mb-2.5 cursor-pointer">
            <NucCard pad={14}>
              <div className="flex items-center justify-between gap-3">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: NUC.font, fontSize: 18, fontWeight: 500, lineHeight: 1.2, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    {s.draft && (
                      <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--warn)', background: 'rgba(var(--warn-rgb),0.12)', border: '1px solid rgba(var(--warn-rgb),0.35)', padding: '1px 5px' }}>{t('Bozza')}</span>
                    )}
                    {daCoach.has(s.id) && (
                      <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--j-accent-ink)', background: 'color-mix(in srgb, var(--j-accent) 12%, transparent)', border: '1px solid var(--j-accent)', padding: '1px 5px' }}>{t('Allenatore')}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 0.4, color: NUC.faint, marginTop: 3 }}>
                    {s.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: s.exercises.length })}
                    {daCoach.has(s.id) && ` · ${t('da {chi}', { chi: daCoach.get(s.id) ?? '' })}`}
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
                  <div style={{ color: NUC.faint, display: 'flex' }}><Icons.chev size={15} stroke={1.6}/></div>
                </div>
              </div>
            </NucCard>
          </div>
        ))}
      </div>
    </SchedaPage>
  )
}

// ── Form creazione / modifica scheda (pagina a parte) ──────────
interface FormRow { id: string; name: string; sets: string; reps: string; linkedExerciseId?: string; muscle: string; note: string; supersetWithNext: boolean }

export function SchedaFormPage({ scheda, palestraExercises, onCancel, onSave, onSaveDraft, onDelete }: {
  scheda: GymScheda | null
  palestraExercises: PalestraExercise[]
  onCancel: () => void
  onSave: (s: GymScheda) => void
  onSaveDraft: (s: GymScheda) => void
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
      ? scheda.exercises.map(e => ({ id: e.id, name: e.name, sets: String(e.sets), reps: e.reps, linkedExerciseId: e.linkedExerciseId, muscle: e.muscle ?? '', note: e.note ?? '', supersetWithNext: !!e.supersetWithNext }))
      : [{ id: uid('r'), name: '', sets: '3', reps: '8', muscle: '', note: '', supersetWithNext: false }]
  )
  const [focused, setFocused] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [draftSaved, setDraftSaved] = useState(false)
  // La scheda esiste già da quando è stata salvata la prima volta, anche come
  // bozza: da lì in poi il tasto salva delle MODIFICHE, non crea una scheda.
  const [giaSalvata, setGiaSalvata] = useState(!!scheda)
  const erroriRef = useRef<HTMLDivElement>(null)
  const etichettaSalva = giaSalvata ? t('Salva modifiche') : t('Salva scheda')

  // Ogni modifica azzera il feedback di validazione precedente.
  const clearFeedback = () => { if (errors.length || draftSaved) { setErrors([]); setDraftSaved(false) } }

  const patch = (id: string, changes: Partial<FormRow>) => {
    clearFeedback()
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...changes } : r))
  }

  const addRow = () => { clearFeedback(); setRows(rs => [...rs, { id: uid('r'), name: '', sets: '3', reps: '8', muscle: '', note: '', supersetWithNext: false }]) }
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
    setGiaSalvata(true)
    if (errs.length === 0) {
      setErrors([]); setDraftSaved(false)
      onSave(buildScheda())
    } else {
      setErrors(errs)
      setDraftSaved(true)
      onSaveDraft(buildScheda())
      // L'elenco di cosa manca sta in fondo: salvando dal tasto in alto non si
      // vedrebbe, e la bozza sembrerebbe un salvataggio riuscito.
      requestAnimationFrame(() => erroriRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
  }

  return (
    <SchedaPage
      onBack={onCancel}
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
        <input
          value={title}
          onChange={e => { clearFeedback(); setTitle(e.target.value) }}
          placeholder={t('Nome scheda (es. Upper A)')}
          className="j-field"
          style={{ marginBottom: 14, fontFamily: NUC.font, fontSize: 16 }}
        />

        {rows.map((r, idx) => {
          const suggestions = focused === r.id ? suggestionsFor(r) : []
          const color = muscleColor(r.muscle, muscleColors)
          const isLast = idx === rows.length - 1
          const linkedToPrev = idx > 0 && rows[idx - 1].supersetWithNext
          return (
            <div key={r.id}>
            <NucCard pad={12} style={{ marginBottom: r.supersetWithNext ? 4 : 10, borderLeft: r.muscle ? `3px solid ${color}` : undefined }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.12em', color: NUC.faint, textTransform: 'uppercase' }}>
                  {t('Esercizio {n}', { n: idx + 1 })}
                  {linkedToPrev && (
                    <span style={{ marginLeft: 8, color: 'var(--j-accent-ink)' }}>· {t('superset')}</span>
                  )}
                  {r.linkedExerciseId && (
                    <span style={{ marginLeft: 8, color: NUC.accentSoft }}>· {t('collegato')}</span>
                  )}
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
              <div style={{ position: 'relative' }}>
                <input
                  value={r.name}
                  onChange={e => patch(r.id, { name: e.target.value, linkedExerciseId: undefined })}
                  onFocus={() => setFocused(r.id)}
                  onBlur={() => setTimeout(() => setFocused(f => f === r.id ? null : f), 150)}
                  placeholder={t('Nome esercizio')}
                  className="j-field"
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

              {/* Serie · Colpi */}
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <label style={{ flex: 1 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', color: NUC.faint, textTransform: 'uppercase', marginBottom: 3 }}>{t('Serie')}</div>
                  <input value={r.sets} onChange={e => patch(r.id, { sets: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="3" className="j-field"/>
                </label>
                <label style={{ flex: 1 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', color: NUC.faint, textTransform: 'uppercase', marginBottom: 3 }}>{t('Colpi')}</div>
                  <div className="flex gap-1.5">
                    <input
                      value={r.reps}
                      onChange={e => patch(r.id, { reps: e.target.value })}
                      placeholder="8"
                      className="j-field"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    {/* "max" è un obiettivo che un numero non sa dire: le serie a
                        cedimento non hanno un bersaglio da centrare, si va finché
                        si va. Il campo è testo libero e la parola si potrebbe
                        scrivere a mano, ma andava scritta uguale ogni volta —
                        `obiettivoColpi` legge un numero e su "max" cade su 0, cioè
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
                        background: r.reps.trim().toLowerCase() === 'max' ? 'var(--j-accent)' : 'var(--surface-2)',
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
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', color: NUC.faint, textTransform: 'uppercase', marginBottom: 3 }}>
                    {t('Gruppo muscolare')}
                  </div>
                  <select value={r.muscle} onChange={e => patch(r.id, { muscle: e.target.value })} className="j-field">
                    <option value="">{t('Scegli il gruppo…')}</option>
                    {gruppi.map(m => <option key={m} value={m}>{tData(m)}</option>)}
                  </select>
                </div>
              )}

              {/* Nota (opzionale): mostrata anche durante l'allenamento */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.1em', color: NUC.faint, textTransform: 'uppercase', marginBottom: 3 }}>
                  {t('Nota')} <span style={{ opacity: 0.55 }}>{t('(opzionale)')}</span>
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
                  style={{ resize: 'none', lineHeight: 1.5 }}
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
          height: 44, borderRadius: 'var(--radius)', background: 'var(--surface)', border: `1px dashed ${NUC.hairline}`,
          color: NUC.dim, cursor: 'pointer', fontFamily: NUC.label, fontSize: 11, letterSpacing: '.06em', marginBottom: 16,
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
          {t('Se manca qualcosa la scheda viene comunque salvata come bozza, senza perdere il lavoro.')}
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

// Una riga di alzata registrata: nome, colpi × chili, la nota se c'è. Toccata
// si corregge; il cestino, dove c'è, la toglie.
function RigaAlzata({ a, primo, onCorreggi, onElimina }: {
  a: AlzataSalvata
  primo: boolean
  onCorreggi?: (a: AlzataSalvata) => void
  onElimina?: (a: AlzataSalvata) => void
}) {
  const t = useT()
  const tData = useTData()
  const h = a.entry
  return (
    <div className="flex items-center gap-2" style={{ borderTop: primo ? 'none' : '1px solid var(--hairline-soft)' }}>
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
          {h.note && (
            <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10.5, color: NUC.faint, marginTop: 2, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.note}
            </span>
          )}
        </span>
        <span style={{ flexShrink: 0, fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.2 }}>
          {h.sets_n} × {fmtReps(h)} – {fmtKg(h)}
        </span>
        <span style={{ flexShrink: 0, color: NUC.faint, display: 'flex' }}><Icons.pencil size={12} stroke={1.8}/></span>
      </button>
      {onElimina && (
        <button
          onClick={() => onElimina(a)}
          aria-label={t('Elimina alzata')}
          className="j-hit flex items-center justify-center"
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0, cursor: 'pointer',
            background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)',
          }}
        >
          <Icons.trash size={11} stroke={1.6}/>
        </button>
      )}
    </div>
  )
}

function SchedaDetailPage({ scheda, muscleColors, assegnata, ioId, mioNome, allievi, appenaSalvate = [], palestraExercises = [], onCorreggi, onElimina, onCondividi, onBack, onEdit, onDelete, onStart }: {
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
        : daCoach
          ? t('da {chi}', { chi: daCoach })
          : scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: scheda.exercises.length })}
      azioni={<>
        {/* Il punto interrogativo: la porta fra le due facce della scheda. Sta a
            sinistra degli altri perché è l'unico che non fa niente di definitivo,
            e perché quando c'è un messaggio da leggere è il primo da vedere. */}
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
            <Icons.clock size={16} stroke={1.9}/>
          </button>
        )}
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
            <Icons.help size={17} stroke={1.9}/>
            {/* Aperta la vista il badge sparisce perché i messaggi sono appena
                stati letti: lasciarlo lì sarebbe un contatore di cose già viste. */}
            {!richieste && <BadgeNonLetti n={daLeggere} style={{ position: 'absolute', top: -6, right: -6 }}/>}
          </button>
        )}
        {puoiCondividere && (
          <button
            onClick={() => setCondividiAperto(true)}
            aria-label={t('Condividi la scheda')}
            className="flex items-center justify-center" style={iconBtn()}
          >
            <Icons.share size={15} stroke={1.8}/>
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
          <button onClick={onDelete} aria-label={t('Elimina scheda')} className="flex items-center justify-center" style={iconBtn(true)}>
            <Icons.trash size={15} stroke={1.6}/>
          </button>
        ) : (
          <button onClick={onEdit} aria-label={t('Modifica')} className="flex items-center justify-center" style={iconBtn()}>
            <Icons.pencil size={15} stroke={1.8}/>
          </button>
        )}
      </>}
    >

      {storico ? (
        <div className="j-scroll-area">
          <div style={{ fontFamily: NUC.label, fontSize: 10.5, lineHeight: 1.5, color: NUC.faint, marginBottom: 12 }}>
            {t('Tocca un’alzata per correggere chili, colpi o nota.')}
          </div>
          {sessioni.map(s => (
            <NucCard key={s.giorno} pad={13} style={{ marginBottom: 10 }}>
              <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 6 }}>
                <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink }}>
                  {giornoSessione(s.giorno)}
                </div>
                <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: NUC.faint, textTransform: 'uppercase' }}>
                  {s.alzate.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: s.alzate.length })}
                </div>
              </div>
              {s.alzate.map((a, i) => (
                <RigaAlzata key={`${a.exerciseId}-${i}`} a={a} primo={i === 0} onCorreggi={onCorreggi} onElimina={onElimina}/>
              ))}
            </NucCard>
          ))}
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
              {t('ultimo {giorno}', { giorno: giornoSessione(sessioni[0].giorno) })}
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
          <button onClick={onStart} className="j-hard j-accent-key j-focus flex items-center justify-center gap-2 w-full" style={{
            height: 52, borderRadius: 'var(--radius)', backgroundColor: 'var(--j-accent)', border: '1px solid var(--accent-edge)',
            color: 'var(--j-accent-fg)', cursor: 'pointer', fontFamily: NUC.font, fontSize: 15, fontWeight: 500,
          }}>
            <Icons.play size={18}/> {t('Inizia allenamento')}
          </button>
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

// Campo numerico di una serie, con l'unità stampata dentro a destra. In allarme
// (colpi sotto obiettivo) vira al rosso: bordo, testo e unità insieme, perché il
// solo bordo rosso su un numero nero si legge come "campo attivo", non come
// "numero sbagliato".
function CampoSerie({ value, onChange, unita, mode, etichetta, allarme }: {
  value: string
  onChange: (v: string) => void
  unita: string
  mode: 'decimal' | 'numeric'
  etichetta: string
  allarme?: boolean
}) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        value={value}
        onChange={ev => onChange(ev.target.value)}
        inputMode={mode}
        aria-label={etichetta}
        aria-invalid={allarme || undefined}
        placeholder={unita}
        className="j-field"
        style={{
          textAlign: 'center', padding: '9px 30px 9px 8px',
          ...(allarme ? {
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
            background: 'rgba(var(--danger-rgb),0.06)',
          } : {}),
        }}
      />
      <span aria-hidden style={{
        position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
        fontFamily: NUC.label, fontSize: 10,
        color: allarme ? 'var(--danger)' : NUC.faint, pointerEvents: 'none',
      }}>{unita}</span>
    </div>
  )
}

// I tastini nell'angolo della card di un esercizio ("uguale", "nota").
const TASTINO: CSSProperties = {
  height: 26, padding: '0 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
  fontFamily: NUC.label, fontSize: 9, letterSpacing: '.04em', textTransform: 'uppercase',
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
  const { verso, kg, motivo, fatte, cima } = consiglio
  const colore = verso === 'su' ? 'var(--segnale-su)' : verso === 'giu' ? 'var(--segnale-giu)' : NUC.dim
  const freccia = verso === 'su' ? '↑' : verso === 'giu' ? '↓' : '='
  const perche =
    motivo === 'completo' ? t('Tutte le serie a {n} colpi: si può salire.', { n: cima ?? '' })
    : motivo === 'dueSettimane' ? t('Due settimane allo stesso peso: prova a salire.')
    : motivo === 'serieMancanti' ? t('L’ultima volta {fatte} serie su {serie}: meglio scendere.', { fatte: fatte ?? 0, serie })
    : motivo === 'colpiCorti' ? t('L’ultima volta una serie sotto i {n} colpi: meglio scendere.', { n: cima ?? '' })
    : motivo === 'pesoCalato' ? t('L’ultima volta hai dovuto alleggerire: riparti più basso.')
    : cima ? t('Resta a questo peso finché non fai {n} colpi su tutte le serie.', { n: cima })
    : t('Resta a questo peso.')
  return (
    <div className="flex items-center gap-2.5" style={{
      marginBottom: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
      background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: NUC.faint }}>
          {t('Carico consigliato')}
        </div>
        <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 600, color: colore, marginTop: 1 }}>
          <span aria-hidden>{freccia} </span>{fmtNum(kg)} kg
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

// L'obiettivo di colpi di un esercizio della scheda. `reps` è una stringa perché
// ammette gli intervalli ("8-10"): l'obiettivo è il MINIMO dell'intervallo, cioè
// il numero sotto il quale la serie è andata storta. Chiudere un 8-10 a 8 non è
// un errore, e segnarlo in rosso renderebbe il rosso un colore di sfondo.
function obiettivoColpi(reps: string): number {
  return parseInt(reps) || 0
}

function SchedaTrainingPage({ scheda, palestraExercises, muscleColors, onExit, onFinish }: {
  scheda: GymScheda
  palestraExercises: PalestraExercise[]
  muscleColors: Record<string, string>
  onExit: () => void
  onFinish: (results: { id: string; checks: boolean[]; weights: string[]; reps: string[]; note?: string }[]) => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  // Gli esercizi con il campo della nota aperto. Quelli che una nota ce l'hanno
  // già la mostrano comunque: si apre a mano solo per cominciarne una.
  const [noteAperte, setNoteAperte] = useState<Set<string>>(() => new Set())
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
    const ripresa = leggiSessione(scheda)
    if (ripresa) return ripresa

    const init: Record<string, TrainProgress> = {}
    for (const e of scheda.exercises) {
      // resolveLinked: fallback per nome, così l'ultimo peso si precompila anche
      // per schede vecchie / esercizi digitati senza scegliere il suggerimento.
      const lastKg = resolveLinked(e)?.current.kg
      const n = Math.max(1, e.sets)
      // I colpi si precompilano sull'obiettivo, non sull'ultima volta: la scheda
      // dice cosa fare oggi, e partire dal numero previsto significa che chi
      // rispetta il programma non tocca nulla — tocca solo chi è rimasto sotto.
      const target = obiettivoColpi(e.reps)
      init[e.id] = {
        checks: Array(n).fill(false),
        // Anche il precompilato passa dal formattatore: un 62.5 riletto dallo
        // storico comparirebbe col punto in un campo che accetta la virgola.
        weights: Array(n).fill(lastKg ? fmtNum(lastKg) : ''),
        reps: Array(n).fill(target ? String(target) : ''),
      }
    }
    return init
  })

  const toggle = (exId: string, setIdx: number) =>
    setProgress(p => {
      const cur = p[exId]
      const checks = cur.checks.map((c, i) => i === setIdx ? !c : c)
      return { ...p, [exId]: { ...cur, checks } }
    })

  const setSetWeight = (exId: string, setIdx: number, weight: string) =>
    setProgress(p => {
      const cur = p[exId]
      const weights = cur.weights.map((w, i) => i === setIdx ? normalizzaDecimale(weight) : w)
      return { ...p, [exId]: { ...cur, weights } }
    })

  const setNote = (exId: string, note: string) =>
    setProgress(p => ({ ...p, [exId]: { ...p[exId], note } }))

  // Il carico consigliato scritto su tutte le serie non ancora spuntate: quelle
  // già fatte sono andate con il peso che avevano, e riscriverle falserebbe lo
  // storico.
  const usaConsiglio = (exId: string, kg: number) =>
    setProgress(p => {
      const cur = p[exId]
      return { ...p, [exId]: { ...cur, weights: cur.weights.map((w, i) => cur.checks[i] ? w : fmtNum(kg)) } }
    })

  const setSetReps = (exId: string, setIdx: number, reps: string) =>
    setProgress(p => {
      const cur = p[exId]
      const next = cur.reps.map((r, i) => i === setIdx ? reps.replace(/[^0-9]/g, '') : r)
      return { ...p, [exId]: { ...cur, reps: next } }
    })

  // Applica peso E colpi della prima serie a tutte. Da quando le righe hanno due
  // campi, ricopiare solo il peso lasciava metà del lavoro a mano proprio nel
  // caso che il tasto esiste per risolvere: le serie tutte uguali.
  const applyFirstToAll = (exId: string) =>
    setProgress(p => {
      const cur = p[exId]
      const kg = cur.weights[0] ?? ''
      const rp = cur.reps[0] ?? ''
      return { ...p, [exId]: { ...cur, weights: cur.weights.map(() => kg), reps: cur.reps.map(() => rp) } }
    })

  // Il consiglio di ogni esercizio si calcola una volta sola per sessione: dipende
  // dallo storico, che durante l'allenamento non cambia, e non dai tasti premuti.
  const consigli = useMemo(() => {
    const out: Record<string, Consiglio | null> = {}
    for (const e of scheda.exercises) out[e.id] = caricoConsigliato(resolveLinked(e)?.history ?? [], e, scheda.id)
    return out
    // `resolveLinked` legge solo `palestraExercises`, che è già fra le dipendenze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheda, palestraExercises])

  // L'avanzamento conta gli ESERCIZI completati (tutte le serie flaggate), non le
  // singole serie: una volta spuntate tutte le serie l'esercizio è "fatto".
  const totalEx = scheda.exercises.length
  const doneEx = useMemo(() => scheda.exercises.filter(e => {
    const p = progress[e.id]
    return p && p.checks.length > 0 && p.checks.every(Boolean)
  }).length, [scheda, progress])
  const anyDone = useMemo(() => Object.values(progress).some(p => p.checks.some(Boolean)), [progress])

  // Ogni spunta, ogni chilo scritto finisce su disco. È un oggetto da poche
  // centinaia di byte e la scrittura è sincrona ma trascurabile: il costo è
  // incomparabile con quello di perdere la sessione.
  useEffect(() => {
    salvaSessione(scheda.id, progress)
  }, [scheda.id, progress])

  const finish = () => {
    // Da qui in poi i dati stanno nello storico: tenerne una copia qui vorrebbe
    // dire ritrovarsi l'allenamento di ieri già spuntato al prossimo ingresso.
    scartaSessione()
    onFinish(scheda.exercises.map(e => ({
      id: e.id,
      checks: progress[e.id].checks,
      weights: progress[e.id].weights,
      reps: progress[e.id].reps,
      note: progress[e.id].note,
    })))
  }

  // Cosa sta per finire nello storico, esercizio per esercizio. Si calcola solo
  // qui e si legge solo nel riepilogo: è la fotografia del "com'è andata", con
  // gli scarti dal programma già misurati.
  const righe = useMemo(() => scheda.exercises.map(e => {
    const p = progress[e.id]
    const idx = p.checks.map((c, i) => c ? i : -1).filter(i => i >= 0)
    const target = obiettivoColpi(e.reps)
    const colpi = idx.map(i => parseInt(p.reps[i]) || 0)
    return {
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      fatte: idx.length,
      previste: Math.max(1, e.sets),
      colpi,
      target,
      // Sotto obiettivo se anche una sola serie è rimasta corta: è quella a dire
      // che qualcosa non ha funzionato, non la media, che la nasconderebbe.
      colpiCorti: target > 0 && colpi.some(c => c > 0 && c < target),
      kg: idx.map(i => parseNum(p.weights[i])),
    }
  }), [scheda, progress])

  return (
    <SchedaPage
      onBack={onExit} tronca
      title={scheda.title}
      sub={t('{fatti}/{tot} esercizi completati', { fatti: doneEx, tot: totalEx })}
      extra={
        <div style={{ height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${totalEx ? (doneEx / totalEx) * 100 : 0}%`, background: 'var(--j-accent)', transition: 'width 200ms' }}/>
        </div>
      }
    >

      <div className="j-scroll-area">
        {scheda.exercises.map((e, idx) => {
          const color = muscleColor(e.muscle, muscleColors)
          const p = progress[e.id]
          const nSets = Math.max(1, e.sets)
          const target = obiettivoColpi(e.reps)
          const last = resolveLinked(e)
          const hasLast = !!last && last.history.length > 0
          // La nota dell'ultima volta: si rilegge prima di cominciare, che è
          // quando serve ("sedile al 4", "la spalla tirava").
          const notaPrima = hasLast ? sortedHistory(last!.history)[last!.history.length - 1]?.note : undefined
          const consiglio = consigli[e.id]
          const notaVisibile = noteAperte.has(e.id) || !!p.note
          const exDone = p.checks.length > 0 && p.checks.every(Boolean)
          const linkedToPrev = idx > 0 && scheda.exercises[idx - 1].supersetWithNext
          return (
            <div key={e.id} style={{ marginBottom: e.supersetWithNext ? 0 : 10 }}>
            {linkedToPrev && <PonteSuperset/>}
            <NucCard pad={14} style={{ borderLeft: `3px solid ${color}`, ...bordiSuperset(linkedToPrev, !!e.supersetWithNext), opacity: exDone ? 0.72 : 1, transition: 'opacity 160ms' }}>
              <div className="flex items-start justify-between gap-3" style={{ marginBottom: 10 }}>
                <FacciaEsercizio nome={e.name} muscolo={e.muscle} lato={48}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    {exDone && <Icons.check size={15} stroke={2.6} color={color}/>}
                    <div style={{ fontFamily: NUC.font, fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: NUC.ink }}>{tData(e.name)}</div>
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: muscleTextColor(color, dark), marginTop: 3, textTransform: 'uppercase' }}>
                    {t('obiettivo')} {e.sets} × {e.reps}
                  </div>
                  {hasLast && (
                    <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.accentSoft, marginTop: 3 }}>
                      {t('ultima volta')} {last!.current.reps} × {fmtNum(last!.current.kg)} kg
                    </div>
                  )}
                  {notaPrima && (
                    <div style={{ fontFamily: NUC.label, fontSize: 10.5, color: NUC.faint, marginTop: 3, lineHeight: 1.45, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                      {t('Nota dell’ultima volta:')} {notaPrima}
                    </div>
                  )}
                  {e.note && (
                    <div style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.faint, marginTop: 5, lineHeight: 1.5, letterSpacing: 0.1, whiteSpace: 'pre-wrap' }}>
                      {e.note}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5" style={{ flexShrink: 0, alignItems: 'flex-end' }}>
                  {nSets > 1 && (
                    <button onClick={() => applyFirstToAll(e.id)} className="flex items-center gap-1" style={TASTINO}>
                      <Icons.repeat size={11} stroke={1.8}/> {t('uguale')}
                    </button>
                  )}
                  {!notaVisibile && (
                    <button
                      onClick={() => setNoteAperte(s => new Set(s).add(e.id))}
                      aria-label={`${tData(e.name)} · ${t('Aggiungi nota')}`}
                      className="flex items-center gap-1" style={TASTINO}
                    >
                      <Icons.pencil size={10} stroke={1.8}/> {t('nota')}
                    </button>
                  )}
                </div>
              </div>

              {consiglio && (
                <ConsiglioCarico
                  consiglio={consiglio}
                  serie={nSets}
                  // Il tasto serve solo se c'è qualcosa da cambiare: con il
                  // consiglio già scritto su ogni serie da fare sarebbe un no-op.
                  applicabile={p.weights.some((w, i) => !p.checks[i] && parseNum(w) !== consiglio.kg)}
                  onUsa={() => usaConsiglio(e.id, consiglio.kg)}
                />
              )}

              {/* Una riga per serie: spunta + peso + colpi della singola serie.
                  I colpi stanno accanto al peso e non in cima all'esercizio
                  perché è la SINGOLA serie a calare: l'ultima chiude a 6 mentre
                  la prima ha fatto i suoi 10. */}
              <div className="flex flex-col gap-2">
                {Array.from({ length: nSets }).map((_, i) => {
                  const on = p.checks[i]
                  const colpi = parseInt(p.reps[i] ?? '') || 0
                  const corta = target > 0 && colpi > 0 && colpi < target
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        onClick={() => toggle(e.id, i)}
                        aria-pressed={on}
                        className="flex items-center gap-1.5"
                        style={{
                          height: 44, padding: '0 9px', borderRadius: 'var(--radius)', cursor: 'pointer', flexShrink: 0, minWidth: 82,
                          background: on ? color : 'var(--surface-2)',
                          border: `1px solid ${on ? color : NUC.hairline}`,
                          color: on ? onMuscleColor(color) : NUC.dim,
                          fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.02em',
                          transition: 'background 120ms',
                        }}
                      >
                        {on ? <Icons.check size={13} stroke={2.4} color={onMuscleColor(color)}/> : <span style={{ width: 13, height: 13, borderRadius: 'var(--radius-sm)', border: `1.5px solid ${NUC.faint}`, display: 'inline-block' }}/>}
                        {t('Serie {n}', { n: i + 1 })}
                      </button>
                      {/* Prima i colpi, poi i chili: è l'ordine in cui la serie si
                          racconta ("10 per 60") e quello in cui si scrive a fine
                          serie — il peso di solito è già lì dalla volta prima. */}
                      <CampoSerie
                        value={p.reps[i] ?? ''}
                        onChange={v => setSetReps(e.id, i, v)}
                        unita={t('colpi')} mode="numeric"
                        etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · ${t('colpi')}`}
                        allarme={corta}
                      />
                      <CampoSerie
                        value={p.weights[i] ?? ''}
                        onChange={v => setSetWeight(e.id, i, v)}
                        unita="kg" mode="decimal"
                        etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · kg`}
                      />
                    </div>
                  )
                })}
              </div>

              {notaVisibile && (
                <textarea
                  value={p.note ?? ''}
                  onChange={ev => setNote(e.id, ev.target.value)}
                  // Aperta a mano, il campo è quello che si voleva: si scrive subito.
                  autoFocus={!p.note}
                  rows={2}
                  aria-label={`${tData(e.name)} · ${t('nota')}`}
                  placeholder={t('Nota su questa sessione…')}
                  className="j-field"
                  style={{ height: 'auto', minHeight: 56, marginTop: 10, padding: '9px 12px', resize: 'vertical', lineHeight: 1.45 }}
                />
              )}
            </NucCard>
            </div>
          )
        })}
      </div>

      <div className="j-page-cta">
        {/* "Allenamento" e non "alzate": quello che finisce qui è la sessione, e
            le alzate sono solo ciò che se ne salva. */}
        <button onClick={() => setRiepilogo(true)} disabled={!anyDone} className="j-btn-accent" style={{ opacity: anyDone ? 1 : 0.5 }}>
          {t('Termina Allenamento')}
        </button>
        <div style={{ fontFamily: NUC.label, fontSize: 9.5, color: NUC.faint, letterSpacing: '.04em', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          {t('Le serie completate verranno salvate come nuova alzata nei rispettivi esercizi.')}
        </div>
      </div>

      <JModal open={riepilogo} onClose={() => setRiepilogo(false)} title={t('Com’è andata')} width={360}>
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
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em', color: NUC.faint, textTransform: 'uppercase', flexShrink: 0 }}>
                    {t('non svolto')}
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
                    {r.colpiCorti && <span style={{ color: 'var(--danger)' }}> ({t('obiettivo')} {r.target})</span>}
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

        <button onClick={() => { setRiepilogo(false); finish() }} className="j-btn-accent" style={{ marginTop: 14 }}>
          {t('Salva e chiudi')}
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
