import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisCoach } from '@/features/coach/JarvisCoach'
import { condividiScheda, numeraSchede, ordineDi, perOrdine, copiaPerAllievo, idSchedaCondivisa, type CoachScheda } from '@/lib/coach'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { useProfiliStore } from '@/lib/profili'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import type { GymScheda } from '@/store/useJarvisStore'

// Il coach dà un numero alle schede di un allievo, e la home ne segue il giro.
// Il numero sta dentro la scheda: le cose da tenere d'occhio sono chi riscrive la
// riga e lo perderebbe, e chi lo scrive due volte uguale.

const IO = 'u-io', ANNA = 'u-anna'

const gym = (id: string, extra: Partial<GymScheda> = {}): GymScheda => ({
  id, title: `Scheda ${id}`, createdAt: '2026-10-01', updatedAt: '2026-10-01',
  exercises: [{ id: `${id}-1`, name: 'Panca piana', sets: 4, reps: '8', muscle: 'Petto', linkedExerciseId: 'px-1' }],
  ...extra,
})
const riga = (id: string, extra: Partial<GymScheda> = {}): CoachScheda => ({
  id, coach_id: IO, athlete_id: ANNA, scheda: gym(id, extra), coach_name: 'Luca', updated_at: '2026-10-01T10:00:00Z',
})
const numeri = (righe: CoachScheda[]) => righe.map(r => `${r.id}:${r.scheda.ordine ?? '-'}`)

describe('l’ordine delle schede', () => {
  it('perOrdine: prima i numeri, poi le altre come sono arrivate', () => {
    const r = perOrdine([riga('c'), riga('b', { ordine: 2 }), riga('d'), riga('a', { ordine: 1 })])
    expect(numeri(r)).toEqual(['a:1', 'b:2', 'c:-', 'd:-'])
  })

  it('numeraSchede: il primo numero dato numera tutte, nell’ordine visto', () => {
    expect(numeri(numeraSchede([riga('a'), riga('b'), riga('c')], 'c', 2))).toEqual(['a:1', 'c:2', 'b:3'])
  })

  it('numeraSchede: spostarne una fa scorrere le altre, senza doppioni né buchi', () => {
    const righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 3 }), riga('c', { ordine: 5 })]
    expect(numeri(numeraSchede(righe, 'c', 1))).toEqual(['c:1', 'a:2', 'b:3'])
  })

  it('numeraSchede: le bozze restano senza numero e in fondo', () => {
    const righe = [riga('z', { draft: true }), riga('a'), riga('b')]
    expect(numeri(numeraSchede(righe, 'b', 1))).toEqual(['b:1', 'a:2', 'z:-'])
  })

  it('ordineDi: chi ha un numero lo tiene, una nuova va in fondo', () => {
    const righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    expect(ordineDi(righe, 'a')).toBe(1)
    expect(ordineDi(righe, 'nuova')).toBe(3)
  })

  it('ordineDi: se il coach non ha dato numeri, una nuova resta senza', () => {
    expect(ordineDi([riga('a'), riga('b')], 'nuova')).toBeUndefined()
  })

  it('il numero non viaggia con la copia: è il posto in un altro elenco', () => {
    expect(copiaPerAllievo(gym('a', { ordine: 4 }), ANNA).ordine).toBeUndefined()
  })
})

// ── Dalla pagina dell'allievo fino alla scrittura sul server ───
describe('il numero nella pagina dell’allievo', () => {
  let righe: CoachScheda[]
  let scritte: Array<{ id: string; scheda: GymScheda }>

  beforeEach(() => {
    righe = []
    scritte = []
    useMessaggiStore.setState({ userId: IO, messaggi: [], primoGiroFatto: true, errore: null })
    useProfiliStore.setState({ owner: null, profili: {} })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = decodeURIComponent(String(url))
      const risposta = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (u.includes('/coach_schede')) {
        if (init?.method === 'POST') {
          const corpo = JSON.parse(String(init.body)) as { id: string; scheda: GymScheda }
          scritte.push(corpo)
          return risposta(null)
        }
        return risposta(righe)
      }
      if (u.includes('/rpc/athlete_training_data')) return risposta({
        userName: 'Anna',
        palestraExercises: [{ id: 'px-1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 }, history: [] }],
      })
      if (u.includes('/coach_links') && u.includes(`coach_id=eq.${IO}`)) {
        return risposta([{ coach_id: IO, athlete_id: ANNA, athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01T10:00:00Z' }])
      }
      return risposta([])
    })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  const apriSchede = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<ConfirmDeleteProvider><JarvisCoach userId={IO} onBack={() => {}} iniziale="allenatore"/></ConfirmDeleteProvider>)
    await user.click(await screen.findByRole('button', { name: /^Anna/ }))
    await user.click(await screen.findByRole('button', { name: /Schede assegnate/ }))
  }

  it('scegliere un numero scrive le righe che cambiano, e non avvisa nessuno', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 }), riga('c', { ordine: 3 })]
    await apriSchede(user)

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Numero di Scheda c' }), '2')

    await waitFor(() => expect(scritte).toHaveLength(2))
    expect(scritte.map(s => `${s.id}:${s.scheda.ordine}`).sort()).toEqual(['b:3', 'c:2'])
    expect(screen.getByRole('combobox', { name: 'Numero di Scheda c' })).toHaveValue('2')
    // Niente messaggio all'allievo: l'unica cosa scritta sul server sono le schede
    // (le `rpc` sono POST anche quando leggono).
    const scrive = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST').map(([u]) => String(u))
    expect(scrive.filter(u => !u.includes('/rpc/')).every(u => u.includes('/coach_schede'))).toBe(true)
  })

  it('senza numeri ogni scheda mostra un trattino, e la bozza non ha la tendina', async () => {
    const user = userEvent.setup()
    righe = [riga('a'), riga('b'), riga('z', { draft: true })]
    await apriSchede(user)
    expect(await screen.findByRole('combobox', { name: 'Numero di Scheda a' })).toHaveDisplayValue('–')
    expect(screen.queryByRole('combobox', { name: 'Numero di Scheda z' })).not.toBeInTheDocument()
  })

  it('una scheda sola non ha un numero da scegliere', async () => {
    const user = userEvent.setup()
    righe = [riga('a')]
    await apriSchede(user)
    expect(await screen.findByText('Scheda a')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('ritoccare una scheda dal form non le toglie il numero', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 2 }), riga('b', { ordine: 1 })]
    await apriSchede(user)
    await user.click(await screen.findByText('Scheda a'))
    await user.click(await screen.findByRole('button', { name: /^Salva/ }))
    await waitFor(() => expect(scritte).toHaveLength(1))
    expect(scritte[0]).toMatchObject({ id: 'a', scheda: { ordine: 2 } })
  })

  it('ricondividere una scheda non le toglie il numero', async () => {
    const copia = idSchedaCondivisa('mia', ANNA)
    righe = [riga(copia, { ordine: 2 }), riga('b', { ordine: 1 })]
    await condividiScheda(IO, ANNA, 'Luca', gym('mia'))
    expect(scritte[0]).toMatchObject({ id: copia, scheda: { ordine: 2 } })
  })

  it('una scheda condivisa per la prima volta va in fondo al giro', async () => {
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    await condividiScheda(IO, ANNA, 'Luca', gym('mia'))
    expect(scritte[0].scheda.ordine).toBe(3)
  })
})
