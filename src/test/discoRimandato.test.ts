import { describe, it, expect, beforeEach } from 'vitest'
import { useJarvisStore, EMPTY_STATE, JARVIS_STORE_KEY, scriviSuDisco } from '@/store/useJarvisStore'

// Lo store non si scrive più su disco a ogni modifica: aspetta un attimo di
// quiete, e parte subito quando l'app va in background. Qui si tengono fermi i
// due modi in cui un rinvio può far danni: perdere l'ultima modifica, o far
// ricomparire su disco un blob appena cancellato.

const suDisco = () => {
  const raw = localStorage.getItem(JARVIS_STORE_KEY)
  return raw ? JSON.parse(raw).state : null
}

beforeEach(() => {
  useJarvisStore.setState({ ...EMPTY_STATE }, true)
  scriviSuDisco()
  localStorage.clear()
})

describe('scrittura dello store su disco', () => {
  it('non scrive dentro il tocco, e poi scrive l’ULTIMO stato', () => {
    useJarvisStore.setState({ userName: 'Primo' })
    useJarvisStore.setState({ userName: 'Secondo' })
    expect(suDisco()).toBeNull()
    scriviSuDisco()
    expect(suDisco().userName).toBe('Secondo')
  })

  it('andando in background scrive subito', () => {
    useJarvisStore.setState({ userName: 'Luca' })
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    expect(suDisco().userName).toBe('Luca')
  })

  it('al logout il blob non ricompare dopo essere stato cancellato', () => {
    useJarvisStore.setState({ userName: 'Luca' })
    scriviSuDisco()
    useJarvisStore.setState({ ...EMPTY_STATE })
    useJarvisStore.persist.clearStorage()
    scriviSuDisco()
    expect(localStorage.getItem(JARVIS_STORE_KEY)).toBeNull()
  })
})
