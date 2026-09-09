import { describe, it, expect, beforeEach } from 'vitest'
import { useJarvisStore, EMPTY_STATE, applyRemoteState, JARVIS_STORE_KEY } from '@/store/useJarvisStore'
import type { JarvisState } from '@/store/useJarvisStore'

const get = useJarvisStore.getState

// Lo stato che arriva dal cloud (o dal localStorage di una versione precedente)
// passa da un filtro a lista chiusa. Due rischi opposti da tenere fermi:
//  - una chiave dimenticata nella lista = un'impostazione dell'utente che sparisce
//    in silenzio al primo login;
//  - nessun filtro = i campi delle schede rimosse rientrano e vengono risalvati
//    per sempre.
describe('filtro delle chiavi di stato', () => {
  beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))

  it('non perde nessun campo dichiarato in JarvisState', () => {
    // Un valore riconoscibile per ogni chiave: se il filtro ne scarta una,
    // qui manca e il test dice esattamente quale.
    const remote = {
      userName: 'Luca', lang: 'de', userAge: 31, userSex: 'F', userWeight: 78, userHeight: 168, userDob: '1995-03-02',
      darkMode: true, layout: 'notte', navPos: 'destra', accentColor: 'rose', customAccentHex: '#abcdef',
      hyroxExercises: [], palestraExercises: [], muscleColors: { Petto: '#111111' },
      gymSchede: [], budget: { salary: 2000, fixed: [], variable: [], big: [] },
      weightLog: [{ date: '2026-08-01', kg: 78 }],
      onboardingSeen: ['hint:gym'],
    } as unknown as Partial<JarvisState>

    applyRemoteState(remote)
    const after = get() as unknown as Record<string, unknown>
    const persi = Object.keys(remote).filter(k => after[k] === undefined)
    expect(persi).toEqual([])
    expect(get().userName).toBe('Luca')
    expect(get().darkMode).toBe(true)
    expect(get().layout).toBe('notte')
    // La lingua è una preferenza dell'utente, non del dispositivo: se il filtro
    // la scartasse, chi ha scelto il tedesco se lo ritroverebbe in italiano al
    // primo accesso da un altro telefono.
    expect(get().lang).toBe('de')
  })

  it('scarta i campi delle schede rimosse', () => {
    applyRemoteState({
      userName: 'Luca',
      events: [{ id: 'e1', title: 'Dentista', date: '2026-08-18', prio: 3 }],
      agendaCategories: [{ id: 'c1', name: 'Lavoro', color: '#2f7a6b' }],
      todos: { everyday: [{ id: 't1' }] },
      companies: [{ id: 1, name: 'ACME' }],
      readinessHistory: [{ date: '2026-08-18', score: 72 }],
      ciclo: { entries: [], cycleLength: 28, periodLength: 5 },
      hydration: { date: '2026-08-18', ml: 1200 },
      hydrationActivity: 'intensa',
      everydayResetOn: '2026-08-18',
    } as unknown as Partial<JarvisState>)

    const after = get() as unknown as Record<string, unknown>
    for (const k of ['events', 'agendaCategories', 'todos', 'companies', 'readinessHistory', 'ciclo', 'hydration', 'hydrationActivity', 'everydayResetOn']) {
      expect(after[k], `"${k}" è rientrato nello store`).toBeUndefined()
    }
    expect(get().userName).toBe('Luca')
  })

  // Il filtro lavora sul primo livello: questi due campi stanno più in basso e
  // servono due potature esplicite (vedi `migrateNested`).
  it('pota il RIR dalle voci di storico, senza toccare il resto dell’alzata', () => {
    applyRemoteState({
      palestraExercises: [{
        id: 'p1', n: 'Panca', muscle: 'Petto',
        current: { kg: 60, reps: 8, sets_n: 4 },
        history: [{ d: 'W1', date: '2026-08-18', kg: 60, reps: 8, sets_n: 4, rir: 2 }],
      }],
    } as unknown as Partial<JarvisState>)

    const h = get().palestraExercises[0].history[0] as unknown as Record<string, unknown>
    expect(h.rir, 'il RIR è rientrato nello storico').toBeUndefined()
    expect(h.kg).toBe(60)
    expect(h.reps).toBe(8)
  })

  it('recupera l’altezza da dov’era prima invece di perderla', () => {
    applyRemoteState({
      kcal: { goal: 'cut', weightLog: [], height: 178 },
    } as unknown as Partial<JarvisState>)

    expect(get().userHeight).toBe(178)
  })

  it('un’altezza già nel profilo non viene sovrascritta da quella vecchia', () => {
    applyRemoteState({
      userHeight: 180,
      kcal: { goal: 'cut', weightLog: [], height: 178 },
    } as unknown as Partial<JarvisState>)

    expect(get().userHeight).toBe(180)
  })

  it('le pesate escono da `kcal` invece di sparire con lui', () => {
    // `kcal` conteneva il calcolo calorico, che non c'è più. Le pesate però sono
    // il denominatore di tutta la forza relativa: se fossero rimaste lì dentro,
    // la lista chiusa avrebbe scartato il contenitore e portato via anche loro.
    applyRemoteState({
      kcal: { goal: 'cut', weightLog: [{ date: '2026-08-01', kg: 79 }] },
    } as unknown as Partial<JarvisState>)

    expect(get().weightLog).toEqual([{ date: '2026-08-01', kg: 79 }])
    expect((get() as unknown as Record<string, unknown>).kcal, '`kcal` è rientrato nello stato').toBeUndefined()
  })

  it('le pesate già al primo livello vincono su quelle vecchie', () => {
    applyRemoteState({
      weightLog: [{ date: '2026-09-01', kg: 78 }],
      kcal: { weightLog: [{ date: '2026-08-01', kg: 79 }] },
    } as unknown as Partial<JarvisState>)

    expect(get().weightLog).toEqual([{ date: '2026-09-01', kg: 78 }])
  })

  it('la chiave di persistenza è quella attesa', () => {
    // Il seed dei test in browser e la migrazione dei dati vecchi ci si appoggiano.
    expect(JARVIS_STORE_KEY).toBe('jarvis-store-v4')
  })
})
