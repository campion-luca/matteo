import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type GymScheda } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// Il report muscolare è di una scheda sola (4 nov 2026): si apre dal tasto in
// fondo al suo rettangolo. Prima ce n'era uno per tutte le schede insieme, in
// testa all'elenco.

const spinta: GymScheda = {
  id: 'sc1', title: 'Spinta A', createdAt: '2026-10-01', updatedAt: '2026-10-01',
  exercises: [
    { id: 'r1', name: 'Panca piana', sets: 4, reps: '8', linkedExerciseId: 'px1' },
    { id: 'r2', name: 'Push down', sets: 3, reps: '12', muscle: 'Tricipiti' },
  ],
}
const gambe: GymScheda = {
  id: 'sc2', title: 'Gambe', createdAt: '2026-10-02', updatedAt: '2026-10-02',
  exercises: [{ id: 'g1', name: 'Squat', sets: 5, reps: '5', muscle: 'Gambe' }],
}

beforeEach(() => {
  useJarvisStore.setState({
    ...EMPTY_STATE, userName: 'Luca', gymSchede: [spinta, gambe],
    palestraExercises: [{
      id: 'px1', n: 'Panca piana', muscle: 'Petto', muscle2: 'Tricipiti', current: { kg: 80, reps: 8, sets_n: 4 },
      history: [{ d: 'W', date: '2026-10-20', kg: 80, reps: 8, sets_n: 4 }],
    }],
  }, true)
  localStorage.clear()
})
afterEach(cleanup)

const monta = () => render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)

describe('il report muscolare di una scheda', () => {
  it('non c’è più quello generale in testa all’elenco: c’è un tasto per scheda', () => {
    monta()
    expect(screen.queryByTitle('Report gruppi muscolari')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report muscolare di Spinta A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report muscolare di Gambe' })).toBeInTheDocument()
  })

  it('dice serie e chili dei muscoli di quella scheda, e solo di quella', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Report muscolare di Spinta A' }))
    expect(screen.getByText('Report muscolare')).toBeInTheDocument()
    // Petto: le 4 serie della panca. Tricipiti: le 3 del push down + metà delle 4 della panca.
    expect(screen.getByText('Petto').parentElement!.parentElement!).toHaveTextContent(/4serie/)
    expect(screen.getByText('Tricipiti').parentElement!.parentElement!).toHaveTextContent(/5serie/)
    // I chili della panca: 4 × 8 × 80.
    expect(screen.getByText(/2\.6k kg/)).toBeInTheDocument()
    // Le gambe sono dell'altra scheda.
    expect(screen.queryByText('Gambe', { selector: 'div' })).not.toBeInTheDocument()
  })

  it('aprire il report non apre la scheda, e la freccia torna all’elenco', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Report muscolare di Gambe' }))
    expect(screen.queryByRole('button', { name: /inizia allenamento/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Report muscolare di Spinta A' })).toBeInTheDocument()
  })
})
