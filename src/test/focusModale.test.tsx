import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NuovoGruppoModal, AddExModal } from '@/features/gym/gymModals'

// All'apertura un modale porta il focus dentro di sé, un frame dopo essersi
// montato. Lo spostava SEMPRE sul primo elemento — la × in testata — anche
// quando il focus era già dentro: rubava il campo con `autoFocus`, e chi aveva
// già cominciato a scrivere si ritrovava i tasti sulla ×.

const unFrame = () => new Promise(r => setTimeout(r, 60))

afterEach(cleanup)

describe('il focus all’apertura di un modale', () => {
  it('un campo con autoFocus se lo tiene', async () => {
    render(<NuovoGruppoModal open onClose={vi.fn()} onCrea={vi.fn()} esistenti={[]}/>)
    const nome = await screen.findByPlaceholderText('Es. Avambracci')
    await unFrame()
    expect(nome).toHaveFocus()
  })

  it('senza un campo da preferire va sul primo elemento, dentro il modale', async () => {
    render(<AddExModal open onClose={vi.fn()} mode="palestra" onAdd={vi.fn()}/>)
    const dialogo = await screen.findByRole('dialog')
    await unFrame()
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)
  })

  it('chi scrive subito non perde lettere', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<AddExModal open onClose={vi.fn()} mode="palestra" onAdd={onAdd} presetMuscle="Dorso"/>)
    // Senza aspettare il frame: è la gara che faceva fallire il test a caso.
    await user.type(await screen.findByLabelText('Nome esercizio'), 'Pulley')
    await unFrame()
    expect(screen.getByLabelText('Nome esercizio')).toHaveValue('Pulley')
  })
})
