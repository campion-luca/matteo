import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // I CSS nei test sono vuoti, tranne questo: il test dei contrasti legge i
    // colori del tema da qui (vedi contrast.test.ts).
    css: { include: [/globals\.css/] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
