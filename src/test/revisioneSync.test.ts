import { describe, it, expect, beforeEach, vi } from 'vitest'

// Le correzioni della revisione di novembre 2026 su chi possiede i dati in
// memoria, su cosa resta in giro dopo un'uscita e sul bridge del cloud che
// lavora ancora mentre l'account se ne va.

const coach = vi.hoisted(() => ({
  myAthletes: vi.fn(),
  athleteData: vi.fn(),
}))
vi.mock('@/lib/coach', async orig => ({ ...(await orig() as object), myAthletes: coach.myAthletes, athleteData: coach.athleteData }))

import { useJarvisStore, EMPTY_STATE, JARVIS_STORE_KEY, scriviSuDisco } from '@/store/useJarvisStore'
import { markDirty, resetSyncMeta, setSynced } from '@/lib/syncMeta'
import { useSyncStatus } from '@/lib/syncStatus'
import { proprietario, segnaProprietario, entratoAltrove, parcheggia, riprendi, svuotaDatiLocali, lasciaAllAltraScheda } from '@/lib/proprietario'
import { salvaSessione, sessioneAperta, scartaSessione } from '@/features/gym/sessioneInCorso'
import { useAllievi, caricaAllievi } from '@/features/desktop/allieviDesktop'
import { useNavDesktop } from '@/features/desktop/navDesktop'

const PORTA = 'jarvis-proprietario-v1'
const scheda = { id: 'sc1', title: 'Push A', exercises: [], createdAt: '2026-10-01', updatedAt: '2026-10-01' }

beforeEach(() => {
  segnaProprietario(null)
  localStorage.clear()
  resetSyncMeta()
  useJarvisStore.setState({ ...EMPTY_STATE }, true)
  useSyncStatus.getState().azzera()
  useSyncStatus.getState().setSmetti(null)
})

// Due schede dello stesso browser: il disco è di tutte, lo store di ciascuna.
describe('di chi sono i dati di questa scheda', () => {
  it('lo dice la sua memoria, non la porta che un’altra scheda ha riscritto', () => {
    segnaProprietario('utente-a')
    // L'altra scheda entra con B: scrive la porta, questa non ne sa niente.
    localStorage.setItem(PORTA, 'utente-b')
    expect(proprietario()).toBe('utente-a')
    expect(entratoAltrove()).toBe(true)
    // Con l'evento `storage`: conta solo se è cambiata la porta.
    expect(entratoAltrove({ key: PORTA })).toBe(true)
    expect(entratoAltrove({ key: JARVIS_STORE_KEY })).toBe(false)
  })

  it('un’uscita altrove non è un ingresso, e chi non ha dati non ha niente da cedere', () => {
    segnaProprietario('utente-a')
    localStorage.removeItem(PORTA)
    expect(entratoAltrove()).toBe(false)
    segnaProprietario(null)
    localStorage.setItem(PORTA, 'utente-b')
    expect(entratoAltrove()).toBe(false)
  })
})

describe('il parcheggio della seconda scheda', () => {
  const mezza = { e1: { checks: [true, false], weights: ['60', '60'], reps: ['8', '8'] } }

  it('non cancella l’allenamento a metà già messo da parte dalla prima', () => {
    // Prima scheda: niente da inviare, un allenamento a metà su disco.
    setSynced('2026-10-07T09:00:00+00:00')
    salvaSessione('sc1', mezza)
    parcheggia('utente-a')
    scartaSessione()
    // Seconda scheda: modifiche non inviate, e la sessione su disco non c'è più.
    useJarvisStore.setState({ gymSchede: [scheda] })
    markDirty()
    parcheggia('utente-a')

    svuotaDatiLocali()
    expect(riprendi('utente-a')).toBe(true)
    expect(useJarvisStore.getState().gymSchede.map(s => s.id)).toEqual(['sc1'])
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1', fatte: 1 })
  })

  it('né le modifiche messe da parte dalla prima, se lei ha solo la sessione', () => {
    useJarvisStore.setState({ gymSchede: [scheda] })
    markDirty()
    parcheggia('utente-a')
    resetSyncMeta()
    localStorage.removeItem('jarvis-sync-meta-v1')
    useJarvisStore.setState({ ...EMPTY_STATE }, true)
    salvaSessione('sc1', mezza)
    parcheggia('utente-a')

    svuotaDatiLocali()
    expect(riprendi('utente-a')).toBe(true)
    expect(useJarvisStore.getState().gymSchede.map(s => s.id)).toEqual(['sc1'])
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1' })
  })
})

describe('svuotare i dati di chi esce', () => {
  it('ferma prima il bridge del cloud: lo store vuoto non è una modifica da mandare', () => {
    const ordine: string[] = []
    useJarvisStore.setState({ gymSchede: [scheda] })
    const unsub = useJarvisStore.subscribe(st => { ordine.push(st.gymSchede.length ? 'pieno' : 'vuoto') })
    useSyncStatus.getState().setSmetti(() => { ordine.push('smetti') })
    svuotaDatiLocali()
    unsub()
    expect(ordine[0]).toBe('smetti')
  })

  it('azzera lo stato della sincronizzazione, anche "app da aggiornare"', () => {
    const st = useSyncStatus.getState()
    st.setVecchia(true); st.setStatus('error'); st.setRetry(() => {}); st.setNotice('Aggiornato da un altro dispositivo')
    svuotaDatiLocali()
    expect(useSyncStatus.getState()).toMatchObject({ vecchia: false, status: 'idle', retry: null, notice: null })
  })

  it('toglie gli allievi di chi allena e la sezione aperta sul desktop', () => {
    useAllievi.setState({ allievi: [{ link: { athlete_id: 'x' } as never, dati: null }] })
    useNavDesktop.getState().vai({ sezione: 'schede', apri: 'sc1' })
    svuotaDatiLocali()
    expect(useAllievi.getState().allievi).toEqual([])
    expect(useNavDesktop.getState().dove).toEqual({ sezione: 'oggi' })
  })
})

describe('gli allievi sul desktop', () => {
  it('quelli di un altro allenatore non restano in vista, e una risposta tardiva non torna', async () => {
    coach.myAthletes.mockResolvedValueOnce([{ athlete_id: 'allievo-1' }])
    coach.athleteData.mockResolvedValue(null)
    await caricaAllievi('coach-a')
    expect(useAllievi.getState().allievi).toHaveLength(1)

    // Entra un altro: senza rete, prima restavano quelli di A.
    coach.myAthletes.mockRejectedValueOnce(new Error('offline'))
    await caricaAllievi('coach-b')
    expect(useAllievi.getState().allievi).toEqual([])

    // A esce mentre la sua lettura è in viaggio: la risposta arriva dopo.
    let rispondi!: (v: unknown) => void
    coach.myAthletes.mockReturnValueOnce(new Promise(r => { rispondi = r }))
    const lettura = caricaAllievi('coach-a')
    svuotaDatiLocali()
    rispondi([{ athlete_id: 'allievo-1' }])
    await lettura
    expect(useAllievi.getState().allievi).toEqual([])
  })
})

// Per ultimo: da qui lo store di questo file non scrive più su disco.
describe('cedere il disco all’altra scheda', () => {
  it('ferma il bridge, butta la scrittura in attesa e lascia il disco com’è', () => {
    const smetti = vi.fn()
    useSyncStatus.getState().setSmetti(smetti)
    segnaProprietario('utente-a')
    // Su disco ci sono i dati che l'altra scheda ha messo per B…
    localStorage.setItem(JARVIS_STORE_KEY, '{"state":{"userName":"Bea"},"version":0}')
    localStorage.setItem(PORTA, 'utente-b')
    // …e qui una scrittura dei dati di A ancora in attesa.
    useJarvisStore.setState({ userName: 'Anna' })
    // La ricarica jsdom non la fa: scrive "Not implemented: navigation", e basta.
    lasciaAllAltraScheda()

    expect(smetti).toHaveBeenCalled()
    scriviSuDisco()                                    // il `pagehide` della ricarica
    useJarvisStore.setState({ userName: 'Anna 2' })    // e una modifica arrivata prima
    scriviSuDisco()
    expect(localStorage.getItem(JARVIS_STORE_KEY)).toBe('{"state":{"userName":"Bea"},"version":0}')
  })

  it('le modifiche non inviate di questa scheda si parcheggiano per chi le ha fatte', () => {
    // L'altra scheda, entrando, ha parcheggiato quello che aveva LEI in
    // memoria: le modifiche fatte qui andavano perse con la ricarica.
    segnaProprietario('utente-a')
    useJarvisStore.setState({ userName: 'Anna' })
    markDirty()
    localStorage.setItem(PORTA, 'utente-b')
    lasciaAllAltraScheda()
    const parcheggio = JSON.parse(localStorage.getItem('jarvis-parcheggio-v1-utente-a') ?? '{}')
    expect(parcheggio.stato?.userName).toBe('Anna')
    expect(parcheggio.meta?.dirty).toBe(true)
  })
})
