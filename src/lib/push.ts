// Le notifiche push: iscrivere questo dispositivo, e far partire un avviso.
//
// ── Come gira ──────────────────────────────────────────────────
// 1. Chi vuole le notifiche le attiva da qui: il browser chiede il permesso e
//    dà un "indirizzo" di questo dispositivo (l'iscrizione), che finisce nella
//    tabella `push_iscrizioni` accanto all'id dell'utente.
// 2. Quando qualcuno scrive un messaggio — o l'app ne scrive uno per lui: un
//    allenamento finito, una scheda assegnata — chi l'ha scritto chiama la Edge
//    Function `notifica` con l'id del messaggio (`notificaPush`).
// 3. La funzione controlla che il messaggio sia davvero di chi chiama, trova i
//    dispositivi dell'ALTRA persona e manda loro la notifica. La chiave privata
//    che serve a firmarla sta solo lì, nei secret di Supabase.
// 4. Sul dispositivo la riceve il service worker (public/push-sw.js), anche ad
//    app chiusa, e la mostra.
//
// ── Perché la chiama il client e non un trigger nel database ───
// Un webhook sul database partirebbe da solo a ogni riga nuova, ma è un pezzo
// in più da configurare a mano nel pannello di Supabase, e uno che quando manca
// non dà nessun errore. Chiamata da qui, la funzione o c'è o non c'è — e se non
// c'è il messaggio parte lo stesso: la notifica è un di più, mai una condizione.
//
// ── iPhone ─────────────────────────────────────────────────────
// Su iOS il push esiste solo per l'app INSTALLATA nella schermata Home (da iOS
// 16.4): in Safari, a scheda aperta, `PushManager` non c'è. `statoPush` lo
// distingue, perché "non supportato" e "installala e funziona" sono due cose
// diverse da dire a chi guarda.
//
// ── Accese per tutti, per quanto il browser lo permette ────────
// Le notifiche non si possono accendere di nascosto: la prima volta il
// permesso lo dà la persona, da un tocco suo, e non c'è modo di saltarlo
// (su iPhone serve in più l'app installata). Quindi:
//  • a chi il permesso l'ha già dato si accendono da sole a ogni ingresso
//    (`riallineaPush`), anche dopo un'uscita e un rientro;
//  • a chi non l'ha mai dato l'app lo chiede UNA volta, al primo ingresso su
//    quel dispositivo (`daProporrePush`, vedi InvitoNotifiche);
//  • chi le spegne dalle impostazioni resta spento: lo si ricorda sul
//    dispositivo, o al prossimo avvio si riaccenderebbero contro la sua scelta.
import { supabase, chiamaFunzione } from './supabase'
import { translateCoachError } from './coach'
import { readStorage, writeStorage, removeStorage } from './safeStorage'

const CHIAVE_PUBBLICA = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim()

/** Le ha spente la persona, da questo dispositivo: non si riaccendono da sole. */
const SPENTE_DA_QUI = 'jarvis-push-spente-v1'
/** L'invito del primo ingresso è già stato mostrato su questo dispositivo. */
const INVITO_FATTO = 'jarvis-push-invito-v1'

const spenteDaQui = () => readStorage('local', SPENTE_DA_QUI) === '1'

export type StatoPush =
  | 'non-configurato'   // manca la chiave pubblica: il push non è stato attivato sul progetto
  | 'da-installare'     // iPhone in Safari: serve l'app nella schermata Home
  | 'non-supportato'    // questo browser non ha il push
  | 'negato'            // il permesso è stato rifiutato: si riattiva dalle impostazioni
  | 'spento'            // si può attivare
  | 'attivo'

/** La chiave pubblica nel formato che vuole il browser: base64 "url-safe" →
 *  bytes. */
export function chiaveInBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  // Su un ArrayBuffer esplicito: è il tipo che `subscribe` accetta.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

const eIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  // iPadOS si presenta come un Mac: lo tradisce il tocco.
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const installata = () => window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true

const haPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Il service worker pronto, o `null` se non arriva: in sviluppo non c'è, e
 *  `serviceWorker.ready` non si risolve mai — senza un limite, chi aspetta
 *  resterebbe appeso. */
async function registrazione(attesaMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(fine => setTimeout(() => fine(null), attesaMs)),
  ])
}

export async function statoPush(): Promise<StatoPush> {
  if (!CHIAVE_PUBBLICA) return 'non-configurato'
  if (!haPush()) return eIOS() && !installata() ? 'da-installare' : 'non-supportato'
  if (Notification.permission === 'denied') return 'negato'
  const reg = await registrazione()
  if (!reg) return 'non-supportato'
  const iscrizione = await reg.pushManager.getSubscription()
  return iscrizione && Notification.permission === 'granted' ? 'attivo' : 'spento'
}

/** Scrive l'iscrizione di questo dispositivo a nome dell'utente. La chiave è
 *  l'indirizzo del dispositivo: se sullo stesso telefono entra un altro account,
 *  la riga passa a lui invece di raddoppiare. */
async function registra(userId: string, iscrizione: PushSubscription): Promise<void> {
  const j = iscrizione.toJSON()
  const { error } = await supabase.from('push_iscrizioni').upsert({
    endpoint: iscrizione.endpoint,
    user_id: userId,
    p256dh: j.keys?.p256dh ?? '',
    auth: j.keys?.auth ?? '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  // Tabella non ancora creata sul server: lo si dice in parole, non col
  // messaggio grezzo del database.
  if (error) throw new Error(translateCoachError(error.message))
}

/** Chiede il permesso e iscrive il dispositivo. Va chiamata da un tocco: i
 *  browser non mostrano la richiesta di permesso se non c'è un gesto dietro. */
export async function attivaPush(userId: string): Promise<StatoPush> {
  if (!CHIAVE_PUBBLICA) return 'non-configurato'
  if (!haPush()) return eIOS() && !installata() ? 'da-installare' : 'non-supportato'
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') return permesso === 'denied' ? 'negato' : 'spento'
  const reg = await registrazione()
  if (!reg) return 'non-supportato'
  const iscrizione = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInBytes(CHIAVE_PUBBLICA) })
  await registra(userId, iscrizione)
  // Riaccese a mano: da qui in poi tornano ad accendersi anche da sole.
  removeStorage('local', SPENTE_DA_QUI)
  return 'attivo'
}

/** Toglie l'iscrizione di questo dispositivo: la riga dal server (finché c'è la
 *  sessione per farlo) e l'iscrizione dal browser. È quello che fa l'uscita
 *  dall'account, e NON è una scelta della persona: rientrando, le notifiche si
 *  riaccendono da sole (vedi `riallineaPush`). */
export async function disattivaPush(): Promise<void> {
  const reg = await registrazione(1500)
  const iscrizione = await reg?.pushManager.getSubscription()
  if (!iscrizione) return
  await supabase.from('push_iscrizioni').delete().eq('endpoint', iscrizione.endpoint)
  await iscrizione.unsubscribe()
}

/** Le spegne perché l'ha chiesto la persona, dall'interruttore delle
 *  impostazioni: oltre a togliere l'iscrizione, lo si ricorda su questo
 *  dispositivo, così non si riaccendono al prossimo avvio. */
export async function spegniPush(): Promise<void> {
  writeStorage('local', SPENTE_DA_QUI, '1')
  await disattivaPush()
}

/** All'avvio: la riga di questo dispositivo dev'essere a nome di chi è entrato
 *  ADESSO — copre il cambio di account sullo stesso telefono e le iscrizioni che
 *  il browser rinnova da sé. E se il permesso c'è già ma l'iscrizione no (dopo
 *  un'uscita, o su un browser che l'ha lasciata scadere) la rifà: le notifiche
 *  sono accese di serie. Non chiede niente a nessuno: senza permesso, o se sono
 *  state spente dalle impostazioni, non fa nulla. */
export async function riallineaPush(userId: string): Promise<void> {
  if (!CHIAVE_PUBBLICA || !haPush() || Notification.permission !== 'granted') return
  const reg = await registrazione()
  if (!reg) return
  let iscrizione = await reg.pushManager.getSubscription()
  if (!iscrizione && !spenteDaQui()) {
    iscrizione = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInBytes(CHIAVE_PUBBLICA) })
  }
  if (iscrizione) await registra(userId, iscrizione)
}

/** C'è da chiedere il permesso? Solo a chi può darlo con un tocco e non è mai
 *  stato interpellato: push configurato, browser che lo sa fare, permesso né
 *  dato né negato, e l'invito non ancora mostrato su questo dispositivo. Chi
 *  deve prima installare l'app (iPhone in Safari) lo legge nelle impostazioni:
 *  qui gli si chiederebbe una cosa che non può fare. */
export async function daProporrePush(): Promise<boolean> {
  if (!CHIAVE_PUBBLICA || !haPush()) return false
  if (readStorage('local', INVITO_FATTO) === '1' || spenteDaQui()) return false
  if (Notification.permission !== 'default') return false
  return (await statoPush()) === 'spento'
}

/** L'invito è stato mostrato (accettato o no): non si ripropone. */
export function segnaInvitoPush(): void {
  writeStorage('local', INVITO_FATTO, '1')
}

/** Fa partire la notifica per questo messaggio verso l'altra persona. Non
 *  aspetta e non fallisce: se la funzione non c'è, la rete cade o l'altro non ha
 *  le notifiche attive, il messaggio è comunque arrivato — lo leggerà aprendo
 *  l'app, com'è sempre stato. */
export function notificaPush(messaggioId: string): void {
  if (!CHIAVE_PUBBLICA) return
  void chiamaFunzione('notifica', { messaggio_id: messaggioId }).catch(() => { /* la notifica è un di più */ })
}
