import { useId } from 'react'
import { NUC } from '@/lib/jarvis-tokens'
import { useT } from '@/lib/i18n'

// Componenti di disegno condivisi fra i pezzi della scheda Allenamento.
// Stavano in cima a JarvisGym, ma li usano modali, hyrox e statistiche: tenerli
// qui è ciò che permette agli altri file di non importarsi a vicenda.

// ── Line Chart ─────────────────────────────────────────────────
// Due modi di leggere lo stesso disegno, scelti con `yAxis`:
//
//  • senza assi (default) — la sparkline compatta di hyrox e della card volume.
//    `labels` sono didascalie sotto i punti e non pretendono di essere una scala.
//
//  • con assi — il grafico a piena pagina. La grandezza sta sulle ORDINATE, con
//    la sua scala a sinistra, e sulle ascisse c'è il tempo. Prima le etichette
//    sotto i punti erano i valori stessi ("60kg", "62.5kg"): un grafico che
//    ripete i propri numeri invece di dire QUANDO sono stati fatti, e su cui non
//    si poteva leggere un'altezza intermedia.
export interface LineChartProps {
  data: number[]
  /** Etichette dell'asse X (con `yAxis`) o didascalie sotto i punti (senza). */
  labels?: string[]
  height?: number
  color?: string
  labelSize?: number
  /** Disegna la scala dei valori a sinistra e la griglia orizzontale. */
  yAxis?: boolean
  /** Valore scritto SOPRA ogni pallino. Uno per punto, nello stesso ordine. */
  pointLabels?: string[]
  /** Come scrivere un valore sulla scala. Default: arrotondato. */
  yFormat?: (v: number) => string
}

// Estremi "belli" per la scala: un passo di 1/2/5 × 10^n che copra l'intervallo
// in 3 tacche. Senza, la scala andava da 62.5 a 87.5 e nessuna tacca cadeva su
// un numero che si legge al volo.
function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (!(max > min)) {
    // Un solo valore distinto: gli si costruisce attorno un intervallo, altrimenti
    // la linea sarebbe piatta sul bordo e la scala direbbe tre volte lo stesso numero.
    const v = max || 1
    const pad = Math.abs(v) * 0.1 || 1
    return { lo: v - pad, hi: v + pad, ticks: [v - pad, v, v + pad] }
  }
  const raw = (max - min) / 2
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].find(m => m * mag >= raw)! * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  // Tolleranza sull'ultimo passo: la somma di float sfiorava `hi` per un ε e
  // l'ultima tacca — quella in cima, la più letta — spariva.
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(6))
  return { lo, hi, ticks }
}

// Quali punti mostrano la propria etichetta senza che due si sovrappongano.
//
// Il passo dev'essere UNIFORME. La versione precedente distribuiva `maxN`
// etichette arrotondando `i * (n-1)/(maxN-1)`: su 9 punti con 7 etichette usciva
// 0,1,3,4,5,7,8 — coppie di vicini a distanza 1 che si scrivevano addosso, mentre
// altrove restava un buco. Qui il passo è uno solo, ricavato da quanto è larga
// l'etichetta rispetto alla distanza fra due punti.
//
// Si conta a ritroso dall'ULTIMO punto: è quello che si guarda per primo (l'ultima
// sessione) e deve avere sempre la sua data. Se il conto non torna esatto, a
// restare senza etichetta è il primo, che è il meno interessante dei due.
function labelIndexes(n: number, spacing: number, labelW: number): Set<number> {
  const stride = Math.max(1, Math.ceil(labelW / spacing))
  const out = new Set<number>()
  for (let i = n - 1; i >= 0; i -= stride) out.add(i)
  return out
}

export function LineChart({ data, labels, height = 64, color = NUC.accentSoft, labelSize = 8, yAxis = false, yFormat, pointLabels }: LineChartProps) {
  const t = useT()
  const uid = useId().replace(/:/g, '')
  const gradId = `lc-fill-${uid}`

  if (data.length < 2) return (
    <div className="j-empty" style={{ height, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {t('NESSUN DATO')}
    </div>
  )

  const W = 280, H = height
  const big = labelSize > 8
  const fmtY = yFormat ?? ((v: number) => String(Math.round(v)))

  const dataMin = Math.min(...data), dataMax = Math.max(...data)
  const scale = yAxis ? niceScale(dataMin, dataMax) : { lo: dataMin, hi: dataMax, ticks: [] as number[] }
  const range = (scale.hi - scale.lo) || 1

  // Il canale del disegno: gli assi si prendono un margine a sinistra per la
  // scala e in basso per le date, altrimenti la linea ci finirebbe sopra.
  const VALUE_FS = labelSize * 0.85
  // Le date sono la fila che si affolla per prima: "02/05" occupa il doppio di
  // "70", e un corpo leggermente più piccolo ne fa stare parecchie in più. Il
  // valore è tarato perché i due grafici della pagina esercizio mostrino LO STESSO
  // numero di date: le loro scale sono larghe diversamente ("80" contro "120"), e
  // con un corpo più generoso uno ne mostrava nove e l'altro cinque — due assi
  // diversi sotto grafici affiancati si leggono come un difetto.
  const DATE_FS = yAxis ? labelSize * 0.74 : labelSize
  const widthOf = (arr: string[] | undefined, fs: number, gap: number) =>
    arr && arr.length ? Math.max(...arr.map(l => l.length)) * fs * 0.62 + gap : 0
  const dateW  = yAxis ? widthOf(labels, DATE_FS, 3) : 0
  const valueW = widthOf(pointLabels, VALUE_FS, 4)

  // Distacco fra la scala e l'asse. Deve coprire la metà SINISTRA del valore
  // scritto sopra il primo pallino, che sborda oltre l'asse: allargare il margine
  // non bastava, perché la scala è ancorata al margine e si spostava con lui —
  // restavano attaccate e si leggeva "8076". Qui è la scala ad arretrare.
  const Y_GAP = pointLabels ? valueW / 2 + 3 : 5
  const LEFT = yAxis
    ? Math.max(26, fmtY(scale.hi).length * (labelSize * 0.62) + Y_GAP + 2)
    : 0
  // Le etichette sono tutte CENTRATE sul proprio punto, comprese la prima e
  // l'ultima. Prima le due estreme erano ancorate al bordo (`start` / `end`) per
  // non uscire dal riquadro: così però finivano tutte da un lato solo del punto e
  // si sovrapponevano al vicino, proprio dove lo spazio è più stretto. Riservare
  // mezza etichetta di margine a destra costa qualche pixel e toglie il caso
  // speciale — a sinistra il margine della scala è già più che sufficiente.
  const RIGHT = Math.max(dateW, valueW) / 2
  // Con i valori sopra i pallini serve aria in cima, o il punto più alto
  // scriverebbe il proprio numero fuori dal riquadro.
  const TOP = pointLabels ? labelSize * 1.8 : (yAxis ? labelSize * 0.7 : (big ? 12 : 6))
  const BOTTOM = labelSize + (yAxis ? 10 : 8)
  const plotW = W - LEFT - RIGHT
  const plotH = H - TOP - BOTTOM
  const dotR = big ? 3.4 : 2.5

  const pts = data.map((v, i) => ({
    x: LEFT + (i / (data.length - 1)) * plotW,
    y: TOP + (1 - (v - scale.lo) / range) * plotH,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${LEFT + plotW},${TOP + plotH} L${LEFT},${TOP + plotH} Z`

  // Le due file si contano separatamente: "21/08" occupa il doppio di "70", e
  // diradarle con lo stesso passo avrebbe nascosto valori che ci stavano benissimo.
  const spacing = plotW / (data.length - 1)
  const xShow = yAxis && labels ? labelIndexes(labels.length, spacing, dateW) : null
  const vShow = pointLabels ? labelIndexes(pointLabels.length, spacing, valueW) : null

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Griglia e scala dei valori */}
        {yAxis && scale.ticks.map(t => {
          const y = TOP + (1 - (t - scale.lo) / range) * plotH
          return (
            <g key={t}>
              <line x1={LEFT} y1={y} x2={W} y2={y} stroke="var(--hairline)" strokeWidth={0.6}/>
              <text x={LEFT - Y_GAP} y={y + labelSize * 0.35} textAnchor="end" fill={NUC.faint}
                style={{ fontFamily: NUC.label, fontSize: labelSize * 0.85 }}>{fmtY(t)}</text>
            </g>
          )
        })}

        <path d={areaD} fill={`url(#${gradId})`}/>
        <path d={pathD} fill="none" stroke={color} strokeWidth={big ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={dotR} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}/>
        ))}

        {/* Il valore di ogni punto, appoggiato sopra il pallino. Rende leggibile
            l'esatto senza costringere a inseguire la griglia con l'occhio. */}
        {pointLabels && pointLabels.map((v, i) => (
          vShow && !vShow.has(i) ? null : (
            <text key={`v${i}`} x={pts[i].x} y={pts[i].y - dotR - VALUE_FS * 0.45}
              textAnchor="middle" fill={NUC.dim}
              style={{ fontFamily: NUC.label, fontSize: VALUE_FS, letterSpacing: 0.2 }}>{v}</text>
          )
        ))}

        {labels && labels.map((l, i) => (
          xShow && !xShow.has(i) ? null : (
            <text key={i} x={pts[i].x} y={H - (big ? 4 : 2)} textAnchor="middle" fill={big ? NUC.dim : NUC.faint}
              style={{ fontFamily: NUC.label, fontSize: DATE_FS, letterSpacing: big ? 0.3 : 1 }}>{l}</text>
          )
        ))}
      </svg>
    </div>
  )
}

// ── Segnalibro del gruppo muscolare (nastro in alto a sinistra) ─
export function BookmarkRibbon({ color, width = 14, height = 30 }: { color: string; width?: number; height?: number }) {
  const notch = width * 0.42
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', filter: 'drop-shadow(0 2px 3px rgba(42,36,24,0.28))' }}>
      <path d={`M0 0 H${width} V${height} L${width / 2} ${height - notch} L0 ${height} Z`} fill={color}/>
    </svg>
  )
}
