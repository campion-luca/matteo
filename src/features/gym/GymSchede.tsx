// Schede d'allenamento: le cinque pagine della sezione, in un file solo.
//
// `GymSchede` è solo il contenitore: tiene lo stato di navigazione (elenco →
// dettaglio → modifica / allenamento / report) e passa i dati alle cinque
// pagine sotto, che sono componenti privati senza store.
// Il pezzo forte è `SchedaTrainingPage`: mentre ti alleni spunta le serie e a
// fine sessione trasforma le spunte in vere alzate nello storico degli esercizi
// collegati (`linkedExerciseId`), così la scheda alimenta le statistiche invece
// di restare una lista a parte.
import { useState, useMemo, useEffect, type ReactNode, type CSSProperties } from 'react'
import { NUC, accentFgFor, accentInkFor } from '@/lib/jarvis-tokens'
import { NucCard } from '@/components/ui/NucComponents'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { GymScheda, GymSchedaExercise, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { MUSCLE_OPTIONS, MUSCLE_COLORS, displayMuscle, weekLabel, sortedHistory, recordFor, normalizzaDecimale, parseNum, fmtNum } from './gymModel'
import { useT, useTData } from '@/lib/i18n'
import { RecordModal, type RecordItem } from './gymModals'
import { useBodyWeight } from './gymHooks'
import { useMuscleColors } from './useMuscleColors'
import { todayISO } from '@/lib/isoDate'
import { useIsDark } from '@/hooks/useIsDark'
import { uid } from '@/lib/uid'
import { supabase } from '@/lib/supabase'
import { schedeRicevute, eliminaSchedaAssegnata, type CoachScheda } from '@/lib/coach'

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
    <div className="flex flex-col h-full overflow-hidden j-page-in">
      <div className="j-page-header">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back"><Icons.back size={20} stroke={1.8}/></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="j-page-title" style={tronca ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}>{title}</div>
            <div className="j-eyebrow mt-0.5">{sub}</div>
          </div>
          {azioni}
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
  width: size, height: size, borderRadius: 0, cursor: 'pointer',
  background: danger ? 'rgba(var(--danger-rgb),0.06)' : 'var(--surface)',
  border: danger ? '1px solid rgba(var(--danger-rgb),0.18)' : `1px solid ${NUC.hairline}`,
  color: danger ? 'var(--danger)' : NUC.dim,
})


// ── Container: gestisce la navigazione interna della sezione Schede ──
export function GymSchede({ onBack }: { onBack: () => void }) {
  const t = useT()
  const { gymSchede, palestraExercises } = useJarvisStore(useShallow(st => ({
    gymSchede: st.gymSchede,
    palestraExercises: st.palestraExercises,
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
  useEffect(() => {
    let vivo = true
    // `getSession` e non `getUser`: la sessione è già in locale, mentre `getUser`
    // interroga il server di autenticazione ad ogni apertura delle schede. Qui
    // l'id serve solo come filtro — a decidere cosa si può leggere è la RLS, non
    // il client — e per un filtro la copia locale basta.
    supabase.auth.getSession()
      .then(({ data }) => data.session ? schedeRicevute(data.session.user.id) : [])
      // Le bozze dell'allenatore restano sue: sono schede che ha salvato
      // incomplete per non perdere il lavoro, non cose da allenarci.
      .then(righe => { if (vivo) setAssegnate(righe.filter(r => !r.scheda.draft)) })
      .catch(() => { /* nessuna scheda assegnata: è il caso normale, non un errore */ })
    return () => { vivo = false }
  }, [])

  const [records, setRecords] = useState<RecordItem[]>([])
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
  const finishTraining = (scheda: GymScheda, results: { id: string; checks: boolean[]; weights: string[]; reps: string[] }[]) => {
    const today = todayISO()
    const wl = weekLabel(today)
    let exs = [...palestraExercises]
    const linkMap: Record<string, string> = {}
    // Una scheda salva più alzate in un colpo: i record si raccolgono e si
    // mostrano tutti insieme a fine sessione, non uno alla volta.
    const recs: RecordItem[] = []

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
        ...(variesKg ? { setWeights: doneWeights } : {}),
        ...(variesReps ? { setReps: doneReps } : {}),
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
      } else {
        const newId = uid('px')
        exs.push({
          id: newId, n: se.name.trim(), muscle: se.muscle || 'Altro',
          current: { kg: entry.kg, reps: entry.reps, sets_n: entry.sets_n },
          history: [entry],
        })
        linkMap[se.id] = newId
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
  }

  const renderView = () => {
  if (view === 'form') {
    return (
      <SchedaFormPage
        scheda={editing}
        palestraExercises={palestraExercises}
        onCancel={() => setView(editing ? 'detail' : 'list')}
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
        daCoach={daCoach.get(current.id)}
        onBack={() => { setActive(null); setView('list') }}
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
      onReport={() => setView('report')}
    />
  )
  }

  return (
    <>
      {renderView()}
      <RecordModal records={records} onClose={() => setRecords([])}/>
    </>
  )
}

// ── Lista schede ───────────────────────────────────────────────
function SchedeListPage({ schede, daCoach, onBack, onNew, onOpen, onDelete, onReport }: {
  schede: GymScheda[]
  /** id scheda → nome dell'allenatore che l'ha assegnata. */
  daCoach: Map<string, string>
  onBack: () => void
  onNew: () => void
  onOpen: (s: GymScheda) => void
  onDelete: (id: string) => void
  onReport: () => void
}) {
  const t = useT()
  const hasExercises = schede.some(s => s.exercises.length > 0)
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
        <button onClick={onNew} className="j-btn-add"><Icons.plus size={18} stroke={2}/></button>
      </>}
    >

      <div className="j-scroll-area">
        {schede.length === 0 && (
          <div className="j-empty">{t('Nessuna scheda — creane una con +')}</div>
        )}
        {schede.map((s, i) => (
          <div key={s.id} onClick={() => onOpen(s)} className="mb-2.5 cursor-pointer j-rise-in" style={{ animationDelay: `${Math.min(i * 45, 360)}ms` }}>
            <NucCard pad={14}>
              <div className="flex items-center justify-between gap-3">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: NUC.serif, fontSize: 18, fontWeight: 500, lineHeight: 1.2, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
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
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                    className="flex items-center justify-center"
                    style={{ width: 30, height: 30, borderRadius: 0, background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer' }}
                  >
                    <Icons.trash size={13} stroke={1.6}/>
                  </button>
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

export function SchedaFormPage({ scheda, palestraExercises, onCancel, onSave, onSaveDraft }: {
  scheda: GymScheda | null
  palestraExercises: PalestraExercise[]
  onCancel: () => void
  onSave: (s: GymScheda) => void
  onSaveDraft: (s: GymScheda) => void
}) {
  const t = useT()
  const tData = useTData()
  // Il form leggeva i colori da una mappa vuota, ignorando le personalizzazioni utente.
  const muscleColors = useMuscleColors()
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
    if (errs.length === 0) {
      setErrors([]); setDraftSaved(false)
      onSave(buildScheda())
    } else {
      setErrors(errs)
      setDraftSaved(true)
      onSaveDraft(buildScheda())
    }
  }

  return (
    <SchedaPage
      onBack={onCancel}
      title={scheda ? t('Modifica scheda') : t('Nuova scheda')}
      sub={t('{n} esercizi', { n: rows.filter(r => r.name.trim()).length })}
    >

      <div className="j-scroll-area">
        <input
          value={title}
          onChange={e => { clearFeedback(); setTitle(e.target.value) }}
          placeholder={t('Nome scheda (es. Upper A)')}
          className="j-field"
          style={{ marginBottom: 14, fontFamily: NUC.serif, fontSize: 16 }}
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
                  <button onClick={() => move(r.id, -1)} disabled={idx === 0} title={t('Sposta su')} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 0, background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>
                    <span style={{ display: 'flex', transform: 'rotate(-90deg)' }}><Icons.chev size={13} stroke={2}/></span>
                  </button>
                  <button onClick={() => move(r.id, 1)} disabled={idx === rows.length - 1} title={t('Sposta giù')} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 0, background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim, cursor: idx === rows.length - 1 ? 'default' : 'pointer', opacity: idx === rows.length - 1 ? 0.3 : 1 }}>
                    <span style={{ display: 'flex', transform: 'rotate(90deg)' }}><Icons.chev size={13} stroke={2}/></span>
                  </button>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(r.id)} className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 0, background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer' }}>
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
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                    background: 'var(--surface)', border: `1px solid ${NUC.hairline}`, borderRadius: 0,
                    boxShadow: 'var(--shadow-card)', overflow: 'hidden',
                  }}>
                    {suggestions.map(ex => (
                      <button
                        key={ex.id}
                        onMouseDown={e => { e.preventDefault(); pickSuggestion(r.id, ex) }}
                        className="flex items-center gap-2 w-full"
                        style={{ padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${NUC.hairline}`, cursor: 'pointer', textAlign: 'left' }}
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
                  <input value={r.reps} onChange={e => patch(r.id, { reps: e.target.value })} placeholder="8" className="j-field"/>
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
                    {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{tData(m)}</option>)}
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
                  placeholder={t('Es. presa larga, tempo 3-1-1, RIR 2…')}
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
                  height: 30, borderRadius: 0, marginBottom: 10, cursor: 'pointer',
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
          height: 44, borderRadius: 0, background: 'var(--surface)', border: `1px dashed ${NUC.hairline}`,
          color: NUC.dim, cursor: 'pointer', fontFamily: NUC.label, fontSize: 11, letterSpacing: '.06em', marginBottom: 16,
        }}>
          <Icons.plus size={15} stroke={2}/> {t('Aggiungi esercizio')}
        </button>

        {errors.length > 0 && (
          <div style={{
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
          {scheda ? t('Salva modifiche') : t('Salva scheda')}
        </button>
        <div style={{ fontFamily: NUC.label, fontSize: 9.5, color: NUC.faint, letterSpacing: '.03em', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          {t('Se manca qualcosa la scheda viene comunque salvata come bozza, senza perdere il lavoro.')}
        </div>
      </div>
    </SchedaPage>
  )
}

// ── Dettaglio scheda ───────────────────────────────────────────
function SchedaDetailPage({ scheda, muscleColors, daCoach, onBack, onEdit, onDelete, onStart }: {
  scheda: GymScheda
  muscleColors: Record<string, string>
  /** Nome dell'allenatore, se è lui ad aver assegnato questa scheda. */
  daCoach?: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onStart: () => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  return (
    <SchedaPage
      onBack={onBack} tronca
      title={scheda.title}
      sub={daCoach
        ? t('da {chi}', { chi: daCoach })
        : scheda.exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: scheda.exercises.length })}
      azioni={<>
        {/* La matita non c'è sulle schede assegnate: sono il lavoro dell'allenatore,
            e lasciarle riscrivere qui vorrebbe dire che i due si allenano su due
            versioni diverse senza saperlo. Il cestino resta — rifiutarla si può. */}
        {!daCoach && (
          <button onClick={onEdit} className="flex items-center justify-center" style={iconBtn()}>
            <Icons.pencil size={15} stroke={1.8}/>
          </button>
        )}
        <button onClick={onDelete} className="flex items-center justify-center" style={iconBtn(true)}>
          <Icons.trash size={15} stroke={1.6}/>
        </button>
      </>}
    >

      <div className="j-scroll-area">
        {scheda.exercises.length === 0 ? (
          <div className="j-empty">{t('Scheda vuota — modificala per aggiungere esercizi')}</div>
        ) : (
          scheda.exercises.map((e, i) => {
            const color = muscleColor(e.muscle, muscleColors)
            const linkedToPrev = i > 0 && scheda.exercises[i - 1].supersetWithNext
            return (
              <div key={e.id} className="j-rise-in" style={{ animationDelay: `${Math.min(i * 40, 320)}ms`, marginBottom: e.supersetWithNext ? 4 : 8 }}>
                {linkedToPrev && (
                  <div className="flex items-center gap-1.5" style={{ padding: '0 4px 4px', color: 'var(--j-accent-ink)' }}>
                    <Icons.repeat size={11} stroke={1.8}/>
                    <span style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase' }}>Superset · nessun recupero</span>
                  </div>
                )}
                <NucCard pad={13} style={{ borderLeft: `3px solid ${color}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: NUC.serif, fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: NUC.ink }}>{tData(e.name)}</div>
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
      </div>

      {scheda.exercises.length > 0 && (
        <div className="j-page-cta">
          <button onClick={onStart} className="flex items-center justify-center gap-2 w-full" style={{
            height: 52, borderRadius: 0, background: 'var(--j-accent)', border: 'none',
            color: 'var(--j-accent-fg)', cursor: 'pointer', fontFamily: NUC.font, fontSize: 15, fontWeight: 500,
            boxShadow: '0 6px 18px -6px rgba(42,36,24,0.35)',
          }}>
            <Icons.play size={18}/> {t('Inizia allenamento')}
          </button>
        </div>
      )}
    </SchedaPage>
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

// ── Allenamento (esecuzione scheda) ────────────────────────────
// Un peso E un numero di colpi per ogni serie: la scheda è il programma, non il
// verbale. Le ultime serie calano quasi sempre, e prima l'allenamento veniva
// salvato con i colpi PREVISTI su tutte — tre serie da 10 anche quando erano
// state 10, 8, 6, con il volume gonfiato di conseguenza.
interface TrainProgress { checks: boolean[]; weights: string[]; reps: string[] }

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
  onFinish: (results: { id: string; checks: boolean[]; weights: string[]; reps: string[] }[]) => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
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

  // L'avanzamento conta gli ESERCIZI completati (tutte le serie flaggate), non le
  // singole serie: una volta spuntate tutte le serie l'esercizio è "fatto".
  const totalEx = scheda.exercises.length
  const doneEx = useMemo(() => scheda.exercises.filter(e => {
    const p = progress[e.id]
    return p && p.checks.length > 0 && p.checks.every(Boolean)
  }).length, [scheda, progress])
  const anyDone = useMemo(() => Object.values(progress).some(p => p.checks.some(Boolean)), [progress])

  const finish = () => {
    onFinish(scheda.exercises.map(e => ({
      id: e.id,
      checks: progress[e.id].checks,
      weights: progress[e.id].weights,
      reps: progress[e.id].reps,
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
        <div style={{ height: 4, borderRadius: 0, background: 'var(--surface-2)', marginTop: 12, overflow: 'hidden' }}>
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
          const exDone = p.checks.length > 0 && p.checks.every(Boolean)
          const linkedToPrev = idx > 0 && scheda.exercises[idx - 1].supersetWithNext
          return (
            <div key={e.id} style={{ marginBottom: e.supersetWithNext ? 4 : 10 }}>
            {linkedToPrev && (
              <div className="flex items-center gap-1.5" style={{ padding: '0 4px 4px', color: 'var(--j-accent-ink)' }}>
                <Icons.repeat size={11} stroke={1.8}/>
                <span style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase' }}>Superset · nessun recupero</span>
              </div>
            )}
            <NucCard pad={14} style={{ borderLeft: `3px solid ${color}`, opacity: exDone ? 0.72 : 1, transition: 'opacity 160ms' }}>
              <div className="flex items-start justify-between gap-3" style={{ marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    {exDone && <Icons.check size={15} stroke={2.6} color={color}/>}
                    <div style={{ fontFamily: NUC.serif, fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: NUC.ink }}>{tData(e.name)}</div>
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: muscleTextColor(color, dark), marginTop: 3, textTransform: 'uppercase' }}>
                    {t('obiettivo')} {e.sets} × {e.reps}
                  </div>
                  {hasLast && (
                    <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.accentSoft, marginTop: 3 }}>
                      {t('ultima volta')} {fmtNum(last!.current.kg)} kg × {last!.current.reps}
                    </div>
                  )}
                  {e.note && (
                    <div style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.faint, marginTop: 5, lineHeight: 1.5, letterSpacing: 0.1, whiteSpace: 'pre-wrap' }}>
                      {e.note}
                    </div>
                  )}
                </div>
                {nSets > 1 && (
                  <button onClick={() => applyFirstToAll(e.id)} className="flex items-center gap-1" style={{
                    flexShrink: 0, height: 26, padding: '0 8px', borderRadius: 0, cursor: 'pointer',
                    background: 'var(--surface-2)', border: `1px solid ${NUC.hairline}`, color: NUC.dim,
                    fontFamily: NUC.label, fontSize: 9, letterSpacing: '.04em', textTransform: 'uppercase',
                  }}>
                    <Icons.repeat size={11} stroke={1.8}/> {t('uguale')}
                  </button>
                )}
              </div>

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
                          height: 44, padding: '0 9px', borderRadius: 0, cursor: 'pointer', flexShrink: 0, minWidth: 82,
                          background: on ? color : 'var(--surface-2)',
                          border: `1px solid ${on ? color : NUC.hairline}`,
                          color: on ? onMuscleColor(color) : NUC.dim,
                          fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.02em',
                          transition: 'background 120ms',
                        }}
                      >
                        {on ? <Icons.check size={13} stroke={2.4} color={onMuscleColor(color)}/> : <span style={{ width: 13, height: 13, borderRadius: 0, border: `1.5px solid ${NUC.faint}`, display: 'inline-block' }}/>}
                        {t('Serie {n}', { n: i + 1 })}
                      </button>
                      <CampoSerie
                        value={p.weights[i] ?? ''}
                        onChange={v => setSetWeight(e.id, i, v)}
                        unita="kg" mode="decimal"
                        etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · kg`}
                      />
                      <CampoSerie
                        value={p.reps[i] ?? ''}
                        onChange={v => setSetReps(e.id, i, v)}
                        unita={t('colpi')} mode="numeric"
                        etichetta={`${tData(e.name)} · ${t('serie')} ${i + 1} · ${t('colpi')}`}
                        allarme={corta}
                      />
                    </div>
                  )
                })}
              </div>
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
                padding: '9px 0', borderBottom: `1px solid ${NUC.hairline}`, opacity: nonSvolto ? 0.55 : 1,
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
            {rows.map((r, i) => {
              const color = muscleColor(r.muscle, muscleColors)
              return (
                <div key={r.muscle} className="mb-2.5 j-rise-in" style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}>
                  <NucCard pad={13} style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="flex items-center justify-between gap-3" style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: NUC.serif, fontSize: 16, fontWeight: 500, color: muscleTextColor(color, dark) }}>{tData(r.muscle)}</div>
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
