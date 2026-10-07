import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { decideInitialSync, getSyncMeta, markDirty, setSynced, clearSyncMeta, resetSyncMeta, segnaInViaggio, confermaRemoto, stessoIstante, type SyncMeta } from '@/lib/syncMeta'

const meta = (o: Partial<SyncMeta> = {}): SyncMeta => ({ lastSyncedAt: null, dirty: false, noti: null, inViaggio: null, ...o })

describe('decideInitialSync', () => {
  it('applica il remoto quando non ci sono modifiche locali pendenti', () => {
    expect(decideInitialSync('2026-08-19T10:00:00Z', meta({ lastSyncedAt: '2026-08-18T10:00:00Z' })))
      .toBe('applyRemote')
  })

  it('tiene il locale quando è sporco e il remoto è fermo dove l\'avevo lasciato', () => {
    expect(decideInitialSync('2026-08-18T10:00:00Z', meta({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true })))
      .toBe('keepLocalAndPush')
  })

  it('parità di timestamp = remoto NON più recente, quindi vince il locale', () => {
    const t = '2026-08-18T10:00:00.000Z'
    expect(decideInitialSync(t, meta({ lastSyncedAt: t, dirty: true }))).toBe('keepLocalAndPush')
  })

  it('segnala il conflitto quando è sporco ma un altro dispositivo ha scritto dopo', () => {
    expect(decideInitialSync('2026-08-19T10:00:00Z', meta({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true })))
      .toBe('applyRemoteConflict')
  })

  it('un orario remoto PIÙ VECCHIO ma diverso è comunque un altro dispositivo', () => {
    // Orologio del telefono indietro: scrive un orario precedente a quello noto.
    // Trattarlo come "nessuno ha scritto" farebbe sovrascrivere quel salvataggio.
    expect(decideInitialSync('2026-08-18T09:59:00Z', meta({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true })))
      .toBe('applyRemoteConflict')
  })

  it('sporco senza alcun sync noto: qualunque remoto esistente è un conflitto', () => {
    expect(decideInitialSync('2026-08-19T10:00:00Z', meta({ dirty: true }))).toBe('applyRemoteConflict')
  })

  it('sporco e nessun remoto: non c\'è niente da applicare, si spinge il locale', () => {
    expect(decideInitialSync(null, meta({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true })))
      .toBe('keepLocalAndPush')
  })

  it('meta assente (primo avvio): comportamento storico, vince il remoto', () => {
    expect(decideInitialSync('2026-08-19T10:00:00Z', getSyncMeta())).toBe('applyRemote')
  })
})

describe('persistenza della meta', () => {
  // `resetSyncMeta` butta la copia in memoria: senza, ogni test erediterebbe lo
  // stato del precedente, perché la memoria sopravvive a `localStorage.clear()`.
  // Ed è esattamente il punto — vedi il blocco qui sotto.
  beforeEach(() => { localStorage.clear(); resetSyncMeta() })

  it('parte vuota e non sporca', () => {
    expect(getSyncMeta()).toEqual({ lastSyncedAt: null, dirty: false, noti: null, inViaggio: null })
  })

  it('markDirty sporca senza perdere lastSyncedAt', () => {
    setSynced('2026-08-18T10:00:00Z')
    markDirty()
    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true, noti: null, inViaggio: null })
  })

  it('setSynced azzera il dirty', () => {
    markDirty()
    setSynced('2026-08-19T10:00:00Z')
    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-08-19T10:00:00Z', dirty: false, noti: null, inViaggio: null })
  })

  it('setSynced ricorda gli id noti, e un sync senza id tiene quelli di prima', () => {
    setSynced('2026-08-19T10:00:00Z', { schede: ['s1'], esercizi: ['p1'] })
    markDirty()
    setSynced('2026-08-20T10:00:00Z')
    expect(getSyncMeta().noti).toEqual({ schede: ['s1'], esercizi: ['p1'] })
  })

  it('sopravvive a un contenuto illeggibile in localStorage', () => {
    localStorage.setItem('jarvis-sync-meta-v1', '{non json')
    expect(getSyncMeta()).toEqual({ lastSyncedAt: null, dirty: false, noti: null, inViaggio: null })
  })

  it('il logout non lascia le meta dell’account precedente', () => {
    setSynced('2026-08-19T10:00:00Z', { schede: ['s1'], esercizi: ['p1'] })
    markDirty()
    clearSyncMeta()
    expect(getSyncMeta()).toEqual({ lastSyncedAt: null, dirty: false, noti: null, inViaggio: null })
    expect(localStorage.getItem('jarvis-sync-meta-v1')).toBeNull()
  })
})

// ── Il caso che rende il flag affidabile ───────────────────────
// Con lo storage negato o pieno, `dirty` deve restare vero lo stesso: se si
// perde, `performSave` esce alla prima riga e NIENTE arriva più in cloud, senza
// un errore a dirlo. È il guasto peggiore possibile per un'app che esiste per
// conservare un dato, ed è silenzioso.
describe('localStorage rotto o pieno', () => {
  // Si sostituisce su `Storage.prototype`, non su `localStorage`: in jsdom (come
  // nei browser) `localStorage` è un Proxy che tratta ogni assegnazione come una
  // VOCE da salvare, quindi `localStorage.setItem = fn` non sostituisce il metodo
  // — scrive una chiave che si chiama "setItem", e il metodo vero continua a
  // funzionare. Un test scritto così passa sempre e non prova niente.
  const vero = { getItem: Storage.prototype.getItem, setItem: Storage.prototype.setItem }

  beforeEach(() => { localStorage.clear(); resetSyncMeta() })
  afterEach(() => {
    Storage.prototype.getItem = vero.getItem
    Storage.prototype.setItem = vero.setItem
  })

  const rompiScrittura = () => {
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') }
  }

  it('markDirty regge anche se la scrittura fallisce', () => {
    rompiScrittura()
    markDirty()
    expect(getSyncMeta().dirty, 'il dirty è andato perso: nessun salvataggio partirebbe più').toBe(true)
  })

  it('anche con lo storage muto in lettura E scrittura', () => {
    Storage.prototype.getItem = () => { throw new DOMException('SecurityError') }
    rompiScrittura()
    markDirty()
    expect(getSyncMeta().dirty).toBe(true)
  })

  it('setSynced pulisce il dirty anche senza storage', () => {
    rompiScrittura()
    markDirty()
    setSynced('2026-08-19T10:00:00Z')
    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-08-19T10:00:00Z', dirty: false, noti: null, inViaggio: null })
  })

  it('una scrittura fallita non fa risorgere il valore vecchio dal disco', () => {
    // Il disco contiene ancora `dirty: false` dal sync precedente. Se la lettura
    // tornasse a fidarsi di lui, la modifica appena fatta sparirebbe.
    setSynced('2026-08-18T10:00:00Z')
    rompiScrittura()
    markDirty()
    expect(getSyncMeta().dirty).toBe(true)
    expect(JSON.parse(localStorage.getItem('jarvis-sync-meta-v1') ?? '{}').dirty,
      'il disco è rimasto indietro, ed è normale').toBe(false)
  })
})

// Un salvataggio può arrivare al server senza che ne torni la risposta: poco
// segnale, l'app sospesa un attimo dopo. Al giro dopo il remoto ha un orario
// "nuovo" — che è il nostro. Riconoscerlo evita di trattare da conflitto con un
// altro dispositivo la propria scrittura.
describe('il salvataggio rimasto senza risposta', () => {
  beforeEach(() => { localStorage.clear(); resetSyncMeta() })

  it('due orari scritti in modo diverso sono lo stesso istante', () => {
    expect(stessoIstante('2026-10-07T10:00:00.123Z', '2026-10-07T10:00:00.123+00:00')).toBe(true)
    expect(stessoIstante('2026-10-07T10:00:00.123Z', '2026-10-07T10:00:00.124Z')).toBe(false)
    expect(stessoIstante(null, '2026-10-07T10:00:00Z')).toBe(false)
  })

  it('l’orario in viaggio si ricorda, e un salvataggio riuscito lo cancella', () => {
    markDirty()
    segnaInViaggio('2026-10-07T10:00:00.000Z')
    expect(getSyncMeta()).toMatchObject({ dirty: true, inViaggio: '2026-10-07T10:00:00.000Z' })
    setSynced('2026-10-07T10:00:00+00:00')
    expect(getSyncMeta().inViaggio).toBeNull()
  })

  it('riconosciuta la propria scrittura si aggiorna cosa si sa del remoto, senza dirsi puliti', () => {
    setSynced('2026-10-07T09:00:00+00:00')
    markDirty()
    segnaInViaggio('2026-10-07T10:00:00.000Z')
    confermaRemoto('2026-10-07T10:00:00+00:00')
    // Da allora qui può essere cambiato altro: resta da mandare.
    expect(getSyncMeta()).toMatchObject({ lastSyncedAt: '2026-10-07T10:00:00+00:00', dirty: true, inViaggio: null })
  })

  it('all’avvio: il remoto è la nostra scrittura di prima, non un altro dispositivo', () => {
    const m = meta({ dirty: true, lastSyncedAt: '2026-10-07T09:00:00+00:00', inViaggio: '2026-10-07T10:00:00.000Z' })
    expect(decideInitialSync('2026-10-07T10:00:00+00:00', m)).toBe('keepLocalAndPush')
    // Se invece dopo di noi ha scritto qualcun altro, il conflitto c'è.
    expect(decideInitialSync('2026-10-07T11:00:00+00:00', m)).toBe('applyRemoteConflict')
  })
})
