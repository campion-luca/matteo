import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type PalestraExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'

// Quello che l'allenamento salva nello storico, nei casi in cui salvava numeri
// sbagliati (audit di ottobre 2026): l'attrezzo dichiarato dopo uno storico, la
// riga cambiata con l'allenamento aperto, "fino a cedimento" senza colpi, il
// corpo libero detto in sessione e perso alla ripresa, il massimale dichiarato
// preso come punto di partenza, «uguale» sopra le serie già fatte.

const giorniFa = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }
const scheda = (title: string, exercises: GymScheda['exercises']): GymScheda =>
  ({ id: 'sc', title, createdAt: '2026-09-20', updatedAt: '2026-09-20', exercises })
const con = (schede: GymScheda[], esercizi: PalestraExercise[] = []) =>
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca', gymSchede: schede, palestraExercises: esercizi }, true)
const monta = () => render(<ConfirmDeleteProvider><GymSchede onBack={() => {}}/><ConfirmModal/></ConfirmDeleteProvider>)
const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement
const storicoDi = (id: string) => useJarvisStore.getState().palestraExercises.find(e => e.id === id)!.history

afterEach(() => { cleanup(); localStorage.clear() })

describe('l’allenamento salva quello che è successo', () => {
  it('con l’attrezzo dichiarato dopo uno storico, i campi propongono i dischi e non il totale', async () => {
    const user = userEvent.setup()
    con([scheda('Spinta', [{ id: 'r1', name: 'Panca piana', sets: 2, reps: '8', linkedExerciseId: 'px1' }])], [{
      id: 'px1', n: 'Panca piana', muscle: 'Petto', bodyweight: false, attrezzoKg: 20, current: { kg: 60, reps: 8, sets_n: 2 },
      history: [{ d: 'W', date: giorniFa(30), kg: 60, reps: 8, sets_n: 2 }, { d: 'W', date: giorniFa(7), kg: 60, reps: 8, sets_n: 2 }],
    }])
    monta()
    await user.click(screen.getByText('Spinta'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    // 60 era il totale: col bilanciere da 20, i dischi sono 40.
    expect(campo('Panca piana · serie 1 · kg').value).toBe('40')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    const storico = storicoDi('px1')
    const ultima = storico[storico.length - 1]
    expect(ultima.kg + (ultima.attrezzo ?? 0)).toBe(60)
  })

  it('una riga cambiata con l’allenamento aperto non si porta dietro i numeri del vecchio esercizio', async () => {
    const user = userEvent.setup()
    con([scheda('Gambe X', [{ id: 'r1', name: 'Leg press', sets: 2, reps: '8', linkedExerciseId: 'px1' }])], [
      { id: 'px1', n: 'Leg press', muscle: 'Gambe', current: { kg: 200, reps: 8, sets_n: 2 }, history: [{ d: 'W', date: giorniFa(7), kg: 200, reps: 8, sets_n: 2 }] },
      { id: 'px2', n: 'Hack squat', muscle: 'Gambe', current: { kg: 0, reps: 0, sets_n: 0 }, history: [] },
    ])
    monta()
    await user.click(screen.getByText('Gambe X'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.click(screen.getByRole('button', { name: /lascia aperto/i }))
    // «Cambia» nel form: stessa riga, un altro esercizio, altri colpi.
    act(() => { useJarvisStore.setState(st => ({ gymSchede: st.gymSchede.map(s => ({ ...s, exercises: [{ id: 'r1', name: 'Hack squat', sets: 2, reps: '12', linkedExerciseId: 'px2' }] })) })) })
    await user.click(screen.getByRole('button', { name: /riprendi allenamento|inizia allenamento/i }))
    expect(campo('Hack squat · serie 1 · kg').value).toBe('')
    expect(campo('Hack squat · serie 1 · colpi').value).toBe('12')
  })

  it('«fino a cedimento» senza i colpi scritti non si salva a zero', async () => {
    const user = userEvent.setup()
    con([scheda('Tirata', [{ id: 'r1', name: 'Rematore', sets: 2, reps: 'max', muscle: 'Dorso' }])])
    monta()
    await user.click(screen.getByText('Tirata'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.type(campo('Rematore · serie 1 · kg'), '40')
    await user.type(campo('Rematore · serie 2 · kg'), '40')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    expect(screen.getByText(/Scrivi quanti colpi hai fatto nelle serie fino a cedimento/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salva e chiudi/i })).toBeDisabled()
  })

  it('il corpo libero detto in sessione resta riprendendola', async () => {
    const user = userEvent.setup()
    con([scheda('Core Y', [{ id: 'r1', name: 'Hollow hold', sets: 2, reps: '10', muscle: 'Core' }])])
    monta()
    await user.click(screen.getByText('Core Y'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    await user.click(screen.getByRole('button', { name: /è a corpo libero/i }))
    // La pagina si rimonta: una ricarica, o iOS che l'ha scartata.
    cleanup()
    monta()
    await user.click(screen.getByText(/tocca per riprendere/))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    expect(screen.queryByText(/senza chili: non conta/i)).not.toBeInTheDocument()
  })

  it('dopo un massimale dichiarato si riparte dall’ultima alzata di lavoro', async () => {
    const user = userEvent.setup()
    con([scheda('Spinta', [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8', linkedExerciseId: 'px1' }])], [{
      id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 110, reps: 1, sets_n: 1 },
      history: [
        { d: 'W', date: giorniFa(9), kg: 80, reps: 8, sets_n: 3 },
        { d: 'W', date: giorniFa(2), kg: 110, reps: 1, sets_n: 1, maxLift: true },
      ],
    }])
    monta()
    await user.click(screen.getByText('Spinta'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(campo('Panca piana · serie 1 · kg').value).toBe('80')
  })

  it('«uguale» non riscrive le serie già spuntate', async () => {
    const user = userEvent.setup()
    con([scheda('Spinta', [{ id: 'r1', name: 'Panca piana', sets: 3, reps: '8', muscle: 'Petto' }])])
    monta()
    await user.click(screen.getByText('Spinta'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    await user.type(campo('Panca piana · serie 1 · kg'), '60')
    await user.type(campo('Panca piana · serie 2 · kg'), '65')
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    await user.click(screen.getByRole('button', { name: /uguale/i }))
    expect(campo('Panca piana · serie 2 · kg').value).toBe('65')
    expect(campo('Panca piana · serie 3 · kg').value).toBe('60')
  })
})
