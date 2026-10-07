// Cercare una versione nuova dell'app, a comando.
//
// Sta in un file suo e non dentro UpdateToast perché lo chiama anche il bridge
// del cloud, quando scopre che i dati sono stati scritti da un'app più recente
// di questa (vedi `VERSIONE_DATI` nello store).

let registrazione: ServiceWorkerRegistration | undefined

/** La registrazione del service worker, appena c'è (la dà UpdateToast). */
export function ricordaRegistrazione(r: ServiceWorkerRegistration | undefined): void {
  registrazione = r
}

/** Chiede adesso se c'è una versione nuova. Non fa niente senza service worker
 *  (in sviluppo) o senza rete. Se la trova, UpdateToast mostra "Aggiorna". */
export function cercaAggiornamento(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  void registrazione?.update().catch(() => { /* rete caduta a metà: al prossimo giro */ })
}
