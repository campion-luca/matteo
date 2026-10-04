import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// Il menù sotto lo switch Pesi/Hyrox cambia con lo switch. Coaching, Schede e
// Statistiche sono il menù dei pesi; in Hyrox resta solo Statistiche, sotto
// Esercizi e Gara, e mostra i tempi — non i pesi.

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

const monta = () => render(
  <ConfirmDeleteProvider>
    <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
  </ConfirmDeleteProvider>,
)

describe('menù dell’allenamento', () => {
  it('nei pesi: Coaching, Schede e Statistiche', () => {
    monta()
    expect(screen.getByRole('button', { name: 'Coaching' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schede' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Statistiche' })).toBeInTheDocument()
  })

  it('in Hyrox: solo Statistiche, sotto Esercizi e Gara', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Hyrox' }))

    expect(screen.queryByRole('button', { name: 'Coaching' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Schede' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Esercizi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gara' })).toBeInTheDocument()

    // Statistiche apre i tempi Hyrox, e si richiude da Esercizi.
    const stats = screen.getByRole('button', { name: 'Statistiche' })
    await user.click(stats)
    expect(stats).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Tempi per esercizio')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    expect(screen.queryByText('Tempi per esercizio')).not.toBeInTheDocument()
    expect(screen.getByText('Stazioni gara')).toBeInTheDocument()
  })

  it('le statistiche dei pesi parlano solo di pesi', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Statistiche' }))
    expect(screen.queryByText('Tempi per esercizio')).not.toBeInTheDocument()
    // Un solo "Hyrox": lo switch in testata, non un secondo dentro le statistiche.
    expect(screen.getAllByRole('button', { name: 'Hyrox' })).toHaveLength(1)
  })
})
