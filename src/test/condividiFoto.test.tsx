import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// Nella scelta di con chi condividere una scheda c'è la faccia di ogni allievo:
// la sua foto, o le iniziali se non ne ha messa una (4 nov 2026).

vi.mock('@/lib/supabase', async importOriginal => ({ ...(await importOriginal<object>()), idUtenteSuDisco: () => 'coach-1' }))
vi.mock('@/lib/coach', async importOriginal => ({
  ...(await importOriginal<object>()),
  schedeRicevute: async () => [],
  myCoaches: async () => [],
  myAthletes: async () => [
    { coach_id: 'coach-1', athlete_id: 'anna', athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01' },
    { coach_id: 'coach-1', athlete_id: 'bruno', athlete_name: 'Bruno Neri', coach_name: 'Luca', created_at: '2026-10-01' },
  ],
}))
vi.mock('@/lib/profili', async importOriginal => ({ ...(await importOriginal<object>()), leggiProfili: async () => ({}) }))

const { GymSchede } = await import('@/features/gym/GymSchede')
const { useProfiliStore } = await import('@/lib/profili')

beforeEach(() => {
  useJarvisStore.setState({
    ...EMPTY_STATE, userName: 'Luca',
    gymSchede: [{ id: 'sc1', title: 'Spinta A', createdAt: '2026-10-01', updatedAt: '2026-10-01', exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8', muscle: 'Petto' }] }],
  }, true)
  useProfiliStore.setState({ owner: 'coach-1', profili: { anna: { user_id: 'anna', nome: 'Anna', cognome: 'Bianchi', foto: 'data:image/png;base64,AAAA' } as never } })
  localStorage.clear()
})
afterEach(cleanup)

describe('condividere una scheda', () => {
  it('ogni allievo ha la sua foto, o le iniziali se non ne ha una', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(await screen.findByRole('button', { name: 'Condividi la scheda' }))
    const finestra = screen.getByRole('dialog')
    // Anna ha la foto, e il nome completo dal suo profilo.
    const anna = within(finestra).getByRole('button', { name: /Anna Bianchi/ })
    expect(anna.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    // Bruno non ha un profilo: le iniziali.
    const bruno = within(finestra).getByRole('button', { name: /Bruno Neri/ })
    expect(bruno.querySelector('img')).toBeNull()
    expect(bruno).toHaveTextContent('BN')
  })
})
