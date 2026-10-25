import { it, expect, vi } from 'vitest'
import { render, act, waitFor, screen } from '@testing-library/react'

// Un account nuovo il cui PRIMO caricamento dal cloud fallisce (rete lenta,
// telefono senza segnale). Fino a ottobre 2026 restava senza il marcatore
// dell'azzeramento del catalogo: l'utente creava schede e alzate, salivano in
// cloud così, e al riavvio successivo l'azzeramento le cancellava e risalvava il
// cloud vuoto. Qui si rifà quel giro con un cloud finto, dall'avvio al riavvio.

vi.mock('@/components/UpdateToast', () => ({ UpdateToast: () => null }))
vi.mock('@/lib/messaggiLive', () => ({ avviaMessaggi: () => {}, fermaMessaggi: () => {} }))
vi.mock('@/features/gym/JarvisGym', () => ({ JarvisGym: () => null }))
vi.mock('@/features/profile/JarvisProfile', () => ({ JarvisProfile: () => null }))
vi.mock('@/features/coach/JarvisCoach', () => ({ JarvisCoach: () => null }))
vi.mock('@/lib/push', async orig => ({ ...(await orig() as object), riallineaPush: async () => {}, daProporrePush: async () => false, disattivaPush: async () => {} }))

// Il cloud: una riga sola, quella di `user_data`. Il primo caricamento fallisce.
const cloud = { riga: null as null | { data: Record<string, unknown>; updated_at: string }, caricamentiFalliti: 1, salvataggi: 0, caricamenti: 0 }
vi.mock('@/lib/supabase', () => {
  const session = { access_token: 'x', user: { id: 'u1' } }
  const auth = {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  }
  type Op = [string | symbol, unknown[]]
  async function risposta(tabella: string, ops: Op[]) {
    if (tabella !== 'user_data') return { data: [], error: null }
    const up = ops.find(o => o[0] === 'upsert')
    if (up) {
      const riga = up[1][0] as { data: unknown; updated_at: string }
      cloud.riga = { data: JSON.parse(JSON.stringify(riga.data)), updated_at: riga.updated_at }
      cloud.salvataggi++
      return { data: { updated_at: riga.updated_at }, error: null }
    }
    const sel = ops.find(o => o[0] === 'select')![1][0]
    if (sel === 'data, updated_at') {
      cloud.caricamenti++
      if (cloud.caricamentiFalliti > 0) { cloud.caricamentiFalliti--; return { data: null, error: { message: 'AbortError: timeout' } } }
      return { data: cloud.riga, error: null }
    }
    return { data: cloud.riga ? { updated_at: cloud.riga.updated_at, versione: cloud.riga.data.versioneDati } : null, error: null }
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
    supabase: { auth, from, rpc: async () => ({ data: null, error: null }) },
    auth,
    sessioneSuDisco: () => null, idUtenteSuDisco: () => null,
    erroreDiRete: () => false, storageKey: 'sb-test-auth-token',
    chiamaFunzione: async () => new Response('{}'),
  }
})

it('un account nuovo partito senza cloud non perde schede e alzate al riavvio', async () => {
  sessionStorage.setItem('jarvis-booted', '1')
  const { default: App } = await import('@/App')
  const { useJarvisStore } = await import('@/store/useJarvisStore')

  const prima = render(<App/>)
  await waitFor(() => expect(screen.getByText(/Dati cloud non caricati/i)).toBeTruthy(), { timeout: 5000 })
  // Torna la rete: il cloud risponde che la riga non c'è, cioè l'account è nuovo.
  // Prima un giro a vuoto: chi ascolta il ritorno della rete si mette in ascolto
  // in un effetto, dopo che la pagina è già disegnata.
  await act(async () => { await new Promise(r => setTimeout(r, 100)) })
  await act(async () => { window.dispatchEvent(new Event('online')); await new Promise(r => setTimeout(r, 200)) })
  await waitFor(() => expect(screen.queryByText(/Dati cloud non caricati/i)).toBeNull(), { timeout: 5000 })
  // E da lì l'account è segnato: ha il catalogo, e l'azzeramento non gli serve più.
  await waitFor(() => expect(useJarvisStore.getState().catalogoReset).toBeTruthy(), { timeout: 5000 })
  expect(useJarvisStore.getState().palestraExercises.length).toBeGreaterThan(0)

  // L'utente si allena: una scheda e un'alzata, che salgono in cloud.
  act(() => {
    useJarvisStore.setState({
      gymSchede: [{ id: 'sc1', title: 'Push A', exercises: [], createdAt: '2026-10-20', updatedAt: '2026-10-20' }],
      palestraExercises: [{ id: 'e1', n: 'Panca', muscle: 'Petto', current: { kg: 80, reps: 8, sets_n: 3 }, history: [{ d: 'W43', date: '2026-10-20', kg: 80, reps: 8, sets_n: 3 }] }],
    })
  })
  await waitFor(() => expect((cloud.riga?.data.gymSchede as unknown[] | undefined)?.length).toBe(1), { timeout: 8000 })
  prima.unmount()

  // Il riavvio: il caricamento questa volta riesce.
  render(<App/>)
  await waitFor(() => expect(cloud.caricamenti).toBe(2), { timeout: 5000 })
  // Il tempo per applicare il cloud e, se ci fosse da fare, azzerare e risalvare.
  await act(async () => { await new Promise(r => setTimeout(r, 2000)) })
  const st = useJarvisStore.getState()
  expect(st.gymSchede.map(s => s.id)).toEqual(['sc1'])
  expect(st.palestraExercises.some(e => e.id === 'e1')).toBe(true)
  // E il cloud ha ancora la scheda.
  expect((cloud.riga?.data.gymSchede as unknown[]).length).toBe(1)
}, 30000)
