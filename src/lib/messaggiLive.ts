// I messaggi, tenuti aggiornati da soli.
//
// ── Perché non un WebSocket ────────────────────────────────────
// Supabase ha il realtime, ma sta in `@supabase/realtime-js`: è la metà del peso
// che questo progetto ha tolto assemblando il client a mano (vedi il commento in
// lib/supabase.ts), e vorrebbe una pubblicazione in più da abilitare a mano sul
// database. In cambio darebbe un centinaio di millisecondi contro i tre secondi
// di qui — su una conversazione fra due persone, una differenza che nessuno
// misura. E in palestra, dove la rete è quella che è, una connessione persistente
// che cade e si riapre è una fonte di stati sbagliati in più, non in meno.
//
// Quindi: si richiede, ma con la testa.
//  • UN solo giro per tutta l'app, qualunque sia il numero di schermate in ascolto
//  • il ritmo lo decide la più esigente fra loro: 3s con una conversazione aperta,
//    20s per il solo badge rosso in home
//  • a schermo spento non si chiede niente, e si riparte subito al ritorno
//  • quello che si scrive compare prima di partire (eco locale), così il campo si
//    svuota nell'istante in cui si preme invio
//  • a ogni giro si chiedono solo gli ULTIMI messaggi, non tutti (vedi sotto)
//
// ── Gli ultimi, non tutti ──────────────────────────────────────
// Per un pezzo ogni giro ha riscaricato l'intera storia: ogni tre secondi, con
// una conversazione aperta. E oltre il numero di righe che il server dà in una
// risposta, a restare fuori erano i messaggi più nuovi.
//
// Adesso i giri sono di due tipi:
//  • COMPLETO — all'avvio, ogni cinque minuti, e quando i conti non tornano: si
//    legge tutto dal più recente, a pagine, fino a un tetto (`MASSIMO`)
//  • NORMALE — gli ultimi `RECENTI`, più il numero di quanti sono in tutto.
//    Quello che c'è nella fetta aggiorna l'elenco; quello che dovrebbe esserci
//    e non c'è è stato cancellato; e se il totale non è quello che ci si
//    aspetta — un messaggio vecchio tolto, o più novità di quante ne stiano
//    in una fetta — si rifà il giro completo.
import { useEffect } from 'react'
import { create } from 'zustand'
import {
  messaggiRecenti, creaMessaggio, salvaMessaggio, segnaLetti, eliminaMessaggio,
  ruoloIn, nonLetti, perData,
  type Messaggio, type BozzaMessaggio,
} from './messaggi'
import { notificaPush } from './push'

/** Il badge in home: basta sapere entro il minuto che è arrivato qualcosa. */
export const RITMO_FONDO = 20_000
/** Una conversazione aperta davanti agli occhi. */
export const RITMO_APERTO = 3_000

/** Quanti messaggi chiede un giro normale: gli ultimi. */
export const RECENTI = 50
/** Una pagina del giro completo. Se il server ne dà meno non cambia niente: si
 *  riparte da dove si è arrivati, non da dove si pensava di arrivare. */
export const PAGINA = 1000
/** Oltre questo numero i più vecchi non si scaricano (restano sul server). */
export const MASSIMO = 3000
/** Il giro completo si rifà comunque, ogni tanto: è l'unico che si accorge di
 *  una spunta di lettura cambiata, da un altro mio dispositivo, su un messaggio
 *  più vecchio degli ultimi. */
const COMPLETO_OGNI = 5 * 60_000
/** E quando i conti non tornano, ma non di continuo: se un giorno non
 *  tornassero mai per un motivo che qui non è previsto, senza questo limite si
 *  riscaricherebbe tutto ogni tre secondi. */
const RIFARE_NON_PRIMA_DI = 30_000

interface Stato {
  /** Chi siamo. `null` = nessuna sessione, il giro è fermo. */
  userId: string | null
  messaggi: Messaggio[]
  /** Il primo giro è FINITO — riuscito o no.
   *
   *  Non "è riuscito", che è la versione che aveva questo campo e che lasciava la
   *  schermata dei messaggi su "Caricamento…" per sempre: se la tabella sul
   *  server non c'è ancora, ogni giro fallisce, e una condizione che aspetta il
   *  successo aspetta una cosa che non arriverà mai. Chi guarda non ha modo di
   *  distinguerlo da una rete lenta, e resta lì. */
  primoGiroFatto: boolean
  /** Cosa è andato storto nell'ultimo giro, se è andato storto. Si azzera al
   *  primo giro che riesce. Il giro di sfondo non lo mostra da nessuna parte —
   *  sarebbe un avviso rosso ogni tre secondi in ascensore — ma una schermata
   *  APERTA sui messaggi deve poterlo dire, o mostra "nessun messaggio" mentre in
   *  realtà non ha potuto guardare. */
  errore: string | null
}

export const useMessaggiStore = create<Stato>(() => ({
  userId: null, messaggi: [], primoGiroFatto: false, errore: null,
}))

let timer: ReturnType<typeof setTimeout> | undefined
let inVolo = false

// ── Cosa ricorda il giro fra una richiesta e l'altra ───────────
/** `quanti ne ha il server` meno `quanti ne ho in elenco`, all'ultimo giro
 *  completo: zero se li ho tutti, di più se il tetto ne ha lasciati fuori.
 *  Finché resta uguale, fra me e il server non è cambiato niente che la fetta
 *  degli ultimi non abbia già detto. `null` = il giro completo va ancora fatto. */
let scarto: number | null = null
let ultimoCompleto = 0
let ultimoRifatto = 0

// Quello che ho appena fatto io, e che una risposta partita PRIMA non sa ancora.
// Senza, la risposta di un giro già in viaggio rimetteva le cose com'erano:
// il messaggio appena inviato spariva per tre secondi, quello appena cancellato
// ricompariva, il pallino rosso si riaccendeva sulla conversazione appena letta.
/** I messaggi scritti da qui: id → quando il server ha detto sì (`null` = non ancora). */
const scritti = new Map<string, number | null>()
/** Quelli cancellati da qui, allo stesso modo. */
const tolti = new Map<string, number | null>()
/** Quelli letti da qui, finché il server non restituisce la spunta accesa. */
const lettiQui = new Set<string>()

/** Una cosa fatta da me che la risposta di un giro partito a `inizio` può non
 *  aver visto: è ancora in viaggio, o è arrivata a giro già cominciato. */
const incerto = (quando: number | null | undefined, inizio: number) =>
  quando === null || (quando !== undefined && quando >= inizio)

/** Quello che il server aveva già confermato prima di un giro partito a
 *  `inizio`, da quel giro in poi lo dice lui: non serve più ricordarselo. Va
 *  fatto dopo OGNI giro, completo compreso — un mio messaggio rimasto in
 *  `scritti` oltre il tempo, e finito fuori dalla fetta degli ultimi, veniva
 *  preso per cancellato e faceva riscaricare tutto. */
function dimenticaConfermati(inizio: number) {
  for (const [id, q] of scritti) if (q !== null && q < inizio) scritti.delete(id)
  for (const [id, q] of tolti) if (q !== null && q < inizio) tolti.delete(id)
}

function dimenticaMovimenti() {
  scarto = null
  ultimoCompleto = 0
  ultimoRifatto = 0
  scritti.clear()
  tolti.clear()
  lettiQui.clear()
}
// Ogni schermata in ascolto lascia qui il ritmo che le serve. Un Set di oggetti e
// non di numeri: due schermate possono chiedere lo stesso ritmo, e togliendo il
// numero alla chiusura della prima si spegnerebbe anche la seconda.
const ritmi = new Set<{ ms: number }>()

function ritmoCorrente(): number {
  let ms = RITMO_FONDO
  for (const r of ritmi) ms = Math.min(ms, r.ms)
  return ms
}

function programma(fra = ritmoCorrente()) {
  clearTimeout(timer)
  timer = setTimeout(() => { void giro() }, fra)
}

/** Tutto quello che il server ha, dal più recente, fino al tetto. */
async function leggiTutto(): Promise<{ righe: Messaggio[]; totale: number | null }> {
  // Per id: un messaggio arrivato fra una pagina e l'altra sposta tutti di un
  // posto, e l'ultimo della pagina prima torna come primo di quella dopo.
  const viste = new Map<string, Messaggio>()
  let totale: number | null = null
  let da = 0
  while (viste.size < MASSIMO) {
    const chiesti = Math.min(PAGINA, MASSIMO - viste.size)
    const p = await messaggiRecenti(chiesti, da)
    if (p.totale !== null) totale = p.totale
    if (p.righe.length === 0) break
    for (const m of p.righe) viste.set(m.id, m)
    da += p.righe.length
    // Finito quando si è arrivati al totale. Se il server il totale non lo
    // dice, quando una pagina torna più corta di come la si era chiesta.
    if (totale !== null ? da >= totale : p.righe.length < chiesti) break
  }
  return { righe: [...viste.values()], totale }
}

/** Mette la risposta del server dentro l'elenco che si ha.
 *
 *  `tutto` = la risposta è l'intera storia (o tutta quella che si scarica):
 *  l'elenco diventa quello. Altrimenti è la fetta degli ultimi, e i messaggi più
 *  vecchi della fetta restano come sono.
 *
 *  Rende anche quanti dei messaggi in elenco sono CERTAMENTE sul server (quelli
 *  ancora in partenza no), che è il numero da confrontare col totale. */
function unisci(
  locali: Messaggio[], risposta: Messaggio[], tutto: boolean, inizio: number, userId: string,
): { messaggi: Messaggio[]; sulServer: number } {
  const dalServer: Messaggio[] = []
  for (const riga of risposta) {
    // Cancellato da qui mentre la risposta era in viaggio: non torna.
    if (incerto(tolti.get(riga.id), inizio)) continue
    let m = riga
    if (lettiQui.has(m.id)) {
      const mio = ruoloIn(m, userId) === 'coach' ? 'letto_coach' : 'letto_atleta'
      if (m[mio]) lettiQui.delete(m.id)   // il server lo sa: da qui in poi fa fede lui
      else m = { ...m, [mio]: true }
    }
    dalServer.push(m)
  }
  const arrivati = new Set(dalServer.map(m => m.id))

  let messaggi = dalServer
  if (!tutto && risposta.length > 0) {
    // Più vecchi della fetta: il server non ne ha parlato, restano. Più nuovi e
    // assenti: dovevano esserci, quindi qualcuno li ha cancellati.
    const soglia = Math.min(...risposta.map(m => Date.parse(m.created_at)))
    const vecchi = locali.filter(m =>
      !arrivati.has(m.id) && !scritti.has(m.id) && Date.parse(m.created_at) <= soglia)
    messaggi = [...vecchi, ...dalServer]
  }
  const sulServer = messaggi.length

  // I miei ancora in partenza, o arrivati a giro già cominciato: la risposta
  // non li ha, ma non per questo sono spariti.
  const inPartenza = locali.filter(m => !arrivati.has(m.id) && incerto(scritti.get(m.id), inizio))

  return { messaggi: [...messaggi, ...inPartenza].sort(perData), sulServer }
}

async function giro(): Promise<void> {
  const userId = useMessaggiStore.getState().userId
  if (!userId) return
  // A schermo spento non si interroga niente: l'app in tasca non ha nessuno che
  // guardi il badge, e un giro ogni tre secondi è batteria e traffico buttati.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    programma()
    return
  }
  if (inVolo) { programma(); return }
  inVolo = true
  // L'utente può essere cambiato mentre la richiesta era in viaggio: scrivere
  // qui dentro senza guardare significherebbe mostrare a uno i messaggi di un
  // altro, per il tempo che il giro dopo ci mette a correggere.
  const stessoUtente = () => useMessaggiStore.getState().userId === userId

  const completo = async (): Promise<void> => {
    const inizio = Date.now()
    const { righe, totale } = await leggiTutto()
    if (!stessoUtente()) return
    const { messaggi, sulServer } = unisci(useMessaggiStore.getState().messaggi, righe, true, inizio, userId)
    useMessaggiStore.setState({ messaggi, errore: null })
    scarto = totale === null ? 0 : totale - sulServer
    ultimoCompleto = Date.now()
    dimenticaConfermati(inizio)
  }

  try {
    const inizio = Date.now()
    if (scarto === null || inizio - ultimoCompleto > COMPLETO_OGNI) {
      await completo()
    } else {
      const p = await messaggiRecenti(RECENTI)
      if (stessoUtente()) {
        // La fetta contiene tutto quello che c'è: vale come un giro completo.
        const tutto = p.totale !== null ? p.righe.length >= p.totale : p.righe.length < RECENTI
        const { messaggi, sulServer } = unisci(useMessaggiStore.getState().messaggi, p.righe, tutto, inizio, userId)
        useMessaggiStore.setState({ messaggi, errore: null })
        // Con qualcosa di mio ancora in viaggio il conto può essere sbagliato
        // di uno per un attimo: si guarda al giro dopo.
        const fermo = ![...scritti.values(), ...tolti.values()].some(q => incerto(q, inizio))
        dimenticaConfermati(inizio)
        if (tutto) {
          scarto = 0
          ultimoCompleto = Date.now()
        } else if (fermo && p.totale !== null && p.totale - sulServer !== scarto
            && Date.now() - ultimoRifatto > RIFARE_NON_PRIMA_DI) {
          ultimoRifatto = Date.now()
          await completo()
        }
      }
    }
  } catch (e) {
    // Rete assente, sessione scaduta, o la tabella non ancora creata sul
    // database: si riprova al giro dopo e intanto resta quello che si aveva.
    // L'errore si registra ma non si grida: chi lo mostra è solo la schermata
    // aperta sui messaggi.
    if (stessoUtente()) {
      useMessaggiStore.setState({ errore: e instanceof Error ? e.message : String(e) })
    }
  } finally {
    inVolo = false
    // Qui e non nel ramo che riesce: è la riga che fa finire il "Caricamento…"
    // anche quando il server non risponderà mai.
    if (stessoUtente()) {
      useMessaggiStore.setState({ primoGiroFatto: true })
    }
    programma()
  }
}

/** Accende il giro per questo utente. Idempotente: chiamarla due volte con lo
 *  stesso id non fa niente. */
export function avviaMessaggi(userId: string): void {
  if (useMessaggiStore.getState().userId === userId) return
  dimenticaMovimenti()
  useMessaggiStore.setState({ userId, messaggi: [], primoGiroFatto: false, errore: null })
  programma(0)
}

/** Spegne tutto e svuota. Al logout è obbligatorio: i messaggi sono dell'account,
 *  non del dispositivo. */
export function fermaMessaggi(): void {
  clearTimeout(timer)
  timer = undefined
  dimenticaMovimenti()
  useMessaggiStore.setState({ userId: null, messaggi: [], primoGiroFatto: false, errore: null })
}

/** Un giro subito, senza aspettare il prossimo. */
export function ricaricaMessaggi(): void {
  if (useMessaggiStore.getState().userId) programma(0)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // Tornando sull'app si riparte subito: chi riapre il telefono per leggere la
    // risposta non deve aspettare il timer che era fermo mentre lo schermo era
    // spento.
    if (document.visibilityState === 'visible') ricaricaMessaggi()
  })
}

/** I messaggi, ricontrollati al ritmo che questa schermata chiede finché resta
 *  montata. Chi tiene aperta una conversazione passa `RITMO_APERTO`; il badge in
 *  home non passa niente e si accontenta del ritmo di fondo. */
export function useMessaggi(ritmo: number = RITMO_FONDO) {
  const messaggi = useMessaggiStore(s => s.messaggi)
  const primoGiroFatto = useMessaggiStore(s => s.primoGiroFatto)
  const errore = useMessaggiStore(s => s.errore)
  const userId = useMessaggiStore(s => s.userId)

  useEffect(() => {
    const voce = { ms: ritmo }
    ritmi.add(voce)
    // Un ascoltatore nuovo può volere un ritmo più svelto di quello in corso, e
    // il timer già armato scadrebbe troppo tardi: aprendo una conversazione si
    // resterebbe fino a venti secondi sui messaggi di prima.
    programma(0)
    return () => { ritmi.delete(voce); programma() }
  }, [ritmo])

  return { messaggi, primoGiroFatto, errore, userId }
}

/** Quanti messaggi devo ancora leggere. Il numero del badge rosso in home. */
export function useNonLetti(): number {
  const { messaggi, userId } = useMessaggi()
  return userId ? nonLetti(messaggi, userId).length : 0
}

/** Manda un messaggio. Compare in elenco PRIMA di partire: il campo si svuota
 *  subito e la riga è già lì, che è ciò che distingue una chat da un modulo.
 *  Se il server rifiuta, la riga se ne va com'è arrivata e l'errore risale a chi
 *  ha chiamato, che ha una schermata dove dirlo. */
export async function invia(bozza: BozzaMessaggio): Promise<Messaggio> {
  // L'ora dell'eco è quella del telefono, e il server la sostituirà con la sua.
  // Ma finché non lo fa, con l'orologio indietro di dieci minuti il messaggio
  // appena scritto compariva sopra gli ultimi dieci minuti di conversazione:
  // qui gli si dà almeno un istante dopo l'ultimo che si ha.
  const ultimo = useMessaggiStore.getState().messaggi.reduce((t, x) => Math.max(t, Date.parse(x.created_at) || 0), 0)
  const m = creaMessaggio(bozza, new Date(Math.max(Date.now(), ultimo + 1)).toISOString())
  scritti.set(m.id, null)
  useMessaggiStore.setState(s => ({ messaggi: [...s.messaggi, m] }))
  try {
    await salvaMessaggio(m)
  } catch (e) {
    scritti.delete(m.id)
    useMessaggiStore.setState(s => ({ messaggi: s.messaggi.filter(x => x.id !== m.id) }))
    throw e
  }
  // Se nel frattempo si è usciti, `fermaMessaggi` ha già svuotato tutto: non
  // si rimette niente in un registro che ora è di un altro.
  if (scritti.has(m.id)) scritti.set(m.id, Date.now())
  // Solo adesso che la riga è al sicuro: la funzione che manda la notifica la
  // rilegge dal database, e prima non la troverebbe.
  notificaPush(m.id)
  ricaricaMessaggi()
  return m
}

/** Un avviso nel filo diretto — un allenamento finito, una scheda assegnata —
 *  scritto dall'app per conto di chi ha fatto la cosa. A differenza di `invia`
 *  non fallisce mai: l'avviso accompagna un'azione già riuscita (l'allenamento è
 *  salvato, la scheda è assegnata), e se non parte non c'è niente da annullare
 *  né da dire a chi ha appena finito di fare altro. */
export function avvisa(bozza: BozzaMessaggio): void {
  void invia(bozza).catch(() => { /* l'avviso è un di più */ })
}

/** Segna letti i messaggi passati, ciascuno dal lato in cui sto io.
 *
 *  Anche qui l'effetto è immediato in locale: il badge si spegne aprendo la
 *  conversazione, non al giro dopo — e non si riaccende se la risposta di un
 *  giro partito prima dice ancora "non letto" (`lettiQui`). Se la scrittura
 *  fallisce non si torna indietro a mano: si smette di tenerlo per letto, e il
 *  prossimo giro che lo vede riporta lo stato vero dal server. */
export function segnaLettiOra(messaggi: Messaggio[], userId: string): void {
  const daSegnare = nonLetti(messaggi, userId)
  if (daSegnare.length === 0) return
  const perRuolo = { coach: [] as string[], atleta: [] as string[] }
  for (const m of daSegnare) {
    const r = ruoloIn(m, userId)
    if (r) perRuolo[r].push(m.id)
  }
  const visti = new Set(daSegnare.map(m => m.id))
  useMessaggiStore.setState(s => ({
    messaggi: s.messaggi.map(m => {
      if (!visti.has(m.id)) return m
      return ruoloIn(m, userId) === 'coach'
        ? { ...m, letto_coach: true }
        : { ...m, letto_atleta: true }
    }),
  }))
  for (const id of visti) lettiQui.add(id)
  const fallito = (ids: string[]) => () => { for (const id of ids) lettiQui.delete(id) }
  void segnaLetti(perRuolo.coach, 'coach').catch(fallito(perRuolo.coach))
  void segnaLetti(perRuolo.atleta, 'atleta').catch(fallito(perRuolo.atleta))
}

/** Toglie un messaggio, subito in locale e poi sul server. */
export async function elimina(id: string): Promise<void> {
  const tolto = useMessaggiStore.getState().messaggi.find(m => m.id === id)
  tolti.set(id, null)
  useMessaggiStore.setState(s => ({ messaggi: s.messaggi.filter(m => m.id !== id) }))
  try {
    await eliminaMessaggio(id)
  } catch (e) {
    // Se nel frattempo si è usciti (`fermaMessaggi` ha svuotato il registro)
    // l'elenco è di un altro: non ci si rimette dentro niente.
    const ancoraMio = tolti.delete(id)
    // Si rimette QUEL messaggio, non l'elenco com'era: nel frattempo può
    // essere arrivato altro, e rimettendo la fotografia di prima spariva.
    if (tolto && ancoraMio) {
      useMessaggiStore.setState(s => s.messaggi.some(m => m.id === id)
        ? s
        : { messaggi: [...s.messaggi, tolto].sort(perData) })
    }
    throw e
  }
  if (tolti.has(id)) tolti.set(id, Date.now())
}
