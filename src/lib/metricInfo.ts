// ── Cosa significano i numeri ──────────────────────────────────
// Nell'app quasi nulla è scopribile leggendo l'interfaccia: dove sta una cosa lo
// impari in cinque minuti, ma "EVL 8.400" o "fabbisogno 2.340" non si spiegano da
// soli e non si spiegheranno mai. Questo è il testo dietro la ⓘ.
//
// Regole per chi aggiunge una voce:
// 1. Deve essere VERA. Va letta la formula, non il nome della variabile. Se non l'hai
//    aperta, non scrivere la riga.
// 2. Dove la costante è esportata si INTERPOLA (vedi sotto): una guida aggiornata a
//    mano diverge dal codice al primo tuning e poi mente per sempre. Dove non si può,
//    il numero è scritto a mano e il commento dice a quale funzione fa da specchio.
// 3. `read` è il posto delle cose scomode: default invisibili, dati che non
//    coincidono, limiti del modello. È metà del valore della ⓘ — un numero spiegato
//    solo quando è lusinghiero non è una spiegazione.

export type MetricInfo = {
  title: string
  /** Una riga: che cos'è, in italiano, senza formule. */
  what: string
  /** Come si ottiene. Le coppie [etichetta, formula] per i blocchi con più numeri. */
  how: string | Array<[string, string]>
  /** Come leggerlo — e cosa NON dice. */
  read?: string
}

// I testi restano scritti in italiano: sono le CHIAVI con cui il dizionario
// tedesco li ritrova (vedi i18n.ts). Questa costante nasce una volta sola
// all'import, quando la lingua scelta non è ancora nota; la traduzione avviene
// in `InfoDot`, cioè nell'unico punto da cui questi testi arrivano allo schermo.
export const METRIC_INFO = {

  bodyMap: {
    title: 'Mappa della forza',
    what: 'Quanto sei forte in ogni distretto, su una scala che rende i distretti confrontabili fra loro.',
    how: [
      ['Il numero', 'Per ogni distretto si prende il massimale stimato dell’esercizio in cui vai meglio (non la media: la media punisce chi ha in lista un accessorio leggero) e lo si divide per il tuo peso corporeo. Un esercizio con due gruppi muscolari conta per intero sul primario e a metà sul secondario: il muscolo che assiste lavora, ma non con quel carico — nessuno curla i 60 kg di un rematore.'],
      ['Il colore', 'Quattro livelli — iniziale, base, buono, forte — con soglie DIVERSE per distretto: servono 1.10× il tuo peso per un "base" sulle gambe e 0.35× per lo stesso grado sui bicipiti. È l’unico modo perché "colorato ovunque" voglia dire equilibrato e non solo "alleno le gambe".'],
    ],
    read: 'Le soglie sono approssimazioni da standard diffusi, non misure: gli stessi chili su una macchina e su un bilanciere non valgono uguale, e la tabella non lo sa. Il core è il più incerto — per gli addominali sotto carico uno standard non esiste, e quelle soglie sono una stima. Senza il peso corporeo nel profilo la mappa non può dire niente. E un distretto vuoto significa solo che non hai registrato alzate: non che sei debole.',
  },

  maxLifts: {
    title: 'Massimali',
    what: 'I tre numeri con cui la forza si racconta da sempre: squat, panca piana e stacco da terra. Il «total» è la loro somma.',
    how: [
      ['Dichiarato', 'L’hai provato: una singola al carico massimo, salvata con l’interruttore «Massimale» quando registri l’alzata. Qui il numero è il carico, non una stima — Epley su una singola lo gonfierebbe del 3%.'],
      ['Stimato', 'Hai fatto quell’alzata a ripetizioni, e il massimale esce dalla serie migliore con la formula di Epley (vedi «Massimale stimato»). Vale l’esercizio giusto: «Panca inclinata» non conta come panca piana.'],
      ['Dal distretto', 'Quell’alzata non è in lista. Il numero viene dai chili che sollevi sui gruppi muscolari coinvolti — gambe per lo squat, petto per la panca, glutei per lo stacco — peso corporeo incluso a corpo libero.'],
      ['× peso', 'Gli stessi chili diviso il tuo peso corporeo: è il modo di confrontarsi fra persone di taglia diversa. 100 kg pesandone 65 è più forza che 110 pesandone 95.'],
    ],
    read: '«Dal distretto» NON è un massimale di quell’alzata: se le gambe le alleni alla pressa, quei chili non sono il tuo squat — sono un ordine di grandezza, e servono solo a non lasciare la riga vuota. Il numero diventa vero quando registri l’alzata, e diventa certo quando la provi come massimale. Il total esce solo con tutte tre: sommarne due darebbe un numero che sembra un total e non lo è. Il peso corporeo è quello del profilo: se è vecchio di mesi, i rapporti sbagliano di conseguenza.',
  },

  oneRM: {
    title: 'Massimale stimato',
    what: 'Quanto alzeresti per una singola ripetizione, dedotto da una serie che ne ha fatte parecchie. Serve a mettere sulla stessa scala alzate con colpi diversi.',
    how: 'Formula di Epley: carico × (1 + colpi / 30). Così 50 kg × 8 dà 63 kg e 40 kg × 15 ne dà 60: la prima serie vale di più, anche se la seconda ha spostato più chili in totale. Con pesi diversi per serie conta la serie migliore, non la media. A corpo libero il carico include il tuo peso.',
    read: 'È una stima, non una prova: nessuno ti ha visto alzare quel peso. Oltre le 12 ripetizioni Epley diventa ottimista, perché lì contano fiato e resistenza più della forza massimale — un 20×30 kg non fa di te un 60 kg di massimale. Misura la forza, non la fatica: una serie fatta al cedimento e una lasciata a metà danno lo stesso numero.',
  },

  bestLift: {
    title: 'Miglior alzata',
    what: 'La sessione in cui hai espresso più forza su questo esercizio, non quella in cui hai alzato il peso più alto.',
    how: 'La sessione col massimale stimato più alto (vedi sopra): kg e colpi finiscono in un numero solo. A parità vince la più recente.',
    read: 'Non è un premio alla fatica: una serie infinita con poco peso non compare qui, per quanto abbia bruciato. Se hai cambiato modo di eseguire l’esercizio, il confronto con le alzate vecchie vale meno di quanto sembri.',
  },

} as const satisfies Record<string, MetricInfo>

export type MetricId = keyof typeof METRIC_INFO
