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
// ── Perché qui non ci sono immagini ─────────────────────────────
// C'è stato un giro in cui ognuno di questi esercizi aveva la sua foto, presa da
// yuhonas/free-exercise-db (Unlicense, quindi utilizzabile: quella parte non era
// il problema). È stato tolto per una ragione che si vede solo a lavoro fatto:
// trentasette foto coprono trentasette esercizi, e la lista di chi usa l'app
// cresce oltre. Il risultato è una griglia metà fotografica e metà disegnata, e
// ogni esercizio nuovo obbliga a cercare una foto nello stesso stile — un lavoro
// che non finisce e che intanto lascia la schermata sbilenca.
//
// La griglia è rimasta pronta: la card ha già la fascia in alto dove l'immagine
// andrebbe, e oggi la riempie il disegno del gruppo muscolare. Se un domani si
// trova una fonte che copre TUTTO (o si generano illustrazioni proprie, coerenti
// per costruzione), si riempie quella fascia e il resto non si tocca.

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
