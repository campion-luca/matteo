import type { FocusEvent } from 'react'

// ── Campi numerici che si riscrivono, non si correggono ────────
// Entrando in un campo se ne seleziona il contenuto: la prima cifra digitata lo
// sostituisce invece di accodarsi.
//
// Serve/serviva perché questi campi arrivano pre-compilati con l'ultima volta —
// che è comodo quando il numero è quello, e un ostacolo quando non lo è: per
// scrivere 62 su un campo che dice 60 bisognava prima cancellare, e chi non
// cancellava si ritrovava 6062. Col catalogo appena azzerato il pre-compilato è
// uno zero, e lo zero da cancellare a mano era il caso peggiore: un ostacolo
// messo lì da un valore che non è nemmeno un dato.
//
// Non è la scelta giusta per un campo di testo lungo, dove si entra per
// ritoccare una parola. Qui i campi sono di due o tre cifre e la modifica è
// quasi sempre "un altro numero", non "questo numero corretto".
export function selezionaAlFocus(e: FocusEvent<HTMLInputElement>): void {
  e.currentTarget.select()
}

/** Il numero come lo si vuole vedere in un campo pre-compilato: lo zero non è un
 *  valore di partenza, è un campo vuoto scritto male — e va cancellato a mano
 *  prima di poter scrivere. Il segnaposto dice già cosa ci va. */
export function preCompila(n: number | undefined): string {
  return n ? String(n) : ''
}
