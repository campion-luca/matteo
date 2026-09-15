import { describe, it, expect } from 'vitest'
import { recuperaCreatiInLocale, idsNoti } from '@/lib/syncMerge'
import type { GymScheda, PalestraExercise } from '@/store/useJarvisStore'

// Il caso da cui nasce: una scheda creata sul telefono sparisce perché, al
// momento di salvarla, il cloud risulta scritto da un altro dispositivo.
const scheda = (id: string): GymScheda => ({ id, title: id, exercises: [], createdAt: '2026-09-15', updatedAt: '2026-09-15' })
const esercizio = (id: string): PalestraExercise => ({ id, n: id, muscle: 'Petto', current: { kg: 0, reps: 0, sets_n: 0 }, history: [] })
const stato = (schede: string[], esercizi: string[] = []) => ({
  gymSchede: schede.map(scheda), palestraExercises: esercizi.map(esercizio),
})

describe('recupero di ciò che è nato in locale', () => {
  it('una scheda creata qui e non ancora salvata sopravvive al remoto più nuovo', () => {
    const noti = idsNoti(stato(['a']))
    const r = recuperaCreatiInLocale(stato(['a', 'nuova']), stato(['a']), noti)
    expect(r?.gymSchede.map(s => s.id)).toEqual(['a', 'nuova'])
  })

  it('una scheda cancellata altrove non torna', () => {
    // C'era all'ultimo sync, il remoto non l'ha più: l'ha tolta l'altro dispositivo.
    const noti = idsNoti(stato(['a', 'vecchia']))
    expect(recuperaCreatiInLocale(stato(['a', 'vecchia']), stato(['a']), noti)).toBeNull()
  })

  it('recupera anche gli esercizi creati salvando la scheda', () => {
    const noti = idsNoti(stato([], ['p1']))
    const r = recuperaCreatiInLocale(stato(['s'], ['p1', 'p2']), stato([], ['p1']), noti)
    expect(r?.palestraExercises.map(e => e.id)).toEqual(['p1', 'p2'])
    expect(r?.gymSchede.map(s => s.id)).toEqual(['s'])
  })

  it('senza memoria dell’ultimo sync tiene tutto ciò che il remoto non ha', () => {
    const r = recuperaCreatiInLocale(stato(['x']), stato([]), null)
    expect(r?.gymSchede.map(s => s.id)).toEqual(['x'])
  })

  it('niente da recuperare se il remoto ha già tutto', () => {
    expect(recuperaCreatiInLocale(stato(['a']), stato(['a', 'b']), idsNoti(stato(['a'])))).toBeNull()
  })
})
