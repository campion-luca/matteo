import { describe, it, expect } from 'vitest'
import { accentFgFor, accentInkFor, ACCENT_PALETTES, ACCENT_FISSI, temaFisso, paletteFor, PREMIUM_ACCENT } from '@/lib/jarvis-tokens'

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

describe('accent di Premium', () => {
  // Premium è il layout di DEFAULT: il suo accent non passa dal picker (App.tsx
  // lo sceglie a monte) e quindi non finisce in PALETTE_KEYS. È però il colore
  // che vede quasi tutti, ed è quello che nessun test copriva quando era bianco.
  it('come fondo di un tasto regge il testo sopra', () => {
    expect(contrast(accentFgFor(PREMIUM_ACCENT.accent), PREMIUM_ACCENT.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('come testo su fondo scuro raggiunge AA', () => {
    expect(contrast(accentInkFor(PREMIUM_ACCENT.accent, true), DARK_CARD)).toBeGreaterThanOrEqual(4.5)
  })

  it('sceglie la crema e non l’inchiostro scuro', () => {
    // La terracotta è scura: con l'inchiostro caldo sopra si leggerebbe appena.
    expect(accentFgFor(PREMIUM_ACCENT.accent)).toBe('#f2f7f0')
  })
})

describe('accent di Neon e Logbook', () => {
  // Come Premium: scelti a monte da App.tsx, fuori dal picker. Il fondo di
  // riferimento è la `--surface-2` di ciascun tema (globals.css), il caso peggiore.
  const TEMI = [
    { nome: 'neon', surface2: '#1e1e26' },
    { nome: 'logbook', surface2: '#252930' },
  ] as const

  it.each(TEMI)('$nome: come fondo di un tasto regge il testo sopra', ({ nome }) => {
    const accent = ACCENT_FISSI[nome].accent
    expect(contrast(accentFgFor(accent), accent)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(TEMI)('$nome: come testo sul fondo del tema raggiunge AA', ({ nome, surface2 }) => {
    expect(contrast(accentInkFor(ACCENT_FISSI[nome].accent, true), surface2)).toBeGreaterThanOrEqual(4.5)
  })

  it('sono chiari: sopra ci va l’inchiostro scuro, non la crema', () => {
    // Sul lime la crema starebbe a 1.2:1.
    expect(accentFgFor(ACCENT_FISSI.neon.accent)).toBe('#26221b')
    expect(accentFgFor(ACCENT_FISSI.logbook.accent)).toBe('#26221b')
  })

  it('il testo secondario dei due temi regge sul loro fondo peggiore', () => {
    expect(contrast('#9a9aa6', '#1e1e26')).toBeGreaterThanOrEqual(4.5)   // --fg-mute di Neon
    expect(contrast('#9aa2ae', '#252930')).toBeGreaterThanOrEqual(4.5)   // --fg-mute di Logbook
    expect(contrast('#5aa9ff', '#252930')).toBeGreaterThanOrEqual(4.5)   // il blu di Logbook
  })

  it('temaFisso riconosce i layout scuri sempre, e non Standard', () => {
    expect(temaFisso('premium')).toBe(true)
    expect(temaFisso('neon')).toBe(true)
    expect(temaFisso('logbook')).toBe(true)
    expect(temaFisso('standard')).toBe(false)
    expect(temaFisso(undefined)).toBe(false)
    // Un nome di proprietà ereditata non è un layout.
    expect(temaFisso('toString')).toBe(false)
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
