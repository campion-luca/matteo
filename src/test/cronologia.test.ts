import { describe, it, expect } from 'vitest'
import { perAnnoEMese } from '@/lib/cronologia'

interface Voce { id: string; date?: string }
const dataDi = (v: Voce) => v.date

describe('perAnnoEMese', () => {
  it('raggruppa per anno e per mese, dal più recente', () => {
    const voci: Voce[] = [
      { id: 'a', date: '2026-10-02' },
      { id: 'b', date: '2026-09-30' },
      { id: 'c', date: '2026-09-03' },
      { id: 'd', date: '2025-12-20' },
    ]
    const { anni, senzaData } = perAnnoEMese(voci, dataDi)
    expect(senzaData).toEqual([])
    expect(anni.map(a => a.anno)).toEqual([2026, 2025])
    expect(anni[0].totale).toBe(3)
    expect(anni[0].mesi.map(m => m.chiave)).toEqual(['2026-10', '2026-09'])
    expect(anni[0].mesi[1].mese).toBe(8)
    expect(anni[0].mesi[1].voci.map(v => v.id)).toEqual(['b', 'c'])
    expect(anni[1].mesi.map(m => m.chiave)).toEqual(['2025-12'])
  })

  it('ordina gli anni e i mesi anche se le voci arrivano in disordine', () => {
    const { anni } = perAnnoEMese<Voce>([
      { id: 'x', date: '2024-03-01' },
      { id: 'y', date: '2026-01-15' },
      { id: 'z', date: '2026-11-15' },
    ], dataDi)
    expect(anni.map(a => a.anno)).toEqual([2026, 2024])
    expect(anni[0].mesi.map(m => m.chiave)).toEqual(['2026-11', '2026-01'])
  })

  it('dentro un mese tiene l’ordine di chi chiama', () => {
    const { anni } = perAnnoEMese<Voce>([
      { id: 'prima', date: '2026-09-01' },
      { id: 'dopo', date: '2026-09-28' },
    ], dataDi)
    expect(anni[0].mesi[0].voci.map(v => v.id)).toEqual(['prima', 'dopo'])
  })

  it('mette a parte le voci senza una data vera', () => {
    const { anni, senzaData } = perAnnoEMese<Voce>([
      { id: 'legacy' },
      { id: 'settimana', date: 'W38' },
      { id: 'buona', date: '2026-09-01' },
    ], dataDi)
    expect(senzaData.map(v => v.id)).toEqual(['legacy', 'settimana'])
    expect(anni).toHaveLength(1)
  })

  it('niente voci, niente gruppi', () => {
    expect(perAnnoEMese<Voce>([], dataDi)).toEqual({ anni: [], senzaData: [] })
  })
})
