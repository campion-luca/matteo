import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { temaScelto, temaScuro, scegliTema } from '@/lib/tema'

// Il tema sta sul telefono (localStorage), e lo applica l'attributo
// `data-tema` su <html>: i colori li cambia globals.css.

const INDEX = Object.values(import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true }))[0] as string
const CSS = Object.values(import.meta.glob('/src/styles/globals.css', { query: '?raw', import: 'default', eager: true }))[0] as string
const fondo = (apertura: string) => CSS.slice(CSS.indexOf(apertura)).match(/--bg:\s*(#[0-9A-Fa-f]{6})/)?.[1]

function sistema(scuro: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(q => ({
    media: q, matches: scuro && q.includes('dark'), onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

describe('il tema', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.tema
    document.head.innerHTML = '<meta name="theme-color" content="#F1F1EF">'
  })
  afterEach(() => vi.restoreAllMocks())

  it('di serie è il chiaro, anche col telefono scuro', () => {
    sistema(true)
    expect(temaScelto()).toBe('chiaro')
    expect(temaScuro()).toBe(false)
  })

  it('«Scuro» mette l’attributo su <html> e scurisce la barra di stato', () => {
    scegliTema('scuro')
    expect(document.documentElement.dataset.tema).toBe('scuro')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0B0B0B')
    scegliTema('chiaro')
    expect(document.documentElement.dataset.tema).toBeUndefined()
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F1F1EF')
  })

  it('«Automatico» segue il telefono', () => {
    sistema(true)
    scegliTema('auto')
    expect(document.documentElement.dataset.tema).toBe('scuro')
    sistema(false)
    scegliTema('auto')
    expect(document.documentElement.dataset.tema).toBeUndefined()
  })

  it('un valore che non conosce vale chiaro', () => {
    localStorage.setItem('jarvis-tema', 'neon')
    expect(temaScelto()).toBe('chiaro')
  })

  // Lo script in index.html lo applica prima di React, o la pagina
  // lampeggerebbe chiara: deve leggere la stessa chiave e dare lo stesso fondo.
  it('lo script d’avvio in index.html legge la stessa chiave', () => {
    expect(INDEX).toContain("localStorage.getItem('jarvis-tema')")
    expect(INDEX).toContain("'#0B0B0B'")
  })

  // La barra di stato prende il colore del fondo: se cambia il fondo in
  // globals.css va cambiato anche in lib/tema.ts e in index.html.
  it('la barra di stato ha il colore del fondo, chiaro e scuro', () => {
    expect(fondo(':root {')).toBe('#F1F1EF')
    expect(fondo(':root[data-tema="scuro"] {')).toBe('#0B0B0B')
  })
})
