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
// Dati personali, pesate, stazioni Hyrox, colori dei gruppi muscolari,
// tema e preferenze. Non è un "cancella tutto": è la palestra che riparte.
//
// ── Chi va azzerato davvero ────────────────────────────────────
// Solo chi ha dati di PRIMA del catalogo nuovo: un'alzata o una scheda datate
// prima dell'11 settembre 2026, o senza data (il formato vecchio). Prima bastava
// che mancasse il marcatore, e il marcatore mancava anche a un account nuovo il
// cui primo caricamento era fallito: l'utente creava schede e alzate, salivano
// in cloud senza marcatore, e al riavvio successivo l'azzeramento le cancellava
// — con la copia di scorta di un account vuoto. A chi non ha niente di vecchio
// si mette il marcatore e basta (vedi `segnatura`), e se non ha esercizi gli si
// dà il catalogo: è quello che riceve ogni account nuovo.
//
// ── La copia di scorta ─────────────────────────────────────────
// Prima di sostituire, lo stato di prima viene messo da parte in localStorage.
// Non è un ripensamento sull'operazione: è che un azzeramento automatico che
// parte da solo all'avvio deve poter essere disfatto da chi se lo trova fatto.
// Resta sul dispositivo dov'è successo, non va nel cloud, e non scade. È una
// per account (la chiave porta l'id): un altro account entrato sullo stesso
// telefono non la sovrascrive. Si riprende dall'esportazione dei dati, nelle
// impostazioni, che la mette nel file accanto allo stato di adesso.

import type { JarvisState } from '@/store/useJarvisStore'
import { esercizidaCatalogo } from './catalogo'

/** L'azzeramento corrente. Cambiare questa stringa ne fa scattare uno nuovo su
 *  tutti gli account: è la sola cosa da toccare, il giorno che servisse. */
export const RESET_ID = '2026-09-catalogo-mpw'

/** Il giorno in cui è arrivato il catalogo nuovo. Quello che è nato da qui in
 *  poi è già fatto col catalogo nuovo, e non c'è niente da sostituire. Va
 *  cambiato insieme a `RESET_ID`. */
const DAL = '2026-09-11'

/** Dove finisce lo stato di prima. La data nel nome serve a non sovrascrivere
 *  una scorta precedente con una successiva; l'id, una di un altro account. */
export const chiaveScorta = (userId: string) => `jarvis-scorta-pre-${RESET_ID}-${userId}`

type Palestra = Pick<JarvisState, 'catalogoReset' | 'palestraExercises' | 'gymSchede'>

/** C'è qualcosa di fatto col catalogo vecchio? Un'alzata senza data è del
 *  formato di prima, e conta come vecchia. */
function haDatiDiPrima(s: Palestra): boolean {
  const vecchia = (data: string | undefined) => !data || data.slice(0, 10) < DAL
  return (s.palestraExercises ?? []).some(e => e.history.some(h => vecchia(h.date)))
    || (s.gymSchede ?? []).some(sc => vecchia(sc.createdAt))
}

export function serveAzzerare(s: Palestra): boolean {
  return s.catalogoReset !== RESET_ID && haDatiDiPrima(s)
}

/** Il marcatore manca ma non c'è niente da sostituire: un account nuovo, o uno
 *  nato dopo il catalogo nuovo. */
export function serveSegnare(s: Palestra): boolean {
  return s.catalogoReset !== RESET_ID && !haDatiDiPrima(s)
}

/** Quello che riceve chi non va azzerato: il marcatore, e il catalogo solo se
 *  la palestra è vuota. Non toglie niente. */
export function segnatura(s: Palestra): Pick<JarvisState, 'palestraExercises' | 'catalogoReset'> {
  return {
    palestraExercises: s.palestraExercises?.length ? s.palestraExercises : esercizidaCatalogo([]),
    catalogoReset: RESET_ID,
  }
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
export function salvaScorta(s: JarvisState, userId: string): boolean {
  try {
    localStorage.setItem(chiaveScorta(userId), JSON.stringify({
      quando: new Date().toISOString(),
      palestraExercises: s.palestraExercises,
      gymSchede: s.gymSchede,
    }))
    return true
  } catch {
    return false
  }
}

/** La scorta di questo account, così com'era stata messa da parte. `null` se
 *  qui non c'è mai stato un azzeramento. */
export function leggiScorta(userId: string): unknown {
  try {
    const raw = localStorage.getItem(chiaveScorta(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
