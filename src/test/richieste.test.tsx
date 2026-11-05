import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisCoach } from '@/features/coach/JarvisCoach'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { useProfiliStore } from '@/lib/profili'
import { useRuolo } from '@/lib/ruolo'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'
import { ConfirmModal } from '@/components/ConfirmModal'

// Le richieste di essere seguiti (4 nov 2026): l'allievo chiede a un coach
// dall'elenco «Trova un coach», il coach accetta o rifiuta da «Richieste».

const IO = 'u-io', MARCO = 'u-marco', ANNA = 'u-anna'

interface Riga { athlete_id: string; coach_id: string; athlete_name: string | null; created_at: string }
let richieste: Riga[] = []
let collegamenti: Array<{ coach_id: string; athlete_id: string; athlete_name: string; coach_name: string; created_at: string }> = []
let chiamate: Array<{ metodo: string; url: string; corpo: unknown }> = []

const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

function server({ coach }: { coach: boolean }) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const u = decodeURIComponent(String(url))
    const metodo = init?.method ?? 'GET'
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined
    chiamate.push({ metodo, url: u, corpo })
    if (u.includes('/coach_abilitati')) return json(coach ? [{ user_id: IO }] : [])
    if (u.includes('/rpc/elenco_coach')) return json([{ user_id: MARCO, nome: 'Marco', cognome: 'Rossi', foto: null, focus: 'Forza', bio: null }])
    if (u.includes('/rpc/accetta_richiesta')) {
      const r = richieste.find(x => x.athlete_id === corpo.p_athlete && x.coach_id === IO)
      if (!r) return new Response(JSON.stringify({ message: 'RICHIESTA_SPARITA' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      collegamenti.push({ coach_id: IO, athlete_id: r.athlete_id, athlete_name: r.athlete_name ?? '', coach_name: corpo.p_coach_name, created_at: '2026-11-04T10:00:00Z' })
      richieste = richieste.filter(x => x.athlete_id !== r.athlete_id)
      return json(null)
    }
    if (u.includes('/coach_richieste')) {
      if (metodo === 'POST') {
        const riga = { ...corpo, created_at: '2026-11-04T09:00:00Z' }
        richieste.push(riga)
        return json([riga])
      }
      if (metodo === 'DELETE') {
        richieste = richieste.filter(r => !(u.includes(`athlete_id=eq.${r.athlete_id}`) && (!u.includes('coach_id=eq.') || u.includes(`coach_id=eq.${r.coach_id}`))))
        return new Response(null, { status: 204 })
      }
      if (u.includes(`athlete_id=eq.${IO}`)) return json(richieste.filter(r => r.athlete_id === IO))
      if (u.includes(`coach_id=eq.${IO}`)) return json(richieste.filter(r => r.coach_id === IO))
      return json([])
    }
    if (u.includes('/coach_links')) {
      if (u.includes(`coach_id=eq.${IO}`)) return json(collegamenti.filter(l => l.coach_id === IO))
      if (u.includes(`athlete_id=eq.${IO}`)) return json(collegamenti.filter(l => l.athlete_id === IO))
      return json([])
    }
    return json([])
  })
}

const apri = () => render(<ConfirmDeleteProvider><JarvisCoach userId={IO} onBack={() => {}}/><ConfirmModal/></ConfirmDeleteProvider>)

beforeEach(() => {
  richieste = []
  collegamenti = []
  chiamate = []
  useMessaggiStore.setState({ userId: IO, messaggi: [], primoGiroFatto: true, errore: null })
  useProfiliStore.setState({ owner: null, profili: {} })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('chi cerca un coach', () => {
  beforeEach(() => { useRuolo.setState({ coach: false }); server({ coach: false }) })

  it('chiede a un coach di seguirlo, e può annullare', async () => {
    const user = userEvent.setup()
    apri()
    await user.click(await screen.findByRole('button', { name: 'Chiedi di seguirmi' }))

    expect(await screen.findByText('Richiesta inviata')).toBeInTheDocument()
    expect(screen.getByText(/Hai chiesto a Marco Rossi di seguirti/)).toBeInTheDocument()
    const inviata = chiamate.find(c => c.metodo === 'POST' && c.url.includes('/coach_richieste'))
    expect(inviata?.corpo).toMatchObject({ athlete_id: IO, coach_id: MARCO })
    // Agli altri non si chiede finché questa è in attesa.
    expect(screen.queryByRole('button', { name: 'Chiedi di seguirmi' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    expect(await screen.findByRole('button', { name: 'Chiedi di seguirmi' })).toBeInTheDocument()
    expect(richieste).toEqual([])
  })

  it('una richiesta già in attesa si ritrova riaprendo la pagina', async () => {
    richieste = [{ athlete_id: IO, coach_id: MARCO, athlete_name: 'Io', created_at: '2026-11-03T09:00:00Z' }]
    apri()
    expect(await screen.findByText('Richiesta inviata')).toBeInTheDocument()
  })

  it('chi ha già un coach non chiede a nessun altro', async () => {
    collegamenti = [{ coach_id: 'u-altro', athlete_id: IO, athlete_name: 'Io', coach_name: 'Gino', created_at: '2026-10-01T10:00:00Z' }]
    apri()
    expect(await screen.findByText('Marco Rossi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chiedi di seguirmi' })).not.toBeInTheDocument()
  })
})

describe('il coach', () => {
  beforeEach(() => { useRuolo.setState({ coach: true }); server({ coach: true }) })

  it('vede quante richieste ha, e accettandone una segue quella persona', async () => {
    richieste = [{ athlete_id: ANNA, coach_id: IO, athlete_name: 'Anna', created_at: '2026-11-03T09:00:00Z' }]
    const user = userEvent.setup()
    apri()
    const tab = await screen.findByRole('tab', { name: /Richieste/ })
    await waitFor(() => expect(tab).toHaveTextContent('1 da guardare'))
    await user.click(tab)
    expect(screen.getByText('Ti ha chiesto di seguirlo il 03/11/26')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accetta' }))
    expect(await screen.findByText('Adesso segui Anna: lo trovi fra i tuoi seguiti.')).toBeInTheDocument()
    expect(chiamate.find(c => c.url.includes('/rpc/accetta_richiesta'))?.corpo).toMatchObject({ p_athlete: ANNA })
    await waitFor(() => expect(screen.getByRole('tab', { name: /Seguiti/ })).toHaveTextContent('1 allievo'))
    expect(screen.getByText('Nessuna richiesta.')).toBeInTheDocument()
  })

  it('una richiesta annullata nel frattempo lo dice, e non resta a schermo', async () => {
    richieste = [{ athlete_id: ANNA, coach_id: IO, athlete_name: 'Anna', created_at: '2026-11-03T09:00:00Z' }]
    const user = userEvent.setup()
    apri()
    await user.click(await screen.findByRole('tab', { name: /Richieste/ }))
    await screen.findByRole('button', { name: 'Accetta' })
    // Mentre la pagina è aperta, Anna annulla.
    richieste = []
    await user.click(screen.getByRole('button', { name: 'Accetta' }))
    expect(await screen.findByText('La richiesta non c’è più: è stata annullata nel frattempo.')).toBeInTheDocument()
    expect(await screen.findByText('Nessuna richiesta.')).toBeInTheDocument()
  })

  it('un coach che ha a sua volta un coach lo ritrova in «Il mio coach», senza l’elenco dei coach', async () => {
    collegamenti = [{ coach_id: 'u-gino', athlete_id: IO, athlete_name: 'Io', coach_name: 'Gino', created_at: '2026-10-01T10:00:00Z' }]
    const user = userEvent.setup()
    apri()
    const tabs = await screen.findAllByRole('tab')
    await waitFor(() => expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      expect.stringMatching(/^Seguiti/), expect.stringMatching(/^Richieste/), expect.stringMatching(/^Il mio coach/),
    ]))
    expect(tabs.length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: /Il mio coach/ }))
    expect(await screen.findByRole('button', { name: 'Scollega' })).toBeInTheDocument()
    expect(screen.queryByText('Marco Rossi')).not.toBeInTheDocument()
  })

  it('rifiuta dopo averlo chiesto, e la richiesta sparisce', async () => {
    richieste = [{ athlete_id: ANNA, coach_id: IO, athlete_name: 'Anna', created_at: '2026-11-03T09:00:00Z' }]
    const user = userEvent.setup()
    apri()
    await user.click(await screen.findByRole('tab', { name: /Richieste/ }))
    await user.click(await screen.findByRole('button', { name: 'Rifiuta' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rifiuta' }))
    await waitFor(() => expect(richieste).toEqual([]))
    expect(await screen.findByText('Nessuna richiesta.')).toBeInTheDocument()
  })
})
