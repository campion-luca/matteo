import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Matteo',
        short_name: 'Matteo',
        description: 'Allenamenti in palestra: schede, alzate, carichi consigliati e un allenatore che ti segue.',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Il fondo dell'app, il cemento di `--bg` in globals.css: il tema è uno
        // solo. Stesso valore della <meta name="theme-color"> in index.html. È
        // anche il colore della schermata d'avvio dell'app installata, prima del
        // primo frame: diverso dal fondo, la si vedrebbe lampeggiare.
        theme_color: '#F1F1EF',
        background_color: '#F1F1EF',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Niente skipWaiting/clientsClaim: col pattern 'prompt' il nuovo SW resta in
        // attesa finché l'utente non conferma l'aggiornamento (updateSW(true)).
        cleanupOutdatedCaches: true,
        // Le notifiche push: il service worker lo genera workbox, e qui gli si
        // aggiunge il pezzo che le riceve (public/push-sw.js). È un file a sé e
        // non un service worker scritto a mano perché tutto il resto — la
        // cache, l'aggiornamento su conferma — resta com'è.
        importScripts: ['/push-sw.js'],
        // Le estensioni delle foto degli esercizi (src/assets/esercizi) vanno
        // tutte tenute qui dentro: dimenticarne una vuol dire immagini rotte al
        // primo uso offline, cioè in palestra, dove il telefono spesso non
        // prende. Un'estensione in più non costa nulla; scoprire perché manca
        // costa un pomeriggio.
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
