import { describe, it, expect } from 'vitest'
import { ageFromDob } from '@/features/auth/FirstSetup'

// L'età è calcolata e non chiesta: è l'unica regola del questionario d'ingresso
// che possa sbagliare in silenzio, perché nessuno ricontrolla un numero che
// l'app ha scritto da sola.
describe('ageFromDob', () => {
  const oggi = new Date(2026, 8, 3)   // 3 settembre 2026

  it('conta gli anni compiuti', () => {
    expect(ageFromDob('1997-03-12', oggi)).toBe(29)
  })

  it('il compleanno non ancora arrivato vale un anno in meno', () => {
    // Senza il controllo sul mese/giorno tutti compirebbero gli anni il 1° gennaio.
    expect(ageFromDob('1997-12-31', oggi)).toBe(28)
    expect(ageFromDob('1997-09-04', oggi)).toBe(28)
  })

  it('il giorno stesso del compleanno l’anno è compiuto', () => {
    expect(ageFromDob('1997-09-03', oggi)).toBe(29)
  })

  it('una data che non è una data non produce un’età', () => {
    expect(ageFromDob('', oggi)).toBeUndefined()
    expect(ageFromDob('12/03/1997', oggi)).toBeUndefined()
  })

  it('date impossibili non passano per età plausibili', () => {
    // Il campo `date` del browser accetta anni a quattro cifre qualsiasi: un
    // 3097 salvato come "1071 anni" avrebbe inquinato il fabbisogno calorico.
    expect(ageFromDob('2030-01-01', oggi)).toBeUndefined()
    expect(ageFromDob('1850-01-01', oggi)).toBeUndefined()
  })
})
