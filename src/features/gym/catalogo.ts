import type { PalestraExercise } from '@/store/useJarvisStore'
import { uid } from '@/lib/uid'

// Il catalogo di partenza: gli esercizi che ci sono in qualunque palestra.
//
// Serve a non far trovare a chi apre l'app per la prima volta una lista vuota e
// otto gruppi muscolari da riempire a mano prima di poter registrare la prima
// alzata. Sono nomi e gruppo muscolare, niente di più: nessuno storico, nessun
// carico: quelli arrivano allenandosi.
//
// L'elenco è scritto a mano: due o tre fondamentali per gruppo più le varianti che
// si trovano davvero in sala. Chi ne vuole altri usa il "+", che è dove è sempre
// stato. Il primo dataset che avevamo guardato (hasaneyldrm/exercises-dataset) ne
// ha 1.324: un catalogo di partenza che ne propone mille non è un aiuto, è la
// stessa lista vuota con più rumore.
//
// ── Dove sono finite le immagini ────────────────────────────────
// Le foto non stanno in questa lista: stanno in src/assets/esercizi, un file per
// esercizio chiamato come l'esercizio, e a cercarle è eserciziFoto.ts. Qui restano
// nomi e gruppo muscolare, come è sempre stato.
//
// Non sono un campo di `Voce` perché la stessa foto deve arrivare anche a chi il
// nome se l'è scritto a mano: legandola alla voce del catalogo coprirebbe solo
// quelli di partenza, e sarebbe un'informazione in più da tenere allineata.
//
// Il primo giro di foto — yuhonas/free-exercise-db, Unlicense, la licenza non era
// il problema — era stato tolto per una ragione che si vede solo a lavoro fatto:
// trentasette foto coprivano trentasette esercizi mentre la lista di chi usa l'app
// cresce oltre, e la griglia restava metà fotografica e metà disegnata senza una
// regola visibile. Foto scattate nella palestra vera cambiano il conto: coprono
// TUTTO il catalogo di partenza, e il disegno del gruppo muscolare resta solo
// dove vuol dire qualcosa — "questo esercizio te lo sei aggiunto tu".

interface Voce { n: string; muscle: string }

export const CATALOGO: Voce[] = [
  // Petto
  { n: 'Panca piana',            muscle: 'Petto' },
  { n: 'Panca inclinata',        muscle: 'Petto' },
  { n: 'Croci ai cavi',          muscle: 'Petto' },
  { n: 'Chest press',            muscle: 'Petto' },
  { n: 'Piegamenti',             muscle: 'Petto' },

  // Dorso
  { n: 'Trazioni alla sbarra',   muscle: 'Dorso' },
  { n: 'Lat machine',            muscle: 'Dorso' },
  { n: 'Rematore con bilanciere', muscle: 'Dorso' },
  { n: 'Pulley basso',           muscle: 'Dorso' },
  { n: 'Stacco da terra',        muscle: 'Dorso' },

  // Spalle
  { n: 'Lento avanti',           muscle: 'Spalle' },
  { n: 'Alzate laterali',        muscle: 'Spalle' },
  { n: 'Alzate posteriori',      muscle: 'Spalle' },
  { n: 'Tirate al mento',        muscle: 'Spalle' },

  // Bicipiti
  { n: 'Curl con bilanciere',    muscle: 'Bicipiti' },
  { n: 'Curl con manubri',       muscle: 'Bicipiti' },
  { n: 'Curl a martello',        muscle: 'Bicipiti' },
  { n: 'Panca Scott',            muscle: 'Bicipiti' },

  // Tricipiti
  { n: 'French press',           muscle: 'Tricipiti' },
  { n: 'Push down ai cavi',      muscle: 'Tricipiti' },
  { n: 'Dip alle parallele',     muscle: 'Tricipiti' },
  { n: 'Panca stretta',          muscle: 'Tricipiti' },

  // Core
  { n: 'Crunch',                 muscle: 'Core' },
  { n: 'Plank',                  muscle: 'Core' },
  { n: 'Leg raise',              muscle: 'Core' },
  { n: 'Russian twist',          muscle: 'Core' },

  // Gambe
  { n: 'Squat',                  muscle: 'Gambe' },
  { n: 'Pressa',                 muscle: 'Gambe' },
  { n: 'Affondi',                muscle: 'Gambe' },
  { n: 'Leg extension',          muscle: 'Gambe' },
  { n: 'Leg curl',               muscle: 'Gambe' },
  { n: 'Calf raise',             muscle: 'Gambe' },
  { n: 'Front squat',            muscle: 'Gambe' },

  // Glutei
  { n: 'Hip thrust',             muscle: 'Glutei' },
  { n: 'Stacco rumeno',          muscle: 'Glutei' },
  { n: 'Glute bridge',           muscle: 'Glutei' },
  { n: 'Abduzioni ai cavi',      muscle: 'Glutei' },
]

/** Il catalogo come esercizi veri, pronti da mettere nello store.
 *
 *  Salta quelli che ci sono già, confrontando i nomi senza badare a maiuscole e
 *  spazi: chi aveva scritto "panca piana" a mano non deve ritrovarsene due. */
export function esercizidaCatalogo(esistenti: PalestraExercise[]): PalestraExercise[] {
  const gia = new Set(esistenti.map(e => e.n.trim().toLowerCase()))
  return CATALOGO
    .filter(v => !gia.has(v.n.trim().toLowerCase()))
    .map(v => ({
      id: uid('px'),
      n: v.n,
      muscle: v.muscle,
      current: { kg: 0, reps: 0, sets_n: 0 },
      history: [],
    }))
}
