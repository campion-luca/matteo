import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede, SchedaFormPage } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type GymScheda } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// Il sottotitolo della scheda (4 nov 2026): una riga facoltativa sotto il nome,
// scritta nel form e letta più piccola nell'elenco e nel dettaglio.

const scheda: GymScheda = {
  id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8', muscle: 'Petto' }],
}

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

const form = (s: GymScheda) => {
  const onSave = vi.fn()
  render(<ConfirmDeleteProvider><SchedaFormPage scheda={s} palestraExercises={[]} onCancel={vi.fn()} onSave={onSave} onSaveDraft={vi.fn()}/></ConfirmDeleteProvider>)
  return onSave
}

describe('il sottotitolo della scheda', () => {
  it('si scrive sotto il nome e si salva senza spazi in più', async () => {
    const user = userEvent.setup()
    const onSave = form(scheda)
    await user.type(screen.getByLabelText('Sottotitolo'), '  Petto e tricipiti  ')
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0].sottotitolo).toBe('Petto e tricipiti')
  })

  it('vuoto non si salva', async () => {
    const user = userEvent.setup()
    const onSave = form({ ...scheda, sottotitolo: 'Vecchio' })
    await user.clear(screen.getByLabelText('Sottotitolo'))
    await user.click(screen.getAllByRole('button', { name: /Salva modifiche/ })[0])
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('sottotitolo')
  })

  it('si legge nell’elenco e nel dettaglio', async () => {
    useJarvisStore.setState({ gymSchede: [{ ...scheda, sottotitolo: 'Petto e tricipiti' }] })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    expect(screen.getByText('Petto e tricipiti')).toBeInTheDocument()
    await user.click(screen.getByText('Spinta A'))
    expect(screen.getByText('Petto e tricipiti')).toBeInTheDocument()
  })
})
