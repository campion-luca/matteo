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
import type { HyroxExercise, HyroxHistoryEntry } from '@/store/useJarvisStore'
import { useConfirmDelete } from '@/hooks/useConfirmDelete'
import { fmtTime, pace, sortedHistory } from './gymModel'
import {
  type FormatoHyrox, type StimaSegmento, type Categoria, type Contesto,
  formatoSessione, distanzaLeggibile, stimaGara, fmtTempoGara,
  FATICA_CORSA, ROXZONE_PASSAGGI, ROXZONE_SEC, MIN_PER_PROFILO,
} from './hyroxStima'
import { readStorage, writeStorage } from '@/lib/safeStorage'
import { EditHyroxHistModal } from './gymModals'
import { FormatoSwitch } from './FormatoSwitch'
import { LineChart } from './gymShared'
import { fmtShortDate } from '@/lib/dateFormat'

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

        {/* Tutte le sessioni in vista, come nella pagina di un esercizio dei pesi:
            chiuse dietro una tendina erano il contenuto della pagina nascosto. */}
        <NucEyebrow right={visibili.length === 1 ? t('1 sessione') : t('{n} sessioni', { n: visibili.length })}>{t('Storico')}</NucEyebrow>

        {visibili.length === 0 && (
          <div className="j-empty">{t('Nessuna sessione da {dist}', { dist: formato === 'mezzo' ? distMezza : distIntera })}</div>
        )}

        {[...visibili].reverse().map(({ h, idx: realIdx }) => {
          const dateStr = h.date ? fmtShortDate(h.date) : h.d
          return (
            <div key={realIdx} className="flex items-center gap-2 py-2.5" style={{ borderBottom: '1px solid var(--hairline-soft)' }}>
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

// ── Riepilogo gara ─────────────────────────────────────────────
// Il tempo di gara che i tuoi allenamenti promettono, segmento per segmento.
// I conti stanno in hyroxStima, puri e testati; qui c'è solo il modo di leggerli.
//
// Tre cose si vedono sempre, perché una stima che non dice come è fatta non è
// una stima, è un numero: DA DOVE viene ogni segmento (gara, simulazione,
// allenamento, o completato dal profilo), QUANTO pesano le ipotesi (fatica in
// corsa, turni in coppia, Roxzone) e QUANTO fidarsi (il ± sotto il tempo).

const CATEGORIA_KEY = 'jarvis-categoria-hyrox'

export function RaceSummary({ raceStations, runStation }: {
  raceStations: HyroxExercise[]
  runStation: HyroxExercise
}) {
  const t = useT()
  const tData = useTData()
  // La categoria che corri. Si ricorda sul dispositivo come la distanza: il
  // default è il double, e cambiarla cambia anche come si leggono le gare
  // registrate — una gara in coppia ha stazioni più brevi di una da solo.
  const [categoria, setCategoriaState] = useState<Categoria>(
    () => readStorage('local', CATEGORIA_KEY) === 'singolo' ? 'singolo' : 'double',
  )
  const setCategoria = (c: Categoria) => { setCategoriaState(c); writeStorage('local', CATEGORIA_KEY, c) }

  const g = useMemo(() => stimaGara(runStation, raceStations, categoria), [runStation, raceStations, categoria])
  const tempi = g.tempi[categoria]
  const altra: Categoria = categoria === 'double' ? 'singolo' : 'double'
  const nomeCat = (c: Categoria) => c === 'double' ? t('Double') : t('Singolo')
  const sec = (x: number) => fmtTime(Math.round(x))

  // "× 2,09": quanto si moltiplica il tempo della mezza. È 2^k, e dice la stessa
  // cosa dell'esponente in un modo che si capisce senza sapere chi è Riegel.
  const fattore = (k: number) => Math.pow(2, k).toFixed(2).replace('.', ',')
  const nomeContesto = (c: Contesto) => c === 'gara' ? t('gara') : c === 'simulazione' ? t('simulazione') : t('allenamento')

  const provenienza = (stima: StimaSegmento, target: number, unit: HyroxExercise['unit']) => {
    if (stima.fonte === 'mancante') return t('nessuna sessione')
    if (stima.fonte === 'profilo') return t('dal tuo profilo')
    const parti = [stima.contesti.map(nomeContesto).join(' + ')]
    if (stima.daMezza) parti.push(`${t('da {dist}', { dist: distanzaLeggibile(target / 2, unit) })} × ${fattore(stima.k)}`)
    if (stima.kPersonale) parti.push(t('tarato su di te'))
    return parti.join(' · ')
  }

  const riga = (id: string, nome: string, sotto: string, stima: StimaSegmento, target: number, unit: HyroxExercise['unit'],
    valore: number | undefined, extra?: string, ultima = false) => (
    <div key={id} className="flex justify-between items-center gap-3 py-3"
      style={{ borderBottom: ultima ? 'none' : '1px solid var(--hairline-soft)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NUC.font, fontSize: 15, fontWeight: 500, color: NUC.ink }}>{nome}</div>
        <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 2, lineHeight: 1.45 }}>
          {sotto} · <span style={{ color: stima.fonte === 'profilo' || stima.daMezza ? 'var(--tertiary-ink)' : undefined }}>
            {provenienza(stima, target, unit)}
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {valore !== undefined ? (
          <>
            <div style={{ fontFamily: NUC.label, fontSize: 15, color: stima.fonte === 'profilo' ? NUC.dim : NUC.accentSoft, letterSpacing: -0.5 }}>{sec(valore)}</div>
            {extra && <div style={{ fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 1 }}>{extra}</div>}
          </>
        ) : (
          <div style={{ fontFamily: NUC.label, fontSize: 14, color: NUC.faint }}>—</div>
        )}
      </div>
    </div>
  )

  const voce = (label: string, valore: string, forte = false) => (
    <div className="flex justify-between items-baseline gap-3" style={{ padding: '4px 0' }}>
      <span style={{ fontFamily: NUC.label, fontSize: 10.5, letterSpacing: '.04em', color: forte ? NUC.ink : NUC.faint }}>{label}</span>
      <span style={{ fontFamily: NUC.label, fontSize: forte ? 13 : 12, color: forte ? NUC.ink : NUC.dim, fontWeight: forte ? 600 : 400, flexShrink: 0 }}>{valore}</span>
    </div>
  )

  const ultimaGara = g.gare[g.gare.length - 1]
  const ultimaSim = g.simulazioni[g.simulazioni.length - 1]
  const basi = [
    ultimaGara && t('gara del {d}', { d: fmtShortDate(ultimaGara) }),
    ultimaSim && t('simulazione del {d}', { d: fmtShortDate(ultimaSim) }),
  ].filter(Boolean).join(' · ')

  const piccolo: React.CSSProperties = { fontFamily: NUC.label, fontSize: 10, color: NUC.faint, marginTop: 4, letterSpacing: .2 }

  return (
    <div>
      <FormatoSwitch<Categoria>
        valore={categoria} onChange={setCategoria}
        valori={['double', 'singolo']} etichette={[t('Double'), t('Singolo')]}
        etichettaGruppo={t('Categoria')}
        style={{ marginBottom: 14 }}
      />

      <NucCard pad={16} style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: NUC.label, fontSize: 10, letterSpacing: 1.5, color: NUC.faint, textTransform: 'uppercase', marginBottom: 8 }}>
            {t('Tempo gara stimato')} · {nomeCat(categoria)}
          </div>
          <div style={{ fontFamily: NUC.label, fontSize: 32, color: tempi ? NUC.accentSoft : NUC.faint, letterSpacing: -1.5, lineHeight: 1 }}>
            {tempi ? fmtTempoGara(tempi.totale) : '—'}
          </div>
          {tempi && g.margine !== null && (
            <div style={{ fontFamily: NUC.label, fontSize: 12, color: NUC.dim, marginTop: 6 }}>± {sec(g.margine)}</div>
          )}
          {g.tempi[altra] && (
            <div style={{ ...piccolo, marginTop: 8, fontSize: 11 }}>
              {nomeCat(altra)}: {fmtTempoGara(g.tempi[altra]!.totale)}
            </div>
          )}

          <div style={{ ...piccolo, marginTop: 10 }}>
            {t('{n}/{tot} segmenti misurati', { n: g.misurati, tot: g.totaleSegmenti })}
            {g.daProfilo > 0 && ` · ${t('{n} dal tuo profilo', { n: g.daProfilo })}`}
          </div>
          <div style={{ ...piccolo, color: basi ? 'var(--tertiary-ink)' : NUC.faint }}>
            {basi || t('nessuna gara né simulazione: stima dagli allenamenti')}
          </div>
          {!tempi && (
            <div style={{ ...piccolo, opacity: .8 }}>
              {t('Servono almeno {n} segmenti registrati', { n: MIN_PER_PROFILO })} · {t('logga le sessioni mancanti nella scheda Esercizi')}
            </div>
          )}
        </div>

        {/* Come è fatto il numero: ogni ipotesi ha la sua riga, così si vede quanto pesa. */}
        {tempi && (
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--divider)' }}>
            {voce(t('Corsa 8 × {p} (fatica +{f}%)', { p: sec(tempi.corsaKm), f: Math.round((FATICA_CORSA[categoria] - 1) * 100) }), fmtTempoGara(tempi.corsa))}
            {voce(categoria === 'double' ? t('Stazioni a turni in due') : t('Stazioni da solo'), fmtTempoGara(tempi.stazioni))}
            {voce(t('Roxzone ({n} × {s} s)', { n: ROXZONE_PASSAGGI, s: ROXZONE_SEC }), fmtTempoGara(tempi.roxzone))}
            <div style={{ borderTop: '1px solid var(--hairline-soft)', marginTop: 4, paddingTop: 4 }}>
              {voce(t('Stima gara'), fmtTempoGara(tempi.totale), true)}
            </div>
          </div>
        )}
      </NucCard>

      <NucCard pad={16} style={{ marginBottom: 16 }}>
        {riga(runStation.id, t('Corsa 1 km'), '1 km × 8', g.corsa, runStation.target, runStation.unit,
          tempi?.corsaKm, tempi ? `× 8 = ${fmtTempoGara(tempi.corsa)}` : undefined)}
        {g.stazioni.map(({ ex, stima }, idx) => riga(
          ex.id, tData(ex.n), distanzaLeggibile(ex.target, ex.unit), stima, ex.target, ex.unit,
          tempi?.perStazione[ex.id],
          // In double il tempo è della coppia: accanto, quello tuo da solo, perché
          // è la misura che alleni e che registri.
          tempi && categoria === 'double' && stima.fresco !== null ? t('da solo {t}', { t: sec(stima.fresco) }) : undefined,
          idx === g.stazioni.length - 1,
        ))}
      </NucCard>

      {/* Il ragionamento, in chiaro: chi guarda un tempo deve poter sapere cosa ci
          sta dietro senza aprire il codice. */}
      <NucCard pad={14}>
        <NucEyebrow>{t('Come ragiona la stima')}</NucEyebrow>
        <div style={{ fontFamily: NUC.font, fontSize: 12, color: NUC.dim, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>{t('1. Ogni sessione viene riportata a te da solo e a gambe fresche: alla corsa di gara si toglie la fatica, alle stazioni di una gara in double i turni col compagno, e una mezza si porta alla distanza intera.')}</div>
          <div>{t('2. Una gara o una simulazione si riconoscono da sole (5 segmenti lo stesso giorno) e contano più degli allenamenti. I segmenti che mancano si completano col tuo profilo, se ne hai registrati almeno 3.')}</div>
          <div>{t('3. La gara si rimonta nella categoria: corsa +10% in singolo e +5% in double, stazioni a turni in due, 16 passaggi in Roxzone da 25 s. In double si suppone un compagno del tuo livello.')}</div>
        </div>
      </NucCard>
    </div>
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
