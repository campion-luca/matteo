import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor, screen, cleanup } from '@testing-library/react'

// La revisione di novembre 2026, rifatta con l'app vera e un cloud finto: il
// questionario del primo accesso con l'app vecchia, l'uscita con la
// sincronizzazione in errore, e una seconda scheda del browser che entra con un
// altro account.

vi.mock('@/components/UpdateToast', () => ({ UpdateToast: () => null }))
vi.mock('@/lib/messaggiLive', () => ({ avviaMessaggi: () => {}, fermaMessaggi: () => {} }))
vi.mock('@/features/gym/JarvisGym', () => ({ JarvisGym: () => null }))
vi.mock('@/features/profile/JarvisProfile', () => ({ JarvisProfile: () => null }))
vi.mock('@/features/coach/JarvisCoach', () => ({ JarvisCoach: () => null }))
vi.mock('@/lib/push', async orig => ({ ...(await orig() as object), riallineaPush: async () => {}, daProporrePush: async () => false, disattivaPush: async () => {}, staccaPushLocale: async () => {} }))
// La ricarica jsdom non la sa fare: qui basta sapere che è stata chiesta.
const cedi = vi.hoisted(() => vi.fn())
vi.mock('@/lib/proprietario', async orig => ({ ...(await orig() as object), lasciaAllAltraScheda: cedi }))

// Il cloud: una riga di `user_data` per utente, e ogni tentativo di scrittura
// annotato — anche quelli che falliscono.
type Riga = { data: Record<string, unknown>; updated_at: string }
const cloud = vi.hoisted(() => ({
  righe: {} as Record<string, Riga>,
  tentativi: [] as { utente: string; data: Record<string, unknown> }[],
  scritturaFallisce: false,
}))
const auth = vi.hoisted(() => ({
  utente: 'u1',
  cb: null as null | ((evento: string, sessione: unknown) => void),
}))
vi.mock('@/lib/supabase', () => {
  const sessione = (id: string) => ({ access_token: 'x', user: { id } })
  const client = {
    getSession: async () => ({ data: { session: sessione(auth.utente) }, error: null }),
    onAuthStateChange: (cb: (evento: string, sessione: unknown) => void) => { auth.cb = cb; return { data: { subscription: { unsubscribe() {} } } } },
    signOut: async () => ({ error: null }),
  }
  type Op = [string | symbol, unknown[]]
  async function risposta(tabella: string, ops: Op[]) {
    if (tabella !== 'user_data') return { data: [], error: null }
    const up = ops.find(o => o[0] === 'upsert')
    if (up) {
      const riga = up[1][0] as { user_id: string; data: Record<string, unknown>; updated_at: string }
      const data = JSON.parse(JSON.stringify(riga.data)) as Record<string, unknown>
      cloud.tentativi.push({ utente: riga.user_id, data })
      if (cloud.scritturaFallisce) return { data: null, error: { message: 'rete' } }
      cloud.righe[riga.user_id] = { data, updated_at: riga.updated_at }
      return { data: { updated_at: riga.updated_at }, error: null }
    }
    const chi = ops.find(o => o[0] === 'eq')![1][1] as string
    const riga = cloud.righe[chi] ?? null
    const sel = ops.find(o => o[0] === 'select')![1][0]
    if (sel === 'data, updated_at') return { data: riga, error: null }
    return { data: riga ? { updated_at: riga.updated_at, versione: riga.data.versioneDati } : null, error: null }
  }
  function from(tabella: string) {
    const ops: Op[] = []
    const q: Record<string | symbol, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => risposta(tabella, ops).then(ok, ko)
        return (...args: unknown[]) => { ops.push([prop, args]); return q }
      },
    })
    return q
  }
  return {
    supabase: { auth: client, from, rpc: async () => ({ data: null, error: null }) },
    auth: client,
    sessioneSuDisco: () => null, idUtenteSuDisco: () => null,
    erroreDiRete: () => false, storageKey: 'sb-test-auth-token',
    chiamaFunzione: async () => new Response('{}'),
  }
})

import App from '@/App'
import { useJarvisStore, EMPTY_STATE, VERSIONE_DATI } from '@/store/useJarvisStore'
import { resetSyncMeta } from '@/lib/syncMeta'
import { useSyncStatus } from '@/lib/syncStatus'
import { segnaProprietario } from '@/lib/proprietario'

const scheda = { id: 'sc1', title: 'Push A', exercises: [], createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const pausa = (ms: number) => new Promise(r => setTimeout(r, ms))

// Come succede davvero: l'evento arriva da fuori React (il client Supabase),
// non dentro un `act` che ridisegnerebbe tutto prima di qualsiasi risposta.
async function daFuori(evento: string, utente: string | null, attesa = 300) {
  const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  g.IS_REACT_ACT_ENVIRONMENT = false
  try {
    auth.cb!(evento, utente ? { access_token: 'x', user: { id: utente } } : null)
    await pausa(attesa)
  } finally { g.IS_REACT_ACT_ENVIRONMENT = true }
}

beforeEach(() => {
  sessionStorage.setItem('jarvis-booted', '1')
  cloud.righe = {}; cloud.tentativi = []; cloud.scritturaFallisce = false
  auth.utente = 'u1'
  cedi.mockClear()
})
afterEach(() => {
  cleanup()
  segnaProprietario(null)
  localStorage.clear()
  resetSyncMeta()
  useJarvisStore.setState({ ...EMPTY_STATE }, true)
  useSyncStatus.getState().azzera()
})

describe('il questionario del primo accesso', () => {
  it('compare a un account nuovo', async () => {
    render(<App/>)
    await waitFor(() => expect(screen.getByText(/Passo 1 di/i)).toBeTruthy(), { timeout: 5000 })
  })

  it('non compare con l’app più vecchia del cloud: il catalogo che aggiunge tornerebbe doppio', async () => {
    cloud.righe.u1 = { data: { versioneDati: VERSIONE_DATI + 1, userName: 'Anna' }, updated_at: '2026-11-01T10:00:00+00:00' }
    render(<App/>)
    await waitFor(() => expect(screen.getByText(/App da aggiornare/i)).toBeTruthy(), { timeout: 5000 })
    await act(async () => { await pausa(500) })
    expect(screen.queryByText(/Passo 1 di/i)).toBeNull()
    expect(cloud.tentativi).toEqual([])
  })
})

describe('l’uscita con la sincronizzazione in errore', () => {
  it('non manda al cloud di chi esce lo store vuoto', async () => {
    cloud.righe.u1 = { data: { versioneDati: VERSIONE_DATI, userName: 'Anna', gymSchede: [] }, updated_at: '2026-11-01T10:00:00+00:00' }
    render(<App/>)
    await waitFor(() => expect(useJarvisStore.getState().userName).toBe('Anna'), { timeout: 5000 })
    await act(async () => { await pausa(100) })
    // Una modifica che non riesce a salire: la sincronizzazione va in errore.
    cloud.scritturaFallisce = true
    act(() => { useJarvisStore.setState({ gymSchede: [scheda] }) })
    await waitFor(() => expect(screen.getByText(/Non sincronizzato/i)).toBeTruthy(), { timeout: 5000 })
    const prima = cloud.tentativi.length

    await daFuori('SIGNED_OUT', null)
    expect(cloud.tentativi.length).toBe(prima)
    // E la modifica che non era salita è messa da parte per chi è uscito.
    expect(localStorage.getItem('jarvis-parcheggio-v1-u1')).not.toBeNull()
  }, 15000)
})

describe('una seconda scheda entra con un altro account', () => {
  async function apertaComeU1() {
    cloud.righe.u1 = { data: { versioneDati: VERSIONE_DATI, userName: 'Anna', gymSchede: [] }, updated_at: '2026-11-01T10:00:00+00:00' }
    render(<App/>)
    await waitFor(() => expect(useJarvisStore.getState().userName).toBe('Anna'), { timeout: 5000 })
    await act(async () => { await pausa(100) })
  }

  it('questa non salva i dati di prima nel cloud del nuovo, e riparte dal disco', async () => {
    await apertaComeU1()
    // Una modifica di Anna non ancora partita…
    act(() => { useJarvisStore.setState({ gymSchede: [scheda] }) })
    // …e intanto l'altra scheda è entrata come u2: ha riscritto la porta.
    localStorage.setItem('jarvis-proprietario-v1', 'u2')
    await daFuori('SIGNED_IN', 'u2', 2500)
    expect(cloud.tentativi.filter(t => t.utente === 'u2')).toEqual([])
    expect(cedi).toHaveBeenCalled()
  }, 15000)

  it('lo sa anche solo dalla porta riscritta, prima della notizia del nuovo accesso', async () => {
    await apertaComeU1()
    localStorage.setItem('jarvis-proprietario-v1', 'u2')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'jarvis-proprietario-v1', newValue: 'u2' })) })
    expect(cedi).toHaveBeenCalledTimes(1)
  }, 15000)

  it('un’uscita dall’altra scheda non fa ricaricare', async () => {
    await apertaComeU1()
    localStorage.removeItem('jarvis-proprietario-v1')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'jarvis-proprietario-v1', newValue: null })) })
    expect(cedi).not.toHaveBeenCalled()
  }, 15000)
})
