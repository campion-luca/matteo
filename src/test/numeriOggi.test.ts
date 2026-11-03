import { describe, it, expect } from 'vitest'
import { recordFatti, sessioniFatte } from '@/features/desktop/numeriOggi'
import { recordAlzata } from '@/features/gym/rankEsercizio'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

// I record della pagina «Oggi» devono essere quelli che l'avviso a fine
// allenamento (`recordAlzata`) ha annunciato: anche per chi va a colpi.

const alzata = (date: string, o: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W', date, kg: 0, reps: 20, sets_n: 3, bodyweight: true, ...o })
const crunch = (history: PalestraHistoryEntry[]): PalestraExercise =>
  ({ id: 'cr', n: 'Crunch', muscle: 'Core', bodyweight: true, current: { kg: 0, reps: 20, sets_n: 3 }, history })

describe('i record di chi va a colpi', () => {
  it('a corpo libero e a 0 kg conta la serie più lunga, come nell’avviso', () => {
    const storico = [alzata('2026-10-01'), alzata('2026-10-08', { reps: 25 }), alzata('2026-10-15', { reps: 25 })]
    // Prima nessun record: il massimale stimato di un crunch è sempre 0.
    expect(recordFatti([crunch(storico)], 80).map(r => r.alzata.date)).toEqual(['2026-10-08'])
    // E l'avviso, che lo aveva annunciato, dice la stessa cosa.
    expect(recordAlzata(crunch(storico.slice(0, 1)), storico[1], 80)).toMatchObject({ colpi: true, next: 25 })
    expect(recordAlzata(crunch(storico.slice(0, 2)), storico[2], 80)).toBeNull()
  })

  it('finisce nel conto dell’allenamento di quel giorno', () => {
    const ex = crunch([alzata('2026-10-01'), alzata('2026-10-08', { reps: 25 })])
    expect(sessioniFatte([ex], 80).find(s => s.data === '2026-10-08')?.record).toBe(1)
  })

  it('con della zavorra si torna ai chili, come nell’avviso', () => {
    // Dalla prima alzata con i chili in poi, l'avviso guarda il massimale: qui
    // 30 colpi a 0 kg dopo una a 5 kg non sono un record.
    const storico = [alzata('2026-10-01'), alzata('2026-10-08', { kg: 5, reps: 15 }), alzata('2026-10-15', { reps: 30 })]
    expect(recordFatti([crunch(storico)], 80).map(r => r.alzata.date)).toEqual(['2026-10-08'])
    expect(recordAlzata(crunch(storico.slice(0, 2)), storico[2], 80)).toBeNull()
  })
})
