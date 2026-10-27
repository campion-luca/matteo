// Chiaro o scuro.
//
// La scelta sta sul telefono e non nell'account, al contrario della lingua: è
// un'impostazione del dispositivo, come la luminosità. Chi tiene il telefono
// scuro e il computer chiaro la vuole diversa sui due. E fuori dal blob non
// passa da `STATE_KEYS` né da `versioneDati`: un'app vecchia non ha niente da
// togliere.
//
// I colori stanno in globals.css: `:root` è il chiaro, `:root[data-tema="scuro"]`
// lo scuro. Qui si sceglie solo quale vale, mettendo l'attributo su <html>. Lo
// stesso conto lo fa uno script in index.html prima che parta React, o al primo
// frame la pagina lampeggerebbe chiara: le due copie vanno tenute allineate.
import { useSyncExternalStore } from 'react'
import { readStorage, writeStorage } from './safeStorage'

export type Tema = 'chiaro' | 'scuro' | 'auto'
export const TEMI: readonly Tema[] = ['chiaro', 'scuro', 'auto']

const KEY = 'jarvis-tema'

// Il fondo dei due temi (`--bg` in globals.css): è il colore della barra di
// stato e della barra del browser.
const FONDO = { chiaro: '#F1F1EF', scuro: '#0B0B0B' } as const

/** Quello che si è scelto. Di serie il chiaro: l'app è nata chiara, e chi non
 *  ha mai toccato niente la ritrova com'era. */
export function temaScelto(): Tema {
  const v = readStorage('local', KEY)
  return v === 'scuro' || v === 'auto' ? v : 'chiaro'
}

function sistemaScuro(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches } catch { return false }
}

/** Il tema che vale adesso: con «Automatico» quello del telefono. */
export function temaScuro(scelto: Tema = temaScelto()): boolean {
  return scelto === 'scuro' || (scelto === 'auto' && sistemaScuro())
}

const ascolta = new Set<() => void>()

function applica(): void {
  const scuro = temaScuro()
  const radice = document.documentElement
  if (scuro) radice.dataset.tema = 'scuro'
  else delete radice.dataset.tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', scuro ? FONDO.scuro : FONDO.chiaro)
  ascolta.forEach(f => f())
}

export function scegliTema(t: Tema): void {
  writeStorage('local', KEY, t)
  applica()
}

/** All'avvio (main.tsx): rimette il tema e da lì segue il telefono. Con
 *  «Automatico» il passaggio al buio della sera arriva ad app aperta, senza
 *  riaprirla. */
export function avviaTema(): void {
  applica()
  try {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => { if (temaScelto() === 'auto') applica() })
  } catch { /* senza matchMedia «Automatico» resta chiaro */ }
}

function iscrivi(f: () => void): () => void {
  ascolta.add(f)
  return () => { ascolta.delete(f) }
}

/** La scelta e il tema in vigore, per chi disegna qualcosa che dipende dal
 *  fondo: si ridisegna quando cambiano. */
export function useTema(): { scelto: Tema; scuro: boolean } {
  const scelto = useSyncExternalStore(iscrivi, temaScelto)
  const scuro = useSyncExternalStore(iscrivi, () => temaScuro(scelto))
  return { scelto, scuro }
}
