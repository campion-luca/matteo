import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisCoach } from '@/features/coach/JarvisCoach'
import { condividiScheda, numeraSchede, ordineDi, perOrdine, copiaPerAllievo, idSchedaCondivisa, type CoachScheda } from '@/lib/coach'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { useProfiliStore } from '@/lib/profili'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
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
  // Righe che si vedono ma che la RLS non lascia toccare: il collegamento sciolto.
  let bloccate: Set<string>

  beforeEach(() => {
    righe = []
    scritte = []
    bloccate = new Set()
    useMessaggiStore.setState({ userId: IO, messaggi: [], primoGiroFatto: true, errore: null })
    useProfiliStore.setState({ owner: null, profili: {} })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = decodeURIComponent(String(url))
      const risposta = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (u.includes('/coach_schede')) {
        const id = new URL(String(url)).searchParams.get('id')?.replace(/^eq\./, '')
        const sua = righe.find(r => r.id === id)
        if (init?.method === 'POST') {
          const corpo = JSON.parse(String(init.body)) as { id: string; scheda: GymScheda }
          scritte.push(corpo)
          return risposta(null)
        }
        // Come la RLS vera: una riga che non c'è, o che non si può toccare, non
        // dà errore — risponde con zero righe.
        if (init?.method === 'PATCH') {
          if (!sua || bloccate.has(sua.id)) return risposta([])
          scritte.push({ id: sua.id, scheda: (JSON.parse(String(init.body)) as { scheda: GymScheda }).scheda })
          return risposta([{ id: sua.id }])
        }
        if (init?.method === 'DELETE') {
          if (!sua || bloccate.has(sua.id)) return risposta([])
          righe = righe.filter(r => r !== sua)
          return risposta([{ id: sua.id }])
        }
        return risposta(id ? righe.filter(r => r.id === id) : righe)
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
    render(<ConfirmDeleteProvider><JarvisCoach userId={IO} onBack={() => {}} iniziale="allenatore"/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(await screen.findByRole('button', { name: /^Anna/ }))
    await user.click(await screen.findByRole('button', { name: /Schede assegnate/ }))
  }

  // Dal 4 nov 2026 il posto si cambia con le frecce su e giù, non più con una
  // tendina di numeri.
  it('la freccia su scrive le righe che cambiano, e non avvisa nessuno', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 }), riga('c', { ordine: 3 })]
    await apriSchede(user)

    await user.click(await screen.findByRole('button', { name: 'Sposta su Scheda c' }))

    await waitFor(() => expect(scritte).toHaveLength(2))
    expect(scritte.map(s => `${s.id}:${s.scheda.ordine}`).sort()).toEqual(['b:3', 'c:2'])
    expect(screen.getAllByText(/^Scheda [abc]$/).map(e => e.textContent)).toEqual(['Scheda a', 'Scheda c', 'Scheda b'])
    // Niente messaggio all'allievo: l'unica cosa scritta sul server sono le schede
    // (le `rpc` sono POST anche quando leggono).
    const scrive = vi.mocked(fetch).mock.calls.filter(([, init]) => ['POST', 'PATCH', 'DELETE'].includes(init?.method ?? '')).map(([u]) => String(u))
    expect(scrive.filter(u => !u.includes('/rpc/')).every(u => u.includes('/coach_schede'))).toBe(true)
  })

  // Una scheda già assegnata si aggiorna, mai un upsert: prima la riga si
  // riscriveva per intero dalla copia letta all'apertura della pagina, e una
  // scheda tolta dall'allievo nel frattempo tornava in piedi.
  const upsertSchede = () => vi.mocked(fetch).mock.calls
    .filter(([u, init]) => String(u).includes('/coach_schede') && init?.method === 'POST')

  it('ritoccare una scheda che l’allievo ha tolto non la rimette in piedi', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    await apriSchede(user)
    await user.click(await screen.findByText('Scheda a'))
    // Mentre il form è aperto, l'allievo la toglie dalle sue schede.
    righe = [riga('b', { ordine: 2 })]
    await user.click(await screen.findByRole('button', { name: /^Salva/ }))

    expect(await screen.findByText('«Scheda a» non c’è più: è stata tolta nel frattempo, e le modifiche non sono state salvate.')).toBeInTheDocument()
    expect(scritte).toEqual([])
    expect(upsertSchede()).toHaveLength(0)
    // L'elenco riletto non la conta più.
    await waitFor(() => expect(screen.getByRole('button', { name: /Schede assegnate/ })).toHaveTextContent('· 1'))
  })

  it('rinumerare rilegge le righe: una scheda tolta non torna, un ritocco fatto altrove resta', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 }), riga('c', { ordine: 3 })]
    await apriSchede(user)
    // Nel frattempo l'allievo toglie la b, e da un altro dispositivo la c cambia titolo.
    righe = [riga('a', { ordine: 1 }), riga('c', { ordine: 3, title: 'Scheda c (ritoccata)' })]
    await user.click(await screen.findByRole('button', { name: 'Sposta su Scheda c' }))

    await waitFor(() => expect(scritte).toHaveLength(1))
    expect(scritte.map(s => `${s.id}:${s.scheda.ordine}`)).toEqual(['c:2'])
    // Della riga riletta cambia solo il numero.
    expect(scritte[0].scheda.title).toBe('Scheda c (ritoccata)')
    expect(upsertSchede()).toHaveLength(0)
    await waitFor(() => expect(screen.queryByText('Scheda b')).not.toBeInTheDocument())
  })

  it('rinumerare una scheda che non c’è più lo dice, e non scrive niente', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 }), riga('c', { ordine: 3 })]
    await apriSchede(user)
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    await user.click(await screen.findByRole('button', { name: 'Sposta su Scheda c' }))

    expect(await screen.findByText('Una scheda non c’è più: è stata tolta nel frattempo. L’elenco è aggiornato.')).toBeInTheDocument()
    expect(scritte).toEqual([])
    expect(upsertSchede()).toHaveLength(0)
    await waitFor(() => expect(screen.queryByText('Scheda c')).not.toBeInTheDocument())
  })

  // Un DELETE che la RLS non lascia passare risponde "fatto" su zero righe: la
  // pagina diceva eliminata una scheda che l'allievo aveva ancora.
  it('eliminare una scheda che non si può più toccare dice perché, e la scheda resta', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    bloccate.add('a')
    await apriSchede(user)
    await user.click(await screen.findByRole('button', { name: 'Elimina Scheda a' }))
    await user.click(await screen.findByRole('button', { name: 'Sì, elimina' }))

    expect(await screen.findByText('Non sei più collegato a questa persona: il collegamento è stato sciolto.')).toBeInTheDocument()
    expect(screen.getByText('Scheda a')).toBeInTheDocument()
  })

  it('eliminare una scheda che l’allievo aveva già tolto la toglie e basta', async () => {
    const user = userEvent.setup()
    righe = [riga('a', { ordine: 1 }), riga('b', { ordine: 2 })]
    await apriSchede(user)
    righe = [riga('b', { ordine: 2 })]
    await user.click(await screen.findByRole('button', { name: 'Elimina Scheda a' }))
    await user.click(await screen.findByRole('button', { name: 'Sì, elimina' }))

    await waitFor(() => expect(screen.queryByText('Scheda a')).not.toBeInTheDocument())
    expect(screen.queryByText(/Non sei più collegato/)).not.toBeInTheDocument()
  })

  it('senza numeri ogni scheda mostra un trattino, e la bozza non ha le frecce', async () => {
    const user = userEvent.setup()
    righe = [riga('a'), riga('b'), riga('z', { draft: true })]
    await apriSchede(user)
    const su = await screen.findByRole('button', { name: 'Sposta su Scheda a' })
    expect(su).toBeDisabled()
    expect(su.parentElement!.parentElement!).toHaveTextContent(/^–/)
    expect(screen.queryByRole('button', { name: 'Sposta su Scheda z' })).not.toBeInTheDocument()
  })

  it('una scheda sola non ha un numero da scegliere', async () => {
    const user = userEvent.setup()
    righe = [riga('a')]
    await apriSchede(user)
    expect(await screen.findByText('Scheda a')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Sposta/ })).not.toBeInTheDocument()
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
