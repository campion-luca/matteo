import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        border: 'hsl(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Jarvis Office/Paper design tokens
        j: {
          bg:           'var(--bg)',
          surface:      'var(--surface)',
          'surface-2':  'var(--surface-2)',
          'input-bg':   'var(--input-bg)',
          fg:           'var(--fg)',
          'fg-soft':    'var(--fg-soft)',
          'fg-mute':    'var(--fg-mute)',
          hairline:     'var(--hairline)',
          accent:       'var(--j-accent)',
          'accent-fg':  'var(--j-accent-fg)',
          'accent-ink': 'var(--j-accent-ink)',
          // legacy aliases kept for gradual migration
          ink:          'var(--fg)',
          dim:          'var(--fg-soft)',
          faint:        'var(--fg-mute)',
          card:         'var(--surface)',
          'card-strong':'var(--surface-2)',
          'accent-soft':'var(--j-accent-soft)',
          'accent-deep':'var(--j-accent-deep)',
        },
      },
      fontFamily: {
        sans:    ["'Inter'", 'system-ui', 'sans-serif'],
        serif:   ["'Fraunces'", 'Georgia', 'serif'],
        display: ["'Fraunces'", 'Georgia', 'serif'],
      },
      borderRadius: {
        lg:       'var(--radius)',
        md:       'var(--radius)',
        sm:       'var(--radius)',
        'j-card': '0',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop:  'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
} satisfies Config
