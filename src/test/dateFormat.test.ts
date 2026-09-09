import { describe, it, expect } from 'vitest'
import { fmtDayMon, fmtDayMonthFull, fmtShortDate, fmtMonthYear } from '@/lib/dateFormat'
import { uid } from '@/lib/uid'

describe('formattazione date', () => {
  it('formatta le date ISO in italiano', () => {
    expect(fmtDayMon('2026-08-19')).toBe('19 ago')
    expect(fmtDayMonthFull('2026-08-19')).toBe('19 Agosto')
    expect(fmtShortDate('2026-08-19')).toBe('19/08/26')
    expect(fmtMonthYear('2027-03-01')).toBe('marzo 2027')
  })

  // `new Date('2026-01-01')` è mezzanotte UTC: a ovest di Greenwich diventava il
  // 31 dicembre. Qui non si passa mai da `Date`, quindi il giorno è quello scritto
  // qualunque sia il fuso di chi guarda.
  it('non sposta il giorno a cavallo del capodanno', () => {
    expect(fmtShortDate('2026-01-01')).toBe('01/01/26')
    expect(fmtDayMon('2026-01-01')).toBe('1 gen')
  })

  it('restituisce l’input se non è una data', () => {
    expect(fmtShortDate('non-una-data')).toBe('non-una-data')
    expect(fmtDayMon('boh')).toBe('boh')
  })
})

describe('uid', () => {
  it('non collide nemmeno nello stesso millisecondo', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => uid('px')))
    expect(ids.size).toBe(2000)
  })

  it('mantiene il prefisso', () => {
    expect(uid('cat_').startsWith('cat_')).toBe(true)
  })
})
