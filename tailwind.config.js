/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#080810',
          2: '#0e0e1a',
          3: '#14141f',
          4: '#1a1a28',
          5: '#20202f',
        },
        blue: {
          DEFAULT: '#3b82f6',
          dim: '#1d4ed8',
          bright: '#60a5fa',
        },
        red: {
          DEFAULT: '#ef4444',
          dim: '#dc2626',
          bright: '#f87171',
        },
        gold: '#f59e0b',
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['var(--font-barlow)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-barlow-condensed)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
