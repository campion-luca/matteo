import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// Le schede si riordinano con le frecce accanto al cestino. L'ordine è quello
// dell'array nello store, quindi è anche quello che viaggia sul cloud.

const scheda = (id: string, title: string) => ({
  id, title, exercises: [], createdAt: '2026-09-01', updatedAt: '2026-09-01',
})

const ordine = () => useJarvisStore.getState().gymSchede.map(s => s.title)

beforeEach(() => {
  useJarvisStore.setState({
    ...EMPTY_STATE, userName: 'Luca',
    gymSchede: [scheda('a', 'Scheda A'), scheda('b', 'Scheda B'), scheda('c', 'Scheda C')],
  }, true)
})
afterEach(cleanup)

// La card della scheda: il contenitore cliccabile che porta il titolo.
const card = (title: string) => screen.getByText(title).closest('.cursor-pointer') as HTMLElement

describe('ordine delle schede', () => {
  it('le frecce spostano la scheda su e giù, senza aprirla', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)

    await user.click(within(card('Scheda C')).getByRole('button', { name: 'Sposta su' }))
    expect(ordine()).toEqual(['Scheda A', 'Scheda C', 'Scheda B'])

    await user.click(within(card('Scheda A')).getByRole('button', { name: 'Sposta giù' }))
    expect(ordine()).toEqual(['Scheda C', 'Scheda A', 'Scheda B'])

    // Il tocco sulla freccia non deve aprire il dettaglio: l'elenco è ancora lì.
    expect(screen.getByText('Scheda B')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inizia allenamento/i })).not.toBeInTheDocument()
  })

  it('la prima non sale e l’ultima non scende', () => {
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)
    expect(within(card('Scheda A')).getByRole('button', { name: 'Sposta su' })).toBeDisabled()
    expect(within(card('Scheda C')).getByRole('button', { name: 'Sposta giù' })).toBeDisabled()
  })
})
