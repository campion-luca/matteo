import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// Eseguire una scheda è il modo in cui la maggior parte delle alzate finisce
// nello storico: quello che si spunta qui diventa un dato su cui poggiano volume,
// massimali e record. Il caso che conta è l'allenamento andato storto — meno
// serie e meno colpi del previsto — perché è quello in cui il programma e la
// realtà divergono, ed è quello che prima veniva salvato come se fosse riuscito.

const scheda = {
  id: 'sc1',
  title: 'Spinta A',
  exercises: [
    { id: 'se1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto' },
  ],
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
}

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca', gymSchede: [scheda] }, true)
})
afterEach(cleanup)

// Lista → dettaglio → allenamento.
async function apriAllenamento(user: ReturnType<typeof userEvent.setup>) {
  render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)
  await user.click(screen.getByText('Spinta A'))
  await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
}

const alzate = () => useJarvisStore.getState().palestraExercises.find(e => e.n === 'Panca piana')?.history ?? []

describe('esecuzione di una scheda', () => {
  it('i colpi partono dall’obiettivo e si salvano com’è andata davvero', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    // Precompilati sull'obiettivo della scheda: chi rispetta il programma non tocca nulla.
    expect(screen.getByLabelText('Panca piana · serie 1 · colpi')).toHaveValue('10')

    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    // Seconda serie chiusa corta: 6 invece di 10.
    const colpi2 = screen.getByLabelText('Panca piana · serie 2 · colpi')
    await user.clear(colpi2)
    await user.type(colpi2, '6')
    // La terza non si fa: fine del tempo.

    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    const h = alzate()
    expect(h).toHaveLength(1)
    expect(h[0].sets_n).toBe(2)          // due serie spuntate su tre previste
    expect(h[0].setReps).toEqual([10, 6]) // i colpi reali, non l'obiettivo replicato
  })

  it('la serie corta si segna in rosso mentre la si scrive', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    const colpi1 = screen.getByLabelText('Panca piana · serie 1 · colpi')
    expect(colpi1).not.toHaveAttribute('aria-invalid')

    await user.clear(colpi1)
    await user.type(colpi1, '7')
    expect(screen.getByLabelText('Panca piana · serie 1 · colpi')).toHaveAttribute('aria-invalid', 'true')
  })

  it('un allenamento a programma non porta con sé colpi per serie', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    for (const n of [1, 2, 3]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    const h = alzate()
    expect(h[0].sets_n).toBe(3)
    expect(h[0].reps).toBe(10)
    // Tutti uguali ⇒ niente array: `setReps` è per le alzate che variano davvero.
    expect(h[0].setReps).toBeUndefined()
  })
})
