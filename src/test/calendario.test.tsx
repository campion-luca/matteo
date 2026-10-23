import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarioAllenamenti } from '@/features/dashboard/CalendarioAllenamenti'
import { useJarvisStore, EMPTY_STATE, type PalestraExercise } from '@/store/useJarvisStore'

// Il calendario degli allenamenti dopo il rebranding (ott 2026): in cima, su
// fondo nero, le settimane di fila e i giorni di allenamento del mese; sotto il
// giorno scelto, con le schede chiuse e "Apri" che le apre tutte.

const SPINTA = { id: 'sA', nome: 'Spinta A' }
const ex = (id: string, n: string, history: PalestraExercise['history']): PalestraExercise => ({
  id, n, muscle: 'Petto', current: { kg: 60, reps: 10, sets_n: 3 }, history,
})

describe('il calendario degli allenamenti', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T10:00:00'))
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca',
      palestraExercises: [
        ex('p1', 'Panca piana', [{ d: 'W', date: '2026-10-22', kg: 60, reps: 10, sets_n: 3, scheda: SPINTA }]),
        ex('p2', 'Croci', [{ d: 'W', date: '2026-10-22', kg: 14, reps: 12, sets_n: 3, scheda: SPINTA }]),
        ex('p3', 'Alzate laterali al cavo', [
          { d: 'W', date: '2026-10-05', kg: 8, reps: 12, sets_n: 3 },
          { d: 'W', date: '2026-10-22', kg: 9, reps: 12, sets_n: 3 },
        ]),
      ],
    }, true)
  })
  afterEach(() => { vi.useRealTimers(); cleanup() })

  it('in cima la serie e i giorni del mese, e si apre sull’ultimo giorno allenato', () => {
    render(<CalendarioAllenamenti open onClose={vi.fn()}/>)
    expect(screen.getByText('giorni a Ottobre').previousSibling).toHaveTextContent('2')
    expect(screen.getByText(/giovedì 22 ottobre/i)).toBeInTheDocument()
    // Il primo allenamento è di questo mese: indietro non c'è niente.
    expect(screen.getByRole('button', { name: 'Mese precedente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mese successivo' })).toBeDisabled()
  })

  it('la scheda è una riga chiusa; «Apri» mostra i suoi esercizi, «Chiudi» li nasconde', async () => {
    const user = userEvent.setup()
    render(<CalendarioAllenamenti open onClose={vi.fn()}/>)
    expect(screen.getByText('Spinta A')).toBeInTheDocument()
    expect(screen.queryByText('Panca piana')).not.toBeInTheDocument()
    // L'alzata fatta a parte si vede subito, coi suoi chili.
    expect(screen.getByText('Alzate laterali al cavo').parentElement).toHaveTextContent('9 kg')

    await user.click(screen.getByRole('button', { name: 'Apri le schede del giorno' }))
    expect(screen.getByText('Panca piana')).toBeInTheDocument()
    expect(screen.getByText('Croci')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chiudi le schede del giorno' }))
    expect(screen.queryByText('Panca piana')).not.toBeInTheDocument()
  })

  it('un giorno senza allenamento lo dice, senza «Apri»', async () => {
    const user = userEvent.setup()
    render(<CalendarioAllenamenti open onClose={vi.fn()}/>)
    await user.click(screen.getByRole('button', { name: '20 Ottobre' }))
    expect(screen.getByText('Non ti sei allenato')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apri le schede del giorno' })).not.toBeInTheDocument()
  })
})
