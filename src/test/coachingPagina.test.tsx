import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JarvisCoach } from '@/features/coach/JarvisCoach'
import { useMessaggiStore } from '@/lib/messaggiLive'
import { useProfiliStore } from '@/lib/profili'
import { ConfirmDeleteProvider } from '@/hooks/useConfirmDelete'

// La pagina del Coaching: due card (chi mi segue, chi seguo), e in alto a destra
// la chat e la chiave dei codici. I codici non stanno più nelle due sezioni, e
// chi seguo si vede con la faccia, il nome e cognome, e il suo profilo a un tocco.

const IO = 'u-io', ANNA = 'u-anna'

const apri = (props: Partial<Parameters<typeof JarvisCoach>[0]> = {}) => render(
  <ConfirmDeleteProvider><JarvisCoach userId={IO} onBack={() => {}} {...props}/></ConfirmDeleteProvider>,
)

function server() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const u = decodeURIComponent(String(url))
    let corpo: unknown = []
    if (u.includes('/coach_links') && u.includes(`coach_id=eq.${IO}`)) {
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
