// Il pezzo di service worker che riceve le notifiche push.
//
// Viene caricato dal service worker generato da workbox (vedi `importScripts`
// in vite.config.ts): è JavaScript semplice, senza build, perché gira in un
// contesto che non è quello dell'app e non ne condivide i moduli.
//
// Il messaggio lo manda la Edge Function `notifica` (supabase/functions), già
// pronto da mostrare: { title, body, tag, url }. Qui non si decide niente sul
// contenuto — si mostra e, al tocco, si apre l'app nel posto giusto.

self.addEventListener('push', event => {
  let dati = {}
  try { dati = event.data ? event.data.json() : {} } catch { dati = { body: event.data ? event.data.text() : '' } }

  const titolo = dati.title || 'Matteo'
  const opzioni = {
    body: dati.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Stesso filo, stessa notifica: dieci messaggi dalla stessa persona non
    // diventano dieci righe nel centro notifiche, ma una che si aggiorna.
    tag: dati.tag || 'matteo',
    renotify: true,
    data: { url: dati.url || '/?apri=messaggi' },
  }
  // Va mostrata SEMPRE, anche con l'app aperta: i browser pretendono una
  // notifica visibile per ogni push, e a chi non la mostra tolgono il permesso
  // (iOS dopo poche volte).
  event.waitUntil(self.registration.showNotification(titolo, opzioni))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/?apri=messaggi'
  event.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // L'app è già aperta: la si porta davanti e le si dice dove andare, invece
    // di aprirne una seconda copia.
    for (const f of finestre) {
      if ('focus' in f) {
        f.postMessage({ tipo: 'apri', url })
        return f.focus()
      }
    }
    return self.clients.openWindow(url)
  })())
})
