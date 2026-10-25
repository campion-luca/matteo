import type { Config } from 'tailwindcss'

// Tailwind serve per le utility di layout (flex, gap, spaziature) e per i tre
// colori di base che globals.css applica con `@apply`. I colori, i raggi e le
// ombre dell'app sono variabili CSS in `:root` (globals.css) e si scrivono
// inline: qui c'era un tema intero — alias "legacy", ombre, raggi, i colori
// Jarvis — che dopo il rebranding non generava più nessuna utility usata.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
      },
      fontFamily: {
        sans: ["'Barlow'", 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
