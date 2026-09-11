// ── L'azzeramento del catalogo ─────────────────────────────────
// Una volta sola, per ogni account: gli esercizi di palestra e le schede
// vengono sostituiti con il catalogo di partenza, quello con le immagini.
//
// ── Perché azzerare invece di far convivere ────────────────────
// Il catalogo è cambiato per intero: nomi nuovi, con la marca del macchinario, e
// una foto per ognuno. Chi usava l'app da prima ha i nomi vecchi, che a quelle
// foto non si agganciano. Le strade erano tre: lasciare i due insiemi uno
// accanto all'altro (una lista doppia, metà illustrata e metà no), rinominare
// uno per uno a mano, oppure ripartire. È stata scelta la terza da chi usa
// l'app, sapendo cosa costa — sotto c'è scritto esattamente cosa costa.
//
// ── Cosa cancella ──────────────────────────────────────────────
// `palestraExercises` (quindi TUTTE le alzate registrate, e con loro massimali,
// record e grafici, che da quelle sono derivati) e `gymSchede`.
//
// ── Cosa NON tocca ─────────────────────────────────────────────
// Dati personali, pesate, budget, stazioni Hyrox, colori dei gruppi muscolari,
// tema e preferenze. Non è un "cancella tutto": è la palestra che riparte.
//
// ── La copia di scorta ─────────────────────────────────────────
// Prima di sostituire, lo stato di prima viene messo da parte in localStorage.
// Non è un ripensamento sull'operazione: è che un azzeramento automatico che
// parte da solo all'avvio deve poter essere disfatto da chi se lo trova fatto.
// Resta sul dispositivo dov'è successo, non va nel cloud, e non scade.

import type { JarvisState } from '@/store/useJarvisStore'
import { esercizidaCatalogo } from './catalogo'

/** L'azzeramento corrente. Cambiare questa stringa ne fa scattare uno nuovo su
 *  tutti gli account: è la sola cosa da toccare, il giorno che servisse. */
export const RESET_ID = '2026-09-catalogo-mpw'

/** Dove finisce lo stato di prima. La data nel nome serve a non sovrascrivere
 *  una scorta precedente con una successiva. */
export const CHIAVE_SCORTA = 'jarvis-scorta-pre-' + RESET_ID

export function serveAzzerare(s: Pick<JarvisState, 'catalogoReset'>): boolean {
  return s.catalogoReset !== RESET_ID
}

/** I campi da scrivere nello store. Non applica niente da sé: chi chiama decide
 *  quando, ed è importante che sia DOPO il caricamento dal cloud — altrimenti il
 *  blob remoto, che è più recente, rimetterebbe dentro quello che si è appena
 *  tolto. */
export function azzeramento(): Pick<JarvisState, 'palestraExercises' | 'gymSchede' | 'catalogoReset'> {
  return {
    // Da lista vuota: il catalogo intero, senza storico e senza carichi.
    palestraExercises: esercizidaCatalogo([]),
    gymSchede: [],
    catalogoReset: RESET_ID,
  }
}

/** Mette da parte lo stato di prima. Se il salvataggio non riesce — spazio
 *  finito, modalità privata, storage negato — l'azzeramento si fa lo stesso: la
 *  scorta è una rete, non una condizione. Ma il fallimento va detto, perché
 *  cambia cosa si può promettere a chi chiede indietro i suoi dati. */
export function salvaScorta(s: JarvisState): boolean {
  try {
    localStorage.setItem(CHIAVE_SCORTA, JSON.stringify({
      quando: new Date().toISOString(),
      palestraExercises: s.palestraExercises,
      gymSchede: s.gymSchede,
    }))
    return true
  } catch {
    return false
  }
}
