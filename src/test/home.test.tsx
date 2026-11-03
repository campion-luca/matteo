import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { schedaDiOggi, serieDellaScheda } from '@/features/gym/anteprimaScheda'
import { useJarvisStore, EMPTY_STATE, type GymScheda, type PalestraExercise } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { localISO } from '@/lib/isoDate'

// La home dopo il rebranding (ott 2026): tre card — Coaching, Esercizi,
// Statistiche — e sotto la scheda di oggi, col tasto per cominciare. I gruppi
// muscolari, che stavano lì, si aprono dalla card "Esercizi".

const OGGI = '2026-10-23'
const scheda = (id: string, title: string, o: Partial<GymScheda> = {}): GymScheda => ({
  id, title, createdAt: '2026-09-01', updatedAt: '2026-09-01',
  exercises: [{ id: `${id}-1`, name: 'Panca piana', sets: 4, reps: '8', muscle: 'Petto' }, { id: `${id}-2`, name: 'Croci', sets: 3, reps: '12', muscle: 'Petto' }],
  ...o,
})
/** Un esercizio con un'alzata fatta il giorno `data` dentro la scheda `id`. */
const fatta = (id: string, data: string): PalestraExercise => ({
  id: `px-${id}-${data}`, n: `Es ${id}`, muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 },
  history: [{ d: 'W', date: data, kg: 60, reps: 8, sets_n: 3, scheda: { id, nome: id } }],
})

describe('la scheda di oggi col numero del coach', () => {
  const A = scheda('a', 'A', { ordine: 1 }), B = scheda('b', 'B', { ordine: 2 }), C = scheda('c', 'C', { ordine: 3 })
  const mia = scheda('mia', 'La mia')

  it('tocca quella dopo l’ultima fatta', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-20'), fatta('b', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('c')
    expect(r?.giorniFa).toBeNull()
  })

  it('dopo l’ultima si riparte dalla prima', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-18'), fatta('b', '2026-10-20'), fatta('c', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('a')
    expect(r?.giorniFa).toBe(5)
  })

  it('mai fatte: si parte dalla 1, ovunque stia nell’elenco', () => {
    expect(schedaDiOggi([C, A, B], [], OGGI)?.scheda.id).toBe('a')
  })

  it('una saltata non si recupera: conta il numero, non da quanto non si fa', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-20'), fatta('b', '2026-10-01'), fatta('c', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('a')
  })

  it('due fatte lo stesso giorno: si riparte dalla più avanti', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-22'), fatta('b', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('c')
  })

  it('le schede senza numero non vengono proposte, nemmeno se mai fatte', () => {
    const r = schedaDiOggi([A, B, mia], [fatta('a', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('b')
  })

  it('una scheda senza numero fatta oggi resta la scheda di oggi', () => {
    const r = schedaDiOggi([A, B, mia], [fatta('mia', OGGI)], OGGI)
    expect(r).toMatchObject({ scheda: { id: 'mia' }, fattaOggi: true })
  })

  it('un buco nei numeri non ferma il giro', () => {
    // La 2 è stata cancellata: restano la 1 e la 3.
    const r = schedaDiOggi([A, C], [fatta('a', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('c')
  })

  it('una bozza col numero non conta', () => {
    const r = schedaDiOggi([A, scheda('b', 'B', { ordine: 2, draft: true }), C], [fatta('a', '2026-10-22')], OGGI)
    expect(r?.scheda.id).toBe('c')
  })
})

describe('la scheda di oggi', () => {
  const A = scheda('a', 'A'), B = scheda('b', 'B'), C = scheda('c', 'C')

  it('è la prossima del giro: quella che non si fa da più tempo', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-21'), fatta('b', '2026-10-15'), fatta('c', '2026-10-19')], OGGI)
    expect(r?.scheda.id).toBe('b')
    expect(r?.giorniFa).toBe(8)
    expect(r?.fattaOggi).toBe(false)
  })

  it('una mai fatta viene prima, nell’ordine dell’elenco', () => {
    const r = schedaDiOggi([A, B, C], [fatta('a', '2026-10-01')], OGGI)
    expect(r?.scheda.id).toBe('b')
    expect(r?.giorniFa).toBeNull()
  })

  it('fatta oggi resta lei, segnata come fatta', () => {
    const r = schedaDiOggi([A, B], [fatta('a', OGGI), fatta('b', '2026-10-01')], OGGI)
    expect(r).toMatchObject({ scheda: { id: 'a' }, fattaOggi: true })
  })

  it('le bozze e le schede vuote non contano', () => {
    const bozza = scheda('d', 'Bozza', { draft: true })
    const vuota = scheda('e', 'Vuota', { exercises: [{ id: 'x', name: '  ', sets: 3, reps: '8' }] })
    expect(schedaDiOggi([bozza, vuota], [], OGGI)).toBeNull()
  })

  it('le serie sono la somma delle righe', () => {
    expect(serieDellaScheda(A)).toBe(7)
  })
})

describe('la home', () => {
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

  it('ha Coaching, Esercizi e Statistiche, e i gruppi muscolari non stanno più qui', () => {
    monta()
    for (const nome of ['Coaching', 'Esercizi', 'Statistiche']) expect(screen.getByRole('button', { name: nome })).toBeInTheDocument()
    expect(screen.queryByText(/Gruppi muscolari/)).not.toBeInTheDocument()
  })

  it('una cornice sola da «Schede» a «Tutte», e tutta porta all’elenco', async () => {
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Spinta')] })
    const user = userEvent.setup()
    monta()
    const cornice = screen.getByRole('button', { name: 'Tutte le schede' })
    expect(cornice).toHaveTextContent('Schede')
    expect(cornice).toHaveTextContent('Tutte')
    await user.click(cornice)
    expect(await screen.findByText(/Schede/, { selector: '.j-page-title' })).toBeInTheDocument()
  })

  it('toccare la scheda di oggi la apre in anteprima, senza far partire l’allenamento', async () => {
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Spinta')] })
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Apri la scheda Spinta' }))
    expect(await screen.findByText('Panca piana')).toBeInTheDocument()
    expect(screen.queryByLabelText('Panca piana · serie 1 · kg')).not.toBeInTheDocument()
  })

  it('sulla card c’è il traguardo più vicino della scheda', () => {
    useJarvisStore.setState({
      userWeight: 80, userSex: 'M',
      gymSchede: [scheda('a', 'Spinta')],
      palestraExercises: [{
        id: 'p', n: 'Panca piana', muscle: 'Petto', current: { kg: 100, reps: 1, sets_n: 1 },
        history: [{ d: 'W', date: '2026-10-01', kg: 100, reps: 1, sets_n: 1, maxLift: true }],
      }],
    })
    monta()
    expect(screen.getByText('Mancano 8 kg per Platino · Panca piana')).toBeInTheDocument()
  })

  it('«Esercizi» apre i gruppi muscolari, e la freccia riporta alla home', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    expect(screen.getByText('Esercizi', { selector: '.j-page-title' })).toBeInTheDocument()
    expect(screen.getByText(/Gruppi muscolari/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Indietro' }))
    expect(screen.getByRole('button', { name: 'Esercizi' })).toBeInTheDocument()
  })

  it('senza schede invita a scriverne una', () => {
    monta()
    expect(screen.getByText(/Nessuna scheda/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crea una scheda' })).toBeInTheDocument()
  })

  it('mostra la scheda di oggi, coi suoi numeri, e «Inizia allenamento» entra nell’allenamento', async () => {
    const user = userEvent.setup()
    const ieri = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d) })()
    useJarvisStore.setState({
      gymSchede: [scheda('a', 'Lunedì'), scheda('b', 'Giovedì')],
      palestraExercises: [fatta('a', ieri)],
    })
    monta()
    // Giovedì non è mai stata fatta: tocca a lei.
    expect(screen.getByText('Oggi · Giovedì')).toBeInTheDocument()
    expect(screen.getByText('mai fatta', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Petto')).toBeInTheDocument()
    // Il numero della card, non uno qualsiasi: la striscia della settimana in
    // cima mostra i giorni del mese, e nelle settimane col 7 il test cadeva.
    expect(screen.getByText('7', { selector: '.j-oggi-numero' })).toBeInTheDocument()
    // Senza un allenamento aperto non c'è niente da chiudere.
    expect(screen.queryByRole('button', { name: 'Chiudi allenamento' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Inizia allenamento/ }))
    // Dritti nell'allenamento della scheda, non nel suo dettaglio.
    expect(await screen.findByRole('button', { name: /termina allenamento/i })).toBeInTheDocument()
  })

  // La barra "Allenamento in corso" e il tasto "Riprendi" della card dicevano la
  // stessa cosa, e insieme su un telefono basso spingevano il tasto sotto il bordo.
  const apertaSu = (schedaId: string, rigaId: string, da = Date.now()) => localStorage.setItem('jarvis-sessione-in-corso-v1', JSON.stringify({
    schedaId, salvataA: da, iniziataA: da,
    progress: { [rigaId]: { checks: [true, true, false, false], weights: ['60', '60', '', ''], reps: ['8', '8', '', ''] } },
  }))

  it('con l’allenamento della scheda di oggi aperto lo dice la card, senza la barra in cima', () => {
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì')] })
    apertaSu('a', 'a-1')
    monta()
    expect(screen.getByText('In corso · Lunedì')).toBeInTheDocument()
    expect(screen.getByText('2/7 serie fatte', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Riprendi allenamento/ })).toBeInTheDocument()
    expect(screen.queryByText('Allenamento in corso')).not.toBeInTheDocument()
  })

  it('rimasto aperto da un altro giorno, la barra resta: è lei a dirlo', () => {
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì')] })
    apertaSu('a', 'a-1', Date.now() - 14 * 60 * 60 * 1000)
    monta()
    expect(screen.getByText(/Allenamento non chiuso/)).toBeInTheDocument()
    expect(screen.getByText('Oggi · Lunedì')).toBeInTheDocument()
  })

  // Il giro proponeva Giovedì, ma ci si sta allenando con Lunedì: la scheda di
  // oggi è quella cominciata.
  it('cominciato su un’altra scheda, la card diventa quella', () => {
    const ieri = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d) })()
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì'), scheda('b', 'Giovedì')], palestraExercises: [fatta('a', ieri)] })
    apertaSu('a', 'a-1')
    monta()
    expect(screen.getByText('In corso · Lunedì')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Riprendi allenamento/ })).toBeInTheDocument()
    expect(screen.queryByText('Allenamento in corso')).not.toBeInTheDocument()
  })

  // «Inizia», indietro, e il tasto diceva solo «Riprendi»: per chiudere
  // bisognava rientrare e passare da «Termina». Adesso accanto a «Tutte» c'è
  // «Chiudi allenamento».
  it('aperto e mai toccato, «Chiudi allenamento» lo chiude e basta', async () => {
    const user = userEvent.setup()
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì')] })
    localStorage.setItem('jarvis-sessione-in-corso-v1', JSON.stringify({
      schedaId: 'a', salvataA: Date.now(),
      progress: { 'a-1': { checks: [false, false, false, false], weights: ['', '', '', ''], reps: ['8', '8', '8', '8'] } },
    }))
    monta()
    expect(screen.getByRole('button', { name: /Riprendi allenamento/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chiudi allenamento' }))
    // Niente da salvare, niente da chiedere: è chiuso.
    expect(screen.queryByRole('button', { name: 'Chiudi allenamento' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Inizia allenamento/ })).toBeInTheDocument()
    expect(localStorage.getItem('jarvis-sessione-in-corso-v1')).toBeNull()
  })

  it('con delle serie fatte, «Chiudi allenamento» apre il riepilogo: chiuso senza salvare si torna in home', async () => {
    const user = userEvent.setup()
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì')] })
    apertaSu('a', 'a-1')
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
        <ConfirmModal/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Chiudi allenamento' }))
    // Il riepilogo di «Termina», già aperto: si sceglie lì se salvare.
    expect(await screen.findByRole('button', { name: /salva e chiudi/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /chiudi senza salvare/i }))
    await user.click(screen.getByRole('button', { name: 'Scarta' }))
    expect(await screen.findByRole('button', { name: /Inizia allenamento/ })).toBeInTheDocument()
    expect(localStorage.getItem('jarvis-sessione-in-corso-v1')).toBeNull()
    expect(useJarvisStore.getState().palestraExercises).toEqual([])
  })

  it('con delle serie fatte, «Salva e chiudi» dal riepilogo le mette nello storico', async () => {
    const user = userEvent.setup()
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì')] })
    apertaSu('a', 'a-1')
    monta()
    await user.click(screen.getByRole('button', { name: 'Chiudi allenamento' }))
    await user.click(await screen.findByRole('button', { name: /salva e chiudi/i }))
    const panca = useJarvisStore.getState().palestraExercises.find(e => e.n === 'Panca piana')
    expect(panca?.history).toHaveLength(1)
    expect(panca?.history[0]).toMatchObject({ kg: 60, sets_n: 2 })
    expect(localStorage.getItem('jarvis-sessione-in-corso-v1')).toBeNull()
  })

  it('solo aperto su un’altra scheda, senza serie spuntate: la card resta quella del giro, e la barra c’è', () => {
    const ieri = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return localISO(d) })()
    useJarvisStore.setState({ gymSchede: [scheda('a', 'Lunedì'), scheda('b', 'Giovedì')], palestraExercises: [fatta('a', ieri)] })
    localStorage.setItem('jarvis-sessione-in-corso-v1', JSON.stringify({
      schedaId: 'a', salvataA: Date.now(), avviataA: Date.now(),
      progress: { 'a-1': { checks: [false, false, false, false], weights: ['', '', '', ''], reps: ['8', '8', '8', '8'] } },
    }))
    monta()
    expect(screen.getByText('Oggi · Giovedì')).toBeInTheDocument()
    expect(screen.getByText('Allenamento in corso')).toBeInTheDocument()
  })
})
