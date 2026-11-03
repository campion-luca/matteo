// Le tabelle di forza: per ogni peso corporeo, quanti chili si alzano di norma.
//
// Da due studi su 1.466 persone misurate di persona, non su numeri dichiarati:
//   Piper, Furman, Smith, Waller. Establishing Normative Data for 10RM Strength
//   Scores in College-Aged Males. Int J Strength Cond. 2021;1(1).
//   doi.org/10.47206/ijsc.v1i1.40 (1.095 uomini)
//   Piper, Furman, Smith, Waller. Establishing Normative Data for 10RM Strength
//   Scores in College-Aged Females. Int J Strength Cond. 2022;2(1).
//   doi.org/10.47206/ijsc.v2i1.138 (371 donne)
// Entrambi sotto licenza Creative Commons Attribution 4.0
// (creativecommons.org/licenses/by/4.0/): si possono riusare anche in un'app a
// pagamento, a patto di citarli e di dire cosa si è cambiato. La citazione sta nei
// crediti in fondo alle impostazioni (vedi JarvisProfile).
//
// Cosa è stato cambiato: i numeri qui sotto sono quelli pubblicati, le tabelle
// "Post-Training" (dopo 12 settimane di allenamento), in libbre e a 10 ripetizioni
// massime. `soglieAlPeso` li porta a un massimale con la formula di Epley, gli
// stessi conti che l'app fa su ogni alzata. E non legge una classe di peso alla
// volta: per ogni percentile prende le otto classi insieme e ne ricava una curva
// forza–peso corporeo (vedi `curva`).
//
// Perché la curva (dal 3 novembre 2026). Le classi hanno poche persone — le
// donne sono 371 in otto classi — e i chili alzati vanno a scatti di 5 libbre:
// in alcune classi due percentili vicini uscivano uguali. Per le donne fra 52 e
// 61 kg alla lat machine il 20° e il 50° erano entrambi 80 libbre, cioè Argento
// alla stessa soglia di Bronzo, e non lo si poteva prendere mai. Una classe
// letta da sola dice anche il rumore del suo campione; la curva su tutte e otto
// tiene la tendenza e lascia il rumore. Dai numeri pubblicati si scosta in media
// del 2-9%, al massimo del 17% (la classe più leggera della pressa uomini, che
// salta da 225 a 315 libbre su quella dopo). In cambio, a ogni peso ogni
// percentile sta almeno il 6% sopra il precedente: ogni rank si può prendere.
//
// Le tabelle "Post" e non quelle di partenza perché chi usa l'app si allena, e
// perché gli autori dicono cosa misurano: da chi comincia a chi è a metà strada.
// Sono ragazzi e ragazze fra i 18 e i 25 anni: per chi ha molti più anni i numeri
// sono severi, e nessuno di questi studi dice di quanto.
//
// Sono cinque esercizi: tutti quelli che gli studi misurano.
export type AlzataTabella = 'panca' | 'lat' | 'lento' | 'curl' | 'pressa'

type Sesso = 'M' | 'F'

/** Il centro di ogni classe di peso degli studi, in libbre. Le due classi aperte
 *  ("meno di 135", "più di 270") hanno come centro il bordo, più metà della classe
 *  vicina. */
const CLASSI: Record<Sesso, readonly number[]> = {
  M: [127.5, 142.5, 157.5, 177.5, 200, 225, 255, 285],
  F: [105, 115, 125, 135, 147.5, 165, 187.5, 212.5],
}

/** Per ogni esercizio i percentili 20, 50, 80 e 95, una colonna per classe di peso:
 *  libbre alzate per 10 ripetizioni, come nelle tabelle pubblicate. */
const TABELLE: Record<Sesso, Record<AlzataTabella, readonly (readonly number[])[]>> = {
  M: {
    // Panca piana
    panca: [
      [95, 115, 130, 135, 145, 145, 147, 155],
      [115, 125, 150, 160, 175, 185, 175, 195],
      [139, 150, 170, 185, 205, 225, 205, 225],
      [156, 166, 196.5, 225, 225, 239.5, 225, 295],
    ],
    // Lat machine
    lat: [
      [110, 120, 130, 130, 140, 140, 140, 150],
      [130, 130, 140, 150, 160, 160, 150, 170],
      [140, 148, 160, 170, 175, 180, 180, 190],
      [160, 160, 180, 184, 200, 220, 200, 220],
    ],
    // Lento avanti seduto
    lento: [
      [65, 75, 85, 95, 95, 100, 96.4, 115],
      [82.5, 95, 100, 115, 115, 115, 115, 135],
      [100, 105, 120, 125, 135, 145, 135, 155],
      [115, 125, 135, 151.25, 157, 165, 165, 193.25],
    ],
    // Curl su panca Scott
    curl: [
      [50, 55, 60, 65, 70, 70, 70, 70],
      [60, 70, 75, 80, 80, 80, 80, 95],
      [80, 80, 90, 90, 95, 95, 90, 110],
      [95, 90, 100, 110, 120, 110, 110, 120],
    ],
    // Leg press a 45°
    pressa: [
      [225, 315, 315, 369, 405, 408, 407, 503],
      [315, 365, 405, 425, 500, 520, 505, 590],
      [359, 405, 468, 505, 585, 590, 598, 705],
      [433, 508.5, 585, 605, 675.5, 696, 695, 817.75],
    ],
  },
  F: {
    // Panca piana
    panca: [
      [45, 55, 50, 60, 60, 60, 60, 65],
      [55, 60, 65, 65, 68.33, 70, 75, 75],
      [64, 73, 70, 75, 80, 85, 85, 94],
      [76, 80, 78, 89.75, 90, 105, 95, 105],
    ],
    // Lat machine
    lat: [
      [68, 80, 80, 72, 80, 90, 80, 90],
      [80, 80, 80, 80, 90, 90, 95, 100],
      [90, 85, 90, 93, 100, 100, 106, 120],
      [102, 100, 105, 109.5, 110, 110, 110, 130],
    ],
    // Lento avanti seduto
    lento: [
      [35, 45, 45, 45, 50, 45, 50, 55],
      [45, 47.5, 50, 50, 55, 55, 57.5, 65],
      [54, 55, 55, 55, 60, 65, 66, 65],
      [72, 70, 65, 65, 75, 75, 85, 94.5],
    ],
    // Curl su panca Scott
    curl: [
      [25, 30, 30, 30, 35, 35, 38, 40],
      [35, 35, 40, 40, 40, 45, 45, 45],
      [40, 42, 45, 45, 45, 50, 50, 54],
      [40.5, 50, 55, 50, 50, 55, 60, 65],
    ],
    // Leg press a 45°
    pressa: [
      [185, 239, 225, 245, 269, 285, 315, 315],
      [225, 300, 295, 295, 305, 350, 390, 405],
      [299, 335, 360, 347, 365, 417, 496, 558],
      [317, 443, 405, 455, 423, 538, 548, 855],
    ],
  },
}

const KG_PER_LIBBRA = 0.45359237
/** Epley a 10 ripetizioni: kg × (1 + 10/30). */
const DA_10RM_A_MASSIMALE = 4 / 3

/** La curva di un percentile: libbre alzate = a × peso^b, coi minimi quadrati
 *  sui logaritmi delle otto classi. È la forma con cui la forza cresce col
 *  corpo — la stessa idea della mappa della forza, che piega le soglie sul
 *  peso^⅔ — e qui l'esponente lo dicono i dati di ogni esercizio. */
function curva(valori: readonly number[], classi: readonly number[]): { a: number; b: number } {
  const lx = classi.map(Math.log), ly = valori.map(Math.log)
  const mx = lx.reduce((s, x) => s + x, 0) / lx.length
  const my = ly.reduce((s, y) => s + y, 0) / ly.length
  let sxy = 0, sxx = 0
  lx.forEach((x, i) => { sxy += (x - mx) * (ly[i] - my); sxx += (x - mx) ** 2 })
  const b = sxy / sxx
  return { a: Math.exp(my - b * mx), b }
}

// Le curve si calcolano una volta: i dati non cambiano.
const CURVE = Object.fromEntries((['M', 'F'] as const).map(s => [s, Object.fromEntries(
  (Object.keys(TABELLE[s]) as AlzataTabella[]).map(e => [e, TABELLE[s][e].map(riga => curva(riga, CLASSI[s]))]),
)])) as Record<Sesso, Record<AlzataTabella, { a: number; b: number }[]>>

/** I massimali in kg dei percentili 20, 50, 80 e 95 a questo peso corporeo. Sesso
 *  ignoto → la tabella maschile, che ha i numeri più alti: come in gymStrength.
 *  Oltre le classi estreme resta il valore del bordo: lì gli studi non dicono
 *  niente, e una curva allungata inventerebbe. */
export function soglieAlPeso(alzata: AlzataTabella, pesoKg: number, sex?: Sesso): number[] {
  const sesso = sex === 'F' ? 'F' : 'M'
  const classi = CLASSI[sesso]
  const libbre = Math.min(classi[classi.length - 1], Math.max(classi[0], pesoKg / KG_PER_LIBBRA))
  return CURVE[sesso][alzata].map(({ a, b }) => a * libbre ** b * KG_PER_LIBBRA * DA_10RM_A_MASSIMALE)
}
