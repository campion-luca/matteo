// Accesso tollerante a localStorage / sessionStorage.
//
// In Safari privato (e con i cookie di terze parti bloccati in un iframe) il solo
// `localStorage.getItem` LANCIA. Chiamato durante l'inizializzazione di uno stato
// React — com'era nel login e nell'app shell — l'eccezione risale fino alla radice
// e l'utente vede una pagina bianca al primo avvio, prima ancora di poter fare
// login. Il resto del codice questa cautela ce l'aveva già (syncMeta, moduli home,
// preferenze di dispositivo): qui diventa una sola implementazione per tutti.
//
// La degradazione è sempre la stessa: la preferenza non si ricorda, l'app funziona.

type Kind = 'local' | 'session'

function store(kind: Kind): Storage | null {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage }
  catch { return null }
}

export function readStorage(kind: Kind, key: string): string | null {
  try { return store(kind)?.getItem(key) ?? null } catch { return null }
}

export function writeStorage(kind: Kind, key: string, value: string): void {
  try { store(kind)?.setItem(key, value) } catch { /* quota piena o storage negato */ }
}

export function removeStorage(kind: Kind, key: string): void {
  try { store(kind)?.removeItem(key) } catch { /* niente da fare */ }
}
