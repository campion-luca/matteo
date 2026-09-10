import type { PalestraExercise } from '@/store/useJarvisStore'
import { uid } from '@/lib/uid'

// Il catalogo di partenza: gli esercizi che ci sono in qualunque palestra.
//
// Serve a non far trovare a chi apre l'app per la prima volta una lista vuota e
// otto gruppi muscolari da riempire a mano prima di poter registrare la prima
// alzata. Sono nomi e gruppo muscolare, niente di più: nessuno storico, nessun
// carico: quelli arrivano allenandosi.
//
// L'elenco è scritto a mano, ed è una lista di allenamento vera: quello che si fa
// davvero, sui macchinari che ci sono davvero. Chi ne vuole altri usa il "+", che
// è dove è sempre stato. Il primo dataset che avevamo guardato
// (hasaneyldrm/exercises-dataset) ne ha 1.324: un catalogo di partenza che ne
// propone mille non è un aiuto, è la stessa lista vuota con più rumore.
//
// I nomi con "al MPW" tengono dentro la marca del macchinario, e non è una svista.
// Una panca piana e una panca piana su un'altra macchina non si caricano uguale:
// chiamarle con lo stesso nome vorrebbe dire sommare in un unico storico due serie
// di numeri che non si possono confrontare, e leggere un progresso dove c'è solo un
// cambio di attrezzo. Il nome è anche ciò a cui si aggancia la foto (eserciziFoto.ts):
// una foto è la foto DI QUELLA macchina, non del gesto in generale.
//
// I massimali continuano a funzionare perché non cercano nomi esatti ma pezzi di
// nome (vedi BIG_LIFTS in gymMaxLifts.ts): "Panca piana al MPW" prende /panca/, e
// l'inclinata e la declinata restano fuori come prima.
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
  { n: 'Panca piana al MPW',                      muscle: 'Petto' },
  { n: 'Panca inclinata al MPW',                  muscle: 'Petto' },
  { n: 'Panca declinata al MPW',                  muscle: 'Petto' },
  { n: 'Croci ai cavi bassi',                     muscle: 'Petto' },
  { n: 'Croci ai cavi alti',                      muscle: 'Petto' },
  { n: 'Croci alla peck deck',                    muscle: 'Petto' },
  { n: 'Piegamenti',                              muscle: 'Petto' },

  // Dorso
  { n: 'Trazioni',                                muscle: 'Dorso' },
  { n: 'Stacco',                                  muscle: 'Dorso' },
  { n: 'Lat machine presa larga',                 muscle: 'Dorso' },
  { n: 'Rematore T-Bar presa larga',              muscle: 'Dorso' },
  { n: 'Rematore con manubri su panca inclinata', muscle: 'Dorso' },
  { n: 'Pulley basso presa stretta',              muscle: 'Dorso' },
  { n: 'Pullover al cavo alto',                   muscle: 'Dorso' },
  { n: 'Scrollate con manubri',                   muscle: 'Dorso' },

  // Spalle
  { n: 'Military press al MPW',                   muscle: 'Spalle' },
  { n: 'Alzate laterali con manubri',             muscle: 'Spalle' },
  { n: 'Alzate laterali al cavo',                 muscle: 'Spalle' },
  { n: 'Peck deck inversa',                       muscle: 'Spalle' },
  { n: 'Face pull',                               muscle: 'Spalle' },

  // Bicipiti
  { n: 'Curl manubri su panca inclinata',         muscle: 'Bicipiti' },
  { n: 'Curl bilanciere Z',                       muscle: 'Bicipiti' },
  { n: 'Curl panca Scott',                        muscle: 'Bicipiti' },
  { n: 'Curl a martello',                         muscle: 'Bicipiti' },

  // Tricipiti
  { n: 'Push down al cavo',                       muscle: 'Tricipiti' },
  { n: 'Estensioni overhead al cavo',             muscle: 'Tricipiti' },

  // Core
  { n: 'Sollevamenti gambe alla sbarra',          muscle: 'Core' },
  { n: 'Ab wheel',                                muscle: 'Core' },
  { n: 'Woodchopper ai cavi',                     muscle: 'Core' },
  { n: 'Pallof press al cavo',                    muscle: 'Core' },
  { n: 'Landmine press rotation',                 muscle: 'Core' },
  { n: 'Suitcase carry',                          muscle: 'Core' },

  // Gambe
  { n: 'Squat',                                   muscle: 'Gambe' },
  { n: 'Leg curl seduto',                         muscle: 'Gambe' },
  { n: 'Polpacci in piedi',                       muscle: 'Gambe' },
  { n: 'Polpacci seduto',                         muscle: 'Gambe' },

  // Glutei
  { n: "Abduzione dell'anca al cavo",             muscle: 'Glutei' },
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
