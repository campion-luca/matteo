import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogPalestraModal, EditHistoryModal, AddExModal, EditExModal } from '@/features/gym/gymModals'
import { GymSchede } from '@/features/gym/GymSchede'
import { conGruppo } from '@/features/gym/catalogo'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'

// Tre cose che i moduli dell'alzata non facevano:
//  • dire perché «Salva» non salva (restava muto, e lo si ripremeva);
//  • rifiutare i numeri impossibili;
//  • far guardare due volte quelli lontani dall'ultima alzata.
// E il gruppo muscolare obbligatorio: senza, l'esercizio finiva in una card
// senza nome che non si apriva.

const alzata = (o: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W37', date: '2026-09-10', kg: 60, reps: 8, sets_n: 3, ...o })
const esercizio = (o: Partial<PalestraExercise> = {}): PalestraExercise =>
  ({ id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 }, history: [alzata()], ...o })

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(cleanup)

describe('nuova alzata: «Salva» dice cosa manca', () => {
  async function apri(ex = esercizio()) {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={ex} onSave={onSave}/>)
    await screen.findByRole('button', { name: 'Salva' })
    return { user, onSave }
  }
  const scrivi = async (user: ReturnType<typeof userEvent.setup>, etichetta: string, valore: string) => {
    const campo = screen.getByLabelText(etichetta)
    await user.clear(campo)
    if (valore) await user.type(campo, valore)
  }

  it('senza chili: il campo diventa rosso e sotto c’è scritto cosa serve', async () => {
    const { user, onSave } = await apri()
    await scrivi(user, 'Kg', '')
    await user.click(screen.getByRole('button', { name: 'Salva' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi i chili.')
    expect(screen.getByLabelText('Kg')).toHaveAttribute('aria-invalid', 'true')
    // Scrivendoli l'avviso se ne va, e si salva.
    await user.type(screen.getByLabelText('Kg'), '62,5')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 62.5 }))
  })

  it('senza serie o senza colpi lo dice, ognuno col suo campo', async () => {
    const { user, onSave } = await apri()
    await scrivi(user, 'Serie', '')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi quante serie hai fatto.')
    expect(screen.getByLabelText('Serie')).toHaveAttribute('aria-invalid', 'true')

    await scrivi(user, 'Serie', '3')
    await scrivi(user, 'Colpi', '')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi quanti colpi hai fatto.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('i numeri impossibili non si salvano: troppi chili, troppi colpi, troppe serie', async () => {
    const { user, onSave } = await apri()
    await scrivi(user, 'Kg', '600')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Più di 500 kg non si possono registrare.')

    await scrivi(user, 'Kg', '60')
    await scrivi(user, 'Colpi', '101')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Più di 100 colpi in una serie non si possono registrare.')

    await scrivi(user, 'Colpi', '8')
    await scrivi(user, 'Serie', '21')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Più di 20 serie non si possono registrare.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('un carico più che doppio dell’ultima volta si conferma, e poi si salva', async () => {
    const { user, onSave } = await apri()
    await scrivi(user, 'Kg', '160')
    await user.click(screen.getByRole('button', { name: 'Salva' }))

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Hai scritto 160 kg: l’ultima volta erano 60.')
    await user.click(screen.getByRole('button', { name: 'Conferma e salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 160 }))
  })

  it('meno della metà pure — uno zero dimenticato', async () => {
    const { user, onSave } = await apri()
    await scrivi(user, 'Kg', '6')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Hai scritto 6 kg: l’ultima volta erano 60.')
    // Correggendo il numero la conferma non serve più.
    await scrivi(user, 'Kg', '62,5')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 62.5 }))
  })

  it('una progressione normale, o la prima alzata di un esercizio, non chiedono niente', async () => {
    const primo = await apri(esercizio({ history: [] }))
    await scrivi(primo.user, 'Kg', '300')
    await primo.user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(primo.onSave).toHaveBeenCalledTimes(1)
  })

  it('a corpo libero la zavorra può raddoppiare senza domande', async () => {
    const { user, onSave } = await apri(esercizio({ n: 'Trazioni', bodyweight: true, history: [alzata({ kg: 10, bodyweight: true })] }))
    await scrivi(user, 'Zavorra', '25')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 25, bodyweight: true }))
  })
})

describe('modifica di un’alzata', () => {
  it('lontana dalle altre alzate dell’esercizio: si conferma', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata()} riferimentoKg={62.5} onClose={vi.fn()} onSave={onSave}/>)

    const kg = await screen.findByLabelText('Kg')
    await user.clear(kg)
    await user.type(kg, '6')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Hai scritto 6 kg: l’ultima volta erano 62,5.')
    await user.click(screen.getByRole('button', { name: 'Conferma e salva' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 6 }))
  })

  it('senza chili lo dice invece di restare muto; un numero impossibile non passa', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata()} riferimentoKg={60} onClose={vi.fn()} onSave={onSave}/>)

    const kg = await screen.findByLabelText('Kg')
    await user.clear(kg)
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi i chili.')

    await user.type(kg, '5000')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Più di 500 kg non si possono registrare.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('aprire e salvare senza toccare niente salva e basta', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata()} riferimentoKg={60} onClose={vi.fn()} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Salva' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})

describe('il gruppo muscolare è obbligatorio', () => {
  it('nuovo esercizio: senza gruppo non si crea, e lo si dice', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<AddExModal open onClose={vi.fn()} mode="palestra" onAdd={onAdd}/>)

    await user.click(await screen.findByRole('button', { name: /aggiungi|salva|crea/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi il nome dell’esercizio.')

    await user.type(screen.getByLabelText('Nome esercizio'), 'Hip thrust')
    await user.click(screen.getByRole('button', { name: /aggiungi|salva|crea/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scegli il gruppo muscolare.')
    expect(onAdd).not.toHaveBeenCalled()

    await user.selectOptions(screen.getByLabelText('Gruppo muscolare'), 'Glutei')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: /aggiungi|salva|crea/i }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ n: 'Hip thrust', muscle: 'Glutei' }))
  })

  it('aperto da un gruppo parte già con quello, e non chiede altro', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<AddExModal open onClose={vi.fn()} mode="palestra" onAdd={onAdd} presetMuscle="Dorso"/>)
    await user.type(await screen.findByLabelText('Nome esercizio'), 'Pulley')
    await user.click(screen.getByRole('button', { name: /aggiungi|salva|crea/i }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ n: 'Pulley', muscle: 'Dorso' }))
  })

  it('modifica esercizio: senza nome lo dice', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditExModal open onClose={vi.fn()} ex={esercizio()} onSave={onSave} onSaveMuscleColor={vi.fn()}/>)
    await user.clear(await screen.findByPlaceholderText('Nome esercizio'))
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi il nome dell’esercizio.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('gli esercizi rimasti senza gruppo vanno in «Altro»', () => {
    expect(conGruppo(esercizio({ muscle: '' })).muscle).toBe('Altro')
    expect(conGruppo(esercizio({ muscle: '   ' })).muscle).toBe('Altro')
    expect(conGruppo(esercizio({ muscle: undefined as unknown as string })).muscle).toBe('Altro')
    // Chi un gruppo ce l'ha — anche uno scritto a mano — resta dov'è.
    const suo = esercizio({ muscle: 'Avambracci' })
    expect(conGruppo(suo)).toBe(suo)
  })
})

// ── Il riepilogo di fine allenamento ───────────────────────────
describe('fine allenamento: i numeri da guardare prima di salvare', () => {
  const giorniFa = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }

  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE,
      userName: 'Luca',
      palestraExercises: [esercizio({ history: [alzata({ date: giorniFa(7), d: 'W' })] })],
      gymSchede: [{
        id: 'sc1', title: 'Spinta A', createdAt: '2026-09-01', updatedAt: '2026-09-01',
        exercises: [{ id: 'se1', name: 'Panca piana', sets: 2, reps: '8', muscle: 'Petto', linkedExerciseId: 'px1' }],
      }],
    }, true)
  })

  async function finoAlRiepilogo(kg: string) {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(screen.getByText('Spinta A'))
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    const campo = screen.getByLabelText('Panca piana · serie 1 · kg')
    await user.clear(campo)
    await user.type(campo, kg)
    await user.click(screen.getByRole('button', { name: /uguale/i }))
    for (const n of [1, 2]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    return user
  }
  const storico = () => useJarvisStore.getState().palestraExercises[0].history

  it('un numero impossibile ferma il salvataggio, col nome dell’esercizio', async () => {
    await finoAlRiepilogo('5000')
    expect(screen.getByText(/da correggere prima di salvare/i)).toHaveTextContent('Panca piana — Più di 500 kg non si possono registrare.')
    expect(screen.getByRole('button', { name: /salva e chiudi/i })).toBeDisabled()
    expect(storico()).toHaveLength(1)
  })

  it('un numero lontano dall’ultima volta si vede prima di salvare, e si può confermare', async () => {
    const user = await finoAlRiepilogo('160')
    expect(screen.getByText(/molto lontani dall’ultima volta/i)).toHaveTextContent('Panca piana: 160 kg (l’ultima volta 60)')
    await user.click(screen.getByRole('button', { name: 'Sono giusti: salva e chiudi' }))
    expect(storico()).toHaveLength(2)
    expect(storico()[1].kg).toBe(160)
  })

  it('un allenamento normale non mostra niente di tutto questo', async () => {
    const user = await finoAlRiepilogo('62,5')
    expect(screen.queryByText(/molto lontani/i)).toBeNull()
    expect(screen.queryByText(/da correggere/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Salva e chiudi' }))
    expect(storico()[1].kg).toBe(62.5)
  })
})
