import { describe, it, expect } from 'vitest'
import { copiaPerAllievo, idSchedaCondivisa } from '@/lib/coach'
import type { GymScheda } from '@/store/useJarvisStore'

// Condividere una scheda con chi si allena con noi. Le cose che possono andare
// storte qui non danno errore: danno una scheda sparita a qualcuno, o un
// doppione, o un riferimento a un esercizio che nel suo archivio non esiste.

const scheda = (extra: Partial<GymScheda> = {}): GymScheda => ({
  id: 'sc-lunedi',
  title: 'Full A',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  exercises: [
    { id: 'r1', name: 'Panca piana al MPW', sets: 4, reps: '5-8', linkedExerciseId: 'px-mio-123', muscle: 'Petto' },
    { id: 'r2', name: 'Piegamenti', sets: 3, reps: 'max', muscle: 'Petto', supersetWithNext: true },
  ],
  ...extra,
})

const ORA = '2026-09-14T09:00:00.000Z'

describe('la copia che riceve l’allievo', () => {
  it('non riusa l’id della scheda originale', () => {
    // La riga in `coach_schede` ha l'id della scheda come chiave primaria:
    // riusarlo tale e quale metterebbe la copia in conflitto con l'originale.
    const copia = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    expect(copia.id).not.toBe('sc-lunedi')
  })

  it('dà id diversi a due allievi diversi', () => {
    // Il guasto che questo previene: condividendo la stessa scheda a due
    // persone, la seconda sovrascriverebbe la riga della prima — stessa chiave
    // primaria — e al primo la scheda sparirebbe senza che nessuno l'abbia
    // toccata, né lui né chi gliel'aveva mandata.
    const a = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    const b = copiaPerAllievo(scheda(), 'atleta-bbbb-2222', ORA)
    expect(a.id).not.toBe(b.id)
  })

  it('dà lo STESSO id ricondividendo alla stessa persona', () => {
    // Correggo un carico e rimando: deve aggiornare la sua, non affiancargliene
    // una seconda identica. Per questo l'id è derivato e non casuale.
    const prima = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    const dopo = copiaPerAllievo(
      scheda({ title: 'Full A (corretta)' }), 'atleta-aaaa-1111', '2026-10-01T09:00:00.000Z')
    expect(dopo.id).toBe(prima.id)
    expect(dopo.title).toBe('Full A (corretta)')
  })

  it('toglie i collegamenti agli esercizi del mio archivio', () => {
    // `linkedExerciseId` punta a un id che esiste solo da me: nel suo archivio
    // non significa niente, e lasciarlo è un riferimento rotto che sembra buono.
    const copia = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    expect(copia.exercises.every(e => e.linkedExerciseId === undefined)).toBe(true)
  })

  it('tiene tutto il resto della riga, superset compresi', () => {
    const copia = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    expect(copia.title).toBe('Full A')
    expect(copia.exercises).toHaveLength(2)
    expect(copia.exercises[0]).toMatchObject({ name: 'Panca piana al MPW', sets: 4, reps: '5-8', muscle: 'Petto' })
    expect(copia.exercises[1].supersetWithNext).toBe(true)
  })

  it('non porta con sé il contrassegno di bozza', () => {
    // Una bozza condivisa sarebbe invisibile: l'elenco delle schede assegnate
    // filtra via le bozze, quindi arriverebbe e non comparirebbe da nessuna
    // parte — il modo peggiore di fallire, perché sembra riuscito.
    const copia = copiaPerAllievo(scheda({ draft: true }), 'atleta-aaaa-1111', ORA)
    expect(copia.draft).toBeUndefined()
  })

  it('data di creazione al momento dell’invio, non quella mia', () => {
    const copia = copiaPerAllievo(scheda(), 'atleta-aaaa-1111', ORA)
    expect(copia.createdAt).toBe(ORA)
    expect(copia.updatedAt).toBe(ORA)
  })

  it('non modifica la scheda di partenza', () => {
    // La mia resta com'è: la copia è per lui, non uno spostamento.
    const mia = scheda()
    copiaPerAllievo(mia, 'atleta-aaaa-1111', ORA)
    expect(mia.id).toBe('sc-lunedi')
    expect(mia.exercises[0].linkedExerciseId).toBe('px-mio-123')
  })

  it('l’id derivato dipende da entrambe le parti', () => {
    expect(idSchedaCondivisa('sc-1', 'atleta-x')).toBe(idSchedaCondivisa('sc-1', 'atleta-x'))
    expect(idSchedaCondivisa('sc-1', 'atleta-x')).not.toBe(idSchedaCondivisa('sc-2', 'atleta-x'))
    expect(idSchedaCondivisa('sc-1', 'atleta-x')).not.toBe(idSchedaCondivisa('sc-1', 'atleta-y'))
  })
})
