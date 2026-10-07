import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { effectiveLoad, setLoads, pesiScritti, entry1RM, entryVolume, fmtKg, fmtKgVerso, recordFor } from '@/features/gym/gymModel'
import { serieValide, chiliScritti } from '@/features/gym/riassuntoAllenamento'
import { caricoConsigliato } from '@/features/gym/caricoConsigliato'
import { LogPalestraModal, EditExModal, EditHistoryModal } from '@/features/gym/gymModals'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'

// Il peso dell'attrezzo a vuoto: chi lo dichiara scrive i soli dischi, e l'app
// somma bilanciere o multipower dove serve il carico vero. È facoltativo, e
// la cosa che non deve succedere è che cambi qualcosa per chi non lo usa.

const alzata = (o: Partial<PalestraHistoryEntry>): PalestraHistoryEntry =>
  ({ d: 'W37', date: '2026-09-10', kg: 60, reps: 8, sets_n: 3, ...o })

describe('il carico di un’alzata con l’attrezzo dichiarato', () => {
  const h = alzata({ attrezzo: 20 })

  it('è dischi più attrezzo, su ogni serie', () => {
    expect(effectiveLoad(h)).toBe(80)
    expect(setLoads(h)).toEqual([80, 80, 80])
    expect(setLoads(alzata({ attrezzo: 20, setWeights: [60, 60, 62.5] }))).toEqual([80, 80, 82.5])
  })

  it('volume e massimale si calcolano sul totale', () => {
    expect(entryVolume(h)).toBe(80 * 8 * 3)
    expect(Math.round(entry1RM(h))).toBe(101)          // 80 × (1 + 8/30), non 60 × …
    expect(entry1RM(alzata({ attrezzo: 20, kg: 100, reps: 1, sets_n: 1, maxLift: true }))).toBe(120)
  })

  it('si legge come totale, anche con pesi diversi per serie', () => {
    expect(fmtKg(h)).toBe('80 kg')
    expect(fmtKg(alzata({ attrezzo: 20, setWeights: [60, 70, 60] }))).toBe('80–90 kg')
    expect(fmtKgVerso(alzata({ attrezzo: 20, setWeights: [60, 60, 62.5] }))).toBe('80 → 82,5 kg')
  })

  it('i chili SCRITTI restano i dischi: è quello che torna nei campi', () => {
    expect(pesiScritti(h)).toEqual([60, 60, 60])
    expect(pesiScritti(alzata({ attrezzo: 20, setWeights: [60, 62.5] }))).toEqual([60, 62.5])
  })

  it('batte un record sul totale', () => {
    // 70 kg scritti come totale la volta prima; oggi 60 di dischi su un bilanciere da 20.
    expect(recordFor([alzata({ kg: 70 })], h)).not.toBeNull()
    expect(recordFor([alzata({ kg: 80 })], h)).toBeNull()
  })

  it('senza attrezzo non cambia niente', () => {
    const senza = alzata({})
    expect(effectiveLoad(senza)).toBe(60)
    expect(setLoads(senza)).toEqual([60, 60, 60])
    expect(fmtKg(senza)).toBe('60 kg')
    expect(fmtKg(alzata({ attrezzo: 0 }))).toBe('60 kg')
  })

  it('a corpo libero l’attrezzo non c’è: quello che si scrive è la zavorra', () => {
    const trazioni = alzata({ kg: 10, bodyweight: true, attrezzo: 20 })
    expect(effectiveLoad(trazioni, 75)).toBe(85)
    expect(fmtKg(trazioni)).toBe('BW +10 kg')
  })
})

describe('quali serie contano, con l’attrezzo dichiarato', () => {
  it('lo zero SCRITTO è una serie col solo attrezzo; il campo vuoto resta una dimenticanza', () => {
    expect(chiliScritti('60')).toBe(true)
    expect(chiliScritti('0', true)).toBe(true)
    expect(chiliScritti('0,0', true)).toBe(true)
    expect(chiliScritti('', true)).toBe(false)
    expect(chiliScritti(undefined, true)).toBe(false)
    // Senza attrezzo dichiarato lo zero non dice niente, com'è sempre stato.
    expect(chiliScritti('0')).toBe(false)
  })

  it('le serie valide seguono la stessa regola', () => {
    expect(serieValide([true, true, true], ['0', '', '40'], false, 20)).toEqual([0, 2])
    expect(serieValide([true, true, true], ['0', '', '40'], false)).toEqual([2])
  })
})

describe('il consiglio sui carichi resta in dischi', () => {
  it('propone cosa SCRIVERE, non il totale', () => {
    const fatta = (date: string, d: string, extra: Partial<PalestraHistoryEntry> = {}) =>
      alzata({ date, d, kg: 60, reps: 10, sets_n: 3, attrezzo: 20, scheda: { id: 'sc1', nome: 'Spinta' }, ...extra })
    const storico = [
      fatta('2026-06-02', 'W23', { scheda: undefined }),
      fatta('2026-06-09', 'W24', { scheda: undefined }),
      fatta('2026-09-10', 'W37'),
    ]
    const c = caricoConsigliato(storico, { sets: 3, reps: '8-10' }, 'sc1', '2026-09-17')
    expect(c).toMatchObject({ verso: 'su', kg: 62.5, da: 60 })
  })
})

// ── I moduli ───────────────────────────────────────────────────
const esercizio = (o: Partial<PalestraExercise> = {}): PalestraExercise =>
  ({ id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 }, history: [], ...o })

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('nuova alzata', () => {
  it('il campo è chiuso finché non lo si chiede, e l’attrezzo scritto finisce nell’alzata', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio()} onSave={onSave}/>)

    expect(screen.queryByLabelText('Peso dell’attrezzo a vuoto')).toBeNull()
    await user.click(await screen.findByRole('button', { name: /peso dell’attrezzo a vuoto/i }))
    await user.type(screen.getByLabelText('Peso dell’attrezzo a vuoto'), '20')
    // L'anteprima del massimale conta già il totale: 80 × (1 + 8/30).
    expect(screen.getByText('101 kg')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 8, sets_n: 3, attrezzo: 20 }))
  })

  it('chi non lo tocca salva come sempre, senza attrezzo', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio()} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('attrezzo')
  })

  it('su un esercizio che ce l’ha già parte compilato, e "0" di dischi è una serie vera', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio({ attrezzoKg: 20 })} onSave={onSave}/>)

    expect(await screen.findByLabelText('Peso dell’attrezzo a vuoto')).toHaveValue('20')
    const kg = screen.getByLabelText('Kg')
    // Campo vuoto: non si sa niente, e non si salva.
    await user.clear(kg)
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).not.toHaveBeenCalled()
    // Zero scritto: solo il bilanciere.
    await user.type(kg, '0')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 0, attrezzo: 20 }))
  })
})

describe('modifica esercizio', () => {
  it('scrive l’attrezzo sull’esercizio, e chiede se vale per le alzate di prima', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const ex = esercizio({ history: [alzata({}), alzata({ date: '2026-09-17' }), alzata({ kg: 0, bodyweight: true })] })
    render(<EditExModal open onClose={vi.fn()} ex={ex} onSave={onSave} onSaveMuscleColor={vi.fn()}/>)

    await user.click(await screen.findByRole('button', { name: /peso dell’attrezzo a vuoto/i }))
    await user.type(screen.getByLabelText('Peso dell’attrezzo a vuoto'), '20')
    // Le due alzate con attrezzo; quella a corpo libero non c'entra.
    const casella = screen.getByRole('checkbox', { name: /anche per le 2 alzate già registrate/i })
    expect(casella).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ attrezzoKg: 20 }), { attrezzoAncheAlleVecchie: false })
  })

  it('con la casella spuntata lo chiede davvero', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditExModal open onClose={vi.fn()} ex={esercizio({ history: [alzata({})] })} onSave={onSave} onSaveMuscleColor={vi.fn()}/>)
    await user.click(await screen.findByRole('button', { name: /peso dell’attrezzo a vuoto/i }))
    await user.type(screen.getByLabelText('Peso dell’attrezzo a vuoto'), '20')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ attrezzoKg: 20 }), { attrezzoAncheAlleVecchie: true })
  })

  it('chi non lo tocca non cambia niente, e non gli si chiede niente', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditExModal open onClose={vi.fn()} ex={esercizio({ history: [alzata({})] })} onSave={onSave} onSaveMuscleColor={vi.fn()}/>)
    expect(screen.queryByRole('checkbox')).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Salva' }))
    expect(onSave.mock.calls[0][0].attrezzoKg).toBeUndefined()
    expect(onSave.mock.calls[0][1]).toEqual({ attrezzoAncheAlleVecchie: false })
  })
})

describe('modifica di una singola alzata', () => {
  it('tiene l’attrezzo che aveva, e lo lascia correggere', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata({ attrezzo: 20 })} onClose={vi.fn()} onSave={onSave}/>)

    const campo = await screen.findByLabelText('Peso dell’attrezzo a vuoto')
    expect(campo).toHaveValue('20')
    await user.clear(campo)
    await user.type(campo, '15')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, attrezzo: 15 }))
  })

  it('un’alzata senza attrezzo resta senza', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata({})} onClose={vi.fn()} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Salva' }))
    expect(onSave.mock.calls[0][0].attrezzo).toBeUndefined()
  })
})

// ── L'allenamento da una scheda ────────────────────────────────
describe('allenamento con un esercizio che ha l’attrezzo dichiarato', () => {
  const giorniFa = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }

  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE,
      userName: 'Luca',
      palestraExercises: [esercizio({
        attrezzoKg: 20,
        history: [alzata({ date: giorniFa(7), d: 'W', attrezzo: 20 })],
      })],
      gymSchede: [{
        id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
        exercises: [{ id: 'se1', name: 'Panca piana', sets: 3, reps: '8', muscle: 'Petto', linkedExerciseId: 'px1' }],
      }],
    }, true)
  })

  async function apriAllenamento(user: ReturnType<typeof userEvent.setup>) {
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
  }
  const ultima = () => {
    const h = useJarvisStore.getState().palestraExercises[0].history
    return h[h.length - 1]
  }

  it('i campi sono in dischi, la card dice che l’attrezzo si somma, e l’alzata se lo porta dietro', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('60')
    expect(screen.getByText(/scrivi solo i dischi: \+ 20 kg di attrezzo/i)).toBeInTheDocument()

    for (const n of [1, 2, 3]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    expect(ultima()).toMatchObject({ kg: 60, sets_n: 3, attrezzo: 20 })
    // Il precompilato della volta dopo resta in dischi.
    expect(useJarvisStore.getState().palestraExercises[0].current.kg).toBe(60)
  })

  it('"0" scritto è una serie col solo attrezzo; il campo vuoto no, e lo dice', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    const kg1 = screen.getByLabelText('Panca piana · serie 1 · kg')
    await user.clear(kg1)
    await user.type(kg1, '0')
    await user.clear(screen.getByLabelText('Panca piana · serie 2 · kg'))
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    expect(screen.queryByText(/0 se usi solo l’attrezzo/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    expect(screen.getByText(/0 se usi solo l’attrezzo/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    // Solo la prima: zero dischi, venti di bilanciere.
    expect(ultima()).toMatchObject({ kg: 0, sets_n: 1, attrezzo: 20 })
  })
})
