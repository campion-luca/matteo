import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useJarvisStore, EMPTY_STATE } from '@/store/useJarvisStore'
import { t, tData, translate, getLang } from '@/lib/i18n'
import { DE_UI, DE_DATA } from '@/lib/i18n.de'
import { fmtDayMon, fmtDayMonthFull, fmtShortDate, fmtDayMonth, fmtMonthYear, daysShort } from '@/lib/dateFormat'
import { isoWeekLabel } from '@/lib/isoDate'

const setLang = (lang: 'it' | 'de') => useJarvisStore.setState({ lang })

// ── Le chiavi usate davvero dal codice ─────────────────────────
// Il dizionario si allinea a mano al codice, e a mano si sbaglia: una `t()`
// aggiunta e non tradotta esce in italiano dentro una schermata tedesca, e nessuno
// se ne accorge finché non la si guarda. Questo test rilegge i sorgenti e chiede
// che ogni chiave abbia una voce.
//
// I file si leggono con `import.meta.glob` e non con `node:fs`: il `tsc` della
// build compila anche questa cartella, e importare i moduli di Node vorrebbe dire
// aggiungere `@types/node` alle dipendenze per un test solo. Il glob è già dentro
// Vite, ed è risolto a build-time.
const SORGENTI = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>

// I test stessi restano fuori: qui dentro le `t('…')` sono casi di prova.
const FILE = Object.keys(SORGENTI).filter(p => !p.startsWith('/src/test/')).sort()

// Solo `t(...)`/`tr(...)`/`translate(lang, ...)` con una stringa LETTERALE.
const CHIAMATA = /(?<![A-Za-z0-9_$.])(?:t|tr|translate)\(\s*(?:target\s*,\s*)?'([^']*)'/g

// Ogni stringa fra apici singoli, per i file elencati qui sotto.
const QUALSIASI = /'([^'\n]*)'/g

// I file che tengono le frasi in costanti di modulo e le traducono al momento di
// disegnarle (`t(m.what)`, `t(hint.title)`, `t(opt.label)`…). Lì la chiave non è
// visibile nella chiamata: sta nella costante, e va raccolta da quella.
const COSTANTI = [
  '/src/components/CoachMark.tsx',
  '/src/features/auth/FirstSetup.tsx',
  '/src/features/dashboard/homeModules.ts',
  '/src/features/gym/gymMaxLifts.ts',
  '/src/features/gym/gymModel.ts',
  '/src/features/gym/gymStrength.ts',
  '/src/features/profile/JarvisProfile.tsx',
  '/src/lib/metricInfo.ts',
]

// Via i commenti: dentro ce ne sono che citano `t('…')` come esempio.
function codiceDi(file: string): string {
  return (SORGENTI[file] ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(r => !r.trim().startsWith('//'))
    .map(r => (r.includes('//') && !r.includes('http') ? r.slice(0, r.indexOf('//')) : r))
    .join('\n')
}

/** Le chiavi scritte per esteso dentro una `t()`. Elenco ESATTO: è quello su cui
 *  si misura se una traduzione manca. */
function chiaviUsate(): Map<string, string> {
  const trovate = new Map<string, string>()
  for (const file of FILE) {
    for (const m of codiceDi(file).matchAll(CHIAMATA)) {
      if (m[1] && !trovate.has(m[1])) trovate.set(m[1], file)
    }
  }
  return trovate
}

/** Le precedenti più ogni stringa dei file che tengono le frasi in costanti.
 *  Elenco LARGO — ci finisce dentro anche qualcosa che chiave non è — e va bene
 *  così: serve solo a dire se una voce del dizionario non è più agganciata a
 *  niente, e allargarlo può al più nascondere un'orfana, mai inventarne una. */
function chiaviRaggiungibili(): Set<string> {
  const out = new Set(chiaviUsate().keys())
  for (const file of COSTANTI) {
    for (const m of codiceDi(file).matchAll(QUALSIASI)) out.add(m[1])
  }
  return out
}

describe('dizionario tedesco', () => {
  it('traduce ogni chiave che il codice usa', () => {
    const usate = chiaviUsate()
    const senza = [...usate].filter(([k]) => !(k in DE_UI)).map(([k, f]) => `${k}  (${f})`)
    expect(senza, 'chiavi senza traduzione tedesca').toEqual([])
  })

  it('non contiene voci che nessuno usa più', () => {
    // Una voce orfana non rompe niente, ma è il segno di una frase cambiata nel
    // codice e non nel dizionario: da lì in poi quella schermata resta italiana.
    const raggiungibili = chiaviRaggiungibili()
    const orfane = Object.keys(DE_UI).filter(k => !raggiungibili.has(k))
    expect(orfane, 'voci del dizionario non più usate').toEqual([])
  })

  it('conserva i segnaposto della frase originale', () => {
    // `{n}` che sparisce nella traduzione è un numero che non compare più a
    // schermo, e `{nn}` scritto storto stampa la graffa così com'è.
    const segnaposto = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    const rotte: string[] = []
    for (const [it, de] of Object.entries(DE_UI)) {
      const a = segnaposto(it).join(',')
      const b = segnaposto(de).join(',')
      if (a !== b) rotte.push(`${it}  →  it:[${a}] de:[${b}]`)
    }
    expect(rotte, 'segnaposto non corrispondenti').toEqual([])
  })

  it('non ha traduzioni vuote né rimaste in italiano', () => {
    const vuote = Object.entries(DE_UI).filter(([, de]) => de.trim() === '').map(([it]) => it)
    expect(vuote).toEqual([])
    // Qualche voce coincide per forza (nomi propri, sigle): l'elenco è chiuso, e
    // una nuova coincidenza va guardata invece di passare in silenzio.
    const uguali = Object.entries(DE_UI).filter(([it, de]) => it === de).map(([it]) => it)
    expect(uguali.sort()).toEqual([
      'Budget', 'Hyrox', 'Journal', 'Kg', 'Light weight baby', 'Pace',
      'Personal Coach', 'Personal OS', 'Standard', 'Total', 'Trend',
    ])
  })
})

describe('traduzione', () => {
  beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))
  afterEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))

  it('senza lingua salvata parla italiano', () => {
    expect(getLang()).toBe('it')
    expect(t('Salva')).toBe('Salva')
  })

  it('in tedesco pesca dal dizionario', () => {
    setLang('de')
    expect(t('Salva')).toBe('Speichern')
    expect(t('Impostazioni')).toBe('Einstellungen')
  })

  it('riempie i segnaposto in tutte e due le lingue', () => {
    expect(t('{n} esercizi', { n: 7 })).toBe('7 esercizi')
    setLang('de')
    expect(t('{n} esercizi', { n: 7 })).toBe('7 Übungen')
  })

  it('una chiave senza traduzione ricade sull’italiano invece di sparire', () => {
    setLang('de')
    expect(t('Questa frase non è nel dizionario')).toBe('Questa frase non è nel dizionario')
  })

  it('toglie il prefisso di contesto quando la voce manca', () => {
    // Il fallback deve mostrare la frase, mai il contesto che la disambigua.
    expect(t('grafico|Carico')).toBe('Carico')
    setLang('de')
    expect(t('grafico|Carico')).toBe('Carico')
  })

  it('lascia in piedi un segnaposto senza valore invece di stampare "undefined"', () => {
    expect(translate('it', 'ne mancano {n}')).toBe('ne mancano {n}')
  })
})

// ── I nomi che vivono nei dati ─────────────────────────────────
describe('nomi di esercizi e gruppi muscolari', () => {
  beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))
  afterEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))

  it('traduce quelli del catalogo', () => {
    setLang('de')
    expect(tData('Petto')).toBe('Brust')
    expect(tData('Panca piana')).toBe('Bankdrücken')
  })

  it('lascia intatto quello che ha scritto l’utente', () => {
    setLang('de')
    expect(tData('Panca del lunedì di Gigi')).toBe('Panca del lunedì di Gigi')
  })

  it('non tocca i nomi quando la lingua è l’italiano', () => {
    expect(tData('Petto')).toBe('Petto')
  })

  it('non traduce con il dizionario dell’interfaccia', () => {
    // Le due mappe sono separate apposta: un esercizio che qualcuno avesse
    // chiamato "Salva" non deve diventare "Speichern".
    setLang('de')
    expect(tData('Salva')).toBe('Salva')
  })

  it('copre tutti i gruppi muscolari di partenza', () => {
    const gruppi = ['Petto', 'Dorso', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core', 'Gambe', 'Glutei', 'Altro']
    const senza = gruppi.filter(g => !(g in DE_DATA))
    expect(senza, 'gruppi muscolari senza nome tedesco').toEqual([])
  })
})

// ── Date ───────────────────────────────────────────────────────
describe('date nella lingua scelta', () => {
  beforeEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))
  afterEach(() => useJarvisStore.setState({ ...EMPTY_STATE }, true))

  it('in italiano resta tutto com’era', () => {
    expect(fmtDayMon('2026-08-19')).toBe('19 ago')
    expect(fmtShortDate('2026-08-19')).toBe('19/08/26')
    expect(daysShort()[0]).toBe('Lu')
    expect(isoWeekLabel('2026-08-19')).toBe('W34')
  })

  it('in tedesco cambia anche la punteggiatura, non solo le parole', () => {
    setLang('de')
    expect(fmtDayMon('2026-08-19')).toBe('19. Aug')
    expect(fmtDayMonthFull('2026-08-19')).toBe('19. August')
    expect(fmtShortDate('2026-08-19')).toBe('19.08.26')
    expect(fmtDayMonth('2026-08-19')).toBe('19.08.')
    expect(fmtMonthYear('2027-03-01')).toBe('März 2027')
    expect(daysShort()[0]).toBe('Mo')
    // "KW" è la sigla che in Germania sta sui calendari: "W34" lì non si legge
    // come una settimana.
    expect(isoWeekLabel('2026-08-19')).toBe('KW34')
  })

  it('non sposta il giorno nemmeno in tedesco', () => {
    setLang('de')
    expect(fmtShortDate('2026-01-01')).toBe('01.01.26')
    expect(fmtDayMon('2026-01-01')).toBe('1. Jan')
  })

  it('restituisce l’input se non è una data', () => {
    setLang('de')
    expect(fmtShortDate('non-una-data')).toBe('non-una-data')
    expect(fmtDayMon('boh')).toBe('boh')
  })
})
