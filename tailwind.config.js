/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        sign: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#0b1118', 900: '#111a24', 800: '#18232f', 700: '#223141', 600: '#2f4256' },
        route: { DEFAULT: '#3b9cff', soft: '#1b3a5c' },
        go: { DEFAULT: '#2dd4a0', soft: '#0f3a30' },
        warn: { DEFAULT: '#fbbf24', soft: '#3d2e0a' },
        halt: { DEFAULT: '#f87171', soft: '#3f1717' },
      },
    },
  },
  plugins: [],
};
