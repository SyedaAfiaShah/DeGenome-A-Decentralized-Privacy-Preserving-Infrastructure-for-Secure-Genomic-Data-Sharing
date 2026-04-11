/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void:   '#050810',
        ink:    '#0b1120',
        panel:  '#111827',
        edge:   '#1e2d45',
        cyan:   { DEFAULT: '#00e5cc', dim: '#00b8a4', ghost: 'rgba(0,229,204,0.08)' },
        acid:   '#b5ff4d',
        muted:  '#8899aa',
        soft:   '#c8d6e5',
      },
      fontFamily: {
        display: ['"DM Mono"', 'monospace'],
        body:    ['"IBM Plex Sans"', 'sans-serif'],
        mono:    ['"DM Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.4s ease forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
