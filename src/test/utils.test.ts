import { describe, it, expect } from 'vitest'
import { buildCustomPalette, ACCENT_PALETTES } from '@/lib/jarvis-tokens'

describe('buildCustomPalette', () => {
  it('produces hex strings for accent/soft/deep', () => {
    const pal = buildCustomPalette('#6366F1')
    expect(pal.accent).toBe('#6366F1')
    expect(pal.accentSoft).toMatch(/^#[0-9a-f]{6}$/)
    expect(pal.accentDeep).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('produces comma-separated rgb strings', () => {
    const pal = buildCustomPalette('#4CAF50')
    expect(pal.rgb).toMatch(/^\d+,\d+,\d+$/)
    expect(pal.softRgb).toMatch(/^\d+,\d+,\d+$/)
    expect(pal.deepRgb).toMatch(/^\d+,\d+,\d+$/)
  })
})

describe('ACCENT_PALETTES', () => {
  it('exposes the current palettes with valid hex accents', () => {
    for (const key of ['warm', 'rose', 'cipria', 'malva', 'notte'] as const) {
      expect(ACCENT_PALETTES[key].accent).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  // `green` è ora il tema "Journal" di default (verde copertina, con variante
  // dark oro); `pink` resta un alias legacy della palette "warm".
  it('mappa green→Journal (verde) e pink→warm', () => {
    expect(ACCENT_PALETTES.green.accent).toBe('#2c5847')
    expect(ACCENT_PALETTES.green.darkVariant?.accent).toBe('#c9a25e')
    expect(ACCENT_PALETTES.pink.accent).toBe(ACCENT_PALETTES.warm.accent)
  })
})
