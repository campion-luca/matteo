import { describe, it, expect } from 'vitest'
import { applicaCorrezioni, type Correzione } from '@/lib/correzioni'
import type { PalestraExercise, PalestraHistoryEntry } from '@/store/useJarvisStore'

// Una correzione sbagliata è peggio di nessuna: riscrive l'allenamento di un
// altro. I casi qui sotto sono quelli in cui si decide SE applicarla — l'alzata
// giusta, solo quella, e mai una che l'allievo nel frattempo ha rifatto a mano.

const alz = (date: string, kg: number, extra: Partial<PalestraHistoryEntry> = {}): PalestraHistoryEntry =>
  ({ d: 'W', date, kg, reps: 8, sets_n: 3, ...extra })

const panca = (history: PalestraHistoryEntry[]): PalestraExercise => ({
  id: 'panca', n: 'Panca piana', muscle: 'Petto',
  current: { kg: history[history.length - 1].kg, reps: 8, sets_n: 3 }, history,
})

let n = 0
const corr = (vecchia: PalestraHistoryEntry, nuova: PalestraHistoryEntry, exercise_id = 'panca'): Correzione => ({
  id: `c${++n}`, coach_id: 'coach', athlete_id: 'allievo', exercise_id, vecchia, nuova, coach_name: 'Luca', created_at: `2026-10-0${n}`,
})

describe('applicare le correzioni dell’allenatore', () => {
  it('corregge l’alzata indicata e lascia stare le altre', () => {
    const sbagliata = alz('2026-09-24', 80)
    const c = corr(sbagliata, { ...sbagliata, kg: 85, correttaDa: 'Luca' })
    const { esercizi, applicate } = applicaCorrezioni([panca([alz('2026-09-17', 77.5), sbagliata])], [c])
    expect(applicate).toEqual([c.id])
    expect(esercizi[0].history.map(h => h.kg)).toEqual([77.5, 85])
    expect(esercizi[0].history[1].correttaDa).toBe('Luca')
    // "L'ultima volta" segue l'alzata corretta: è da lì che si precompila.
    expect(esercizi[0].current.kg).toBe(85)
  })

  it('non tocca gli oggetti in ingresso', () => {
    const sbagliata = alz('2026-09-24', 80)
    const prima = [panca([sbagliata])]
    applicaCorrezioni(prima, [corr(sbagliata, { ...sbagliata, kg: 85 })])
    expect(prima[0].history[0].kg).toBe(80)
  })

  it('riconosce l’alzata anche se il database ha rimescolato le chiavi', () => {
    const sbagliata = alz('2026-09-24', 80, { setReps: [8, 8, 6], scheda: { id: 's', nome: 'Lunedì' } })
    // Come torna da un jsonb: stessi valori, chiavi in un altro ordine.
    const dalDb = JSON.parse(JSON.stringify({ scheda: { nome: 'Lunedì', id: 's' }, setReps: [8, 8, 6], sets_n: 3, reps: 8, kg: 80, date: '2026-09-24', d: 'W' }))
    const { applicate } = applicaCorrezioni([panca([sbagliata])], [corr(dalDb, { ...sbagliata, kg: 85 })])
    expect(applicate).toHaveLength(1)
  })

  it('due correzioni alla stessa alzata si applicano in fila', () => {
    const orig = alz('2026-09-24', 80)
    const a = { ...orig, kg: 85 }
    const b = { ...orig, kg: 85, reps: 10 }
    const { esercizi, applicate } = applicaCorrezioni([panca([orig])], [corr(orig, a), corr(a, b)])
    expect(applicate).toHaveLength(2)
    expect(esercizi[0].history[0]).toMatchObject({ kg: 85, reps: 10 })
  })

  it('se l’allievo l’ha riscritta a mano, la correzione non ha più un bersaglio', () => {
    const comeLaVedevaIlCoach = alz('2026-09-24', 80)
    const rifatta = alz('2026-09-24', 82.5)
    const c = corr(comeLaVedevaIlCoach, { ...comeLaVedevaIlCoach, kg: 85 })
    const stato = [panca([rifatta])]
    const esito = applicaCorrezioni(stato, [c])
    expect(esito.esercizi).toBe(stato)          // niente è cambiato
    expect(esito.applicate).toEqual([])
    expect(esito.perse).toEqual([c.id])
  })

  it('una correzione già applicata si riconosce, e non si riapplica', () => {
    const orig = alz('2026-09-24', 80)
    const nuova = { ...orig, kg: 85 }
    const c = corr(orig, nuova)
    const stato = [panca([nuova])]
    const esito = applicaCorrezioni(stato, [c])
    expect(esito.giaFatte).toEqual([c.id])
    expect(esito.esercizi).toBe(stato)
  })

  it('un esercizio che non c’è più: la correzione è persa, niente esplode', () => {
    const orig = alz('2026-09-24', 80)
    const c = corr(orig, { ...orig, kg: 85 }, 'eliminato')
    expect(applicaCorrezioni([panca([orig])], [c])).toMatchObject({ applicate: [], perse: [c.id] })
  })

  it('correggendo la data l’alzata cambia posto, e l’ultima resta la più recente', () => {
    const giusta = alz('2026-09-24', 80)
    const dataSbagliata = alz('2026-09-30', 60)
    const c = corr(dataSbagliata, { ...dataSbagliata, date: '2026-09-20' })
    const { esercizi } = applicaCorrezioni([panca([giusta, dataSbagliata])], [c])
    expect(esercizi[0].history.map(h => h.date)).toEqual(['2026-09-20', '2026-09-24'])
    expect(esercizi[0].current.kg).toBe(80)
  })

  it('senza correzioni restituisce gli stessi esercizi', () => {
    const stato = [panca([alz('2026-09-24', 80)])]
    expect(applicaCorrezioni(stato, []).esercizi).toBe(stato)
  })
})

// `nuova` arriva da un jsonb di cui il database non controlla la forma: una
// chiamata REST scritta a mano ci mette quello che vuole. Una data che non era un
// testo faceva esplodere l'ordinamento, e la correzione restava in tabella a
// riprovarci a ogni apertura; il resto finiva tale e quale nei dati dell'allievo.
describe('una correzione malformata', () => {
  const storta = (o: unknown) => o as PalestraHistoryEntry

  it('una data che non è un testo non fa esplodere niente: la correzione è persa', () => {
    const orig = alz('2026-09-24', 80)
    const c = corr(orig, storta({ ...orig, date: 42 }))
    const stato = [panca([alz('2026-09-17', 77.5), orig])]
    let esito: ReturnType<typeof applicaCorrezioni> | undefined
    expect(() => { esito = applicaCorrezioni(stato, [c]) }).not.toThrow()
    expect(esito?.perse).toEqual([c.id])
    expect(esito?.esercizi).toBe(stato)
  })

  it('chili scritti come testo, o un’alzata che non è un oggetto: perse, e le altre si applicano lo stesso', () => {
    const orig = alz('2026-09-24', 80)
    const testo = corr(orig, storta({ ...orig, kg: '85' }))
    const nulla = corr(orig, storta(null))
    const serie = corr(orig, storta({ ...orig, setWeights: ['80', 80] }))
    const buona = corr(orig, { ...orig, kg: 82.5 })
    const esito = applicaCorrezioni([panca([orig])], [testo, nulla, serie, buona])
    expect(esito.perse).toEqual([testo.id, nulla.id, serie.id])
    expect(esito.applicate).toEqual([buona.id])
    expect(esito.esercizi[0].history[0].kg).toBe(82.5)
  })

  it('le chiavi che un’alzata non ha non entrano nei dati dell’allievo', () => {
    const orig = alz('2026-09-24', 80)
    const c = corr(orig, storta({ ...orig, kg: 85, admin: true, html: '<img src=x>' }))
    const { esercizi, applicate } = applicaCorrezioni([panca([orig])], [c])
    expect(applicate).toEqual([c.id])
    expect(esercizi[0].history[0]).toEqual({ ...orig, kg: 85 })
  })

  it('nemmeno dentro `scheda` e `piano`', () => {
    const orig = alz('2026-09-24', 80)
    const c = corr(orig, storta({
      ...orig, kg: 85,
      scheda: { id: 'sc1', nome: 'Push', extra: 'x'.repeat(100) },
      piano: { sets: 3, reps: '8', riga: 'r1', junk: { grande: true } },
    }))
    const { esercizi } = applicaCorrezioni([panca([orig])], [c])
    expect(esercizi[0].history[0].scheda).toEqual({ id: 'sc1', nome: 'Push' })
    expect(esercizi[0].history[0].piano).toEqual({ sets: 3, reps: '8', riga: 'r1' })
  })

  it('una data storta già nello storico non blocca le correzioni alle altre alzate', () => {
    const orig = alz('2026-09-24', 80)
    const c = corr(orig, { ...orig, kg: 85 })
    const esito = applicaCorrezioni([panca([storta({ ...alz('', 70), date: 7 }), orig])], [c])
    expect(esito.applicate).toEqual([c.id])
  })
})
