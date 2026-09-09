// Identificatori locali per le entità create dall'utente (eventi, esercizi,
// categorie, voci di budget, righe di scheda).
//
// `Date.now()` da solo NON basta: creare due voci nello stesso millisecondo —
// cosa che succede tenendo premuto "+", o quando `reconcileAndPersist` genera
// più esercizi in un giro solo — produceva due id identici. Da lì in poi React
// vede due chiavi uguali e, peggio, `filter(x => x.id !== id)` ne cancella due.
// Il suffisso casuale rende la collisione irrilevante restando ordinabile nel
// tempo (il prefisso temporale resta in testa).
export function uid(prefix = ''): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
