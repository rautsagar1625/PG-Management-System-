import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:          '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover':  '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
        elevated:      '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 4px 8px -2px rgb(0 0 0 / 0.08)',
        glow:          '0 0 0 3px rgb(99 102 241 / 0.15)',
        'glow-green':  '0 0 0 3px rgb(34 197 94 / 0.15)',
        inner:         'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'success-gradient': 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
        'warning-gradient': 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
        'danger-gradient':  'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
        'info-gradient':    'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, #312e81 0%, #4338ca 50%, #4f46e5 100%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-fast': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.25s ease-out both',
        'fade-in-fast':  'fade-in-fast 0.15s ease-out both',
        'slide-in-left': 'slide-in-left 0.25s ease-out both',
        'scale-in':      'scale-in 0.2s ease-out both',
        shimmer:         'shimmer 2s linear infinite',
        'pulse-soft':    'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
