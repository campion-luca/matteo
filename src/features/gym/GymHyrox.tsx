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
import type React from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT, useTData } from '@/lib/i18n'
import { NucCard, NucEyebrow } from '@/components/ui/NucComponents'
import { Icons } from '@/components/ui/Icons'
import type { HyroxExercise, HyroxGara, HyroxHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { fmtTime, pace, sortedHistory } from './gymModel'
import {
  type FormatoHyrox, type Fonte, type PB,
  formatoSessione, distanzaLeggibile, stimaPB, giornateAMeta, totaleGara, fmtTempoGara, fmtDelta,
  ROXZONE_PASSAGGI, ROXZONE_SEC, MIN_PER_PROFILO,
} from './hyroxStima'
import { readStorage, writeStorage } from '@/lib/safeStorage'
import { EditHyroxHistModal } from './gymModals'
import { FormatoSwitch } from './FormatoSwitch'
import { LineChart } from './gymShared'
import { Cronologia } from '@/components/ui/Cronologia'
import { fmtShortDate, fmtDayMon, fmtDayMonthFull } from '@/lib/dateFormat'

// La parte Hyrox della scheda Allenamento: la card in elenco, la pagina di
// dettaglio di una stazione e il riepilogo gara.

export function HyroxDetail({ ex, onBack, onLog, onDelete, onUpdate, isRace = false, formato, onFormato }: {
  ex: HyroxExercise; onBack: () => void; onLog: () => void
  onDelete?: () => void
  onUpdate?: (changes: Partial<HyroxExercise>) => void
  isRace?: boolean
  formato: FormatoHyrox
  onFormato: (f: FormatoHyrox) => void
}) {
  const t = useT()
  const tData = useTData()
  // Ordinato per data (letto e riscritto qui, quindi gli indici restano coerenti).
  const hist = useMemo(() => sortedHistory(ex.history), [ex.history])
  const [editHistEntry, setEditHistEntry] = useState<{ entry: HyroxHistoryEntry; idx: number } | null>(null)
  const { confirmDelete } = useConfirmDelete()

  // Solo le sessioni del formato scelto. Miglior tempo, trend e grafici su
  // distanze diverse non si confrontano: un 500 m sarebbe sempre il "record" di
  // un 1000 m, e il grafico salterebbe a ogni cambio di distanza. L'indice vero
  // viaggia con la sessione: modifica ed eliminazione lavorano su `hist` intero.
  const visibili = useMemo(
    () => hist.map((h, idx) => ({ h, idx })).filter(({ h }) => formatoSessione(h, ex.target) === formato),
    [hist, ex.target, formato],
  )
  const dalPiuRecente = useMemo(() => [...visibili].reverse(), [visibili])
  const distIntera = distanzaLeggibile(ex.target, ex.unit)
  const distMezza  = distanzaLeggibile(ex.target / 2, ex.unit)

  const { times, paces, labels } = useMemo(() => ({
    times:  visibili.map(({ h }) => h.sec),
    paces:  visibili.map(({ h }) => {
      if (ex.unit === 'km') return Math.round(h.sec / h.units)
      if (ex.unit === 'm')  return Math.round((h.sec / h.units) * 500)
      return Math.round((h.units / h.sec) * 60)
    }),
    labels: visibili.map(({ h }) => h.d),
  }), [visibili, ex.unit])

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
            <div style={{ fontFamily: NUC.font, fontSize: 22, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0, color: NUC.ink }}>{tData(ex.n)}</div>
            <div className="j-eyebrow mt-0.5">{formato === 'mezzo' ? distMezza : distIntera} · {isRace ? t('Gara Hyrox') : t('Hyrox')}</div>
          </div>
          {!isRace && onDelete && (
            <button onClick={() => confirmDelete(onDelete, tData(ex.n))} style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)',
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
              color: 'var(--danger)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}><Icons.trash size={14} stroke={1.6}/></button>
          )}
        </div>
      </div>

      <div className="j-scroll-area">
        <FormatoSwitch valore={formato} onChange={onFormato} etichette={[distIntera, distMezza]} style={{ marginBottom: 14 }}/>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: t('Miglior tempo'), value: bestSec > 0 ? fmtTime(bestSec) : '—' },
            { label: t('Trend'),         value: trend !== 0 ? `${trend < 0 ? '▼' : '▲'} ${Math.abs(trend)}s` : '—', color: trendCol },
            { label: t('Sessioni'),      value: String(visibili.length) },
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

        {/* Lo storico non sta dietro una tendina sola, come nella pagina di un
            esercizio dei pesi: il mese in corso è aperto, i precedenti si aprono
            uno per uno. */}
        <NucEyebrow right={visibili.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: visibili.length })}>{t('Storico')}</NucEyebrow>

        {visibili.length === 0 && (
          <div className="j-empty">{t('Nessuna sessione da {dist}', { dist: formato === 'mezzo' ? distMezza : distIntera })}</div>
        )}

        {/* Per anno e per mese, come lo storico dei pesi: aperti solo i più recenti. */}
        {visibili.length > 0 && (
          <Cronologia
            voci={dalPiuRecente}
            dataDi={v => v.h.date}
            chiaveDi={v => v.idx}
            conta={n => n === 1 ? t('1 sessione') : t('{n} sessioni', { n })}
            voce={({ h, idx: realIdx }) => {
              const dateStr = h.date ? fmtShortDate(h.date) : h.d
              return (
                <div className="flex items-center gap-2 py-2.5" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: NUC.ink, letterSpacing: -0.2 }}>
                      {fmtTime(h.sec)} · {distanzaLeggibile(h.units, ex.unit)}
                    </div>
                    <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, letterSpacing: 0.5, marginTop: 2 }}>{dateStr}</div>
                  </div>
                  <div style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.accentSoft, letterSpacing: -0.3, flexShrink: 0 }}>
                    {pace(h.sec, h.units, ex.unit)}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setEditHistEntry({ entry: h, idx: realIdx })} style={{
                      width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)', border: '1px solid var(--hairline)',
                      color: NUC.faint, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icons.pencil size={10} stroke={1.8}/>
                    </button>
                    <button onClick={() => confirmDelete(() => deleteHistEntry(realIdx), t('Sessione'))} style={{
                      width: 26, height: 26, borderRadius: 'var(--radius-sm)',
                      background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)',
                      color: 'var(--danger)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Icons.trash size={11} stroke={1.6}/></button>
                  </div>
                </div>
              )
            }}
          />
        )}

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
          // Riordinato: con la data modificabile la sessione può cambiare posto.
          const newHist = sortedHistory(hist.map((h, i) => i === editHistEntry.idx ? updated : h))
          onUpdate?.({ history: newHist })
          setEditHistEntry(null)
        }}
      />
    )}
    </>
  )
}

// ── La gara ────────────────────────────────────────────────────
// La prima cosa che si vede aprendo Hyrox. In alto il tempo che i tuoi PB
// promettono, diviso in corsa, stazioni e Roxzone; sotto, da dove viene ogni
// pezzo — il PB di ogni stazione con il giorno in cui l'hai fatto; poi le gare
// e le simulazioni registrate, e in fondo come ragiona la stima. I conti stanno
// in hyroxStima, puri e testati: qui c'è solo il modo di leggerli.

/** Il grigio-azzurro dello sfondo fuso: le stazioni nella barra, accanto
 *  all'arancione della corsa. Due tinte che si distinguono in tutti i temi. */
const TINTA_STAZIONI = '#8593A4'

/** I nomi delle stazioni come si dicono in palestra: nelle card a due colonne
 *  "Burpees Broad Jump" non ci sta accanto alla distanza. */
const NOME_BREVE: Record<string, string> = {
  hx_bbj: 'Burpee BJ', hx_farm: 'Farmers', hx_lunge: 'Lunges',
}

/** Le giornate già controllate ("erano a metà davvero"): sul dispositivo, come
 *  le altre preferenze di Hyrox. È una risposta a una domanda, non un dato. */
const GIORNATE_OK_KEY = 'jarvis-hyrox-giornate-ok'
function useGiornateOk(): [string[], (d: string) => void] {
  const [ok, setOk] = useState<string[]>(() => {
    try { return JSON.parse(readStorage('local', GIORNATE_OK_KEY) ?? '[]') as string[] } catch { return [] }
  })
  const aggiungi = (d: string) => setOk(prev => {
    const next = [...prev, d]
    writeStorage('local', GIORNATE_OK_KEY, JSON.stringify(next))
    return next
  })
  return [ok, aggiungi]
}

export function RaceSummary({ raceStations, runStation, gare, oggi, onRegistra, onModifica, onElimina, onApri, onCorreggiGiornata }: {
  raceStations: HyroxExercise[]
  runStation: HyroxExercise
  gare: HyroxGara[]
  /** Il giorno da cui si conta "l'ultimo mese". */
  oggi: string
  onRegistra: () => void
  onModifica: (g: HyroxGara) => void
  onElimina: (g: HyroxGara) => void
  onApri: (ex: HyroxExercise) => void
  /** Riporta alla distanza intera le sessioni a metà di quel giorno. */
  onCorreggiGiornata: (data: string) => void
}) {
  const t = useT()
  const tData = useTData()
  const s = useMemo(() => stimaPB(runStation, raceStations, gare, oggi), [runStation, raceStations, gare, oggi])
  const [giornateOk, segnaOk] = useGiornateOk()
  const daControllare = useMemo(
    () => giornateAMeta([runStation, ...raceStations]).filter(g => !giornateOk.includes(g.data)),
    [runStation, raceStations, giornateOk],
  )
  const gareOrdinate = useMemo(() => [...gare].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [gare])

  const fonte = (f: Fonte | null, unit: HyroxExercise['unit']): string => {
    if (!f) return t('nessuna sessione')
    switch (f.tipo) {
      case 'allenamento': return `${t('allenamento')} · ${fmtDayMon(f.data)}`
      case 'gara':        return `${t('gara')} · ${fmtDayMon(f.data)}`
      case 'simulazione': return `${t('simulazione')} · ${fmtDayMon(f.data)}`
      case 'mezza':       return `${t('da {dist}', { dist: distanzaLeggibile(f.daUnita, unit) })} × ${Math.pow(2, f.k).toFixed(2).replace('.', ',')} · ${fmtDayMon(f.data)}`
      case 'profilo':     return t('dal tuo profilo')
      case 'ipotesi':     return t('ipotesi: {n} passaggi × {s} s', { n: ROXZONE_PASSAGGI, s: ROXZONE_SEC })
    }
  }

  const sottotitolo = s.totale === null
    ? t('Servono almeno {n} segmenti registrati', { n: MIN_PER_PROFILO })
    : [
        t('somma dei tuoi PB'),
        s.delta !== null && s.delta !== 0 ? t('{d} nell’ultimo mese', { d: fmtDelta(s.delta) }) : null,
        s.delta === 0 ? t('invariato nell’ultimo mese') : null,
      ].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Le giornate registrate a metà che sembrano una simulazione intera: è
          così che una simulazione da 1:30 diventava una stima da 2:16. Si
          chiede, non si corregge da soli — una mezza simulazione vera esiste. */}
      {daControllare.slice(0, 1).map(g => (
        <NucCard key={g.data} pad={14} style={{ marginBottom: 12, borderLeft: '3px solid var(--j-accent)' }}>
          <div style={{ fontFamily: NUC.label, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--tertiary-ink)' }}>
            {t('Da controllare')}
          </div>
          <div style={{ fontFamily: NUC.font, fontSize: 14, color: NUC.ink, marginTop: 6, lineHeight: 1.4 }}>
            {t('Il {d} hai registrato {n} segmenti a metà distanza.', { d: fmtDayMonthFull(g.data), n: g.segmenti.length })}
          </div>
          <div style={{ fontFamily: NUC.label, fontSize: 11, color: NUC.faint, marginTop: 4, lineHeight: 1.5 }}>
            {t('Se era una simulazione intera, i tempi sono quelli giusti ma la distanza no: la stima li legge come mezze e li raddoppia.')}
          </div>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <button onClick={() => onCorreggiGiornata(g.data)} className="j-btn-accent-sm" style={{ flex: 1 }}>
              {t('Erano intere')}
            </button>
            <button onClick={() => segnaOk(g.data)} className="j-btn-ghost" style={{ flex: 1, height: 44, fontFamily: NUC.label, fontSize: 13.5 }}>
              {t('Erano a metà')}
            </button>
          </div>
        </NucCard>
      ))}

      {/* ── Il tempo ── */}
      <NucCard pad={16} style={{ marginBottom: 18 }}>
        <div className="flex items-start justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: NUC.label, fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--j-accent-ink)' }}>
              {t('Tempo gara stimato')}{s.categoria ? ` · ${s.categoria === 'double' ? t('Double') : t('Singolo')}` : ''}
            </div>
            <div style={{ fontFamily: NUC.tempo, fontSize: 'clamp(34px, 11vw, 44px)', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-.02em', color: s.totale !== null ? NUC.ink : NUC.faint, marginTop: 8 }}>
              {s.totale !== null ? fmtTempoGara(s.totale) : '—'}
            </div>
            <div style={{ fontFamily: NUC.label, fontSize: 11.5, color: NUC.faint, marginTop: 6, lineHeight: 1.4 }}>
              {sottotitolo}
            </div>
          </div>
          <button
            onClick={onRegistra}
            aria-label={t('Registra una gara o una simulazione')}
            className="j-hard j-accent-key j-focus"
            style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 'var(--radius)', cursor: 'pointer',
              backgroundColor: 'var(--j-accent)', color: 'var(--j-accent-fg)', border: '1px solid var(--accent-edge)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icons.plus size={20} stroke={2}/>
          </button>
        </div>

        {s.parti && (
          <>
            <div role="img" aria-label={t('Corsa {c}, stazioni {s}, Roxzone {r}', { c: fmtTempoGara(s.parti.corsa), s: fmtTempoGara(s.parti.stazioni), r: fmtTempoGara(s.parti.roxzone) })}
              style={{ display: 'flex', gap: 3, height: 8, marginTop: 16 }}>
              {[
                { v: s.parti.corsa, c: 'var(--j-accent)' },
                { v: s.parti.stazioni, c: TINTA_STAZIONI },
                { v: s.parti.roxzone, c: 'var(--track)' },
              ].map((p, i) => (
                <span key={i} style={{ flex: `${p.v} 1 0`, minWidth: 4, background: p.c, borderRadius: 'var(--radius-pill)' }}/>
              ))}
            </div>
            <div className="flex flex-wrap" style={{ gap: '6px 16px', marginTop: 10 }}>
              {[
                { l: t('Corsa'), v: s.parti.corsa, c: 'var(--j-accent)' },
                { l: t('Stazioni'), v: s.parti.stazioni, c: TINTA_STAZIONI },
                { l: t('Roxzone'), v: s.parti.roxzone, c: 'var(--track)' },
              ].map(p => (
                <span key={p.l} className="flex items-center gap-1.5" style={{ fontFamily: NUC.label, fontSize: 11.5, color: NUC.dim }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: p.c, display: 'inline-block' }}/>
                  {p.l} <span style={{ fontFamily: NUC.tempo, color: NUC.ink }}>{fmtTempoGara(p.v)}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </NucCard>

      {/* ── Da dove viene ── */}
      <NucEyebrow right={s.corsa.passoKm !== null ? `${fmtTime(Math.round(s.corsa.passoKm))} /km` : undefined}>{t('Corsa · PB')}</NucEyebrow>
      <div style={{ marginBottom: 16 }}>
        <CardPB
          nome={t('Corsa')} distanza="8 km" pb={s.corsa}
          fonte={fonte(s.corsa.fonte, 'km')}
          onClick={() => onApri(runStation)}
        />
      </div>

      <NucEyebrow>{t('Stazioni · PB')}</NucEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
        {raceStations.map((ex, i) => (
          <CardPB
            key={ex.id}
            nome={NOME_BREVE[ex.id] ?? tData(ex.n)}
            distanza={distanzaLeggibile(ex.target, ex.unit)}
            pb={s.stazioni[i].pb}
            fonte={fonte(s.stazioni[i].pb.fonte, ex.unit)}
            onClick={() => onApri(ex)}
          />
        ))}
      </div>

      <NucEyebrow>{t('Roxzone')}</NucEyebrow>
      <div style={{ marginBottom: 22 }}>
        <CardPB
          nome={t('Roxzone')} distanza={t('{n} passaggi', { n: ROXZONE_PASSAGGI })} pb={s.roxzone}
          fonte={fonte(s.roxzone.fonte, 'm')}
        />
      </div>

      {/* ── Le gare registrate ── */}
      <NucEyebrow right={gare.length > 0 ? String(gare.length) : undefined}>{t('Gare e simulazioni')}</NucEyebrow>
      {gare.length === 0 ? (
        <button onClick={onRegistra} className="j-focus" style={{
          width: '100%', marginBottom: 22, padding: '14px', borderRadius: 'var(--radius)', cursor: 'pointer',
          background: 'transparent', border: '1px dashed var(--hairline)', color: 'var(--j-accent-ink)',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <Icons.plus size={18} stroke={1.9}/>
          <span>
            <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 14, color: NUC.ink }}>{t('Registra una gara o una simulazione')}</span>
            <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10.5, color: NUC.faint, marginTop: 2 }}>
              {t('Corsa, stazioni e Roxzone, con i tempi della distanza intera')}
            </span>
          </span>
        </button>
      ) : (
        <div style={{ marginBottom: 22 }}>
          <Cronologia
            voci={gareOrdinate}
            dataDi={g => g.date}
            chiaveDi={g => g.id}
            // "Prove" e non "gare": dentro ci sono anche le simulazioni.
            conta={n => n === 1 ? t('1 prova') : t('{n} prove', { n })}
            voce={g => <GaraRegistrata g={g} stazioni={raceStations} onModifica={() => onModifica(g)} onElimina={() => onElimina(g)}/>}
          />
        </div>
      )}

      {/* Il ragionamento, in chiaro: chi guarda un tempo deve poter sapere cosa
          ci sta dietro senza aprire il codice. */}
      <NucCard pad={14}>
        <NucEyebrow>{t('Come ragiona la stima')}</NucEyebrow>
        <div style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.dim, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>{t('1. Il tempo stimato è la somma dei tuoi tempi migliori: il passo migliore al km × 8, il PB di ogni stazione e la Roxzone. Sotto ogni tempo c’è il giorno da cui viene.')}</div>
          <div>{t('2. Gare e simulazioni intere si registrano col +, e valgono come gli allenamenti: vince il tempo migliore. Sono l’unico posto da cui viene la Roxzone; senza, è un’ipotesi.')}</div>
          <div>{t('3. In double le stazioni si fanno in due: la stima è nella categoria della tua ultima gara, e le stazioni delle gare dell’altra categoria non contano. La corsa sì: si corre tutti e due.')}</div>
          <div>{t('4. Una stazione fatta solo a metà si porta all’intera con la formula di Riegel (circa × 2,1), finché non ne registri una intera. Con almeno 3 segmenti misurati, quelli che mancano si completano dal tuo profilo.')}</div>
        </div>
      </NucCard>
    </div>
  )
}

/** Un PB: nome e distanza, il tempo, quanto è cambiato nell'ultimo mese, e da
 *  dove viene. Toccata, apre la pagina della stazione. */
function CardPB({ nome, distanza, pb, fonte, onClick }: {
  nome: string; distanza: string; pb: PB; fonte: string; onClick?: () => void
}) {
  const t = useT()
  const supposto = pb.fonte?.tipo === 'profilo' || pb.fonte?.tipo === 'ipotesi' || pb.fonte?.tipo === 'mezza'
  const colore = pb.delta === null || pb.delta === 0 ? NUC.faint : pb.delta < 0 ? 'var(--segnale-su)' : 'var(--segnale-giu)'
  const contenuto = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span style={{ fontFamily: NUC.font, fontSize: 13.5, fontWeight: 500, color: NUC.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
        <span style={{ fontFamily: NUC.label, fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: NUC.faint, flexShrink: 0 }}>{distanza}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2" style={{ marginTop: 8 }}>
        <span style={{ fontFamily: NUC.tempo, fontSize: 24, fontWeight: 500, letterSpacing: '-.02em', color: pb.sec === null ? NUC.faint : supposto ? NUC.dim : NUC.ink }}>
          {pb.sec !== null ? fmtTempoGara(pb.sec) : '—'}
        </span>
        <span aria-label={pb.delta ? t('{d} nell’ultimo mese', { d: fmtDelta(pb.delta) }) : undefined} style={{ fontFamily: NUC.tempo, fontSize: 11.5, color: colore, flexShrink: 0 }}>
          {pb.delta ? fmtDelta(pb.delta) : '–'}
        </span>
      </div>
      <div style={{
        fontFamily: NUC.label, fontSize: 10, marginTop: 5, lineHeight: 1.35,
        color: supposto ? 'var(--tertiary-ink)' : NUC.faint,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{fonte}</div>
    </>
  )
  const stile: React.CSSProperties = {
    width: '100%', minWidth: 0, padding: '12px 12px 11px', borderRadius: 'var(--radius)', textAlign: 'left',
    background: 'var(--surface)', border: '1px solid var(--hairline)',
  }
  return onClick
    ? <button onClick={onClick} className="j-hard j-focus" style={{ ...stile, cursor: 'pointer', display: 'block' }}>{contenuto}</button>
    : <div className="j-hard-flat" style={stile}>{contenuto}</div>
}

/** Una gara registrata: chiusa, il giorno e il tempo; aperta, i suoi tempi. */
function GaraRegistrata({ g, stazioni, onModifica, onElimina }: {
  g: HyroxGara; stazioni: HyroxExercise[]; onModifica: () => void; onElimina: () => void
}) {
  const t = useT()
  const tData = useTData()
  const [aperta, setAperta] = useState(false)
  // Registrata solo in parte: il totale non è il tempo della gara, e va detto.
  const parziale = !(g.corsa > 0) || !(g.roxzone > 0) || stazioni.some(ex => !(g.stazioni[ex.id] > 0))
  const riga = (nome: string, sec: number | undefined, primo = false) => (
    <div key={nome} className="flex items-baseline justify-between gap-3" style={{ padding: '6px 0', borderTop: primo ? 'none' : '1px solid var(--hairline-soft)' }}>
      <span style={{ fontFamily: NUC.font, fontSize: 13, color: NUC.dim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
      <span style={{ fontFamily: NUC.tempo, fontSize: 13, color: sec ? NUC.ink : NUC.faint, flexShrink: 0 }}>{sec ? fmtTempoGara(sec) : '—'}</span>
    </div>
  )
  return (
    <NucCard pad={0} style={{ marginBottom: 8 }}>
      <button onClick={() => setAperta(a => !a)} aria-expanded={aperta} className="j-focus flex items-center justify-between gap-3 w-full"
        style={{ padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink }}>{fmtDayMonthFull(g.date)}</span>
          <span style={{ display: 'block', fontFamily: NUC.label, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tertiary-ink)', marginTop: 2 }}>
            {g.tipo === 'gara' ? t('Gara') : t('Simulazione')} · {g.categoria === 'double' ? t('Double') : t('Singolo')}
            {parziale && <span style={{ color: NUC.faint }}> · {t('parziale')}</span>}
          </span>
        </span>
        <span className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          <span style={{ fontFamily: NUC.tempo, fontSize: 16, color: NUC.ink }}>{fmtTempoGara(totaleGara(g))}</span>
          <span style={{ display: 'flex', color: NUC.faint, transform: aperta ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
            <Icons.chev size={13} stroke={2}/>
          </span>
        </span>
      </button>
      {aperta && (
        <div style={{ borderTop: '1px solid var(--hairline-soft)', padding: '6px 14px 12px' }}>
          {riga(`${t('Corsa')} · 8 km`, g.corsa, true)}
          {stazioni.map(ex => riga(tData(ex.n), g.stazioni[ex.id]))}
          {riga(t('Roxzone'), g.roxzone)}
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <button onClick={onModifica} className="j-btn-ghost flex items-center justify-center gap-1.5" style={{ flex: 1, height: 34, fontFamily: NUC.label, fontSize: 12 }}>
              <Icons.pencil size={12} stroke={1.8}/> {t('Modifica')}
            </button>
            <button onClick={onElimina} aria-label={t('Elimina gara')} style={{
              width: 34, height: 34, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icons.trash size={13} stroke={1.6}/></button>
          </div>
        </div>
      )}
    </NucCard>
  )
}

// ── Hyrox Card ─────────────────────────────────────────────────
// Bassa apposta: nove stazioni devono scorrere in fretta. Il grafico vive nella
// pagina della stazione; qui servono il nome, l'ultimo tempo e il tasto per
// registrare, sulla stessa riga del nome dove il pollice lo trova subito.
export function HyroxCard({ ex, onLog, onDelete, formato }: {
  ex: HyroxExercise
  onLog: (e?: React.MouseEvent) => void
  onDelete?: (e?: React.MouseEvent) => void
  formato: FormatoHyrox
}) {
  const t = useT()
  const tData = useTData()
  // L'ultima sessione e il trend sono quelli della distanza scelta.
  const hist = useMemo(
    () => sortedHistory(ex.history).filter(h => formatoSessione(h, ex.target) === formato),
    [ex.history, ex.target, formato],
  )
  const last = hist[hist.length - 1]
  const prev = hist[hist.length - 2]
  const trend = last && prev ? last.sec - prev.sec : 0
  const trendColor = trend < 0 ? NUC.accentSoft : trend > 0 ? 'var(--danger)' : NUC.faint
  const dist = distanzaLeggibile(formato === 'mezzo' ? ex.target / 2 : ex.target, ex.unit)
  const piccolo: React.CSSProperties = { fontFamily: NUC.label, fontSize: 10, letterSpacing: 1, color: NUC.faint, whiteSpace: 'nowrap' }

  return (
    <NucCard pad={12} style={{ marginBottom: 8 }}>
      <div className="flex items-center gap-2">
        <div style={{ flex: 1, minWidth: 0, fontFamily: NUC.font, fontSize: 16, fontWeight: 500, lineHeight: 1.2, color: NUC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tData(ex.n)}
        </div>
        <button onClick={e => { e.stopPropagation(); onLog(e) }} className="j-btn-log"
          style={{ width: 'auto', height: 32, padding: '0 12px', fontSize: 12, flexShrink: 0 }}>
          <Icons.plus size={13} stroke={2}/> {t('Sessione')}
        </button>
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(e) }} aria-label={t('Elimina')}
            className="flex items-center justify-center w-[32px] h-[32px] rounded-none"
            style={{ background: 'rgba(var(--danger-rgb),0.06)', border: '1px solid rgba(var(--danger-rgb),0.18)', color: 'var(--danger)', cursor: 'pointer', flexShrink: 0 }}>
            <Icons.trash size={14} stroke={1.6}/>
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-2" style={{ marginTop: 6, minWidth: 0 }}>
        <span className="j-eyebrow" style={{ whiteSpace: 'nowrap' }}>{dist}</span>
        {last ? (
          <>
            <span style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.accentSoft, letterSpacing: -0.4, marginLeft: 'auto' }}>{fmtTime(last.sec)}</span>
            <span style={piccolo}>{pace(last.sec, last.units, ex.unit)}</span>
            {trend !== 0 && (
              <span style={{ ...piccolo, color: trendColor }}>{trend < 0 ? '▼' : '▲'} {Math.abs(trend)}s</span>
            )}
          </>
        ) : (
          <span style={{ ...piccolo, marginLeft: 'auto', textTransform: 'uppercase' }}>{t('Nessuna sessione registrata')}</span>
        )}
      </div>
    </NucCard>
  )
}
