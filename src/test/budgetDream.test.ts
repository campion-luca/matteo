import { describe, it, expect } from 'vitest'
import { computeDream } from '@/features/budget/budgetMath'
import type { BudgetDream } from '@/store/useJarvisStore'

const dream = (o: Partial<BudgetDream> = {}): BudgetDream => ({ name: 'Moto', amount: 6000, saved: 0, ...o })
const TODAY = new Date(2026, 6, 9)  // 9 luglio 2026

describe('computeDream — quanto manca al sogno', () => {
  it('conta i mesi al traguardo col risparmio mensile attuale', () => {
    const d = computeDream(dream(), 500, TODAY)
    expect(d.remaining).toBe(6000)
    expect(d.monthsNeeded).toBe(12)
    expect(d.readyOn).toBe('2027-07-09')
  })

  it('arrotonda per eccesso: 11 mesi non bastano per 6000 a 550/mese', () => {
    expect(computeDream(dream(), 550, TODAY).monthsNeeded).toBe(11)
    expect(computeDream(dream({ amount: 6050 }), 550, TODAY).monthsNeeded).toBe(11)
    expect(computeDream(dream({ amount: 6051 }), 550, TODAY).monthsNeeded).toBe(12)
  })

  it('sottrae quanto è già da parte e ne calcola la percentuale', () => {
    const d = computeDream(dream({ saved: 1500 }), 500, TODAY)
    expect(d.remaining).toBe(4500)
    expect(d.pct).toBe(25)
    expect(d.monthsNeeded).toBe(9)
  })

  it('senza risparmio mensile il sogno è irraggiungibile, non "fra infiniti mesi"', () => {
    const d = computeDream(dream(), 0, TODAY)
    expect(d.monthsNeeded).toBeNull()
    expect(d.readyOn).toBeNull()
    // Un deficit non deve diventare un traguardo raggiungibile.
    expect(computeDream(dream(), -200, TODAY).monthsNeeded).toBeNull()
  })

  it('con una data desiderata dice se sei sulla giusta strada', () => {
    const inTime  = computeDream(dream({ targetDate: '2027-09-09' }), 500, TODAY)
    expect(inTime.monthsToTarget).toBe(14)
    expect(inTime.onTrack).toBe(true)

    const late = computeDream(dream({ targetDate: '2027-01-09' }), 500, TODAY)
    expect(late.monthsToTarget).toBe(6)
    expect(late.onTrack).toBe(false)
    expect(late.requiredPerMonth).toBe(1000)
  })

  it('il mese conta solo se è compiuto: il 10 del mese target non è ancora un mese pieno', () => {
    // Dal 9 lug al 10 ago = 1 mese pieno; dall'9 lug all'8 ago = 0.
    expect(computeDream(dream({ targetDate: '2026-08-10' }), 1, TODAY).monthsToTarget).toBe(1)
    expect(computeDream(dream({ targetDate: '2026-08-08' }), 1, TODAY).monthsToTarget).toBe(0)
  })

  it('sogno già coperto: nessun mese di attesa, on track anche senza risparmio', () => {
    const d = computeDream(dream({ saved: 6000, targetDate: '2026-08-01' }), 0, TODAY)
    expect(d.done).toBe(true)
    expect(d.pct).toBe(100)
    expect(d.monthsNeeded).toBe(0)
    expect(d.onTrack).toBe(true)
  })

  it('senza data desiderata non si pronuncia sul "sulla giusta strada"', () => {
    expect(computeDream(dream(), 500, TODAY).onTrack).toBeNull()
  })

  it('il traguardo stimato non sfora la fine del mese corto', () => {
    // 31 gennaio + 1 mese → 28 febbraio, non 3 marzo.
    const d = computeDream(dream({ amount: 100, saved: 0 }), 100, new Date(2026, 0, 31))
    expect(d.readyOn).toBe('2026-02-28')
  })
})
