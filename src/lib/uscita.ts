// Uscire dall'account, da QUESTO telefono.
//
// Tre cose che l'uscita di prima non faceva:
//
//  • usciva da TUTTI i dispositivi (`signOut()` senza argomenti vale "globale"):
//    il telefono rimasto in palestra con un allenamento non ancora inviato si
//    ritrovava fuori, e svuotato. Adesso si esce solo da qui;
//
//  • non aspettava il salvataggio in corso: le ultime modifiche partivano un
//    secondo e mezzo dopo, cioè a sessione già chiusa. Adesso prima si spinge
//    quello che c'è e si aspetta un momento che arrivi;
//
//  • senza rete non faceva niente e non lo diceva: la libreria non toglie la
//    sessione se non riesce a dirlo al server, e chi premeva "Logout" credeva
//    di essere uscito. Adesso la sessione si toglie comunque da questo telefono.
//
// Quello che non è riuscito a partire non si perde: lo mette da parte
// `parcheggia` (vedi lib/proprietario), chiamato dall'evento di uscita.
import { supabase, storageKey } from './supabase'
import { getSyncMeta } from './syncMeta'
import { useSyncStatus } from './syncStatus'
import { disattivaPush } from './push'
import { proprietario, parcheggia, svuotaDatiLocali, segnaProprietario } from './proprietario'

const ATTESA_SALVATAGGIO_MS = 4000
const ATTESA_USCITA_MS = 4000

function finche(fatto: () => boolean, ms: number): Promise<void> {
  return new Promise(fine => {
    const da = Date.now()
    const giro = () => (fatto() || Date.now() - da > ms ? fine() : void setTimeout(giro, 150))
    giro()
  })
}

export async function esci(): Promise<void> {
  // PRIMA di uscire, finché c'è la sessione per farlo: questo dispositivo
  // smette di ricevere le notifiche dell'account. Senza, chi entra dopo sullo
  // stesso telefono si vedrebbe arrivare i messaggi di chi è uscito.
  // Con un limite: la cancellazione dell'iscrizione è una richiesta al server,
  // e con la rete che pende terrebbe il tasto su "Attendi…" senza fine.
  await Promise.race([
    disattivaPush().catch(() => { /* niente iscrizione, o niente rete: si esce lo stesso */ }),
    new Promise<void>(fine => setTimeout(fine, ATTESA_USCITA_MS)),
  ])

  if (getSyncMeta().dirty) {
    useSyncStatus.getState().salvaOra?.()
    await finche(() => !getSyncMeta().dirty, ATTESA_SALVATAGGIO_MS)
  }

  // Anche l'uscita ha un tempo massimo. Senza rete la libreria prova prima a
  // rinnovare l'accesso, e ci mette fino a un minuto ad arrendersi: un minuto
  // col tasto "Logout" premuto e niente che succede.
  const esito = await Promise.race([
    supabase.auth.signOut({ scope: 'local' }).catch(e => ({ error: e as unknown })),
    new Promise<{ error: unknown }>(fine => setTimeout(() => fine({ error: new Error('uscita non confermata in tempo') }), ATTESA_USCITA_MS)),
  ])
  if (!esito.error) return

  // Il server non ha risposto e la sessione è ancora lì. Si fa a mano quello
  // che avrebbe fatto l'evento di uscita, e si ricarica: l'app riparte dal login.
  const chi = proprietario()
  if (chi) parcheggia(chi)
  svuotaDatiLocali()
  segnaProprietario(null)
  try { localStorage.removeItem(storageKey) } catch { /* niente da fare */ }
  window.location.reload()
}
