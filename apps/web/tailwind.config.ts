import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        surface: {
          DEFAULT: '#0f172a',
          50:  '#1e293b',
          100: '#0f172a',
          200: '#0d1117',
          900: '#020617',
        },
        muted: '#475569',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
        'slide-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)'    },
        },
        'float-a': {
          '0%, 100%': { transform: 'translateY(0px)'   },
          '50%':      { transform: 'translateY(-10px)' },
        },
        'float-b': {
          '0%, 100%': { transform: 'translateY(0px)'  },
          '50%':      { transform: 'translateY(8px)'  },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.3s ease both',
        'slide-right':'slide-right 0.25s ease both',
        'float-a':    'float-a 5s ease-in-out infinite',
        'float-b':    'float-b 6s ease-in-out infinite',
        spin:         'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
