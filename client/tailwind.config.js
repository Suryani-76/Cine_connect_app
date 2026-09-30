/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ── Typography ──────────────────────────────────────────
      fontFamily: {
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], // headings use heavy Inter
        mono:  ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },

      // ── Colour palette ──────────────────────────────────────
      colors: {
        brand: {
          DEFAULT: '#1F6FEB',   // bright blue — primary CTA
          light:   '#4D8FF0',   // lighter blue — hover
          dark:    '#1558C0',   // darker blue — active
          navy:    '#0B2545',   // deep navy — headings / logo
          'navy-2':'#14294F',   // alternate navy
          teal:    '#0EA5E9',   // teal-blue — accent
        },
        surface: {
          base:    '#FFFFFF',   // white — page background
          section: '#F5F7FA',   // light gray — section backgrounds
          raised:  '#FFFFFF',   // white — card background
          overlay: '#F5F7FA',   // light gray — inputs, elevated
          border:  '#E2E8F0',   // cool gray — default border
          subtle:  '#CBD5E1',   // slightly darker border
        },
        content: {
          primary:   '#1A1A2E',  // dark slate — body text
          heading:   '#0B2545',  // deep navy — headings
          secondary: '#475569',  // slate-600 — secondary text
          tertiary:  '#94A3B8',  // slate-400 — muted / placeholders
          muted:     '#CBD5E1',  // slate-300 — disabled / very muted
          inverse:   '#FFFFFF',  // white — text on dark backgrounds
        },
      },

      // ── Type scale ──────────────────────────────────────────
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs:    ['0.75rem',  { lineHeight: '1rem'     }],
        sm:    ['0.875rem', { lineHeight: '1.25rem'  }],
        base:  ['1rem',     { lineHeight: '1.5rem'   }],
        lg:    ['1.125rem', { lineHeight: '1.75rem'  }],
        xl:    ['1.25rem',  { lineHeight: '1.75rem'  }],
        '2xl': ['1.5rem',   { lineHeight: '2rem'     }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem'  }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem'   }],
        '5xl': ['3rem',     { lineHeight: '1'        }],
      },

      // ── Border radius ───────────────────────────────────────
      borderRadius: {
        btn:   '7px',    // 6–8px for buttons/inputs per spec
        card:  '12px',
        lg:    '8px',
        xl:    '12px',
        '2xl': '16px',
      },

      // ── Shadows ─────────────────────────────────────────────
      boxShadow: {
        card:       '0 1px 3px rgba(11,37,69,0.08), 0 1px 2px rgba(11,37,69,0.06)',
        'card-md':  '0 4px 16px rgba(11,37,69,0.10)',
        'card-hover':'0 8px 24px rgba(11,37,69,0.12)',
        'btn-glow': '0 0 0 3px rgba(31,111,235,0.25)',
        nav:        '0 1px 0 0 #E2E8F0',
      },
    },
  },
  plugins: [],
}
