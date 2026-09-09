import { describe, it, expect, beforeEach } from 'vitest'
import { decideInitialSync, getSyncMeta, markDirty, setSynced, type SyncMeta } from '@/lib/syncMeta'

const meta = (o: Partial<SyncMeta> = {}): SyncMeta => ({ lastSyncedAt: null, dirty: false, ...o })

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
  beforeEach(() => localStorage.clear())

  it('parte vuota e non sporca', () => {
    expect(getSyncMeta()).toEqual({ lastSyncedAt: null, dirty: false })
  })

  it('markDirty sporca senza perdere lastSyncedAt', () => {
    setSynced('2026-08-18T10:00:00Z')
    markDirty()
    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-08-18T10:00:00Z', dirty: true })
  })

  it('setSynced azzera il dirty', () => {
    markDirty()
    setSynced('2026-08-19T10:00:00Z')
    expect(getSyncMeta()).toEqual({ lastSyncedAt: '2026-08-19T10:00:00Z', dirty: false })
  })

  it('sopravvive a un contenuto illeggibile in localStorage', () => {
    localStorage.setItem('jarvis-sync-meta-v1', '{non json')
    expect(getSyncMeta()).toEqual({ lastSyncedAt: null, dirty: false })
  })
})
