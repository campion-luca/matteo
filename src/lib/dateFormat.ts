// Nomi di mesi e giorni e le formattazioni brevi usate ovunque, nella lingua scelta.
//
// Stavano duplicati in più file (dashboard, ricerca globale), ciascuno
// con la sua copia degli array e la sua versione di "19 ago": tre posti in cui
// cambiare un'abbreviazione, e tre risultati diversi per la stessa data.
// Qui non c'è `Intl`: le etichette sono fisse e volutamente brevi (finiscono in
// celle da poche decine di pixel), e il formato non deve cambiare con la lingua
// del DISPOSITIVO — segue quella scelta nell'app, che è un'altra cosa.
//
// ── Cambiano le parole, non l'ordine ───────────────────────────
// L'inglese dell'app è quello britannico: giorno, mese, anno, con le barre,
// esattamente come l'italiano ("19/08/26", "19 Aug"). Chi legge in inglese e
// misura in chili e chilometri una data col giorno davanti la legge senza
// pensarci; "08/19/26" invece cambierebbe il significato di ogni data già a
// schermo. (Col tedesco cambiava anche la punteggiatura — "19.08.26" — e questo
// file aveva un ramo per ogni formato: con l'inglese non servono più.)
import { getLang, type Lang } from '@/lib/i18n'

// I mesi già nella forma in cui vanno stampati.
const MONTHS: Record<Lang, readonly string[]> = {
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
       'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
}

// Forma breve, già minuscola in italiano: le eyebrow ("13 AGO — 19 AGO") le
// alza il CSS con `text-transform`, non questo file. In inglese i mesi sono
// nomi propri e restano maiuscoli.
const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// La settimana inizia di lunedì, come la griglia del calendario e la settimana ISO.
const DAYS_SHORT: Record<Lang, readonly string[]> = {
  it: ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
}

// Nomi interi dei giorni, da lunedì. In italiano minuscoli (vanno dentro la
// frase: "martedì 15 settembre"), in inglese maiuscoli come vuole la lingua.
const DAYS_LONG: Record<Lang, readonly string[]> = {
  it: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
}

/** "martedì 15 settembre" · "Tuesday 15 September" — la data in cima alla home.
 *  Senza anno: è sempre oggi, e l'anno lo sa già chi guarda. Prende una `Date`
 *  locale e non una stringa ISO perché il giorno della settimana va letto dal
 *  calendario, e da una ISO servirebbe comunque ricostruire la `Date`. */
export function fmtGiornoLungo(d: Date, lang: Lang = getLang()): string {
  const giorno = DAYS_LONG[lang][(d.getDay() + 6) % 7]
  const mese = MONTHS[lang][d.getMonth()]
  return `${giorno} ${d.getDate()} ${lang === 'it' ? mese.toLowerCase() : mese}`
}

/** "Settembre 2026" · "September 2026" — il titolo di un mese del calendario. */
export function fmtMeseAnno(year: number, month: number, lang: Lang = getLang()): string {
  return `${MONTHS[lang][month]} ${year}`
}

/** "Settembre" · "September" — il nome del mese da solo, per le intestazioni
 *  della cronologia, dove l'anno sta già nella riga sopra. */
export function fmtMese(month: number, lang: Lang = getLang()): string {
  return MONTHS[lang][month] ?? ''
}

/** Le iniziali dei sette giorni, da lunedì.
 *
 *  La lingua si può passare esplicitamente: chi chiama da dentro un `useMemo` ha
 *  così una dipendenza VERA da mettere nell'array, invece di una funzione che
 *  legge la lingua di nascosto e un `eslint-disable` a coprire il buco. */
export function daysShort(lang: Lang = getLang()): readonly string[] {
  return DAYS_SHORT[lang]
}


// Indice 0-11 del mese di una data ISO (`-1` se la stringa non è una data).
function monthIndex(iso: string): number {
  const m = Number(iso.split('-')[1])
  return Number.isFinite(m) ? m - 1 : -1
}

/** "19 ago" · "19 Aug" — etichetta compatta per periodi, range e sottotitoli. */
export function fmtDayMon(iso: string): string {
  const mi = monthIndex(iso)
  if (mi < 0) return iso
  return `${Number(iso.split('-')[2])} ${MONTHS_SHORT[getLang()][mi]}`
}

/** "19 Agosto" · "19 August" — forma estesa, per i titoli di giornata. */
export function fmtDayMonthFull(iso: string): string {
  const mi = monthIndex(iso)
  if (mi < 0) return iso
  return `${Number(iso.split('-')[2])} ${MONTHS[getLang()][mi]}`
}

/** "19/08/26" — forma numerica compatta usata negli storici, uguale nelle due
 *  lingue.
 *
 * Non usa `new Date(iso).toLocaleDateString()`: quel costruttore interpreta
 * "YYYY-MM-DD" come mezzanotte UTC, e a ovest di Greenwich stampa il giorno
 * PRIMA. Era la quinta copia della stessa riga sparsa nei file della palestra. */
export function fmtShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`
}

/** "21/08" — giorno e mese soli. Sull'asse dei grafici l'anno è
 *  ridondante (la serie è cronologica) e costa tre caratteri per punto: senza,
 *  le date ci stanno tutte invece di essere diradate una sì e due no. */
export function fmtDayMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}`
}



/** "14:32" · "ieri 14:32" · "19/08 14:32" — quando è arrivato un messaggio.
 *
 *  Tre forme e non una perché in una conversazione la distanza che conta cambia
 *  col tempo: di oggi si vuole l'ora, di ieri si vuole sapere che era ieri, e più
 *  indietro l'ora non dice più niente ma il giorno sì. Una data intera su ogni
 *  riga di oggi sarebbe rumore su tutte le righe che si leggono davvero.
 *
 *  Prende un timestamp completo (quello che scrive Postgres), non una "YYYY-MM-DD":
 *  qui il fuso serve, ed è quello del telefono — l'ora di un messaggio è l'ora in
 *  cui lo si è ricevuto, non l'ora UTC. */
export function fmtQuando(iso: string, adesso = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const ora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  // Il confronto è fra GIORNI di calendario, non fra "meno di 24 ore fa": un
  // messaggio dell'una di notte non è "ieri" alle due di notte.
  const giorno = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const scarto = Math.round((giorno(adesso) - giorno(d)) / 86_400_000)
  if (scarto === 0) return ora
  if (scarto === 1) return `${getLang() === 'en' ? 'yesterday' : 'ieri'} ${ora}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${ora}`
}
