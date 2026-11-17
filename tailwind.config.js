/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#1e3a5f',
          100: '#2a4a72',
          200: '#3b5d83',
          300: '#5a7a9e',
          400: '#7b97b8',
          500: '#9bb5d0',
          600: '#b8cde0',
          700: '#d0e0ee',
          800: '#e0ecf7',
          900: '#eef4fb',
        },
        teal: {
          glow: '#0d9488',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
