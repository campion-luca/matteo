import { describe, it, expect } from 'vitest'
import { settimaneDiFila, lunediDi, giorniAllenati } from '@/features/dashboard/allenamenti'
import type { PalestraExercise } from '@/store/useJarvisStore'

// La fiamma del calendario: quante settimane di fila ci si è allenati.
describe('settimane di fila', () => {
  // Martedì 15 settembre 2026: la settimana va da lunedì 14 a domenica 20.
  const OGGI = '2026-09-15'

  it('il lunedì di una data è quello della sua settimana, anche a cavallo d’anno', () => {
    expect(lunediDi('2026-09-20')).toBe('2026-09-14')
    expect(lunediDi('2026-09-14')).toBe('2026-09-14')
    expect(lunediDi('2027-01-01')).toBe('2026-12-28')
  })

  it('senza allenamenti la serie è zero', () => {
    expect(settimaneDiFila([], OGGI)).toBe(0)
  })

  it('conta la settimana in corso se c’è già un allenamento', () => {
    expect(settimaneDiFila(['2026-09-14', '2026-09-09', '2026-09-01'], OGGI)).toBe(3)
  })

  it('la settimana in corso ancora vuota non spezza la serie', () => {
    expect(settimaneDiFila(['2026-09-09', '2026-09-01'], OGGI)).toBe(2)
  })

  it('una settimana saltata la chiude', () => {
    // 7-13 settembre vuota: resta solo quella in corso.
    expect(settimaneDiFila(['2026-09-15', '2026-09-02'], OGGI)).toBe(1)
  })

  it('più allenamenti nella stessa settimana contano una volta', () => {
    expect(settimaneDiFila(['2026-09-14', '2026-09-15', '2026-09-16'], OGGI)).toBe(1)
  })
})

describe('giorni allenati', () => {
  it('raccoglie le sessioni per data e ignora le voci senza data', () => {
    const palestra = [{
      id: 'p1', n: 'Panca', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 4 },
      history: [
        { d: 'W1', date: '2026-09-14', kg: 60, reps: 8, sets_n: 4 },
        { d: 'W1', kg: 60, reps: 8, sets_n: 4 },
      ],
    }] as PalestraExercise[]
    const giorni = giorniAllenati(palestra, [])
    expect([...giorni.keys()]).toEqual(['2026-09-14'])
    expect(giorni.get('2026-09-14')?.[0]).toMatchObject({ nome: 'Panca', tipo: 'pesi', indice: 0 })
  })
})
