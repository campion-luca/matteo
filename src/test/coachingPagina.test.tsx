import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisCoach } from '@/features/coach/JarvisCoach'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { useProfiliStore } from '@/lib/profili'
import { useRuolo } from '@/lib/ruolo'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// La pagina del Coaching: due card (chi mi segue, chi seguo), e in alto a destra
// la chat e la chiave dei codici. I codici non stanno più nelle due sezioni, e
// chi seguo si vede con la faccia, il nome e cognome, e il suo profilo a un tocco.

const IO = 'u-io', ANNA = 'u-anna'

const apri = (props: Partial<Parameters<typeof JarvisCoach>[0]> = {}) => render(
  <ConfirmDeleteProvider><JarvisCoach userId={IO} onBack={() => {}} {...props}/></ConfirmDeleteProvider>,
)

// `coach`: la risposta del server alla domanda «sono coach?».
function server({ coach = true, coachApp = [] as unknown[] } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const u = decodeURIComponent(String(url))
    let corpo: unknown = []
    if (u.includes('/coach_abilitati')) {
      corpo = coach ? [{ user_id: IO }] : []
    } else if (u.includes('/rpc/elenco_coach')) {
      corpo = coachApp
    } else if (u.includes('/coach_links') && u.includes(`coach_id=eq.${IO}`)) {
      if (!coach) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
      corpo = [{ coach_id: IO, athlete_id: ANNA, athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01T10:00:00Z' }]
    } else if (u.includes('/profili')) {
      corpo = u.includes(ANNA)
        ? [{ user_id: ANNA, nome: 'Anna', cognome: 'Bianchi', foto_agg: null, nascita: null, eta: 29, dettagli: { obiettivi: 'Dieci trazioni' }, updated_at: '2026-10-01T10:00:00Z' }]
        : []
    }
    return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

describe('la pagina del Coaching', () => {
  beforeEach(() => {
    useMessaggiStore.setState({ userId: IO, messaggi: [], primoGiroFatto: true, errore: null })
    useProfiliStore.setState({ owner: null, profili: {} })
    useRuolo.setState({ coach: true })
    server()
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('ha due card, Trova un coach e Seguiti, e in alto la chat e i codici', async () => {
    apri()
    const schede = await screen.findAllByRole('tab')
    expect(schede.map(s => s.textContent)).toEqual([expect.stringMatching(/^Trova un coach/), expect.stringMatching(/^Seguiti/)])
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Codici' })).toBeInTheDocument()
    // Il codice non si genera più da qui.
    expect(await screen.findByText('Nessuno ti segue.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('CODICE')).not.toBeInTheDocument()
  })

  it('i seguiti hanno nome e cognome, e il profilo accanto alla x', async () => {
    const user = userEvent.setup()
    apri({ iniziale: 'allenatore' })
    expect(await screen.findByText('Anna Bianchi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Profilo di Anna Bianchi' }))
    expect(await screen.findByText('Dieci trazioni')).toBeInTheDocument()
    expect(screen.getByText('29 anni')).toBeInTheDocument()
  })

  it('dai codici si sceglie il verso, e solo dopo compare il modulo', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(await screen.findByRole('button', { name: 'Codici' }))
    const scelta = screen.getByRole('radiogroup')
    expect(within(scelta).getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByPlaceholderText('CODICE')).not.toBeVisible()
    await user.click(within(scelta).getByRole('radio', { name: /Seguire qualcuno/ }))
    expect(screen.getByPlaceholderText('CODICE')).toBeVisible()
    await user.click(within(scelta).getByRole('radio', { name: /Farmi seguire/ }))
    expect(screen.getByRole('button', { name: 'Genera un codice' })).toBeVisible()
  })
})

describe('un atleta nel Coaching', () => {
  const LUCA = { user_id: 'u-luca', nome: 'Luca', cognome: 'Campion', foto: null, focus: 'Forza, ipertrofia', bio: 'Alleno da dieci anni.' }

  beforeEach(() => {
    useMessaggiStore.setState({ userId: IO, messaggi: [], primoGiroFatto: true, errore: null })
    useProfiliStore.setState({ owner: null, profili: {} })
    useRuolo.setState({ coach: false })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  it('vede una card sola, senza «Seguiti» e senza il tasto del codice', async () => {
    server({ coach: false })
    apri()
    const schede = await screen.findAllByRole('tab')
    expect(schede).toHaveLength(1)
    expect(schede[0]).toHaveTextContent('Trova un coach')
    expect(await screen.findByText('Nessuno ti segue.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Genera un codice' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Codici' })).toBeInTheDocument()
  })

  it('vede i coach dell’app, col loro lavoro', async () => {
    server({ coach: false, coachApp: [LUCA] })
    apri()
    expect(await screen.findByText('Luca Campion')).toBeInTheDocument()
    expect(screen.getByText('Forza, ipertrofia')).toBeInTheDocument()
    expect(screen.getByText('Alleno da dieci anni.')).toBeInTheDocument()
  })

  it('senza coach nell’app lo dice', async () => {
    server({ coach: false })
    apri()
    expect(await screen.findByText('Per ora non ci sono coach disponibili.')).toBeInTheDocument()
  })

  it('dalla chiave genera il suo codice, e seguire qualcuno non gli viene proposto', async () => {
    server({ coach: false })
    const user = userEvent.setup()
    apri()
    await user.click(await screen.findByRole('button', { name: 'Codici' }))
    expect(await screen.findByRole('button', { name: 'Genera un codice' })).toBeVisible()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('CODICE')).not.toBeInTheDocument()
  })

  it('un coach non vede se stesso fra i coach dell’app', async () => {
    useRuolo.setState({ coach: true })
    server({ coachApp: [{ ...LUCA, user_id: IO }] })
    apri()
    await screen.findAllByRole('tab')
    await screen.findByText('Nessuno ti segue.')
    expect(screen.queryByText('Luca Campion')).not.toBeInTheDocument()
  })

  it('chi seguiva già qualcuno prima dei ruoli continua a vederlo', async () => {
    server({ coach: false })
    vi.mocked(fetch).mockImplementation(async url => {
      const u = decodeURIComponent(String(url))
      const corpo = u.includes('/coach_links') && u.includes(`coach_id=eq.${IO}`)
        ? [{ coach_id: IO, athlete_id: ANNA, athlete_name: 'Anna', coach_name: 'Luca', created_at: '2026-10-01T10:00:00Z' }]
        : []
      return new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    apri()
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(2))
  })
})
