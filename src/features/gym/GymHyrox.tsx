// Le tre viste Hyrox: dettaglio stazione, riepilogo gara e card di elenco.
//
// Hyrox è una gara a stazioni fisse (8 workout + 8 km di corsa): le stazioni di
// gara sono predefinite in gymModel (RACE_STATIONS/RUNNING_STATION) e non si
// possono cancellare, mentre l'utente può aggiungere esercizi suoi. Per questo
// quasi ogni vista qui distingue `isRace`.
// A differenza della palestra, qui non si misura un carico ma un TEMPO (o una
// distanza): il "meglio" è il valore più basso, e i grafici vanno letti al
// contrario rispetto a quelli dei pesi.
import { useState, useMemo } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT, useTData } from '@/lib/i18n'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import type { HyroxExercise, HyroxHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { fmtTime, pace, sortedHistory } from './gymModel'
import { EditHyroxHistModal } from './gymModals'
import { LineChart } from './gymShared'
import { fmtShortDate } from '@/lib/dateFormat'

// La parte Hyrox della scheda Allenamento: la card in elenco, la pagina di
// dettaglio di una stazione e il riepilogo gara.

export function HyroxDetail({ ex, onBack, onLog, onDelete, onUpdate, isRace = false }: {
  ex: HyroxExercise; onBack: () => void; onLog: () => void
  onDelete?: () => void
  onUpdate?: (changes: Partial<HyroxExercise>) => void
  isRace?: boolean
}) {
  const t = useT()
  const tData = useTData()
  // Ordinato per data (letto e riscritto qui, quindi gli indici restano coerenti).
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const [histOpen, setHistOpen] = useState(false)
  const [editHistEntry, setEditHistEntry] = useState<{ entry: HyroxHistoryEntry; idx: number } | null>(null)
  const { confirmDelete } = useConfirmDelete()

  const { times, paces, labels } = useMemo(() => ({
    times:  hist.map(h => h.sec),
    paces:  hist.map(h => {
      if (ex.unit === 'km') return Math.round(h.sec / h.units)
      if (ex.unit === 'm')  return Math.round((h.sec / h.units) * 500)
      return Math.round((h.units / h.sec) * 60)
    }),
    labels: hist.map(h => h.d),
  }), [hist, ex.unit])

  const bestSec  = times.length ? Math.min(...times) : 0
  const lastSec  = times[times.length - 1]
  const prevSec  = times[times.length - 2]
  const trend    = lastSec !== undefined && prevSec !== undefined ? lastSec - prevSec : 0
  const trendCol = trend < 0 ? NUC.accentSoft : trend > 0 ? 'var(--danger)' : NUC.faint

  const deleteHistEntry = (idx: number) => {
    onUpdate?.({ history: hist.filter((_, i) => i !== idx) })
  }

  return (
    <>
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="j-btn-back">
            <Icons.chevL size={16} stroke={2}/>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: NUC.serif, fontSize: 22, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5">{ex.target} {ex.unit} · {isRace ? t('Gara Hyrox') : t('Hyrox')}</div>
          </div>
          {!isRace && onDelete && (
            <button onClick={() => confirmDelete(onDelete, tData(ex.n))} style={{
              width: 34, height: 34, borderRadius: 0,
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
              color: 'var(--danger)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><Icons.trash size={14} stroke={1.6}/></button>
          )}
        </div>
      </div>

      <div className="j-scroll-area">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: t('Miglior tempo'), value: bestSec > 0 ? fmtTime(bestSec) : '—' },
            { label: t('Trend'),         value: trend !== 0 ? `${trend < 0 ? '▼' : '▲'} ${Math.abs(trend)}s` : '—', color: trendCol },
            { label: t('Sessioni'),      value: String(hist.length) },
          ].map(st => (
            <NucCard key={st.label} pad={12} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1.5, color: NUC.faint, textTransform: 'uppercase', marginBottom: 6 }}>{st.label}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 13, color: st.color ?? NUC.accentSoft, letterSpacing: -0.4 }}>{st.value}</div>
            </NucCard>
          ))}
        </div>

        {times.length >= 2 && (
          <>
            <NucEyebrow right={trend !== 0 ? (
              <span style={{ color: trendCol }}>{trend < 0 ? '▼' : '▲'} {Math.abs(trend)}s</span>
            ) : undefined}>{t('Tempo (secondi)')}</NucEyebrow>
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.3, marginTop: -6, marginBottom: 8, paddingLeft: 2 }}>
              {t('il grafico che scende = miglioramento')}
            </div>
            <NucCard pad={12} style={{ marginBottom: 12 }}>
              <LineChart data={times} labels={labels} height={64} color={NUC.accentSoft}/>
            </NucCard>
          </>
        )}

        {paces.length >= 2 && (
          <>
            <NucEyebrow>
              {ex.unit === 'km' ? t('Pace (sec/km)') : ex.unit === 'm' ? t('Pace (sec/500m)') : t('Cadenza (rep/min)')}
            </NucEyebrow>
            <NucCard pad={12} style={{ marginBottom: 12 }}>
              <LineChart data={paces} labels={labels} height={52} color="var(--j-accent)"/>
            </NucCard>
          </>
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
          const dateStr = h.date ? fmtShortDate(h.date) : h.d
          return (
            <div key={i} className="flex items-center gap-2 py-2.5" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: NUC.ink, letterSpacing: -0.2 }}>
                  {fmtTime(h.sec)} · {h.units} {ex.unit}
                </div>
                <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{dateStr}</div>
              </div>
              <div style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.accentSoft, letterSpacing: -0.3, flexShrink: 0 }}>
                {pace(h.sec, h.units, ex.unit)}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditHistEntry({ entry: h, idx: realIdx })} style={{
                  width: 26, height: 26, borderRadius: 0,
                  background: 'var(--surface)', border: '1px solid var(--hairline)',
                  color: NUC.faint, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icons.pencil size={10} stroke={1.8}/>
                </button>
                <button onClick={() => confirmDelete(() => deleteHistEntry(realIdx), t('Sessione'))} style={{
                  width: 26, height: 26, borderRadius: 0,
                  background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
                  color: 'var(--danger)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><Icons.trash size={11} stroke={1.6}/></button>
              </div>
            </div>
          )
        })}

        <button onClick={onLog} className="j-btn-accent" style={{ marginTop: 16 }}>
          <Icons.plus size={16} stroke={2}/> {t('Nuova sessione')}
        </button>
      </div>
    </div>
    {editHistEntry && (
      <EditHyroxHistModal
        entry={editHistEntry.entry}
        unit={ex.unit}
        onClose={() => setEditHistEntry(null)}
        onSave={updated => {
          const newHist = hist.map((h, i) => i === editHistEntry.idx ? updated : h)
          onUpdate?.({ history: newHist })
          setEditHistEntry(null)
        }}
      />
    )}
    </>
  )
}

// ── Riepilogo gara ─────────────────────────────────────────────
export function RaceSummary({ raceStations, runStation }: {
  raceStations: HyroxExercise[]
  runStation: HyroxExercise
}) {
  const t = useT()
  const tData = useTData()
  const stationStats = useMemo(() =>
    raceStations.map(ex => {
      const hist = ex.history
      if (!hist.length) return { ex, avgSec: null as number | null, avgUnits: ex.target, sessions: 0 }
      const avgSec = Math.round(hist.reduce((s, h) => s + h.sec, 0) / hist.length)
      const avgUnits = hist.reduce((s, h) => s + h.units, 0) / hist.length
      return { ex, avgSec, avgUnits, sessions: hist.length }
    }),
    [raceStations]
  )

  const runStats = useMemo(() => {
    const hist = runStation.history
    if (!hist.length) return { avgSec: null as number | null, sessions: 0 }
    return {
      avgSec: Math.round(hist.reduce((s, h) => s + h.sec, 0) / hist.length),
      sessions: hist.length,
    }
  }, [runStation])

  const logged   = stationStats.filter(s => s.avgSec !== null).length + (runStats.avgSec !== null ? 1 : 0)
  const totalSec = stationStats.reduce((sum, s) => sum + (s.avgSec ?? 0), 0) + (runStats.avgSec !== null ? runStats.avgSec * 8 : 0)

  return (
    <div>
      <NucCard pad={16} style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1.5, color: NUC.faint, textTransform: 'uppercase', marginBottom: 8 }}>
          {t('Tempo gara stimato · media sessioni')}
        </div>
        <div style={{ fontFamily: NUC.label, fontSize: 32, color: logged > 0 ? NUC.accentSoft : NUC.faint, letterSpacing: -1.5, lineHeight: 1 }}>
          {logged > 0 ? fmtTime(totalSec) : '—'}
        </div>
        <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 10, letterSpacing: .3 }}>
          {t('{n}/9 segmenti tracciati', { n: logged })}
          {logged === 9 ? ` · ${t('stima completa')}` : logged > 0 ? ` · ${t('stima parziale')}` : ''}
        </div>
        {logged < 9 && (
          <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 4, letterSpacing: .2, opacity: .7 }}>
            {t('logga le sessioni mancanti nella scheda Esercizi')}
          </div>
        )}
      </NucCard>

      <NucCard pad={16}>
        {/* Run row */}
        <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: NUC.ink, letterSpacing: -0.2 }}>{t('Corsa 1 km')}</div>
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>
              1 km · {t('{n} sess.', { n: runStats.sessions })}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {runStats.avgSec !== null ? (
              <>
                <div style={{ fontFamily: NUC.label, fontSize: 15, color: NUC.accentSoft, letterSpacing: -0.5 }}>{fmtTime(runStats.avgSec)}</div>
                <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 1 }}>{pace(runStats.avgSec, 1, 'km')}</div>
              </>
            ) : (
              <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.faint }}>—</div>
            )}
          </div>
        </div>

        {/* Station rows */}
        {stationStats.map(({ ex, avgSec, avgUnits, sessions }, idx) => (
          <div key={ex.id} className="flex justify-between items-center py-3"
            style={{ borderBottom: idx < stationStats.length - 1 ? '1px solid var(--hairline-soft)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: NUC.serif, fontSize: 15, fontWeight: 500, letterSpacing: 0, color: NUC.ink }}>{tData(ex.n)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2 }}>
                {ex.target} {ex.unit} · {t('{n} sess.', { n: sessions })}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {avgSec !== null ? (
                <>
                  <div style={{ fontFamily: NUC.label, fontSize: 15, color: NUC.accentSoft, letterSpacing: -0.5 }}>{fmtTime(avgSec)}</div>
                  <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 1 }}>{pace(avgSec, avgUnits, ex.unit)}</div>
                </>
              ) : (
                <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.faint }}>—</div>
              )}
            </div>
          </div>
        ))}
      </NucCard>
    </div>
  )
}

// ── Hyrox Card ─────────────────────────────────────────────────
export function HyroxCard({ ex, onLog, onDelete }: {
  ex: HyroxExercise
  onLog: (e?: React.MouseEvent) => void
  onDelete?: (e?: React.MouseEvent) => void
}) {
  const t = useT()
  const tData = useTData()
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const last = hist[hist.length - 1]
  const prev = hist[hist.length - 2]
  const times = hist.map(h => h.sec)
  const labels = hist.map(h => h.d)
  const trend = last && prev ? last.sec - prev.sec : 0
  const trendColor = trend < 0 ? NUC.accentSoft : trend > 0 ? 'var(--danger)' : NUC.faint

  return (
    <NucCard pad={16} style={{ marginBottom: 10 }}>
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div style={{ fontFamily: NUC.serif, fontSize: 18, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0, color: NUC.ink, marginBottom: 3 }}>{tData(ex.n)}</div>
          <div className="j-eyebrow">{ex.target} {ex.unit}</div>
        </div>
        <div className="flex items-center gap-2">
          {last && (
            <div className="text-right">
              <div style={{ fontFamily: NUC.label, fontSize: 16, color: NUC.accentSoft, letterSpacing: -0.5 }}>{fmtTime(last.sec)}</div>
              <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1, color: NUC.faint }}>{pace(last.sec, last.units, ex.unit)}</div>
            </div>
          )}
          {trend !== 0 && (
            <div style={{ fontFamily: NUC.label, fontSize: 10, color: trendColor, letterSpacing: 0.5 }}>
              {trend < 0 ? '▼' : '▲'} {Math.abs(trend)}s
            </div>
          )}
        </div>
      </div>

      {times.length >= 2 && (
        <div className="mb-2.5">
          <LineChart data={times} labels={labels} height={52} color={NUC.accentSoft}/>
        </div>
      )}

      {times.length === 0 && (
        <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1.5, color: NUC.faint, textAlign: 'center', padding: '10px 0', textTransform: 'uppercase' }}>
          {t('Nessuna sessione registrata')}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={e => { e.stopPropagation(); onLog(e) }} className="j-btn-log flex-1">
          <Icons.plus size={14} stroke={2}/> {t('Nuova sessione')}
        </button>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(e) }} className="flex items-center justify-center w-[38px] h-[38px] rounded-none" style={{ background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer' }}><Icons.trash size={15} stroke={1.6}/></button>
        )}
      </div>
    </NucCard>
  )
}
