import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type PalestraExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { esercizioPerNome, nomiDopoRinomina } from '@/features/gym/gymModel'

// Rinominare un esercizio. Le righe delle schede del coach non hanno il
// collegamento e cercano l'esercizio per nome: dopo un cambio di nome non lo
// ritrovavano più, e al primo allenamento ne nasceva un gemello vuoto. Adesso
// l'esercizio si ricorda i nomi di prima, e la riga col nome vecchio lo ritrova.

const panca = (o: Partial<PalestraExercise> = {}): PalestraExercise => ({
  id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 },
  history: [{ d: 'W', date: '2026-10-20', kg: 60, reps: 8, sets_n: 3 }], ...o,
})

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('i nomi di prima', () => {
  it('prima il nome di adesso, poi quelli di prima', () => {
    const rinominato = panca({ n: 'Panca piana bilanciere', nomiPrima: ['Panca piana'] })
    expect(esercizioPerNome([rinominato], ' panca PIANA ')).toBe(rinominato)
    // Un esercizio nuovo che si chiama come il nome vecchio dell'altro vince lui.
    const nuovo = panca({ id: 'px2' })
    expect(esercizioPerNome([rinominato, nuovo], 'Panca piana')).toBe(nuovo)
    expect(esercizioPerNome([rinominato], '')).toBeUndefined()
  })

  it('rinominando si aggiunge quello lasciato; tornando a un nome di prima, quello esce', () => {
    expect(nomiDopoRinomina({ n: 'Panca' }, 'Panca piana')).toEqual(['Panca'])
    expect(nomiDopoRinomina({ n: 'Panca piana', nomiPrima: ['Panca'] }, 'panca')).toEqual(['Panca piana'])
  })
})

describe('rinominare dalla pagina dell’esercizio', () => {
  it('il nome lasciato resta fra i nomi di prima', async () => {
    useJarvisStore.setState({ palestraExercises: [panca()] })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/></ConfirmDeleteProvider>)
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    await user.click(await screen.findByRole('button', { name: /Petto/ }))
    await user.click(await screen.findByRole('button', { name: /Panca piana/ }))
    await user.click(screen.getByRole('button', { name: 'Azioni sull’esercizio' }))
    await user.click(screen.getByRole('menuitem', { name: /Modifica esercizio/ }))
    const nome = await screen.findByPlaceholderText('Nome esercizio')
    await user.clear(nome)
    await user.type(nome, 'Panca piana bilanciere')
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(useJarvisStore.getState().palestraExercises[0]).toMatchObject({ n: 'Panca piana bilanciere', nomiPrima: ['Panca piana'] })
  })
})

describe('la scheda del coach dopo il rinomina', () => {
  it('ritrova l’esercizio: parte dai suoi chili e ci aggiunge l’alzata, senza farne un gemello', async () => {
    useJarvisStore.setState({
      palestraExercises: [panca({ n: 'Panca piana bilanciere', nomiPrima: ['Panca piana'] })],
      // Come arriva dal coach: il nome, senza collegamento.
      gymSchede: [{ id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01', exercises: [{ id: 'r1', name: 'Panca piana', sets: 1, reps: '8', muscle: 'Petto' }] }],
    })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('60')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    const esercizi = useJarvisStore.getState().palestraExercises
    expect(esercizi).toHaveLength(1)
    expect(esercizi[0].history).toHaveLength(2)
  })
})
