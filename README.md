# Matteo

PWA in italiano e inglese per allenarsi in palestra: **schede**, **alzate** e
**massimali**, un **carico consigliato** a ogni esercizio mentre esegui una
scheda, e il **Coaching**, dove un allenatore segue i suoi allievi — guarda i
loro allenamenti, assegna schede, corregge le alzate scritte male e ci parla in
chat, con le notifiche push. Hyrox c'è, ma è spento.

Funziona offline, si installa sulla schermata Home e sincronizza su Supabase.
Ogni account ha il suo blob di stato, sincronizzato su più dispositivi; quello
che due account si scambiano — schede assegnate, note, messaggi, correzioni,
profili — vive in tabelle a parte.

| | |
|---|---|
| **Stack** | React 18 · TypeScript strict · Vite 5 · Tailwind · Zustand · Supabase (Auth, Postgres, una Edge Function) |
| **Bundle** | 120 kB gzip d'ingresso (più 6 kB di CSS), feature in chunk lazy: il più grosso, 47 kB, è il codice che Allenamento e Coaching hanno in comune |
| **Qualità** | 768 test Vitest · ESLint `--max-warnings 0` · `tsc` strict, tutti in CI |

---

## Cosa fa

### La schermata d'ingresso

L'app si apre sull'allenamento. Non c'è una home a parte né una barra di
navigazione: è una schermata sola, fatta per stare dentro lo schermo di un
telefono senza scorrere. Dall'alto:

- la **testata**: la data, il saluto col nome, e i tre comandi che valgono
  ovunque — ricerca, profilo, impostazioni;
- **la tua settimana**: sette celle da lunedì a domenica. Oggi è la cella piena
  d'inchiostro, un giorno in cui ti sei allenato ha la barra d'accento sotto. La
  settimana del calendario e non "gli ultimi 7 giorni": "come sta andando la mia
  settimana" si legge da lunedì. Dopo due giorni di fermo una riga dice da
  quanto; oltre i dieci lo dice nel colore degli avvisi, perché è la stessa
  soglia dello stop nel carico consigliato. Toccandola si apre il
  **calendario degli allenamenti**: un mese alla volta, le settimane di fila, e
  per ogni giorno le schede eseguite e le alzate registrate a parte;
- la barra dell'**allenamento in corso**, se ne hai lasciato uno aperto: un
  tocco e sei dov'eri;
- tre card — **Coaching**, **Esercizi**, **Statistiche** — che aprono ognuna una
  pagina sopra questa;
- **la scheda di oggi**, col tasto per cominciare. Le schede non hanno un giorno
  della settimana, si girano (A, B, C, poi di nuovo A): la prossima è quella che
  non fai da più tempo, e prima ancora quelle mai fatte.

Le pagine si posano una sull'altra — i gruppi, un gruppo, un esercizio — e
quelle coperte restano montate: tornando indietro la pagina sotto è com'era,
scorrimento compreso. Da desktop è la stessa pagina, una colonna al centro,
ingrandita.

### Allenamento

- **Esercizi per gruppo muscolare**: gli otto di serie (petto, dorso, gambe…) e
  quelli che crei tu, ognuno con la sua figura e il suo colore. Al primo accesso
  c'è già un **catalogo** di esercizi veri, con la marca del macchinario nel
  nome: «Panca piana al MPW» e la panca di un'altra macchina non si caricano
  uguale, e chiamate allo stesso modo finirebbero in un unico storico di numeri
  non confrontabili. Ogni esercizio ha lo storico per anno e mese, le tue note,
  la foto quando c'è, e una freccia di **tendenza** che confronta l'ultima alzata
  con la media delle tre prima (sotto l'1,5% è "invariato": un chilo su un
  massimale da cento è rumore).
- **Registrazione di un'alzata** con serie × colpi × carico, e **peso e colpi
  diversi per singola serie**. Esercizi **a corpo libero**: il campo `kg` è la
  sola zavorra, e si somma la parte di peso corporeo che l'esercizio fa davvero
  sollevare — tutto nelle trazioni, il 65% nei piegamenti, niente negli
  addominali, che si misurano a colpi. Il **peso dell'attrezzo a vuoto**
  (bilanciere, carrello del multipower) si dice una volta: da lì si scrivono i
  soli dischi, e storico, massimali e grafici mostrano il totale. Il
  **massimale dichiarato** è una singola provata davvero, e non si stima: è
  quel carico.
- **Numeri che non si accettano**: l'impossibile non si salva (oltre 500 kg, 100
  colpi, 20 serie), l'improbabile si conferma — più del doppio o meno della metà
  dell'ultima alzata. Bloccarlo no: i salti veri esistono, e un'app che li
  rifiuta insegna a scrivere numeri falsi per farla contenta.
- **Massimale stimato (1RM)** con la formula di Epley — `carico × (1 + colpi/30)`:
  è la metrica con cui l'app ordina record e miglior alzata, perché mette sulla
  stessa scala serie con ripetizioni diverse (50 kg × 8 vale più di 40 × 15,
  al contrario del volume). Con pesi diversi per serie conta la serie migliore.
- **Svuota memoria**: azzera lo storico di un esercizio tenendone nome, gruppo e
  colore, per ripartire da zero dopo uno stop o un cambio di esecuzione. Dalle
  impostazioni lo stesso, su tutti gli esercizi insieme.
- **Il momento del record**: quando un'alzata batte il massimale stimato di tutte
  le precedenti su quell'esercizio, un modale lo dice subito — anche più d'uno
  insieme, a fine sessione da scheda. La prima alzata di un esercizio non conta:
  non ha battuto niente.
- **Traguardi**: medaglie *derivate* dallo storico, non salvate da nessuna parte —
  una medaglia memorizzata può desincronizzarsi dai dati che la motivano, una
  ricalcolata no. Quelle chiuse restano visibili in grigio con il loro obiettivo.

### Schede d'allenamento

Le crei, le avvii, spunti le serie mentre ti alleni, e a fine sessione le spunte
diventano vere alzate nello storico degli esercizi collegati.

- **L'elenco** le raggruppa per mese, e di ognuna dice da quanto esiste, quanto
  dura (stimata da serie, colpi e recuperi) e che gruppi muscolari tocca:
  "Giovedì · 11 esercizi" non diceva se era il giorno delle gambe né se stava
  nell'ora che si ha. Superset, riordino, e il salvataggio come bozza quando
  manca qualcosa. Un **report muscolare** aggrega tutte le schede e dice quali
  gruppi stai colpendo e quanto.
- **In allenamento** ogni esercizio arriva col peso dell'ultima volta già scritto
  e i colpi dell'obiettivo della scheda, le note della volta prima sopra le
  serie (è prima di caricare il bilanciere che serve sapere "sedile al 4"), e il
  **timer di recupero**: un quadrante da un minuto e mezzo che, arrivato a zero,
  conta in su quanto stai aspettando oltre. Non spunta la serie da solo: il
  recupero è proprio il momento in cui la si registra coi numeri veri.
- **Il carico consigliato**: guardando com'è andata l'ultima volta con quella
  scheda, una card dentro l'esercizio propone il peso di oggi e dice sempre
  perché — si sale di poco (mai più di 2,5 kg) quando tutto è andato, si scende
  quando una serie è saltata o rimasta corta, si resta dopo uno stop, su un
  esercizio nuovo o quando oggi il muscolo arriva più stanco. "Usa" lo scrive
  sulle serie ancora da fare. Le regole, in ordine e con i casi che non copre,
  stanno in [docs/CARICHI.txt](docs/CARICHI.txt).
- **L'allenamento a metà** sta in `localStorage` finché non lo chiudi: una
  ricarica, il tasto indietro premuto per sbaglio, iOS che scarta la pagina
  mentre il telefono è in tasca fra due serie — in palestra non sono casi
  limite, ed è per questo che non lo perdono. Non va nello store: una sessione a
  metà è un appunto di questo telefono, non un dato.
- **Ogni alzata fatta da una scheda** si porta dietro cosa la scheda chiedeva
  quel giorno, in che ordine veniva e quanto è durato l'allenamento: una scheda
  si modifica, e senza questo l'allenamento di ieri verrebbe giudicato col
  programma di oggi.

### Statistiche

Una pagina a sé. In cima il riepilogo: le settimane di fila e le sessioni di
questa settimana, la **mappa della forza** e i **massimali ipotetici**.

- **Mappa della forza**: una sagoma del corpo, fronte e retro, con ogni distretto
  colorato su quattro livelli. La scala è il massimale sul **peso corporeo**, con
  soglie **diverse per distretto** (e per sesso) — servono 1.10× per un "base"
  sulle gambe e 0.35× per lo stesso grado sui bicipiti — perché i chili di due
  distretti non sono confrontabili: uno squat da 100 kg e un curl da 25 sono
  entrambi buoni. Un esercizio con due gruppi conta per intero sul primario e a
  metà sul secondario.
- **Massimali ipotetici**: squat, panca e stacco, e il loro total rapportato al
  tuo peso — il modo in cui la forza si racconta fuori da questa app. Ognuno dice
  da dove viene: dichiarato, stimato da una serie a ripetizioni, o ricavato dal
  distretto per chi quell'esercizio non lo fa.
- Sotto, il **volume** o gli **allenamenti per muscolo** (chili spostati o giorni
  in cui l'hai allenato: domande diverse), i traguardi, i **record personali**
  per distretto, e per ogni esercizio due grafici con assi veri — carico e
  massimale stimato in ordinata, la data dell'alzata in ascissa, i chili scritti
  sopra ogni pallino. Le etichette si diradano a passo uniforme solo quando due
  finirebbero l'una sull'altra.

La **ricerca globale** (la lente in testata) cerca su esercizi e schede,
ignorando accenti e maiuscole, e porta dove sta la cosa trovata: l'esercizio
dentro il suo gruppo, la scheda nel suo elenco.

### Hyrox, spento

Dal 6 ottobre 2026 Hyrox non si vede: l'app è solo palestra finché quella parte
non trova una forma che convince. È spento, non tolto. L'interruttore è una riga,
`HYROX_ATTIVO` in [src/features/gym/hyroxAttivo.ts](src/features/gym/hyroxAttivo.ts):
spento, non c'è il selettore «Pesi | Hyrox», le stazioni non compaiono nella
ricerca e le sessioni già registrate non contano come giorni allenati. I dati
(`hyroxExercises`, `hyroxGare`) restano nello store e nel cloud, e riaccendendo
tornano tutti. Il codice resta com'è — le otto stazioni più la corsa, i tempi
con il passo per km / 500 m / colpi al minuto, intera o mezza distanza, le gare
e le simulazioni registrate, e un tempo di gara stimato come somma dei tuoi
migliori tempi segmento per segmento — e i suoi test girano accendendo
l'interruttore con un `vi.mock`.

### Coaching

Due account si collegano con un codice generato dall'ALLIEVO e inserito
dall'allenatore, mai nel verso opposto: chi condivide i propri dati deve essere
quello che compie il gesto, e non ritrovarseli condivisi da una richiesta
accettata di fretta. Il codice scade dopo sette giorni, si consuma alla prima
volta, e non contiene 0/O né 1/I/L, perché si detta a voce o si copia da uno
screenshot. Un allievo ha un allenatore per volta, e la regola sta nel database.

La stessa persona può stare da tutte e due le parti — chi allena si allena
anche — e la pagina (aperta dalla card **Coaching**) ne ha due sezioni: chi ti
segue, con il suo profilo e la chat, e chi segui tu. Dalla pagina di un allievo
l'allenatore:

- **guarda**, in sola lettura: allenamenti e settimana, curva del peso, volume
  per settimana, forza per distretto, migliori alzate. Le **sessioni** giornata
  per giornata, confrontate con la scheda com'era *quel giorno*: esercizi
  saltati, serie mancanti, serie sotto i colpi, carichi saliti o scesi. Il
  **confronto** fra due allenamenti scelti da lui. I **grafici** esercizio per
  esercizio. I calcoli sono gli stessi della propria scheda: due formule diverse
  per "quanto sei forte" a seconda di chi guarda sarebbero due app che non si
  parlano;
- **assegna schede**, scritte con lo stesso form delle proprie, o **condivide**
  una delle sue: l'allievo le trova nel suo elenco col nome di chi gliele ha
  mandate, le esegue, e non le riscrive — sono il lavoro di un altro;
- **scrive note** sugli esercizi dell'allievo, che lui ritrova nella pagina
  dell'esercizio;
- **corregge un'alzata** scritta male. Non scrive nei dati dell'allievo: lascia
  la correzione in una tabella, e ad applicarla è l'app dell'allievo alla
  prossima apertura (vedi *Le tabelle condivise*, più sotto). Intanto
  l'allenatore vede già il numero giusto, e sull'alzata resta scritto chi l'ha
  corretta.

**I messaggi.** Su una scheda assegnata l'allievo chiede dalla riga
dell'esercizio — "Chiedi info", "Sostituisci" — e la domanda resta attaccata a
quella riga: lo stesso scambio in chat, tre giorni dopo, non si sa più di quale
esercizio parlasse. L'allenatore legge le richieste raccolte per scheda e
risponde. Accanto c'è una **chat diretta** per ogni coppia, dove arrivano anche
gli avvisi che l'app scrive da sé: un allenamento finito (con una riga che dice
se c'è qualcosa da guardare), una scheda assegnata, una nota, una correzione,
un collegamento nuovo.

I messaggi si chiedono al server a giri — ogni 3 secondi con una conversazione
aperta, ogni 20 per il pallino rosso in home, niente a schermo spento — invece
che con il realtime di Supabase: quello sta in `@supabase/realtime-js`, il peso
che il client fatto a mano ha tolto (vedi sotto), e in palestra una connessione
persistente che cade e si riapre è una fonte di stati sbagliati in più.

**Le notifiche push** arrivano per ogni messaggio, anche ad app chiusa. Chi
scrive chiama la Edge Function [`notifica`](supabase/functions/notifica/index.ts)
con il solo id del messaggio; la funzione legge titolo, testo e destinatario dal
database — presi dalla richiesta, chiunque potrebbe mandare un testo qualsiasi
a chiunque — e manda solo se il messaggio è di chi chiama, il collegamento c'è
ancora e il messaggio ha meno di dieci minuti. Le riceve
[public/push-sw.js](public/push-sw.js), un pezzo aggiunto al service worker di
workbox. Sono accese di serie per quanto il browser lo permette: il permesso lo
deve dare la persona con un tocco, quindi l'app lo chiede una volta al primo
ingresso su ogni dispositivo, e chi le spegne dalle impostazioni resta spento.
Su iPhone il push esiste solo per l'app installata nella schermata Home.

**Il profilo pubblico** — nome, cognome, foto, età, da quando ti alleni, focus,
obiettivi, percorso, limitazioni, e per chi allena formazione ed esperienze — lo
vede chi è collegato a te, in uno dei due versi, e nessun altro. La foto si
sceglie dal telefono e parte già piccola: ritagliata al quadrato, 256 px, WebP
dove il browser lo sa scrivere, una ventina di kB. Sta nella colonna
`profili.foto` come data URL e non su Storage: un file così piccolo non vale un
bucket, le sue policy e una richiesta in più per ogni faccia di un elenco. Le
foto restano sul telefono e si riscaricano solo quando cambiano.

### Profilo e impostazioni

Le due icone in testata aprono due pagine diverse. Il **profilo**: nome, sesso,
data di nascita (l'età si calcola), altezza, il peso di oggi con lo storico delle
pesate e la sua direzione — è il denominatore di tutta la forza relativa, e la
curva che un allenatore guarda per prima — e il profilo pubblico. Le
**impostazioni**: lingua, notifiche, la memoria delle alzate, l'esportazione dei
propri dati in un file JSON, la password, e l'uscita dall'account — solo da
questo dispositivo, dopo aver spinto quello che c'era da spingere; quello che non
è riuscito a partire, e un allenamento lasciato a metà, restano da parte sul
telefono e si ritrovano rientrando.

### Aspetto e accessibilità

- **Un tema solo** (rebranding di ottobre 2026): fondo cemento `#F1F1EF`, card
  bianche col bordo d'inchiostro da 2 px, inchiostro `#141414`, e un solo
  accento rosso-arancio `#E4472B` per tutto ciò che chiede attenzione — il gesto
  principale, un giorno fatto, un calo, un errore, un "elimina". Barlow
  Condensed per titoli, numeri ed etichette, quasi sempre in maiuscolo; Barlow
  per il testo che si legge riga per riga. Angoli vivi ovunque, card piatte, e
  un'ombra sola, quella del tasto principale: così un'ombra vuol dire sempre
  "questo è il gesto". Erano quattro layout per tre palette per chiaro e scuro,
  e ogni tasto andava guardato in una dozzina di combinazioni. I campi del tema
  di prima (`layout`, `darkMode`, `accentColor`…) restano nel blob, non letti,
  finché sui telefoni ci sono versioni dell'app che li conoscono: toglierli li
  farebbe sparire e ricomparire dal cloud a ogni salvataggio dell'una e
  dell'altra.
- **Contrasto misurato, non promesso**: [src/test/contrast.test.ts](src/test/contrast.test.ts)
  legge i colori da `:root` in [globals.css](src/styles/globals.css) e verifica le
  coppie che l'app usa davvero — testo, secondario e accento come testo a 4.5:1
  sul fondo e sulle card, l'accento e il grigio chiaro sulla card nera. Il bianco
  sui tasti arancioni si ferma a 4.0:1, sopra la soglia delle scritte grandi
  (3:1): è una scelta di design, e per questo i tasti pieni scrivono in grande e
  in grassetto. I colori dei gruppi muscolari li sceglie l'utente, e quando fanno
  da testo o da fondo passano da `accentInkFor` e `accentFgFor`, che li spingono
  fino ad AA.
- **Due lingue**, italiano e inglese, dalle impostazioni. Cambia a schermata
  accesa, senza ricaricare, e segue l'account invece del dispositivo: chi sceglie
  l'inglese se lo ritrova anche aprendo l'app altrove. (Fino a ottobre 2026 la
  seconda lingua era il tedesco: chi l'aveva scelto passa all'inglese.)
- Focus trap, `Escape`, blocco scroll e ripristino del focus su tutti i dialog;
  `prefers-reduced-motion` rispettato; `<html lang>` segue la lingua scelta,
  perché è quello che dice al lettore di schermo con che pronuncia leggere.

---

## Come è fatto

**Client Supabase assemblato a mano** in [src/lib/supabase.ts](src/lib/supabase.ts)
invece di `createClient` di `@supabase/supabase-js`: quel pacchetto porta con sé
realtime, storage e functions, e pesa 52.8 kB gzip contro i 27 di `auth-js` +
`postgrest-js`. Storage l'app non lo usa; la Edge Function si chiama con una
`fetch` autenticata (`chiamaFunzione`), e al posto del realtime ci sono i giri
di `messaggiLive`.

**Sincronizzazione** — tutto lo stato utente vive in
[src/store/useJarvisStore.ts](src/store/useJarvisStore.ts) e viaggia in cloud
come blob unico, dal `CloudSyncBridge` in [src/App.tsx](src/App.tsx):

- debounce 1.5 s, un save alla volta, flush immediato su `visibilitychange` e
  `pagehide`; si salva solo se c'è davvero qualcosa da mandare, o un dispositivo
  con i dati vecchi diventerebbe "il più recente" solo perché è stato aperto;
- nessun errore in silenzio — un save fallito diventa una pill toccabile e
  riprova da solo;
- **con più dispositivi vince il più recente**: prima di scrivere il bridge
  rilegge l'`updated_at` remoto, e se qualcun altro ha salvato dopo di noi
  scarica il suo dato invece di sovrascriverlo, dicendolo all'utente. Ma quello
  che è stato **creato** qui e non era ancora salito — una scheda, un esercizio,
  le alzate di un allenamento appena finito — non si butta: lo recupera
  [src/lib/syncMerge.ts](src/lib/syncMerge.ts), che distingue "nato qui" da
  "cancellato altrove" confrontando con cosa c'era all'ultimo sync;
- **le modifiche fatte offline non vengono cancellate dal remoto stale**: due
  metadati persistiti (`lastSyncedAt`, `dirty`) in
  [src/lib/syncMeta.ts](src/lib/syncMeta.ts) distinguono "il remoto è cambiato
  davvero" da "il remoto è quello che conoscevo, ma ho lavoro locale da inviare";
- **il cloud si rilegge tornando sull'app** e quando torna la rete: una PWA sul
  telefono non si riavvia, resta aperta per giorni, e il conflitto si scopriva
  solo al primo salvataggio, cioè a fine allenamento;
- **un'app vecchia non salva**: chi salva scrive `versioneDati`, e una versione
  che trova nel cloud un numero più alto del suo si ferma e chiede di
  aggiornare. Altrimenti, passando lo stato dal suo filtro delle chiavi,
  toglierebbe dal cloud per tutti quello che non conosce;
- **senza rete si parte subito** dalla sessione salvata sul telefono e dai dati
  locali, invece di aspettare che il rinnovo dell'accesso si arrenda: nel
  seminterrato della palestra l'app prima non si apriva;
- **i dati sul telefono hanno un proprietario**: se entra un altro account si
  tolgono prima di caricare i suoi, e quello che chi esce non aveva ancora
  inviato si mette da parte sotto il suo id e gli torna al prossimo ingresso
  ([src/lib/proprietario.ts](src/lib/proprietario.ts)).

Lo stato in arrivo passa da `STATE_KEYS`, una lista chiusa di chiavi note: senza
quel filtro i campi delle schede rimosse in passato rientrerebbero a ogni avvio e
verrebbero risalvati per sempre. Il filtro lavora sul primo livello, quindi quello
che vive più in basso ha una potatura esplicita in `migrateNested`: il `rir`
dentro ogni voce di storico, l'immagine agganciata a mano agli esercizi, e il
vecchio contenitore `kcal`, da cui altezza e pesate escono prima che venga
scartato.

**Le tabelle condivise** — schede assegnate, note, messaggi e correzioni non
stanno nel blob, e non per gusto: `user_data.data` lo riscrive per intero l'app
del suo titolare a ogni salvataggio, partendo dalla copia che ha in memoria. Una
scheda scritta là dentro dall'allenatore sparirebbe al primo salvataggio
dell'allievo, senza un errore. Righe separate non hanno questo problema: le due
parti scrivono su oggetti diversi. (I profili hanno una tabella loro per due
motivi in più: esistono per farsi leggere da altri, mentre il blob lo legge solo
il suo titolare, e una foto nel blob viaggerebbe a ogni serie spuntata.)

Per la stessa ragione del blob riscritto per intero, l'allenatore non
*modifica* un'alzata: propone la correzione in `coach_correzioni`, e la applica
il `CorrezioniBridge` dell'allievo. Solo a caricamento dal cloud riuscito: un
istante prima lo store contiene quello che c'era sul telefono, e la correzione,
non trovando la sua alzata, verrebbe buttata. E dalla tabella si toglie solo
quando il dato corretto è arrivato al cloud.

**Cosa vede l'allenatore** lo decide il database e non il client
([supabase/coach_schema.sql](supabase/coach_schema.sql)): la riga `user_data` è
un blob unico con tutto lo stato dell'utente, e una policy RLS per riga
gliel'avrebbe dato tutto. Al suo posto c'è una funzione `SECURITY DEFINER`,
`athlete_training_data`, che ricompone un blob ridotto a quello che serve a chi
allena — esercizi e alzate, schede, pesate e pochi dati anagrafici — e solo per
chi è collegato: un filtro fatto nell'app sarebbe stato una cortesia
scavalcabile con una chiamata REST scritta a mano. Allo stesso modo le policy di schede, note e correzioni lasciano scrivere
l'allenatore solo finché il collegamento esiste, e sui messaggi ognuno può solo
accendere la propria spunta di lettura.

**Traduzione** ([src/lib/i18n.ts](src/lib/i18n.ts)) — la chiave è la frase
italiana, come in gettext: `t('Salva')`, non `t('profile.save')`. Con quasi
novecento stringhe, inventare altrettanti nomi simbolici avrebbe dato un
dizionario illeggibile e schermate che si rompono in silenzio quando una chiave
è scritta male; così il codice si legge senza saltare al dizionario, e una voce
mancante ricade sull'italiano invece di sparire.

La distinzione che conta è fra **interfaccia** e **dati**: gruppi muscolari ed
esercizi del catalogo non sono testo dell'app, sono stringhe copiate dentro lo
store al primo avvio, e il gruppo muscolare fa anche da chiave dei colori in
`muscleColors`. Restano italiani su disco e si traducono solo quando si stampano
(`tData`), con un dizionario separato: quello che l'utente ha scritto lui esce
sempre com'è stato scritto. Un test rilegge i sorgenti e fallisce se una `t()`
non ha la sua voce inglese, se una voce non è più agganciata a niente, o se una
traduzione perde per strada un segnaposto.

**Primo accesso** ([src/features/auth/FirstSetup.tsx](src/features/auth/FirstSetup.tsx))
— account nuovo, una domanda per schermata: nome, sesso, data di nascita, peso, e
l'altezza, l'unica facoltativa. L'età non si chiede, si calcola: due campi per la
stessa cosa possono contraddirsi, e un'età salvata a 27 anni resta 27 per sempre.
Il peso sì, subito: senza, la mappa della forza è vuota e le trazioni valgono
zero chili. Il questionario è sospeso se il caricamento cloud è fallito, o le
risposte verrebbero sovrascritte dal dato remoto al ritorno della rete.

**Aggiornamenti PWA** col pattern `prompt`: il nuovo service worker resta in
attesa e l'utente decide quando ricaricare — nessun reload a metà allenamento.
Una PWA però non si ricarica quasi mai, e il browser cerca versioni nuove solo al
caricamento: l'app lo chiede da sé ogni ora e a ogni ritorno in primo piano.

---

## Avvio rapido

```bash
npm install          # dipendenze
cp .env.example .env # poi compila le variabili qui sotto
npm run dev          # http://localhost:5173
```

### Variabili d'ambiente

```env
VITE_SUPABASE_URL=https://<tuo-progetto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_VAPID_PUBLIC_KEY=<chiave pubblica VAPID>
```

Le prime due sono obbligatorie: senza, il client Supabase si ferma all'import.
La terza accende le notifiche push; senza, l'app funziona lo stesso, con le
notifiche spente (vedi *Notifiche push* qui sotto).

Il `.env` è in `.gitignore` e ci deve restare, come qualunque file che contenga
un segreto: quelli vivono solo nei secret di Supabase
(`npx supabase secrets set …`), mai nel repo.

### Database

Gli schemi si eseguono dall'SQL Editor di Supabase, in quest'ordine:

1. [supabase_schema.sql](supabase_schema.sql) — la tabella `user_data` (un blob
   per utente) e la sua policy RLS.
2. [supabase/coach_schema.sql](supabase/coach_schema.sql) — il Coaching:
   collegamenti e codici, le funzioni `redeem_coach_code` e
   `athlete_training_data`, le schede assegnate (`coach_schede`), le note
   (`coach_note`), i messaggi (`coach_messaggi`), le correzioni
   (`coach_correzioni`) e i dispositivi iscritti alle notifiche
   (`push_iscrizioni`). È rieseguibile, e dopo un aggiornamento che vi aggiunge
   oggetti va ridato in pasto all'SQL Editor: finché manca una tabella, la parte
   dell'app che la usa resta vuota invece di rompersi.
3. [supabase/profili_schema.sql](supabase/profili_schema.sql) — i profili, con
   la foto; dopo `coach_schema.sql`, perché le regole di lettura guardano i
   collegamenti. Finché manca, il Coaching mostra i nomi copiati nel
   collegamento e nessuna foto.
4. [supabase/storico_schema.sql](supabase/storico_schema.sql) — facoltativo:
   una copia al giorno della riga `user_data` di ognuno, com'era prima della
   prima modifica della giornata, tenuta due settimane. L'app non la legge: serve
   a te, dalla dashboard, il giorno che a qualcuno spariscono i dati. La
   procedura per rimetterli a posto è scritta in cima al file.

### Notifiche push

1. Genera una coppia di chiavi: `npx web-push generate-vapid-keys`.
2. La pubblica va in `VITE_VAPID_PUBLIC_KEY` nel `.env`.
3. Nei secret delle Edge Functions di Supabase: `VAPID_PUBLIC_KEY` (la stessa),
   `VAPID_PRIVATE_KEY` (la privata, che sta solo lì) e `VAPID_SUBJECT` (un
   contatto, per esempio `mailto:tu@esempio.it`).
4. Pubblica la funzione [supabase/functions/notifica](supabase/functions/notifica/index.ts)
   con la CLI di Supabase (`npx supabase functions deploy notifica`).
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` li mette Supabase da sé.

Serve anche la tabella `push_iscrizioni`, che sta in `coach_schema.sql`. Se la
funzione non c'è, i messaggi partono lo stesso: la notifica è un di più, mai una
condizione.

### Immagini degli esercizi

Le illustrazioni stanno in `src/assets/esercizi/`, un file per esercizio, e si
vedono nella fascia in cima alla card nella **vista a griglia** e accanto
all'esercizio nelle schede. Vengono dal dataset gratuito di
**[RepDB](https://repdb.co)** — 512×512 WebP, stile flat, stesso personaggio e
stesso sfondo per tutte.

> **Exercise data by [RepDB](https://repdb.co)**

La licenza le concede per uso in-app anche commerciale a una condizione:
**attribuzione visibile**. Quella riga qui sopra e la riga in fondo alle
Impostazioni dell'app sono l'adempimento, non un ringraziamento — se saltano,
vanno tolte anche le immagini. Vietata invece la ridistribuzione come dataset o
raccolta di immagini: per questo [LICENSE](LICENSE) dice a chiare lettere che
MIT copre il codice e non `src/assets/esercizi/`, e per questo la cartella non
va mai esposta come archivio scaricabile.

Vietato anche darle in pasto a modelli generativi — restyling, style transfer,
fine-tuning. Chi disegna i pezzi mancanti **non deve usare queste come
riferimento**: si parte dalla descrizione dell'esercizio, non dall'immagine.

La copertura è **parziale e resta parziale**: gli esercizi senza illustrazione
tengono il disegno del gruppo muscolare, che è l'unica figura garantita per
ognuno — compreso quello che uno si inventa stasera. `npm run foto` normalizza
i nomi dei file e dice quali mancano. Come si aggiunge una foto è scritto in
[src/assets/esercizi/LEGGIMI.md](src/assets/esercizi/LEGGIMI.md).

Note storiche, per non ripercorrere strade già battute:

- Il primo giro usava [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (**Unlicense**, dominio pubblico: la licenza non era il problema). Tolto perché
  37 foto coprivano 37 esercizi su una lista che cresce, e la griglia restava
  metà fotografica e metà disegnata senza una regola visibile.
- Le figure di `hasaneyldrm/exercises-dataset` **non** sono utilizzabili: i dati
  testuali sono MIT, le immagini restano di Gym visual e vanno licenziate da loro.

### Azzeramento del catalogo

Il catalogo è cambiato per intero — nomi nuovi, con la marca del macchinario, e
una foto per ognuno — e i nomi vecchi a quelle foto non si agganciano. Invece di
far convivere i due insiemi in una lista doppia mezza illustrata,
[resetCatalogo.ts](src/features/gym/resetCatalogo.ts) rimette **una volta per
account** gli esercizi del catalogo e svuota le schede.

Tocca solo chi ha dati di **prima** del catalogo nuovo: un'alzata o una scheda
datate prima dell'11 settembre 2026, o senza data. A tutti gli altri — un account
nuovo, uno nato dopo — mette il marcatore e basta, e il catalogo se la palestra
è vuota. Bastava che mancasse il marcatore, prima: e mancava anche a un account
nuovo il cui primo caricamento era fallito, che al riavvio dopo si vedeva
cancellare le schede appena create.

Quando scatta cancella `palestraExercises` (quindi tutte le alzate, e con esse
massimali, record e grafici, che da quelle sono derivati) e `gymSchede`. Non
tocca dati personali, pesate, Hyrox, colori dei gruppi e preferenze.

Due cose lo tengono in piedi. Scatta **dopo** il caricamento dal cloud e mai prima:
il blob remoto è un oggetto unico e vince il più recente, quindi azzerare sul
locale e poi ricevere il remoto rimetterebbe dentro tutto. E **non scatta** finché
il cloud non ha risposto: non sapendo cosa c'è davvero, un azzeramento spinto al
buio cancellerebbe dati che nessuno ha letto.

Prima di sostituire, lo stato di prima finisce in `localStorage` sotto
`jarvis-scorta-pre-<azzeramento>-<id utente>`: resta sul dispositivo dov'è
successo, non va nel cloud, non scade, ed è una per account. Un azzeramento che
parte da solo all'avvio deve poter essere disfatto da chi se lo trova fatto: la
scorta finisce nel file di **Esporta i miei dati** (impostazioni), sotto
`primaDelCatalogoNuovo`, accanto allo stato di adesso.

### Script

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Type-check + build di produzione (`dist/`) |
| `npm run preview` | Preview della build |
| `npm run lint` | ESLint su TS/TSX (`--max-warnings 0`) |
| `npm run format` | Prettier su `src/` |
| `npm test` | Test Vitest (single run) |
| `npm run test:watch` | Test Vitest in watch |
| `npm run foto` | Normalizza i nomi in `src/assets/esercizi/` e dice quali esercizi sono senza immagine |

CI su ogni push e PR: [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Struttura

```
.
├── index.html              # meta, font (Barlow e Barlow Condensed), icone
├── vite.config.ts          # build e PWA: manifest, workbox, push-sw.js
├── vercel.json             # ogni percorso torna a index.html
├── public/                 # icone (192, 512 anche maskable, apple-touch, favicon) e push-sw.js
├── scripts/foto-esercizi.mjs   # npm run foto
├── supabase_schema.sql     # user_data + RLS
├── supabase/
│   ├── coach_schema.sql    # collegamenti, codici, schede, note, messaggi, correzioni, push
│   ├── profili_schema.sql  # profilo pubblico e foto
│   ├── storico_schema.sql  # una copia al giorno di user_data (facoltativo)
│   └── functions/notifica/ # Edge Function delle notifiche push
├── docs/                   # CARICHI.txt e due documenti storici
└── src/
    ├── App.tsx             # shell, CloudSyncBridge, CorrezioniBridge, pill di sync, overlay
    ├── main.tsx            # bootstrap React
    ├── assets/esercizi/    # le illustrazioni RepDB (+ LEGGIMI.md)
    ├── components/
    │   ├── ui/             # Primitives (JModal), NucComponents, Icons, Avatar,
    │   │                   # Cronologia, Pila, SalutoHeader
    │   └── ErrorBoundary · ConfirmModal · InstallBanner · InvitoNotifiche · UpdateToast
    ├── features/
    │   ├── gym/            # Allenamento — vedi sotto
    │   ├── dashboard/      # la settimana, il calendario, il riepilogo delle statistiche
    │   ├── coach/          # Coaching: codici, allievi, sessioni, confronto, grafici, messaggi
    │   ├── profile/        # profilo, impostazioni, profilo pubblico
    │   ├── search/         # ricerca globale
    │   ├── auth/           # accesso, iscrizione, password; le domande del primo accesso
    │   └── boot/           # l'animazione d'avvio
    ├── hooks/              # useModalA11y, useIsDesktop, useConfirmDelete
    ├── lib/                # supabase, cloudSync, syncMeta, syncMerge, syncStatus,
    │                       # proprietario, uscita, aggiornamento; coach, correzioni,
    │                       # messaggi, messaggiLive, push, profili, fotoProfilo;
    │                       # i18n (+ i18n.en, il dizionario inglese), isoDate,
    │                       # dateFormat, cronologia, campi, jarvis-tokens, uid, safeStorage
    ├── store/useJarvisStore.ts
    ├── styles/globals.css  # il tema (token in :root) + base Tailwind
    └── test/               # Vitest — logica pura e rendering
```

La sezione Allenamento è divisa per livelli, in ordine di dipendenza: i modali
usano i grafici, le schede e le statistiche usano i modali, e il Coaching riusa
il form delle schede e la correzione dello storico. Le primitive stanno in fondo
alla catena, e nessuno dei file si importa a vicenda.

```
gymModel.ts            calcoli e costanti (1RM, volume, pace, record) — nessun React, testato
gymStrength.ts         forza per distretto e traguardi — puro, testato
gymMaxLifts.ts         squat, panca, stacco e il total — puro, testato
caricoConsigliato.ts   il carico consigliato (le regole a parole: docs/CARICHI.txt)
limitiAlzata.ts        numeri impossibili e improbabili
anteprimaScheda.ts     muscoli toccati, durata stimata, la scheda di oggi
sessioneInCorso.ts     l'allenamento a metà, in localStorage, e il timer di recupero
catalogo.ts            il catalogo di partenza e la quota di peso corporeo
eserciziFoto.ts        le foto, agganciate per nome
resetCatalogo.ts       l'azzeramento una volta per account
hyroxAttivo.ts         l'interruttore di Hyrox (spento)
gymHooks.ts            useBodyWeight, useSchedaDiOggi, useGruppiMuscolari, …
gymShared.tsx          LineChart, la faccia di un esercizio, il menù delle azioni
gymModals.tsx          registra alzata, aggiungi/modifica esercizio, correggi storico, record
GymHyrox.tsx           stazioni, gara, stima (spento)
GymSchede.tsx          schede: elenco, form, dettaglio, allenamento, report
JarvisGym.tsx          la schermata d'ingresso, gli esercizi, le statistiche
```

La logica che vale la pena testare senza montare React vive in file puri —
`gymModel`, `gymStrength`, `gymMaxLifts`, `caricoConsigliato`, `limitiAlzata`,
`anteprimaScheda`, `analisiSessioni`, `hyroxStima`, `correzioni`, `syncMeta`,
`syncMerge`, `cronologia`, `isoDate`, `dateFormat` — ed è lì che stanno la
maggior parte dei test. Gli altri montano le schermate con Testing Library: la
home, le schede, l'allenamento, il Coaching, la chat e le notifiche.

---

## Documenti

[docs/CARICHI.txt](docs/CARICHI.txt) dice a parole come l'app ragiona sui carichi:
quando propone un peso, in che ordine applica le regole e dove ancora non arriva.
Va aggiornato ogni volta che una regola cambia.

[docs/REVISIONE.md](docs/REVISIONE.md) e [docs/COLOR-AUDIT.md](docs/COLOR-AUDIT.md)
descrivono interventi già eseguiti in passato: si leggono come cronaca, non come
documentazione dello stato attuale.

## Licenza

[MIT](LICENSE) per il codice.

Le illustrazioni in `src/assets/esercizi/` **no**: sono di
[RepDB](https://repdb.co), usate sotto la loro licenza gratuita (uso in-app con
attribuzione, niente ridistribuzione come dataset). Chi riusa questo repo riusa
il codice; per le immagini si rivolge a RepDB.

> Exercise data by [RepDB](https://repdb.co)
