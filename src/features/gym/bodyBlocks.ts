// La figura a blocchi, in un posto solo.
//
// La usano la Mappa della forza (BodyMap, grande, con i distretti colorati per
// quanto sei forte) e le icone dei gruppi muscolari (MuscleIcons, in miniatura,
// con un distretto acceso). Erano due copie delle stesse coordinate: cambiare la
// sagoma voleva dire cambiarla due volte, e le due figure erano già scivolate
// l'una rispetto all'altra.
//
// Il disegno è GEOMETRICO — capsule e rettangoli arrotondati — non una silhouette
// anatomica: a queste misure una sagoma realistica diventa una macchia, mentre i
// blocchi restano leggibili e, soprattutto, hanno confini netti. Si vede dove
// finisce un distretto e comincia l'altro, che è tutto ciò che serve.
//
// Le regole della griglia, imparate guardando la prima versione ingrandita:
//
//  1. I pezzi si TOCCANO. Prima fra spalla e braccio, fra coscia e polpaccio, fra
//     gamba e piede correvano tre o quattro pixel di vuoto: da vicino la figura
//     non leggeva come un corpo ma come una scatola di montaggio rovesciata.
//     Ora fra due blocchi contigui c'è un solo pixel — quanto basta a vedere il
//     confine, non abbastanza da staccarli.
//  2. Il busto si STRINGE in vita. Petto e core larghi uguale facevano un
//     rettangolo, e un rettangolo non è un torso. Il petto è il punto più largo,
//     il core rientra di due unità per lato, il bacino torna fuori.
//  3. La testa è piccola. Era un quinto dell'altezza totale: a quella
//     proporzione la figura leggeva come un bambino, e rubava l'occhio a un
//     disegno in cui la testa è l'unica parte che non vuol dire niente.

/** Un blocco: x, y, larghezza, altezza, raggio degli angoli. */
export type Blocco = [number, number, number, number, number]

// Il sistema di coordinate della figura.
export const VIEWBOX_CORPO = '0 0 110 196'

// I bordi REALI del disegno, per chi deve ritagliarlo stretto invece di
// centrarlo in un quadrato mezzo vuoto (le icone).
export const BOUNDS = { x: 14, y: 1, w: 82, h: 191 }

// ── Parti senza un gruppo muscolare corrispondente ─────────────
// Non sono "non allenate": sono fuori dal modello, e colorarle di grigio-vuoto
// direbbe una cosa falsa.
export const TESTA:      Blocco[] = [[44, 3, 22, 26, 10]]
export const COLLO:      Blocco[] = [[50, 27, 10, 9, 3]]
export const AVAMBRACCI: Blocco[] = [[17, 84, 17, 27, 8], [76, 84, 17, 27, 8]]
export const MANI:       Blocco[] = [[19, 112, 13, 10, 4], [78, 112, 13, 10, 4]]
export const PIEDI:      Blocco[] = [[39, 181, 15, 9, 3], [56, 181, 15, 9, 3]]

// ── I distretti ────────────────────────────────────────────────
// Le spalle arrivano fino al petto e i bracci partono dove le spalle finiscono:
// è così che il braccio risulta ATTACCATO invece che appeso lì vicino.
export const SPALLE:    Blocco[] = [[16, 33, 24, 21, 10], [70, 33, 24, 21, 10]]
export const PETTO:     Blocco[] = [[41, 34, 28, 23, 5]]
export const CORE:      Blocco[] = [[43, 58, 24, 30, 5]]
// Da dietro il gran dorsale copre tutto il tratto che davanti si divide fra
// petto e addome: un blocco solo, non due.
export const DORSO:     Blocco[] = [[41, 34, 28, 54, 5]]
// Lo stesso rettangolo è bacino davanti (neutro) e glutei dietro (distretto).
export const BACINO:    Blocco[] = [[41, 89, 28, 16, 6]]
export const BRACCIA:   Blocco[] = [[17, 55, 18, 28, 9], [75, 55, 18, 28, 9]]
export const COSCE:     Blocco[] = [[40, 106, 14, 45, 6], [56, 106, 14, 45, 6]]
export const POLPACCI:  Blocco[] = [[41, 152, 12, 29, 5], [57, 152, 12, 29, 5]]
export const GAMBE:     Blocco[] = [...COSCE, ...POLPACCI]

/** Tutto ciò che non è un distretto, per la faccia richiesta. Davanti il bacino
 *  è neutro; dietro quello stesso spazio sono i glutei, che un distretto ce
 *  l'hanno. */
export function neutri(lato: 'front' | 'back'): Blocco[] {
  return [...TESTA, ...COLLO, ...AVAMBRACCI, ...MANI, ...PIEDI, ...(lato === 'front' ? BACINO : [])]
}

/** L'intera figura di una faccia: serve alle icone, che disegnano il corpo
 *  appena accennato e sopra ci accendono un distretto solo. */
export function figura(lato: 'front' | 'back'): Blocco[] {
  return lato === 'front'
    ? [...neutri('front'), ...SPALLE, ...PETTO, ...CORE, ...BRACCIA, ...GAMBE]
    : [...neutri('back'), ...SPALLE, ...DORSO, ...BACINO, ...BRACCIA, ...GAMBE]
}
