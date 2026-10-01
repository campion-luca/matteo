import { describe, it, expect } from 'vitest'
import { caricoConsigliato, intervalloColpi, passo } from '@/features/gym/caricoConsigliato'
import type { PalestraHistoryEntry } from '@/store/useJarvisStore'

// Il consiglio si legge prima di ogni esercizio: se sbaglia verso — scendere a
// chi ha fatto tutto, salire a chi ha saltato una serie — è peggio di non
// esserci. I casi qui sotto sono quelli in cui il verso si decide.

const alz = (date: string, d: string, kg: number, sets_n: number, reps: number, extra: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ date, d, kg, sets_n, reps, scheda: { id: 'sc1', nome: 'Spinta' }, ...extra })

const riga = { sets: 3, reps: '8-10' }
// Oggi è giovedì della W38: la W37 è "la settimana scorsa".
const OGGI = '2026-09-17'
const consiglia = (storico: PalestraHistoryEntry[], r = riga) => caricoConsigliato(storico, r, 'sc1', OGGI)

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
  it('è più corto sui pesi leggeri, e mai oltre 2,5 kg', () => {
    expect(passo(8)).toBe(1)
    expect(passo(20)).toBe(2)
    expect(passo(60)).toBe(2.5)
    expect(passo(200)).toBe(2.5)
  })
})

describe('quando il consiglio c’è', () => {
  it('niente storico, niente consiglio', () => {
    expect(consiglia([])).toBeNull()
  })

  it('solo dopo almeno una settimana di scheda', () => {
    // Primo allenamento lunedì di questa settimana: niente "settimana scorsa".
    expect(consiglia([alz('2026-09-14', 'W38', 60, 3, 10)])).toBeNull()
  })

  it('solo con lo storico della scheda, non con le alzate singole', () => {
    const singola = alz('2026-09-10', 'W37', 60, 3, 10, { scheda: undefined })
    expect(consiglia([singola])).toBeNull()
    expect(caricoConsigliato([alz('2026-09-10', 'W37', 60, 3, 10)], riga, undefined, OGGI)).toBeNull()
  })

  it('non mescola un’altra scheda con obiettivi diversi', () => {
    // L'ultima alzata in assoluto viene da un'altra scheda, con un altro
    // obiettivo: 5 colpi lì sono giusti, qui sarebbero "sotto l'obiettivo".
    const c = consiglia([
      alz('2026-09-10', 'W37', 60, 3, 10),
      alz('2026-09-12', 'W37', 80, 5, 5, { scheda: { id: 'altra', nome: 'Forza' } }),
    ])
    expect(c).toMatchObject({ verso: 'su', da: 60 })
  })

  it('niente consiglio su corpo libero e massimali', () => {
    expect(consiglia([alz('2026-09-10', 'W37', 0, 3, 10, { bodyweight: true })])).toBeNull()
    expect(consiglia([alz('2026-09-10', 'W37', 5, 3, 10, { bodyweight: true })])).toBeNull()
    expect(consiglia([alz('2026-09-10', 'W37', 100, 1, 1, { maxLift: true })])).toBeNull()
  })
})

describe('salire', () => {
  it('una settimana con tutto fatto allo stesso peso: valuta un aumento leggero', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 3, 8)])
    expect(c).toMatchObject({ verso: 'su', kg: 62.5, da: 60, motivo: 'valuta', pesi: [62.5, 62.5, 62.5] })
  })

  it('due settimane di fila allo stesso peso: si deve salire', () => {
    const c = consiglia([
      alz('2026-09-03', 'W36', 60, 3, 8),
      alz('2026-09-10', 'W37', 60, 3, 9),
    ])
    expect(c).toMatchObject({ verso: 'su', kg: 62.5, motivo: 'devi' })
  })

  it('due settimane ma a pesi diversi: è la prima settimana al peso nuovo', () => {
    const c = consiglia([
      alz('2026-09-03', 'W36', 57.5, 3, 10),
      alz('2026-09-10', 'W37', 60, 3, 8),
    ])
    expect(c?.motivo).toBe('valuta')
  })

  it('due settimane, ma la prima non era piena: solo valuta', () => {
    const c = consiglia([
      alz('2026-09-03', 'W36', 60, 2, 8),
      alz('2026-09-10', 'W37', 60, 3, 8),
    ])
    expect(c?.motivo).toBe('valuta')
  })

  it('due volte nella stessa settimana non sono due settimane', () => {
    const c = consiglia([
      alz('2026-09-08', 'W37', 60, 3, 8),
      alz('2026-09-10', 'W37', 60, 3, 8),
    ])
    expect(c?.motivo).toBe('valuta')
  })

  it('il salto è piccolo anche sui pesi leggeri', () => {
    expect(consiglia([alz('2026-09-10', 'W37', 8, 3, 10)])).toMatchObject({ kg: 9 })
    expect(consiglia([alz('2026-09-10', 'W37', 20, 3, 10)])).toMatchObject({ kg: 22 })
  })

  it('con obiettivo «max» bastano le serie fatte', () => {
    const max = { sets: 3, reps: 'max' }
    expect(consiglia([alz('2026-09-10', 'W37', 10, 3, 15)], max)).toMatchObject({ verso: 'su', motivo: 'valuta', kg: 12 })
  })
})

describe('dopo uno stop, o con la scheda cambiata', () => {
  it('più di dieci giorni senza farla: né su né giù, si riparte da dov’era', () => {
    // Tutto fatto, da manuale "puoi salire" — ma tre settimane fa.
    const c = caricoConsigliato([alz('2026-08-27', 'W35', 60, 3, 10)], riga, 'sc1', OGGI)
    expect(c).toMatchObject({ verso: 'uguale', motivo: 'stop', giorni: 21, kg: 60, pesi: [60, 60, 60] })
  })

  it('lo stop vale anche se l’ultima volta era andata male', () => {
    const c = caricoConsigliato([alz('2026-08-27', 'W35', 60, 2, 10)], riga, 'sc1', OGGI)
    expect(c).toMatchObject({ verso: 'uguale', motivo: 'stop' })
  })

  it('dieci giorni esatti non sono ancora uno stop', () => {
    const c = caricoConsigliato([alz('2026-09-07', 'W37', 60, 3, 10)], riga, 'sc1', OGGI)
    expect(c?.motivo).toBe('valuta')
  })

  it('due settimane piene, ma non di fila: solo valuta', () => {
    const c = consiglia([
      alz('2026-08-13', 'W33', 60, 3, 10),
      alz('2026-09-10', 'W37', 60, 3, 10),
    ])
    expect(c?.motivo).toBe('valuta')
  })

  it('una serie in più nella scheda non è una serie saltata', () => {
    // Fatte 3 su 3 col programma di allora; oggi la scheda ne chiede 4.
    const c = caricoConsigliato(
      [alz('2026-09-10', 'W37', 60, 3, 10, { piano: { sets: 3, reps: '8-10' } })],
      { sets: 4, reps: '8-10' }, 'sc1', OGGI,
    )
    expect(c).toMatchObject({ verso: 'uguale', motivo: 'schedaCambiata', pesi: [60, 60, 60, 60] })
  })

  it('i colpi alzati nella scheda non sono colpi mancati', () => {
    const c = caricoConsigliato(
      [alz('2026-09-10', 'W37', 60, 3, 8, { piano: { sets: 3, reps: '8' } })],
      { sets: 3, reps: '10' }, 'sc1', OGGI,
    )
    expect(c?.motivo).toBe('schedaCambiata')
  })

  it('stessa scheda di allora: il piano ricordato non cambia niente', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 3, 8, { piano: { sets: 3, reps: '8-10' } })])
    expect(c?.motivo).toBe('valuta')
  })
})

describe('una serie in più col peso alto', () => {
  it('l’ultima serie è salita: oggi due serie col peso alto', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 62.5, 3, 8, { setWeights: [60, 60, 62.5] })])
    expect(c).toMatchObject({ verso: 'su', motivo: 'estendi', kg: 62.5, alte: 2, pesi: [60, 62.5, 62.5] })
  })

  it('le ultime due erano salite: oggi tutte e tre', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 62.5, 3, 8, { setWeights: [60, 62.5, 62.5] })])
    expect(c).toMatchObject({ motivo: 'estendi', alte: 3, pesi: [62.5, 62.5, 62.5] })
  })

  it('e la settimana dopo, tutte e tre al peso alto, si valuta di salire ancora', () => {
    const c = consiglia([
      alz('2026-09-03', 'W36', 62.5, 3, 8, { setWeights: [60, 62.5, 62.5] }),
      alz('2026-09-10', 'W37', 62.5, 3, 8),
    ])
    expect(c).toMatchObject({ motivo: 'valuta', kg: 65 })
  })

  it('se la serie pesante non ha retto, si torna al peso di prima', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 62.5, 3, 10, { setWeights: [60, 60, 62.5], setReps: [10, 10, 6] })])
    expect(c).toMatchObject({ verso: 'giu', motivo: 'colpiCorti', pesi: [60, 60, 60] })
  })

  it('una piramide non è un aumento a metà: si ripete', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 3, 10, { setWeights: [50, 55, 60] })])
    expect(c).toMatchObject({ verso: 'uguale', motivo: 'mantieni', pesi: [50, 55, 60] })
  })
})

describe('scendere', () => {
  it('una serie saltata', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 2, 10)])
    expect(c).toMatchObject({ verso: 'giu', kg: 57.5, motivo: 'serieMancanti', fatte: 2 })
  })

  it('una serie sotto l’obiettivo', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 3, 10, { setReps: [10, 9, 6] })])
    expect(c).toMatchObject({ verso: 'giu', kg: 57.5, motivo: 'colpiCorti', cima: 8 })
  })

  it('il peso abbassato a metà allenamento', () => {
    const c = consiglia([alz('2026-09-10', 'W37', 60, 3, 10, { setWeights: [60, 60, 55] })])
    expect(c).toMatchObject({ verso: 'giu', kg: 57.5, da: 60, motivo: 'pesoCalato' })
  })
})
