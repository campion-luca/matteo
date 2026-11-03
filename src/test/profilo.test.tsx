import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisProfile } from '@/features/profile/JarvisProfile'
import { ProfiloPubblico } from '@/features/profile/ProfiloPubblico'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { ConfirmModal } from '@/components/ConfirmModal'
import { storageKey, supabase } from '@/lib/supabase'
import { useProfiliStore } from '@/lib/profili'
import { todayISO } from '@/lib/isoDate'

// Il Profilo dopo il rebranding (ott 2026): il nome in un riquadro con la foto,
// i dati generali in griglia, la pesata di oggi col campo e «Registra» sulla
// stessa riga, e niente «Salva» in testata — la freccia salva e chiude.

const monta = (onClose = vi.fn()) => render(
  <ConfirmDeleteProvider>
    <JarvisProfile open onClose={onClose} sezione="utente"/>
  </ConfirmDeleteProvider>,
)

describe('il profilo', () => {
  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', userWeight: 76.2, userHeight: 178, userAge: 29, userSex: 'M', userDob: '1997-08-11',
      weightLog: [{ date: '2026-10-20', kg: 76.2 }],
    }, true)
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); cleanup() })

  it('mostra i dati generali coi loro numeri, e l’età dalla data di nascita', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T10:00:00'))
    // L'età salvata è vecchia di un compleanno: conta la data di nascita.
    useJarvisStore.setState({ userAge: 28 })
    monta()
    expect(screen.getAllByText('76,2').length).toBeGreaterThan(0)    // nei dati generali e nello storico
    expect(screen.getByText('178')).toBeInTheDocument()
    expect(screen.getByText('29')).toBeInTheDocument()
    expect(screen.getByText('Uomo')).toBeInTheDocument()
    expect(screen.getByText('11/08/1997')).toBeInTheDocument()
  })

  it('«Registra» sta accanto al campo, si accende solo con un peso, e registra la pesata', async () => {
    const user = userEvent.setup()
    monta()
    const campo = screen.getByLabelText('Peso di oggi in kg')
    const registra = screen.getByRole('button', { name: 'Registra' })
    // Stessa riga: il tasto e il riquadro del campo sono fratelli.
    expect(registra.parentElement).toContainElement(campo)
    expect(registra).toBeDisabled()
    expect(screen.getByText('Con una seconda pesata qui compare la direzione.')).toBeInTheDocument()

    await user.type(campo, '75.8')
    expect(registra).toBeEnabled()
    await user.click(registra)

    const st = useJarvisStore.getState()
    expect(st.userWeight).toBe(75.8)
    expect(st.weightLog).toHaveLength(2)
    // Con due pesate il posto tratteggiato lascia il posto al grafico.
    expect(screen.queryByText('Con una seconda pesata qui compare la direzione.')).not.toBeInTheDocument()
  })

  it('in testata non c’è «Salva»: la freccia salva il nome e chiude', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    monta(onClose)
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument()
    const nome = screen.getByLabelText('Nome utente')
    await user.clear(nome)
    await user.type(nome, 'Matteo')
    await user.click(screen.getByRole('button', { name: 'Chiudi il profilo' }))
    expect(useJarvisStore.getState().userName).toBe('Matteo')
    expect(onClose).toHaveBeenCalled()
  })

  // Col tastierino di iOS che mostra la virgola, "78,5" in un `type="number"`
  // valeva '' e «Salva» scriveva il peso `undefined`: spariva dal profilo.
  it('il peso dei dati generali si scrive con la virgola, e un campo che non è un numero non lo cancella', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Modifica' }))
    const peso = screen.getByLabelText('Peso (kg)')
    await user.clear(peso)
    await user.type(peso, '78,5')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(useJarvisStore.getState().userWeight).toBe(78.5)
    expect(screen.getAllByText('78,5').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Modifica' }))
    await user.clear(screen.getByLabelText('Peso (kg)'))
    await user.type(screen.getByLabelText('Peso (kg)'), ',')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(useJarvisStore.getState().userWeight).toBe(78.5)
    expect(screen.getAllByText('78,5').length).toBeGreaterThan(0)
  })

  it('anche la pesata di oggi accetta la virgola', async () => {
    const user = userEvent.setup()
    monta()
    await user.type(screen.getByLabelText('Peso di oggi in kg'), '75,8')
    await user.click(screen.getByRole('button', { name: 'Registra' }))
    expect(useJarvisStore.getState().userWeight).toBe(75.8)
  })

  // La freccia riscriveva tutti i dati generali con quello letto all'apertura:
  // un'altezza o una data corrette intanto da un altro telefono tornavano indietro.
  it('uscendo si scrive solo quello che è cambiato, non quello arrivato intanto da un altro telefono', async () => {
    const user = userEvent.setup()
    monta()
    // La sincronizzazione porta altezza, data e sesso nuovi mentre la pagina è aperta.
    act(() => { useJarvisStore.setState({ userHeight: 180, userDob: '1997-08-12', userSex: 'F' }) })
    // Qui si cambia soltanto il nome.
    const nome = screen.getByLabelText('Nome utente')
    await user.clear(nome)
    await user.type(nome, 'Matteo')
    await user.click(screen.getByRole('button', { name: 'Chiudi il profilo' }))
    const st = useJarvisStore.getState()
    expect(st).toMatchObject({ userName: 'Matteo', userHeight: 180, userDob: '1997-08-12', userSex: 'F', userAge: 29, userWeight: 76.2 })
  })

  it('«Salva» dei dati generali scrive il campo toccato e lascia gli altri a quello che è arrivato', async () => {
    const user = userEvent.setup()
    monta()
    await user.click(screen.getByRole('button', { name: 'Modifica' }))
    act(() => { useJarvisStore.setState({ userHeight: 180 }) })
    await user.click(screen.getByRole('radio', { name: 'Donna' }))
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(useJarvisStore.getState()).toMatchObject({ userSex: 'F', userHeight: 180, userWeight: 76.2, userDob: '1997-08-11' })
    // E la griglia mostra l'altezza arrivata, non quella letta aprendo.
    expect(screen.getByText('180')).toBeInTheDocument()
  })

  // Dal profilo pubblico la freccia tornava indietro e basta: bio, percorso e
  // infortuni scritti e non salvati sparivano senza una parola.
  it('dal profilo pubblico, con qualcosa di non salvato, la freccia chiede prima di uscire', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ access_token: 'x', user: { id: 'u1' } }))
    useProfiliStore.setState({ owner: 'u1', profili: {} })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <JarvisProfile open onClose={vi.fn()} sezione="utente"/>
        <ConfirmModal/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: /Profilo pubblico/ }))
    await user.type(await screen.findByPlaceholderText('Il tuo cognome'), 'Rossi')
    await user.click(screen.getByRole('button', { name: 'Torna al profilo' }))
    expect(screen.getByText('Uscire senza salvare?')).toBeInTheDocument()
    // E restando, quello che si è scritto è ancora lì.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No' }))
    expect(screen.getByPlaceholderText('Il tuo cognome')).toHaveValue('Rossi')
    vi.restoreAllMocks()
    localStorage.removeItem(storageKey)
  })

  // «Togli» cancellava la foto dal server al primo tocco, senza ritorno.
  it('«Togli» chiede prima di cancellare la foto dal server', async () => {
    const riga = { user_id: 'u1', nome: null, cognome: null, foto_agg: '2026-10-01T10:00:00Z', nascita: null, eta: null, dettagli: {}, updated_at: '2026-10-01T10:00:00Z' }
    useProfiliStore.setState({ owner: null, profili: { u1: { ...riga, foto: 'data:image/png;base64,AAAA' } } })
    const rete = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => new Response(
      JSON.stringify(init?.method === 'POST' ? { ...riga, foto_agg: null } : [riga]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    const scritture = () => rete.mock.calls.filter(([, init]) => init?.method === 'POST').length
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <ProfiloPubblico userId="u1"/>
        <ConfirmModal/>
      </ConfirmDeleteProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Togli' }))
    expect(screen.getByText('Togliere la foto?')).toBeInTheDocument()
    expect(scritture()).toBe(0)
    // «No»: la foto resta, e al server non è partito niente.
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No' }))
    expect(scritture()).toBe(0)
    expect(screen.getByRole('button', { name: 'Togli' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Togli' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Togli' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Togli' })).toBeNull())
    expect(scritture()).toBe(1)
    expect(useProfiliStore.getState().profili.u1?.foto).toBeNull()
  })

  // L'errore di Supabase arrivava a schermo così com'era, in inglese.
  it('un errore cambiando la password arriva tradotto, mai col testo grezzo del server', async () => {
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({ data: { user: { email: 'luca@esempio.it' } }, error: null } as never)
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: {}, error: null } as never)
    const aggiorna = vi.spyOn(supabase.auth, 'updateUser')
      .mockResolvedValue({ data: { user: null }, error: { message: 'New password should be different from the old password.' } } as never)
    const user = userEvent.setup()
    render(
      <ConfirmDeleteProvider>
        <JarvisProfile open onClose={vi.fn()} sezione="impostazioni"/>
      </ConfirmDeleteProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Cambia password' }))
    await user.type(screen.getByPlaceholderText('Password attuale'), 'vecchia1')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'vecchia1')
    await user.click(screen.getByRole('button', { name: 'Aggiorna password' }))
    expect(await screen.findByText('La nuova password deve essere diversa da quella attuale.')).toBeInTheDocument()

    // Un caso che non si conosce: una frase generica, non l'inglese del server.
    aggiorna.mockResolvedValue({ data: { user: null }, error: { message: 'Unexpected failure, please check server logs for more information' } } as never)
    await user.click(screen.getByRole('button', { name: 'Aggiorna password' }))
    expect(await screen.findByText('Non è stato possibile aggiornare la password. Riprova.')).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected failure/)).toBeNull()
  })
})

// Lo storico delle pesate: ognuna si corregge e si toglie, anche le vecchie, e
// il peso dei dati generali ci finisce dentro come pesata di oggi. Il peso del
// profilo segue sempre l'ultima.
describe('lo storico delle pesate', () => {
  beforeEach(() => {
    useJarvisStore.setState({
      ...EMPTY_STATE, userName: 'Luca', userWeight: 77, userSex: 'M',
      weightLog: [{ date: '2026-10-20', kg: 76.2 }, { date: '2026-10-27', kg: 77 }],
    }, true)
  })
  afterEach(cleanup)

  const apri = () => render(
    <ConfirmDeleteProvider>
      <JarvisProfile open onClose={vi.fn()} sezione="utente"/>
      <ConfirmModal/>
    </ConfirmDeleteProvider>,
  )

  it('il peso dei dati generali diventa la pesata di oggi', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(screen.getByRole('button', { name: 'Modifica' }))
    await user.clear(screen.getByLabelText('Peso (kg)'))
    await user.type(screen.getByLabelText('Peso (kg)'), '78,5')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    const st = useJarvisStore.getState()
    expect(st.weightLog[st.weightLog.length - 1]).toEqual({ date: todayISO(), kg: 78.5 })
    expect(st.weightLog).toHaveLength(3)
    expect(st.userWeight).toBe(78.5)
  })

  it('un peso fuori misura non si scrive: né nel profilo né nello storico', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(screen.getByRole('button', { name: 'Modifica' }))
    await user.clear(screen.getByLabelText('Peso (kg)'))
    await user.type(screen.getByLabelText('Peso (kg)'), '7,8')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    expect(useJarvisStore.getState().userWeight).toBe(77)
    expect(useJarvisStore.getState().weightLog).toHaveLength(2)
  })

  it('una pesata vecchia si corregge, e il peso del profilo resta l’ultima', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(screen.getByRole('button', { name: /Correggi la pesata del 20/ }))
    const campo = screen.getByLabelText(/Peso del 20/)
    await user.clear(campo)
    await user.type(campo, '75,4')
    await user.click(screen.getByRole('button', { name: 'Salva' }))
    const st = useJarvisStore.getState()
    expect(st.weightLog).toEqual([{ date: '2026-10-20', kg: 75.4 }, { date: '2026-10-27', kg: 77 }])
    expect(st.userWeight).toBe(77)
  })

  it('togliere l’ultima riporta il peso del profilo a quella prima, dopo averlo chiesto', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(screen.getByRole('button', { name: /Togli la pesata del 27/ }))
    expect(useJarvisStore.getState().weightLog).toHaveLength(2)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Togli' }))
    const st = useJarvisStore.getState()
    expect(st.weightLog).toEqual([{ date: '2026-10-20', kg: 76.2 }])
    expect(st.userWeight).toBe(76.2)
  })
})
