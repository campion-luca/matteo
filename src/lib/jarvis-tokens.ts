// Office / Paper design tokens
export const NUC = {
  bg:         'var(--bg)',
  surface:    'var(--surface)',
  surface2:   'var(--surface-2)',
  ink:        'var(--fg)',
  dim:        'var(--fg-soft)',
  faint:      'var(--fg-mute)',
  hairline:   'var(--hairline)',
  card:       'var(--surface)',
  cardStrong: 'var(--surface-2)',
  accent:     'var(--j-accent)',
  accentSoft: 'var(--j-accent-soft)',
  accentDeep: 'var(--j-accent-deep)',
  // Typography roles (tema "Journal"):
  //  serif  → Fraunces (titoli, titoli card/evento, nomi cliente & muscolo, mese calendario)
  //  font   → Inter (corpo / sans di default)
  //  label  → Inter (label, metadati, numeri, bottoni, chip, nav; eyebrow in maiuscoletto spaziato)
  serif:      "'Fraunces', Georgia, serif",
  font:       "'Inter', system-ui, sans-serif",
  label:      "'Inter', system-ui, sans-serif",
} as const

export type AccentColor = 'green' | 'pink' | 'rose' | 'cipria' | 'malva' | 'notte' | 'custom'

export interface AccentPalette {
  accent: string; accentSoft: string; accentDeep: string
  rgb: string; softRgb: string; deepRgb: string
  // Variante dark esplicita: se presente, in dark mode si usa questa invece di
  // schiarire l'accent (serve al tema "Journal", dove l'azione passa a oro/foil).
  darkVariant?: AccentPalette
}

const WARM: AccentPalette = {
  accent:     '#8b4a2a', accentSoft: '#a96040', accentDeep: '#6d3318',
  rgb:        '139,74,42', softRgb: '169,96,64', deepRgb: '109,51,24',
}

// Tema "Journal": in light l'azione è verde copertina; in dark diventa oro (foil).
const JOURNAL_GOLD: AccentPalette = {
  accent:     '#c9a25e', accentSoft: '#d8b87e', accentDeep: '#b08a47',
  rgb:        '201,162,94', softRgb: '216,184,126', deepRgb: '176,138,71',
}
const JOURNAL: AccentPalette = {
  accent:     '#2c5847', accentSoft: '#47775f', accentDeep: '#1c3e31',
  rgb:        '44,88,71', softRgb: '71,119,95', deepRgb: '28,62,49',
  darkVariant: JOURNAL_GOLD,
}

// Chiavi = gli `AccentColor` che sono una palette fissa ('custom' la costruisce
// `buildCustomPalette` dall'hex scelto), più 'warm', che non è selezionabile ma è
// il bersaglio dell'alias legacy 'pink'.
// Qui c'era anche 'slate': non compare in `AccentColor`, quindi nessun valore —
// né dal picker né dai dati persistiti — poteva raggiungerla. Rimossa.
export const ACCENT_PALETTES: Record<Exclude<AccentColor, 'custom'> | 'warm', AccentPalette> = {
  warm: WARM,
  rose: {
    accent:     '#C58A7C', accentSoft: '#E3A89A', accentDeep: '#A76C5E',
    rgb:        '197,138,124', softRgb: '227,168,154', deepRgb: '167,108,94',
  },
  cipria: {
    accent:     '#E7CBC4', accentSoft: '#FFE9E2', accentDeep: '#C9ADA6',
    rgb:        '231,203,196', softRgb: '255,233,226', deepRgb: '201,173,166',
  },
  malva: {
    accent:     '#A26870', accentSoft: '#C0868E', accentDeep: '#844A52',
    rgb:        '162,104,112', softRgb: '192,134,142', deepRgb: '132,74,82',
  },
  notte: {
    accent:     '#211C18', accentSoft: '#3F3A36', accentDeep: '#030000',
    rgb:        '33,28,24', softRgb: '63,58,54', deepRgb: '3,0,0',
  },
  // `green` è ora il tema "Journal" (verde copertina) ed è la palette di default:
  // gli utenti che non hanno mai scelto un accent hanno `accentColor: 'green'`
  // persistito, quindi vedono Journal automaticamente.
  green: JOURNAL,
  // `pink` è un nome legacy possibilmente persistito: alias di warm per non
  // rompere il lookup di vecchi dati.
  pink:  WARM,
}

// Risolve l'AccentColor persistito nella sua palette, con fallback sicuro:
// un valore sconosciuto (dato vecchio o corrotto) non deve dare `undefined`.
export function paletteFor(accent: AccentColor, customHex?: string): AccentPalette {
  if (accent === 'custom') return customHex ? buildCustomPalette(customHex) : JOURNAL
  return ACCENT_PALETTES[accent] ?? JOURNAL
}

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

function darken(hex: string, amt: number): string {
  return lighten(hex, -amt)
}

export function buildCustomPalette(hex: string): AccentPalette {
  const soft = lighten(hex, 30)
  const deep = darken(hex, 30)
  const [r, g, b] = hexToRgb(hex)
  const [rs, gs, bs] = hexToRgb(soft)
  const [rd, gd, bd] = hexToRgb(deep)
  return {
    accent: hex,
    accentSoft: soft,
    accentDeep: deep,
    rgb: `${r},${g},${b}`,
    softRgb: `${rs},${gs},${bs}`,
    deepRgb: `${rd},${gd},${bd}`,
  }
}

// In dark mode a near-black accent (e.g. the "Notte" palette = #211C18) becomes
// indistinguishable from the dark background, making accent text/borders/buttons
// invisible. Only lift critically-dark accents; normal palettes pass through unchanged.
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

// Superficie di riferimento per la spinta ad AA: è `--surface-2`, NON `--surface`
// (devono restare allineate a globals.css). Il testo accent non vive quasi mai sulla
// card nuda: sta nelle tile del riepilogo, nei chip — tutte in `--surface-2`, che
// è il caso PEGGIORE in entrambi i temi (più chiara
// del fondo in dark, più scura in light). Puntando a `--surface` l'oro si fermava a
// 4.45:1 sulle tile pur risultando "a norma" sul fondo di riferimento sbagliato.
const LIGHT_CARD = '#efe8d8'
const DARK_CARD  = '#1c1c1c'
// I due inchiostri disponibili sopra un fondo accent.
const CREAM = '#f2f7f0'
const INK   = '#26221b'

// Accent per il TESTO (--j-accent-ink). L'accent "interattivo" (--j-accent) è
// scelto per fare da SFONDO ai bottoni, quindi come testo può cadere sotto AA:
// scuro su dark (es. "Notte" ~1.2:1), chiaro su light (es. "Rosa" ~2.5:1).
// Qui lo spingiamo lontano dalla superficie finché non supera 4.5:1, mantenendo
// la tinta. Se l'accent è già leggibile passa invariato.
export function accentInkFor(hex: string, dark: boolean): string {
  return pushToAA(hex, dark ? DARK_CARD : LIGHT_CARD, dark)
}

// Spinge `from` lontano da `bg` (schiarendo o scurendo) finché non supera AA.
function pushToAA(from: string, bg: string, up: boolean): string {
  let c = from
  for (let i = 0; i < 32 && contrast(c, bg) < 4.6; i++) c = up ? lighten(c, 8) : darken(c, 8)
  return c
}

// Inchiostro per il testo/icone SOPRA un fondo accent (--j-accent-fg). La crema
// funziona sugli accent scuri (terracotta, notte) ma sparisce su quelli chiari
// (rosa #C58A7C ≈ 2.5:1, cipria #E7CBC4 ≈ 1.2:1): lì serve inchiostro scuro.
// Sugli accent di luminanza intermedia (malva #A26870) nessuno dei due arriva ad
// AA senza essere spinto, e il lato "migliore in partenza" non è quello che vince
// alla fine: col nero malva si ferma a 4.42:1, col bianco arriva a 4.75:1. Perciò
// entrambi i lati vengono portati al limite e si sceglie il più contrastato.
export function accentFgFor(hex: string): string {
  const light = pushToAA(CREAM, hex, true)
  const dark  = pushToAA(INK, hex, false)
  return contrast(light, hex) >= contrast(dark, hex) ? light : dark
}

// ── Layout "Notte" ─────────────────────────────────────────────
// Non è una palette accent fra le altre: spegne il colore in tutta l'app, e per
// questo vive in "Cambio layout" e non in "Tema colore". Il resto dei token grigi
// sta nei blocchi `.mono` / `.mono.dark` di globals.css.
//
// Attenzione: queste due palette NON vanno passate ad `adjustPaletteForDark` — su un
// accent near-black quella funzione schiarisce fino a un grigio-talpa (era il destino
// della vecchia palette "Notte": #211C18 → #726d69). Qui si sceglie la variante a
// monte, in App.tsx.
export const MONO_LIGHT: AccentPalette = {
  accent:     '#1f1f1f', accentSoft: '#4a4a4a', accentDeep: '#000000',
  rgb:        '31,31,31', softRgb: '74,74,74', deepRgb: '0,0,0',
}
export const MONO_DARK: AccentPalette = {
  accent:     '#ededed', accentSoft: '#bdbdbd', accentDeep: '#ffffff',
  rgb:        '237,237,237', softRgb: '189,189,189', deepRgb: '255,255,255',
}

// Hex dei DATI utente (colore del gruppo muscolare) → grigio.
// Questi hex sono persistiti nello store e sincronizzati sul cloud: arrivano da JS
// come `background: cat.color`, quindi nessun override CSS può raggiungerli.
//
// La sola luma non basta: mapperebbe le tinte su tutto [0,255] e i grigi chiari
// sparirebbero sul fondo bianco (e quelli scuri sul fondo nero). Il valore viene
// perciò rimappato in una banda che resta staccata dal fondo del tema.
export function toMono(hex: string, dark: boolean): string {
  const [r, g, b] = hexToRgb(hex)
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const [lo, hi] = dark ? [0x70, 0xf0] : [0x18, 0x80]
  const c = Math.round(lo + y * (hi - lo)).toString(16).padStart(2, '0')
  return `#${c}${c}${c}`
}

export function adjustPaletteForDark(p: AccentPalette): AccentPalette {
  // Variante dark esplicita (tema "Journal": verde → oro). Ha la precedenza sul
  // semplice schiarimento, così l'azione cambia metallo invece di sbiadire.
  if (p.darkVariant) return p.darkVariant
  const [r, g, b] = hexToRgb(p.accent)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  if (brightness >= 70) return p
  return buildCustomPalette(lighten(p.accent, Math.round(110 - brightness)))
}
