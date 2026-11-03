import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  aggiornaSchedaAssegnata, eliminaSchedaAssegnata, salvaNotaCoach, noteRicevute, createInvite, type NotaCoach,
} from '@/lib/coach'
import type { GymScheda } from '@/store/useJarvisStore'

// Le scritture su righe che vedono in due, allenatore e allievo. Quello che va
// storto qui non dà errore: una scheda tolta che torna, "eliminata" a schermo
// con la riga ancora lì, un secondo codice valido in giro, la nota di un ex.

const ANNA = 'u-anna', COACH = 'u-coach', EX = 'u-ex'
const SCOLLEGATO = 'Non sei più collegato a questa persona: il collegamento è stato sciolto.'

interface Chiamata { metodo: string; url: URL; corpo: unknown }

/** Un server finto: `risponde` dà il corpo della risposta (o lancia, come la
 *  rete che cade), e ogni richiesta resta in `chiamate`. */
function server(risponde: (c: Chiamata) => unknown) {
  const chiamate: Chiamata[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const c = { metodo: init?.method ?? 'GET', url: new URL(String(url)), corpo: init?.body ? JSON.parse(String(init.body)) : undefined }
    chiamate.push(c)
    return new Response(JSON.stringify(risponde(c) ?? []), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  return chiamate
}

const scheda: GymScheda = {
  id: 'sc-1', title: 'Full A', createdAt: '2026-10-01', updatedAt: '2026-10-01',
  exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8', muscle: 'Petto' }],
}

afterEach(() => vi.restoreAllMocks())

describe('una scheda già assegnata si aggiorna, non si ricrea', () => {
  it('se c’è, la riscrive con un PATCH su quella riga: mai un upsert', async () => {
    const chiamate = server(c => (c.metodo === 'PATCH' ? [{ id: 'sc-1' }] : []))
    expect(await aggiornaSchedaAssegnata('Luca', scheda)).toBe(true)
    expect(chiamate.map(c => c.metodo)).toEqual(['PATCH'])
    expect(chiamate[0].url.searchParams.get('id')).toBe('eq.sc-1')
    expect(chiamate[0].corpo).toMatchObject({ scheda: { title: 'Full A' }, coach_name: 'Luca' })
  })

  it('tolta nel frattempo: false, e nessuna riga ricreata', async () => {
    const chiamate = server(() => [])
    expect(await aggiornaSchedaAssegnata('Luca', scheda)).toBe(false)
    expect(chiamate.some(c => c.metodo === 'POST')).toBe(false)
  })

  it('ancora lì ma intoccabile, a collegamento sciolto: lo dice invece di tacere', async () => {
    // La RLS non dà errore: il PATCH tocca zero righe, la lettura la vede ancora.
    server(c => (c.metodo === 'GET' ? [{ updated_at: '2026-10-01T10:00:00Z' }] : []))
    await expect(aggiornaSchedaAssegnata('Luca', scheda)).rejects.toThrow(SCOLLEGATO)
  })
})

describe('cancellare, e sapere se è successo davvero', () => {
  it('una scheda che la RLS non lascia cancellare è un errore, non un successo', async () => {
    server(c => (c.metodo === 'GET' ? [{ updated_at: '2026-10-01T10:00:00Z' }] : []))
    await expect(eliminaSchedaAssegnata('sc-1')).rejects.toThrow(SCOLLEGATO)
  })

  it('una scheda già tolta dall’altro va bene così: era quello che si voleva', async () => {
    server(() => [])
    await expect(eliminaSchedaAssegnata('sc-1')).resolves.toBeUndefined()
  })

  it('cancellata davvero, non serve chiedere altro', async () => {
    const chiamate = server(c => (c.metodo === 'DELETE' ? [{ id: 'sc-1' }] : []))
    await eliminaSchedaAssegnata('sc-1')
    expect(chiamate.map(c => c.metodo)).toEqual(['DELETE'])
  })

  it('una nota svuotata che la RLS non lascia togliere è un errore', async () => {
    server(c => (c.metodo === 'GET' ? [{ updated_at: '2026-10-01T10:00:00Z' }] : []))
    await expect(salvaNotaCoach(COACH, ANNA, 'px-1', 'Luca', '  ')).rejects.toThrow(SCOLLEGATO)
  })

  it('una nota svuotata che non c’era più va bene così', async () => {
    server(() => [])
    await expect(salvaNotaCoach(COACH, ANNA, 'px-1', 'Luca', '')).resolves.toBeUndefined()
  })
})

describe('le note sui miei esercizi', () => {
  const nota = (coach_id: string, testo: string): NotaCoach => ({
    coach_id, athlete_id: ANNA, exercise_id: 'px-1', nota: testo, coach_name: null, updated_at: '2026-10-01T10:00:00Z',
  })

  it('solo di chi mi segue ancora: quelle di un ex non restano per sempre', async () => {
    server(c => {
      if (c.url.pathname.endsWith('/coach_note')) return [nota(COACH, 'Scendi lento'), nota(EX, 'Gomiti stretti')]
      if (c.url.pathname.endsWith('/coach_links')) {
        return [{ coach_id: COACH, athlete_id: ANNA, athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01T10:00:00Z' }]
      }
      return []
    })
    expect((await noteRicevute(ANNA)).map(n => n.nota)).toEqual(['Scendi lento'])
  })
})

describe('un codice nuovo', () => {
  it('se il vecchio non si toglie non se ne fa un secondo', async () => {
    const chiamate = server(c => {
      if (c.metodo === 'DELETE') throw new TypeError('Failed to fetch')
      return { code: 'ABC234', expires_at: '2026-11-10T10:00:00Z' }
    })
    await expect(createInvite(ANNA, 'Anna')).rejects.toThrow('La rete non risponde. Riprova fra poco.')
    expect(chiamate.some(c => c.metodo === 'POST')).toBe(false)
  })

  it('tolto il vecchio, il nuovo arriva', async () => {
    const chiamate = server(c => (c.metodo === 'POST' ? { code: 'ABC234', expires_at: '2026-11-10T10:00:00Z' } : []))
    expect((await createInvite(ANNA, 'Anna')).code).toBe('ABC234')
    expect(chiamate.map(c => c.metodo)).toEqual(['DELETE', 'POST'])
  })
})
