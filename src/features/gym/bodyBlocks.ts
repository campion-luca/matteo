// La figura del corpo, in un posto solo.
//
// La usano la Mappa della forza (BodyMap, grande, con i distretti colorati per
// quanto sei forte) e le icone dei gruppi muscolari (MuscleIcons, con un distretto
// acceso). Erano due copie delle stesse coordinate: cambiare la sagoma voleva dire
// cambiarla due volte, e le due figure erano già scivolate l'una rispetto all'altra.
//
// ── Da blocchi a sagome (set 2026) ─────────────────────────────
// La prima figura era fatta di capsule e rettangoli: leggibile, ma leggeva come
// un manichino di legno. Ora ogni distretto ha la forma del suo muscolo, stilizzata:
// il deltoide è una calotta, il petto due pettorali che si incontrano sullo sterno,
// il core una tartaruga di sei riquadri con gli obliqui ai lati, il braccio ha il
// bicipite, coscia e polpaccio si affusolano verso ginocchio e caviglia.
//
// Restano le regole della prima versione, perché erano giuste:
//  1. I pezzi si TOCCANO: fra due distretti contigui corre un pixel, quanto basta
//     a vedere il confine senza staccarli.
//  2. Il busto si stringe in vita e il bacino torna fuori.
//  3. La testa è piccola: non vuol dire niente, e non deve rubare l'occhio.
//
// Si disegna una metà sola: la destra è la sinistra specchiata sull'asse x = 55
// (vedi `specchia`). Così la figura è simmetrica per costruzione, non per pazienza.

/** Una forma: il `d` di un <path>, solo comandi assoluti M, L, C, Z. */
export type Forma = string

// Il sistema di coordinate della figura.
export const VIEWBOX_CORPO = '0 0 110 196'
const ASSE = 55

// I bordi REALI del disegno, per chi deve ritagliarlo stretto invece di
// centrarlo in un quadrato mezzo vuoto (le icone).
export const BOUNDS = { x: 19, y: 2, w: 72, h: 191 }

/** La stessa forma riflessa sull'asse verticale del corpo. Funziona perché le
 *  forme usano solo M/L/C/Z assoluti: ogni numero è una coordinata, e le
 *  coordinate vanno a coppie x, y. */
export function specchia(d: Forma): Forma {
  let i = 0
  return d.replace(/-?\d+(?:\.\d+)?/g, n => (i++ % 2 === 0 ? String(+(2 * ASSE - Number(n)).toFixed(2)) : n))
}

const coppia = (d: Forma): Forma[] => [d, specchia(d)]

/** Rettangolo con gli angoli arrotondati, come path (niente archi: non si
 *  specchierebbero con `specchia`). */
function riquadro(x: number, y: number, w: number, h: number, r: number): Forma {
  const k = r * 0.45
  return `M${x + r} ${y} L${x + w - r} ${y} C${x + w - k} ${y} ${x + w} ${y + k} ${x + w} ${y + r} `
    + `L${x + w} ${y + h - r} C${x + w} ${y + h - k} ${x + w - k} ${y + h} ${x + w - r} ${y + h} `
    + `L${x + r} ${y + h} C${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r} `
    + `L${x} ${y + r} C${x} ${y + k} ${x + k} ${y} ${x + r} ${y} Z`
}

// ── Parti senza un gruppo muscolare corrispondente ─────────────
// Non sono "non allenate": sono fuori dal modello, e colorarle di grigio-vuoto
// direbbe una cosa falsa.
export const TESTA: Forma[] = ['M55 3 C61 3 64.5 8 64.5 14.5 C64.5 21.5 60.5 27 55 27 C49.5 27 45.5 21.5 45.5 14.5 C45.5 8 49 3 55 3 Z']
export const COLLO: Forma[] = ['M50.5 24 L59.5 24 L60.5 32 C58.5 33.5 51.5 33.5 49.5 32 Z']
export const AVAMBRACCI: Forma[] = coppia('M23.2 84.8 L31.4 84.8 C32.4 91.5 31.2 100.5 28.4 109.4 L21.6 109.4 C19.8 100.5 20.6 91.5 23.2 84.8 Z')
export const MANI: Forma[] = coppia('M21.4 110.8 L28.6 110.8 C29.8 114.4 29.4 118.6 27.4 121.6 C25.6 123.4 22.8 123.2 21.2 121 C19.6 118 19.8 114.2 21.4 110.8 Z')
export const PIEDI: Forma[] = coppia('M44.8 183 L50.2 183 C51.4 185.8 53 188 53.6 189.8 C53.8 191.4 52.8 192.2 51.2 192.2 L42.6 192.2 C41.2 192.2 40.6 191.2 41.2 189.8 C42.4 187.8 44 185.8 44.8 183 Z')

// ── I distretti ────────────────────────────────────────────────
// Il deltoide è una calotta che scende sul braccio: è così che il braccio risulta
// ATTACCATO invece che appeso lì vicino.
export const SPALLE: Forma[] = coppia('M40.5 34.5 C34 33.2 27.5 35.5 25.2 42 C23.8 46.5 24 52 25.6 56.5 C29.8 55 33.6 51.5 35.8 46.5 C37.4 42.8 38.8 38.4 40.5 34.5 Z')

// Due pettorali che si toccano sullo sterno, con il bordo basso che risale verso
// l'ascella.
export const PETTO: Forma[] = coppia('M54.4 35.2 L54.4 54.5 C50 57.6 43.6 57.8 39.6 54.4 C37 52 36.6 45.6 37.8 40.6 C38.8 37 41.6 35.2 45.4 35 Z')

// Sei riquadri dell'addome (le righe crescono scendendo, come nell'anatomia vera)
// e gli obliqui ai fianchi: insieme sono il core.
export const CORE: Forma[] = [
  ...coppia(riquadro(45.6, 58.4, 8.4, 8.6, 2.4)),
  ...coppia(riquadro(45.6, 67.8, 8.4, 9, 2.4)),
  ...coppia(riquadro(45.6, 77.6, 8.4, 10, 2.6)),
  ...coppia('M44.4 58.2 C42 58.6 40.4 57.8 39.4 56.6 C39 64 39.8 76 42.6 88 L44.4 88 Z'),
]

// Da dietro trapezio e gran dorsale sono un'unica V, dal collo alla vita: il
// tratto che davanti si divide fra petto e addome. La colonna la segna il pixel
// fra le due metà.
export const DORSO: Forma[] = coppia('M54.4 31 L54.4 88.6 C50.4 87.6 47.2 83.4 44.8 77 C40.6 66 38 51.4 38.4 38.6 C40.8 35.4 44.6 33.4 48.2 32.4 C50.2 31.8 52.2 31.2 54.4 31 Z')

// Davanti il bacino è una V neutra; dietro, nello stesso spazio, i due glutei.
export const BACINO: Forma[] = ['M42.8 89.4 L67.2 89.4 C68.2 93 68.6 97 68.4 100.4 C64 105.4 59 108.6 55 109.6 C51 108.6 46 105.4 41.6 100.4 C41.4 97 41.8 93 42.8 89.4 Z']
// Il bordo basso tondo è la piega sotto il gluteo. Le forme NON si sovrappongono:
// i distretti sono pieni a opacità variabile (il livello di forza), e dove due
// forme si coprono il colore si somma e disegna una mezzaluna che non esiste.
export const GLUTEI: Forma[] = coppia('M54.4 90 L54.4 108.2 C50.8 112 45 112 41.8 108.4 C39.2 105.2 39.2 98.6 41.2 93.6 C42.2 91.2 44 90 46.4 90 Z')

// Il braccio col bicipite: la stessa forma fa da tricipite vista da dietro.
export const BRACCIA: Forma[] = coppia('M26.4 58 C30.4 56.4 34.2 52.8 36.4 48 C37.8 55 37.6 63.5 35.6 71 C34.4 76 32.8 80.4 31.6 83.4 L23.4 83.4 C22.2 77.5 22 70 22.8 63.5 C23.2 60.6 24.4 58.8 26.4 58 Z')

// Coscia larga all'anca e stretta al ginocchio; polpaccio gonfio in alto e
// sottile alla caviglia.
export const COSCE: Forma[] = coppia('M41.2 101.8 C45.2 107 49.8 110.2 54.4 111.2 L54 126 C53.6 136.4 52.6 144.2 51.4 150 L43.4 150 C41.2 141.8 39.2 131.6 39 120.4 C38.9 113 39.6 106.6 41.2 101.8 Z')
export const POLPACCI: Forma[] = coppia('M43.4 151.4 L51.4 151.4 C53 158.2 53 167 51.6 174.6 C51.2 177.2 50.6 179.6 50 181.6 L45 181.6 C43.2 175.6 41.4 167.6 41.6 160.2 C41.8 156.4 42.4 153.6 43.4 151.4 Z')
export const GAMBE: Forma[] = [...COSCE, ...POLPACCI]
// Da dietro la coscia comincia sotto la piega del gluteo, un pixel più in basso,
// invece che all'anca come davanti.
export const FEMORALI: Forma[] = coppia('M41 109.6 C44.6 113.4 50.8 113.6 54.4 110.4 L54 126 C53.6 136.4 52.6 144.2 51.4 150 L43.4 150 C41.2 141.8 39.2 131.6 39 120.4 C38.9 115.6 39.6 112 41 109.6 Z')
export const GAMBE_RETRO: Forma[] = [...FEMORALI, ...POLPACCI]

/** Tutto ciò che non è un distretto, per la faccia richiesta. Davanti il bacino
 *  è neutro; dietro quello stesso spazio sono i glutei, che un distretto ce
 *  l'hanno. */
export function neutri(lato: 'front' | 'back'): Forma[] {
  return [...TESTA, ...COLLO, ...AVAMBRACCI, ...MANI, ...PIEDI, ...(lato === 'front' ? BACINO : [])]
}

/** L'intera figura di una faccia: serve alle icone, che disegnano il corpo
 *  appena accennato e sopra ci accendono un distretto solo. */
export function figura(lato: 'front' | 'back'): Forma[] {
  return lato === 'front'
    ? [...neutri('front'), ...SPALLE, ...PETTO, ...CORE, ...BRACCIA, ...GAMBE]
    : [...neutri('back'), ...GAMBE_RETRO, ...DORSO, ...SPALLE, ...GLUTEI, ...BRACCIA]
}
