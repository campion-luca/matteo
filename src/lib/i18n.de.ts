// Il dizionario tedesco. Due mappe separate, con due destini diversi.
//
//  · DE_UI   — il testo dell'interfaccia. Chiave = la frase italiana, eventualmente
//              preceduta da un contesto (`'grafico|Carico'`). Vedi `i18n.ts`.
//  · DE_DATA — i nomi che stanno DENTRO i dati dell'utente: gruppi muscolari,
//              esercizi del catalogo iniziale, stazioni Hyrox. Nello store restano
//              scritti in italiano — sono anche la chiave dei colori in
//              `muscleColors` — e si traducono soltanto quando si stampano.
//              Quello che non è qui esce com'è: sono i nomi scritti a mano
//              dall'utente, che nessuno deve tradurgli.

// ── Nomi nei dati ──────────────────────────────────────────────
export const DE_DATA: Record<string, string> = {
  // Gruppi muscolari. 'Altro' è il gruppo di chi non sceglie: esiste nei dati
  // ma non ha una regione sulla mappa del corpo.
  'Petto': 'Brust',
  'Dorso': 'Rücken',
  'Spalle': 'Schultern',
  'Bicipiti': 'Bizeps',
  'Tricipiti': 'Trizeps',
  'Core': 'Rumpf',
  'Gambe': 'Beine',
  'Glutei': 'Gesäß',
  'Altro': 'Sonstige',

  // Il catalogo di partenza precedente. Non è più quello che si installa a chi si
  // registra oggi, ma resta qui: quei nomi sono nello store di chi usa l'app da
  // prima, e toglierli glieli farebbe tornare in italiano da un giorno all'altro.
  //
  // Dove la sala tedesca usa l'inglese (Hip Thrust, Crunches) l'inglese resta:
  // tradurlo darebbe un nome che nessuno pronuncia in palestra.
  'Panca piana': 'Bankdrücken',
  'Panca inclinata': 'Schrägbankdrücken',
  'Croci ai cavi': 'Kabelzug-Fliegende',
  'Chest press': 'Brustpresse',
  'Piegamenti': 'Liegestütze',

  'Trazioni alla sbarra': 'Klimmzüge',
  'Lat machine': 'Latzug',
  'Rematore con bilanciere': 'Langhantelrudern',
  'Pulley basso': 'Rudern am Kabelzug',
  'Stacco da terra': 'Kreuzheben',

  'Lento avanti': 'Schulterdrücken',
  'Alzate laterali': 'Seitheben',
  'Alzate posteriori': 'Vorgebeugtes Seitheben',
  'Tirate al mento': 'Aufrechtes Rudern',

  'Curl con bilanciere': 'Langhantel-Curls',
  'Curl con manubri': 'Kurzhantel-Curls',
  'Curl a martello': 'Hammer-Curls',
  'Panca Scott': 'Scott-Curls',

  'French press': 'Stirndrücken',
  'Push down ai cavi': 'Trizepsdrücken am Kabel',
  'Dip alle parallele': 'Dips am Barren',
  'Panca stretta': 'Enges Bankdrücken',

  'Crunch': 'Crunches',
  'Plank': 'Unterarmstütz',
  'Leg raise': 'Beinheben',
  'Russian twist': 'Russian Twist',

  'Squat': 'Kniebeuge',
  'Pressa': 'Beinpresse',
  'Affondi': 'Ausfallschritte',
  'Leg extension': 'Beinstrecker',
  'Leg curl': 'Beinbeuger',
  'Calf raise': 'Wadenheben',
  'Front squat': 'Frontkniebeuge',

  'Hip thrust': 'Hip Thrust',
  'Stacco rumeno': 'Rumänisches Kreuzheben',
  'Glute bridge': 'Beckenheben',
  'Abduzioni ai cavi': 'Abduktionen am Kabelzug',

  // Catalogo di partenza di oggi (vedi catalogo.ts). "MPW" è la marca del
  // macchinario e non si traduce: è un nome proprio, come Hip Thrust.
  'Panca piana al MPW': 'Bankdrücken am MPW',
  'Panca inclinata al MPW': 'Schrägbankdrücken am MPW',
  'Panca declinata al MPW': 'Negativbankdrücken am MPW',
  'Croci ai cavi bassi': 'Kabelzug-Fliegende von unten',
  'Croci ai cavi alti': 'Kabelzug-Fliegende von oben',
  'Croci alla peck deck': 'Butterfly',

  'Trazioni': 'Klimmzüge',
  'Stacco': 'Kreuzheben',
  'Lat machine presa larga': 'Latzug weiter Griff',
  'Rematore T-Bar presa larga': 'T-Bar-Rudern weiter Griff',
  'Rematore con manubri su panca inclinata': 'Kurzhantelrudern auf der Schrägbank',
  'Pulley basso presa stretta': 'Rudern am Kabelzug enger Griff',
  'Pullover al cavo alto': 'Überzüge am Kabelzug',
  'Scrollate con manubri': 'Kurzhantel-Shrugs',

  'Military press al MPW': 'Schulterdrücken am MPW',
  'Alzate laterali con manubri': 'Seitheben mit Kurzhanteln',
  'Alzate laterali al cavo': 'Seitheben am Kabelzug',
  'Peck deck inversa': 'Reverse Butterfly',
  'Face pull': 'Face Pull',

  'Curl manubri su panca inclinata': 'Schrägbank-Curls',
  'Curl bilanciere Z': 'SZ-Curls',
  'Curl panca Scott': 'Scott-Curls',

  'Push down al cavo': 'Trizepsdrücken am Kabel',
  'Estensioni overhead al cavo': 'Überkopf-Trizepsdrücken am Kabel',

  'Sollevamenti gambe alla sbarra': 'Hängendes Beinheben',
  'Ab wheel': 'Bauchroller',
  'Woodchopper ai cavi': 'Holzhacker am Kabelzug',
  'Pallof press al cavo': 'Pallof Press am Kabelzug',
  'Landmine press rotation': 'Landmine Press mit Rotation',
  'Suitcase carry': 'Koffertragen',

  'Leg curl seduto': 'Beinbeuger sitzend',
  'Polpacci in piedi': 'Wadenheben stehend',
  'Polpacci seduto': 'Wadenheben sitzend',

  "Abduzione dell'anca al cavo": 'Hüftabduktion am Kabelzug',

  // Stazioni Hyrox: i nomi di gara sono gli stessi in Germania — SkiErg, Sled Push,
  // Wall Balls stanno scritti così anche sul percorso di Hyrox Berlin. Si traduce
  // solo la corsa, che è l'unica voce non ufficiale dell'elenco.
  'Corsa (1 km)': 'Laufen (1 km)',
}

// ── Interfaccia ────────────────────────────────────────────────
// Le voci sono raggruppate come le schermate dell'app. Una chiave che manca non
// è un errore: la frase esce in italiano.
export const DE_UI: Record<string, string> = {
  // ── Sincronizzazione (App) ───────────────────────────────────
  'Aggiornato da un altro dispositivo': 'Von einem anderen Gerät aktualisiert',
  'Catalogo esercizi rinnovato': 'Übungskatalog erneuert',
  'Catalogo esercizi rinnovato (senza copia di scorta)':
    'Übungskatalog erneuert (ohne Sicherungskopie)',
  'Dati cloud non caricati — tocca per riprovare': 'Cloud-Daten nicht geladen — zum Wiederholen tippen',
  'Non sincronizzato — tocca per riprovare': 'Nicht synchronisiert — zum Wiederholen tippen',

  // ── Suggerimenti (CoachMark) ─────────────────────────────────
  'Come funziona': 'So funktioniert’s',
  'Ho capito': 'Verstanden',
  'Allenamento': 'Training',
  'Gruppo muscolare': 'Muskelgruppe',
  'Scheda esercizio': 'Übungsblatt',
  'Registra un’alzata': 'Satz eintragen',
  'Tutti i grafici': 'Alle Diagramme',
  'Schede': 'Pläne',
  'Mappa della forza': 'Kraftkarte',
  'Profilo': 'Profil',
  'Personal Coach': 'Personal Coach',
  'Budget': 'Budget',
  'I tuoi esercizi sono raccolti per gruppo muscolare: tocca un gruppo per aprirlo.':
    'Deine Übungen sind nach Muskelgruppe sortiert: tippe auf eine Gruppe, um sie zu öffnen.',
  'Dentro ogni esercizio registri le alzate — carico, serie e ripetizioni — e le ritrovi tutte nello storico.':
    'In jeder Übung trägst du deine Sätze ein — Gewicht, Sätze und Wiederholungen — und findest sie alle im Verlauf wieder.',
  'Con “Schede” prepari un allenamento in anticipo e poi lo esegui passo passo.':
    'Mit „Pläne“ bereitest du ein Training vor und arbeitest es dann Schritt für Schritt ab.',
  'Qui trovi tutti gli esercizi di questo gruppo, con l’ultima alzata registrata.':
    'Hier findest du alle Übungen dieser Gruppe, mit dem zuletzt eingetragenen Satz.',
  'Il colore del gruppo lo scegli tu: si cambia dalla matita dell’esercizio.':
    'Die Farbe der Gruppe wählst du selbst: sie lässt sich über den Stift der Übung ändern.',
  'Tocca un esercizio per aprirlo e registrare una nuova alzata.':
    'Tippe auf eine Übung, um sie zu öffnen und einen neuen Satz einzutragen.',
  'Il tasto grande registra una nuova alzata: carico, serie e ripetizioni.':
    'Die große Taste trägt einen neuen Satz ein: Gewicht, Sätze und Wiederholungen.',
  'Sotto trovi lo storico completo — ogni riga si può correggere o cancellare.':
    'Darunter steht der vollständige Verlauf — jede Zeile lässt sich korrigieren oder löschen.',
  'Il grafico segue il carico nel tempo: toccalo per aprire tutti gli altri.':
    'Das Diagramm verfolgt das Gewicht über die Zeit: tippe darauf, um alle anderen zu öffnen.',
  'Se vuoi ripartire da zero senza perdere l’esercizio, usa “svuota la memoria”.':
    'Willst du bei null anfangen, ohne die Übung zu verlieren, nutze „Verlauf leeren“.',
  'Metti il carico più alto che hai usato, le serie e le ripetizioni.':
    'Trage das höchste Gewicht ein, das du benutzt hast, dazu Sätze und Wiederholungen.',
  'Se hai cambiato peso serie per serie, accendi “peso diverso per serie”.':
    'Hast du das Gewicht von Satz zu Satz geändert, schalte „Gewicht pro Satz“ ein.',
  '“A corpo libero” somma il tuo peso corporeo: le trazioni non valgono zero.':
    '„Eigengewicht“ rechnet dein Körpergewicht dazu: Klimmzüge zählen nicht als null.',
  'Se batti il tuo massimo su questo esercizio, l’app te lo dice subito.':
    'Schlägst du dein Maximum bei dieser Übung, sagt es dir die App sofort.',
  '“Carico” è il peso sul bilanciere, “Massimale stimato” tiene conto anche delle ripetizioni.':
    '„Gewicht“ ist die Last auf der Stange, „Geschätztes Maximum“ berücksichtigt auch die Wiederholungen.',
  'Sull’asse verticale ci sono i chili, in basso la data di ogni alzata.':
    'Auf der senkrechten Achse stehen die Kilo, unten das Datum jedes Satzes.',
  'Sono due letture della stessa storia: il carico dice cosa hai caricato, il massimale quanto sei forte.':
    'Es sind zwei Lesarten derselben Geschichte: das Gewicht sagt, was du aufgeladen hast, das Maximum, wie stark du bist.',
  'Una scheda è l’allenamento scritto prima: esercizi, serie e ripetizioni in ordine.':
    'Ein Plan ist das vorab aufgeschriebene Training: Übungen, Sätze und Wiederholungen der Reihe nach.',
  'In esecuzione la segui riga per riga e ogni serie chiusa finisce nello storico.':
    'Beim Durchführen folgst du ihm Zeile für Zeile, und jeder abgehakte Satz landet im Verlauf.',
  'Puoi collegare ogni riga a un esercizio esistente, così i progressi si sommano ai suoi.':
    'Du kannst jede Zeile mit einer vorhandenen Übung verknüpfen, so summieren sich die Fortschritte dort.',
  'Ogni distretto è colorato per quanto sei forte, non per quanti chili sollevi.':
    'Jede Region ist danach eingefärbt, wie stark du bist — nicht danach, wie viele Kilo du hebst.',
  'Il punteggio va da 0 a 100, dove 100 è il livello “forte” di quel distretto: così braccia e gambe si confrontano.':
    'Der Wert geht von 0 bis 100, wobei 100 die Stufe „stark“ dieser Region ist: so lassen sich Arme und Beine vergleichen.',
  'Tocca un distretto per vedere i chili veri da cui esce il punteggio.':
    'Tippe auf eine Region, um die echten Kilo hinter dem Wert zu sehen.',
  'Peso e altezza non sono un vezzo: da lì escono la forza relativa e la mappa del corpo.':
    'Gewicht und Größe sind keine Spielerei: daraus ergeben sich die relative Kraft und die Körperkarte.',
  'Da qui cambi tema, colore e stile del menù di navigazione.':
    'Von hier aus änderst du Thema, Farbe und Stil der Navigation.',
  'Da qui registri il peso quando ti pesi: serve al trend, non al singolo numero.':
    'Hier trägst du dein Gewicht ein, wenn du dich wiegst: es zählt der Verlauf, nicht die einzelne Zahl.',
  'Puoi far seguire i tuoi allenamenti da un’altra persona che usa Matteo.':
    'Du kannst dein Training von einer anderen Person betreuen lassen, die Matteo benutzt.',
  'Generi un codice, glielo dai, e da quel momento vede i tuoi allenamenti e il tuo peso.':
    'Du erzeugst einen Code, gibst ihn weiter, und ab dann sieht sie dein Training und dein Gewicht.',
  'Vede solo: non può modificare niente. E puoi togliergli l’accesso quando vuoi.':
    'Sie sieht nur zu: ändern kann sie nichts. Und du kannst den Zugang jederzeit entziehen.',
  'Dall’altra linguetta fai il contrario: inserisci il codice di chi vuoi seguire.':
    'Im anderen Reiter machst du es umgekehrt: du gibst den Code der Person ein, die du betreuen willst.',
  'Metti lo stipendio e le spese fisse: l’app calcola cosa ti resta ogni mese.':
    'Trage Gehalt und Fixkosten ein: die App rechnet aus, was dir jeden Monat bleibt.',
  'Le spese grosse imminenti si scalano a parte, senza sporcare il conto mensile.':
    'Größere anstehende Ausgaben werden separat abgezogen, ohne die Monatsrechnung zu verfälschen.',
  'Il “sogno” ti dice fra quanto ci arrivi con quello che avanzi.':
    'Der „Traum“ sagt dir, wann du ihn mit dem erreichst, was übrig bleibt.',

  // ── Dialogo di conferma ──────────────────────────────────────
  'Eliminazione': 'Löschen',
  'Sicuro di voler eliminare?': 'Wirklich löschen?',
  'Stai per eliminare': 'Du löschst gleich',
  'L’azione è definitiva.': 'Die Aktion ist endgültig.',
  'No': 'Nein',
  'Sì, elimina': 'Ja, löschen',
  'questo elemento': 'dieses Element',

  // ── Schermata d'errore ───────────────────────────────────────
  'Qualcosa è andato storto': 'Etwas ist schiefgelaufen',
  'Si è verificato un errore imprevisto. Puoi svuotare la cache e ricaricare l’app.':
    'Es ist ein unerwarteter Fehler aufgetreten. Du kannst den Cache leeren und die App neu laden.',
  'Dettagli tecnici': 'Technische Details',
  'Nascondi dettagli tecnici': 'Technische Details ausblenden',
  'Svuota cache e ricarica': 'Cache leeren und neu laden',

  // ── Installazione e aggiornamento ────────────────────────────
  'Aggiungi alla schermata Home': 'Zum Home-Bildschirm hinzufügen',
  'Condividi → “Aggiungi alla schermata Home” per usarla senza la barra Safari':
    'Teilen → „Zum Home-Bildschirm“, um sie ohne die Safari-Leiste zu nutzen',
  'Chiudi': 'Schließen',
  'Nuova versione disponibile': 'Neue Version verfügbar',
  'Aggiorna': 'Aktualisieren',

  // ── Spiegazioni (ⓘ) ─────────────────────────────────────────
  'Cos’è': 'Was ist das',
  'Come si calcola': 'So wird gerechnet',
  'Da sapere': 'Gut zu wissen',

  // ── Navigazione ──────────────────────────────────────────────
  'Home': 'Start',
  'Impostazioni': 'Einstellungen',
  'Personal OS': 'Personal OS',
  'Apri Budget': 'Budget öffnen',
  'Apri Personal Coach': 'Personal Coach öffnen',
  'Vai alla Home': 'Zur Startseite',
  'Vai all’allenamento': 'Zum Training',

  // ── Saluti ───────────────────────────────────────────────────
  'Buongiorno': 'Guten Morgen',
  'Buon pomeriggio': 'Guten Tag',
  'Buonasera': 'Guten Abend',
  'Buonanotte': 'Gute Nacht',
  'Buon Natale': 'Frohe Weihnachten',
  'Buon Anno Nuovo': 'Frohes neues Jahr',
  'Buona Pasqua': 'Frohe Ostern',
  'Buon Ferragosto': 'Schönen Feiertag',
  'Buon 1° Maggio': 'Schönen 1. Mai',
  'Buon 25 Aprile': 'Schönen Tag der Befreiung',
  'Buona Festa della Repubblica': 'Schönen Tag der Republik',

  // ── Primo avvio ──────────────────────────────────────────────
  'Passo {n} di {tot}': 'Schritt {n} von {tot}',
  'Come ti chiami?': 'Wie heißt du?',
  'Serve solo per salutarti. Puoi metterci quello che vuoi.':
    'Nur zur Begrüßung. Du kannst hineinschreiben, was du willst.',
  'Sesso': 'Geschlecht',
  'Cambia le soglie di forza: gli stessi chili non valgono lo stesso grado.':
    'Ändert die Kraftschwellen: dieselben Kilo bedeuten nicht dieselbe Stufe.',
  'Quando sei nato?': 'Wann bist du geboren?',
  'Da qui l’app ricava l’età, senza doverla aggiornare ogni anno.':
    'Daraus errechnet die App dein Alter, ohne dass du es jedes Jahr ändern musst.',
  'Quanto pesi?': 'Wie viel wiegst du?',
  'È la misura su cui si calcola la forza. Senza, la mappa del corpo resta vuota.':
    'Das ist die Größe, auf der die Kraft berechnet wird. Ohne sie bleibt die Körperkarte leer.',
  'Quanto sei alto?': 'Wie groß bist du?',
  'Serve al fabbisogno calorico del Personal Coach.':
    'Wird für den Kalorienbedarf im Personal Coach gebraucht.',
  'Il tuo nome': 'Dein Name',
  'Uomo': 'Mann',
  'Donna': 'Frau',
  '{n} anni': '{n} Jahre',
  'Avanti': 'Weiter',
  'Iniziamo': 'Los geht’s',

  // ── Accesso ──────────────────────────────────────────────────
  'Fatto in Italia': 'Made in Italy',
  'Accedi': 'Anmelden',
  'Crea account': 'Konto erstellen',
  'Recupera password': 'Passwort zurücksetzen',
  'Nuova password': 'Neues Passwort',
  'email': 'E-Mail',
  'password': 'Passwort',
  'nuova password': 'neues Passwort',
  'conferma password': 'Passwort bestätigen',
  'Mostra password': 'Passwort anzeigen',
  'Nascondi password': 'Passwort ausblenden',
  'Ricordami': 'Angemeldet bleiben',
  'Entra': 'Einloggen',
  'Registrati': 'Registrieren',
  'Invia email': 'E-Mail senden',
  'Aggiorna password': 'Passwort aktualisieren',
  'Non hai un account? Registrati': 'Noch kein Konto? Registrieren',
  'Password dimenticata?': 'Passwort vergessen?',
  'Hai già un account? Accedi': 'Schon ein Konto? Anmelden',
  'Torna al login': 'Zurück zur Anmeldung',
  'La password deve avere almeno 6 caratteri.': 'Das Passwort muss mindestens 6 Zeichen haben.',
  'Le password non coincidono.': 'Die Passwörter stimmen nicht überein.',
  'Ti abbiamo inviato una email: conferma l’indirizzo per completare la registrazione.':
    'Wir haben dir eine E-Mail geschickt: bestätige die Adresse, um die Registrierung abzuschließen.',
  'Email inviata. Controlla la tua casella di posta.': 'E-Mail gesendet. Sieh in deinem Postfach nach.',
  'Password aggiornata. Accesso in corso…': 'Passwort aktualisiert. Anmeldung läuft…',
  'Email o password non corretti.': 'E-Mail oder Passwort sind falsch.',
  'Devi prima confermare la tua email. Controlla la casella di posta.':
    'Du musst zuerst deine E-Mail bestätigen. Sieh in deinem Postfach nach.',
  'Esiste già un account con questa email.': 'Mit dieser E-Mail besteht bereits ein Konto.',
  'Indirizzo email non valido.': 'Ungültige E-Mail-Adresse.',
  'Troppi tentativi. Riprova tra qualche minuto.': 'Zu viele Versuche. Versuche es in ein paar Minuten erneut.',
  'Troppi tentativi ravvicinati. Attendi qualche istante e riprova.':
    'Zu viele Versuche kurz hintereinander. Warte einen Moment und versuche es erneut.',

  // ── Avvio ────────────────────────────────────────────────────
  'Bentornato': 'Willkommen zurück',
  'Benvenuto': 'Willkommen',
  'Tocca per saltare': 'Zum Überspringen tippen',

  // ── Budget ───────────────────────────────────────────────────
  'Stipendio mensile netto': 'Monatliches Nettogehalt',
  'Ogni mese': 'Jeden Monat',
  'Entrate': 'Einnahmen',
  'Spese fisse': 'Fixkosten',
  'Spese variabili': 'Variable Kosten',
  'Spese grosse imminenti': 'Größere anstehende Ausgaben',
  'Ciò che paghi ogni mese: affitto, bollette, abbonamenti, rate…':
    'Was du jeden Monat zahlst: Miete, Nebenkosten, Abos, Raten…',
  'Spese eccezionali medie al mese: cinema, mangiare fuori, svago…':
    'Außergewöhnliche Ausgaben im Monatsschnitt: Kino, Essen gehen, Freizeit…',
  'Uscite una tantum in arrivo: tagliando auto, vacanza estiva, elettrodomestici…':
    'Einmalige Ausgaben, die anstehen: Autoinspektion, Sommerurlaub, Haushaltsgeräte…',
  'Ti resta al mese': 'Bleibt dir im Monat',
  'Sforo mensile': 'Monatliches Minus',
  '{somma} di uscite totali': '{somma} Ausgaben insgesamt',
  'Descrizione': 'Beschreibung',
  'Aggiungi voce': 'Posten hinzufügen',
  'Nessuna voce ancora.': 'Noch keine Posten.',
  'Nessuna voce · tocca per aggiungere': 'Keine Posten · zum Hinzufügen tippen',
  '1 voce': '1 Posten',
  '{n} voci': '{n} Posten',
  '/mese': '/Monat',
  'tot': 'ges.',
  'Senza nome': 'Ohne Namen',
  'Fra 12 mesi': 'In 12 Monaten',
  'messi da parte': 'zurückgelegt',
  'di debito accumulato': 'aufgelaufene Schulden',
  'Spese grosse sostenibili': 'Tragbare größere Ausgaben',
  'Con le spese attuali non riesci a mettere da parte nulla: rivedi le uscite prima di pianificare spese grosse.':
    'Mit den jetzigen Ausgaben kannst du nichts zurücklegen: sieh die Kosten durch, bevor du größere Ausgaben planst.',
  'Copri': 'Du deckst',
  'tutte': 'alle',
  'le spese grosse e ti avanzano': 'größeren Ausgaben, und es bleiben dir',
  'Con {somma} copri': 'Mit {somma} deckst du',
  'spese su {tot}. Ti mancano': 'von {tot} Ausgaben. Es fehlen dir',
  'per farle tutte.': ', um alle zu schaffen.',
  'Il sogno da raggiungere': 'Der Traum, den du erreichen willst',
  'Una cosa che vuoi comprare: scrivi quanto costa e scopri se, col tuo risparmio, sei sulla giusta strada.':
    'Etwas, das du kaufen willst: schreib auf, was es kostet, und sieh, ob du mit deinen Ersparnissen auf dem richtigen Weg bist.',
  'Imposta un sogno': 'Traum festlegen',
  'Es. Moto, viaggio in Giappone, casa…': 'z. B. Motorrad, Japanreise, Haus…',
  'Costo': 'Kosten',
  'Già da parte': 'Schon gespart',
  'Entro il': 'Bis zum',
  'obiettivo raggiunto': 'Ziel erreicht',
  'mancano {somma}': 'es fehlen {somma}',
  'Ci sei: hai da parte tutto il necessario.': 'Du bist da: du hast alles Nötige beisammen.',
  'Puoi permettertelo.': 'Du kannst es dir leisten.',
  'Ogni mese non ti avanza nulla:': 'Jeden Monat bleibt dir nichts übrig:',
  'così non lo raggiungerai mai': 'so wirst du es nie erreichen',
  'Riduci le spese o aumenta le entrate.': 'Senke die Ausgaben oder erhöhe die Einnahmen.',
  'Al ritmo di {somma} al mese lo raggiungi in': 'Mit {somma} im Monat erreichst du es in',
  'in tempo per la data che hai scelto.': 'rechtzeitig zum gewählten Datum.',
  'Sei sulla giusta strada.': 'Du bist auf dem richtigen Weg.',
  'Ti servono': 'Du brauchst',
  'ma ne hai {quanti}: per arrivarci dovresti mettere da parte':
    'hast aber {quanti}: um dorthin zu kommen, müsstest du',
  'al mese invece di {somma}.': 'im Monat zurücklegen statt {somma}.',
  'verso {mese}.': 'etwa im {mese}.',
  'subito': 'sofort',
  '1 mese': '1 Monat',
  '{n} mesi': '{n} Monate',
  '1 anno': '1 Jahr',
  'e {n} mesi': 'und {n} Monate',

  // ── Personal Coach ───────────────────────────────────────────
  'Ti seguono': 'Betreuen dich',
  'Segui': 'Du betreust',
  'Caricamento…': 'Wird geladen…',
  'Attendi…': 'Bitte warten…',
  'Annulla': 'Abbrechen',
  'Il tuo codice': 'Dein Code',
  'Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso —':
    'Erzeuge einen Code und gib ihn der Person, die dich trainiert. Sie sieht dein Training, das Volumen und den Gewichtsverlauf —',
  'in sola lettura': 'nur lesend',
  'Il budget non esce da questo telefono. Puoi togliergli l’accesso quando vuoi.':
    'Das Budget verlässt dieses Telefon nicht. Du kannst den Zugang jederzeit entziehen.',
  'Genera un codice': 'Code erzeugen',
  'Nuovo codice': 'Neuer Code',
  'Copiato': 'Kopiert',
  'Tocca per copiare · scade il {data}': 'Zum Kopieren tippen · läuft ab am {data}',
  'Chi vede i tuoi allenamenti': 'Wer dein Training sieht',
  'Nessuno. I tuoi dati sono solo tuoi.': 'Niemand. Deine Daten gehören nur dir.',
  'Collega un allievo': 'Sportler verbinden',
  'Chiedi il codice a chi vuoi seguire: lo genera dalla sua app, in questa stessa schermata.':
    'Frag die Person, die du betreuen willst, nach ihrem Code: sie erzeugt ihn in ihrer App, auf genau diesem Bildschirm.',
  'CODICE': 'CODE',
  'Collega': 'Verbinden',
  'I tuoi allievi': 'Deine Sportler',
  'Nessun allievo collegato.': 'Kein Sportler verbunden.',
  'Allenatore': 'Trainer',
  'Allievo': 'Sportler',
  'Dal {data}': 'Seit {data}',
  'Scollega': 'Trennen',
  'Scollega {chi}': '{chi} trennen',
  'Togliere l’accesso?': 'Zugang entziehen?',
  '{chi} non vedrà più i tuoi allenamenti. I tuoi dati restano intatti.':
    '{chi} sieht dein Training nicht mehr. Deine Daten bleiben unverändert.',
  'Togliere dalla lista?': 'Aus der Liste entfernen?',
  'Non vedrai più gli allenamenti di {chi}. Per rientrare servirà un codice nuovo.':
    'Du siehst das Training von {chi} nicht mehr. Für einen erneuten Zugang braucht es einen neuen Code.',
  'Questa persona': 'Diese Person',
  'questa persona': 'diese Person',
  'questo allenatore': 'diesen Trainer',
  'questo allievo': 'diesen Sportler',
  'Questa persona non ha ancora salvato nulla.': 'Diese Person hat noch nichts gespeichert.',
  'Schede assegnate': 'Zugewiesene Pläne',
  'Nuova': 'Neu',
  'Nessuna scheda assegnata. Quelle che scrivi qui compaiono nelle sue «Schede d’allenamento», pronte da avviare.':
    'Keine Pläne zugewiesen. Was du hier schreibst, erscheint bei ihr unter „Trainingspläne“, startbereit.',
  'non ancora visibile a lui': 'für sie noch nicht sichtbar',
  'Elimina {cosa}': '{cosa} löschen',

  // ── Scheda dell'allievo ──────────────────────────────────────
  'Questa persona non ha ancora registrato allenamenti.': 'Diese Person hat noch keine Trainings eingetragen.',
  'Questa settimana': 'Diese Woche',
  'Allenamenti': 'Trainings',
  'Ultimo': 'Zuletzt',
  'oggi': 'heute',
  'ieri': 'gestern',
  '{n} gg fa': 'vor {n} Tagen',
  'Ultimo allenamento': 'Letztes Training',
  'Confronto col solito': 'Vergleich zum Üblichen',
  'Note sugli esercizi': 'Notizen zu den Übungen',
  'Nessuna scritta': 'Keine geschrieben',
  '1 scritta': '1 geschrieben',
  '{n} scritte': '{n} geschrieben',
  'Volume per settimana': 'Volumen pro Woche',
  'Peso': 'Gewicht',
  '{kg} kg oggi': '{kg} kg heute',
  'Forza per distretto': 'Kraft nach Region',
  'Sessioni': 'Einheiten',
  '{n} in tutto': '{n} insgesamt',
  'Scegli la sessione': 'Einheit wählen',
  '1 alzata': '1 Satz',
  '{n} alzate': '{n} Sätze',
  'Solo hyrox, nessuna alzata di pesi.': 'Nur Hyrox, keine Gewichtssätze.',
  'massimale stimato': 'geschätztes Maximum',
  'Migliori alzate': 'Beste Sätze',
  'Nessuna nota': 'Keine Notiz',
  'Modifica': 'Bearbeiten',
  'Scrivi': 'Schreiben',
  'Cosa deve ricordarsi su {esercizio}': 'Was sie sich zu {esercizio} merken soll',
  'Nota su {esercizio}': 'Notiz zu {esercizio}',
  'Servono almeno due allenamenti sullo stesso esercizio per avere un confronto.':
    'Für einen Vergleich braucht es mindestens zwei Trainings mit derselben Übung.',
  'rispetto al solito': 'im Vergleich zum Üblichen',
  'Esercizio': 'Übung',
  'Serie': 'Sätze',
  'Colpi': 'Wdh.',
  'di solito': 'sonst',

  // ── Widget della home ────────────────────────────────────────
  'Trascina · attiva / disattiva': 'Ziehen · ein- / ausschalten',
  'attivo': 'an',
  'spento': 'aus',
  'Widget': 'Widgets',
  'Ordina la home': 'Startseite ordnen',
  'Nessun modulo attivo. Riaccendili da Impostazioni · Cambio widget.':
    'Kein Widget aktiv. Schalte sie unter Einstellungen · Widgets ändern wieder ein.',

  // ── Home ─────────────────────────────────────────────────────
  'Alleniamoci': 'Trainieren wir',
  'La tua settimana': 'Deine Woche',
  'Massimali': 'Maximalwerte',
  'Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.':
    'Trag einen Satz ein: hier erscheinen Kniebeuge, Bankdrücken und Kreuzheben.',
  'Total': 'Total',
  '{r}× il tuo peso': '{r}× dein Körpergewicht',
  '{r}× peso': '{r}× Gewicht',
  'Mai allenato': 'Nie trainiert',
  'Inserisci il peso nel profilo →': 'Gewicht im Profil eintragen →',
  'Ricerca globale': 'Globale Suche',
  'Trova esercizi e schede…': 'Übungen und Pläne finden…',

  // ── Ricerca ──────────────────────────────────────────────────
  'Cerca esercizi, schede…': 'Übungen, Pläne suchen…',
  'Nessun risultato per “{q}”': 'Kein Treffer für „{q}“',
  'Scrivi per cercare in tutta l’app —': 'Tippe, um die ganze App zu durchsuchen —',
  'esercizi e schede d’allenamento.': 'Übungen und Trainingspläne.',

  // ── Mappa del corpo ──────────────────────────────────────────
  '100 = forte per questo distretto': '100 = stark für diese Region',
  'Fronte': 'Vorne',
  'Retro': 'Hinten',
  'La forza si misura sul tuo peso corporeo.': 'Die Kraft wird an deinem Körpergewicht gemessen.',
  'Inseriscilo nel profilo': 'Trag es im Profil ein',
  'Iniziale': 'Einsteiger',
  'Base': 'Grundlage',
  'Buono': 'Gut',
  'Forte': 'Stark',

  // ── Traguardi ────────────────────────────────────────────────
  'Traguardi': 'Meilensteine',
  'I primi 100 kg': 'Die ersten 100 kg',
  'I primi 100 kg non si scordano mai.': 'Die ersten 100 kg vergisst man nie.',
  'Solleva 100 kg in una singola serie.': 'Heb 100 kg in einem einzelnen Satz.',
  'Light weight baby': 'Light weight baby',
  'Cento alzate di schiena. Light weight, baby!': 'Hundert Rückensätze. Light weight, baby!',
  'Registra {target} alzate di dorso (ne hai {fatte}).':
    'Trage {target} Rückensätze ein (du hast {fatte}).',

  // ── Palestra ─────────────────────────────────────────────────
  'Pesi': 'Gewichte',
  'Hyrox': 'Hyrox',
  'Cerca': 'Suchen',
  'Stats': 'Statistik',
  'Esercizi': 'Übungen',
  'Gara': 'Wettkampf',
  'Gruppi muscolari': 'Muskelgruppen',
  'Risultati': 'Treffer',
  'Cerca esercizio': 'Übung suchen',
  'Cerca esercizio…': 'Übung suchen…',
  'Cerca stazione…': 'Station suchen…',
  'Svuota la ricerca': 'Suche leeren',
  'Nessun esercizio': 'Keine Übung',
  'Nessuna stazione': 'Keine Station',
  'Nessun esercizio — aggiungine uno con +': 'Keine Übung — füg eine mit + hinzu',
  'Nessun esercizio in {gruppo} — aggiungine uno con +': 'Keine Übung in {gruppo} — füg eine mit + hinzu',
  'Aggiungi gli esercizi di base': 'Die Basisübungen hinzufügen',
  'Ne manca 1, con la sua immagine': '1 fehlt noch, mit ihrem Bild',
  'Ne mancano {n}, con la loro immagine': 'Es fehlen noch {n}, mit ihren Bildern',
  '1 esercizio': '1 Übung',
  '{n} esercizi': '{n} Übungen',
  '{n} esercizi in palestra': '{n} Übungen im Studio',
  '{n} esercizi hyrox': '{n} Hyrox-Übungen',
  '{n} esercizi tracciati': '{n} erfasste Übungen',
  'Vedi in elenco': 'Als Liste anzeigen',
  'Vedi in griglia': 'Als Raster anzeigen',
  'Nessuna alzata': 'Kein Satz',
  'Corsa · 8 × 1 km': 'Laufen · 8 × 1 km',
  'Stazioni gara': 'Wettkampfstationen',
  'Grafico andamento': 'Verlaufsdiagramm',

  // ── Dettaglio esercizio ──────────────────────────────────────
  'Nuova alzata': 'Neuer Satz',
  'Reset alzate': 'Sätze zurücksetzen',
  'Svuota lo storico, tieni l’esercizio': 'Verlauf leeren, Übung behalten',
  'Storico': 'Verlauf',
  '1 sessione': '1 Einheit',
  '{n} sessioni': '{n} Einheiten',
  '{n} sess.': '{n} Einh.',
  'Nessuna sessione registrata': 'Keine Einheit eingetragen',
  'Nessuna alzata registrata': 'Kein Satz eingetragen',
  'Massimale': 'Maximum',
  'Massimale stimato': 'Geschätztes Maximum',
  'Massimale stimato (kg)': 'Geschätztes Maximum (kg)',
  'Carico (kg)': 'Gewicht (kg)',
  'kg stim.': 'kg gesch.',
  'Alzata': 'Satz',
  'Scopri di più': 'Mehr sehen',
  'Registra almeno 2 alzate per vedere i grafici': 'Trag mindestens 2 Sätze ein, um die Diagramme zu sehen',
  'Servono almeno 2 sessioni per visualizzare i grafici': 'Für die Diagramme braucht es mindestens 2 Einheiten',
  'Miglior alzata': 'Bester Satz',
  'il peso sul bilanciere, sessione per sessione': 'das Gewicht auf der Stange, Einheit für Einheit',
  'quanto alzeresti per una singola: tiene conto anche dei colpi':
    'was du für eine einzelne Wiederholung heben würdest: zählt auch die Wiederholungen mit',
  'Azzerare lo storico?': 'Verlauf zurücksetzen?',
  'Svuota memoria': 'Verlauf leeren',
  'Sì, azzera': 'Ja, zurücksetzen',
  'Cancelli tutte le {n} alzate di “{nome}”. L’esercizio resta, con il suo nome, il gruppo muscolare e il colore: riparti da zero. L’azione è definitiva.':
    'Du löschst alle {n} Sätze von „{nome}“. Die Übung bleibt, mit Namen, Muskelgruppe und Farbe: du fängst bei null an. Die Aktion ist endgültig.',
  'Note': 'Notizen',
  'Le tue': 'Deine',
  'Note dell’esercizio': 'Notizen zur Übung',
  'Un promemoria per la prossima volta: presa, sedile, tempi…':
    'Eine Erinnerung für das nächste Mal: Griff, Sitz, Tempo…',

  // ── Statistiche ──────────────────────────────────────────────
  'Sessioni hyrox': 'Hyrox-Einheiten',
  'Volume per muscolo': 'Volumen pro Muskel',
  'Volte': 'Mal',
  'Allenamenti per muscolo': 'Trainings pro Muskel',
  '1 allenamento': '1 Training',
  '{n} allenamenti': '{n} Trainings',
  'Record personali': 'Persönliche Rekorde',
  'stima {n} kg': 'gesch. {n} kg',
  'Tempi per esercizio': 'Zeiten pro Übung',
  'media {v}': 'Ø {v}',
  'Nessuna sessione hyrox registrata': 'Keine Hyrox-Einheit eingetragen',
  'NESSUN DATO': 'KEINE DATEN',

  // ── Hyrox ────────────────────────────────────────────────────
  'Gara Hyrox': 'Hyrox-Wettkampf',
  'Miglior tempo': 'Bestzeit',
  'Trend': 'Trend',
  'Tempo (secondi)': 'Zeit (Sekunden)',
  'il grafico che scende = miglioramento': 'fallende Kurve = Verbesserung',
  'Pace (sec/km)': 'Pace (Sek./km)',
  'Pace (sec/500m)': 'Pace (Sek./500 m)',
  'Cadenza (rep/min)': 'Frequenz (Wdh./Min.)',
  'Nuova sessione': 'Neue Einheit',
  'Sessione': 'Einheit',
  'Tempo gara stimato · media sessioni': 'Geschätzte Wettkampfzeit · Durchschnitt der Einheiten',
  '{n}/9 segmenti tracciati': '{n}/9 Abschnitte erfasst',
  'stima completa': 'vollständige Schätzung',
  'stima parziale': 'teilweise Schätzung',
  'logga le sessioni mancanti nella scheda Esercizi': 'trage die fehlenden Einheiten im Reiter Übungen ein',
  'Corsa 1 km': 'Laufen 1 km',

  // ── Schede d'allenamento ─────────────────────────────────────
  'Schede d’allenamento': 'Trainingspläne',
  'Scheda': 'Plan',
  '1 scheda': '1 Plan',
  '{n} schede': '{n} Pläne',
  'Nessuna scheda — creane una con +': 'Kein Plan — erstell einen mit +',
  'Scheda vuota — modificala per aggiungere esercizi': 'Leerer Plan — bearbeite ihn, um Übungen hinzuzufügen',
  'Report gruppi muscolari': 'Bericht zu den Muskelgruppen',
  'Report muscolare': 'Muskelbericht',
  'Bozza': 'Entwurf',
  'da {chi}': 'von {chi}',
  'Nuova scheda': 'Neuer Plan',
  'Modifica scheda': 'Plan bearbeiten',
  'Nome scheda (es. Upper A)': 'Plannname (z. B. Oberkörper A)',
  'Esercizio {n}': 'Übung {n}',
  'superset': 'Supersatz',
  'collegato': 'verknüpft',
  'Sposta su': 'Nach oben',
  'Sposta giù': 'Nach unten',
  'Nome esercizio': 'Name der Übung',
  'Scegli il gruppo…': 'Gruppe wählen…',
  'Nota': 'Notiz',
  '(opzionale)': '(optional)',
  'Es. presa larga, tempo 3-1-1, RIR 2…': 'z. B. weiter Griff, Tempo 3-1-1, RIR 2…',
  'In superset con il prossimo': 'Im Supersatz mit der nächsten',
  'Superset con il prossimo': 'Supersatz mit der nächsten',
  'Aggiungi esercizio': 'Übung hinzufügen',
  'Manca il nome della scheda': 'Der Name des Plans fehlt',
  'Aggiungi almeno un esercizio con un nome': 'Füg mindestens eine Übung mit Namen hinzu',
  'Esercizio {n}: numero di serie non valido': 'Übung {n}: ungültige Satzzahl',
  'Esercizio {n}: mancano i colpi (ripetizioni)': 'Übung {n}: die Wiederholungen fehlen',
  'Esercizio {n}: scegli il gruppo muscolare': 'Übung {n}: wähle die Muskelgruppe',
  'Bozza salvata · da completare': 'Entwurf gespeichert · noch zu vervollständigen',
  'Da completare': 'Noch zu vervollständigen',
  'Salva modifiche': 'Änderungen speichern',
  'Salva scheda': 'Plan speichern',
  'Se manca qualcosa la scheda viene comunque salvata come bozza, senza perdere il lavoro.':
    'Fehlt etwas, wird der Plan trotzdem als Entwurf gespeichert — deine Arbeit geht nicht verloren.',
  'Senza gruppo': 'Ohne Gruppe',
  'Inizia allenamento': 'Training starten',
  '{fatti}/{tot} esercizi completati': '{fatti}/{tot} Übungen erledigt',
  'obiettivo': 'Ziel',
  'ultima volta': 'letztes Mal',
  'uguale': 'gleich',
  'Serie {n}': 'Satz {n}',
  'serie': 'Satz',
  'colpi': 'Wdh.',
  'Termina Allenamento': 'Training beenden',
  'Le serie completate verranno salvate come nuova alzata nei rispettivi esercizi.':
    'Die abgehakten Sätze werden als neuer Satz in den jeweiligen Übungen gespeichert.',
  'Com’è andata': 'Wie es gelaufen ist',
  'non svolto': 'nicht gemacht',
  'In rosso quello che è rimasto sotto il programma. Si salva com’è andata davvero: è quello che rende confrontabili gli allenamenti.':
    'Rot ist, was unter dem Plan geblieben ist. Gespeichert wird, wie es wirklich lief: nur so bleiben die Trainings vergleichbar.',
  'Salva e chiudi': 'Speichern und schließen',
  'Nessun esercizio nelle schede — creane per vedere il report':
    'Keine Übungen in den Plänen — erstell welche, um den Bericht zu sehen',
  'Distribuzione dei gruppi muscolari su tutte le schede: quante volte ogni gruppo viene colpito e la sua quota sul totale.':
    'Verteilung der Muskelgruppen über alle Pläne: wie oft jede Gruppe drankommt und ihr Anteil am Ganzen.',
  '1 volta': '1 Mal',
  '{n} volte': '{n} Mal',

  // ── Modali di registrazione ──────────────────────────────────
  'Log': 'Eintrag',
  'Data': 'Datum',
  'Tempo': 'Zeit',
  'min': 'Min.',
  'sec': 'Sek.',
  'Distanza / Ripetizioni': 'Distanz / Wiederholungen',
  'Kg (opzionale)': 'Kg (optional)',
  'Pace': 'Pace',
  'Salva': 'Speichern',
  'Modifica sessione': 'Einheit bearbeiten',
  'Quantità': 'Menge',
  'Data dell’alzata': 'Datum des Satzes',
  'Una singola al carico massimo. Serie e colpi valgono 1 × 1.':
    'Eine einzelne Wiederholung mit Maximalgewicht. Sätze und Wiederholungen zählen 1 × 1.',
  'Una singola al carico massimo: serie e colpi diventano 1 × 1.':
    'Eine einzelne Wiederholung mit Maximalgewicht: Sätze und Wiederholungen werden 1 × 1.',
  'Serie × Colpi': 'Sätze × Wdh.',
  'Kg': 'Kg',
  'Zavorra': 'Zusatzgewicht',
  'Zavorra extra': 'Extra-Zusatzgewicht',
  'colpi per serie': 'Wdh. pro Satz',
  'Serie {n} · kg': 'Satz {n} · kg',
  'Serie {n} · colpi': 'Satz {n} · Wdh.',
  'kg agg.': 'kg zus.',
  'kg aggiunti': 'zusätzliche kg',
  'Tipo di carico': 'Art der Last',
  'Attrezzo': 'Gerät',
  'Con attrezzo': 'Mit Gerät',
  'Corpo libero': 'Eigengewicht',
  'Tipo di alzata': 'Art des Satzes',
  'Uguale': 'Gleich',
  'Per serie': 'Pro Satz',
  'valori uguali': 'gleiche Werte',
  'valori per serie': 'Werte pro Satz',
  'Tecniche di intensità': 'Intensitätstechniken',
  'Eccentrica lenta': 'Langsam exzentrisch',
  'Concentrica lenta': 'Langsam konzentrisch',
  'Isometria al picco': 'Isometrie im Umkehrpunkt',
  'Drop Set': 'Dropsatz',
  'una singola a {kg} kg': 'eine einzelne mit {kg} kg',
  'da {kg} kg × {n} colpi': 'aus {kg} kg × {n} Wdh.',

  // ── Nuovo esercizio / modifica ───────────────────────────────
  'Nuovo esercizio': 'Neue Übung',
  'Palestra': 'Studio',
  'Nome': 'Name',
  'Target (distanza/reps)': 'Ziel (Distanz/Wdh.)',
  'Seleziona gruppo muscolare': 'Muskelgruppe wählen',
  'O scrivi manualmente': 'Oder von Hand eintragen',
  'Muscolo (es. Petto)': 'Muskel (z. B. Brust)',
  'Secondo gruppo muscolare (opzionale)': 'Zweite Muskelgruppe (optional)',
  'Secondo gruppo (opzionale)': 'Zweite Gruppe (optional)',
  'Secondo muscolo': 'Zweiter Muskel',
  'Nessuno': 'Keine',
  'Note (opzionale)': 'Notizen (optional)',
  'Esecuzione, setup, attrezzatura…': 'Ausführung, Einstellung, Ausrüstung…',
  'Aggiungi': 'Hinzufügen',
  'Modifica esercizio': 'Übung bearbeiten',
  'Colore gruppo muscolare — si applica a tutti gli esercizi':
    'Farbe der Muskelgruppe — gilt für alle Übungen',
  '{gruppo} — default': '{gruppo} — Standard',
  '{gruppo} — personalizzato': '{gruppo} — angepasst',
  'Modifica alzata': 'Satz bearbeiten',
  'Miglior Kg': 'Beste kg',
  'Miglior stima': 'Beste Schätzung',

  // ── Il momento del record ────────────────────────────────────
  'Nuovo record': 'Neuer Rekord',
  '{n} nuovi record': '{n} neue Rekorde',
  'era {kg} kg': 'vorher {kg} kg',
  'Massimale stimato dai chili e dai colpi della serie.':
    'Aus Gewicht und Wiederholungen des Satzes geschätztes Maximum.',
  'Bene così': 'Passt so',

  // ── Impostazioni ─────────────────────────────────────────────
  'Torna alle impostazioni': 'Zurück zu den Einstellungen',
  'Chiudi le impostazioni': 'Einstellungen schließen',
  'Nome utente': 'Benutzername',
  'Dati generali': 'Allgemeine Daten',
  'Età': 'Alter',
  'Peso (kg)': 'Gewicht (kg)',
  'Altezza (cm)': 'Größe (cm)',
  'Altezza': 'Größe',
  'Data di nascita': 'Geburtsdatum',
  'Registralo quando ti pesi: conta la direzione, non il numero di oggi.':
    'Trag es ein, wenn du dich wiegst: es zählt die Richtung, nicht die Zahl von heute.',
  'Peso di oggi in kg': 'Heutiges Gewicht in kg',
  'Registra': 'Eintragen',
  '{d} kg dalla prima delle {n} pesate': '{d} kg seit der ersten von {n} Wiegungen',
  'Serve una seconda pesata per vedere la direzione.':
    'Für die Richtung braucht es eine zweite Wiegung.',
  'Nessuna pesata registrata.': 'Keine Wiegung eingetragen.',

  // ── Lingua ───────────────────────────────────────────────────
  'Lingua': 'Sprache',
  'La lingua dell’app. I nomi che hai scritto tu restano come li hai scritti.':
    'Die Sprache der App. Namen, die du selbst geschrieben hast, bleiben so, wie du sie geschrieben hast.',
  'Impostare la lingua su {lingua}?': 'Sprache auf {lingua} umstellen?',
  'Tutta l’app passa in {lingua}. Puoi tornare indietro da qui quando vuoi.':
    'Die ganze App wechselt zu {lingua}. Du kannst hier jederzeit zurückwechseln.',
  'Sì, cambia lingua': 'Ja, Sprache umstellen',

  // ── Aspetto ──────────────────────────────────────────────────
  'Cambio tema': 'Thema ändern',
  'Cambio widget': 'Widgets ändern',
  'Dark mode': 'Dunkelmodus',
  'Fondo scuro e inchiostro chiaro.': 'Dunkler Grund, helle Schrift.',
  'Tema colore': 'Farbthema',
  'Sospeso dal layout {layout} — torna attivo con Standard.':
    'Vom Layout {layout} ausgesetzt — wird mit Standard wieder aktiv.',
  'Journal': 'Journal',
  'Rosa': 'Rosé',
  'Malva': 'Malve',
  'scuro': 'dunkel',
  'Cambio layout': 'Layout ändern',
  'Standard': 'Standard',
  'I colori del tema scelto sopra.': 'Die Farben des oben gewählten Themas.',
  'Notte': 'Nacht',
  'Niente colori, ma segue chiaro/scuro: di giorno resta grigio su bianco.':
    'Keine Farben, folgt aber hell/dunkel: tagsüber bleibt es grau auf weiß.',
  'Nero': 'Schwarz',
  'Sempre nero pieno, testo e dettagli bianchi. Ignora l’interruttore chiaro/scuro.':
    'Immer tiefschwarz, Text und Details weiß. Ignoriert den Hell-/Dunkel-Schalter.',
  'Tasto di navigazione': 'Navigationstaste',
  'Da che parte lo trovi in fondo allo schermo.': 'Auf welcher Seite du sie unten am Bildschirm findest.',
  'Sinistra': 'Links',
  'Centro': 'Mitte',
  'Destra': 'Rechts',

  // ── Account ──────────────────────────────────────────────────
  'Cambia password': 'Passwort ändern',
  'Password attuale': 'Aktuelles Passwort',
  'Password aggiornata ✓': 'Passwort aktualisiert ✓',
  'La nuova password deve avere almeno 6 caratteri.': 'Das neue Passwort muss mindestens 6 Zeichen haben.',
  'Utente non trovato.': 'Benutzer nicht gefunden.',
  'Password attuale non corretta.': 'Aktuelles Passwort ist falsch.',
  'Logout': 'Abmelden',

  // ── Svuota le alzate ─────────────────────────────────────────
  'Memoria delle alzate': 'Verlauf der Sätze',
  'Azzera lo storico di tutti gli esercizi e riparti da zero. Esercizi, schede, dati personali e pesate restano dove sono.':
    'Setzt den Verlauf aller Übungen zurück, und du fängst bei null an. Übungen, Pläne, persönliche Daten und Wiegungen bleiben erhalten.',
  'Svuota 1 alzata': '1 Satz löschen',
  'Svuota {n} alzate': '{n} Sätze löschen',
  'tutte le alzate': 'alle Sätze',
  'Cancellare tutte le alzate?': 'Alle Sätze löschen?',
  'l’unica alzata': 'den einzigen Satz',
  'tutte le {n} alzate': 'alle {n} Sätze',
  'Cancelli {quante} di tutti gli esercizi, e con esse massimali, record e grafici. Restano gli esercizi, le schede, i tuoi dati e le pesate. L’azione è definitiva.':
    'Du löschst {quante} aus allen Übungen, und damit Maximalwerte, Rekorde und Diagramme. Übungen, Pläne, deine Daten und die Wiegungen bleiben. Die Aktion ist endgültig.',
  'Sì, svuota': 'Ja, leeren',

  // ── Errori del Personal Coach (lato server) ──────────────────
  'Codice non valido o scaduto.': 'Code ungültig oder abgelaufen.',
  'Questo è il tuo codice: dallo a chi deve seguirti.':
    'Das ist dein eigener Code: gib ihn der Person, die dich betreuen soll.',
  'Sessione scaduta. Esci e rientra.': 'Sitzung abgelaufen. Melde dich ab und wieder an.',
  'La funzione non è ancora attiva sul server.': 'Die Funktion ist auf dem Server noch nicht aktiv.',
  'Non sei più collegato a questa persona: il collegamento è stato sciolto.':
    'Du bist mit dieser Person nicht mehr verbunden: die Verbindung wurde aufgelöst.',

  // ── Fonti dei massimali ──────────────────────────────────────
  'Dichiarato': 'Angegeben',
  'Stimato': 'Geschätzt',
  'Dal distretto': 'Aus der Region',

  // ── Spiegazioni dei numeri (ⓘ) ──────────────────────────────
  'Quanto sei forte in ogni distretto, su una scala che rende i distretti confrontabili fra loro.':
    'Wie stark du in jeder Region bist, auf einer Skala, die die Regionen untereinander vergleichbar macht.',
  'Il numero': 'Die Zahl',
  'Per ogni distretto si prende il massimale stimato dell’esercizio in cui vai meglio (non la media: la media punisce chi ha in lista un accessorio leggero) e lo si divide per il tuo peso corporeo. Un esercizio con due gruppi muscolari conta per intero sul primario e a metà sul secondario: il muscolo che assiste lavora, ma non con quel carico — nessuno curla i 60 kg di un rematore.':
    'Für jede Region wird das geschätzte Maximum der Übung genommen, in der du am besten bist (nicht der Durchschnitt: der bestraft alle, die eine leichte Zusatzübung in der Liste haben), und durch dein Körpergewicht geteilt. Eine Übung mit zwei Muskelgruppen zählt voll auf die primäre und zur Hälfte auf die sekundäre: der assistierende Muskel arbeitet mit, aber nicht mit dieser Last — niemand curlt die 60 kg einer Ruderübung.',
  'Il colore': 'Die Farbe',
  'Quattro livelli — iniziale, base, buono, forte — con soglie DIVERSE per distretto: servono 1.10× il tuo peso per un "base" sulle gambe e 0.35× per lo stesso grado sui bicipiti. È l’unico modo perché "colorato ovunque" voglia dire equilibrato e non solo "alleno le gambe".':
    'Vier Stufen — Einsteiger, Grundlage, gut, stark — mit UNTERSCHIEDLICHEN Schwellen je Region: für „Grundlage“ an den Beinen braucht es das 1,10-Fache deines Gewichts, für dieselbe Stufe am Bizeps das 0,35-Fache. Nur so heißt „überall eingefärbt“ ausgewogen und nicht bloß „ich trainiere Beine“.',
  'Le soglie sono approssimazioni da standard diffusi, non misure: gli stessi chili su una macchina e su un bilanciere non valgono uguale, e la tabella non lo sa. Il core è il più incerto — per gli addominali sotto carico uno standard non esiste, e quelle soglie sono una stima. Senza il peso corporeo nel profilo la mappa non può dire niente. E un distretto vuoto significa solo che non hai registrato alzate: non che sei debole.':
    'Die Schwellen sind Näherungen aus verbreiteten Standards, keine Messungen: dieselben Kilo an einer Maschine und an der Langhantel sind nicht dasselbe, und die Tabelle weiß das nicht. Am unsichersten ist der Rumpf — für Bauchmuskeln unter Last gibt es keinen Standard, diese Schwellen sind geschätzt. Ohne Körpergewicht im Profil kann die Karte gar nichts sagen. Und eine leere Region heißt nur, dass du keine Sätze eingetragen hast — nicht, dass du schwach bist.',
  'I tre numeri con cui la forza si racconta da sempre: squat, panca piana e stacco da terra. Il «total» è la loro somma.':
    'Die drei Zahlen, mit denen Kraft seit jeher erzählt wird: Kniebeuge, Bankdrücken und Kreuzheben. Das „Total“ ist ihre Summe.',
  'L’hai provato: una singola al carico massimo, salvata con l’interruttore «Massimale» quando registri l’alzata. Qui il numero è il carico, non una stima — Epley su una singola lo gonfierebbe del 3%.':
    'Du hast es versucht: eine einzelne Wiederholung mit Maximalgewicht, beim Eintragen mit dem Schalter „Maximum“ gespeichert. Hier ist die Zahl die Last, keine Schätzung — Epley würde sie bei einer einzelnen Wiederholung um 3 % aufblähen.',
  'Hai fatto quell’alzata a ripetizioni, e il massimale esce dalla serie migliore con la formula di Epley (vedi «Massimale stimato»). Vale l’esercizio giusto: «Panca inclinata» non conta come panca piana.':
    'Du hast diese Übung auf Wiederholungen gemacht, und das Maximum kommt aus dem besten Satz über die Epley-Formel (siehe „Geschätztes Maximum“). Es zählt die richtige Übung: „Schrägbankdrücken“ gilt nicht als Bankdrücken.',
  'Quell’alzata non è in lista. Il numero viene dai chili che sollevi sui gruppi muscolari coinvolti — gambe per lo squat, petto per la panca, glutei per lo stacco — peso corporeo incluso a corpo libero.':
    'Diese Übung steht nicht in der Liste. Die Zahl kommt aus den Kilo, die du auf den beteiligten Muskelgruppen bewegst — Beine für die Kniebeuge, Brust fürs Bankdrücken, Gesäß fürs Kreuzheben — bei Eigengewicht inklusive Körpergewicht.',
  'Gli stessi chili diviso il tuo peso corporeo: è il modo di confrontarsi fra persone di taglia diversa. 100 kg pesandone 65 è più forza che 110 pesandone 95.':
    'Dieselben Kilo geteilt durch dein Körpergewicht: so vergleichen sich Menschen unterschiedlicher Statur. 100 kg bei 65 kg Körpergewicht sind mehr Kraft als 110 kg bei 95 kg.',
  '× peso': '× Gewicht',
  '«Dal distretto» NON è un massimale di quell’alzata: se le gambe le alleni alla pressa, quei chili non sono il tuo squat — sono un ordine di grandezza, e servono solo a non lasciare la riga vuota. Il numero diventa vero quando registri l’alzata, e diventa certo quando la provi come massimale. Il total esce solo con tutte tre: sommarne due darebbe un numero che sembra un total e non lo è. Il peso corporeo è quello del profilo: se è vecchio di mesi, i rapporti sbagliano di conseguenza.':
    '„Aus der Region“ ist KEIN Maximum dieser Übung: wenn du die Beine an der Beinpresse trainierst, sind diese Kilo nicht deine Kniebeuge — sie sind eine Größenordnung und sollen nur die Zeile nicht leer lassen. Die Zahl wird echt, sobald du den Satz einträgst, und sicher, sobald du sie als Maximum versuchst. Das Total erscheint nur mit allen dreien: zwei zu addieren ergäbe eine Zahl, die aussieht wie ein Total und keines ist. Das Körpergewicht ist das aus dem Profil: ist es Monate alt, stimmen die Verhältnisse entsprechend nicht.',
  'Quanto alzeresti per una singola ripetizione, dedotto da una serie che ne ha fatte parecchie. Serve a mettere sulla stessa scala alzate con colpi diversi.':
    'Was du für eine einzelne Wiederholung heben würdest, abgeleitet aus einem Satz mit vielen. Damit landen Sätze mit unterschiedlichen Wiederholungen auf derselben Skala.',
  'Formula di Epley: carico × (1 + colpi / 30). Così 50 kg × 8 dà 63 kg e 40 kg × 15 ne dà 60: la prima serie vale di più, anche se la seconda ha spostato più chili in totale. Con pesi diversi per serie conta la serie migliore, non la media. A corpo libero il carico include il tuo peso.':
    'Epley-Formel: Last × (1 + Wdh. / 30). So ergeben 50 kg × 8 dann 63 kg und 40 kg × 15 nur 60: der erste Satz zählt mehr, obwohl der zweite insgesamt mehr Kilo bewegt hat. Bei unterschiedlichen Gewichten pro Satz zählt der beste Satz, nicht der Durchschnitt. Beim Eigengewicht schließt die Last dein Körpergewicht ein.',
  'È una stima, non una prova: nessuno ti ha visto alzare quel peso. Oltre le 12 ripetizioni Epley diventa ottimista, perché lì contano fiato e resistenza più della forza massimale — un 20×30 kg non fa di te un 60 kg di massimale. Misura la forza, non la fatica: una serie fatta al cedimento e una lasciata a metà danno lo stesso numero.':
    'Es ist eine Schätzung, kein Beweis: niemand hat dich dieses Gewicht heben sehen. Über 12 Wiederholungen wird Epley optimistisch, weil dort Atem und Ausdauer mehr zählen als Maximalkraft — 20 × 30 kg machen aus dir kein 60-kg-Maximum. Gemessen wird Kraft, nicht Anstrengung: ein Satz bis zum Muskelversagen und einer, der auf halbem Weg endet, ergeben dieselbe Zahl.',
  'La sessione in cui hai espresso più forza su questo esercizio, non quella in cui hai alzato il peso più alto.':
    'Die Einheit, in der du bei dieser Übung die meiste Kraft gezeigt hast — nicht die mit dem höchsten Gewicht.',
  'La sessione col massimale stimato più alto (vedi sopra): kg e colpi finiscono in un numero solo. A parità vince la più recente.':
    'Die Einheit mit dem höchsten geschätzten Maximum (siehe oben): Kilo und Wiederholungen landen in einer einzigen Zahl. Bei Gleichstand gewinnt die jüngere.',
  'Non è un premio alla fatica: una serie infinita con poco peso non compare qui, per quanto abbia bruciato. Se hai cambiato modo di eseguire l’esercizio, il confronto con le alzate vecchie vale meno di quanto sembri.':
    'Es ist kein Preis für Anstrengung: ein endloser Satz mit wenig Gewicht taucht hier nicht auf, so sehr er auch gebrannt hat. Hast du die Ausführung der Übung geändert, ist der Vergleich mit alten Sätzen weniger wert, als er scheint.',
}
