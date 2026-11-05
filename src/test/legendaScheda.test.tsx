import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SchedaFormPage } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type GymSchedaExercise, type PalestraExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ripartizioneMuscoli } from '@/features/gym/anteprimaScheda'

// La legenda del form su desktop e il report di una scheda fanno lo stesso
// conto: le serie allenanti e i chili, muscolo per muscolo.

vi.mock('@/hooks/useIsDesktop', () => ({ useIsDesktop: () => true }))

const panca: PalestraExercise = {
  id: 'px1', n: 'Panca piana', muscle: 'Petto', muscle2: 'Tricipiti', current: { kg: 80, reps: 8, sets_n: 3 },
  history: [{ d: 'W', date: '2026-10-20', kg: 80, reps: 8, sets_n: 3 }],
}
const riga = (o: Partial<GymSchedaExercise> & { name: string }): GymSchedaExercise => ({ id: `r-${o.name}`, sets: 3, reps: '8', ...o })

beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true))
afterEach(cleanup)

describe('serie e chili per muscolo', () => {
  it('il principale prende tutte le serie, il secondario metà; i chili dall’ultima alzata', () => {
    const r = ripartizioneMuscoli([riga({ name: 'Panca piana', linkedExerciseId: 'px1' })], [panca])
    expect(r).toMatchObject({ esercizi: 1, serie: 3, chili: 3 * 8 * 80 })
    expect(r.muscoli).toEqual([
      { muscolo: 'Petto', serie: 3, esercizi: 1, chili: 1920 },
      { muscolo: 'Tricipiti', serie: 1.5, esercizi: 0, chili: 960 },
    ])
  })

  it('un esercizio mai fatto conta nelle serie e non nei chili', () => {
    const r = ripartizioneMuscoli([riga({ name: 'Squat', muscle: 'Gambe', sets: 4 })], [])
    expect(r.muscoli).toEqual([{ muscolo: 'Gambe', serie: 4, esercizi: 1, chili: 0 }])
  })

  it('«max» prende i colpi dell’ultima volta', () => {
    const r = ripartizioneMuscoli([riga({ name: 'Panca piana', linkedExerciseId: 'px1', reps: 'max', sets: 1 })], [panca])
    expect(r.chili).toBe(8 * 80)
  })
})

describe('la legenda accanto al form, su desktop', () => {
  const scheda: GymScheda = {
    id: 'sc1', title: 'Spinta A', createdAt: '2026-10-01', updatedAt: '2026-10-01',
    exercises: [riga({ name: 'Panca piana', linkedExerciseId: 'px1', tecnica: { tipo: 'dropSet', serie: 'ultima' } })],
  }

  it('dice muscoli e serie della scheda, e la tecnica usata', () => {
    render(<ConfirmDeleteProvider><SchedaFormPage scheda={scheda} palestraExercises={[panca]} onCancel={vi.fn()} onSave={vi.fn()} onSaveDraft={vi.fn()}/></ConfirmDeleteProvider>)
    const legenda = screen.getByRole('complementary')
    expect(within(legenda).getByText('Petto')).toBeInTheDocument()
    expect(within(legenda).getByText('Tricipiti')).toBeInTheDocument()
    expect(within(legenda).getByText('1,5')).toBeInTheDocument()
    expect(within(legenda).getByText('Drop set')).toBeInTheDocument()
  })

  it('si aggiorna mentre si aggiungono le righe', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><SchedaFormPage scheda={null} palestraExercises={[]} onCancel={vi.fn()} onSave={vi.fn()} onSaveDraft={vi.fn()}/></ConfirmDeleteProvider>)
    expect(screen.getByText(/Aggiungi un esercizio: qui compaiono i muscoli/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nome esercizio'), 'Squat')
    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Gambe')
    const legenda = screen.getByRole('complementary')
    expect(within(legenda).getByText('Gambe')).toBeInTheDocument()
    expect(within(legenda).getByText(/1 esercizio · 3 serie/)).toBeInTheDocument()
  })
})
