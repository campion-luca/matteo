import { describe, it, expect, beforeEach } from 'vitest'
import { RESET_ID, chiaveScorta, serveAzzerare, serveSegnare, segnatura, azzeramento, salvaScorta, leggiScorta } from '@/features/gym/resetCatalogo'
import { CATALOGO } from '@/features/gym/catalogo'
import { EMPTY_STATE, useJarvisStore, applyRemoteState, type JarvisState, type PalestraExercise } from '@/store/useJarvisStore'

// Questo azzeramento cancella lo storico delle alzate di tutti gli account, una
// volta sola e senza chiedere. Le cose che devono reggere sono due: che avvenga
// davvero una volta sola, e che quello che cancella sia recuperabile.

const statoCon = (extra: Partial<JarvisState>): JarvisState => ({ ...EMPTY_STATE, ...extra })

// `d` è la data vera dello storico; `date` è il campo che certe voci vecchie
// portano ancora. Qui servono entrambi per restare fedeli a cosa c’è nei dati.
const esercizio = (n: string, alzate = 0): PalestraExercise => ({
  id: 'px-' + n, n, muscle: 'Petto',
  current: { kg: 100, reps: 5, sets_n: 3 },
  history: Array.from({ length: alzate }, (_, i) => ({
    d: `2026-0${(i % 9) + 1}-01`, kg: 100, reps: 5, sets_n: 3,
  })),
})

describe('azzeramento del catalogo', () => {
  beforeEach(() => localStorage.clear())

  // Un account coi dati del catalogo vecchio: alzate senza `date`, il formato
  // di prima.
  const vecchio = () => statoCon({ palestraExercises: [esercizio('Panca piana', 3)] })

  it('serve a chi ha dati del catalogo vecchio e non l’ha mai avuto', () => {
    expect(serveAzzerare(vecchio())).toBe(true)
  })

  it('non si ripete su chi l’ha già ricevuto', () => {
    // È ciò che impedisce all'app di azzerare di nuovo a ogni avvio, e al secondo
    // dispositivo di rifarlo sopra i dati appena rifatti sul primo.
    expect(serveAzzerare({ ...vecchio(), catalogoReset: RESET_ID })).toBe(false)
  })

  it('si ripete se l’azzeramento è un altro', () => {
    // Il marcatore è l'id dell'operazione, non un booleano "fatto": il giorno che
    // servisse un secondo azzeramento, cambiare la stringa deve bastare.
    expect(serveAzzerare({ ...vecchio(), catalogoReset: '2025-01-qualcosa-di-prima' })).toBe(true)
  })

  it('anche una scheda creata prima del catalogo nuovo conta come vecchia', () => {
    const s = statoCon({ gymSchede: [{ id: 'sc1', title: 'Lunedì', exercises: [], createdAt: '2026-08-30T10:00:00Z', updatedAt: 'x' }] })
    expect(serveAzzerare(s)).toBe(true)
  })

  // ── Chi non ha niente di vecchio ──────────────────────────────
  // Il caso che ha cancellato i dati di un account nuovo: primo caricamento
  // fallito, niente marcatore, schede e alzate create dopo — e al riavvio
  // l'azzeramento le toglieva. Chi è nato col catalogo nuovo si segna e basta.
  it('non azzera chi ha solo dati nati col catalogo nuovo', () => {
    const nuovo = statoCon({
      palestraExercises: [{ ...esercizio('Panca', 0), history: [{ d: 'W43', date: '2026-10-20', kg: 80, reps: 8, sets_n: 3 }] }],
      gymSchede: [{ id: 'sc1', title: 'Push A', exercises: [], createdAt: '2026-10-20', updatedAt: '2026-10-20' }],
    })
    expect(serveAzzerare(nuovo)).toBe(false)
    expect(serveSegnare(nuovo)).toBe(true)
    // Il marcatore, e la palestra com'è.
    const dopo = segnatura(nuovo)
    expect(dopo.catalogoReset).toBe(RESET_ID)
    expect(dopo.palestraExercises).toBe(nuovo.palestraExercises)
  })

  it('un account vuoto riceve il catalogo, senza azzeramento', () => {
    expect(serveAzzerare(statoCon({}))).toBe(false)
    expect(serveSegnare(statoCon({}))).toBe(true)
    expect(segnatura(statoCon({})).palestraExercises).toHaveLength(CATALOGO.length)
  })

  it('chi ha già il marcatore non si segna di nuovo', () => {
    expect(serveSegnare(statoCon({ catalogoReset: RESET_ID }))).toBe(false)
  })

  it('rimette il catalogo intero, pulito', () => {
    const dopo = azzeramento()
    expect(dopo.palestraExercises).toHaveLength(CATALOGO.length)
    expect(dopo.palestraExercises.every(e => e.history.length === 0)).toBe(true)
    expect(dopo.palestraExercises.every(e => e.current.kg === 0)).toBe(true)
    expect(dopo.gymSchede).toEqual([])
    expect(dopo.catalogoReset).toBe(RESET_ID)
  })

  it('tocca solo palestra e schede', () => {
    // Un azzeramento che si allargasse a pesate o dati personali sarebbe
    // un'altra operazione, e nessuno l'ha chiesta.
    expect(Object.keys(azzeramento()).sort()).toEqual(['catalogoReset', 'gymSchede', 'palestraExercises'])
  })

  it('mette da parte quello che cancella', () => {
    const prima = statoCon({
      palestraExercises: [esercizio('Panca piana', 12), esercizio('Squat', 30)],
      gymSchede: [{ id: 'sc1', title: 'Lunedì', exercises: [], createdAt: 'x', updatedAt: 'x' }],
    })
    expect(salvaScorta(prima, 'u1')).toBe(true)

    const scorta = JSON.parse(localStorage.getItem(chiaveScorta('u1'))!)
    expect(scorta.palestraExercises).toHaveLength(2)
    expect(scorta.palestraExercises[1].history).toHaveLength(30)
    expect(scorta.gymSchede).toHaveLength(1)
    expect(scorta.quando).toBeTruthy()
  })

  it('la scorta è di un account: un altro sullo stesso telefono non la sovrascrive', () => {
    salvaScorta(statoCon({ palestraExercises: [esercizio('Panca piana', 12)] }), 'anna')
    salvaScorta(statoCon({}), 'bruno')
    expect((leggiScorta('anna') as { palestraExercises: unknown[] }).palestraExercises).toHaveLength(1)
    expect(leggiScorta('carla')).toBeNull()
  })

  it('non impedisce l’azzeramento se la scorta non si può scrivere', () => {
    // Spazio finito, finestra anonima, storage negato: la scorta è una rete, non
    // una condizione. Deve però dire di aver fallito, perché cambia cosa si può
    // promettere a chi chiede indietro i suoi dati.
    const vero = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }
    try {
      expect(salvaScorta(statoCon({}), 'u1')).toBe(false)
    } finally {
      Storage.prototype.setItem = vero
    }
  })
})

// ── Il marcatore contro il blob remoto ─────────────────────────
describe('il marcatore segue il cloud', () => {
  beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))

  it('viene tolto se il blob remoto non ce l’ha', () => {
    // Il caso che questo previene: un dispositivo azzera ma non riesce a
    // spingere, poi riceve un blob salvato prima dell'azzeramento. Se il
    // marcatore sopravvivesse alla fusione, l'account tornerebbe agli esercizi
    // vecchi TENENDO il "già fatto" — e l'azzeramento non si ripeterebbe mai più.
    useJarvisStore.setState({ catalogoReset: RESET_ID })
    applyRemoteState({ palestraExercises: [esercizio('Panca piana', 4)] })
    expect(useJarvisStore.getState().catalogoReset).toBeUndefined()
    expect(serveAzzerare(useJarvisStore.getState())).toBe(true)
  })

  it('resta se il blob remoto ce l’ha', () => {
    useJarvisStore.setState({ catalogoReset: undefined })
    applyRemoteState({ palestraExercises: [], catalogoReset: RESET_ID })
    expect(useJarvisStore.getState().catalogoReset).toBe(RESET_ID)
    expect(serveAzzerare(useJarvisStore.getState())).toBe(false)
  })
})
