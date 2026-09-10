import { describe, it, expect } from 'vitest'
import { CATALOGO, esercizidaCatalogo } from '@/features/gym/catalogo'
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
