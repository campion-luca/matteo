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
        description: 'Allenamenti e strumenti personali in una sola PWA.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        // Stessi valori della <meta name="theme-color"> in index.html: il tema
        // di default è la carta avorio, e un nero qui faceva lampeggiare la
        // splash dell'app installata prima del primo frame.
        theme_color: '#e9e3d4',
        background_color: '#e9e3d4',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Niente skipWaiting/clientsClaim: col pattern 'prompt' il nuovo SW resta in
        // attesa finché l'utente non conferma l'aggiornamento (updateSW(true)).
        cleanupOutdatedCaches: true,
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
