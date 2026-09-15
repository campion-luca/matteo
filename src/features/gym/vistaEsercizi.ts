// ── Come si guardano gli esercizi di un gruppo ─────────────────
// Elenco o griglia. Sta in un file suo e non dentro JarvisGym perché è una
// decisione, non un pezzo di interfaccia: si vuole poterla leggere e provare
// senza tirare dentro mezza schermata della palestra.

export type VistaEsercizi = 'elenco' | 'griglia'

// La `-v2` rimette tutti sulla griglia (set 2026): è diventata il default voluto
// sia per gli esercizi sia per i gruppi, e una scelta "elenco" salvata quando la
// griglia non aveva ancora le immagini non va trascinata avanti.
export const VISTA_KEY = 'jarvis-vista-esercizi-v2'

// Stessa scelta, ma per l'elenco dei gruppi muscolari: una chiave a parte perché
// si può volere la griglia degli esercizi (con le foto) e l'elenco compatto dei
// gruppi, o viceversa.
export const VISTA_GRUPPI_KEY = 'jarvis-vista-gruppi'

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
