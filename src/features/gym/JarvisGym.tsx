// Sezione Allenamento: schermata principale e tutte le sue sotto-pagine.
//
// Un solo componente esportato (`JarvisGym`) con tre tab — Pesi, Hyrox, Stats —
// e una navigazione interna a stati, non a router: `selectedExercise`,
// `selectedMuscle`, `selectedHyrox`, `showSchede` sono i "livelli", e i rami di
// return in fondo al file scelgono la pagina da mostrare. Nessuna URL da
// sincronizzare, e il back è sempre "azzera questo stato".
// Le pagine di dettaglio stanno qui sopra come componenti privati; i modali di
// log/modifica vivono in gymModals.tsx e il calcolo (EVL, volume, PR) in
// gymModel.ts, che è puro e testato.
import { useState, useMemo, useEffect } from 'react'
import { NUC, accentInkFor } from '@/lib/jarvis-tokens'
import { NucCard, NucSubTabs, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import { useShallow } from 'zustand/react/shallow'
import { useJarvisStore } from '@/store/useJarvisStore'
import type { HyroxExercise, HyroxHistoryEntry, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { fireCoach } from '@/components/CoachMark'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import {
  TECHNIQUE_LABELS, MUSCLE_OPTIONS,
  displayMuscle, exColor, fmtKg, fmtReps, fmtTime, fmtVol, entry1RM, recordFor,
  effectiveLoad, entryVolume, sortedHistory,
  RACE_STATIONS, RUNNING_STATION, RACE_IDS,
} from './gymModel'
import { useMuscleColors } from './useMuscleColors'
import { achievements } from './gymStrength'
import { GymSchede } from './GymSchede'
import { MuscleIcon } from './MuscleIcons'
import { readStorage, writeStorage } from '@/lib/safeStorage'
import { esercizidaCatalogo } from './catalogo'
import { fotoEsercizio } from './eserciziFoto'
import { supabase } from '@/lib/supabase'
import { noteRicevute, type NotaCoach } from '@/lib/coach'
import { BookmarkRibbon, LineChart } from './gymShared'
import { useBodyWeight } from './gymHooks'
import { useIsDark } from '@/hooks/useIsDark'
import { useT, useTData } from '@/lib/i18n'
import { fmtShortDate, fmtDayMonth } from '@/lib/dateFormat'
import { AddExModal, EditExModal, EditHistoryModal, ExStatsModal, LogHyroxModal, LogPalestraModal, RecordModal } from './gymModals'
import type { RecordItem } from './gymModals'
import { HyroxCard, HyroxDetail, RaceSummary } from './GymHyrox'

type MuscleView = 'vol' | 'sessioni'

// Lo switch della tabella per muscolo: chili spostati o volte che l'hai allenato.
// Vive nell'etichetta di sezione, che cambia titolo con lui — è quello a dire cosa
// si sta guardando; queste due celle dicono solo cosa si può guardare.
function MetricSwitch({ value, onChange }: { value: MuscleView; onChange: (v: MuscleView) => void }) {
  const t = useT()
  const opts: Array<[MuscleView, string]> = [['vol', t('Kg')], ['sessioni', t('Volte')]]
  return (
    <div style={{ display: 'flex', border: '1px solid var(--hairline)', background: 'var(--surface-2)' }}>
      {opts.map(([id, label]) => {
        const on = id === value
        return (
          <button key={id} type="button" onClick={() => onChange(id)} aria-pressed={on} style={{
            padding: '3px 9px', borderRadius: 0,
            background: on ? 'var(--surface)' : 'transparent',
            border: `1px solid ${on ? 'var(--j-accent)' : 'transparent'}`,
            color: on ? 'var(--j-accent-ink)' : NUC.faint,
            fontFamily: NUC.label, fontSize: 9.5, fontWeight: on ? 600 : 500,
            letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
            transition: 'all 180ms',
          }}>{label}</button>
        )
      })}
    </div>
  )
}

type GymMode = 'palestra' | 'hyrox' | 'stats'

// I due modi di allenarsi. Non sono tre: "Stats" non è un allenamento ma ciò che
// se ne ricava, e stava qui dentro solo perché era un'altra schermata da
// raggiungere. Adesso è una delle tre card sotto, insieme a Schede e Cerca, che
// sono anche loro cose che si FANNO sui pesi — non modi di allenarsi.
function GymModeTabs({ value, onChange }: { value: 'palestra' | 'hyrox'; onChange: (m: 'palestra' | 'hyrox') => void }) {
  const t = useT()
  const cell = (id: 'palestra' | 'hyrox', label: string, icon: JSX.Element) => {
    const on = id === value
    return (
      <button key={id} onClick={() => onChange(id)} aria-current={on ? 'page' : undefined} style={{
        height: 36, borderRadius: 0, minWidth: 0,
        background: on ? 'var(--surface)' : 'transparent',
        border: `1px solid ${on ? 'var(--j-accent)' : 'transparent'}`,
        boxShadow: on ? 'var(--shadow-card)' : 'none',
        color: on ? 'var(--j-accent-ink)' : NUC.faint,
        fontFamily: NUC.label, fontSize: 10, fontWeight: on ? 600 : 500,
        letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'color 220ms, background 220ms, border-color 220ms',
      }}>
        {icon}{label}
      </button>
    )
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3,
      background: 'var(--surface-2)', border: '1px solid var(--hairline)',
      borderRadius: 0, padding: 3,
    }}>
      {cell('palestra', t('Pesi'),  <Icons.dumbbell size={14}/>)}
      {cell('hyrox',    t('Hyrox'), <Icons.run size={14}/>)}
    </div>
  )
}

// Le tre cose che si fanno sull'allenamento, quadrate e affiancate sotto i tab.
// Quadrate perché sono destinazioni di pari peso: schede, ricerca e statistiche
// erano finite in tre posti diversi — una riga larga in mezzo alla lista, un
// campo di testo sempre acceso e una cella di un segmented control — e nessuna
// delle tre si trovava guardando la schermata.
function AzioniGym({ attiva, onSchede, onCerca, onStats }: {
  attiva: 'cerca' | 'stats' | null
  onSchede: () => void
  onCerca: () => void
  onStats: () => void
}) {
  const t = useT()
  const card = (id: 'schede' | 'cerca' | 'stats', label: string, icon: JSX.Element, onClick: () => void) => {
    const on = id === attiva
    return (
      <button
        onClick={onClick}
        aria-pressed={id === 'schede' ? undefined : on}
        className="j-hard"
        style={{
          // `aspectRatio` e non un'altezza fissa: la card resta quadrata dal
          // telefono stretto al desktop, dove la colonna è il doppio.
          aspectRatio: '1 / 1', minWidth: 0, borderRadius: 0, cursor: 'pointer',
          background: on ? 'var(--j-accent)' : 'var(--surface)',
          border: `1px solid ${on ? 'var(--j-accent)' : 'var(--hairline)'}`,
          color: on ? 'var(--j-accent-fg)' : 'var(--fg-soft)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 200ms, border-color 200ms, color 200ms',
        }}
      >
        {icon}
        <span style={{
          fontFamily: NUC.label, fontSize: 9.5, fontWeight: 600, letterSpacing: '.14em',
          textTransform: 'uppercase',
        }}>{label}</span>
      </button>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10, maxWidth: 420 }}>
      {card('schede', t('Schede'), <Icons.bookOpen size={26} stroke={1.5}/>, onSchede)}
      {card('cerca',  t('Cerca'),  <Icons.search   size={26} stroke={1.5}/>, onCerca)}
      {card('stats',  t('Stats'),  <Icons.chart    size={26} stroke={1.5}/>, onStats)}
    </div>
  )
}

function GymStats({ exercises, hyroxExercises }: {
  exercises: PalestraExercise[]
  hyroxExercises: HyroxExercise[]
}) {
  const t = useT()
  const tData = useTData()
  const [selectedEx, setSelectedEx] = useState<PalestraExercise | null>(null)
  const [statsTab, setStatsTab] = useState<'pesi' | 'hyrox'>('pesi')
  const [muscleView, setMuscleView] = useState<MuscleView>('vol')
  const [prOpen, setPrOpen] = useState(false)
  const bodyWeight = useBodyWeight()

  const totalPalestra = exercises.reduce((sum, ex) => sum + ex.history.length, 0)
  const totalHyrox    = hyroxExercises.reduce((sum, ex) => sum + ex.history.length, 0)

  const { prs, muscleEntries } = useMemo(() => {
    const volOf = (h: PalestraHistoryEntry) => entryVolume(h, bodyWeight)

    const prs = exercises.map(ex => {
      const bestKg  = ex.history.length ? Math.max(...ex.history.map(h => effectiveLoad(h, bodyWeight))) : ex.current.kg
      // I record si ordinano per massimale stimato: il solo carico massimo metteva
      // davanti una singola pesante fatta una volta rispetto a una serie lunga e piena.
      const best1RM = ex.history.length ? Math.max(...ex.history.map(h => entry1RM(h, bodyWeight))) : 0
      return { ex, name: ex.n, muscle: displayMuscle(ex.muscle), bestKg, best1RM, sessions: ex.history.length }
    }).sort((a, b) => b.best1RM - a.best1RM)

    // Due numeri per muscolo, non uno: i chili spostati e i GIORNI in cui l'hai
    // allenato. Il volume dice quanto hai lavorato, i giorni quanto spesso — e
    // sono domande diverse: un gruppo può avere volume alto perché ci si mettono
    // carichi grossi, non perché lo si alleni più degli altri.
    // I giorni si contano distinti: tre esercizi di dorso lo stesso giovedì sono
    // un allenamento di dorso. Le voci legacy senza `date` ricadono sull'etichetta
    // settimana `d`, che è il massimo di precisione che hanno.
    const map = new Map<string, { vol: number; days: Set<string> }>()
    exercises.forEach(ex => {
      if (!ex.history.length) return
      const m = displayMuscle(ex.muscle)
      const cur = map.get(m) ?? { vol: 0, days: new Set<string>() }
      ex.history.forEach(h => { cur.vol += volOf(h); cur.days.add(h.date ?? h.d) })
      map.set(m, cur)
    })
    const muscleEntries = [...map.entries()].map(([muscle, v]) => ({ muscle, vol: v.vol, days: v.days.size }))

    return { prs, muscleEntries }
  }, [exercises, bodyWeight])

  const hyroxStats = useMemo(() => {
    const allStations = [
      RUNNING_STATION,
      ...RACE_STATIONS,
      ...hyroxExercises.filter(e => !RACE_IDS.has(e.id)),
    ].map(rs => {
      const hist = hyroxExercises.find(e => e.id === rs.id)?.history ?? []
      const bestSec = hist.length ? Math.min(...hist.map(h => h.sec)) : null
      const avgSec  = hist.length ? Math.round(hist.reduce((s, h) => s + h.sec, 0) / hist.length) : null
      return { ...rs, hist, bestSec, avgSec }
    })
    return allStations
  }, [hyroxExercises])

  // Le barre si riordinano insieme alla metrica: un grafico ordinato per volume e
  // letto in allenamenti mostrerebbe la barra più lunga in mezzo alla lista.
  const muscleBars = useMemo(() => {
    const val = (e: typeof muscleEntries[number]) => muscleView === 'vol' ? e.vol : e.days
    return [...muscleEntries]
      .sort((a, b) => val(b) - val(a))
      .map(e => ({
        muscle: e.muscle,
        value: val(e),
        label: muscleView === 'vol'
          ? `${fmtVol(e.vol)} kg`
          : e.days === 1 ? t('1 allenamento') : t('{n} allenamenti', { n: e.days }),
      }))
  }, [muscleEntries, muscleView, t])
  const muscleMax = Math.max(1, ...muscleBars.map(b => b.value))

  const hyroxTabOpts = [
    { id: 'pesi',  label: t('Pesi')  },
    { id: 'hyrox', label: t('Hyrox') },
  ]

  return (
    <div>
      {/* Sub-tab */}
      <NucSubTabs
        options={hyroxTabOpts}
        value={statsTab}
        onChange={id => setStatsTab(id as 'pesi' | 'hyrox')}
        style={{ marginBottom: 16 }}
      />

      {/* Il conteggio sessioni resta solo su Hyrox: lì è il dato che manca
          altrove. Sui pesi era un numero senza appiglio — "112 sessioni" non dice
          né quanto né quando — e stava in cima a tutto il resto. */}
      {statsTab === 'hyrox' && (
        <NucCard pad={14} style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1.5, color: NUC.faint, textTransform: 'uppercase', marginBottom: 6 }}>
            {t('Sessioni hyrox')}
          </div>
          <div style={{ fontFamily: NUC.label, fontSize: 32, color: NUC.accentSoft, letterSpacing: -1, lineHeight: 1 }}>
            {totalHyrox}
          </div>
        </NucCard>
      )}

      {statsTab === 'pesi' && (
        <>
          {muscleEntries.length > 0 && (
            <>
              <NucEyebrow right={
                <MetricSwitch value={muscleView} onChange={setMuscleView}/>
              }>
                {muscleView === 'vol' ? t('Volume per muscolo') : t('Allenamenti per muscolo')}
              </NucEyebrow>
              <NucCard pad={14} style={{ marginBottom: 16 }}>
                <div className="flex flex-col gap-2.5">
                  {muscleBars.map(({ muscle, value, label }) => (
                    <div key={muscle}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1, color: NUC.dim, textTransform: 'uppercase' }}>{tData(muscle)}</span>
                        <span style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{label}</span>
                      </div>
                      <div className="j-progress-track">
                        <div style={{ height: '100%', width: `${(value / muscleMax) * 100}%`, borderRadius: 0, background: 'var(--j-accent)' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </NucCard>
            </>
          )}

          <AchievementsSection exercises={exercises} bodyWeight={bodyWeight}/>

          {/* I record sono una riga per esercizio: con trenta esercizi in lista
              erano trenta card sotto tutto il resto, e la pagina finiva lì. Chiusi
              restano una riga sola, e il numero accanto dice già che ci sono. */}
          {prs.length > 0 && (
            <>
              <button onClick={() => setPrOpen(o => !o)} className="w-full flex items-center justify-between px-0.5 bg-transparent border-none cursor-pointer" style={{ marginBottom: prOpen ? 10 : 16 }}>
                <div className="j-eyebrow">{t('Record personali')}</div>
                <div className="flex items-center gap-1.5">
                  <div className="j-eyebrow">{prs.length}</div>
                  <div style={{ color: NUC.faint, transform: prOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'flex' }}>
                    <Icons.chev size={12} stroke={2}/>
                  </div>
                </div>
              </button>
              {prOpen && (
                <div className="flex flex-col gap-1.5">
                  {prs.map(pr => (
                    <NucCard key={pr.ex.id} pad={12} onPress={() => setSelectedEx(pr.ex)} style={{ cursor: 'pointer' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>{pr.name}</div>
                          <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 1, marginTop: 2, textTransform: 'uppercase' }}>{tData(pr.muscle)} · {t('{n} sess.', { n: pr.sessions })}</div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="text-right">
                            <div style={{ fontFamily: NUC.label, fontSize: 15, color: NUC.accentSoft, letterSpacing: -0.5 }}>{pr.bestKg} kg</div>
                            {pr.best1RM > 0 && <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{t('stima {n} kg', { n: Math.round(pr.best1RM) })}</div>}
                          </div>
                          <div style={{ color: NUC.faint }}><Icons.chev size={16} stroke={1.6}/></div>
                        </div>
                      </div>
                    </NucCard>
                  ))}
                </div>
              )}
            </>
          )}

          {totalPalestra === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}
        </>
      )}

      {statsTab === 'hyrox' && (
        <>
          <NucEyebrow>{t('Tempi per esercizio')}</NucEyebrow>
          <NucCard pad={16} style={{ marginBottom: 16 }}>
            {hyroxStats.map(({ id, n, hist, bestSec, avgSec }, idx) => (
              <div key={id} className="flex justify-between items-center py-2.5"
                style={{ borderBottom: idx < hyroxStats.length - 1 ? '1px solid var(--hairline-soft)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>{tData(n)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>{t('{n} sess.', { n: hist.length })}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {bestSec !== null ? (
                    <>
                      <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentSoft, letterSpacing: -0.5 }}>{fmtTime(bestSec)}</div>
                      {avgSec !== null && avgSec !== bestSec && (
                        <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint }}>{t('media {v}', { v: fmtTime(avgSec) })}</div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.faint }}>—</div>
                  )}
                </div>
              </div>
            ))}
          </NucCard>

          {hyroxStats.filter(s => (s.hist?.length ?? 0) >= 2).map(st => {
            const times = st.hist.map(h => h.sec)
            const labels = st.hist.map(h => h.d)
            return (
              <div key={st.id} style={{ marginBottom: 16 }}>
                <NucEyebrow>{tData(st.n)}</NucEyebrow>
                <NucCard pad={12}>
                  <LineChart data={times} labels={labels} height={48} color={NUC.accentSoft}/>
                </NucCard>
              </div>
            )
          })}

          {totalHyrox === 0 && <div className="j-empty">{t('Nessuna sessione hyrox registrata')}</div>}
        </>
      )}

      {selectedEx && <ExStatsModal ex={selectedEx} onClose={() => setSelectedEx(null)}/>}
    </div>
  )
}

// ── Card di un esercizio di palestra (elenco e griglia) ────────
function PalestraCard({ ex, onNavigate, muscleColors, compact = false }: {
  ex: PalestraExercise; onNavigate: () => void
  muscleColors: Record<string, string>
  compact?: boolean
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  // ordinato: `last` dev'essere la sessione più recente per data, non l'ultima inserita
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const last = hist[hist.length - 1]
  const muscleLabel = ex.muscle2 ? `${tData(displayMuscle(ex.muscle))} · ${tData(displayMuscle(ex.muscle2))}` : tData(displayMuscle(ex.muscle))
  const color = exColor(ex, muscleColors)

  // Variante compatta usata sotto il gruppo muscolare nell'accordion:
  // più piccola e rientrata a destra, così si legge come "figlia" del gruppo.
  if (compact) {
    return (
      <div onClick={onNavigate} className="cursor-pointer" style={{ marginBottom: 6, marginLeft: 28 }}>
        <NucCard pad={11} style={{ borderLeft: `3px solid ${color}` }}>
          <div className="flex justify-between items-center gap-2.5">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.serif, fontSize: 14, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 0.4, color: NUC.faint, marginTop: 2 }}>
                {last ? `${last.sets_n}×${fmtReps(last)} · ${fmtKg(last)}` : t('Nessuna alzata')}
              </div>
            </div>
            <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={14} stroke={1.6}/></div>
          </div>
        </NucCard>
      </div>
    )
  }

  return (
    <div onClick={onNavigate} className="mb-2 cursor-pointer">
      <NucCard pad={14} style={{ borderLeft: `3px solid ${color}` }}>
        <div className="flex justify-between items-center gap-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.serif, fontSize: 17, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0, color: NUC.ink, marginBottom: 3 }}>{tData(ex.n)}</div>
            <div className="j-eyebrow" style={{ color: accentInkFor(color, dark) }}>{muscleLabel}</div>
            {ex.note && (
              <div style={{
                fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 4,
                lineHeight: 1.45, letterSpacing: 0.1,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {ex.note}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
            <div className="text-right">
              <div style={{ fontFamily: NUC.label, fontSize: 15, color: last ? NUC.accentSoft : NUC.faint, letterSpacing: -0.5 }}>
                {last ? fmtKg(last) : '—'}
              </div>
              {last && <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1, color: NUC.faint }}>{last.sets_n}×{fmtReps(last)}</div>}
            </div>
            <div style={{ color: NUC.faint, display: 'flex' }}><Icons.chev size={16} stroke={1.6}/></div>
          </div>
        </div>
      </NucCard>
    </div>
  )
}

// ── Traguardi ──────────────────────────────────────────────────
// Le medaglie sono DERIVATE dallo storico (vedi gymStrength): niente da salvare,
// niente da sincronizzare, e una medaglia non può mai contraddire i dati che la
// motivano. Quelle chiuse restano visibili in grigio — un traguardo che non si
// vede finché non lo centri non è un traguardo, è una sorpresa.
function AchievementsSection({ exercises, bodyWeight }: { exercises: PalestraExercise[]; bodyWeight: number }) {
  const t = useT()
  const list = useMemo(() => achievements(exercises, bodyWeight), [exercises, bodyWeight])
  const sbloccati = list.filter(a => a.unlockedAt !== null).length

  return (
    <>
      <NucEyebrow right={`${sbloccati}/${list.length}`}>{t('Traguardi')}</NucEyebrow>
      <div className="flex flex-col gap-1.5" style={{ marginBottom: 16 }}>
        {list.map(a => {
          const on = a.unlockedAt !== null
          return (
            <NucCard key={a.id} pad={14}>
              <div className="flex items-center gap-3.5">
                <div style={{
                  width: 52, height: 52, flexShrink: 0, borderRadius: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: on ? 'var(--surface-2)' : 'transparent',
                  border: `1px ${on ? 'solid' : 'dashed'} ${on ? 'var(--j-accent)' : 'var(--hairline)'}`,
                  // Chiusa: la coppa è una sagoma grigia, senza l'accent. È la
                  // differenza che si legge da lontano, prima ancora del testo.
                  color: on ? 'var(--j-accent-ink)' : 'var(--fg-mute)',
                }}>
                  <Icons.trophy size={28} stroke={on ? 1.5 : 1.3}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NUC.font, fontSize: 14, color: on ? NUC.ink : 'var(--fg-mute)' }}>{t(a.title)}</div>
                  <div style={{
                    fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.03em',
                    color: on ? 'var(--j-accent-ink)' : NUC.faint, marginTop: 4, lineHeight: 1.45,
                  }}>
                    {on ? t(a.phrase) : t(a.goal, a.goalVars)}
                  </div>
                  {on && a.unlockedAt && (
                    <div style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: NUC.faint, marginTop: 4 }}>
                      {fmtShortDate(a.unlockedAt)}
                    </div>
                  )}
                </div>
              </div>
            </NucCard>
          )
        })}
      </div>
    </>
  )
}

// ── Pagina grafici di un esercizio ─────────────────────────────
function ExerciseChartsPage({ ex, onBack, muscleColors }: {
  ex: PalestraExercise; onBack: () => void; muscleColors: Record<string, string>
}) {
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight()
  const dark = useIsDark()
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const color = exColor(ex, muscleColors)
  // Le ascisse sono il TEMPO: la data dell'alzata. Prima sotto ogni punto stava
  // il valore del punto stesso — il grafico ripeteva i propri numeri e non diceva
  // mai quando fossero stati fatti.
  // Giorno e mese, senza anno: la serie è cronologica, l'anno è ridondante e
  // costava tre caratteri per punto — cioè le date diradate una sì e due no.
  const { kgs, oneRMs, dates } = useMemo(() => ({
    kgs:    hist.map(h => effectiveLoad(h, bodyWeight)),
    oneRMs: hist.map(h => Math.round(entry1RM(h, bodyWeight))),
    dates:  hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])

  // I due grafici avevano l'accent e la sua variante soffusa: affiancati sulla
  // stessa pagina si leggevano come lo stesso colore. `--chart-2` è un token
  // pensato per restare distinto in tutti e cinque i temi.
  const charts = [
    {
      show: kgs.length >= 2, label: t('Carico (kg)'), info: undefined,
      sub: t('il peso sul bilanciere, sessione per sessione'),
      data: kgs, c: 'var(--j-accent)',
    },
    {
      show: oneRMs.length >= 2, label: t('Massimale stimato (kg)'), info: 'oneRM' as const,
      sub: t('quanto alzeresti per una singola: tiene conto anche dei colpi'),
      data: oneRMs, c: 'var(--chart-2)',
    },
  ]
  const any = charts.some(c => c.show)

  // Miglior alzata = massimale stimato più alto: kg e colpi finiscono nello stesso
  // numero, così 50×8 e 40×15 sono confrontabili. A parità vince la più recente,
  // perché `hist` è ordinato per data e il `>=` tiene l'ultima.
  const best = hist.length
    ? hist.reduce((b, h) => entry1RM(h, bodyWeight) >= entry1RM(b, bodyWeight) ? h : b)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden j-page-in">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0 }}><BookmarkRibbon color={color}/></div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back"><Icons.chevL size={16} stroke={2}/></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.15, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{t('Scopri di più')} · {t('{n} sessioni', { n: hist.length })}</div>
          </div>
        </div>
      </div>
      <div className="j-scroll-area">
        {/* La miglior alzata sta qui e non nel dettaglio. Lì occupava la prima
            schermata con un numero che non cambia quasi mai, e spingeva sotto la
            piega lo storico — che è la cosa che si viene a vedere. Qui è in casa
            sua: questa pagina risponde a "come sto andando", e il record è la
            prima riga di quella risposta. */}
        <NucCard pad={14} style={{ marginBottom: 22 }}>
          <NucEyebrow info="bestLift" style={{ marginBottom: 7 }}>{t('Miglior alzata')}</NucEyebrow>
          {best ? (
            <>
              <div style={{ fontFamily: NUC.label, fontSize: 22, color: NUC.accentSoft, letterSpacing: -0.5, lineHeight: 1 }}>
                {best.sets_n}×{fmtReps(best)} – {fmtKg(best)}
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.4, marginTop: 7 }}>
                {best.maxLift ? t('Massimale') : t('Massimale stimato')} {Math.round(entry1RM(best, bodyWeight))} kg · {hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}
                {best.date ? ` · ${fmtShortDate(best.date)}` : ''}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: NUC.label, fontSize: 16, color: NUC.faint }}>{t('Nessuna alzata registrata')}</div>
          )}
        </NucCard>

        {!any && <div className="j-empty">{t('Servono almeno 2 sessioni per visualizzare i grafici')}</div>}
        {charts.filter(c => c.show).map(c => (
          <div key={c.label} style={{ marginBottom: 22 }}>
            <NucEyebrow info={c.info}>{c.label}</NucEyebrow>
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.3, marginTop: -4, marginBottom: 8, paddingLeft: 2 }}>{c.sub}</div>
            <NucCard pad={14}>
              <LineChart data={c.data} labels={dates} pointLabels={c.data.map(String)} height={180} color={c.c} labelSize={11} yAxis/>
            </NucCard>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Pagina dettaglio esercizio (storico, PR, azioni) ───────────
function ExerciseDetail({ ex, onBack, onLog, onUpdate, onDelete, onOpenCharts, muscleColors, onSaveMuscleColor, noteCoach = [] }: {
  ex: PalestraExercise; onBack: () => void; onLog: () => void
  onUpdate: (changes: Partial<PalestraExercise>) => void
  onDelete: () => void
  onOpenCharts: () => void
  /** Le note che gli allenatori hanno scritto su QUESTO esercizio. */
  noteCoach?: NotaCoach[]
  muscleColors: Record<string, string>
  onSaveMuscleColor: (muscle: string, color: string | undefined) => void
}) {
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight()
  const dark = useIsDark()
  // Ordinato per data: lo storico viene letto E riscritto da questa vista, quindi
  // l'ordinamento si normalizza anche su disco e gli indici restano coerenti.
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const [histOpen, setHistOpen] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [editHistEntry, setEditHistEntry] = useState<{ entry: PalestraHistoryEntry; idx: number } | null>(null)
  const { confirmDelete } = useConfirmDelete()
  const color = exColor(ex, muscleColors)

  // `current` è il prefill dei prossimi log: dopo aver cancellato o modificato
  // l'ultima sessione restava sui valori vecchi (o su quelli appena eliminati).
  const withCurrent = (history: PalestraHistoryEntry[]) => {
    const last = history[history.length - 1]
    return last
      ? { history, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
      : { history }
  }

  const deleteHistEntry = (idx: number) => {
    onUpdate(withCurrent(hist.filter((_, i) => i !== idx)))
  }

  // Ricominciare da zero senza perdere l'esercizio: dopo uno stop lungo, o un
  // cambio di esecuzione, lo storico vecchio falsa massimale e miglior alzata, ma
  // cancellarlo alzata per alzata voleva dire una conferma per riga e alla fine
  // restava comunque da ricreare l'esercizio. `current` torna vuoto, così il
  // prossimo log non parte pre-compilato sui carichi di prima.
  const clearHistory = () => confirmDelete(
    () => onUpdate({ history: [], current: { kg: 0, reps: 0, sets_n: 0 } }),
    ex.n,
    {
      eyebrow: t('Svuota memoria'),
      title: t('Azzerare lo storico?'),
      body: t('Cancelli tutte le {n} alzate di “{nome}”. L’esercizio resta, con il suo nome, il gruppo muscolare e il colore: riparti da zero. L’azione è definitiva.', { n: hist.length, nome: tData(ex.n) }),
      cta: t('Sì, azzera'),
    },
  )

  const { kgs, kgLabels } = useMemo(() => ({
    kgs: hist.map(h => effectiveLoad(h, bodyWeight)),
    kgLabels: hist.map(h => h.date ? fmtDayMonth(h.date) : h.d),
  }), [hist, bodyWeight])

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden j-page-in">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0 }}><BookmarkRibbon color={color}/></div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back">
            <Icons.chevL size={16} stroke={2}/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{ex.muscle2 ? `${tData(displayMuscle(ex.muscle))} · ${tData(displayMuscle(ex.muscle2))}` : tData(displayMuscle(ex.muscle))}</div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button onClick={() => setShowEdit(true)} style={{
              width: 34, height: 34, borderRadius: 0,
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              color: NUC.faint, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icons.pencil size={14} stroke={1.8}/>
            </button>
            <button onClick={() => confirmDelete(onDelete, ex.n)} style={{
              width: 34, height: 34, borderRadius: 0,
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
              color: 'var(--danger)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.trash size={14} stroke={1.6}/></button>
          </div>
        </div>
      </div>

      <div className="j-scroll-area">
        {/* I due comandi, uno sopra l'altro e larghi uguale. Il reset era un
            quadrato di fianco al CTA: stessa altezza e stesso rosso di un tasto
            primario per un'azione che si fa una volta l'anno. Sotto e basso un
            terzo pesa quanto deve — si trova quando lo si cerca, non si preme per
            sbaglio al posto di "Nuova alzata". */}
        <button onClick={onLog} className="j-btn-accent" style={{ width: '100%', marginBottom: hist.length > 0 ? 6 : 16 }}>
          <Icons.plus size={16} stroke={2}/> {t('Nuova alzata')}
        </button>
        {hist.length > 0 && (
          <button onClick={clearHistory} title={t('Svuota lo storico, tieni l’esercizio')} aria-label={t('Reset alzate')} className="j-hard j-hard-sm" style={{
            width: '100%', height: 16, marginBottom: 16, borderRadius: 0,
            background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.25)',
            color: 'var(--danger)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: NUC.label, fontSize: 9, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
            padding: 0,
          }}>
            <Icons.refresh size={10} stroke={2}/> {t('Reset alzate')}
          </button>
        )}

        <button onClick={() => setHistOpen(o => !o)} className="w-full flex items-center justify-between px-0.5 bg-transparent border-none cursor-pointer" style={{ marginBottom: histOpen ? 10 : 16 }}>
          <div className="j-eyebrow">{t('Storico')}</div>
          <div className="flex items-center gap-1.5">
            <div className="j-eyebrow">{hist.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: hist.length })}</div>
            <div style={{ color: NUC.faint, transform: histOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <Icons.chev size={12} stroke={2}/>
            </div>
          </div>
        </button>

        {histOpen && hist.length === 0 && <div className="j-empty">{t('Nessuna sessione registrata')}</div>}

        {histOpen && [...hist].reverse().map((h, i) => {
          const realIdx = hist.length - 1 - i
          const techLabels = (h.techniques ?? []).map(tec => t(TECHNIQUE_LABELS[tec])).join(' · ')
          const dateStr = h.date ? fmtShortDate(h.date) : h.d
          return (
            <div key={i} className="flex items-center gap-2 py-2.5" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: NUC.ink, letterSpacing: -0.2 }}>
                  {h.sets_n} × {fmtReps(h)} – {fmtKg(h)}
                </div>
                <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{dateStr}</div>
                {h.maxLift && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>{t('Massimale')}</div>}
                {techLabels && <div style={{ fontFamily: NUC.label, fontSize: 10, color: 'var(--j-accent-ink)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>{techLabels}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                {/* `--j-accent-ink` e non `NUC.accentSoft`: quest'ultimo è tarato per
                    stare SU una superficie accent, e come testo sulla carta si ferma
                    a 4.0:1 — sotto AA. Il token "da testo" è AA per costruzione. */}
                <div style={{ fontFamily: NUC.label, fontSize: 13, color: 'var(--j-accent-ink)', letterSpacing: -0.3 }}>{Math.round(entry1RM(h, bodyWeight))}</div>
                {/* Su un massimale non è una stima: dirlo "stim." lo svaluterebbe. */}
                <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.5 }}>{h.maxLift ? 'kg' : t('kg stim.')}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditHistEntry({ entry: h, idx: realIdx })} style={{
                  width: 26, height: 26, borderRadius: 0, flexShrink: 0,
                  background: 'var(--surface)', border: '1px solid var(--hairline)',
                  color: NUC.faint, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icons.pencil size={10} stroke={1.8}/>
                </button>
                <button onClick={() => confirmDelete(() => deleteHistEntry(realIdx), t('Alzata'))} style={{
                  width: 26, height: 26, borderRadius: 0, flexShrink: 0,
                  background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
                  color: 'var(--danger)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icons.trash size={11} stroke={1.6}/></button>
              </div>
            </div>
          )
        })}

        {kgs.length >= 2 ? (
          <div onClick={onOpenCharts} style={{ cursor: 'pointer' }}>
            {/* "tutti i grafici" era un testo grigio da 10px accanto al titolo:
                si leggeva come una didascalia, non come la porta d'ingresso agli
                altri grafici, e chi non ci provava per caso non scopriva mai che
                il grafico si apre. Adesso ha il bordo e il colore dei controlli —
                le stesse due cose per cui il "peso diverso per serie" era stato
                riquadrato — e il corpo cresce quanto basta a farlo notare senza
                che rubi la scena al titolo di sezione. */}
            <NucEyebrow right={
              <span className="j-hard j-hard-sm" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px',
                background: 'var(--surface)', border: '1px solid var(--fg-mute)',
                borderRadius: 0, cursor: 'pointer',
                fontFamily: NUC.label, fontSize: 11, fontWeight: 500,
                letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--j-accent-ink)',
              }}>
                {t('Scopri di più')} <Icons.chev size={12} stroke={2.2}/>
              </span>
            }>{t('Carico (kg)')}</NucEyebrow>
            <NucCard pad={12} style={{ marginBottom: 12 }}>
              <LineChart data={kgs} labels={kgLabels} height={96} color="var(--j-accent)" yAxis labelSize={9}/>
            </NucCard>
          </div>
        ) : (
          hist.length > 0 && <div className="j-empty" style={{ marginTop: 4 }}>{t('Registra almeno 2 alzate per vedere i grafici')}</div>
        )}

        <NoteEsercizio
          nota={ex.note ?? ''}
          onSalva={nota => onUpdate({ note: nota || undefined })}
          daCoach={noteCoach}
        />
      </div>
    </div>
    <EditExModal open={showEdit} onClose={() => setShowEdit(false)} ex={ex} onSave={onUpdate} onSaveMuscleColor={onSaveMuscleColor}/>
    {editHistEntry && (
      <EditHistoryModal
        entry={editHistEntry.entry}
        onClose={() => setEditHistEntry(null)}
        onSave={updated => {
          const newHist = sortedHistory(hist.map((h, i) => i === editHistEntry.idx ? updated : h))
          onUpdate(withCurrent(newHist))
          setEditHistEntry(null)
        }}
      />
    )}
    </>
  )
}

// Le note dell'esercizio: l'appunto che si tiene per sé — la posizione del
// sedile, la presa, "scendere lento". Stava nell'intestazione, minuscolo e in
// sola lettura: si vedeva ma non si poteva scrivere se non entrando in modifica
// esercizio, cioè nel posto dove si cambia il nome.
//
// Salva quando il campo perde il fuoco e non a ogni tasto: un appunto si scrive
// tutto d'un fiato, e salvare a ogni lettera vorrebbe dire un giro di sync per
// carattere battuto.
function NoteEsercizio({ nota, onSalva, daCoach = [] }: {
  nota: string
  onSalva: (n: string) => void
  /** Quelle dell'allenatore: si leggono, non si scrivono. */
  daCoach?: NotaCoach[]
}) {
  const t = useT()
  const [testo, setTesto] = useState(nota)
  // Se la nota cambia da fuori (modifica esercizio, sync dal cloud) il campo la
  // segue — ma solo quando non lo si sta scrivendo, altrimenti il salvataggio
  // remoto cancellerebbe la frase a metà.
  const [attivo, setAttivo] = useState(false)
  useEffect(() => { if (!attivo) setTesto(nota) }, [nota, attivo])

  // Due colonne sulla stessa riga quando c'è anche l'allenatore: sono due voci
  // diverse sullo stesso esercizio, e affiancate si legge subito chi ha detto
  // cosa. Da soli, i propri appunti prendono tutta la larghezza — metà riga
  // vuota accanto direbbe che manca qualcosa.
  const conCoach = daCoach.length > 0

  return (
    <div style={{ marginTop: 4 }}>
      <NucEyebrow>{t('Note')}</NucEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: conCoach ? '1fr 1fr' : '1fr', gap: 10, alignItems: 'start' }}>
        <div>
          {conCoach && (
            <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: NUC.faint, marginBottom: 5 }}>
              {t('Le tue')}
            </div>
          )}
          <textarea
            value={testo}
            onChange={e => setTesto(e.target.value)}
            onFocus={() => setAttivo(true)}
            onBlur={() => { setAttivo(false); if (testo !== nota) onSalva(testo.trim()) }}
            placeholder={t('Un promemoria per la prossima volta: presa, sedile, tempi…')}
            aria-label={t('Note dell’esercizio')}
            rows={3}
            className="j-field"
            style={{
              width: '100%', height: 'auto', minHeight: 76, padding: '10px 12px',
              resize: 'vertical', lineHeight: 1.5, fontSize: 14,
              fontFamily: NUC.font,
            }}
          />
        </div>

        {daCoach.map(n => (
          <div key={n.coach_id}>
            <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--j-accent-ink)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.coach_name?.trim() || t('Allenatore')}
            </div>
            {/* Non è un campo: è la voce di qualcun altro. Il fondo acceso e il
                bordo accent lo dicono senza doverlo scrivere. */}
            <div style={{
              minHeight: 76, padding: '10px 12px', boxSizing: 'border-box',
              background: 'color-mix(in srgb, var(--j-accent) 7%, var(--surface))',
              border: '1px solid var(--j-accent)',
              fontFamily: NUC.font, fontSize: 14, lineHeight: 1.5,
              color: NUC.ink, whiteSpace: 'pre-wrap',
            }}>{n.nota}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Come si guardano gli esercizi di un gruppo ─────────────────
type VistaEsercizi = 'elenco' | 'griglia'
const VISTA_KEY = 'jarvis-vista-esercizi'

// In localStorage e non nello store: è una preferenza del dispositivo, come
// l'ordine dei widget della home. Su un telefono si scorre un elenco, su un
// desktop si abbraccia una griglia, e portarsi la scelta dall'uno all'altro
// sarebbe un dispetto invece che una comodità.
function useVistaEsercizi(): [VistaEsercizi, (v: VistaEsercizi) => void] {
  const [vista, setVista] = useState<VistaEsercizi>(
    () => readStorage('local', VISTA_KEY) === 'griglia' ? 'griglia' : 'elenco',
  )
  const cambia = (v: VistaEsercizi) => { setVista(v); writeStorage('local', VISTA_KEY, v) }
  return [vista, cambia]
}

// L'interruttore fra le due viste: due icone, non due parole. Sta nell'occhiello
// di sezione, dove ci sono già gli altri interruttori dell'app.
function VistaSwitch({ valore, onChange }: { valore: VistaEsercizi; onChange: (v: VistaEsercizi) => void }) {
  const t = useT()
  const cella = (v: VistaEsercizi, etichetta: string, icona: JSX.Element) => {
    const on = v === valore
    return (
      <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={on} aria-label={etichetta} style={{
        width: 28, height: 24, borderRadius: 0, padding: 0,
        background: on ? 'var(--surface)' : 'transparent',
        border: `1px solid ${on ? 'var(--j-accent)' : 'transparent'}`,
        color: on ? 'var(--j-accent-ink)' : NUC.faint,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 180ms',
      }}>{icona}</button>
    )
  }
  return (
    <div style={{ display: 'flex', border: '1px solid var(--hairline)', background: 'var(--surface-2)' }}>
      {cella('elenco',  t('Vedi in elenco'),  <Icons.list size={13} stroke={1.9}/>)}
      {cella('griglia', t('Vedi in griglia'), <Icons.grid size={13} stroke={1.9}/>)}
    </div>
  )
}

// Elenco: le righe unite in una scheda sola, come i gruppi muscolari. Erano card
// staccate con un margine fra l'una e l'altra, e sei esercizi occupavano lo
// schermo che ne basta a dodici.
function ElencoEsercizi({ esercizi, color, onApri }: {
  esercizi: PalestraExercise[]; color: string; onApri: (ex: PalestraExercise) => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div className="j-hard-flat" style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 0, overflow: 'hidden',
    }}>
      {esercizi.map((ex, i) => {
        const hist = sortedHistory(ex.history)
        const last = hist[hist.length - 1]
        return (
          <button
            key={ex.id}
            onClick={() => onApri(ex)}
            className="j-rise-in flex items-center gap-3 w-full j-riga-gruppo"
            style={{
              animationDelay: `${Math.min(i * 35, 300)}ms`,
              padding: '11px 12px', borderRadius: 0, textAlign: 'left', cursor: 'pointer',
              background: 'transparent', border: 'none',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.serif, fontSize: 15, fontWeight: 500, color: NUC.ink, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, marginTop: 2 }}>
                {last ? `${last.sets_n}×${fmtReps(last)} · ${fmtKg(last)}` : t('Nessuna alzata')}
              </div>
            </div>
            <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={16} stroke={1.6}/></div>
          </button>
        )
      })}
    </div>
  )
}

// Griglia: una card per esercizio, con una fascia illustrata in cima e il testo
// sotto sulla carta — la forma della scheda di un catalogo.
//
// Nella fascia va la foto dell'esercizio, quando ce l'ha (vedi eserciziFoto.ts:
// il file si chiama come l'esercizio, la cartella è src/assets/esercizi). Chi non
// ce l'ha tiene il disegno del gruppo muscolare, ed è per questo che il disegno
// non se ne va: è l'unica figura che l'app può garantire per OGNI esercizio,
// compreso quello che uno si inventa stasera e che nessuna fotografia può
// coprire in anticipo.
//
// Il giro precedente di foto era stato tolto proprio qui (la nota è in
// catalogo.ts): venivano da un dataset che copriva trentasette esercizi su una
// lista che cresce, e la griglia restava metà fotografica e metà disegnata senza
// una regola visibile. Foto scattate nella palestra di chi usa l'app cambiano il
// conto: coprono TUTTO il catalogo di partenza, e il disegno resta solo dove
// significa qualcosa — "questo esercizio te lo sei aggiunto tu".
function GrigliaEsercizi({ esercizi, color, onApri }: {
  esercizi: PalestraExercise[]; color: string; onApri: (ex: PalestraExercise) => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 10 }}>
      {esercizi.map((ex, i) => {
        const hist = sortedHistory(ex.history)
        const last = hist[hist.length - 1]
        const foto = fotoEsercizio(ex.n)
        return (
          <button
            key={ex.id}
            onClick={() => onApri(ex)}
            className="j-hard j-rise-in"
            style={{
              animationDelay: `${Math.min(i * 35, 300)}ms`,
              minWidth: 0, borderRadius: 0, cursor: 'pointer', overflow: 'hidden',
              background: 'var(--surface)', border: '1px solid var(--hairline)',
              borderLeft: `3px solid ${color}`,
              padding: 0, display: 'flex', flexDirection: 'column', textAlign: 'left',
            }}
          >
            <div style={{
              width: '100%', aspectRatio: '1 / 1', minHeight: 0,
              background: 'var(--surface-2)', borderBottom: '1px solid var(--hairline)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color, flexShrink: 0,
            }}>
              {foto
                // alt vuoto di proposito: il nome dell'esercizio è scritto qui
                // sotto: con l'alt pieno chi usa il lettore di schermo se lo
                // sentirebbe due volte di fila.
                ? <img src={foto} alt="" loading="lazy" decoding="async"
                       style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
                : <MuscleIcon muscle={ex.muscle} size={52} stroke={1.5}/>}
            </div>
            <div style={{ padding: '8px 9px 9px', minWidth: 0, width: '100%' }}>
              <div style={{
                fontFamily: NUC.serif, fontSize: 12.5, fontWeight: 500, color: NUC.ink,
                lineHeight: 1.15,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 9, letterSpacing: '.06em', color: NUC.faint, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {last ? fmtKg(last) : t('Mai allenato')}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Elenco dei gruppi muscolari ─────────────────────────
// Una scheda sola con dentro tutti i gruppi, non otto card staccate.
// Erano due componenti diversi — una griglia di quadrati su desktop, righe
// distanziate su telefono — e in entrambi i casi otto rettangoli separati
// occupavano uno schermo e mezzo per dire una cosa che è un elenco. Uniti in un
// blocco si leggono in un colpo d'occhio, e la distinzione fra i gruppi la fa
// quello che già la faceva: il colore, l'icona, il nome.
//
// L'ombra sta sulla SCHEDA e non sulle righe: dentro un contenitore che è già
// sollevato, otto rilievi in fila si annullerebbero a vicenda. Alla riga il tocco
// lo segnala il fondo, che cambia sotto il dito.
function ElencoGruppi({ gruppi, muscleColors, onApri }: {
  gruppi: Array<{ muscle: string; items: PalestraExercise[] }>
  muscleColors: Record<string, string>
  onApri: (muscle: string) => void
}) {
  const t = useT()
  const tData = useTData()
  return (
    <div className="j-hard-flat" style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 0,
      overflow: 'hidden',
    }}>
      {gruppi.map(({ muscle, items }, i) => {
        const color = muscleColors[muscle] ?? muscleColors.Altro
        return (
          <button
            key={muscle}
            onClick={() => onApri(muscle)}
            className="j-rise-in flex items-center gap-3 w-full j-riga-gruppo"
            style={{
              animationDelay: `${Math.min(i * 40, 320)}ms`,
              padding: '11px 12px', borderRadius: 0, textAlign: 'left', cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              borderTop: i === 0 ? 'none' : '1px solid var(--hairline-soft)',
              // Il filetto colorato è ciò che resta della card di prima: è lui a
              // dire di che gruppo si tratta prima ancora che si legga il nome.
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div style={{ color, display: 'flex', flexShrink: 0 }}>
              <MuscleIcon muscle={muscle} size={36} stroke={1.5}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.serif, fontSize: 15, fontWeight: 500, color: NUC.ink, textTransform: 'uppercase', letterSpacing: '.01em', lineHeight: 1.1 }}>{tData(muscle)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 8.5, letterSpacing: '.08em', color: NUC.faint, marginTop: 2, textTransform: 'uppercase' }}>
                {items.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: items.length })}
              </div>
            </div>
            <div style={{ color: NUC.faint, display: 'flex', flexShrink: 0 }}><Icons.chev size={16} stroke={1.6}/></div>
          </button>
        )
      })}
    </div>
  )
}

// ── Pagina di un gruppo muscolare (i suoi esercizi) ────────────
function MuscleDetailPage({ muscle, color, exercises, onBack, onSelectExercise, onAddExercise }: {
  muscle: string; color: string; exercises: PalestraExercise[]
  onBack: () => void
  onSelectExercise: (ex: PalestraExercise) => void
  onAddExercise: () => void
}) {
  const t = useT()
  const tData = useTData()
  const dark = useIsDark()
  // Elenco o griglia. La scelta resta in localStorage e non nello store cloud: è
  // il modo in cui si guarda una lista su QUESTO schermo — sul telefono si scorre,
  // sul desktop si abbraccia — non un dato da portarsi dietro fra dispositivi.
  const [vista, setVista] = useVistaEsercizi()
  return (
    <div className="flex flex-col h-full overflow-hidden j-page-in">
      <div className="px-5 pt-6 pb-4 flex-shrink-0" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0 }}><BookmarkRibbon color={color}/></div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back"><Icons.chevL size={16} stroke={2}/></button>
          <div style={{ color, display: 'flex', flexShrink: 0 }}>
            <MuscleIcon muscle={muscle} size={34} stroke={1.6}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.serif, fontSize: 24, fontWeight: 500, color: NUC.ink, textTransform: 'uppercase', letterSpacing: '.02em', lineHeight: 1.1 }}>{tData(muscle)}</div>
            <div className="j-eyebrow mt-0.5" style={{ color: accentInkFor(color, dark) }}>{exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: exercises.length })}</div>
          </div>
          <button onClick={onAddExercise} className="j-btn-add">
            <Icons.plus size={18} stroke={2}/>
          </button>
        </div>
      </div>
      <div className="j-scroll-area">
        {exercises.length === 0 ? (
          <div className="j-empty">{t('Nessun esercizio in {gruppo} — aggiungine uno con +', { gruppo: tData(muscle) })}</div>
        ) : (
          <>
            <NucEyebrow right={<VistaSwitch valore={vista} onChange={setVista}/>}>
              {exercises.length === 1 ? t('1 esercizio') : t('{n} esercizi', { n: exercises.length })}
            </NucEyebrow>
            {vista === 'elenco'
              ? <ElencoEsercizi esercizi={exercises} color={color} onApri={onSelectExercise}/>
              : <GrigliaEsercizi esercizi={exercises} color={color} onApri={onSelectExercise}/>}
          </>
        )}
      </div>
    </div>
  )
}

export function JarvisGym() {
  // Selettori granulari: ri-render solo al cambio dei campi palestra usati.
  const s = useJarvisStore(useShallow(st => ({
    hyroxExercises: st.hyroxExercises,
    palestraExercises: st.palestraExercises,
    muscleColors: st.muscleColors,
  })))
  const set = useJarvisStore.setState
  const t = useT()
  const tData = useTData()
  const bodyWeight = useBodyWeight()
  const { confirmDelete } = useConfirmDelete()
  // `tab` è il mondo in cui si sta (pesi o hyrox), `stats` e `ricerca` sono due
  // viste che ci si aprono sopra. Prima era un'enum sola, e per questo "Stats"
  // doveva per forza essere un terzo tab: entrarci significava USCIRE da pesi.
  const [tab, setTab] = useState<'palestra' | 'hyrox'>('palestra')
  const [stats, setStats] = useState(false)
  const [ricerca, setRicerca] = useState(false)
  const mode: GymMode = stats ? 'stats' : tab
  const [hyroxSubTab, setHyroxSubTab] = useState<'gara' | 'esercizi'>('esercizi')
  const [logHyrox, setLogHyrox] = useState<HyroxExercise | null>(null)
  const [logPalestra, setLogPalestra] = useState<PalestraExercise | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<PalestraExercise | null>(null)
  const [showExerciseCharts, setShowExerciseCharts] = useState(false)
  // Le note che un allenatore ha scritto sui miei esercizi. Come le schede
  // assegnate: vivono in una tabella a parte, non nel blob, e se la tabella non
  // c'è ancora o la rete non risponde la schermata resta quella di sempre.
  const [noteCoach, setNoteCoach] = useState<NotaCoach[]>([])
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession()
      .then(({ data }) => data.session ? noteRicevute(data.session.user.id) : [])
      .then(n => { if (vivo) setNoteCoach(n) })
      .catch(() => { /* nessuna nota: è il caso normale */ })
    return () => { vivo = false }
  }, [])
  const [selectedHyrox, setSelectedHyrox] = useState<HyroxExercise | null>(null)
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSchede, setShowSchede] = useState(false)

  // Mappa risolta (default + override utente, desaturata in layout "Notte"). Il picker
  // di EditExModal riceve invece `s.muscleColors` raw: vedi sotto.
  const muscleColors = useMuscleColors()

  const saveMuscleColor = (muscle: string, color: string | undefined) => {
    set(st => {
      const mc = { ...(st.muscleColors ?? {}) }
      if (color) mc[muscle] = color
      else delete mc[muscle]
      return { muscleColors: mc }
    })
  }

  const saveHyroxEntry = (ex: HyroxExercise, entry: HyroxHistoryEntry) => {
    // Inserimento ordinato: il form consente una data arretrata, che accodata
    // sarebbe letta come la sessione più recente.
    const updated = { ...ex, history: sortedHistory([...ex.history, entry]) }
    set(st => ({
      hyroxExercises: st.hyroxExercises.some(e => e.id === ex.id)
        ? st.hyroxExercises.map(e => e.id === ex.id ? updated : e)
        : [...st.hyroxExercises, updated],
    }))
    if (selectedHyrox?.id === ex.id) setSelectedHyrox(updated)
  }

  const updateHyroxExercise = (ex: HyroxExercise, changes: Partial<HyroxExercise>) => {
    const updated = { ...ex, ...changes }
    set(st => ({
      hyroxExercises: st.hyroxExercises.some(e => e.id === ex.id)
        ? st.hyroxExercises.map(e => e.id === ex.id ? updated : e)
        : [...st.hyroxExercises, updated],
    }))
    if (selectedHyrox?.id === ex.id) setSelectedHyrox(updated)
  }

  const deleteHyroxExercise = (ex: HyroxExercise) => {
    set(st => ({ hyroxExercises: st.hyroxExercises.filter(e => e.id !== ex.id) }))
    setSelectedHyrox(null)
  }

  const savePalestraEntry = (ex: PalestraExercise, entry: PalestraHistoryEntry) => {
    // Il confronto va fatto PRIMA di scrivere: dopo, l'alzata appena salvata
    // starebbe già nello storico e batterebbe sempre sé stessa.
    const rec = recordFor(ex.history, entry, bodyWeight)
    if (rec) setRecords([{ name: ex.n, ...rec }])

    // Storico ordinato per data e `current` preso dalla sessione più RECENTE, non
    // da quella appena inserita: registrando una serie arretrata, il prefill dei
    // prossimi log non deve tornare indietro.
    const merge = (history: PalestraHistoryEntry[]) => {
      const sorted = sortedHistory([...history, entry])
      const last = sorted[sorted.length - 1]
      return { history: sorted, current: { kg: last.kg, reps: last.reps, sets_n: last.sets_n } }
    }
    set(st => ({ palestraExercises: st.palestraExercises.map(e =>
      e.id === ex.id ? { ...e, ...merge(e.history) } : e
    )}))
    if (selectedExercise?.id === ex.id) {
      setSelectedExercise(prev => prev ? { ...prev, ...merge(prev.history) } : null)
    }
  }

  const updatePalestraExercise = (ex: PalestraExercise, changes: Partial<PalestraExercise>) => {
    const updated = { ...ex, ...changes }
    set(st => ({ palestraExercises: st.palestraExercises.map(e => e.id === ex.id ? updated : e) }))
    setSelectedExercise(updated)
  }

  const deletePalestraExercise = (ex: PalestraExercise) => {
    set(st => ({ palestraExercises: st.palestraExercises.filter(e => e.id !== ex.id) }))
    setSelectedExercise(null)
  }

  const addExercise = (ex: HyroxExercise | PalestraExercise) => {
    if (mode === 'hyrox') {
      set(st => ({ hyroxExercises: [...st.hyroxExercises, ex as HyroxExercise] }))
    } else {
      set(st => ({ palestraExercises: [...st.palestraExercises, ex as PalestraExercise] }))
    }
  }

  const filteredPalestra = useMemo(() => {
    let list = s.palestraExercises
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(e =>
        e.n.toLowerCase().includes(q) ||
        e.muscle.toLowerCase().includes(q) ||
        (e.muscle2 ?? '').toLowerCase().includes(q)
      )
    }
    if (muscleFilter) list = list.filter(e => displayMuscle(e.muscle) === muscleFilter)
    return list
  }, [s.palestraExercises, muscleFilter, searchQuery])

  // Group filtered exercises by muscle for the collapsible accordion view
  const hasAny = s.palestraExercises.length > 0
  const groupedPalestra = useMemo(() => {
    const groups: Record<string, PalestraExercise[]> = {}
    // Seed con tutti i gruppi muscolari standard: così ogni account (anche
    // nuovo, senza esercizi) trova già tutte le card — seppur vuote — e
    // capisce subito a cosa serve la sezione.
    for (const m of MUSCLE_OPTIONS) groups[m] = []
    for (const ex of filteredPalestra) {
      const m = displayMuscle(ex.muscle)
      ;(groups[m] ??= []).push(ex)
    }
    const ordered = Object.keys(groups)
      .sort((a, b) => {
        const ia = MUSCLE_OPTIONS.indexOf(a), ib = MUSCLE_OPTIONS.indexOf(b)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
      })
      .map(m => ({ muscle: m, items: groups[m] }))
    // Un gruppo vuoto ("Altro · 0 esercizi") occupa una riga per dire niente. Le
    // card vuote restano solo all'utente nuovo, dove sono l'onboarding di cui sopra.
    return hasAny ? ordered.filter(g => g.items.length > 0) : ordered
  }, [filteredPalestra, hasAny])

  const raceStationData = useMemo<HyroxExercise[]>(() =>
    RACE_STATIONS.map(rs => ({
      ...rs,
      history: s.hyroxExercises.find(e => e.id === rs.id)?.history ?? [],
    })),
    [s.hyroxExercises]
  )
  const runStationData = useMemo<HyroxExercise>(() => ({
    ...RUNNING_STATION,
    history: s.hyroxExercises.find(e => e.id === RUNNING_STATION.id)?.history ?? [],
  }), [s.hyroxExercises])

  const customHyrox = useMemo(() =>
    s.hyroxExercises.filter(e => !RACE_IDS.has(e.id)),
    [s.hyroxExercises]
  )

  // Gli esercizi hyrox filtrati dalla stessa ricerca: la card "Cerca" sta sotto i
  // tab, quindi è accesa anche su Hyrox, e un campo che non trova niente è peggio
  // di un campo che non c'è.
  // Quanti esercizi del catalogo non ci sono ancora. Si ricalcola dallo store, non
  // da un flag "catalogo importato": chi ne cancella uno lo rivede offerto, che è
  // ciò che ci si aspetta da una riga che dice "ne mancano N".
  const mancanti = useMemo(() => esercizidaCatalogo(s.palestraExercises).length, [s.palestraExercises])
  const aggiungiCatalogo = () =>
    set(st => ({ palestraExercises: [...st.palestraExercises, ...esercizidaCatalogo(st.palestraExercises)] }))

  const filteredHyrox = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return [runStationData, ...raceStationData, ...customHyrox].filter(e => e.n.toLowerCase().includes(q))
  }, [searchQuery, runStationData, raceStationData, customHyrox])

  // Modali di log/aggiunta: uno solo per tipo, condiviso da tutti i rami di render
  // sotto. Erano ricopiati in ognuno — quattro punti da tenere allineati a mano per
  // modali che sono comunque chiusi finché il loro stato è null.
  // `presetMuscle` fa partire "Nuovo esercizio" già sul gruppo aperto, se c'è.
  const modals = (
    <>
      <LogHyroxModal
        open={!!logHyrox} onClose={() => setLogHyrox(null)}
        ex={logHyrox}
        onSave={entry => logHyrox && saveHyroxEntry(logHyrox, entry)}
      />
      <LogPalestraModal
        open={!!logPalestra} onClose={() => setLogPalestra(null)}
        ex={logPalestra}
        onSave={entry => logPalestra && savePalestraEntry(logPalestra, entry)}
      />
      <AddExModal
        open={showAdd} onClose={() => setShowAdd(false)}
        mode={mode === 'stats' ? 'palestra' : mode} onAdd={addExercise}
        presetMuscle={selectedMuscle ?? undefined}
      />
      <RecordModal records={records} onClose={() => setRecords([])}/>
    </>
  )

  if (showSchede) {
    return <GymSchede onBack={() => setShowSchede(false)}/>
  }

  if (selectedHyrox) {
    const isRace = RACE_IDS.has(selectedHyrox.id)
    return (
      <>
        <HyroxDetail
          ex={selectedHyrox}
          onBack={() => setSelectedHyrox(null)}
          onLog={() => setLogHyrox(selectedHyrox)}
          isRace={isRace}
          onDelete={isRace ? undefined : () => deleteHyroxExercise(selectedHyrox)}
          onUpdate={changes => updateHyroxExercise(selectedHyrox, changes)}
        />
        {modals}
      </>
    )
  }

  if (selectedExercise && showExerciseCharts) {
    return (
      <ExerciseChartsPage
        ex={selectedExercise}
        onBack={() => setShowExerciseCharts(false)}
        muscleColors={muscleColors}
      />
    )
  }

  if (selectedExercise) {
    return (
      <>
        <ExerciseDetail
          ex={selectedExercise}
          onBack={() => { setSelectedExercise(null); setShowExerciseCharts(false) }}
          onLog={() => { setLogPalestra(selectedExercise); fireCoach('addLift') }}
          onUpdate={changes => updatePalestraExercise(selectedExercise, changes)}
          onDelete={() => deletePalestraExercise(selectedExercise)}
          onOpenCharts={() => { setShowExerciseCharts(true); fireCoach('charts') }}
          noteCoach={noteCoach.filter(n => n.exercise_id === selectedExercise.id)}
          muscleColors={muscleColors}
          onSaveMuscleColor={saveMuscleColor}
        />
        {modals}
      </>
    )
  }

  if (selectedMuscle) {
    const muscleExercises = s.palestraExercises.filter(e => displayMuscle(e.muscle) === selectedMuscle)
    const mColor = muscleColors[selectedMuscle] ?? muscleColors.Altro
    return (
      <>
        <MuscleDetailPage
          muscle={selectedMuscle}
          color={mColor}
          exercises={muscleExercises}
          onBack={() => setSelectedMuscle(null)}
          onSelectExercise={ex => { setSelectedExercise(ex); fireCoach('exercise') }}
          onAddExercise={() => setShowAdd(true)}
        />
        {modals}
      </>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="j-page-header">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="j-page-title">{t('Allenamento')}</div>
            {/* Il conteggio segue il tab: sul tab Pesi la lista sotto ne mostra 33 e
                il sottotitolo ne dichiarava 38 (palestra + hyrox). */}
            <div className="j-eyebrow mt-0.5">
              {mode === 'palestra' && t('{n} esercizi in palestra', { n: s.palestraExercises.length })}
              {mode === 'hyrox'    && t('{n} esercizi hyrox', { n: s.hyroxExercises.length })}
              {mode === 'stats'    && t('{n} esercizi tracciati', { n: s.hyroxExercises.length + s.palestraExercises.length })}
            </div>
          </div>
          {mode === 'palestra' && (
            <button onClick={() => setShowAdd(true)} className="j-btn-add">
              <Icons.plus size={18} stroke={2}/>
            </button>
          )}
        </div>
        <GymModeTabs value={tab} onChange={v => { setTab(v); setStats(false); setRicerca(false); setSelectedExercise(null); setShowExerciseCharts(false); setSelectedMuscle(null); setSelectedHyrox(null); setMuscleFilter(null); setSearchQuery('') }}/>
        {/* Cerca e Stats sono interruttori: si ripreme la card per tornare alla
            lista. Non si escludono per principio ma per senso — cercare dentro le
            statistiche non vuol dire niente — quindi accenderne una spegne l'altra. */}
        <AzioniGym
          attiva={stats ? 'stats' : ricerca ? 'cerca' : null}
          onSchede={() => { setShowSchede(true); fireCoach('schede') }}
          onCerca={() => {
            if (ricerca) { setRicerca(false); setSearchQuery('') }
            else { setRicerca(true); setStats(false) }
          }}
          onStats={() => {
            if (stats) setStats(false)
            else { setStats(true); setRicerca(false); setSearchQuery('') }
          }}
        />
      </div>

      <div className="j-scroll-area">
        {/* Il campo vive qui, sopra i rami: la ricerca è una vista che si apre su
            qualunque tab, e duplicarlo dentro pesi e hyrox avrebbe voluto dire due
            campi da tenere allineati. */}
        {ricerca && (
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: NUC.faint, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
              <Icons.search size={14} stroke={1.8}/>
            </div>
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={mode === 'hyrox' ? t('Cerca stazione…') : t('Cerca esercizio…')}
              aria-label={t('Cerca esercizio')}
              className="j-field"
              style={{ paddingLeft: 36 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label={t('Svuota la ricerca')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: NUC.faint,
                display: 'flex', alignItems: 'center', padding: 2,
              }}>
                <Icons.x size={13} stroke={2}/>
              </button>
            )}
          </div>
        )}

        {mode === 'stats' && (
          <GymStats exercises={s.palestraExercises} hyroxExercises={s.hyroxExercises}/>
        )}
        {mode === 'hyrox' && searchQuery.trim() && (
          <>
            <NucEyebrow right={`${filteredHyrox.length}`}>{t('Risultati')}</NucEyebrow>
            {filteredHyrox.map(ex => (
              <div key={ex.id} onClick={() => setSelectedHyrox(ex)} style={{ cursor: 'pointer' }}>
                <HyroxCard ex={ex} onLog={e => { e?.stopPropagation?.(); setLogHyrox(ex) }}/>
              </div>
            ))}
            {filteredHyrox.length === 0 && <div className="j-empty">{t('Nessuna stazione')}</div>}
          </>
        )}
        {mode === 'hyrox' && !searchQuery.trim() && (
          <>
            {/* Sub-tab bar */}
            <NucSubTabs
              options={[{ id: 'esercizi', label: t('Esercizi') }, { id: 'gara', label: t('Gara') }]}
              value={hyroxSubTab}
              onChange={id => setHyroxSubTab(id as 'gara' | 'esercizi')}
              style={{ marginBottom: 16 }}
            />

            {hyroxSubTab === 'gara' && (
              <RaceSummary raceStations={raceStationData} runStation={runStationData}/>
            )}

            {hyroxSubTab === 'esercizi' && (
              <>
                <NucEyebrow>{t('Corsa · 8 × 1 km')}</NucEyebrow>
                <div onClick={() => setSelectedHyrox(runStationData)} style={{ cursor: 'pointer' }}>
                  <HyroxCard ex={runStationData} onLog={e => { e?.stopPropagation?.(); setLogHyrox(runStationData) }}/>
                </div>

                <div style={{ marginTop: 8 }}><NucEyebrow>{t('Stazioni gara')}</NucEyebrow></div>
                {raceStationData.map(ex => (
                  <div key={ex.id} onClick={() => setSelectedHyrox(ex)} style={{ cursor: 'pointer' }}>
                    <HyroxCard ex={ex} onLog={e => { e?.stopPropagation?.(); setLogHyrox(ex) }}/>
                  </div>
                ))}

                {customHyrox.length > 0 && (
                  <>
                    <div style={{ marginTop: 8 }}><NucEyebrow right={`${customHyrox.length}`}>{t('Grafico andamento')}</NucEyebrow></div>
                    {customHyrox.map(ex => (
                      <div key={ex.id} onClick={() => setSelectedHyrox(ex)} style={{ cursor: 'pointer' }}>
                        <HyroxCard
                          ex={ex}
                          onLog={e => { e?.stopPropagation?.(); setLogHyrox(ex) }}
                          onDelete={e => { e?.stopPropagation?.(); confirmDelete(() => deleteHyroxExercise(ex), tData(ex.n)) }}
                        />
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
        {mode === 'palestra' && (
          <>
            {searchQuery.trim() ? (
              <>
                <NucEyebrow right={`${filteredPalestra.length}/${s.palestraExercises.length}`}>{t('Risultati')}</NucEyebrow>
                {filteredPalestra.map((ex, i) => (
                  <div key={ex.id} className="j-rise-in" style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}>
                    <PalestraCard
                      ex={ex}
                      onNavigate={() => { setSelectedExercise(ex); fireCoach('exercise') }}
                      muscleColors={muscleColors}
                    />
                  </div>
                ))}
                {filteredPalestra.length === 0 && <div className="j-empty">{t('Nessun esercizio')}</div>}
              </>
            ) : (
              <>
                {/* La riga larga "Schede d'allenamento" non è più qui: era in mezzo
                    alla lista degli esercizi, cioè dentro il contenuto invece che
                    fra i comandi. Adesso è la prima delle tre card sopra. */}
                <NucEyebrow right={t('{n} esercizi', { n: s.palestraExercises.length })}>{t('Gruppi muscolari')}</NucEyebrow>
                {/* Il catalogo entra da solo al primo accesso, ma chi aveva già un
                    profilo quel passaggio non lo rivede più: senza questa riga i
                    trentasette esercizi — e le loro foto — restavano irraggiungibili
                    per tutti gli account già avviati. Compare finché ne manca almeno
                    uno e sparisce quando non manca più niente. */}
                {mancanti > 0 && (
                  <button onClick={aggiungiCatalogo} className="j-hard" style={{
                    width: '100%', marginBottom: 12, padding: '11px 13px', borderRadius: 0,
                    background: 'var(--surface)', border: '1px solid var(--hairline)',
                    display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ color: 'var(--j-accent-ink)', display: 'flex', flexShrink: 0 }}>
                      <Icons.plus size={17} stroke={2}/>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 13.5, color: NUC.ink }}>
                        {t('Aggiungi gli esercizi di base')}
                      </span>
                      <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, letterSpacing: '.04em', color: NUC.faint, marginTop: 2 }}>
                        {mancanti === 1 ? t('Ne manca 1, con la sua immagine') : t('Ne mancano {n}, con la loro immagine', { n: mancanti })}
                      </span>
                    </span>
                    <Icons.chev size={15} stroke={1.6} color={NUC.faint}/>
                  </button>
                )}
                {groupedPalestra.length === 0 ? (
                  <div className="j-empty">{t('Nessun esercizio — aggiungine uno con +')}</div>
                ) : (
                  <ElencoGruppi
                    gruppi={groupedPalestra}
                    muscleColors={muscleColors}
                    onApri={muscle => { setSelectedMuscle(muscle); fireCoach('muscleGroup') }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>

      {modals}
    </div>
  )
}

