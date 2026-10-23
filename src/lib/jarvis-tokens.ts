import type { CSSProperties } from 'react'

// I token del tema, per gli stili scritti inline (vedi globals.css).
export const NUC = {
  bg:         'var(--bg)',
  surface:    'var(--surface)',
  surface2:   'var(--surface-2)',
  ink:        'var(--ink)',
  dim:        'var(--fg-soft)',
  faint:      'var(--fg-mute)',
  hairline:   'var(--hairline)',
  card:       'var(--surface)',
  cardStrong: 'var(--surface-2)',
  accent:     'var(--j-accent)',
  accentSoft: 'var(--j-accent-soft)',
  accentDeep: 'var(--j-accent-deep)',
  // Typography roles (vedi `--font-display` e `--font-body` in globals.css):
  //  font    → Barlow: il testo corrente — nomi degli esercizi, righe di dettaglio
  //  label   → Barlow Condensed: titoli, numeri, etichette, tasti, chip, date
  //  display → lo stesso Condensed, detto col suo nome dove è un titolo
  font:       "'Barlow', system-ui, sans-serif",
  label:      "'Barlow Condensed', system-ui, sans-serif",
  display:    "'Barlow Condensed', system-ui, sans-serif",
  //  tempo  → i tempi di gara Hyrox, e solo quelli: si leggono come un
  //           cronometro, a cifre larghe uguali. Il monospaziato di sistema
  //           (SF Mono su iPhone e Mac): nessun carattere in più da scaricare.
  tempo:      "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace",
} as const

// ── Un tema solo ───────────────────────────────────────────────
// Fino al rebranding di ottobre 2026 qui c'erano le palette da scegliere
// (Journal, Rosa, Malva, un colore a piacere) e i layout a tema fisso (Premium,
// Neon, Logbook), con le funzioni per adattarli al chiaro e allo scuro. Adesso i
// colori sono quelli di `:root` in globals.css, uguali per tutti. Restano qui
// solo i conti di leggibilità che servono ai colori che NON sono del tema: quelli
// dei gruppi muscolari, scelti dall'utente e salvati nei suoi dati.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp(v: number): number { return Math.min(255, Math.max(0, v)) }

function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `#${[clamp(r + amt), clamp(g + amt), clamp(b + amt)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

function relLum(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const la = relLum(a), lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Superficie di riferimento per la spinta ad AA: il fondo cemento (`--bg`, uguale
// a `--surface-2`). È il caso peggiore: sul bianco delle card ogni colore che
// regge sul cemento regge anche lì. Va tenuta allineata a globals.css.
const FONDO = '#F1F1EF'
// I due inchiostri disponibili sopra un fondo colorato: il bianco e il nero del tema.
const BIANCO = '#FFFFFF'
const NERO   = '#141414'

// Spinge `from` lontano da `bg` (schiarendo o scurendo) finché non supera AA.
function pushToAA(from: string, bg: string, up: boolean): string {
  let c = from
  for (let i = 0; i < 32 && contrast(c, bg) < 4.6; i++) c = lighten(c, up ? 8 : -8)
  return c
}

/** Un colore usato COME TESTO sul fondo chiaro: scurito, mantenendo la tinta,
 *  finché non supera AA. Se è già leggibile passa invariato. */
export function accentInkFor(hex: string): string {
  return pushToAA(hex, FONDO, false)
}

/** Il testo SOPRA un fondo colorato: bianco o nero, quello che si legge meglio.
 *  Su un colore di luminanza intermedia nessuno dei due arriva ad AA senza
 *  essere spinto, e il lato "migliore in partenza" non è quello che vince alla
 *  fine: si portano entrambi al limite e si sceglie il più contrastato. */
export function accentFgFor(hex: string): string {
  const light = pushToAA(BIANCO, hex, true)
  const dark  = pushToAA(NERO, hex, false)
  return contrast(light, hex) >= contrast(dark, hex) ? light : dark
}

// ── Interruttori a segmenti ──────────────────────────────
/** Le due variabili che fanno scorrere il cursore di `.j-switch` (globals.css):
 *  quale cella è scelta e quante sono. Una funzione e non due prop scritte a
 *  mano in ogni interruttore, perché scritte a mano si sbaglia l'indice e il
 *  cursore si ferma sulla cella sbagliata senza che niente segnali l'errore. */
export function cursore(indice: number, quante: number): CSSProperties {
  return { '--i': Math.max(0, indice), '--n': quante } as CSSProperties
}
