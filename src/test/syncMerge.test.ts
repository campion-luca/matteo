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

// L'altro caso, più doloroso: il telefono rimasto indietro finisce una scheda, e
// l'allenamento appena salvato spariva perché il computer aveva scritto dopo.
describe('recupero delle alzate nate in locale', () => {
  const alz = (date: string, kg: number) => ({ d: 'W', date, kg, reps: 8, sets_n: 3 })
  const conStorico = (id: string, storico: ReturnType<typeof alz>[]): PalestraExercise =>
    ({ ...esercizio(id), history: storico, current: storico.length ? { kg: storico[storico.length - 1].kg, reps: 8, sets_n: 3 } : { kg: 0, reps: 0, sets_n: 0 } })
  const palestra = (...es: PalestraExercise[]) => ({ gymSchede: [], palestraExercises: es })

  it('l’allenamento fatto qui si aggiunge a quello che ha scritto l’altro dispositivo', () => {
    const base = palestra(conStorico('panca', [alz('2026-09-20', 60)]))
    // Il computer ha registrato il 22; il telefono, rimasto alla base, il 24.
    const remoto = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-22', 62.5)]))
    const locale = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-24', 65)]))
    const r = recuperaCreatiInLocale(locale, remoto, idsNoti(base))
    const panca = r?.palestraExercises[0]
    expect(panca?.history.map(h => h.date)).toEqual(['2026-09-20', '2026-09-22', '2026-09-24'])
    // "L'ultima volta" è l'alzata più recente, cioè quella appena recuperata.
    expect(panca?.current.kg).toBe(65)
  })

  it('un’alzata cancellata altrove non torna', () => {
    const base = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-22', 62.5)]))
    const remoto = palestra(conStorico('panca', [alz('2026-09-20', 60)]))
    expect(recuperaCreatiInLocale(base, remoto, idsNoti(base))).toBeNull()
  })

  it('la stessa giornata corretta sui due dispositivi resta una, quella remota', () => {
    const base = palestra(conStorico('panca', [alz('2026-09-20', 60)]))
    const remoto = palestra(conStorico('panca', [alz('2026-09-20', 62.5)]))
    const locale = palestra(conStorico('panca', [alz('2026-09-20', 65)]))
    expect(recuperaCreatiInLocale(locale, remoto, idsNoti(base))).toBeNull()
  })

  it('un’alzata con data arretrata non diventa "l’ultima volta"', () => {
    const base = palestra(conStorico('panca', [alz('2026-09-20', 60)]))
    const remoto = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-25', 70)]))
    const locale = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-10', 50)]))
    const panca = recuperaCreatiInLocale(locale, remoto, idsNoti(base))?.palestraExercises[0]
    expect(panca?.history).toHaveLength(3)
    expect(panca?.current.kg).toBe(70)
  })

  it('non tocca gli esercizi che sul remoto non ci sono più', () => {
    const base = palestra(conStorico('panca', [alz('2026-09-20', 60)]))
    const locale = palestra(conStorico('panca', [alz('2026-09-20', 60), alz('2026-09-24', 65)]))
    // L'esercizio è stato eliminato altrove: resta eliminato, alzate comprese.
    expect(recuperaCreatiInLocale(locale, palestra(), idsNoti(base))).toBeNull()
  })
})
