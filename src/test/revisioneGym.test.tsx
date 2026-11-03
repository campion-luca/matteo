import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogPalestraModal, EditHistoryModal, EditExModal, AddExModal } from '@/features/gym/gymModals'
import { JarvisGym } from '@/features/gym/JarvisGym'
import { SchieraGruppi } from '@/features/gym/SchieraGruppi'
import { JFoglio } from '@/components/ui/Primitives'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'
import { ConfirmDeleteProvider, useConfirmDelete } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'
import { supabase } from '@/lib/supabase'
import { noteRicevute } from '@/lib/coach'

// La revisione di novembre sulla palestra: undici cose che si rompevano senza
// dare errore. I colpi «per serie» presi da un campo che non si vede, l'attrezzo
// riscritto sulle alzate che ne avevano già uno, la correzione finita sull'alzata
// accanto dopo una rilettura dal cloud, l'Esc che chiudeva la conferma e il
// foglio sotto insieme.

vi.mock('@/lib/coach', async orig => ({
  ...(await orig() as object),
  noteRicevute: vi.fn(async () => []),
  aggiornaSchedeRicevute: vi.fn(async () => {}),
}))

const alzata = (o: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W37', date: '2026-09-10', kg: 60, reps: 8, sets_n: 3, ...o })
const esercizio = (o: Partial<PalestraExercise> = {}): PalestraExercise =>
  ({ id: 'px1', n: 'Panca piana', muscle: 'Petto', current: { kg: 60, reps: 8, sets_n: 3 }, history: [alzata()], ...o })

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE, userName: 'Luca' }, true)
  localStorage.clear()
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

const riscrivi = async (user: ReturnType<typeof userEvent.setup>, etichetta: string, valore: string) => {
  const campo = screen.getByLabelText(etichetta)
  await user.clear(campo)
  if (valore) await user.type(campo, valore)
}

// ── 1 e 2: serie per serie contano le righe ────────────────────
describe('nuova alzata, serie per serie', () => {
  it('i colpi vengono dalle righe anche quando sono tutte uguali', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio()} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Per serie' }))
    for (const n of [1, 2, 3]) await riscrivi(user, `Serie ${n} · colpi`, '10')
    // Anche l'anteprima: 60 × 10, non 60 × 8 del campo nascosto.
    expect(screen.getByText('da 60 kg × 10 rip')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()   // 60 × (1 + 10/30)

    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 10, sets_n: 3 }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('setReps')
  })

  it('con una riga sola i colpi sono i suoi', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio()} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Per serie' }))
    await user.click(screen.getByRole('button', { name: 'Togli la serie 3' }))
    await user.click(screen.getByRole('button', { name: 'Togli la serie 2' }))
    await riscrivi(user, 'Serie 1 · colpi', '12')
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 12, sets_n: 1 }))
  })

  it('l’anteprima stima la serie migliore coi suoi colpi', async () => {
    const user = userEvent.setup()
    render(<LogPalestraModal open onClose={vi.fn()} ex={esercizio()} onSave={vi.fn()}/>)
    await user.click(await screen.findByRole('button', { name: 'Per serie' }))
    // 70 × 1 vale 72; 60 × 10 ne vale 80.
    await riscrivi(user, 'Serie 1 · kg', '70')
    await riscrivi(user, 'Serie 1 · colpi', '1')
    await riscrivi(user, 'Serie 2 · colpi', '10')
    expect(screen.getByText('da 60 kg × 10 rip')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('col pre-compilato a zero guarda le righe, non i campi nascosti', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const nuovo = esercizio({ current: { kg: 0, reps: 0, sets_n: 0 }, history: [] })
    render(<LogPalestraModal open onClose={vi.fn()} ex={nuovo} onSave={onSave}/>)
    await user.click(await screen.findByRole('button', { name: 'Per serie' }))
    await riscrivi(user, 'Serie 1 · kg', '40')

    // Manca il colpo della riga: lo dice, e lo segna sulla riga.
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Scrivi quanti colpi hai fatto.')
    expect(screen.getByLabelText('Serie 1 · colpi')).toHaveAttribute('aria-invalid', 'true')

    await riscrivi(user, 'Serie 1 · colpi', '8')
    await user.click(screen.getByRole('button', { name: 'Salva alzata' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 40, reps: 8, sets_n: 1 }))
  })

  it('passando a «Per serie» con «Serie» vuoto, il campo prende le righe', async () => {
    const user = userEvent.setup()
    const nuovo = esercizio({ current: { kg: 0, reps: 0, sets_n: 0 }, history: [] })
    render(<LogPalestraModal open onClose={vi.fn()} ex={nuovo} onSave={vi.fn()}/>)
    await user.click(await screen.findByRole('button', { name: 'Per serie' }))
    await user.click(screen.getByRole('button', { name: 'Stesso kg' }))
    expect(screen.getByLabelText('Serie')).toHaveValue('1')
  })
})

describe('modifica di un’alzata, serie per serie', () => {
  it('10, 8, 6 corretti in 8, 8, 8 si salvano a 8 colpi', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata({ reps: 10, setReps: [10, 8, 6] })} onClose={vi.fn()} onSave={onSave}/>)
    await screen.findByLabelText('Serie 1 · colpi')
    for (const n of [1, 2, 3]) await riscrivi(user, `Serie ${n} · colpi`, '8')
    expect(screen.getByText('da 60 kg × 8 rip')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 8, sets_n: 3, setReps: undefined }))
  })

  it('con i soli pesi variabili le righe hanno già i colpi, e si salva senza riscriverli', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditHistoryModal entry={alzata({ setWeights: [60, 60, 55] })} onClose={vi.fn()} onSave={onSave}/>)
    expect(await screen.findByLabelText('Serie 3 · colpi')).toHaveValue('8')
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 8, sets_n: 3, setWeights: [60, 60, 55], setReps: undefined }))
  })
})

// ── 11: il pre-compilato coi decimali ──────────────────────────
describe('il pre-compilato dei chili', () => {
  it('cambiando attrezzo non mostra il rumore dei decimali', async () => {
    const ex = esercizio({ attrezzoKg: 15, history: [alzata({ kg: 22.3, attrezzo: 20 })] })
    render(<LogPalestraModal open onClose={vi.fn()} ex={ex} onSave={vi.fn()}/>)
    expect(await screen.findByLabelText('Kg')).toHaveValue('27.3')
  })
})

// ── 3: l'attrezzo sulle alzate di prima ────────────────────────
describe('l’attrezzo anche sulle alzate già registrate', () => {
  it('la casella conta solo quelle senza attrezzo, e non c’è togliendolo', async () => {
    const user = userEvent.setup()
    const ex = esercizio({
      attrezzoKg: 20,
      history: [alzata({ attrezzo: 20 }), alzata({ date: '2026-09-17' }), alzata({ date: '2026-09-24' })],
    })
    render(<EditExModal open onClose={vi.fn()} ex={ex} onSave={vi.fn()} onSaveMuscleColor={vi.fn()}/>)
    await riscrivi(user, 'Peso dell’attrezzo a vuoto', '15')
    expect(screen.getByRole('checkbox', { name: /anche per le 2 alzate già registrate/i })).toBeInTheDocument()
    await riscrivi(user, 'Peso dell’attrezzo a vuoto', '')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('spuntata, non tocca le alzate che un attrezzo loro ce l’hanno già', async () => {
    const user = userEvent.setup()
    useJarvisStore.setState({
      palestraExercises: [esercizio({
        attrezzoKg: 20,
        history: [alzata({ date: '2026-10-05' }), alzata({ date: '2026-10-12', attrezzo: 20 })],
      })],
    })
    await apriEsercizio(user)
    await user.click(screen.getByRole('button', { name: 'Azioni sull’esercizio' }))
    await user.click(screen.getByRole('menuitem', { name: 'Modifica esercizio' }))
    await riscrivi(user, 'Peso dell’attrezzo a vuoto', '15')
    await user.click(screen.getByRole('checkbox', { name: /anche per l’alzata già registrata/i }))
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    const ex = useJarvisStore.getState().palestraExercises[0]
    expect(ex.attrezzoKg).toBe(15)
    expect(ex.history.map(h => h.attrezzo)).toEqual([15, 20])
  })
})

// ── Dentro la pagina dell'esercizio ────────────────────────────
async function apriEsercizio(user: ReturnType<typeof userEvent.setup>) {
  render(
    <ConfirmDeleteProvider>
      <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      <ConfirmModal/>
    </ConfirmDeleteProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Esercizi' }))
  await user.click(await screen.findByRole('button', { name: /Petto/ }))
  await user.click(await screen.findByRole('button', { name: /Panca piana/ }))
  await screen.findByRole('button', { name: /nuova alzata/i })
}

// ── 4: svuotare lo storico svuota anche le progressioni ────────
describe('svuota lo storico', () => {
  it('toglie anche lo stato delle progressioni delle schede', async () => {
    const user = userEvent.setup()
    useJarvisStore.setState({
      palestraExercises: [esercizio({
        history: [alzata({ date: '2026-10-05' })],
        progressioni: { 'sc1:se1': { il: '2026-10-05', evento: 'increase', messaggio: '', modello: 'topSet', stato: { topWeight: 80, missCount: 0 } } },
      })],
    })
    await apriEsercizio(user)
    await user.click(screen.getByRole('button', { name: 'Azioni sull’esercizio' }))
    await user.click(screen.getByRole('menuitem', { name: 'Svuota lo storico' }))
    await user.click(screen.getByRole('button', { name: 'Sì, azzera' }))

    const ex = useJarvisStore.getState().palestraExercises[0]
    expect(ex.history).toEqual([])
    expect(ex.progressioni).toBeUndefined()
  })
})

// ── 5: l'alzata si ritrova per quello che è ────────────────────
describe('correggere o cancellare un’alzata dopo una rilettura dal cloud', () => {
  const tre = [
    alzata({ date: '2026-10-05', d: 'W41', kg: 60 }),
    alzata({ date: '2026-10-12', d: 'W42', kg: 62.5 }),
    alzata({ date: '2026-10-19', d: 'W43', kg: 65 }),
  ]
  // La rilettura: oggetti nuovi (passati dal JSON), e un'alzata arrivata da un
  // altro telefono che sposta le posizioni — o quella aperta che non c'è più.
  const rileggi = (cambia: (h: PalestraHistoryEntry[]) => PalestraHistoryEntry[]) => act(() => {
    const ex = useJarvisStore.getState().palestraExercises[0]
    const copia = JSON.parse(JSON.stringify(ex)) as PalestraExercise
    useJarvisStore.setState({ palestraExercises: [{ ...copia, history: cambia(copia.history) }] })
  })
  const arrivata = alzata({ date: '2026-10-08', d: 'W41', kg: 61 })
  const storico = () => useJarvisStore.getState().palestraExercises[0].history.map(h => [h.date, h.kg])

  beforeEach(() => {
    useJarvisStore.setState({ palestraExercises: [esercizio({ history: tre })] })
  })

  // Lo storico si legge dalla più recente: la seconda riga è quella del 12.
  const azioniSul12 = () => screen.getAllByRole('button', { name: 'Azioni sull’alzata' })[1]

  it('la correzione va sull’alzata aperta, non su quella che ne ha preso il posto', async () => {
    const user = userEvent.setup()
    await apriEsercizio(user)
    await user.click(azioniSul12())
    await user.click(screen.getByRole('menuitem', { name: 'Modifica' }))
    expect(await screen.findByLabelText('Kg')).toHaveValue('62.5')

    rileggi(h => [h[0], arrivata, ...h.slice(1)])
    await riscrivi(user, 'Kg', '63')
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    expect(storico()).toEqual([['2026-10-05', 60], ['2026-10-08', 61], ['2026-10-12', 63], ['2026-10-19', 65]])
  })

  it('la cancellazione confermata dopo la rilettura toglie quella giusta, e tiene l’arrivata', async () => {
    const user = userEvent.setup()
    await apriEsercizio(user)
    await user.click(azioniSul12())
    await user.click(screen.getByRole('menuitem', { name: 'Elimina' }))

    rileggi(h => [h[0], arrivata, ...h.slice(1)])
    await user.click(screen.getByRole('button', { name: /sì, elimina/i }))

    expect(storico()).toEqual([['2026-10-05', 60], ['2026-10-08', 61], ['2026-10-19', 65]])
  })

  it('se nel frattempo l’alzata non c’è più, non si scrive niente', async () => {
    const user = userEvent.setup()
    await apriEsercizio(user)
    await user.click(azioniSul12())
    await user.click(screen.getByRole('menuitem', { name: 'Modifica' }))
    await screen.findByLabelText('Kg')

    rileggi(h => h.filter(x => x.date !== '2026-10-12'))
    await riscrivi(user, 'Kg', '63')
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }))

    expect(storico()).toEqual([['2026-10-05', 60], ['2026-10-19', 65]])
  })
})

// ── 6: una conferma sopra un foglio ────────────────────────────
describe('una conferma aperta sopra un foglio', () => {
  function FoglioConConferma({ onClose }: { onClose: () => void }) {
    const { confirmDelete } = useConfirmDelete()
    return (
      <JFoglio open onClose={onClose} titolo="Modifica alzata">
        <input aria-label="Nota"/>
        <button onClick={() => confirmDelete(() => {}, 'Alzata')}>Togli</button>
      </JFoglio>
    )
  }
  const unFrame = () => new Promise(r => setTimeout(r, 60))

  async function apri() {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ConfirmDeleteProvider><FoglioConConferma onClose={onClose}/><ConfirmModal/></ConfirmDeleteProvider>)
    await user.click(await screen.findByRole('button', { name: 'Togli' }))
    const conferma = screen.getByText('Sicuro di voler eliminare?').closest('[role="dialog"]') as HTMLElement
    await unFrame()
    return { user, onClose, conferma }
  }

  it('Esc chiude la conferma e lascia il foglio aperto', async () => {
    const { user, onClose } = await apri()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Sicuro di voler eliminare?')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    // Il secondo Esc è del foglio.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('il Tab gira dentro la conferma, non lo tira il foglio', async () => {
    // jsdom non impagina: `offsetParent` è sempre null, e il giro del Tab
    // scarterebbe tutto come nascosto. Qui ogni elemento è visibile.
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
    const { user, conferma } = await apri()
    const no = within(conferma).getByRole('button', { name: 'No' })
    const si = within(conferma).getByRole('button', { name: /sì, elimina/i })
    expect(no).toHaveFocus()
    await user.tab()
    expect(si).toHaveFocus()
    await user.tab()
    expect(no).toHaveFocus()
  })
})

// ── 7: le note dell'allenatore si rileggono tornando in primo piano ──
describe('le note dell’allenatore', () => {
  it('si rileggono quando l’app torna davanti', async () => {
    vi.mocked(noteRicevute).mockClear()
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { user: { id: 'u-io' } } }, error: null } as never)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    await waitFor(() => expect(noteRicevute).toHaveBeenCalledTimes(1))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(noteRicevute).toHaveBeenCalledTimes(2))
    expect(noteRicevute).toHaveBeenLastCalledWith('u-io')
    delete (document as { visibilityState?: unknown }).visibilityState
  })
})

// ── 8: un gruppo usato da secondario non si elimina ────────────
describe('eliminare un gruppo creato', () => {
  const apriGruppo = async (palestraExercises: PalestraExercise[]) => {
    const user = userEvent.setup()
    useJarvisStore.setState({ customMuscles: [{ name: 'Avambracci', icon: 'braccia' }], palestraExercises })
    render(
      <ConfirmDeleteProvider>
        <JarvisGym onOpenCoach={vi.fn()} onOpenProfile={vi.fn()} onOpenUser={vi.fn()}/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Esercizi' }))
    await user.click(await screen.findByRole('button', { name: /Avambracci/ }))
    await screen.findByRole('button', { name: 'Indietro' })
  }

  it('vuoto si può togliere', async () => {
    await apriGruppo([esercizio()])
    expect(screen.getByRole('button', { name: 'Elimina gruppo' })).toBeInTheDocument()
  })

  it('se un esercizio lo usa come secondario resta', async () => {
    await apriGruppo([esercizio({ muscle: 'Dorso', muscle2: 'Avambracci' })])
    expect(screen.queryByRole('button', { name: 'Elimina gruppo' })).toBeNull()
  })
})

// ── 9: «Nuovo esercizio» riparte pulito ────────────────────────
describe('nuovo esercizio', () => {
  it('ogni apertura parte vuota, non dalla bozza lasciata a metà', async () => {
    const user = userEvent.setup()
    const props = { onClose: vi.fn(), mode: 'palestra' as const, onAdd: vi.fn(), presetMuscle: 'Dorso' }
    const { rerender } = render(<AddExModal open {...props}/>)
    await user.type(await screen.findByLabelText('Nome esercizio'), 'Pulley')
    rerender(<AddExModal open={false} {...props}/>)
    rerender(<AddExModal open {...props}/>)
    expect(await screen.findByLabelText('Nome esercizio')).toHaveValue('')
  })

  it('il nome si salva senza gli spazi ai lati', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<AddExModal open onClose={vi.fn()} mode="palestra" onAdd={onAdd} presetMuscle="Dorso"/>)
    await user.type(await screen.findByLabelText('Nome esercizio'), '  Pulley  ')
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ n: 'Pulley' }))
  })
})

// ── 10: «oggi» e «ieri» cambiano a mezzanotte ──────────────────
describe('l’ultima volta di un gruppo', () => {
  it('a mezzanotte «oggi» diventa «ieri»', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 0))
    render(
      <SchieraGruppi
        gruppi={[{ muscle: 'Petto', items: [esercizio({ history: [alzata({ date: '2026-11-02' })] })] }]}
        colori={{}} icone={{}} onApri={vi.fn()} onNuovo={vi.fn()} colonne={2}
      />,
    )
    expect(screen.getByText('Ultima volta: oggi')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000) })
    expect(screen.getByText('Ultima volta: ieri')).toBeInTheDocument()
  })
})
