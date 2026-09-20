/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1c212c',
          950: '#12161e',
          900: '#1c212c',
          800: '#242b38',
          700: '#2e3646',
          600: '#3d4759',
        },
        brand: {
          DEFAULT: '#3131ff',
          soft: '#5a5aff',
          deep: '#1e1eb8',
        },
        mint: {
          DEFAULT: '#518b7b',
          soft: '#6fae9c',
          deep: '#356355',
        },
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,0.35)',
        glow: '0 0 24px rgba(49,49,255,0.45)',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        dash: {
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        ticker: 'ticker 28s linear infinite',
        float: 'float 6s ease-in-out infinite',
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
