// Nomi di mesi e giorni e le formattazioni brevi usate ovunque, nella lingua scelta.
//
// Stavano duplicati in più file (dashboard, ricerca globale), ciascuno
// con la sua copia degli array e la sua versione di "19 ago": tre posti in cui
// cambiare un'abbreviazione, e tre risultati diversi per la stessa data.
// Qui non c'è `Intl`: le etichette sono fisse e volutamente brevi (finiscono in
// celle da poche decine di pixel), e il formato non deve cambiare con la lingua
// del DISPOSITIVO — segue quella scelta nell'app, che è un'altra cosa.
//
// ── Il separatore cambia con la lingua, non solo le parole ─────
// L'italiano scrive "19/08/26" e "19 agosto"; il tedesco scrive "19.08.26" e
// "19. August", col punto che è un ordinale ("il diciannovesimo") e non un
// abbellimento. Una data tedesca con le barre si legge come una data straniera,
// quindi qui cambia anche la punteggiatura.
import { getLang, type Lang } from '@/lib/i18n'

// I mesi già nella forma in cui vanno stampati. In tedesco i nomi dei mesi sono
// sostantivi e restano maiuscoli: non si possono abbassare come in italiano.
const MONTHS: Record<Lang, readonly string[]> = {
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
       'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
}

// Forma breve, già minuscola in italiano: le eyebrow ("13 AGO — 19 AGO") le
// alza il CSS con `text-transform`, non questo file.
const MONTHS_SHORT: Record<Lang, readonly string[]> = {
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
}

// La settimana inizia di lunedì, come la griglia del calendario e la settimana ISO.
const DAYS_SHORT: Record<Lang, readonly string[]> = {
  it: ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'],
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
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

/** "19 ago" · "19. Aug" — etichetta compatta per periodi, range e sottotitoli. */
export function fmtDayMon(iso: string): string {
  const mi = monthIndex(iso)
  if (mi < 0) return iso
  const lang = getLang()
  const giorno = Number(iso.split('-')[2])
  return lang === 'de'
    ? `${giorno}. ${MONTHS_SHORT.de[mi]}`
    : `${giorno} ${MONTHS_SHORT.it[mi]}`
}

/** "19 Agosto" · "19. August" — forma estesa, per i titoli di giornata. */
export function fmtDayMonthFull(iso: string): string {
  const mi = monthIndex(iso)
  if (mi < 0) return iso
  const lang = getLang()
  const giorno = Number(iso.split('-')[2])
  return lang === 'de'
    ? `${giorno}. ${MONTHS.de[mi]}`
    : `${giorno} ${MONTHS.it[mi]}`
}

/** "19/08/26" · "19.08.26" — forma numerica compatta usata negli storici.
 *
 * Non usa `new Date(iso).toLocaleDateString()`: quel costruttore interpreta
 * "YYYY-MM-DD" come mezzanotte UTC, e a ovest di Greenwich stampa il giorno
 * PRIMA. Era la quinta copia della stessa riga sparsa nei file della palestra. */
export function fmtShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return getLang() === 'de'
    ? `${m[3]}.${m[2]}.${m[1].slice(2)}`
    : `${m[3]}/${m[2]}/${m[1].slice(2)}`
}

/** "21/08" · "21.08." — giorno e mese soli. Sull'asse dei grafici l'anno è
 *  ridondante (la serie è cronologica) e costa tre caratteri per punto: senza,
 *  le date ci stanno tutte invece di essere diradate una sì e due no. */
export function fmtDayMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return getLang() === 'de' ? `${m[3]}.${m[2]}.` : `${m[3]}/${m[2]}`
}

/** "marzo 2027" · "März 2027" — mese con anno, per le proiezioni del budget.
 *  In italiano va minuscolo dentro la frase; in tedesco resta maiuscolo. */
export function fmtMonthYear(iso: string): string {
  const mi = monthIndex(iso)
  if (mi < 0) return iso
  const lang = getLang()
  return lang === 'de'
    ? `${MONTHS.de[mi]} ${iso.slice(0, 4)}`
    : `${MONTHS.it[mi].toLowerCase()} ${iso.slice(0, 4)}`
}
