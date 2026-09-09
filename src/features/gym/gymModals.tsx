// Tutti i modali della sezione Allenamento, in un file solo.
//
// Stanno insieme perché condividono la stessa impalcatura (JModal + campi
// "j-field") e perché nessuno di loro ha senso fuori dalla palestra: registrare
// un'alzata, correggerne una vecchia, creare un esercizio, cambiarne i dati.
// La differenza di fondo fra i due mondi: in palestra si registrano CARICO ×
// ripetizioni × serie, in Hyrox un TEMPO su una distanza — da qui due modali di
// log separati invece di uno generico pieno di if.
import { useState, useMemo, useEffect } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT, useTData } from '@/lib/i18n'
import { NucEyebrow } from '@/components/ui/NucComponents'
import { JModal } from '@/components/ui/Primitives'
import { Icons } from '@/components/ui/Icons'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { HyroxExercise, HyroxHistoryEntry, PalestraExercise, PalestraHistoryEntry, GymTechnique } from '@/store/useJarvisStore'
import {
  TECHNIQUE_LABELS, TECHNIQUES, MUSCLE_COLORS, COLOR_PALETTE, MUSCLE_OPTIONS,
  displayMuscle, fmtKg, fmtReps, pace, weekLabel, estimate1RM, entry1RM, normalizzaDecimale, parseNum,
  effectiveLoad, sortedHistory,
  } from './gymModel'
import { LineChart } from './gymShared'
import { useBodyWeight } from './gymHooks'
import { todayISO } from '@/lib/isoDate'
import { uid } from '@/lib/uid'
import { fmtShortDate, fmtDayMonth } from '@/lib/dateFormat'

// I modali della scheda Allenamento: registrare una prestazione, aggiungere o
// modificare un esercizio, correggere una riga di storico.
// Sono foglie — non conoscono nessuna delle pagine che li aprono.

export interface LogHyroxModalProps {
  open: boolean; onClose: () => void
  ex: HyroxExercise | null
  onSave: (entry: HyroxHistoryEntry) => void
}

export function LogHyroxModal({ open, onClose, ex, onSave }: LogHyroxModalProps) {
  const t = useT()
  const tData = useTData()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [min, setMin] = useState('')
  const [sec, setSec] = useState('')
  const [units, setUnits] = useState(String(ex?.target ?? 1))
  const [kg, setKg] = useState('')
  const [sets, setSets] = useState('')

  // Il modale resta montato: pre-compila i campi ad ogni apertura (l'init di
  // useState gira una volta sola, con ex ancora null).
  useEffect(() => {
    if (!open || !ex) return
    setDate(todayISO())
    setMin(''); setSec(''); setUnits(String(ex.target ?? 1)); setKg(''); setSets('')
  }, [open, ex])

  if (!ex) return null

  const totalSec = (parseInt(min) || 0) * 60 + (parseInt(sec) || 0)
  const u = parseFloat(units) || ex.target
  const paceStr = totalSec > 0 ? pace(totalSec, u, ex.unit) : '—'

  const save = () => {
    if (!totalSec || !u) return
    onSave({
      d: weekLabel(date), date,
      sec: totalSec, units: u,
      ...(kg ? { kg: parseNum(kg) } : {}),
      ...(sets ? { sets_n: parseInt(sets) } : {}),
    })
    onClose()
  }

  return (
    <JModal open={open} onClose={onClose} title={`${t('Log')} · ${tData(ex.n)}`} width={340}>
      <div className="flex flex-col gap-2.5">
        <div className="j-eyebrow mb-0.5">{t('Data')}</div>
        <input value={date} onChange={e => setDate(e.target.value)} type="date" className="j-field"/>

        <div className="j-eyebrow mt-1">{t('Tempo')}</div>
        <div className="flex gap-2">
          <input value={min} onChange={e => setMin(e.target.value)} placeholder={t('min')} type="number" className="j-field"/>
          <input value={sec} onChange={e => setSec(e.target.value)} placeholder={t('sec')} type="number" className="j-field"/>
        </div>

        <div className="j-eyebrow mt-1">{t('Distanza / Ripetizioni')} ({ex.unit})</div>
        <input value={units} onChange={e => setUnits(e.target.value)} placeholder={String(ex.target)} type="number" className="j-field"/>

        {ex.unit !== 'rep' && (
          <>
            <div className="j-eyebrow mt-1">{t('Kg (opzionale)')}</div>
            <div className="flex gap-2">
              <input value={kg} onChange={e => setKg(normalizzaDecimale(e.target.value))} placeholder="kg" inputMode="decimal" className="j-field"/>
              <input value={sets} onChange={e => setSets(e.target.value)} placeholder={t('serie')} type="number" className="j-field"/>
            </div>
          </>
        )}

        {totalSec > 0 && (
          <div className="flex justify-between items-center rounded-none px-3.5 py-2.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
            <span className="j-eyebrow">{t('Pace')}</span>
            <span style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentSoft }}>{paceStr}</span>
          </div>
        )}

        <button onClick={save} className="j-btn-accent">{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Edit Hyrox History Modal ───────────────────────────────────
export function EditHyroxHistModal({ entry, unit, onClose, onSave }: {
  entry: HyroxHistoryEntry; unit: string
  onClose: () => void; onSave: (h: HyroxHistoryEntry) => void
}) {
  const t = useT()
  const [minV, setMin] = useState(String(Math.floor(entry.sec / 60)))
  const [secV, setSec] = useState(String(entry.sec % 60))
  const [units, setUnits] = useState(String(entry.units))

  const save = () => {
    const totalSec = (parseInt(minV) || 0) * 60 + (parseInt(secV) || 0)
    if (!totalSec) return
    onSave({ ...entry, sec: totalSec, units: parseFloat(units) || entry.units })
    onClose()
  }

  return (
    <JModal open={true} onClose={onClose} title={t('Modifica sessione')} width={300}>
      <div className="flex flex-col gap-2.5">
        <div className="j-eyebrow">{t('Tempo')}</div>
        <div className="flex gap-2">
          <input value={minV} onChange={e => setMin(e.target.value)} placeholder={t('min')} type="number" className="j-field"/>
          <input value={secV} onChange={e => setSec(e.target.value)} placeholder={t('sec')} type="number" className="j-field"/>
        </div>
        <div className="j-eyebrow mt-1">{t('Quantità')} ({unit})</div>
        <input value={units} onChange={e => setUnits(e.target.value)} type="number" className="j-field"/>
        <button onClick={save} className="j-btn-accent">{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// Una colonna del blocco interruttori del log: il titolo e le sue due
// alternative, impilate. Tre colonne affiancate invece di tre righe piene: le sei
// scelte prendono l'altezza di due bottoni invece che di sei, e restano visibili
// insieme ai campi su cui agiscono.
function ColonnaScelta({ titolo, opzioni, spenta }: {
  titolo: string
  opzioni: Array<{ label: string; on: boolean; onClick: () => void }>
  spenta?: boolean
}) {
  return (
    <div style={{ minWidth: 0, opacity: spenta ? 0.4 : 1, transition: 'opacity 180ms' }}>
      <div className="j-eyebrow" style={{ fontSize: 8.5, letterSpacing: '.1em', marginBottom: 6 }}>{titolo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {opzioni.map(o => (
          <button key={o.label} type="button" disabled={spenta} onClick={o.onClick} aria-pressed={o.on} style={{
            height: 32, borderRadius: 0, padding: '0 4px', minWidth: 0,
            background: o.on ? 'var(--surface-2)' : 'var(--surface)',
            border: `1px solid ${o.on ? 'var(--j-accent)' : NUC.hairline}`,
            color: o.on ? 'var(--j-accent-ink)' : NUC.dim,
            fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.04em',
            cursor: spenta ? 'default' : 'pointer', transition: 'all 180ms',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

// ── Log Palestra Modal ─────────────────────────────────────────
export interface LogPalestraModalProps {
  open: boolean; onClose: () => void
  ex: PalestraExercise | null
  onSave: (entry: PalestraHistoryEntry) => void
}

export function LogPalestraModal({ open, onClose, ex, onSave }: LogPalestraModalProps) {
  const t = useT()
  const tData = useTData()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [kg, setKg] = useState(String(ex?.current.kg ?? ''))
  const [reps, setReps] = useState(String(ex?.current.reps ?? ''))
  const [sets, setSets] = useState(String(ex?.current.sets_n ?? ''))
  const [techniques, setTechniques] = useState<GymTechnique[]>([])
  const [isBodyweight, setIsBodyweight] = useState(false)
  const [zavorra, setZavorra] = useState('')
  const [techOpen, setTechOpen] = useState(false)
  const [perSet, setPerSet] = useState(false)          // peso e colpi diversi per ogni serie
  const [setWeightsStr, setSetWeightsStr] = useState<string[]>([])
  const [setRepsStr, setSetRepsStr] = useState<string[]>([])
  const [isMax, setIsMax] = useState(false)            // massimale: una singola al massimo

  // Il modale resta montato: pre-compila kg/reps/sets dall'ultimo valore ad ogni
  // apertura (l'init di useState gira una volta sola, con ex ancora null).
  useEffect(() => {
    if (!open || !ex) return
    setDate(todayISO())
    setKg(String(ex.current.kg ?? ''))
    setReps(String(ex.current.reps ?? ''))
    setSets(String(ex.current.sets_n ?? ''))
    setTechniques([]); setIsBodyweight(false); setZavorra(''); setTechOpen(false)
    setPerSet(false); setSetWeightsStr([]); setSetRepsStr([]); setIsMax(false)
  }, [open, ex])

  const kgN = parseNum(kg)
  // Un massimale è per definizione 1 × 1: i campi serie/colpi non si mostrano
  // nemmeno, e il salvataggio non si fida di cosa c'era scritto prima.
  const repsN = isMax ? 1 : parseInt(reps)
  const setsN = isMax ? 1 : parseInt(sets)
  const zavorraN = parseNum(zavorra)
  const nSets = Math.max(1, setsN || 1)

  const updateSetWeight = (i: number, v: string) =>
    setSetWeightsStr(arr => { const next = [...arr]; next[i] = normalizzaDecimale(v); return next })
  const updateSetReps = (i: number, v: string) =>
    setSetRepsStr(arr => { const next = [...arr]; next[i] = v.replace(/[^0-9]/g, ''); return next })

  // "Serie per serie" vale per il peso E per i colpi: sono le due metà della
  // stessa serie, e un'alzata che cala di carico di solito cala anche di colpi.
  // Entrambi partono dal valore uguale per tutte, così chi ne cambia uno solo
  // non deve riscrivere l'altro.
  const enablePerSet = () => {
    const base = isBodyweight ? zavorra : kg
    setSetWeightsStr(Array.from({ length: nSets }, (_, i) => setWeightsStr[i] ?? (base || '')))
    setSetRepsStr(Array.from({ length: nSets }, (_, i) => setRepsStr[i] ?? (reps || '')))
    setPerSet(true)
  }

  // Pesi e colpi per serie (numerici) limitati al numero di serie impostato
  const perSetNums = perSet ? Array.from({ length: nSets }, (_, i) => parseNum(setWeightsStr[i])) : []
  const perSetReps = perSet ? Array.from({ length: nSets }, (_, i) => parseInt(setRepsStr[i]) || repsN || 0) : []
  const perSetAvg = perSetNums.length ? perSetNums.reduce((a, b) => a + b, 0) / perSetNums.length : 0

  const effectiveKg = perSet ? perSetAvg : (isBodyweight ? (zavorraN || 0) : kgN)
  const hasValues = isBodyweight
    ? (repsN > 0 && setsN > 0)
    : (repsN > 0 && setsN > 0 && (perSet ? perSetNums.some(w => w > 0) : kgN > 0))

  // Anteprima: il carico più pesante dell'alzata e il massimale che ne deriva.
  // Prima qui stava il "coefficiente di difficoltà" dell'EVL, cioè una stima di
  // fatica; ora l'unico numero mostrato è quello con cui l'alzata verrà giudicata.
  // Due moltiplicazioni: niente useMemo, che su `perSetNums` (array nuovo a ogni
  // render) non avrebbe comunque mai fatto centro.
  const topLoad = perSet ? Math.max(0, ...perSetNums) : effectiveKg
  const preview = (ex && hasValues && topLoad > 0)
    // Su un massimale non c'è niente da stimare: il carico È il massimale.
    ? { top: topLoad, oneRM: Math.round(isMax ? topLoad : estimate1RM(topLoad, repsN)) }
    : null

  if (!ex) return null

  const toggleTech = (t: GymTechnique) =>
    setTechniques(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])

  const save = () => {
    if (!hasValues) return
    // Con peso variabile: `kg` = serie più pesante (rappresentativa), e i pesi
    // per serie salvati solo se effettivamente diversi tra loro.
    const weights = perSet ? perSetNums.slice(0, nSets) : []
    const varies = perSet && weights.length > 1 && new Set(weights).size > 1
    const kgOut = perSet ? (weights.length ? Math.max(...weights) : 0) : (isBodyweight ? (zavorraN || 0) : kgN)
    const repsPerSet = perSet ? perSetReps.slice(0, nSets) : []
    const variesReps = perSet && repsPerSet.length > 1 && new Set(repsPerSet).size > 1
    // Col peso variabile il valore rappresentativo è la serie più pesante: i
    // colpi che l'accompagnano devono essere i SUOI, o `kg × reps` descriverebbe
    // una serie mai avvenuta.
    const topIdx = weights.length ? weights.indexOf(Math.max(...weights)) : -1
    const repsOut = variesReps && topIdx >= 0 ? repsPerSet[topIdx] : repsN
    onSave({
      d: weekLabel(date), date,
      kg: kgOut,
      reps: repsOut, sets_n: setsN,
      ...(varies ? { setWeights: weights } : {}),
      ...(variesReps ? { setReps: repsPerSet } : {}),
      techniques: techniques.length > 0 ? techniques : undefined,
      ...(isBodyweight ? { bodyweight: true as const } : {}),
      ...(isMax ? { maxLift: true as const } : {}),
    })
    setTechniques([])
    setIsBodyweight(false); setZavorra('')
    setPerSet(false); setSetWeightsStr([]); setSetRepsStr([]); setIsMax(false)
    onClose()
  }

  return (
    <JModal
      open={open} onClose={onClose} title={`${t('Log')} · ${tData(ex.n)}`} width={360}
      // La data è quasi sempre oggi e quasi mai si tocca: in cima al form
      // prendeva la prima riga — e la prima riga di un form è quella che si
      // legge come "compila da qui". Nell'intestazione dice quando senza
      // chiedere niente, e il form comincia da ciò che c'è davvero da scrivere.
      headerRight={
        <input
          value={date} onChange={e => setDate(e.target.value)} type="date"
          aria-label={t('Data dell’alzata')}
          className="j-field"
          style={{ height: 34, width: 118, fontSize: 12, background: 'var(--surface-2)' }}
        />
      }
    >
      <div className="flex flex-col gap-2.5">
        {/* L'ordine è quello in cui si compila: prima i numeri dell'alzata, poi il
            carico, e in fondo i tre interruttori che ne cambiano la natura. Gli
            interruttori stavano in cima, tre righe piene prima del primo campo:
            si toccano di rado — quasi ogni alzata è con attrezzo, di allenamento,
            a peso uguale — e occupavano mezzo modale per dire ciò che era già vero. */}

        {/* 1. Serie × Colpi */}
        {isMax ? (
          <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: '.04em', lineHeight: 1.5, marginTop: 4 }}>
            {t('Una singola al carico massimo. Serie e colpi valgono 1 × 1.')}
          </div>
        ) : (
          <>
            <div className="j-eyebrow mt-1">{t('Serie × Colpi')}</div>
            <div className="flex gap-2">
              <input value={sets} onChange={e => setSets(e.target.value)} placeholder={t('serie')} aria-label={t('Serie')} type="number" className="j-field"/>
              <input value={reps} onChange={e => setReps(e.target.value)} placeholder={t('colpi')} aria-label={t('Colpi')} type="number" className="j-field"/>
            </div>
          </>
        )}

        {/* 2. Il carico */}
        {perSet && !isMax ? (
          <>
            <div className="j-eyebrow mt-1">
              {isBodyweight ? t('Zavorra') : t('Kg')}<span style={{ opacity: 0.55 }}> · {t('colpi per serie')}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: nSets }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span style={{ width: 26, flexShrink: 0, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: NUC.faint, textTransform: 'uppercase' }}>S{i + 1}</span>
                  <input
                    value={setWeightsStr[i] ?? ''}
                    onChange={e => updateSetWeight(i, e.target.value)}
                    placeholder={isBodyweight ? t('kg agg.') : 'kg'}
                    aria-label={t('Serie {n} · kg', { n: i + 1 })}
                    inputMode="decimal"
                    className="j-field"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <input
                    value={setRepsStr[i] ?? ''}
                    onChange={e => updateSetReps(i, e.target.value)}
                    placeholder={t('colpi')}
                    aria-label={t('Serie {n} · colpi', { n: i + 1 })}
                    inputMode="numeric"
                    className="j-field"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                </div>
              ))}
            </div>
          </>
        ) : isBodyweight ? (
          <>
            <div className="j-eyebrow mt-1">{t('Zavorra extra')} <span style={{ opacity: 0.45 }}>{t('(opzionale)')}</span></div>
            <input value={zavorra} onChange={e => setZavorra(normalizzaDecimale(e.target.value))} placeholder={t('kg aggiunti')} aria-label={t('Zavorra')} inputMode="decimal" className="j-field"/>
          </>
        ) : (
          <>
            <div className="j-eyebrow mt-1">{t('Kg')}</div>
            <input value={kg} onChange={e => setKg(normalizzaDecimale(e.target.value))} placeholder="kg" aria-label={t('Kg')} inputMode="decimal" className="j-field"/>
          </>
        )}

        {/* 3. I tre interruttori, in colonna dentro tre colonne. Su un massimale
            la scelta del carico per serie non esiste: c'è una serie sola, e la
            colonna resta al suo posto spenta invece di sparire — sparendo
            allargherebbe le altre due e farebbe ballare il modale a ogni tocco. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 2 }}>
          <ColonnaScelta titolo={t('Tipo di carico')} opzioni={[
            { label: t('Attrezzo'),     on: !isBodyweight, onClick: () => { setIsBodyweight(false); setZavorra('') } },
            { label: t('Corpo libero'), on: isBodyweight,  onClick: () => { setIsBodyweight(true);  setZavorra('') } },
          ]}/>
          {/* Un massimale non è una serie con un colpo solo: è la prova di quanto
              sposti, e l'app lo tratta diversamente — non viene stimato (nessun
              Epley sopra) e alimenta la card Massimali della home con un numero
              certo invece che dedotto. */}
          <ColonnaScelta titolo={t('Tipo di alzata')} opzioni={[
            { label: t('Allenamento'), on: !isMax, onClick: () => setIsMax(false) },
            { label: t('Massimale'),   on: isMax,  onClick: () => { setIsMax(true); setPerSet(false) } },
          ]}/>
          <ColonnaScelta titolo={isBodyweight ? t('Zavorra') : t('Kg')} spenta={isMax} opzioni={[
            { label: t('Uguale'),    on: !perSet, onClick: () => setPerSet(false) },
            { label: t('Per serie'), on: perSet,  onClick: () => enablePerSet() },
          ]}/>
        </div>

        <button type="button" onClick={() => setTechOpen(o => !o)} className="flex items-center justify-between mt-1 w-full" style={{ background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer' }}>
          <span className="j-eyebrow">
            {t('Tecniche di intensità')}{techniques.length > 0 && <span style={{ color: 'var(--j-accent-ink)' }}> · {techniques.length}</span>}
          </span>
          <div style={{ color: NUC.faint, transform: techOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', display: 'flex' }}>
            <Icons.chev size={13} stroke={2}/>
          </div>
        </button>
        {techOpen && TECHNIQUES.map(tec => {
          const active = techniques.includes(tec)
          return (
            <button key={tec} onClick={() => toggleTech(tec)} className="flex items-center justify-between px-3.5 h-10 rounded-none text-left transition-all duration-180" style={{
              background: active ? 'var(--surface-2)' : 'var(--surface)',
              border: `1px solid ${active ? 'var(--j-accent)' : NUC.hairline}`,
              color: active ? 'var(--j-accent-ink)' : NUC.dim,
              fontFamily: NUC.font, fontSize: 13, cursor: 'pointer',
            }}>
              <span>{t(TECHNIQUE_LABELS[tec])}</span>
              {active && <Icons.check size={14} stroke={2.5}/>}
            </button>
          )
        })}

        {preview && (
          <div className="rounded-none p-3.5 mt-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
            <div className="flex justify-between items-baseline">
              <span style={{ fontFamily: NUC.label, fontSize: 11, letterSpacing: 1, color: NUC.faint, textTransform: 'uppercase' }}>{isMax ? t('Massimale') : t('Massimale stimato')}</span>
              <span style={{ fontFamily: NUC.label, fontSize: 18, color: 'var(--j-accent-ink)', letterSpacing: -0.5 }}>{preview.oneRM} kg</span>
            </div>
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 5 }}>
              {isMax ? t('una singola a {kg} kg', { kg: preview.top }) : t('da {kg} kg × {n} colpi', { kg: preview.top, n: repsN })}
            </div>
          </div>
        )}

        <button onClick={save} className="j-btn-accent">{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Add Exercise Modal ─────────────────────────────────────────
export interface AddExModalProps {
  open: boolean; onClose: () => void; mode: 'hyrox' | 'palestra'
  onAdd: (ex: HyroxExercise | PalestraExercise) => void
  presetMuscle?: string
}

export function AddExModal({ open, onClose, mode, onAdd, presetMuscle }: AddExModalProps) {
  const t = useT()
  const tData = useTData()
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<'km' | 'm' | 'rep'>('m')
  const [target, setTarget] = useState('')
  const [muscle, setMuscle] = useState(presetMuscle ?? '')
  const [muscle2, setMuscle2] = useState('')
  const [note, setNote] = useState('')

  // Quando il modale viene aperto da una card di gruppo muscolare, parte già
  // sul muscolo giusto.
  useEffect(() => {
    if (open) setMuscle(presetMuscle ?? '')
  }, [open, presetMuscle])

  const save = () => {
    if (!name.trim()) return
    if (mode === 'hyrox') {
      onAdd({ id: uid('hx'), n: name, unit, target: parseFloat(target) || 1, history: [] })
    } else {
      onAdd({ id: uid('px'), n: name, muscle, ...(muscle2 ? { muscle2 } : {}), ...(note.trim() ? { note: note.trim() } : {}), current: { kg: 0, reps: 8, sets_n: 3 }, history: [] })
    }
    setName(''); setUnit('m'); setTarget(''); setMuscle(''); setMuscle2(''); setNote('')
    onClose()
  }

  return (
    <JModal open={open} onClose={onClose} title={`${t('Nuovo esercizio')} · ${mode === 'hyrox' ? t('Hyrox') : t('Palestra')}`} width={320}>
      <div className="flex flex-col gap-2.5">
        {/* Le label ci sono anche qui, come per il secondo gruppo muscolare: il
            placeholder da solo sparisce appena si scrive, e il campo resta muto. */}
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 2 }}>
          {t('Nome')}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Nome esercizio')} className="j-field"/>
        {mode === 'hyrox' ? (
          <>
            <select value={unit} onChange={e => setUnit(e.target.value as 'km' | 'm' | 'rep')} className="j-field">
              <option value="km">km</option>
              <option value="m">m</option>
              <option value="rep">rep</option>
            </select>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder={t('Target (distanza/reps)')} className="j-field"/>
          </>
        ) : (
          <>
            <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 2 }}>
              {t('Gruppo muscolare')}
            </div>
            <select value={muscle} onChange={e => { setMuscle(e.target.value); setMuscle2('') }} className="j-field">
              <option value="">{t('Seleziona gruppo muscolare')}</option>
              {/* `value` resta il nome italiano: è ciò che finisce nei dati. Si
                  traduce solo l'etichetta che si legge. */}
              {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{tData(m)}</option>)}
            </select>
            {/* Un solo campo per il muscolo scritto a mano. Prima erano due input in
                posizioni diverse dell'albero (uno per muscle vuoto, uno per muscle
                custom): al primo carattere React smontava l'uno e montava l'altro,
                e il campo perdeva il focus a ogni tasto. */}
            {!MUSCLE_OPTIONS.includes(muscle) && (
              <input
                value={muscle}
                onChange={e => setMuscle(e.target.value)}
                placeholder={muscle ? t('Muscolo (es. Petto)') : t('O scrivi manualmente')}
                className="j-field"
              />
            )}
            {muscle && (
              <>
                <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 2 }}>
                  {t('Secondo gruppo muscolare (opzionale)')}
                </div>
                <select value={muscle2} onChange={e => setMuscle2(e.target.value)} className="j-field">
                  <option value="">{t('Nessuno')}</option>
                  {MUSCLE_OPTIONS.filter(m => m !== muscle).map(m => <option key={m} value={m}>{tData(m)}</option>)}
                </select>
                {muscle2 && !MUSCLE_OPTIONS.includes(muscle2) && (
                  <input value={muscle2} onChange={e => setMuscle2(e.target.value)} placeholder={t('Secondo muscolo')} className="j-field"/>
                )}
              </>
            )}
            <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 4 }}>
              {t('Note (opzionale)')}
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('Esecuzione, setup, attrezzatura…')}
              className="j-field"
              rows={3}
              style={{ resize: 'none', lineHeight: 1.5 }}
            />
          </>
        )}
        <button onClick={save} className="j-btn-accent">{t('Aggiungi')}</button>
      </div>
    </JModal>
  )
}

// ── Exercise Stats Modal ───────────────────────────────────────
export function ExStatsModal({ ex, onClose }: { ex: PalestraExercise; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight()
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])

  // memoised derived arrays
  const { oneRMs, kgs, labels } = useMemo(() => ({
    oneRMs: hist.map(h => Math.round(entry1RM(h, bodyWeight))),
    kgs:    hist.map(h => effectiveLoad(h, bodyWeight)),
    labels: hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])

  const bestKg   = kgs.length    ? Math.max(...kgs)    : ex.current.kg
  const best1RM  = oneRMs.length ? Math.max(...oneRMs) : 0
  const last1RM  = oneRMs[oneRMs.length - 1]
  const prev1RM  = oneRMs[oneRMs.length - 2]
  const rmTrend  = last1RM !== undefined && prev1RM !== undefined ? last1RM - prev1RM : 0

  return (
    <JModal open onClose={onClose} title={tData(ex.n)} width={360} maxHeight="calc(100% - 32px)">
      <div className="flex flex-col gap-3.5">

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('Miglior Kg'),    value: `${bestKg} kg` },
            { label: t('Miglior stima'), value: best1RM > 0 ? `${best1RM} kg` : '—' },
            { label: t('Sessioni'),      value: String(hist.length) },
          ].map(s => (
            <div key={s.label} className="j-stat-tile">
              <div className="j-eyebrow mb-1.5">{s.label}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.4 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {kgs.length >= 2 && (
          <div>
            <NucEyebrow>{t('Carico (kg)')}</NucEyebrow>
            <div className="j-chart-box">
              <LineChart data={kgs} labels={labels} height={96} color="var(--j-accent)" yAxis labelSize={9}/>
            </div>
          </div>
        )}

        {oneRMs.length >= 2 && (
          <div>
            <NucEyebrow info="oneRM" right={rmTrend !== 0 ? (
              <span style={{ color: rmTrend > 0 ? 'var(--j-accent-ink)' : 'var(--danger)' }}>
                {rmTrend > 0 ? '+' : ''}{rmTrend} kg
              </span>
            ) : undefined}>{t('Massimale stimato (kg)')}</NucEyebrow>
            <div className="j-chart-box">
              <LineChart data={oneRMs} labels={labels} height={96} color="var(--chart-2)" yAxis labelSize={9}/>
            </div>
          </div>
        )}

        {hist.length > 0 && (
          <div>
            <NucEyebrow>{hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}</NucEyebrow>
            <div className="flex flex-col">
              {[...hist].reverse().slice(0, 8).map((h, i) => {
                const dateStr = h.date ? fmtShortDate(h.date) : h.d
                const techLabels = (h.techniques ?? []).map(tec => t(TECHNIQUE_LABELS[tec])).join(' · ')
                return (
                  <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
                    <div>
                      <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>
                        {h.sets_n} × {fmtReps(h)} – {fmtKg(h)}
                      </div>
                      <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{dateStr}</div>
                      {h.maxLift && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>{t('Massimale')}</div>}
                      {techLabels && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>{techLabels}</div>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.3 }}>{Math.round(entry1RM(h, bodyWeight))}</div>
                      {/* Su un massimale non è una stima: dirlo "stim." lo svaluterebbe. */}
                      <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{h.maxLift ? 'kg' : t('kg stim.')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {hist.length === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}
      </div>
    </JModal>
  )
}

// ── Modifica esercizio (nome, gruppi muscolari, colore) ────────
export function EditExModal({ open, onClose, ex, onSave, onSaveMuscleColor }: {
  open: boolean; onClose: () => void
  ex: PalestraExercise
  onSave: (changes: Partial<PalestraExercise>) => void
  onSaveMuscleColor: (muscle: string, color: string | undefined) => void
}) {
  const t = useT()
  const tData = useTData()
  // Colori RAW dallo store, NON la mappa risolta di `useMuscleColors()`: questo è il
  // picker e `color` finisce dritto in `onSaveMuscleColor`. Con la mappa desaturata,
  // aprire e salvare in layout "Notte" persisterebbe il grigio come colore scelto.
  const muscleColors = useJarvisStore(st => st.muscleColors) ?? {}
  const [name, setName] = useState(ex.n)
  const [muscle, setMuscle] = useState(displayMuscle(ex.muscle))
  const [muscle2, setMuscle2] = useState(displayMuscle(ex.muscle2 ?? ''))
  const [color, setColor] = useState(muscleColors[displayMuscle(ex.muscle)] ?? '')
  const [note, setNote] = useState(ex.note ?? '')

  useEffect(() => {
    setName(ex.n); setMuscle(displayMuscle(ex.muscle)); setMuscle2(displayMuscle(ex.muscle2 ?? ''))
    setColor(muscleColors[displayMuscle(ex.muscle)] ?? ''); setNote(ex.note ?? '')
    // Reset del form solo al cambio di esercizio (ex.id): gli altri campi sono letti una tantum.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex.id])

  // when muscle group changes in the form, show that group's current color
  useEffect(() => {
    setColor(muscleColors[muscle] ?? '')
    // Reagisce al solo cambio di gruppo muscolare selezionato nel form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muscle])

  const activeColor = color || MUSCLE_COLORS[muscle] || '#8a7440'

  const save = () => {
    if (!name.trim()) return
    onSaveMuscleColor(muscle, color || undefined)
    onSave({ n: name.trim(), muscle, muscle2: muscle2 || undefined, note: note.trim() || undefined })
    onClose()
  }

  return (
    <JModal open={open} onClose={onClose} title={t('Modifica esercizio')} width={320}>
      <div className="flex flex-col gap-2.5">
        {/* Le label ci sono anche qui, come per il secondo gruppo muscolare: il
            placeholder da solo sparisce appena si scrive, e il campo resta muto. */}
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 2 }}>
          {t('Nome')}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Nome esercizio')} className="j-field"/>

        <select value={muscle} onChange={e => { setMuscle(e.target.value); setColor('') }} className="j-field">
          {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{tData(m)}</option>)}
        </select>
        {!MUSCLE_OPTIONS.includes(muscle) && (
          <input value={muscle} onChange={e => setMuscle(e.target.value)} placeholder={t('Gruppo muscolare')} className="j-field"/>
        )}

        <select value={muscle2} onChange={e => setMuscle2(e.target.value)} className="j-field">
          <option value="">{t('Secondo gruppo (opzionale)')}</option>
          {MUSCLE_OPTIONS.filter(m => m !== muscle).map(m => <option key={m} value={m}>{tData(m)}</option>)}
        </select>

        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 4 }}>
          {t('Colore gruppo muscolare — si applica a tutti gli esercizi')}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <button onClick={() => setColor('')} style={{
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0,
            background: 'var(--surface-2)', border: `2px solid ${!color ? 'var(--fg)' : 'var(--hairline)'}`,
            fontFamily: NUC.label, fontSize: 10, color: NUC.faint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>A</button>
          {COLOR_PALETTE.map(c => (
            <button key={c} onClick={() => setColor(color === c ? '' : c)} style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: `2px solid ${activeColor === c && color === c ? 'var(--surface)' : 'transparent'}`,
              outline: activeColor === c && color === c ? `2px solid ${c}` : 'none',
              transition: 'outline 120ms',
            }}/>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeColor, flexShrink: 0 }}/>
          <span style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>
            {color ? t('{gruppo} — personalizzato', { gruppo: tData(muscle) }) : t('{gruppo} — default', { gruppo: tData(muscle) })}
          </span>
        </div>

        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.14em', color: NUC.faint, textTransform: 'uppercase' as const, marginTop: 4 }}>
          {t('Note (opzionale)')}
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t('Esecuzione, setup, attrezzatura…')}
          className="j-field"
          rows={3}
          style={{ resize: 'none', lineHeight: 1.5 }}
        />

        <button onClick={save} className="j-btn-accent" style={{ marginTop: 4 }}>{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Edit History Entry Modal ───────────────────────────────────
export function EditHistoryModal({ entry, onClose, onSave }: {
  entry: PalestraHistoryEntry
  onClose: () => void
  onSave: (updated: PalestraHistoryEntry) => void
}) {
  const t = useT()
  const [isBodyweight, setIsBodyweight] = useState(entry.bodyweight === true)
  const [kg, setKg] = useState(String(entry.bodyweight ? '' : entry.kg))
  const [zavorra, setZavorra] = useState(String(entry.bodyweight && entry.kg > 0 ? entry.kg : ''))
  const [reps, setReps] = useState(String(entry.reps))
  const [sets, setSets] = useState(String(entry.sets_n))
  // Basta UNO dei due array per aprire in modalità per-serie: un'alzata da scheda
  // può avere colpi variabili e peso costante (10, 8, 6 sempre a 40 kg), e
  // guardare solo i pesi l'avrebbe riaperta come uniforme, cancellandole i colpi
  // al primo salvataggio.
  const [perSet, setPerSet] = useState(!!(entry.setWeights?.length || entry.setReps?.length))
  const [setWeightsStr, setSetWeightsStr] = useState<string[]>(entry.setWeights?.map(String) ?? [])
  const [setRepsStr, setSetRepsStr] = useState<string[]>(entry.setReps?.map(String) ?? [])
  // Anche un'alzata già registrata può essere un massimale: il flag si mette e si
  // toglie da qui, altrimenti l'unico modo sarebbe cancellarla e riscriverla.
  const [isMax, setIsMax] = useState(entry.maxLift === true)

  const nSets = Math.max(1, parseInt(sets) || 1)
  const updateSetWeight = (i: number, v: string) =>
    setSetWeightsStr(arr => { const next = [...arr]; next[i] = normalizzaDecimale(v); return next })
  const updateSetReps = (i: number, v: string) =>
    setSetRepsStr(arr => { const next = [...arr]; next[i] = v.replace(/[^0-9]/g, ''); return next })
  const enablePerSet = () => {
    const base = isBodyweight ? zavorra : kg
    setSetWeightsStr(Array.from({ length: nSets }, (_, i) => setWeightsStr[i] ?? (base || '')))
    setSetRepsStr(Array.from({ length: nSets }, (_, i) => setRepsStr[i] ?? (reps || '')))
    setPerSet(true)
  }

  const save = () => {
    const repsN = isMax ? 1 : parseInt(reps)
    const setsN = isMax ? 1 : parseInt(sets)
    if (!repsN || !setsN) return
    let setWeights: number[] | undefined
    let setReps: number[] | undefined
    let kgN: number
    let repsOut = repsN
    if (perSet) {
      const nums = Array.from({ length: Math.max(1, setsN) }, (_, i) => parseNum(setWeightsStr[i]))
      if (!isBodyweight && !nums.some(w => w > 0)) return
      const rps = Array.from({ length: Math.max(1, setsN) }, (_, i) => parseInt(setRepsStr[i]) || repsN)
      kgN = nums.length ? Math.max(...nums) : 0
      setWeights = new Set(nums).size > 1 ? nums : undefined
      setReps = new Set(rps).size > 1 ? rps : undefined
      // Come nel log: `kg` e `reps` restano una coppia vera, quella della serie
      // più pesante, non due estremi presi da serie diverse.
      if (setReps) repsOut = rps[nums.indexOf(Math.max(...nums))] || repsN
    } else {
      kgN = isBodyweight ? parseNum(zavorra) : parseNum(kg)
      if (!isBodyweight && !kgN) return
      setWeights = undefined
      setReps = undefined
    }
    onSave({
      ...entry,
      kg: kgN, reps: repsOut, sets_n: setsN,
      setWeights,   // esplicito: azzera eventuali pesi-serie non più validi
      setReps,      // idem per i colpi-serie
      bodyweight: isBodyweight ? true : undefined,
      maxLift: isMax ? true : undefined,
      machineModel: undefined,
    })
    onClose()
  }

  const dateLabel = entry.date ? fmtShortDate(entry.date) : entry.d

  return (
    <JModal open={true} onClose={onClose} title={`${t('Modifica alzata')} · ${dateLabel}`} width={300}>
      <div className="flex flex-col gap-2.5">
        <div className="j-eyebrow">{t('Tipo di carico')}</div>
        <div className="flex gap-2">
          {([false, true] as const).map(bw => (
            <button key={String(bw)} onClick={() => { setIsBodyweight(bw); setZavorra(''); setKg('') }} style={{
              flex: 1, height: 36, borderRadius: 0,
              background: isBodyweight === bw ? 'var(--surface-2)' : 'var(--surface)',
              border: `1px solid ${isBodyweight === bw ? 'var(--j-accent)' : NUC.hairline}`,
              color: isBodyweight === bw ? 'var(--j-accent-ink)' : NUC.dim,
              fontFamily: NUC.label, fontSize: 11, letterSpacing: '.08em', cursor: 'pointer',
              transition: 'all 180ms',
            }}>
              {bw ? t('Corpo libero') : t('Con attrezzo')}
            </button>
          ))}
        </div>

        <div className="j-eyebrow">{t('Tipo di alzata')}</div>
        <div className="flex gap-2">
          {([false, true] as const).map(v => (
            <button key={String(v)} onClick={() => { setIsMax(v); if (v) setPerSet(false) }} style={{
              flex: 1, height: 36, borderRadius: 0,
              background: isMax === v ? 'var(--surface-2)' : 'var(--surface)',
              border: `1px solid ${isMax === v ? 'var(--j-accent)' : NUC.hairline}`,
              color: isMax === v ? 'var(--j-accent-ink)' : NUC.dim,
              fontFamily: NUC.label, fontSize: 11, letterSpacing: '.08em', cursor: 'pointer',
              transition: 'all 180ms',
            }}>
              {v ? t('Massimale') : t('Allenamento')}
            </button>
          ))}
        </div>
        {isMax && (
          <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: '.04em', lineHeight: 1.5 }}>
            {t('Una singola al carico massimo: serie e colpi diventano 1 × 1.')}
          </div>
        )}

        {!isMax && [
          { label: t('Serie'), val: sets, set: setSets, mode: 'numeric' as const },
          { label: t('Colpi'), val: reps, set: setReps, mode: 'numeric' as const },
        ].map(f => (
          <div key={f.label}>
            <div className="j-eyebrow mb-1">{f.label}</div>
            <input type="number" inputMode={f.mode} value={f.val} onChange={e => f.set(e.target.value)} className="j-field" placeholder="0"/>
          </div>
        ))}

        {!isMax && (
          <button type="button" onClick={() => perSet ? setPerSet(false) : enablePerSet()} className="flex items-center justify-between w-full" style={{
            background: 'transparent', border: 'none', padding: '2px 0', cursor: 'pointer',
          }}>
            <span className="j-eyebrow">
              {isBodyweight ? t('Zavorra') : t('Kg')}{perSet && <span style={{ color: 'var(--j-accent-ink)' }}> · {t('colpi per serie')}</span>}
            </span>
            <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: perSet ? 'var(--j-accent-ink)' : NUC.faint }}>
              {perSet ? t('valori uguali') : t('valori per serie')}
            </span>
          </button>
        )}

        {perSet ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: nSets }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span style={{ width: 30, flexShrink: 0, fontFamily: NUC.label, fontSize: 10, letterSpacing: '.06em', color: NUC.faint, textTransform: 'uppercase' }}>S{i + 1}</span>
                <input value={setWeightsStr[i] ?? ''} onChange={e => updateSetWeight(i, e.target.value)} inputMode="decimal" aria-label={t('Serie {n} · kg', { n: i + 1 })} placeholder={isBodyweight ? t('kg agg.') : 'kg'} className="j-field" style={{ flex: 1, minWidth: 0 }}/>
                <input value={setRepsStr[i] ?? ''} onChange={e => updateSetReps(i, e.target.value)} inputMode="numeric" aria-label={t('Serie {n} · colpi', { n: i + 1 })} placeholder={t('colpi')} className="j-field" style={{ flex: 1, minWidth: 0 }}/>
              </div>
            ))}
          </div>
        ) : isBodyweight ? (
          <div>
            <div className="j-eyebrow mb-1">{t('Zavorra extra')} <span style={{ opacity: 0.45 }}>{t('(opzionale)')}</span></div>
            <input inputMode="decimal" value={zavorra} onChange={e => setZavorra(normalizzaDecimale(e.target.value))} className="j-field" placeholder={t('kg aggiunti')}/>
          </div>
        ) : (
          <div>
            <div className="j-eyebrow mb-1">{t('Kg')}</div>
            <input inputMode="decimal" value={kg} onChange={e => setKg(normalizzaDecimale(e.target.value))} className="j-field" placeholder="0"/>
          </div>
        )}

        <div>
        </div>

        <button onClick={save} className="j-btn-accent" style={{ marginTop: 4 }}>{t('Salva')}</button>
      </div>
    </JModal>
  )
}

// ── Il momento del record ──────────────────────────────────────
// Compare subito dopo il salvataggio, quando l'alzata appena registrata batte il
// massimale stimato di tutte le precedenti su quell'esercizio. Prima il record si
// scopriva riaprendo la scheda, cioè quasi mai.
//
// Una lista e non un singolo: a fine scheda si salvano più alzate in un colpo e i
// record possono essere due o tre. Mostrarli uno per volta avrebbe voluto dire tre
// modali in fila da chiudere a mano.
export interface RecordItem { name: string; prev: number; next: number }

export function RecordModal({ records, onClose }: { records: RecordItem[]; onClose: () => void }) {
  const t = useT()
  const tData = useTData()
  if (!records.length) return null
  const uno = records.length === 1
  return (
    <JModal open onClose={onClose} title={uno ? t('Nuovo record') : t('{n} nuovi record', { n: records.length })} width={320}>
      <div className="flex flex-col gap-3.5">
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--j-accent-ink)', paddingTop: 2 }}>
          <Icons.trophy size={44} stroke={1.4}/>
        </div>

        {records.map(r => (
          <div key={r.name} style={{
            background: 'var(--surface-2)', border: '1px solid var(--hairline)',
            borderRadius: 0, padding: '12px 14px',
          }}>
            <div style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink, marginBottom: 6 }}>{tData(r.name)}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: NUC.label, fontSize: 24, color: 'var(--j-accent-ink)', letterSpacing: -0.8 }}>{r.next} kg</span>
              <span style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.faint }}>
                {t('era {kg} kg', { kg: r.prev })} · +{r.next - r.prev}
              </span>
            </div>
          </div>
        ))}

        {/* Il numero è una stima, e dirlo qui evita che la medaglia prometta una
            singola che non hai mai provato davvero. */}
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, lineHeight: 1.5 }}>
          {t('Massimale stimato dai chili e dai colpi della serie.')}
        </div>

        <button onClick={onClose} className="j-btn-accent">{t('Bene così')}</button>
      </div>
    </JModal>
  )
}
