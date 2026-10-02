import { describe, it, expect } from 'vitest'
import { CATALOGO, esercizidaCatalogo, corpoLibero, quotaCorpo, aColpi, conSegnoCorpoLibero } from '@/features/gym/catalogo'
import { MUSCLE_OPTIONS, displayMuscle } from '@/features/gym/gymModel'
import type { PalestraExercise } from '@/store/useJarvisStore'

// Il catalogo entra nello store di chi apre l'app per la prima volta: se un nome
// è duplicato o un gruppo muscolare è scritto male, il danno lo si trova già
// dentro i dati dell'utente invece che in una lista da correggere.

const ex = (n: string): PalestraExercise => ({
  id: `px-${n}`, n, muscle: 'Petto', current: { kg: 0, reps: 0, sets_n: 0 }, history: [],
})

describe('catalogo di partenza', () => {
  it('non ha nomi ripetuti', () => {
    const nomi = CATALOGO.map(v => v.n.toLowerCase())
    expect(new Set(nomi).size).toBe(nomi.length)
  })

  it('usa solo gruppi muscolari che l’app conosce', () => {
    for (const v of CATALOGO) {
      expect(MUSCLE_OPTIONS, `"${v.n}" ha il gruppo "${v.muscle}"`).toContain(v.muscle)
      // displayMuscle è ciò che decide colore e icona: se normalizzasse a
      // qualcos'altro, l'esercizio finirebbe in un gruppo che non è il suo.
      expect(displayMuscle(v.muscle)).toBe(v.muscle)
    }
  })

  it('copre tutti i gruppi, così nessuno si apre vuoto', () => {
    for (const m of MUSCLE_OPTIONS) {
      if (m === 'Altro') continue   // è il ripiego dei gruppi legacy, non un distretto
      expect(CATALOGO.some(v => v.muscle === m), `nessun esercizio per ${m}`).toBe(true)
    }
  })

  it('parte senza storico: i carichi arrivano allenandosi', () => {
    const nuovi = esercizidaCatalogo([])
    expect(nuovi).toHaveLength(CATALOGO.length)
    expect(nuovi.every(e => e.history.length === 0 && e.current.kg === 0)).toBe(true)
    // Id distinti: due esercizi con lo stesso id si cancellerebbero a coppie.
    expect(new Set(nuovi.map(e => e.id)).size).toBe(nuovi.length)
  })

  it('non ricrea quello che c’è già, comunque sia stato scritto', () => {
    // Chi aveva scritto "panca piana al mpw" a mano non deve ritrovarsene due.
    const nuovi = esercizidaCatalogo([ex('  Panca Piana AL MPW '), ex('Squat')])
    const nomi = nuovi.map(e => e.n)
    expect(nomi).not.toContain('Panca piana al MPW')
    expect(nomi).not.toContain('Squat')
    expect(nuovi).toHaveLength(CATALOGO.length - 2)
  })
})

describe('corpo libero', () => {
  it('piegamenti e trazioni lo sono, anche negli esercizi già salvati senza il campo', () => {
    expect(corpoLibero(ex('Piegamenti'))).toBe(true)
    expect(corpoLibero(ex('trazioni '))).toBe(true)
    expect(corpoLibero(ex('Panca piana al MPW'))).toBe(false)
    const nuovi = esercizidaCatalogo([])
    expect(nuovi.find(e => e.n === 'Trazioni')?.bodyweight).toBe(true)
  })

  it('la scelta di chi ha creato l’esercizio vince sul catalogo', () => {
    expect(corpoLibero({ ...ex('Trazioni'), bodyweight: false })).toBe(false)
    expect(corpoLibero({ ...ex('Dip alle parallele'), bodyweight: true })).toBe(true)
  })
})

describe('quota di peso corporeo', () => {
  it('i piegamenti, comunque si chiamino, ne sollevano due terzi; il resto tutto', () => {
    expect(quotaCorpo(ex('Piegamenti'))).toBe(0.65)
    expect(quotaCorpo(ex('Piegamenti presa stretta'))).toBe(0.65)
    expect(quotaCorpo(ex('Push-up'))).toBe(0.65)
    expect(quotaCorpo(ex('Trazioni'))).toBe(1)
    expect(quotaCorpo(ex('Dip alle parallele'))).toBe(1)
  })
})

// Addominali e polpacci: a corpo libero, e il corpo non è un carico da contare.
describe('esercizi che non vanno a chili', () => {
  it('sollevamenti delle gambe, ab wheel e polpacci in piedi sono a corpo libero e a colpi', () => {
    for (const n of ['Sollevamenti gambe alla sbarra', 'Ab wheel', 'Polpacci in piedi']) {
      expect(corpoLibero(ex(n)), n).toBe(true)
      expect(quotaCorpo(ex(n)), n).toBe(0)
      expect(aColpi(ex(n)), n).toBe(true)
    }
  })

  it('trazioni e piegamenti restano a chili; la macchina dei polpacci non è a corpo libero', () => {
    expect(aColpi(ex('Trazioni'))).toBe(false)
    expect(aColpi(ex('Piegamenti'))).toBe(false)
    expect(aColpi(ex('Polpacci seduto'))).toBe(false)
    expect(corpoLibero(ex('Polpacci seduto'))).toBe(false)
  })

  it('chi li ha voluti con attrezzo li tiene a chili', () => {
    expect(aColpi({ ...ex('Polpacci in piedi'), bodyweight: false })).toBe(false)
  })

  it('le vecchie alzate a 0 kg prendono il segno; quelle con dei chili restano come sono', () => {
    const storico: PalestraExercise['history'] = [
      { d: 'W', date: '2026-09-10', kg: 0, reps: 15, sets_n: 3 },
      { d: 'W', date: '2026-09-17', kg: 20, reps: 15, sets_n: 3 },
    ]
    const polpacci = conSegnoCorpoLibero({ ...ex('Polpacci in piedi'), history: storico })
    expect(polpacci.history.map(h => h.bodyweight)).toEqual([true, undefined])
    // Un esercizio con attrezzo non si tocca: resta lo stesso oggetto.
    const panca = { ...ex('Panca piana'), history: storico }
    expect(conSegnoCorpoLibero(panca)).toBe(panca)
  })
})
