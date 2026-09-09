import '@testing-library/jest-dom'

// jsdom non implementa matchMedia, e `useIsDesktop` la chiama al primo render:
// senza questo, montare un qualsiasi componente dell'app esplode. Il finto
// risponde sempre "no", cioè mobile — il layout su cui l'app è pensata.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},      // deprecata, ma qualche libreria la usa ancora
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}
