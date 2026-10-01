import { describe, it, expect, beforeEach } from 'vitest'
import { leggiSessione, salvaSessione, scartaSessione, sessioneAperta, copreAltra, type SerieInCorso } from '@/features/gym/sessioneInCorso'
import type { GymScheda } from '@/store/useJarvisStore'

// La sessione a metà è l'unico dato dell'app che non sta né nello store né in
// cloud: vive in localStorage finché l'allenamento non finisce. Quello che si
// verifica qui è che venga ripresa SOLO quando ha ancora senso riprenderla —
// ripresentare le spunte sbagliate significherebbe registrare un allenamento
// che non è stato fatto, che è peggio di perderlo.

const scheda = (esercizi: Array<{ id: string; sets: number }>): GymScheda => ({
  id: 'sc1',
  title: 'Push A',
  createdAt: '2026-09-01',
  updatedAt: '2026-09-01',
  exercises: esercizi.map(e => ({ id: e.id, name: 'Es ' + e.id, sets: e.sets, reps: '8' })),
})

const serie = (n: number, fatte = 0): SerieInCorso => ({
  checks: Array.from({ length: n }, (_, i) => i < fatte),
  weights: Array(n).fill('60'),
  reps: Array(n).fill('8'),
})

const PUSH = scheda([{ id: 'e1', sets: 4 }, { id: 'e2', sets: 3 }])
const mezzaSessione = { e1: serie(4, 2), e2: serie(3) }

beforeEach(() => localStorage.clear())

describe('sessione di allenamento in corso', () => {
  it('senza niente salvato non riprende nulla', () => {
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('riprende quello che era stato spuntato', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
  })

  it('non riprende la sessione di un’ALTRA scheda', () => {
    salvaSessione('sc-altra', mezzaSessione)
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('a fine allenamento la butta: i dati ora stanno nello storico', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    scartaSessione()
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('dopo dodici ore non è più "dove ero rimasto"', () => {
    const ieri = Date.now() - 13 * 60 * 60 * 1000
    salvaSessione(PUSH.id, mezzaSessione, ieri)
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('entro le dodici ore sì', () => {
    const prima = Date.now() - 2 * 60 * 60 * 1000
    salvaSessione(PUSH.id, mezzaSessione, prima)
    expect(leggiSessione(PUSH)).toEqual(mezzaSessione)
  })

  // ── Se la scheda cambia, la sessione non combacia più ─────────
  // Sono i casi che, senza controllo, darebbero spunte su serie inesistenti o
  // esercizi scomparsi: `progress[e.id]` undefined e `finishTraining` che legge
  // `.checks` su niente.
  it('scarta se un esercizio è stato tolto dalla scheda', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }]))).toBeNull()
  })

  it('scarta se un esercizio è stato aggiunto', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }, { id: 'e2', sets: 3 }, { id: 'e3', sets: 3 }]))).toBeNull()
  })

  it('scarta se il numero di serie è cambiato', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 5 }, { id: 'e2', sets: 3 }]))).toBeNull()
  })

  it('scarta se un esercizio è stato sostituito con un altro', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(leggiSessione(scheda([{ id: 'e1', sets: 4 }, { id: 'e9', sets: 3 }]))).toBeNull()
  })

  it('sopravvive a un contenuto illeggibile', () => {
    localStorage.setItem('jarvis-sessione-in-corso-v1', '{non json')
    expect(leggiSessione(PUSH)).toBeNull()
  })

  it('non esplode se lo storage è negato', () => {
    const vero = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') }
    expect(() => salvaSessione(PUSH.id, mezzaSessione)).not.toThrow()
    Storage.prototype.setItem = vero
  })

  // ── Riprendere da fuori ───────────────────────────────────────
  it('dice quale scheda ha un allenamento aperto, e a che punto è', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(sessioneAperta()).toEqual({ schedaId: 'sc1', fatte: 2, totali: 7 })
  })

  it('una sessione mai toccata non è un allenamento in corso', () => {
    salvaSessione(PUSH.id, { e1: serie(4), e2: serie(3) })
    expect(sessioneAperta()).toBeNull()
  })

  it('aprire un’altra scheda solo per guardarla non cancella quella cominciata', () => {
    salvaSessione(PUSH.id, mezzaSessione)
    expect(copreAltra('sc-altra', { x: serie(3) })).toBe(true)
    // Appena lì si spunta qualcosa, l'allenamento vero diventa quello.
    expect(copreAltra('sc-altra', { x: serie(3, 1) })).toBe(false)
    expect(copreAltra(PUSH.id, { e1: serie(4), e2: serie(3) })).toBe(false)
  })
})
