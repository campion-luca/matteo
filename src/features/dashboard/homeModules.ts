// Quali moduli mostra la home, e in che ordine.
//
// Vive in localStorage e NON nello store cloud: è una preferenza del singolo
// dispositivo, non un dato da sincronizzare.
// Sta in un file suo — e non più dentro `JarvisDashboard` — da quando il gestore
// dei widget è nel menù utente: home e profilo sono montati insieme, e con un
// `useState` per ciascuno il riordino fatto nel profilo non arrivava alla home
// finché non si ricaricava la pagina. Qui la sorgente è una sola, e chi la
// modifica sveglia entrambi.
import { useSyncExternalStore } from 'react'
import { readStorage, writeStorage, removeStorage } from '@/lib/safeStorage'
import { t } from '@/lib/i18n'

export interface HomeModule { id: string; on: boolean }

// L'ordine di questo array È l'ordine di default della home (non c'è un campo
// `order`).
export const ALL_MODULES = [
  { id: 'weekDots', label: 'La tua settimana',  defaultOn: true },
  // La ricerca sta in alto perché è un COMANDO, non un dato: sotto due schede di
  // numeri diventava la cosa che si scorre per raggiungere, mentre è quella con
  // cui si comincia quando si sa già dove si vuole andare.
  { id: 'search',   label: 'Ricerca globale',   defaultOn: true },
  { id: 'bodyMap',  label: 'Mappa della forza', defaultOn: true },
  { id: 'maxLifts', label: 'Massimali',         defaultOn: true },
  // 'weeklyReview' è stato rimosso: diceva le stesse cose de "La tua settimana"
  // più il volume, che è un numero senza un metro con cui confrontarlo — e per
  // quello ci sono i grafici. `load()` scarta da sé gli id che non sono più qui,
  // quindi chi ce l'aveva salvato in layout non vede un buco.
]

// Il bump serve a far comparire i moduli nuovi nella posizione voluta. Senza,
// il caricamento li appenderebbe in fondo al layout già salvato e la settimana —
// che è il colpo d'occhio della home — finirebbe sotto tutto il resto.
const MODULES_KEY = 'jarvis-modules-v8'
const LEGACY_MODULES_KEYS = ['jarvis-modules-v2', 'jarvis-modules-v3', 'jarvis-modules-v4', 'jarvis-modules-v5', 'jarvis-modules-v6', 'jarvis-modules-v7']

// Le `label` in `ALL_MODULES` restano scritte in italiano: sono le chiavi del
// dizionario, e questa costante nasce una volta all'import. La traduzione avviene
// qui, all'uscita, che è l'unico punto da cui i nomi dei moduli raggiungono lo schermo.
export function moduleLabel(id: string): string {
  const label = ALL_MODULES.find(m => m.id === id)?.label
  return label ? t(label) : id
}

function load(): HomeModule[] {
  try {
    const raw = readStorage('local', MODULES_KEY)
    if (!raw) throw 0
    const arr: HomeModule[] = JSON.parse(raw)
    const have = new Set(arr.map(m => m.id))
    ALL_MODULES.forEach(m => { if (!have.has(m.id)) arr.push({ id: m.id, on: m.defaultOn }) })
    const known = new Set(ALL_MODULES.map(m => m.id))
    return arr.filter(m => known.has(m.id))
  } catch {
    LEGACY_MODULES_KEYS.forEach(k => removeStorage('local', k))
    return ALL_MODULES.map(m => ({ id: m.id, on: m.defaultOn }))
  }
}

let current: HomeModule[] | null = null
const listeners = new Set<() => void>()

// `useSyncExternalStore` pretende un riferimento STABILE: ricalcolare `load()` a
// ogni chiamata restituirebbe un array nuovo ogni volta e React entrerebbe in un
// ciclo di render infinito.
function snapshot(): HomeModule[] {
  if (!current) current = load()
  return current
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setHomeModules(update: (mods: HomeModule[]) => HomeModule[]): void {
  const next = update(snapshot())
  if (next === current) return
  current = next
  writeStorage('local', MODULES_KEY, JSON.stringify(next))
  listeners.forEach(l => l())
}

export function useHomeModules(): HomeModule[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

// Il riordino e l'accensione, condivisi da chiunque disegni il gestore.
export function moveHomeModule(id: string, dir: number): void {
  setHomeModules(ms => {
    const idx = ms.findIndex(m => m.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= ms.length) return ms
    const copy = [...ms]
    const [item] = copy.splice(idx, 1)
    copy.splice(to, 0, item)
    return copy
  })
}

export function reorderHomeModules(fromId: string, toId: string): void {
  setHomeModules(ms => {
    const from = ms.findIndex(x => x.id === fromId)
    const to   = ms.findIndex(x => x.id === toId)
    if (from < 0 || to < 0 || from === to) return ms
    const copy = [...ms]
    const [item] = copy.splice(from, 1)
    copy.splice(to, 0, item)
    return copy
  })
}

export function toggleHomeModule(id: string): void {
  setHomeModules(ms => ms.map(m => m.id === id ? { ...m, on: !m.on } : m))
}
