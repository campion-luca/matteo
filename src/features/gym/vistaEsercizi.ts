// ── Come si guardano gli esercizi di un gruppo ─────────────────
// Elenco o griglia. Sta in un file suo e non dentro JarvisGym perché è una
// decisione, non un pezzo di interfaccia: si vuole poterla leggere e provare
// senza tirare dentro mezza schermata della palestra.

export type VistaEsercizi = 'elenco' | 'griglia'

export const VISTA_KEY = 'jarvis-vista-esercizi'

/** La vista con cui si apre la palestra, dato quello che c'è in memoria.
 *
 *  ── Si parte dalla griglia ──
 *  Per un lungo tratto il default è stato l'elenco, ed era la scelta giusta: la
 *  fascia in cima alla card conteneva il disegno del gruppo muscolare, che è lo
 *  stesso per tutti gli esercizi di quel gruppo. Otto quadrati con dentro la
 *  stessa figura occupano tre volte lo spazio di otto righe e dicono di meno.
 *
 *  Ora ogni esercizio del catalogo ha la sua illustrazione, e la griglia mostra
 *  cose diverse l'una dall'altra: si riconosce l'esercizio prima di leggerne il
 *  nome, che è tutto il motivo per cui una griglia esiste. */
export function vistaIniziale(salvato: string | null): VistaEsercizi {
  // Solo 'elenco' esplicito vince sul default: null (mai scelto), il valore di un
  // vecchio formato o uno storage negato cadono tutti sulla griglia, invece che
  // su un 'elenco' che nessuno ha chiesto.
  return salvato === 'elenco' ? 'elenco' : 'griglia'
}
