/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identité de marque Livrechap
        orange: '#F97316',
        navy: '#14213D',
      },
    },
  },
  plugins: [],
};
