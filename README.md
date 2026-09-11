# Matteo — Personal OS

PWA personale in italiano e tedesco: **allenamenti** (palestra e Hyrox) e una
**home** che apre sull'allenamento e riassume la settimana, più due strumenti a
parte — **Budget** e **Personal Coach** (fabbisogno calorico e andamento del peso).

Funziona offline, si installa sulla schermata Home e sincronizza su Supabase.
Un solo utente, un solo blob di stato, più dispositivi.

| | |
|---|---|
| **Stack** | React 18 · TypeScript strict · Vite 5 · Tailwind · Zustand · Supabase |
| **Bundle** | 94 kB gzip d'ingresso, feature in chunk lazy (21 kB la più grossa) |
| **Qualità** | 173 test Vitest · ESLint `--max-warnings 0` · `tsc` strict, tutti in CI |

---

## Cosa fa

### Allenamento

Tre schede — **Pesi**, **Hyrox**, **Stats** — sopra un modello di dati unico.

- **Esercizi per gruppo muscolare** (petto, dorso, gambe…), ognuno con storico,
  note di esecuzione e colore del gruppo personalizzabile.
- **Registrazione di un'alzata** con serie × ripetizioni × carico, **peso
  diverso per singola serie**, esercizi **a corpo libero** (il campo `kg` è la
  sola zavorra: il peso corporeo dal profilo viene sommato per non azzerare il
  volume) e **tecniche di intensità** (eccentrica lenta, isometria al picco,
  drop set…), che restano un'etichetta sull'alzata.
- **Massimale stimato (1RM)** con la formula di Epley — `carico × (1 + colpi/30)`:
  è la metrica con cui l'app ordina record e miglior alzata, perché mette sulla
  stessa scala serie con ripetizioni diverse (50 kg × 8 vale più di 40 × 15,
  al contrario del volume). Con pesi diversi per serie conta la serie migliore.
- **Svuota memoria**: azzera lo storico di un esercizio tenendone nome, gruppo e
  colore, per ripartire da zero dopo uno stop o un cambio di esecuzione.
- **Il momento del record**: quando un'alzata batte il massimale stimato di tutte
  le precedenti su quell'esercizio, un modale lo dice subito — anche più d'uno
  insieme, a fine sessione da scheda. La prima alzata di un esercizio non conta:
  non ha battuto niente.
- **Traguardi**: medaglie *derivate* dallo storico, non salvate da nessuna parte —
  una medaglia memorizzata può desincronizzarsi dai dati che la motivano, una
  ricalcolata no. Quelle chiuse restano visibili in grigio con il loro obiettivo.
- **Schede d'allenamento**: le crei, le avvii, spunti le serie mentre ti alleni
  con il peso dell'ultima volta già precompilato, e a fine sessione le spunte
  diventano vere alzate nello storico degli esercizi collegati. Superset,
  riordino, salvataggio come bozza se manca qualcosa. Un **report muscolare**
  aggrega tutte le schede e dice quali gruppi stai colpendo e quanto.
- **Hyrox**: le 8 stazioni di gara più la corsa sono predefinite; si registra un
  **tempo** (non un carico), con pace per km / 500 m / rep al minuto, e il
  **riepilogo gara** stima il tempo totale dalle medie per segmento.
- **Statistiche**: volume settimanale (settimane ISO), volume per muscolo,
  record personali, e per ogni esercizio due grafici con assi veri — carico e
  massimale stimato in ordinata, la data dell'alzata in ascissa, i chili scritti
  sopra ogni pallino. Le etichette si diradano a passo uniforme solo quando due
  finirebbero l'una sull'altra, e i due grafici ne mostrano sempre lo stesso numero.

### Home

In cima, fisso, il tasto **Alleniamoci**: porta dritto alla schermata di
allenamento. Non è un modulo — non si sposta e non si spegne.

Sotto, moduli **riordinabili e disattivabili** (l'ordine è una preferenza del
singolo dispositivo, non va in cloud):

- **La tua settimana**: i sette giorni da lunedì a domenica; quelli in cui ti sei
  allenato sono cerchi pieni, quelli ancora da venire tratteggiati.
- **Mappa della forza**: una sagoma del corpo, fronte e retro, con ogni distretto
  colorato su quattro livelli. La scala è il massimale sul **peso corporeo**, con
  soglie **diverse per distretto** — servono 1.10× per un "base" sulle gambe e
  0.35× per lo stesso grado sui bicipiti — perché i chili di due distretti non
  sono confrontabili: uno squat da 100 kg e un curl da 25 sono entrambi buoni.
  Un esercizio con due gruppi conta per intero sul primario e a metà sul secondario.
- **Forza**: il massimale stimato più alto, in chili e rapportato al tuo peso
  corporeo (`1.40×` = alzi una volta e mezza te stesso).
- **Ricerca globale** su esercizi e schede — accent-insensitive.
- **Riepilogo settimanale**: allenamenti e volume degli ultimi 7 giorni, con il
  confronto sui 7 precedenti e il dettaglio giorno per giorno.

### Strumenti

- **Budget** — stipendio, spese fisse, variabili e "grosse imminenti"; calcola
  quanto avanza al mese, quante spese grosse copre il risparmio a 12 mesi
  (greedy dalla più economica) e, per il **sogno da raggiungere**, in quanti mesi
  ci arrivi, quanto dovresti accantonare e se sei in tempo per la data voluta.
- **Personal Coach** — BMR con Mifflin-St Jeor, fabbisogno dal fattore di
  attività, calorie e proteine per l'obiettivo (definizione / mantenimento /
  massa), **trend del peso** come regressione lineare sulle pesate delle ultime
  4 settimane, e un verdetto che dipende dall'obiettivo: −0.8 %/settimana è
  ottimo in definizione e pessimo in massa.

Ogni numero calcolato ha una **ⓘ** che spiega cos'è, come si ottiene e cosa
*non* dice. Dove la costante è esportata, la spiegazione la interpola invece di
ripeterla: una guida scritta a mano diverge dal codice al primo tuning.

### Aspetto e accessibilità

- **3 palette** (Journal, Rosa, Malva) e **3 layout** (Standard, Notte, Nero),
  combinabili con l'interruttore chiaro/scuro.
- Contrasto **AA garantito per costruzione**: `accentInkFor` e `accentFgFor`
  spingono l'accent lontano dalla superficie finché non supera 4.5:1, e un test
  lo verifica su tutte le palette in entrambi i temi.
- **3 stili di navigazione** su mobile (hub fluttuante, barra, rail laterale) e
  sidebar su desktop. Su desktop la sidebar raccoglie anche profilo, strumenti e
  impostazioni dei moduli: è una colonna sempre presente accanto al contenuto, e
  ripetere gli stessi comandi dentro la pagina significava due posti dove cercare
  la stessa cosa. Su mobile, dove la sidebar non c'è, restano in cima alla home.
- **Due lingue**, italiano e tedesco, con le bandiere nelle impostazioni. Cambia
  a schermata accesa, senza ricaricare, e segue l'account invece del dispositivo:
  chi sceglie il tedesco se lo ritrova anche aprendo l'app altrove.
- Focus trap, `Escape`, blocco scroll e ripristino del focus su tutti i dialog;
  `prefers-reduced-motion` rispettato.

---

## Come è fatto

**Design system "Journal"** — sfondo carta avorio con righe da quaderno, angoli
squadrati e ombre piene, Space Grotesk per i titoli, DM Sans per il resto, verde
copertina come accent (oro in dark mode).

**Client Supabase assemblato a mano** in [src/lib/supabase.ts](src/lib/supabase.ts)
invece di `createClient` di `@supabase/supabase-js`: quel pacchetto porta con sé
realtime, storage e functions, che qui non si usano, e pesava metà del chunk
d'ingresso (52.8 kB gzip contro i 27 di `auth-js` + `postgrest-js`).

**Sincronizzazione** — tutto lo stato utente vive in
[src/store/useJarvisStore.ts](src/store/useJarvisStore.ts) e viaggia in cloud
come blob unico, dal `CloudSyncBridge` in [src/App.tsx](src/App.tsx):

- debounce 1.5 s, un save alla volta, flush immediato su `visibilitychange` e
  `pagehide`;
- nessun errore in silenzio — un save fallito diventa una pill toccabile e
  riprova da solo;
- **con più dispositivi vince il più recente**: prima di scrivere il bridge
  rilegge l'`updated_at` remoto, e se qualcun altro ha salvato dopo di noi
  scarica il suo dato invece di sovrascriverlo, dicendolo all'utente;
- **le modifiche fatte offline non vengono cancellate dal remoto stale**: due
  metadati persistiti (`lastSyncedAt`, `dirty`) in
  [src/lib/syncMeta.ts](src/lib/syncMeta.ts) distinguono "il remoto è cambiato
  davvero" da "il remoto è quello che conoscevo, ma ho lavoro locale da inviare".

Lo stato in arrivo passa da `STATE_KEYS`, una lista chiusa di chiavi note: senza
quel filtro i campi delle schede rimosse in passato rientrerebbero a ogni avvio e
verrebbero risalvati per sempre. Il filtro lavora sul primo livello, quindi due
campi rimossi più in basso hanno una potatura esplicita in `migrateNested`: il
`rir` dentro ogni voce di storico, e l'altezza, salita da `kcal` al profilo.

**Traduzione** ([src/lib/i18n.ts](src/lib/i18n.ts)) — la chiave è la frase
italiana, come in gettext: `t('Salva')`, non `t('profile.save')`. Con seicento
stringhe, inventare altrettanti nomi simbolici avrebbe dato un dizionario
illeggibile e schermate che si rompono in silenzio quando una chiave è scritta
male; così il codice si legge senza saltare al dizionario, e una voce mancante
ricade sull'italiano invece di sparire.

La distinzione che conta è fra **interfaccia** e **dati**: gruppi muscolari ed
esercizi del catalogo non sono testo dell'app, sono stringhe copiate dentro lo
store al primo avvio, e il gruppo muscolare fa anche da chiave dei colori in
`muscleColors`. Restano italiani su disco e si traducono solo quando si stampano
(`tData`), con un dizionario separato: quello che l'utente ha scritto lui esce
sempre com'è stato scritto. Un test rilegge i sorgenti e fallisce se una `t()`
non ha la sua voce tedesca, se una voce non è più agganciata a niente, o se una
traduzione perde per strada un segnaposto.

**Personal Coach** — due account si collegano con un codice generato
dall'ATLETA e riscattato dall'allenatore, mai nel verso opposto: chi condivide i
propri dati deve essere quello che compie il gesto. Da lì l'allenatore vede
allenamenti, volume, curva del peso e forza per distretto, **in sola lettura**.
Ha preso il posto della vecchia scheda con lo stesso nome, che calcolava
fabbisogno calorico, proteine e obiettivo di peso: Matteo misura la forza, non la
dieta. Delle pesate è rimasto lo storico — è il denominatore di tutta la forza
relativa — e vive nel profilo, accanto al peso di oggi.
Il filtro su cosa esce sta nel database e non nel client
([supabase/coach_schema.sql](supabase/coach_schema.sql)): la riga `user_data` è
un blob unico che contiene anche stipendio e spese, quindi una policy RLS per
riga avrebbe dato al trainer le finanze dell'allievo. Al suo posto c'è una
funzione `SECURITY DEFINER` che ricompone un blob ridotto ai soli campi
dell'allenamento — un filtro fatto nell'app sarebbe stato una cortesia
scavalcabile con una chiamata REST scritta a mano.

**Spiegazioni contestuali** ([src/components/CoachMark.tsx](src/components/CoachMark.tsx))
— alla prima apertura di ogni funzione sale dal basso un popup che dice cosa ci
si fa, e poi mai più. Ha sostituito il tutorial d'ingresso, che arrivava prima
che l'utente avesse visto qualcosa e si chiudeva senza leggerlo. Gli id già visti
stanno in `onboardingSeen`, quindi viaggiano col cloud; dal profilo si azzerano.

**Primo accesso** ([src/features/auth/FirstSetup.tsx](src/features/auth/FirstSetup.tsx))
— account nuovo, cinque domande: nome, sesso, data di nascita, peso, altezza.
L'età non si chiede, si calcola: due campi per la stessa cosa possono
contraddirsi, e un'età salvata a 27 anni resta 27 per sempre. Il questionario è
sospeso se il caricamento cloud è fallito, o le risposte verrebbero sovrascritte
dal dato remoto al ritorno della rete.

**Aggiornamenti PWA** col pattern `prompt`: il nuovo service worker resta in
attesa e l'utente decide quando ricaricare — nessun reload a metà allenamento.

---

## Avvio rapido

```bash
npm install          # dipendenze
cp .env.example .env # poi compila le due variabili qui sotto
npm run dev          # http://localhost:5173
```

### Variabili d'ambiente

```env
VITE_SUPABASE_URL=https://<tuo-progetto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
```

Il `.env` è in `.gitignore` e ci deve restare, come qualunque file che contenga
un segreto: quelli vivono solo nei secret di Supabase
(`npx supabase secrets set …`), mai nel repo.

Lo schema della tabella `user_data` e le policy RLS sono in
[supabase_schema.sql](supabase_schema.sql); il collegamento allenatore ⇄ atleta
(tabelle, policy e le due funzioni `SECURITY DEFINER`) è in
[supabase/coach_schema.sql](supabase/coach_schema.sql), da eseguire dopo il
primo. Quel file è rieseguibile: dopo un aggiornamento che vi aggiunge oggetti
— come la tabella `coach_schede`, le schede che un allenatore assegna a un
allievo — va ridato in pasto all'SQL Editor, altrimenti la funzione nuova resta
spenta nell'app (che se ne accorge e non si rompe: la sezione resta vuota). Per gli allegati su Storage vedi
[docs/SETUP-STORAGE.md](docs/SETUP-STORAGE.md).

### Immagini degli esercizi

Le illustrazioni stanno in `src/assets/esercizi/`, un file per esercizio, e si
vedono nella fascia in cima alla card nella **vista a griglia**. Vengono dal
dataset gratuito di **[RepDB](https://repdb.co)** — 512×512 WebP, stile flat,
stesso personaggio e stesso sfondo per tutte.

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
i nomi dei file e dice quali mancano.

Note storiche, per non ripercorrere strade già battute:

- Il primo giro usava [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (**Unlicense**, dominio pubblico: la licenza non era il problema). Tolto perché
  37 foto coprivano 37 esercizi su una lista che cresce, e la griglia restava
  metà fotografica e metà disegnata senza una regola visibile.
- Le figure di `hasaneyldrm/exercises-dataset` **non** sono utilizzabili: i dati
  testuali sono MIT, le immagini restano di Gym visual e vanno licenziate da loro.

### Script

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server con HMR |
| `npm run build` | Type-check + build di produzione (`dist/`) |
| `npm run preview` | Preview della build |
| `npm run lint` | ESLint su TS/TSX (`--max-warnings 0`) |
| `npm run format` | Prettier su `src/` |
| `npm test` | Test Vitest (single run) |
| `npm run foto` | Normalizza i nomi in `src/assets/esercizi/` e dice quali esercizi sono senza immagine |

CI su ogni push e PR: [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Struttura

```
src/
├── App.tsx              # Shell, routing per-tab, CloudSyncBridge, overlay
├── main.tsx             # Bootstrap React
├── components/
│   ├── ui/              # Primitives (JModal), NucComponents, Icons, InfoDot, Flags
│   ├── ErrorBoundary.tsx · ConfirmModal.tsx · InstallBanner.tsx · UpdateToast.tsx
├── features/
│   ├── dashboard/       # Home: tasto Alleniamoci + moduli riordinabili
│   ├── gym/             # Allenamento — vedi sotto
│   ├── budget/          # Budget + "sogno da raggiungere"
│   ├── kcal/            # Personal Coach
│   ├── search/          # Ricerca globale
│   └── auth/ profile/ boot/
├── hooks/               # useModalA11y, useIsDesktop, useMono, useIsDark, …
├── lib/                 # supabase, cloudSync, syncMeta, isoDate, dateFormat,
│                        # i18n (+ i18n.de, il dizionario tedesco),
│                        # jarvis-tokens, metricInfo, uid, safeStorage
├── store/useJarvisStore.ts
├── styles/globals.css   # token del tema + base Tailwind
└── test/                # Vitest — logica pura e rendering
```

La sezione Allenamento è divisa per livelli, in ordine di dipendenza: i modali
usano i grafici e le statistiche usano un modale, quindi le primitive stanno in
fondo alla catena e nessuno dei file si importa a vicenda.

```
gymModel.ts    calcoli e costanti (1RM, volume, pace, record) — nessun React, testato
gymStrength.ts forza per distretto e traguardi — nessun React, testato
gymHooks.ts    useBodyWeight
gymShared.tsx  LineChart, BookmarkRibbon
gymModals.tsx  registra prestazione, aggiungi/modifica esercizio, correggi storico
GymHyrox.tsx   card, dettaglio stazione, riepilogo gara
GymSchede.tsx  schede d'allenamento (elenco, editor, sessione, report)
JarvisGym.tsx  statistiche, pagine palestra e schermata principale
```

La logica che vale la pena testare senza montare React vive in file puri —
`gymModel`, `gymStrength`, `kcalMath`, `budgetMath`, `isoDate`, `syncMeta`,
`dateFormat` — ed è
lì che stanno quasi tutti i test.

---

## Documenti storici

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
