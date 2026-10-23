import { describe, it, expect } from 'vitest'
import { accentFgFor, accentInkFor } from '@/lib/jarvis-tokens'
import { MUSCLE_COLORS, COLOR_PALETTE } from '@/features/gym/gymModel'

// Il tema è uno solo (rebranding, ott 2026): i colori si leggono da `:root` in
// globals.css, gli stessi che vede l'app, e si misura che le coppie che l'app
// usa davvero reggano AA (4.5:1). Se qualcuno cambia un colore lassù, è qui che
// si scopre che una scritta non si legge più.

const CSS = Object.values(import.meta.glob('/src/styles/globals.css', { query: '?raw', import: 'default', eager: true }))[0] as string
const ROOT = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('\n}', CSS.indexOf(':root {')))
function token(nome: string): string {
  const m = ROOT.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`--${nome} non è un colore esadecimale in :root`)
  return m[1]
}

function relLum(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const la = relLum(a), lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

describe('la palette si legge', () => {
  const fondi = { fondo: token('bg'), card: token('surface') }

  it.each(Object.entries(fondi))('testo, secondario e accento-come-testo reggono sul %s', (_, fondo) => {
    expect(contrast(token('fg'), fondo)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('fg-mute'), fondo)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('j-accent-ink'), fondo)).toBeGreaterThanOrEqual(4.5)
  })

  // Il bianco sui tasti arancioni è una scelta di design: regge la soglia delle
  // scritte grandi (3:1), e i tasti pieni scrivono in grande e in grassetto.
  it('la scritta sopra un tasto d’accento regge come scritta grande', () => {
    expect(contrast(token('j-accent-fg'), token('j-accent'))).toBeGreaterThanOrEqual(3)
  })

  it('sulla card nera reggono l’accento e il secondario chiaro', () => {
    expect(contrast(token('j-accent'), token('ink'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(token('muted-dark'), token('ink'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('un tema solo', () => {
  it('in globals.css non restano i temi tolti', () => {
    for (const tema of ['.dark {', '.premium {', ':root.neon', ':root.logbook', '.bg-fusione']) {
      expect(CSS).not.toContain(tema)
    }
  })
})

// I colori dei gruppi muscolari non sono del tema: li sceglie l'utente. Quando
// fanno da testo o da fondo sotto un testo, passano da queste due funzioni.
const COLORI_DATI = [...new Set([...Object.values(MUSCLE_COLORS), ...COLOR_PALETTE])]

describe('accentInkFor — un colore dei dati come testo', () => {
  it.each(COLORI_DATI)('%s raggiunge AA sul fondo', hex => {
    expect(contrast(accentInkFor(hex), token('bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('lascia invariato un colore già leggibile', () => {
    expect(accentInkFor('#000000')).toBe('#000000')
  })
})

describe('accentFgFor — il testo sopra un colore dei dati', () => {
  it.each(COLORI_DATI)('%s ha sopra un testo AA', hex => {
    expect(contrast(accentFgFor(hex), hex)).toBeGreaterThanOrEqual(4.5)
  })

  it('bianco sugli scuri, nero sui chiari', () => {
    expect(accentFgFor('#211C18')).toBe('#FFFFFF')
    expect(accentFgFor('#E7CBC4')).toBe('#141414')
  })
})
