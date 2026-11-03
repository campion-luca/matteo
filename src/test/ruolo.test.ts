import { describe, it, expect, beforeEach, vi } from 'vitest'

// Il ruolo si rilegge dal server, e la risposta può arrivare dopo un'uscita o
// a account già cambiato: scritta lo stesso, ridava il titolo di coach a chi
// era entrato dopo.

let chiEntrato: string | null = 'coach-1'
let rispondi: (righe: unknown[]) => void = () => {}

vi.mock('@/lib/supabase', () => ({
  idUtenteSuDisco: () => chiEntrato,
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          limit: () => new Promise(res => { rispondi = righe => res({ data: righe, error: null }) }),
        }),
      }),
    }),
  },
}))

const { aggiornaRuolo, useRuolo, dimenticaRuolo } = await import('@/lib/ruolo')

beforeEach(() => {
  localStorage.clear()
  chiEntrato = 'coach-1'
  dimenticaRuolo()
})

describe('il ruolo letto dal server', () => {
  it('chi è coach lo diventa', async () => {
    const fatto = aggiornaRuolo('coach-1')
    rispondi([{ user_id: 'coach-1' }])
    await fatto
    expect(useRuolo.getState().coach).toBe(true)
  })

  it('una risposta arrivata dopo l’uscita non ridà il titolo a nessuno', async () => {
    const fatto = aggiornaRuolo('coach-1')
    chiEntrato = 'atleta-2'
    dimenticaRuolo()
    rispondi([{ user_id: 'coach-1' }])
    await fatto
    expect(useRuolo.getState().coach).toBe(false)
    expect(localStorage.getItem('jarvis-ruolo-v1')).toBeNull()
  })
})
