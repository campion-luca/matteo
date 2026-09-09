# Revisione completa — bug, pulizia, performance, UX

> **Documento storico.** Racconta un intervento in dieci parti fatto quando l'app
> aveva anche le schede Lavoro e Attività e le feature Readiness, Idratazione e
> Ciclo, e il tema si chiamava "Office/Paper" con Playfair Display e accent
> terracotta. Niente di tutto questo esiste più: si legge come cronaca, non come
> documentazione dello stato attuale, per cui fa fede [README.md](../README.md).

Il punto di partenza era un'app che funzionava ma perdeva dati in silenzio, si
ricaricava da sola a metà allenamento e si portava dietro mezzo scheletro di un
progetto precedente. Sotto, cosa è cambiato e perché — l'ordine è quello in cui è
stato fatto, che non è casuale: la pulizia sta al secondo posto perché senza di
lei il lint non era un gate utilizzabile e tutto il resto lavorava nel rumore.

---

## 1. Sincronizzazione cloud

Era il difetto grave. `saveUserData` faceva l'upsert senza mai guardare `error`:
un salvataggio fallito — rete, sessione scaduta, RLS — passava senza un segno, e
l'utente restava convinto di avere i dati in cloud. Si aggiungevano due buchi più
piccoli ma dello stesso tipo: una modifica fatta entro 1,5 s dalla chiusura non
partiva mai (finestra del debounce), e con due dispositivi aperti valeva un
last-write-wins cieco.

Cosa è cambiato:

- l'upsert controlla l'errore e lo rilancia, e restituisce l'`updated_at` salvato;
- lo stato di sync vive in uno store leggero **fuori** da `useJarvisStore`: dentro,
  ogni cambio di stato avrebbe fatto scattare un nuovo salvataggio, cioè un ciclo;
- prima di ogni scrittura il bridge rilegge l'`updated_at` remoto. Se qualcun
  altro ha salvato dopo di noi, scarica il suo dato invece di sovrascriverlo e lo
  dice. La politica è esplicita: **vince il più recente**;
- un errore diventa una pill toccabile in alto, con retry automatico al
  cambiamento successivo e uno temporizzato a 10 s. Quando tutto funziona non
  c'è nessun indicatore — un'icona verde permanente è rumore;
- flush immediato su `visibilitychange` e `pagehide`.

## 2. Pulizia

Il progetto trascinava le dipendenze e i file di un impianto mai usato: `axios`,
`@tanstack/react-query` e `react-router-dom` (quest'ultimo con un `BrowserRouter`
che non avvolgeva nessuna `<Route>`), più `components/layout/`, `pages/`,
`Button.tsx`, `Card.tsx`, `useAppStore` e `useAuthStore` — tutti file che nessuno
importava. Via anche `STORAGE_TAB`, che scriveva `jarvis-tab` in localStorage
senza rileggerlo mai.

Due dettagli che meritano una riga:

- `useGreeting` aveva `'Luca'` come default. Tolto: con il nome vuoto il saluto
  va senza virgola — "Buongiorno." e non "Buongiorno, .";
- in `globals.css` la custom property `--accent` era definita due volte in
  `:root`, prima in oklch e poi sovrascritta da un tripletto HSL pensato per
  Tailwind. Vinceva il secondo, e non era quello che si voleva.

Da qui in avanti `npm run lint` esce a zero, con `--max-warnings 0`. I nove
errori aperti erano entità non escapate in JSX e `catch {}` vuoti; per i warning
`react-hooks/exhaustive-deps` la regola è caso per caso — dove il pattern è
voluto (reset dello stato locale all'apertura di un modale, effetti run-once) c'è
un `eslint-disable-next-line` **con il motivo scritto accanto**, altrove è stata
corretta la dipendenza.

## 3. Accesso

Tre cose, tutte piccole e tutte visibili:

- `signUp` passa `emailRedirectTo`, e quando il progetto ha la conferma via email
  attiva (`data.user` valorizzato ma `session` nulla) il form lo dice invece di
  sembrare fermo;
- la password di almeno sei caratteri si controlla anche in registrazione, non
  solo nel reset;
- gli errori di Supabase arrivano in inglese dentro un'app che in inglese non è.
  `translateAuthError` mappa i casi comuni e ricade sul messaggio originale per
  gli altri: meglio una frase inglese che una schermata muta.

## 4. Permesso notifiche

Il hook chiedeva `Notification.requestPermission()` al mount. Safari lo blocca
senza un gesto dell'utente e Chrome lo penalizza, quindi la richiesta è rimasta
solo dentro l'azione esplicita che la giustifica. Accanto al bottone di prova
c'è una riga onesta: i promemoria funzionano solo con l'app aperta.

## 5. Aggiornamenti della PWA

`registerType: 'autoUpdate'` più `skipWaiting`/`clientsClaim` e un listener
`controllerchange` che chiamava `window.location.reload()` volevano dire una
cosa sola: a ogni deploy l'app si ricaricava da sola, anche a metà di una serie.

Adesso il service worker nuovo resta in attesa e compare una pill "Nuova versione
disponibile — Aggiorna". Il ricaricamento lo decide chi sta usando l'app.

## 6. iOS e lo zoom sugli input

iOS Safari ingrandisce la pagina al focus di un input con font-size effettivo
sotto i 16px, e nel codebase ce n'erano sette. Sono stati portati tutti a 16px
ricalibrando padding e altezza per non perdere la densità visiva. Dove lo stile
era inline ed era necessario distinguere telefono e desktop, è passato in una
classe di `globals.css`, che le media query le sa usare.

Quello che **non** si è fatto: `user-scalable=no`. Toglie lo zoom a chi ne ha
bisogno per leggere, che è un prezzo troppo alto per un fastidio estetico.

## 7. Allegati delle schede su Storage

`EditSchedaModal` salvava l'allegato come base64 dentro lo store: le immagini
compresse a 900px e JPEG 0.72, ma i PDF **grezzi**, fino a 4 MB. Quel blob finiva
in localStorage, che sta sotto i 5 MB — un `QuotaExceededError` e `persist`
smette di salvare — e risaliva in cloud per intero a ogni sync.

Gli allegati sono passati su un bucket privato di Supabase Storage, letti con
signed URL a scadenza. I campi `photoPath`/`photoMime` si affiancano al vecchio
`photo`, che resta come legacy: le schede già salvate continuano a funzionare, e
la migrazione avviene quando si apre la scheda, in background e best-effort — se
fallisce si tiene il base64 e non si blocca niente. Sostituire un allegato
cancella il precedente; cancellare una scheda cancella il suo file.

Le istruzioni per creare il bucket e le sue policy stanno in
[SETUP-STORAGE.md](SETUP-STORAGE.md): sono un passaggio da fare una volta dalla
dashboard, e nessun codice può farlo al posto tuo.

## 8. Task ricorrenti

Le task del tab "Ricorrenti" salvavano `periodicity` e `repeatCount`, ma niente
le rimetteva in piedi dopo il completamento: l'unico reset esistente era quello
delle quotidiane. Erano ricorrenti solo di nome.

`resetRecurringIfNeeded` è agganciata agli stessi trigger delle quotidiane —
cambio giorno, `visibilitychange`, focus, interval — ed è idempotente nello
stesso giorno. Una task torna aperta quando è passato il suo periodo dal
`doneAt` (settimanale +7 giorni, mensile stesso giorno del mese dopo con clamp a
fine mese, annuale +1 anno), scalando `repeatCount`; a zero il ciclo è esaurito e
la task resta chiusa. `repeatCount` è stato interpretato come "ripetizioni
rimanenti".

*Questa parte è uscita dall'app insieme alla scheda Attività.*

## 9. Performance

Due interventi, nessuno dei due visibile a schermo.

`useStore()` restituiva l'intero stato, quindi ogni componente che lo usava si
ridisegnava a ogni cambiamento di qualunque cosa. I componenti principali sono
passati a selettori granulari (`useJarvisStore(s => s.todos)`), con `useShallow`
dove serve leggere più campi insieme; `useStore` è rimasto per il resto.

E `JarvisGym.tsx`, arrivato a 2.500 righe, è stato spezzato per livelli di
dipendenza: i modali usano i grafici e le statistiche usano un modale, quindi le
primitive stanno in fondo alla catena e nessuno dei file si importa a vicenda.
Refactor puramente strutturale.

## 10. Grafica e accessibilità

Micro-interventi, niente redesign:

- i testi sotto i 10px — ce n'erano a 7, 7,5, 8 e 9 — sono saliti tutti a 10,
  allargando il contenitore dove il bump lo richiedeva;
- il token `NUC.mono` è diventato `NUC.label`. Il nome vecchio mentiva: puntava a
  DM Sans, non a un monospace, e faceva perdere tempo a chiunque lo leggesse;
- `JModal` e `ConfirmModal` hanno `role="dialog"`, `aria-modal`, `aria-labelledby`
  sul titolo, focus trap con Tab ciclico, ripristino del focus all'elemento che
  li ha aperti e blocco dello scroll sotto.

---

Alla fine: `npm run build`, `npm test` e `npm run lint` verdi, e due cose che
restavano da fare a mano — la creazione del bucket Storage con le sue policy, e
una prova su un iPhone vero per lo zoom degli input e il permesso notifiche, che
in un browser desktop non si verificano davvero.
