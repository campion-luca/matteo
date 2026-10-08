import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// Le statistiche sono una pagina a sé, come le schede: la card in home le apre
// sopra la home, e una freccia riporta indietro. Prima erano un interruttore —
// i grafici prendevano il posto dei gruppi muscolari sotto la testata, e per
// richiuderle si ritoccava la card.

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

describe('la pagina delle statistiche', () => {
  it('la card la apre sopra la home, col suo titolo e il riepilogo in cima', async () => {
    const user = userEvent.setup()
    monta()
    expect(screen.queryByText('Riepilogo complessivo')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Statistiche' }))

    expect(screen.getByText('Riepilogo complessivo')).toBeInTheDocument()
    expect(screen.getByText('Statistiche', { selector: '.j-page-title' })).toBeInTheDocument()
    // La home è sotto, coperta: le sue card e i gruppi non si raggiungono più
    // finché non si torna indietro.
    expect(screen.queryByRole('button', { name: 'Schede' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Statistiche' })).not.toBeInTheDocument()
  })

  it('la freccia riporta alla home, com’era', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Statistiche' }))
    await user.click(screen.getByRole('button', { name: 'Indietro' }))

    expect(screen.queryByText('Riepilogo complessivo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coaching' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schede' })).toBeInTheDocument()
    expect(screen.getByText('Gruppi muscolari')).toBeInTheDocument()
  })

  it('la card non è più un interruttore: apre e basta, senza restare accesa', async () => {
    const user = userEvent.setup()
    monta()
    const card = screen.getByRole('button', { name: 'Statistiche' })
    expect(card).not.toHaveAttribute('aria-pressed')
    await user.click(card)
    await user.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Statistiche' })).not.toHaveAttribute('aria-pressed')
  })

  it('la settimana in testata non si ripete dentro la pagina: resta una riga nel riepilogo', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Statistiche' }))
    // Un solo tasto per il calendario a portata: la striscia della home è coperta.
    expect(screen.getAllByRole('button', { name: 'Apri il calendario degli allenamenti' })).toHaveLength(1)
  })
})
