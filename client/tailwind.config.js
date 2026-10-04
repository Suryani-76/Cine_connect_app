/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // ── Typography ──────────────────────────────────────────
      fontFamily: {
        sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4 Variable"', '"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      // ── CineConnect Film-Set Token Palette ──────────────────
      colors: {
        ink: 'var(--color-ink)',
        paper: 'var(--color-paper)',
        surface: 'var(--color-surface)',
        tungsten: 'var(--color-tungsten)',
        line: 'var(--color-line)',
        muted: 'var(--color-muted)',
        gel: {
          camera: 'var(--color-gel-camera)',
          sound: 'var(--color-gel-sound)',
          editing: 'var(--color-gel-editing)',
          art: 'var(--color-gel-art)',
          cast: 'var(--color-gel-cast)',
          production: 'var(--color-gel-production)',
        },
        status: {
          success: 'var(--color-status-success)',
          warning: 'var(--color-status-warning)',
          error: 'var(--color-status-error)',
        },
      },

      // ── Type Scale (Brief: 12, 14, 16, 18, 22, 28, 40, 56 px) ──
      fontSize: {
        '12': ['12px', { lineHeight: '16px' }],
        '14': ['14px', { lineHeight: '20px' }],
        '16': ['16px', { lineHeight: '24px' }],
        '18': ['18px', { lineHeight: '26px' }],
        '22': ['22px', { lineHeight: '28px' }],
        '28': ['28px', { lineHeight: '34px' }],
        '40': ['40px', { lineHeight: '46px' }],
        '56': ['56px', { lineHeight: '62px' }],

        // Semantic aliases aligned strictly to the 8-step scale:
        '2xs': ['12px', { lineHeight: '16px' }],
        xs:    ['12px', { lineHeight: '16px' }],
        sm:    ['14px', { lineHeight: '20px' }],
        base:  ['16px', { lineHeight: '24px' }],
        lg:    ['18px', { lineHeight: '26px' }],
        xl:    ['22px', { lineHeight: '28px' }],
        '2xl': ['28px', { lineHeight: '34px' }],
        '3xl': ['40px', { lineHeight: '46px' }],
        '4xl': ['56px', { lineHeight: '62px' }],
        '5xl': ['56px', { lineHeight: '62px' }],
      },

      // ── Border Radius (Strict 3px data / 10px floating) ────
      borderRadius: {
        none: '0px',
        sm: '3px',
        DEFAULT: '3px',
        md: '3px',
        btn: '3px',
        input: '3px',
        row: '3px',
        card: '3px',
        lg: '10px',
        xl: '10px',
        '2xl': '10px',
        modal: '10px',
        sheet: '10px',
        full: '9999px',
      },

      // ── Single Soft Shadow for Floating Menus/Modals ────────
      boxShadow: {
        none: 'none',
        floating: 'var(--shadow-floating)',
        DEFAULT: 'var(--shadow-floating)',
        card: 'none',
        'card-md': 'var(--shadow-floating)',
        'card-hover': 'none',
      },
    },
  },
  plugins: [],
}
