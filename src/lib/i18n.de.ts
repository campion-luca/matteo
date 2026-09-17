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
  'Corsa avg pace': 'Laufen Ø-Pace',
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

  // ── Nomi delle sezioni ───────────────────────────────────────
  'Allenamento': 'Training',
  'Gruppo muscolare': 'Muskelgruppe',
  'Schede': 'Pläne',
  'Mappa della forza': 'Kraftkarte',
  'Personal Coach': 'Personal Coach',

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

  // ── Navigazione ──────────────────────────────────────────────
  'Impostazioni': 'Einstellungen',

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

  // ── Varie ────────────────────────────────────────────────────
  'Senza nome': 'Ohne Namen',

  // ── Personal Coach ───────────────────────────────────────────
  'Ti seguono': 'Betreuen dich',
  'Segui': 'Du betreust',
  'Caricamento…': 'Wird geladen…',
  'Attendi…': 'Bitte warten…',
  'Annulla': 'Abbrechen',
  'Elimina': 'Löschen',
  'Confronto': 'Vergleich',
  'Il tuo codice': 'Dein Code',
  'Genera un codice e dallo a chi ti allena. Vedrà i tuoi allenamenti, il volume e l’andamento del peso —':
    'Erzeuge einen Code und gib ihn der Person, die dich trainiert. Sie sieht dein Training, das Volumen und den Gewichtsverlauf —',
  'in sola lettura': 'nur lesend',
  'Puoi togliergli l’accesso quando vuoi.': 'Du kannst den Zugang jederzeit entziehen.',
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
  'Condividi la scheda': 'Trainingsplan teilen',
  'Condividi': 'Teilen',
  '«{scheda}» finisce nelle sue schede, pronta da avviare.':
    '«{scheda}» landet in seinen Plänen, bereit zum Starten.',
  'Invio…': 'Wird gesendet…',
  'Inviata ✓': 'Gesendet ✓',
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

  // ── Home ─────────────────────────────────────────────────────
  'La tua settimana': 'Deine Woche',
  'Registra un’alzata: qui vedrai squat, panca piana e stacco da terra.':
    'Trag einen Satz ein: hier erscheinen Kniebeuge, Bankdrücken und Kreuzheben.',
  'Total': 'Total',
  '{r}× il tuo peso': '{r}× dein Körpergewicht',
  '{r}× peso': '{r}× Gewicht',
  'Mai allenato': 'Nie trainiert',
  'Inserisci il peso nel profilo →': 'Gewicht im Profil eintragen →',
  'Ricerca globale': 'Globale Suche',

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
  'Stats': 'Statistik',
  'Esercizi': 'Übungen',
  'Gara': 'Wettkampf',
  'Gruppi muscolari': 'Muskelgruppen',
  'Scegli un esercizio per vederne la scheda': 'Wähle eine Übung, um ihr Blatt zu sehen',
  'Apri un gruppo muscolare, poi un esercizio': 'Öffne eine Muskelgruppe, dann eine Übung',
  'Aggiungi gli esercizi di base': 'Die Basisübungen hinzufügen',
  'Ne manca 1, con la sua immagine': '1 fehlt noch, mit ihrem Bild',
  'Ne mancano {n}, con la loro immagine': 'Es fehlen noch {n}, mit ihren Bildern',
  '1 esercizio': '1 Übung',
  '{n} esercizi': '{n} Übungen',
  'Vedi in elenco': 'Als Liste anzeigen',
  'Vedi in griglia': 'Als Raster anzeigen',
  'Nessuna alzata': 'Kein Satz',
  'Corsa · 8 × 1 km': 'Laufen · 8 × 1 km',
  'Stazioni gara': 'Wettkampfstationen',
  'Registra almeno 2 sessioni per vedere il grafico': 'Trag mindestens 2 Einheiten ein, um das Diagramm zu sehen',
  'più basso = meglio': 'niedriger = besser',

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
  'Profilo': 'Profil',
  'Nuovo gruppo': 'Neue Gruppe',
  'Nuovo gruppo muscolare': 'Neue Muskelgruppe',
  'Es. Avambracci': 'Z. B. Unterarme',
  'Esiste già un gruppo con questo nome': 'Eine Gruppe mit diesem Namen gibt es bereits',
  'Colore': 'Farbe',
  'Figura': 'Figur',
  'Crea gruppo': 'Gruppe erstellen',
  'Chiudi il profilo': 'Profil schließen',
  'Pesati ogni mattina appena sveglio, a stomaco vuoto: è l’unico modo perché due misure siano confrontabili. Conta la direzione, non il numero di oggi.': 'Wiege dich jeden Morgen direkt nach dem Aufstehen, nüchtern: nur so sind zwei Messungen vergleichbar. Es zählt die Richtung, nicht die Zahl von heute.',
  'Distanza': 'Distanz',
  'Nessuna sessione da {dist}': 'Keine Einheit über {dist}',
  'nessuna sessione': 'keine Einheit',
  'da {dist}': 'aus {dist}',
  'tarato su di te': 'auf dich kalibriert',
  'Tempo gara stimato': 'Geschätzte Wettkampfzeit',
  'Roxzone ({n} × {s} s)': 'Roxzone ({n} × {s} s)',
  'Stima gara': 'Wettkampfschätzung',
  'Mezza distanza': 'Halbe Distanz',
  'Corsa · 8 × 500 m': 'Laufen · 8 × 500 m',
  'Double': 'Doppel',
  'Singolo': 'Einzel',
  'Categoria': 'Kategorie',
  'gara': 'Wettkampf',
  'simulazione': 'Simulation',
  'allenamento': 'Training',
  'dal tuo profilo': 'aus deinem Profil',
  'gara del {d}': 'Wettkampf vom {d}',
  'simulazione del {d}': 'Simulation vom {d}',
  '{n}/{tot} segmenti misurati': '{n}/{tot} Abschnitte gemessen',
  '{n} dal tuo profilo': '{n} aus deinem Profil',
  'nessuna gara né simulazione: stima dagli allenamenti': 'kein Wettkampf und keine Simulation: Schätzung aus dem Training',
  'Servono almeno {n} segmenti registrati': 'Mindestens {n} erfasste Abschnitte nötig',
  'Corsa 8 × {p} (fatica +{f}%)': 'Laufen 8 × {p} (Ermüdung +{f}%)',
  'Stazioni a turni in due': 'Stationen abwechselnd zu zweit',
  'Stazioni da solo': 'Stationen allein',
  'da solo {t}': 'allein {t}',
  'Come ragiona la stima': 'Wie die Schätzung rechnet',
  '1. Ogni sessione viene riportata a te da solo e a gambe fresche: alla corsa di gara si toglie la fatica, alle stazioni di una gara in double i turni col compagno, e una mezza si porta alla distanza intera.': '1. Jede Einheit wird auf dich allein und mit frischen Beinen umgerechnet: Beim Wettkampflauf wird die Ermüdung abgezogen, bei Stationen eines Doppel-Wettkampfs die Wechsel mit dem Partner, und eine halbe Distanz wird auf die volle hochgerechnet.',
  '2. Una gara o una simulazione si riconoscono da sole (5 segmenti lo stesso giorno) e contano più degli allenamenti. I segmenti che mancano si completano col tuo profilo, se ne hai registrati almeno 3.': '2. Wettkämpfe und Simulationen werden automatisch erkannt (5 Abschnitte am selben Tag) und zählen mehr als Training. Fehlende Abschnitte werden aus deinem Profil ergänzt, wenn du mindestens 3 erfasst hast.',
  '3. La gara si rimonta nella categoria: corsa +10% in singolo e +5% in double, stazioni a turni in due, 16 passaggi in Roxzone da 25 s. In double si suppone un compagno del tuo livello.': '3. Der Wettkampf wird in der Kategorie zusammengesetzt: Laufen +10 % im Einzel und +5 % im Doppel, Stationen abwechselnd zu zweit, 16 Roxzone-Durchgänge à 25 s. Im Doppel wird ein Partner auf deinem Niveau angenommen.',
  'Nessuna sessione': 'Keine Einheit',
  '1 giornata': '1 Trainingstag',
  '{n} giornate': '{n} Trainingstage',
  'Giornate': 'Trainingstage',
  'meno del previsto o carico sceso': 'weniger als geplant oder Gewicht gesunken',
  'carico salito': 'Gewicht gestiegen',
  '1 esercizio saltato': '1 Übung ausgelassen',
  '{n} esercizi saltati': '{n} Übungen ausgelassen',
  '1 serie in meno': '1 Satz weniger',
  '{n} serie in meno': '{n} Sätze weniger',
  '1 serie corta': '1 Satz zu kurz',
  '{n} serie corte': '{n} Sätze zu kurz',
  '1 carico sceso': '1 Gewicht gesunken',
  '{n} carichi scesi': '{n} Gewichte gesunken',
  'Solo hyrox': 'Nur Hyrox',
  'Senza scheda': 'Ohne Plan',
  'scheda rispettata': 'Plan eingehalten',
  'Registrate a mano': 'Von Hand eingetragen',
  'scheda non più disponibile, niente confronto': 'Plan nicht mehr vorhanden, kein Vergleich',
  'Volume': 'Volumen',
  'Saltato': 'Ausgelassen',
  'Fuori scheda': 'Außerhalb des Plans',
  'stesso carico': 'gleiches Gewicht',
  'previsto': 'geplant',
  'fatto': 'gemacht',
  'prima {kg} kg': 'vorher {kg} kg',
  'Elimina esercizio': 'Übung löschen',
  'in miglioramento': 'steigend',
  'in calo': 'fallend',
  'servono almeno 3 alzate': 'mindestens 3 Sätze nötig',
  'invariato': 'unverändert',
  'Conferma la data': 'Datum bestätigen',
  'Oggi': 'Heute',
  'Modifica la data': 'Datum ändern',
  'ripetizioni': 'Wiederholungen',
  'chili': 'Kilo',
  'Superset · nessun recupero': 'Supersatz · keine Pause',
  'Salva': 'Speichern',
  'Modifica sessione': 'Einheit bearbeiten',
  'Quantità': 'Menge',
  'Data dell’alzata': 'Datum des Satzes',
  'Una singola al carico massimo. Serie e colpi valgono 1 × 1.':
    'Eine einzelne Wiederholung mit Maximalgewicht. Sätze und Wiederholungen zählen 1 × 1.',
  'Una singola al carico massimo: serie e colpi diventano 1 × 1.':
    'Eine einzelne Wiederholung mit Maximalgewicht: Sätze und Wiederholungen werden 1 × 1.',
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
  'Sfondo fuso': 'Verschmolzener Hintergrund',
  'Nero, arancione e grigio-azzurro sfumati uno dentro l’altro invece dei soli aloni caldi. Vale sui temi scuri.':
    'Schwarz, Orange und Blaugrau ineinander verlaufend statt nur warmer Lichthöfe. Gilt für die dunklen Themen.',
  'Sfondo in movimento': 'Hintergrund in Bewegung',
  'Gli aloni scorrono lentamente e non si fermano mai. Si muove solo il fondo, il resto della pagina non si ridisegna.':
    'Die Lichthöfe ziehen langsam und ohne Unterbrechung. Nur der Hintergrund bewegt sich, der Rest der Seite wird nicht neu gezeichnet.',
  'Standard': 'Standard',
  'I colori del tema scelto sopra.': 'Die Farben des oben gewählten Themas.',
  'Premium': 'Premium',
  'Sempre nero, vetro e contorni bianchi. Ignora l’interruttore chiaro/scuro.':
    'Immer schwarz, Glas und weiße Konturen. Ignoriert den Hell-/Dunkel-Schalter.',

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

  // ── Home: riepilogo e calendario ─────────────────────────────
  'Mese precedente': 'Vorheriger Monat',
  'Mese successivo': 'Nächster Monat',
  'I tuoi allenamenti': 'Deine Trainings',
  'settimana di fila': 'Woche in Folge',
  'settimane di fila': 'Wochen in Folge',
  '1 giorno di allenamento': '1 Trainingstag',
  '{n} giorni di allenamento': '{n} Trainingstage',
  'Nessun allenamento registrato.': 'Noch kein Training erfasst.',
  'Tocca un giorno per vedere cosa hai fatto.': 'Tippe auf einen Tag, um zu sehen, was du gemacht hast.',
  'Non ti sei allenato': 'Kein Training',
  'Alzate registrate': 'Erfasste Sätze',
  'Apri il calendario degli allenamenti': 'Trainingskalender öffnen',
  'Massimali ipotetici': 'Geschätzte Maximalwerte',
  'Il total compare con tutte e tre le alzate': 'Das Total erscheint mit allen drei Übungen',
  'Riepilogo complessivo': 'Gesamtübersicht',
}
