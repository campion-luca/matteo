import { describe, it, expect } from 'vitest'
import { analizzaGiornate, colpiMinimi } from '@/features/coach/analisiSessioni'
import type { GymScheda, PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

const SCHEDA_A: GymScheda = {
  id: 'sA', title: 'Scheda A', createdAt: '', updatedAt: '',
  exercises: [
    { id: 'e1', name: 'Panca piana', sets: 4, reps: '8' },
    { id: 'e2', name: 'Rematore', sets: 3, reps: '8-10' },
    { id: 'e3', name: 'Curl', sets: 3, reps: '12' },
  ],
}
const daScheda = { id: 'sA', nome: 'Scheda A' }
const alzata = (date: string, kg: number, reps: number, sets_n: number, extra: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: date, date, kg, reps, sets_n, ...extra })
const es = (id: string, n: string, history: PalestraHistoryEntry[], muscle = 'Petto'): PalestraExercise =>
  ({ id, n, muscle, current: { kg: 0, reps: 0, sets_n: 0 }, history })

describe('colpi previsti', () => {
  it('legge il minimo di un intervallo', () => {
    expect(colpiMinimi('10')).toBe(10)
    expect(colpiMinimi('8-10')).toBe(8)
    expect(colpiMinimi('max')).toBeNull()
  })
})

describe('una giornata di scheda', () => {
  const palestra = [
    es('p', 'Panca piana', [
      alzata('2026-09-10', 80, 8, 4, { scheda: daScheda }),
      // Oggi: una serie in meno, l'ultima a 6 colpi, 2,5 kg in più.
      alzata('2026-09-17', 82.5, 8, 3, { scheda: daScheda, setReps: [8, 8, 6] }),
    ]),
    es('r', 'rematore', [
      alzata('2026-09-10', 60, 10, 3, { scheda: daScheda }),
      alzata('2026-09-17', 55, 8, 3, { scheda: daScheda }),                  // 8 su "8-10": va bene
    ], 'Dorso'),
    es('c', 'Curl', [alzata('2026-09-10', 14, 12, 3, { scheda: daScheda })], 'Bicipiti'),
    es('x', 'Crunch', [alzata('2026-09-17', 0, 20, 2, { scheda: daScheda, bodyweight: true })], 'Core'),
  ]
  const [oggi] = analizzaGiornate(palestra, [SCHEDA_A], 80)
  const gruppo = oggi.gruppi[0]
  const per = (nome: string) => gruppo.esercizi.find(e => e.nome === nome)!

  it('è la giornata più recente, con la sua scheda confrontabile', () => {
    expect(oggi.date).toBe('2026-09-17')
    expect(gruppo).toMatchObject({ scheda: daScheda, confrontabile: true })
  })

  it('un esercizio della scheda senza alzata è saltato', () => {
    expect(per('Curl')).toMatchObject({ saltato: true, serieMancanti: 3, carico: null })
    expect(oggi.saltati).toBe(1)
  })

  it('segna le serie mancanti e le serie corte', () => {
    expect(per('Panca piana')).toMatchObject({ serieMancanti: 1, serieCorte: [2] })
    expect(oggi.serieMancanti).toBe(1)                  // il Curl saltato non si conta due volte
    expect(oggi.serieCorte).toBe(1)
  })

  it('con un intervallo di colpi il minimo è rispettare la scheda', () => {
    expect(per('rematore').serieCorte).toEqual([])
  })

  it('il nome si abbina senza badare a maiuscole e spazi', () => {
    expect(per('rematore').saltato).toBe(false)
  })

  it('confronta il carico con l’ultima volta', () => {
    expect(per('Panca piana').carico).toEqual({ ora: 82.5, prima: 80, delta: 2.5 })
    expect(per('rematore').carico).toEqual({ ora: 55, prima: 60, delta: -5 })
    expect(oggi.caloCarico).toBe(1)
  })

  it('un esercizio non previsto resta visibile come fuori scheda', () => {
    expect(per('Crunch')).toMatchObject({ fuoriScheda: true, saltato: false })
    // a corpo libero il carico comprende il peso corporeo
    expect(per('Crunch').carico).toMatchObject({ ora: 80, prima: null, delta: null })
  })

  it('segue l’ordine della scheda', () => {
    expect(gruppo.esercizi.map(e => e.nome)).toEqual(['Panca piana', 'rematore', 'Curl', 'Crunch'])
  })
})

describe('giornate senza confronto', () => {
  it('le alzate a mano non hanno serie mancanti né saltati', () => {
    const [g] = analizzaGiornate([es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 2)])], [SCHEDA_A], 80)
    expect(g.gruppi[0]).toMatchObject({ scheda: null, confrontabile: false })
    expect(g).toMatchObject({ saltati: 0, serieMancanti: 0 })
  })

  it('una scheda cancellata mostra le alzate senza inventare saltati', () => {
    const [g] = analizzaGiornate([es('p', 'Panca piana', [alzata('2026-09-17', 80, 8, 2, { scheda: { id: 'via', nome: 'Vecchia' } })])], [SCHEDA_A], 80)
    expect(g.gruppi[0]).toMatchObject({ confrontabile: false })
    expect(g.saltati).toBe(0)
  })

  it('i giorni di solo hyrox ci sono, vuoti', () => {
    const giornate = analizzaGiornate([], [], 80, ['2026-09-15'])
    expect(giornate).toHaveLength(1)
    expect(giornate[0]).toMatchObject({ soloHyrox: true, volume: 0 })
  })

  it('le giornate vanno dalla più recente', () => {
    const giornate = analizzaGiornate([es('p', 'Panca', [alzata('2026-09-01', 80, 8, 3), alzata('2026-09-20', 80, 8, 3)])], [], 80)
    expect(giornate.map(g => g.date)).toEqual(['2026-09-20', '2026-09-01'])
  })
})
