import { describe, it, expect, beforeEach } from 'vitest'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { getSyncMeta, markDirty, setSynced, resetSyncMeta, dimenticaUltimoSync, decideInitialSync } from '@/lib/syncMeta'
import { proprietario, segnaProprietario, parcheggia, riprendi, svuotaDatiLocali, pulisciParcheggi } from '@/lib/proprietario'
import { sessioneSuDisco, idUtenteSuDisco, storageKey } from '@/lib/supabase'
import { salvaSessione, sessioneAperta } from '@/features/gym/sessioneInCorso'

// Di chi sono i dati sul telefono, e cosa succede a quelli non ancora inviati
// quando l'account esce. Prima un'uscita con lavoro non sincronizzato lo
// cancellava; e una sessione cambiata senza passare dall'uscita lasciava i dati
// di un account nello store di un altro.

const scheda = { id: 'sc1', title: 'Push A', exercises: [], createdAt: '2026-10-01', updatedAt: '2026-10-01' }

beforeEach(() => {
  localStorage.clear()
  resetSyncMeta()
  useJarvisStore.setState({ ...EMPTY_STATE }, true)
})

describe('i dati non inviati di chi esce', () => {
  it('si mettono da parte, e tornano al suo prossimo ingresso segnati da inviare', () => {
    setSynced('2026-10-07T09:00:00+00:00', { schede: [], esercizi: [] })
    useJarvisStore.setState({ userName: 'Anna', gymSchede: [scheda] })
    markDirty()

    parcheggia('utente-a')
    svuotaDatiLocali()
    expect(useJarvisStore.getState().gymSchede).toEqual([])
    expect(getSyncMeta().dirty).toBe(false)

    expect(riprendi('utente-a')).toBe(true)
    expect(useJarvisStore.getState().userName).toBe('Anna')
    expect(useJarvisStore.getState().gymSchede.map(s => s.id)).toEqual(['sc1'])
    // Ripartono come una modifica fatta senza rete: da inviare, e con memoria
    // di cosa c'era all'ultimo sync.
    expect(getSyncMeta()).toMatchObject({ dirty: true, lastSyncedAt: '2026-10-07T09:00:00+00:00' })
    // Una volta sola.
    expect(riprendi('utente-a')).toBe(false)
  })

  it('non finiscono a un altro account', () => {
    useJarvisStore.setState({ userName: 'Anna', gymSchede: [scheda] })
    markDirty()
    parcheggia('utente-a')
    svuotaDatiLocali()
    expect(riprendi('utente-b')).toBe(false)
    expect(useJarvisStore.getState().gymSchede).toEqual([])
  })

  it('se era tutto già nel cloud non si mette da parte niente', () => {
    setSynced('2026-10-07T09:00:00+00:00')
    useJarvisStore.setState({ gymSchede: [scheda] })
    parcheggia('utente-a')
    expect(riprendi('utente-a')).toBe(false)
  })
})

describe('l’allenamento lasciato a metà di chi esce', () => {
  const mezza = { e1: { checks: [true, false], weights: ['60', '60'], reps: ['8', '8'] } }

  it('non resta in vista a chi entra dopo', () => {
    salvaSessione('sc1', mezza)
    svuotaDatiLocali()
    expect(sessioneAperta()).toBeNull()
  })

  it('ma si mette da parte, e torna al suo proprietario — anche se il resto era già nel cloud', () => {
    setSynced('2026-10-07T09:00:00+00:00')   // niente da inviare
    salvaSessione('sc1', mezza)
    parcheggia('utente-a')
    svuotaDatiLocali()

    expect(riprendi('utente-b')).toBe(false)
    expect(sessioneAperta()).toBeNull()

    expect(riprendi('utente-a')).toBe(true)
    expect(sessioneAperta()).toMatchObject({ schedaId: 'sc1', fatte: 1, totali: 2 })
    // Lo stato non era da inviare, e non lo diventa.
    expect(getSyncMeta().dirty).toBe(false)
  })
})

describe('i parcheggi che nessuno torna a prendere', () => {
  it('dopo un mese si buttano; quelli recenti restano', () => {
    useJarvisStore.setState({ gymSchede: [scheda] })
    markDirty()
    parcheggia('utente-a')
    parcheggia('utente-b')
    const chiave = 'jarvis-parcheggio-v1-utente-a'
    const vecchio = JSON.parse(localStorage.getItem(chiave)!)
    localStorage.setItem(chiave, JSON.stringify({ ...vecchio, quando: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() }))
    pulisciParcheggi()
    expect(localStorage.getItem(chiave)).toBeNull()
    expect(localStorage.getItem('jarvis-parcheggio-v1-utente-b')).not.toBeNull()
  })
})

// L'app scopre che il cloud è stato scritto da una versione più nuova: lo stato
// che ha in mano ha già perso quello che non conosce, e dopo l'aggiornamento
// non deve risalire tale e quale.
describe('dopo aver scoperto di essere una versione vecchia', () => {
  it('al prossimo avvio il remoto si applica, invece di essere sovrascritto', () => {
    setSynced('2026-10-07T09:00:00+00:00')
    markDirty()
    // Senza la dimenticanza: il locale sporco sopra un remoto "fermo" si terrebbe e spingerebbe.
    expect(decideInitialSync('2026-10-07T09:00:00+00:00', getSyncMeta())).toBe('keepLocalAndPush')
    dimenticaUltimoSync()
    expect(decideInitialSync('2026-10-07T09:00:00+00:00', getSyncMeta())).toBe('applyRemoteConflict')
  })
})

describe('il nome sulla porta', () => {
  it('si scrive, si legge, si toglie', () => {
    expect(proprietario()).toBeNull()
    segnaProprietario('utente-a')
    expect(proprietario()).toBe('utente-a')
    segnaProprietario(null)
    expect(proprietario()).toBeNull()
  })
})

// La sessione letta dal telefono senza chiedere niente alla rete: serve ad
// aprire l'app nel seminterrato anche con l'accesso scaduto.
describe('la sessione salvata sul telefono', () => {
  it('si legge anche scaduta', () => {
    localStorage.setItem(storageKey, JSON.stringify({ access_token: 'x', refresh_token: 'y', expires_at: 1, user: { id: 'utente-a' } }))
    expect(sessioneSuDisco()?.user.id).toBe('utente-a')
    expect(idUtenteSuDisco()).toBe('utente-a')
  })

  it('niente sessione, o illeggibile: nessuno è entrato', () => {
    expect(sessioneSuDisco()).toBeNull()
    localStorage.setItem(storageKey, '{non json')
    expect(sessioneSuDisco()).toBeNull()
    localStorage.setItem(storageKey, JSON.stringify({ access_token: 'x' }))
    expect(idUtenteSuDisco()).toBeNull()
  })
})
