import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { avvisaNuovoRank } from '@/features/gym/avvisoRank'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// L'avviso al coach parte dalle due strade da cui arriva un'alzata. Il test di
// avvisoRank dice cosa manda; questo dice che qualcuno lo chiama davvero.
vi.mock('@/features/gym/avvisoRank', () => ({ avvisaNuovoRank: vi.fn(async () => {}) }))
vi.mock('@/lib/supabase', async orig => ({ ...(await orig() as object), idUtenteSuDisco: () => 'u-io' }))

const panca70 = {
  id: 'px', n: 'Panca piana', muscle: 'Petto', current: { kg: 70, reps: 5, sets_n: 3 },
  history: [{ d: 'W1', date: '2026-01-01', kg: 70, reps: 5, sets_n: 3 }],
}
const scheda = {
  id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: [{ id: 'se1', name: 'Panca piana', sets: 1, reps: '10', muscle: 'Petto', linkedExerciseId: 'px' }],
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(avvisaNuovoRank).mockClear()
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Anna', userWeight: 80, userSex: 'M', gymSchede: [scheda], palestraExercises: [panca70] }, true)
})
afterEach(cleanup)

describe('l’avviso parte da dove nasce l’alzata', () => {
  const fineScheda = async (kg: string) => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.clear(screen.getByLabelText('Panca piana · serie 1 · kg'))
    await user.type(screen.getByLabelText('Panca piana · serie 1 · kg'), kg)
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
  }

  it('a fine scheda, col rank nuovo', async () => {
    await fineScheda('80')
    await screen.findByText('Nuovo rank: Oro')
    expect(avvisaNuovoRank).toHaveBeenCalledWith('u-io', 'Anna', [expect.objectContaining({ name: 'Panca piana', salitoA: 'Oro' })])
  })

  it('dall’alzata singola, col rank nuovo', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    await user.click(await screen.findByRole('button', { name: /Petto/ }))
    await user.click(await screen.findByRole('button', { name: /Panca piana/ }))
    await user.click(await screen.findByRole('button', { name: /nuova alzata/i }))
    const kg = await screen.findByLabelText('Kg')
    await user.clear(kg)
    await user.type(kg, '85')
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))

    await screen.findByText('Nuovo rank: Oro')
    expect(avvisaNuovoRank).toHaveBeenCalledWith('u-io', 'Anna', [{ name: 'Panca piana', salitoA: 'Oro' }])
  })

  it('un’alzata singola che non fa salire non avvisa', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    await user.click(await screen.findByRole('button', { name: /Petto/ }))
    await user.click(await screen.findByRole('button', { name: /Panca piana/ }))
    await user.click(await screen.findByRole('button', { name: /nuova alzata/i }))
    const kg = await screen.findByLabelText('Kg')
    await user.clear(kg)
    await user.type(kg, '72')
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))

    await screen.findByText('Nuovo record')
    expect(avvisaNuovoRank).not.toHaveBeenCalled()
  })
})
