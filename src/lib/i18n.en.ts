// Il dizionario inglese. Due mappe separate, con due destini diversi.
//
//  · EN_UI   — il testo dell'interfaccia. Chiave = la frase italiana, eventualmente
//              preceduta da un contesto (`'grafico|Carico'`). Vedi `i18n.ts`.
//  · EN_DATA — i nomi che stanno DENTRO i dati dell'utente: gruppi muscolari,
//              esercizi del catalogo iniziale, stazioni Hyrox. Nello store restano
//              scritti in italiano — sono anche la chiave dei colori in
//              `muscleColors` — e si traducono soltanto quando si stampano.
//              Quello che non è qui esce com'è: sono i nomi scritti a mano
//              dall'utente, che nessuno deve tradurgli.
//
// L'inglese è quello internazionale di un'app da palestra: unità metriche,
// maiuscola solo sulla prima parola delle etichette e, dove le due grafie
// divergono, quella britannica ("colour").

// ── Nomi nei dati ──────────────────────────────────────────────
export const EN_DATA: Record<string, string> = {
  // Gruppi muscolari. 'Altro' è il gruppo di chi non sceglie: esiste nei dati
  // ma non ha una regione sulla mappa del corpo.
  'Petto': 'Chest',
  'Dorso': 'Back',
  'Spalle': 'Shoulders',
  'Bicipiti': 'Biceps',
  'Tricipiti': 'Triceps',
  'Core': 'Core',
  'Gambe': 'Legs',
  'Glutei': 'Glutes',
  'Altro': 'Other',

  // Il catalogo di partenza precedente. Non è più quello che si installa a chi si
  // registra oggi, ma resta qui: quei nomi sono nello store di chi usa l'app da
  // prima, e toglierli glieli farebbe tornare in italiano da un giorno all'altro.
  //
  // I nomi degli esercizi portano la maiuscola su ogni parola ("Bench Press"),
  // come si scrivono in sala: è l'unica eccezione alla regola delle etichette.
  // Molti nel catalogo italiano sono già inglesi (Hip thrust, Leg curl) e
  // cambiano solo in quello.
  'Panca piana': 'Bench Press',
  'Panca inclinata': 'Incline Bench Press',
  'Croci ai cavi': 'Cable Fly',
  'Chest press': 'Chest Press',
  'Piegamenti': 'Push-ups',

  'Trazioni alla sbarra': 'Pull-ups',
  'Lat machine': 'Lat Pulldown',
  'Rematore con bilanciere': 'Barbell Row',
  'Pulley basso': 'Seated Cable Row',
  'Stacco da terra': 'Deadlift',

  'Lento avanti': 'Overhead Press',
  'Alzate laterali': 'Lateral Raise',
  'Alzate posteriori': 'Rear Delt Raise',
  'Tirate al mento': 'Upright Row',

  'Curl con bilanciere': 'Barbell Curl',
  'Curl con manubri': 'Dumbbell Curl',
  'Curl a martello': 'Hammer Curl',
  'Panca Scott': 'Preacher Curl',

  // "French press" in sala italiana è l'estensione dei tricipiti da sdraiati:
  // in inglese quel nome farebbe pensare alla versione sopra la testa.
  'French press': 'Skull Crusher',
  'Push down ai cavi': 'Triceps Pushdown',
  'Dip alle parallele': 'Dips',
  'Panca stretta': 'Close-Grip Bench Press',

  'Crunch': 'Crunch',
  'Plank': 'Plank',
  'Leg raise': 'Leg Raise',
  'Russian twist': 'Russian Twist',

  'Squat': 'Squat',
  'Pressa': 'Leg Press',
  'Affondi': 'Lunges',
  'Leg extension': 'Leg Extension',
  'Leg curl': 'Leg Curl',
  'Calf raise': 'Calf Raise',
  'Front squat': 'Front Squat',

  'Hip thrust': 'Hip Thrust',
  'Stacco rumeno': 'Romanian Deadlift',
  'Glute bridge': 'Glute Bridge',
  'Abduzioni ai cavi': 'Cable Hip Abduction',

  // Catalogo di partenza di oggi (vedi catalogo.ts). "MPW" è la marca del
  // macchinario e non si traduce: è un nome proprio.
  'Panca piana al MPW': 'MPW Bench Press',
  'Panca inclinata al MPW': 'MPW Incline Bench Press',
  'Panca declinata al MPW': 'MPW Decline Bench Press',
  'Croci ai cavi bassi': 'Low Cable Fly',
  'Croci ai cavi alti': 'High Cable Fly',
  'Croci alla peck deck': 'Pec Deck Fly',

  'Trazioni': 'Pull-ups',
  'Stacco': 'Deadlift',
  'Lat machine presa larga': 'Wide-Grip Lat Pulldown',
  'Rematore T-Bar presa larga': 'Wide-Grip T-Bar Row',
  'Rematore con manubri su panca inclinata': 'Incline Bench Dumbbell Row',
  'Pulley basso presa stretta': 'Close-Grip Seated Cable Row',
  'Pullover al cavo alto': 'High Cable Pullover',
  'Scrollate con manubri': 'Dumbbell Shrugs',

  'Military press al MPW': 'MPW Military Press',
  'Alzate laterali con manubri': 'Dumbbell Lateral Raise',
  'Alzate laterali al cavo': 'Cable Lateral Raise',
  'Peck deck inversa': 'Reverse Pec Deck',
  'Face pull': 'Face Pull',

  'Curl manubri su panca inclinata': 'Incline Dumbbell Curl',
  'Curl bilanciere Z': 'EZ-Bar Curl',
  'Curl panca Scott': 'Preacher Curl',

  'Push down al cavo': 'Triceps Pushdown',
  'Estensioni overhead al cavo': 'Overhead Cable Triceps Extension',

  'Sollevamenti gambe alla sbarra': 'Hanging Leg Raise',
  'Ab wheel': 'Ab Wheel',
  'Woodchopper ai cavi': 'Cable Woodchopper',
  'Pallof press al cavo': 'Cable Pallof Press',
  'Landmine press rotation': 'Landmine Press with Rotation',
  'Suitcase carry': 'Suitcase Carry',

  'Leg curl seduto': 'Seated Leg Curl',
  'Polpacci in piedi': 'Standing Calf Raise',
  'Polpacci seduto': 'Seated Calf Raise',

  "Abduzione dell'anca al cavo": 'Cable Hip Abduction',

  // Stazioni Hyrox: i nomi di gara sono già in inglese nei dati — SkiErg, Sled
  // Push, Wall Balls — e non hanno bisogno di una voce. Si traduce solo la corsa,
  // che è l'unica voce non ufficiale dell'elenco.
  'Corsa avg pace': 'Run avg pace',
}

// ── Interfaccia ────────────────────────────────────────────────
// Le voci sono raggruppate come le schermate dell'app. Una chiave che manca non
// è un errore: la frase esce in italiano.
export const EN_UI: Record<string, string> = {
  // ── Sincronizzazione (App) ───────────────────────────────────
  'Aggiornato da un altro dispositivo': 'Updated from another device',
  'Catalogo esercizi rinnovato': 'Exercise library updated',
  'Catalogo esercizi rinnovato (senza copia di scorta)':
    'Exercise library updated (no backup copy)',
  'Dati cloud non caricati — tocca per riprovare': 'Cloud data not loaded — tap to retry',
  'Non sincronizzato — tocca per riprovare': 'Not synced — tap to retry',

  // ── Nomi delle sezioni ───────────────────────────────────────
  'Allenamento': 'Training',
  'Gruppo muscolare': 'Muscle group',
  'Schede': 'Plans',
  // Le tre destinazioni sotto i tab dell'allenamento.
  'Coaching': 'Coaching',
  'Statistiche': 'Statistics',
  'Mappa della forza': 'Strength map',
  'Personal Coach': 'Personal Coach',

  // ── Dialogo di conferma ──────────────────────────────────────
  'Eliminazione': 'Delete',
  'Sicuro di voler eliminare?': 'Are you sure you want to delete?',
  'Stai per eliminare': 'You’re about to delete',
  'L’azione è definitiva.': 'This can’t be undone.',
  'No': 'No',
  'Sì, elimina': 'Yes, delete',
  'questo elemento': 'this item',

  // ── Schermata d'errore ───────────────────────────────────────
  'Qualcosa è andato storto': 'Something went wrong',
  'Si è verificato un errore imprevisto. Puoi svuotare la cache e ricaricare l’app.':
    'An unexpected error occurred. You can clear the cache and reload the app.',
  'Dettagli tecnici': 'Technical details',
  'Nascondi dettagli tecnici': 'Hide technical details',
  'Svuota cache e ricarica': 'Clear cache and reload',

  // ── Installazione e aggiornamento ────────────────────────────
  'Aggiungi alla schermata Home': 'Add to Home Screen',
  'Condividi → “Aggiungi alla schermata Home” per usarla senza la barra Safari':
    'Share → “Add to Home Screen” to use it without the Safari bar',
  'Chiudi': 'Close',
  'Nuova versione disponibile': 'New version available',
  'Aggiorna': 'Update',

  // ── Navigazione ──────────────────────────────────────────────
  'Impostazioni': 'Settings',

  // ── Saluti ───────────────────────────────────────────────────
  'Buongiorno': 'Good morning',
  'Buon pomeriggio': 'Good afternoon',
  'Buonasera': 'Good evening',
  'Buonanotte': 'Good night',
  'Buon Natale': 'Merry Christmas',
  'Buon Anno Nuovo': 'Happy New Year',
  'Buona Pasqua': 'Happy Easter',
  // Le feste italiane restano quelle: l'app saluta nel giorno in cui cadono in
  // Italia, e il nome inglese dice quale festa è.
  'Buon Ferragosto': 'Happy Ferragosto',
  'Buon 1° Maggio': 'Happy May Day',
  'Buon 25 Aprile': 'Happy Liberation Day',
  'Buona Festa della Repubblica': 'Happy Republic Day',

  // ── Primo avvio ──────────────────────────────────────────────
  'Passo {n} di {tot}': 'Step {n} of {tot}',
  'Come ti chiami?': 'What’s your name?',
  'Serve solo per salutarti. Puoi metterci quello che vuoi.':
    'It’s only used to greet you. Put whatever you like.',
  'Sesso': 'Sex',
  'Cambia le soglie di forza: gli stessi chili non valgono lo stesso grado.':
    'It changes the strength thresholds: the same kilos don’t earn the same level.',
  'Quando sei nato?': 'When were you born?',
  'Da qui l’app ricava l’età, senza doverla aggiornare ogni anno.':
    'The app works out your age from this, with no need to update it every year.',
  'Quanto pesi?': 'How much do you weigh?',
  'È la misura su cui si calcola la forza. Senza, la mappa del corpo resta vuota.':
    'It’s what strength is calculated against. Without it, the body map stays empty.',
  'Quanto sei alto?': 'How tall are you?',
  'Serve al fabbisogno calorico del Personal Coach.':
    'Used for your calorie needs in Personal Coach.',
  'Il tuo nome': 'Your name',
  'Uomo': 'Male',
  'Donna': 'Female',
  '{n} anni': '{n} years',
  'Avanti': 'Next',
  'Iniziamo': 'Let’s go',

  // ── Accesso ──────────────────────────────────────────────────
  'Fatto in Italia': 'Made in Italy',
  'Accedi': 'Log in',
  'Crea account': 'Create account',
  'Recupera password': 'Reset password',
  'Nuova password': 'New password',
  'email': 'email',
  'password': 'password',
  'nuova password': 'new password',
  'conferma password': 'confirm password',
  'Mostra password': 'Show password',
  'Nascondi password': 'Hide password',
  'Ricordami': 'Remember me',
  'Entra': 'Log in',
  'Registrati': 'Sign up',
  'Invia email': 'Send email',
  'Aggiorna password': 'Update password',
  'Non hai un account? Registrati': 'No account yet? Sign up',
  'Password dimenticata?': 'Forgot your password?',
  'Hai già un account? Accedi': 'Already have an account? Log in',
  'Torna al login': 'Back to login',
  'La password deve avere almeno 6 caratteri.': 'The password must be at least 6 characters long.',
  'Le password non coincidono.': 'The passwords don’t match.',
  'Ti abbiamo inviato una email: conferma l’indirizzo per completare la registrazione.':
    'We’ve sent you an email: confirm your address to complete sign-up.',
  'Email inviata. Controlla la tua casella di posta.': 'Email sent. Check your inbox.',
  'Password aggiornata. Accesso in corso…': 'Password updated. Logging you in…',
  'Email o password non corretti.': 'Incorrect email or password.',
  'Devi prima confermare la tua email. Controlla la casella di posta.':
    'You need to confirm your email first. Check your inbox.',
  'Esiste già un account con questa email.': 'An account with this email already exists.',
  'Indirizzo email non valido.': 'Invalid email address.',
  'Troppi tentativi. Riprova tra qualche minuto.': 'Too many attempts. Try again in a few minutes.',
  'Troppi tentativi ravvicinati. Attendi qualche istante e riprova.':
    'Too many attempts in a row. Wait a moment and try again.',

  // ── Avvio ────────────────────────────────────────────────────
  'Bentornato': 'Welcome back',
  'Benvenuto': 'Welcome',
  'Tocca per saltare': 'Tap to skip',

  // ── Varie ────────────────────────────────────────────────────
  'Senza nome': 'Unnamed',

  // ── Personal Coach ───────────────────────────────────────────
  // "Seguire" qui è allenare qualcuno, non il "follow" dei social: in inglese
  // le due liste si chiamano col verbo dell'allenatore.
  'Ti seguono': 'Coaching you',
  'Segui': 'You coach',
  'Caricamento…': 'Loading…',
  'Attendi…': 'Please wait…',
  'Annulla': 'Cancel',
  'Elimina': 'Delete',
  'Confronto': 'Compare',
  'Il tuo codice': 'Your code',
  'Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso, e potrà correggere un’alzata scritta male.':
    'Generate a code and give it to the person who trains you. They’ll see your workouts, volume and weight trend, and can correct a lift that was logged wrong.',
  'Puoi togliergli l’accesso quando vuoi.': 'You can remove their access whenever you like.',
  'Genera un codice': 'Generate a code',
  'Nuovo codice': 'New code',
  'Copiato': 'Copied',
  'Tocca per copiare · scade il {data}': 'Tap to copy · expires on {data}',
  'Chi vede i tuoi allenamenti': 'Who can see your workouts',
  'Nessuno. I tuoi dati sono solo tuoi.': 'No one. Your data is yours alone.',
  'Collega un allievo': 'Connect an athlete',
  'Chiedi il codice a chi vuoi seguire: lo genera dalla sua app, in questa stessa schermata.':
    'Ask the person you want to coach for their code: they generate it in their app, on this same screen.',
  'CODICE': 'CODE',
  'Collega': 'Connect',
  'I tuoi allievi': 'Your athletes',
  'Nessun allievo collegato.': 'No athletes connected.',
  'Allenatore': 'Coach',
  'Allievo': 'Athlete',
  'Dal {data}': 'Since {data}',
  'Scollega': 'Disconnect',
  'Scollega {chi}': 'Disconnect {chi}',
  'Togliere l’accesso?': 'Remove access?',
  '{chi} non vedrà più i tuoi allenamenti. I tuoi dati restano intatti.':
    '{chi} will no longer see your workouts. Your data stays untouched.',
  'Togliere dalla lista?': 'Remove from the list?',
  'Non vedrai più gli allenamenti di {chi}. Per rientrare servirà un codice nuovo.':
    'You’ll no longer see workouts from {chi}. Getting back in will take a new code.',
  'Questa persona': 'This person',
  'questa persona': 'this person',
  'questo allenatore': 'this coach',
  'questo allievo': 'this athlete',
  'Questa persona non ha ancora salvato nulla.': 'This person hasn’t saved anything yet.',
  'Schede assegnate': 'Assigned plans',
  'Condividi la scheda': 'Share plan',
  'Condividi': 'Share',
  '«{scheda}» finisce nelle sue schede, pronta da avviare.':
    '“{scheda}” goes into their plans, ready to start.',
  'Invio…': 'Sending…',
  'Inviata ✓': 'Sent ✓',
  'Nuova': 'New',
  'Nessuna scheda assegnata. Quelle che scrivi qui compaiono nelle sue «Schede d’allenamento», pronte da avviare.':
    'No plans assigned. The ones you write here show up in their “Workout plans”, ready to start.',
  'non ancora visibile a lui': 'not visible to them yet',
  'Elimina {cosa}': 'Delete {cosa}',

  // ── Scheda dell'allievo ──────────────────────────────────────
  'Questa persona non ha ancora registrato allenamenti.': 'This person hasn’t logged any workouts yet.',
  'Questa settimana': 'This week',
  'Allenamenti': 'Workouts',
  'Ultimo': 'Last',
  'oggi': 'today',
  'ieri': 'yesterday',
  '{n} gg fa': '{n}d ago',
  'Ultimo allenamento': 'Last workout',
  'Note sugli esercizi': 'Exercise notes',
  'Nessuna scritta': 'None written',
  '1 scritta': '1 written',
  '{n} scritte': '{n} written',
  'Volume per settimana': 'Volume per week',
  'Peso': 'Weight',
  '{kg} kg oggi': '{kg} kg today',
  'Forza per distretto': 'Strength by body area',
  'Sessioni': 'Sessions',
  // L'elenco degli esercizi Hyrox: sessioni di allenamento da una parte, tempi
  // delle gare e simulazioni registrate dall'altra.
  'Gare': 'Races',
  'Sessioni o gare': 'Sessions or races',
  'Nessun tempo in gara': 'No race time',
  '{n} in tutto': '{n} in total',
  'massimale stimato': 'estimated max',
  'Migliori alzate': 'Best lifts',
  'Nessuna nota': 'No note',
  'Modifica': 'Edit',
  'Scrivi': 'Write',
  'Cosa deve ricordarsi su {esercizio}': 'What they should remember about {esercizio}',
  'Nota su {esercizio}': 'Note on {esercizio}',
  'Servono almeno due allenamenti sullo stesso esercizio per avere un confronto.':
    'A comparison needs at least two workouts on the same exercise.',
  'rispetto al solito': 'compared to usual',
  'Esercizio': 'Exercise',
  'Serie': 'Sets',
  'Colpi': 'Reps',
  'di solito': 'usually',

  // ── Home ─────────────────────────────────────────────────────
  'La tua settimana': 'Your week',
  'Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.':
    'Log a lift: your squat, bench press and deadlift will show up here.',
  'Total': 'Total',
  '{r}× il tuo peso': '{r}× your body weight',
  '{r}× peso': '{r}× body weight',
  'Mai allenato': 'Never trained',
  'Inserisci il peso nel profilo →': 'Add your weight in your profile →',
  'Ricerca globale': 'Global search',

  // ── Ricerca ──────────────────────────────────────────────────
  'Cerca esercizi, schede…': 'Search exercises, plans…',
  'Nessun risultato per “{q}”': 'No results for “{q}”',
  'Scrivi per cercare in tutta l’app —': 'Type to search the whole app —',
  'esercizi e schede d’allenamento.': 'exercises and workout plans.',

  // ── Mappa del corpo ──────────────────────────────────────────
  // "Distretto" è la zona del corpo su cui si misura la forza: in inglese resta
  // distinto dal "muscle group" che l'utente assegna agli esercizi.
  '100 = forte per questo distretto': '100 = strong for this body area',
  'Fronte': 'Front',
  'Retro': 'Back',
  'La forza si misura sul tuo peso corporeo.': 'Strength is measured against your body weight.',
  'Inseriscilo nel profilo': 'Add it in your profile',
  'Iniziale': 'Beginner',
  'Base': 'Basic',
  'Buono': 'Good',
  'Forte': 'Strong',

  // ── Traguardi ────────────────────────────────────────────────
  'Traguardi': 'Milestones',
  'I primi 100 kg': 'The first 100 kg',
  'I primi 100 kg non si scordano mai.': 'You never forget your first 100 kg.',
  'Solleva 100 kg in una singola serie.': 'Lift 100 kg in a single set.',
  'Light weight baby': 'Light weight baby',
  'Cento alzate di schiena. Light weight, baby!': 'A hundred back lifts. Light weight, baby!',
  'Registra {target} alzate di dorso (ne hai {fatte}).':
    'Log {target} back lifts (you have {fatte}).',

  // ── Palestra ─────────────────────────────────────────────────
  'Pesi': 'Weights',
  'Hyrox': 'Hyrox',
  'Esercizi': 'Exercises',
  'Gara': 'Race',
  'Gruppi muscolari': 'Muscle groups',
  // Qui "scheda" è la pagina dell'esercizio, non una scheda d'allenamento.
  'Scegli un esercizio per vederne la scheda': 'Pick an exercise to see its details',
  'Apri un gruppo muscolare, poi un esercizio': 'Open a muscle group, then an exercise',
  'Aggiungi gli esercizi di base': 'Add the basic exercises',
  'Ne manca 1, con la sua immagine': '1 missing, with its image',
  'Ne mancano {n}, con la loro immagine': '{n} missing, with their images',
  '1 esercizio': '1 exercise',
  '{n} esercizi': '{n} exercises',
  'Vedi in elenco': 'View as list',
  'Vedi in griglia': 'View as grid',
  'Nessuna alzata': 'No lifts',
  'Stazioni gara': 'Race stations',
  'Registra almeno 2 sessioni per vedere il grafico': 'Log at least 2 sessions to see the chart',
  'più basso = meglio': 'lower = better',

  // ── Dettaglio esercizio ──────────────────────────────────────
  'Nuova alzata': 'New lift',
  'Reset alzate': 'Reset lifts',
  'Svuota lo storico, tieni l’esercizio': 'Clear the history, keep the exercise',
  'Storico': 'History',
  '1 sessione': '1 session',
  '{n} sessioni': '{n} sessions',
  // Abbreviato come in italiano: così regge anche con 1 senza il plurale.
  '{n} sess.': '{n} sess.',
  'Nessuna sessione registrata': 'No sessions logged',
  'Nessuna alzata registrata': 'No lifts logged',
  'Massimale': 'Max',
  'Massimale stimato': 'Estimated max',
  'Massimale stimato (kg)': 'Estimated max (kg)',
  'Carico (kg)': 'Load (kg)',
  'kg stim.': 'kg est.',
  'Alzata': 'Lift',
  'Andamento': 'Progress',
  'Visualizza grafico andamento': 'View progress chart',
  'Registra almeno 2 alzate per vedere i grafici': 'Log at least 2 lifts to see the charts',
  'Servono almeno 2 sessioni per visualizzare i grafici': 'Charts need at least 2 sessions',
  'Miglior alzata': 'Best lift',
  'il peso sul bilanciere, sessione per sessione': 'the weight on the bar, session by session',
  'quanto alzeresti per una singola: tiene conto anche dei colpi':
    'what you’d lift for a single: it factors in the reps too',
  'Azzerare lo storico?': 'Reset history?',
  'Svuota memoria': 'Clear history',
  'Sì, azzera': 'Yes, reset',
  'Cancelli tutte le {n} alzate di “{nome}”. L’esercizio resta, con il suo nome, il gruppo muscolare e il colore: riparti da zero. L’azione è definitiva.':
    'You’re deleting all {n} lifts of “{nome}”. The exercise stays, with its name, muscle group and colour: you start from scratch. This can’t be undone.',
  'Note': 'Notes',
  'Le tue': 'Yours',
  'Note dell’esercizio': 'Exercise notes',
  'Esecuzione, modalità…': 'Execution, method…',

  // ── Statistiche ──────────────────────────────────────────────
  'Volume per muscolo': 'Volume per muscle',
  // L'altra metà dell'interruttore "Kg / Volte" sui gruppi muscolari: quante
  // volte lo si è allenato, cioè le sessioni. "Times" si confondeva coi tempi.
  'Volte': 'Sessions',
  'Allenamenti per muscolo': 'Workouts per muscle',
  '1 allenamento': '1 workout',
  '{n} allenamenti': '{n} workouts',
  'Record personali': 'Personal records',
  'stima {n} kg': 'est. {n} kg',
  'Tempi per esercizio': 'Times per exercise',
  'media {v}': 'avg {v}',
  'Nessuna sessione hyrox registrata': 'No Hyrox sessions logged',
  'NESSUN DATO': 'NO DATA',

  // ── Hyrox ────────────────────────────────────────────────────
  'Gara Hyrox': 'Hyrox race',
  'Miglior tempo': 'Best time',
  'Trend': 'Trend',
  'Tempo (secondi)': 'Time (seconds)',
  'il grafico che scende = miglioramento': 'chart going down = improvement',
  'Pace (sec/km)': 'Pace (sec/km)',
  'Pace (sec/500m)': 'Pace (sec/500 m)',
  'Cadenza (rep/min)': 'Cadence (reps/min)',
  'Nuova sessione': 'New session',
  'Sessione': 'Session',

  // ── Schede d'allenamento ─────────────────────────────────────
  'Schede d’allenamento': 'Workout plans',
  'Scheda': 'Plan',
  '1 scheda': '1 plan',
  '{n} schede': '{n} plans',
  'Nessuna scheda — creane una con +': 'No plans — create one with +',
  'Scheda vuota — modificala per aggiungere esercizi': 'Empty plan — edit it to add exercises',
  'Report gruppi muscolari': 'Muscle group report',
  'Report muscolare': 'Muscle report',
  'Bozza': 'Draft',
  'da {chi}': 'from {chi}',
  'Nuova scheda': 'New plan',
  'Modifica scheda': 'Edit plan',
  'Nome scheda (es. Upper A)': 'Plan name (e.g. Upper A)',
  'Esercizio {n}': 'Exercise {n}',
  'superset': 'superset',
  'collegato': 'linked',
  'Sposta su': 'Move up',
  'Sposta giù': 'Move down',
  'Nome esercizio': 'Exercise name',
  'Scegli il gruppo…': 'Choose group…',
  'Nota': 'Note',
  '(opzionale)': '(optional)',
  'Testo': 'Text',
  // Dopo un allenamento, nel dettaglio della scheda: cosa è finito nello storico.
  'Allenamento salvato': 'Workout saved',
  'Tocca un’alzata per correggere i chili o i colpi.': 'Tap a lift to correct its weight or reps.',
  'In superset con il prossimo': 'In superset with the next one',
  'Superset con il prossimo': 'Superset with the next one',
  'Aggiungi esercizio': 'Add exercise',
  'Manca il nome della scheda': 'The plan name is missing',
  'Aggiungi almeno un esercizio con un nome': 'Add at least one named exercise',
  'Esercizio {n}: numero di serie non valido': 'Exercise {n}: invalid number of sets',
  'Esercizio {n}: mancano i colpi (ripetizioni)': 'Exercise {n}: the reps are missing',
  'Esercizio {n}: scegli il gruppo muscolare': 'Exercise {n}: choose the muscle group',
  'Bozza salvata · da completare': 'Draft saved · to be completed',
  'Da completare': 'To be completed',
  'Salva modifiche': 'Save changes',
  'Salva scheda': 'Save plan',
  'Se manca qualcosa la scheda viene comunque salvata come bozza, senza perdere il lavoro.':
    'If something is missing, the plan is still saved as a draft, so no work is lost.',
  'Senza gruppo': 'No group',
  'Inizia allenamento': 'Start workout',
  '{fatti}/{tot} esercizi completati': '{fatti}/{tot} exercises completed',
  'obiettivo': 'target',
  'ultima volta': 'last time',
  'uguale': 'same',
  'Serie {n}': 'Set {n}',
  'serie': 'sets',
  'colpi': 'reps',
  'Termina Allenamento': 'Finish workout',
  'Le serie completate verranno salvate come nuova alzata nei rispettivi esercizi.':
    'Completed sets will be saved as a new lift in their exercises.',
  'Com’è andata': 'How it went',
  'non svolto': 'not done',
  'In rosso quello che è rimasto sotto il programma. Si salva com’è andata davvero: è quello che rende confrontabili gli allenamenti.':
    'In red, whatever fell short of the plan. It’s saved as it really went: that’s what makes workouts comparable.',
  'Salva e chiudi': 'Save and close',
  'Nessun esercizio nelle schede — creane per vedere il report':
    'No exercises in your plans — create some to see the report',
  'Distribuzione dei gruppi muscolari su tutte le schede: quante volte ogni gruppo viene colpito e la sua quota sul totale.':
    'How muscle groups are spread across all plans: how many times each group is hit and its share of the total.',
  '1 volta': '1 time',
  '{n} volte': '{n} times',

  // ── Modali di registrazione ──────────────────────────────────
  'Log': 'Log',
  'Data': 'Date',
  'Tempo': 'Time',
  'Passo medio al km': 'Average pace per km',
  'min': 'min',
  'sec': 'sec',
  'Distanza / Ripetizioni': 'Distance / Reps',
  'Kg (opzionale)': 'Kg (optional)',
  'Pace': 'Pace',
  'Profilo': 'Profile',
  'Nuovo gruppo': 'New group',
  'Nuovo gruppo muscolare': 'New muscle group',
  'Es. Avambracci': 'E.g. Forearms',
  'Esiste già un gruppo con questo nome': 'A group with this name already exists',
  'Colore': 'Colour',
  'Figura': 'Figure',
  'Crea gruppo': 'Create group',
  'Chiudi il profilo': 'Close profile',
  'Pesati ogni mattina appena sveglio, a stomaco vuoto: è l’unico modo perché due misure siano confrontabili. Conta la direzione, non il numero di oggi.':
    'Weigh yourself every morning right after waking up, on an empty stomach: it’s the only way two readings can be compared. What counts is the direction, not today’s number.',
  'Distanza': 'Distance',
  'Nessuna sessione da {dist}': 'No {dist} sessions',
  'nessuna sessione': 'no sessions',
  'da {dist}': 'from {dist}',
  'Tempo gara stimato': 'Estimated race time',
  'Mezza distanza': 'Half distance',
  // I nomi ufficiali delle due categorie Hyrox, che in inglese sono al plurale.
  'Double': 'Doubles',
  'Singolo': 'Singles',
  'Categoria': 'Category',
  'gara': 'race',
  'simulazione': 'simulation',
  'allenamento': 'workout',
  'dal tuo profilo': 'from your profile',
  'Servono almeno {n} segmenti registrati': 'At least {n} logged segments needed',
  'Nessuna sessione': 'No sessions',
  '1 giornata': '1 training day',
  '{n} giornate': '{n} training days',
  'meno del previsto o carico sceso': 'less than planned or load down',
  'carico salito': 'load up',
  '1 esercizio saltato': '1 exercise skipped',
  '{n} esercizi saltati': '{n} exercises skipped',
  '1 serie in meno': '1 set fewer',
  '{n} serie in meno': '{n} sets fewer',
  '1 serie corta': '1 short set',
  '{n} serie corte': '{n} short sets',
  '1 carico sceso': '1 load down',
  '{n} carichi scesi': '{n} loads down',
  'Solo hyrox': 'Hyrox only',
  'Senza scheda': 'No plan',
  'scheda rispettata': 'plan followed',
  'Registrate a mano': 'Logged manually',
  'scheda non più disponibile, niente confronto': 'plan no longer available, no comparison',
  'Volume': 'Volume',
  'Saltato': 'Skipped',
  'Fuori scheda': 'Off plan',
  'stesso carico': 'same load',
  'previsto': 'planned',
  'fatto': 'done',
  'prima {kg} kg': 'previously {kg} kg',
  'Elimina esercizio': 'Delete exercise',
  'in miglioramento': 'improving',
  'in calo': 'declining',
  'carico invariato': 'same load',
  'prima alzata': 'first lift',
  'Azioni sull’alzata': 'Lift actions',
  'invariato': 'unchanged',
  'Conferma la data': 'Confirm date',
  'Oggi': 'Today',
  'Modifica la data': 'Change date',
  'ripetizioni': 'reps',
  'chili': 'kilos',
  'Superset · nessun recupero': 'Superset · no rest',
  'Salva': 'Save',
  'Modifica sessione': 'Edit session',
  'Quantità': 'Amount',
  'Data dell’alzata': 'Lift date',
  'Una singola al carico massimo. Serie e colpi valgono 1 × 1.':
    'A single at max load. Sets and reps count as 1 × 1.',
  'Una singola al carico massimo: serie e colpi diventano 1 × 1.':
    'A single at max load: sets and reps become 1 × 1.',
  'Kg': 'Kg',
  'Zavorra': 'Added weight',
  'Zavorra extra': 'Extra added weight',
  'colpi per serie': 'reps per set',
  'Serie {n} · kg': 'Set {n} · kg',
  'Serie {n} · colpi': 'Set {n} · reps',
  'kg agg.': 'kg added',
  'kg aggiunti': 'kg added',
  'Tipo di carico': 'Load type',
  'Attrezzo': 'Equipment',
  'Con attrezzo': 'With equipment',
  'Corpo libero': 'Bodyweight',
  'Tipo di alzata': 'Lift type',
  'Uguale': 'Same',
  'Per serie': 'Per set',
  'valori uguali': 'same values',
  'valori per serie': 'values per set',
  'una singola a {kg} kg': 'a single at {kg} kg',
  'da {kg} kg × {n} colpi': 'from {kg} kg × {n} reps',

  // ── Nuovo esercizio / modifica ───────────────────────────────
  'Nuovo esercizio': 'New exercise',
  'Palestra': 'Gym',
  'Nome': 'Name',
  'Target (distanza/reps)': 'Target (distance/reps)',
  'Seleziona gruppo muscolare': 'Select muscle group',
  'O scrivi manualmente': 'Or type it in',
  'Muscolo (es. Petto)': 'Muscle (e.g. Chest)',
  'Secondo gruppo muscolare (opzionale)': 'Second muscle group (optional)',
  'Secondo gruppo (opzionale)': 'Second group (optional)',
  'Secondo muscolo': 'Second muscle',
  'Nessuno': 'None',
  'Note (opzionale)': 'Notes (optional)',
  'Esecuzione, setup, attrezzatura…': 'Form, setup, equipment…',
  'Aggiungi': 'Add',
  'Modifica esercizio': 'Edit exercise',
  'Colore gruppo muscolare — si applica a tutti gli esercizi':
    'Muscle group colour — applies to all exercises',
  '{gruppo} — default': '{gruppo} — default',
  '{gruppo} — personalizzato': '{gruppo} — custom',
  'Modifica alzata': 'Edit lift',
  'Miglior Kg': 'Best kg',
  'Miglior stima': 'Best estimate',

  // ── Il momento del record ────────────────────────────────────
  'Nuovo record': 'New record',
  '{n} nuovi record': '{n} new records',
  'era {kg} kg': 'was {kg} kg',
  'Massimale stimato dai chili e dai colpi della serie.':
    'Max estimated from the weight and reps of the set.',
  'Bene così': 'Great',

  // ── Impostazioni ─────────────────────────────────────────────
  'Torna alle impostazioni': 'Back to settings',
  'Chiudi le impostazioni': 'Close settings',
  'Nome utente': 'Username',
  'Dati generali': 'General info',
  'Età': 'Age',
  'Peso (kg)': 'Weight (kg)',
  'Altezza (cm)': 'Height (cm)',
  'Altezza': 'Height',
  'Data di nascita': 'Date of birth',
  'Peso di oggi in kg': 'Today’s weight in kg',
  'Registra': 'Log',
  '{d} kg dalla prima delle {n} pesate': '{d} kg since the first of {n} weigh-ins',
  'Serve una seconda pesata per vedere la direzione.':
    'It takes a second weigh-in to see the direction.',
  'Nessuna pesata registrata.': 'No weigh-ins logged.',

  // ── Lingua ───────────────────────────────────────────────────
  'Lingua': 'Language',
  'La lingua dell’app. I nomi che hai scritto tu restano come li hai scritti.':
    'The app’s language. Names you typed yourself stay just as you wrote them.',
  'Impostare la lingua su {lingua}?': 'Set the language to {lingua}?',
  'Tutta l’app passa in {lingua}. Puoi tornare indietro da qui quando vuoi.':
    'The whole app switches to {lingua}. You can switch back from here any time.',
  'Sì, cambia lingua': 'Yes, change language',

  // ── Aspetto ──────────────────────────────────────────────────
  'Cambio tema': 'Change theme',
  'Dark mode': 'Dark mode',
  'Fondo scuro e inchiostro chiaro.': 'Dark background and light ink.',
  'Tema colore': 'Colour theme',
  'Sospeso dal layout {layout} — torna attivo con Standard.':
    'Paused by the {layout} layout — back on with Standard.',
  'Journal': 'Journal',
  'Rosa': 'Rose',
  'Malva': 'Mauve',
  'scuro': 'dark',
  'Cambio layout': 'Change layout',
  'Sfondo fuso': 'Blended background',
  'Nero, arancione e grigio-azzurro sfumati uno dentro l’altro invece dei soli aloni caldi. Vale sui temi scuri.':
    'Black, orange and blue-grey blended into one another instead of just the warm glows. Applies to dark themes.',
  'Standard': 'Standard',
  'I colori del tema scelto sopra.': 'The colours of the theme chosen above.',
  'Premium': 'Premium',
  'Sempre nero, vetro e contorni bianchi. Ignora l’interruttore chiaro/scuro.':
    'Always black, glass and white outlines. Ignores the light/dark switch.',
  'Neon': 'Neon',
  'Quasi nero con un solo accento lime, per progressi e tasti principali.':
    'Near-black with a single lime accent, for progress and main buttons.',
  'Logbook': 'Logbook',
  'Scuro e sobrio: verde per serie fatte e record, blu per le azioni secondarie.':
    'Dark and plain: green for completed sets and records, blue for secondary actions.',
  // La conferma che compare in testata a ogni modifica (vedi `useSalvato`).
  'Salvato': 'Saved',

  // ── Account ──────────────────────────────────────────────────
  'Cambia password': 'Change password',
  'Password attuale': 'Current password',
  'Password aggiornata ✓': 'Password updated ✓',
  'La nuova password deve avere almeno 6 caratteri.': 'The new password must be at least 6 characters long.',
  'Utente non trovato.': 'User not found.',
  'Password attuale non corretta.': 'Current password is incorrect.',
  'Logout': 'Log out',

  // ── Svuota le alzate ─────────────────────────────────────────
  'Memoria delle alzate': 'Lift history',
  'Azzera lo storico di tutti gli esercizi e riparti da zero. Esercizi, schede, dati personali e pesate restano dove sono.':
    'Reset the history of every exercise and start from scratch. Exercises, plans, personal data and weigh-ins stay where they are.',
  'Svuota 1 alzata': 'Clear 1 lift',
  'Svuota {n} alzate': 'Clear {n} lifts',
  'tutte le alzate': 'all lifts',
  'Cancellare tutte le alzate?': 'Delete all lifts?',
  'l’unica alzata': 'the only lift',
  'tutte le {n} alzate': 'all {n} lifts',
  'Cancelli {quante} di tutti gli esercizi, e con esse massimali, record e grafici. Restano gli esercizi, le schede, i tuoi dati e le pesate. L’azione è definitiva.':
    'You’re deleting {quante} across all exercises, and with them maxes, records and charts. Exercises, plans, your data and weigh-ins stay. This can’t be undone.',
  'Sì, svuota': 'Yes, clear',

  // ── Errori del Personal Coach (lato server) ──────────────────
  'Codice non valido o scaduto.': 'Invalid or expired code.',
  'Questo è il tuo codice: dallo a chi deve seguirti.':
    'This is your own code: give it to the person who’ll coach you.',
  'Sessione scaduta. Esci e rientra.': 'Session expired. Log out and back in.',
  'La funzione non è ancora attiva sul server.': 'This feature isn’t active on the server yet.',
  'Non sei più collegato a questa persona: il collegamento è stato sciolto.':
    'You’re no longer connected to this person: the link has been removed.',

  // ── Fonti dei massimali ──────────────────────────────────────
  // "Dichiarato" è il massimale provato davvero, una singola al massimo: in
  // inglese si dice "tested", in coppia con "estimated".
  'Dichiarato': 'Tested',
  'Stimato': 'Estimated',
  'Dal distretto': 'From body area',

  // ── Home: riepilogo e calendario ─────────────────────────────
  'Mese precedente': 'Previous month',
  'Mese successivo': 'Next month',
  'I tuoi allenamenti': 'Your workouts',
  'settimana di fila': 'week in a row',
  'settimane di fila': 'weeks in a row',
  '1 giorno di allenamento': '1 training day',
  '{n} giorni di allenamento': '{n} training days',
  'Nessun allenamento registrato.': 'No workouts logged.',
  'Tocca un giorno per vedere cosa hai fatto.': 'Tap a day to see what you did.',
  'Non ti sei allenato': 'You didn’t train',
  'Alzate registrate': 'Logged lifts',
  'Apri il calendario degli allenamenti': 'Open the workout calendar',
  'Massimali ipotetici': 'Estimated maxes',
  'Il total compare con tutte e tre le alzate': 'The total appears once all three lifts are in',
  'Riepilogo complessivo': 'Overall summary',

  // ── Schede: modalità modifica ────────────────────────────────
  'Modifica elenco': 'Edit list',
  'Fine': 'Done',
  'Elimina scheda': 'Delete plan',

  // ── Richieste su una scheda condivisa ────────────────────────
  'Messaggi': 'Messages',
  'Richieste a {chi}': 'Requests to {chi}',
  'Chiedi all’allenatore': 'Ask your coach',
  'Torna alla scheda': 'Back to plan',
  'Chiedi quello che ti serve sotto l’esercizio che riguarda: {chi} lo legge e risponde da qui. La scheda resta com’è finché non la cambia chi te l’ha mandata.':
    'Ask what you need under the exercise it’s about: {chi} reads it and replies from here. The plan stays as it is until the person who sent it changes it.',
  'Sulla scheda': 'About the plan',
  'sulla scheda': 'about the plan',
  'la scheda': 'the plan',
  'Chiedi': 'Ask',
  'Chiedi info': 'Ask for info',
  'Sostituisci': 'Replace',
  'Chiedi una sostituzione': 'Ask for a replacement',
  'Es. quanto recupero fra le serie?': 'E.g. how much rest between sets?',
  'Es. la pressa è sempre occupata, cosa metto al posto?': 'E.g. the leg press is always taken, what can I do instead?',
  'Manda a {chi}': 'Send to {chi}',
  'Su «{esercizio}», nella scheda «{scheda}».': 'About “{esercizio}”, in the plan “{scheda}”.',
  'Sulla scheda «{scheda}».': 'About the plan “{scheda}”.',
  'Rispondi': 'Reply',
  'Rispondi su': 'Reply about',
  'Scrivi la risposta…': 'Write your reply…',
  'Le richieste non si possono leggere adesso. Riprova più tardi.': 'Requests can’t be loaded right now. Try again later.',
  'Nessuna conversazione. Per scrivere a qualcuno tocca il suo nome in “Segui” o in “Ti seguono”; chi riceve una tua scheda può anche chiederti info o una sostituzione dal punto interrogativo in cima alla scheda.':
    'No conversations. To message someone, tap their name under “You coach” or “Coaching you”; anyone who receives a plan from you can also ask for info or a replacement from the question mark at the top of the plan.',

  // ── Chat diretta, avvisi e notifiche push ──
  'Conversazioni': 'Conversations',
  'Chat': 'Chat',
  'I messaggi non si possono leggere adesso. Riprova più tardi.': 'Messages can’t be loaded right now. Try again later.',
  'Nessun messaggio. Scrivi il primo.': 'No messages. Write the first one.',
  'Scrivi un messaggio…': 'Write a message…',
  'Invia': 'Send',
  // ── Ottobre: un allenamento alla volta, durata, serie senza chili ──
  'Hai già avviato un allenamento': 'You already have a workout in progress',
  '«{scheda}» è a metà: {fatte} serie su {totali}. Chiuderlo per passare a questo? Le serie spuntate di là non vengono salvate.':
    '“{scheda}” is half done: {fatte} sets out of {totali}. Close it to switch to this one? The sets ticked there won’t be saved.',
  'Chiudi e inizia questo': 'Close it and start this one',
  'Allenamento non chiuso · {giorno}': 'Workout left open · {giorno}',
  'Durata dell’allenamento': 'Workout duration',
  'senza chili: non conta': 'no weight: not counted',
  'Le serie spuntate senza chili non vengono salvate: valgono come non fatte. Chiudi questa finestra per scriverli, o per dire che l’esercizio è a corpo libero.':
    'Sets ticked with no weight are not saved: they count as not done. Close this window to fill them in, or to mark the exercise as bodyweight.',
  'Le note sugli esercizi non svolti non restano nello storico: arrivano a chi ti segue, nel resoconto.':
    'Notes on exercises you skipped don’t stay in your history: they reach whoever coaches you, in the report.',
  'Le note sugli esercizi non svolti non vengono salvate.': 'Notes on exercises you skipped are not saved.',
  'Senza chili una serie non conta.': 'A set with no weight doesn’t count.',
  'È a corpo libero': 'It’s bodyweight',
  'Le serie senza chili non vengono salvate.': 'Sets with no weight are not saved.',
  '+ Peso dell’attrezzo a vuoto': '+ Weight of the empty bar or machine',
  'attrezzo a vuoto · facoltativo': 'empty bar or machine · optional',
  'kg di bilanciere o multipower': 'kg of the bar or Smith machine',
  'Peso dell’attrezzo a vuoto': 'Weight of the empty bar or machine',
  'Nei chili scrivi solo i dischi: i {kg} kg dell’attrezzo si sommano da sé.':
    'Enter only the plates: the {kg} kg of the bar are added for you.',
  'Vale anche per le {n} alzate già registrate. Spuntalo solo se finora scrivevi i soli dischi.':
    'Apply it to the {n} lifts already logged too. Tick this only if you have been entering the plates alone.',
  'scrivi solo i dischi: + {kg} kg di attrezzo': 'enter only the plates: + {kg} kg of bar',
  'Scrivi i dischi: 0 se usi solo l’attrezzo.': 'Enter the plates: 0 if you use the bar alone.',
  'Un numero negativo non si può registrare.': 'A negative number can’t be logged.',
  'Più di {n} serie non si possono registrare.': 'More than {n} sets can’t be logged.',
  'Più di {n} colpi in una serie non si possono registrare.': 'More than {n} reps in one set can’t be logged.',
  'L’attrezzo a vuoto non può pesare più di {n} kg.': 'The empty bar can’t weigh more than {n} kg.',
  'Più di {n} kg non si possono registrare.': 'More than {n} kg can’t be logged.',
  'Hai scritto {nuovo} kg: l’ultima volta erano {ultimo}. Se è giusto, conferma.':
    'You entered {nuovo} kg: last time it was {ultimo}. If that’s right, confirm.',
  'Scrivi quante serie hai fatto.': 'Enter how many sets you did.',
  'Scrivi quanti colpi hai fatto.': 'Enter how many reps you did.',
  'Scrivi i chili.': 'Enter the weight.',
  'Conferma e salva': 'Confirm and save',
  'Da correggere prima di salvare: chiudi questa finestra e sistema i numeri.':
    'Fix these before saving: close this window and correct the numbers.',
  'Molto lontani dall’ultima volta: controlla prima di salvare.': 'A long way from last time: check before saving.',
  '{nome}: {nuovo} kg (l’ultima volta {ultimo})': '{nome}: {nuovo} kg (last time {ultimo})',
  'Sono giusti: salva e chiudi': 'They’re right: save and close',
  'Esercizio {n}: al massimo {max} serie': 'Exercise {n}: {max} sets at most',
  'Scrivi il nome dell’esercizio.': 'Enter the exercise name.',
  'Scegli il gruppo muscolare.': 'Choose the muscle group.',
  'Le alzate già registrate restano com’erano. Se anche lì scrivevi solo i dischi, sommalo da «Modifica esercizio».':
    'Lifts already logged stay as they were. If you entered only the plates there too, add it from “Edit exercise”.',
  'colpi invariati': 'same reps',
  'Chiudi l’allenamento del {giorno}': 'Close the workout of {giorno}',
  'Scartalo e inizia oggi': 'Discard it and start today',
  'Scarta e inizia oggi': 'Discard and start today',
  'È l’allenamento del {giorno}, rimasto aperto: quello che salvi da qui finisce in quel giorno. Per allenarti oggi chiudilo, poi ricomincia.':
    'This is the workout of {giorno}, left open: what you save from here goes on that day. To train today, close it, then start again.',
  'Salvataggio non riuscito: controlla la rete e riprova.': 'Couldn’t save: check your connection and try again.',
  'Chiudi senza salvare': 'Close without saving',
  'Allenamento finito: «{scheda}» in {durata}. {dettaglio}': 'Workout done: “{scheda}” in {durata}. {dettaglio}',
  'Sui saltati: {note}': 'On the skipped ones: {note}',
  // ── L'editor della scheda ──
  'le modifiche': 'the changes',
  'Uscire senza salvare?': 'Leave without saving?',
  'Quello che hai scritto in questa scheda dall’ultimo salvataggio va perso.': 'What you wrote in this plan since the last save will be lost.',
  'Esci senza salvare': 'Leave without saving',
  'Nome cambiato: questa riga diventa un altro esercizio, con uno storico suo. Quello di «{nome}» resta dov’è. Per correggere solo il nome, fallo dalla pagina dell’esercizio.':
    'Name changed: this row becomes a different exercise, with its own history. The history of “{nome}” stays where it is. To fix just the name, do it from the exercise page.',
  'Questa scheda è già assegnata: se manca qualcosa non viene salvata, così a chi la usa resta quella di prima.':
    'This plan is already assigned: if something is missing it isn’t saved, so whoever uses it keeps the previous one.',
  'Ho tolto la scheda «{scheda}».': 'I removed the plan “{scheda}”.',
  'Togliere la scheda?': 'Remove the plan?',
  '«{scheda}» te l’ha mandata {chi}, e ne esiste una copia sola: togliendola qui sparisce anche dalla sua app. Glielo facciamo sapere.':
    '“{scheda}” was sent to you by {chi}, and there is only one copy: removing it here removes it from their app too. We’ll let them know.',
  // ── Eliminare un esercizio ──
  'Eliminare l’esercizio?': 'Delete the exercise?',
  'Cancelli “{nome}”. L’azione è definitiva.': 'You are deleting “{nome}”. This cannot be undone.',
  'Cancelli “{nome}” con le sue {n} alzate. L’azione è definitiva.': 'You are deleting “{nome}” with its {n} lifts. This cannot be undone.',
  'Cancelli “{nome}” con le sue {n} alzate: spariscono anche dallo storico di {schede}. L’azione è definitiva.':
    'You are deleting “{nome}” with its {n} lifts: they also disappear from the history of {schede}. This cannot be undone.',
  // ── Coaching: un coach per volta ──
  'Il tuo coach': 'Your coach',
  'I tuoi coach': 'Your coaches',
  'Ti segue dal {data}': 'Coaching you since {data}',
  'Vede i tuoi allenamenti, il volume e l’andamento del peso, e può correggere un’alzata scritta male.':
    'They can see your workouts, volume and weight trend, and can fix a lift you logged wrong.',
  'Scrivigli': 'Message them',
  'Si può avere un solo coach per volta: per cambiarlo, scollegati prima da quello che hai.':
    'You can have one coach at a time: to change, unlink from the current one first.',
  'Collegato a {chi}.': 'Linked to {chi}.',
  'Da adesso ti seguo io: vedo i tuoi allenamenti e possiamo scriverci da qui.':
    'I’m coaching you from now on: I can see your workouts and we can message each other here.',
  'collegamento': 'link',
  'Non è stato possibile generare un codice. Riprova.': 'Couldn’t generate a code. Try again.',
  'Questa persona ha già un coach: deve prima scollegarsi da quello.': 'This person already has a coach: they need to unlink from them first.',
  // ── Sincronizzazione e account ──
  'App da aggiornare — per ora non salvo nel cloud': 'App needs updating — not saving to the cloud for now',
  'Esporta i miei dati': 'Export my data',
  'Uscire dall’account?': 'Sign out of the account?',
  'Esci solo da questo dispositivo. Quello che non è ancora salvato nel cloud, e un allenamento lasciato a metà, restano qui: li ritrovi rientrando su questo telefono. Per rientrare serve la rete.':
    'You only sign out of this device. Anything not yet saved to the cloud, and a workout left half done, stay here: you’ll find them when you sign back in on this phone. You need a connection to sign back in.',
  'Esci': 'Sign out',
  'La rete non risponde. Riprova fra poco.': 'The network isn’t responding. Try again shortly.',
  'Scarica un file con allenamenti, schede e pesate: una copia tua, fuori dall’app.':
    'Download a file with your workouts, plans and weigh-ins: your own copy, outside the app.',
  'Scrivi a {chi}': 'Message {chi}',
  'scheda': 'plan',
  'correzione': 'correction',
  'Ti ho assegnato una scheda nuova: «{scheda}».': 'I’ve assigned you a new plan: “{scheda}”.',
  'Ho aggiornato la scheda «{scheda}».': 'I’ve updated the plan “{scheda}”.',
  'Ti ho condiviso la scheda «{scheda}».': 'I’ve shared the plan “{scheda}” with you.',
  'Ho corretto «{esercizio}» del {giorno}: ora è {alzata}.': 'I’ve corrected “{esercizio}” from {giorno}: it’s now {alzata}.',
  'Nota su «{esercizio}»: {testo}': 'Note on “{esercizio}”: {testo}',
  'Allenamento finito: «{scheda}». {dettaglio}': 'Workout finished: “{scheda}”. {dettaglio}',
  'tutto come da scheda': 'all as planned',
  'Notifiche attive su questo dispositivo.': 'Notifications are on for this device.',
  'Attiva le notifiche per sapere subito quando ti scrivono o un allievo finisce un allenamento.': 'Turn on notifications to know right away when someone messages you or an athlete finishes a workout.',
  'Le notifiche sono bloccate per questa app. Riattivale dalle impostazioni del telefono o del browser.': 'Notifications are blocked for this app. Turn them back on in your phone or browser settings.',
  'Su iPhone le notifiche arrivano solo con l’app installata: da Safari tocca Condividi, poi “Aggiungi alla schermata Home”, e aprila da lì.': 'On iPhone, notifications only arrive with the app installed: in Safari tap Share, then “Add to Home Screen”, and open it from there.',
  'Questo browser non supporta le notifiche.': 'This browser doesn’t support notifications.',
  'Disattiva': 'Turn off',
  'Attiva': 'Turn on',
  // Minuscolo: sta dentro la bolla al posto del nome ("tu: ...").
  'tu': 'you',
  'info': 'info',
  'sostituzione': 'replacement',
  '{n} da leggere': '{n} unread',
  'Elimina messaggio': 'Delete message',
  'Togliere il messaggio?': 'Remove message?',
  'questo messaggio': 'this message',

  // ── Allenamento: nota, carico consigliato, storico della scheda ──
  '{n} in salita': '{n} up',
  '{n} in calo': '{n} down',
  'primo allenamento': 'first workout',
  'carichi invariati': 'same loads',
  'Dal coach': 'From coach',
  'Creata da te': 'Created by you',
  'Nome della scheda': 'Plan name',
  'Storico allenamenti': 'Workout history',

  // ── Hyrox: la gara stimata e le gare registrate ──
  'ipotesi: {n} passaggi × {s} s': 'assumption: {n} transitions × {s} s',
  'somma dei tuoi PB': 'sum of your PBs',
  '{d} nell’ultimo mese': '{d} in the last month',
  'invariato nell’ultimo mese': 'unchanged in the last month',
  'Da controllare': 'Needs checking',
  'Il {d} hai registrato {n} segmenti a metà distanza.': 'On {d} you logged {n} segments at half distance.',
  'Se era una simulazione intera, i tempi sono quelli giusti ma la distanza no: la stima li legge come mezze e li raddoppia.': 'If it was a full simulation, the times are right but the distance isn’t: the estimate reads them as halves and doubles them.',
  'Erano intere': 'They were full',
  'Erano a metà': 'They were half',
  'Registra una gara o una simulazione': 'Log a race or simulation',
  'Corsa {c}, stazioni {s}, Roxzone {r}': 'Running {c}, stations {s}, Roxzone {r}',
  'Corsa': 'Running',
  'Stazioni': 'Stations',
  'Roxzone': 'Roxzone',
  'Corsa · PB': 'Running · PB',
  'Stazioni · PB': 'Stations · PBs',
  '{n} passaggi': '{n} transitions',
  'Gare e simulazioni': 'Races and simulations',
  'Corsa, stazioni e Roxzone, con i tempi della distanza intera': 'Running, stations and Roxzone, with full-distance times',
  // "Prove" tiene insieme gare e simulazioni: in inglese la parola neutra è "event".
  '1 prova': '1 event',
  '{n} prove': '{n} events',
  'parziale': 'partial',
  'Simulazione': 'Simulation',
  'Elimina gara': 'Delete race',
  'Modifica gara': 'Edit race',
  'Registra una gara': 'Log a race',
  'Tipo': 'Type',
  'Tempi': 'Times',
  'Solo le cifre: 425 diventa 4:25, 4040 diventa 40:40. Un tempo lasciato vuoto non conta.': 'Digits only: 425 becomes 4:25, 4040 becomes 40:40. A time left empty doesn’t count.',
  '8 km, sommati': '8 km, combined',
  'tutti i passaggi, sommati': 'all transitions, combined',
  'Totale': 'Total',
  '1 tempo mancante: totale parziale': '1 time missing: partial total',
  '{n} tempi mancanti: totale parziale': '{n} times missing: partial total',
  'Apri un giorno per vederne le alzate, poi toccane una per correggere chili, colpi o nota.': 'Open a day to see its lifts, then tap one to correct its weight, reps or note.',
  'Senza data': 'No date',
  'ultimo {giorno}': 'last on {giorno}',
  'L’ultima volta {fatte} serie su {serie}: meglio scendere.': 'Last time {fatte} of {serie} sets: better to go lighter.',
  'L’ultima volta una serie sotto i {n} colpi: meglio scendere.': 'Last time one set under {n} reps: better to go lighter.',
  'L’ultima volta hai dovuto alleggerire: riparti più basso.': 'Last time you had to drop the weight: start lower.',
  'Carico consigliato': 'Suggested load',
  'Puoi salire': 'You can go up',
  'Devi salire': 'Time to go up',
  'L’ultima volta tutte le serie e i colpi a {kg} kg: valuta un aumento leggero.': 'Last time all sets and reps at {kg} kg: consider a small increase.',
  'Due settimane di fila tutto fatto a {kg} kg: è ora di salire.': 'Two weeks in a row with everything done at {kg} kg: time to go up.',
  'L’ultima volta le ultime serie sono salite e hanno retto: oggi tutte a {kg} kg.': 'Last time the last sets went up and held: today all of them at {kg} kg.',
  'L’ultima volta l’ultima serie è salita e ha retto: oggi {alte} serie su {serie} a {kg} kg.': 'Last time the last set went up and held: today {alte} of {serie} sets at {kg} kg.',
  'Ripeti i carichi dell’ultima volta.': 'Repeat last time’s loads.',
  'Dopo lo stop': 'After the break',
  'Esercizio nuovo': 'New exercise',
  'Muscolo già stanco': 'Muscle already tired',
  'Lo fai da poco: per le prime due settimane resta su questi carichi e cura l’esecuzione. Del peso si riparla dopo.': 'You’ve only just started it: for the first two weeks stay on these loads and focus on technique. The weight can wait.',
  'È ancora un esercizio nuovo: l’ultima volta tutto fatto a {kg} kg, puoi provare a salire, ma di poco. Prima viene l’esecuzione.': 'It’s still a new exercise: last time everything done at {kg} kg, so you can try going up, but only slightly. Technique comes first.',
  'L’ultima volta lo facevi con il muscolo già stanco da un altro esercizio. Oggi ci arrivi più fresco: prova a salire, di poco.': 'Last time you did it with the muscle already tired from another exercise. Today you get to it fresher: try going up, slightly.',
  'L’ultima volta non hai chiuso tutto, ma il muscolo era già stanco da un altro esercizio. Oggi ci arrivi più fresco: riprova con gli stessi carichi.': 'Last time you didn’t finish everything, but the muscle was already tired from another exercise. Today you get to it fresher: try the same loads again.',
  'Oggi lo fai dopo un altro esercizio per lo stesso muscolo, e l’ultima volta ci arrivavi più fresco: potrebbe essere più faticoso. Tieni questi carichi, senza salire.': 'Today it comes after another exercise for the same muscle, and last time you got to it fresher: it may feel harder. Keep these loads, without going up.',

  // ── Grafici dell'allievo e correzione delle alzate ──
  'Il tuo allenatore ha corretto un’alzata': 'Your coach corrected a lift',
  'Il tuo allenatore ha corretto {n} alzate': 'Your coach corrected {n} lifts',
  'il tuo allenatore': 'your coach',
  'corretta da {chi}': 'corrected by {chi}',
  'Correggi': 'Correct',
  'Grafici': 'Charts',
  'tocca un esercizio per il grafico': 'tap an exercise for its chart',
  'ultima': 'last',
  'Dall’inizio': 'Since the start',
  '1 carico salito': '1 load up',
  '{n} carichi saliti': '{n} loads up',

  // ── Esercizi a colpi, note per muscolo, sessioni per settimana ──
  'la serie più lunga, sessione per sessione': 'the longest set, session by session',
  'Serie migliore: {n} colpi': 'Best set: {n} reps',
  'Serie migliore': 'Best set',
  'Ultima': 'Last',
  '1 nota': '1 note',
  '{n} note': '{n} notes',
  'Settimane': 'Weeks',
  'Contate dal {giorno}, quando hai assegnato la prima scheda.': 'Counted from {giorno}, when you assigned the first plan.',
  'Contate dalla prima sessione registrata: non ci sono schede assegnate.': 'Counted from the first logged session: there are no assigned plans.',
  'Prima delle schede': 'Before the plans',
  'Settimana {n}': 'Week {n}',
  'in corso': 'in progress',
  '1 da guardare': '1 to review',
  '{n} da guardare': '{n} to review',
  // Sul quadrante del timer: la fase in cui si sta facendo la serie.
  'Esecuzione': 'Working',
  'Serie finita': 'Set done',
  'Timer': 'Timer',
  'Chiudi il timer': 'Close timer',
  'Apri il timer': 'Open timer',
  'Riprendi': 'Resume',
  'Oltre il recupero': 'Over rest time',
  'tocca per riprendere': 'tap to resume',
  'Finita la serie, tocca il timer per il recupero.': 'When the set is done, tap the timer to start your rest.',
  'Recupero finito: è ora della prossima serie.': 'Rest over: time for the next set.',
  'Recupero': 'Rest',
  'Salta': 'Skip',
  'Tempo di recuperare e registrare la serie.': 'Time to rest and log the set.',
  'Elimina gruppo': 'Delete group',
  'Non lo fai da {n} giorni: probabilmente farai più fatica a sollevare questi carichi, visto lo stop. Riparti da qui senza salire.': 'You haven’t done it for {n} days: after the break, these loads will probably feel harder. Restart from here without going up.',
  'La scheda è cambiata dall’ultima volta: riparti dai carichi che avevi.': 'The plan has changed since last time: restart from the loads you had.',
  'Non fai questa scheda da {n} giorni: probabilmente farai più fatica con i carichi dell’ultima volta.': 'You haven’t done this plan for {n} days: last time’s loads will probably feel harder.',
  '{n} giorni fa': '{n} days ago',
  'Non ti alleni da {n} giorni': 'You haven’t trained for {n} days',
  'Ultimo allenamento: {quando}': 'Last workout: {quando}',
  'Non si allena da {n} giorni: alla ripresa farà più fatica con i carichi di prima.': 'Hasn’t trained for {n} days: on return, the previous loads will feel harder.',
  'Allenamento in corso': 'Workout in progress',
  'Scartare l’allenamento?': 'Discard workout?',
  'Le serie spuntate finora non vengono salvate. La prossima volta la scheda riparte da zero.': 'The sets ticked off so far won’t be saved. Next time the plan starts from scratch.',
  'Scarta': 'Discard',
  '{fatte}/{totali} serie fatte · tocca per riprendere': '{fatte}/{totali} sets done · tap to resume',
  'Scarta allenamento in corso': 'Discard workout in progress',
  'Riprendi allenamento': 'Resume workout',
  'Usa': 'Use',
  'Nota dell’ultima volta:': 'Note from last time:',
  'Aggiungi nota': 'Add note',
  'nota': 'note',
  'Nota su questa sessione…': 'Note on this session…',

  // ── Carosello dei gruppi muscolari ──
  'Ultima volta: {data}': 'Last time: {data}',
  'Vedi a carosello': 'View as carousel',
}
