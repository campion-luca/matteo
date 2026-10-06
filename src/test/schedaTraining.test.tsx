import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GymSchede } from '@/features/gym/GymSchede'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'

// Il consiglio dipende da quanto tempo è passato: le alzate "della settimana
// scorsa" vanno datate rispetto a oggi, o fra un mese diventano uno stop.
const giorniFa = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d) }

// Eseguire una scheda è il modo in cui la maggior parte delle alzate finisce
// nello storico: quello che si spunta qui diventa un dato su cui poggiano volume,
// massimali e record. Il caso che conta è l'allenamento andato storto — meno
// serie e meno colpi del previsto — perché è quello in cui il programma e la
// realtà divergono, ed è quello che prima veniva salvato come se fosse riuscito.

const scheda = {
  id: 'sc1',
  title: 'Spinta A',
  exercises: [
    { id: 'se1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto' },
  ],
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
}

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca', gymSchede: [scheda] }, true)
  // L'allenamento a metà sopravvive in localStorage (vedi sessioneInCorso): senza
  // questa riga il secondo test riprende le spunte del primo invece di partire da
  // una scheda pulita.
  localStorage.clear()
})
afterEach(cleanup)

// Lista → dettaglio → allenamento.
async function apriAllenamento(user: ReturnType<typeof userEvent.setup>) {
  render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
  await user.click(screen.getByText('Spinta A'))
  await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
}

const alzate = (nome = 'Panca piana') => useJarvisStore.getState().palestraExercises.find(e => e.n === nome)?.history ?? []

// Due alzate a mano di un paio di mesi fa: l'esercizio non è nuovo. Su uno
// nuovo il consiglio non fa salire per le prime due settimane (vedi più sotto).
const daMesi = (kg: number) => [
  { d: 'W', date: giorniFa(63), kg, reps: 10, sets_n: 3 },
  { d: 'W', date: giorniFa(56), kg, reps: 10, sets_n: 3 },
]

describe('esecuzione di una scheda', () => {
  it('i colpi partono dall’obiettivo e si salvano com’è andata davvero', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    // Precompilati sull'obiettivo della scheda: chi rispetta il programma non tocca nulla.
    expect(screen.getByLabelText('Panca piana · serie 1 · colpi')).toHaveValue('10')

    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: 'Serie 2' }))
    // Seconda serie chiusa corta: 6 invece di 10.
    const colpi2 = screen.getByLabelText('Panca piana · serie 2 · colpi')
    await user.clear(colpi2)
    await user.type(colpi2, '6')
    // La terza non si fa: fine del tempo.

    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    const h = alzate()
    expect(h).toHaveLength(1)
    expect(h[0].sets_n).toBe(2)          // due serie spuntate su tre previste
    expect(h[0].setReps).toEqual([10, 6]) // i colpi reali, non l'obiettivo replicato
    // Il calendario raggruppa il giorno per scheda: l'alzata deve dire da quale viene.
    expect(h[0].scheda?.nome).toBe('Spinta A')
  })

  it('la serie corta si segna in rosso mentre la si scrive', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    const colpi1 = screen.getByLabelText('Panca piana · serie 1 · colpi')
    expect(colpi1).not.toHaveAttribute('aria-invalid')

    await user.clear(colpi1)
    await user.type(colpi1, '7')
    expect(screen.getByLabelText('Panca piana · serie 1 · colpi')).toHaveAttribute('aria-invalid', 'true')
  })

  it('un allenamento a programma non porta con sé colpi per serie', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    for (const n of [1, 2, 3]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    const h = alzate()
    expect(h[0].sets_n).toBe(3)
    expect(h[0].reps).toBe(10)
    // Tutti uguali ⇒ niente array: `setReps` è per le alzate che variano davvero.
    expect(h[0].setReps).toBeUndefined()
  })
})

// ── L'obiettivo "max" ──────────────────────────────────────────
// Le serie a cedimento non hanno un bersaglio: si va finché si va. Nella scheda
// si scrivono "max" (c'è un tasto apposta nel form), e da lì in poi tutto deve
// comportarsi come se un obiettivo non ci fosse — perché non c'è.
describe('una scheda con obiettivo «max»', () => {
  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE,
      userName: 'Luca',
      gymSchede: [{
        ...scheda,
        exercises: [{ id: 'se1', name: 'Piegamenti', sets: 2, reps: 'max', muscle: 'Petto' }],
      }],
    }, true)
  })

  it('non precompila i colpi con un numero inventato', async () => {
    // Il rischio è che "max" venga letto come 0 e finisca scritto nel campo: uno
    // zero da cancellare a mano prima di poter scrivere quanto se n'è fatti.
    const user = userEvent.setup()
    await apriAllenamento(user)
    expect(screen.getByLabelText('Piegamenti · serie 1 · colpi')).toHaveValue('')
  })

  it('non segna in rosso nessuna serie, per quanto corta', async () => {
    // Senza bersaglio non si può stare sotto. Se "max" tornasse un numero — un
    // default a 8, poniamo — ogni serie a cedimento sotto quella soglia si
    // colorerebbe di rosso, e il rosso smetterebbe di voler dire qualcosa.
    const user = userEvent.setup()
    await apriAllenamento(user)

    const colpi = screen.getByLabelText('Piegamenti · serie 1 · colpi')
    await user.type(colpi, '3')
    expect(screen.getByLabelText('Piegamenti · serie 1 · colpi')).not.toHaveAttribute('aria-invalid')
  })

  it('salva i colpi davvero fatti', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)

    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.type(screen.getByLabelText('Piegamenti · serie 1 · colpi'), '14')
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    const h = useJarvisStore.getState().palestraExercises.find(e => e.n === 'Piegamenti')?.history ?? []
    expect(h).toHaveLength(1)
    expect(h[0].reps).toBe(14)
  })
})

// ── Nota, ordine dei campi, carico consigliato, storico ────────
describe('allenamento: le aggiunte di settembre', () => {
  it('i colpi vengono prima dei chili in ogni serie', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    const colpi = screen.getByLabelText('Panca piana · serie 1 · colpi')
    const kg = screen.getByLabelText('Panca piana · serie 1 · kg')
    // DOCUMENT_POSITION_FOLLOWING: `kg` sta dopo `colpi` nel documento.
    expect(colpi.compareDocumentPosition(kg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('la nota scritta in allenamento finisce nell’alzata', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    await user.click(screen.getByRole('button', { name: 'Panca piana · Aggiungi nota' }))
    await user.type(screen.getByLabelText('Panca piana · nota'), 'sedile al 4')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    expect(alzate()[0].note).toBe('sedile al 4')
  })

  it('consiglia di salire dopo un allenamento completo, e «Usa» lo scrive', async () => {
    useJarvisStore.setState({
      palestraExercises: [{
        id: 'px1', n: 'Panca piana', muscle: 'Petto',
        current: { kg: 60, reps: 10, sets_n: 3 },
        history: [...daMesi(55), { d: 'W37', date: giorniFa(7), kg: 60, reps: 10, sets_n: 3, scheda: { id: 'sc1', nome: 'Spinta A' } }],
      }],
    })
    const user = userEvent.setup()
    await apriAllenamento(user)
    // Una settimana piena: è un permesso, non un ordine.
    expect(screen.getByText('Puoi salire')).toBeInTheDocument()
    expect(screen.getByText(/62,5 kg/)).toBeInTheDocument()
    // Precompilato sull'ultima volta: il consiglio non si impone da solo.
    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('60')
    await user.click(screen.getByRole('button', { name: 'Usa' }))
    expect(screen.getByLabelText('Panca piana · serie 3 · kg')).toHaveValue('62,5')
  })

  it('dopo l’ultima serie salita, «Usa» scrive il peso alto su due serie', async () => {
    useJarvisStore.setState({
      palestraExercises: [{
        id: 'px1', n: 'Panca piana', muscle: 'Petto',
        current: { kg: 62.5, reps: 10, sets_n: 3 },
        history: [...daMesi(55), { d: 'W37', date: giorniFa(7), kg: 62.5, reps: 10, sets_n: 3, setWeights: [60, 60, 62.5], scheda: { id: 'sc1', nome: 'Spinta A' } }],
      }],
    })
    const user = userEvent.setup()
    await apriAllenamento(user)
    expect(screen.getByText(/60 · 62,5 · 62,5 kg/)).toBeInTheDocument()
    // Precompilato serie per serie com'era andata, non col peso più alto su
    // tutte: chi spunta senza toccare niente salva quello che ha fatto davvero.
    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('60')
    expect(screen.getByLabelText('Panca piana · serie 2 · kg')).toHaveValue('60')
    expect(screen.getByLabelText('Panca piana · serie 3 · kg')).toHaveValue('62,5')
    await user.click(screen.getByRole('button', { name: 'Usa' }))
    expect(screen.getByLabelText('Panca piana · serie 1 · kg')).toHaveValue('60')
    expect(screen.getByLabelText('Panca piana · serie 2 · kg')).toHaveValue('62,5')
    expect(screen.getByLabelText('Panca piana · serie 3 · kg')).toHaveValue('62,5')
  })

  it('dopo più di dieci giorni di stop non dice né di salire né di scendere', async () => {
    useJarvisStore.setState({
      palestraExercises: [{
        id: 'px1', n: 'Panca piana', muscle: 'Petto',
        current: { kg: 60, reps: 10, sets_n: 3 },
        // Tutto fatto, da manuale "puoi salire" — ma tre settimane fa.
        history: [{ d: 'W', date: giorniFa(21), kg: 60, reps: 10, sets_n: 3, scheda: { id: 'sc1', nome: 'Spinta A' } }],
      }],
    })
    const user = userEvent.setup()
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    // Già nell'elenco: da quanto non la si fa.
    expect(screen.getByText(/21 giorni fa/)).toBeInTheDocument()
    await user.click(screen.getByText('Spinta A'))
    // E prima di cominciare, sul dettaglio.
    expect(screen.getByText(/Non fai questa scheda da 21 giorni/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /inizia allenamento/i }))
    expect(screen.getByText('Dopo lo stop')).toBeInTheDocument()
    expect(screen.getByText(/farai più fatica a sollevare questi carichi/)).toBeInTheDocument()
    expect(screen.queryByText('Puoi salire')).not.toBeInTheDocument()
  })

  it('su un esercizio nuovo non dice di salire: prima l’esecuzione', async () => {
    useJarvisStore.setState({
      palestraExercises: [{
        id: 'px1', n: 'Panca piana', muscle: 'Petto',
        current: { kg: 60, reps: 10, sets_n: 3 },
        // Tutto fatto la settimana scorsa — che era anche la prima in assoluto.
        history: [{ d: 'W37', date: giorniFa(7), kg: 60, reps: 10, sets_n: 3, scheda: { id: 'sc1', nome: 'Spinta A' } }],
      }],
    })
    const user = userEvent.setup()
    await apriAllenamento(user)
    expect(screen.getByText('Esercizio nuovo')).toBeInTheDocument()
    expect(screen.getByText(/cura l’esecuzione/)).toBeInTheDocument()
    expect(screen.queryByText('Puoi salire')).not.toBeInTheDocument()
    // Gli stessi carichi sono già nei campi: niente da applicare.
    expect(screen.queryByRole('button', { name: 'Usa' })).not.toBeInTheDocument()
  })

  it('l’alzata ricorda cosa chiedeva la scheda quel giorno', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    await user.type(screen.getByLabelText('Panca piana · serie 1 · kg'), '60')
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    expect(alzate()[0].piano).toEqual({ sets: 3, reps: '10' })
  })

  it('a corpo libero niente consiglio sui chili, e l’alzata si salva come tale', async () => {
    useJarvisStore.setState({
      gymSchede: [{ ...scheda, exercises: [{ id: 'se1', name: 'Trazioni', sets: 2, reps: '8', muscle: 'Dorso' }] }],
      // Nessun `bodyweight` sull'esercizio: lo dice il catalogo, per nome.
      palestraExercises: [{
        id: 'px1', n: 'Trazioni', muscle: 'Dorso',
        current: { kg: 0, reps: 8, sets_n: 2 },
        history: [{ d: 'W37', date: '2026-09-10', kg: 0, reps: 8, sets_n: 2, bodyweight: true, scheda: { id: 'sc1', nome: 'Spinta A' } }],
      }],
    })
    const user = userEvent.setup()
    await apriAllenamento(user)
    expect(screen.queryByText('Puoi salire')).not.toBeInTheDocument()
    expect(screen.queryByText('Carico consigliato')).not.toBeInTheDocument()
    for (const n of [1, 2]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    const h = useJarvisStore.getState().palestraExercises.find(e => e.n === 'Trazioni')?.history ?? []
    expect(h[h.length - 1]).toMatchObject({ bodyweight: true, kg: 0, sets_n: 2 })
  })

  // ── L'ordine degli esercizi ──────────────────────────────────
  // Le spinte con i manubri dopo la panca non sono le spinte fatte per prime:
  // l'alzata si ricorda con che muscolo ci si è arrivati, e il consiglio della
  // volta dopo ne tiene conto.
  const panca = { id: 'se1', name: 'Panca piana', sets: 3, reps: '10', muscle: 'Petto' }
  const spinte = { id: 'se2', name: 'Spinte con manubri', sets: 3, reps: '10', muscle: 'Petto' }

  it('l’alzata ricorda quanti esercizi dello stesso muscolo aveva davanti', async () => {
    useJarvisStore.setState({ gymSchede: [{ ...scheda, exercises: [panca, spinte] }] })
    const user = userEvent.setup()
    await apriAllenamento(user)
    for (const n of [1, 2, 3]) for (const tasto of screen.getAllByRole('button', { name: `Serie ${n}` })) await user.click(tasto)
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    expect(alzate('Panca piana')[0].giaFatti).toBe(0)
    expect(alzate('Spinte con manubri')[0].giaFatti).toBe(1)
  })

  it('un esercizio saltato non ha stancato niente', async () => {
    useJarvisStore.setState({ gymSchede: [{ ...scheda, exercises: [panca, spinte] }] })
    const user = userEvent.setup()
    await apriAllenamento(user)
    // La panca è occupata: si fanno solo le spinte.
    for (const n of [1, 2, 3]) await user.click(screen.getAllByRole('button', { name: `Serie ${n}` })[1])
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))
    expect(alzate('Panca piana')).toHaveLength(0)
    expect(alzate('Spinte con manubri')[0].giaFatti).toBe(0)
  })

  it('scambiando due esercizi di petto, uno sale e l’altro no', async () => {
    const fatta = (kg: number, giaFatti: number) =>
      ({ d: 'W37', date: giorniFa(7), kg, reps: 10, sets_n: 3, scheda: { id: 'sc1', nome: 'Spinta A' }, giaFatti })
    useJarvisStore.setState({
      // La settimana scorsa: panca, poi spinte. Oggi la scheda le ha scambiate.
      gymSchede: [{ ...scheda, exercises: [spinte, panca] }],
      palestraExercises: [
        { id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 10, sets_n: 3 }, history: [...daMesi(55), fatta(60, 0)] },
        { id: 'px2', n: 'Spinte con manubri', muscle: 'Petto', current: { kg: 20, reps: 10, sets_n: 3 }, history: [...daMesi(18), fatta(20, 1)] },
      ],
    })
    const user = userEvent.setup()
    await apriAllenamento(user)
    // Le spinte, per prime e a petto fresco: si sale, di poco.
    expect(screen.getByText(/Oggi ci arrivi più fresco: prova a salire/)).toBeInTheDocument()
    expect(screen.getByText(/22 kg/)).toBeInTheDocument()
    // La panca, per seconda: tutto fatto a 60, ma non è il giorno per salire.
    expect(screen.getByText('Muscolo già stanco')).toBeInTheDocument()
    expect(screen.getByText(/potrebbe essere più faticoso/)).toBeInTheDocument()
    expect(screen.queryByText(/62,5 kg/)).not.toBeInTheDocument()
  })

  it('uscendo a metà, l’elenco propone di riprendere da dove si era', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    await user.click(screen.getByRole('button', { name: 'Serie 1' }))
    cleanup()

    // Si rientra nelle schede da capo, come dopo essere usciti dalla sezione.
    render(<ConfirmDeleteProvider><GymSchede onBack={vi.fn()}/><ConfirmModal/></ConfirmDeleteProvider>)
    expect(screen.getByText('Allenamento in corso')).toBeInTheDocument()
    expect(screen.getByText(/1\/3 serie fatte/)).toBeInTheDocument()
    await user.click(screen.getByText(/tocca per riprendere/))
    expect(screen.getByRole('button', { name: 'Serie 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('un’alzata con colpi diversi per serie si corregge senza riscrivere i chili', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    await user.type(screen.getByLabelText('Panca piana · serie 1 · kg'), '60')
    await user.click(screen.getByRole('button', { name: /uguale/i }))
    const colpi3 = screen.getByLabelText('Panca piana · serie 3 · colpi')
    await user.clear(colpi3)
    await user.type(colpi3, '6')
    for (const n of [1, 2, 3]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    // Peso costante, colpi 10·10·6: la correzione si apre con i chili già
    // scritti su ogni serie, e una nota si salva senza toccarli.
    await user.click(screen.getAllByRole('button', { name: /Panca piana/ })[0])
    expect(screen.getByLabelText('Serie 1 · kg')).toHaveValue('60')
    expect(screen.getByLabelText('Serie 3 · kg')).toHaveValue('60')
    await user.type(screen.getByPlaceholderText('Nota su questa sessione…'), 'ok')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(alzate()[0]).toMatchObject({ kg: 60, setReps: [10, 10, 6], note: 'ok' })
    expect(alzate()[0].setWeights).toBeUndefined()
  })

  it('il timer si chiude in un’icona accanto al titolo, e si riapre da lì', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    // Aperto: il quadrante in fondo, nessuna icona in testata.
    expect(screen.getByRole('button', { name: 'Timer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apri il timer' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chiudi il timer' }))
    expect(screen.queryByRole('button', { name: 'Timer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apri il timer' })).toBeInTheDocument()

    // Uscendo e rientrando resta chiuso: è una scelta, non uno stato della pagina.
    cleanup()
    await apriAllenamento(user)
    expect(screen.queryByRole('button', { name: 'Timer' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apri il timer' }))
    expect(screen.getByRole('button', { name: 'Timer' })).toBeInTheDocument()
  })

  it('lo storico della scheda mostra gli allenamenti fatti, li corregge e li toglie', async () => {
    const user = userEvent.setup()
    await apriAllenamento(user)
    await user.type(screen.getByLabelText('Panca piana · serie 1 · kg'), '60')
    await user.click(screen.getByRole('button', { name: /uguale/i }))
    for (const n of [1, 2, 3]) await user.click(screen.getByRole('button', { name: `Serie ${n}` }))
    await user.click(screen.getByRole('button', { name: /termina allenamento/i }))
    await user.click(screen.getByRole('button', { name: /salva e chiudi/i }))

    // Di ritorno sul dettaglio: l'orologio in testata apre lo storico.
    const tasti = screen.getAllByRole('button', { name: 'Storico allenamenti' })
    await user.click(tasti[0])
    expect(screen.getByText(/Apri un giorno/)).toBeInTheDocument()

    // L'ultimo allenamento parte aperto: è quello che si viene a guardare. La
    // data fa da punto elenco e sotto c'è il segnale — qui "primo allenamento",
    // perché non c'è una volta prima con cui misurarsi.
    const giorno = screen.getByRole('button', { name: /1 esercizio/, expanded: true })
    expect(giorno).toHaveTextContent('primo allenamento')
    const riga = screen.getByRole('button', { name: /Panca piana.*3 × 10.*60 kg/ })
    expect(riga).toHaveTextContent('prima alzata')

    // Si richiude e si riapre.
    await user.click(giorno)
    expect(giorno).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /Panca piana.*60 kg/ })).not.toBeInTheDocument()
    await user.click(giorno)

    // Toccare l'alzata apre la correzione, con la nota fra i campi.
    await user.click(screen.getByRole('button', { name: /Panca piana.*60 kg/ }))
    await user.type(screen.getByPlaceholderText('Nota su questa sessione…'), 'presa larga')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(alzate()[0].note).toBe('presa larga')

    // Dietro i tre puntini la si toglie, dopo la conferma.
    await user.click(screen.getByRole('button', { name: 'Azioni sull’alzata' }))
    await user.click(screen.getByRole('menuitem', { name: 'Elimina' }))
    await user.click(screen.getByRole('button', { name: /sì, elimina/i }))
    expect(alzate()).toHaveLength(0)
  })
})
