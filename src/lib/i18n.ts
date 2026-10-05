// Traduzione dell'interfaccia. Due lingue: italiano (originale) e inglese.
// (Fino a ott 2026 la seconda era il tedesco: chi l'aveva scelto passa
// all'inglese, vedi `migrateNested` nello store.)
//
// ── Perché la chiave è la frase italiana ───────────────────────
// Il modello è quello di gettext: `t('Salva')`, non `t('profile.save')`. Con
// settecento stringhe sparse in venticinque file, inventare altrettanti nomi
// simbolici significa un dizionario che nessuno riesce a rileggere e una schermata
// che si rompe in silenzio quando una chiave è scritta male — `t('profil.save')`
// non è un errore per il compilatore, è solo una stringa che non esiste.
// Con la frase come chiave il codice resta leggibile senza saltare al dizionario,
// e una voce mancante ricade sull'italiano: peggio dell'inglese, ma leggibile.
//
// ── Il prefisso di contesto ────────────────────────────────────
// Quando la stessa parola italiana ha due traduzioni diverse a seconda di dov'è
// (`Serie` di un esercizio ≠ `Serie` di una scheda), la chiave porta davanti un
// contesto: `t('grafico|Carico')`. Se la voce manca, il fallback mostra quello che
// c'è dopo la barra, mai il prefisso.
import { useMemo } from 'react'
import { useJarvisStore } from '@/store/useJarvisStore'
import { EN_UI, EN_DATA } from './i18n.en'

export type Lang = 'it' | 'en'

export const LANGS: readonly Lang[] = ['it', 'en'] as const

/** Nome della lingua nella lingua stessa: in un selettore di lingua "English"
 *  lo riconosce anche chi non capisce una parola di quelle attorno, "Inglese" no. */
export const LANG_LABELS: Record<Lang, string> = { it: 'Italiano', en: 'English' }

/** Il tag BCP 47 per `<html lang>`, `Intl` e la sintesi vocale. Inglese
 *  britannico: l'app misura in chili e chilometri e scrive le date col giorno
 *  davanti, come l'italiano (vedi dateFormat). */
export const LANG_TAGS: Record<Lang, string> = { it: 'it-IT', en: 'en-GB' }

export type TVars = Record<string, string | number>

export type TFn = (s: string, vars?: TVars) => string

/** Toglie il prefisso di contesto: `'grafico|Carico'` → `'Carico'`. */
function stripContext(key: string): string {
  const i = key.indexOf('|')
  return i < 0 ? key : key.slice(i + 1)
}

/** Sostituisce i segnaposto `{nome}`. Un segnaposto senza valore resta scritto
 *  com'è invece di diventare "undefined": si vede subito ed è innocuo. */
function interpolate(s: string, vars?: TVars): string {
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

export function translate(lang: Lang, key: string, vars?: TVars): string {
  const base = lang === 'en' ? (EN_UI[key] ?? stripContext(key)) : stripContext(key)
  return interpolate(base, vars)
}

/** La lingua corrente, letta fuori da React (moduli non-componente, handler). */
export function getLang(): Lang {
  return useJarvisStore.getState().lang ?? 'it'
}

/** Traduzione fuori da un componente. Dentro un componente usare `useT()`, che
 *  fa anche ridisegnare la schermata quando la lingua cambia. */
export function t(key: string, vars?: TVars): string {
  return translate(getLang(), key, vars)
}

/** La lingua corrente, dentro un componente. Serve dove non basta tradurre una
 *  frase ma cambia una REGOLA — l'ordine delle parole in una data, i nomi dei
 *  giorni — e chi chiama deve ricalcolare quando la lingua cambia. */
export function useLang(): Lang {
  return useJarvisStore(s => s.lang ?? 'it')
}

/** Traduzione dentro un componente: si iscrive alla lingua, quindi al cambio
 *  l'intera schermata si ridisegna senza ricaricare la pagina. */
export function useT(): TFn {
  const lang = useJarvisStore(s => s.lang ?? 'it')
  return useMemo<TFn>(() => (key, vars) => translate(lang, key, vars), [lang])
}

// ── Nomi che vivono nei dati dell'utente ───────────────────────
// Gruppi muscolari ed esercizi del catalogo non sono testo dell'interfaccia: sono
// stringhe COPIATE dentro lo store al primo avvio (vedi `esercizidaCatalogo`), e
// il gruppo muscolare fa pure da chiave dei colori in `muscleColors`. Tradurli
// alla fonte significherebbe spaccare i dati già salvati di chi usa l'app.
//
// Perciò restano italiani nello store e si traducono solo quando si stampano.
// Il dizionario è separato da quello dell'interfaccia di proposito: qui dentro
// passano anche i nomi scritti a mano dall'utente, e un esercizio che qualcuno
// avesse chiamato "Salva" non deve diventare "Save".
export function translateData(lang: Lang, name: string): string {
  if (lang !== 'en') return name
  return EN_DATA[name] ?? EN_DATA[name.trim()] ?? name
}

/** Nome di un esercizio o di un gruppo muscolare, pronto da mostrare. Quello che
 *  il dizionario non conosce — cioè tutto ciò che l'utente ha scritto lui —
 *  esce esattamente com'è stato scritto. */
export function tData(name: string): string {
  return translateData(getLang(), name)
}

/** Come `tData`, ma dentro un componente. */
export function useTData(): (name: string) => string {
  const lang = useJarvisStore(s => s.lang ?? 'it')
  return useMemo(() => (name: string) => translateData(lang, name), [lang])
}
