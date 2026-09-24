import { describe, it, expect } from 'vitest'
import { caricoConsigliato, intervalloColpi, passo } from '@/features/gym/caricoConsigliato'
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'

// Il consiglio si legge prima di ogni esercizio: se sbaglia verso — scendere a
// chi ha fatto tutto, salire a chi ha saltato una serie — è peggio di non
// esserci. I casi qui sotto sono quelli in cui il verso si decide.

const alz = (date: string, d: string, kg: number, sets_n: number, reps: number, extra: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ date, d, kg, sets_n, reps, scheda: { id: 'sc1', nome: 'Spinta' }, ...extra })

const riga = { sets: 3, reps: '8-10' }

describe('intervallo di colpi', () => {
  it('legge numeri singoli e intervalli, e ignora il resto', () => {
    expect(intervalloColpi('10')).toEqual({ min: 10, max: 10 })
    expect(intervalloColpi('8-10')).toEqual({ min: 8, max: 10 })
    expect(intervalloColpi('8–12')).toEqual({ min: 8, max: 12 })
    expect(intervalloColpi('max')).toBeNull()
    expect(intervalloColpi('')).toBeNull()
  })
})

describe('passo', () => {
  it('è più corto sui pesi leggeri', () => {
    expect(passo(8)).toBe(1)
    expect(passo(20)).toBe(2)
    expect(passo(60)).toBe(2.5)
  })
})

describe('carico consigliato', () => {
  it('niente storico, niente consiglio', () => {
    expect(caricoConsigliato([], riga, 'sc1')).toBeNull()
  })

  it('tutte le serie in cima all’intervallo con lo stesso peso: si sale', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 10)], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'su', kg: 62.5, da: 60, motivo: 'completo' })
  })

  it('a obiettivo ma non in cima, la prima volta: si resta', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 8)], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'uguale', kg: 60, motivo: 'mantieni' })
  })

  it('stesso peso a obiettivo per due settimane: si sale', () => {
    const c = caricoConsigliato([
      alz('2026-09-03', 'W36', 60, 3, 8),
      alz('2026-09-10', 'W37', 60, 3, 9),
    ], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'su', kg: 62.5, motivo: 'dueSettimane' })
  })

  it('due volte nella stessa settimana non sono due settimane', () => {
    const c = caricoConsigliato([
      alz('2026-09-08', 'W37', 60, 3, 8),
      alz('2026-09-10', 'W37', 60, 3, 8),
    ], riga, 'sc1')
    expect(c?.verso).toBe('uguale')
  })

  it('una serie saltata: si scende', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 2, 10)], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'giu', kg: 57.5, motivo: 'serieMancanti', fatte: 2 })
  })

  it('una serie sotto l’obiettivo: si scende', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 10, { setReps: [10, 9, 6] })], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'giu', motivo: 'colpiCorti', cima: 8 })
  })

  it('peso abbassato a metà allenamento: si scende', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 10, { setWeights: [60, 60, 55] })], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'giu', da: 60, motivo: 'pesoCalato' })
  })

  it('una piramide in salita non è un calo', () => {
    const c = caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 10, { setWeights: [50, 55, 60] })], riga, 'sc1')
    expect(c?.verso).not.toBe('giu')
  })

  it('guarda prima lo storico fatto con questa scheda', () => {
    // L'ultima alzata in assoluto viene da un'altra scheda, con un altro
    // obiettivo: 5 colpi lì sono giusti, qui sarebbero "sotto l'obiettivo".
    const c = caricoConsigliato([
      alz('2026-09-10', 'W37', 60, 3, 10),
      alz('2026-09-12', 'W37', 80, 5, 5, { scheda: { id: 'altra', nome: 'Forza' } }),
    ], riga, 'sc1')
    expect(c).toMatchObject({ verso: 'su', da: 60 })
  })

  it('niente consiglio su corpo libero e massimali', () => {
    expect(caricoConsigliato([alz('2026-09-10', 'W37', 0, 3, 10, { bodyweight: true })], riga, 'sc1')).toBeNull()
    expect(caricoConsigliato([alz('2026-09-10', 'W37', 100, 1, 1, { maxLift: true })], riga, 'sc1')).toBeNull()
  })

  it('con obiettivo «max» non sale per i colpi, ma sale dopo due settimane', () => {
    const max = { sets: 3, reps: 'max' }
    expect(caricoConsigliato([alz('2026-09-10', 'W37', 10, 3, 15)], max, 'sc1')?.verso).toBe('uguale')
    expect(caricoConsigliato([
      alz('2026-09-03', 'W36', 10, 3, 12),
      alz('2026-09-10', 'W37', 10, 3, 15),
    ], max, 'sc1')).toMatchObject({ verso: 'su', kg: 12 })
  })
})
