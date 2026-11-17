/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Text and neutral tones (slate). 50 is the darkest, 900 the lightest.
        ink: {
          50: '#0f172a',
          100: '#1e293b',
          200: '#334155',
          300: '#475569',
          400: '#64748b',
          500: '#94a3b8',
          600: '#cbd5e1',
          700: '#e2e8f0',
          800: '#f1f5f9',
          900: '#f8fafc',
        },
        // Research and Innovation Authority red, taken from the logo.
        brand: {
          DEFAULT: '#c8102e',
          50: '#fdf2f3',
          100: '#fbe4e7',
          200: '#f6c9cf',
          300: '#ee9fa9',
          400: '#e1606f',
          500: '#d4283f',
          600: '#c8102e',
          700: '#a50d26',
          800: '#870b20',
          900: '#6e0a1b',
        },
        // Warm off-white page background used on the login brand panel.
        paper: '#faf7f5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
