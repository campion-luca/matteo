import { describe, it, expect } from 'vitest'
import { accentFgFor, accentInkFor, ACCENT_PALETTES, paletteFor } from '@/lib/jarvis-tokens'

const LIGHT_CARD = '#f7f3e8'
const DARK_CARD = '#1c1c1c'

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
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

// Ogni palette selezionabile o persistibile.
const PALETTE_KEYS = ['warm', 'green', 'pink', 'rose', 'cipria', 'malva', 'notte'] as const

describe('accentInkFor — accent leggibile come testo', () => {
  it.each(PALETTE_KEYS)('%s raggiunge AA sulla card chiara', key => {
    const ink = accentInkFor(ACCENT_PALETTES[key].accent, false)
    expect(contrast(ink, LIGHT_CARD)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(PALETTE_KEYS)('%s raggiunge AA sulla card scura', key => {
    const ink = accentInkFor(ACCENT_PALETTES[key].accent, true)
    expect(contrast(ink, DARK_CARD)).toBeGreaterThanOrEqual(4.5)
  })

  it('lascia invariato un accent già leggibile', () => {
    // Nero puro su carta chiara: nessun aggiustamento necessario.
    expect(accentInkFor('#000000', false)).toBe('#000000')
  })
})

describe('accentFgFor — inchiostro sopra un fondo accent', () => {
  it.each(PALETTE_KEYS)('%s ottiene un contrasto AA sul proprio accent', key => {
    const accent = ACCENT_PALETTES[key].accent
    expect(contrast(accentFgFor(accent), accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('sceglie la crema sugli accent scuri', () => {
    expect(accentFgFor('#211C18')).toBe('#f2f7f0')  // "Notte"
  })

  it('sceglie l\'inchiostro scuro sugli accent chiari', () => {
    expect(accentFgFor('#E7CBC4')).toBe('#26221b')  // "Cipria" — la crema vi spariva
    expect(accentFgFor('#C58A7C')).toBe('#26221b')  // "Rosa"
  })
})

describe('paletteFor', () => {
  it('risolve gli accent legacy: green→Journal (default), pink→warm', () => {
    // `green` è ora il tema "Journal" di default; `pink` resta alias di warm.
    expect(paletteFor('green')).toEqual(ACCENT_PALETTES.green)
    expect(paletteFor('pink')).toEqual(ACCENT_PALETTES.warm)
  })

  it('non restituisce mai undefined per un valore sconosciuto', () => {
    // Dato persistito corrotto: deve degradare sul default Journal, non crashare.
    expect(paletteFor('inesistente' as never)).toEqual(ACCENT_PALETTES.green)
  })

  it('usa l\'hex custom quando presente, altrimenti ripiega sul default', () => {
    expect(paletteFor('custom', '#336699').accent).toBe('#336699')
    expect(paletteFor('custom')).toEqual(ACCENT_PALETTES.green)
  })
})
