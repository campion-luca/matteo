import { describe, it, expect } from 'vitest'
import { maxLifts, maxTotal } from '@/features/gym/gymMaxLifts'
import { entry1RM } from '@/features/gym/gymModel'
import type { DistrictStrength } from '@/features/gym/gymStrength'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

const h = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry => ({
  d: 'W1', kg: 0, reps: 10, sets_n: 3, ...o,
})
const ex = (o: Partial<PalestraExercise>): PalestraExercise => ({
  id: 'x', n: 'Es', muscle: 'Petto',
  current: { kg: 0, reps: 0, sets_n: 0 }, history: [], ...o,
})
const distretto = (muscle: string, best: number): DistrictStrength =>
  ({ muscle, best, ratio: null, level: 0, score: 0 })

const VUOTI: DistrictStrength[] = []
const lift = (lifts: ReturnType<typeof maxLifts>, id: string) => lifts.find(l => l.id === id)!

describe('entry1RM — il massimale dichiarato non si stima', () => {
  it('su un massimale il 1RM è il carico, non Epley', () => {
    // Epley su una singola gonfia del 3%: 100 kg diventerebbero 103, cioè la
    // stima batterebbe la misura.
    expect(entry1RM(h({ kg: 100, reps: 1, sets_n: 1, maxLift: true }))).toBe(100)
    expect(entry1RM(h({ kg: 100, reps: 1, sets_n: 1 }))).toBeCloseTo(103.33, 1)
  })

  it('a corpo libero il massimale include il peso corporeo', () => {
    expect(entry1RM(h({ kg: 20, reps: 1, sets_n: 1, bodyweight: true, maxLift: true }), 78)).toBe(98)
  })
})

describe('maxLifts — da dove viene il numero', () => {
  it('il massimale dichiarato batte la stima sullo stesso esercizio', () => {
    const lifts = maxLifts([
      ex({ n: 'Squat', muscle: 'Gambe', history: [
        h({ kg: 120, reps: 5 }),                              // stima ~140
        h({ kg: 150, reps: 1, sets_n: 1, maxLift: true }),
      ] }),
    ], 80, VUOTI)
    expect(lift(lifts, 'squat').source).toBe('dichiarato')
    expect(lift(lifts, 'squat').kg).toBe(150)
  })

  it('senza massimale dichiarato stima dall’esercizio giusto', () => {
    const lifts = maxLifts([ex({ n: 'Panca piana', muscle: 'Petto', history: [h({ kg: 80, reps: 6 })] })], 80, VUOTI)
    expect(lift(lifts, 'panca').source).toBe('stimato')
    expect(lift(lifts, 'panca').kg).toBe(96)   // 80 × (1 + 6/30)
  })

  it('le varianti non contano come l’alzata: la loro non è quel massimale', () => {
    const lifts = maxLifts([
      ex({ n: 'Panca inclinata', muscle: 'Petto', history: [h({ kg: 70, reps: 5 })] }),
      ex({ n: 'Squat bulgaro',   muscle: 'Gambe', history: [h({ kg: 40, reps: 8 })] }),
      ex({ n: 'Stacco rumeno',   muscle: 'Glutei', history: [h({ kg: 90, reps: 8 })] }),
    ], 80, VUOTI)
    expect(lifts.every(l => l.source === null)).toBe(true)
  })

  it('senza quell’esercizio in lista il numero arriva dal distretto', () => {
    const lifts = maxLifts([], 80, [distretto('Gambe', 160), distretto('Petto', 0)])
    expect(lift(lifts, 'squat')).toMatchObject({ source: 'distretto', kg: 160 })
    expect(lift(lifts, 'squat').ratio).toBeCloseTo(2, 5)
    // Un distretto mai allenato resta vuoto: zero non è un massimale.
    expect(lift(lifts, 'panca').source).toBeNull()
    expect(lift(lifts, 'panca').kg).toBeNull()
  })

  it('l’esercizio vero batte il distretto, anche se il distretto dice di più', () => {
    // La pressa sposta più chili dello squat: se il distretto vincesse, registrare
    // lo squat farebbe SCENDERE il massimale di squat.
    const lifts = maxLifts(
      [ex({ n: 'Squat', muscle: 'Gambe', history: [h({ kg: 100, reps: 5 })] })],
      80, [distretto('Gambe', 300)],
    )
    expect(lift(lifts, 'squat').source).toBe('stimato')
    expect(lift(lifts, 'squat').kg).toBe(117)
  })

  it('senza peso corporeo i rapporti non ci sono, i chili sì', () => {
    const lifts = maxLifts([ex({ n: 'Squat', muscle: 'Gambe', history: [h({ kg: 100, reps: 1, sets_n: 1, maxLift: true })] })], 0, VUOTI)
    expect(lift(lifts, 'squat').kg).toBe(100)
    expect(lift(lifts, 'squat').ratio).toBeNull()
  })
})

describe('maxTotal', () => {
  const tutti = [
    ex({ n: 'Squat', muscle: 'Gambe', history: [h({ kg: 100, reps: 1, sets_n: 1, maxLift: true })] }),
    ex({ n: 'Panca piana', muscle: 'Petto', history: [h({ kg: 80, reps: 1, sets_n: 1, maxLift: true })] }),
    ex({ n: 'Stacco da terra', muscle: 'Glutei', history: [h({ kg: 140, reps: 1, sets_n: 1, maxLift: true })] }),
  ]

  it('somma le tre alzate', () => {
    expect(maxTotal(maxLifts(tutti, 80, VUOTI))).toBe(320)
  })

  it('con una riga vuota non esce: due terzi di total sembrano un total', () => {
    expect(maxTotal(maxLifts(tutti.slice(0, 2), 80, VUOTI))).toBeNull()
  })
})
