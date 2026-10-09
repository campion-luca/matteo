import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { localISO } from '@/lib/isoDate'

// Le schede si riordinano con le frecce accanto al cestino. L'ordine è quello
// dell'array nello store, quindi è anche quello che viaggia sul cloud.
//
// Frecce e cestino stanno dietro la matita in testata: fuori dalla modalità
// modifica l'elenco è solo da leggere e da aprire.

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

/** Accende la modalità modifica: senza, frecce e cestino non sono in pagina. */
const apriModifica = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Modifica elenco' }))

describe('ordine delle schede', () => {
  it('le frecce spostano la scheda su e giù, senza aprirla', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)
    await apriModifica(user)

    await user.click(within(card('Scheda C')).getByRole('button', { name: 'Sposta su' }))
    expect(ordine()).toEqual(['Scheda A', 'Scheda C', 'Scheda B'])

    await user.click(within(card('Scheda A')).getByRole('button', { name: 'Sposta giù' }))
    expect(ordine()).toEqual(['Scheda C', 'Scheda A', 'Scheda B'])

    // Il tocco sulla freccia non deve aprire il dettaglio: l'elenco è ancora lì.
    expect(screen.getByText('Scheda B')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /inizia allenamento/i })).not.toBeInTheDocument()
  })

  it('la prima non sale e l’ultima non scende', async () => {
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)
    await apriModifica(user)
    expect(within(card('Scheda A')).getByRole('button', { name: 'Sposta su' })).toBeDisabled()
    expect(within(card('Scheda C')).getByRole('button', { name: 'Sposta giù' })).toBeDisabled()
  })

  it('a riposo l’elenco non mostra né frecce né cestino', async () => {
    // Il guasto che questo previene: rimettere i comandi sempre accesi, e con
    // loro tre bersagli da schivare su ogni riga per arrivare alla scheda.
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)
    expect(screen.queryByRole('button', { name: 'Sposta su' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elimina Scheda A' })).not.toBeInTheDocument()

    await apriModifica(user)
    expect(screen.getByRole('button', { name: 'Elimina Scheda A' })).toBeInTheDocument()

    // E si richiude: la matita è un interruttore, non un viaggio di sola andata.
    await user.click(screen.getByRole('button', { name: 'Fine' }))
    expect(screen.queryByRole('button', { name: 'Sposta su' })).not.toBeInTheDocument()
  })
})

// L'elenco è diviso per mese e anno in cui la scheda è nata, e ogni scheda dice
// da quanto esiste: è il numero che dice quando è ora di cambiarla.
describe('le schede per mese e anno', () => {
  const nata = (id: string, title: string, createdAt: string) => ({ ...scheda(id, title), createdAt })
  const monta = () => render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/></ConfirmDeleteProvider>)

  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca',
      gymSchede: [nata('a', 'Scheda A', '2026-08-15'), nata('b', 'Scheda B', '2026-09-01'), nata('c', 'Scheda C', '2026-09-20'), nata('d', 'Scheda D', '2026-08-02')],
    }, true)
  })

  it('un titolo per mese, dal più recente, con sotto le sue schede nell’ordine dell’elenco', () => {
    monta()
    const testo = document.body.textContent ?? ''
    const posti = ['Settembre 2026', 'Scheda B', 'Scheda C', 'Agosto 2026', 'Scheda A', 'Scheda D'].map(x => testo.indexOf(x))
    expect(posti.every(p => p >= 0)).toBe(true)
    expect([...posti].sort((x, y) => x - y)).toEqual(posti)
  })

  it('un mese si richiude toccandone il titolo, e si riapre', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: /Agosto 2026/ }))
    expect(screen.queryByText('Scheda A')).not.toBeInTheDocument()
    expect(screen.getByText('Scheda B')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Agosto 2026/ }))
    expect(screen.getByText('Scheda A')).toBeInTheDocument()
  })

  it('le frecce scambiano una scheda con la vicina dello stesso mese, non con una di un altro', async () => {
    const user = userEvent.setup()
    monta()
    await apriModifica(user)
    // Scheda A è la prima di agosto: sopra di lei non c'è niente con cui scambiarla…
    expect(within(card('Scheda A')).getByRole('button', { name: 'Sposta su' })).toBeDisabled()
    // …e sotto c'è Scheda D, che nello store sta tre posti più in là.
    await user.click(within(card('Scheda A')).getByRole('button', { name: 'Sposta giù' }))
    expect(ordine()).toEqual(['Scheda D', 'Scheda B', 'Scheda C', 'Scheda A'])
  })

  it('ogni scheda dice da quanto esiste', () => {
    const giorniFa = (n: number) => { const d = new Date(); return localISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n)) }
    useJarvisStore.setState({ gymSchede: [nata('a', 'Scheda A', giorniFa(21)), nata('b', 'Scheda B', giorniFa(0))] })
    monta()
    expect(within(card('Scheda A')).getByText('da 3 settimane')).toBeInTheDocument()
    expect(within(card('Scheda B')).getByText('da oggi')).toBeInTheDocument()
  })
})
